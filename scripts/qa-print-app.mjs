import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080/";
await mkdir("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true });
const errors = [];

async function run(name, viewport, action) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", (err) => errors.push(`${name} pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${name} console: ${msg.text()}`);
  });
  await page.goto(base, { waitUntil: "networkidle", timeout: 30000 });
  await action(page);
  await page.close();
}

await run("desktop-home", { width: 1280, height: 800 }, async (page) => {
  const title = await page.locator("h1").first().textContent();
  console.log("h1:", title);
  await page.screenshot({
    path: "/workspace/screenshots/home-desktop.png",
    fullPage: true,
  });
});

await run("mobile-home", { width: 390, height: 844 }, async (page) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log("mobile overflow:", overflow);
  await page.screenshot({
    path: "/workspace/screenshots/home-mobile.png",
    fullPage: true,
  });
});

await run("search-success", { width: 1280, height: 900 }, async (page) => {
  await page.getByLabel("Describe the item").fill("phone stand");
  await page.getByRole("button", { name: "Can I 3D Print This?" }).click();
  await page.getByText(/Found \d+ strong match|Closest matches|No solid free printable match/i).waitFor({
    timeout: 45000,
  });
  const summary = await page.locator("h2").first().textContent();
  console.log("success summary:", summary);
  const cards = await page.locator("article").count();
  console.log("cards:", cards);
  await page.screenshot({
    path: "/workspace/screenshots/results-phone-stand.png",
    fullPage: true,
  });
});

await run("search-nomatch", { width: 1280, height: 900 }, async (page) => {
  await page.getByLabel("Describe the item").fill("qzxvplm unique unobtanium flux widget 99281");
  await page.getByRole("button", { name: "Can I 3D Print This?" }).click();
  await page.getByText(/Found \d+ strong match|Closest matches|No solid free printable match/i).waitFor({
    timeout: 45000,
  });
  const summary = await page.locator("h2").first().textContent();
  console.log("nomatch summary:", summary);
  await page.screenshot({
    path: "/workspace/screenshots/results-nomatch.png",
    fullPage: true,
  });
});

await browser.close();
if (errors.length) {
  console.log("ERRORS");
  for (const e of errors) console.log("-", e);
  process.exitCode = 1;
} else {
  console.log("NO CONSOLE ERRORS");
}
