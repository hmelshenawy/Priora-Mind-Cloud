// Run from frontend: node --test tests/proxy-timeout.node.mjs
// Real Next.js rewrite transport; no Agent calls or database writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {parse} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {proxyRequest} = require('next/dist/server/lib/router-utils/proxy-request');
const loadConfig = require('next/dist/server/config').default;
const {PHASE_DEVELOPMENT_SERVER} = require('next/constants');

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

test('rewrite waits beyond 30 seconds and forwards the upstream response intact', {timeout: 60_000}, async (t) => {
  const config = await loadConfig(PHASE_DEVELOPMENT_SERVER, process.cwd());
  const rewrites = await config.rewrites();
  assert.ok(rewrites.some(({source}) => source === '/api/v1/:path*'));
  const completed = [];
  const received = [];
  const reply = {role: 'assistant', content: 'Delayed test reply'};
  const upstream = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received.push({url: req.url, method: req.method, auth: req.headers.authorization, body: JSON.parse(body)});
    await delay(31_000);
    completed.push(req.url);
    res.writeHead(201, {'Content-Type': 'application/json', 'X-Upstream-Test': 'completed'});
    res.end(JSON.stringify(reply));
  });
  const origin = await listen(upstream);
  const proxy = createServer((req, res) => {
    const timeout = req.url.includes('baseline') ? undefined : config.experimental.proxyTimeout;
    proxyRequest(req, res, parse(`${origin}${req.url}`, true), undefined, undefined, timeout)
      .catch(() => {}); // Next's proxy already sends its 500 on upstream socket errors.
  });
  const proxyOrigin = await listen(proxy);
  t.after(() => {
    proxy.closeAllConnections();
    upstream.closeAllConnections();
    proxy.close();
    upstream.close();
  });
  const start = performance.now();
  async function send(id) {
    const response = await fetch(`${proxyOrigin}/api/v1/conversations/${id}/messages`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer regression-token'},
      body: JSON.stringify({content: 'Timeout regression test'}),
    });
    return {status: response.status, body: await response.text(), headers: response.headers, elapsed: Math.round(performance.now() - start)};
  }
  const [baseline, configured] = await Promise.all([send('baseline'), send('configured')]);
  await delay(1_100); // Observe upstream completion even when both proxy sockets were closed early.
  t.diagnostic(JSON.stringify({baseline: {status: baseline.status, elapsed: baseline.elapsed}, configured: {status: configured.status, elapsed: configured.elapsed}, upstreamCompletions: completed.length}));
  assert.equal(baseline.status, 500);
  assert.equal(baseline.body, 'Internal Server Error');
  assert.equal(completed.length, 2, 'upstream work completes even after the proxy timeout');
  assert.equal(configured.status, 201);
  assert.deepEqual(JSON.parse(configured.body), reply);
  assert.equal(configured.headers.get('x-upstream-test'), 'completed');
  for (const request of received) {
    assert.equal(request.method, 'POST');
    assert.equal(request.auth, 'Bearer regression-token');
    assert.deepEqual(request.body, {content: 'Timeout regression test'});
  }
});
