import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

const DEBUG_VISIBILITY = false;
const FALLBACK_PARTICLE_COLOR = '#00ffff'; // 파티클 기본(색상 없을 때)

/** 둥근 부드러운 원형 파티클 텍스처 (방사형 그라데이션) — 블록 제거 */
function createSoftCircleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const r = cx - 1;
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  gradient.addColorStop(0.65, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

interface Particle {
  id: string;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
  targetPosition: THREE.Vector3;
  initialPosition: THREE.Vector3;
}

interface ParticleSystemProps {
  district: string;
  color: string;
  amount: number;
  districtPositions: Record<string, THREE.Vector3>;
  isHighlighted?: boolean;   // true = full glow; false = dimmed (search mode)
  isSearchActive?: boolean;  // search is currently active
}

/**
 * 🚀 상용화급 3D 파티클 시스템 - AI 분류 결과를 실시간 시각화
 */
export function ParticleSystem({
  district,
  color,
  amount,
  districtPositions,
  isHighlighted = true,
  isSearchActive = false,
}: ParticleSystemProps) {
  const particlesRef = useRef<THREE.Points>(null);
  const particlesDataRef = useRef<Particle[]>([]);

  // 파티클 개수 (거래 금액에 비례, 상용화 성능 최적화)
  const particleCount = useMemo(() => {
    const count = Math.floor(amount / 10);
    return Math.min(Math.max(count, 15), 80);
  }, [amount]);

  // 시작 위치 (도시 중심, 약간 위로)
  const startPosition = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  // 목표 위치 (분류된 구역) — fallback: 구역 맵에 없으면 원 위 임의 좌표
  const targetPosition = useMemo(() => {
    let pos = districtPositions[district];
    if (!pos || isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
      const keys = Object.keys(districtPositions);
      pos = keys.length > 0 ? (districtPositions[keys[0]] as THREE.Vector3).clone() : new THREE.Vector3(6, 2, 6);
      console.warn('ParticleSystem: Target fallback', { district, districtKeys: keys, using: pos });
    }
    return pos;
  }, [district, districtPositions]);

  // 파티클 색상 — 타겟 건물 색상에 맞춤 (props.color)
  const particleColor = useMemo(
    () => new THREE.Color(color && /^#[\da-fA-F]{6}$/.test(color) ? color : FALLBACK_PARTICLE_COLOR),
    [color]
  );

  useEffect(() => {
    const pos = districtPositions[district] ?? new THREE.Vector3(0, 5, 0);
    console.log('Particle Target Info:', {
      targetDistrict: district,
      targetPosition: { x: pos.x, y: pos.y, z: pos.z },
      hasTarget: !!districtPositions[district],
      districtKeys: Object.keys(districtPositions),
    });
  }, [district, districtPositions]);

  // 지오메트리 및 머티리얼 초기화
  const { geometry, material } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    // 파티클 데이터 초기화
    particlesDataRef.current = [];

    for (let i = 0; i < particleCount; i++) {
      // 폭발 효과를 위한 구형 분산
      const spread = 0.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = Math.random() * spread;

      const offsetX = r * Math.sin(phi) * Math.cos(theta);
      const offsetY = Math.random() * 0.5;
      const offsetZ = r * Math.sin(phi) * Math.sin(theta);

      const initialPos = new THREE.Vector3(
        startPosition.x + offsetX,
        startPosition.y + offsetY,
        startPosition.z + offsetZ
      );

      const particle: Particle = {
        id: `${Date.now()}_${i}`,
        position: initialPos.clone(),
        initialPosition: initialPos.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.03,
          Math.random() * 0.05 + 0.02,
          (Math.random() - 0.5) * 0.03
        ),
        color: particleColor.clone(),
        size: (Math.random() * 0.4 + 0.3) * (DEBUG_VISIBILITY ? 5 : 1),
        life: 0,
        // 🌟 [수정됨] CityDistrict의 Flash 타이밍(2.5초)과 완벽 동기화!
        maxLife: 2.5,
        targetPosition: targetPosition.clone()
      };

      particlesDataRef.current.push(particle);

      // 초기 위치
      positions[i * 3] = particle.position.x;
      positions[i * 3 + 1] = particle.position.y;
      positions[i * 3 + 2] = particle.position.z;

      // 색상
      colors[i * 3] = particle.color.r;
      colors[i * 3 + 1] = particle.color.g;
      colors[i * 3 + 2] = particle.color.b;

      // 크기
      sizes[i] = particle.size;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const circleTexture = createSoftCircleTexture();
    const mat = new THREE.PointsMaterial({
      size: DEBUG_VISIBILITY ? 1.5 : 0.4,
      map: circleTexture,
      vertexColors: true,
      transparent: true,
      opacity: DEBUG_VISIBILITY ? 1 : 0.9,
      alphaTest: 0.01,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    return { geometry: geo, material: mat };
  }, [particleCount, startPosition, targetPosition, particleColor]);

  // 애니메이션 루프
  useFrame((state, delta) => {
    if (!particlesRef.current) return;

    // Search highlight: smoothly lerp material opacity
    const mat = particlesRef.current.material as THREE.PointsMaterial;
    const targetOpacity = isSearchActive
      ? (isHighlighted ? 1.0 : 0.10)
      : 0.8;
    mat.opacity += (targetOpacity - mat.opacity) * 0.12;
    // Scale size for highlighted particles so they pop
    mat.size = DEBUG_VISIBILITY ? 1.5 : isSearchActive && isHighlighted ? 0.45 : 0.3;

    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
    const colors = particlesRef.current.geometry.attributes.color.array as Float32Array;
    const sizes = particlesRef.current.geometry.attributes.size.array as Float32Array;

    particlesDataRef.current.forEach((particle, i) => {
      // 수명 증가
      particle.life += delta;
      const progress = Math.min(particle.life / particle.maxLife, 1);

      if (progress < 1) {
        // 3단계 궤적: 발사 → 상승 → 도착
        const t = easeInOutCubic(progress);

        if (progress < 0.3) {
          // 1단계: 폭발 발사 (0-30%)
          const launchProgress = progress / 0.3;
          particle.position.lerpVectors(
            particle.initialPosition,
            particle.initialPosition.clone().add(new THREE.Vector3(0, 3, 0)),
            launchProgress
          );
        } else {
          // 2-3단계: 베지어 곡선으로 목표 지점까지
          const flightProgress = (progress - 0.3) / 0.7;

          // 중간 제어점 (높은 포물선)
          const midPoint = new THREE.Vector3(
            (particle.initialPosition.x + particle.targetPosition.x) / 2,
            Math.max(particle.initialPosition.y, particle.targetPosition.y) + 5,
            (particle.initialPosition.z + particle.targetPosition.z) / 2
          );

          // 3차 베지어 곡선 (부드러운 궤적)
          if (flightProgress < 0.5) {
            particle.position.lerpVectors(
              particle.initialPosition,
              midPoint,
              flightProgress * 2
            );
          } else {
            particle.position.lerpVectors(
              midPoint,
              particle.targetPosition,
              (flightProgress - 0.5) * 2
            );
          }
        }

        // 바람 효과 (자연스러운 움직임)
        particle.position.x += Math.sin(state.clock.elapsedTime * 3 + i) * 0.015;
        particle.position.z += Math.cos(state.clock.elapsedTime * 2.5 + i) * 0.015;

        // 색상 페이드 (끝부분에서만 서서히 사라짐)
        const fadeStart = 0.8;
        if (progress > fadeStart) {
          const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
          const originalColor = particleColor.clone();
          particle.color.lerpColors(originalColor, new THREE.Color(0x000000), fadeProgress);
        }

        // 크기 변화 (펄스 효과 + 점진적 축소)
        const pulseEffect = Math.sin(progress * Math.PI * 6) * 0.15;
        const sizeProgress = 1 - Math.pow(progress, 1.5);
        particle.size = ((0.3 + sizeProgress * 0.5) * (1 + pulseEffect)) * (DEBUG_VISIBILITY ? 5 : 1);

      } else {
        // 수명 종료 - 화면 밖으로 이동
        particle.position.set(0, -1000, 0);
        particle.size = 0;
      }

      // 버퍼 업데이트
      positions[i * 3] = particle.position.x;
      positions[i * 3 + 1] = particle.position.y;
      positions[i * 3 + 2] = particle.position.z;

      colors[i * 3] = particle.color.r;
      colors[i * 3 + 1] = particle.color.g;
      colors[i * 3 + 2] = particle.color.b;

      sizes[i] = particle.size;
    });

    particlesRef.current.geometry.attributes.position.needsUpdate = true;
    particlesRef.current.geometry.attributes.color.needsUpdate = true;
    particlesRef.current.geometry.attributes.size.needsUpdate = true;
  });

  return <points ref={particlesRef} geometry={geometry} material={material} />;
}

// Easing 함수들
function easeInOutCubic(t: number): number {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInQuad(t: number): number {
  return t * t;
}
