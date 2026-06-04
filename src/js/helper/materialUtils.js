/**
 * Object providing helper methods for material updates within traverse loops.
 */
export const MaterialUpdater = {
    /**
     * Returns a function for use in .traverse() that sets a property.
     * @param {string} prop - The property to set (e.g., 'material' or 'opacity').
     * @param {any|Function} valueOrFn - The value to set, or a function (child) => value.
     */
    setProperty: (prop, valueOrFn) => (child) => {
        if (!child.isMesh && !child.isSprite) return;
        const value = (typeof valueOrFn === 'function') ? valueOrFn(child) : valueOrFn;
        if (prop === 'material') {
            child.material = value;
        } else if (child.material) {
            child.material[prop] = value;
        }
    }
};