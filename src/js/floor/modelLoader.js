let loader = null;

/**
 * Fetches and parses a single GLB from jsDelivr, caching the result.
 * On subsequent calls with the same path, returns the cached GLTF instantly.
 * @param {string} relativePath - e.g. "models/njc-l1-v2-31-3.glb"
 */
export async function loadModel(relativePath) {
  const url = `${ASSETS_BASE_URL}/${relativePath}`;

  if (!loader) {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    loader = new GLTFLoader();
  }

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        console.log(`[modelLoader] Loaded: ${relativePath}`);
        resolve(gltf);
      },
      () => {},
      (error) => {
        console.error(`[modelLoader] Error loading ${relativePath}:`, error);
        reject(error);
      }
    );
  });
}
