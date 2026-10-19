import type { AuthUser } from "./types";
export type PageRoute = "developer" | "courses" | "my-courses";
export function roleRoute(
  user: Pick<AuthUser, "isDeveloper">,
  hash: string,
): PageRoute {
  if (user.isDeveloper) return "developer";
  return hash === "#/my-courses" ? "my-courses" : "courses";
}

export function courseRoute(hash: string): string | null {
 if (!hash.startsWith("#/course/")) return null;
 try { return decodeURIComponent(hash.slice(9)) || null; } catch { return null; }
}
