'use client';

import { useLayoutEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { divisions } from '@/config/divisions';
import { journey, setBeat } from '@/lib/scroll-store';
import { clamp } from '@/lib/motion';
import type { Tier } from './journey-config';
import { CARD_IN, CARD_OUT, cameraStops, TIMELINE_SEGMENTS } from './journey-config';

gsap.registerPlugin(ScrollTrigger);

/* =========================================================================
   THE SCROLL-DRIVEN CAMERA.

   One GSAP timeline, `scrub: 1`, bound to the journey track. Because it is
   scrubbed, camera position is a pure function of scrollbar position: scroll
   up and the camera runs backwards, frame for frame. Nothing here plays on
   its own clock.

   The timeline lives inside the Canvas so it can hold the real THREE camera.
   It also schedules the DOM cards, so overlay copy and 3D beats cannot drift
   apart - they are literally the same tween list.
   ========================================================================= */

export function CameraTimeline({
  trackId,
  stageId,
  tier,
}: {
  trackId: string;
  stageId: string;
  tier: Tier;
}) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  useLayoutEffect(() => {
    if (journey.reducedMotion) return;

    const track = document.getElementById(trackId);
    const stage = document.getElementById(stageId);
    if (!track || !stage) return;

    const cards = gsap.utils.toArray<HTMLElement>('[data-journey-card]');
    const stops = cameraStops(tier);

    // The look target is a plain object so GSAP can tween it; the camera is
    // re-aimed at it once per tick.
    const look = new THREE.Vector3(...stops[0].lookAt);
    camera.position.set(...stops[0].position);
    camera.lookAt(look);

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: track,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          pin: stage,
          pinSpacing: false,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            journey.progress = self.progress;
            const seg = self.progress * TIMELINE_SEGMENTS;
            setBeat(clamp(Math.round(seg) - 1, 0, divisions.length - 1));
            invalidate();
          },
        },
        onUpdate: () => {
          camera.lookAt(look);
          camera.updateMatrixWorld();
        },
      });

      // ---- camera keyframes: one segment (duration 1) between each stop, so
      // timeline time == stop index. Everything else schedules against that.
      stops.slice(1).forEach((stop, i) => {
        tl.to(
          camera.position,
          { x: stop.position[0], y: stop.position[1], z: stop.position[2], duration: 1 },
          i,
        ).to(look, { x: stop.lookAt[0], y: stop.lookAt[1], z: stop.lookAt[2], duration: 1 }, i);
      });

      // ---- DOM cards, on the same clock. Division i is centred at time i+1.
      cards.forEach((card, i) => {
        tl.fromTo(
          card,
          { autoAlpha: 0, yPercent: 6 },
          { autoAlpha: 1, yPercent: 0, duration: CARD_IN.duration, ease: 'power2.out' },
          i + CARD_IN.at,
        ).to(
          card,
          { autoAlpha: 0, yPercent: -5, duration: CARD_OUT.duration, ease: 'power2.in' },
          i + CARD_OUT.at,
        );
      });

      // The hero copy hands off to the first division card.
      const hero = document.querySelector<HTMLElement>('[data-journey-hero]');
      if (hero) {
        tl.to(hero, { autoAlpha: 0, yPercent: -4, duration: 0.5, ease: 'power2.in' }, 0.25);
      }

      // The backdrop photograph drifts across the whole journey. Scheduled on
      // this timeline rather than its own trigger so it is scrubbed by the same
      // clock as the camera - a second trigger would drift by a frame.
      const backdrop = document.querySelector<HTMLElement>('[data-journey-backdrop]');
      if (backdrop) {
        tl.fromTo(
          backdrop,
          { yPercent: -3 },
          { yPercent: 3, duration: TIMELINE_SEGMENTS, ease: 'none' },
          0,
        );
      }
    }, stage);

    return () => ctx.revert();
  }, [camera, invalidate, trackId, stageId, tier]);

  return null;
}
