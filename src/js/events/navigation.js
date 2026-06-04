import * as THREE from "three";
import { CONFIG } from "@/js/base/config.js";
import { DirectoryMarker } from '@/js/marker/directorymarker.js';
import { focusOnObject, focusOnFloor, focusAt as focusAtUtil } from "@/js/ui_ux/cameraUtils.js";
import { Icon } from "@/js/marker/icon.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { TextMarker, BoothIDMarker } from "@/js/marker/textmarker.js";
import { setFloorOpacity } from "@/js/helper/util.js";

export class Navigation {
  static appState = null;

  static init(appState) {
    Navigation.appState = appState;
    // Attached to appState.ui for internal coordination instead of window
    appState.ui.updateFloorVisibilities = () => {
        if (appState.currentFloor) {
            Navigation.applyGhostLayers(appState.currentFloor.id);
        }
    };
  }

  static clearActiveMarkers() {
    const appState = Navigation.appState;
    if (appState.activeMarkers && appState.activeMarkers.length > 0) {
      appState.activeMarkers.forEach(m => {
        // Skip directory marker, we handle its persistence manually
        if (m !== appState.activeDirectoryMarker) {
            m.clear();
        }
      });
      // Filter out cleared markers, keeping the directory marker if it exists
      appState.activeMarkers = appState.activeMarkers.filter(m => m === appState.activeDirectoryMarker);
    }
  }

  static restoreLastMarker(floorId) {
    const appState = Navigation.appState;
    if (appState.lastScannedInfo && appState.lastScannedInfo.floorId === floorId) {
      const startTime = appState.lastScannedInfo.startTime;
      const greyDelay = CONFIG.NAVIGATION.MARKER_GREY_DELAY;
      const now = performance.now();
      
      if (now - startTime < greyDelay) {
        const marker = new QRMarker(appState.lastScannedInfo.pos, floorId, greyDelay);
        marker.startTime = startTime;
        appState.activeMarkers.push(marker);
      }
    }
  }

  /**
   * Smoothly animates camera to a specific position using shared cardinal snapping logic.
   */
  static focusAt(pos, options = {}) {
    focusAtUtil(Navigation.appState, pos, options);
  }

  /**
   * Wraps focusOnObject to reduce imports in other feature modules.
   */
  static focusOnObject(target) {
    focusOnObject(target, Navigation.appState);
  }

  /**
   * Updates the visibility and opacity of all floors based on the active floor.
   * Lower floors become translucent if Ghost Layers is enabled.
   */
  static applyGhostLayers(activeFloorId) {
    const appState = Navigation.appState;
    
    // Determine the "Reference" floor. If we are in a child model (like Canteen), 
    // we use its parent (L1) to determine the ghost stack.
    const activeFloor = appState.floors[activeFloorId];
    const referenceFloorId = (activeFloor && activeFloor.parentFloorId) ? activeFloor.parentFloorId : activeFloorId;
    const isViewingChild = !!activeFloor?.parentFloorId;
    
    const targetIdx = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(referenceFloorId);

    CONFIG.NAVIGATION.FLOOR_ORDER.forEach((id, index) => {
      const floor = appState.floors[id];
      if (!floor) return;

      // Case 1: The current view is either this floor or a child of this floor
      if (id === referenceFloorId) {
        if (floor.sceneModel) {
          // Hide main floor if we are inside one of its child areas
          floor.sceneModel.visible = !isViewingChild;
          floor.targetY = 0;
          floor.sceneModel.renderOrder = 10; // Ensure it renders on top
          floor.currentOpacity = 1.0;
          setFloorOpacity(floor.sceneModel, 1.0);
        }
      } else if (!isViewingChild && index < targetIdx && appState.ghostLayersEnabled) {
        // Case 2: Lower Floors (Translucent "Ghost" stack beneath current)
        if (!floor.isLoaded()) {
          if (!floor._loading) {
            floor.load(appState, appState.rawData).then(() => {
              if (floor.sceneModel) floor.sceneModel.position.y = 1; // Start above to animate down
              Navigation.applyGhostLayers(activeFloorId);
            });
          }
        } else if (floor.sceneModel) {
          const depth = targetIdx - index;
          floor.targetY = -depth * CONFIG.NAVIGATION.GHOST_SPACING;

          floor.sceneModel.visible = true;
          floor.sceneModel.renderOrder = index; // Lower floors render first

          // Decreasing opacity based on depth (0.2 -> 0.1 -> 0.05...)
          const opacity = Math.max(0.02, 0.3 * Math.pow(0.4, depth - 1));
          floor.currentOpacity = opacity;
          setFloorOpacity(floor.sceneModel, opacity);
        }
      } else {
        // Case 3: Upper Floors (Fly out to top) or hide ghosts if child is active
        if (floor.sceneModel) {
          const depthAbove = index - targetIdx;
          floor.targetY = depthAbove * CONFIG.NAVIGATION.GHOST_SPACING;
          
          // Fade out as it flies away
          floor.currentOpacity = 0;
          setFloorOpacity(floor.sceneModel, 0); 
          // Hide main floors that are "above" or "ghosts" when a child model is active
          floor.sceneModel.visible = !isViewingChild;
        }
      }
    });

    // CRITICAL: Ensure all other child models are hidden
    Object.keys(appState.floors).forEach(id => {
      const f = appState.floors[id];
      if (f.parentFloorId) {
        if (id === activeFloorId) {
          f.sceneModel.visible = true;
          f.targetY = 0;
          setFloorOpacity(f.sceneModel, 1.0);
        } else if (f.sceneModel) {
          f.hide();
        }
      }
    });
  }

