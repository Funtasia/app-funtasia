// textmarker.js
import * as THREE from "three";
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG } from "@/js/base/config.js";
import { ManagedMarker } from "@/js/marker/managedmarker.js";
import { disposeThreeObject } from "@/js/helper/threeUtils.js";

/**
 * BaseTextMarker: Provides common functionality for text-based markers.
 * Uses CSS2DRenderer for translatable labels.
 */
export class BaseTextMarker extends ManagedMarker {
  constructor(parent, position, text, level, options) {
    super(parent, position, level);
    this.text = text;

    const defaultOptions = {
      markerHeight: 0.4,
      fontSize: '14px',
      textColor: '#000000',
      bgColor: '#ffffff',
      bgOpacity: 0.9,
      bgPadding: '4px 12px',
      borderRadius: '12px',
      fontWeight: 'normal',
    };
    this.options = { ...defaultOptions, ...options };

    // Create the label div
    const div = document.createElement('div');
    div.textContent = this.text;
    div.style.cssText = `
      background: ${this.options.bgColor};
      opacity: ${this.options.bgOpacity};
      padding: ${this.options.bgPadding};
      border-radius: ${this.options.borderRadius};
      color: ${this.options.textColor};
      font-size: ${this.options.fontSize};
      font-family: sans-serif;
      font-weight: ${this.options.fontWeight};
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    `;

    this._label = new CSS2DObject(div);
    this._label.position.y = this.options.markerHeight;
    this.group.add(this._label);
  }

  /**
   * Updates the marker each frame: optionally applies bobbing.
   * No manual billboarding needed.
   */
  animate(time, camera) {
    if (!this.group || !camera || !this.group.visible) return;

    // Optionally add a subtle bob:
    // const bob = Math.sin(time * 0.002) * 0.02;
    // this._label.position.y = this.options.markerHeight + bob;
  }

  /**
   * Update the text content (for translations).
   */
  setText(newText) {
    this.text = newText;
    if (this._label) {
      this._label.element.textContent = newText;
    }
  }

  clear() {
    if (this._label) {
      this.group.remove(this._label);
      this._label.element.remove();
      this._label = null;
    }
    disposeThreeObject(this.group);
    super.clear();
  }
}

export class TextMarker extends BaseTextMarker {
  constructor(parent, position, text, level) {
    super(parent, position, text, level, {
      markerHeight: 0.5,
      fontSize: '14px',
      textColor: '#000000',
      bgColor: '#ffffff',
      bgOpacity: 0.9,
      bgPadding: '4px 12px',
      borderRadius: '12px',
    });
    this.updateVisibilityAndOpacity();
  }

  animate(time, camera) {
    this.updateVisibilityAndOpacity(); // handles visibility based on active level
    super.animate(time, camera);
  }

  updateVisibilityAndOpacity() {
    if (!this.group) return;
    const isVisibleLocal = TextMarker.visibleState && this.level === TextMarker.activeLevel;
    this.updateSyncState(isVisibleLocal);
  }

  clear() {
    super.clear();
  }
}

export class BoothIDMarker extends BaseTextMarker {
  constructor(parent, position, text, level, customOptions = {}) {
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ctp-mauve') || "#cba6f7";
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ctp-base') || "#1e1e2e";
    
    super(parent, position, text, level, {
      markerHeight: CONFIG.MARKERS.BOOTH.height,
      fontSize: CONFIG.MARKERS.BOOTH.fontSize + 'px',
      textColor: textColor,
      bgColor: bgColor,
      bgOpacity: 0.85,
      bgPadding: '2px 10px',
      borderRadius: '8px',
      fontWeight: 'bold',
      ...customOptions
    });
  }

  animate(time, camera) {
    if (!this.group || !camera) return;

    // Zoom-based visibility
    const worldPos = new THREE.Vector3();
    this.group.getWorldPosition(worldPos);
    this.distance = camera.position.distanceTo(worldPos);
    this.zoomThreshold = CONFIG.MARKERS.BOOTH.zoomThreshold;

    this.updateVisibilityAndOpacity();

    if (this.group.visible) super.animate(time, camera);
  }

  updateVisibilityAndOpacity() {
    if (!this.group) return;
    const isWithinZoom = this.distance !== undefined ? this.distance < this.zoomThreshold : true;
    const isVisibleLocal = BoothIDMarker.visibleState && this.level === BoothIDMarker.activeLevel && isWithinZoom;
    this.updateSyncState(isVisibleLocal);
  }

  clear() {
    super.clear();
  }
}