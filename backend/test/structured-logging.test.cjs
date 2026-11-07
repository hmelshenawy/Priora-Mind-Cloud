// node -r ts-node/register -r tsconfig-paths/register --test test/structured-logging.test.cjs
require('ts-node').register({ experimentalResolver: true });
require('tsconfig-paths').register({ baseUrl: process.cwd(), paths: {} });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { NestFactory } = require('@nestjs/core');
const {
  Module,
  Controller,
  Get,
  Param,
  Res,
  ParseUUIDPipe,
  UseGuards,
  UnauthorizedException,
  Logger,
} = require('@nestjs/common');
const {
  requestLogging,
  SafeExceptionFilter,
  requestContext,
  requestId,
} = require('../src/logging/request-logging.ts');
const { AgentService } = require('../src/agent/agent.service.ts');
const { RagService } = require('../src/documents/rag.service.ts');
const { DocumentProcessor } = require('../src/documents/document.processor.ts');
const { DocumentsService } = require('../src/documents/documents.service.ts');
const {
  ConversationMessagesService,
} = require('../src/conversations/conversation-messages.service.ts');
const SECRET = 'PRIVATE-message-JWT-file-signed-url';

test('real HTTP lifecycle: validation, guards, concurrency, stream failures and disconnect are safe and exactly once', async () => {
  const logs = [];
  const logger = Object.fromEntries(
    ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'].map((level) => [
      level,
      (message) => logs.push({ level, message: String(message) }),
    ]),
  );
  let streamMode = 'success';
  let persisted = 0;
  const messages = new ConversationMessagesService(
    {
      conversation: { findFirst: async () => ({ mindSpaceId: SECRET }) },
      message: {
        findMany: async () => [],
        createMany: async () => {
          if (streamMode === 'persist') throw Error(SECRET);
          persisted++;
        },
      },
    },
    {
      runAgent: async () =>
        new ReadableStream({
          async start(controller) {
            controller.enqueue(new TextEncoder().encode(SECRET));
            await new Promise((resolve) => setTimeout(resolve, 35));
            if (streamMode === 'failure') controller.error(Error(SECRET));
            else controller.close();
          },
        }),
    },
  );
  class Deny {
    canActivate() {
      throw new UnauthorizedException();
    }
  }
  class Synthetic {
    async list() {
      const id = requestId();
      await new Promise((r) => setTimeout(r, 5));
      assert.equal(requestId(), id);
      return { ok: true };
    }
    get(id) {
      return id;
    }
    denied() {
      return 'unreachable';
    }
    error() {
      throw Error(SECRET);
    }
    async stream(res) {
      for await (const chunk of messages.create(
        'id',
        { content: SECRET },
        SECRET,
        SECRET,
      ))
        res.write(chunk);
      res.end();
    }
  }
  Controller()(Synthetic);
  for (const [name, path] of [
    ['list', 'tasks'],
    ['get', 'tasks/:id'],
    ['denied', 'auth/me'],
    ['error', 'notes'],
    ['stream', 'conversations/:id/messages'],
  ])
    Get(path)(
      Synthetic.prototype,
      name,
      Object.getOwnPropertyDescriptor(Synthetic.prototype, name),
    );
  Param('id', new ParseUUIDPipe())(Synthetic.prototype, 'get', 0);
  Res()(Synthetic.prototype, 'stream', 0);
  UseGuards(Deny)(
    Synthetic.prototype,
    'denied',
    Object.getOwnPropertyDescriptor(Synthetic.prototype, 'denied'),
  );
  class App {}
  Module({ controllers: [Synthetic] })(App);
  const app = await NestFactory.create(App, { logger });
  app.use(requestLogging);
  app.useGlobalFilters(new SafeExceptionFilter(app.getHttpAdapter()));
  app.setGlobalPrefix('api/v1');
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  async function call(path, headers = {}) {
    const response = await fetch(base + '/api/v1/' + path, { headers });
    const body = await response.text();
    return { response, body };
  }
  try {
    logs.length = 0;
    const concurrent = await Promise.all(
      ['first', 'second'].map((id) => call('tasks', { 'X-Request-ID': id })),
    );
    assert.deepEqual(
      concurrent.map((x) => x.response.headers.get('x-request-id')),
      ['first', 'second'],
    );
    for (const invalid of ['', '-', 'bad id', 'a'.repeat(65), 'a,b']) {
      const { response } = await call('tasks', { 'X-Request-ID': invalid });
      assert.match(response.headers.get('x-request-id'), /^[a-f0-9-]{36}$/);
    }
    const missing = await call('tasks');
    assert.match(
      missing.response.headers.get('x-request-id'),
      /^[a-f0-9-]{36}$/,
    );
    await new Promise((resolve, reject) => {
      http
        .get(
          base + '/api/v1/tasks',
          { headers: { 'X-Request-ID': ['duplicate', 'duplicate'] } },
          (res) => {
            assert.match(res.headers['x-request-id'], /^[a-f0-9-]{36}$/);
            res.resume();
            res.on('end', resolve);
          },
        )
        .on('error', reject);
    });
    assert.equal((await call('tasks/' + SECRET)).response.status, 400);
    assert.equal((await call('auth/me')).response.status, 401);
    assert.equal((await call('notes')).response.status, 500);
    assert.equal((await call('conversations/id/messages')).body, SECRET);
    assert.equal(persisted, 1);
    streamMode = 'failure';
    await call('conversations/id/messages', { 'X-Request-ID': 'stream-fail' });
    streamMode = 'persist';
    await call('conversations/id/messages', { 'X-Request-ID': 'persist-fail' });
    streamMode = 'success';
    await new Promise((resolve, reject) => {
      http
        .get(
          base + '/api/v1/conversations/id/messages',
          { headers: { 'X-Request-ID': 'disconnect' } },
          (res) => {
            res.once('data', () => {
              res.destroy();
              resolve();
            });
          },
        )
        .on('error', reject);
    });
    await new Promise((resolve) => setTimeout(resolve, 70));
    const terminal = logs.filter((x) =>
      x.message.includes(' request.finished '),
    );
    assert.equal(terminal.length, 16);
    for (const id of [
      'first',
      'second',
      'stream-fail',
      'persist-fail',
      'disconnect',
    ])
      assert.equal(
        terminal.filter((x) => x.message.includes(`request_id=${id} `)).length,
        1,
      );
    assert.ok(
      terminal.some(
        (x) =>
          x.level === 'warn' && x.message.includes('error_code=unauthorized'),
      ),
    );
    assert.ok(
      terminal.some(
        (x) =>
          x.level === 'warn' &&
          x.message.includes('error_code=validation_failed'),
      ),
    );
    for (const id of ['stream-fail', 'persist-fail'])
      assert.ok(
        terminal.some(
          (x) =>
            x.level === 'error' &&
            x.message.includes(`request_id=${id} `) &&
            x.message.includes('http_status=200'),
        ),
      );
    assert.ok(
      terminal.some(
        (x) => x.level === 'debug' && x.message.includes('status=cancelled'),
      ),
    );
    assert.ok(logs.every((x) => !x.message.includes(SECRET)));
    assert.equal(requestContext.getStore(), undefined);
  } finally {
    await app.close();
  }
});

