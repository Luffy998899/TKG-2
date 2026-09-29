export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="mt-1 text-sm text-ink-soft">{description}</p> : null}
    </div>
  );
}

/** Placeholder for a screen that a later phase fills in. */
export function ComingInPhase({ phase, what }: { phase: number; what: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-paper-raised p-6 text-sm text-ink-soft">
      {what} arrives in build phase {phase}.
    </div>
  );
}