  static async switchFloor(floorId) {
    const appState = Navigation.appState;
    const targetFloor = appState.floors[floorId];

    if (!targetFloor) {
      console.warn(`Floor ${floorId} not found`);
      return;
    }

    // Ensure child-floor exit button visibility is handled even if floor hasn't changed.
    // This handles cases where UI might have been hidden by a modal (like the Directory).
    const isChildFloor = !!targetFloor.parentFloorId;
    appState.isChildFloor = isChildFloor;

    const exitBtn = document.getElementById("exit-child-btn");
    if (exitBtn) {
      if (isChildFloor) {
        exitBtn.style.display = "flex";
        exitBtn.onclick = async () => {
           // Priority: 1. Parent of the child floor we are in, 2. Floor we came from
           const exitTargetId = targetFloor.parentFloorId || appState.previousMainFloorId || CONFIG.NAVIGATION.DEFAULT_FLOOR;
           await Navigation.switchFloor(exitTargetId);
           
           // Attempt to re-select the parent object
           let targetObj = appState.previousSelectedObject;
           
           // Ensure the previous selection is actually the parent of the child floor we just left
           if (targetObj && targetObj.userData.child !== floorId) {
               targetObj = null;
           }
           
           // If no previously selected object, try to find it by matching the child floor ID
           if (!targetObj && appState.currentFloor && appState.currentFloor.constructor.childModels[appState.currentFloor.id]) {
               for (const [nodeName, childId] of Object.entries(appState.currentFloor.constructor.childModels[appState.currentFloor.id])) {
                   if (childId === floorId) {
                       targetObj = appState.interactiveObjects.find(obj => obj.name === nodeName || obj.userData.boothId === nodeName);
                       break;
                   }
               }
           }

           if (targetObj) {
               // Temporarily reset parent floor Y to 0 to get the correct "rest" world position for focusOnObject.
               // Otherwise, if the floor is mid-animation, the focus target will be offset.
               const parentFloorModel = appState.currentFloor?.sceneModel;
               const currentY = parentFloorModel ? parentFloorModel.position.y : 0;
               
               if (parentFloorModel) {
                   parentFloorModel.position.y = 0;
                   parentFloorModel.updateMatrixWorld(true);
               }

               Navigation.focusOnObject(targetObj);

               if (parentFloorModel) {
                   parentFloorModel.position.y = currentY;
                   parentFloorModel.updateMatrixWorld(true);
               }
               appState.ui.showSheet(targetObj.userData.boothId, targetObj.userData.child, targetObj.userData.boothDescription, targetObj.name);
           }
        };
      } else {
        exitBtn.style.display = "none";
      }
    }

    // TASK #1: Cleanup listeners at the start of a floor switch
    if (appState && appState.cleanupEventListeners) {
      appState.cleanupEventListeners();
    }

    const isSameFloor = appState.currentFloor && appState.currentFloor.id === floorId;

    if (!isSameFloor) {
      // TASK #3: Mark all floors as starting animation
      Object.values(appState.floors).forEach(floor => {
        if (floor.startYAnimation) floor.startYAnimation(floorId);
      });

      // Redundant UI update removed: Handled by appState.currentFloor setter
      
      // Store the active selected object to enable deep-back resuming
      const savedSelection = appState.selected;

      // Clear any selected state and camera animations when starting a switch
      if (appState.cameraAnim) {
        appState.cameraAnim.active = false;
      }

      appState.ui.hideSheet();

      if (appState.selected) {
        appState.selected.traverse((child) => {
          if (child.isMesh && child.userData.material) {
            child.material = child.userData.material;
          }
        });
        appState.selected = null;
      }

      if (appState.currentFloor && !appState.currentFloor.parentFloorId) {
        appState.previousMainFloorId = appState.currentFloor.id;
        appState.previousSelectedObject = savedSelection;
      }
      
      // Lazy load
      if (!targetFloor.isLoaded()) {
        const isPreloaded = appState.loadedAssets.has(targetFloor.modelPath);
        if (!isPreloaded) appState.ui.showToast(`Loading ${floorId.toUpperCase()}…`, CONFIG.UI.LOAD_TOAST_DURATION);
        
        try {
          await targetFloor.load(appState, appState.rawData);
          appState.recordAssetLoaded(targetFloor.modelPath);
          
          // Initialize at top for "fly in from up" effect
          if (targetFloor.sceneModel) {
            targetFloor.sceneModel.position.y = CONFIG.NAVIGATION.GHOST_SPACING;
          }
          
          // Once all main floors are loaded (or as they load), cache the data
          // Actually, we can just cache it immediately after parsing since the data object is shared
          appState.directory.setDirectoryListData(appState.rawData);
        } catch (err) {
          console.error(`Failed to load floor ${floorId}:`, err);
          appState.ui.showToast(`Error: ${floorId.toUpperCase()} failed.`);
          return;
        } finally {
          appState.ui.hideToast();
        }
      }

      // Update Ghost Layer visibilities
      Navigation.applyGhostLayers(floorId);

      targetFloor.activate(appState.camera, appState.controls);

      // Update state
      appState.interactiveObjects = targetFloor.interactiveObjects;
      appState.currentFloor = targetFloor;
      Icon.setLevel(floorId);
      TextMarker.setLevel(floorId);
      BoothIDMarker.setLevel(floorId);
      console.log(`Switched to floor: ${floorId}`);
    }

    Navigation.clearActiveMarkers();
    Navigation.restoreLastMarker(floorId);
    Navigation._syncDirectoryMarker(floorId);

    // TASK #1: Re-initialize listeners (assuming setupEventListeners is available via global/appState scope)
    // Note: This requires Task 1D/1E implementation in event.js and main.js to be complete.
    if (appState && typeof setupEventListeners === 'function') {
        appState._eventListenerCleanup = setupEventListeners(appState);
    }
  }

