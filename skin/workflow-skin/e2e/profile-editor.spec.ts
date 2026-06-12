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
    shownProfileIds: profiles.map((profile) => profile.id),
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
    else if (method === "GET" && url.pathname === "/api/v1/steams") body = [];
    else if (method === "GET" && url.pathname === "/api/v1/sensors") body = [];
    else if (method === "GET" && url.pathname === "/api/v1/devices") body = [];
    else if (method === "GET" && url.pathname === "/api/v1/info") body = { localIp: "192.168.1.20", version: "0.7.6" };
    else if (method === "GET" && url.pathname === "/api/v1/display") body = { brightness: 100, wakeLockOverride: true };
    else if (method === "GET" && url.pathname === "/api/v1/plugins") body = [];
    else if (method === "GET" && url.pathname === "/api/v1/webui/skins") body = [{ id: "workflow-skin", name: "Workflow Skin", version: "0.1.24" }];
    else if (method === "GET" && url.pathname === "/api/v1/webui/skins/default") body = { id: "workflow-skin", name: "Workflow Skin", version: "0.1.24" };
    else if (method === "GET" && url.pathname === "/api/v1/devices/scan") body = [];
    else if ((method === "POST" || method === "DELETE") && url.pathname === "/api/v1/display/wakelock") body = {};
    else if (method === "GET" && url.pathname === "/api/v1/machine/state") body = { connected: true, wifi: { connected: true, ipAddress: "192.168.1.20" } };
    else if (method === "GET" && (url.pathname === "/api/v1/store/workflow-skin/settings" || url.pathname === "/api/v1/kv/workflow-skin/settings")) body = settings;
    else if ((method === "POST" || method === "PUT") && (url.pathname === "/api/v1/store/workflow-skin/settings" || url.pathname === "/api/v1/kv/workflow-skin/settings")) {
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

test("top title and machine action buttons do not overlap", async ({ page }) => {
  await routeProfileEditorApi(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Brew" })).toBeVisible();

  const metrics = await page.evaluate(() => {
    const title = document.querySelector(".app-headline")?.getBoundingClientRect();
    const actions = document.querySelector(".page-top-actions")?.getBoundingClientRect();
    const buttons = Array.from(document.querySelectorAll(".page-top-actions .sleep-button")).map((button) => button.getBoundingClientRect());
    return {
      title: title ? { left: title.left, right: title.right, top: title.top, bottom: title.bottom } : null,
      actions: actions ? { left: actions.left, right: actions.right, top: actions.top, bottom: actions.bottom } : null,
      buttons: buttons.map((button) => ({ left: button.left, right: button.right }))
    };
  });

  expect(metrics.title).not.toBeNull();
  expect(metrics.actions).not.toBeNull();
  expect(metrics.title!.right).toBeLessThanOrEqual(metrics.actions!.left - 8);
  expect(metrics.buttons).toHaveLength(2);
  expect(metrics.buttons[0].right).toBeLessThanOrEqual(metrics.buttons[1].left - 8);
});
