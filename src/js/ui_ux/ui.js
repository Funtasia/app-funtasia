import { focusOnFloor } from "@/js/ui_ux/cameraUtils.js";
import { CONFIG } from "@/js/base/config.js";

/**
 * Cached DOM elements for quick access
 */
const DOM = {
  sheet: document.getElementById("bottom-sheet"),
  sheetTitle: document.getElementById("sheet-title"),
  sheetDesc: document.getElementById("sheet-desc"),
  closeBtn: document.getElementById("close-btn"),
  floorSelector: document.getElementById("floor-selector"),
  floorThumb: document.getElementById("floor-thumb"),
  floorBtns: Array.from(document.querySelectorAll(".floor-btn")),
  toastPopup: document.getElementById("toast-popup"),
  toastMessage: document.getElementById("toast-message"),
  exitChildBtn: document.getElementById("exit-child-btn"),
};
/** @type {Object.<string, {title: string, description: string}>} */
const locationData = {}; 

/**
 * Populates the UI's location database from the directory JSON.
 * @param {Object} data - The directory data object { floor: { boothId: item } }
 */
export function setUISheetData(data) {
  if (!data || typeof data !== 'object') return;

  // Flatten the floor-grouped data for the UI lookup map
  Object.values(data).forEach(floorEntries => {
    if (!floorEntries || typeof floorEntries !== 'object') return;

    Object.entries(floorEntries).forEach(([id, item]) => {
      const title = item["booth_name"] || id;
      const description = item["booth_description"];

      const info = {
        title: title,
        description: description || `Welcome to ${title}.`
      };

      // Map by ID and by Title to ensure showBottomSheet always finds the data
      locationData[id] = info;
      if (title !== id) {
        locationData[title] = info;
      }
    });
  });
}

/**
 * Resolves human-readable title and description for a given object name using the location database.
 * @param {string} objectName - The raw name or ID of the 3D object.
 * @returns {{title: string, description: string}}
 */
function getLocationInfo(objectName) {
  if (locationData[objectName]) {
    return locationData[objectName];
  }
  return {
    title: objectName
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
    description: `This is ${objectName.replace(
      /_/g,
      " ",
    )}. Click to learn more about this location.`,
  };
}

let currentAppState = null;
let storedBottomSheetState = null;

/**
 * @typedef {Object} ActionContext
 * @property {string} objectName - The unique ID or name of the interactive object.
 * @property {string|null} childFloorId - The ID of the floor to enter, if the object is a portal.
 * @property {Object} locationInfo - The resolved title and description metadata.
 */

/**
 * Defines modular actions for buttons in the bottom sheet.
 * Each entry maps a DOM ID to a visibility condition and a click handler.
 * @type {Array<{id: string, condition: (ctx: ActionContext) => boolean, onClick: (ctx: ActionContext) => void, displayStyle?: string}>}
 */
const BOTTOM_SHEET_ACTIONS = [
  {
    id: "enter-child-btn",
    condition: (ctx) => !!ctx.childFloorId,
    onClick: async (ctx) => {
      const { Navigation } = await import("@/js/events/navigation.js");
      Navigation.switchFloor(ctx.childFloorId);
      hideBottomSheet();
    }
  },
  {
    id: "lt5-event-btn",
    condition: (ctx) => ctx.objectName === "CCA Performances @ LT5",
    onClick: () => {
      if (window.openEventsModal) window.openEventsModal("cca");
      hideBottomSheet();
    }
  },
  {
    id: "o2-event-btn",
    condition: (ctx) => ctx.objectName === "Busking @ Linkway",
    onClick: () => {
      if (window.openEventsModal) window.openEventsModal("pabusking");
      hideBottomSheet();
    }
  },
  {
    id: "amphi-event-btn",
    condition: (ctx) => ctx.objectName === "Water Dunk Tank",
    onClick: () => {
      if (window.openEventsModal) window.openEventsModal("dunklist");
      hideBottomSheet();
    }
  },
  {
    id: "makers-redirect-btn",
    condition: (ctx) => ctx.locationInfo.title === "Makers",
    onClick: () => window.open("https://makers.njcfuntasia.com", "_blank")
  },
  {
    id: "escaperoom-redirect-btn",
    condition: (ctx) => ctx.locationInfo.title.toLowerCase().includes("escape room"),
    displayStyle: "flex",
    onClick: () => window.open("https://escape-room.njcfuntasia.com", "_blank")
  }
];

/**
 * Displays the bottom sheet UI with information and contextual actions.
 * @param {string} objectName - The ID or Name of the selected 3D object.
 * @param {string|null} [childFloorId=null] - The ID of a sub-floor if the object is an entrance.
 * @param {string|null} [description=null] - Manual override for the description text.
 * @param {string|null} [title=null] - Manual override for the title text.
 */
