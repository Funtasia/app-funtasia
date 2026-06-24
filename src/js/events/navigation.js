import * as THREE from "three";
import { CONFIG } from "@/js/base/config.js";
import { DirectoryMarker } from '@/js/marker/directorymarker.js';
import { focusOnObject, focusAt as focusAtUtil } from "@/js/ui_ux/cameraUtils.js";
import { Icon } from "@/js/marker/icon.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { TextMarker, BoothIDMarker } from "@/js/marker/textmarker.js";
import { setFloorOpacity } from "@/js/helper/util.js";
import { updateExitButtonVisibility } from "@/js/ui_ux/ui.js";
import { MaterialUpdater } from "@/js/helper/materialUtils.js";
import { setupEventListeners } from "@/js/events/event.js";

export class Navigation {
  static appState = null;

  static init(appState) {
    Navigation.appState = appState;
    appState.ui.updateFloorVisibilities = () => {
        if (appState.currentFloor) {
            Navigation.applyGhostLayers(appState.currentFloor.id);
        }
    };
  }

  // ── Marker Helpers ────────────────────────────────────────────────────────

  static clearActiveMarkers() {
      const { appState } = Navigation;
      if (!appState.activeMarkers?.length) return;
      appState.activeMarkers.forEach(m => {
        if (m !== appState.activeDirectoryMarker) {
            m.clear();
        }
      });
      appState.activeMarkers = appState.activeMarkers.filter(m => m === appState.activeDirectoryMarker);
  }

  static restoreLastMarker(floorId) {
    const { appState } = Navigation;
    const info = appState.lastScannedInfo;
    if (!info || info.floorId !== floorId) return;
    const elapsed = performance.now() - info.startTime;
    if (elapsed < CONFIG.NAVIGATION.MARKER_GREY_DELAY) {
        const marker = new QRMarker(info.pos, floorId, CONFIG.NAVIGATION.MARKER_GREY_DELAY);
        marker.startTime = info.startTime;
        appState.activeMarkers.push(marker);
    }
  }

  static _updateDirectoryMarkerVisibility(floorId) {
    const { appState } = Navigation;
    if (!appState.activeDirectoryMarker) return;
    const isMatch = appState.activeDirectoryMarker.level === floorId;
    if (appState.activeDirectoryMarker.group) appState.activeDirectoryMarker.group.visible = isMatch;
    if (isMatch && !appState.activeMarkers.includes(appState.activeDirectoryMarker)) {
        appState.activeMarkers.push(appState.activeDirectoryMarker);
    }
    appState.ui.setClearDirectoryMarkerVisible?.(isMatch);
  }

  // ── Camera Delegates ──────────────────────────────────────────────────────

  static focusAt(pos, options = {}) {
    focusAtUtil(Navigation.appState, pos, options);
  }

  static focusOnObject(target) {
    focusOnObject(target, Navigation.appState);
  }

  // ── Ghost Layer Helpers ───────────────────────────────────────────────────

  /**
   * Sets visibility, opacity, and Y-animation target for a floor model atomically.
   */
  static _applyFloorState(floor, visible, opacity, targetY, activeFloorId) {
      if (!floor.sceneModel) return;
      floor.sceneModel.visible = visible;
      floor.targetY = targetY;
      floor.currentOpacity = opacity;
      setFloorOpacity(floor.sceneModel, opacity);
      if (Math.abs(targetY - floor.sceneModel.position.y) > 0.01) floor.startYAnimation?.(activeFloorId);
  }

  static applyGhostLayers(activeFloorId) {
      const { appState }  = Navigation;
      const activeFloor   = appState.floor.floors[activeFloorId];
      const refFloorId    = activeFloor?.parentFloorId ?? activeFloorId;
      const isViewingChild = !!activeFloor?.parentFloorId;
      const targetIdx     = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(refFloorId);

      CONFIG.NAVIGATION.FLOOR_ORDER.forEach((id, index) => {
          const floor = appState.floor.floors[id];
          if (!floor) return;

          if (id === refFloorId) {
              floor.sceneModel && (floor.sceneModel.renderOrder = 10);
              Navigation._applyFloorState(floor, !isViewingChild, 1.0, 0, activeFloorId);

          } else if (!isViewingChild && index < targetIdx && appState.settings.ghostLayersEnabled) {
              if (!floor.isLoaded()) {
                  if (!floor._loading) {
                      floor.load(appState, appState.rawData).then(() => {
                          if (floor.sceneModel) floor.sceneModel.position.y = 1;
                          Navigation.applyGhostLayers(activeFloorId);
                      });
                  }
              } else {
                  const depth   = targetIdx - index;
                  const opacity = Math.max(0.02, 0.3 * Math.pow(0.4, depth - 1));
                  floor.sceneModel && (floor.sceneModel.renderOrder = index);
                  Navigation._applyFloorState(floor, true, opacity, -depth * CONFIG.NAVIGATION.GHOST_SPACING, activeFloorId);
              }

          } else {
              Navigation._applyFloorState(floor, !isViewingChild, 0, (index - targetIdx) * CONFIG.NAVIGATION.GHOST_SPACING, activeFloorId);
          }
      });

      // Ensure all other child models are hidden
      Object.entries(appState.floor.floors).forEach(([id, f]) => {
          if (!f.parentFloorId) return;
          if (id === activeFloorId) {
              Navigation._applyFloorState(f, true, 1.0, 0, activeFloorId);
          } else if (f.sceneModel) {
              f.hide();
          }
      });
  }

