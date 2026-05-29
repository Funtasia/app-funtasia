/**
 * Funtasia Central Configuration
 * Consolidates all static constants, theme schemas, and model-specific defaults.
 */

export const CONFIG = {
  // Using Vite-injected globals directly
  VERSION: VERSION,
  ASSETS_BASE_URL: ASSETS_BASE_URL,

  MODELS: {
    FLOORS: {
      l2: `models/${VERSION}/njc-l2-${VERSION}.glb`,
      l1: `models/${VERSION}/njc-l1-${VERSION}.glb`,
      b1: `models/${VERSION}/njc-b1-${VERSION}.glb`,
      b2: `models/${VERSION}/njc-b2-${VERSION}.glb`,
      b3: `models/${VERSION}/njc-b3-${VERSION}.glb`,
    },
    CHILDREN: {
      canteen:   { floorId: "l1", nodeName: "Canteen",           path: `models/${VERSION}/njc-l1-canteen-${VERSION}.glb`   },
      sanctuary: { floorId: "l1", nodeName: "Sanctuary",         path: `models/${VERSION}/njc-l1-sanctuary-${VERSION}.glb` },
      hall:      { floorId: "l2", nodeName: "CCA Booths @ Hall", path: `models/${VERSION}/njc-l2-hall-${VERSION}.glb`      },
      ish:       { floorId: "b3", nodeName: "ISH",               path: `models/${VERSION}/njc-b3-ish-${VERSION}.glb`       },
    },
    ROLE_MAP: {
      "ATOILET": "atoilet",
      "MTOILET": "mtoilet",
      "FTOILET": "ftoilet",
      "LIFT": "lift",
      "STAIRCASE": "staircase",
      "DOOR": "door"
    }
  },

  // Navigation & Floor Stack
  NAVIGATION: {
    FLOOR_ORDER: ['b3', 'b2', 'b1', 'l1', 'l2'],
    GHOST_SPACING: 1.234567,
    MARKER_GREY_DELAY: 5 * 60000, // 5 minutes
    DEFAULT_FLOOR: 'l1'
  },

  // Camera Behaviors
  CAMERA: {
    DEFAULTS: {
      distance: 8,
      heightOffset: 6,
      lerpFactor: 0.05,
      lookAtOffset: { x: 0, y: 1, z: 0 }
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

  // UI & Directory
  DIRECTORY: {
    FALLBACK_TAG_COLOR: "#6b7280",
    ZONE_COLORS: { //CSS variables to check, value of variables changes on theme change
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
      "NONOBJECT": '--color-ctp-flamingo-950',
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
      "BROWN":  '--color-ctp-flamingo-900',
    },
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