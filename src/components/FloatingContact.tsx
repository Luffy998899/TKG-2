'use client';

import { useEffect, useState } from 'react';
import { useContact } from '@/components/SiteProvider';
import { PhoneIcon, WhatsAppIcon } from '@/components/icons';

/**
 * The always-there floating contact cluster.
 *
 * Distinct from <StickyCTA>, which is a full-width bar that only exists below
 * `lg`. This is a pair of round buttons pinned to the bottom-right at EVERY
 * width, so there is a visible one-tap route to a human on every screen size.
 *
 * Placement:
 *   - below lg it clears the sticky bar (bottom-24) and the phone's home
 *     indicator (env safe-area),
 *   - from lg the bar is gone, so it drops to the normal corner inset.
 *
 * It hides while a field is focused, for the same reason <StickyCTA> does:
 * with the on-screen keyboard up, a floating control lands on top of the
 * input the user is typing into.
 */
export function FloatingContact() {
  const { site, tel: telHref, wa: waHref } = useContact();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const el = event.target as HTMLElement | null;
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
        'fixed right-[var(--shell-x)] z-40 flex flex-col items-end gap-3',
        'bottom-[calc(6.5rem+env(safe-area-inset-bottom))] lg:bottom-8',
        'transition-[opacity,transform] duration-300 ease-out-soft',
        hidden ? 'pointer-events-none translate-y-4 opacity-0' : 'translate-y-0 opacity-100',
      ].join(' ')}
    >
      {/* Call: secondary here, because the header and the sticky bar already
          carry it. Present so the cluster reads as "contact", not "WhatsApp". */}
      <a
        href={telHref}
        data-cta="call"
        aria-label={`Call ${site.contact.phoneDisplay}`}
        className="hidden h-12 w-12 items-center justify-center rounded-full border border-line bg-paper-raised text-ink shadow-lift transition-[transform,background-color] duration-150 ease-out-soft hover:bg-accent-soft hover:text-accent-ink active:scale-95 lg:flex"
      >
        <PhoneIcon width={20} height={20} />
      </a>

      {/*
        WhatsApp keeps its own brand green rather than the site accent. A
        messaging shortcut is recognised by colour before it is read, and this
        is the one place on the site where an outside brand's colour is the
        clearer signal.
      */}
      <a
        href={waHref}
        data-cta="whatsapp"
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Message us on WhatsApp at ${site.contact.phoneDisplay}`}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-float transition-transform duration-150 ease-out-soft active:scale-95"
        style={{ backgroundColor: '#25D366' }}
      >
        <WhatsAppIcon width={26} height={26} />
      </a>
    </div>
  );
}
