import type { CameraPresetId } from '../scene/cameraPresets';

/** App-wide events between UI and scene layers. */
export interface AppEvents {
  'camera:preset': CameraPresetId;
  'camera:toggleAutoRotate': undefined;
  'camera:autoRotateChanged': boolean;
  'app:toggleFullscreen': undefined;
}