test('Agent HTTP forwarding and queue retries preserve correlation without logging payloads', async () => {
  const logs = [];
  Logger.overrideLogger(
    Object.fromEntries(
      ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'].map((level) => [
        level,
        (msg) => logs.push(String(msg)),
      ]),
    ),
  );
  const seen = [];
  const upstream = http.createServer((req, res) => {
    seen.push(req.headers['x-request-id']);
    req.resume();
    res.end(req.url === '/v1/ingest' ? '{}' : SECRET);
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  const url = `http://127.0.0.1:${upstream.address().port}`;
  const agent = new AgentService({
    getOrThrow: (key) =>
      ({
        AGENT_SERVICE_URL: url,
        AGENT_TIMEOUT_MS: 2000,
        AGENT_SECRET_KEY: SECRET,
      })[key],
  });
  const rag = new RagService({
    getOrThrow: (key) => (key === 'RAG_URL' ? url : SECRET),
  });
  try {
    await Promise.all(
      ['origin-a', 'origin-b'].map((id) =>
        requestContext.run({ requestId: id }, async () => {
          const stream = await agent.runAgent({
            message: SECRET,
            history: [],
            accessToken: SECRET,
          });
          assert.equal(await new Response(stream).text(), SECRET);
        }),
      ),
    );
    let queued;
    const queue = {
      add: async (name, data, opts) => {
        queued = {
          name,
          data,
          opts,
          attemptsMade: 0,
          updateData: async (data) => {
            queued.data = data;
          },
        };
        return { id: SECRET };
      },
    };
    const prisma = {
      document: {
        findFirst: async () => null,
        create: async () => ({ id: SECRET, fileName: SECRET }),
        update: async () => ({}),
      },
      mindSpace: { findFirst: async () => ({}) },
    };
    const documents = new DocumentsService(
      queue,
      { upload: async () => SECRET },
      prisma,
      rag,
    );
    await requestContext.run({ requestId: 'upload-origin' }, () =>
      documents.upload(
        { buffer: Buffer.from('%PDF-'), originalname: SECRET },
        SECRET,
        SECRET,
      ),
    );
    assert.equal(queued.data.request_id, 'upload-origin');
    const worker = new DocumentProcessor(prisma, {
      ingest: async (...args) => {
        await rag.ingest(...args);
        if (queued.attemptsMade === 0) throw Error(SECRET);
      },
    });
    await assert.rejects(worker.process(queued));
    queued.attemptsMade = 1;
    await worker.process(queued);
    assert.deepEqual(seen.slice(0, 2).sort(), ['origin-a', 'origin-b']);
    assert.deepEqual(seen.slice(2), ['upload-origin', 'upload-origin']);
    assert.equal(
      logs.filter((x) => /document.processing.(completed|failed)/.test(x))
        .length,
      2,
    );
    delete queued.data.request_id;
    delete queued.data.job_correlation_id;
    await worker.process(queued);
    const legacyId = queued.data.request_id;
    await worker.process(queued);
    assert.equal(queued.data.request_id, legacyId);
    assert.ok(logs.every((x) => !x.includes(SECRET)));
  } finally {
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
  }
});

