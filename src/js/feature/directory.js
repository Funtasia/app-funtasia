import { DirectoryMarker } from '@/js/marker/directorymarker.js';
import { appState } from "@/js/base/appState.js";
import { CONFIG } from "@/js/base/config.js";

// ── Module-level helpers ──────────────────────────────────────────────────────

function buildTagPillsHTML(tags) {
    return tags.map(tag => {
        const raw    = CONFIG.DIRECTORY.TAG_COLORS[tag] || CONFIG.DIRECTORY.FALLBACK_TAG_COLOR;
        const cssVal = raw.startsWith('--') ? `var(${raw})` : raw;
        return `<span class="tag-pill" style="--pill-color:${cssVal};">${tag}</span>`;
    }).join("");
}

// ── Directory class ───────────────────────────────────────────────────────────

class Directory {
    constructor() {
        this.cachedFuntasiaData = null;
        this.filterState = { search: "", level: "", zone: "", tags: new Set() };
    }

    // ── Data Fetching ─────────────────────────────────────────────────────────

    async fetchDirectoryData() {
        try {
            const rawData = await fetch(`${ASSETS_BASE_URL}/json_data/funtasia_data.json`).then(r => r.json());
            const normalized = {};
            for (const [level, items] of Object.entries(rawData)) {
                if (Array.isArray(items)) {
                    normalized[level] = {};
                    items.forEach(item => { 
                      if (item["Booth ID"]) normalized[level][item["Booth ID"]] = item; 
                    });
                } else {
                    normalized[level] = items;
                }
            }
            return normalized;
        } catch (e) {
            console.error("Failed to fetch directory data:", e);
            throw e;
        }
    }

    setDirectoryListData(processedData) {
        this.cachedFuntasiaData = processedData;
        const container = document.getElementById("funtasia-directory-list");
        if (container) {
            this.initCustomFilters(this.cachedFuntasiaData);
            this.applyFilters();
        }
    }

    getDirectoryData() { return this.cachedFuntasiaData; }

    // ── Tag Helpers ───────────────────────────────────────────────────────────

    collectAllTags(funtasiaData) {
        const tags = new Set();
        Object.values(funtasiaData).forEach(levelData => {
            if (!levelData || typeof levelData !== 'object') return;
            Object.values(levelData).forEach(item => item.tags.forEach(t => tags.add(t)));
        });
        return [...tags].sort();
    }

    // ── Zone Color Helper ─────────────────────────────────────────────────────

    getZoneColors(zoneName) {
        if (!zoneName) return { bg: "bg-ctp-surface1", text: "text-ctp-text", bar: "bg-ctp-surface0" };
        const lower = zoneName.toLowerCase();
        for (const [key, colors] of Object.entries(CONFIG.DIRECTORY.ZONE_COLORS)) {
            if (lower.includes(key)) return colors;
        }
        return { bg: "bg-ctp-surface1", text: "text-ctp-text", bar: "color-ctp-mauve" };
    }

    // ── Filtering ─────────────────────────────────────────────────────────────

    getFilteredData(funtasiaData) {
        const search     = this.filterState.search.toLowerCase().trim();
        const tokens     = search ? search.split(/\s+/) : [];
        const zoneFilter = this.filterState.zone?.toLowerCase();
        const levels     = this.filterState.level ? [this.filterState.level] : Object.keys(funtasiaData);
        const results    = [];

        levels.forEach(level => {
            const levelData = funtasiaData[level];
            if (!levelData || typeof levelData !== 'object') return;
            const levelStr   = String(level || "");
            const humanLevel = `level ${levelStr.replace(/[^0-9]/g, "")}`;

            Object.entries(levelData).forEach(([boothId, item]) => {
                if (zoneFilter && (item.zone || item.Zone || "").trim().toLowerCase() !== zoneFilter) return;

                if (this.filterState.tags.size > 0 && !item.tags.some(t => this.filterState.tags.has(t))) return;

                if (tokens.length > 0) {
                    const tStr = item.tags.join(" ");
                    const iStr = item.invis_tags.join(" ");
                    // All attributes guaranteed to exist
                    const haystack = `${item.booth_name} ${item.booth_oneline_description} ${item.booth_description} ${tStr} ${iStr} ${item.parent_model || ""} ${boothId} ${levelStr} ${humanLevel}`.toLowerCase();
                    if (!tokens.every(t => haystack.includes(t))) return;
                }

                results.push({ item: { ...item, "Booth ID": boothId }, level });
            });
        });
        return results;
    }

