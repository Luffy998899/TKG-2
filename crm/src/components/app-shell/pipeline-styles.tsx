import 'server-only';
import { headers } from 'next/headers';
import { listPipelines } from '@/lib/deals/queries';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;

/**
 * One <style> per page with a class per pipeline (chip colour, board column
 * accent). Carries this request's CSP nonce. Values are re-validated here as
 * well as by the database's check constraints, so nothing but a slug and a
 * hex colour can ever reach the stylesheet.
 */
export async function PipelineStyles() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const pipelines = await listPipelines(true);
  const css = pipelines
    .filter((p) => SLUG.test(p.slug) && HEX.test(p.accent) && HEX.test(p.accent_ink) && HEX.test(p.accent_soft))
    .map((p) => `.pl-${p.slug}{color:${p.accent_ink};background-color:${p.accent_soft}}.pl-bar-${p.slug}{background-color:${p.accent}}`)
    .join('');
  return <style nonce={nonce}>{css}</style>;
}
