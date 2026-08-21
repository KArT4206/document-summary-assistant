import { test, expect } from "@playwright/test";
import { ensureFixtures } from "./fixtures";

test("debug upload", async ({ page }) => {
  page.on("console", (msg) => console.log("[browser]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  const { unsupported } = ensureFixtures();
  await page.goto("/");
  const input = page.locator('input[type="file"]');
  console.log("input count", await input.count());
  await input.setInputFiles(unsupported);
  await page.waitForTimeout(1000);
  const html = await page.content();
  console.log("HAS_ALERT_TEXT", html.includes("Unsupported file type"));
  expect(true).toBe(true);
});
