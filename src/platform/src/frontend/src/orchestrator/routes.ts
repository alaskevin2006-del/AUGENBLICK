import type { AuthUser } from "./types";
export type PageRoute = "developer" | "courses" | "my-courses";
export function roleRoute(
  user: Pick<AuthUser, "isDeveloper">,
  hash: string,
): PageRoute {
  if (user.isDeveloper) return "developer";
  return hash === "#/my-courses" ? "my-courses" : "courses";
}
