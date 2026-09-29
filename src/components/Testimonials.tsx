import { getTestimonials } from '@/lib/settings';
import { Reveal } from '@/components/Reveal';

/**
 * Real customer reviews, from the data store.
 *
 * Every review here was added by the owner in /admin with permission
 * recorded - there is no code-defined list and no placeholder. While the
 * store is empty the component renders nothing, so a page never shows an
 * empty "Reviews" heading.
 *
 * `division` filters to reviews tagged for that division plus any tagged
 * 'general'. Omit it to show everything (the homepage).
 */
export async function Testimonials({
  division,
  eyebrow = 'Reviews',
  title = 'What customers say.',
  tone = 'paper',
}: {
  division?: string;
  eyebrow?: string;
  title?: string;
  /** Which ground the section sits on, so it alternates correctly with its neighbours. */
  tone?: 'paper' | 'sunk';
}) {
  const reviews = await getTestimonials(division);
  if (reviews.length === 0) return null;

  return (
    <section
      aria-labelledby="reviews-heading"
      className={tone === 'sunk' ? 'border-t border-line bg-paper-sunk' : 'bg-paper'}
    >
      <div className="shell py-section md:py-section-lg">
        <Reveal className="mb-10 md:mb-14">
          <div data-reveal>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id="reviews-heading" className="display-2 mt-5 max-w-[16ch]">
              {title}
            </h2>
          </div>
        </Reveal>

        <Reveal as="ul" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <li key={review.id} data-reveal className="card flex h-full flex-col p-6 md:p-8">
              <span aria-hidden className="font-display text-h2 leading-none text-accent">
                &ldquo;
              </span>
              <blockquote className="mt-2 text-body-lg text-ink">{review.quote}</blockquote>
              <footer className="mt-auto pt-6">
                <p className="font-display text-caption font-semibold text-ink">{review.name}</p>
                {review.context ? (
                  <p className="mt-1 text-caption text-ink-mute">{review.context}</p>
                ) : null}
              </footer>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