test('dependency failures keep safe codes and expected severity', async () => {
  const originalFetch = globalThis.fetch;
  const agent = new AgentService({
    getOrThrow: (key) =>
      key === 'AGENT_TIMEOUT_MS' ? 100 : 'http://synthetic.invalid',
  });
  const rag = new RagService({ getOrThrow: () => 'http://synthetic.invalid' });
  try {
    for (const [status, level] of [
      [429, 'warn'],
      [503, 'error'],
    ]) {
      globalThis.fetch = async () => ({
        ok: false,
        status,
        text: async () => SECRET,
      });
      const state = { requestId: 'dependency' };
      await requestContext.run(state, () =>
        assert.rejects(agent.runAgent({ history: [], message: SECRET })),
      );
      assert.equal(state.failure.level, level);
      assert.equal(state.failure.upstream_http_status, status);
      assert.equal(state.failure.error_code, 'agent_http_failed');
    }
    globalThis.fetch = async () => {
      throw new DOMException(SECRET, 'TimeoutError');
    };
    for (const [call, code] of [
      [() => agent.runAgent({ history: [] }), 'agent_timeout'],
      [() => rag.ingest(SECRET, SECRET, SECRET, SECRET), 'rag_timeout'],
    ]) {
      const state = { requestId: 'timeout' };
      await requestContext.run(state, () => assert.rejects(call()));
      assert.equal(state.failure.level, 'warn');
      assert.equal(state.failure.error_code, code);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('final job failure and status-update failure still have one terminal event', async () => {
  const logs = [];
  Logger.overrideLogger(
    Object.fromEntries(
      ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'].map((level) => [
        level,
        (msg) => logs.push(String(msg)),
      ]),
    ),
  );
  const job = {
    name: 'process-document',
    data: {
      request_id: 'final-attempt',
      job_correlation_id: 'job-correlation',
      documentId: SECRET,
    },
    attemptsMade: 2,
    opts: { attempts: 3 },
  };
  const worker = new DocumentProcessor(
    {
      document: {
        update: async ({ data }) => {
          if (data.status === 'FAILED') throw Error(SECRET);
        },
      },
    },
    {
      ingest: async () => {
        throw Error(SECRET);
      },
    },
  );
  await assert.rejects(worker.process(job));
  const terminal = logs.filter((x) => x.includes('document.processing.failed'));
  assert.equal(terminal.length, 1);
  assert.match(terminal[0], /will_retry=false/);
  assert.match(terminal[0], /stage=rag_ingest/);
  assert.ok(logs.every((x) => !x.includes(SECRET)));
});

test('task and note counts reflect committed writes and deduplication', async () => {
  const { TasksService } = require('../src/tasks/tasks.service.ts');
  const { NotesService } = require('../src/notes/notes.service.ts');
  for (const [Service, model] of [
    [TasksService, 'task'],
    [NotesService, 'note'],
  ]) {
    let duplicate = false;
    const record = { content: SECRET, title: SECRET };
    const service = new Service({
      mindSpace: { findFirst: async () => ({}) },
      [model]: {
        findFirst: async () => (duplicate ? record : null),
        create: async () => record,
        findMany: async () => [record, record],
      },
    });
    const state = { requestId: 'counts' };
    await requestContext.run(state, async () => {
      await service.create(
        { title: SECRET, content: SECRET, mindSpaceId: SECRET },
        SECRET,
      );
      assert.deepEqual(state.counts, { saved_count: 1 });
      duplicate = true;
      await service.create(
        { title: SECRET, content: SECRET, mindSpaceId: SECRET },
        SECRET,
      );
      assert.deepEqual(state.counts, { saved_count: 0 });
      await service.findAll(SECRET, SECRET);
      assert.deepEqual(state.counts, { result_count: 2 });
    });
  }
});
