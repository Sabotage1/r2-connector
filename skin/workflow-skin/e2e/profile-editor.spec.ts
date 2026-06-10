import { expect, test, type Page } from "@playwright/test";

const profiles = Array.from({ length: 28 }, (_, index) => ({
  id: `profile-${index + 1}`,
  profile: { title: `Long Profile ${index + 1}` }
}));

async function routeProfileEditorApi(page: Page) {
  let settings = {
    presetSlots: [{ label: "Light" }, { label: "Sweet" }, { label: "Turbo" }, { label: "Classic" }],
    defaultReviewEnabled: true,
    reviewEnabledByProfile: {},
    profileWorkflows: {},
    skinTitle: "Workflow"
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    let body: unknown = null;

    if (method === "GET" && url.pathname === "/api/v1/profiles") body = profiles;
    else if (method === "GET" && url.pathname === "/api/v1/workflow") body = { context: { targetDoseWeight: 18, targetYield: 36 } };
    else if (method === "GET" && url.pathname === "/api/v1/beans") body = [];
    else if (method === "GET" && url.pathname === "/api/v1/grinders") body = [];
    else if (method === "GET" && url.pathname === "/api/v1/shots") body = { items: [], total: 0, limit: 100, offset: 0 };
    else if (method === "GET" && url.pathname === "/api/v1/sensors") body = [];
    else if (method === "GET" && url.pathname === "/api/v1/machine/state") body = { connected: true, wifi: { connected: true, ipAddress: "192.168.1.20" } };
    else if (method === "GET" && url.pathname === "/api/v1/kv/workflow-skin/settings") body = settings;
    else if (method === "PUT" && url.pathname === "/api/v1/kv/workflow-skin/settings") {
      settings = JSON.parse(request.postData() ?? "{}");
      await route.fulfill({ status: 200, body: "" });
      return;
    } else {
      body = {};
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  return {
    get settings() {
      return settings;
    }
  };
}

test("preset editor keeps long profile lists scrollable inside the dialog", async ({ page }) => {
  await routeProfileEditorApi(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Edit Light" }).click();

  const panel = page.locator(".preset-editor-panel");
  const picker = page.locator(".profile-picker");
  await expect(panel).toBeVisible();

  const metrics = await page.evaluate(() => {
    const panelElement = document.querySelector(".preset-editor-panel");
    const pickerElement = document.querySelector(".profile-picker");
    return {
      panelHeight: panelElement?.getBoundingClientRect().height ?? 0,
      viewportHeight: window.innerHeight,
      pickerClientHeight: pickerElement?.clientHeight ?? 0,
      pickerScrollHeight: pickerElement?.scrollHeight ?? 0
    };
  });

  expect(metrics.panelHeight).toBeLessThan(metrics.viewportHeight - 24);
  expect(metrics.pickerScrollHeight).toBeGreaterThan(metrics.pickerClientHeight);

  await picker.evaluate((element) => {
    element.scrollTop = 180;
  });
  await expect.poll(() => picker.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test("preset editor assigns a profile when a visible profile row is clicked", async ({ page }) => {
  const api = await routeProfileEditorApi(page);

  await page.goto("/");
  await page.getByRole("button", { name: "Edit Light" }).click();
  await page.getByRole("button", { name: "Use Long Profile 2", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "Edit Light preset" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Light Long Profile 2" })).toBeVisible();
  expect(api.settings.presetSlots[0]).toEqual({ label: "Light", profileId: "profile-2" });
});
