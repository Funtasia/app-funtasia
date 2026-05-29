// src/js/base/appState.js
// Central application state object.
import * as THREE from "three";
import { CONFIG } from "@/js/base/config.js";

class AppState {
  constructor() {
    // Core Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = null;
    this.mouse = null;

    // Feature Managers
    this.directory = null;
    this.events = null;
    this.navigation = null;
    this.ui = {};
    this.floors = {};

    // Application State
    this._currentFloor = null;
    this.interactiveObjects = [];
    this.selected = null;
    this._rotationLocked = localStorage.getItem('funtasia-rotation-lock') !== 'false';
    this._autoFocusEnabled = localStorage.getItem('funtasia-autofocus') !== 'false';
    this._ghostLayersEnabled = localStorage.getItem('funtasia-ghost-layers') !== 'false';
    this.isChildFloor = false;

    this.cameraAnim = {
      active: false,
      cameraTarget: new THREE.Vector3(),
      controlsTarget: new THREE.Vector3(),
      lerpFactor: CONFIG.CAMERA.ANIMATION.lerpFactor,
      isSystemAction: false,
      viewDistanceFactor: CONFIG.CAMERA.ANIMATION.viewDistanceFactor,
      viewHeightFactor: CONFIG.CAMERA.ANIMATION.viewHeightFactor,
    };

    this.activeMarkers = [];
    this.activeDirectoryMarker = null;
    this.activeDirectoryBoothId = null;
    this.activeDirectoryLevel = null;
    this.activeDirectoryActualFloor = null;
    this.lastScannedInfo = null;
    this.pointerStartTime = 0;
    this.isBottomSheetOpen = false;

    // Initialize assets from localStorage
    try {
      const preloaded = JSON.parse(localStorage.getItem('funtasia_preloaded_assets') || '[]');
      this.loadedAssets = new Set(preloaded);
    } catch (e) {
      this.loadedAssets = new Set();
    }

    this.rawData = null;
  }

  get rotationLocked() { return this._rotationLocked; }
  set rotationLocked(val) {
    this._rotationLocked = val;
    localStorage.setItem('funtasia-rotation-lock', val);
    if (this.controls) {
      this.controls.enableRotate = !val;
      this.controls.touches.TWO = val ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE;
    }
  }

  get autoFocusEnabled() { return this._autoFocusEnabled; }
  set autoFocusEnabled(val) {
    this._autoFocusEnabled = val;
    localStorage.setItem('funtasia-autofocus', val);
  }

  get ghostLayersEnabled() { return this._ghostLayersEnabled; }
  set ghostLayersEnabled(val) {
    this._ghostLayersEnabled = val;
    localStorage.setItem('funtasia-ghost-layers', val);
    // Trigger UI visibility refresh if the bridge is set
    if (this.ui.updateFloorVisibilities) this.ui.updateFloorVisibilities();
  }

  get currentFloor() {
    return this._currentFloor;
  }

  set currentFloor(floor) {
    console.log(`[State] Floor changing to: ${floor?.id}`);
    this._currentFloor = floor;
    
    // Automatically trigger UI updates if the UI bridge is set
    if (this.ui.updateFloor && floor) {
      this.ui.updateFloor(floor.parentFloorId || floor.id);
    }
  }

  /**
   * Helper to track assets and potentially persist to localStorage
   */
  recordAssetLoaded(path) {
    this.loadedAssets.add(path);
    const loadedArray = Array.from(this.loadedAssets);
    localStorage.setItem('funtasia_preloaded_assets', JSON.stringify(loadedArray));
  }
}

export const appState = new AppState();
