import * as THREE from "three";
import { DirectoryMarker } from '@/js/marker/directorymarker.js';
import { appState } from "@/js/base/appState.js"; 
import { CONFIG } from "@/js/base/config.js"

/* ── Filter State ────────────────────────────────────────── */

class Directory {
  constructor() {
    this.cachedFuntasiaData = null;
    this.filterState = {
      search: "",
      level: "",      // "" = all
      zone: "",       // "" = all
      tags: new Set() // multi-select
    };
  }

/* ── Data Fetching ───────────────────────────────────────── */

  async fetchDirectoryData() {
    try {
      const response = await fetch(`${ASSETS_BASE_URL}/json_data/funtasia_data.json`);
      const rawData = await response.json();
      // const localData = await import("@/assets/funtasia_data.json");
      // const rawData = localData.default;
      // console.log(rawData);
      
      // Normalize data: convert array format to object format keyed by "Booth ID"
      // This ensures compatibility whether the CDN serves the old array or new object format.
      const normalizedData = {};
      for (const [level, items] of Object.entries(rawData)) {
        if (Array.isArray(items)) {
          normalizedData[level] = {};
          items.forEach(item => {
            if (item["Booth ID"]) {
              normalizedData[level][item["Booth ID"]] = item;
            }
          });
        } else {
          normalizedData[level] = items;
        }
      }
      
      return normalizedData;
    } catch (e) {
      console.error("Failed to fetch directory data:", e);
      throw e;
    }
  }

  setDirectoryListData(processedData) {
    this.cachedFuntasiaData = processedData;
  const container = document.getElementById("funtasia-directory-list");
  if (container) {
    // Re-populate tags and re-render with the latest processed data
    this.initCustomFilters(this.cachedFuntasiaData);
    this.applyFilters();
  }
}

  getDirectoryData() {
    return this.cachedFuntasiaData;
  }

/* ── Tag Helpers ─────────────────────────────────────────── */

/** Normalise Tags field (string | string[] | empty) into a clean array */
  parseTags(rawTags) {
    if (!rawTags) return [];
    if (Array.isArray(rawTags)) return rawTags.map(t => t.trim()).filter(Boolean);
    return rawTags.split(",").map(t => t.trim()).filter(Boolean);
  }

  /** Collect every unique tag from the full dataset */
  collectAllTags(funtasiaData) {
  const tags = new Set();
  const levels = Object.keys(funtasiaData); //
  levels.forEach(level => {
    if (typeof funtasiaData[level] !== 'object' || funtasiaData[level] === null) return;
    Object.values(funtasiaData[level]).forEach(item => {
      this.parseTags(item["tags"] || item["Tags"]).forEach(t => tags.add(t));
    });
  });
  return [...tags].sort();
}

/* ── Zone Color Helper ───────────────────────────────────── */

