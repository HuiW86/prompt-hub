// Screenshot + interaction probe for the prompt-hub web layer (harness only).
// Usage: node shoot.mjs <baseUrl> <outDir> <label>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { webkit, chromium } from "playwright";

const [base, out, label] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const report = { label, engine: process.env.ENGINE || "webkit", checks: {} };
const engine = report.engine === "chromium" ? chromium : webkit;
const browser = await engine.launch();
const log = (k, v) => {
  report.checks[k] = v;
  console.log(k, JSON.stringify(v));
};

async function open(size, { clear = true, persisted } = {}) {
  const ctx = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  if (persisted)
    await ctx.addInitScript((v) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem("prompt-hub-settings", v);
        sessionStorage.setItem("seeded", "1");
      }
    }, persisted);
  await page.goto(base + "/harness/index.html");
  await page.waitForSelector('[aria-label="全景"] [data-tier]', { timeout: 15000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}

const shot = (page, name) =>
  page.screenshot({ path: join(out, `${label}-${name}.png`) });

async function metrics(page) {
  return page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      return { fontSize: cs.fontSize, lineHeight: cs.lineHeight, color: cs.color };
    };
    const truncated = [...document.querySelectorAll('[aria-label="全景"] [data-tier] span')]
      .filter((s) => s.scrollWidth > s.clientWidth + 1).length;
    return {
      rootClass: document.documentElement.className,
      rootFontScale: getComputedStyle(document.documentElement).getPropertyValue("--font-scale").trim(),
      activeName: pick('[data-tier="active"] span'),
      pinnedName: pick('[data-tier="pinned"] span:nth-child(2)'),
      dormantRow: pick('[data-tier="dormant"]'),
      columnTitle: pick('[data-column] header span:nth-child(2)'),
      columnCount: pick('[data-column] header span:last-child'),
      footer: pick('footer[aria-live]'),
      truncatedSpans: truncated,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
}

async function previewState(page) {
  return page.evaluate(() => {
    const el = document.querySelector("[data-hover-preview]");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const body = el.querySelector("[data-hover-preview-body]");
    return {
      visible: getComputedStyle(el).visibility !== "hidden" && r.width > 0,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      inViewport: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      fontSize: body ? getComputedStyle(body).fontSize : null,
      scrollable: body ? body.scrollHeight > body.clientHeight : null,
      textLen: body ? body.textContent.length : 0,
    };
  });
}

async function hoverDelay(page, sel) {
  const box = await page.locator(sel).first().boundingBox();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(600);
  const t0 = Date.now();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const ok = await page
    .waitForFunction(() => {
      const el = document.querySelector("[data-hover-preview]");
      return el && getComputedStyle(el).visibility !== "hidden";
    }, null, { timeout: 3000, polling: 10 })
    .then(() => true)
    .catch(() => false);
  return ok ? Date.now() - t0 : null;
}

// ── 1. default panorama, wide ────────────────────────────────────────────────
{
  const { ctx, page } = await open({ width: 1440, height: 900 });
  await shot(page, "01-panorama-1440");
  log("metrics-default-1440", await metrics(page));
  log("title-attr-on-rows", await page.evaluate(() =>
    [...document.querySelectorAll('[aria-label="全景"] [data-tier]')].filter((b) => b.title).length));

  const hasPreview = await page.evaluate(() => true);
  const row = '[aria-label="全景"] [data-tier="pinned"]';
  const d = await hoverDelay(page, row);
  log("hover-delay-ms-first", d);
  if (d != null) {
    await page.waitForTimeout(150);
    await shot(page, "02-hover-preview-long");
    log("preview-state-long", await previewState(page));
    // Warm switch: move to the next row while open.
    const t0 = Date.now();
    const rows = page.locator('[aria-label="全景"] [data-tier="active"]');
    const b2 = await rows.nth(0).boundingBox();
    await page.mouse.move(b2.x + 20, b2.y + b2.height / 2);
    await page.waitForFunction(
      (y) => {
        const el = document.querySelector("[data-hover-preview]");
        return el && el.dataset.anchorTop && Math.abs(Number(el.dataset.anchorTop) - y) < 2;
      },
      b2.y,
      { timeout: 2000, polling: 10 },
    ).catch(() => {});
    log("hover-delay-ms-warm-switch", Date.now() - t0);
    // Move into the card and scroll it.
    const st = await previewState(page);
    if (st) {
      await page.mouse.move(st.rect.x + st.rect.w / 2, st.rect.y + 30, { steps: 8 });
      await page.waitForTimeout(250);
      log("preview-stays-open-when-pointer-inside", (await previewState(page))?.visible ?? false);
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(150);
      log("preview-scrolled", await page.evaluate(() =>
        document.querySelector("[data-hover-preview-body]")?.scrollTop ?? null));
    }
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
    log("preview-closed-after-leave", !((await previewState(page))?.visible));

    // Fast sweep across many rows: count how many times the card appears.
    await page.evaluate(() => {
      window.__opens = 0;
      new MutationObserver(() => {
        const el = document.querySelector("[data-hover-preview]");
        const v = !!el && getComputedStyle(el).visibility !== "hidden";
        if (v && !window.__wasOpen) window.__opens++;
        window.__wasOpen = v;
      }).observe(document.body, { subtree: true, childList: true, attributes: true });
    });
    const col = page.locator('[data-column="understand"] [data-tier]');
    const first = await col.first().boundingBox();
    const grid = await page.locator('[aria-label="全景"]').boundingBox();
    // ~1 row per 25ms horizontally across all columns (a fast pass).
    await page.mouse.move(grid.x + 10, first.y + 4);
    const t1 = Date.now();
    await page.mouse.move(grid.x + grid.width - 10, first.y + 4, { steps: 40 });
    const sweepMs = Date.now() - t1;
    await page.mouse.move(grid.x + grid.width - 10, grid.y + grid.height - 5, { steps: 1 });
    await page.mouse.move(5, 5);
    await page.waitForTimeout(500);
    log("fast-sweep", { ms: sweepMs, opens: await page.evaluate(() => window.__opens) });

    // Click copies and dismisses.
    await hoverDelay(page, row);
    await page.locator(row).first().click();
    await page.waitForTimeout(100);
    log("preview-closed-after-click", !((await previewState(page))?.visible));
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
  }
  void hasPreview;

  // Right-edge positioning: last column row.
  const lastCol = '[data-column="distill"] [data-tier]';
  if ((await hoverDelay(page, lastCol)) != null) {
    await page.waitForTimeout(100);
    await shot(page, "03-hover-preview-right-edge");
    log("preview-right-edge", await previewState(page));
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
  }
  // Bottom strip (near bottom edge).
  const strip = '[data-column="cue"] [data-tier]';
  if ((await hoverDelay(page, strip)) != null) {
    await page.waitForTimeout(100);
    await shot(page, "04-hover-preview-bottom-edge");
    log("preview-bottom-edge", await previewState(page));
    await page.mouse.move(5, 5);
    await page.waitForTimeout(400);
  }

  // Settings → appearance.
  await page.keyboard.press("Meta+Comma");
  await page.waitForTimeout(300);
  await shot(page, "05-settings-appearance");
  const scaleButtons = page.locator('[data-font-scale]');
  log("font-scale-options", await scaleButtons.evaluateAll((els) => els.map((e) => e.textContent)));
  if ((await scaleButtons.count()) > 0) {
    await scaleButtons.last().click();
    await page.waitForTimeout(200);
    await shot(page, "06-settings-font-largest");
    log("after-pick-largest", await page.evaluate(() => document.documentElement.className));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await shot(page, "07-panorama-1440-largest");
    log("metrics-largest-1440", await metrics(page));
    if ((await hoverDelay(page, row)) != null) {
      await page.waitForTimeout(100);
      await shot(page, "08-hover-preview-largest");
      log("preview-state-largest", await previewState(page));
      await page.mouse.move(5, 5);
      await page.waitForTimeout(400);
    }
    // Persistence: reload.
    await page.reload();
    await page.waitForSelector('[aria-label="全景"] [data-tier]');
    await page.waitForTimeout(300);
    log("persisted-after-reload", await page.evaluate(() => ({
      cls: document.documentElement.className,
      stored: localStorage.getItem("prompt-hub-settings"),
    })));
    // Keyboard: ⌘0 resets, ⌘= grows, ⌘- shrinks.
    await page.keyboard.press("Meta+Digit0");
    await page.waitForTimeout(150);
    const afterReset = await page.evaluate(() => document.documentElement.className);
    await page.keyboard.press("Meta+Equal");
    await page.waitForTimeout(150);
    const afterPlus = await page.evaluate(() => document.documentElement.className);
    await page.keyboard.press("Meta+Minus");
    await page.waitForTimeout(150);
    const afterMinus = await page.evaluate(() => document.documentElement.className);
    log("keyboard-shortcuts", { afterReset, afterPlus, afterMinus });
    // Reset button in settings.
    await page.keyboard.press("Meta+Equal");
    await page.keyboard.press("Meta+Comma");
    await page.waitForTimeout(250);
    const reset = page.locator("[data-font-scale-reset]");
    if (await reset.count()) {
      log("reset-enabled-when-larger", await reset.isEnabled());
      await reset.click();
      await page.waitForTimeout(150);
      log("after-reset-button", await page.evaluate(() => document.documentElement.className));
      log("reset-disabled-at-default", !(await reset.isEnabled()));
    }
    await page.keyboard.press("Escape");
  }
  await ctx.close();
}

// ── 2. narrow window + large text ────────────────────────────────────────────
for (const [w, h] of [[1024, 700], [800, 600]]) {
  {
    const { ctx, page } = await open({ width: w, height: h });
    await shot(page, `09-panorama-${w}-default`);
    log(`metrics-default-${w}`, await metrics(page));
    await ctx.close();
  }
  {
    const { ctx, page } = await open(
      { width: w, height: h },
      { persisted: JSON.stringify({ state: { themeMode: "dark", accent: "neutral", density: "comfortable", interactionMode: "invoke", fontScale: "xlarge" }, version: 2 }) },
    );
    await shot(page, `10-panorama-${w}-largest`);
    log(`metrics-largest-${w}`, await metrics(page));
    if ((await hoverDelay(page, '[data-column="distill"] [data-tier]')) != null) {
      await page.waitForTimeout(100);
      await shot(page, `11-hover-preview-${w}-largest`);
      log(`preview-${w}-largest`, await previewState(page));
    }
    await ctx.close();
  }
}

// ── 3. organize workspace (管理) at both sizes ───────────────────────────────
{
  const { ctx, page } = await open({ width: 1440, height: 900 });
  const tab = page.getByRole("tab", { name: "管理" });
  if (await tab.count()) {
    await tab.first().click();
    await page.waitForTimeout(400);
    await shot(page, "12-manage-1440-default");
  } else {
    const btn = page.getByRole("button", { name: /管理/ });
    if (await btn.count()) {
      await btn.first().click();
      await page.waitForTimeout(400);
      await shot(page, "12-manage-1440-default");
    }
  }
  await ctx.close();
}

writeFileSync(join(out, `${label}-report.json`), JSON.stringify(report, null, 2));
await browser.close();
