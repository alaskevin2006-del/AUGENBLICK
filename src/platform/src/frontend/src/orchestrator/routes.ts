import type { AuthUser } from "./types";
export type PageRoute = "developer" | "courses" | "my-courses";
export type CourseTab = "learn" | "test" | "learning-history" | "test-history" | "difficulties";
export const courseTabs: readonly CourseTab[] = ["learn","test","learning-history","test-history","difficulties"];
export function roleRoute(user: Pick<AuthUser,"isDeveloper">, hash:string):PageRoute {return user.isDeveloper ? "developer" : hash === "#/my-courses" ? "my-courses" : "courses";}
export function courseRoute(hash:string):string|null {if(!hash.startsWith("#/course/"))return null;try{return decodeURIComponent(hash.slice(9).split("/")[0].split("?")[0])||null;}catch{return null;}}
export function courseTab(hash:string):CourseTab {const value=hash.split("?")[0].split("/")[3];return courseTabs.includes(value as CourseTab)?value as CourseTab:"learn";}
export function courseHash(id:string,tab:CourseTab="learn"){return `#/course/${encodeURIComponent(id)}/${tab}`;}
export function recordsCourse(hash:string):string|undefined {return new URLSearchParams(hash.split("?")[1]??"").get("course")||undefined;}
export function legacyCourseHash(hash:string):string|null {const page=hash.split("?")[0];const id=recordsCourse(hash);return id&&(page==="#/history"||page==="#/difficulties")?courseHash(id,page==="#/history"?"learning-history":"difficulties"):null;}
