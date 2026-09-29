import 'server-only';
import { createHash } from 'node:crypto';
import { listPipelines } from '@/lib/deals/queries';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const SLUG = /^[a-z0-9-]{1,60}$/;

/**
 * One class per pipeline: `.pl-<slug>` (chip text + background) and
 * `.pl-bar-<slug>` (accent). Values are re-validated here as well as by the
 * database's check constraints, so only a slug and hex colours can ever
 * reach the stylesheet.
 */
export async function pipelineCss() {
  const pipelines = await listPipelines(true);
  const css = pipelines
    .filter((p) => SLUG.test(p.slug) && HEX.test(p.accent) && HEX.test(p.accent_ink) && HEX.test(p.accent_soft))
    .map((p) => `.pl-${p.slug}{color:${p.accent_ink};background-color:${p.accent_soft}}.pl-bar-${p.slug}{background-color:${p.accent}}`)
    .join('\n');
  return { css, version: createHash('sha256').update(css).digest('hex').slice(0, 12) };
}
