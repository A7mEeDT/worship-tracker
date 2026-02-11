interface ApiErrorPayload {
  error?: {
    message?: string;
  };
}

async function parseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload?.error?.message || `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
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
    throw new Error(await parseErrorMessage(response));
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
