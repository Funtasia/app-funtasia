import * as THREE from "three";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from "@/js/base/config.js";

export function getViewportSize() {
  if (window.visualViewport) {
    return {
      width: window.visualViewport.width,
      height: window.visualViewport.height,
    };
  }
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function setupScene() {
  const container = document.getElementById("canvas-container");
  const scene = new THREE.Scene();
  let bgColor = getComputedStyle(document.documentElement).getPropertyValue('--color-ctp-base')
  scene.background = new THREE.Color(bgColor); 

  const viewportSize = getViewportSize();
  const camera = new THREE.PerspectiveCamera(
    CONFIG.CAMERA.PROJECTION.fov,
    viewportSize.width / viewportSize.height,
    CONFIG.CAMERA.PROJECTION.near,
    CONFIG.CAMERA.PROJECTION.far,
  );
  camera.position.set(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(viewportSize.width, viewportSize.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0,1);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.touches = {
    ONE: THREE.TOUCH.PAN,
    TWO: THREE.TOUCH.DOLLY_ROTATE,
  };
  controls.target.set(0, 0, 0);
  controls.screenSpacePanning = false;
  controls.minDistance = CONFIG.CAMERA.CONTROLS.minDistance;
  controls.maxDistance = CONFIG.CAMERA.CONTROLS.maxDistance;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = CONFIG.CAMERA.CONTROLS.maxPolarAngle;
  controls.enableDamping = true;
  controls.dampingFactor = CONFIG.CAMERA.CONTROLS.dampingFactor;

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444455,1);
  hemiLight.position.set(0, 200, 0);
  // scene.add(hemiLight);
  
  const dirLight = new THREE.DirectionalLight(0xffffff, 10);
  dirLight.position.set(10, 20, 50); 
  dirLight.castShadow = false;
  dirLight.shadow.camera.top = 50;
  dirLight.shadow.camera.bottom = -50;
  dirLight.shadow.camera.left = -50;
  dirLight.shadow.camera.right = 50;
  dirLight.shadow.camera.near = 0.1;
  dirLight.shadow.camera.far = 500;
  dirLight.shadow.bias = -0.0001; // Avoid shadow acne
  scene.add(dirLight);
  


  // Setup event listener to cancel animation on user interaction
  controls.addEventListener("start", () => {
    // We dispatch a custom event which main.js can catch to update appState
    window.dispatchEvent(new CustomEvent("camera-interaction-start"));
  });
  
  function handleResize() {
    const viewportSize = getViewportSize();
    camera.aspect = viewportSize.width / viewportSize.height;
    camera.updateProjectionMatrix();
    renderer.setSize(viewportSize.width, viewportSize.height);
  }
  

  window.addEventListener("resize", handleResize);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleResize);
    window.visualViewport.addEventListener("scroll", () => {
      window.scrollTo(0, 0);
    });
  }

  return { scene, camera, renderer, controls };
}
