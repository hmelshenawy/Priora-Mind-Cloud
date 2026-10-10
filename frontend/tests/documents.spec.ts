import {expect, test, type Page, type Route} from '@playwright/test';

const spaces = [{id: 'space-1', name: 'Personal'}, {id: 'space-2', name: 'Work'}];
const record = (status: string, id = 'doc-1', mindSpaceId = 'space-1') => ({
  id, mindSpaceId, fileName: `${id}.pdf`, status,
  createdAt: '2026-10-10T00:00:00Z', updatedAt: '2026-10-10T00:00:00Z',
});

async function setup(page: Page, documents: (route: Route) => Promise<void>, locale = 'en') {
  await page.addInitScript(() => {
    sessionStorage.setItem('priora.auth', JSON.stringify({accessToken: 'test-token', user: {id: 'user-1', email: 'test@example.com'}}));
    sessionStorage.setItem('priora.selectedMindSpaceId', 'space-1');
  });
  await page.route('**/api/v1/**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer test-token');
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/mindspaces') return route.fulfill({json: {count: 2, result: spaces}});
    if (path === '/api/v1/documents') return documents(route);
    if (path === '/api/v1/notes') return route.fulfill({json: []});
    throw new Error(`Unexpected endpoint: ${path}`);
  });
  await page.clock.install();
  await page.goto(`/${locale}/app/documents`);
  await expect(page.locator('#documents-title')).toBeVisible();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
}

async function upload(page: Page) {
  await page.locator('#document-file').setInputFiles({name: 'example.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test')});
  await page.getByRole('button', {name: 'Upload document', exact: true}).click();
}

test('upload is accepted immediately, refreshes, polls every 3 seconds and stops for mixed terminal statuses', async ({page}) => {
  let gets = 0;
  let uploaded = false;
  await setup(page, async (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().postData()).toContain('space-1');
      expect(route.request().postData()).toContain('example.pdf');
      uploaded = true;
      return route.fulfill({status: 201, json: {documentId: 'doc-1', jobId: 'doc-1', status: 'PENDING'}});
    }
    gets++;
    const rows = !uploaded ? [] : gets === 2 ? [record('PENDING'), record('READY', 'doc-2')] :
      gets === 3 ? [record('PROCESSING'), record('READY', 'doc-2')] : [record('READY'), record('FAILED', 'doc-2')];
    await route.fulfill({json: rows});
  });
  await expect(page.getByText('No documents in this MindSpace yet.')).toBeVisible();
  await upload(page);
  await expect(page.getByText('Upload accepted.', {exact: false})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Upload document', exact: true})).toBeEnabled();
  await expect(page.getByText('Pending', {exact: true})).toBeVisible();
  expect(gets).toBe(2);
  await page.clock.runFor(2999);
  expect(gets).toBe(2);
  await page.clock.runFor(1);
  await expect(page.getByText('Processing', {exact: true})).toBeVisible();
  expect(gets).toBe(3);
  await page.clock.runFor(3000);
  await expect(page.getByText('Failed', {exact: true})).toBeVisible();
  await expect(page.getByText('Processing failed.', {exact: false})).toBeVisible();
  await page.clock.runFor(12000);
  expect(gets).toBe(4);
});

test('slow list requests do not overlap, and upload during a poll queues one fresh list', async ({page}) => {
  let gets = 0;
  let pending: Route | undefined;
  await setup(page, async (route) => {
    if (route.request().method() === 'POST') return route.fulfill({json: {documentId: 'doc-2', jobId: 'doc-2', status: 'PENDING'}});
    gets++;
    if (gets === 2) { pending = route; return; }
    await route.fulfill({json: gets === 1 ? [record('PROCESSING')] : [record('READY'), record('READY', 'doc-2')]});
  });
  await expect(page.getByText('Processing', {exact: true})).toBeVisible();
  await page.clock.runFor(3000);
  await expect.poll(() => pending).toBeTruthy();
  await page.clock.runFor(12000);
  expect(gets).toBe(2);
  await upload(page);
  await expect(page.getByText('Upload accepted.', {exact: false})).toBeVisible();
  expect(gets).toBe(2);
  await pending!.fulfill({json: [record('READY')]});
  await expect(page.getByText('doc-2.pdf', {exact: true})).toBeVisible();
  expect(gets).toBe(3);
  await page.clock.runFor(9000);
  expect(gets).toBe(3);
});

test('poll failures preserve documents and recover on the next poll', async ({page}) => {
  let gets = 0;
  await setup(page, async (route) => {
    gets++;
    await route.fulfill(gets === 2 ? {status: 503, json: {message: 'Unavailable'}} : {json: [record(gets === 1 ? 'PROCESSING' : 'READY')]});
  });
  await expect(page.getByText('Processing', {exact: true})).toBeVisible();
  await page.clock.runFor(3000);
  await expect(page.locator('.documents').getByRole('alert')).toContainText('could not be refreshed');
  await expect(page.getByText('doc-1.pdf', {exact: true})).toBeVisible();
  await page.clock.runFor(3000);
  await expect(page.getByText('Ready', {exact: true})).toBeVisible();
  await expect(page.locator('.documents').getByRole('alert')).toHaveCount(0);
  await page.clock.runFor(9000);
  expect(gets).toBe(3);
});

