import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

const PARTICLE_TRAVEL_TIME_MS = 2500;

const MAX_SCALE_Y = 2.0;

// Precomputed warning/danger colors (module-level, no GC pressure in useFrame)
const WARN_COLOR   = new THREE.Color('#f59e0b'); // orange — 80-100% of budget
const DANGER_COLOR = new THREE.Color('#ef4444'); // red    — over budget

interface DistrictTransaction {
  id: string;
  amount: number;
  timestamp: number;
}

interface CityDistrictProps {
  name: string;
  position: [number, number, number];
  color: string;
  icon: string;
  scale?: number;
  districtTransactions?: DistrictTransaction[];
  onClick?: (districtName: string) => void;
  isSelected?: boolean;
  /** 0–1 = under budget, >1 = exceeded. Drives building warning color. */
  budgetRatio?: number;
  /** Called every frame with current smooth scale so CityScene can track max height */
  onScaleUpdate?: (scale: number) => void;
  /** When search is active but this district doesn't match, dim the building */
  searchDimmed?: boolean;
}

export function CityDistrict({
  name,
  position,
  color,
  icon,
  scale = 1,
  districtTransactions = [],
  onClick,
  isSelected = false,
  budgetRatio,
  onScaleUpdate,
  searchDimmed = false,
}: CityDistrictProps) {
  const rootGroupRef  = useRef<THREE.Group>(null);
  const scaleGroupRef = useRef<THREE.Group>(null);
  const labelRef      = useRef<any>(null);
  const lightRef      = useRef<THREE.PointLight>(null);
  const buildingMeshRef = useRef<THREE.Mesh>(null);
  const glowMeshRef   = useRef<THREE.Mesh>(null);
  // Scan ring — lives OUTSIDE scaleGroup so it isn't stretched
  const ringMeshRef        = useRef<THREE.Mesh>(null);
  // Budget warning rings (inner + outer, both horizontal at ground level)
  const budgetRingInnerRef = useRef<THREE.Mesh>(null);
  const budgetRingOuterRef = useRef<THREE.Mesh>(null);
  const budgetRingT        = useRef(0);

  const arrivedIdsRef    = useRef<Set<string>>(new Set());
  const processedTxRefs  = useRef<Set<string>>(new Set());
  const arrivedAmountRef = useRef<number>(0);

  // Pure smooth-scale reference — NEVER multiplied by pump
  const smoothScaleYRef = useRef<number>(1.0);

  // Flash / emissive
  const flashRef    = useRef<number>(0);
  const emissiveRef = useRef<number>(0.3);

  // Ring sweep animation state
  const ringAnimRef = useRef({ opacity: 0, rise: 0 });

  const BASE_EMISSIVE = isSelected ? 1.5 : 0.3;

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (onClick) onClick(name);
  };

  useFrame((_state, delta) => {
    const now = Date.now();

    // ── 1. Detect newly arrived transactions ──────────────────────────────
    let newArrival = false;
    districtTransactions.forEach((tx) => {
      if (!arrivedIdsRef.current.has(tx.id) && now - tx.timestamp >= PARTICLE_TRAVEL_TIME_MS) {
        arrivedIdsRef.current.add(tx.id);
        arrivedAmountRef.current += tx.amount;
        if (!processedTxRefs.current.has(tx.id)) {
          processedTxRefs.current.add(tx.id);
          newArrival = true;
        }
      }
    });

    // ── 2. Trigger flash + ring sweep on arrival ──────────────────────────
    if (newArrival) {
      flashRef.current = 1.0;
      // Ring starts at current building top and sweeps upward
      ringAnimRef.current.opacity = 1.0;
      ringAnimRef.current.rise    = 0;
    }

    // ── 3. Decay flash ────────────────────────────────────────────────────
    flashRef.current = Math.max(0, flashRef.current - delta * 1.0);

    // ── 4. Target height scale (log curve, hard-capped) ──────────────────
    const arrived = arrivedAmountRef.current;
    // Divide by 30 to normalise typical transaction amounts (~$30 avg)
    const baseTargetScaleY = arrived > 0
      ? Math.min(1 + Math.log1p(arrived / 30) * 0.55, MAX_SCALE_Y)
      : 1;

    // ── 5. Smooth height animation (NO pump multiplier here) ──────────────
    smoothScaleYRef.current = THREE.MathUtils.lerp(
      smoothScaleYRef.current, baseTargetScaleY, 0.04
    );
    if (scaleGroupRef.current) {
      scaleGroupRef.current.scale.y = smoothScaleYRef.current;
    }

    // Notify parent of current scale for camera auto-zoom
    if (onScaleUpdate) onScaleUpdate(smoothScaleYRef.current);

    // ── 6. Update label position (above building top) ─────────────────────
    if (labelRef.current) {
      // building top in rootGroup space = -1.5*scale (scaleGroup origin) + 3*scale * smoothScale
      const buildingTopY = -1.5 * scale + 3 * scale * smoothScaleYRef.current;
      labelRef.current.position.y = buildingTopY + 0.6;
    }

    // ── 7. Emissive color + intensity (flash + budget warning) ───────────
    const br = budgetRatio ?? 0;  // shared by sections 7 and 11
    const targetEmissive = BASE_EMISSIVE + flashRef.current * 2.5;
    emissiveRef.current = THREE.MathUtils.lerp(emissiveRef.current, targetEmissive, delta * 5);
    if (buildingMeshRef.current) {
      const mat = buildingMeshRef.current.material as THREE.MeshStandardMaterial;

      if (br >= 1.0) {
        // Danger: pulsing red emissive
        const pulse = 0.5 + Math.sin(_state.clock.elapsedTime * 5) * 0.5;
        mat.emissive.set(color);
        mat.emissive.lerp(DANGER_COLOR, 0.75);
        mat.emissiveIntensity = 0.8 + pulse * 2.0;
      } else if (br >= 0.8) {
        // Warning: orange tint proportional to how close to limit
        const warnMix = (br - 0.8) / 0.2; // 0→1 as ratio goes 80%→100%
        mat.emissive.set(color);
        mat.emissive.lerp(WARN_COLOR, warnMix * 0.6);
        mat.emissiveIntensity = emissiveRef.current + warnMix * 0.6;
      } else {
        mat.emissive.set(color);
        mat.emissiveIntensity = emissiveRef.current;
      }
    }

    // ── 8. Glow mesh opacity + search dim ────────────────────────────────
    const targetOpacity = searchDimmed ? 0.12 : 0.08 + flashRef.current * 0.45;
    if (glowMeshRef.current) {
      const mat = glowMeshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, delta * 5);
    }
    if (buildingMeshRef.current && searchDimmed) {
      const mat = buildingMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity ?? 1, 0.22, delta * 4);
      mat.transparent = true;
    } else if (buildingMeshRef.current && !searchDimmed) {
      const mat = buildingMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity ?? 1, 1, delta * 4);
    }

    // ── 9. Point light ────────────────────────────────────────────────────
    if (lightRef.current) {
      const base = isSelected ? 4 : 1.2;
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity, base + flashRef.current * 7, delta * 5
      );
      lightRef.current.distance = THREE.MathUtils.lerp(
        lightRef.current.distance, 7 + flashRef.current * 9, delta * 5
      );
    }

    // ── 10. Construction scan ring animation ──────────────────────────────
    if (ringMeshRef.current && ringAnimRef.current.opacity > 0) {
      ringAnimRef.current.opacity = Math.max(0, ringAnimRef.current.opacity - delta * 1.4);
      ringAnimRef.current.rise   += delta * 2.0;

      const buildingTopY = -1.5 * scale + 3 * scale * smoothScaleYRef.current;
      ringMeshRef.current.position.y  = buildingTopY + ringAnimRef.current.rise;
      ringMeshRef.current.scale.setScalar(1 + ringAnimRef.current.rise * 0.3); // ring expands outward
      const mat = ringMeshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = ringAnimRef.current.opacity;
    }

    // ── 11. Per-building budget warning ring ──────────────────────────────
    if (br >= 0.7 && (budgetRingInnerRef.current || budgetRingOuterRef.current)) {
      budgetRingT.current += delta;

      // Color: yellow→orange→red as ratio increases
      const ringColor = br >= 1.0
        ? new THREE.Color('#ef4444')
        : br >= 0.9
          ? new THREE.Color('#f97316')
          : new THREE.Color('#fbbf24');

      // Pulse speed/amplitude grows with severity
      const pulseSpeed = 2.0 + br * 4.0;
      const pulse = 0.5 + Math.abs(Math.sin(budgetRingT.current * pulseSpeed)) * 0.5;
      // Outer ring rotates slowly for extra drama
      const rotationSpeed = 0.4 + br * 0.6;

      if (budgetRingInnerRef.current) {
        const mat = budgetRingInnerRef.current.material as THREE.MeshStandardMaterial;
        mat.color.copy(ringColor);
        mat.emissive.copy(ringColor);
        mat.emissiveIntensity = 0.6 + pulse * (br >= 1.0 ? 2.5 : 1.2);
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.55 + pulse * 0.3, delta * 5);
        mat.transparent = true;
      }
      if (budgetRingOuterRef.current) {
        budgetRingOuterRef.current.rotation.z += rotationSpeed * delta;
        const mat = budgetRingOuterRef.current.material as THREE.MeshStandardMaterial;
        mat.color.copy(ringColor);
        mat.emissive.copy(ringColor);
        mat.emissiveIntensity = 0.3 + pulse * 0.9;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0.30 + pulse * 0.2, delta * 5);
        mat.transparent = true;
      }
    } else {
      // Fade out rings when below threshold
      if (budgetRingInnerRef.current) {
        const mat = budgetRingInnerRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, delta * 3);
      }
      if (budgetRingOuterRef.current) {
        const mat = budgetRingOuterRef.current.material as THREE.MeshStandardMaterial;
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, 0, delta * 3);
      }
    }

    // ── 12. Idle float ────────────────────────────────────────────────────
    if (rootGroupRef.current) {
      rootGroupRef.current.position.y =
        position[1] + Math.sin(_state.clock.elapsedTime * 0.5 + position[0]) * 0.08;
      rootGroupRef.current.rotation.y =
        Math.sin(_state.clock.elapsedTime * 0.3 + position[2]) * 0.04;
    }
  });

  // Suppress unused icon prop (reserved for future icon rendering)
  void icon;

  return (
    <group position={position} ref={rootGroupRef}>

      {/* ── Scale group: Y-scale drives building height ── */}
      <group position={[0, -1.5 * scale, 0]} ref={scaleGroupRef}>

        {/* Main building */}
        <mesh
          ref={buildingMeshRef}
          position={[0, 1.5 * scale, 0]}
          castShadow
          receiveShadow
          onClick={handleClick}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'default')}
        >
          <boxGeometry args={[2 * scale, 3 * scale, 2 * scale]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={BASE_EMISSIVE}
            metalness={isSelected ? 0.4 : 0.75}
            roughness={0.2}
          />
        </mesh>

        {/* Glow outline — back-face larger box */}
        <mesh ref={glowMeshRef} position={[0, 1.5 * scale, 0]}>
          <boxGeometry args={[2.2 * scale, 3.2 * scale, 2.2 * scale]} />
          <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.BackSide} />
        </mesh>
      </group>

      {/* ── Construction scan ring (outside scaleGroup to avoid y-stretch) ── */}
      <mesh ref={ringMeshRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0 * scale, 1.4 * scale, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>

      {/* ── Budget warning rings — flat at ground level, glow when >70% budget ── */}
      {/* Inner ring: solid pulse */}
      <mesh
        ref={budgetRingInnerRef}
        position={[0, -1.45 * scale, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[1.6 * scale, 1.85 * scale, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Outer ring: wider, rotates slowly */}
      <mesh
        ref={budgetRingOuterRef}
        position={[0, -1.42 * scale, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[2.0 * scale, 2.18 * scale, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* ── Billboard label — always faces camera ── */}
      <Billboard ref={labelRef} position={[0, 2 * scale, 0]} follow>
        <Text
          fontSize={0.32}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.025}
          outlineColor="#000000"
        >
          {name}
        </Text>
      </Billboard>

      {/* Point light */}
      <pointLight
        ref={lightRef}
        position={[0, 2, 0]}
        color={color}
        intensity={1.2}
        distance={7}
        decay={2}
      />

      {/* Ground platform */}
      <mesh position={[0, -1.6 * scale, 0]} receiveShadow>
        <cylinderGeometry args={[1.5 * scale, 1.5 * scale, 0.2, 32]} />
        <meshStandardMaterial
          color={color}
          metalness={0.9}
          roughness={0.1}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>
    </group>
  );
}
