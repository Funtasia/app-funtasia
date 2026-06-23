import * as THREE from "three";
import { CONFIG } from "@/js/base/config.js";

export class CameraState {
  constructor() {
    /** @type {boolean} */
    this.active = false;
    /** @type {THREE.Vector3} */
    this.cameraTarget = new THREE.Vector3();
    /** @type {THREE.Vector3} */
    this.controlsTarget = new THREE.Vector3();
    /** @type {number} */
    this.lerpFactor = CONFIG.CAMERA.ANIMATION.lerpFactor;
    /** @type {boolean} */
    this.isSystemAction = false;
    /** @type {number} */
    this.viewDistanceFactor = CONFIG.CAMERA.ANIMATION.viewDistanceFactor;
    /** @type {number} */
    this.viewHeightFactor = CONFIG.CAMERA.ANIMATION.viewHeightFactor;
  }
}
