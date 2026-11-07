// Run: node -r ts-node/register --test test/rag-correlation.test.cjs
// Node's native loader supports Nest's ESM packages; the existing Jest loader does not.
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');
const { BadRequestException, RequestTimeoutException } = require('@nestjs/common');
const { RagService } = require('../src/documents/rag.service.ts');

const service = new RagService({
  getOrThrow: key => key === 'RAG_URL' ? 'http://rag.invalid' : 'private-key',
});
afterEach(() => mock.restoreAll());

test('forwards the processing ID without changing payload, auth, timeout or result', async () => {
  const result = { status: 'Ingestion done', textLength: 2 };
  const fetch = mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => result }));
  const timeout = mock.method(AbortSignal, 'timeout');
  assert.deepEqual(await service.ingest('private-path', 'private-source', 'private-tenant', 'private-file', 'backend-request'), result);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'http://rag.invalid/v1/ingest');
  assert.equal(options.method, 'POST');
  assert.deepEqual(options.headers, {
    'Content-Type': 'application/json',
    'X-Internal-Service-Key': 'private-key',
    'X-Request-ID': 'backend-request',
  });
  assert.deepEqual(JSON.parse(options.body), {
    storageKey: 'private-path', source_id: 'private-source', mindSpaceId: 'private-tenant', fileName: 'private-file',
  });
  assert.equal(timeout.mock.calls[0].arguments[0], 600000);
});

test('generates distinct IDs for callers without a processing ID', async () => {
  const fetch = mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({}) }));
  await Promise.all([service.ingest('a', 'b', 'c', 'd'), service.ingest('a', 'b', 'c', 'd')]);
  const ids = fetch.mock.calls.map(call => call.arguments[1].headers['X-Request-ID']);
  assert.match(ids[0], /^[a-f0-9-]{36}$/);
  assert.notEqual(ids[0], ids[1]);
});

test('preserves rejection and timeout errors without printing exceptions', async () => {
  mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  const consoleLog = mock.method(console, 'log');
  await assert.rejects(service.ingest('a', 'b', 'c', 'd'), BadRequestException);
  mock.method(globalThis, 'fetch', async () => { throw new DOMException('private-error-content', 'TimeoutError'); });
  await assert.rejects(service.ingest('a', 'b', 'c', 'd'), RequestTimeoutException);
  assert.equal(consoleLog.mock.callCount(), 0);
});