test('MindSpace change cancels an in-flight poll and navigation clears the next timer', async ({page}) => {
  let firstGets = 0;
  let secondGets = 0;
  let pending: Route | undefined;
  await setup(page, async (route) => {
    const space = new URL(route.request().url()).searchParams.get('mindSpaceId');
    if (space === 'space-1') {
      firstGets++;
      if (firstGets === 2) { pending = route; return; }
      return route.fulfill({json: [record('PENDING')]});
    }
    secondGets++;
    await route.fulfill({json: [record('PROCESSING', 'work-doc', 'space-2')]});
  });
  await expect(page.getByText('Pending', {exact: true})).toBeVisible();
  await page.clock.runFor(3000);
  await expect.poll(() => pending).toBeTruthy();
  await page.getByRole('combobox').click();
  await page.getByRole('option', {name: 'Work', exact: true}).click();
  await expect(page.getByText('work-doc.pdf', {exact: true})).toBeVisible();
  await pending!.fulfill({json: [record('FAILED')]});
  await expect(page.getByText('doc-1.pdf', {exact: true})).toHaveCount(0);
  await page.clock.runFor(3000);
  await expect.poll(() => secondGets).toBe(2);
  expect(firstGets).toBe(2);
  await page.getByRole('link', {name: 'Notes', exact: true}).click();
  await expect(page).toHaveURL(/\/notes$/);
  await page.clock.runFor(12000);
  expect(firstGets).toBe(2);
  expect(secondGets).toBe(2);
});

test('initial list error can be retried, and empty lists do not poll', async ({page}) => {
  let gets = 0;
  await setup(page, async (route) => {
    gets++;
    await route.fulfill(gets === 1 ? {status: 500, json: {}} : {json: []});
  });
  await expect(page.locator('.documents').getByRole('alert')).toBeVisible();
  await page.getByRole('button', {name: 'Refresh documents'}).click();
  await expect(page.getByText('No documents in this MindSpace yet.')).toBeVisible();
  await page.clock.runFor(9000);
  expect(gets).toBe(2);
});

test('unauthorized polling clears the session and redirects to login', async ({page}) => {
  let gets = 0;
  await setup(page, async (route) => {
    gets++;
    await route.fulfill(gets === 1 ? {json: [record('PENDING')]} : {status: 401, json: {}});
  });
  await expect(page.getByText('Pending', {exact: true})).toBeVisible();
  await page.clock.runFor(3000);
  await expect(page).toHaveURL(/\/en\/login$/);
  expect(await page.evaluate(() => sessionStorage.getItem('priora.auth'))).toBeNull();
  await page.clock.runFor(9000);
  expect(gets).toBe(2);
});

test('upload validation and upload errors leave the form usable', async ({page}) => {
  let posts = 0;
  await setup(page, async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({json: []});
    posts++;
    await route.fulfill({status: 400, json: {message: 'Failed to queue document'}});
  });
  await page.getByRole('button', {name: 'Upload document', exact: true}).click();
  await expect(page.locator('.documents').getByRole('alert')).toContainText('Choose a PDF');
  expect(posts).toBe(0);
  await upload(page);
  await expect(page.locator('.documents').getByRole('alert')).toContainText('could not be uploaded');
  await expect(page.getByRole('button', {name: 'Upload document', exact: true})).toBeEnabled();
  expect(posts).toBe(1);
});

test('Arabic document statuses and processing errors are translated', async ({page}) => {
  await setup(page, (route) => route.fulfill({json: [record('PENDING'), record('FAILED', 'doc-2')]}), 'ar');
  await expect(page.getByText('في الانتظار', {exact: true})).toBeVisible();
  await expect(page.getByText('فشل', {exact: true})).toBeVisible();
  await expect(page.getByText('فشلت المعالجة.', {exact: false})).toBeVisible();
});

test('an accepted upload keeps retrying when its first list refresh fails', async ({page}) => {
  let gets = 0;
  await setup(page, async (route) => {
    if (route.request().method() === 'POST') return route.fulfill({json: {documentId: 'doc-1', jobId: 'doc-1', status: 'PENDING'}});
    gets++;
    await route.fulfill(gets === 2 ? {status: 503, json: {}} : {json: gets === 1 ? [] : [record('READY')]});
  });
  await expect(page.getByText('No documents in this MindSpace yet.')).toBeVisible();
  await upload(page);
  await expect(page.getByText('Upload accepted.', {exact: false})).toBeVisible();
  await expect(page.locator('.documents').getByRole('alert')).toContainText('could not be refreshed');
  await page.clock.runFor(3000);
  await expect(page.getByText('Ready', {exact: true})).toBeVisible();
  await page.clock.runFor(9000);
  expect(gets).toBe(3);
});

test('upload response from a previous MindSpace cannot refresh or overwrite the active list', async ({page}) => {
  let gets = 0;
  let pending: Route | undefined;
  await setup(page, async (route) => {
    if (route.request().method() === 'POST') { pending = route; return; }
    gets++;
    await route.fulfill({json: []});
  });
  await expect(page.getByText('No documents in this MindSpace yet.')).toBeVisible();
  await upload(page);
  await expect.poll(() => pending).toBeTruthy();
  await page.getByRole('combobox').click();
  await page.getByRole('option', {name: 'Work', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Upload document', exact: true})).toBeEnabled();
  await expect.poll(() => gets).toBe(2);
  await pending!.fulfill({json: {documentId: 'doc-1', jobId: 'doc-1', status: 'PENDING'}});
  await page.clock.runFor(9000);
  await expect(page.getByText('Upload accepted.', {exact: false})).toHaveCount(0);
  expect(gets).toBe(2);
});

