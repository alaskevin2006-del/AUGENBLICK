// AUGENBLICK Znawca 切片端到端验收脚本
// 覆盖切片接口-v0.md §七：建会话→四事件落库→权威分→中断恢复→幂等（后端已单测，这里走真实浏览器）
// v0.1 增补：开头加登录步骤（契约§八，开发者账号 dev/dev123），后续流程不变；API 均带 Authorization。
// 注意：后端认证就绪前本脚本无法真跑（mock 后端数据与真实课程 ID 不一致），改好放着待联调。
// 运行：node e2e-slice.mjs   （需后端 8000 + 前端 5173 已启动）
import { createRequire } from "module";
import { mkdirSync } from "fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const API = process.env.API_URL ?? "http://localhost:8000";
import { fileURLToPath } from "url";
const SHOTS = fileURLToPath(new URL("./shots/", import.meta.url));
const COURSE_TITLE = "国家示例课（完整功能演示）";
const COURSE_ID = "国家示例课_zh@41339bd5";

mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
};

// 契约§八：先登录拿 token，后续 API 调用统一带 Authorization 头。
const LOGIN = { username: process.env.E2E_USER ?? "dev", password: process.env.E2E_PASS ?? "dev123" };
let token = null;

const api = async (path, init) => {
  const headers = { ...(init?.headers ?? {}) };
  if (token) headers.Authorization = `Token ${token}`;
  const res = await fetch(API + path, { ...init, headers });
  return { status: res.status, body: await res.json().catch(() => null) };
};

// 答一道题：input 填错误答案 / choice 选第一个；返回 "answered" | "finished"
async function answerOne(page) {
  if (await page.getByText("会话完成").first().isVisible().catch(() => false)) return "finished";
  const checkBtn = page.getByRole("button", { name: "检查答案" });
  const nextBtn = page.getByRole("button", { name: "下一题" });
  if (await checkBtn.isVisible().catch(() => false)) {
    const input = page.locator("input:not([type='radio']):not([type='checkbox']):visible").first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill("一个不正确的答案");
    } else {
      await page.locator(".choice-list label").first().click();
    }
    await checkBtn.click();
    await page.waitForTimeout(250);
    if (await nextBtn.isVisible().catch(() => false)) await nextBtn.click();
    await page.waitForTimeout(250);
    return "answered";
  }
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(250);
    return "answered";
  }
  return "stuck";
}

const consoleErrors = [];
const httpErrors = [];
const browser = await chromium.launch({
  executablePath: "C:/Users/Kevin/.agent-browser/browsers/chrome-154.0.8037.92/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
// 预期内的认证流程响应（登录前探测 401、故意的错误凭证 400）不计入干净度检查。
const EXPECTED_HTTP = [
  /\/api\/courses\/ → 401$/,
  /\/api\/auth\/login\/ → 400$/,
];
const isExpected = (entry) => EXPECTED_HTTP.some((re) => re.test(entry));
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const text = m.text();
  if (text.includes("401 (Unauthorized)") || text.includes("400 (Bad Request)")) return;
  consoleErrors.push(text);
});
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("response", (r) => {
  const entry = `${r.url()} → ${r.status()}`;
  if (r.status() >= 400 && !isExpected(entry)) httpErrors.push(entry);
});

