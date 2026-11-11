// node --test test/hitl.test.cjs
require('ts-node').register({ experimentalResolver: true });
require('tsconfig-paths').register({ baseUrl: process.cwd(), paths: {} });
const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { JwtService } = require('@nestjs/jwt');
const { JwtStrategy } = require('../src/auth/strategies/jwt.strategy.ts');
const { ConversationsController } = require('../src/conversations/conversations.controller.ts');
const { ConversationsService } = require('../src/conversations/conversations.service.ts');
const { ConversationMessagesService } = require('../src/conversations/conversation-messages.service.ts');
const { AgentService } = require('../src/agent/agent.service.ts');

const conversationId = 'd0a279e5-a839-43ff-a032-aed288674e8c';
const executionId = 'a0a279e5-a839-43ff-a032-aed288674e8c';
const mindSpaceId = 'b0a279e5-a839-43ff-a032-aed288674e8c';
const envelope = (type, content) => JSON.stringify({ type, content });
function bytes(source) {
  return new ReadableStream({ start(controller) {
    for (const byte of new TextEncoder().encode(source)) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } });
}

test('authenticated HITL HTTP flow, ownership, validation, persistence and chat compatibility', async (t) => {
  const calls = [], saved = [];
  let source = '', owner = true;
  const prisma = {
    user: { findUnique: async () => ({ id: 'user-1' }) },
    conversation: { findFirst: async ({ where }) => {
      assert.deepEqual(where, { id: conversationId, mindSpace: { userId: 'user-1' } });
      return owner ? { mindSpaceId } : null;
    } },
    message: { findMany: async () => [], createMany: async ({ data }) => saved.push(...data) },
  };
  const agent = { runAgent: async (request) => { calls.push(request); return bytes(source); } };
  const service = new ConversationMessagesService(prisma, agent);
  const secret = 'test-only-hitl-secret';
  const token = new JwtService({ secret }).sign({ sub: 'user-1' });
  const module = await Test.createTestingModule({
    controllers: [ConversationsController],
    providers: [
      { provide: ConversationsService, useValue: {} },
      { provide: ConversationMessagesService, useValue: service },
      { provide: JwtStrategy, useValue: new JwtStrategy({ getOrThrow: () => secret }, prisma) },
    ],
  }).compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const post = (body, path = `${conversationId}/hitl`, auth = token) => fetch(`${base}/api/v1/conversations/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body),
  });
  try {
    await t.test('JWT and DTO validation reject missing auth, bad IDs, invalid decisions and injected identity', async () => {
      const valid = { executionId, decision: 'approve' };
      assert.equal((await post(valid, undefined, '')).status, 401);
      assert.equal((await post(valid, undefined, 'invalid')).status, 401);
      for (const input of [{ decision: 'approve' }, { executionId: 'bad', decision: 'approve' }, { executionId, decision: 'edit' }, { ...valid, userId: 'other' }]) {
        assert.equal((await post(input)).status, 400);
      }
      assert.equal((await post(valid, 'bad/hitl')).status, 400);
      assert.equal(calls.length, 0);
    });
    await t.test('absent or non-owned conversation returns 404 before reaching Agent', async () => {
      owner = false;
      assert.equal((await post({ executionId, decision: 'approve' })).status, 404);
      assert.equal(calls.length, 0);
      owner = true;
    });
    for (const decision of ['approve', 'reject']) await t.test(`${decision}: split UTF-8/NDJSON and final unterminated line persist only assistant text`, async () => {
      saved.length = 0;
      source = envelope('text', 'تم 🚀 ') + '\r\n\n' + envelope('text', 'done');
      const response = await post({ executionId, decision });
      assert.equal(response.status, 201);
      assert.match(response.headers.get('content-type'), /application\/x-ndjson/);
      assert.deepEqual((await response.text()).trim().split('\n').map(JSON.parse), [{ type: 'text', content: 'تم 🚀 ' }, { type: 'text', content: 'done' }]);
      assert.deepEqual(calls.at(-1), { type: 'HITL', executionId, decision, history: [], accessToken: token, mindSpaceId, sourceMessageId: '' });
      assert.deepEqual(saved, [{ conversationId, role: 'ASSISTANT', content: 'تم 🚀 done' }]);
    });
    for (const code of ['HITL_EXPIRED', 'TEMPORARY_FAILURE']) await t.test(`${code}: preserve structured error and do not persist partial text`, async () => {
      saved.length = 0;
      const error = { code, message: 'Approval request has expired. Please try again.' };
      source = envelope('text', 'partial') + '\n' + envelope('error', error) + '\n' + envelope('text', 'must not continue');
      const response = await post({ executionId, decision: 'approve' });
      const events = (await response.text()).trim().split('\n').map(JSON.parse);
      assert.deepEqual(events.at(-1), { type: 'error', content: error });
      assert.equal(events.length, 2);
      assert.equal(saved.length, 0);
    });
    await t.test('normal chat unwraps text, forwards cards and creates an execution UUID', async () => {
      saved.length = 0;
      const hitl = { executionId, actions: [{ name: 'createTask', args: { title: 'Review' } }] };
      source = envelope('text', 'Please review. ') + '\n' + envelope('HITL', hitl) + '\n';
      const response = await post({ content: 'Create task' }, `${conversationId}/messages`);
      assert.equal(await response.text(), 'Please review. ' + envelope('HITL', hitl) + '\n');
      assert.equal(calls.at(-1).type, 'message');
      assert.match(calls.at(-1).executionId, /^[a-f0-9-]{36}$/);
      assert.deepEqual(saved.map(({ role, content }) => ({ role, content })), [{ role: 'USER', content: 'Create task' }, { role: 'ASSISTANT', content: 'Please review. ' }]);
      saved.length = 0;
      source = envelope('HITL', hitl);
      await (await post({ content: 'Create task' }, `${conversationId}/messages`)).text();
      assert.equal(saved.length, 1);
      assert.equal(saved[0].role, 'USER');
      saved.length = 0;
      await (await post({ executionId, decision: 'approve' })).text();
      assert.equal(saved.length, 0);
    });
    await t.test('persistence failure after text emits a failure event rather than a successful EOF', async () => {
      source = envelope('text', 'done') + '\n';
      const persist = prisma.message.createMany;
      prisma.message.createMany = async () => { throw new Error('private database error'); };
      try {
        const response = await post({ executionId, decision: 'approve' });
        const body = await response.text();
        assert.equal(JSON.parse(body.trim().split('\n').at(-1)).content.code, 'HITL_RESUME_FAILED');
        assert.ok(!body.includes('private database error'));
      } finally { prisma.message.createMany = persist; }
    });
    await t.test('malformed and interrupted resumes fail without persisting', async () => {
      saved.length = 0;
      source = envelope('text', 'partial') + '\n{"type":';
      const response = await post({ executionId, decision: 'approve' });
      const events = (await response.text()).trim().split('\n').map(JSON.parse);
      assert.equal(events.at(-1).content.code, 'HITL_RESUME_FAILED');
      await assert.rejects(async () => { for await (const chunk of service.resume(conversationId, { executionId, decision: 'approve' }, 'user-1', `Bearer ${token}`)) {} });
      agent.runAgent = async () => new ReadableStream({ start(controller) { controller.error(new Error('connection lost')); } });
      await assert.rejects(async () => { for await (const chunk of service.resume(conversationId, { executionId, decision: 'approve' }, 'user-1', `Bearer ${token}`)) {} });
      assert.equal(saved.length, 0);
    });
  } finally { await app.close(); }
});

test('AgentService forwards HITL to the configured /chat with internal auth and the same execution ID', async () => {
  const service = new AgentService({ getOrThrow: (key) => ({ AGENT_SERVICE_URL: 'http://agent.invalid/chat', AGENT_TIMEOUT_MS: '1000', AGENT_SECRET_KEY: 'internal-test-key' })[key] });
  const stub = mock.method(globalThis, 'fetch', async () => new Response(bytes(envelope('text', 'done'))));
  try {
    const stream = await service.runAgent({ type: 'HITL', executionId, decision: 'reject', history: [], accessToken: 'user-token', mindSpaceId, sourceMessageId: '' });
    await stream.cancel();
    const [url, options] = stub.mock.calls[0].arguments;
    assert.equal(url, 'http://agent.invalid/chat');
    assert.equal(options.headers['X-Internal-Service-Key'], 'internal-test-key');
    assert.deepEqual(JSON.parse(options.body), { type: 'HITL', executionId, decision: 'reject', history: [], accessToken: 'user-token', mindSpaceId, sourceMessageId: '' });
  } finally { stub.mock.restore(); }
});
