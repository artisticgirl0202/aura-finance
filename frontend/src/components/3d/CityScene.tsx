import { Environment, OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, ChromaticAberration, EffectComposer, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { getDistrictColor } from '../../constants/districtColors';
import { normalizeDistrictFor3D } from '../../utils/districtMap';
import { CelebrationEffect } from './CelebrationEffect';
import { CityDistrict } from './CityDistrict';
import { IncomeScene } from './IncomeBeam';
import { InvestmentScene } from './InvestmentNode';
import { ParticleSystem } from './ParticleSystem';

type ActiveTab = 'expense' | 'income' | 'investment';

interface Transaction {
  id: string;
  type?: ActiveTab;
  district: string;
  color: string;
  amount: number;
  timestamp: number;
  description?: string;
}

interface CitySceneProps {
  transactions: Transaction[];
  districts: Array<{
    id: string;
    name: string;
    icon: string;
    color: string;
  }>;
  onDistrictSelect?: (districtName: string | null) => void;
  selectedDistrict?: string | null;
  budgetRatios?: Record<string, number>;
  activeTab?: ActiveTab;
  achievedGoals?: Set<string>;
  onGoalCelebrated?: (key: string) => void;
  searchQuery?: string;
}


/**
 * CameraRig — owns OrbitControls and drives smooth camera animation.
 *
 * Overview mode: camera height/distance scales automatically with the
 * tallest building (maxScaleRef) so nothing ever clips out of frame.
 *
 * Zoom-in mode: camera moves along the vector from city-center → building,
 * always approaching from outside the ring regardless of building direction.
 */
function CameraRig({
  targetPosition,
  maxScaleRef,
  orbitControlsProps,
}: {
  targetPosition: THREE.Vector3 | null;
  maxScaleRef: React.MutableRefObject<number>;
  orbitControlsProps?: React.ComponentProps<typeof OrbitControls>;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  const destVec = useRef(new THREE.Vector3(0, 32, 28));
  const lookVec = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (targetPosition) {
      // ── Zoom-in: radial offset from building outward ────────────────────
      const radial = new THREE.Vector3(targetPosition.x, 0, targetPosition.z);
      const radialLen = radial.length();
      const dir = radialLen > 0.001
        ? radial.clone().divideScalar(radialLen)
        : new THREE.Vector3(0, 0, 1);

      // Camera sits back + up from the building
      const BACK   = 16;
      const HEIGHT = 11;
      destVec.current.set(
        targetPosition.x + dir.x * BACK,
        targetPosition.y + HEIGHT,
        targetPosition.z + dir.z * BACK
      );
      lookVec.current.set(targetPosition.x, targetPosition.y + 2, targetPosition.z);

    } else {
      // ── Overview: pull camera back when buildings grow tall ─────────────
      // maxScale is in [1, 2.0]; when tall buildings exist, zoom out
      const ms = Math.max(1, maxScaleRef.current);
      // Extra Y and Z grow linearly with building height
      const extraY = (ms - 1) * 14; // up to +14 units higher
      const extraZ = (ms - 1) * 10; // up to +10 units further back
      destVec.current.set(0, 32 + extraY, 28 + extraZ);
      lookVec.current.set(0, (ms - 1) * 2, 0); // look slightly higher when tall
    }

    camera.position.lerp(destVec.current, 0.04);

    if (controlsRef.current) {
      controlsRef.current.target.lerp(lookVec.current, 0.04);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      {...orbitControlsProps}
    />
  );
}

/**
 * Aura Finance 3D 도시 메인 씬
 * AI가 분류한 거래를 실시간으로 시각화
 */
export function CityScene({
  transactions, districts, onDistrictSelect, selectedDistrict,
  budgetRatios, activeTab = 'expense',
  achievedGoals = new Set(), onGoalCelebrated,
  searchQuery = '',
}: CitySceneProps) {

  const maxScaleRef = useRef<number>(1);
  const sessionStartRef = useRef<number>(Date.now()); // 새로고침 후 첫 렌더 시점

  // ── Type-split transactions ──────────────────────────────────────────────
  const expenseTransactions  = useMemo(() => transactions.filter(t => !t.type || t.type === 'expense'), [transactions]);
  const incomeTransactions   = useMemo(() => transactions.filter(t => t.type === 'income'),   [transactions]);
  const investTransactions   = useMemo(() => transactions.filter(t => t.type === 'investment'), [transactions]);

  // 🌟 구역별 거래 목록 — 정확히 1개 District만 매칭 (타겟 건물만 성장)
  // 방어: 새로고침 후 DB에서 불러온 이전 세션 거래는 건물 성장에서 제외
  const districtNamesSet = useMemo(() => new Set(districts.map((d) => d.name)), [districts]);
  const districtTransactionMap = useMemo(() => {
    const sessionStart = sessionStartRef.current;
    const cutoff = sessionStart - 1000;
    const map: Record<string, Array<{ id: string; amount: number; timestamp: number }>> = {};
    expenseTransactions.forEach((tx) => {
      const ts = tx.timestamp ?? 0;
      if (ts < cutoff) return; // 이전 세션 거래 제외
      const key = normalizeDistrictFor3D(tx.district);
      if (!districtNamesSet.has(key)) return;
      if (!map[key]) map[key] = [];
      map[key].push({ id: tx.id, amount: tx.amount, timestamp: ts });
    });
    return map;
  }, [expenseTransactions, districtNamesSet]);

  // 구역별 3D 위치 계산 (원형 배치)
  const districtPositions = useMemo(() => {
    const positions: Record<string, THREE.Vector3> = {};
    const radius = 8;
    const angleStep = (Math.PI * 2) / districts.length;

    districts.forEach((district, index) => {
      const angle = angleStep * index;
      positions[district.name] = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      );
    });

    return positions;
  }, [districts]);

  // 단일 타겟: 가장 최근 1건만 파티클 발사 (5초 내)
  const activeTransactions = useMemo(() => {
    const now = Date.now();
    const recent = expenseTransactions
      .filter((t) => t.timestamp && now - t.timestamp < 5000)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (recent.length === 0) return [];
    return [recent[0]];
  }, [expenseTransactions]);

  // 리렌더 간섭 차단: 파티클 전용 상태 — 트랜잭션 replace 시에도 2.5초 동안 유지
  const [particleTx, setParticleTx] = useState<typeof expenseTransactions[0] | null>(null);
  useEffect(() => {
    if (activeTransactions.length === 0) return;
    const tx = activeTransactions[0];
    setParticleTx(tx);
    const t = setTimeout(() => setParticleTx(null), 3200);
    return () => clearTimeout(t);
  }, [activeTransactions]);

  // Set of district names that match search (for dim effect on buildings)
  const matchingDistricts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null; // null = no filter active
    const s = new Set<string>();
    expenseTransactions.forEach((t) => {
      if (t.description?.toLowerCase().includes(query) || t.district?.toLowerCase().includes(query)) {
        if (t.district) s.add(t.district);
      }
    });
    return s;
  }, [expenseTransactions, searchQuery]);

  // 건물 클릭 핸들러
  const handleDistrictClick = (districtName: string) => {
    const newSelection = selectedDistrict === districtName ? null : districtName;
    console.log(`📍 Selected district: ${newSelection || 'None'}`);

    if (onDistrictSelect) {
      onDistrictSelect(newSelection);
    }
  };

  // 선택된 구역의 위치 계산
  const selectedPosition = selectedDistrict
    ? districtPositions[selectedDistrict]
    : null;

  return (
    <div style={{ width: '100%', height: '100vh', background: '#0a0e27' }}>
      <Canvas
        camera={{ position: [0, 32, 28], fov: 48 }}
        shadows
        gl={{
          antialias: false, // EffectComposer가 안티앨리어싱 처리
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2
        }}
      >
        <Suspense fallback={null}>
          {/* 조명 설정 */}
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={1}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />

          {/* 배경 별 */}
          <Stars
            radius={100}
            depth={50}
            count={5000}
            factor={4}
            saturation={0}
            fade
            speed={1}
          />

          {/* 환경 조명 */}
          <Environment preset="night" />

          {/* Camera rig (owns OrbitControls with makeDefault) */}
          <CameraRig
            targetPosition={selectedPosition}
            maxScaleRef={maxScaleRef}
            orbitControlsProps={{
              enablePan: true,
              enableZoom: true,
              enableRotate: true,
              maxPolarAngle: Math.PI / 2.2,
              minDistance: 10,
              maxDistance: 80,
            }}
          />

          {/* 🌟 구역별 거래 목록 전달 → 건물이 파티클 도착(2.5초) 후 스스로 성장 */}
          {districts.map((district) => {
            const pos = districtPositions[district.name];
            const isDimmed = matchingDistricts !== null && !matchingDistricts.has(district.name);
            return (
              <CityDistrict
                key={district.id}
                name={district.name}
                position={[pos.x, pos.y, pos.z]}
                color={getDistrictColor(district.name)}
                icon={district.icon}
                onClick={handleDistrictClick}
                isSelected={selectedDistrict === district.name}
                districtTransactions={districtTransactionMap[district.name] ?? []}
                budgetRatio={budgetRatios?.[district.name]}
                searchDimmed={isDimmed}
                onScaleUpdate={(s) => {
                  if (s > maxScaleRef.current) maxScaleRef.current = s;
                }}
              />
            );
          })}

          {/* 지출 파티클 — particleTx로 독립 유지 (리렌더 시 언마운트 방지) */}
          {particleTx && (() => {
            const q = searchQuery.trim().toLowerCase();
            const isSearchActive = q.length > 0;
            const targetDistrict = normalizeDistrictFor3D(particleTx.district);
            const isHighlighted = !isSearchActive || (
              (particleTx.description?.toLowerCase().includes(q) ?? false) ||
              (particleTx.district?.toLowerCase().includes(q) ?? false)
            );
            return (
              <ParticleSystem
                key={`particle-${particleTx.timestamp}`}
                district={targetDistrict}
                color={getDistrictColor(targetDistrict)}
                amount={particleTx.amount}
                districtPositions={districtPositions}
                isHighlighted={isHighlighted}
                isSearchActive={isSearchActive}
              />
            );
          })()}

          {/* 💰 수입 빔 (outer ring) */}
          <IncomeScene
            incomeTransactions={incomeTransactions}
            isActive={activeTab === 'income'}
          />

          {/* 📈 투자 노드 (floating gems) */}
          <InvestmentScene
            investmentTransactions={investTransactions}
            isActive={activeTab === 'investment'}
          />

          {/* 🚨 Per-building budget rings are rendered inside each CityDistrict */}

          {/* 🎉 Goal celebration fireworks */}
          {onGoalCelebrated && (
            <CelebrationEffect
              achievedGoals={achievedGoals}
              onGoalCelebrated={onGoalCelebrated}
            />
          )}

          {/* 중앙 플랫폼 (거래 시작 지점) */}
          <mesh position={[0, -0.5, 0]} receiveShadow>
            <cylinderGeometry args={[3, 3, 1, 64]} />
            <meshStandardMaterial
              color="#1e293b"
              metalness={0.8}
              roughness={0.2}
              emissive="#3b82f6"
              emissiveIntensity={0.1}
            />
          </mesh>

          {/* 바닥 그리드 */}
          <gridHelper args={[50, 50, '#334155', '#1e293b']} position={[0, -1, 0]} />

          {/* OrbitControls is now managed by CameraRig above */}

          {/* 🌟 포스트 프로세싱: 사이버펑크 네온 효과 */}
          <EffectComposer multisampling={0}>
            <Bloom
              intensity={0.8}
              luminanceThreshold={0.4}
              luminanceSmoothing={0.9}
              height={300}
            />
            <ChromaticAberration
              blendFunction={BlendFunction.NORMAL}
              offset={[0.0015, 0.0015] as [number, number]}
            />
            <Vignette
              offset={0.4}
              darkness={0.5}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
