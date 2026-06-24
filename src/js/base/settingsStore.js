/**
 * Manages application settings persisted to localStorage.
 */
export class SettingsStore {
  constructor() {
    /** @type {boolean} */ this._rotationLocked     = this._read('funtasia-rotation-lock', true);
    /** @type {boolean} */ this._autoFocusEnabled   = this._read('funtasia-autofocus',     true);
    /** @type {boolean} */ this._ghostLayersEnabled = this._read('funtasia-ghost-layers',  true);

    /** @type {string}  */ this._theme              = this._readTheme(); // "mocha" | "latte"
    /** @type {boolean} */ this._showIcons          = this._read('funtasia-show-icons', true);
    /** @type {boolean} */ this._showTextMarkers    = this._read('funtasia-show-text-markers', true);
    /** @type {boolean} */ this._showBoothMarkers   = this._read('funtasia-show-booth-markers', true);
  }

  get rotationLocked() { return this._rotationLocked; }
  set rotationLocked(v) { this._rotationLocked = v; this._write('funtasia-rotation-lock', v); }

  get autoFocusEnabled() { return this._autoFocusEnabled; }
  set autoFocusEnabled(v) { this._autoFocusEnabled = v; this._write('funtasia-autofocus', v); }

  get ghostLayersEnabled() { return this._ghostLayersEnabled; }
  set ghostLayersEnabled(v) { this._ghostLayersEnabled = v; this._write('funtasia-ghost-layers', v); }

  get theme() { return this._theme; }
  set theme(v) { this._theme = v; this._write('funtasia-theme', v); }

  get showIcons() { return this._showIcons; }
  set showIcons(v) { this._showIcons = v; this._write('funtasia-show-icons', v); }

  get showTextMarkers() { return this._showTextMarkers; }
  set showTextMarkers(v) { this._showTextMarkers = v; this._write('funtasia-show-text-markers', v); }

  get showBoothMarkers() { return this._showBoothMarkers; }
  set showBoothMarkers(v) { this._showBoothMarkers = v; this._write('funtasia-show-booth-markers', v); }


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
   * Internal helper to read theme from localStorage
   * @returns {string}
   * @private
   */
  _readTheme() {
    const stored = localStorage.getItem('funtasia-theme');
    if (stored) return stored;
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    return (root && root.classList.contains('mocha')) ? 'mocha' : 'latte';
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
