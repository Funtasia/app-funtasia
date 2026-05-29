import * as THREE from "three";
import { Marker, FONT_URL } from "@/js/marker/marker.js";
import { Text } from "troika-three-text";
import { ManagedMarker } from "@/js/marker/managedmarker.js";

/**
 * BaseTextMarker: Provides common functionality for text-based markers.
 * Handles text mesh creation, background, and billboarding.
 */
export class BaseTextMarker extends ManagedMarker {
  constructor(parent, position, text, level, options) {
    super(parent, position, level);
    this.text = text;

    // Default options, overridden by provided options
    const defaultOptions = {
      markerHeight: 0.4,
      fontSize: 0.15,
      textColor: 0x000000,
      bgColor: 0xffffff,
      bgOpacity: 0.9,
      bgPlaneHeight: 0.25,
      bgPadding: 0.1,
      bgZOffset: -0.01,
    };
    this.options = { ...defaultOptions, ...options };

    this._labelGroup = new THREE.Group();

    const textMesh = new Text();
    textMesh.text = this.text;
    textMesh.fontSize = this.options.fontSize;
    textMesh.font = FONT_URL;
    textMesh.color = this.options.textColor;
    textMesh.anchorX = 'center';
    textMesh.anchorY = 'middle';

    const bgMaterial = new THREE.MeshBasicMaterial({
      color: this.options.bgColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: this.options.bgOpacity,
    });
    
    // Create background with a unit width so we can scale it easily to the text width
    const bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, this.options.bgPlaneHeight), bgMaterial);
    bgMesh.position.z = this.options.bgZOffset;

    // Sync the text and update background scale based on actual text width
    this._textMesh = textMesh;
    this._materials = [bgMaterial];

    textMesh.sync(() => {
      // Safety check: ensure marker hasn't been cleared during async sync
      if (this.group && textMesh.geometry && textMesh.geometry.boundingBox) {
        const width = textMesh.geometry.boundingBox.max.x - textMesh.geometry.boundingBox.min.x;
        bgMesh.scale.x = width + this.options.bgPadding;
      }
    });

    this._labelGroup.add(bgMesh);
    this._labelGroup.add(textMesh);
    this._labelGroup.position.y = this.options.markerHeight;
    this.group.add(this._labelGroup);
  }

  /**
   * Updates the marker each frame: billboards the text label.
   * Subclasses should implement their specific visibility logic before calling super.animate().
   * @param {number} time - Elapsed time in milliseconds.
   * @param {THREE.Camera} camera - The active camera.
   */
  animate(time, camera) {
    if (!this.group || !camera || !this.group.visible) return;

    if (this._labelGroup) {
      this._labelGroup.quaternion.copy(camera.quaternion);
      this._labelGroup.position.y = this.options.markerHeight;
    }
  }

  clear() {
    this.group?.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    super.clear();
  }
}

export class TextMarker extends BaseTextMarker {
  constructor(parent, position, text, level) {
    super(parent, position, text, level, {
      markerHeight: 0.5,
      fontSize: 0.15,
      textColor: 0x000000,
      bgColor: 0xffffff,
      bgOpacity: 0.9,
      bgPlaneHeight: 0.25,
      bgPadding: 0.1,
      bgZOffset: -0.01,
    });
    this.updateVisibilityAndOpacity(); // Apply initial visibility
  }

  /**
   * Updates the marker each frame: handles TextMarker-specific visibility and calls base class for billboarding.
   * @param {number} time - Elapsed time in milliseconds.
   * @param {THREE.Camera} camera - The active camera.
   */
  animate(time, camera) {
    this.updateVisibilityAndOpacity(); // Ensure visibility is updated before base animate
    super.animate(time, camera); // Call base class animate for billboarding and opacity sync
  }

  // New instance method to update visibility and opacity
  updateVisibilityAndOpacity() {
    if (!this.group) return;
    const isVisibleLocal = TextMarker.visibleState && this.level === TextMarker.activeLevel;
    this.updateSyncState(isVisibleLocal); // Apply parent floor's opacity and final visibility
  }

  clear() {
    super.clear(); // Clear Three.js resources via BaseTextMarker
  }
}

/**
 * BoothIDMarker: Displays Booth Names (e.g., "Canteen", "LT5") above interactive meshes.
 * Styled with brand colors (Mauve) to distinguish from Location TextMarkers.
 */
export class BoothIDMarker extends BaseTextMarker {
  // New instance method to update visibility and opacity
  updateVisibilityAndOpacity() {
    if (!this.group) return;
    const isWithinZoom = this.distance !== undefined ? this.distance < this.zoomThreshold : true;
    const isVisibleLocal = BoothIDMarker.visibleState && this.level === BoothIDMarker.activeLevel && isWithinZoom;
    this.updateSyncState(isVisibleLocal); 
  }
  constructor(parent, position, text, level, customOptions = {}) {
    // Default Brand-colored background (Mauve) and text (Base)
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ctp-mauve') || "#cba6f7";
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ctp-base') || "#1e1e2e";
    
    super(parent, position, text, level, {
      markerHeight: 0.2, // Placed very close to the booth surface
      fontSize: 0.0267, // Smaller than location labels
      textColor: Number("0x" + textColor.slice(1)), // Use brand base color
      bgColor: Number("0x" + bgColor.slice(1)), // Default mauve background
      bgOpacity: 0.85,
      bgPlaneHeight: 0.08,
      bgPadding: 0.06,
      bgZOffset: -0.005,
      ...customOptions // Merge custom options, overriding defaults
    });
  }

  animate(time, camera) {
    if (!this.group || !camera) return;

    // 1. Zoom-based visibility: only show when the camera is close
    const worldPos = new THREE.Vector3();
    this.group.getWorldPosition(worldPos);
    this.distance = camera.position.distanceTo(worldPos);
    this.zoomThreshold = 7.6; 

    this.updateVisibilityAndOpacity(); // Update visibility and opacity based on zoom and parent state

    if (this.group.visible) super.animate(time, camera); // Call base class animate for billboarding
  }

  clear() {
    super.clear(); // Clear Three.js resources via ManagedMarker
  }
}
