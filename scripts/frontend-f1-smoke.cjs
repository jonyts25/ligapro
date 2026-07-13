const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const outDir = path.join("docs", "reports", "assets", "frontend-f1");

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const results = {
    consoleErrors: [],
    checks: {},
  };

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") results.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => results.consoleErrors.push(String(err)));

  async function checkRedirect(from, expectedIncludes) {
    await page.goto(`http://localhost:3000${from}`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    const url = new URL(page.url());
    results.checks[from] = {
      finalPath: url.pathname + url.search,
      expectedIncludes,
      pass: (url.pathname + url.search).includes(expectedIncludes),
    };
  }

  await checkRedirect("/", "/iniciar-sesion");
  await checkRedirect("/onboarding", "/iniciar-sesion");
  await checkRedirect(
    "/organizaciones/00000000-0000-0000-0000-000000000000/inicio",
    "/iniciar-sesion"
  );

  await page.goto("http://localhost:3000/iniciar-sesion", {
    waitUntil: "domcontentloaded",
  });
  await page.locator("#email").fill("no-existe@example.com");
  await page.locator("#password").fill("wrong-password");
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("iniciar-sesion") || res.request().method() === "POST",
      { timeout: 20000 }
    ).catch(() => null),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
  await page.waitForTimeout(2500);
  const alert = page.locator('[role="alert"]').first();
  const alertCount = await alert.count();
  const alertText = alertCount ? await alert.textContent() : null;
  results.checks.invalidLogin = {
    alertText,
    pass: Boolean(alertText && alertText.includes("No pudimos iniciar sesión")),
  };
  await page.screenshot({
    path: path.join(outDir, "invalid-login.png"),
    fullPage: true,
  });

  await page.goto("http://localhost:3000/registro", {
    waitUntil: "domcontentloaded",
  });
  results.checks.registroVisible = {
    pass:
      (await page.getByRole("heading", { name: "Crear cuenta" }).count()) > 0,
  };
  await page.screenshot({
    path: path.join(outDir, "registro-375.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: path.join(outDir, "registro-1440.png"),
    fullPage: true,
  });

  await page.goto("http://localhost:3000/auth/callback?next=https://evil.com", {
    waitUntil: "domcontentloaded",
  });
  results.checks.callbackRejectsExternal = {
    finalPath: new URL(page.url()).pathname,
    pass: new URL(page.url()).pathname === "/iniciar-sesion",
  };

  await page.goto(
    "http://localhost:3000/auth/callback?next=//evil.com",
    { waitUntil: "domcontentloaded" }
  );
  results.checks.callbackRejectsProtocolRelative = {
    finalPath: new URL(page.url()).pathname,
    pass: new URL(page.url()).pathname === "/iniciar-sesion",
  };

  const manifestResp = await page.goto(
    "http://localhost:3000/manifest.webmanifest"
  );
  const manifest = await manifestResp.json();
  results.checks.manifest = {
    name: manifest.name,
    display: manifest.display,
    pass: manifest.name === "LigaPro" && manifest.display === "standalone",
  };

  fs.writeFileSync(
    path.join(outDir, "smoke-results.json"),
    JSON.stringify(results, null, 2)
  );
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