    // ── Booth Focus ───────────────────────────────────────────────────────────

    _findBoothInData(boothNum, levelHint) {
        if (levelHint && this.cachedFuntasiaData[levelHint]?.[boothNum]) {
            return { item: this.cachedFuntasiaData[levelHint][boothNum], level: levelHint };
        }
        for (const [l, levelData] of Object.entries(this.cachedFuntasiaData)) {
            if (levelData?.[boothNum]) return { item: levelData[boothNum], level: l };
        }
        return null;
    }

    _determineTargetFloor(level, boothName, boothNum) {
        const children = appState.floors[level]?.constructor.childModels[level] || {};
        if (children[boothName]) return children[boothName];
        for (const [nodeName, childId] of Object.entries(children)) {
            if (boothNum.toLowerCase().startsWith(childId.toLowerCase()) ||
                (nodeName[0] && boothNum.toLowerCase().startsWith(nodeName[0].toLowerCase()))) {
                return childId;
            }
        }
        return level;
    }

    async focusOnBooth(boothNum, levelHint = null) {
        if (!this.cachedFuntasiaData || !appState) return;

        const found = this._findBoothInData(boothNum, levelHint);
        if (!found) { console.warn(`Booth ${boothNum} not found in directory data.`); return; }
        const { item, level } = found;

        const boothName  = item.booth_name      || boothNum;
        const boothDesc  = item.booth_description || "No description available.";
        const targetFloorId = this._determineTargetFloor(level, boothName, boothNum);

        await appState.navigation.switchFloor(targetFloorId);
        appState.ui.clearStoredSheet?.();
        appState.ui.hideSheet();

        if (appState.activeDirectoryMarker) {
            appState.activeDirectoryMarker.clear();
            appState.activeDirectoryMarker = null;
        }
        Object.assign(appState, {
            activeDirectoryBoothId:    boothNum,
            activeDirectoryLevel:      level,
            activeDirectoryActualFloor: targetFloorId,
        });

        const latestItem   = this.cachedFuntasiaData[level][boothNum] || item;
        const locationData = latestItem.location || latestItem.Location;
        if (locationData) {
            const marker = new DirectoryMarker(locationData, targetFloorId);
            appState.activeDirectoryMarker = marker;
            appState.activeMarkers.push(marker);

            const targetObject = appState.floors[targetFloorId]?.interactiveObjects
                ?.find(obj => obj.userData.boothId === boothNum);
            targetObject
                ? appState.navigation.focusOnObject(targetObject)
                : appState.navigation.focusAt(locationData);
        }

        window.parent.postMessage({ type: 'selectPOI', id: boothNum, floor: level }, '*');
        appState.ui.setClearDirectoryMarkerVisible?.(true);
        document.querySelectorAll(".modal-wrapper").forEach(el => el.style.display = 'none');
        appState.ui.showFabButtons?.();
        appState.ui.showSheet(boothNum, null, boothDesc, boothName);
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    _groupResults(filtered) {
        const grouped = {};
        filtered.forEach(({ item, level }) => {
            if (!grouped[level]) grouped[level] = {};
            let zone = (item.zone || item.Zone || "").trim();
            if (!zone || zone === "-") zone = "Other Zones";
            if (!grouped[level][zone]) grouped[level][zone] = [];
            grouped[level][zone].push(item);
        });
        return grouped;
    }

    _buildItem(item, level) {
        const boothNum  = item["Booth ID"];
        const rawName   = item.booth_name;
        const boothName = (!rawName || rawName === "-") ? "Unnamed Booth" : rawName;
        const boothDesc = item.booth_oneline_description || item.booth_description || "";
        const tags      = item.tags;
        const zc        = this.getZoneColors(item.zone || item.Zone);

        const el = document.createElement("div");
        el.className = "modal-list-item";
        el.addEventListener('click', () => this.focusOnBooth(boothNum, level));
        el.innerHTML = `
            <div class="modal-item-icon-wrapper ${zc.bg} ${zc.text}">
                <span class="material-symbols-outlined text-[20px]" data-icon="festival">festival</span>
            </div>
            <div class="modal-item-accent-bar ${zc.bar}"></div>
            <div class="modal-item-content">
                <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                    <h3 class="modal-item-title leading-tight">${boothName}</h3>
                    ${buildTagPillsHTML(tags)}
                </div>
                <p class="modal-item-subtitle mt-0.5 opacity-80 line-clamp-2">${boothDesc}</p>
            </div>
            <span class="modal-item-chevron">chevron_right</span>`;
        return el;
    }

    renderDirectory(container, funtasiaData) {
        container.innerHTML = "";
        const filtered = this.getFilteredData(funtasiaData);
        if (!filtered.length) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center px-6">
                    <span class="material-symbols-outlined text-[40px] text-ctp-subtext1 mb-3">search_off</span>
                    <p class="font-headline font-bold text-ctp-text text-sm">No results found</p>
                    <p class="text-ctp-subtext1 text-xs mt-1">Try adjusting your filters or search term</p>
                </div>`;
            return;
        }

        const grouped = this._groupResults(filtered);
        Object.keys(grouped)
            .sort((a, b) => CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(a) - CONFIG.NAVIGATION.FLOOR_ORDER.indexOf(b))
            .forEach(level => {
                const section = document.createElement("div");
                section.className = "mb-8";
                const header = document.createElement("h3");
                header.className = "modal-section-title text-primary";
                header.textContent = level.toUpperCase();
                section.appendChild(header);

                for (const [zone, items] of Object.entries(grouped[level])) {
                    const zc        = this.getZoneColors(zone);
                    const zoneEl    = document.createElement("div");
                    zoneEl.className = "mb-6 last:mb-0";
                    const zoneHeader = document.createElement("h4");
                    zoneHeader.className = `text-xs font-bold tracking-[0.1em] uppercase px-4 mb-3 ${zc.text}`;
                    zoneHeader.textContent = zone;
                    zoneEl.appendChild(zoneHeader);

                    const itemsContainer = document.createElement("div");
                    itemsContainer.className = "space-y-2";
                    items.forEach(item => itemsContainer.appendChild(this._buildItem(item, level)));
                    zoneEl.appendChild(itemsContainer);
                    section.appendChild(zoneEl);
                }
                container.appendChild(section);
            });
    }

    // ── Tag Multiselect ───────────────────────────────────────────────────────

    injectTagColorStyles() {
        document.getElementById("choices-tag-colors")?.remove();
        const style = document.createElement("style");
        style.id = "choices-tag-colors";
        style.textContent = Object.entries(CONFIG.DIRECTORY.TAG_COLORS).map(([tag, color]) => {
            const cssVal = color.startsWith('--') ? `var(${color})` : color;
            return `
                .custom-dropdown-menu .custom-dropdown-item[data-value="${tag}"].selected { color:${cssVal}; }
                .custom-dropdown-menu .custom-dropdown-item[data-value="${tag}"].selected::after { color:${cssVal}; }
                #selected-tags-container .tag-pill[data-value="${tag}"] { border-color:${cssVal}; background:color-mix(in srgb,${cssVal} 15%,transparent); color:${cssVal}; }
            `;
        }).join("");
        document.head.appendChild(style);
    }

    updateFilterUI() {
        // Tags
        const tagContainer  = document.getElementById("selected-tags-container");
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
                    pill.innerHTML = `${tag}<span class="remove-btn material-symbols-outlined" onclick="event.stopPropagation();window.toggleTagSelection('${tag.replace(/'/g, "\\'")}');">close</span>`;
                    tagContainer.appendChild(pill);
                });
            }
        }
        document.getElementById("filter-level-label").textContent = this.filterState.level ? this.filterState.level.toUpperCase() : "All Levels";
        document.getElementById("filter-zone-label").textContent = this.filterState.zone  || "All Zones";

        document.querySelectorAll(".custom-dropdown-item").forEach(item => {
            const { value, filter: filterType } = item.dataset;
            const selected = filterType === "tags"  ? this.filterState.tags.has(value)
                           : filterType === "level" ? this.filterState.level === value
                           : filterType === "zone"  ? this.filterState.zone  === value
                           : false;
            item.classList.toggle("selected", selected);
        });
    }

    toggleTagSelection(tag) {
        this.filterState.tags.has(tag) ? this.filterState.tags.delete(tag) : this.filterState.tags.add(tag);
        this.updateFilterUI();
        this.applyFilters();
    }

    setLevelFilter(val) {
        this.filterState.level = val;
        document.getElementById("filter-level-menu")?.classList.add("hidden");
        this.updateFilterUI();
        this.applyFilters();
    }

    setZoneFilter(val) {
        this.filterState.zone = val;
        document.getElementById("filter-zone-menu")?.classList.add("hidden");
        this.updateFilterUI();
        this.applyFilters();
    }

    // ── Custom Filter Dropdowns ───────────────────────────────────────────────

    _setupDropdown(triggerId, menuId, itemsHTML, closeAll) {
        const trigger = document.getElementById(triggerId);
        const menu    = document.getElementById(menuId);
        if (!trigger || !menu) return;
        menu.innerHTML = itemsHTML;
        trigger.onclick = (e) => {
            e.stopPropagation();
            const wasHidden = menu.classList.contains("hidden");
            closeAll();
            if (wasHidden) menu.classList.remove("hidden");
        };
    }

    initCustomFilters(funtasiaData) {
        const closeAll = () => ['tags', 'level', 'zone'].forEach(f =>
            document.getElementById(`filter-${f}-menu`)?.classList.add("hidden"));

        const allTags  = this.collectAllTags(funtasiaData);
        const levels   = [""].concat(CONFIG.NAVIGATION.FLOOR_ORDER);
        const zones    = [""].concat(CONFIG.MODELS.ZONES.filter(z => z !== 'NONE'));

        this._setupDropdown('filter-tags-trigger', 'filter-tags-menu',
            allTags.map(t => `<div class="custom-dropdown-item" data-filter="tags" data-value="${t}" onclick="toggleTagSelection('${t.replace(/'/g, "\\'")}');">${t}</div>`).join(""),
            closeAll);

        this._setupDropdown('filter-level-trigger', 'filter-level-menu',
            levels.map(l => `<div class="custom-dropdown-item" data-filter="level" data-value="${l}" onclick="setLevelFilter('${l}');">${l ? l.toUpperCase() : "All Levels"}</div>`).join(""),
            closeAll);

        this._setupDropdown('filter-zone-trigger', 'filter-zone-menu',
            zones.map(z => `<div class="custom-dropdown-item" data-filter="zone" data-value="${z}" onclick="setZoneFilter('${z}');">${z || "All Zones"}</div>`).join(""),
            closeAll);

        // Global close-on-outside-click
        document.addEventListener("click", (e) => {
            ['tags', 'level', 'zone'].forEach(f => {
                const trigger = document.getElementById(`filter-${f}-trigger`);
                const menu    = document.getElementById(`filter-${f}-menu`);
                if (trigger && menu && !trigger.contains(e.target) && !menu.contains(e.target)) {
                    menu.classList.add("hidden");
                }
            });
        });

        this.injectTagColorStyles();
        this.updateFilterUI();
    }

    // ── Filter Application ────────────────────────────────────────────────────

    applyFilters() {
        const container = document.getElementById("funtasia-directory-list");
        if (!container || !this.cachedFuntasiaData) return;
        this.renderDirectory(container, this.cachedFuntasiaData);
    }

    bindFilterEvents() {
        const searchInput = document.getElementById("directory-search-input");
        if (searchInput) {
            searchInput.addEventListener("input",  (e) => { this.filterState.search = e.target.value; this.applyFilters(); });
            searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") searchInput.blur(); });
        }

        const clearBtn = document.getElementById("filter-clear-all-btn");
        if (clearBtn) {
            clearBtn.addEventListener("click", () => {
                Object.assign(this.filterState, { search: "", level: "", zone: "" });
                this.filterState.tags.clear();
                if (searchInput) searchInput.value = "";
                this.updateFilterUI();
                this.applyFilters();
                clearBtn.blur();
            });
        }
    }

    // ── Public Init ───────────────────────────────────────────────────────────

    init() {
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

window.toggleTagSelection = (tag) => directory.toggleTagSelection(tag);
window.setLevelFilter     = (val) => directory.setLevelFilter(val);
window.setZoneFilter      = (val) => directory.setZoneFilter(val);