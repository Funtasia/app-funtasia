import * as THREE from "three";
import { CONFIG } from "@/js/base/config.js";
import { ManagedMarker } from "@/js/marker/managedmarker.js";

export class Icon extends ManagedMarker {
  constructor(parent, type, position, level) {
    super(parent, position, level);
    
    this.icontype = type;
    this.iconPath = `${ASSETS_BASE_URL}/icons/${this.icontype}.png`;

    // Use TextureLoader to load high quality PNGs
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(this.iconPath, (tex) => {
      // Load aspect ratio once texture is ready
      this.aspect = tex.image.width / tex.image.height;
      if (this.indicator) {
        this.indicator.scale.set(this.baseScale * this.aspect, this.baseScale, 1);
      }
    });
    
    // High-quality texture settings
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 16; 

    // Using SpriteMaterial / Sprite so the icon always faces the camera (billboarding)
    this.material = new THREE.SpriteMaterial({ 
      map: texture, 
      transparent: true,
      depthTest: true 
    });
    this._materials = [this.material];

    this.indicator = new THREE.Sprite(this.material);
    this.baseScale = CONFIG.MARKERS.ICON.baseScale;
    this.aspect = 1.0;

    this.indicator.scale.set(this.baseScale, this.baseScale, 1);
    
    // Elevate icon slightly above floor level
    this.indicator.position.y = CONFIG.MARKERS.ICON.height; 

    this.group.add(this.indicator);
    this.updateVisibilityAndOpacity(); // Apply initial visibility
  }

  // Helper method to sync visibility across instances, optimized for levels
  updateVisibilityAndOpacity() {
    const isVisibleLocal = Icon.visibleState && this.level === Icon.activeLevel;
    this.updateSyncState(isVisibleLocal); // Apply parent floor's opacity and final visibility
  }

  // Animate method to handle dynamic scaling
  animate(time, camera) {
    if (!this.group || !this.indicator) return;
    this.updateVisibilityAndOpacity(); // Update visibility and opacity based on active level and parent state

    // Calculate distance and update scale
    const worldPos = new THREE.Vector3();
    this.indicator.getWorldPosition(worldPos);
    const distance = camera.position.distanceTo(worldPos);
    
    const targetScale = distance * CONFIG.MARKERS.ICON.scaleFactor;
    
    const finalScale = Math.min(this.baseScale, targetScale); // Cap at original size
    if (this.group.visible && finalScale >= (this.baseScale / CONFIG.MARKERS.ICON.minScaleRatio)) { 
      this.indicator.scale.set(finalScale * this.aspect, finalScale, 1);
    }
  }

  // Cleanup to prevent memory leaks
  clear() {
    super.clear(); // handles removing group from scene

    // Dispose of specific Three.js resources
    if (this.material?.map) this.material.map.dispose();
    if (this.material) this.material.dispose();
  }
}
