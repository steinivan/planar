import { test, expect } from "@playwright/test";

// The mock server (vite.config.ts) registers a "session-graph" session whose
// plan contains an planar-graph block spanning a `web` and a `backend` repo.
test.describe("Graph Review", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".plan-viewer-container");
    // Switch to the graph-enabled session (not the default active tab).
    await page
      .locator(".session-tab", { hasText: "Checkout con pago en un clic" })
      .click();
  });

  test("graph toggle appears and switches to the graph view", async ({
    page,
  }) => {
    const graphBtn = page.locator(".view-btn", { hasText: "Graph" });
    await expect(graphBtn).toBeVisible();
    await graphBtn.click();

    // Svelte Flow canvas renders.
    await expect(page.locator(".graph-wrapper .svelte-flow")).toBeVisible();
    // Entity nodes render with their non-technical labels.
    await expect(page.getByText("Carrito", { exact: true })).toBeVisible();
    // Repos are grouped into labelled containers.
    await expect(page.getByText("web", { exact: true })).toBeVisible();
    await expect(page.getByText("backend", { exact: true })).toBeVisible();
  });

  test("'More details' opens the side panel with technical detail", async ({
    page,
  }) => {
    await page.locator(".view-btn", { hasText: "Graph" }).click();

    await page.locator(".gn-btn", { hasText: "More details" }).first().click();

    const panel = page.locator(".detail-panel");
    await expect(panel).toBeVisible();
    // Files section shows technical paths.
    await expect(panel).toContainText("Files");
    await expect(panel.locator("code").first()).toBeVisible();
  });

  test("commenting a node feeds the approve feedback", async ({ page }) => {
    await page.locator(".view-btn", { hasText: "Graph" }).click();

    // Open the comment popover for the first node.
    await page
      .locator('.gn-btn[aria-label="Comment on this node"]')
      .first()
      .click();
    const popover = page.locator(".comment-popover");
    await expect(popover).toBeVisible();
    await popover.locator(".cp-input").fill("Rename this capability");
    await popover.locator(".cp-btn.save").click();
    await expect(popover).not.toBeVisible();

    // Submit approve and assert the graph comment is in the feedback payload.
    // With a comment present the dropdown defaults to "Request changes", so
    // select the approve radio explicitly first.
    await page.locator(".btn-trigger").click();
    await page.locator('input[type="radio"][value="approve"]').check();
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) =>
          req.url().includes("/approve") &&
          req.url().includes("/api/sessions/"),
      ),
      page.locator(".btn-submit.approve").click(),
    ]);
    const postData = request.postDataJSON();
    expect(postData.feedback).toContain("Rename this capability");
    expect(postData.feedback).toContain("Graph feedback");
  });
});
