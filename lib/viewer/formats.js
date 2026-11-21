import { FileLoader, Group, Mesh, MeshStandardMaterial, Points, PointsMaterial } from 'three';

const usd = () => import('three/addons/loaders/USDLoader.js').then(({ USDLoader }) => USDLoader);
const vrml = () => import('three/addons/loaders/VRMLLoader.js').then(({ VRMLLoader }) => VRMLLoader);
const vtk = () => import('three/addons/loaders/VTKLoader.js').then(({ VTKLoader }) => VTKLoader);

const modelLoaders = {
  fbx: () => import('three/addons/loaders/FBXLoader.js').then(({ FBXLoader }) => FBXLoader),
  stl: () => import('three/addons/loaders/STLLoader.js').then(({ STLLoader }) => STLLoader),
  dae: () => import('three/addons/loaders/ColladaLoader.js').then(({ ColladaLoader }) => ColladaLoader),
  '3mf': () => import('three/addons/loaders/3MFLoader.js').then(({ ThreeMFLoader }) => ThreeMFLoader),
  '3ds': () => import('three/addons/loaders/TDSLoader.js').then(({ TDSLoader }) => TDSLoader),
  amf: () => import('three/addons/loaders/AMFLoader.js').then(({ AMFLoader }) => AMFLoader),
  usd, usda: usd, usdc: usd, usdz: usd,
  wrl: vrml, vrml,
  vtk, vtp: vtk,
  pcd: () => import('three/addons/loaders/PCDLoader.js').then(({ PCDLoader }) => PCDLoader),
  xyz: () => import('three/addons/loaders/XYZLoader.js').then(({ XYZLoader }) => XYZLoader),
};

async function loadObj(entry, manager, onProgress) {
  const [{ OBJLoader }, { MTLLoader }, text] = await Promise.all([
    import('three/addons/loaders/OBJLoader.js'),
    import('three/addons/loaders/MTLLoader.js'),
    new FileLoader(manager).loadAsync(entry.href, onProgress),
  ]);
  const names = [...text.matchAll(/^\s*mtllib[ \t]+([^\r\n]+)$/gm)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  const libraries = await Promise.allSettled(names.map((name) => (
    new MTLLoader(manager).loadAsync(new URL(name.replaceAll('\\', '/'), entry).href)
  )));
  const materials = libraries.filter(({ status }) => status === 'fulfilled').map(({ value }) => value);
  const loader = new OBJLoader(manager);
  if (materials.length) {
    loader.setMaterials({
      create(name) {
        return materials.find((library) => Object.hasOwn(library.materialsInfo, name))?.create(name);
      },
    });
  }
  return loader.parse(text);
}

function fromGeometry(geometry, format, pointCloud = false) {
  const vertexColors = geometry.hasAttribute('color');
  if (format === 'xyz' || pointCloud) {
    return new Points(geometry, new PointsMaterial({ vertexColors, size: 2, sizeAttenuation: false }));
  }
  if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
  const material = new MeshStandardMaterial({
    color: vertexColors ? 0xffffff : 0xb5c4d1,
    vertexColors,
    roughness: 0.65,
    transparent: Boolean(geometry.hasColors && geometry.alpha < 1),
    opacity: geometry.hasColors ? geometry.alpha : 1,
  });
  const mesh = new Mesh(geometry, material);
  if (format === 'stl') mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export async function loadOtherFormat(format, entry, manager, onProgress) {
  if (format === 'obj') return loadObj(entry, manager, onProgress);
  if (format === 'ply') {
    const [{ PLYLoader }, buffer] = await Promise.all([
      import('three/addons/loaders/PLYLoader.js'),
      new FileLoader(manager).setResponseType('arraybuffer').loadAsync(entry.href, onProgress),
    ]);
    const header = new TextDecoder().decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 65536))).split('end_header')[0];
    const hasFaces = /^element[ \t]+face[ \t]+0*[1-9][0-9]*\s*$/m.test(header);
    return fromGeometry(new PLYLoader(manager).parse(buffer), format, !hasFaces);
  }
  if (format === 'vox') {
    const { VOXLoader, VOXMesh } = await import('three/addons/loaders/VOXLoader.js');
    const chunks = await new VOXLoader(manager).loadAsync(entry.href, onProgress);
    const group = new Group();
    for (const chunk of chunks) group.add(new VOXMesh(chunk));
    return group;
  }
  const Loader = await modelLoaders[format]();
  const loader = new Loader(manager).setResourcePath(new URL('.', entry).href);
  const model = await loader.loadAsync(entry.href, onProgress);
  if (model.isBufferGeometry) return fromGeometry(model, format);
  return model.scene || model;
}
