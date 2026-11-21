import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { encodeModelPath, modelExtension } from '../model-paths.mjs';
import { disposeObject } from './materials.js';
import { loadOtherFormat } from './formats.js';

// A virtual origin preserves glTF relative paths without issuing network requests.
const virtualRoot = new URL('https://fmv.invalid/files/');

export function loadModel(asset, onProgress) {
  const manager = new LoadingManager();
  const entry = new URL(encodeModelPath(asset.path), virtualRoot);
  const format = modelExtension(asset.path);
  const isGltf = format === 'glb' || format === 'gltf';
  const resolvedPaths = new Map();
  let unavailable;
  manager.onError = (url) => { unavailable ??= resolvedPaths.get(url); };
  manager.setURLModifier((uri) => {
    if (/^(data|blob):/i.test(uri)) return uri;

    try {
      const url = new URL(uri, entry);
      if (url.origin === virtualRoot.origin && url.pathname.startsWith(virtualRoot.pathname)) {
        const path = url.pathname.slice(virtualRoot.pathname.length).split('/').map(decodeURIComponent).join('/');
        const local = asset.resolve(path);
        if (local) {
          resolvedPaths.set(local, path);
          return local;
        }
        unavailable ??= path;
      }
    } catch {
      // Invalid URIs are reported alongside missing resources.
    }

    unavailable ??= uri;
    return 'data:application/octet-stream,';
  });

  const missingAsset = () => Object.assign(new Error(unavailable), {
    messageKey: 'modelResourceMissing',
    resource: unavailable,
  });

  const ready = new Promise((resolve) => { manager.onLoad = resolve; });
  // Keep the manager busy across parser imports and files loaded in succession.
  manager.itemStart(entry.href + '#model');
  const parsed = isGltf
    ? new GLTFLoader(manager).setResourcePath(new URL('.', entry).href)
      .setMeshoptDecoder(MeshoptDecoder).loadAsync(entry.href, onProgress).then((gltf) => gltf.scene)
    : loadOtherFormat(format, entry, manager, onProgress);
  const result = parsed.finally(() => manager.itemEnd(entry.href + '#model')).then(async (root) => {
    await ready;
    if (!unavailable || !isGltf) return root;
    disposeObject(root);
    throw missingAsset();
  }, (error) => {
    if (unavailable) throw missingAsset();
    if (/DRACOLoader|KTX2Loader/.test(error?.message)) {
      error.messageKey = 'modelCompression';
    }
    throw error;
  });

  return { result, dispose: () => manager.abort() };
}
