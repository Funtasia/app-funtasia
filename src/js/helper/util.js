import * as THREE from "three";

export function isPointerOverUI(event) {
  try {
    return !!event.target.closest("#bottom-sheet, #close-btn, #floor-selector, .modal-wrapper, button, input");
  } catch {
    return false
  }
}

export function performRaycast(appState) {
  if (!appState.interactiveObjects || appState.interactiveObjects.length === 0) return null;
  appState.raycaster.setFromCamera(appState.mouse, appState.camera);
  const intersects = appState.raycaster.intersectObjects(appState.interactiveObjects, true);
  if (intersects.length > 0) {
    const hit = intersects[0].object;
    // Resolve child mesh to parent Group if applicable
    return hit.userData.logicalParent || hit;
  }
  return null;
}

export function updateMousePosition(clientX, clientY, appState) {
  const rect = appState.renderer.domElement.getBoundingClientRect();
  appState.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  appState.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

export function updateMouseFromTouch(event, appState) {
  const touch =
    (event.touches && event.touches[0]) ||
    (event.changedTouches && event.changedTouches[0]);
  if (!touch) return;
  updateMousePosition(touch.clientX, touch.clientY, appState);
}

export function getInteractionTarget(event, appState) {
  if (isPointerOverUI(event)) return null;

  const pressDuration = Date.now() - appState.pointerStartTime;
  if (pressDuration > 150) return null; // Ignore long presses/drags

  return performRaycast(appState);
}

export function setFloorOpacity(group, opacity) {
  const isTransparent = opacity < 1;
  
  // Optimization: If the group is already at this opacity state, skip traversal
  if (group.userData.currentOpacity === opacity) return;
  group.userData.currentOpacity = opacity;

  group.traverse((child) => {
    if (child.isMesh || child.isSprite) {
      // CRITICAL: Do not override opacity for structural/invisible meshes
      if (child.userData.ROLE === "GREY") return;

      if (isTransparent) {
        if (child.userData.ghostMaterial) {
          child.material = child.userData.ghostMaterial;
          child.material.opacity = opacity;
        }
      } else {
        if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
        }
      }
      child.material.needsUpdate = true;
    }
  });
}