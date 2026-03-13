/**
 * InvestmentNode — floating rotating crystal gems above the city.
 *
 * Each investment category (Stocks, Crypto, ETF/Fund, Real Estate) is
 * visualised as an icosahedron that bobs, rotates, and pulses on arrival.
 * A thin light-beam connects each gem to the ground platform.
 */

import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getDistrictColor } from '../../constants/districtColors';

// ── District definitions (must match backend INVESTMENT_CLASSIFICATIONS) ──────
export const INVESTMENT_DISTRICT_DEFS = [
  { name: 'Stocks',      baseHeight: 16, angle: Math.PI * 0.15 },
  { name: 'Crypto',      baseHeight: 20, angle: Math.PI * 0.65 },
  { name: 'ETF/Fund',    baseHeight: 14, angle: Math.PI * 1.15 },
  { name: 'Real Estate', baseHeight: 18, angle: Math.PI * 1.65 },
];

const FLOAT_RADIUS = 11; // Gems orbit over the expense buildings

export function getInvestmentPositions(): Record<string, THREE.Vector3> {
  const result: Record<string, THREE.Vector3> = {};
  INVESTMENT_DISTRICT_DEFS.forEach((d) => {
    result[d.name] = new THREE.Vector3(
      Math.cos(d.angle) * FLOAT_RADIUS,
      d.baseHeight,
      Math.sin(d.angle) * FLOAT_RADIUS,
    );
  });
  return result;
}

// ── Single node ───────────────────────────────────────────────────────────────
interface NodeProps {
  name: string;
  color: string;
  basePosition: THREE.Vector3;
  amounts: number[];
  isActive: boolean;
  bobOffset: number;
}

function SingleNode({ name, color, basePosition, amounts, isActive, bobOffset }: NodeProps) {
  const meshRef   = useRef<THREE.Mesh>(null!);
  const glowRef   = useRef<THREE.Mesh>(null!);
  const beamRef   = useRef<THREE.Mesh>(null!);
  const lightRef  = useRef<THREE.PointLight>(null!);
  const smoothS   = useRef(0.6);
  const pulseRef  = useRef(0);
  const prevCount = useRef(amounts.length);
  const t         = useRef(bobOffset);

  const accumulated = amounts.reduce((s, a) => s + a, 0);
  const targetScale = Math.min(0.6 + Math.log1p(accumulated / 1000) * 0.7, 2.4);

  useFrame((_, delta) => {
    t.current += delta;

    // Smooth scale
    smoothS.current = THREE.MathUtils.lerp(smoothS.current, targetScale, 0.04);
    const s = smoothS.current;

    // Bob & rotate
    const bobY = Math.sin(t.current * 0.9 + bobOffset) * 0.6;
    const worldY = basePosition.y + bobY;

    if (meshRef.current) {
      meshRef.current.position.y = worldY;
      meshRef.current.rotation.y += delta * (isActive ? 0.6 : 0.2);
      meshRef.current.rotation.x += delta * 0.25;
      meshRef.current.scale.setScalar(s);
    }
    if (glowRef.current) {
      glowRef.current.position.y = worldY;
      glowRef.current.scale.setScalar(s * 1.6);
    }

    // Beam height from ground to gem
    if (beamRef.current) {
      beamRef.current.position.y = worldY / 2;
      beamRef.current.scale.y = worldY / 2;
    }

    // Pulse on new data
    if (amounts.length > prevCount.current) {
      pulseRef.current = 1.5;
      prevCount.current = amounts.length;
    }
    pulseRef.current = Math.max(0, pulseRef.current - delta * 1.2);

    if (lightRef.current) {
      lightRef.current.position.y = worldY;
      lightRef.current.intensity = (isActive ? 1.2 : 0.25) + pulseRef.current * 2;
    }
    if (meshRef.current) {
      (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        (isActive ? 0.8 : 0.2) + pulseRef.current;
    }
  });

  const colorObj = new THREE.Color(color);
  const dimOpacity = isActive ? 1 : 0.35;

  return (
    <group position={[basePosition.x, 0, basePosition.z]}>
      {/* Thin connector beam from ground to gem */}
      <mesh ref={beamRef}>
        <cylinderGeometry args={[0.04, 0.04, 2, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 0.6 : 0.1}
          transparent
          opacity={0.4 * dimOpacity}
        />
      </mesh>

      {/* Main gem (icosahedron) */}
      <mesh ref={meshRef} position={[0, basePosition.y, 0]} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          metalness={0.4}
          roughness={0.1}
          transparent
          opacity={0.88 * dimOpacity}
          wireframe={false}
        />
      </mesh>

      {/* Soft glow shell */}
      <mesh ref={glowRef} position={[0, basePosition.y, 0]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.12 * dimOpacity}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Point light */}
      <pointLight
        ref={lightRef}
        color={colorObj}
        intensity={isActive ? 1.2 : 0.25}
        distance={14}
      />

      {/* Label — follows the bobbing gem */}
      <Billboard follow position={[0, basePosition.y + smoothS.current * 1.6 + 0.6, 0]}>
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
            position={[0, -0.65, 0]}
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

// ── Scene-level wrapper ───────────────────────────────────────────────────────
interface InvestmentSceneProps {
  investmentTransactions: Array<{ district: string; amount: number; id: string; timestamp: number }>;
  isActive: boolean;
}

export function InvestmentScene({ investmentTransactions, isActive }: InvestmentSceneProps) {
  const positions = useMemo(() => getInvestmentPositions(), []);

  return (
    <>
      {INVESTMENT_DISTRICT_DEFS.map((def, idx) => {
        const pos = positions[def.name];
        const amounts = investmentTransactions
          .filter((t) => t.district === def.name)
          .map((t) => t.amount);
        return (
          <SingleNode
            key={def.name}
            name={def.name}
            color={getDistrictColor(def.name)}
            basePosition={pos}
            amounts={amounts}
            isActive={isActive}
            bobOffset={idx * 1.3}
          />
        );
      })}
    </>
  );
}
