/**
 * Facade class for distributed application state management.
 */
import * as THREE from "three";
import { CONFIG } from "@/js/base/config";
import { SettingsStore } from "@/js/base/settingsStore";
import { AssetManager } from "@/js/base/assetManager";
import { CameraState } from "@/js/base/cameraState";
import { FloorState } from "@/js/floor/floorState";
import { MarkerState } from "@/js/marker/markerState";

export class AppState {
  constructor() {
    // Core Three.js objects (scene graph, renderer, controls, etc.)
    this.scene = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = null;
    this.mouse = null;

    // Feature managers (directory, events, navigation, UI bridge)
    this.directory = null;
    this.events = null;
    this.navigation = null;
    this.ui = {};

    // Delegated state containers
    this.settings = new SettingsStore();
    this.assets = new AssetManager();
    this.camera = new CameraState();
    this.floor = new FloorState();
    this.marker = new MarkerState();

    // Miscellaneous runtime state kept here for now
    this.interactiveObjects = [];
    this.selected = null;
    this.lastScannedInfo = null;
    this.pointerStartTime = 0;
    this.isBottomSheetOpen = false;
    this.rawData = null;

    this.cameraAnim = {
      active: false,
      cameraTarget: new THREE.Vector3(),
      controlsTarget: new THREE.Vector3(),
      lerpFactor: CONFIG.CAMERA.ANIMATION.lerpFactor,
      isSystemAction: false,
      viewDistanceFactor: CONFIG.CAMERA.ANIMATION.viewDistanceFactor,
      viewHeightFactor: CONFIG.CAMERA.ANIMATION.viewHeightFactor,
    };
  }

  // ---------------------------------------------------------------------
  // Settings delegation (rotation lock, autofocus, ghost‑layers)
  // ---------------------------------------------------------------------
  get rotationLocked() { return this.settings.rotationLocked; }
  set rotationLocked(val) {
    this.settings.rotationLocked = val;
    // Keep existing side‑effects on controls
    if (this.controls) {
      this.controls.enableRotate = !val;
      this.controls.touches.TWO = val ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE;
    }
  }

  get autoFocusEnabled() { return this.settings.autoFocusEnabled; }
  set autoFocusEnabled(val) { this.settings.autoFocusEnabled = val; }

  get ghostLayersEnabled() { return this.settings.ghostLayersEnabled; }
  set ghostLayersEnabled(val) {
    this.settings.ghostLayersEnabled = val;
    if (this.ui.updateFloorVisibilities) this.ui.updateFloorVisibilities();
  }

  // ---------------------------------------------------------------------
  // Floor delegation
  // ---------------------------------------------------------------------
  get currentFloor() { return this.floor.currentFloor; }
  set currentFloor(floor) {
    this.floor.currentFloor = floor;
    if (this.ui.updateFloor && floor) {
      this.ui.updateFloor(floor.parentFloorId || floor.id);
    }
  }

  // ---------------------------------------------------------------------
  // Marker delegation
  // ---------------------------------------------------------------------
  get activeMarkers() { return this.marker.activeMarkers; }
  set activeMarkers(v) { this.marker.activeMarkers = v; }

  get activeDirectoryMarker() { return this.marker.activeDirectoryMarker; }
  set activeDirectoryMarker(v) { this.marker.activeDirectoryMarker = v; }

  get activeDirectoryBoothId() { return this.marker.activeDirectoryBoothId; }
  set activeDirectoryBoothId(v) { this.marker.activeDirectoryBoothId = v; }

  get activeDirectoryLevel() { return this.marker.activeDirectoryLevel; }
  set activeDirectoryLevel(v) { this.marker.activeDirectoryLevel = v; }

  get activeDirectoryActualFloor() { return this.marker.activeDirectoryActualFloor; }
  set activeDirectoryActualFloor(v) { this.marker.activeDirectoryActualFloor = v; }

  // ---------------------------------------------------------------------
  // Asset delegation
  // ---------------------------------------------------------------------
  recordAssetLoaded(path) { return this.assets.recordAssetLoaded(path); }
}

export const appState = new AppState();