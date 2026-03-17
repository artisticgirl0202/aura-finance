/**
 * 트랜잭션 카테고리 → 3D District 이름 정규화 매핑
 * AI/DB에서 반환되는 district 문자열을 3D 맵의 건물 이름과 1:1 매칭
 */

/** 3D 맵에 있는 모든 District 이름 (Unknown 제외) */
export const DISTRICTS_3D = [
  'Food & Cafe',
  'Shopping',
  'Housing & Utility',
  'Entertainment',
  'Transport',
  'Healthcare',
  'Education',
  'Finance',
  'Freelance',
  'Rental Income',
  'Salary',
  'Side Income',
] as const;

/** AI/DB district 문자열 → 3D District 정규화 (누락 시 Unknown → Finance로 폴백) */
const DISTRICT_NORMALIZE: Record<string, string> = {
  // 정확 매칭
  'Food & Cafe': 'Food & Cafe',
  'Shopping': 'Shopping',
  'Housing & Utility': 'Housing & Utility',
  'Entertainment': 'Entertainment',
  'Transport': 'Transport',
  'Healthcare': 'Healthcare',
  'Education': 'Education',
  'Finance': 'Finance',
  'Freelance': 'Freelance',
  'Rental Income': 'Rental Income',
  'Salary': 'Salary',
  'Side Income': 'Side Income',
  'Unknown': 'Finance', // Unknown → 3D에 없으므로 Finance로 폴백
  // 백엔드 CityDistrict enum name (혹시 API가 name 반환 시 대비)
  'FOOD_CAFE': 'Food & Cafe',
  'SHOPPING': 'Shopping',
  'HOUSING': 'Housing & Utility',
  'ENTERTAINMENT': 'Entertainment',
  'TRANSPORT': 'Transport',
  'HEALTHCARE': 'Healthcare',
  'EDUCATION': 'Education',
  'FREELANCE': 'Freelance',
  'RENTAL_INCOME': 'Rental Income',
  'SALARY': 'Salary',
  'SIDE_INCOME': 'Side Income',
  'UNKNOWN': 'Finance',
  // 유사 매칭 (오타/변형)
  'Housing': 'Housing & Utility',
  'Housing and Utility': 'Housing & Utility',
  'Food': 'Food & Cafe',
  'Food and Cafe': 'Food & Cafe',
  'Stocks': 'Stocks',
  'Crypto': 'Crypto',
  'ETF/Fund': 'ETF/Fund',
  'Real Estate': 'Real Estate',
  'Investment': 'Finance',
  'Insurance': 'Finance',
  'Bank': 'Finance',
  'Rent': 'Housing & Utility',
  'Utilities': 'Housing & Utility',
  'Bonus': 'Bonus',
  'Dividend': 'Side Income',
  'Refund': 'Side Income',
};

/**
 * 트랜잭션 district 문자열을 3D 맵의 타겟 district로 정규화
 * districtPositions 키와 매칭되어 파티클이 올바른 건물로 날아감
 *
 * Idempotent: 이미 유효한 3D district 문자열이면 입력값 그대로 반환 (Unknown으로 매핑하지 않음)
 */
export function normalizeDistrictFor3D(district: string | undefined | null): string {
  if (!district || !district.trim()) return 'Finance';
  const key = district.trim();

  // 이미 유효한 3D district면 그대로 반환 (Idempotent — 렌더링 가능한 값은 건드리지 않음)
  const exactMatch = DISTRICTS_3D.find((d) => d === key);
  if (exactMatch) return exactMatch;

  const direct = DISTRICT_NORMALIZE[key] ?? DISTRICT_NORMALIZE[key.toLowerCase()];
  if (direct) return direct;
  const found = DISTRICTS_3D.find((d) => d.toLowerCase() === key.toLowerCase());
  return found ?? 'Finance';
}