  // ── Floor Switch Helpers ──────────────────────────────────────────────────

  static _buildExitCallback(floorId, targetFloor) {
      return async () => {
          const { appState } = Navigation;
          const exitId = targetFloor.parentFloorId || appState.previousMainFloorId || CONFIG.NAVIGATION.DEFAULT_FLOOR;
          await Navigation.switchFloor(exitId);

          // Try to re-select the parent object that leads into the child floor
          let targetObj = appState.previousSelectedObject;
          if (targetObj?.userData.child !== floorId) targetObj = null;

          if (!targetObj && appState.currentFloor) {
              const childMap = appState.currentFloor.constructor.childModels[appState.currentFloor.id] || {};
              for (const [nodeName, childId] of Object.entries(childMap)) {
                  if (childId === floorId) {
                      targetObj = appState.interactiveObjects.find(obj => obj.name === nodeName || obj.userData.boothId === nodeName);
                      break;
                  }
              }
          }

          if (targetObj) {
              // Temporarily zero the parent floor Y so focusOnObject reads the correct world position
              const parentModel = appState.currentFloor?.sceneModel;
              const savedY = parentModel?.position.y ?? 0;
              if (parentModel) { parentModel.position.y = 0; parentModel.updateMatrixWorld(true); }
              Navigation.focusOnObject(targetObj);
              if (parentModel) { parentModel.position.y = savedY; parentModel.updateMatrixWorld(true); }
              appState.ui.showSheet(targetObj.userData.boothId, targetObj.userData.child, targetObj.userData.boothDescription, targetObj.name);
          }
      };
  }

  static async _loadFloor(targetFloor, floorId) {
      if (targetFloor.isLoaded()) return;
      const { appState } = Navigation;
      const isPreloaded  = appState.assets.loadedAssets.has(targetFloor.modelPath);
      if (!isPreloaded) appState.ui.showToast(`Loading ${floorId.toUpperCase()}…`, CONFIG.UI.LOAD_TOAST_DURATION);

      try {
          await targetFloor.load(appState, appState.rawData);
          appState.recordAssetLoaded(targetFloor.modelPath);
          if (targetFloor.sceneModel) targetFloor.sceneModel.position.y = CONFIG.NAVIGATION.GHOST_SPACING;
          appState.directory.setDirectoryListData(appState.rawData);
      } catch (err) {
          console.error(`Failed to load floor ${floorId}:`, err);
          appState.ui.showToast(`Error: ${floorId.toUpperCase()} failed.`);
          throw err;
      } finally {
          appState.ui.hideToast();
      }
  }

  // ── Floor Switch ──────────────────────────────────────────────────────────

  static async switchFloor(floorId) {
      const { appState } = Navigation;
      const targetFloor = appState.floor.floors[floorId];
      if (!targetFloor)   { console.warn(`Floor ${floorId} not found`); return; }

      appState.isChildFloor = !!targetFloor.parentFloorId;
      updateExitButtonVisibility(appState.isChildFloor, Navigation._buildExitCallback(floorId, targetFloor));

      appState.cleanupEventListeners?.();

      if (appState.currentFloor?.id !== floorId) {
          const savedSelection = appState.selected;
          appState.cameraAnim.active = false;
          appState.ui.hideSheet();

          if (appState.selected) {
              appState.selected.traverse(MaterialUpdater.setProperty('material', c => c.userData.material));
              appState.selected = null;
          }

          if (appState.currentFloor && !appState.currentFloor.parentFloorId) {
              appState.previousMainFloorId = appState.currentFloor.id;
              appState.previousSelectedObject = savedSelection;
          }

          await Navigation._loadFloor(targetFloor, floorId);
          Navigation.applyGhostLayers(floorId);
          targetFloor.activate(appState.camera, appState.controls);

          appState.interactiveObjects = targetFloor.interactiveObjects;
          appState.currentFloor = targetFloor;
          Icon.setLevel(floorId);
          TextMarker.setLevel(floorId);
          BoothIDMarker.setLevel(floorId);
      }

      Navigation.clearActiveMarkers();
      Navigation.restoreLastMarker(floorId);
      Navigation._syncDirectoryMarker(floorId);
      appState.cleanupEventListeners = setupEventListeners(appState);
  }

