import { focusOnFloor } from "@/js/ui_ux/cameraUtils.js";
import { CONFIG } from "@/js/base/config.js";

const sheet = document.getElementById("bottom-sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetDesc = document.getElementById("sheet-desc");
const closeBtn = document.getElementById("close-btn");
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
  sheetTitle.textContent = title || locationInfo.title;
  sheetDesc.textContent = description ? description : locationInfo.description;

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

  sheet.classList.add("show");
  if (currentAppState) currentAppState.isBottomSheetOpen = true;
}

/**
 * Hides the bottom sheet and optionally clears the stored navigation state.
 * @param {boolean} [clearState=true] - Whether to clear the reference to the last selected object.
 */
export function hideBottomSheet(clearState = true) {
  sheet.classList.remove("show");
  if (currentAppState) {
    currentAppState.isBottomSheetOpen = false;
  }
  if (clearState) {
    storedBottomSheetState = null;
  }
  window.dispatchEvent(new Event('bottomsheetclose'));
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
  const toast = document.getElementById("toast-popup");
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
  const toast = document.getElementById("toast-popup");
  const toastMsg = document.getElementById("toast-message");
  if (!toast || !toastMsg) return;

  hideToast(); // Clear any existing toast before showing new one

  toastMsg.textContent = message;
  toast.classList.add("show");

  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove("show");
    toast.hideTimeout = null;
  }, duration);
}

let floorSelector = null;
let floorThumb = null;
let floorBtns = [];
let activeIndex = -1;

/**
 * Updates the floor selector UI to reflect the current floor level.
 * @param {string} floorId - The ID of the floor (e.g., 'l1', 'b2').
 */
export function updateFloorUI(floorId) {
  if (!floorThumb || floorBtns.length === 0) {
    // Retry finding elements if they aren't captured yet
    floorSelector = document.getElementById("floor-selector");
    floorThumb = document.getElementById("floor-thumb");
    floorBtns = Array.from(document.querySelectorAll(".floor-btn"));
    if (!floorThumb || floorBtns.length === 0) return;
  }

  const index = floorBtns.findIndex(btn => btn.dataset.floor === floorId);
  if (index === -1) return;

  activeIndex = index;
  
  // Update button classes
  floorBtns.forEach((btn, i) => {
    btn.classList.toggle("active", i === index);
  });

  // Update thumb position
  const buttonHeight = floorBtns[0].offsetHeight || (window.innerWidth <= 768 ? 36 : 40);
  const gap = 4;
  const padding = window.innerWidth <= 768 ? 6 : 8;
  const newTop = padding + (index * (buttonHeight + gap));
  
  floorThumb.style.top = `${newTop}px`;
  floorThumb.style.opacity = "1";
}

/**
 * Initializes the UI event listeners, including floor selection and swipe gestures.
 * @param {Object.<string, import("@/js/floor/floor.js").Floor>} floors - Registry of loaded floors.
 * @param {Object} appState - The global application state.
 */
