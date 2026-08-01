import type { ApiErrorBody } from '@atlas/shared';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: { path: string; message: string }[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error;
    this.issues = body.issues ?? [];
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (typeof body?.message === 'string') return new ApiError(response.status, body);
  } catch {
    // Fall through to a generic message below.
  }
  return new ApiError(response.status, {
    error: 'unexpected_response',
    message: `Request failed with status ${response.status}.`,
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Only advertise a JSON body when we actually send one: Fastify rejects an
  // empty body when the content-type is `application/json` (e.g. bare DELETEs).
  const headers = new Headers(init.headers);
  if (init.body != null) headers.set('content-type', 'application/json');

  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers,
  });

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