  // ── Directory Marker Sync ─────────────────────────────────────────────────

  static _syncDirectoryMarker(floorId) {
      const { appState } = Navigation;
      if (!appState.activeDirectoryBoothId || !appState.activeDirectoryLevel) {
          Navigation._updateDirectoryMarkerVisibility(floorId);
          return;
      }

      const funtasiaData  = appState.directory.getDirectoryData();
      const targetFloor   = appState.floor.floors[floorId];
      let targetLocation  = null;
      let targetFloorId   = null;

      if (floorId === appState.activeDirectoryActualFloor) {
          const item = funtasiaData?.[appState.activeDirectoryLevel]?.[appState.activeDirectoryBoothId];
          if (item) { targetLocation = item.Location || item.location; targetFloorId = floorId; }

      } else if (targetFloor.constructor.childModels[floorId]) {
          for (const [nodeName, childId] of Object.entries(targetFloor.constructor.childModels[floorId])) {
              if (appState.activeDirectoryActualFloor === childId) {
                  const parentObj = appState.interactiveObjects.find(obj => obj.name === nodeName || obj.userData.boothId === nodeName);
                  if (parentObj) {
                      const worldPos = parentObj.getWorldPosition(new THREE.Vector3());
                      worldPos.y -= targetFloor.sceneModel.position.y;
                      targetLocation = worldPos;
                      targetFloorId  = floorId;
                  }
                  break;
              }
          }
      }

      if (targetLocation && targetFloorId) {
          if (appState.activeDirectoryMarker) {
              appState.activeDirectoryMarker.clear();
              appState.activeMarkers = appState.activeMarkers.filter(m => m !== appState.activeDirectoryMarker);
          }
          appState.activeDirectoryMarker = new DirectoryMarker(targetLocation, targetFloorId);
          appState.activeMarkers.push(appState.activeDirectoryMarker);
          appState.ui.setClearDirectoryMarkerVisible?.(true);

          Navigation.focusAt(targetLocation, {
              lookAtOffset: new THREE.Vector3(0, appState.activeDirectoryMarker.markerHeight + CONFIG.MARKERS.LOCATION.textOffset, 0)
          });
      } else {
          Navigation._updateDirectoryMarkerVisibility(floorId);
      }
  }

  // ── QR Handling ───────────────────────────────────────────────────────────

  static async handleQRID(qrID, suppressWarning = false) {
      const markerInfo = QRMarker.allMarkers[qrID];
      if (!markerInfo) {
          if (!suppressWarning) console.warn(`Marker ${qrID} not found.`);
          return false;
      }
      Navigation.appState.lastScannedInfo = { id: qrID, floorId: markerInfo.floorId, pos: markerInfo.pos, startTime: performance.now() };
      await Navigation.switchFloor(markerInfo.floorId);
      Navigation.focusAt(markerInfo.pos);
      return true;
  }

  static handleURLQR() {
      const qrID = new URLSearchParams(window.location.search).get("qrID");
      if (!qrID) { Navigation.switchFloor(CONFIG.NAVIGATION.DEFAULT_FLOOR); return; }

      (async () => {
          if (await Navigation.handleQRID(qrID, true)) return;

          // Wait for the target floor to finish loading before handling the QR code
          let resolved = false;
          let timeout  = null;

          const cleanup = () => {
              if (resolved) return;
              resolved = true;
              window.removeEventListener("floorReady", onReady);
              clearTimeout(timeout);
          };
          const onReady = async () => {
              cleanup();
              setTimeout(() => Navigation.handleQRID(qrID), CONFIG.INTERACTION.FLOOR_READY_DELAY);
          };

          window.addEventListener("floorReady", onReady);
          timeout = setTimeout(() => { cleanup(); console.warn(`[Navigation] floorReady timeout for QR: ${qrID}`); }, 10000);

          await Navigation.switchFloor(qrID.slice(0, 2));
      })();
  }
}