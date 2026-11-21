// Adapted from https://github.com/umutokcelik/candurmaz-portfolio/tree/main/lib/viewer.
import * as THREE from 'three';
import { loadModel } from './loader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyMaterialMappings, collectModelMaterials, disposeObject } from './materials.js';
import { createModelInspection } from './inspection.js';
import { attachViewerLighting } from './lighting.js';
import { messages } from '../i18n.js';

export function createModelViewer(host, asset, { onProgress, onReady, onError, onLightChange }, { preview = false } = {}) {
  let active = true, root = null, materials = [], frame = 0, fitted = false;
  let inspection;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(preview ? 1 : Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = !preview;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', messages.tr.canvasLabel(asset.title, true));
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111722');
  scene.fog = new THREE.Fog('#111722', 22, 45);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
  camera.position.set(6, 4, 7);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 1;
  controls.maxDistance = 25;
  controls.autoRotateSpeed = 1.2;
  controls.listenToKeyEvents(canvas);
  const target = new THREE.Vector3(0, 0.8, 0);
  let radius = 2, fitBounds = null;

  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 80), new THREE.MeshStandardMaterial({ color: '#1c2431', roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.025;
  floor.receiveShadow = true;
  floor.visible = asset.showFloor !== false;
  scene.add(floor);
  const grid = new THREE.GridHelper(22, 44, '#47546b', '#354053');
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  grid.visible = asset.showGrid !== false;
  scene.add(grid);
  scene.add(new THREE.HemisphereLight('#dcecff', '#44404d', 0.8));
  const key = new THREE.DirectionalLight('#fff5e5', 2);
  key.position.set(4, 8, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -6;
  key.shadow.camera.right = key.shadow.camera.top = 6;
  key.shadow.normalBias = 0.025;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#9abfff', 1);
  rim.position.set(-4, 3, -5); scene.add(rim);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.75;
  pmrem.dispose();

  const lighting = attachViewerLighting({
    canvas, camera, controls, light: key,
    getTarget: () => target,
    getRadius: () => radius,
    onChange: onLightChange,
  });

  function modelBounds(object) {
    const excluded = new Set(asset.framing?.excludeMaterials || []);
    const bounds = new THREE.Box3();
    object.updateWorldMatrix(true, true);
    object.traverse((child) => {
      if (!child.geometry?.attributes.position?.count) return;
      if ([].concat(child.material || []).every((material) => excluded.has(material.name))) return;
      bounds.union(new THREE.Box3().setFromObject(child));
    });
    return bounds.isEmpty() ? new THREE.Box3().setFromObject(object) : bounds;
  }

  function fit() {
    const vertical = THREE.MathUtils.degToRad(camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
    const direction = new THREE.Vector3(...(asset.cameraDirection || [1.1, 0.65, 1.3])).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
    const up = direction.clone().cross(right).normalize();
    let distance = radius * 1.2;
    if (fitBounds) {
      for (const x of [fitBounds.min.x, fitBounds.max.x]) for (const y of [fitBounds.min.y, fitBounds.max.y]) for (const z of [fitBounds.min.z, fitBounds.max.z]) {
        const corner = new THREE.Vector3(x, y, z).sub(target);
        const depth = corner.dot(direction);
        distance = Math.max(distance, Math.abs(corner.dot(right)) / Math.tan(horizontal / 2) + depth, Math.abs(corner.dot(up)) / Math.tan(vertical / 2) + depth);
      }
    }
    camera.position.copy(target).add(direction.multiplyScalar(distance * 1.22));
    controls.target.copy(target);
    controls.minDistance = radius * 0.65;
    controls.maxDistance = radius * 12;
    controls.update(); controls.saveState();
  }
  function resize() {
    if (!active) return;
    const { width, height } = host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const previousAspect = camera.aspect;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (fitted && Math.abs(previousAspect - camera.aspect) > 0.4) fit();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host); resize();
  function reportError(key, detail) {
    const message = messages.tr[key];
    onError(typeof message === 'function' ? message(detail) : message, key, detail);
  }
  function contextLost(event) {
    event.preventDefault();
    reportError('modelContextLost');
  }
  canvas.addEventListener('webglcontextlost', contextLost);
  function animate() {
    if (!active) return;
    frame = requestAnimationFrame(animate);
    if (document.hidden) return;
    if (!lighting.dragging) controls.update();
    renderer.render(scene, camera);
  }
  if (!preview) animate();
  const loading = loadModel(asset, (event) => {
    if (active) onProgress?.(event.total ? Math.round(event.loaded / event.total * 100) : null);
  });
  loading.result.then(async (model) => {
    if (!active) { disposeObject(model); return; }
    root = model;
    try {
      await applyMaterialMappings(root, asset.materialOverrides || {}, () => active);
      if (!active) return;
      const bounds = modelBounds(root);
      const size = bounds.getSize(new THREE.Vector3());
      if (bounds.isEmpty() || !Number.isFinite(size.lengthSq())) throw new Error('Model contains no visible geometry');
      const scale = 4 / (Math.max(size.x, size.y, size.z) || 1);
      const pivot = new THREE.Group();
      root.position.sub(bounds.getCenter(new THREE.Vector3()));
      pivot.add(root); pivot.scale.setScalar(scale);
      pivot.position.y = size.y * scale / 2 + 0.015;
      scene.add(pivot);
      const normalized = modelBounds(pivot);
      normalized.getCenter(target);
      fitBounds = normalized;
      radius = Math.max(0.15, normalized.getSize(new THREE.Vector3()).length() / 2);
      let triangles = 0, meshes = 0, uvMeshes = 0, points = 0;
      root.traverse((object) => {
        if (object.isPoints) points += object.geometry.attributes.position.count;
        if (!object.isMesh || !object.geometry.attributes.position) return;
        meshes++; if (object.geometry.attributes.uv) uvMeshes++;
        triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
        object.castShadow = true; object.receiveShadow = true;
      });
      materials = collectModelMaterials(root);
      inspection = createModelInspection(root, scene, renderer, floor, grid, radius);
      fitted = true; resize(); fit();
      lighting.reset({ notify: false });
      const textureCount = new Set(materials.flatMap((material) => Object.values(material).filter((value) => value?.isTexture))).size;
      const usesSceneLighting = materials.some((material) => material.isMeshStandardMaterial || material.isMeshPhongMaterial || material.isMeshLambertMaterial || material.isMeshToonMaterial || material.lights);
      lighting.setEnabled(usesSceneLighting);
      canvas.setAttribute('aria-label', messages.tr.canvasLabel(asset.title, usesSceneLighting));
      onReady({ usesSceneLighting, textureCount, availableModes: inspection.availableModes, triangles: Math.round(triangles), points, meshes, uvMeshes, materials: materials.map((m) => m.name) });
    } catch (error) { if (active) { console.error('Model preparation failed', error); reportError('modelPreparationFailed'); } }
  }).catch((error) => {
    if (active) {
      console.error('Model loading failed', error);
      reportError(error?.messageKey || 'modelLoadFailed', error?.resource);
    }
  });

  return {
    reset: fit,
    resetLighting() { lighting.reset(); },
    setAutoRotate(enabled) { controls.autoRotate = enabled; },
    setViewMode(mode) { return inspection?.setMode(mode) || ''; },
    setCanvasLabel(label) { canvas.setAttribute('aria-label', label); },
    captureThumbnail() {
      if (!active || !fitted || !canvas.width || !canvas.height) return null;
      const thumbnail = document.createElement('canvas');
      thumbnail.width = 256;
      thumbnail.height = 160;
      const context = thumbnail.getContext('2d');
      const scale = Math.min(thumbnail.width / canvas.width, thumbnail.height / canvas.height);
      const width = canvas.width * scale;
      const height = canvas.height * scale;
      const showFloor = floor.visible;
      const showGrid = grid.visible;
      const pointSizes = new Map();
      root.traverse((object) => {
        const material = object.material;
        if (!object.isPoints || !material?.isPointsMaterial || pointSizes.has(material)) return;
        pointSizes.set(material, material.size);
        material.size = Math.max(material.size, 3 / (scale * renderer.getPixelRatio()));
      });
      floor.visible = grid.visible = false;
      try {
        renderer.render(scene, camera);
        context.fillStyle = '#111722';
        context.fillRect(0, 0, thumbnail.width, thumbnail.height);
        context.drawImage(canvas, (thumbnail.width - width) / 2, (thumbnail.height - height) / 2, width, height);
        return thumbnail.toDataURL('image/webp', 0.8);
      } finally {
        floor.visible = showFloor;
        grid.visible = showGrid;
        for (const [material, size] of pointSizes) material.size = size;
      }
    },
    dispose() {
      if (!active) return;
      active = false;
      loading.dispose();
      cancelAnimationFrame(frame); observer.disconnect();
      canvas.removeEventListener('webglcontextlost', contextLost);
      lighting.dispose(); controls.dispose();
      inspection?.dispose();
      disposeObject(scene);
      if (root && !root.parent) disposeObject(root);
      key.shadow.dispose();
      environment.dispose(); renderer.dispose();
      renderer.forceContextLoss(); canvas.remove();
    },
  };
}
