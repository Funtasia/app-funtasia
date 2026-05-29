# Warning: This file was AI generated except for a few key edits made by me. I cannot fully guarantee the accuracy 100% YET.

# Funtasia 3D Interactive Map

Welcome to the Funtasia 3D Map project! This is a high-performance, web-based interactive map designed for carnivals and open houses. It uses **Three.js** for 3D rendering, **Vite** for the build pipeline, and **Tailwind CSS** for a responsive, modern UI. It also primarily uses the [Catppuccin](https://catppuccin.com/) Mocha and Latte themes by using the [Tailwind package](https://github.com/catppuccin/tailwindcss).

## 🚀 Project Overview

The app allows users to navigate a multi-level 3D building model, search for booths, view event schedules, and scan QR codes to find their current location. It features a "Ghost Layer" system to view multiple floors simultaneously ~~and a pathfinding system for navigation~~(not yet, stupid AI).

## 🛠 Technical Stack

- **Core**: Three.js
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (v4)
- **UI Components**: Native Modals, Catppuccin Theme system (Latte/Mocha)

## 📂 Key Architecture

To get acquainted with the code, focus on these files:

1.  **`index.html`**: Contains the UI skeleton (modals for directory, settings, and events) and initial theme synchronization logic. Also contains many static elements, such as the help menu.
2.  **`src/js/base/appState.js`**: Holds references to the Three.js scene, camera, renderer, and active application state (current floor, selection, etc.).
3.  **`src/js/base/config.js`**: Central configuration. It maps model paths, defines floor orders, and sets color schemas.

## ⚙️ Configuration

### 1. Asset Hosting
In `vite.config.js`, update the `ASSETS_BASE_URL`. By default, it points to jsdelivr CDN that points to this repo. To update assets, you will also need to fork the `funtasia_assets` repo (which is available as a submodule here) and update the jsdelivr link to point to your repo.

### 2. Model Mapping
Open `src/js/base/config.js` and update the `MODELS` object. 
- `FLOORS`: Maps floor IDs (e.g., `l1`, `b1`) to their `.glb` file paths.
- `CHILDREN`: Defines "detail" models (like the Canteen or Hall) that are loaded inside specific parent floors.

### 3. Data Source
The directory data is driven by `funtasia_data.json`. Ensure your booth IDs in the JSON match the object names in your Blender files (e.g., a mesh named `BG1` in Blender should correspond to the `BG1` key in the JSON).

## 🎨 3D Pipeline 

**TODO!** I myself do not have knowledge of the 3D modelling process, that is for another time

## 🛠 Dev server

### Prerequisites
- Node.js
- Dependencies listed in `package.json`, which can be installed with:
```bash
npm install
```
Note: this has mainly been tested on Linux and WSL. Other environements may or may not be supported.

### Local Development
Start the Vite dev server and the Tailwind CSS watcher:
```bash
# Opens a dev server at localhost:5317
# Port number is configured in vite.config.js
npm run dev
```

## 🏗 Building and Deployment

### Production Build
The project is optimized for performance using `three-minifier` and `vite-plugin-minify` to keep the bundle size small. Also uses `vite-plugin-compression2` to compress files that supported servers and clients can use instead, which reduces file sizes by 50-70%!

```bash
npm run build
```
The output will be in the `dist/` folder.

### Deployment
The project is designed to be hosted on static hosting services like **GitHub Pages**, **Vercel**, or **Netlify**.
1.  Ensure `base` in `vite.config.js` matches your deployment subdirectory (use `""` for root).
2.  Upload the `dist/` contents.

#### Example for **Github Pages**
1. Create a branch called `gh-pages`
2. Configure your Github repository to deploy from the `gh-pages` branch
3. Use the `./cmd/deploy.sh` script to automatically build and deploy the project

Note: In theory, it is possible to have the build and deployment run on Github Actions, feel free to implement it if you want.

## 📝 Development Notes

### Welcome screen and info menu
-   The welcome screen will appear only on the first visit. This is detected through the lack of the presence of a key in local storage. The info menu/help menu is easily editable through just editing `index.html`.

### QR System
-   The QR marker ID in the model must follow the naming convention of `<Level>`-`m<MarkerNo>`-`<MarkerName>`, where:
    -   Level: Basement levels are prefixed with '0' (e.g. 01-m1 for 1st marker at B1), other levels prefixed with '1'
    -   MarkerNo: Unique number for the marker per level (MarkerNo is unique within each level, not necessarily unique across levels)
    -   MarkerName: A name for the marker to help us know the general location of the marker by just looking at it, can be anything and is unimportant. (e.g. l1-m8-amphi for the QR marker near the Amphitheatre)
-   The manual input system goes by `<Level>`-`<MarkerNo>`. Note the lack of the leading 'm' before MarkerID. The MarkerNo may be 0-padded, but this will be stripped before processing
-   The GET query in the URL (`?qrID=`) uses the marker ID inside the model (e.g. l1-m1-aesthetics) and will instantly place the marker on page load.
