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
      pointer-events: auto;
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
  // ---- static clustering properties ----
  static _clusterMarkers = [];
  static _lastCameraPos = new THREE.Vector3();
  static _lastUpdateTime = 0;
  static _updateThrottle = 250;               // ms
  static clusterThresholdPixels = 29;         // screen‑space distance
  static _lastActiveLevel = null;
  static _lastGroupHash = '';

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

    this._isClustered = false;
  }

  // ---- cluster update method ----
  static updateClusters(camera, screenWidth, screenHeight) {
    const now = performance.now();

    // Force rebuild if active level changed
    if (this.activeLevel !== this._lastActiveLevel) {
      this._lastActiveLevel = this.activeLevel;
      this._lastUpdateTime = 0;
      this._lastGroupHash = '';
    }

    // Only update if camera moved significantly
    const distMoved = this._lastCameraPos.distanceTo(camera.position);
    if (distMoved < 0.3 && (now - this._lastUpdateTime) < this._updateThrottle) return;
    this._lastCameraPos.copy(camera.position);
    this._lastUpdateTime = now;

    // Gather all BoothIDMarkers on the active level and visible
    const markers = ManagedMarker.allManagedMarkers.filter(m =>
      m instanceof BoothIDMarker &&
      m.level === this.activeLevel &&
      this.visibleState
    );

    // If no markers, clear any existing clusters
    if (markers.length === 0) {
      this._clearClusterMarkers();
      return;
    }

    // Compute world positions of the visual centers (group + height)
    const markerData = markers.map(m => {
      const baseWorld = new THREE.Vector3();
      m.group.getWorldPosition(baseWorld);
      const height = m.options.markerHeight || 0.5;
      const visualWorld = baseWorld.clone().add(new THREE.Vector3(0, height, 0));
      const ndc = visualWorld.clone().project(camera);
      const screenX = (ndc.x + 1) / 2 * screenWidth;
      const screenY = (1 - ndc.y) / 2 * screenHeight;
      return { marker: m, visualWorld, screenX, screenY };
    });

    // Group by screen distance
    const groups = [];
    const used = new Array(markerData.length).fill(false);
    for (let i = 0; i < markerData.length; i++) {
      if (used[i]) continue;
      const group = [i];
      used[i] = true;
      for (let j = i + 1; j < markerData.length; j++) {
        if (used[j]) continue;
        const dx = markerData[i].screenX - markerData[j].screenX;
        const dy = markerData[i].screenY - markerData[j].screenY;
        if (Math.hypot(dx, dy) < this.clusterThresholdPixels) {
          group.push(j);
          used[j] = true;
        }
      }
      groups.push(group);
    }

    // Compute a hash of the grouping to detect changes
    const groupHash = groups.map(g => g.sort().join(',')).join('|');
    if (groupHash === this._lastGroupHash) {
      // No change in grouping – just update existing cluster positions (optional)
      // For simplicity we skip updating positions, but they might drift if camera moves
      // We'll just return to avoid flicker
      return;
    }
    this._lastGroupHash = groupHash;

    // Clear old cluster markers
    this._clearClusterMarkers();
    markers.forEach(m => { m._isClustered = false; });

    const clusterHeight = 0.5;

    for (const group of groups) {
      if (group.length <= 1) continue;

      // Average visual world positions (including label height)
      const avgVisual = new THREE.Vector3();
      for (const idx of group) {
        avgVisual.add(markerData[idx].visualWorld);
      }
      avgVisual.divideScalar(group.length);

      // Compute base world by subtracting clusterHeight (since label is at +height)
      const avgBase = avgVisual.clone().add(new THREE.Vector3(0, -clusterHeight, 0));

      const parent = markerData[group[0]].marker.parent;
      if (!parent) continue;

      // Compute local position using same logic as Marker constructor
      const currentParentY = parent.position.y;
      parent.position.y = 0;
      parent.updateMatrixWorld(true);
      const localPos = parent.worldToLocal(avgBase.clone());
      parent.position.y = currentParentY;
      parent.updateMatrixWorld(true);

      // Create a new BaseTextMarker with a dummy position (we'll set localPos manually)
      const count = group.length;
      const clusterMarker = new BaseTextMarker(
        parent,
        new THREE.Vector3(0, 0, 0), // dummy, we'll overwrite
        String(count),
        markerData[group[0]].marker.level,
        {
          markerHeight: clusterHeight,
          bgColor: 'rgba(255, 200, 0, 0.9)',
          textColor: '#000',
          fontSize: '16px',
          fontWeight: 'bold',
          bgPadding: '6px 12px',
          borderRadius: '50%',
        }
      );

      // Override the group position with our computed local position
      clusterMarker.group.position.copy(localPos);

      // Enable clicks
      const el = clusterMarker._label.element;
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      el.style.border = '2px solid #000';

      // Store visual center for zoom
      clusterMarker._clusterCenter = avgVisual.clone();

      // Click handler
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const appState = this.appState || window.appState;
        if (!appState) return;
        import('@/js/ui_ux/cameraUtils.js').then(({ focusAt }) => {
          focusAt(appState, avgVisual, {
            distance: 2,
            heightOffset: 1,
            isSystem: true,
            // lookAtOffset: new THREE.Vector3(0, 0, 0),
          });
        });
      });

      this._clusterMarkers.push(clusterMarker);

      for (const idx of group) {
        markerData[idx].marker._isClustered = true;
      }
    }

    markers.forEach(m => m.updateVisibilityAndOpacity());
  }

  // ---- helper to clear cluster markers ----
  static _clearClusterMarkers() {
    for (const cm of this._clusterMarkers) {
      cm.clear();   // removes from parent and cleans up label
    }
    this._clusterMarkers = [];
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
    const isVisibleLocal =
      BoothIDMarker.visibleState &&
      this.level === BoothIDMarker.activeLevel &&
      isWithinZoom &&
      !this._isClustered;   // ← hide if clustered

    this.updateSyncState(isVisibleLocal);
  }
}