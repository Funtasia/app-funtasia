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
   * @param {string} innerHTML - The label HTML.
   * @param {string} level - The floor/level the marker belongs to.
   * @param {Object} options - Label styling options.
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
      white-select: none;
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
    this.updateVisibilityAndOpacity();
  }

  clear() {
    if (this._label) {
      this.group.remove(this._label);
      this._label.element.remove();
      this._label = null;
    }

    this.parent?.remove(this.group);
    super.clear();
  }
}


export class TextMarker extends BaseTextMarker {
  /**
   * @param {THREE.Object3D} parent - Parent object to add the marker group to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string} text - The text to be displayed on the marker.
   * @param {string} level - The floor/level the marker belongs to.
   */
  constructor(parent, position, text, level) {
    super(parent, position, text, level, { markerHeight: 0.5 });
  }

  updateVisibilityAndOpacity() {
    if (!this.group) return;

    const isVisibleLocal =
      TextMarker.visibleState &&
      this.level === TextMarker.activeLevel;

    this.updateSyncState(isVisibleLocal);
  }
}

export class BoothIDMarker extends BaseTextMarker {
  // ---- static clustering properties ----
  static _clusterMarkers = [];
  static _lastUpdateTime = 0;
  static _updateThrottle = 250;               // ms
  static clusterThresholdPixels = 30;         // screen‑space distance
  static _lastActiveLevel = null;
  static _lastGroupHash = '';

  /**
   * 
   * @param {THREE.Object3D} parent - Parent object to add the marker group to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string[]} tags - Array of the booth tags.
   * @param {string} level - The floor/level the marker belongs to.
   * @param {Object} customOptions - Optional label overrides.
   */
  constructor(parent, position, tags, level, customOptions = {}) {
    const bgColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--color-ctp-mauve') ||
      "#cba6f7";

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
    } else if (now - this._lastUpdateTime < this._updateThrottle) {
      return;
    }
    this._lastUpdateTime = now;

    const levelMarkers = ManagedMarker.allManagedMarkers.filter(marker =>
      marker instanceof BoothIDMarker &&
      marker.level === this.activeLevel
    );

    levelMarkers.forEach(marker => {
      marker._isClustered = false;
    });

    if (
      !this.visibleState ||
      levelMarkers.length === 0
    ) {
      this._clearClusterMarkers();
      levelMarkers.forEach(marker => {
        marker.updateVisibilityAndOpacity();
      });
      return;
    }

