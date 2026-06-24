import * as THREE from "three";
import { CONFIG } from "@/js/base/config.js";
import { loadModel } from "@/js/floor/modelLoader.js";
import { parseModel } from "@/js/floor/modelParser.js";

export class Floor {
  // Static class attributes initialized in main.js
  static appState = null;

  // Static dictionary for mapping object names to child model floor IDs
  // Populated dynamically in main.js
  static childModels = {};

  // Static dictionary of all loaded floors
  static floors = {};
  
  // Static reference to the currently active floor instance
  static currentFloor = null;

  // Adds floor object to Floor class attribute: dictionary 'floors'
  static registerFloor(floor) {
    Floor.floors[floor.id] = floor;
  }

  constructor(id, modelPath, infoDataPath = null) {
    this.id = id;
    this.modelPath = modelPath;
    this.infoDataPath = infoDataPath;
    this.parentFloorId = null; // Set dynamically if this is a child model

    this.sceneModel = null;
    this.targetY = 0;
    this.interactiveObjects = [];
    this.textMarkers = [];
    this.boothIDMarkers = [];

    this._isAnimating = false;
    this._targetIndex = -1;
    this._materialCache = null;
    
    // Initialize userData so markers can observe state without importing Floor
    if (this.sceneModel) this.sceneModel.userData.currentOpacity = 1.0;

    // Register self
    Floor.registerFloor(this);

    // Derived during model parsing to fit the specific floor's bounds
    this.cameraConfig = {
      initialPosition: new THREE.Vector3(),
      target: new THREE.Vector3(0, 0, 0),
      minDistance: 0,
      maxDistance: 0,
      near: 0.001,
      far: 2000,
    };
  }

  isLoaded() {
    return this.sceneModel !== null;
  }

  /**
   * Lazily loads this floor's model from jsDelivr and parses it.
   * Safe to call multiple times — resolves immediately if already loaded.
   * @param {import("@/js/base/appState.js").AppState} appState
   * @returns {Promise<void>}
   */
  async load(appState, funtasiaData) {
    if (this.isLoaded()) return;
    if (this._loading) return; // Prevent multiple simultaneous loads

    this._loading = true;

    const gltf = await loadModel(this.modelPath);
    const parsingId = this.parentFloorId || this.id;
    const result = await parseModel(gltf, this.id, appState.scene, funtasiaData, parsingId, Floor.childModels);
    this.attachParsedData(result.model, result.interactiveObjects, result.cameraConfig, result.textMarkers, result.boothIDMarkers);
    
    this._materialCache = result.materialCache;
    this._loading = false;
    window.dispatchEvent(new CustomEvent("floorReady", { detail: { floorId: this.id } }));
  }

  /**
   * Marks this floor as animating and caches the target floor index
   * @param {string} activeFloorId - The ID of the target floor
   */
  startYAnimation(activeFloorId) {
    this._isAnimating = true;
    this._targetIndex = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(activeFloorId);
  }

  unload() {
    if (this._materialCache) {
      this._materialCache.clear();
      this._materialCache = null;
    }
    this.sceneModel = null;
  }

  /**
   * Called to show this floor and apply its specific camera constraints.
   */
  async activate(camera, controls) {
    if (!this.isLoaded()) {
      console.warn(`Attempted to activate unloaded floor: ${this.id}`);
      return;
    }

    this.sceneModel.visible = true;
    
    // Notify TextMarker system of the active level to sync visibility
    const { TextMarker, BoothIDMarker } = await import("@/js/marker/textmarker.js");
    TextMarker.setLevel(this.id);
    BoothIDMarker.setLevel(this.id);

    // Apply specific camera config
    if (this.cameraConfig) {

      const isMainLevelTransition = !this.parentFloorId && Floor.currentFloor && !Floor.currentFloor.parentFloorId;
      const shouldPreserveRotation = Floor.appState.settings.ghostLayersEnabled && isMainLevelTransition && !Floor.appState.settings.rotationLocked;

      if (shouldPreserveRotation) {
        // Calculate current vector from target to camera to preserve orientation and zoom
        const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
        // Update target to the new floor's center
        controls.target.copy(this.cameraConfig.target);
        // Re-apply the offset to the new target
        camera.position.addVectors(controls.target, offset);
      } else {
        // Default: reset to the floor's specific initial position (child models, or if conditions aren't met)
        controls.target.copy(this.cameraConfig.target);
        camera.position.copy(this.cameraConfig.initialPosition);
      }

      controls.minDistance = this.cameraConfig.minDistance;
      controls.maxDistance = this.cameraConfig.maxDistance;
      camera.updateProjectionMatrix();
      controls.update();
    }
    
    controls.enableRotate = !Floor.appState.settings.rotationLocked;
    controls.touches.TWO = Floor.appState.settings.rotationLocked ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE;
  }

  /**
   * Called to hide this floor from view.
   */
  hide() {
    if (this.isLoaded()) {
      this.sceneModel.visible = false;
      this.textMarkers.forEach(tm => { if (tm.group) tm.group.visible = false; });
      this.boothIDMarkers.forEach(bm => { if (bm.group) bm.group.visible = false; });
    }
  }

  /**
   * Populates the internal state after the GLTF model is parsed.
   */
  attachParsedData(model, interactiveObjects, cameraConfig, textMarkers = [], boothIDMarkers = []) {
    this.sceneModel = model;
    this.interactiveObjects = interactiveObjects;
    this.cameraConfig = cameraConfig;
    this.textMarkers = textMarkers;
    this.boothIDMarkers = boothIDMarkers;
  }
}
