interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, { code, status }: { code?: string; status?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function parseErrorPayload(response: Response) {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return {
      message: payload?.error?.message || `Request failed with ${response.status}`,
      code: payload?.error?.code,
    };
  } catch {
    return {
      message: `Request failed with ${response.status}`,
      code: undefined,
    };
  }
}

export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    throw new ApiError(payload.message, { code: payload.code, status: response.status });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiGet<T>(url: string) {
  return apiRequest<T>(url);
}

export function apiPost<T>(url: string, body?: unknown) {
  return apiRequest<T>(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(url: string, body?: unknown) {
  return apiRequest<T>(url, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(url: string, body?: unknown) {
  return apiRequest<T>(url, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(url: string) {
  return apiRequest<T>(url, {
    method: "DELETE",
  });
}
