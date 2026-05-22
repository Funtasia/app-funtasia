import * as THREE from "three";
import { appState } from "@/js/base/appState.js";
import { events } from "@/js/feature/events.js";
import { setupScene } from "@/js/base/sceneSetup.js";
import { SettingsController } from "@/js/base/settings.js";
import { setupEventListeners } from "@/js/events/event.js";
import { Navigation } from "@/js/events/navigation.js";
import { directory } from "@/js/feature/directory.js";
import { Floor } from "@/js/floor/floor.js";
import { applyThemeToScene } from "@/js/floor/modelParser.js";
import { Icon } from "@/js/marker/icon.js";
import { Marker } from "@/js/marker/marker.js"; 
import { TextMarker, BoothIDMarker } from "@/js/marker/textmarker.js";
import { QRMarker } from "@/js/marker/qrmarker.js";
import { startAnimationLoop } from "@/js/ui_ux/animate.js";
import * as UI from "@/js/ui_ux/ui.js";

const { scene, camera, renderer, controls } = setupScene();

// Register all floors with their relative CDN paths (no static imports needed).
// Models are fetched lazily from jsDelivr on first switchFloor() call.
const floorDefs = {
  l2: `models/${VERSION}/njc-l2-${VERSION}.glb`,
  l1: `models/${VERSION}/njc-l1-${VERSION}.glb`,
  b1: `models/${VERSION}/njc-b1-${VERSION}.glb`,
  b2: `models/${VERSION}/njc-b2-${VERSION}.glb`,
  b3: `models/${VERSION}/njc-b3-${VERSION}.glb`,
};

const childModelDefs = {
  canteen:   { floorId: "l1", nodeName: "Canteen",   path: `models/${VERSION}/njc-l1-canteen-${VERSION}.glb` },
  sanctuary: { floorId: "l1", nodeName: "Sanctuary", path: `models/${VERSION}/njc-l1-sanctuary-${VERSION}.glb` },
  hall:      { floorId: "l2", nodeName: "CCA Booths @ Hall",      path: `models/${VERSION}/njc-l2-hall-${VERSION}.glb` },
  ish:       { floorId: "b3", nodeName: "ISH",       path: `models/${VERSION}/njc-b3-ish-${VERSION}.glb` },
};