export function showBottomSheet(objectName, childFloorId = null, description = null, title = null) {
  // Store the current state so it can be restored later
  storedBottomSheetState = { objectName, childFloorId, description, title };
  const locationInfo = getLocationInfo(objectName);
  DOM.sheetTitle.textContent = title || locationInfo.title;
  DOM.sheetDesc.textContent = description ? description : locationInfo.description;

  // Process modular action buttons
  const btnContext = { objectName, childFloorId, locationInfo };
  BOTTOM_SHEET_ACTIONS.forEach(config => {
    const btn = document.getElementById(config.id);
    if (!btn) return;

    if (config.condition(btnContext)) {
      btn.style.display = config.displayStyle || "block";
      btn.onclick = () => config.onClick(btnContext);
    } else {
      btn.style.display = "none";
      btn.onclick = null;
    }
  });

  DOM.sheet.classList.add("show");
  if (currentAppState) currentAppState.isBottomSheetOpen = true;
}

/**
 * Hides the bottom sheet and optionally clears the stored navigation state.
 * @param {boolean} [clearState=true] - Whether to clear the reference to the last selected object.
 */
export function hideBottomSheet(clearState = true) {
  if (DOM.sheet) DOM.sheet.classList.remove("show");
  if (currentAppState) {
    currentAppState.isBottomSheetOpen = false;
  }
  if (clearState) {
    storedBottomSheetState = null;
  }
  window.dispatchEvent(new Event('bottomsheetclose'));
}

/**
 * Centralized logic for the floating 'Exit Area' button.
 * @param {boolean} isChildFloor 
 * @param {Function|null} onExitClick 
 */
export function updateExitButtonVisibility(isChildFloor, onExitClick = null) {
  const exitBtn = DOM.exitChildBtn;
  if (!exitBtn) return;

  if (isChildFloor) {
    exitBtn.style.display = "flex";
    if (onExitClick) exitBtn.onclick = onExitClick;
  } else {
    exitBtn.style.display = "none";
  }
}

/**
 * Hides the bottom sheet while preserving its state.
 * Used during transitions where the sheet should reappear after an action.
 */
export function storeAndHideBottomSheet() {
  if (currentAppState && currentAppState.isBottomSheetOpen) {
    // Hide without clearing the stored state
    hideBottomSheet(false);
  } else {
    // If it wasn't open, ensure no stale state is stored
    storedBottomSheetState = null;
  }
}

/**
 * Re-displays the bottom sheet using the last saved state.
 */
export function reopenStoredBottomSheet() {
  if (storedBottomSheetState) {
    const { objectName, childFloorId, description, title } = storedBottomSheetState;
    showBottomSheet(objectName, childFloorId, description, title);
  }
}

export function clearStoredBottomSheet() {
  storedBottomSheetState = null;
}

/**
 * Triggers the removal of the currently visible toast notification.
 * Cleans up any pending hide timeouts.
 */
export function hideToast() {
  const toast = DOM.toastPopup;
  if (!toast) return;
  toast.classList.remove("show");
  if (toast.hideTimeout) {
    clearTimeout(toast.hideTimeout);
    toast.hideTimeout = null;
  }
}

/**
 * Displays a temporary toast notification at the top of the screen.
 * @param {string} message - The message to display.
 * @param {number} [duration=3000] - How long to show the toast in milliseconds.
 */
export function showToast(message, duration = CONFIG.UI.TOAST_DURATION) {
  const toast = DOM.toastPopup;
  const toastMsg = DOM.toastMessage;
  if (!toast || !toastMsg) return; // Ensure toast elements exist

  hideToast(); // Clear any existing toast before showing a new one

  toastMsg.textContent = message;
  toast.classList.add("show");

  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove("show");
    toast.hideTimeout = null;
  }, duration);
}

let activeIndex = -1;

/**
 * Updates the floor selector UI to reflect the current floor level.
 * @param {string} floorId - The ID of the floor (e.g., 'l1', 'b2').
 */
export function updateFloorUI(floorId) {
  if (!DOM.floorThumb || DOM.floorBtns.length === 0) return;

  const index = DOM.floorBtns.findIndex(btn => btn.dataset.floor === floorId);
  if (index === -1) return;

  activeIndex = index;
  
  // Update button classes
  DOM.floorBtns.forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });

  // Update thumb position
  const buttonHeight = DOM.floorBtns[0].offsetHeight || (window.innerWidth <= 768 ? 36 : 40);
  const gap = 4;
  const padding = window.innerWidth <= 768 ? 6 : 8;
  const newTop = padding + (index * (buttonHeight + gap));
  DOM.floorThumb.style.top = `${newTop}px`;
  DOM.floorThumb.style.opacity = "1";
}

/**
 * Initializes the UI event listeners, including floor selection and swipe gestures.
 * @param {Object.<string, import("@/js/floor/floor.js").Floor>} floors - Registry of loaded floors.
 * @param {Object} appState - The global application state.
 */
