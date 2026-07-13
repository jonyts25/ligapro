const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const viewports = [
  { name: "375x812", width: 375, height: 812 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
];

const outputDir = path.join("docs", "reports", "assets", "frontend-f0");

(async () => {
  fs.mkdirSync(outputDir, { recursive: true });

  const results = {
    consoleErrors: [],
    hydrationErrors: [],
    horizontalScroll: {},
    manifest: null,
    icons: {},
    screenshots: [],
    drawerTest: null,
  };

  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") results.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => results.consoleErrors.push(String(err)));

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const hydration = await page
    .locator("text=/Hydration failed|hydration mismatch/i")
    .count();
  results.hydrationErrors =
    hydration > 0 ? ["Possible hydration mismatch detected in DOM text"] : [];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);
    results.horizontalScroll[vp.name] = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1
    );
    const screenshotPath = path.join(outputDir, `${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    results.screenshots.push(screenshotPath);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  const menuButton = page.getByRole("button", {
    name: /Abrir menú de módulos adicionales/i,
  });
  await menuButton.click();
  await page.waitForTimeout(300);
  const drawerPath = path.join(outputDir, "375x812-drawer-open.png");
  await page.screenshot({ path: drawerPath, fullPage: true });
  results.screenshots.push(drawerPath);

  const drawerVisible = await page
    .getByRole("dialog", { name: /Más módulos/i })
    .isVisible();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const drawerClosed = await page
    .getByRole("dialog", { name: /Más módulos/i })
    .isHidden();

  results.drawerTest = {
    opened: drawerVisible,
    closedWithEscape: drawerClosed,
    ariaExpandedAfterClose: await menuButton.getAttribute("aria-expanded"),
  };

  const manifestResp = await page.goto(
    "http://localhost:3000/manifest.webmanifest"
  );
  results.manifest = await manifestResp.json();

  for (const iconPath of [
    "/icons/icon-192",
    "/icons/icon-512",
    "/icons/icon-512?maskable=1",
  ]) {
    const resp = await page.goto(`http://localhost:3000${iconPath}`);
    results.icons[iconPath] = {
      status: resp.status(),
      contentType: resp.headers()["content-type"],
    };
  }

  fs.writeFileSync(
    path.join(outputDir, "validation-results.json"),
    JSON.stringify(results, null, 2)
  );

  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
