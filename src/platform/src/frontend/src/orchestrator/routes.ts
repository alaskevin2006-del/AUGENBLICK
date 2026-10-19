import type { AuthUser } from "./types";
export type PageRoute = "developer" | "courses" | "my-courses" | "history" | "difficulties";
export function roleRoute(
  user: Pick<AuthUser, "isDeveloper">,
  hash: string,
): PageRoute {
  const page = hash.split("?")[0];
  if(page === "#/history") return "history";
  if(page === "#/difficulties") return "difficulties";
  if (user.isDeveloper) return "developer";
  return hash === "#/my-courses" ? "my-courses" : "courses";
}

export function courseRoute(hash: string): string | null {
 if (!hash.startsWith("#/course/")) return null;
 try { return decodeURIComponent(hash.slice(9)) || null; } catch { return null; }
}

export function recordsCourse(hash:string):string|undefined {return new URLSearchParams(hash.split("?")[1] ?? "").get("course") || undefined;}
