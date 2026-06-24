import * as THREE from "three";
import { appState } from "@/js/base/appState.js";
import { CONFIG } from "@/js/base/config.js";
import { setupScene } from "@/js/base/sceneSetup.js";
import { setupEventListeners } from "@/js/events/event.js";
import { Floor } from "@/js/floor/floor.js";
import { startAnimationLoop } from "@/js/ui_ux/animate.js";
import * as UI from "@/js/ui_ux/ui.js";

// Instantiate Floor objects — they self-register into Floor.floors
Object.entries(CONFIG.MODELS.FLOORS).forEach(([id, path]) => new Floor(id, path));
Object.entries(CONFIG.MODELS.CHILDREN).forEach(([id, config]) => {
  const floor = new Floor(id, config.path);
  floor.parentFloorId = config.floorId;
  
  // Populate the lookup map for the parser (Parent ID -> { NodeName -> ChildID })
  if (!Floor.childModels[config.floorId]) Floor.childModels[config.floorId] = {};
  Floor.childModels[config.floorId][config.nodeName] = id;
});

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

appState.raycaster = raycaster;
appState.mouse = mouse;
// Bind UI functions and Floor registry to appState to reduce imports in other modules
appState.floor.floors = Floor.floors;
appState.ui = {
  hideSheet: UI.hideBottomSheet,
  showSheet: UI.showBottomSheet,
  setSheetData: UI.setUISheetData,
  clearStoredSheet: UI.clearStoredBottomSheet,
  updateFloor: UI.updateFloorUI,
  showToast: UI.showToast,
  hideToast: UI.hideToast,
  /**
   * Delegates to global UI handlers but ensures child-floor exit button 
   * state is preserved. This fixes cases where closing a modal (like 
   * the Directory) would hide the 'Exit Area' button.
   */
  showFabButtons: () => {
    if (typeof window.showFabButtons === 'function') window.showFabButtons();
    UI.updateExitButtonVisibility(appState.isChildFloor);
  },
  hideFabButtons: () => {
    if (typeof window.hideFabButtons === 'function') window.hideFabButtons();
    UI.updateExitButtonVisibility(false);
  },
  setClearDirectoryMarkerVisible: (visible) => 
    window.setClearDirectoryMarkerVisible && window.setClearDirectoryMarkerVisible(visible)
};

// Marker and Floor appState binding moved inside initApp to support dynamic marker imports
Floor.appState = appState;

// Initializing the application
async function initApp() {
  const { scene, camera, renderer, controls } = await setupScene();
  
  appState.scene = scene;
  appState.camera = camera;
  appState.renderer = renderer;
  appState.controls = controls;
  appState.raycaster = raycaster;

  // Dynamically import heavy feature modules to improve TBT (Total Blocking Time)
  const [
    { Navigation },
    { setupSettings },
    { directory },
    { events },
    { Marker },
    { ManagedMarker },
    { Icon },
    { TextMarker, BoothIDMarker }
  ] = await Promise.all([
    import("@/js/events/navigation.js"),
    import("@/js/base/settings.js"),
    import("@/js/feature/directory.js"),
    import("@/js/feature/events.js"),
    import("@/js/marker/marker.js"),
    import("@/js/marker/managedmarker.js"),
    import("@/js/marker/icon.js"),
    import("@/js/marker/textmarker.js")
  ]);

  appState.directory = directory;
  appState.events = events;
  appState.navigation = Navigation;
  appState.ManagedMarker = ManagedMarker;
  
  // Bind appState to markers now that they are loaded
  Marker.appState = appState;

  // Initialize systems that depend on the dynamic modules
  appState.navigation.init(appState);
  appState.cleanupEventListeners = setupEventListeners(appState);

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
  await setupSettings();

  const handleURLQR = () => {
    Navigation.handleURLQR();
  };

  // Listen for URL changes (back/forward or manual scan)
  window.addEventListener("popstate", handleURLQR);

  // Initial check — triggers first lazy load for the default floor
  handleURLQR();

  startAnimationLoop(appState);

  // window.switchEventCategory is no longer needed as event listeners are managed internally by Events.js

  // Clear Directory Marker Button Logic
  const clearDirMarkerBtn = document.getElementById('clear-directory-marker-btn');
  if (clearDirMarkerBtn) {
    clearDirMarkerBtn.addEventListener('click', async () => {
        if (appState.activeDirectoryMarker) {
            appState.activeDirectoryMarker.clear();
            appState.activeDirectoryMarker = null;
            appState.activeDirectoryBoothId = null;
            appState.activeDirectoryLevel = null;
            appState.activeMarkers = appState.activeMarkers.filter(m => m !== null);
        }

        appState.ui.hideSheet();
        appState.ui.setClearDirectoryMarkerVisible(false);
    });
  }
}

initApp();