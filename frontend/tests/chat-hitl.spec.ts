import { expect, test, type Page } from '@playwright/test';
import { createChatStreamReader } from '../lib/chat-stream';
import { ConversationApiError, type HitlApproval } from '../lib/api/conversations';

const approval: HitlApproval = {
  executionId: 'd0a279e5-a839-43ff-a032-aed288674e8c',
  actions: [{ name: 'createTask', args: { title: 'Review HITL', description: 'مراجعة {tests} "today"', executor: 'USER' }, description: 'Tool execution requires approval' }],
};
const event = JSON.stringify({ type: 'HITL', content: approval });

test('stream separates fragmented HITL payloads from text and retains the complete execution data', () => {
  for (let split = 0; split <= event.length; split++) {
    let text = '';
    const approvals: HitlApproval[] = [];
    const reader = createChatStreamReader((chunk) => { text += chunk; }, (value) => approvals.push(value));
    reader.push('Before. ' + event.slice(0, split));
    reader.push(event.slice(split) + '\nAfter.');
    reader.finish();
    expect(text).toBe('Before. After.');
    expect(approvals).toEqual([approval]);
  }
});

test('ordinary JSON, code braces, invalid payloads and incomplete candidates remain text', () => {
  const source = 'Code: { return true; } {"other":42}\n{"type":"HITL","content":null}\n{"type":';
  let text = '';
  const approvals: HitlApproval[] = [];
  const reader = createChatStreamReader((chunk) => { text += chunk; }, (value) => approvals.push(value));
  for (const character of source) reader.push(character);
  reader.finish();
  expect(text).toBe(source);
  expect(approvals).toEqual([]);
});