try {
  // 0. 登录（契约§八）：API 登录拿 token + 页面走登录表单
  const login = await api("/api/auth/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(LOGIN),
  });
  token = login.body?.token ?? null;
  check("API 登录返回 token", login.status === 200 && !!token, `HTTP ${login.status}`);

  await page.goto(BASE, { waitUntil: "load" });
  await page.getByLabel("用户名").fill(LOGIN.username);
  await page.getByLabel("密码").fill(LOGIN.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByText("选择要掌握的内容").waitFor({ timeout: 10000 });
  check("页面登录进入课程列表", true);
  await page.screenshot({ path: SHOTS + "0-login.png" });

  // 1. 首页：4 个真实课程版本来自后端
  await page.getByText("选择要掌握的内容").waitFor({ timeout: 10000 });
  await page.locator("article").first().waitFor({ timeout: 10000 });
  const cardCount = await page.locator("article").count();
  check("课程列表来自后端", cardCount >= 4, `卡片 ${cardCount} 张`);
  await page.screenshot({ path: SHOTS + "1-courses.png" });

  const zhCard = page.locator("article", { hasText: COURSE_TITLE });

  // 1. 测试模式：完整跑完 → activityFinished + 后端权威分
  await zhCard.getByRole("button", { name: "测试", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOTS + "2-question.png" });
  let steps = 0;
  let state = "answered";
  while (steps < 250 && state === "answered") {
    state = await answerOne(page);
    steps++;
  }
  check("测试模式跑到结果页", state === "finished", `作答 ${steps} 步`);
  await page.screenshot({ path: SHOTS + "3-results.png" });

  const fin = await api(`/api/sessions/?status=finished&courseVersionId=${encodeURIComponent(COURSE_ID)}`);
  const latest = Array.isArray(fin.body) ? fin.body[0] : null;
  const detail = latest ? await api(`/api/sessions/${latest.sessionId ?? latest.id}/`) : null;
  check(
    "后端权威 totalScore 落库",
    !!detail?.body && typeof detail.body.totalScore === "number" && detail.body.status === "finished",
    detail?.body ? `totalScore=${detail.body.totalScore}` : `HTTP ${detail?.status}`,
  );
  if (detail?.body) {
    const n = detail.body.eventCount;
    check("四事件数量完整", n === 2 + 2 * (steps - 1), `eventCount=${n}（期望 ${2 + 2 * (steps - 1)}）`);
  }

  // 2. 学习模式：答 1 题 → 刷新 → 继续 → 恢复
  const backBtn = page.getByRole("button", { name: "返回课程列表" });
  const coursesBtn = page.getByRole("button", { name: "课程", exact: true });
  if (await backBtn.isVisible().catch(() => false)) {
    await backBtn.click();
  } else {
    await coursesBtn.click(); // 引擎结果页 → 平台结果页
    await page.waitForTimeout(600);
    await page.screenshot({ path: SHOTS + "3b-platform-results.png" });
    await page.getByRole("button", { name: "返回课程列表" }).click();
  }
  await page.getByText("选择要掌握的内容").waitFor();
  await zhCard.getByRole("button", { name: "学习", exact: true }).click();
  await page.waitForTimeout(1500);
  const r1 = await answerOne(page);
  check("学习模式可作答", r1 === "answered", r1);

  await page.reload({ waitUntil: "load" });
  await page.getByText("选择要掌握的内容").waitFor();
  const resumeBtn = zhCard.getByRole("button", { name: "继续学习" });
  const resumeVisible = await resumeBtn.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  check("刷新后出现「继续学习」", resumeVisible);
  await page.screenshot({ path: SHOTS + "4-resume-entry.png" });

  await resumeBtn.click();
  await page.waitForTimeout(1500);
  const back =
    (await page.getByRole("button", { name: "检查答案" }).isVisible().catch(() => false)) ||
    (await page.getByRole("button", { name: "下一题" }).isVisible().catch(() => false));
  check("恢复后继续答题", back);
  await page.screenshot({ path: SHOTS + "5-resumed.png" });

  const act = await api(`/api/sessions/?status=active&courseVersionId=${encodeURIComponent(COURSE_ID)}`);
  const active = Array.isArray(act.body) ? act.body[0] : null;
  check("resumeToken 已存后端", !!active && active.resumeToken != null, active ? "已保存" : `HTTP ${act.status}`);

  // 3. 退出确认 → 返回课程列表
  await page.getByRole("button", { name: "退出", exact: true }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "退出", exact: true }).click();
  await page.getByText("选择要掌握的内容").waitFor();
  check("退出确认返回课程列表", true);

  // 4. 媒体可达性（payload 第一个图片/音频 URL）
  const pl = await api(`/api/courses/${encodeURIComponent(COURSE_ID)}/payload/`);
  const mediaUrl =
    pl.body?.items?.flatMap((i) => [...(i.media ?? []), ...Object.values(i.cellMedia ?? {}).flat()])[0]?.url ??
    pl.body?.speech?.[0]?.url;
  if (mediaUrl) {
    const m = await fetch(API + mediaUrl);
    check("媒体文件可访问", m.status === 200, `${mediaUrl} → ${m.status}`);
  } else check("媒体文件可访问", false, "payload 无媒体 URL");

  check("浏览器 console 无错误", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  check("无 4xx/5xx 资源请求", httpErrors.length === 0, httpErrors.slice(0, 5).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} 通过 ===`);
process.exit(failed.length ? 1 : 0);
