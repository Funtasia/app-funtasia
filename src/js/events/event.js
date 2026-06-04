import * as THREE from "three";
import { CONFIG } from "@/js/base/config.js";
import { 
  isPointerOverUI, 
  getInteractionTarget, 
  updateMousePosition, 
  updateMouseFromTouch 
} from "@/js/helper/util.js";
import { focusOnObject, applySelection } from "@/js/ui_ux/cameraUtils.js";
import { showBottomSheet } from "@/js/ui_ux/ui.js";

/**
 * Registry for tracking and removing event listeners.
 */
export function createEventRegistry() {
  const listeners = [];
  return {
    add(target, type, handler, options = {}) {
      target.addEventListener(type, handler, options);
      listeners.push({ target, type, handler });
    },
    cleanup() {
      listeners.forEach(({ target, type, handler }) => target.removeEventListener(type, handler));
      listeners.length = 0;
    }
  };
}

/**
 * Named handlers to allow clean removal from memory.
 */
const Handlers = {
  onMouseMove: (e, appState) => {
    if (isPointerOverUI(e)) return;
    updateMousePosition(e.clientX, e.clientY, appState);
  },
  onPointerDown: (appState) => {
    appState.pointerStartTime = Date.now();
  },
  onTouchStart: (e, appState) => {
    if (isPointerOverUI(e)) return;
    appState.pointerStartTime = Date.now();
    updateMouseFromTouch(e, appState);
  },
  onTouchMove: (e, appState) => {
    if (isPointerOverUI(e)) return;
    if (e.touches.length > 0) {
      updateMouseFromTouch(e, appState);
      e.preventDefault();
    }
  },
  onTouchEnd: (e, appState) => {
    if (isPointerOverUI(e)) return;
    updateMouseFromTouch(e, appState);
    const duration = Date.now() - appState.pointerStartTime;
    if (duration < CONFIG.INTERACTION.TAP_THRESHOLD) {
      const target = getInteractionTarget(e, appState);
      if (target) {
        focusOnObject(target, appState);
        showBottomSheet(target.userData.boothId, target.userData.child, target.userData.boothDescription, target.name);
      }
    }
  },
  onClick: (e, appState) => {
    const target = getInteractionTarget(e, appState);
    if (target) {
      focusOnObject(target, appState);
      showBottomSheet(target.userData.boothId, target.userData.child, target.userData.boothDescription, target.name);
    }
  },
  onWindowResize: (camera, renderer, composer) => {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (composer) composer.setSize(w, h);
  }
};

export function setupEventListeners(appState) {
  const registry = createEventRegistry();
  
  appState.pointerStartTime = 0;

  // Interaction Handlers
  registry.add(window, "mousemove", (e) => Handlers.onMouseMove(e, appState));
  registry.add(window, "mousedown", () => Handlers.onPointerDown(appState));
  registry.add(window, "touchstart", (e) => Handlers.onTouchStart(e, appState), { passive: false });
  registry.add(window, "touchmove", (e) => Handlers.onTouchMove(e, appState), { passive: false });
  registry.add(window, "touchend", (e) => Handlers.onTouchEnd(e, appState), { passive: false });
  registry.add(window, "click", (e) => Handlers.onClick(e, appState));
  
  registry.add(window, "camera-interaction-start", () => {
    if (appState.cameraAnim) appState.cameraAnim.active = false;
  });

  registry.add(window, "bottomsheetclose", () => {
    applySelection(null, appState);
  });
  
  // Handle Window Resize via central Handlers
  const onResize = () => Handlers.onWindowResize(appState.camera, appState.renderer, appState.composer);
  registry.add(window, "resize", onResize);

  return () => registry.cleanup();
}
