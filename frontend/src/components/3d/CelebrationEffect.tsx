/**
 * CelebrationEffect — goal-achievement fireworks in 3D space.
 *
 * When income or investment goals are achieved, colourful particles
 * burst outward from above the city, arc, and fade away.
 * The effect auto-dismisses after ~2.5 seconds and notifies the parent.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const BURST_COUNT  = 5;   // simultaneous shells
const PARTS_PER_BURST = 40;
const TOTAL_PARTS  = BURST_COUNT * PARTS_PER_BURST;
const DURATION_SEC = 2.8;

const PALETTE = [
  '#fbbf24', '#ef4444', '#10b981', '#06b6d4',
  '#8b5cf6', '#f97316', '#ec4899', '#a3e635',
];

function randomColor() {
  return new THREE.Color(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
}

function randomRange(lo: number, hi: number) {
  return lo + Math.random() * (hi - lo);
}

interface Shell {
  origin: THREE.Vector3;
  particles: Array<{
    velocity: THREE.Vector3;
    color: THREE.Color;
  }>;
}

function buildShells(): Shell[] {
  return Array.from({ length: BURST_COUNT }, (_, si) => {
    const angle = (si / BURST_COUNT) * Math.PI * 2;
    const origin = new THREE.Vector3(
      Math.cos(angle) * randomRange(3, 9),
      randomRange(14, 24),
      Math.sin(angle) * randomRange(3, 9),
    );
    const color = randomColor();
    const particles = Array.from({ length: PARTS_PER_BURST }, () => {
      const phi   = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      const speed = randomRange(2.5, 6);
      return {
        velocity: new THREE.Vector3(
          Math.sin(theta) * Math.cos(phi) * speed,
          Math.cos(theta) * speed,
          Math.sin(theta) * Math.sin(phi) * speed,
        ),
        color: Math.random() > 0.3 ? color : randomColor(),
      };
    });
    return { origin, particles };
  });
}

// ── Single burst effect ───────────────────────────────────────────────────────
interface CelebrationBurstProps {
  onDone: () => void;
}

function CelebrationBurst({ onDone }: CelebrationBurstProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const tRef    = useRef(0);
  const done    = useRef(false);

  const shells  = useMemo(() => buildShells(), []);

  // Build per-instance buffers
  const instanceColors = useMemo(() => {
    const arr = new Float32Array(TOTAL_PARTS * 3);
    let idx = 0;
    shells.forEach((s) => s.particles.forEach((p) => {
      arr[idx++] = p.color.r;
      arr[idx++] = p.color.g;
      arr[idx++] = p.color.b;
    }));
    return arr;
  }, [shells]);

  useEffect(() => {
    if (!meshRef.current) return;
    const colorAttr = new THREE.InstancedBufferAttribute(instanceColors, 3);
    meshRef.current.instanceColor = colorAttr;
  }, [instanceColors]);

  useFrame((_, delta) => {
    if (done.current || !meshRef.current) return;
    tRef.current += delta;
    const t = tRef.current;
    const progress = t / DURATION_SEC;

    if (t > DURATION_SEC) {
      meshRef.current.visible = false;
      if (!done.current) { done.current = true; onDone(); }
      return;
    }

    const dummy = new THREE.Object3D();
    const GRAVITY = -4;

    let instanceIdx = 0;
    shells.forEach((s) => {
      s.particles.forEach((p) => {
        const px = s.origin.x + p.velocity.x * t;
        const py = s.origin.y + p.velocity.y * t + 0.5 * GRAVITY * t * t;
        const pz = s.origin.z + p.velocity.z * t;

        dummy.position.set(px, py, pz);
        // Fade + shrink toward end
        const scale = Math.max(0, 1 - progress * 0.8) * 0.18;
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(instanceIdx++, dummy.matrix);
      });
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Update opacity via emissiveIntensity proxy (material is shared)
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = Math.max(0, 1 - progress * 1.5);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TOTAL_PARTS]} castShadow={false}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshStandardMaterial
        emissive="#ffffff"
        emissiveIntensity={1}
        color="#ffffff"
        vertexColors
      />
    </instancedMesh>
  );
}

// ── Public wrapper — one burst per achieved goal ──────────────────────────────
interface CelebrationEffectProps {
  /** Keys of newly achieved goals (triggers one burst per key). */
  achievedGoals: Set<string>;
  onGoalCelebrated: (key: string) => void;
}

export function CelebrationEffect({ achievedGoals, onGoalCelebrated }: CelebrationEffectProps) {
  // Convert set to stable array of pending goal keys
  const [pending, setPending] = useState<string[]>([]);

  useEffect(() => {
    if (achievedGoals.size === 0) return;
    setPending((prev) => {
      const next = [...prev];
      achievedGoals.forEach((k) => { if (!next.includes(k)) next.push(k); });
      return next;
    });
  }, [achievedGoals]);

  if (pending.length === 0) return null;

  const key = pending[0];
  return (
    <CelebrationBurst
      key={key}
      onDone={() => {
        onGoalCelebrated(key);
        setPending((prev) => prev.filter((k) => k !== key));
      }}
    />
  );
}
