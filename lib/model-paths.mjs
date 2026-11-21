export const modelExtensions = [
  'glb', 'gltf', 'obj', 'fbx', 'stl', 'ply', 'dae', '3mf', '3ds', 'amf',
  'usd', 'usda', 'usdc', 'usdz', 'wrl', 'vrml', 'vox', 'vtk', 'vtp', 'pcd', 'xyz',
];
const supportedExtensions = new Set(modelExtensions);

export function modelExtension(path) {
  return path.split('/').at(-1).match(/\.([^.]+)$/)?.[1].toLowerCase() ?? '';
}

export function isModelPath(path) {
  return supportedExtensions.has(modelExtension(path));
}

export function encodeModelPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}
