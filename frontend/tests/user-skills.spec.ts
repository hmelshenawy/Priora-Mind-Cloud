import {expect, test, type Page} from '@playwright/test';

const initial = {id: '11111111-1111-4111-8111-111111111111', name: 'Writing', description: 'Clear writing', instructions: 'Use short sentences.\nBe precise.', isEnabled: false};

async function setup(page: Page, options: {empty?: boolean; deleteStub?: boolean; listError?: boolean; unauthorized?: boolean; conflict?: boolean} = {}) {
  const records = options.empty ? [] : [{...initial}];
  const calls: {method: string; path: string; body: any}[] = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('priora.auth', JSON.stringify({accessToken: 'skills-token', user: {id: 'user-1', email: 'skills@example.com'}}));
  });
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    expect(req.headers().authorization).toBe('Bearer skills-token');
    if (url.pathname === '/api/v1/mindspaces') {
      await route.fulfill({json: {count: 1, result: [{id: 'space-1', name: 'Personal'}]}}); return;
    }
    expect(url.pathname).toMatch(/^\/api\/v1\/user-skills(?:\/[^/]+)?$/);
    expect(url.search).toBe('');
    const body = req.postDataJSON();
    calls.push({method, path: url.pathname, body});
    if (options.unauthorized) { await route.fulfill({status: 401, json: {message: 'Unauthorized'}}); return; }
    const id = url.pathname.split('/')[4];
    if (method === 'GET' && !id) {
      if (options.listError) { options.listError = false; await route.fulfill({status: 500, json: {message: 'Failed'}}); return; }
      await route.fulfill({json: {ok: true, data: records.map(({id, name, description}) => ({id, name, description}))}}); return;
    }
    if (method === 'POST') {
      expect(Object.keys(body).sort()).toEqual(['description', 'instructions', 'name']);
      if (options.conflict) { await route.fulfill({status: 409, json: {message: 'Conflict'}}); return; }
      const skill = {...body, id: '22222222-2222-4222-8222-222222222222', isEnabled: true};
      records.push(skill);
      await route.fulfill({status: 201, json: {ok: true, data: skill}}); return;
    }
    const skill = records.find((record) => record.id === id);
    if (!skill) { await route.fulfill({status: 404, json: {message: 'Missing'}}); return; }
    if (method === 'PATCH') Object.assign(skill, body);
    if (method === 'DELETE') {
      if (!options.deleteStub) records.splice(records.indexOf(skill), 1);
      await route.fulfill({contentType: 'text/plain', body: 'This action removes a #NaN userSkill'}); return;
    }
    await route.fulfill({json: {ok: true, data: skill}});
  });
  return calls;
}

test('lists disabled user skills, views multiline instructions, edits and toggles status', async ({page}) => {
  const calls = await setup(page);
  await page.goto('/en/app/skills');
  const card = page.getByRole('listitem').filter({has: page.getByRole('heading', {name: 'Writing'})});
  await expect(card.getByText('Disabled', {exact: true})).toBeVisible();
  await card.getByRole('button', {name: 'View', exact: true}).click();
  await expect(page.getByRole('article')).toContainText(initial.instructions);
  await page.getByRole('article').getByRole('button', {name: 'Edit', exact: true}).click();
  await page.getByLabel('Name', {exact: true}).fill('Better writing');
  await page.getByLabel('Instructions', {exact: true}).fill('First line\nSecond line');
  await page.getByLabel('Enabled', {exact: true}).check();
  await page.getByRole('button', {name: 'Save changes'}).click();
  await expect(page.getByRole('status')).toHaveText('Skill updated.');
  await page.getByRole('button', {name: 'Disable', exact: true}).click();
  await expect(page.getByText('Disabled', {exact: true})).toBeVisible();
  expect(calls.filter(({method}) => method === 'PATCH').map(({body}) => body)).toEqual([
    {name: 'Better writing', description: initial.description, instructions: 'First line\nSecond line', isEnabled: true}, {isEnabled: false},
  ]);
  expect(calls.filter(({method, path}) => method === 'GET' && path === '/api/v1/user-skills')).toHaveLength(3);
});

test('empty state, validation, creation and confirmed deletion refresh the list', async ({page}) => {
  const calls = await setup(page, {empty: true});
  await page.goto('/en/app/skills');
  await expect(page.getByText(/You have no skills yet/)).toBeVisible();
  await page.getByRole('button', {name: 'New skill', exact: true}).click();
  await page.getByLabel('Name', {exact: true}).fill('   ');
  await page.getByLabel('Description', {exact: true}).fill('Description');
  await page.getByLabel('Instructions', {exact: true}).fill('Instructions');
  await page.getByRole('button', {name: 'Create skill', exact: true}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('whitespace');
  expect(calls.some(({method}) => method === 'POST')).toBe(false);
  await page.getByLabel('Name', {exact: true}).fill('Planning');
  await page.getByRole('button', {name: 'Create skill', exact: true}).click();
  await expect(page.getByRole('status')).toHaveText('Skill created.');
  await expect(page.getByText('Enabled', {exact: true})).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', {name: 'Delete', exact: true}).click();
  expect(calls.some(({method}) => method === 'DELETE')).toBe(false);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', {name: 'Delete', exact: true}).click();
  await expect(page.getByRole('status')).toHaveText('Skill deleted.');
  await expect(page.getByText(/You have no skills yet/)).toBeVisible();
});

test('does not report success for the existing backend delete placeholder', async ({page}) => {
  await setup(page, {deleteStub: true});
  await page.goto('/en/app/skills');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', {name: 'Delete', exact: true}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('not deleted by the server');
  await expect(page.getByRole('heading', {name: 'Writing', exact: true})).toBeVisible();
  await expect(page.getByText('Skill deleted.', {exact: true})).toHaveCount(0);
});

test('list errors can be retried', async ({page}) => {
  await setup(page, {listError: true});
  await page.goto('/en/app/skills');
  await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
  await page.getByRole('button', {name: 'Retry'}).click();
  await expect(page.getByRole('heading', {name: 'Writing', exact: true})).toBeVisible();
});

test('conflict preserves the draft', async ({page}) => {
  await setup(page, {conflict: true});
  await page.goto('/en/app/skills');
  await page.getByRole('button', {name: 'New skill', exact: true}).click();
  await page.getByLabel('Name', {exact: true}).fill('Writing');
  await page.getByLabel('Description', {exact: true}).fill('Description');
  await page.getByLabel('Instructions', {exact: true}).fill('Instructions');
  await page.getByRole('button', {name: 'Create skill', exact: true}).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('already exists');
  await expect(page.getByLabel('Instructions', {exact: true})).toHaveValue('Instructions');
});

test('expired authentication redirects to login', async ({page}) => {
  await setup(page, {unauthorized: true});
  await page.goto('/en/app/skills');
  await expect(page).toHaveURL(/\/en\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('priora.auth'))).toBeNull();
});

test('Arabic mobile page and workspace navigation preserve RTL', async ({page}) => {
  await setup(page);
  await page.setViewportSize({width: 390, height: 844});
  await page.goto('/ar/app/skills');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('معطّلة', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'مهارة جديدة', exact: true}).click();
  await expect(page.getByLabel('التعليمات', {exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
