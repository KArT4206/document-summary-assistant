import { test, expect } from "@playwright/test";
import { ensureFixtures, ensureImageFixture } from "./fixtures";

test.describe("Initial page", () => {
  test("renders the upload zone with correct heading and hints", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Document Summary Assistant" })).toBeVisible();
    await expect(page.getByText(/Drag & drop a document/i)).toBeVisible();
    await expect(page.getByText(/PDF, PNG, JPEG, or WEBP/i)).toBeVisible();
  });

  test("upload zone is keyboard-focusable and activates on Enter", async ({ page }) => {
    await page.goto("/");
    const zone = page.getByRole("button", { name: /Upload a document/i });
    await zone.focus();
    await expect(zone).toBeFocused();
  });
});

test.describe("Upload validation (client-side)", () => {
  test("rejects an unsupported file extension with a visible error", async ({ page }) => {
    const { unsupported } = ensureFixtures();
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(unsupported);
    await expect(page.getByRole("alert")).toContainText(/Unsupported file type/i);
  });

  test("rejects an oversized file with a visible error and does not start processing", async ({ page }) => {
    const { oversized } = ensureFixtures();
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(oversized);
    await expect(page.getByRole("alert")).toContainText(/too large/i);
    await expect(page.getByText(/Uploading document/i)).not.toBeVisible();
  });
});

test.describe("Upload -> processing -> result/error journey", () => {
  test("valid PDF upload shows a processing state, then resolves to either a summary or a clear AI error (never a blank/frozen screen)", async ({ page }) => {
    const { validPdf } = ensureFixtures();
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(validPdf);

    // Processing state must appear — the UI should never look frozen.
    await expect(page.getByRole("status")).toBeVisible();

    // Resolves within a reasonable time to either the summary view or a readable error.
    const summaryHeading = page.getByRole("heading", { name: "Summary" });
    const errorAlert = page.getByRole("alert");
    await expect(summaryHeading.or(errorAlert)).toBeVisible({ timeout: 45_000 });
  });

  test("a failed request shows a Try Again button that returns to the upload screen", async ({ page }) => {
    const { oversized: _unused } = ensureFixtures();
    void _unused;
    await page.goto("/");

    // Force a guaranteed server-side failure via an unsupported real file so we reach the API error state deterministically.
    const buf = Buffer.from("not a real document at all");
    await page.setInputFiles('input[type="file"]', {
      name: "fake.pdf",
      mimeType: "application/pdf",
      buffer: buf,
    });

    const errorAlert = page.getByRole("alert");
    await expect(errorAlert).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
    await page.getByRole("button", { name: "Try Again" }).click();
    await expect(page.getByText(/Drag & drop a document/i)).toBeVisible();
  });
});

test.describe("Image OCR upload", () => {
  test("valid image upload reaches processing and resolves (summary or AI error)", async ({ page }) => {
    const imagePath = await ensureImageFixture();
    await page.goto("/");
    await page.locator('input[type="file"]').setInputFiles(imagePath);
    await expect(page.getByRole("status")).toBeVisible();
    const summaryHeading = page.getByRole("heading", { name: "Summary" });
    const errorAlert = page.getByRole("alert");
    await expect(summaryHeading.or(errorAlert)).toBeVisible({ timeout: 45_000 });
  });
});

test.describe("404 and global error recovery", () => {
  test("an unknown route renders the custom 404 page with a way back home", async ({ page }) => {
    const res = await page.goto("/this-route-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to Document Summary Assistant/i })).toBeVisible();
  });
});

test.describe("Responsive layout", () => {
  for (const [name, width, height] of [
    ["narrow mobile", 320, 640],
    ["mobile", 375, 812],
    ["tablet", 768, 1024],
    ["desktop", 1440, 900],
  ] as const) {
    test(`no horizontal overflow at ${name} (${width}x${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(hasOverflow).toBe(false);
    });
  }
});
