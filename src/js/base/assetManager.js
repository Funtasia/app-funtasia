/**
 * Manages asset tracking and localStorage persistence for loaded resources.
 */
export class AssetManager {
  constructor() {
    /** @type {Set<string>} */
    this.loadedAssets = new Set();
    this._loadPreloadedAssets();
  }

  /**
   * Records that an asset has been loaded and persists to localStorage if new.
   * @param {string} path - The asset path to track
   * @returns {boolean} true if the asset was newly recorded
   */
  recordAssetLoaded(path) {
    const isNew = !this.loadedAssets.has(path);
    if (isNew) {
      this.loadedAssets.add(path);
      this._persistAssets();
    }
    return isNew;
  }

  /**
   * Loads previously tracked assets from localStorage into the Set.
   * @private
   */
  _loadPreloadedAssets() {
    try {
      const preloaded = JSON.parse(localStorage.getItem('funtasia_preloaded_assets') || '[]');
      preloaded.forEach(path => this.loadedAssets.add(path));
    } catch (e) {
      this.loadedAssets = new Set();
    }
  }

  /**
   * Persists the current Set of loaded assets to localStorage as a JSON array.
   * @private
   */
  _persistAssets() {
    localStorage.setItem('funtasia_preloaded_assets', JSON.stringify([...this.loadedAssets]));
  }

  /**
   * Clears all tracked assets and removes persistence.
   */
  clear() {
    this.loadedAssets.clear();
    localStorage.removeItem('funtasia_preloaded_assets');
  }
}