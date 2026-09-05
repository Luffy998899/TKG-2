'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { divisions, divisionPath } from '@/config/divisions';
import { themeVars } from '@/config/theme';
import { useContact } from '@/components/SiteProvider';
import { ArrowIcon, CloseIcon, MenuIcon, PhoneIcon } from '@/components/icons';
import { Wordmark } from '@/components/Wordmark';

const primaryNav = [
  { href: '/about', label: 'About' },
  { href: '/careers', label: 'Careers' },
  { href: '/contact', label: 'Contact' },
];

/**
 * Routes that open on a dark hero. Seeding from the route avoids a light
 * header flashing over the dark image for a frame before the observer runs.
 */
const startsDark = (pathname: string) =>
  pathname === '/' ||
  pathname === '/careers' ||
  pathname.startsWith('/services/');

export function Header() {
  const pathname = usePathname();
  const { site, tel: telHref } = useContact();
  const [menuOpen, setMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  // Seeded from the route rather than defaulting to false: the homepage always
  // opens on the dark hero, and waiting for the observer's first callback
  // flashed a light header over it for a frame.
  const [overNight, setOverNight] = useState(startsDark(pathname));
  const servicesRef = useRef<HTMLDivElement>(null);
  const hoverAway = useRef<number>();

  // The header is translucent; it only earns a shadow once content is
  // actually passing underneath it.
  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * Several pages open on a dark photographic hero - the homepage journey,
   * security, automotive, careers - and the header floats over all of them,
   * so the chrome has to invert while a dark section is behind it. Any
   * element marked `data-header-dark` counts. Driven by an
   * IntersectionObserver against the header's own band rather than a scroll
   * threshold, so it stays correct however tall the section is - including
   * the pinned journey.
   */
  useEffect(() => {
    const darks = Array.from(document.querySelectorAll<HTMLElement>('[data-header-dark]'));
    if (darks.length === 0) {
      setOverNight(false);
      return;
    }
    const header =
      Math.round(
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) *
          16,
      ) || 72;
    const under = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return r.top <= header && r.bottom > 0;
    };
    setOverNight(darks.some(under));

    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setOverNight(visible.size > 0);
      },
      // Shrink the viewport to just the header band: "is a dark section
      // underneath the chrome right now?"
      { rootMargin: `0px 0px -${Math.max(0, window.innerHeight - header)}px 0px`, threshold: 0 },
    );
    darks.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  // Close the mobile sheet on navigation - never leave the user trapped.
  useEffect(() => {
    setMenuOpen(false);
    setServicesOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    window.__lenis?.stop();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => {
      window.__lenis?.start();
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // Desktop dropdown: dismiss on outside pointer-down and on Escape.
  useEffect(() => {
    if (!servicesOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!servicesRef.current?.contains(e.target as Node)) setServicesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setServicesOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [servicesOpen]);

  useEffect(() => () => window.clearTimeout(hoverAway.current), []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  /**
   * Hover opens the menu on a mouse, but never on touch — a touch device fires
   * a synthetic pointerenter on tap, which would open and immediately re-close
   * the menu on the following click. Touch and keyboard use the button.
   */
  const hoverOpen = (open: boolean) => (event: React.PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    window.clearTimeout(hoverAway.current);
    if (open) {
      setServicesOpen(true);
    } else {
      // A short grace period, so clipping the corner of the trigger on the way
      // to the panel does not snap it shut.
      hoverAway.current = window.setTimeout(() => setServicesOpen(false), 120);
    }
  };

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50',
        'transition-[background-color,box-shadow] duration-300 ease-out-soft',
        overNight ? 'on-night bg-night/45 backdrop-blur-xl backdrop-saturate-150' : 'material',
        lifted && !overNight
          ? 'shadow-[0_1px_0_rgb(var(--line)/0.9),0_14px_34px_-28px_rgb(var(--ink)/0.55)]'
          : '',
      ].join(' ')}
    >
      <div className="shell flex h-[var(--header-h)] items-center justify-between gap-6">
        <Link
          href="/"
          className="-m-2 rounded-lg p-2 transition-opacity duration-150 hover:opacity-70"
          aria-label={`${site.name} home`}
        >
          <Wordmark />
        </Link>

        {/* -------------------------------------------------- desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          <div
            ref={servicesRef}
            className="relative"
            onPointerEnter={hoverOpen(true)}
            onPointerLeave={hoverOpen(false)}
          >
            <button
              type="button"
              aria-expanded={servicesOpen}
              aria-controls="services-menu"
              onClick={() => setServicesOpen((v) => !v)}
              data-nav-link
              data-active={isActive('/services') || servicesOpen}
              className={[
                'rounded-full px-4 py-2 text-caption font-medium',
                'transition-[background-color,color] duration-150 ease-out-soft',
                isActive('/services') || servicesOpen
                  ? 'bg-accent-soft text-accent-ink'
                  : 'text-ink-soft hover:text-ink',
              ].join(' ')}
            >
              Divisions
              <span aria-hidden className="ml-1.5 inline-block text-[0.7em]">
                {servicesOpen ? '–' : '+'}
              </span>
            </button>

            {/*
              The wrapper is `top-full` with padding rather than offset by
              `top-[calc(100%+…)]`: hover has to survive the trip from the
              button to the panel, and an offset leaves a dead gap that fires
              pointerleave halfway across. The padding IS the bridge.
            */}
            <div
              id="services-menu"
              data-open={servicesOpen}
              aria-hidden={!servicesOpen}
              className="menu-panel absolute left-0 top-full w-[30rem] pt-2.5"
            >
              {/* Anchored to its trigger: it scales open from the top-left,
                  where the button is, not from its own centre. */}
              <ul className="material-strong grid gap-0.5 rounded-panel border border-line/70 p-2 shadow-float">
                {divisions.map((division) => (
                  <li key={division.slug}>
                    <Link
                      href={divisionPath(division.slug)}
                      style={themeVars(division.theme)}
                      className="group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-[background-color] duration-150 ease-out-soft hover:bg-accent-soft"
                    >
                      <span
                        aria-hidden
                        className="mt-[0.4rem] h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                      />
                      {/*
                        min-w-0 is load-bearing. A flex child defaults to
                        min-width:auto, so the tagline refused to shrink and
                        pushed each row ~65px past the panel edge instead of
                        wrapping. Stacked rather than side-by-side so the
                        taglines read in full.
                      */}
                      <span className="min-w-0 flex-1">
                        <span className="block text-caption font-semibold text-ink">
                          {division.name}
                        </span>
                        <span className="mt-0.5 block text-caption text-ink-mute">
                          {division.tagline}
                        </span>
                      </span>
                      <ArrowIcon
                        width={15}
                        height={15}
                        className="mt-[0.2rem] shrink-0 text-accent opacity-0 transition-[opacity,translate] duration-150 ease-out-soft group-hover:translate-x-0.5 group-hover:opacity-100"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {primaryNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              data-nav-link
              data-active={isActive(item.href)}
              className={[
                'rounded-full px-4 py-2 text-caption font-medium',
                'transition-[background-color,color] duration-150 ease-out-soft',
                isActive(item.href)
                  ? 'bg-accent-soft text-accent-ink'
                  : 'text-ink-soft hover:text-ink',
              ].join(' ')}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* ------------------------------------------------ desktop CTAs */}
        <div className="hidden items-center gap-2 lg:flex">
          <a href={telHref} className="btn btn-ghost" data-cta="call">
            <PhoneIcon />
            <span className="phone-number">{site.contact.phoneDisplay}</span>
          </a>
          <Link href="/quote" className="btn btn-primary" data-cta="quote">
            Get a quote
            <ArrowIcon width={16} height={16} />
          </Link>
        </div>

        {/* -------------------------------------------------- mobile menu */}
        <button
          type="button"
          className="menu-toggle -mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-ink transition-[background-color,color] duration-150 active:bg-ink/[0.06] lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          onPointerDown={() => setMenuOpen((v) => !v)}
        >
          <span className="sr-only">{menuOpen ? 'Close menu' : 'Open menu'}</span>
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </button>
      </div>

      {/*
        Full-height sheet. Always mounted and positioned below the bar, so the
        header's own box never grows: `.menu-sheet` transitions it in from the
        header edge and hides it (visibility) when closed. See plans/003.
      */}
      <div
        id="mobile-menu"
        data-open={menuOpen}
        aria-hidden={!menuOpen}
        className="menu-sheet material-strong absolute inset-x-0 top-full h-[calc(100dvh-var(--header-h))] overflow-y-auto border-t border-line/70 lg:hidden"
        data-lenis-prevent
      >
        <nav aria-label="Divisions" className="shell py-6">
          <p className="eyebrow mb-3">Divisions</p>
          <ul className="grid gap-px overflow-hidden rounded-card bg-line/60">
            {divisions.map((division) => (
              <li key={division.slug}>
                <Link
                  href={divisionPath(division.slug)}
                  style={themeVars(division.theme)}
                  className="flex items-center gap-3 bg-paper-raised px-4 py-4"
                >
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-body-lg font-semibold text-ink">
                      {division.name}
                    </span>
                    <span className="mt-0.5 block text-caption text-ink-mute">
                      {division.tagline}
                    </span>
                  </span>
                  <ArrowIcon className="shrink-0 text-accent-ink" />
                </Link>
              </li>
            ))}
          </ul>

          <p className="eyebrow mb-3 mt-8">Company</p>
          <ul className="grid gap-px overflow-hidden rounded-card bg-line/60">
            {[...primaryNav, { href: '/quote', label: 'Request a quote' }].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between gap-3 bg-paper-raised px-4 py-4 font-display text-body-lg font-semibold text-ink"
                >
                  {item.label}
                  <ArrowIcon className="shrink-0 text-ink-mute" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="h-28" />
        </nav>
      </div>
    </header>
  );
}
