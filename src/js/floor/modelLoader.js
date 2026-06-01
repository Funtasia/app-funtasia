let loader = null;

/**
 * Fetches and parses a single GLB from jsDelivr, caching the result.
 * On subsequent calls with the same path, returns the cached GLTF instantly.
 * @param {string} relativePath - e.g. "models/njc-l1-v2-31-3.glb"
 */
export async function loadModel(relativePath) {
  // Using Vite-injected ASSETS_BASE_URL global
  const url = `${ASSETS_BASE_URL}/${relativePath}`;
  console.log(`[modelLoader] Fetching: ${url}`);

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
      (xhr) => {
        if (xhr.lengthComputable) {
          const pct = ((xhr.loaded / xhr.total) * 100).toFixed(1);
          console.log(`[modelLoader] ${relativePath}: ${pct}%`);
        }
      },
      (error) => {
        console.error(`[modelLoader] Error loading ${relativePath}:`, error);
        reject(error);
      }
    );
  });
}
