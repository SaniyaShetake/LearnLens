import { test, expect, Page } from "@playwright/test";
import { collectConsoleErrors } from "./helpers";

const THIRD_PARTY = /youtube|ytimg|googlevideo|doubleclick|google\.com|gstatic|fonts\.googleapis/i;

async function presentIndex(page: Page) {
  return page.locator(".reveal .slides > section").evaluateAll((els) => els.findIndex((el) => el.classList.contains("present")));
}

test.describe("Guidelines slides (reveal.js)", () => {
  test("loads, shows the first slide image and navigates next/prev", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const failed: string[] = [];
    page.on("requestfailed", (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));

    await page.goto("/guidelines");
    const deck = page.locator(".reveal");
    await expect(deck).toBeVisible({ timeout: 15_000 });
    await expect(deck).toHaveClass(/ready/);
    await expect(page.locator(".reveal .slides > section")).toHaveCount(4);

    const first = page.locator(".reveal .slides > section.present");
    await expect(first).toHaveCount(1);
    expect(await presentIndex(page)).toBe(0);
    const img = first.locator("img");
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator(".reveal .slide-number")).toHaveText(/1\s*\/\s*4/);

    // Keyboard: focus the deck and press ArrowRight.
    await deck.click({ position: { x: 20, y: 20 } });
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => presentIndex(page), { message: "ArrowRight should go to slide 2" }).toBe(1);
    await expect(page.locator(".reveal .slide-number")).toHaveText(/2\s*\/\s*4/);
    const img2 = page.locator(".reveal .slides > section.present img");
    await expect.poll(() => img2.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth)).toBeGreaterThan(0);

    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => presentIndex(page), { message: "ArrowLeft should go back to slide 1" }).toBe(0);

    // On-screen controls.
    await page.locator(".reveal .controls .navigate-right").click();
    await expect.poll(() => presentIndex(page), { message: "next control" }).toBe(1);
    await page.locator(".reveal .controls .navigate-left").click();
    await expect.poll(() => presentIndex(page), { message: "prev control" }).toBe(0);

    // Every slide image loads.
    await expect
      .poll(() => page.locator(".reveal .slides img").evaluateAll((els) => els.map((el) => (el as HTMLImageElement).naturalWidth > 0)))
      .toEqual([true, true, true, true]);

    const appErrors = errors.filter((e) => !THIRD_PARTY.test(e));
    expect(appErrors, appErrors.join("\n")).toEqual([]);
    const ownFailed = failed.filter((f) => !THIRD_PARTY.test(f));
    expect(ownFailed, ownFailed.join("\n")).toEqual([]);
  });
});
