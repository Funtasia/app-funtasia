# Warning: This file was initially AI generated with numerous edits made by me. I cannot yet fully guarantee its accuracy.

# Funtasia 3D Interactive Map

Welcome to the Funtasia 3D Map project! This is a ~~high-performance~~(yeah, right), web-based interactive map designed for Funtasia 2026. It uses **Three.js** for 3D rendering, **Vite** for the build pipeline, and **Tailwind CSS** for a responsive, modern UI. It also primarily uses the [Catppuccin](https://catppuccin.com/) Mocha and Latte themes by using the [Tailwind package](https://github.com/catppuccin/tailwindcss).

## 🚀 Project Overview

The app allows users to navigate a multi-level 3D building model, search for booths, view event schedules, and scan QR codes to find their current location. It features a "Ghost Layer" system to view multiple floors simultaneously ~~and a pathfinding system for navigation~~(not yet, stupid AI).

## 🛠 Technical Stack

- **3D Rendering**: Three.js
- **Build Tool**: Vite
- **Styling**: Tailwind CSS (v4)
- **UI Components**: Catppuccin Theme system (Latte/Mocha)

## 📂 Key Architecture

To get acquainted with the code, focus on these files:

1.  **`index.html`**: Contains the UI skeleton (modals for directory, settings, and events) and initial theme synchronization logic. Also contains many static elements, such as the help menu.
2.  **`src/js/base/config.js`**: Central configuration. It maps model paths, defines floor orders, and sets color schemas.
3.  **`src/js/base/appState.js`**: Holds references to the Three.js scene, camera, renderer, and active application state (current floor, selection, etc.).
4. **`vite.config.js`**: Config options for Vite which specify how the project should be built, and also options for the local dev server
5. **`src/js/floor/modelParser.js`**: The bridge between 3D geometry and application logic. It injects metadata and handles object naming.

## Naming Conventions
The application relies on specific naming patterns to link 3D meshes to logic.

### 1. Blender Mesh Naming
| Category | Convention | Usage |
| :--- | :--- | :--- |
| **Booth/Object** | `[ID]` (e.g., `BG1`) | Matches `booth_id` in `funtasia_data.json`. |
| **Visual Splits** | `[Name]_1` and `[Name]_2` | `_1`: wall material <br> `_2`: top material |
| **QR Markers** | `{level}-m{number}-{name}` | `l1-m8-amphi`. Internal name used for URL params and object search. See more [below](#qr-system) |

### 2. Blender "Custom Properties" (userData)
These must be set in Blender's **Object Properties > Custom Properties** panel before exporting to GLTF.

| Property | Values | Description |
| :--- | :--- | :--- |
| `ROLE` | `CONFIG.MODELS.ROLES` | Defines how the mesh is processed and colored. Generated from `config.js` |
| `ZONE` | `CONFIG.MODELS.ZONES` | Used if `ROLE` is `OBJECT`. Sets color from keys of `CONFIG.THEME.ZONE_SCHEMA`. |
| `MARKERID` | Numeric String (e.g., `8`) | Used if `ROLE` is `MARKER`. Maps to physical QR location tags. |
| `STAIRCASEDIRECTION` | `U`, `D`, `UD` | Used if `ROLE` is `STAIRCASE` to determine the icon displayed (Up, Down, or both). |

### 3. Special Role Behaviors
*   **`ROLE: "GREY"`**: Mesh is made completely transparent (`opacity: 0`). Used for collision or invisible triggers.
*   **`ROLE: "OBJECT"`**: Mesh becomes interactive. If found in the JSON data, it will show a label and be clickable.
*   **`ROLE: "MARKER"`** Mesh is almost invis, and it shows a text/icon.
*   **Decorative Roles**: Roles listed in `CONFIG.MODELS.DECORATIVE_ROLES` (e.g., `FOOT`, `GRASS`, `DRIVE`) automatically use `polygonOffset` to prevent "Z-fighting" (flickering) when placed exactly on top of the base floor mesh.

## ⚙️ Configuration

### 1. Asset Hosting
In `vite.config.js`, update the `ASSETS_BASE_URL`. By default, it points to the jsDelivr CDN that points to the [`funtasia_assets`](https://github.com/garethlearnscoding/funtasia_assets/tree/main) repo (available as submodule). To update assets, you will also need to fork the `funtasia_assets` repo and update the jsDelivr link to [point to your repo](https://www.jsdelivr.com/?docs=gh).

### 2. Model Mapping
Open `src/js/base/config.js` and update the `MODELS` object. 
- `FLOORS`: Maps floor IDs (e.g., `l1`, `b1`) to their `.glb` file paths relative to the ASSETS_BASE_URL.
- `CHILDREN`: Defines child models (like the Canteen or Hall) that are loaded inside specific parent floors.

### 3. Data Source (`funtasia_data.json`)
TL;DR: Google sheets -> `.csv` -> `.json` -> promoted to `funtasia_assets` repo

The directory is based on a [Google sheets spreadsheet](https://docs.google.com/spreadsheets/d/1XRPx2ZcikyZykce8x2-sKBLCl2eSoay8EKH2Kdq2e60/edit) which is exported as a csv to [`./json_data`](./json_data/). Then the csv is processed using `parse.py` in the same folder to turn it into a `funtasia_data.json`. Finally, the json file is promoted to be in the `funtasia_assets` repo. (Remember this step!) 

Ensure your booth IDs in the spreadsheet match the object names in your .glb files (e.g., a mesh named `BG1` in Blender should correspond to the `booth_id` `BG1` in the spreadsheet).

## 🎨 3D Pipeline 

**TODO!** I myself do not have knowledge of the 3D modelling process, that is for another time.

## 🏗 Building and Deployment

### Prerequisites
- Node.js
- Dependencies listed in `package.json`, which can be installed with:
```bash
npm install
```
Note: this has mainly been tested on Linux and WSL. Other environements may or may not be supported.

### Local Development
Start the Vite dev server:
```bash
# Opens a dev server at localhost:5317
# Port number can be configured in vite.config.js
npm run dev
```

### Production Build
The project is optimized for performance using `three-minifier` and `vite-plugin-minify` to keep the bundle size small. Also uses `vite-plugin-compression2` to compress files that supported servers and clients can use instead, which reduces file sizes by 50-70%.

```bash
# Builds the project into the dist/ folder
npm run build
```
### Deployment
The project is designed to be hosted on static hosting services like **GitHub Pages**, **Vercel**, or **Netlify**.
1.  Ensure `base` in `vite.config.js` matches your deployment subdirectory (use `""` for root).
2.  Upload the contents of `dist/`.

#### Example for **Github Pages**
1. Create a branch called `gh-pages`.
2. Configure your Github repository to deploy from the `gh-pages` branch.
3. Use the `./cmd/deploy.sh` script to automatically build and deploy the project.

Note: In theory, it is possible to have the build and deployment run on Github Actions, feel free to implement it if you want.

## 📝 Development Notes

### Welcome screen and info menu
-   The welcome screen will appear only on the first visit. This is detected through the lack of the presence of a key in local storage. The info menu/help menu is easily editable through just editing `index.html`.

### QR System
-   The QR marker ID in the model must follow the naming convention of `<Level>`-`m<MarkerNo>`-`<MarkerName>`, where:
    -   Level: Internal floor ID (e.g., `l1` for Level 1, `b2` for Basement 2).
    -   MarkerNo: Unique number for the marker per level (MarkerNo is unique within each level, not necessarily unique across levels)
    -   MarkerName: A name for the marker to help us know the general location of the marker by just looking at it, can be anything and is unimportant. (e.g. l1-m8-amphi for the QR marker near the Amphitheatre)
-   The **Manual Input System** uses the format `<NumericFloorPrefix><FloorNumber>`-`<MarkerNo>`. 
    -   The `NumericFloorPrefix` is `1` for levels (e.g., `12` for Level 2) and `0` for basements (e.g., `03` for Basement 3).
    -   Note the lack of the leading 'm' before the marker number. 
    -   The `MarkerNo` may be 0-padded, but this will be stripped before processing.
-   The **URL GET Query** (`?qrID=`) uses the full internal marker ID (mesh name) found in the model (e.g. `l1-m1-aesthetics`) and will instantly focus the camera on the marker on page load.

#### ID Mapping Logic (Manual Input)
The system automatically maps manual input to the internal floor IDs:
| Manual Input Example | Maps to Internal Floor ID |
| :--- | :--- |
| `11-1`/`11-01` | `l1-m1` |
| `01-1`/`01-01` | `b1-m1` |