export function setupUI(floors, appState) {
  currentAppState = appState;
  
  DOM.closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    hideBottomSheet();
  });

  DOM.closeBtn.addEventListener("touchend", (e) => {
    e.stopPropagation();
    e.preventDefault();
    hideBottomSheet();
  });


  if (DOM.floorSelector && DOM.floorThumb && DOM.floorBtns.length > 0) {
    let isDragging = false;
    
    function getCSSPadding() {
      return window.innerWidth <= 768 ? 6 : 8;
    }

    function updateThumbUI(index) {
      if (index < 0) index = 0;
      if (index >= DOM.floorBtns.length) index = DOM.floorBtns.length - 1;
      const buttonHeight = DOM.floorBtns[0].offsetHeight || 40;
      const gap = 4;
      const newTop = getCSSPadding() + (index * (buttonHeight + gap));
      DOM.floorThumb.style.top = `${newTop}px`;
      DOM.floorThumb.style.opacity = "1";
    }

    function processInteraction(clientY) {
      const rect = DOM.floorSelector.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      
      const buttonHeight = DOM.floorBtns[0].offsetHeight || 40;
      const step = buttonHeight + 4; // button height + gap
      const offsetToCenter = getCSSPadding() + (buttonHeight / 2);
      
      let index = Math.round((relativeY - offsetToCenter) / step);
      if (index < 0) index = 0;
      if (index >= DOM.floorBtns.length) index = DOM.floorBtns.length - 1;
      
      if (index !== activeIndex) {
        activeIndex = index;
        updateThumbUI(index); // Update thumb position
        
        const floorId = DOM.floorBtns[index].dataset.floor;
        const NavigationPromise = import("@/js/events/navigation.js");
        NavigationPromise.then(({ Navigation }) => {
          Navigation.switchFloor(floorId);
        });
      }
    }

    DOM.floorSelector.addEventListener("pointerdown", (e) => {
      isDragging = true;
      DOM.floorSelector.setPointerCapture(e.pointerId);
      processInteraction(e.clientY);
      e.preventDefault();
      e.stopPropagation();
    });

    DOM.floorSelector.addEventListener("pointermove", (e) => {
      if (isDragging) {
        processInteraction(e.clientY);
        e.preventDefault();
        e.stopPropagation();
      }
    });

    DOM.floorSelector.addEventListener("pointerup", (e) => {
      if (isDragging) {
        isDragging = false;
        DOM.floorSelector.releasePointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
    DOM.floorSelector.addEventListener("pointercancel", (e) => {
        isDragging = false;
        try { DOM.floorSelector.releasePointerCapture(e.pointerId); } catch(err) {}
    });
  }

  // --- Bottom Sheet Swipe-to-Close Logic ---
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let rafId = null;

  const updatePosition = () => {
    if (!isDragging) {
      rafId = null;
      return;
    }
    DOM.sheet.style.transform = `translate3d(0, ${currentY}px, 0)`;
    rafId = requestAnimationFrame(updatePosition);
  };

  const handlePointerDown = (e) => {
    if (e.target.closest('#sheet-handle') || e.target.closest('h2') || e.target === DOM.sheet) {
      isDragging = true;
      startY = e.clientY - currentY; // Consistent start from current position
      DOM.sheet.setPointerCapture(e.pointerId);
      DOM.sheet.classList.add("shifting");
      
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePosition);
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaY = e.clientY - startY;
    currentY = Math.max(0, deltaY);
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    DOM.sheet.releasePointerCapture(e.pointerId);
    DOM.sheet.classList.remove("shifting");
    
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    const threshold = DOM.sheet.offsetHeight * 0.05; // Honoring user's 5% change
    
    if (currentY > threshold) {
      // Use Web Animations API to finish the motion fluidly to the bottom (100%)
      const closingAnim = DOM.sheet.animate([
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: `translate3d(0, 100%, 0)` }
      ], {
        duration: 250,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'forwards'
      });

      closingAnim.onfinish = () => {
        DOM.sheet.classList.remove("shifting");
        DOM.sheet.style.transform = "";
        hideBottomSheet();
        closingAnim.cancel(); // Remove the "fill: forwards" effect so CSS takes over
        currentY = 0;
      };
    } else {
      // Snap back to 0
      const snapAnim = DOM.sheet.animate([
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: `translate3d(0, 0, 0)` }
      ], {
        duration: 200,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'forwards'
      });

      snapAnim.onfinish = () => {
        DOM.sheet.classList.remove("shifting");
        DOM.sheet.style.transform = "";
        snapAnim.cancel();
        currentY = 0;
      };
    }
  };

  DOM.sheet.addEventListener("pointerdown", handlePointerDown);
  DOM.sheet.addEventListener("pointermove", handlePointerMove);
  DOM.sheet.addEventListener("pointerup", handlePointerUp);
  DOM.sheet.addEventListener("pointercancel", handlePointerUp);
}