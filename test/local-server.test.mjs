import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { startLocalServer } from '../lib/local-server.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fmv-test-'));
  t.after(() => rm(root, { force: true, recursive: true }));
  const webRoot = path.join(root, 'site');
  const modelRoot = path.join(root, 'models');
  await mkdir(webRoot);
  await mkdir(path.join(modelRoot, 'textures'), { recursive: true });
  await writeFile(path.join(webRoot, 'index.html'), '<h1>FMV</h1>');
  await writeFile(path.join(modelRoot, 'scene #1.gltf'), JSON.stringify({
    asset: { version: '2.0' },
    images: [{ uri: 'textures/a%20b.png' }],
  }));
  await writeFile(path.join(modelRoot, 'textures', 'a b.png'), 'texture');
  await writeFile(path.join(modelRoot, 'another.glb'), '');
  await writeFile(path.join(root, 'outside.txt'), 'private');
  return { webRoot, modelRoot };
}

test('single-model launch serves its relative resources behind the session token', async (t) => {
  const { webRoot, modelRoot } = await fixture(t);
  const server = await startLocalServer({ webRoot, argument: path.join(modelRoot, 'scene #1.gltf') });
  t.after(() => server.close());
  const token = new URL(server.url).hash.slice(1);
  const api = `${server.origin}/_fmv/${token}`;
  assert.deepEqual(await (await fetch(api + '/selection')).json(), {
    paths: ['scene #1.gltf'], initial: 'scene #1.gltf',
  });
  assert.equal((await fetch(api + '/file/scene%20%231.gltf')).status, 200);
  assert.equal(await (await fetch(api + '/file/textures/a%20b.png')).text(), 'texture');
  assert.equal((await fetch(api + '/file/another.glb')).status, 404);
  assert.equal((await fetch(`${server.origin}/_fmv/${'a'.repeat(48)}/selection`)).status, 404);
});

test('folder launches can run at once and reject foreign hosts and paths outside the folder', async (t) => {
  const { webRoot, modelRoot } = await fixture(t);
  const first = await startLocalServer({ webRoot, argument: modelRoot });
  t.after(() => first.close());
  const second = await startLocalServer({ webRoot });
  t.after(() => second.close());
  assert.notEqual(first.origin, second.origin);
  const api = `${first.origin}/_fmv/${new URL(first.url).hash.slice(1)}`;
  const { paths, initial } = await (await fetch(api + '/selection')).json();
  assert.deepEqual(paths.sort(), ['another.glb', 'scene #1.gltf']);
  assert.equal(initial, null);
  assert.equal((await fetch(api + '/file/..%2Foutside.txt')).status, 404);

  const status = await new Promise((resolve, reject) => {
    http.get(first.origin, { headers: { Host: 'foreign.example' } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(status, 403);
  assert.match(await (await fetch(second.origin)).text(), /FMV/);
});
