// textmarker.js
import * as THREE from "three";
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG } from "@/js/base/config.js";
import { ManagedMarker } from "@/js/marker/managedmarker.js";

/**
 * BaseTextMarker: Provides common functionality for text-based markers.
 * Uses CSS2DRenderer for translatable labels.
 */
export class BaseTextMarker extends ManagedMarker {
  /**
   * @param {THREE.Object3D} parent - Parent object to add the marker group to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string} innerHTML 
   * @param {string} level - The floor/level the marker belongs to.
   * @param {Object} options 
   */
  constructor(parent, position, innerHTML, level, options) {
    super(parent, position, level);
    this.innerHTML = innerHTML;

    const defaultOptions = {
      markerHeight: 0.4,
      fontSize: '14px',
      textColor: '#000000',
      bgColor: 'rgb(255 255 255 / 0.75)',
      bgOpacity: 0.9,
      bgPadding: '4px 12px',
      borderRadius: '4px',
      fontWeight: 'normal',
    };
    this.options = { ...defaultOptions, ...options };

    // Create the label div
    const div = document.createElement('div');
    div.innerHTML = this.innerHTML;
    div.style.cssText = `
      background: ${this.options.bgColor};
      opacity: ${this.options.bgOpacity};
      padding: ${this.options.bgPadding};
      border-radius: ${this.options.borderRadius};
      color: ${this.options.textColor};
      font-size: ${this.options.fontSize};
      font-weight: ${this.options.fontWeight};
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
      transition-duration: 0ms !important;
    `;
    div.className = 'map-marker';

    this._label = new CSS2DObject(div);
    this._label.position.y = this.options.markerHeight;
    this.group.add(this._label);
  }

  /**
   * Calls this.updateVisibilityAndOpacity()
   */
  animate(time, camera) {
    this.updateVisibilityAndOpacity()
  }

  clear() {
    if (this._label) {
      this.group.remove(this._label);
      this._label.element.remove();
      this._label = null;
    }
    super.clear();
  }
}


export class TextMarker extends BaseTextMarker {
  /**
   * @param {THREE.Object3D} parent - Parent object to add the marker group to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string} text - The text to be displayed on the marker
   * @param {string} level - The floor/level the marker belongs to.
   */
  constructor(parent, position, text, level) {
    super(parent, position, text, level, { markerHeight: 0.5 });
  }

  updateVisibilityAndOpacity() {
    if (!this.group) return;
    const isVisibleLocal = TextMarker.visibleState && this.level === TextMarker.activeLevel;
    this.updateSyncState(isVisibleLocal);
  }
}

export class BoothIDMarker extends BaseTextMarker {
  /**
   * 
   * @param {THREE.Object3D} parent - Parent object to add the marker group to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {String[]} tags Array of the tags
   * @param {string} level - The floor/level the marker belongs to.
   * @param {*} customOptions 
   */
  constructor(parent, position, tags, level, customOptions = {}) {
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ctp-mauve') || "#cba6f7";
    
    const iconHTML = `
      <span class="material-symbols-outlined text-black" style="font-size: ${CONFIG.MARKERS.BOOTH.fontSize}">
        ${CONFIG.THEME.TAG_TO_ICON_MAP[tags[0]] || tags[0]}
      </span>`;

    super(parent, position, iconHTML, level, {
      markerHeight: CONFIG.MARKERS.BOOTH.height,
      bgColor: bgColor,
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

    this.updateVisibilityAndOpacity();
  }

  updateVisibilityAndOpacity() {
    if (!this.group) return;
    const isWithinZoom = this.distance !== undefined ? this.distance < CONFIG.MARKERS.BOOTH.zoomThreshold : true;
    const isVisibleLocal = BoothIDMarker.visibleState && this.level === BoothIDMarker.activeLevel && isWithinZoom;
    this.updateSyncState(isVisibleLocal);
  }
}