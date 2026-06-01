/**
 * Funtasia Central Configuration
 * 
 * Consolidates all static constants, theme schemas, and model-specific defaults.
 */

// Define functional roles that don't necessarily have a 1:1 color mapping in MISC_SCHEMA
// Basically roles that have a special behavior
// Refer to README.MD under Special Role Behaviors
const FUNCTIONAL_ROLES = ["OBJECT", "MARKER", "GREY"];

// Note that idk what some constants do
export const CONFIG = {
  MODELS: {
    // Dynamically generated from THEME schemas + functional roles
    get ROLES() { return [...FUNCTIONAL_ROLES, ...Object.keys(CONFIG.THEME.MISC_SCHEMA)]; },
    get ZONES() { return Object.keys(CONFIG.THEME.ZONE_SCHEMA); },

    // Path of the model files relative to ASSETS_BASE_URL
    FLOORS: {
      l2: `models/${VERSION}/njc-l2-${VERSION}.glb`,
      l1: `models/${VERSION}/njc-l1-${VERSION}.glb`,
      b1: `models/${VERSION}/njc-b1-${VERSION}.glb`,
      b2: `models/${VERSION}/njc-b2-${VERSION}.glb`,
      b3: `models/${VERSION}/njc-b3-${VERSION}.glb`,
    },
    // Same as above, but for child models
    CHILDREN: {
      canteen:   { floorId: "l1", nodeName: "Canteen",           path: `models/${VERSION}/njc-l1-canteen-${VERSION}.glb`   },
      sanctuary: { floorId: "l1", nodeName: "Sanctuary",         path: `models/${VERSION}/njc-l1-sanctuary-${VERSION}.glb` },
      hall:      { floorId: "l2", nodeName: "CCA Booths @ Hall", path: `models/${VERSION}/njc-l2-hall-${VERSION}.glb`      },
      ish:       { floorId: "b3", nodeName: "ISH",               path: `models/${VERSION}/njc-b3-ish-${VERSION}.glb`       },
    },
    // uh idk man
    ROLE_MAP: {
      ATOILET: "atoilet",
      MTOILET: "mtoilet",
      FTOILET: "ftoilet",
      LIFT: "lift",
      STAIRCASE: "staircase",
      DOOR: "door"
    },
    // Roles that are flat and should be offset to avoid clashing with floor
    DECORATIVE_ROLES: ["FOOT", "GRASS", "DRIVE"]
  },

  // Navigation & Floor Stack
  NAVIGATION: {
    FLOOR_ORDER: ['b3', 'b2', 'b1', 'l1', 'l2'],

    // Vertical spacing between ghost models
    GHOST_SPACING: 1.234567, // Arbitrary, adjust until looks good

    // Minumum time for QR Location marker to turn grey
    MARKER_GREY_DELAY: 5 * 60000, // 5 minutes

    // Floor shown when loading in
    DEFAULT_FLOOR: 'l1'
  },

  INTERACTION: {
    TAP_THRESHOLD: 250,      // Max duration for a "tap" vs "drag" in ms
    FLOOR_READY_DELAY: 50    // Delay after floor switch before QR snapping when `?qrID=` in url params
  },

  UI: {
    TOAST_DURATION: 3000,
    LOAD_TOAST_DURATION: 15000
  },

  // Camera Behaviors
  CAMERA: {
    DEFAULTS: {
      distance: 8,
      heightOffset: 6,
      lookAtOffset: { x: 0, y: 1, z: 0 }
    },
    PROJECTION: {
      fov: 60,
      near: 0.1,
      far: 2000
    },
    CONTROLS: {
      minDistance: 10,
      maxDistance: 200,
      maxPolarAngle: Math.PI / 2.3, // ~1.36 rad
      dampingFactor: 0.08
    },
    ANIMATION: {
      viewDistanceFactor: 1.2,
      viewHeightFactor: 0.8,
      lerpFactor: 0.05
    },
    PARSER_DEFAULTS: {
      radiusFixed: 20,
      childInitialYFactor: 1.4,
      childInitialZFactor: 2.0
    }
  },

  MARKERS: {
    URLS: {
      GOOGLE_MAP_ICON: `${ASSETS_BASE_URL}/icons/google-map-icon.glb`,
      FONT: "https://cdn.jsdelivr.net/gh/JetBrains/JetBrainsMono@2.304/fonts/ttf/JetBrainsMono-Regular.ttf"
    },
    PHYSICS: {
      bobSpeed: 0.003,
      bobFreq: 0.5,
      bobAmp: 0.05
    },
    LOCATION: {
      height: 0.8,
      textOffset: 0.4
    },
    // For text markers for each booth
    BOOTH: {
      zoomThreshold: 7.6,  // When to start showing the markers
      fontSize: 0.0267,
      height: 0.2,         // Vertical offset of marker from base
      bgPlaneHeight: 0.08  // Height of the text box
    },
    // For icons on map
    ICON: {
      baseScale: 0.4,
      scaleFactor: 0.08,
      minScaleRatio: 4.5, // Hide if smaller than baseScale / 4.5
      height: 0.5
    }
  },

  // UI & Directory
  DIRECTORY: {
    FALLBACK_TAG_COLOR: "#6b7280",
    // Mapping of zone to colors (as CSS variables) of each directory entry
    // look idk why some have -- and some don't, that's how it was and too lazy to change now
    // u can change it if u want
    ZONE_COLORS: {
      blue:   { bg: "bg-ctp-blue-50",   text: "text-ctp-blue",   bar: "bg-ctp-blue-500"  },
      green:  { bg: "bg-ctp-green-50",  text: "text-ctp-green",  bar: "bg-ctp-green-500" },
      orange: { bg: "bg-orange-50",     text: "text-orange-600", bar: "bg-orange-500"    },
      purple: { bg: "bg-ctp-mauve-50",  text: "text-ctp-mauve",  bar: "bg-ctp-mauve-500" },
      red:    { bg: "bg-ctp-red-50",    text: "text-ctp-red",    bar: "bg-ctp-red-500"   },
      yellow: { bg: "bg-yellow-50",     text: "text-yellow-600", bar: "bg-yellow-500"    },
      brown:  { bg: "bg-amber-50",      text: "text-amber-800",  bar: "bg-amber-600"     },
    },
    TAG_COLORS: {
      Game:        "--color-ctp-blue",
      Performance: "--color-ctp-mauve",
      Academic:    "--color-ctp-teal",
      Food:        "--color-ctp-maroon",
      Drinks:      "--color-ctp-sky",
      Merch:       "--color-ctp-peach",
      Photos:      "--color-ctp-pink",
      Info:        "--color-ctp-sapphire",
      Tickets:     "--color-ctp-flamingo",
      Services:    "--color-ctp-green",
      CCA:         "--color-ctp-lavender",
      "First Aid": "--color-ctp-red",
      "Glam Up":   "--color-ctp-rosewater"
    }
  },

  // 3D Theming & Materials
  THEME: {
    MISC_SCHEMA: {
      "BASE":      '--color-ctp-surface0',
      "DRIVE":     '--color-ctp-surface2',
      "FOOT":      '--color-ctp-flamingo',
      "GRASS":     '--color-ctp-green-900',
      "NONOBJECT": '--color-ctp-flamingo-950', // buildings but non-interactable
      "FTOILET":   '--color-ctp-pink',
      "MTOILET":   '--color-ctp-lavender',
      "ATOILET":   '--color-ctp-sky',
      "LIFT":      '--color-ctp-overlay1',
    },
    ZONE_SCHEMA: {
      "NONE":   '--color-ctp-overlay2',
      "GREEN":  '--color-ctp-green-300',
      "BLUE":   '--color-ctp-blue-600',
      "ORANGE": '--color-ctp-peach-400',
      "PURPLE": '--color-ctp-mauve',
      "YELLOW": '--color-ctp-yellow',
      "RED":    '--color-ctp-red',
      "BROWN":  '--color-ctp-flamingo-900', // ts legit took me a while to find a brown color that looks good in latte and mocha
    },
    // Mapping for ID to the generic location labels on map, arranged by level
    TEXT_MARKER_MAP: {
      l1: { 
        "Canteen": "Canteen", 
        "Amphi": "Amphitheatre", 
        "Atrium": "Atrium", 
        "NJCLOGO": "Plaza" 
      },
      l2: { 
        "Hall": "Hall", 
        "LT5": "LT5", 
        "LT1": "LT1", 
        "Amphitheatre": "Amphitheatre", 
        "NJCLOGO":"Plaza", 
        "Pasar Malam Food Street": "Pasar Malam Food Street" 
      },
      b2: { 
        "Gym": "Gymnasium" 
      },
      b3: { 
        "Field": "Field", 
        "ISH": "ISH", 
        "njcentrance": "Funtasia Entrance", 
        "njcexit":"Funtasia Exit" 
      }
    }
  }
};