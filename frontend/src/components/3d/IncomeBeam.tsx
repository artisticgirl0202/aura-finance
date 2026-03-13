/**
 * IncomeBeam — glowing vertical pillars in an outer ring.
 *
 * Each income district (Salary, Freelance, …) is represented by a
 * tall neon column.  When income arrives the beam pulses and grows.
 * Tiny particles rain downward from the tip to the ground level.
 */

import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getDistrictColor } from '../../constants/districtColors';

// ── District definitions (must match backend INCOME_CLASSIFICATIONS) ─────────
export const INCOME_DISTRICT_DEFS = [
  { name: 'Salary' },
  { name: 'Freelance' },
  { name: 'Bonus' },
  { name: 'Rental Income' },
  { name: 'Side Income' },
];

export const INCOME_RADIUS = 16;

/** Compute world positions for all income districts (outer ring). */
export function getIncomePositions(): Record<string, THREE.Vector3> {
  const step = (Math.PI * 2) / INCOME_DISTRICT_DEFS.length;
  const result: Record<string, THREE.Vector3> = {};
  INCOME_DISTRICT_DEFS.forEach((d, i) => {
    const a = step * i + Math.PI / INCOME_DISTRICT_DEFS.length; // offset so it doesn't align with expense ring
    result[d.name] = new THREE.Vector3(
      Math.cos(a) * INCOME_RADIUS,
      0,
      Math.sin(a) * INCOME_RADIUS,
    );
  });
  return result;
}

// ── Falling particle constants ────────────────────────────────────────────────
const PARTICLE_COUNT = 24;

interface IncomeBeamProps {
  name: string;
  position: [number, number, number];
  color: string;
  /** Array of income transaction amounts for this district */
  amounts: number[];
  isActive: boolean;
}

function IncomeBeamInner({ name, position, color, amounts, isActive }: IncomeBeamProps) {
  // Accumulated income → beam height (log scale, capped)
  const accumulated = amounts.reduce((s, a) => s + a, 0);
  const targetHeight = Math.min(1 + Math.log1p(accumulated / 500) * 3.5, 8);

  const beamRef      = useRef<THREE.Mesh>(null!);
  const glowRef      = useRef<THREE.Mesh>(null!);
  const lightRef     = useRef<THREE.PointLight>(null!);
  const smoothH      = useRef(0.1);
  const pulseRef     = useRef(0);
  const prevCount    = useRef(amounts.length);

  // Particle positions (falling rain)
  const particlePositions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 0.8;
      arr[i * 3 + 1] = Math.random() * 10;          // start at various heights
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    return arr;
  }, []);
  const particleSpeeds = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, () => 0.04 + Math.random() * 0.06),
    [],
  );
  const particleGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(particlePositions.slice(), 3));
    return g;
  }, [particlePositions]);

  useFrame((_, delta) => {
    // Smooth height
    smoothH.current = THREE.MathUtils.lerp(smoothH.current, targetHeight, 0.05);
    const h = smoothH.current;

    if (beamRef.current) {
      beamRef.current.scale.y = h;
      beamRef.current.position.y = h / 2;
    }
    if (glowRef.current) {
      glowRef.current.scale.y = h;
      glowRef.current.position.y = h / 2;
    }

    // Pulse on new income
    if (amounts.length > prevCount.current) {
      pulseRef.current = 1;
      prevCount.current = amounts.length;
    }
    pulseRef.current = Math.max(0, pulseRef.current - delta * 1.5);

    if (lightRef.current) {
      lightRef.current.intensity = (isActive ? 1.0 : 0.3) + pulseRef.current * 2;
    }

    // Animate particles (rain downward from beam tip)
    const positions = particleGeo.attributes.position.array as Float32Array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3 + 1] -= particleSpeeds[i] * (isActive ? 1 : 0.3);
      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = h + Math.random() * 2;
        positions[i * 3 + 0] = (Math.random() - 0.5) * 0.8;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;
  });

  const colorObj = new THREE.Color(color);
  const dimAlpha = isActive ? 1 : 0.35;

  return (
    <group position={position}>
      {/* ── Core beam ── */}
      <mesh ref={beamRef}>
        <cylinderGeometry args={[0.18, 0.25, 1, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 1.4 : 0.5}
          transparent
          opacity={0.85 * dimAlpha}
        />
      </mesh>

      {/* ── Soft outer glow shell ── */}
      <mesh ref={glowRef}>
        <cylinderGeometry args={[0.45, 0.55, 1, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.4 : 0.1}
          transparent
          opacity={0.18 * dimAlpha}
          side={THREE.BackSide}
        />
      </mesh>

      {/* ── Flat base ring ── */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.7, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.8 : 0.2}
          transparent
          opacity={0.6 * dimAlpha}
        />
      </mesh>

      {/* ── Point light ── */}
      <pointLight
        ref={lightRef}
        color={colorObj}
        intensity={isActive ? 1 : 0.3}
        distance={10}
        position={[0, 3, 0]}
      />

      {/* ── Falling particles ── */}
      <points geometry={particleGeo}>
        <pointsMaterial
          color={color}
          size={0.12}
          transparent
          opacity={isActive ? 0.85 : 0.3}
          sizeAttenuation
        />
      </points>

      {/* ── Billboard label ── */}
      <Billboard follow position={[0, smoothH.current + 1.2, 0]}>
        <Text
          fontSize={0.55}
          color={color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#000000"
        >
          {name}
        </Text>
        {accumulated > 0 && (
          <Text
            fontSize={0.42}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            position={[0, -0.7, 0]}
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            ${accumulated.toFixed(0)}
          </Text>
        )}
      </Billboard>
    </group>
  );
}

// ── Scene-level wrapper (renders all income beams) ────────────────────────────
interface IncomeSceneProps {
  /** All income-type transactions */
  incomeTransactions: Array<{ district: string; amount: number; id: string; timestamp: number }>;
  isActive: boolean;
}

export function IncomeScene({ incomeTransactions, isActive }: IncomeSceneProps) {
  const positions = useMemo(() => getIncomePositions(), []);

  return (
    <>
      {INCOME_DISTRICT_DEFS.map((def) => {
        const pos = positions[def.name];
        const amounts = incomeTransactions
          .filter((t) => t.district === def.name)
          .map((t) => t.amount);
        return (
          <IncomeBeamInner
            key={def.name}
            name={def.name}
            position={[pos.x, pos.y, pos.z]}
            color={getDistrictColor(def.name)}
            amounts={amounts}
            isActive={isActive}
          />
        );
      })}
    </>
  );
}
