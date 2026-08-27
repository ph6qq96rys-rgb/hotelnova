import { expect, test } from "@playwright/test";

test.describe("QAE auth smoke", () => {
  test("login page is usable on all supported viewports", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByText("Hotel Nova")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    const passwordInput = page.getByRole("textbox", { name: "Password" });
    await expect(passwordInput).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeDisabled();

    await page.getByLabel("Email address").fill("companyadmin@restaurantfnb.local");
    await passwordInput.fill("secret-password");
    await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();

    await expect(passwordInput).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");
  });

  test("protected company route redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/companies/c76834e2-1b3b-4794-9ff8-272c825c4f17/production/menu-engineering");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });
});
