import Image from 'next/image';
import Link from 'next/link';
import { divisions, divisionPath } from '@/config/divisions';
import { themeVars } from '@/config/theme';
import { imageMeta, imageSizes } from '@/lib/images';
import { ArrowIcon, shapeMarks } from '@/components/icons';
import { Reveal } from '@/components/Reveal';

/**
 * The canonical, always-present list of divisions. Server-rendered, so it is
 * what crawlers index and what a no-JS or reduced-motion visitor reads — the
 * 3D journey above is an enhancement on top of this, never a replacement.
 *
 * Card anatomy follows the collectui pattern: a fixed 16:10 image frame, the
 * index numeral and mark on one baseline, then title / tagline / summary in a
 * tightening type ramp, and the action pinned to the bottom so every card in a
 * row ends on the same line regardless of copy length.
 */
export function DivisionGrid({ excludeSlug }: { excludeSlug?: string } = {}) {
  const items = divisions.filter((d) => d.slug !== excludeSlug);

  return (
    <Reveal as="ul" className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {items.map((division, index) => {
        const Mark = shapeMarks[division.scene.shape];
        const meta = imageMeta(division.slug);

        return (
          <li
            key={division.slug}
            data-reveal
            // Scopes --accent* to this card, so everything inside it — the
            // mark, the hover border, the image wash — is that division's
            // colour with no per-division CSS.
            style={themeVars(division.theme)}
          >
            <Link
              href={divisionPath(division.slug)}
              className="card card-interactive group flex h-full flex-col overflow-hidden focus-visible:outline-offset-4"
            >
              <div className="frame aspect-[16/10] w-full rounded-none">
                {meta ? (
                  <Image
                    src={meta.src}
                    alt={division.image.alt}
                    width={meta.width}
                    height={meta.height}
                    sizes={imageSizes.gridCard}
                    placeholder="blur"
                    blurDataURL={meta.blurDataURL}
                    className="frame-img"
                  />
                ) : null}
              </div>

              <div className="flex flex-1 flex-col justify-between gap-8 p-6 md:p-7">
                <div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-accent-ink">
                      <Mark />
                    </span>
                    <span className="counter">{String(index + 1).padStart(2, '0')}</span>
                  </div>

                  <h3 className="mt-5 font-display text-card-title font-semibold text-ink">
                    {division.name}
                  </h3>
                  <p className="eyebrow-accent mt-2">{division.tagline}</p>
                  <p className="mt-4 max-w-measure text-body text-ink-soft">{division.summary}</p>
                </div>

                <span className="inline-flex items-center gap-2 text-caption font-semibold text-ink">
                  Explore {division.shortName}
                  <ArrowIcon
                    width={16}
                    height={16}
                    className="text-accent-ink transition-transform duration-300 ease-out-soft group-hover:translate-x-1"
                  />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </Reveal>
  );
}
