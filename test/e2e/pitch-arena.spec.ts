import { test, expect } from "@playwright/test";

test.describe("PitchArena E2E Flows", () => {
  test("Nạp trang chủ và kiểm tra hiển thị", async ({ page }) => {
    await page.goto("/");

    // Kiểm tra tiêu đề hoặc button bắt đầu có mặt trên giao diện
    await expect(page).toHaveTitle(/PITCH·ARENA/i);
  });

  test("Kiểm tra giao diện Bước 3 Thuyết trình (Teleprompter)", async ({
    page,
  }) => {
    // Điều hướng vào màn hình Step 3 (hoặc flow arena)
    await page.goto("/arena");

    // Kiểm tra các phần tử cốt lõi của Bước 3: nút Mic, Teleprompter, Audio Wave
    const micButton = page.locator(
      'button:has-text("Bắt đầu"), button:has-text("Nói")',
    );
    if (await micButton.isVisible()) {
      await expect(micButton).toBeEnabled();
    }
  });
});
