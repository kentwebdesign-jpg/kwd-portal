import type { Browser } from "puppeteer-core";

// Renders a generated page to screenshots so the design loop can SEE its own
// output — the single biggest quality lever. A one-shot generator never looks
// at what it produced; this module gives the pipeline eyes.
//
// Chrome discovery is multi-strategy so it works both on Railway (via
// @sparticuz/chromium's bundled static build) and on a dev Mac (local Chrome).
// Rendering is strictly best-effort: any failure returns null and the build
// carries on exactly as before — the review loop is an enhancement, never a
// point of failure.

export type PageShots = {
  // JPEG, base64 (no data: prefix). Sized to stay readable after the vision
  // model's downscaling — a 1440px-wide, ~4000px-tall page becomes soup if
  // sent as one image, so we send hero + capped full-page + mobile.
  desktopHero: string; // 1440×900 — the wow moment, full detail
  desktopFull: string; // 1440 wide, capped height — overall flow/rhythm
  mobile: string; // 390×844 — the mobile-first check
};

const JPEG_QUALITY = 62;
const FULL_PAGE_MAX_HEIGHT = 4200;
const NAV_TIMEOUT_MS = 45_000;

// Wrap a WordPress page fragment (style + header + main + footer) in a minimal
// document shell, mirroring what the blank-canvas theme serves.
export function wrapFragment(fragmentHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
</head>
<body>
${fragmentHtml}
</body>
</html>`;
}

const LOCAL_CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

async function launchBrowser(): Promise<Browser | null> {
  const puppeteer = await import("puppeteer-core");

  // 1. Explicit override always wins (lets us point Railway at anything).
  // 2. @sparticuz/chromium — a static Chromium built for headless server use.
  // 3. A locally installed Chrome (dev machines).
  const attempts: Array<() => Promise<Browser>> = [];

  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (envPath) {
    attempts.push(() =>
      puppeteer.launch({ executablePath: envPath, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }),
    );
  }

  attempts.push(async () => {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: true,
      args: chromium.args,
    });
  });

  const fs = await import("node:fs");
  for (const p of LOCAL_CHROME_PATHS) {
    if (fs.existsSync(p)) {
      attempts.push(() =>
        puppeteer.launch({ executablePath: p, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] }),
      );
      break;
    }
  }

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch {
      // try the next strategy
    }
  }
  return null;
}

async function shoot(
  browser: Browser,
  html: string,
  viewport: { width: number; height: number },
  fullPage: boolean,
): Promise<string> {
  const page = await browser.newPage();
  try {
    await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
    // Wait for the DOM, then for the network (Google Fonts + hosted imagery)
    // to go quiet; a slow asset shouldn't kill the shot, so time out into
    // "shoot what we have".
    await page.setContent(html, { waitUntil: "load", timeout: NAV_TIMEOUT_MS }).catch(() => {});
    await page.waitForNetworkIdle({ idleTime: 500, timeout: NAV_TIMEOUT_MS }).catch(() => {});
    // Let entrance animations (GSAP/reveals) settle so we don't screenshot
    // everything at opacity 0.
    await new Promise((r) => setTimeout(r, 1200));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await new Promise((r) => setTimeout(r, 300));

    let clip: { x: number; y: number; width: number; height: number } | undefined;
    if (fullPage) {
      const bodyHeight = await page.evaluate(() => document.body.scrollHeight).catch(() => viewport.height);
      clip = {
        x: 0,
        y: 0,
        width: viewport.width,
        height: Math.min(Number(bodyHeight) || viewport.height, FULL_PAGE_MAX_HEIGHT),
      };
    }

    const buf = await page.screenshot({
      type: "jpeg",
      quality: JPEG_QUALITY,
      ...(clip ? { clip, captureBeyondViewport: true } : {}),
    });
    return Buffer.from(buf).toString("base64");
  } finally {
    await page.close().catch(() => {});
  }
}

// Render the three review shots for one page. Returns null if no Chrome can be
// launched or every capture fails — callers treat that as "skip the review".
export async function renderPageShots(fragmentHtml: string, title: string): Promise<PageShots | null> {
  const browser = await launchBrowser();
  if (!browser) return null;
  try {
    const html = wrapFragment(fragmentHtml, title);
    const [desktopHero, desktopFull, mobile] = await Promise.all([
      shoot(browser, html, { width: 1440, height: 900 }, false),
      shoot(browser, html, { width: 1440, height: 900 }, true),
      shoot(browser, html, { width: 390, height: 844 }, false),
    ]);
    if (!desktopHero || !desktopFull || !mobile) return null;
    return { desktopHero, desktopFull, mobile };
  } catch (err) {
    console.error("Design render failed (review loop skipped):", err);
    return null;
  } finally {
    await browser.close().catch(() => {});
  }
}
