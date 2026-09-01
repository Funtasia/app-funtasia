/*
Function: animate() -> Main animation loop
*/

import { CONFIG } from "@/js/base/config.js";
import { Floor } from "@/js/floor/floor.js";
import { BoothIDMarker } from "@/js/marker/textmarker.js";

export function animateCameraTo(appState, cameraTarget, controlsTarget, isSystemAction = false, lerpFactor = CONFIG.CAMERA.ANIMATION.lerpFactor) {
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
      if (appState.settings.autoFocusEnabled === false && !appState.cameraAnim.isSystemAction) {
        appState.cameraAnim.active = false;
        return;
      }

      const lerpFactor = appState.cameraAnim.lerpFactor || CONFIG.CAMERA.ANIMATION.lerpFactor;
      
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
    Object.values(Floor.floors).forEach((floor) => {
      if (!floor._isAnimating || !floor.sceneModel?.visible) return;
      
      const dist = floor.targetY - floor.sceneModel.position.y;
      if (Math.abs(dist) > 0.01) {
        floor.sceneModel.position.y += dist * CONFIG.CAMERA.ANIMATION.floorLerpFactor;
      } else {
        floor._isAnimating = false;
        // Hide floors that are ABOVE the current active floor once they finish flying out
        const floorIdx = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(floor.id);
        const targetIdx = floor._targetIndex;
        if (floorIdx > targetIdx && floorIdx !== -1 && targetIdx !== -1) {
          floor.sceneModel.visible = false;
        }
      }
    });    

    const time = performance.now();
    
    /*
    Animate markers (Location markers + Managed markers)
    */
    const animatedMarkers = new Set();
    
    if (appState.activeMarkers) {
      appState.activeMarkers.forEach(m => {
        if (m && m.animate) {
          m.animate(time, appState.camera);
          animatedMarkers.add(m);
        }
      });
    }

    if (appState.ManagedMarker?.allManagedMarkers) {
      appState.ManagedMarker.allManagedMarkers.forEach(marker => {
        if (marker && marker.animate && !animatedMarkers.has(marker)) {
          marker.animate(time, appState.camera);
          animatedMarkers.add(marker);
        }
      });
    }

    BoothIDMarker.updateClusters(appState.camera, appState.renderer.domElement.clientWidth, appState.renderer.domElement.clientHeight)

    appState.renderer.render(appState.scene, appState.camera);
    appState.css2DRenderer.render(appState.scene, appState.camera)
  }

  animate();
}
