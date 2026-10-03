import {test, expect, type Page} from '@playwright/test';

const credentials = {email: 'new@example.com', password: 'abcde'};
const auth = {accessToken: 'test-token', user: {id: 'user-1', email: credentials.email}};
const space = {id: 'space-1', name: 'My MindSpace'};

async function mockApi(page: Page, options: {registerStatus?: number; loginStatus?: number; createStatus?: number; network?: boolean; existing?: typeof space[]} = {}) {
  const calls: {path: string; method: string; body: unknown; authorization?: string}[] = [];
  let created = false;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    calls.push({path, method, body: request.postDataJSON(), authorization: request.headers().authorization});
    if (options.network && path.endsWith('/register')) return route.abort();
    let status = 200;
    let json: unknown = [];
    if (path.endsWith('/register')) {
      status = options.registerStatus ?? 201;
      json = {id: auth.user.id, email: credentials.email, createdAt: '2026-10-02T00:00:00Z'};
    } else if (path.endsWith('/login')) {
      status = options.loginStatus ?? 200;
      json = auth;
    } else if (path.endsWith('/mindspaces')) {
      if (method === 'POST') {
        status = options.createStatus ?? 201;
        created = status === 201;
        json = space;
      } else {
        const result = [...(options.existing ?? []), ...(created ? [space] : [])];
        json = {count: result.length, result};
      }
    }
    await route.fulfill({status, json});
  });
  return calls;
}

async function register(page: Page) {
  await page.goto('/en/register');
  await page.getByLabel('Email', {exact: true}).fill(credentials.email);
  await page.getByLabel('Password', {exact: true}).fill(credentials.password);
  await page.getByRole('button', {name: 'Create account', exact: true}).click();
}

test('existing MindSpaces retain a create action and new creation preserves the list', async ({page}) => {
  const options = {existing: [{id: 'personal', name: 'personal'}, {id: 'work', name: 'work'}], createStatus: 500};
  const calls = await mockApi(page, options);
  await page.addInitScript((value) => sessionStorage.setItem('priora.auth', JSON.stringify(value)), auth);
  await page.goto('/en/app');
  const create = page.getByRole('button', {name: 'Create MindSpace', exact: true});
  await expect(page.getByLabel('Choose a MindSpace')).toHaveValue('personal');
  await create.click();
  await page.getByRole('button', {name: 'Cancel', exact: true}).click();
  await expect(page.getByLabel('MindSpace name')).toHaveCount(0);
  await create.click();
  await page.getByLabel('MindSpace name').fill(space.name);
  await create.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('could not be created');
  await expect(page.getByLabel('Choose a MindSpace')).toHaveValue('personal');
  options.createStatus = 201;
  await create.click();
  await expect(page.getByLabel('MindSpace name')).toHaveCount(0);
  await expect(page.getByLabel('Choose a MindSpace')).toHaveValue(space.id);
  await expect(page.locator('#mindspace-selector option')).toHaveText(['personal', 'work', space.name]);
  expect(await page.evaluate(() => sessionStorage.getItem('priora.selectedMindSpaceId'))).toBe(space.id);
  expect(calls.filter(({path, method}) => path.endsWith('/mindspaces') && method === 'POST')).toHaveLength(2);
  await page.reload();
  await expect(page.getByLabel('Choose a MindSpace')).toHaveValue(space.id);
  await expect(create).toBeVisible();
});

test('registers, logs in, creates and persists the selected MindSpace, then enters chat', async ({page}) => {
  const calls = await mockApi(page);
  await page.goto('/en/login');
  await page.getByRole('link', {name: 'Create account'}).click();
  await expect(page).toHaveURL(/\/en\/register$/);
  await page.getByLabel('Email', {exact: true}).fill(credentials.email);
  await page.getByLabel('Password', {exact: true}).fill(credentials.password);
  await page.getByRole('button', {name: 'Create account', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Create your first MindSpace'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Chat', exact: true})).toHaveCount(0);
  expect(calls.filter(({method}) => method === 'POST').map(({path, body}) => ({path, body}))).toEqual([
    {path: '/api/v1/auth/register', body: credentials}, {path: '/api/v1/auth/login', body: credentials},
  ]);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('priora.auth')!))).toEqual(auth);
  await page.getByRole('button', {name: 'Create MindSpace', exact: true}).click();
  await expect(page.getByText('Enter a MindSpace name.')).toBeVisible();
  expect(calls.filter(({method, path}) => method === 'POST' && path.endsWith('/mindspaces'))).toHaveLength(0);
  await page.getByLabel('MindSpace name').fill('  My MindSpace  ');
  await page.getByRole('button', {name: 'Create MindSpace', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Chat', exact: true})).toBeVisible();
  expect(calls.find(({path, method}) => path.endsWith('/mindspaces') && method === 'POST')).toMatchObject({body: {name: space.name}, authorization: 'Bearer test-token'});
  expect(await page.evaluate(() => sessionStorage.getItem('priora.selectedMindSpaceId'))).toBe(space.id);
  await page.reload();
  await expect(page.getByLabel('Choose a MindSpace')).toHaveValue(space.id);
});

