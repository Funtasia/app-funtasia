/*
Function: animate() -> Main animation loop
*/

import { CONFIG } from "@/js/base/config.js";
import { Icon } from "@/js/marker/icon.js";
import { Floor } from "@/js/floor/floor.js";
import { ManagedMarker } from "@/js/marker/managedmarker.js";
import { Navigation } from "@/js/events/navigation.js";

export function animateCameraTo(appState, cameraTarget, controlsTarget, isSystemAction = false, lerpFactor = 0.05) {
  appState.cameraAnim.controlsTarget.copy(controlsTarget);
  appState.cameraAnim.cameraTarget.copy(cameraTarget);
  appState.cameraAnim.isSystemAction = isSystemAction;
  appState.cameraAnim.lerpFactor = lerpFactor;
  appState.cameraAnim.active = true;
}

export function startAnimationLoop(appState) {
  /**
  * @param {appstate} appState
  * @returns {None}
  */

  function animate() {
    requestAnimationFrame(animate);

    /*
    Utilises interpolation to smoothly re-orientate the camera upon user 'click'
    */
    if (appState.cameraAnim && appState.cameraAnim.active) {
      // If auto-focus is disabled and this wasn't triggered by a system action (like Rotation Lock), cancel it
      if (appState.autoFocusEnabled === false && !appState.cameraAnim.isSystemAction) {
        appState.cameraAnim.active = false;
        return;
      }

      const lerpFactor = appState.cameraAnim.lerpFactor || 0.05;
      
      appState.camera.position.lerp(appState.cameraAnim.cameraTarget, lerpFactor);
      appState.controls.target.lerp(appState.cameraAnim.controlsTarget, lerpFactor);

      /*
      Check if animation has completed -> Camera has arrived at the target location
      */
      const posDist = appState.camera.position.distanceTo(appState.cameraAnim.cameraTarget);
      const targetDist = appState.controls.target.distanceTo(appState.cameraAnim.controlsTarget);
      
      if (posDist < 0.1 && targetDist < 0.1) {
        appState.cameraAnim.active = false;
        appState.cameraAnim.isSystemAction = false;
      }
    }

    appState.controls.update();
    
    /*
    Animate floor transitions (Ghost Layers sliding)
    */
    const activeFloorId = Navigation.appState?.currentFloor?.id;
    Object.values(Floor.floors).forEach((floor) => {
      if (floor.sceneModel && floor.sceneModel.visible) {
        const dist = floor.targetY - floor.sceneModel.position.y;
        if (Math.abs(dist) > 0.01) {
          floor.sceneModel.position.y += dist * 0.1;
        } else {
          // Hide floors that are ABOVE the current active floor once they finish flying out
          const floorIdx = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(floor.id);
          const targetIdx = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(activeFloorId);
          if (floorIdx > targetIdx && floorIdx !== -1 && targetIdx !== -1) {
            floor.sceneModel.visible = false;
          }
        }
      }
    });    

    const time = performance.now();
    /*
    Animate markers
    */
    if (appState.activeMarkers) {
      appState.activeMarkers.forEach(m => m.animate(time, appState.camera));
    }

    /*
    Animate icons
    */
    // Animate all managed markers (Icons, TextMarkers, BoothIDMarkers)
    if (ManagedMarker.allManagedMarkers) {
      ManagedMarker.allManagedMarkers.forEach(marker => marker.animate(time, appState.camera));
    }

    appState.renderer.render(appState.scene, appState.camera);
  }

  animate();
}
