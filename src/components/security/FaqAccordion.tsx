'use client';

import { useId } from 'react';

/**
 * FAQ accordion built on <details>/<summary>.
 *
 * Native disclosure rather than a JS-driven one: it opens with the keyboard,
 * is announced correctly by a screen reader, and works before hydration. The
 * only script here is the chevron rotation, which CSS handles off the
 * [open] attribute - so this could almost be a server component. It is marked
 * client only so the marker animation runs under motion-safe.
 */
export function FaqAccordion({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const uid = useId();

  return (
    <div className="divide-y divide-line border-y border-line">
      {faqs.map((faq, i) => (
        <details key={faq.question} name={`faq-${uid}`} className="group">
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 md:py-6"
            id={`${uid}-${i}`}
          >
            <span className="font-display text-body-lg font-semibold text-ink md:text-card-title">
              {faq.question}
            </span>
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-accent-ink transition-[transform,background-color,border-color] duration-200 ease-out-soft group-open:rotate-45 group-open:border-accent group-open:bg-accent-soft"
            >
              {/* A plus that becomes an x on rotate. */}
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </summary>
          <div className="pb-6 pr-12">
            <p className="max-w-prose text-body text-ink-soft">{faq.answer}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