export function setupUI(floors, appState) {
  currentAppState = appState;
  
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    hideBottomSheet();
  });

  closeBtn.addEventListener("touchend", (e) => {
    e.stopPropagation();
    e.preventDefault();
    hideBottomSheet();
  });


  floorSelector = document.getElementById("floor-selector");
  floorThumb = document.getElementById("floor-thumb");
  floorBtns = Array.from(document.querySelectorAll(".floor-btn"));


  if (floorSelector && floorThumb && floorBtns.length > 0) {
    let isDragging = false;
    
    function getCSSPadding() {
      return window.innerWidth <= 768 ? 6 : 8;
    }

    function updateThumbUI(index) {
      if (index < 0) index = 0;
      if (index >= floorBtns.length) index = floorBtns.length - 1;
      const buttonHeight = floorBtns[0].offsetHeight || 40;
      const gap = 4;
      const newTop = getCSSPadding() + (index * (buttonHeight + gap));
      floorThumb.style.top = `${newTop}px`;
      floorThumb.style.opacity = "1";
    }

    function processInteraction(clientY) {
      const rect = floorSelector.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      
      const buttonHeight = floorBtns[0].offsetHeight || 40;
      const step = buttonHeight + 4; // button height + gap
      const offsetToCenter = getCSSPadding() + (buttonHeight / 2);
      
      let index = Math.round((relativeY - offsetToCenter) / step);
      if (index < 0) index = 0;
      if (index >= floorBtns.length) index = floorBtns.length - 1;
      
      if (index !== activeIndex) {
        activeIndex = index;
        updateThumbUI(index);
        
        const floorId = floorBtns[index].dataset.floor;
        const NavigationPromise = import("@/js/events/navigation.js");
        NavigationPromise.then(({ Navigation }) => {
          Navigation.switchFloor(floorId);
        });
      }
    }

    floorSelector.addEventListener("pointerdown", (e) => {
      isDragging = true;
      floorSelector.setPointerCapture(e.pointerId);
      processInteraction(e.clientY);
      e.preventDefault();
      e.stopPropagation();
    });

    floorSelector.addEventListener("pointermove", (e) => {
      if (isDragging) {
        processInteraction(e.clientY);
        e.preventDefault();
        e.stopPropagation();
      }
    });

    floorSelector.addEventListener("pointerup", (e) => {
      if (isDragging) {
        isDragging = false;
        floorSelector.releasePointerCapture(e.pointerId);
        e.preventDefault();
        e.stopPropagation();
      }
    });
    
    floorSelector.addEventListener("pointercancel", (e) => {
        isDragging = false;
        try { floorSelector.releasePointerCapture(e.pointerId); } catch(err) {}
    });
  }

  // --- Bottom Sheet Swipe-to-Close Logic ---
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let rafId = null;

  const updatePosition = () => {
    if (!isDragging) return;
    sheet.style.transform = `translate3d(0, ${currentY}px, 0)`;
    rafId = requestAnimationFrame(updatePosition);
  };

  const handlePointerDown = (e) => {
    if (e.target.closest('#sheet-handle') || e.target.closest('h2') || e.target === sheet) {
      isDragging = true;
      startY = e.clientY - currentY; // Consistent start from current position
      sheet.setPointerCapture(e.pointerId);
      sheet.classList.add("shifting");
      
      cancelAnimationFrame(rafId);
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
    sheet.releasePointerCapture(e.pointerId);
    sheet.classList.remove("shifting");
    cancelAnimationFrame(rafId);

    const threshold = sheet.offsetHeight * 0.05; // Honoring user's 5% change
    
    if (currentY > threshold) {
      // Use Web Animations API to finish the motion fluidly to the bottom (100%)
      const closingAnim = sheet.animate([
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: `translate3d(0, 100%, 0)` }
      ], {
        duration: 250,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'forwards'
      });

      closingAnim.onfinish = () => {
        sheet.classList.remove("shifting");
        sheet.style.transform = "";
        hideBottomSheet();
        closingAnim.cancel(); // Remove the "fill: forwards" effect so CSS takes over
        currentY = 0;
      };
    } else {
      // Snap back to 0
      const snapAnim = sheet.animate([
        { transform: `translate3d(0, ${currentY}px, 0)` },
        { transform: `translate3d(0, 0, 0)` }
      ], {
        duration: 200,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
        fill: 'forwards'
      });

      snapAnim.onfinish = () => {
        sheet.classList.remove("shifting");
        sheet.style.transform = "";
        snapAnim.cancel();
        currentY = 0;
      };
    }
  };

  sheet.addEventListener("pointerdown", handlePointerDown);
  sheet.addEventListener("pointermove", handlePointerMove);
  sheet.addEventListener("pointerup", handlePointerUp);
  sheet.addEventListener("pointercancel", handlePointerUp);

  // --- FAB Button Listeners ---
  const infoBtn = document.getElementById("open-info-btn");

  if (infoBtn) {
    infoBtn.addEventListener("click", () => {
      showInfo();
    });
  }
}

export function showInfo() {
  console.log("Info button clicked - function placeholder");
  // Future implementation: show app info / tutorial modal
}
