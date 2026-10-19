import type { AuthUser } from "./types";

// 契约§八：token 与用户信息存 localStorage；任何 401 → clearAuth + 跳登录页（handler 见 api.ts）。

const TOKEN_KEY = "augenblick.auth.token";
const USER_KEY = "augenblick.auth.user";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (typeof parsed.username !== "string") return null;
    return { username: parsed.username, isDeveloper: Boolean(parsed.isDeveloper) };
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // 忽略
  }
}
