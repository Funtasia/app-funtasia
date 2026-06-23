/**
 * Manages application settings persisted to localStorage.
 */
export class SettingsStore {
  constructor() {
    /** @type {boolean} */
    this._rotationLocked = this._read('funtasia-rotation-lock', true);
    /** @type {boolean} */
    this._autoFocusEnabled = this._read('funtasia-autofocus', true);
    /** @type {boolean} */
    this._ghostLayersEnabled = this._read('funtasia-ghost-layers', true);
  }

  /**
   * @returns {boolean}
   */
  get rotationLocked() { return this._rotationLocked; }
  /**
   * @param {boolean} val
   */
  set rotationLocked(val) {
    this._rotationLocked = val;
    this._write('funtasia-rotation-lock', val);
  }

  /**
   * @returns {boolean}
   */
  get autoFocusEnabled() { return this._autoFocusEnabled; }
  /**
   * @param {boolean} val
   */
  set autoFocusEnabled(val) {
    this._autoFocusEnabled = val;
    this._write('funtasia-autofocus', val);
  }

  /**
   * @returns {boolean}
   */
  get ghostLayersEnabled() { return this._ghostLayersEnabled; }
  /**
   * @param {boolean} val
   */
  set ghostLayersEnabled(val) {
    this._ghostLayersEnabled = val;
    this._write('funtasia-ghost-layers', val);
  }

  /**
   * Internal helper to read from localStorage.
   * @param {string} key 
   * @param {boolean} defaultValue 
   * @returns {boolean}
   * @private
   */
  _read(key, defaultValue) {
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    return val !== 'false';
  }

  /**
   * Internal helper to write to localStorage.
   * @param {string} key 
   * @param {boolean} val 
   * @private
   */
  _write(key, val) {
    localStorage.setItem(key, String(val));
  }
}
