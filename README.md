# Funtasia 3D Interactive Map

Welcome to the Funtasia 3D Map project! This is a ~~high-performance~~(yeah, right)<!--If my nan had wheels she'd be a bike-->, web-based interactive map designed for Funtasia 2026. It uses **Three.js** for 3D rendering, **Vite** for the build pipeline, and **Tailwind CSS** for a responsive, modern UI. It also primarily uses the [Catppuccin](https://catppuccin.com/) Mocha and Latte themes by using the [Tailwind package](https://github.com/catppuccin/tailwindcss).

# Project Overview

The app allows users to navigate a multi-level 3D building model, search for booths, view event schedules, and scan QR codes to find their current location. It features a "Ghost Layer" system to view multiple floors simultaneously ~~and a pathfinding system for navigation~~(not yet, stupid AI). <!--Dammit why does Gemini keep reading notes/ even after i ask it to look at the code instead-->

# Project Structure

```
app-funtasia/
├── src/
│   ├── css/            # CSS files used
│   └── js/
│       ├── base/       # Entrypoint to the JS codebase
│       ├── feature/    # Key features unrelated to map (events list, directory)
│       ├── event/      # JS relating to user input events (Not to be confused with feature/events.js)
│       ├── floor/      # JS relating to how each floor is processed and handled
│       ├── helper/     # Helper functions used by other files
│       ├── marker/     # Defines all the different types of markers
│       └── ui_ux/      # Relates to appearance of 3D map and UI elements with relation to the map
├── public/             # Files that will be available at / on the server
├── notes/              # Notes used for previous implementation plans WHICH ARE NOT ACCURATE AND NOT REFLECTIVE OF THE CURRENT PROJECT
├── docs/               # Project documentation
├── assets-funtasia/    # Submodule for easier access for local version of assets during development
├── index.html          # Main html file for the 3D map
├── 404.html            # 404 page
├── vite.config.json    # Config for Vite which defines how the project is built
└── .env*               # Environment variables which change whether on dev server (.development) or building for production (.production)
```

# Quickstart

## Prerequisites

- [node.js](https://nodejs.org/en/download)

```bash
git clone --recursive https://github.com/Funtasia/app-funtasia.git
cd app-funtasia
npm i

# Start a local dev server on port 5317
npm run dev

# Build and preview the project
npm run build # Builds the project into dist/
npm run preview
```

# See also
- [docs/OUTLINE.md](./docs/OUTLINE.md)
- [docs/CONFIGURATION.md](./docs/CONFIGURATION.md)