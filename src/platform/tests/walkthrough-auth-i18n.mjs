// 临时自测脚本（mock 模式）：登录 → 课程列表 → 语言切换(zh/en/ar) → 顶栏 → 开发者页上传 → 引擎 i18n → 退出登录
// 后端认证未就绪时自动降级 mock（/api/auth/login/ 404 探测）。
import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");

const BASE = "http://localhost:5173";
const SHOTS = fileURLToPath(new URL("./shots/", import.meta.url));
mkdirSync(SHOTS, { recursive: true });
// mock 只校验 .zip 扩展名：造一个假 zip。
const FAKE_ZIP = fileURLToPath(new URL("./shots/fake-course.zip", import.meta.url));
writeFileSync(FAKE_ZIP, "PKfake");

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({
  executablePath: "C:/Users/Kevin/.agent-browser/browsers/chrome-154.0.8037.92/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  // 1. 未登录 → 登录页
  await page.goto(BASE, { waitUntil: "load" });
  await page.getByRole("button", { name: "登录", exact: true }).waitFor({ timeout: 10000 });
  check("未登录显示登录页", true);

  // 2. 错误凭证 → 错误提示
  await page.getByLabel("用户名").fill("dev");
  await page.getByLabel("密码").fill("wrong");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByText("用户名或密码错误").waitFor({ timeout: 5000 });
  check("凭证错误提示", true);
  await page.screenshot({ path: SHOTS + "w1-login-error.png" });

  // 3. dev/dev123 登录 → 课程列表 + 顶栏用户名
  await page.getByLabel("密码").fill("dev123");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByText("选择要掌握的内容").waitFor({ timeout: 10000 });
  const hasUser = await page.locator(".topbar-user").textContent();
  check("登录进课程列表+顶栏用户名", hasUser === "dev", `topbar=${hasUser}`);
  const devBtnVisible = await page.getByRole("button", { name: "开发者" }).isVisible();
  check("开发者入口对 dev 可见", devBtnVisible);
  await page.screenshot({ path: SHOTS + "w2-courses-zh.png" });

  // 4. 切英文
  await page.locator(".topbar-select").selectOption("en");
  await page.getByText("Choose what to master").waitFor();
  const dirEn = await page.evaluate(() => document.documentElement.dir);
  check("切英文生效且 dir=ltr", dirEn === "ltr" || dirEn === "");
  await page.screenshot({ path: SHOTS + "w3-courses-en.png" });

  // 5. 切阿拉伯语 → dir=rtl
  await page.locator(".topbar-select").selectOption("ar");
  await page.waitForTimeout(400);
  const dirAr = await page.evaluate(() => document.documentElement.dir);
  check("切阿拉伯语 dir=rtl", dirAr === "rtl", `dir=${dirAr}`);
  await page.screenshot({ path: SHOTS + "w4-courses-ar-rtl.png" });

  // 6. 切回中文 → 进学习模式 → 引擎中文
  await page.locator(".topbar-select").selectOption("zh-CN");
  await page.getByText("选择要掌握的内容").waitFor();
  await page.getByRole("button", { name: "学习", exact: true }).first().click();
  await page.getByRole("button", { name: "检查答案" }).waitFor({ timeout: 10000 });
  check("引擎 UI 中文（检查答案）", true);
  await page.screenshot({ path: SHOTS + "w5-engine-zh.png" });

  // 7. 活动中切英文 → 引擎 UI 跟随（检查答案 → Check answer）
  await page.locator(".topbar-select").selectOption("en");
  await page.getByRole("button", { name: "Check answer" }).waitFor({ timeout: 5000 });
  check("活动中切语言引擎跟随", true);
  await page.screenshot({ path: SHOTS + "w6-engine-en.png" });

  // 8. 退出活动（确认弹窗英文）→ 回课程列表
  await page.locator(".topbar-select").selectOption("zh-CN");
  await page.getByRole("button", { name: "退出", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "退出" }).click();
  await page.getByText("选择要掌握的内容").waitFor();
  check("退出确认返回课程列表", true);

  // 9. 开发者页：列表 + 上传
  await page.getByRole("button", { name: "开发者" }).click();
  await page.getByText("上传课程 ZIP").waitFor();
  const rowCount = await page.locator(".dev-table tbody tr").count();
  check("开发者页课程版本表", rowCount >= 1, `行数=${rowCount}`);
  await page.locator("input[type=file]").setInputFiles(FAKE_ZIP);
  await page.getByRole("button", { name: "上传", exact: true }).click();
  await page.getByText("导入结果").waitFor({ timeout: 5000 });
  const warnings = await page.locator(".warning-list li").count();
  check("上传结果显示 imported+warnings", warnings >= 1, `warnings=${warnings}`);
  await page.screenshot({ path: SHOTS + "w7-developer.png" });

  // 10. 退出登录 → 登录页
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("button", { name: "登录", exact: true }).waitFor({ timeout: 5000 });
  check("退出登录回登录页", true);

  // 11. 学习者账号：无开发者入口
  await page.getByLabel("用户名").fill("user");
  await page.getByLabel("密码").fill("user123");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByText("选择要掌握的内容").waitFor({ timeout: 10000 });
  const devBtnForUser = await page.getByRole("button", { name: "开发者" }).isVisible().catch(() => false);
  check("学习者无开发者入口", !devBtnForUser);

  check("浏览器无 pageerror", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} 通过 ===`);
process.exit(failed.length ? 1 : 0);
