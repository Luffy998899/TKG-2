'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { journey } from '@/lib/scroll-store';
import { Scene } from './Scene';
import { CameraTimeline } from './CameraTimeline';
import { cameraStops, layoutFor, type Tier } from './journey-config';

/* =========================================================================
   Canvas host. Dynamically imported with `ssr: false` from Journey.tsx, so
   three.js is never in the server bundle and never in the critical path.

   Two throttles keep this cheap:
     - `frameloop` flips to 'never' whenever the stage leaves the viewport, so
       the GPU is idle on every other section of the page.
     - the scene tier drops geometry and lights on small or low-core devices.
   ========================================================================= */

/**
 * Called synchronously on first render - this module is only ever loaded on the
 * client (`ssr: false`), so `window` is guaranteed and the Canvas can mount
 * with the right camera and DPR instead of correcting itself a frame later.
 */
function detectTier(): Tier {
  if (typeof window === 'undefined') return 'full';
  const smallViewport = window.matchMedia('(max-width: 768px)').matches;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  return smallViewport || fewCores || coarse ? 'lite' : 'full';
}

export default function SceneCanvas({ trackId, stageId }: { trackId: string; stageId: string }) {
  const [tier] = useState<Tier>(detectTier);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    journey.webglReady = true;
    return () => {
      journey.webglReady = false;
    };
  }, []);

  // Stop rendering entirely once the pinned stage is off screen.
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: '160px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={host} className="absolute inset-0" aria-hidden="true">
      <Canvas
        frameloop={visible ? 'always' : 'never'}
        dpr={tier === 'lite' ? [1, 1.5] : [1, 2]}
        gl={{
          antialias: tier === 'full',
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        camera={{
          fov: layoutFor(tier).fov,
          near: 0.1,
          far: 60,
          position: cameraStops(tier)[0].position,
        }}
        // No shadow maps anywhere in this scene - the lighting is matte and
        // shadows would cost a full extra pass for something invisible.
        shadows={false}
        style={{ pointerEvents: 'none' }}
      >
        <CameraTimeline trackId={trackId} stageId={stageId} tier={tier} />
        <Scene tier={tier} />
      </Canvas>
    </div>
  );
}