test('invalid and missing registration input sends no requests', async ({page}) => {
  const calls = await mockApi(page);
  await page.goto('/en/register');
  await page.getByRole('button', {name: 'Create account', exact: true}).click();
  await expect(page.getByText('Enter your email.', {exact: true})).toBeVisible();
  await expect(page.getByText('Enter your password.', {exact: true})).toBeVisible();
  await page.getByLabel('Email', {exact: true}).fill('invalid');
  await page.getByLabel('Password', {exact: true}).fill('1234');
  await page.getByRole('button', {name: 'Create account', exact: true}).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await expect(page.getByText('Use at least 5 characters.')).toBeVisible();
  expect(calls).toHaveLength(0);
});

test('duplicate email shows an error and does not log in', async ({page}) => {
  const calls = await mockApi(page, {registerStatus: 409});
  await register(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('already exists');
  expect(calls).toHaveLength(1);
  expect(await page.evaluate(() => sessionStorage.getItem('priora.auth'))).toBeNull();
});

test('automatic login failure can retry without registering twice', async ({page}) => {
  const options = {loginStatus: 401};
  const calls = await mockApi(page, options);
  await register(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('account was created, but login failed');
  expect(await page.evaluate(() => sessionStorage.getItem('priora.auth'))).toBeNull();
  options.loginStatus = 200;
  await page.getByRole('button', {name: 'Retry login'}).click();
  await expect(page.getByLabel('MindSpace name')).toBeVisible();
  expect(calls.filter(({path}) => path.endsWith('/register'))).toHaveLength(1);
  expect(calls.filter(({path}) => path.endsWith('/login'))).toHaveLength(2);
});

test('MindSpace failure preserves input and permits retry', async ({page}) => {
  const options = {createStatus: 500};
  await mockApi(page, options);
  await register(page);
  await page.getByLabel('MindSpace name').fill(space.name);
  await page.getByRole('button', {name: 'Create MindSpace', exact: true}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('could not be created');
  await expect(page.getByLabel('MindSpace name')).toHaveValue(space.name);
  expect(await page.evaluate(() => sessionStorage.getItem('priora.selectedMindSpaceId'))).toBeNull();
  options.createStatus = 201;
  await page.getByRole('button', {name: 'Create MindSpace', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Chat', exact: true})).toBeVisible();
});

test('network registration failure shows a recoverable error', async ({page}) => {
  await mockApi(page, {network: true});
  await register(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('could not reach the server');
  await expect(page.getByRole('button', {name: 'Create account', exact: true})).toBeEnabled();
});

test('expired authentication during creation returns to login and clears state', async ({page}) => {
  await mockApi(page, {createStatus: 401});
  await register(page);
  await page.getByLabel('MindSpace name').fill(space.name);
  await page.getByRole('button', {name: 'Create MindSpace', exact: true}).click();
  await expect(page).toHaveURL(/\/en\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('priora.auth'))).toBeNull();
});

test('pending registration and creation disable submission and avoid duplicate requests', async ({page}) => {
  const calls = await mockApi(page);
  let releaseRegistration!: () => void;
  const registrationWait = new Promise<void>((resolve) => { releaseRegistration = resolve; });
  await page.route('**/api/v1/auth/register', async (route) => {
    await registrationWait;
    await route.fallback();
  });
  await register(page);
  await expect(page.getByRole('button', {name: 'Please wait...'})).toBeDisabled();
  releaseRegistration();
  await expect(page.getByLabel('MindSpace name')).toBeVisible();
  let releaseCreation!: () => void;
  const creationWait = new Promise<void>((resolve) => { releaseCreation = resolve; });
  await page.route('**/api/v1/mindspaces', async (route) => {
    if (route.request().method() === 'POST') await creationWait;
    await route.fallback();
  });
  await page.getByLabel('MindSpace name').fill(space.name);
  await page.getByRole('button', {name: 'Create MindSpace', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Creating...', exact: true})).toBeDisabled();
  releaseCreation();
  await expect(page.getByRole('heading', {name: 'Chat', exact: true})).toBeVisible();
  expect(calls.filter(({path}) => path.endsWith('/register'))).toHaveLength(1);
  expect(calls.filter(({path, method}) => path.endsWith('/mindspaces') && method === 'POST')).toHaveLength(1);
});

test('Arabic mobile onboarding uses translated labels and RTL layout', async ({page}) => {
  await mockApi(page);
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/ar/register');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByLabel('البريد الإلكتروني', {exact: true}).fill(credentials.email);
  await page.getByLabel('كلمة المرور', {exact: true}).fill(credentials.password);
  await page.getByRole('button', {name: 'إنشاء حساب', exact: true}).click();
  await expect(page.getByLabel('اسم مساحة التفكير')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
