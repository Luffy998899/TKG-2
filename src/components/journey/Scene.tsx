'use client';

import { Suspense, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { divisions, type Division } from '@/config/divisions';
import { imageMeta } from '@/lib/images';
import { journey } from '@/lib/scroll-store';
import { clamp, damp, progressBetween, smootherstep } from '@/lib/motion';
import {
  SPACING,
  TIMELINE_SEGMENTS,
  approachOf,
  layoutFor,
  slabPosition,
  slabSide,
  type Tier,
} from './journey-config';

/* =========================================================================
   Everything in here is a pure function of scroll.

   The camera itself is driven by the GSAP timeline in CameraTimeline.tsx
   (that is what makes it scrubbable and reversible). This file reads the same
   `journey.progress` value on every frame and lerps the *scene* from it -
   slab rotation, emissive intensity, the depth field's drift.

   `damp()` is frame-rate independent, so a 120Hz laptop and a 60Hz monitor
   settle at the same wall-clock speed.
   ========================================================================= */

/**
 * The card is sized FROM the photograph, not the other way round.
 *
 * The photo is 16:10 and 0.18 in from the left, right and top edges; below it
 * sits a 0.62 caption block carrying the two accent bars. Everything else is
 * derived, so the panel can never grow a dead area again - which is exactly
 * what a fixed 3.6 height did when the art was only 1.78 tall.
 */
const SLAB_W = 3.2;
const MARGIN = 0.18;
const CAPTION_H = 0.62;

const ART_W = SLAB_W - MARGIN * 2;
const ART_H = ART_W / 1.6;

const SLAB_H = ART_H + MARGIN * 2 + CAPTION_H;
/** Centre of the art, measured from the centre of the panel. */
const ART_Y = SLAB_H / 2 - MARGIN - ART_H / 2;
/** Top of the caption block. */
const CAPTION_TOP = ART_Y - ART_H / 2;

/**
 * The slab panel: a cool near-white mount carrying the division's photograph -
 * a lit card floating in a dark corridor, which is what gives the scene its
 * depth now that the ground is night rather than paper.
 */
const PANEL = '#F4F6F8';

/** The dark ground. Kept in step with --night in globals.css. */
const NIGHT = '#0E1219';

export interface SceneProps {
  /** 'lite' narrows the corridor, halves the depth field, drops the fill light. */
  tier: Tier;
}

export function Scene({ tier }: SceneProps) {
  const lite = tier === 'lite';

  return (
    <>
      {/* A warm key plus a cool hemisphere. No HDR environment map: it would
          add a network request and a render target for very little on matte
          surfaces. */}
      {/* Dark room: a low cool ambient so nothing goes pure black, and one
          warm key that picks out the front face of each card. The fill is a
          cold bounce from behind, which separates the card edges from the
          backdrop photograph. */}
      <hemisphereLight args={['#8fa4c4', '#0E1219', 0.55]} />
      <directionalLight position={[4, 8, 6]} intensity={2.1} color="#fff2e2" />
      {!lite && <directionalLight position={[-7, 2, -5]} intensity={0.7} color="#7fa8ff" />}

      {/* Fog fades the corridor into the backdrop rather than into a wall. */}
      <fog attach="fog" args={[NIGHT, 13, 42]} />

      <CameraReactor tier={tier} />
      <Corridor />

      {divisions.map((division, i) => (
        <Slab key={division.slug} index={i} division={division} lite={lite} tier={tier} />
      ))}

      <DepthField count={lite ? 120 : 320} />
    </>
  );
}

/* ------------------------------------------------------------------ camera */

/**
 * The GSAP timeline owns camera.position and the look target. This component
 * only adds the parts that should react to *velocity* rather than position:
 * a slight roll into the turn, and a focal-length squeeze when moving fast.
 * Both are damped, so an interrupted scroll never snaps.
 */
function CameraReactor({ tier }: { tier: Tier }) {
  const { camera } = useThree();
  const baseFov = layoutFor(tier).fov;
  const roll = useRef(0);
  const fov = useRef(baseFov);

  useFrame((_, dt) => {
    const d = Math.min(dt, 1 / 20); // clamp after a stalled tab

    const seg = journey.progress * TIMELINE_SEGMENTS;
    const divisionIndex = clamp(Math.round(seg) - 1, 0, divisions.length - 1);
    const targetRoll =
      slabSide(divisionIndex) *
      approachOf(divisionIndex) *
      0.05 *
      smootherstep(progressBetween(seg, 0.4, 1.2));
    roll.current = damp(roll.current, targetRoll, 6, d);
    camera.rotation.z = roll.current;

    // Fast scrolling widens the lens a touch - the same cue a dolly-zoom uses
    // to say "you are moving". Capped so it never reads as a glitch.
    const speed = Math.min(Math.abs(journey.velocity) / 2600, 1);
    fov.current = damp(fov.current, baseFov + speed * 5, 5, d);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - fov.current) > 0.01) {
      cam.fov = fov.current;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

/* --------------------------------------------------------------- corridor */

/**
 * The ground and two floor rails. They exist to give the corridor a horizon and
 * a vanishing point - without them the slabs float in an empty void and the
 * camera travel reads as scaling, not movement.
 */
function Corridor() {
  const length = (divisions.length + 2) * SPACING;
  const railGeometry = useMemo(() => new THREE.BoxGeometry(0.05, 0.05, length), [length]);
  const railMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#5A6880', transparent: true, opacity: 0.85 }),
    [],
  );

  return (
    <group position={[0, 0, -length / 2 + SPACING]}>
      {/* Slightly lighter than the fog so the floor reads as a surface
          catching light, not as a hole. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.65, 0]}>
        <planeGeometry args={[26, length]} />
        <meshStandardMaterial color="#161C26" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh geometry={railGeometry} material={railMaterial} position={[-5.6, -2.6, 0]} />
      <mesh geometry={railGeometry} material={railMaterial} position={[5.6, -2.6, 0]} />
    </group>
  );
}

/* ------------------------------------------------------------------- slab */

interface SlabProps {
  index: number;
  division: Division;
  lite: boolean;
  tier: Tier;
}

/**
 * One division, as a physical card in the corridor: a pale panel carrying that
 * division's artwork, with an accent hairline down its leading edge.
 *
 * It angles toward the camera as its beat comes up and swings away once the
 * camera has passed - reversibly, because the rotation is derived from
 * `journey.progress`, not played on a clock.
 */
function Slab({ index, division, lite, tier }: SlabProps) {
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const turn = useRef(0);
  const lift = useRef(0);

  const position = useMemo(() => slabPosition(index, tier), [index, tier]);
  const side = slabSide(index);
  const { accent, accentBright, glow } = division.theme;
  const artSrc = imageMeta(division.slug)?.texture;

  useFrame((_, dt) => {
    if (!group.current || !material.current) return;
    const d = Math.min(dt, 1 / 20);

    // How close is this division's beat? 1 at its stop, 0 more than a segment away.
    const seg = journey.progress * TIMELINE_SEGMENTS;
    const focus = 1 - clamp(Math.abs(seg - (index + 1)) / 1.15);
    const eased = smootherstep(focus);

    // Angled toward the camera at its beat, swinging away to near edge-on once
    // the camera has passed. `side` flips the whole arc for a mirrored beat.
    turn.current = damp(turn.current, side * (-0.34 - (1 - eased) * 0.61), 7, d);
    group.current.rotation.y = turn.current;

    lift.current = damp(lift.current, eased * 0.32, 7, d);
    group.current.position.y = position[1] + lift.current;

    material.current.emissiveIntensity = 0.05 + eased * 0.42;

    if (glowRef.current) {
      const gm = glowRef.current.material as THREE.MeshBasicMaterial;
      gm.opacity = 0.12 + eased * 0.68;
    }
  });

  return (
    <group ref={group} position={position}>
      {/* The panel itself. */}
      <mesh>
        <boxGeometry args={[SLAB_W, SLAB_H, 0.16]} />
        <meshStandardMaterial
          ref={material}
          color={PANEL}
          emissive={glow}
          emissiveIntensity={0.05}
          roughness={0.45}
          metalness={0.04}
        />
      </mesh>

      {/* The photograph. Loaded on every tier: the whole texture set is ~212kB,
          it arrives after first paint, and without it a phone shows seven blank
          panels against the backdrop — which reads as a failed load rather than
          a design. The overlay card carries the same image as a next/image
          thumbnail regardless. */}
      {artSrc && (
        <Suspense fallback={null}>
          <SlabArt src={artSrc} />
        </Suspense>
      )}

      {/* Accent hairline down the leading edge — the only saturated colour in
          the scene, so it reads as a signal rather than decoration. */}
      <mesh ref={glowRef} position={[-side * (SLAB_W / 2 - 0.07), 0, 0.09]}>
        <planeGeometry args={[0.075, SLAB_H - MARGIN * 2]} />
        <meshBasicMaterial color={accentBright} transparent opacity={0.12} toneMapped={false} />
      </mesh>

      {/* Caption bar under the artwork — reads as a card, not a poster. */}
      <mesh position={[-side * ART_W * 0.11, CAPTION_TOP - 0.2, 0.081]}>
        <planeGeometry args={[ART_W * 0.56, 0.075]} />
        <meshBasicMaterial color={accent} transparent opacity={0.62} toneMapped={false} />
      </mesh>
      <mesh position={[-side * ART_W * 0.27, CAPTION_TOP - 0.4, 0.081]}>
        <planeGeometry args={[ART_W * 0.24, 0.05]} />
        <meshBasicMaterial color={accent} transparent opacity={0.32} toneMapped={false} />
      </mesh>

      {!lite && (
        <mesh position={[0, -SLAB_H / 2 - 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[SLAB_W * 1.5, 2.4]} />
          <meshBasicMaterial color={glow} transparent opacity={0.12} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/**
 * The division's artwork as a texture. Split into its own component so the
 * `useTexture` suspension only holds back this one plane — the corridor and
 * the untextured panels render immediately.
 */
function SlabArt({ src }: { src: string }) {
  const gl = useThree((s) => s.gl);
  const texture = useTexture(src);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.needsUpdate = true;
  }, [texture, gl]);

  return (
    <mesh position={[0, ART_Y, 0.082]}>
      <planeGeometry args={[ART_W, ART_H]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

/* ------------------------------------------------------------ depth field */

/**
 * A single points cloud for parallax. One draw call, no textures. Its drift is
 * scroll-derived, not time-derived, so a still page is a still scene - which is
 * what makes the `frameloop` throttling safe.
 */
function DepthField({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const length = (divisions.length + 1) * SPACING;
    const positions = new Float32Array(count * 3);
    // Deterministic pseudo-random: the same layout every render, no seed lib.
    let seed = 20240917;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (rand() - 0.5) * 16;
      positions[i * 3 + 1] = (rand() - 0.5) * 9;
      positions[i * 3 + 2] = -rand() * length + SPACING;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: '#cfe0ff',
        size: 0.03,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    [],
  );

  useFrame((_, dt) => {
    if (!points.current) return;
    const d = Math.min(dt, 1 / 20);
    points.current.rotation.z = damp(points.current.rotation.z, journey.progress * 0.35, 3, d);
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled />;
}