for (const locale of ['en', 'ar']) {
  test(`${locale}: pending card appears during a split-byte stream with disabled decisions and no raw JSON`, async ({page}) => {
    await page.setViewportSize({width: 1440, height: 900});
    await page.addInitScript(() => sessionStorage.setItem('priora.auth', JSON.stringify({accessToken: 'test-token', user: {id: 'user-1', email: 'test@example.com'}})));
    await page.route('**/api/v1/**', async (route) => {
      expect(route.request().method()).toBe('GET');
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/mindspaces')) await route.fulfill({json: {count: 1, result: [{id: 'space-1', name: 'Personal'}]}});
      else if (path.endsWith('/conversations')) await route.fulfill({json: [{id: 'conversation-1', mindSpaceId: 'space-1', title: 'HITL test'}]});
      else if (path.endsWith('/messages')) await route.fulfill({json: []});
      else throw new Error(`Unexpected request: ${path}`);
    });
    await page.goto(`/${locale}/app/chat`);
    await page.getByRole('button', {name: 'HITL test', exact: true}).click();
    await expect(page.locator('#message-content')).toBeEnabled();
    await page.evaluate(() => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        if (String(input).startsWith('/api/chat-stream/')) {
          return new Response(new ReadableStream<Uint8Array>({start(controller) {
            (window as Window & {hitlStream?: ReadableStreamDefaultController<Uint8Array>}).hitlStream = controller;
          }}));
        }
        return originalFetch(input, init);
      };
    });
    await page.locator('#message-content').fill('Create a task');
    await page.locator('#message-content').press('Enter');
    const reply = page.locator('.assistant-message');
    await expect(reply).toHaveCount(1);
    async function push(text: string, close = false) {
      await page.evaluate(({text, close}) => {
        const stream = (window as Window & {hitlStream?: ReadableStreamDefaultController<Uint8Array>}).hitlStream!;
        for (const byte of new TextEncoder().encode(text)) stream.enqueue(new Uint8Array([byte]));
        if (close) stream.close();
      }, {text, close});
    }
    await push('Preparing. ');
    await expect(reply).toContainText('Preparing.');
    await push(event.slice(0, 55));
    await expect(reply).not.toContainText('executionId');
    await push(event.slice(55) + '\n');
    const card = reply.getByRole('region', {name: locale === 'ar' ? 'بانتظار الموافقة' : 'Pending approval'});
    await expect(card).toBeVisible();
    await expect(card).toContainText('createTask');
    await expect(card).toContainText('Review HITL');
    await expect(card).toContainText(approval.actions[0].args.description as string);
    await expect(card.getByRole('button', {name: locale === 'ar' ? 'موافقة' : 'Approve', exact: true})).toBeDisabled();
    await expect(card.getByRole('button', {name: locale === 'ar' ? 'رفض' : 'Reject', exact: true})).toBeDisabled();
    await expect(reply).not.toContainText('executionId');
    await push('Following text.', true);
    await expect(reply).toContainText('Following text.');
    await expect(page.locator('#message-content')).toBeEnabled();
    await expect(card.getByRole('button').first()).toBeEnabled();
    await expect(card.getByRole('button').last()).toBeEnabled();
    await page.setViewportSize({width: 390, height: 844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

async function openPendingCard(page: Page, locale = 'en') {
  await page.setViewportSize({width: 1440, height: 900});
  await page.addInitScript(() => sessionStorage.setItem('priora.auth', JSON.stringify({accessToken: 'test-token', user: {id: 'user-1', email: 'test@example.com'}})));
  await page.route('**/api/v1/**', async (route) => {
    expect(route.request().method()).toBe('GET');
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/mindspaces')) await route.fulfill({json: {count: 1, result: [{id: 'space-1', name: 'Personal'}]}});
    else if (path.endsWith('/conversations')) await route.fulfill({json: [{id: 'conversation-1', mindSpaceId: 'space-1', title: 'HITL test'}]});
    else if (path.endsWith('/messages')) await route.fulfill({json: [{id: 'history-1', conversationId: 'conversation-1', role: 'ASSISTANT', content: 'Existing history', createdAt: '2026-11-10T00:00:00Z'}]});
    else throw new Error(`Unexpected request: ${path}`);
  });
  await page.route('**/api/chat-stream/conversation-1', (route) => route.fulfill({body: event + '\n', contentType: 'text/plain'}));
  await page.goto(`/${locale}/app/chat`);
  await page.getByRole('button', {name: 'HITL test', exact: true}).click();
  await expect(page.locator('#message-content')).toBeEnabled();
  await page.locator('#message-content').fill('Create a task');
  await page.locator('#message-content').press('Enter');
  const card = page.getByRole('region', {name: locale === 'ar' ? 'بانتظار الموافقة' : 'Pending approval'});
  await expect(card.getByRole('button').first()).toBeEnabled();
  return card;
}

for (const decision of ['approve', 'reject'] as const) {
  for (const locale of ['en', 'ar']) {
    test(`${locale}: ${decision} streams fragmented NDJSON and blocks duplicate decisions until completion`, async ({page}) => {
      const card = await openPendingCard(page, locale);
      await page.locator('#message-content').fill('Keep my draft');
      await page.evaluate(() => {
        const originalFetch = window.fetch;
        const state = window as Window & {resumeCalls?: {url: string; method?: string; authorization: string | null; body: unknown}[]; resumeStream?: ReadableStreamDefaultController<Uint8Array>};
        state.resumeCalls = [];
        window.fetch = async (input, init) => {
          if (String(input).endsWith('/hitl')) {
            state.resumeCalls!.push({url: String(input), method: init?.method, authorization: new Headers(init?.headers).get('Authorization'), body: JSON.parse(String(init?.body))});
            return new Response(new ReadableStream<Uint8Array>({start(controller) { state.resumeStream = controller; }}));
          }
          return originalFetch(input, init);
        };
      });
      // Trigger multiple clicks synchronously, before React can render disabled buttons.
      await card.getByRole('button').nth(decision === 'approve' ? 0 : 1).evaluate((button: HTMLButtonElement) => {
        button.click(); button.click();
        (button.parentElement!.querySelector('button') as HTMLButtonElement).click();
      });
      await expect(card.getByRole('button').first()).toBeDisabled();
      await expect(card.getByRole('button').last()).toBeDisabled();
      await expect(card.getByRole('status')).toHaveText(locale === 'ar' ? 'جارٍ إرسال القرار...' : 'Submitting decision...');
      async function push(text: string, close = false) {
        await page.evaluate(({text, close}) => {
          const stream = (window as Window & {resumeStream?: ReadableStreamDefaultController<Uint8Array>}).resumeStream!;
          for (const byte of new TextEncoder().encode(text)) stream.enqueue(new Uint8Array([byte]));
          if (close) stream.close();
        }, {text, close});
      }
      const reply = page.locator('.assistant-message').last().locator('.message-content');
      const first = JSON.stringify({type: 'text', content: 'تم 🚀 '});
      await push(first.slice(0, 12));
      await expect(reply).toBeEmpty();
      await push(first.slice(12) + '\r\n\n');
      await expect(reply).toContainText('تم 🚀');
      await expect(card.getByRole('status')).toHaveText(locale === 'ar' ? 'جارٍ إرسال القرار...' : 'Submitting decision...');
      // Multiple records in one chunk, including a final record without a newline.
      await push('{"type":"text","content":"Task "}\n{"type":"text","content":"finished."}', true);
      await expect(reply).toHaveText('تم 🚀 Task finished.');
      await expect(card.getByRole('status')).toHaveText(locale === 'ar'
        ? decision === 'approve' ? 'تمت الموافقة' : 'تم الرفض'
        : decision === 'approve' ? 'Approved' : 'Rejected');
      await expect(card.getByRole('button').first()).toBeDisabled();
      await expect(card.getByRole('button').last()).toBeDisabled();
      await expect(page.locator('#message-content')).toBeEnabled();
      await expect(page.locator('#message-content')).toHaveValue('Keep my draft');
      await expect(page.locator('.user-message')).toHaveCount(1);
      await expect(page.locator('.assistant-message').first()).toContainText('Existing history');
      expect(await page.evaluate(() => (window as Window & {resumeCalls?: unknown[]}).resumeCalls)).toEqual([
        {url: '/api/v1/conversations/conversation-1/hitl', method: 'POST', authorization: 'Bearer test-token', body: {executionId: approval.executionId, decision}},
      ]);
    });
  }
}

for (const failure of ['http', 'malformed', 'error-event', 'temporary-error', 'network'] as const) {
  test(`failed resume (${failure}) keeps approval pending and allows retry`, async ({page}) => {
    const card = await openPendingCard(page);
    let calls = 0;
    await page.route('**/api/v1/conversations/conversation-1/hitl', async (route) => {
      calls++;
      expect(route.request().method()).toBe('POST');
      expect(route.request().headers().authorization).toBe('Bearer test-token');
      expect(route.request().postDataJSON()).toEqual({executionId: approval.executionId, decision: 'approve'});
      if (calls > 1) return route.fulfill({contentType: 'application/x-ndjson', body: '{"type":"text","content":"Success on retry."}\n'});
      if (failure === 'network') return route.abort('failed');
      if (failure === 'http') return route.fulfill({status: 500});
      return route.fulfill({contentType: 'application/x-ndjson', body: '{"type":"text","content":"Partial response"}\n'
        + (failure === 'malformed' ? '{"type":' : failure === 'temporary-error'
          ? '{"type":"error","content":{"code":"AGENT_UNAVAILABLE","message":"Try later"}}\n'
          : '{"type":"error","content":"Failed"}\n')});
    });
    await card.getByRole('button', {name: 'Approve', exact: true}).click();
    await expect(card.getByRole('alert')).toContainText('Please try again');
    await expect(card.getByRole('status')).toHaveText('Pending approval');
    await expect(card.getByRole('button').first()).toBeEnabled();
    await expect(card.getByRole('button').last()).toBeEnabled();
    await expect(page.locator('.assistant-message')).toHaveCount(2);
    await expect(page.locator('.message-list')).not.toContainText('Partial response');
    await card.getByRole('button', {name: 'Approve', exact: true}).click();
    await expect(card.getByRole('status')).toHaveText('Approved');
    await expect(card.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.assistant-message').last()).toContainText('Success on retry.');
    expect(calls).toBe(2);
  });
}

test('fragmented expiration events preserve their code and server message, including at EOF', () => {
  const message = 'Approval expired — انتهت الصلاحية.';
  const source = JSON.stringify({type: 'error', content: {code: 'HITL_EXPIRED', message}});
  for (const ending of ['\n', '']) {
    const reader = createChatStreamReader(() => { throw new Error('Raw JSON reached text'); }, () => {}, 'ndjson');
    let caught: unknown;
    try {
      for (const character of source + ending) reader.push(character);
      reader.finish();
    } catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(ConversationApiError);
    expect(caught).toMatchObject({code: 'hitlExpired', message});
  }
});

for (const locale of ['en', 'ar']) {
  test(`${locale}: expired execution shows the server message and cannot be submitted again`, async ({page}) => {
    const card = await openPendingCard(page, locale);
    const message = 'Approval request has expired. Please try again.';
    let calls = 0;
    await page.route('**/api/v1/conversations/conversation-1/hitl', async (route) => {
      calls++;
      expect(route.request().postDataJSON()).toEqual({executionId: approval.executionId, decision: locale === 'en' ? 'approve' : 'reject'});
      await route.fulfill({contentType: 'application/x-ndjson', body:
        '{"type":"text","content":"Partial response"}\n'
        + JSON.stringify({type: 'error', content: {code: 'HITL_EXPIRED', message}}) + '\n'});
    });
    await card.getByRole('button').nth(locale === 'en' ? 0 : 1).click();
    await expect(card.getByRole('status')).toHaveText(locale === 'en' ? 'Expired' : 'انتهت صلاحية الطلب');
    await expect(card.getByRole('alert')).toHaveText(message);
    await expect(card.getByRole('button').first()).toBeDisabled();
    await expect(card.getByRole('button').last()).toBeDisabled();
    await expect(page.locator('.assistant-message')).toHaveCount(2);
    await expect(page.locator('.message-list')).not.toContainText('Partial response');
    await expect(page.locator('.message-list')).not.toContainText('HITL_EXPIRED');
    await expect(page.locator('#message-content')).toBeEnabled();
    // An independent execution remains actionable; later chat activity cannot revive the expired one.
    const next = {...approval, executionId: 'a0a279e5-a839-43ff-a032-aed288674e8c'};
    await page.route('**/api/chat-stream/conversation-1', (route) => route.fulfill({body:
      'New request. ' + JSON.stringify({type: 'HITL', content: next}) + '\n', contentType: 'text/plain'}));
    await page.locator('#message-content').fill('New request');
    await page.locator('#message-content').press('Enter');
    await expect(page.locator('#message-content')).toBeEnabled();
    const cards = page.getByRole('region', {name: locale === 'en' ? 'Pending approval' : 'بانتظار الموافقة'});
    await expect(cards).toHaveCount(2);
    await expect(cards.first().getByRole('button').first()).toBeDisabled();
    await expect(cards.first().getByRole('button').last()).toBeDisabled();
    await expect(cards.last().getByRole('button').first()).toBeEnabled();
    await expect(cards.last().getByRole('button').last()).toBeEnabled();
    await cards.first().getByRole('button').evaluateAll((buttons) => buttons.forEach((button) => (button as HTMLButtonElement).click()));
    expect(calls).toBe(1);
  });
}
