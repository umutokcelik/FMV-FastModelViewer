import { open, readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { encodeModelPath, isModelPath, modelExtension } from './model-paths.mjs';

export function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

async function findModels(root, directory = '', found = []) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  for (const entry of entries) {
    const relative = directory + entry.name;
    if (entry.isFile() && isModelPath(relative)) found.push(relative);
    if (entry.isDirectory()) await findModels(root, relative + '/', found);
  }
  return found;
}

async function readGltfJson(file) {
  if (file.toLowerCase().endsWith('.gltf')) return JSON.parse(await readFile(file, 'utf8'));
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(20);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead !== header.length || header.toString('ascii', 0, 4) !== 'glTF' ||
        header.readUInt32LE(4) !== 2 || header.toString('ascii', 16, 20) !== 'JSON') return {};
    const length = header.readUInt32LE(12);
    if (length > (await handle.stat()).size - header.length) return {};
    const chunk = Buffer.alloc(length);
    const read = await handle.read(chunk, 0, length, header.length);
    return read.bytesRead === length ? JSON.parse(chunk.toString('utf8')) : {};
  } finally {
    await handle.close();
  }
}

async function resourcesFor(file, initial) {
  const resources = new Set([initial]);
  if (!['glb', 'gltf'].includes(modelExtension(initial))) return resources;
  const gltf = await readGltfJson(file).catch(() => ({}));
  const base = new URL(encodeModelPath(initial), 'https://fmv.invalid/files/');
  for (const entries of [gltf?.buffers, gltf?.images]) {
    if (!Array.isArray(entries)) continue;
    for (const { uri } of entries.filter(Boolean)) {
      if (typeof uri !== 'string') continue;
      try {
        const url = new URL(uri, base);
        if (url.origin === base.origin && url.pathname.startsWith('/files/')) {
          resources.add(url.pathname.slice('/files/'.length).split('/').map(decodeURIComponent).join('/'));
        }
      } catch {
        // The model loader reports malformed references during preview.
      }
    }
  }
  return resources;
}

export async function inspectSelection(argument) {
  if (!argument) return null;
  const input = path.resolve(argument);
  const canonical = await realpath(input).catch(() => {
    throw new Error(`Dosya veya klasör bulunamadı: ${input}`);
  });
  const info = await stat(canonical);
  if (info.isDirectory()) return { root: canonical, paths: await findModels(canonical), initial: null };
  if (!info.isFile() || !isModelPath(input)) throw new Error('Desteklenen bir model dosyası veya klasör belirt.');

  const initial = path.basename(input);
  return {
    root: path.dirname(canonical),
    paths: [initial],
    initial,
    file: canonical,
    resources: await resourcesFor(canonical, initial),
  };
}
