import { Marker } from "@/js/marker/marker.js";

/**
 * ManagedMarker: A base class for markers that need to be globally managed
 * for visibility and level-specific display.
 * Subclasses (Icon, TextMarker, BoothIDMarker) will extend this.
 */
export class ManagedMarker extends Marker {
  // Static properties for global management
  static allManagedMarkers = [];
  static managedMarkersByLevel = {};
  static activeLevel = null;
  static visibleState = true; // Global visibility toggle for this type of marker

  constructor(parent, position, level) {
    super(parent, position, level);

    this.group.userData.isMarker = true;

    // Register this instance globally and by level
    ManagedMarker.allManagedMarkers.push(this);
    if (!ManagedMarker.managedMarkersByLevel[this.level]) {
      ManagedMarker.managedMarkersByLevel[this.level] = [];
    }
    ManagedMarker.managedMarkersByLevel[this.level].push(this);
  }

  /**
   * Sets the global visibility state for all markers of this type.
   * @param {boolean} isVisible - Whether markers of this type should be visible.
   */
  static state(isVisible) {
    this.visibleState = isVisible;
    ManagedMarker.allManagedMarkers.forEach(marker => {
      if (marker instanceof this) marker.updateVisibilityAndOpacity();
    });
  }

  /**
   * Sets the currently active level, affecting visibility of markers.
   * @param {string} levelId - The ID of the active floor/level.
   */
  static setLevel(levelId) {
    this.activeLevel = levelId;
    ManagedMarker.allManagedMarkers.forEach(marker => {
      if (marker instanceof this) marker.updateVisibilityAndOpacity();
    });
  }

  // Placeholder for subclasses to implement their specific visibility logic
  updateVisibilityAndOpacity() {
    // Subclasses must implement this based on their own `visibleState` and `activeLevel`
  }
}