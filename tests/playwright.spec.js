// Playwright scaffold for hosted NexusOS click-through testing.
// Install with: npm install -D @playwright/test
// Run with: npx playwright test

const { test, expect } = require("@playwright/test");

const base = process.env.NEXUSOS_URL || "http://127.0.0.1:4288";

test("public pages load", async ({ page }) => {
  await page.goto(`${base}/intake.html`);
  await expect(page.getByText("NexusOS Service Intake")).toBeVisible();
  await page.goto(`${base}/pricing.html`);
  await expect(page.getByText("NexusOS Subscriptions")).toBeVisible();
  await page.goto(`${base}/status.html`);
  await expect(page.getByText("connection center")).toBeVisible();
});

test("admin login screen loads", async ({ page }) => {
  await page.goto(base);
  await expect(page.getByText("NexusOS Secure Access")).toBeVisible();
});
