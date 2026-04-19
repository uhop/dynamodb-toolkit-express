// Body-handling paths: stream parsing, size cap (413), malformed JSON (400),
// and deference to a pre-parsed `req.body` when a body-parser is installed
// upstream.

import test from 'tape-six';
import express from 'express';

import {createExpressAdapter} from 'dynamodb-toolkit-express';

import {makeMockAdapter} from './helpers/mock-adapter.js';
import {withExpressServer} from './helpers/with-express-server.js';

test('stream body is parsed when req.body is undefined', async t => {
  const adapter = makeMockAdapter();
  await withExpressServer(createExpressAdapter(adapter), async base => {
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({name: 'stream-parsed'})
    });
    t.equal(res.status, 204);
    t.deepEqual(adapter.calls[0].item, {name: 'stream-parsed'});
  });
});

test('oversized body returns 413 before reaching adapter', async t => {
  const adapter = makeMockAdapter();
  const middleware = createExpressAdapter(adapter, {maxBodyBytes: 64});
  await withExpressServer(middleware, async base => {
    const huge = JSON.stringify({blob: 'x'.repeat(2000)});
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: huge
    });
    t.equal(res.status, 413);
    const body = await res.json();
    t.equal(body.code, 'PayloadTooLarge');
    t.equal(adapter.calls.length, 0, 'adapter.post never fired');
  });
});

test('malformed JSON returns 400 BadJsonBody', async t => {
  const adapter = makeMockAdapter();
  await withExpressServer(createExpressAdapter(adapter), async base => {
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: '{not json'
    });
    t.equal(res.status, 400);
    const body = await res.json();
    t.equal(body.code, 'BadJsonBody');
  });
});

test('pre-parsed req.body (via express.json()) is preferred over the stream', async t => {
  const adapter = makeMockAdapter();
  // Install express.json() and then an injector so we have a deterministic
  // pre-parsed body to observe — same shape as wiring koa-bodyparser in koa.
  const injector = (req, _res, next) => {
    req.body = {name: 'from-parser', injected: true};
    next();
  };
  await withExpressServer(
    createExpressAdapter(adapter),
    async base => {
      const res = await fetch(`${base}/`, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({name: 'from-stream'})
      });
      t.equal(res.status, 204);
      t.deepEqual(adapter.calls[0].item, {name: 'from-parser', injected: true}, 'adapter received the pre-parsed body, not the stream content');
    },
    {
      before: app => {
        app.use(express.json());
        app.use(injector);
      }
    }
  );
});

test('empty body on POST passes null through', async t => {
  const adapter = makeMockAdapter();
  await withExpressServer(createExpressAdapter(adapter), async base => {
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: {'content-type': 'application/json'}
      // no body
    });
    t.equal(res.status, 204);
    t.equal(adapter.calls[0].item, null, 'empty body resolves to null');
  });
});

test('custom maxBodyBytes accepts a body at the limit', async t => {
  const adapter = makeMockAdapter();
  // Exact-length string; the JSON parser sees `"aaa...aaa"` which is length+2.
  const payload = JSON.stringify('a'.repeat(50));
  const middleware = createExpressAdapter(adapter, {maxBodyBytes: payload.length});
  await withExpressServer(middleware, async base => {
    const res = await fetch(`${base}/`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: payload
    });
    t.equal(res.status, 204, 'body at exact cap accepted');
  });
});