  getZoneColors(zoneName) {
  if (!zoneName) return { bg: "bg-ctp-surface1", text: "text-ctp-text", bar: "bg-ctp-surface0" };
  const lower = zoneName.toLowerCase();
  for (const [key, colors] of Object.entries(CONFIG.DIRECTORY.ZONE_COLORS)) {
    if (lower.includes(key)) return colors;
  }
  return { bg: "bg-ctp-surface1", text: "text-ctp-text", bar: "color-ctp-mauve" };
}

/* ── Filtering ───────────────────────────────────────────── */

/**
 * Returns a flat array of { item, level } objects that pass all active filters.
 * Filters are AND-ed: level ∩ zone ∩ tags ∩ search.
 * Tags use OR within themselves (item matches if it has ANY selected tag).
   */
  getFilteredData(funtasiaData) {
  const results = [];
  const levelsToSearch = this.filterState.level
    ? [this.filterState.level]
    : Object.keys(funtasiaData);

  levelsToSearch.forEach(level => {
    if (typeof funtasiaData[level] !== 'object' || funtasiaData[level] === null) return;
    Object.entries(funtasiaData[level]).forEach(([boothId, item]) => {
      // Zone filter
      if (this.filterState.zone) {
        const itemZone = (item["zone"] || item["Zone"] || "").trim();
        if (itemZone.toLowerCase() !== this.filterState.zone.toLowerCase()) return;
      }

      // Tag filter (OR: item must have at least one selected tag)
      if (this.filterState.tags.size > 0) {
        const itemTags = this.parseTags(item["tags"] || item["Tags"]);
        const hasMatch = itemTags.some(t => this.filterState.tags.has(t));
        if (!hasMatch) return;
      }

      // Search filter (Tokenized for multi-word support) //
      if (this.filterState.search) { //
        const tokens = this.filterState.search.toLowerCase().trim().split(/\s+/); //
        
        const itemTagsRaw = item["tags"] || ""; //
        const itemTagsStr = Array.isArray(itemTagsRaw) ? itemTagsRaw.join(" ") : String(itemTagsRaw); //
        
        const invisibleTags = item["invis_tags"] || ""; //
        const invisibleTagsStr = Array.isArray(invisibleTags) ? invisibleTags.join(" ") : String(invisibleTags); //

        const keywords = item["Keywords"] || ""; //
        const keywordsStr = Array.isArray(keywords) ? keywords.join(" ") : String(keywords); //

        const levelStr = String(level || ""); //
        const humanLevel = `level ${levelStr.replace(/[^0-9]/g, "")}`; //

        const haystack = [
          item["booth_name"] || "",
          item["booth_oneline_description"] || "",
          item["booth_description"] || "",
          itemTagsStr,
          invisibleTagsStr,
          keywordsStr,
          item["parent_model"] || "",
          boothId || "",
          levelStr,
          humanLevel
        ].join(" ").toLowerCase();

        const allMatch = tokens.every(token => haystack.includes(token));
        if (!allMatch) return;
      }

      // We inject Booth ID here for rendering later
      results.push({ item: { ...item, "Booth ID": boothId }, level });
    });
  });

  return results;
}

/**
 * Orchestrates navigation, marker placement, and camera focus for a specific booth.
 * Can be called from the directory, event schedule, or external links.
 */
  async focusOnBooth(boothNum, levelHint = null) {
  if (!this.cachedFuntasiaData || !appState) return;

  let level = levelHint;
  let item = null;

  // Find the item and its level in the cached data
  if (level && this.cachedFuntasiaData[level] && this.cachedFuntasiaData[level][boothNum]) {
    item = this.cachedFuntasiaData[level][boothNum];
  } else {
    // Search all levels if hint is missing or incorrect
    for (const l of Object.keys(this.cachedFuntasiaData)) {
      if (this.cachedFuntasiaData[l] && this.cachedFuntasiaData[l][boothNum]) {
        item = this.cachedFuntasiaData[l][boothNum];
        level = l;
        break;
      }
    }
  }

  if (!item || !level) {
    console.warn(`Booth ${boothNum} not found in directory data.`);
    return;
  }

  const boothName = item["booth_name"] || boothNum;
  const boothDesc = item["booth_description"] || "No description available.";

  // 1. Navigation Logic
  let targetFloorId = level;
  const children = appState.floors[level]?.constructor.childModels[level] || {};
  
  // Try exact match first (e.g. if booth name is "Canteen")
  if (children[boothName]) {
    targetFloorId = children[boothName];
  } else {
    // Check if booth ID starts with child ID (ish -> ISH1) or node name prefix (C -> Canteen)
    for (const [nodeName, childId] of Object.entries(children)) {
        if (boothNum.toLowerCase().startsWith(childId.toLowerCase()) || 
            (nodeName.length > 0 && boothNum.toLowerCase().startsWith(nodeName[0].toLowerCase()))) {
          targetFloorId = childId;
          break;
        }
    }
  }

  await appState.navigation.switchFloor(targetFloorId);
  if (appState.ui.clearStoredSheet) appState.ui.clearStoredSheet(); 
  appState.ui.hideSheet();

  // 2. Clear previous markers
  if (appState.activeDirectoryMarker) {
    appState.activeDirectoryMarker.clear();
    appState.activeDirectoryMarker = null;
  }
  
  appState.activeDirectoryBoothId = boothNum;
  appState.activeDirectoryLevel = level;
  appState.activeDirectoryActualFloor = targetFloorId;

  // 3. Marker and Camera Logic
  // Re-fetch to ensure we have any runtime-injected data (like Location coordinates)
  const latestItem = this.cachedFuntasiaData[level][boothNum] || item;
  const locationData = latestItem["location"] || latestItem["Location"];

  if (locationData) {
    const marker = new DirectoryMarker(locationData, targetFloorId);
    appState.activeDirectoryMarker = marker;
    appState.activeMarkers.push(marker);

    // 4. Camera Focus
    // Find the interactive object in the scene to apply highlight and focus
    const currentFloor = appState.floors[targetFloorId];
    const targetObject = currentFloor?.interactiveObjects?.find(obj => 
      obj.userData.boothId === boothNum
    );

    if (targetObject) {
      appState.navigation.focusOnObject(targetObject);
    } else {
      // Fallback: Camera animation using stored location coordinates if object is missing
      appState.navigation.focusAt(locationData);
    }
  }

  // 4. Interaction messaging
  window.parent.postMessage({ type: 'selectPOI', id: boothNum, floor: level }, '*');

  // 5. UI Cleanup/Update
  if (appState.ui.setClearDirectoryMarkerVisible) {
    appState.ui.setClearDirectoryMarkerVisible(true);
  }

  document.querySelectorAll(".modal-wrapper").forEach(mod_wrapp => {
    mod_wrapp.style.display = 'none';
  });

  if (appState.ui.showFabButtons) {
    appState.ui.showFabButtons();
  }

  appState.ui.showSheet(boothNum, null, boothDesc, boothName);
}

