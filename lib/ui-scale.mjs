export const uiScaleLimits = { min: 70, max: 130, step: 10, initial: 100 };

export function readUiScale(stored) {
  const value = Number(stored);
  const { min, max, step, initial } = uiScaleLimits;
  return value >= min && value <= max && (value - min) % step === 0 ? value : initial;
}

const zoomKeys = new Set(['+', '=', '-', '−', 'Add', 'Subtract']);
const zoomCodes = new Set(['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract']);

export function isZoomKey(key, code) {
  return zoomKeys.has(key) || zoomCodes.has(code);
}
