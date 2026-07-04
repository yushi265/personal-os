/**
 * APIクライアント(design-browser-ui.md §5.2・§6.1)。
 * fetchラッパでBearerトークンを一元付与する。API_BASEは同一オリジン(サーバーがwebapp-distを配信するため空文字でよい)。
 */

const API_BASE = "";
const TOKEN_STORAGE_KEY = "pos.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }

  static async from(res: Response): Promise<ApiError> {
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      return new ApiError(res.status, body.error ?? res.statusText, body.code);
    } catch {
      return new ApiError(res.status, res.statusText);
    }
  }
}

/** 401時にトークンを破棄し、案内画面へ遷移させるためのハンドラ(main.tsxで登録) */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    clearToken();
    onUnauthorized?.();
    throw new ApiError(401, "Unauthorized");
  }

  if (!res.ok) throw await ApiError.from(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: "DELETE", body: body !== undefined ? JSON.stringify(body) : undefined }),
};
