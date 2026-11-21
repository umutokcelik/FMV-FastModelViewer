import assert from 'node:assert/strict';
import test from 'node:test';
import { droppedFiles } from '../lib/local-files.js';

function file(name) {
  return { name, isFile: true, file: (resolve) => resolve(new File(['data'], name)) };
}

function directory(name, batches) {
  return {
    name,
    isDirectory: true,
    createReader() {
      let offset = 0;
      return { readEntries: (resolve) => resolve(batches[offset++] || []) };
    },
  };
}

test('a dropped directory preserves nested asset paths across directory-reader batches', async () => {
  const model = file('scene.gltf');
  const texture = file('base color.png');
  const root = directory('Models', [[model], [directory('textures', [[texture]])]]);
  const files = await droppedFiles({
    files: [],
    items: [{ kind: 'file', webkitGetAsEntry: () => root, getAsFile: () => null }],
  });
  assert.deepEqual([...files.keys()], ['Models/scene.gltf', 'Models/textures/base color.png']);
});
