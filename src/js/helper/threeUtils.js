/**
 * Shared Three.js utilities for memory management and scene traversal.
 */
export function disposeThreeObject(obj) {
    if (!obj) return;

    if (obj.geometry) {
        obj.geometry.dispose();
    }

    if (obj.material) {
        if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
        } else {
            obj.material.dispose();
        }
    }
}