# Funtasia App: Performance Optimization & Code Quality Plan

**Target:** Google Gemini/Claude Implementation  
**Priority:** Critical → High → Medium  
**Scope:** JavaScript only (src/js directory)  
**Last Updated:** 2026-06-04 (Latest Commit: `1a74a23`)

---

## 📋 Status Overview

| Task ID | Priority | Category | Status | Notes |
|---------|----------|----------|--------|-------|
| [#1](#task-1-event-listener-cleanup) | 🔴 CRITICAL | Memory | 🟠 PARTIAL | Implemented in navigation.js, needs full event.js extraction |
| [#2](#task-2-fix-raf-loop-inefficiency) | 🔴 CRITICAL | Perf | ✅ COMPLETE | Fixed in ui.js - RAF loop now stops properly |
| [#3](#task-3-optimize-floor-traversal) | 🔴 CRITICAL | Perf | ✅ COMPLETE | `_isAnimating` flag & `startYAnimation()` implemented |
| [#4](#task-4-material-caching) | 🟡 HIGH | Memory | ✅ COMPLETE | MaterialCache class implemented in modelParser.js |
| [#5](#task-5-fix-duplicate-marker-animation) | 🟡 HIGH | Perf | ✅ COMPLETE | Set-based deduplication in animate.js |
| [#6](#task-6-pre-bake-ghost-materials) | 🟡 HIGH | Memory | ✅ COMPLETE | Ghost materials pre-baked, setFloorOpacity optimized |
| [#7](#task-7-dom-caching) | 🟢 MEDIUM | Maintainability | ✅ COMPLETE | DOM cache object created (const DOM) |
| [#8](#task-8-fix-race-condition) | 🟢 MEDIUM | Stability | ✅ COMPLETE | QR listener cleanup with timeout added |

**Overall Progress:** 6/8 Complete (75%) | 1/8 Partial (13%)

---

## ⚡ EASY PERFORMANCE WINS

### Win #4: Optimize Directory Marker Visibility Toggle
**File:** `src/js/events/navigation.js` (lines 310-321)  
**Issue:** Same visibility toggle logic repeated 2+ times

**Current Duplication:**
```javascript
// Line 310-321
const isMatch = appState.activeDirectoryMarker.level === floorId;
if (appState.activeDirectoryMarker.group) {
  appState.activeDirectoryMarker.group.visible = isMatch;
}

// Line 373-380 (repeated)
const isMatch = appState.activeDirectoryMarker.level === floorId;
appState.activeDirectoryMarker.group.visible = isMatch;
```

**Extract Helper:**
```javascript
// Add to navigation.js near top
static _updateDirectoryMarkerVisibility(floorId) {
  const appState = Navigation.appState;
  if (!appState.activeDirectoryMarker?.group) return;
  
  const isMatch = appState.activeDirectoryMarker.level === floorId;
  appState.activeDirectoryMarker.group.visible = isMatch;
  
  if (isMatch && !appState.activeMarkers.includes(appState.activeDirectoryMarker)) {
    appState.activeMarkers.push(appState.activeDirectoryMarker);
  }
}

// Then call it instead of repeating logic:
Navigation._updateDirectoryMarkerVisibility(floorId);
```

**Impact:** -16 LOC, better maintainability

---

## 🔴 CRITICAL BUGS TO FIX

### Bug #1: Material Memory Leak in `applySelection()`
**File:** `src/js/ui_ux/cameraUtils.js`  
**Issue:** NEW materials created each time, never disposed!

**Current:**
```javascript
// Every time you click a new object:
const wallHighlightMaterial = new THREE.MeshBasicMaterial({color: wallHighlightColor});
const topHighlightMaterial = new THREE.MeshBasicMaterial({color: topHighlightColor});
// ❌ These pile up if you keep clicking different objects
```

**Fix:** Cache highlight materials globally

```javascript
// At module level
let cachedHighlightMaterials = new Map();

export function applySelection(target, appState) {
  if (appState.selected === target) return;

  if (appState.selected) {
    appState.selected.traverse(MaterialUpdater.setProperty('material', (c) => c.userData.originalMaterial || c.userData.material));
  }

  appState.selected = target;

  if (appState.selected) {
    const baseColor = new THREE.Color(zoneColours[appState.selected.userData.ZONE]);
    const colorKey = baseColor.getHexString();

    // ✅ Check cache first
    if (!cachedHighlightMaterials.has(colorKey)) {
      const wallColor = baseColor.clone().multiplyScalar(1.4);
      const topColor = baseColor.clone().multiplyScalar(1.6);
      
      cachedHighlightMaterials.set(colorKey, {
        wall: new THREE.MeshBasicMaterial({color: wallColor}),
        top: new THREE.MeshBasicMaterial({color: topColor})
      });
    }

    const materials = cachedHighlightMaterials.get(colorKey);
    appState.selected.traverse(MaterialUpdater.setProperty('material', (c) => 
      c.name.endsWith('_2') ? materials.top : materials.wall
    ));
  }
}
```

**Impact:** +0 LOC (net), eliminates material leak, ~10-15 materials per session saved
