import {expect, test, type Page} from '@playwright/test';

const auth = {accessToken: 'test-token', user: {id: 'user-1', email: 'new@example.com'}};
const mindSpaces = [{id: 'space-1', name: 'Personal'}, {id: 'space-2', name: 'Work'}];

type ApiCall = {path: string; method: string; authorization?: string; body?: unknown; search: string};

async function seedSession(page: Page, selectedMindSpaceId = mindSpaces[0].id) {
  await page.addInitScript(({authState, selectedId}) => {
    sessionStorage.setItem('priora.auth', JSON.stringify(authState));
    sessionStorage.setItem('priora.selectedMindSpaceId', selectedId);
  }, {authState: auth, selectedId: selectedMindSpaceId});
}

async function mockWorkspaceApi(page: Page, options: {spaces?: typeof mindSpaces} = {}) {
  const calls: ApiCall[] = [];
  const spaces = options.spaces ?? mindSpaces;

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    calls.push({
      path,
      method,
      search: url.search,
      authorization: request.headers().authorization,
      body: request.postDataJSON(),
    });

    if (path.endsWith('/mindspaces') && method === 'GET') {
      await route.fulfill({json: {count: spaces.length, result: spaces}});
      return;
    }
    if (path.endsWith('/conversations') && method === 'GET') {
      await route.fulfill({json: []});
      return;
    }
    if (path.endsWith('/documents') && method === 'GET') {
      await route.fulfill({json: []});
      return;
    }
    if (path.endsWith('/tasks') && method === 'GET') {
      await route.fulfill({json: []});
      return;
    }
    if (path.endsWith('/notes') && method === 'GET') {
      await route.fulfill({json: []});
      return;
    }

    await route.fulfill({status: 501, json: {error: `Unexpected ${method} ${path}`}});
  });

  return calls;
}

function chatHeading(page: Page) {
  return page.getByRole('heading', {level: 1, name: 'Chat', exact: true});
}

function workspaceMenu(page: Page, name = 'Open workspace navigation') {
  return page.getByRole('banner').getByRole('button', {name});
}

test('workspace fixture boots authenticated chat route', async ({page}) => {
  await seedSession(page);
  await mockWorkspaceApi(page);
  await page.goto('/en/app/chat');
  await expect(chatHeading(page)).toBeVisible();
});

test('settings controls theme preference and persists across refresh', async ({page}) => {
  await page.emulateMedia({colorScheme: 'dark'});
  await seedSession(page);
  await mockWorkspaceApi(page);

  await page.goto('/en/app/settings');
  await expect(page.getByRole('heading', {level: 1, name: 'Settings', exact: true})).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');

  await page.getByRole('radio', {name: /Light/}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'light');
  await expect(page.getByRole('radio', {name: /Light/})).toHaveAttribute('aria-checked', 'true');

  await page.getByRole('radio', {name: /Dark/}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => localStorage.getItem('priora.theme'))).toBe('dark');

  await page.getByRole('radio', {name: /System/}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-preference', 'system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.emulateMedia({colorScheme: 'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('desktop sidebar collapses, persists, and keeps icon-only navigation accessible', async ({page}) => {
  await seedSession(page);
  await mockWorkspaceApi(page);
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('/en/app/chat');

  const sidebar = page.locator('aside').first();
  const main = page.getByRole('main');
  const expanded = await sidebar.boundingBox();
  const expandedMain = await main.boundingBox();
  expect(expanded).not.toBeNull();
  expect(expandedMain).not.toBeNull();

  await expect(page.getByRole('link', {name: 'Settings'})).toBeVisible();
  await page.getByRole('button', {name: 'Collapse sidebar'}).click();
  await expect(page.getByRole('button', {name: 'Expand sidebar'})).toBeVisible();
  const collapsed = await sidebar.boundingBox();
  const collapsedMain = await main.boundingBox();
  expect(collapsed!.width).toBeLessThan(expanded!.width);
  expect(collapsedMain!.width).toBeGreaterThan(expandedMain!.width);
  expect(await page.evaluate(() => localStorage.getItem('priora.sidebar.collapsed'))).toBe('true');

  await page.getByRole('link', {name: 'Settings'}).click();
  await expect(page).toHaveURL(/\/en\/app\/settings$/);
  await expect(page.getByRole('link', {name: 'Settings'})).toHaveAttribute('aria-current', 'page');
  await page.reload();
  await expect(page.getByRole('button', {name: 'Expand sidebar'})).toBeVisible();

  await page.getByRole('button', {name: 'Expand sidebar'}).dispatchEvent('click');
  await expect(page.getByRole('button', {name: 'Collapse sidebar'})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('priora.sidebar.collapsed'))).toBe('false');
});

test('settings routing preserves MindSpace and preferences across navigation', async ({page}) => {
  await seedSession(page, mindSpaces[1].id);
  await mockWorkspaceApi(page);
  await page.goto('/en/app/settings');

  await expect(page.getByRole('combobox', {name: 'Choose a MindSpace'})).toContainText('Work');
  await page.getByRole('radio', {name: /Dark/}).click();
  await page.getByRole('button', {name: 'Collapse sidebar'}).click();
  await page.getByRole('link', {name: 'Chat'}).click();

  await expect(page).toHaveURL(/\/en\/app\/chat$/);
  await expect(chatHeading(page)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('button', {name: 'Expand sidebar'})).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('priora.selectedMindSpaceId'))).toBe(mindSpaces[1].id);
});

test('mobile workspace Sheet includes Settings and remains independent from Chat conversation Sheet', async ({page}) => {
  await seedSession(page);
  await mockWorkspaceApi(page);
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/en/app/chat');

  await workspaceMenu(page).click();
  await expect(page.getByRole('dialog').getByRole('link', {name: 'Settings'})).toBeVisible();
  await expect(page.getByRole('button', {name: /Collapse sidebar|Expand sidebar/})).toHaveCount(0);
  await page.getByRole('dialog').getByRole('link', {name: 'Settings'}).click();
  await expect(page).toHaveURL(/\/en\/app\/settings$/);

  await workspaceMenu(page).click();
  await page.getByRole('dialog').getByRole('link', {name: 'Chat'}).click();
  await expect(page.getByRole('button', {name: 'Conversations'})).toBeVisible();
  await page.getByRole('button', {name: 'Conversations'}).click();
  await expect(page.getByRole('dialog').getByRole('heading', {name: 'Conversations'})).toBeVisible();
});

test('Arabic settings and collapsed navigation preserve RTL without horizontal overflow', async ({page}) => {
  await seedSession(page);
  await mockWorkspaceApi(page);
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto('/ar/app/settings');

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', {level: 1, name: 'الإعدادات', exact: true})).toBeVisible();
  await expect(page.getByRole('link', {name: 'الإعدادات'})).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', {name: 'طي الشريط الجانبي'}).click();
  await expect(page.getByRole('button', {name: 'توسيع الشريط الجانبي'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.setViewportSize({width: 390, height: 844});
  await workspaceMenu(page, 'فتح تنقل مساحة العمل').click();
  await expect(page.getByRole('dialog').getByRole('link', {name: 'الإعدادات'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test('public login remains a normal scrolling document outside workspace containment', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('priora.theme', 'dark'));
  await page.setViewportSize({width: 390, height: 420});
  await page.goto('/en/login');
  await expect(page.getByRole('heading', {name: 'Welcome back'})).toBeVisible();
  const overflow = await page.evaluate(() => getComputedStyle(document.body).overflowY);
  expect(overflow).not.toBe('hidden');
});
