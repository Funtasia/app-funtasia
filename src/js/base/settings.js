import * as THREE from "three";

// ---------------------------------------------------------------------------
// Toggle configuration — add/remove/reorder settings here only.
// ---------------------------------------------------------------------------
const TOGGLE_CONFIG = [
  {
    section: 'mapElements',
    label: 'Show POI Icons',
    description: 'Toggle icons on the map',
    settingKey: 'showIcons',
    onToggle: (state, _, { Icon }) => Icon.state(state),
  },
  {
    section: 'mapElements',
    label: 'Location Labels',
    description: 'Toggle text labels for major areas (Hall, Canteen, etc.)',
    settingKey: 'showTextMarkers',
    onToggle: (state, _, { TextMarker }) => TextMarker.state(state),
  },
  {
    section: 'mapElements',
    label: 'Booth Labels',
    description: 'Toggle text labels for individual booths',
    settingKey: 'showBoothMarkers',
    onToggle: (state, _, { BoothIDMarker }) => BoothIDMarker.state(state),
  },
  {
    section: 'visualsSection',
    label: 'Ghost Layers',
    description: 'View lower levels as translucent layers',
    settingKey: 'ghostLayersEnabled',
    onToggle: (_, appState) => appState.ui.updateFloorVisibilities(),
  },
  {
    section: 'visualsSection',
    label: 'Dark Mode',
    description: 'Toggle dark mode',
    settingKey: 'theme',
    // theme is a string ("mocha"|"latte"), so we transform to/from boolean for the toggle
    transform: { read: v => v === 'mocha', write: v => v ? 'mocha' : 'latte' },
    onToggle: (isDark, appState, { applyThemeToScene }) => {
      document.documentElement.classList.toggle('mocha', isDark);
      document.documentElement.classList.toggle('latte', !isDark);
      applyThemeToScene(appState);
    },
  },
  {
    section: 'controlsSection',
    label: 'Rotation Lock',
    description: 'Lock the rotation of the 3D model',
    settingKey: 'rotationLocked',
    onToggle: (isLocked, appState, { animateCameraTo }) => {
      if (appState.controls) {
        appState.controls.enableRotate = !isLocked;
        appState.controls.touches.TWO = isLocked
          ? THREE.TOUCH.DOLLY_PAN
          : THREE.TOUCH.DOLLY_ROTATE;
      }
      if (isLocked && appState.currentFloor?.cameraConfig) {
        const { initialPosition, target } = appState.currentFloor.cameraConfig;
        animateCameraTo(appState, initialPosition, target, true);
      }
    },
  },
  {
    section: 'controlsSection',
    label: 'Camera Auto-Focus',
    description: 'Smoothly animate the camera when selecting a location',
    settingKey: 'autoFocusEnabled',
    // No side effects — settings store write is sufficient
  },
];

// ---------------------------------------------------------------------------
// SettingsController — DOM builder
// ---------------------------------------------------------------------------
export class SettingsController {
  static init(containerId) {
    this.container = document.getElementById(containerId);
    if (this.container) {
      this.container.innerHTML = '';
      this.container.className = 'px-2 pb-8 space-y-6 overflow-y-auto hide-scrollbar';
    }
  }

  static addSection(title) {
    if (!this.container) return;

    const sectionDiv = document.createElement('section');
    sectionDiv.className = 'mt-6 first:mt-2';

    const headerTitle = document.createElement('h3');
    headerTitle.className = 'modal-section-title';
    headerTitle.innerHTML = title;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'overflow-hidden bg-ctp-mantle rounded-2xl';

    sectionDiv.appendChild(headerTitle);
    sectionDiv.appendChild(contentDiv);
    this.container.appendChild(sectionDiv);

    return contentDiv;
  }

  static addToggle(parentContainer, label, description, onToggle, initialValue = true) {
    const targetContainer = parentContainer || this.container;
    if (!targetContainer) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center justify-between p-4 cursor-pointer active:bg-surface-variant/50 transition-colors';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'flex-1 pr-4';
    contentDiv.innerHTML = `
      <h3 class="text-ctp-text font-semibold text-[15px] leading-tight">${label}</h3>
      ${description ? `<p class="text-ctp-subtext1 text-sm mt-1 leading-snug">${description}</p>` : ''}
    `;

    const switchLabel = document.createElement('label');
    switchLabel.className = 'relative inline-flex items-center cursor-pointer pointer-events-none';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'sr-only peer';
    input.checked = initialValue;

    const slider = document.createElement('div');
    slider.className = "w-11 h-6 bg-ctp-surface2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all after:duration-300 peer-checked:bg-ctp-mauve transition-colors duration-300";

    switchLabel.appendChild(input);
    switchLabel.appendChild(slider);
    wrapper.appendChild(contentDiv);
    wrapper.appendChild(switchLabel);

    wrapper.addEventListener('click', () => {
      input.checked = !input.checked;
      onToggle?.(input.checked);
    });

    targetContainer.appendChild(wrapper);
    return wrapper;
  }
}

// ---------------------------------------------------------------------------
// setupSettings — wires TOGGLE_CONFIG to the DOM
// ---------------------------------------------------------------------------
export async function setupSettings() {
  SettingsController.init('settings-content-area');

  const sections = {
    controlsSection: SettingsController.addSection('Controls'),
    visualsSection:  SettingsController.addSection('Visual Preferences'),
    mapElements:     SettingsController.addSection('Map elements'),
  };

  const [
    { appState },
    { Icon },
    { TextMarker, BoothIDMarker },
    { applyThemeToScene },
    { animateCameraTo },
  ] = await Promise.all([
    import('@/js/base/appState'),
    import('@/js/marker/icon'),
    import('@/js/marker/textmarker'),
    import('@/js/floor/modelParser'),
    import('@/js/ui_ux/animate'),
  ]);

  const modules = { Icon, TextMarker, BoothIDMarker, applyThemeToScene, animateCameraTo };

  // Sync marker visibility with persisted settings on open
  Icon.state(appState.settings.showIcons);
  TextMarker.state(appState.settings.showTextMarkers);
  BoothIDMarker.state(appState.settings.showBoothMarkers);

  for (const cfg of TOGGLE_CONFIG) {
    const raw = appState.settings[cfg.settingKey];
    const initialValue = cfg.transform ? cfg.transform.read(raw) : raw;

    SettingsController.addToggle(
      sections[cfg.section],
      cfg.label,
      cfg.description,
      (state) => {
        appState.settings[cfg.settingKey] = cfg.transform ? cfg.transform.write(state) : state;
        cfg.onToggle?.(state, appState, modules);
      },
      initialValue
    );
  }
}
