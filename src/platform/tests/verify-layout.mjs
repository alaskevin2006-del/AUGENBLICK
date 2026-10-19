// 布局固定化验收：1280×800 视口下整页不滚动，内容区内滚
import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const SHOTS = fileURLToPath(new URL("./shots/", import.meta.url));

const browser = await chromium.launch({
  executablePath: "C:/Users/Kevin/.agent-browser/browsers/chrome-154.0.8037.92/chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const results = [];
const check = (n, ok, d = "") => { results.push(ok); console.log(`${ok ? "✓" : "✗"} ${n}${d ? " — " + d : ""}`); };

const noBodyScroll = async () =>
  page.evaluate(() => ({
    body: document.body.scrollHeight <= window.innerHeight + 1,
    doc: document.documentElement.scrollHeight <= window.innerHeight + 1,
  }));

await page.goto("http://localhost:5173", { waitUntil: "load" });
await page.locator("article").first().waitFor();
let s = await noBodyScroll();
check("课程列表：整页不滚动", s.body && s.doc);
await page.screenshot({ path: SHOTS + "L1-courses-fixed.png" });

// 答题页（媒体网格题，找一节测试进）
await page.locator("article", { hasText: "国家示例课（完整功能演示）" }).getByRole("button", { name: "测试", exact: true }).click();
await page.waitForTimeout(2000);
s = await noBodyScroll();
check("答题页：整页不滚动", s.body && s.doc);
const host = await page.evaluate(() => {
  const el = document.querySelector(".host-content");
  return el ? { clientH: el.clientHeight, scrollH: el.scrollHeight } : null;
});
check("答题页：host 内容区存在", !!host, host ? `client=${host.clientH} scroll=${host.scrollH}` : "");
await page.screenshot({ path: SHOTS + "L2-question-fixed.png" });

// 退出回列表（不清会话，保留 active 供人工看恢复）
await page.getByRole("button", { name: "退出" }).first().click();
await page.getByRole("dialog").getByRole("button", { name: "退出" }).click();
await page.locator("article").first().waitFor();
s = await noBodyScroll();
check("返回后：整页仍不滚动", s.body && s.doc);

await browser.close();
console.log(results.every(Boolean) ? "=== 布局验收通过 ===" : "=== 有失败项 ===");
process.exit(results.every(Boolean) ? 0 : 1);
