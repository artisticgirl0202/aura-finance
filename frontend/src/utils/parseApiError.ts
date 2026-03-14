/**
 * parseApiError — Universal API Error Parser
 * ─────────────────────────────────────────────────────────────────
 * FastAPI/Pydantic 422, 400/401/403, Network/500, and unknown errors
 * into human-readable strings for UX.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface AxiosErrorLike {
  response?: {
    status?: number;
    data?: unknown;
  };
  request?: unknown;
  message?: string;
  code?: string;
}

/**
 * Extract a user-friendly error message from API error responses.
 *
 * A. Pydantic 422: First error object's `msg` field
 * B. 400/401/403: detail as string
 * C. Network/500: "Network error. Please check your connection or try again later."
 * D. Unknown: "An unexpected error occurred. Please try again."
 */
export function parseApiError(error: unknown): string {
  const err = error as AxiosErrorLike;

  // C. No response (network error, timeout, CORS, etc.)
  if (!err?.response && (err?.request || err?.message === 'Network Error')) {
    return 'Network error. Please check your connection or try again later.';
  }

  // C. 500 or other server errors — generic message
  if (err?.response?.status && err.response.status >= 500) {
    return 'Network error. Please check your connection or try again later.';
  }

  const data = err?.response?.data;
  const detail = (data as { detail?: unknown })?.detail;

  // A. Pydantic 422 — detail is array of { type, msg, loc, ... }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string; type?: string };
    const rawMsg = (typeof first?.msg === 'string' ? first.msg : '') || (typeof first?.type === 'string' ? first.type : '');
    if (rawMsg && (/72\s*(byte|character|char)/i.test(rawMsg) || /password.*72|72.*password/i.test(rawMsg))) {
      return '비밀번호 검증에 실패했습니다. (최대 72자)';
    }
    if (rawMsg) return rawMsg;
  }

  // B. 400/401/403 — detail is string
  if (typeof detail === 'string') {
    if (/72\s*(byte|character|char)/i.test(detail) || /password.*72|72.*password/i.test(detail)) {
      return '비밀번호 검증에 실패했습니다. (최대 72자)';
    }
    return detail;
  }

  // B. detail might be { message: "..." }
  if (detail && typeof detail === 'object' && 'message' in detail && typeof (detail as { message: unknown }).message === 'string') {
    return (detail as { message: string }).message;
  }

  // D. Unknown
  return 'An unexpected error occurred. Please try again.';
}
