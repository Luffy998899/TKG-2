/* eslint-disable @typescript-eslint/no-explicit-any --
   Rows are untyped by design (like the client this replaces); callers cast
   to their row interfaces where they read them. */
import { DatabaseError } from 'pg';
import { inTransaction, pool, type DbContext } from '@/lib/db/pool';

/* =============================================================================
   A small query builder with the same shape the app was written against
   (from().select().eq()..., rpc()), compiled to parameterised SQL and run as
   the request's database role. It is deliberately narrow:

     * identifiers are checked against /^[a-z_][a-z0-9_]*$/ and quoted;
       every value is a bind parameter - nothing user-typed is ever spliced
       into SQL text;
     * only `public` tables, views and functions are reachable;
     * embedded selects (`customers(full_name)`) follow single-column foreign
       keys, many-to-one, and run as the same role (RLS applies inside them).

   Results resolve to { data, error, count } and never throw for database
   errors, so callers keep checking `error.code` / `error.hint`.
   ========================================================================== */

export interface DbError {
  code: string;
  message: string;
  hint?: string;
  details?: string;
}

export interface DbResult<T = any> {
  data: T;
  error: DbError | null;
  count: number | null;
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (name: string): string => {
  if (!IDENT.test(name)) throw new Error(`invalid identifier: ${name}`);
  return `"${name}"`;
};

function toDbError(error: unknown): DbError {
  if (error instanceof DatabaseError) {
    return { code: error.code ?? 'XX000', message: error.message, hint: error.hint, details: error.detail };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { code: 'unavailable', message };
}

/* ------------------------------------------------------------ catalog */

interface ColumnInfo {
  type: string;
  json: boolean;
}
interface TableInfo {
  columns: Map<string, ColumnInfo>;
  primaryKey: string[];
  /** fk column -> referenced table/column, per referenced table name. */
  references: Map<string, { column: string; refColumn: string }>;
}
interface FunctionInfo {
  args: Map<string, string>;
  returnsRows: boolean;
  returnsVoid: boolean;
}

const tables = new Map<string, Promise<TableInfo>>();
const functions = new Map<string, Promise<FunctionInfo>>();

/** Catalog reads need no table privileges; the pool login runs them as itself. */
function tableInfo(name: string): Promise<TableInfo> {
  let info = tables.get(name);
  if (!info) {
    info = (async () => {
      const columns = await pool().query<{ name: string; type: string }>(
        `select a.attname as name, format_type(a.atttypid, a.atttypmod) as type
           from pg_attribute a
          where a.attrelid = to_regclass($1) and a.attnum > 0 and not a.attisdropped`,
        [`public.${name}`],
      );
      if (!columns.rowCount) throw new Error(`unknown table: ${name}`);
      const pk = await pool().query<{ name: string }>(
        `select a.attname as name
           from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
          where i.indrelid = to_regclass($1) and i.indisprimary`,
        [`public.${name}`],
      );
      const fks = await pool().query<{ column: string; ref_table: string; ref_column: string }>(
        `select a.attname as column, rc.relname as ref_table, ra.attname as ref_column
           from pg_constraint c
           join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
           join pg_class rc on rc.oid = c.confrelid
           join pg_namespace rn on rn.oid = rc.relnamespace and rn.nspname = 'public'
           join pg_attribute ra on ra.attrelid = c.confrelid and ra.attnum = c.confkey[1]
          where c.conrelid = to_regclass($1) and c.contype = 'f' and array_length(c.conkey, 1) = 1`,
        [`public.${name}`],
      );
      const references = new Map<string, { column: string; refColumn: string }>();
      for (const fk of fks.rows) if (!references.has(fk.ref_table)) references.set(fk.ref_table, { column: fk.column, refColumn: fk.ref_column });
      return {
        columns: new Map(columns.rows.map((c) => [c.name, { type: c.type, json: c.type === 'jsonb' || c.type === 'json' }])),
        primaryKey: pk.rows.map((r) => r.name),
        references,
      };
    })();
    info.catch(() => tables.delete(name));
    tables.set(name, info);
  }
  return info;
}

function functionInfo(name: string): Promise<FunctionInfo> {
  let info = functions.get(name);
  if (!info) {
    info = (async () => {
      const found = await pool().query<{ arg_names: string[] | null; arg_types: string[]; retset: boolean; rettype: string; composite: boolean }>(
        `select p.proargnames as arg_names,
                array(select format_type(t, null) from unnest(p.proargtypes) as t) as arg_types,
                p.proretset as retset, format_type(p.prorettype, null) as rettype,
                (select typtype = 'c' from pg_type where oid = p.prorettype) as composite
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = $1`,
        [name],
      );
      if (found.rowCount !== 1) throw new Error(`unknown or overloaded function: ${name}`);
      const row = found.rows[0]!;
      const args = new Map<string, string>();
      row.arg_types.forEach((type, i) => {
        const argName = row.arg_names?.[i];
        if (argName) args.set(argName, type);
      });
      return { args, returnsRows: row.retset || row.composite, returnsVoid: row.rettype === 'void' };
    })();
    info.catch(() => functions.delete(name));
    functions.set(name, info);
  }
  return info;
}

/* --------------------------------------------------------- SQL pieces */

class Params {
  readonly values: unknown[] = [];
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

const bindValue = (value: unknown, column: ColumnInfo | undefined) =>
  value === undefined ? null : column?.json && value !== null ? JSON.stringify(value) : value;

/** Splits "a, b, rel(x, y(z))" on top-level commas. */
function splitColumns(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

async function selectList(table: string, alias: string, columns: string, depth = 0): Promise<string> {
  if (depth > 3) throw new Error('embedding too deep');
  const info = await tableInfo(table);
  const out: string[] = [];
  for (const item of splitColumns(columns || '*')) {
    if (item === '*') {
      out.push(`${alias}.*`);
      continue;
    }
    const embed = item.match(/^([a-z_][a-z0-9_]*)\((.*)\)$/s);
    if (embed) {
      const [, relation, inner] = embed as unknown as [string, string, string];
      const ref = info.references.get(relation);
      if (!ref) throw new Error(`no foreign key from ${table} to ${relation}`);
      const child = `t${depth + 1}`;
      const list = await selectList(relation, child, inner, depth + 1);
      out.push(
        `(select to_jsonb(e) from (select ${list} from public.${ident(relation)} ${child} ` +
          `where ${child}.${ident(ref.refColumn)} = ${alias}.${ident(ref.column)}) e) as ${ident(relation)}`,
      );
      continue;
    }
    out.push(`${alias}.${ident(item)}`);
  }
  return out.join(', ');
}

type Filter = (params: Params) => string;

/** `column`, or `column->>key` for one text value out of a jsonb column. */
function filterTarget(column: string): string {
  const path = column.match(/^([a-z_][a-z0-9_]*)->>([a-z_][a-z0-9_]*)$/);
  return path ? `t0.${ident(path[1]!)} ->> '${path[2]}'` : `t0.${ident(column)}`;
}
type Mode = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

/* -------------------------------------------------------------- query */

export class Query<T = any[]> implements PromiseLike<DbResult<T>> {
  private mode: Mode = 'select';
  private columns: string | null = null;
  private returning: string | null = null;
  private countMode: 'exact' | null = null;
  private head = false;
  private values: Record<string, unknown>[] = [];
  private patch: Record<string, unknown> = {};
  private conflict: string[] | null = null;
  private ignoreDuplicates = false;
  private filters: Filter[] = [];
  private orders: string[] = [];
  private limitCount: number | null = null;
  private offsetCount: number | null = null;
  private cardinality: 'one' | 'maybe' | null = null;

  constructor(
    private readonly ctx: DbContext,
    private readonly table: string,
  ) {
    ident(table);
  }

  select(columns = '*', options: { count?: 'exact'; head?: boolean } = {}): this {
    if (this.mode === 'select') {
      this.columns = columns;
      this.countMode = options.count ?? null;
      this.head = options.head ?? false;
    } else this.returning = columns;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = 'insert';
    this.values = Array.isArray(values) ? values : [values];
    return this;
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], options: { onConflict?: string; ignoreDuplicates?: boolean } = {}): this {
    this.insert(values);
    this.mode = 'upsert';
    this.conflict = options.onConflict ? options.onConflict.split(',').map((c) => c.trim()) : null;
    this.ignoreDuplicates = options.ignoreDuplicates ?? false;
    return this;
  }

  update(patch: Record<string, unknown>): this {
    this.mode = 'update';
    this.patch = patch;
    return this;
  }

  delete(): this {
    this.mode = 'delete';
    return this;
  }

  private compare(column: string, op: string, value: unknown): this {
    const target = filterTarget(column);
    this.filters.push((params) => `${target} ${op} ${params.add(value)}`);
    return this;
  }

  eq(column: string, value: unknown) { return this.compare(column, '=', value); }
  neq(column: string, value: unknown) { return this.compare(column, '<>', value); }
  gt(column: string, value: unknown) { return this.compare(column, '>', value); }
  gte(column: string, value: unknown) { return this.compare(column, '>=', value); }
  lt(column: string, value: unknown) { return this.compare(column, '<', value); }
  lte(column: string, value: unknown) { return this.compare(column, '<=', value); }
  like(column: string, pattern: string) { return this.compare(column, 'like', pattern); }
  ilike(column: string, pattern: string) { return this.compare(column, 'ilike', pattern); }

  is(column: string, value: null | boolean): this {
    ident(column);
    const keyword = value === null ? 'null' : value ? 'true' : 'false';
    this.filters.push(() => `t0.${ident(column)} is ${keyword}`);
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    ident(column);
    this.filters.push((params) => `t0.${ident(column)} = any (${params.add([...values])})`);
    return this;
  }

  match(values: Record<string, unknown>): this {
    for (const [column, value] of Object.entries(values)) this.eq(column, value);
    return this;
  }

  /**
   * A hand-written condition with `?` placeholders, for the few searches the
   * builder cannot say (OR across columns). Column names in it are written by
   * us, never taken from input; the values are bound.
   */
  where(sql: string, values: unknown[] = []): this {
    this.filters.push((params) => {
      let i = 0;
      return `(${sql.replace(/\?/g, () => params.add(values[i++]))})`;
    });
    return this;
  }

  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    const direction = options.ascending === false ? 'desc' : 'asc';
    const nulls = options.nullsFirst === undefined ? '' : options.nullsFirst ? ' nulls first' : ' nulls last';
    this.orders.push(`t0.${ident(column)} ${direction}${nulls}`);
    return this;
  }

  limit(count: number): this {
    this.limitCount = Math.max(0, Math.floor(count));
    return this;
  }

  range(from: number, to: number): this {
    this.offsetCount = Math.max(0, Math.floor(from));
    this.limitCount = Math.max(0, Math.floor(to) - Math.floor(from) + 1);
    return this;
  }

  maybeSingle<R = any>(): Query<R> {
    this.cardinality = 'maybe';
    return this as unknown as Query<R>;
  }

  single<R = any>(): Query<R> {
    this.cardinality = 'one';
    return this as unknown as Query<R>;
  }

  private whereClause(params: Params): string {
    return this.filters.length ? ` where ${this.filters.map((f) => f(params)).join(' and ')}` : '';
  }

  private async build(): Promise<{ text: string; values: unknown[]; countText?: string; countValues?: unknown[] }> {
    const params = new Params();
    const target = `public.${ident(this.table)} as t0`;

    if (this.mode === 'select') {
      if (this.head) {
        return { text: `select count(*)::int as count from ${target}${this.whereClause(params)}`, values: params.values };
      }
      const list = await selectList(this.table, 't0', this.columns ?? '*');
      let text = `select ${list} from ${target}${this.whereClause(params)}`;
      const filterValues = [...params.values];
      if (this.orders.length) text += ` order by ${this.orders.join(', ')}`;
      if (this.limitCount !== null) text += ` limit ${this.limitCount}`;
      if (this.offsetCount !== null) text += ` offset ${this.offsetCount}`;
      if (this.countMode) {
        const countParams = new Params();
        return {
          text, values: params.values,
          countText: `select count(*)::int as count from ${target}${this.whereClause(countParams)}`,
          countValues: countParams.values.length ? countParams.values : filterValues,
        };
      }
      return { text, values: params.values };
    }

    const info = await tableInfo(this.table);
    const returning = this.returning !== null ? ` returning ${await selectList(this.table, 't0', this.returning)}` : '';

    if (this.mode === 'insert' || this.mode === 'upsert') {
      const columnNames = [...new Set(this.values.flatMap((row) => Object.keys(row)))];
      columnNames.forEach(ident);
      const rows = this.values.map(
        (row) => `(${columnNames.map((c) => (c in row ? params.add(bindValue(row[c], info.columns.get(c))) : 'default')).join(', ')})`,
      );
      let text = `insert into ${target} (${columnNames.map(ident).join(', ')}) values ${rows.join(', ')}`;
      if (this.mode === 'upsert') {
        const keys = this.conflict ?? info.primaryKey;
        const updates = columnNames.filter((c) => !keys.includes(c));
        text += ` on conflict (${keys.map(ident).join(', ')}) `;
        text += this.ignoreDuplicates || !updates.length
          ? 'do nothing'
          : `do update set ${updates.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}`;
      }
      return { text: text + returning, values: params.values };
    }

    if (this.mode === 'update') {
      const sets = Object.entries(this.patch).map(([c, v]) => `${ident(c)} = ${params.add(bindValue(v, info.columns.get(c)))}`);
      if (!sets.length) throw new Error('empty update');
      return { text: `update ${target} set ${sets.join(', ')}${this.whereClause(params)}${returning}`, values: params.values };
    }

    return { text: `delete from ${target}${this.whereClause(params)}${returning}`, values: params.values };
  }

  async execute(): Promise<DbResult<T>> {
    try {
      const built = await this.build();
      return await inTransaction(this.ctx, async (client) => {
        const result = await client.query(built.text, built.values);
        let count: number | null = null;
        if (this.head) return { data: null as T, error: null, count: (result.rows[0]?.count as number) ?? 0 };
        if (built.countText) count = ((await client.query(built.countText, built.countValues)).rows[0]?.count as number) ?? 0;
        const wantsRows = this.mode === 'select' || this.returning !== null;
        if (!wantsRows) return { data: null as T, error: null, count };
        return shape<T>(result.rows, this.cardinality, count);
      });
    } catch (error) {
      return { data: null as T, error: toDbError(error), count: null };
    }
  }

  then<A = DbResult<T>, B = never>(
    onFulfilled?: ((value: DbResult<T>) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

function shape<T>(rows: unknown[], single: 'one' | 'maybe' | null, count: number | null): DbResult<T> {
  if (!single) return { data: rows as T, error: null, count };
  if (rows.length === 1) return { data: rows[0] as T, error: null, count };
  if (rows.length === 0 && single === 'maybe') return { data: null as T, error: null, count };
  return {
    data: null as T,
    error: { code: 'PGRST116', message: `expected one row, got ${rows.length}` },
    count,
  };
}

/* ---------------------------------------------------------------- rpc */

export class Rpc<T = any> implements PromiseLike<DbResult<T>> {
  private cardinality: 'one' | 'maybe' | null = null;

  constructor(
    private readonly ctx: DbContext,
    private readonly name: string,
    private readonly args: Record<string, unknown> = {},
  ) {
    ident(name);
  }

  maybeSingle<R = T>(): Rpc<R> {
    this.cardinality = 'maybe';
    return this as unknown as Rpc<R>;
  }

  async execute(): Promise<DbResult<T>> {
    try {
      const info = await functionInfo(this.name);
      const params = new Params();
      const named = Object.entries(this.args).map(([arg, value]) => {
        const type = info.args.get(arg);
        if (!type) throw new Error(`${this.name} has no argument ${arg}`);
        const bound = value === undefined ? null : type === 'jsonb' || type === 'json' ? (value === null ? null : JSON.stringify(value)) : value;
        return `${ident(arg)} => ${params.add(bound)}::${type}`;
      });
      const call = `public.${ident(this.name)}(${named.join(', ')})`;
      return await inTransaction(this.ctx, async (client) => {
        if (info.returnsRows) {
          const result = await client.query(`select * from ${call}`, params.values);
          return shape<T>(result.rows, this.cardinality, null);
        }
        const result = await client.query(`select ${call} as value`, params.values);
        return { data: (info.returnsVoid ? null : result.rows[0]?.value) as T, error: null, count: null };
      });
    } catch (error) {
      return { data: null as T, error: toDbError(error), count: null };
    }
  }

  then<A = DbResult<T>, B = never>(
    onFulfilled?: ((value: DbResult<T>) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.execute().then(onFulfilled, onRejected);
  }
}

/* ------------------------------------------------------------- client */

export interface Db {
  from<T = any[]>(table: string): Query<T>;
  rpc<T = any>(name: string, args?: Record<string, unknown>): Rpc<T>;
  readonly context: DbContext;
}

export function createDb(ctx: DbContext): Db {
  return {
    from: (table) => new Query(ctx, table),
    rpc: (name, args) => new Rpc(ctx, name, args),
    context: ctx,
  };
}
