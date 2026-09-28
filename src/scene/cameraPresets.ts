/** Camera preset ids, in shortcut order (keys 1–5). Kept three.js-free for UI use. */
export const CAMERA_PRESETS = [
  'tactical',
  'broadcast',
  'behindHome',
  'behindAway',
  'threeQuarter',
] as const;

export type CameraPresetId = (typeof CAMERA_PRESETS)[number];
