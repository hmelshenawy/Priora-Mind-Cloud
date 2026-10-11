import {expect, test, type Page} from '@playwright/test';

const samples = [
  {text: 'مرحباً بالعالم', direction: 'rtl'},
  {text: 'Hello world', direction: 'ltr'},
  {text: 'استخدم Next.js مع TypeScript (API v2).', direction: 'rtl'},
  {text: 'Use the API للبحث عن المعلومات.', direction: 'ltr'},
  {text: '**تعليمات**\n- استخدم `fetch(url)`\n- جرّب API\n1. خطوة أولى', direction: 'rtl'},
  {text: '**Instructions**\n- Use `fetch(url)`\n1. First step', direction: 'ltr'},
  {text: 'مثال برمجي:\n```js\nconst text = "مرحباً";\nconsole.log(text);\n```\nانتهى المثال.', direction: 'rtl'},
  {text: 'Example:\n~~~js\nconst text = "مرحباً";\n~~~\nDone.', direction: 'ltr'},
  {text: '```js\nconst value = 1;\n```\nشرح بالعربية بعد الكود.', direction: 'rtl'},
];

async function setup(page: Page, locale: string) {
  await page.setViewportSize({width: 1440, height: 900});
  await page.addInitScript(() => {
    sessionStorage.setItem('priora.auth', JSON.stringify({accessToken: 'test-token', user: {id: 'user-1', email: 'test@example.com'}}));
  });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/mindspaces')) {
      await route.fulfill({json: {count: 1, result: [{id: 'space-1', name: 'Personal'}]}});
    } else if (path.endsWith('/conversations')) {
      await route.fulfill({json: [{id: 'conversation-1', mindSpaceId: 'space-1', title: 'Direction test'}]});
    } else if (path.endsWith('/messages')) {
      await route.fulfill({json: ['USER', 'ASSISTANT'].flatMap((role) => samples.map(({text}, index) => ({
        id: `${role}-${index}`, role, content: text, conversationId: 'conversation-1', createdAt: '2026-10-11T00:00:00Z',
      })))});
    } else {
      throw new Error(`Unexpected request: ${path}`);
    }
  });
  await page.goto(`/${locale}/app`);
  await expect(page).toHaveURL(new RegExp(`/${locale}/app/chat$`));
  await page.getByRole('button', {name: 'Direction test', exact: true}).click();
  await expect(page.locator('.message-list > li')).toHaveCount(samples.length * 2);
}

for (const locale of ['en', 'ar']) {
  test(`${locale}: both roles render Markdown with content direction and unchanged bubble alignment`, async ({page}) => {
    await setup(page, locale);
    for (const role of ['user', 'assistant']) {
      const bubbles = page.locator(`.${role}-message`);
      for (const [index, sample] of samples.entries()) {
        const bubble = bubbles.nth(index);
        const content = bubble.locator('.message-content');
        await expect(content).toHaveAttribute('dir', 'auto');
        await expect(content).toHaveCSS('direction', sample.direction);
        if (index < 4) expect(await content.textContent()).toBe(sample.text);
        if (index === 4 || index === 5) {
          await expect(content.locator('strong')).toHaveText(index === 4 ? 'تعليمات' : 'Instructions');
          await expect(content.locator('code')).toHaveText('fetch(url)');
          await expect(content.locator('ul')).toHaveCSS('list-style-type', 'disc');
          await expect(content.locator('ol')).toHaveCSS('list-style-type', 'decimal');
          await expect(content.locator('strong')).toHaveCSS('display', 'inline');
          await expect(content.locator('li').first()).toHaveCSS('padding', '0px');
        }
        await expect(bubble).toHaveCSS('direction', locale === 'ar' ? 'rtl' : 'ltr');
        await expect(bubble).toHaveCSS('justify-self', role === 'user' ? 'end' : 'start');
        const code = content.locator('pre');
        if (sample.text.includes('```') || sample.text.includes('~~~')) {
          await expect(code).toHaveCSS('direction', 'ltr');
          await expect(code.locator('code')).toHaveCSS('unicode-bidi', 'isolate');
        }
      }
    }
  });

  test(`${locale}: optimistic user and progressively revealed assistant messages detect their own direction`, async ({page}) => {
    await setup(page, locale);
    const answer = 'إليك المثال:\n```js\nconst greeting = "مرحباً";\nconsole.log(greeting);\n```\nاستخدم API للحصول على النتيجة.';
    await page.route('**/api/chat-stream/*', (route) => route.fulfill({contentType: 'text/plain; charset=utf-8', body: answer}));
    await page.locator('#message-content').fill('Explain this API مثال');
    await page.locator('#message-content').press('Enter');
    await expect(page.locator('.user-message .message-content').last()).toHaveCSS('direction', 'ltr');
    const reply = page.locator('.assistant-message .message-content').last();
    await expect(reply).toHaveCSS('direction', 'rtl');
    // Observe the open code fence before the progressive reveal has completed.
    await expect(reply.locator('pre')).toHaveCSS('direction', 'ltr');
    await expect(reply.locator('p').last()).toHaveText('استخدم API للحصول على النتيجة.', {timeout: 15000});
    await expect(reply.locator('pre')).toHaveCSS('direction', 'ltr');
    expect(await reply.locator('pre code').textContent()).toBe('const greeting = "مرحباً";\nconsole.log(greeting);\n');
    await expect(page.locator('#message-content')).toBeEnabled();
  });
}
