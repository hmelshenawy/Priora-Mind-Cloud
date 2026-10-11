import {expect, test, type Page} from '@playwright/test';

const code = 'function build() {\n    const entity = "&#x20;";\n    const pattern = /\\w+/;\n    return "أهلاً";\n}\n';
const markdown = 'خلّينا نشرح **Builder Design Pattern** و*الفكرة* باستخدام `Builder<T>`.\n\n- أول خطوة\n- استخدم API\n\n1. Create builder\n2. ابنِ النتيجة\n\n```ts\n' + code + '```\n\nA&#x20;B &amp; &lt;b&gt;';
type StoredMessage = {id: string; role: string; content: string; conversationId: string; createdAt: string};
const message = (id: string, role: string, content: string): StoredMessage => ({id, role, content, conversationId: 'conversation-1', createdAt: '2026-10-11T00:00:00Z'});

async function setup(page: Page, locale: string, records: StoredMessage[]) {
  await page.setViewportSize({width: 1440, height: 900});
  await page.addInitScript(() => sessionStorage.setItem('priora.auth', JSON.stringify({accessToken: 'test-token', user: {id: 'user-1', email: 'test@example.com'}})));
  await page.route('**/api/v1/**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer test-token');
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/mindspaces')) {
      await route.fulfill({json: {count: 1, result: [{id: 'space-1', name: 'Personal'}]}});
    } else if (path.endsWith('/conversations')) {
      await route.fulfill({json: [{id: 'conversation-1', mindSpaceId: 'space-1', title: 'Markdown test'}]});
    } else if (path.endsWith('/messages')) {
      await route.fulfill({json: records});
    } else throw new Error(`Unexpected request: ${path}`);
  });
  await page.goto(`/${locale}/app/chat`);
  await page.getByRole('button', {name: 'Markdown test', exact: true}).click();
  await expect(page.locator('#message-content')).toBeEnabled();
}

for (const locale of ['en', 'ar']) {
  test(`${locale}: persisted Markdown preserves indentation, entities and intentional escapes without executing HTML`, async ({page}) => {
    const literal = String.raw`\*\*literal bold\*\* and \`literal code\` and C:\Users\name`;
    const unsafe = '<img src="x" onerror="window.markdownXss = true">\n\n<script>window.markdownXss = true</script>\n\n[unsafe](javascript:alert%281%29)\n\n&lt;img src=x onerror=alert(1)&gt;';
    await setup(page, locale, [message('1', 'ASSISTANT', markdown), message('2', 'USER', literal), message('3', 'ASSISTANT', unsafe)]);
    const content = page.locator('.message-content').first();
    await expect(content).toHaveCSS('direction', 'rtl');
    await expect(content.locator('strong')).toHaveText('Builder Design Pattern');
    await expect(content.locator('em')).toHaveText('الفكرة');
    await expect(content.locator('p code')).toHaveText('Builder<T>');
    await expect(content.locator('p code')).toHaveCSS('direction', 'ltr');
    await expect(content.locator('ul > li')).toHaveCount(2);
    await expect(content.locator('ol > li')).toHaveCount(2);
    await expect(content.locator('pre')).toHaveCSS('direction', 'ltr');
    await expect(content.locator('pre')).toHaveCSS('white-space', 'pre');
    expect(await content.locator('pre code').textContent()).toBe(code);
    await expect(content.locator('p').last()).toHaveText('A B & <b>');
    const escaped = page.locator('.message-content').nth(1);
    await expect(escaped).toHaveText('**literal bold** and `literal code` and C:\\Users\\name');
    await expect(escaped.locator('strong, code')).toHaveCount(0);
    await expect(page.locator('.message-content img, .message-content script')).toHaveCount(0);
    await expect(page.locator('.message-content a')).not.toHaveAttribute('href', /^javascript:/i);
    expect(await page.evaluate(() => (window as Window & {markdownXss?: boolean}).markdownXss)).toBeUndefined();
    await expect(page.locator('.message-content').last()).toContainText('<img src=x onerror=alert(1)>');
  });

  test(`${locale}: chunked Markdown and split UTF-8 render during streaming and identically after reload`, async ({page}) => {
    const records: StoredMessage[] = [];
    await setup(page, locale, records);
    // A controllable byte stream exercises TextDecoder and reveal updates before EOF.
    await page.evaluate(() => {
      const originalFetch = window.fetch;
      window.fetch = async (input, init) => {
        if (String(input).startsWith('/api/chat-stream/')) {
          return new Response(new ReadableStream<Uint8Array>({start(controller) {
            (window as Window & {testChatStream?: ReadableStreamDefaultController<Uint8Array>}).testChatStream = controller;
          }}), {headers: {'Content-Type': 'text/plain; charset=utf-8'}});
        }
        return originalFetch(input, init);
      };
    });
    const prompt = 'Explain **Builder** بالعربي';
    await page.locator('#message-content').fill(prompt);
    await page.locator('#message-content').press('Enter');
    await expect(page.locator('.assistant-message .message-content')).toHaveCount(1);
    async function push(text: string) {
      await page.evaluate((chunk) => {
        const controller = (window as Window & {testChatStream?: ReadableStreamDefaultController<Uint8Array>}).testChatStream!;
        // Separate chunks even within multibyte Arabic characters.
        for (const byte of new TextEncoder().encode(chunk)) controller.enqueue(new Uint8Array([byte]));
      }, text);
    }
    const reply = page.locator('.assistant-message .message-content');
    const first = 'خلّينا نشرح **Builder';
    await push(first);
    await expect(reply).toContainText('Builder');
    await expect(reply).toHaveCSS('direction', 'rtl');
    await expect(page.locator('#message-content')).toBeDisabled();
    const second = ' Design Pattern** و*الفكرة* باستخدام `Builder<T>`.\n\n- أول خطوة\n- استخدم API\n\n1. Create builder\n2. ابنِ النتيجة\n\n```ts\n' + code;
    await push(second);
    await expect(reply.locator('strong')).toHaveText('Builder Design Pattern');
    await expect(reply.locator('pre code')).toHaveText(code, {timeout: 15000});
    await expect(reply.locator('pre')).toHaveCSS('direction', 'ltr');
    const final = '```\n\nA&#x20;B &amp; &lt;b&gt;';
    expect(first + second + final).toBe(markdown);
    await push(final);
    await page.evaluate(() => (window as Window & {testChatStream?: ReadableStreamDefaultController<Uint8Array>}).testChatStream!.close());
    await expect(page.locator('#message-content')).toBeEnabled({timeout: 15000});
    expect(await reply.locator('pre code').textContent()).toBe(code);
    await expect(reply.locator('p').last()).toHaveText('A B & <b>');
    const rendered = await reply.innerHTML();
    await expect(page.locator('.user-message .message-content')).toHaveCSS('direction', 'ltr');
    await expect(page.locator('.user-message strong').last()).toHaveText('Builder');
    records.push(message('user-saved', 'USER', prompt), message('assistant-saved', 'ASSISTANT', markdown));
    await page.reload();
    await page.getByRole('button', {name: 'Markdown test', exact: true}).click();
    await expect(reply.locator('strong')).toHaveText('Builder Design Pattern');
    expect(await reply.innerHTML()).toBe(rendered);
    await expect(reply).toHaveCSS('direction', 'rtl');
  });
}
