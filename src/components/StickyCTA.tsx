'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useContact } from '@/components/SiteProvider';
import { PhoneIcon, WhatsAppIcon, ArrowIcon } from '@/components/icons';

/**
 * Persistent contact cluster for touch devices. Docked to the bottom safe area,
 * always one tap from anywhere on the site. Hidden at >=lg, where the same
 * actions live in the header and footer.
 *
 * It hides while the on-screen keyboard is up (a form is focused) so it never
 * covers the field the user is typing into.
 */
export function StickyCTA() {
  const { site, tel: telHref, wa: waHref } = useContact();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      setHidden(['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
    };
    const onFocusOut = () => setHidden(false);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return (
    <div
      className={[
        'fixed inset-x-0 bottom-0 z-40 lg:hidden',
        'transition-transform duration-300 ease-out-soft',
        hidden ? 'translate-y-full' : 'translate-y-0',
      ].join(' ')}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="shell">
        <nav
          aria-label="Quick contact"
          className="material-strong flex items-stretch gap-1 rounded-panel border border-line/70 p-1 shadow-float"
        >
          <a
            href={telHref}
            data-cta="call"
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-card py-2.5 text-micro font-semibold uppercase text-ink transition-[transform,background-color] duration-150 ease-out-soft active:scale-[0.97] active:bg-accent-soft"
          >
            <PhoneIcon />
            Call
          </a>
          <a
            href={waHref}
            data-cta="whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-card py-2.5 text-micro font-semibold uppercase text-ink transition-[transform,background-color] duration-150 ease-out-soft active:scale-[0.97] active:bg-accent-soft"
          >
            <WhatsAppIcon />
            Text
          </a>
          <Link
            href="/contact"
            data-cta="contact"
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-card py-2.5 text-micro font-semibold uppercase text-ink transition-[transform,background-color] duration-150 ease-out-soft active:scale-[0.97] active:bg-accent-soft"
          >
            <ArrowIcon />
            Contact
          </Link>
          <Link
            href="/quote"
            data-cta="quote"
            className="flex flex-[1.3] items-center justify-center rounded-card bg-ink px-3 py-2.5 text-caption font-semibold text-paper transition-transform duration-150 ease-out-soft active:scale-[0.97]"
          >
            Get a quote
          </Link>
        </nav>
        <p className="sr-only">
          Call {site.contact.phoneDisplay} or message us on WhatsApp at{' '}
          {site.contact.whatsapp}.
        </p>
      </div>
    </div>
  );
}
