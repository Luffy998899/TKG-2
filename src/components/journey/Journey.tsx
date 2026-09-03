'use client';

import { useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { divisions, divisionPath } from '@/config/divisions';
import { site } from '@/config/site';
import { themeVars } from '@/config/theme';
import { imageMeta, imageSizes } from '@/lib/images';
import { cardSide } from './journey-config';
import { ArrowIcon, shapeMarks } from '@/components/icons';
import { getBeatServerSnapshot, getBeatSnapshot, subscribeBeat } from '@/lib/scroll-store';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

const TRACK_ID = 'journey-track';
const STAGE_ID = 'journey-stage';

/**
 * WebGL is loaded lazily and client-only: three.js never touches the server
 * bundle, and the hero paints from HTML — backdrop photograph included — before
 * the canvas exists.
 */
const SceneCanvas = dynamic(() => import('./SceneCanvas'), {
  ssr: false,
  loading: () => null,
});

export function Journey() {
  // `null` until mounted, so the server and the first client render agree.
  const reducedMotion = usePrefersReducedMotion();
  const backdrop = imageMeta('hero-backdrop');

  return (
    <section
      id={TRACK_ID}
      aria-labelledby="journey-heading"
      // One viewport of scroll per camera segment. This height IS the timeline:
      // the pinned stage plays across exactly this distance. Reduced motion
      // collapses it to auto (see globals.css).
      style={{ ['--journey-h' as string]: `${(divisions.length + 2) * 100}svh` }}
      className="relative"
    >
      <div
        id={STAGE_ID}
        className="on-night relative flex h-[100svh] w-full items-end overflow-hidden bg-night"
      >
        {/* ------------------------------------------------------- backdrop */}
        {/*
          The photograph the whole hero is built on. It sits in the DOM rather
          than the 3D scene so next/image can optimise it and so it paints
          immediately — the WebGL canvas above it has `alpha: true` and simply
          composites over the top.
        */}
        {backdrop ? (
          <div
            aria-hidden
            data-journey-backdrop
            className="pointer-events-none absolute inset-0 scale-110"
          >
            <Image
              src={backdrop.src}
              alt=""
              fill
              sizes="100vw"
              placeholder="blur"
              blurDataURL={backdrop.blurDataURL}
              priority
              className="object-cover"
            />
          </div>
        ) : null}

        {/*
          Scrim. Two layers, not one: a flat wash to sink the photo far enough
          for white type to clear AA on the brightest part of the sky, and a
          bottom-weighted gradient so the copy corner is darker still.
        */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-night/45" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night via-night/55 to-night/15"
        />

        {/* Never downloaded at all when the user asks for reduced motion. */}
        {reducedMotion === false && <SceneCanvas trackId={TRACK_ID} stageId={STAGE_ID} />}

        <div className="shell relative z-10 w-full pb-24 pt-[var(--header-h)] md:pb-28">
          {/* ----------------------------------------------------- hero copy */}
          <div
            data-journey-hero
            className="max-w-[24ch] pb-10 md:absolute md:bottom-24 md:left-[var(--shell-x)] md:pb-0"
          >
            <p className="eyebrow">Est. in the {site.serviceArea[0]}</p>
            <h1
              id="journey-heading"
              className="mt-5 font-display text-h1 font-semibold text-paper md:text-display"
            >
              {site.name}
            </h1>
            <p className="mt-6 font-display text-lead font-medium text-paper/75">{site.tagline}</p>

            <p className="mt-9 flex items-center gap-3 text-caption text-paper/60 motion-reduce:hidden">
              <span aria-hidden className="inline-block h-7 w-px bg-accent-bright" />
              Scroll to travel through our seven divisions
            </p>
            <p className="mt-6 hidden max-w-prose text-body text-paper/75 motion-reduce:block">
              {site.description}
            </p>
          </div>

          {/* --------------------------------------------- division moments */}
          {divisions.map((division, index) => {
            const Mark = shapeMarks[division.scene.shape];
            const meta = imageMeta(division.slug);

            return (
              <article
                key={division.slug}
                data-journey-card
                // Hidden until the timeline reveals it. The static grid further
                // down the page carries the same content for crawlers, for
                // no-JS visitors and for reduced motion.
                style={{ visibility: 'hidden', opacity: 0, ...themeVars(division.theme) }}
                className={[
                  'pointer-events-auto absolute bottom-24 md:w-[27rem]',
                  // Full width on a phone; from md it takes its side, mirroring
                  // the slab (see slabSide in journey-config).
                  'left-[var(--shell-x)] right-[var(--shell-x)]',
                  cardSide(index) === 'right'
                    ? 'md:left-auto md:right-[var(--shell-x)]'
                    : 'md:left-[var(--shell-x)] md:right-auto',
                ].join(' ')}
              >
                <Link
                  href={divisionPath(division.slug)}
                  className="material-night group block rounded-panel p-5 shadow-float transition-[scale] duration-150 ease-out-soft active:scale-[0.98] md:p-6"
                >
                  <div className="flex items-start gap-5">
                    {/* On the `lite` scene tier the slabs are untextured, so
                        this thumbnail is where the division's photograph
                        actually lives on a phone. */}
                    <div className="frame frame-dark aspect-square w-20 shrink-0 md:w-24">
                      {meta ? (
                        <Image
                          src={meta.src}
                          alt=""
                          width={meta.width}
                          height={meta.height}
                          sizes={imageSizes.thumb}
                          placeholder="blur"
                          blurDataURL={meta.blurDataURL}
                          className="frame-img"
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-accent-bright">
                          <Mark width={22} height={22} />
                        </span>
                        <span className="counter">
                          {String(index + 1).padStart(2, '0')} /{' '}
                          {String(divisions.length).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="mt-3 font-display text-card-title font-semibold text-paper">
                        {division.name}
                      </p>
                      <p className="eyebrow-accent mt-1.5">{division.tagline}</p>
                    </div>
                  </div>

                  <p className="mt-4 text-body text-paper/70">{division.summary}</p>

                  <span className="mt-5 inline-flex items-center gap-2 text-caption font-semibold text-paper">
                    Explore {division.shortName}
                    <ArrowIcon
                      width={16}
                      height={16}
                      className="text-accent-bright transition-[translate] duration-300 ease-out-soft group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              </article>
            );
          })}

        </div>

        {/* Outside the shell on purpose: the shell is `items-end` inside the
            stage, so it is only as tall as the copy sitting at the bottom.
            Anchoring the rail to the stage is what lets `top` mean the top. */}
        <JourneyRail />
      </div>

      <StaticStrip />
    </section>
  );
}

/* ---------------------------------------------------------------- the rail */

/**
 * Seven ticks. The only part of the journey that re-renders React, and it does
 * so at most once per beat — not once per frame.
 */
function JourneyRail() {
  const beat = useSyncExternalStore(subscribeBeat, getBeatSnapshot, getBeatServerSnapshot);

  return (
    <ol
      aria-hidden
      data-journey-rail
      // Top right, not bottom right: the cards are bottom-anchored and now
      // take either side, so the only band guaranteed clear of them is under
      // the header.
      className="absolute right-[var(--shell-x)] top-[calc(var(--header-h)+2rem)] hidden flex-col items-end gap-3 md:flex"
    >
      {divisions.map((division, i) => {
        const active = i === beat;
        return (
          <li key={division.slug} className="flex items-center gap-3">
            {/* The rail sits on the same side of the stage as the slabs, so a
                bare light label can land on a white card. The chip guarantees
                it reads against anything the camera happens to be passing. */}
            <span
              className={[
                'rounded-full bg-night/65 px-2.5 py-1 backdrop-blur-sm',
                'font-display text-micro font-semibold uppercase',
                'transition-[opacity] duration-300 ease-out-soft',
                active ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              style={{ color: division.theme.accentBright }}
            >
              {division.shortName}
            </span>
            <span
              className="block h-[2px] rounded-full transition-[width,background-color] duration-300 ease-out-soft"
              style={{
                width: active ? 44 : 16,
                backgroundColor: active ? division.theme.accentBright : 'rgb(255 255 255 / 0.28)',
              }}
            />
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------- static image strip */

/**
 * Shown only under `prefers-reduced-motion` (see globals.css), where the whole
 * pinned journey collapses and the canvas is never downloaded. It carries the
 * same seven photographs as the 3D beats, as plain `next/image` cards.
 */
function StaticStrip() {
  return (
    <div data-journey-static className="on-night hidden bg-night">
      <div className="shell pb-16">
        <p className="eyebrow mb-6">The seven divisions</p>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          {divisions.map((division) => {
            const meta = imageMeta(division.slug);
            return (
              <li key={division.slug} style={themeVars(division.theme)}>
                <Link href={divisionPath(division.slug)} className="group block">
                  <div className="frame frame-dark aspect-[4/3] w-full">
                    {meta ? (
                      <Image
                        src={meta.src}
                        alt={division.image.alt}
                        width={meta.width}
                        height={meta.height}
                        sizes={imageSizes.strip}
                        placeholder="blur"
                        blurDataURL={meta.blurDataURL}
                        className="frame-img"
                      />
                    ) : null}
                  </div>
                  <p className="mt-3 font-display text-caption font-semibold text-paper">
                    {division.name}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
