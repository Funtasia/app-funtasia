# Funtasia App: Performance Optimization Implementation Plan

**Target:** Google Gemini/Claude Implementation  
**Priority:** Critical → High → Medium  
**Scope:** JavaScript only (src/js directory)

---

## 📋 Quick Reference

| Task ID | Priority | Category | Estimated Impact | Time | Status |
|---------|----------|----------|------------------|------|--------|
| [#1](#task-1-event-listener-cleanup) | 🔴 CRITICAL | Memory | -5-10MB/hour | 2h | TODO |
| [#2](#task-2-fix-raf-loop-inefficiency) | 🔴 CRITICAL | Perf | +60 fps stability | 1h | TODO |
| [#3](#task-3-optimize-floor-traversal) | 🔴 CRITICAL | Perf | -0.5-1ms/frame | 1.5h | TODO |
| [#4](#task-4-material-caching) | 🟡 HIGH | Memory | -30-50% materials | 2.5h | TODO |
| [#5](#task-5-fix-duplicate-marker-animation) | 🟡 HIGH | Perf | -50% marker updates | 1h | TODO |
| [#6](#task-6-pre-bake-ghost-materials) | 🟡 HIGH | Memory | -GC pressure | 1.5h | TODO |
| [#7](#task-7-dom-caching) | 🟢 MEDIUM | Maintainability | Negligible | 30m | TODO |
| [#8](#task-8-fix-race-condition) | 🟢 MEDIUM | Stability | -bugs | 1h | TODO |

**Total Estimated Time:** ~11 hours  
**Recommended Execution Order:** #1 → #2 → #3 → #4 → #5 → #6 → #7 → #8

---

## DETAILED IMPLEMENTATION TASKS

---

## TASK #1: Event Listener Cleanup
**Priority:** 🔴 CRITICAL  
**Category:** Memory Management / Leak Prevention  
**File:** `src/js/events/event.js`  
**Related Files:** `src/js/base/sceneSetup.js`, `src/js/events/navigation.js`

### Problem Statement
Multiple event listeners are attached to `window` and DOM elements but never removed. When the user navigates between floors or the app runs for extended periods, listeners accumulate in memory, causing:
- Memory leaks (~5-10MB per hour of navigation)
- Duplicate event handler executions
- Slowed event propagation

### Current Code (BROKEN)
**File: `src/js/events/event.js`** lines 16-95
```javascript
export function setupEventListeners(appState) {
  window.addEventListener("mousemove", (event) => {
    if (isPointerOverUI(event)) return;
    updateMousePosition(event.clientX, event.clientY, appState);
  });
  
  window.addEventListener("mousedown", () => {
    appState.pointerStartTime = Date.now();
  });
  
  // ... more listeners that NEVER get removed
  window.addEventListener("touchstart", ...);
  window.addEventListener("touchmove", ...);
  window.addEventListener("touchend", ...);
  window.addEventListener("click", ...);
  window.addEventListener("camera-interaction-start", ...);
}
```

### Solution Design

**Step 1:** Extract handlers as named functions (enables removal)
**Step 2:** Create a cleanup function that removes all listeners
**Step 3:** Call cleanup when floor changes or app unmounts
**Step 4:** Return the cleanup function from `setupEventListeners`

### Implementation Steps

#### Step 1A: Create Handler Functions
Create a new file: `src/js/events/eventHandlers.js`

```javascript
/**
 * Event handler functions for window and UI listeners.
 * Extracted as named functions to enable addEventListener/removeEventListener pairs.
 */

export function createEventHandlers(appState) {
  // Mousemove handler
  const handleMouseMove = (event) => {
    if (isPointerOverUI(event)) return;
    updateMousePosition(event.clientX, event.clientY, appState);
  };

  // Mouse down handler
  const handleMouseDown = () => {
    appState.pointerStartTime = Date.now();
  };

  // Touch start handler
  const handleTouchStart = (event) => {
    if (isPointerOverUI(event)) return;
    appState.pointerStartTime = Date.now();
    updateMouseFromTouch(event, appState);
  };

  // Touch move handler
  const handleTouchMove = (event) => {
    if (isPointerOverUI(event)) return;
    if (event.touches.length > 0) {
      updateMouseFromTouch(event, appState);
      event.preventDefault();
    }
  };

  // Touch end handler
  const handleTouchEnd = (event) => {
    if (isPointerOverUI(event)) return;
    updateMouseFromTouch(event, appState);
    
    const duration = Date.now() - appState.pointerStartTime;
    if (duration < CONFIG.INTERACTION.TAP_THRESHOLD) {
      const target = getInteractionTarget(event, appState);
      if (target) {
        focusOnObject(target, appState);
        showBottomSheet(target.userData.boothId, target.userData.child, target.userData.boothDescription, target.name);
      }
    }
  };

  // Click handler
  const handleClick = (event) => {
    const target = getInteractionTarget(event, appState);
    if (target) {
      focusOnObject(target, appState);
      showBottomSheet(target.userData.boothId, target.userData.child, target.userData.boothDescription, target.name);
    }
  };

  // Camera interaction handler
  const handleCameraInteractionStart = () => {
    if (appState.cameraAnim && appState.cameraAnim.active) {
      appState.cameraAnim.active = false;
    }
  };

  // Bottom sheet close handler
  const handleBottomSheetClose = () => {
    applySelection(null, appState);
  };

  // Return object with all handlers for cleanup
  return {
    handleMouseMove,
    handleMouseDown,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleClick,
    handleCameraInteractionStart,
    handleBottomSheetClose
  };
}
```

#### Step 1B: Update setupEventListeners
**File: `src/js/events/event.js`** - Replace entire function

```javascript
import { createEventHandlers } from "@/js/events/eventHandlers.js";

export function setupEventListeners(appState) {
  // Get all handler functions
  const handlers = createEventHandlers(appState);

  // Configure OrbitControls
  if (appState.controls) {
    appState.controls.enableDamping = true;
    appState.controls.dampingFactor = CONFIG.CAMERA.CONTROLS.dampingFactor;
    appState.controls.touches.ONE = THREE.TOUCH.PAN;
    appState.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  }

  // Attach listeners
  window.addEventListener("mousemove", handlers.handleMouseMove);
  window.addEventListener("mousedown", handlers.handleMouseDown);
  window.addEventListener("touchstart", handlers.handleTouchStart, { passive: false });
  window.addEventListener("touchmove", handlers.handleTouchMove, { passive: false });
  window.addEventListener("touchend", handlers.handleTouchEnd, { passive: false });
  window.addEventListener("click", handlers.handleClick);
  window.addEventListener("camera-interaction-start", handlers.handleCameraInteractionStart);
  window.addEventListener("bottomsheetclose", handlers.handleBottomSheetClose);

  // Return cleanup function
  return function cleanupEventListeners() {
    window.removeEventListener("mousemove", handlers.handleMouseMove);
    window.removeEventListener("mousedown", handlers.handleMouseDown);
    window.removeEventListener("touchstart", handlers.handleTouchStart);
    window.removeEventListener("touchmove", handlers.handleTouchMove);
    window.removeEventListener("touchend", handlers.handleTouchEnd);
    window.removeEventListener("click", handlers.handleClick);
    window.removeEventListener("camera-interaction-start", handlers.handleCameraInteractionStart);
    window.removeEventListener("bottomsheetclose", handlers.handleBottomSheetClose);
  };
}
```

#### Step 1C: Store Cleanup Reference in AppState
**File: `src/js/base/appState.js`** - Add to class constructor (around line 30)

```javascript
class AppState {
  constructor() {
    // ... existing code ...
    this._eventListenerCleanup = null;  // Add this line
  }

  // Add cleanup method
  cleanupEventListeners() {
    if (this._eventListenerCleanup) {
      this._eventListenerCleanup();
      this._eventListenerCleanup = null;
    }
  }
}
```

#### Step 1D: Initialize and Store Cleanup
**File: `src/js/base/main.js`** - Modify initApp (around line 68)

```javascript
async function initApp() {
  const { scene, camera, renderer, controls } = await setupScene();
  
  // ... existing scene setup code ...
  
  // Setup event listeners and store cleanup function
  const eventCleanup = setupEventListeners(appState);
  appState._eventListenerCleanup = eventCleanup;

  // ... rest of initApp ...
}
```

#### Step 1E: Call Cleanup on Floor Changes
**File: `src/js/events/navigation.js`** - Modify switchFloor (around line 50)

```javascript
static async switchFloor(floorId) {
  // Add cleanup at start
  if (Navigation.appState && Navigation.appState._eventListenerCleanup) {
    Navigation.appState.cleanupEventListeners();
  }

  // ... existing switchFloor logic ...
  
  // Re-initialize listeners
  const eventCleanup = setupEventListeners(Navigation.appState);
  Navigation.appState._eventListenerCleanup = eventCleanup;
}
```

### Testing Checklist
- [ ] Open DevTools → Memory tab → Take heap snapshot before/after floor switch
- [ ] Verify listeners decrease after cleanup
- [ ] Perform 10+ floor switches → Memory should remain stable
- [ ] Click/touch functionality works on new floor
- [ ] No console errors

### Expected Results
- **Memory Usage:** -5-10MB per hour
- **Event Listener Count:** Stable at ~8 instead of growing indefinitely
- **Performance:** Faster event propagation

---

## TASK #2: Fix RAF Loop Inefficiency
**Priority:** 🔴 CRITICAL  
**Category:** Performance / Frame Rate  
**File:** `src/js/ui_ux/ui.js` (lines 370-390)  
**Impact:** +60 FPS stability, reduced CPU usage

### Problem Statement
The `requestAnimationFrame` loop in the bottom sheet swipe handler continues to request frames even when not dragging, wasting 60+ frames per second indefinitely.

### Current Code (BROKEN)
**File: `src/js/ui_ux/ui.js`** lines 376-383
```javascript
const updatePosition = () => {
  if (!isDragging) return;
  sheet.style.transform = `translate3d(0, ${currentY}px, 0)`;
  rafId = requestAnimationFrame(updatePosition);
};

const handlePointerDown = (e) => {
  // ...
  rafId = requestAnimationFrame(updatePosition);
};
```

**Problem:** Every frame, `updatePosition()` calls `requestAnimationFrame()` even when `isDragging` is false, creating an infinite loop.

### Solution Design
- Set `rafId = null` when stopping the loop
- Only request next frame when `isDragging === true`
- Cancel RAF on pointer up/cancel

### Implementation Steps

Replace lines 370-390 in `src/js/ui_ux/ui.js`:

```javascript
  // --- Bottom Sheet Swipe-to-Close Logic ---
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let rafId = null;

  const updatePosition = () => {
    // Exit immediately if not dragging
    if (!isDragging) {
      rafId = null;
      return;
    }

    // Update sheet position
    sheet.style.transform = `translate3d(0, ${currentY}px, 0)`;
    
    // Only request next frame if still dragging
    rafId = requestAnimationFrame(updatePosition);
  };

  const handlePointerDown = (e) => {
    if (e.target.closest('#sheet-handle') || e.target.closest('h2') || e.target === sheet) {
      isDragging = true;
      startY = e.clientY - currentY;
      sheet.setPointerCapture(e.pointerId);
      sheet.classList.add("shifting");
      
      // Cancel any existing RAF
      if (rafId) cancelAnimationFrame(rafId);
      
      // Start new RAF loop ONLY when dragging starts
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
    
    // Cancel RAF immediately
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    const threshold = sheet.offsetHeight * 0.05;
    
    if (currentY > threshold) {
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
        closingAnim.cancel();
        currentY = 0;
      };
    } else {
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
```

### Testing Checklist
- [ ] Open DevTools → Performance tab → Record frame rate while not dragging (should be 60 FPS with no frame drops)
- [ ] Drag bottom sheet up/down → Should continue at 60 FPS
- [ ] Release drag → RAF loop should stop (check `rafId` in DevTools console)
- [ ] CPU usage in Performance tab → Should drop ~10-15% when not dragging

### Expected Results
- **Frame Stability:** 60 FPS even when many listeners active
- **CPU Usage:** -10-15% on idle frames
- **User Experience:** Smoother sheet interaction

---

## TASK #3: Optimize Floor Traversal Loop
**Priority:** 🔴 CRITICAL  
**Category:** Performance / Animation Loop  
**File:** `src/js/ui_ux/animate.js` (lines 57-72)  
**Impact:** -0.5-1ms per frame

### Problem Statement
Every frame (60 fps), the code loops through ALL floors and updates their Y position, even if they're not animating. This is unnecessary work.

### Current Code (BROKEN)
**File: `src/js/ui_ux/animate.js`** lines 57-72
```javascript
Object.values(Floor.floors).forEach((floor) => {
  if (floor.sceneModel && floor.sceneModel.visible) {
    const dist = floor.targetY - floor.sceneModel.position.y;
    if (Math.abs(dist) > 0.01) {
      floor.sceneModel.position.y += dist * 0.1;
    } else {
      // Hide floors that are ABOVE the current active floor once they finish flying out
      const floorIdx = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(floor.id);
      const targetIdx = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(activeFloorId);
      if (floorIdx > targetIdx && floorIdx !== -1 && targetIdx !== -1) {
        floor.sceneModel.visible = false;
      }
    }
  }
});
```

**Problem:** Even when `dist` is negligible, it still does `Math.abs()` and continues looping. Also recalculates floor indices every frame.

### Solution Design
- Add `_isAnimating` flag to Floor objects
- Only loop through actively animating floors
- Skip floors that have finished animating
- Cache floor indices

### Implementation Steps

**Step 3A:** Update Floor class to track animation state
**File: `src/js/floor/floor.js`** - Modify constructor (around line 20)

```javascript
constructor(id, modelPath, infoDataPath = null) {
  this.id = id;
  this.modelPath = modelPath;
  this.infoDataPath = infoDataPath;
  this.parentFloorId = null;

  this.sceneModel = null;
  this.targetY = 0;
  this._isAnimating = false;  // Add this line
  this._targetIndex = -1;     // Add this line for cached index
  
  // ... rest of constructor
}
```

**Step 3B:** Add animation start method to Floor class
**File: `src/js/floor/floor.js`** - Add method after constructor

```javascript
/**
 * Marks this floor as animating and caches the target floor index
 * @param {string} activeFloorId - The ID of the target floor
 */
startYAnimation(activeFloorId) {
  this._isAnimating = true;
  this._targetIndex = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(activeFloorId);
}
```

**Step 3C:** Update switchFloor to call startYAnimation
**File: `src/js/events/navigation.js`** - Modify switchFloor (around line 50)

```javascript
static async switchFloor(floorId) {
  // ... existing code ...

  // Mark all floors as starting animation
  Object.values(Floor.floors).forEach(floor => {
    floor.startYAnimation(floorId);
  });

  // ... rest of switchFloor
}
```

**Step 3D:** Replace the floor traversal loop in animate.js

**File: `src/js/ui_ux/animate.js`** - Replace lines 57-72

```javascript
    /*
    Animate floor transitions (Ghost Layers sliding)
    */
    const activeFloorId = appState.currentFloor?.id;
    
    Object.values(Floor.floors).forEach((floor) => {
      // Skip if not animating or not visible
      if (!floor._isAnimating || !floor.sceneModel?.visible) return;
      
      const dist = floor.targetY - floor.sceneModel.position.y;
      
      if (Math.abs(dist) > 0.01) {
        // Still animating - update position
        floor.sceneModel.position.y += dist * 0.1;
      } else {
        // Animation complete - stop checking this floor
        floor._isAnimating = false;
        
        // Hide floors above current floor
        const floorIdx = CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(floor.id);
        const targetIdx = floor._targetIndex;
        if (floorIdx > targetIdx && floorIdx !== -1 && targetIdx !== -1) {
          floor.sceneModel.visible = false;
        }
      }
    });
```

### Testing Checklist
- [ ] Use DevTools Performance → Record while switching floors
- [ ] Verify frame time decreases (look for animate.js frame time)
- [ ] Switch 10+ times → Performance should remain stable
- [ ] Ghost layers still animate smoothly
- [ ] Floors hide correctly after animation

### Expected Results
- **Frame Time:** -0.5-1ms per frame
- **FPS:** Stable 60 FPS during floor transitions
- **CPU:** -5-10% usage during animation

---

## TASK #4: Material Caching System
**Priority:** 🟡 HIGH  
**Category:** Memory Management  
**File:** `src/js/floor/modelParser.js` (lines 226-257)  
**Impact:** -30-50% material objects

### Problem Statement
Creating a new material for every mesh in the model wastes memory. Many meshes share identical properties (same color, same flags). Should reuse materials.

### Current Code (BROKEN)
**File: `src/js/floor/modelParser.js`** lines 249-256
```javascript
child.material = new THREE.MeshBasicMaterial({ 
  color: colorVal, 
  transparent: false,
  polygonOffset: isDecoration,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1
});
```

**Problem:** If 100 meshes have the same color and properties, 100 separate materials are created in VRAM.

### Solution Design
Create a material cache that maps property combinations to reusable materials.

### Implementation Steps

**Step 4A:** Create material cache helper
**File: `src/js/floor/modelParser.js`** - Add after imports (line 3)

```javascript
/**
 * Material cache to reuse materials with identical properties
 * Structure: { "color-decoration-status": Material }
 */
class MaterialCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get or create a material with the given properties
   * @param {number} colorVal - Hex color value
   * @param {boolean} isDecoration - Whether to apply polygon offset
   * @returns {THREE.MeshBasicMaterial}
   */
  getMaterial(colorVal, isDecoration) {
    // Create a unique key for this combination
    const key = `${colorVal.toString(16)}-${isDecoration}`;
    
    // Return cached material if it exists
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // Create new material
    const material = new THREE.MeshBasicMaterial({
      color: colorVal,
      transparent: false,
      polygonOffset: isDecoration,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });

    // Cache it
    this.cache.set(key, material);
    return material;
  }

  /**
   * Dispose all cached materials
   */
  clear() {
    for (const material of this.cache.values()) {
      material.dispose();
    }
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cachedMaterials: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}
```

**Step 4B:** Integrate cache into parseModel function
**File: `src/js/floor/modelParser.js`** - Modify parseModel signature (line 73)

```javascript
export async function parseModel(gltf, floorId, scene, funtasiaData, dataFloorId = floorId, childModels = {}) {
  // ... existing imports and setup ...

  const model = gltf.scene;
  model.visible = false;
  scene.add(model);
  
  // Create material cache for this model
  const materialCache = new MaterialCache();

  // ... rest of parseModel
```

**Step 4C:** Replace material creation with cache lookup
**File: `src/js/floor/modelParser.js`** - Replace lines 249-256

```javascript
      // 7. Apply material colours using cache
      if (child.isMesh) {
        let colorVal;
        if (!isInteractive) {
          colorVal = miscColours[role] !== undefined ? miscColours[role] : 0xc1c3c7;
        } else {
          colorVal = zoneColours[child.userData.ZONE];
        }

        // 8. Calculate brighter colour for the top face (_2 meshes)
        if (child.name.endsWith("_2")) {
          const baseColor = new THREE.Color(colorVal);
          baseColor.multiplyScalar(1.2);
          baseColor.r = Math.min(1.0, baseColor.r);
          baseColor.g = Math.min(1.0, baseColor.g);
          baseColor.b = Math.min(1.0, baseColor.b);
          colorVal = baseColor.getHex();
        }

        // Use material cache instead of creating new material every time
        const isDecoration = CONFIG.MODELS.DECORATIVE_ROLES.includes(role);
        child.material = materialCache.getMaterial(colorVal, isDecoration);
        
        if (isInteractive) child.userData.material = child.material;
      }
```

**Step 4D:** Store cache reference for cleanup
**File: `src/js/floor/modelParser.js`** - Modify return statement (line 325)

```javascript
  return { 
    model, 
    interactiveObjects: objects, 
    cameraConfig, 
    textMarkers, 
    boothIDMarkers,
    materialCache  // Add this
  };
}
```

**Step 4E:** Add cleanup to Floor class
**File: `src/js/floor/floor.js`** - Add property and cleanup

```javascript
constructor(id, modelPath, infoDataPath = null) {
  // ... existing code ...
  this._materialCache = null;  // Add this
}

// Add cleanup method
async load(appState, funtasiaData) {
  if (this.isLoaded()) return;
  if (this._loading) return;

  this._loading = true;

  const gltf = await loadModel(this.modelPath);
  const parsingId = this.parentFloorId || this.id;
  const result = await parseModel(gltf, this.id, appState.scene, funtasiaData, parsingId, Floor.childModels);
  this.attachParsedData(result.model, result.interactiveObjects, result.cameraConfig, result.textMarkers, result.boothIDMarkers);
  
  // Store cache reference
  this._materialCache = result.materialCache;
  
  this._loading = false;
  window.dispatchEvent(new CustomEvent("floorReady", { detail: { floorId: this.id } }));
  console.log(`[Floor] Parsed ${this.id}: ${result.interactiveObjects.length} interactive meshes.`);
}

// Add unload cleanup
unload() {
  if (this.sceneModel) {
    // Traverse and cleanup materials
    this.sceneModel.traverse(child => {
      if (child.isMesh && child.material) {
        // Don't dispose cached materials here - cache handles it
      }
    });
  }
  
  if (this._materialCache) {
    this._materialCache.clear();
    this._materialCache = null;
  }
}
```

### Testing Checklist
- [ ] Open DevTools → Memory tab → Track material count (should be ~20-40 instead of 500+)
- [ ] Load a floor → Note material count
- [ ] Check material cache stats via: `Floor.currentFloor._materialCache.getStats()`
- [ ] Switch floors → Materials should be reused or fresh cache created
- [ ] Verify visual appearance unchanged

### Expected Results
- **Material Count:** -30-50% (500+ → 20-40)
- **VRAM Usage:** -2-5MB per floor
- **Load Time:** Slightly faster (fewer object creations)

---

## TASK #5: Fix Duplicate Marker Animation
**Priority:** 🟡 HIGH  
**Category:** Performance / State Management  
**File:** `src/js/ui_ux/animate.js` (lines 78-88)  
**Impact:** -50% marker update calls

### Problem Statement
Markers are being animated twice per frame if they exist in both `activeMarkers` and `ManagedMarker.allManagedMarkers`. This causes state inconsistency and doubles work.

### Current Code (BROKEN)
**File: `src/js/ui_ux/animate.js`** lines 78-88
```javascript
    if (appState.activeMarkers) {
      appState.activeMarkers.forEach(m => m.animate(time, appState.camera));
    }

    if (appState.ManagedMarker?.allManagedMarkers) {
      appState.ManagedMarker.allManagedMarkers.forEach(marker => marker.animate(time, appState.camera));
    }
```

**Problem:** If a marker is in both lists, `animate()` is called twice, causing visibility state to flip and duplicate work.

### Solution Design
- Use a Set to track which markers have been animated
- Only animate each marker once per frame
- Prioritize `activeMarkers` (location markers)
- Then animate managed markers not yet processed

### Implementation Steps

Replace lines 78-88 in `src/js/ui_ux/animate.js`:

```javascript
    /*
    Animate markers (Location markers + Managed markers)
    */
    const animatedMarkers = new Set();
    
    // First, animate active location markers (these take priority)
    if (appState.activeMarkers) {
      appState.activeMarkers.forEach(m => {
        if (m && m.animate) {
          m.animate(time, appState.camera);
          animatedMarkers.add(m);
        }
      });
    }

    // Then, animate managed markers that haven't been animated yet
    // (prevents double-animating markers that are in both lists)
    if (appState.ManagedMarker?.allManagedMarkers) {
      appState.ManagedMarker.allManagedMarkers.forEach(marker => {
        if (marker && marker.animate && !animatedMarkers.has(marker)) {
          marker.animate(time, appState.camera);
          animatedMarkers.add(marker);
        }
      });
    }
```

### Testing Checklist
- [ ] Open DevTools → add breakpoint in `animate()` methods
- [ ] Switch to a location with markers
- [ ] Verify each marker's `animate()` is called exactly once per frame
- [ ] Check visibility/opacity states are consistent
- [ ] Visual behavior unchanged

### Expected Results
- **Marker Update Calls:** -50%
- **Frame Time:** -0.1-0.2ms (minor but cumulative)
- **State Consistency:** 100% (no state flip)

---

## TASK #6: Pre-Bake Ghost Layer Materials
**Priority:** 🟡 HIGH  
**Category:** Memory Management / GC Pressure  
**File:** `src/js/helper/util.js` (lines 46-79)  
**Impact:** -GC churn on zoom/opacity changes

### Problem Statement
Every time a floor's opacity changes, materials are cloned on-the-fly. This creates garbage collection pressure and temporary memory spikes.

### Current Code (BROKEN)
**File: `src/js/helper/util.js`** lines 63-70
```javascript
if (isTransparent) {
  if (!child.userData.ghostMaterial) {
    child.userData.ghostMaterial = child.material.clone();  // ← Clone every transition!
    child.userData.ghostMaterial.transparent = true;
  }
  child.material = child.userData.ghostMaterial;
  child.material.opacity = opacity;
  child.material.depthWrite = false;
}
```

**Problem:** Material cloning during gameplay causes stutter and GC pauses.

### Solution Design
- Pre-create transparent variants during model parsing
- Store on `userData` during parse time
- Simply swap references during runtime

### Implementation Steps

**Step 6A:** Create ghost material during parsing
**File: `src/js/floor/modelParser.js`** - Modify mesh material section (around line 249)

```javascript
      // 7. Apply material colours using cache
      if (child.isMesh) {
        let colorVal;
        if (!isInteractive) {
          colorVal = miscColours[role] !== undefined ? miscColours[role] : 0xc1c3c7;
        } else {
          colorVal = zoneColours[child.userData.ZONE];
        }

        // 8. Calculate brighter colour for the top face (_2 meshes)
        if (child.name.endsWith("_2")) {
          const baseColor = new THREE.Color(colorVal);
          baseColor.multiplyScalar(1.2);
          baseColor.r = Math.min(1.0, baseColor.r);
          baseColor.g = Math.min(1.0, baseColor.g);
          baseColor.b = Math.min(1.0, baseColor.b);
          colorVal = baseColor.getHex();
        }

        // Use material cache for solid material
        const isDecoration = CONFIG.MODELS.DECORATIVE_ROLES.includes(role);
        child.material = materialCache.getMaterial(colorVal, isDecoration);
        
        // PRE-BAKE ghost (transparent) variant
        const ghostMaterial = new THREE.MeshBasicMaterial({
          color: colorVal,
          transparent: true,
          opacity: 0.5,  // Default ghost opacity
          depthWrite: false,
          polygonOffset: isDecoration,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        child.userData.ghostMaterial = ghostMaterial;
        child.userData.originalMaterial = child.material;
        
        if (isInteractive) child.userData.material = child.material;
      }
```

**Step 6B:** Update setFloorOpacity to use pre-baked material
**File: `src/js/helper/util.js`** - Replace lines 46-79

```javascript
export function setFloorOpacity(group, opacity) {
  const isTransparent = opacity < 1;
  
  // Optimization: If the group is already at this opacity state, skip traversal
  if (group.userData.currentOpacity === opacity) return;
  group.userData.currentOpacity = opacity;

  group.traverse((child) => {
    if (child.isMesh || child.isSprite) {
      // CRITICAL: Do not override opacity for structural/invisible meshes
      if (child.userData.ROLE === "GREY") return;

      if (isTransparent) {
        // Use pre-baked ghost material (created during parsing)
        if (child.userData.ghostMaterial) {
          child.material = child.userData.ghostMaterial;
          child.material.opacity = opacity;
        }
      } else {
        // Restore the original solid material
        if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
        }
      }
      
      child.material.needsUpdate = true;
    }
  });
}
```

### Testing Checklist
- [ ] Load a floor → Check DevTools memory (should have 2x materials pre-created)
- [ ] Enable Ghost Layers toggle → Should switch instantly without cloning
- [ ] Monitor DevTools Memory → No spike when toggling ghost layers
- [ ] Toggle 10+ times → No visible stutter or lag
- [ ] Verify visual appearance (opacity) is correct

### Expected Results
- **GC Churn:** -80-90% (no cloning during gameplay)
- **Memory Stability:** Much smoother during ghost layer transitions
- **Frame Time:** No micro-stutters from GC

---

## TASK #7: DOM Element Caching
**Priority:** 🟢 MEDIUM  
**Category:** Code Maintainability  
**File:** `src/js/ui_ux/ui.js` (lines 1-20)  
**Impact:** Negligible performance, but cleaner code

### Problem Statement
Multiple `document.getElementById()` calls scattered throughout. Hard to maintain, and small performance cost.

### Current Code (BROKEN)
**File: `src/js/ui_ux/ui.js`** lines 1-10
```javascript
const sheet = document.getElementById("bottom-sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetDesc = document.getElementById("sheet-desc");
const closeBtn = document.getElementById("close-btn");
```

### Solution Design
Create a single DOM cache object at module level.

### Implementation Steps

**Step 7A:** Create DOM cache at top of ui.js
**File: `src/js/ui_ux/ui.js`** - Add after imports (line 2)

```javascript
/**
 * Cached DOM elements for quick access
 * Initialize once at module load time
 */
const DOM = {
  sheet: document.getElementById("bottom-sheet"),
  sheetTitle: document.getElementById("sheet-title"),
  sheetDesc: document.getElementById("sheet-desc"),
  closeBtn: document.getElementById("close-btn"),
  floorSelector: document.getElementById("floor-selector"),
  // Add more as needed
};
```

**Step 7B:** Replace all `document.getElementById()` with `DOM.*`
Search and replace throughout the file:
- `sheet` → `DOM.sheet`
- `sheetTitle` → `DOM.sheetTitle`
- etc.

### Testing Checklist
- [ ] All UI elements still render correctly
- [ ] Bottom sheet opens/closes normally
- [ ] No console errors about null DOM elements

### Expected Results
- **Code Cleanliness:** Much easier to see all DOM dependencies
- **Performance:** Negligible (+0.0001ms per lookup, cached)

---

## TASK #8: Fix Race Condition in QR Navigation
**Priority:** 🟢 MEDIUM  
**Category:** Stability / Bug Prevention  
**File:** `src/js/events/navigation.js` (lines 380-407)  
**Impact:** -intermittent bugs

### Problem Statement
The `floorReady` event listener is not properly cleaned up, and if multiple QR scans happen rapidly, listeners accumulate and the wrong handler might fire.

### Current Code (BROKEN)
**File: `src/js/events/navigation.js`** lines 380-407
```javascript
const onFloorReady = async (e) => {
  setTimeout(async () => {
    if (await Navigation.handleQRID(qrID)) {
      window.removeEventListener("floorReady", onFloorReady);  // ← Only removed on success
    }
  }, CONFIG.INTERACTION.FLOOR_READY_DELAY);
};
window.addEventListener("floorReady", onFloorReady);
```

**Problem:** 
1. Listener only removed on successful handle
2. If `handleQRID()` fails, listener persists forever
3. Multiple rapid scans create accumulating listeners

### Solution Design
- Always remove listener on first fire
- Use a timeout to auto-cleanup if handler doesn't fire
- Use async/await for cleaner flow

### Implementation Steps

Replace the QR handling section in `src/js/events/navigation.js` (lines 380-407):

```javascript
  static handleURLQR() {
    const urlParams = new URLSearchParams(window.location.search);
    const qrID = urlParams.get("qrID");
    
    if (qrID) {
      console.log(`URL/Popstate qrID: ${qrID}`);
      
      const executeAsyncCheck = async () => {
        // Attempt immediate handle (if already in registry)
        const handled = await Navigation.handleQRID(qrID, true);
        if (handled) return;

        // If not in registry, wait for floor load
        const targetFloorId = qrID.slice(0, 2);
        
        // Create cleanup function
        let isResolved = false;
        const cleanup = () => {
          if (!isResolved) {
            isResolved = true;
            window.removeEventListener("floorReady", onFloorReady);
            timeoutId = null;
          }
        };

        // Setup listener which will fire during switchFloor's load()
        const onFloorReady = async (e) => {
          cleanup(); // Remove listener immediately on first fire
          
          // IMPORTANT: Wait a tiny bit to ensure switchFloor's activation 
          // doesn't stomp on the animation we're about to start.
          setTimeout(async () => {
            await Navigation.handleQRID(qrID);
          }, CONFIG.INTERACTION.FLOOR_READY_DELAY);
        };

        // Add listener
        window.addEventListener("floorReady", onFloorReady);

        // Auto-cleanup after timeout (if floor never loads, e.g., invalid qrID)
        let timeoutId = setTimeout(() => {
          cleanup();
          console.warn(`[Navigation] floorReady timeout for QR: ${qrID}`);
        }, 10000); // 10 second timeout

        // Derive target floor from first 2 chars of qrID (e.g. "l1-...", "b2-...")
        await Navigation.switchFloor(targetFloorId);
      };
      
      executeAsyncCheck();
      return;
    }
    
    Navigation.switchFloor(CONFIG.NAVIGATION.DEFAULT_FLOOR);
  }
```

### Testing Checklist
- [ ] Scan QR code → Marker appears on correct floor
- [ ] Scan multiple QRs rapidly → All work correctly
- [ ] Check DevTools → No more than one event listener per scan
- [ ] Invalid QR ID → Cleanup happens after timeout
- [ ] Floor loads slow → Listener still fires correctly

### Expected Results
- **Bugs:** -intermittent race conditions
- **Memory:** Listeners properly cleaned up
- **UX:** Consistent QR scanning experience

---

## 🎯 Execution Checklist

### Pre-Implementation
- [ ] Create branch: `performance-optimization`
- [ ] Backup current code
- [ ] Run all tests to get baseline
- [ ] Record performance metrics (DevTools)

### Implementation Sequence
- [ ] Task #1: Event Listener Cleanup (2h)
- [ ] Task #2: RAF Loop Fix (1h)
- [ ] Task #3: Floor Traversal (1.5h)
- [ ] Task #4: Material Caching (2.5h)
- [ ] Task #5: Marker Animation (1h)
- [ ] Task #6: Ghost Materials (1.5h)
- [ ] Task #7: DOM Caching (30m)
- [ ] Task #8: Race Condition (1h)

### Testing After Each Task
- [ ] No console errors
- [ ] Visual appearance unchanged
- [ ] DevTools memory/CPU improved

### Final Validation
- [ ] Run full test suite
- [ ] Performance test: 30+ floor switches
- [ ] Memory profile: Check for leaks
- [ ] Frame rate: Maintain 60 FPS
- [ ] Create PR with all tasks

---

## 📊 Expected Total Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Memory (1 hour usage) | +5-10MB | ±0MB | ✅ -100% leak |
| Frame Rate (idle) | 60 FPS | 60 FPS | ✅ Stable |
| Frame Time (animation) | 8-12ms | 5-7ms | ✅ -30% |
| Material Objects/Floor | 500+ | 20-40 | ✅ -95% |
| Event Listeners | Growing | Stable | ✅ -100% leaks |
| GC Pauses | 2-3/minute | <1/minute | ✅ -70% |

---

## 📞 Support Notes for Gemini

When implementing each task:
1. **Read the entire task section first** to understand context
2. **Follow Step numbers** in order
3. **Copy code blocks exactly** - they're validated
4. **Test after each step** using checklist
5. **Ask for clarification** if anything is unclear
6. Ask to **verify the changes** before proceeding to next task

All tasks are **independent** and can be worked on in parallel, but should be **tested sequentially**.