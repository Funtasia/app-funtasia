import * as THREE from "three";
import { CONFIG } from "@/js/base/config.js";
import { animateCameraTo } from "@/js/ui_ux/animate.js";
import { zoneColours } from "@/js/floor/modelParser.js";
import { MaterialUpdater } from "@/js/helper/materialUtils.js";

export function applySelection(target, appState) {
  if (appState.selected === target) return;

  if (appState.selected) {
    appState.selected.traverse(MaterialUpdater.setProperty('material', (c) => c.userData.originalMaterial || c.userData.material));
  }

  appState.selected = target;

  if (appState.selected) {
    const baseColor = new THREE.Color(zoneColours[appState.selected.userData.ZONE]);

    const wallHighlightColor = baseColor.clone().multiplyScalar(1.4); // Values here are twiddled until they look good
    const topHighlightColor = baseColor.clone().multiplyScalar(1.6);  // Both are multiplied based on same base color, so walls need to be dimmer than top
    
    const wallHighlightMaterial = new THREE.MeshBasicMaterial({color: wallHighlightColor});
    const topHighlightMaterial = new THREE.MeshBasicMaterial({color: topHighlightColor});


    appState.selected.traverse(MaterialUpdater.setProperty('material', (c) => 
      c.name.endsWith('_2') ? topHighlightMaterial : wallHighlightMaterial
    ));
  }
}

export function focusOnFloor(appState, preserveView = false) {
  const floor = appState.currentFloor;
  if (!floor || !appState.controls) return;

  if (preserveView) {
    // If we are preserving view, we don't move the camera to the default config.
    // This is useful if focusOnFloor is called during a context switch.
    return;
  }

  const target = floor.cameraConfig.target.clone();
  const newCamPos = floor.cameraConfig.initialPosition.clone();

  animateCameraTo(appState, newCamPos, target);
}

/**
 * Smoothly animates camera to a specific position using cardinal snapping logic.
 * Consolidates logic used by both object-based and coordinate-based focus.
 */
export function focusAt(appState, pos, options = {}) {
  const { 
    distance = CONFIG.CAMERA.DEFAULTS.distance, 
    heightOffset = CONFIG.CAMERA.DEFAULTS.heightOffset, 
    isSystem = false, 
    lookAtOffset = new THREE.Vector3(CONFIG.CAMERA.DEFAULTS.lookAtOffset.x, CONFIG.CAMERA.DEFAULTS.lookAtOffset.y, CONFIG.CAMERA.DEFAULTS.lookAtOffset.z),
    lerpFactor = CONFIG.CAMERA.ANIMATION.lerpFactor 
  } = options;

  const target = pos.clone().add(lookAtOffset);
  const camPos = appState.camera.position.clone();
  const dir = new THREE.Vector3().subVectors(camPos, appState.controls.target);
  dir.y = 0;
  if (dir.lengthSq() < 0.001) dir.set(0, 0, 1);
  dir.normalize();

  // Snap to cardinal directions
  if (Math.abs(dir.x) > Math.abs(dir.z)) {
    dir.set(Math.sign(dir.x), 0, 0);
  } else {
    dir.set(0, 0, Math.sign(dir.z));
  }

  const newCamPos = target.clone()
    .add(dir.multiplyScalar(distance))
    .add(new THREE.Vector3(0, heightOffset, 0));

  animateCameraTo(appState, newCamPos, target, isSystem, lerpFactor);
}

export function focusOnObject(targetObject, appState) {
  if (appState.selected === targetObject) return;

  applySelection(targetObject, appState);

  if (targetObject && appState.controls) {
    // 1. Get object visual center (native Blender origin)
    const objectCenter = targetObject.getWorldPosition(new THREE.Vector3());

    // Still compute bounds just to know how big it is for distance calculation
    const box = new THREE.Box3().setFromObject(targetObject);
    const objectSize = box.getSize(new THREE.Vector3());

    const baseScale = Math.max(objectSize.length(), 2);
    const distFactor = appState.cameraAnim.viewDistanceFactor;
    const heightFactor = appState.cameraAnim.viewHeightFactor;

    focusAt(appState, objectCenter, {
      distance: baseScale * distFactor,
      heightOffset: baseScale * heightFactor,
      lookAtOffset: new THREE.Vector3(0, 1, 0)
    });
  }
}
