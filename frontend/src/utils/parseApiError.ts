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
    if (typeof first?.msg === 'string') {
      return first.msg;
    }
    if (typeof first?.type === 'string') {
      return first.type;
    }
  }

  // B. 400/401/403 — detail is string
  if (typeof detail === 'string') {
    return detail;
  }

  // B. detail might be { message: "..." }
  if (detail && typeof detail === 'object' && 'message' in detail && typeof (detail as { message: unknown }).message === 'string') {
    return (detail as { message: string }).message;
  }

  // D. Unknown
  return 'An unexpected error occurred. Please try again.';
}
