/**
 * Manages floor navigation and visibility state.
 */
export class FloorState {
  constructor() {
    /** @type {Object.<string, Floor>} */
    this.floors = {};
    /** @type {Floor | null} */
    this._currentFloor = null;
    /** @type {boolean} */
    this.isChildFloor = false;
  }

  /**
   * @returns {Floor | null}
   */
  get currentFloor() {
    return this._currentFloor;
  }

  /**
   * @param {Floor} floor
   */
  set currentFloor(floor) {
    this._currentFloor = floor;
    this.isChildFloor = floor ? !!floor.parentFloorId : false;
  }

  /**
   * Registers a floor instance in the state registry.
   * @param {Floor} floor
   */
  registerFloor(floor) {
    this.floors[floor.id] = floor;
  }
}