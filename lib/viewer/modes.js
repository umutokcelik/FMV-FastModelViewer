export const viewModeGroups = [
  { id: 'render', label: 'Render', items: [
    { id: 'final', label: 'Final Render' },
    { id: 'raw', label: 'No Post-Processing' },
  ] },
  { id: 'material', label: 'Material channels', items: [
    { id: 'baseColor', label: 'Base Color' },
    { id: 'metalness', label: 'Metalness' },
    { id: 'anisotropy', label: 'Anisotropy' },
    { id: 'roughness', label: 'Roughness' },
    { id: 'emission', label: 'Emission' },
    { id: 'specular', label: 'Specular F0' },
  ] },
  { id: 'geometry', label: 'Geometry', items: [
    { id: 'matcap', label: 'Matcap' },
    { id: 'wireframe', label: 'Wireframe' },
    { id: 'normals', label: 'Vertex Normals' },
  ] },
  { id: 'uv', label: 'UV', items: [
    { id: 'uv', label: 'UV Checker' },
  ] },
];
export const viewModes = viewModeGroups.flatMap((group) => group.items);