  /**
   * Handles Directory Marker Bidirectional Transition Logic during floor switches.
   * @private
   */
  static _syncDirectoryMarker(floorId) {
    const appState = Navigation.appState;
    if (!appState.activeDirectoryBoothId || !appState.activeDirectoryLevel) {
      // Fallback for legacy marker handling
      if (appState.activeDirectoryMarker) {
      const isMatch = appState.activeDirectoryMarker.level === floorId;
      if (appState.activeDirectoryMarker.group) {
        appState.activeDirectoryMarker.group.visible = isMatch;
      }
      if (isMatch && !appState.activeMarkers.includes(appState.activeDirectoryMarker)) {
        appState.activeMarkers.push(appState.activeDirectoryMarker);
      }
      if (appState.ui.setClearDirectoryMarkerVisible) appState.ui.setClearDirectoryMarkerVisible(isMatch);
    }
      return;
    }

    const funtasiaData = appState.directory.getDirectoryData();
    const targetFloor = appState.floors[floorId];
    let targetMarkerLocation = null;
    let targetMarkerFloorId = null;

    // Case 1: Returning to the booth's exact floor
    if (floorId === appState.activeDirectoryActualFloor) {
      const item = funtasiaData?.[appState.activeDirectoryLevel]?.[appState.activeDirectoryBoothId];
      if (item) {
        targetMarkerLocation = item.Location || item.location;
        targetMarkerFloorId = floorId;
      }
    } 
    // Case 2: Moving to a parent floor
    else if (targetFloor.constructor.childModels[floorId]) {
      let parentNodeName = null;
      for (const [nodeName, childId] of Object.entries(targetFloor.constructor.childModels[floorId])) {
        if (appState.activeDirectoryActualFloor === childId) {
          parentNodeName = nodeName;
          break;
        }
      }

      if (parentNodeName) {
        const parentObj = appState.interactiveObjects.find(obj => obj.name === parentNodeName || obj.userData.boothId === parentNodeName);
        if (parentObj) {
          // Capture position but subtract the floor's current animation offset
          // to ensure we focus on the canonical "rest" world position.
          const worldPos = parentObj.getWorldPosition(new THREE.Vector3());
          worldPos.y -= targetFloor.sceneModel.position.y;
          targetMarkerLocation = worldPos;
          targetMarkerFloorId = floorId;
        }
      }
    }

    if (targetMarkerLocation && targetMarkerFloorId) {
      if (appState.activeDirectoryMarker) {
        appState.activeDirectoryMarker.clear();
        appState.activeMarkers = appState.activeMarkers.filter(m => m !== appState.activeDirectoryMarker);
      }
      
      appState.activeDirectoryMarker = new DirectoryMarker(targetMarkerLocation, targetMarkerFloorId);
      appState.activeMarkers.push(appState.activeDirectoryMarker);
      if (appState.ui.setClearDirectoryMarkerVisible) appState.ui.setClearDirectoryMarkerVisible(true);

      // Re-trigger focus on the canonical rest position
      Navigation.focusAt(targetMarkerLocation, { 
        lookAtOffset: new THREE.Vector3(0, appState.activeDirectoryMarker.markerHeight + CONFIG.MARKERS.LOCATION.textOffset, 0) 
      });
    } else if (appState.activeDirectoryMarker && appState.activeDirectoryMarker.group) {
      const isMatch = appState.activeDirectoryMarker.level === floorId;
      appState.activeDirectoryMarker.group.visible = isMatch;
      if (isMatch && !appState.activeMarkers.includes(appState.activeDirectoryMarker)) {
        appState.activeMarkers.push(appState.activeDirectoryMarker);
      }
      if (appState.ui.setClearDirectoryMarkerVisible) appState.ui.setClearDirectoryMarkerVisible(isMatch);
    }
  }