  /* ── Rendering ───────────────────────────────────────────── */

  renderDirectory(container, funtasiaData) {
  container.innerHTML = "";
  const filtered = this.getFilteredData(funtasiaData);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-center px-6">
        <span class="material-symbols-outlined text-[40px] text-ctp-subtext1 mb-3">search_off</span>
        <p class="font-headline font-bold text-ctp-text text-sm">No results found</p>
        <p class="text-ctp-subtext1 text-xs mt-1">Try adjusting your filters or search term</p>
      </div>`;
    return;
  }

  // Group by level, then by zone
  const grouped = {};
  filtered.forEach(({ item, level }) => {
    if (!grouped[level]) grouped[level] = {};
    let zone = item["zone"] || item["Zone"];
    if (!zone || zone.trim() === "-") zone = "Other Zones";
    else zone = zone.trim();
    if (!grouped[level][zone]) grouped[level][zone] = [];
    grouped[level][zone].push(item);
  });

  const levelOrder = ["b3", "b2", "b1", "l1", "l2", "l3"];
  const sortedLevels = Object.keys(grouped).sort(
    (a, b) => levelOrder.indexOf(a) - levelOrder.indexOf(b)
  );

  sortedLevels.forEach(level => {
    const levelSection = document.createElement("div");
    levelSection.className = "mb-8";

    const levelHeader = document.createElement("h3");
    levelHeader.className = "modal-section-title text-primary";
    levelHeader.textContent = level.toUpperCase();
    levelSection.appendChild(levelHeader);

    for (const [zone, items] of Object.entries(grouped[level])) {
      const zoneBlock = document.createElement("div");
      zoneBlock.className = "mb-6 last:mb-0";
      const zoneColors = this.getZoneColors(zone);

      const zoneHeader = document.createElement("h4");
      zoneHeader.className = `text-xs font-bold tracking-[0.1em] uppercase px-4 mb-3 ${zoneColors.text}`;
      zoneHeader.textContent = zone;
      zoneBlock.appendChild(zoneHeader);

      const itemsContainer = document.createElement("div");
      itemsContainer.className = "space-y-2";

      items.forEach(item => {
        const itemEl = document.createElement("div");
        itemEl.className = "modal-list-item";

        let boothName = item["booth_name"] || "Unnamed Booth";
        if (boothName === "-") boothName = "Unnamed Booth";
        const boothDesc = item["booth_oneline_description"] || item["booth_description"] || "";
        const boothNum = item["Booth ID"];
        const itemTags = this.parseTags(item["tags"] || item["Tags"]);

        // Build tag pills HTML
        const tagPillsHTML = itemTags.map(tag => {
          const color = CONFIG.DIRECTORY.TAG_COLORS[tag] || CONFIG.DIRECTORY.FALLBACK_TAG_COLOR;
          return `<span class="tag-pill" style="--pill-color: ${color};">${tag}</span>`;
        }).join("");

        itemEl.onclick = () => this.focusOnBooth(boothNum, level);

        itemEl.innerHTML = `
          <div class="modal-item-icon-wrapper ${zoneColors.bg} ${zoneColors.text}">
            <span class="material-symbols-outlined text-[20px]" data-icon="festival">festival</span>
          </div>
          <div class="modal-item-accent-bar ${zoneColors.bar}"></div>
          <div class="modal-item-content">
            <div class="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 class="modal-item-title leading-tight">${boothName}</h3>
              ${tagPillsHTML}
            </div>
            <p class="modal-item-subtitle mt-0.5 opacity-80 line-clamp-2">${boothDesc}</p>
          </div>
          <span class="modal-item-chevron">chevron_right</span>
        `;
        itemsContainer.appendChild(itemEl);
      });

      zoneBlock.appendChild(itemsContainer);
      levelSection.appendChild(zoneBlock);
    }

    container.appendChild(levelSection);
  });
}

  /* ── Tag Multiselect ─────────────────────────────────────── */

  /** Injects a <style> block with per-tag colours for Choices.js pills */
  injectTagColorStyles() {
  const existing = document.getElementById("choices-tag-colors");
  if (existing) existing.remove();

  const style = document.createElement("style");
  style.id = "choices-tag-colors";

  const rules = Object.entries(CONFIG.DIRECTORY.TAG_COLORS).map(([tag, color]) => `
    .custom-dropdown-menu .custom-dropdown-item[data-value="${tag}"].selected {
      color: ${color};
    }
    .custom-dropdown-menu .custom-dropdown-item[data-value="${tag}"].selected::after {
      color: ${color};
    }
    #selected-tags-container .tag-pill[data-value="${tag}"] {
      border-color: ${color};
      background: color-mix(in srgb, ${color} 15%, transparent);
      color: ${color};
    }
  `);

  style.textContent = rules.join("");
  document.head.appendChild(style);
}

  /** Updates the manual filter trigger UI based on filterState */
  updateFilterUI() {
  // 1. Tags
  const tagContainer = document.getElementById("selected-tags-container");
  const tagPlaceholder = document.getElementById("multiselect-placeholder");
  if (tagContainer && tagPlaceholder) {
    tagContainer.innerHTML = "";
    if (this.filterState.tags.size === 0) {
      tagPlaceholder.style.display = "block";
    } else {
      tagPlaceholder.style.display = "none";
      this.filterState.tags.forEach(tag => {
        const pill = document.createElement("span");
        pill.className = "tag-pill";
        pill.dataset.value = tag;
        pill.innerHTML = `
          ${tag}
          <span class="remove-btn material-symbols-outlined" onclick="event.stopPropagation(); window.toggleTagSelection('${tag.replace(/'/g, "\\'")}');">close</span>
        `;
        tagContainer.appendChild(pill);
      });
    }
  }

  // 2. Level Label
  const levelLabel = document.getElementById("filter-level-label");
  if (levelLabel) {
    levelLabel.textContent = this.filterState.level ? this.filterState.level.toUpperCase() : "All Levels";
  }

  // 3. Zone Label
  const zoneLabel = document.getElementById("filter-zone-label");
  if (zoneLabel) {
    zoneLabel.textContent = this.filterState.zone || "All Zones";
  }

  // 4. Update menu item states
  document.querySelectorAll(".custom-dropdown-item").forEach(item => {
    const val = item.dataset.value;
    const filterType = item.dataset.filter;
    let isSelected = false;

    if (filterType === "tags") isSelected = this.filterState.tags.has(val);
    else if (filterType === "level") isSelected = (this.filterState.level === val);
    else if (filterType === "zone") isSelected = (this.filterState.zone === val);

    item.classList.toggle("selected", isSelected);
  });
}

  /** Toggles a tag in the filter state */
  toggleTagSelection(tag) {
  if (this.filterState.tags.has(tag)) this.filterState.tags.delete(tag);
  else this.filterState.tags.add(tag);
  this.updateFilterUI();
  this.applyFilters();
}

  /** Sets level filter */
  setLevelFilter(val) {
  this.filterState.level = val;
  document.getElementById("filter-level-menu")?.classList.add("hidden");
  this.updateFilterUI();
  this.applyFilters();
}

  /** Sets zone filter */
  setZoneFilter(val) {
  this.filterState.zone = val;
  document.getElementById("filter-zone-menu")?.classList.add("hidden");
  this.updateFilterUI();
  this.applyFilters();
}

  /** Initialises all custom manual dropdowns */
  initCustomFilters(funtasiaData) {
  const closeAllMenus = () => {
    ["tags", "level", "zone"].forEach(f => {
      document.getElementById(`filter-${f}-menu`)?.classList.add("hidden");
    });
  };

  // 1. Tags
  const tagTrigger = document.getElementById("filter-tags-trigger");
  const tagMenu = document.getElementById("filter-tags-menu");
  if (tagTrigger && tagMenu) {
    const allTags = this.collectAllTags(funtasiaData);
    tagMenu.innerHTML = allTags.map(tag => `
      <div class="custom-dropdown-item" data-filter="tags" data-value="${tag}" onclick="appState.directory.toggleTagSelection('${tag.replace(/'/g, "\\'")}');">
        ${tag}
      </div>
    `).join("");
    tagTrigger.onclick = (e) => { 
      e.stopPropagation(); 
      const isHidden = tagMenu.classList.contains("hidden");
      closeAllMenus();
      if (isHidden) tagMenu.classList.remove("hidden");
    };
  }

  // 2. Levels
  const levelTrigger = document.getElementById("filter-level-trigger");
  const levelMenu = document.getElementById("filter-level-menu");
  if (levelTrigger && levelMenu) {
    const levels = ["", "b3", "b2", "b1", "l1", "l2"];
    levelMenu.innerHTML = levels.map(l => `
      <div class="custom-dropdown-item" data-filter="level" data-value="${l}" onclick="appState.directory.setLevelFilter('${l}');">
        ${l ? l.toUpperCase() : "All Levels"}
      </div>
    `).join("");
    levelTrigger.onclick = (e) => { 
      e.stopPropagation(); 
      const isHidden = levelMenu.classList.contains("hidden");
      closeAllMenus();
      if (isHidden) levelMenu.classList.remove("hidden");
    };
  }

  // 3. Zones
  const zoneTrigger = document.getElementById("filter-zone-trigger");
  const zoneMenu = document.getElementById("filter-zone-menu");
  if (zoneTrigger && zoneMenu) {
    const zones = ["", "Yellow", "Green", "Blue", "Red", "Purple", "Orange", "Brown"];
    zoneMenu.innerHTML = zones.map(z => `
      <div class="custom-dropdown-item" data-filter="zone" data-value="${z}" onclick="appState.directory.setZoneFilter('${z}');">
        ${z || "All Zones"}
      </div>
    `).join("");
    zoneTrigger.onclick = (e) => { 
      e.stopPropagation(); 
      const isHidden = zoneMenu.classList.contains("hidden");
      closeAllMenus();
      if (isHidden) zoneMenu.classList.remove("hidden");
    };
  }

  // 4. Global close logic
  document.addEventListener("click", (e) => {
    ["tags", "level", "zone"].forEach(f => {
      const trigger = document.getElementById(`filter-${f}-trigger`);
      const menu = document.getElementById(`filter-${f}-menu`);
      if (trigger && menu && !trigger.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.add("hidden");
      }
    });
  });

  this.injectTagColorStyles();
  this.updateFilterUI();
}

  /* ── Filter Application ──────────────────────────────────── */

  applyFilters() {
  const container = document.getElementById("funtasia-directory-list");
  if (!container || !this.cachedFuntasiaData) return;
  this.renderDirectory(container, this.cachedFuntasiaData);
}

  /* ── Filter Event Binding ────────────────────────────────── */

  bindFilterEvents() {
  // Search
  const searchInput = document.getElementById("directory-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      this.filterState.search = e.target.value;
      this.applyFilters();
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchInput.blur();
    });
  }

  // Clear All
  const clearBtn = document.getElementById("filter-clear-all-btn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      this.filterState.search = "";
      this.filterState.level = "";
      this.filterState.zone = "";
      this.filterState.tags.clear();

      if (searchInput) searchInput.value = "";
      this.updateFilterUI();
      this.applyFilters();
      clearBtn.blur();
    });
  }
}

  /* ── Public Init ─────────────────────────────────────────── */

  init() { // Renamed from initDirectory
  const container = document.getElementById("funtasia-directory-list");
  if (!container) return;

  this.bindFilterEvents();

  if (this.cachedFuntasiaData) {
    this.initCustomFilters(this.cachedFuntasiaData);
    this.renderDirectory(container, this.cachedFuntasiaData);
  } else {
    container.innerHTML = "Loading directory data...";
  }
}
}

export const directory = new Directory();

// Expose global functions for onclick handlers, which will delegate to the instance
window.toggleTagSelection = (tag) => directory.toggleTagSelection(tag);
window.setLevelFilter = (val) => directory.setLevelFilter(val);
window.setZoneFilter = (val) => directory.setZoneFilter(val);