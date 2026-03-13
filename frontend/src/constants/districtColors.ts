/**
 * 전체 앱의 유일한 District 색상 기준
 * 3D 건물, 파티클, UI 차트가 모두 이 Map을 사용
 *
 * 백엔드 DISTRICT_COLOR_MAP 및 districtMap.ts DISTRICTS_3D와 정확히 정렬됨.
 */

import { normalizeDistrictFor3D } from '../utils/districtMap';

/**
 * 고대비(High-contrast) 네온 컬러 팔레트 — 사이버펑크 테마
 * 3D 건물, 파티클, UI 차트가 모두 이 Map 사용. 시각적 구분 명확.
 */
export const DISTRICT_COLOR_MAP: Record<string, string> = {
  // Expense
  'Housing & Utility': '#39ff14',   // 네온 그린
  'Transport': '#00ffff',           // 시안 / 일렉트릭 블루
  'Food & Cafe': '#ff9f1c',        // 네온 오렌지
  'Entertainment': '#ff00ff',      // 핫 핑크 / 마젠타
  'Finance': '#ffd700',             // 네온 골드 / 옐로우
  'Healthcare': '#b026ff',          // 네온 퍼플
  'Shopping': '#ff3366',            // 코랄 레드
  'Education': '#00d4ff',          // 일렉트릭 블루 (Transport와 구분)
  // Income
  'Freelance': '#2dd4bf',          // 틸
  'Rental Income': '#c084fc',      // 라벤더
  'Salary': '#22c55e',             // 에메랄드 그린
  'Side Income': '#38bdf8',         // 스카이 블루
  'Bonus': '#facc15',               // 앰버 옐로우
  // Investment
  'Stocks': '#3b82f6',             // 블루
  'Crypto': '#a855f7',              // 바이올렛
  'ETF/Fund': '#14b8a6',           // 틸
  'Real Estate': '#fb923c',        // 오렌지
  // Fallback
  'Unknown': '#94a3b8',            // 슬레이트
};

const FALLBACK_COLOR = '#00ffff';

/**
 * Category/District 이름을 받아 표준 Hex 색상 반환.
 * 대소문자, 띄어쓰기, 앰퍼샌드(&) 차이를 무시하고 정확히 매칭.
 *
 * @param name - "Housing & Utility", "HOUSING", "housing and utility" 등
 * @returns Hex 색상 (예: #4ade80), 매칭 실패 시 #00ffff
 */
export function getDistrictColor(name: string | undefined | null): string {
  if (!name || !String(name).trim()) return FALLBACK_COLOR;
  const canonical = normalizeDistrictFor3D(name);
  return DISTRICT_COLOR_MAP[canonical] ?? FALLBACK_COLOR;
}
