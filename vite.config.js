import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { threeMinifier } from "@yushijinhun/three-minifier-rollup";
import { ViteMinifyPlugin } from 'vite-plugin-minify'
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';
import { compression } from 'vite-plugin-compression2'

// for when hosting on github pages using project sites
// const base = "/funtasia_app/"
const base = ""

export default defineConfig({
  base:base,  
  plugins: [
    threeMinifier(), // 7kB saved
    ViteMinifyPlugin({removeAttributeQuotes: true, removeComments: true, removeRedundantAttributes: true}), // 1kB saved
    tailwindcss(),
    compression(), // compresses files
  ],
  define: {
    ASSETS_BASE_URL: JSON.stringify('https://cdn.jsdelivr.net/gh/garethlearnscoding/funtasia_assets@1.0.1'),
    VERSION: JSON.stringify('v6-8-5') // version number used for models
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)) // for resolution of imports in the js files
    }
  },
  assetsInclude: ['**/*.glb'],
  server: {
    port:5317,
    allowedHosts: ["chunky-toaster.seagull-hippocampus.ts.net","broken-toaster.seagull-hippocampus.ts.net"], // for dev testing, raw IP addresses work
    host:true, // whether to host only on localhost (false) or on all addresses (true)
  },
  build: {
    minify: "terser",
    terserOptions: {
      toplevel: true,
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        notfound404: resolve(__dirname, "404.html")
      },
      output: {
        manualChunks(id) {
          // split three.js into seperate chunk from other node_modules
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              if (id.includes('GLTFLoader.js')) {
                return 'vendor-three-gltf-loader';
              }
              if (id.includes('OrbitControls.js')) {
                return 'vendor-three-orbit-controls';
              }
              if (id.includes('three.module.js')) {
                return 'vendor-three-module';
              }
              if (id.includes('three.core.js')) {
                return 'vendor-three-core';
              }
              if (id.includes('troika-three')) {
                return 'vendor-troika-three';
              }
              return 'vendor-three-other';
            } 
            if (id.includes('html5-qrcode')) {
              if (id.includes('zxing-js')) {
                return 'vendor-html5-qrcode-xzing-js';
              }
              return 'vendor-html5-qrcode';
            }
            return 'vendor-other';
          }
        }
      }
    }
  }
});