// Instantiate Floor objects — they self-register into Floor.floors
Object.entries(floorDefs).forEach(([id, path]) => new Floor(id, path));
Object.entries(childModelDefs).forEach(([id, config]) => {
  const floor = new Floor(id, config.path);
  floor.parentFloorId = config.floorId;
  
  // Populate the lookup map for the parser (Parent ID -> { NodeName -> ChildID })
  if (!Floor.childModels[config.floorId]) Floor.childModels[config.floorId] = {};
  Floor.childModels[config.floorId][config.nodeName] = id;
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

appState.scene = scene;
appState.camera = camera;
appState.renderer = renderer;
appState.controls = controls;
appState.raycaster = raycaster;
appState.mouse = mouse;
appState.directory = directory;
appState.events = events;
appState.navigation = Navigation;

// Bind UI functions and Floor registry to appState to reduce imports in other modules
appState.floors = Floor.floors;
appState.ui = {
  hideSheet: UI.hideBottomSheet,
  showSheet: UI.showBottomSheet,
  setSheetData: UI.setUISheetData,
  clearStoredSheet: UI.clearStoredBottomSheet,
  updateFloor: UI.updateFloorUI,
  showToast: UI.showToast,
  hideToast: UI.hideToast,
};

Marker.appState = appState;
Floor.appState = appState;

appState.navigation.init(appState);

setupEventListeners(appState);

// Initializing the application
async function initApp() {
  // 1. Fetch raw data
  const rawData = await directory.fetchDirectoryData();

  // Register the fetched directory data with the UI module
  appState.ui.setSheetData(rawData);

  // No pre-loading — floors are fetched on-demand in Navigation.switchFloor()
  // 2. Set up UI
  UI.setupUI(Floor.floors, appState);

  // 3. Make raw data accessible globally for parsing later (handled via switchFloor param injection down the line)
  appState.rawData = rawData;
  
  appState.directory.init();
  appState.events.init();

  // Initialize modular Settings menu
  SettingsController.init('settings-content-area');
  const controlsSection = SettingsController.addSection('Controls');
  const visualsSection = SettingsController.addSection('Visual Preferences');
  const mapElements = SettingsController.addSection('Map elements');
  
  // Initialize settings from local storage
  window.ghostLayersEnabled = localStorage.getItem('funtasia-ghost-layers') !== 'false';  // default true
  appState.rotationLocked = localStorage.getItem('funtasia-rotation-lock') !== 'false';   // default true
  appState.autoFocusEnabled = localStorage.getItem('funtasia-autofocus') !== 'false';     // default true
  Icon.state(localStorage.getItem('funtasia-show-icons') !== 'false'); // default true
  TextMarker.state(localStorage.getItem('funtasia-show-text-markers') !== 'false'); // default true
  BoothIDMarker.state(localStorage.getItem('funtasia-show-booth-markers') !== 'false'); // default true

  if (visualsSection) {
    SettingsController.addToggle(
      mapElements,
      'Show POI Icons',
      'Toggle icons on the map',
      (state) => {
        localStorage.setItem('funtasia-show-icons', state);
        Icon.state(state); 
      },
      Icon.iconsVisible
    );
    SettingsController.addToggle(
      mapElements,
      'Location Labels',
      'Toggle text labels for major areas (Hall, Canteen, etc.)',
      (state) => {
        localStorage.setItem('funtasia-show-text-markers', state);
        TextMarker.state(state);
      },
      TextMarker.textMarkersVisible
    );
    SettingsController.addToggle(
      mapElements,
      'Booth Labels',
      'Toggle text labels for individual booths',
      (state) => {
        localStorage.setItem('funtasia-show-booth-markers', state);
        BoothIDMarker.state(state);
      },
      BoothIDMarker.boothIDsVisible
    );
    SettingsController.addToggle(
      visualsSection,
      'Ghost Layers',
      'View lower levels as translucent layers',
      (state) => {
          localStorage.setItem('funtasia-ghost-layers', state);
          window.ghostLayersEnabled = state;
          if (window.updateFloorVisibilities) window.updateFloorVisibilities();
      },
      window.ghostLayersEnabled
    );
    SettingsController.addToggle(
      visualsSection,
      'Dark Mode',
      'Toggle dark mode',
      (isDark) => {
          const root = document.documentElement;
          if (isDark) {
            root.classList.add('mocha');
            root.classList.remove('latte');
            localStorage.setItem('funtasia-theme', 'mocha');
          } else {
            root.classList.add('latte');
            root.classList.remove('mocha');
            localStorage.setItem('funtasia-theme', 'latte');
          };
          applyThemeToScene(appState); // update scene
        },
        document.documentElement.classList.contains('mocha') // Check if current mode is mocha
    );
  }
  if (controlsSection) {
    SettingsController.addToggle(
      controlsSection,
      'Rotation Lock',
      'Lock the rotation of the 3D model',
      (isLocked) => {
        localStorage.setItem('funtasia-rotation-lock', isLocked);
        appState.rotationLocked = isLocked;
        controls.enableRotate = !isLocked;
        controls.touches.TWO = isLocked ? THREE.TOUCH.DOLLY_PAN : THREE.TOUCH.DOLLY_ROTATE;
        
        // Lerp camera to front of the model when locked
        if (isLocked && appState.currentFloor && appState.currentFloor.cameraConfig) {
          const config = appState.currentFloor.cameraConfig;
          // Use consolidated navigation focus to ensure cardinal snapping
          appState.navigation.focusAt(config.target, {
            distance: config.initialPosition.distanceTo(config.target),
            heightOffset: config.initialPosition.y - config.target.y,
            isSystem: true
          });
        }
      },
      appState.rotationLocked
    );

    SettingsController.addToggle(
      controlsSection,
      'Camera Auto-Focus',
      'Smoothly animate the camera when selecting a location',
      (enabled) => {
        localStorage.setItem('funtasia-autofocus', enabled)
        appState.autoFocusEnabled = enabled;
      },
      appState.autoFocusEnabled
    );
  }

  const handleURLQR = () => {
    Navigation.handleURLQR();
  };

  // Listen for URL changes (back/forward or manual scan)
  window.addEventListener("popstate", handleURLQR);

  // Initial check — triggers first lazy load for the default floor
  handleURLQR();

  startAnimationLoop(appState);
}

initApp();
// Optional Console func
window.printCurrentFloorInfo = function () {
  const currentFloorId = appState.currentFloor ? appState.currentFloor.id : "None";
  console.log(`=== Info for Current Floor: ${currentFloorId} ===`);
};

window.printAllMarkers = function () {
  console.log(QRMarker.allMarkers);
};

// Events toggle buttons logic
const ccaToggleBtn = document.getElementById('events-cca-toggle-btn');
const dunklistToggleBtn = document.getElementById('events-dunklist-toggle-btn');
const pabuskingToggleBtn = document.getElementById('events-pabusking-toggle-btn');

ccaToggleBtn.addEventListener('click', () => appState.events.switchEventCategory('cca'));
dunklistToggleBtn.addEventListener('click', () => appState.events.switchEventCategory('dunklist'));
pabuskingToggleBtn.addEventListener('click', () => appState.events.switchEventCategory('pabusking'));

window.switchEventCategory = (cat) => appState.events.switchEventCategory(cat);

// Clear Directory Marker Button Logic
const clearDirMarkerBtn = document.getElementById('clear-directory-marker-btn');
if (clearDirMarkerBtn) {
  clearDirMarkerBtn.addEventListener('click', async () => {
      // We need to clear the active directory marker from the global app state
      // Since appState isn't globally exposed on window, we can dispatch an event or import it
      // Let's import the global appState reference or just find the module
      const appState = Navigation.appState;
      if (appState && appState.activeDirectoryMarker) {
          appState.activeDirectoryMarker.clear();
          appState.activeDirectoryMarker = null;
          appState.activeDirectoryBoothId = null;
          appState.activeDirectoryLevel = null;
          appState.activeMarkers = appState.activeMarkers.filter(m => m !== null);
      }
      clearDirMarkerBtn.style.display = 'none';

      // Also close the bottom sheet if it happens to be open
      appState.ui.hideSheet();

      window.setClearDirectoryMarkerVisible(false);
  });
}