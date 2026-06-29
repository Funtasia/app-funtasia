import * as THREE from "three";
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CONFIG } from "@/js/base/config.js";

export class Marker {
  static appState = null;
  static scene = null;

  /**
   * @param {THREE.Object3D} parent - Parent object to add the marker group to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string} level - The floor/level the marker belongs to.
   */
  constructor(parent, position, level) {
    this.appState = Marker.appState;
    // Markers should be children of their floor models to follow animations.
    this.parent = parent || (this.appState ? this.appState.scene : null);
    
    this.position = position ? position.clone() : new THREE.Vector3();
    this.level = level;

    this.group = new THREE.Group();
    
    if (this.parent && this.parent.type !== 'Scene') {
      // To ensure the marker follows the floor geometry correctly, we must calculate 
      // the local position relative to the floor's "rest" state (y=0). 
      // Otherwise, the current animation offset gets baked into the marker's height.
      const currentParentY = this.parent.position.y;
      this.parent.position.y = 0;
      this.parent.updateMatrixWorld(true);

      const localPos = this.parent.worldToLocal(this.position.clone());
      this.group.position.copy(localPos);

      // Restore the animating position so the transition remains smooth
      this.parent.position.y = currentParentY;
      this.parent.updateMatrixWorld(true);
    } else {
      this.group.position.copy(this.position);
    }

    this.indicator = null; // To be populated by subclasses

    const actualParent = this.parent || Marker.scene || (this.appState ? this.appState.scene : null);
    if (actualParent) {
      actualParent.add(this.group);
    }
  }

  /**
   * Synchronizes visibility and opacity with the parent floor.
   * Now also handles CSS2D labels.
   * This is modular and can be called by any subclass (TextMarker, Icon, etc.)
   * @param {boolean} isVisible - Optional local visibility override from subclass
   */
  updateSyncState(isVisible = true) {
    // If this.parent is floor.sceneModel, this is correct.
    if (!this.group || !this.parent || this.parent.type === 'Scene' || !this.parent.userData) return;

    const targetOpacity = this.parent.userData.currentOpacity ?? 1.0;
    const finalVisible = isVisible && targetOpacity > 0.01;
    this.group.visible = finalVisible;

    // Apply opacity to 3D materials
    if (this._materials) {
      this._materials.forEach(m => {
        const baseOpacity = (m.opacity < 1 && m.opacity > 0) ? m.opacity : 1.0;
        m.opacity = targetOpacity * baseOpacity;
      });
    }

    // Apply opacity/visibility to CSS2D label
    if (this._label && this._label.element) {
      const el = this._label.element;
      if (finalVisible) {
        el.style.display = 'block';
        el.style.opacity = targetOpacity;
      } else {
        el.style.display = 'none';
      }
    }
  }

  clear() {
    this.scene?.remove(this.group);
  }
}

export class LocationMarker extends Marker {
  /**
   * @param {THREE.Object3D} parent - Parent object to add the marker group to.
   * @param {THREE.Vector3} position - World position of the marker.
   * @param {string} level - The floor/level the marker belongs to.
   * @param {boolean} text - Whether to include the "You are here!" text label.
   * @param {boolean} showRing - Whether to show the base ring.
   */
  constructor(parent, position, level, text = false, showRing = true) {
    super(parent, position, level);

    this.scene = this.parent;
    this.markerHeight = CONFIG.MARKERS.LOCATION.height;

    const activeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true });
    const outlineMaterialActive = new THREE.LineBasicMaterial({ color: 0x550000, transparent: true });
    this._materials = [activeMaterial, outlineMaterialActive];

    // Ring (unchanged)
    if (showRing) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.11, 0.14, 32),
        activeMaterial
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.02;

      const ringEdges = new THREE.EdgesGeometry(ring.geometry);
      const ringOutline = new THREE.LineSegments(ringEdges, outlineMaterialActive);
      ring.add(ringOutline);
      this.group.add(ring);
    }

    // GLB model (unchanged)
    this._markerModel = null;
    import("three/addons/loaders/GLTFLoader.js").then(({ GLTFLoader }) => {
      const loader = new GLTFLoader();
      loader.load(CONFIG.MARKERS.URLS.GOOGLE_MAP_ICON, (gltf) => {
        this._markerModel = gltf.scene;
        this._markerModel.traverse((child) => {
          if (child.isMesh) {
            child.material = activeMaterial;
            const edges = new THREE.EdgesGeometry(child.geometry, 60);
            const outline = new THREE.LineSegments(edges, outlineMaterialActive);
            child.add(outline);
          }
        });
        const scale = 10;
        this._markerModel.scale.set(scale, scale, scale);
        this._markerModel.position.y = this.markerHeight;
        if (this.group) {
          this.group.add(this._markerModel);
        }
      });
    });

    // ----- CSS2D label (replaces Troika Text) -----
    this._label = null;
    if (text) {
      const div = document.createElement('div');
      div.textContent = 'You are here!'; // Can be replaced by translation function
      div.style.cssText = `
        background: rgba(255,255,255,0.9);
        padding: 4px 12px;
        border-radius: 12px;
        font-family: sans-serif;
        font-size: 14px;
        color: #ff0000;
        font-weight: bold;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        pointer-events: none;
        user-select: none;
        white-space: nowrap;
      `;
      this._label = new CSS2DObject(div);
      this._label.position.y = this.markerHeight + CONFIG.MARKERS.LOCATION.textOffset;
      this.group.add(this._label);
    }
  }

  /**
   * Updates the marker each frame: floats the GLB model and bobs the label.
   * No manual billboarding needed for CSS2D.
   */
  animate(time, camera) {
    if (!this.group) return;

    this.updateSyncState();

    const t = time * CONFIG.MARKERS.PHYSICS.bobSpeed;
    const bobOffset = Math.sin(t * CONFIG.MARKERS.PHYSICS.bobFreq) * CONFIG.MARKERS.PHYSICS.bobAmp;

    // Bob the GLB model
    if (this._markerModel) {
      this._markerModel.position.y = this.markerHeight + bobOffset;
      if (camera) {
        const targetPos = new THREE.Vector3();
        camera.getWorldPosition(targetPos);
        const modelPos = new THREE.Vector3();
        this._markerModel.getWorldPosition(modelPos);
        targetPos.y = modelPos.y;
        this._markerModel.lookAt(targetPos);
      }
    }

    // Bob the CSS2D label
    if (this._label) {
      this._label.position.y = (this.markerHeight + CONFIG.MARKERS.LOCATION.textOffset) + bobOffset;
    }
  }

  clear() {
    try {
          if (this._label) {
            this.group.remove(this._label);
            this._label.element.remove();
            this._label = null;
          }
          // Clean up GLTF model if needed
          if (this._markerModel) {
            this.group.remove(this._markerModel);
            // Optionally dispose geometries/materials
          }
      
    } catch (e) {
      console.log(this);
      console.log(this.group)
    };
    super.clear();
  }
}