    camera.updateMatrixWorld(true);

    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);

    const markerData = [];

    for (const marker of levelMarkers) {
      if (!marker.group) continue;

      const baseWorld = new THREE.Vector3();
      marker.group.getWorldPosition(baseWorld);

      const distance = cameraPosition.distanceTo(baseWorld);
      if (distance >= CONFIG.MARKERS.BOOTH.zoomThreshold) continue;

      const visualWorld = baseWorld.clone();
      visualWorld.y += marker.options.markerHeight || 0.5;

      const projected = visualWorld.clone().project(camera);

      // offscreen
      if (
        projected.z < -1 ||
        projected.z > 1 ||
        projected.x < -1 ||
        projected.x > 1 ||
        projected.y < -1 ||
        projected.y > 1
      ) continue;

      const screenX = (projected.x + 1) / 2 * screenWidth;
      const screenY = (1 - projected.y) / 2 * screenHeight;

      markerData.push({
        marker,
        visualWorld,
        screenX,
        screenY
      });
    }

    // Stable sorting makes cluster assignment deterministic.
    markerData.sort((a, b) =>
      a.screenX - b.screenX ||
      a.screenY - b.screenY ||
      a.marker.group.uuid.localeCompare(b.marker.group.uuid)
    );

    const groups = [];

    for (const data of markerData) {
      let nearestGroup = null;
      let nearestDistance = this.clusterThresholdPixels;

      for (const group of groups) {
        let distance = Math.hypot(
          data.screenX - group.centerX,
          data.screenY - group.centerY
        );

        // artificially increase distance between single
        // groups to lower chances for 2-element groups
        if (group.members.length == 1) {
          distance *= 1.5
        }

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestGroup = group;
        }
      }

      if (nearestGroup) {
        nearestGroup.members.push(data);

        const count = nearestGroup.members.length;
        nearestGroup.centerX +=
          (data.screenX - nearestGroup.centerX) / count;
        nearestGroup.centerY +=
          (data.screenY - nearestGroup.centerY) / count;
      } else {
        groups.push({
          members: [data],
          centerX: data.screenX,
          centerY: data.screenY
        });
      }
    }

    const clusterGroups = groups.filter(
      group => group.members.length > 1
    );

    const groupHash = clusterGroups
      .map(group =>
        group.members
          .map(data => data.marker.group.uuid)
          .sort()
          .join(',')
      )
      .sort()
      .join('|');

    if (groupHash !== this._lastGroupHash) {
      this._clearClusterMarkers();
      this._lastGroupHash = groupHash;

      for (const group of clusterGroups) {
        const firstMarker = group.members[0].marker;
        const clusterHeight = 0.5;

        const clusterMarker = new BaseTextMarker(
          firstMarker.parent,
          new THREE.Vector3(),
          String(group.members.length),
          firstMarker.level,
          {
            markerHeight: clusterHeight,
            bgColor: 'rgba(255, 200, 0, 0.9)',
            textColor: '#000',
            fontSize: '16px',
            fontWeight: 'bold',
            bgPadding: '6px 12px',
            borderRadius: '50%'
          }
        );

        clusterMarker._clusterMemberIds =
          group.members
            .map(data => data.marker.group.uuid)
            .sort();

        const element = clusterMarker._label.element;
        element.style.pointerEvents = 'auto';
        element.style.cursor = 'pointer';
        element.style.border = '2px solid #000';

        element.addEventListener('click', event => {
          event.stopPropagation();
          event.preventDefault();

          const appState =
            this.appState ||
            window.appState;

          if (!appState) return;

          import('@/js/ui_ux/cameraUtils.js').then(({ focusAt }) => {
            focusAt(appState, clusterMarker._clusterCenter, {
              distance: 2,
              heightOffset: 1,
              isSystem: true
            });
          });
        });

        this._clusterMarkers.push(clusterMarker);
      }
    }

    const clusterByMembers = new Map(
      this._clusterMarkers.map(marker => [
        marker._clusterMemberIds.join(','),
        marker
      ])
    );

    for (const group of clusterGroups) {
      const memberIds = group.members
        .map(data => data.marker.group.uuid)
        .sort();

      const clusterMarker = clusterByMembers.get(memberIds.join(','));
      if (!clusterMarker) continue;

      const visualCenter = new THREE.Vector3();

      for (const data of group.members) {
        visualCenter.add(data.visualWorld);
        data.marker._isClustered = true;
      }

      visualCenter.divideScalar(group.members.length);
      clusterMarker._clusterCenter = visualCenter;

      const parent = clusterMarker.parent;

      if (!parent) continue;

      const baseWorld = visualCenter.clone();
      baseWorld.y -= clusterMarker.options.markerHeight;

      const currentParentY = parent.position.y;
      parent.position.y = 0;
      parent.updateMatrixWorld(true);

      clusterMarker.group.position.copy(
        parent.worldToLocal(baseWorld)
      );

      parent.position.y = currentParentY;
      parent.updateMatrixWorld(true);
    }

    levelMarkers.forEach(marker => {
      marker.updateVisibilityAndOpacity();
    });

    this._clusterMarkers.forEach(marker => {
      const opacity =
        marker.parent?.userData?.currentOpacity ?? 1.0;

      marker.group.visible = opacity > 0.01;

      if (marker._label?.element) {
        marker._label.element.style.display =
          marker.group.visible ? 'block' : 'none';
        marker._label.element.style.opacity = opacity;
      }
    });
  }

  static _clearClusterMarkers() {
    for (const clusterMarker of this._clusterMarkers) {
      clusterMarker.clear();

      ManagedMarker.allManagedMarkers =
        ManagedMarker.allManagedMarkers.filter(
          marker => marker !== clusterMarker
        );

      const levelMarkers =
        ManagedMarker.managedMarkersByLevel[clusterMarker.level];

      if (levelMarkers) {
        ManagedMarker.managedMarkersByLevel[clusterMarker.level] =
          levelMarkers.filter(
            marker => marker !== clusterMarker
          );
      }
    }

    this._clusterMarkers = [];
  }

  animate(time, camera) {
    if (!this.group || !camera) return;

    const worldPosition = new THREE.Vector3();
    this.group.getWorldPosition(worldPosition);

    this.distance =
      camera.position.distanceTo(worldPosition);

    this.updateVisibilityAndOpacity();
  }

  updateVisibilityAndOpacity() {
    if (!this.group) return;

    const isWithinZoom =
      this.distance !== undefined
        ? this.distance < CONFIG.MARKERS.BOOTH.zoomThreshold
        : true;

    const isVisibleLocal =
      BoothIDMarker.visibleState &&
      this.level === BoothIDMarker.activeLevel &&
      isWithinZoom &&
      !this._isClustered;

    this.updateSyncState(isVisibleLocal);
  }
}