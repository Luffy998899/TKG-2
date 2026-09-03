import Image from 'next/image';
import { selectedVehicles, SOURCING_DISCLAIMER } from '@/config/automotive';
import { imageSizes } from '@/lib/images';
import { Reveal } from '@/components/Reveal';

/**
 * Partner-supplied vehicles.
 *
 * Renders NOTHING while `selectedVehicles` is empty, which is the state it
 * ships in - an empty listings grid is worse than no listings section. Add
 * entries to src/config/automotive.ts and the section appears, already laid
 * out.
 *
 * Every card names the selling dealership, and the sourcing disclaimer sits
 * directly under the grid. Both are structural, not decorative: TKG is the
 * referrer here, and a listings grid is exactly where a visitor would
 * otherwise assume it is the seller.
 */
export function SelectedVehicles() {
  if (selectedVehicles.length === 0) return null;

  return (
    <section aria-labelledby="vehicles-heading" className="border-t border-line bg-paper-sunk">
      <div className="shell py-section md:py-section-lg">
        <Reveal className="mb-10 md:mb-14">
          <div data-reveal>
            <p className="eyebrow">Selected vehicles</p>
            <h2 id="vehicles-heading" className="display-2 mt-5 max-w-[18ch]">
              Currently available through our partners
            </h2>
          </div>
        </Reveal>

        <Reveal as="ul" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {selectedVehicles.map((vehicle) => (
            <li key={vehicle.id} data-reveal className="card flex h-full flex-col overflow-hidden">
              <div className="frame aspect-[16/10] w-full rounded-none">
                {vehicle.image ? (
                  <Image
                    src={vehicle.image.src}
                    alt={vehicle.image.alt}
                    width={1600}
                    height={1000}
                    sizes={imageSizes.productCard}
                    className="frame-img"
                  />
                ) : null}
              </div>

              <div className="flex flex-1 flex-col justify-between gap-6 p-6">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-card-title font-semibold text-ink">
                      {vehicle.title}
                    </h3>
                    <span className="counter shrink-0">{vehicle.year}</span>
                  </div>
                  <p className="mt-2 text-body font-semibold text-accent-ink">{vehicle.price}</p>
                  <dl className="mt-4 grid gap-1 text-caption text-ink-soft">
                    <div className="flex gap-2">
                      <dt className="text-ink-mute">Mileage</dt>
                      <dd>{vehicle.mileage}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-ink-mute">Body type</dt>
                      <dd>{vehicle.bodyType}</dd>
                    </div>
                  </dl>
                </div>

                {/* Never optional. See the note above. */}
                <p className="rounded-xl bg-paper-sunk px-4 py-3 text-caption text-ink-soft">
                  <span className="block text-micro font-semibold uppercase text-ink-mute">
                    Sold by
                  </span>
                  {vehicle.sellingDealership}
                </p>
              </div>
            </li>
          ))}
        </Reveal>

        <p className="mt-8 max-w-prose text-caption text-ink-mute">{SOURCING_DISCLAIMER}</p>
      </div>
    </section>
  );
}