  static async handleQRID(qrID, suppressWarning = false) {
    const markerInfo = QRMarker.allMarkers[qrID];
    if (!markerInfo) {
      if (!suppressWarning) {
        console.warn(`Marker ${qrID} not found.`);
      }
      return false;
    }

    // Store in appState for persistence across floor switches
    Navigation.appState.lastScannedInfo = {
      id: qrID,
      floorId: markerInfo.floorId,
      pos: markerInfo.pos,
      startTime: performance.now()
    };

    // Trigger floor switch and await completion to avoid "snapping" override
    await Navigation.switchFloor(markerInfo.floorId);

    Navigation.focusAt(markerInfo.pos);

    return true;
  }

  static handleURLQR() {
    const urlParams = new URLSearchParams(window.location.search);
    const qrID = urlParams.get("qrID");
    
    if (qrID) {
      console.log(`URL/Popstate qrID: ${qrID}`);
      
      const executeAsyncCheck = async () => {
        // Attempt immediate handle (if already in registry)
        const handled = await Navigation.handleQRID(qrID, true);
        if (handled) return;

        // If not in registry, wait for floor load
        const targetFloorId = qrID.slice(0, 2);
        
        // TASK #8: Improved QR listener with cleanup and timeout
        let isResolved = false;
        let timeoutId = null;

        const cleanup = () => {
          if (!isResolved) {
            isResolved = true;
            window.removeEventListener("floorReady", onFloorReady);
            if (timeoutId) clearTimeout(timeoutId);
          }
        };

        const onFloorReady = async (e) => {
          cleanup(); // Remove listener immediately on first fire
          
          // IMPORTANT: Wait a tiny bit to ensure switchFloor's activation 
          // doesn't stomp on the animation we're about to start.
          setTimeout(async () => {
            await Navigation.handleQRID(qrID);
          }, CONFIG.INTERACTION.FLOOR_READY_DELAY);
        };

        window.addEventListener("floorReady", onFloorReady);

        // Auto-cleanup after 10s timeout
        timeoutId = setTimeout(() => {
          cleanup();
          console.warn(`[Navigation] floorReady timeout for QR: ${qrID}`);
        }, 10000);

        // Derive target floor from first 2 chars of qrID (e.g. "l1-...", "b2-...")
        await Navigation.switchFloor(targetFloorId);
      };
      
      executeAsyncCheck();
      return;
    }
    
    Navigation.switchFloor(CONFIG.NAVIGATION.DEFAULT_FLOOR);
  }
}
