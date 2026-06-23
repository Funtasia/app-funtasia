/**
 * Manages active markers and directory navigation state.
 */
export class MarkerState {
  constructor() {
    /** @type {Array} */
    this.activeMarkers = [];
    /** @type {Marker | null} */
    this.activeDirectoryMarker = null;
    /** @type {string | null} */
    this.activeDirectoryBoothId = null;
    /** @type {string | null} */
    this.activeDirectoryLevel = null;
    /** @type {Floor | null} */
    this.activeDirectoryActualFloor = null;
  }
}