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

// Bind raycaster, mouse, floor registry, and UI bridge to appState
appState.floor.floors = Floor.floors;
appState.ui = {
  hideSheet:                  UI.hideBottomSheet,
  showSheet:                  UI.showBottomSheet,
  setSheetData:               UI.setUISheetData,
  clearStoredSheet:           UI.clearStoredBottomSheet,
  updateFloor:                UI.updateFloorUI,
  showToast:                  UI.showToast,
  hideToast:                  UI.hideToast,
  /**
   * Delegates to global UI handlers but ensures child-floor exit button 
   * state is preserved. This fixes cases where closing a modal (like 
   * the Directory) would hide the 'Exit Area' button.
   */
  showFabButtons: () => {
    window.showFabButtons?.();
    UI.updateExitButtonVisibility(appState.isChildFloor);
  },
  hideFabButtons: () => {
    window.hideFabButtons?.();
    UI.updateExitButtonVisibility(false);
  },
  setClearDirectoryMarkerVisible: (visible) =>
    window.setClearDirectoryMarkerVisible?.(visible),
};

Floor.appState = appState;

async function initApp() {
  const { scene, camera, renderer, controls } = await setupScene();

  appState.scene    = scene;
  appState.camera   = camera;
  appState.renderer = renderer;
  appState.controls = controls;

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

  appState.directory    = directory;
  appState.events       = events;
  appState.navigation   = Navigation;
  appState.ManagedMarker = ManagedMarker;

  Marker.appState = appState;

  appState.css2DRenderer.setSize(window.innerWidth, window.innerHeight);
  Object.assign(appState.css2DRenderer.domElement.style, {position: 'absolute', top: '0px', left: '0px', pointerEvents: 'none'});
  document.body.appendChild(appState.css2DRenderer.domElement);

  // Initialize systems that depend on the dynamic modules
  appState.navigation.init(appState);
  appState.cleanupEventListeners = setupEventListeners(appState);

  // Fetch directory data and hand it to the UI and appState
  const rawData = await directory.fetchDirectoryData();
  appState.ui.setSheetData(rawData);
  appState.rawData = rawData;

  UI.setupUI(Floor.floors, appState);

  appState.directory.init();
  appState.events.init();

  // Initialize modular Settings menu
  await setupSettings();

  // Handle URL/QR navigation — initial check + popstate listener
  window.addEventListener("popstate", Navigation.handleURLQR);
  Navigation.handleURLQR();

  startAnimationLoop(appState);

  // Clear Directory Marker button
  document.getElementById('clear-directory-marker-btn')?.addEventListener('click', async () => {
    appState.activeDirectoryMarker?.clear();
    appState.activeDirectoryMarker   = null;
    appState.activeDirectoryBoothId  = null;
    appState.activeDirectoryLevel    = null;
    appState.activeMarkers = appState.activeMarkers.filter(Boolean);

    appState.ui.hideSheet();
    appState.ui.setClearDirectoryMarkerVisible(false);
  });
}

initApp();
