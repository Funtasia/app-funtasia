// src/js/base/appState.js
// Central application state object.
import * as THREE from "three";

export const appState = {
  // Core Three.js objects
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  raycaster: null,
  mouse: null,

  // Feature Managers
  directory: null,
  events: null,
  navigation: null,
  ui: {},
  floors: {},

  // Application State
  currentFloor: null,
  interactiveObjects: [],
  selected: null,
  rotationLocked: true,
  cameraAnim: {
    active: false,
    cameraTarget: new THREE.Vector3(),
    controlsTarget: new THREE.Vector3(),
    lerpFactor: 0.05,
    isSystemAction: false,
    viewDistanceFactor: 1.2,
    viewHeightFactor: 0.8,
  },
  activeMarkers: [],
  activeDirectoryMarker: null,
  activeDirectoryBoothId: null,
  activeDirectoryLevel: null,
  activeDirectoryActualFloor: null,
  lastScannedInfo: null,
  pointerStartTime: 0,
  isBottomSheetOpen: false,
  loadedAssets: new Set(),
  rawData: null
};
