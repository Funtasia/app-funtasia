import { appState } from "@/js/base/appState.js";
import { createEventRegistry } from "@/js/events/event.js";
import { CONFIG } from "@/js/base/config";

const DOM = {
    ccaToggleBtn: document.getElementById('events-cca-toggle-btn'),
    dunklistToggleBtn: document.getElementById('events-dunklist-toggle-btn'),
    pabuskingToggleBtn: document.getElementById('events-pabusking-toggle-btn'),
    eventsListContainer: document.getElementById('events-list-container'),
    eventsContentArea: document.getElementById('events-content-area'),
    eventsBackToTopBtn: document.getElementById('events-back-to-top'),
    toggleContainer: document.getElementById('fullwidth-toggle-selector-container'),
};

if (!DOM.eventsListContainer || !DOM.eventsContentArea || !DOM.eventsBackToTopBtn || !DOM.toggleContainer) {
    console.error("Events module: One or more required DOM elements not found.");
}

const eventCategories = {
    cca:       DOM.ccaToggleBtn,
    dunklist:  DOM.dunklistToggleBtn,
    pabusking: DOM.pabuskingToggleBtn
};

function buildLinkHTML(link) {
    if (!link) return "";
    return `<span class="bg-ctp-surface0 text-ctp-blue ml-4 px-3 py-1 rounded-full font-label text-[10px] uppercase tracking-widest flex items-center gap-1 w-fit">
        <span class="material-symbols-outlined" style="font-size:12px">${link.icon || "open_in_new"}</span>
        <a class="capitalize" href="${link.link}" target="${link.target || "_blank"}">${link.text}</a>
    </span>`;
}

function buildSongsHTML(songs) {
    return (songs || []).map(song => `
        <div class="flex items-center gap-3 my-4">
            <span class="material-symbols-outlined text-[18px] text-ctp-text">${song.icon || "music_note"}</span>
            <div class="flex flex-col gap-0.5">
                <span class="font-headline font-bold text-[12px] text-ctp-text uppercase tracking-wider">${song.title}</span>
                <span class="font-body text-[10px] text-ctp-mauve font-bold uppercase tracking-widest">${song.author}</span>
            </div>
        </div>`).join("");
}

class Events {
    constructor() {
        this.registry = createEventRegistry();
    }

    parseTimeToMinutes(timeInput) {
        const s = String(timeInput || "");
        return /^\d{4}$/.test(s) ? parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(2, 4), 10) : 0;
    }

    formatTime(timeInput) {
        if (!timeInput) return "";
        const s = String(timeInput);
        if (!/^\d{4}$/.test(s)) return s;
        let h = Number(s.slice(0, 2));
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${s.slice(2, 4)} ${ampm}`;
    }

    _getNextMins(events, ev_no) {
        for (let i = ev_no + 1; i < events.length; i++) {
            if (events[i].time) return this.parseTimeToMinutes(events[i].time);
        }
        return Infinity;
    }

    _buildEventItemHTML(ev, status) {
        const c = CONFIG.EVENTS.STATUS_CLASSES[status];
        const bodyHTML = !ev.isSessionHeader && (ev.description || ev.songs?.length)
            ? `<div class="${c.box} events-item-body">
                ${ev.description ? `<p class="${status === 'past' ? 'text-ctp-subtext0' : 'text-ctp-subtext1'} events-item-description">${ev.description}</p>` : ""}
                ${buildSongsHTML(ev.songs)}
               </div>`
            : "";
        return `
            <div class="events-item-container group">
                <div class="${c.node} events-item-dots"></div>
                <div class="flex flex-col gap-1 mb-3">
                    <span class="${c.time} events-item-time">${this.formatTime(ev.time)}</span>
                    <div class="flex flex-row">
                        <h3 class="${c.title} events-item-title">${ev.title}</h3>
                        ${buildLinkHTML(ev.link)}
                    </div>
                </div>
                ${bodyHTML}
            </div>`;
    }

    async switchEventCategory(category) {
        // Update button styles
        Object.entries(eventCategories).forEach(([key, btn]) => {
            btn.style.background = key === category ? 'var(--color-ctp-mauve)' : 'transparent';
            btn.style.color      = key === category ? 'var(--color-ctp-base)'  : 'var(--color-ctp-text)';
        });

        DOM.eventsListContainer.innerHTML = '<p class="text-center opacity-50 py-10">Loading events...</p>';
        DOM.eventsListContainer.style.cssText += ';position:relative;z-index:0';

        try {
            const res = await fetch(`${ASSETS_BASE_URL}/json_data/events/${category}_events.json`);
            if (!res.ok) throw new Error('Failed to load events for ' + category);
            const data_arr = await res.json();

            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            let html = '';
            let currentEventID = null;

            data_arr.forEach((data, index) => {
                if (!data.events?.length) {
                    DOM.eventsListContainer.innerHTML = '<p class="text-center opacity-50 py-10">No events scheduled in this category.</p>';
                    return;
                }

                const eventID = `events-item-${index + 1}`;
                let isAllPast = true;

                html += `
                <header id="${eventID}" class="text-left sticky -left-3 bg-ctp-base text-ctp-base min-h-28 z-50 w-[calc(100%+var(--spacing)*3)]"
                        style="top:var(--event-header-top,-1rem);transition:top 0.3s ease-in-out;contain:layout paint;">
                    <div class="flex flex-row mb-1 items-center justify-between w-full pr-8 mt-8 gap-4">
                        <h1 class="font-headline text-3xl font-bold tracking-tight text-ctp-text leading-none ml-4 truncate">${data.title}</h1>
                        <span class="events-location cursor-pointer hover:opacity-70 transition-opacity active:scale-95 flex-0" data-booth-id="${data.location_id || data.location}">
                            <span class="material-symbols-outlined text-[12px]">location_on</span>${data.location}
                        </span>
                    </div>
                    <p class="text-ctp-subtext0 font-body text-sm w-full ml-4">${data.subtitle || '<br>'}</p>
                </header>
                <div class="events-timeline">`;

                data.events.forEach((ev, ev_no) => {
                    const evMins   = this.parseTimeToMinutes(ev.time);
                    const nextMins = ev.endTime ? this.parseTimeToMinutes(ev.endTime) : this._getNextMins(data.events, ev_no);
                    const status   = currentMinutes >= nextMins ? 'past' : currentMinutes >= evMins ? 'current' : 'future';

                    if (status !== 'past') isAllPast = false;
                    if (!isAllPast && !currentEventID) currentEventID = eventID;
                    html += this._buildEventItemHTML(ev, status);
                });

                // End node — check if next section has already started
                let nextSectionMins = Infinity;
                for (let i = index + 1; i < data_arr.length; i++) {
                    if (data_arr[i].events?.[0]?.time) { nextSectionMins = this.parseTimeToMinutes(data_arr[i].events[0].time); break; }
                }
                const isCurrentEnd = isAllPast && currentMinutes < nextSectionMins;
                html += `
                    <div class="relative w-full">
                        <div class="${isCurrentEnd ? 'bg-ctp-mauve shadow-[0_0_10px_var(--color-ctp-mauve)]' : 'bg-ctp-surface2'} events-item-dots"></div>
                        <span class="font-label ${isCurrentEnd ? 'text-ctp-text font-bold' : 'text-ctp-subtext0'} events-item-time block pt-0.5">${data.endText || 'End of Schedule'}</span>
                    </div>
                </div>`;
            });

            DOM.eventsListContainer.innerHTML = html;
            if (currentEventID) {
                document.getElementById(currentEventID)?.scrollIntoView({ behavior: "smooth", block: "start", container: "nearest" });
                DOM.toggleContainer.style.top = `-${DOM.toggleContainer.offsetHeight + 20}px`;
                DOM.eventsContentArea.style.setProperty('--event-header-top', '-16px');
            }
        } catch (err) {
            console.error("Error rendering timeline:", err);
            DOM.eventsListContainer.innerHTML = '<p class="text-center text-ctp-red py-10">Failed to load events. Please try again later.</p>';
        }
    }

    _setupScrollBehavior() {
        const { eventsContentArea: area, eventsBackToTopBtn: backBtn, toggleContainer: toggle } = DOM;
        const HEADER_BASE = -16;
        let lastTop = 0, upAcc = 0, downAcc = 0;

        if (toggle && !toggle.dataset.styled) {
            Object.assign(toggle.style, {
                position: 'sticky', top: '-16px', zIndex: '60',
                width: 'calc(100% + var(--spacing) * 3)',
                marginLeft: 'calc(var(--spacing) * -3)',
                transition: 'top 0.3s ease-in-out', willChange: 'top',
            });
            toggle.dataset.styled = 'true';
        }

        this.registry.add(area, 'scroll', () => {
            const scrollTop  = Math.max(0, area.scrollTop);
            const toggleH    = toggle?.offsetHeight ?? 0;
            const isScrolled = scrollTop > 200;

            backBtn.classList.toggle('opacity-0',           !isScrolled);
            backBtn.classList.toggle('pointer-events-none', !isScrolled);
            backBtn.classList.toggle('opacity-100',          isScrolled);
            backBtn.classList.toggle('pointer-events-auto',  isScrolled);

            if (toggle) {
                const delta = lastTop - scrollTop;
                if (scrollTop <= 0) {
                    toggle.style.top = '-16px';
                    area.style.setProperty('--event-header-top', `${toggleH + HEADER_BASE}px`);
                    upAcc = downAcc = 0;
                } else if (delta > 0) {
                    upAcc += delta; downAcc = 0;
                    if (upAcc >= 0) {
                        toggle.style.top = '-16px';
                        area.style.setProperty('--event-header-top', `${toggleH + HEADER_BASE}px`);
                    }
                } else if (delta < 0) {
                    downAcc += Math.abs(delta); upAcc = 0;
                    if (scrollTop > 120 && downAcc >= 20) {
                        toggle.style.top = `-${toggle.offsetHeight + 20}px`;
                        area.style.setProperty('--event-header-top', `${HEADER_BASE}px`);
                    }
                }
            }
            lastTop = scrollTop;
        }, { passive: true });

        this.registry.add(backBtn, 'click', () => area.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    init() {
        this.registry.cleanup();

        if (DOM.ccaToggleBtn)       this.registry.add(DOM.ccaToggleBtn,       'click', () => this.switchEventCategory('cca'));
        if (DOM.dunklistToggleBtn)  this.registry.add(DOM.dunklistToggleBtn,  'click', () => this.switchEventCategory('dunklist'));
        if (DOM.pabuskingToggleBtn) this.registry.add(DOM.pabuskingToggleBtn, 'click', () => this.switchEventCategory('pabusking'));

        if (DOM.eventsListContainer) {
            this.registry.add(DOM.eventsListContainer, 'click', (e) => {
                const tag = e.target.closest('.events-location');
                if (tag?.dataset.boothId) {
                    const id = tag.dataset.boothId.trim();
                    if (id && id !== "-") appState.directory.focusOnBooth(id);
                }
            });
        }

        if (DOM.eventsContentArea && DOM.eventsBackToTopBtn) this._setupScrollBehavior();
    }
}

export const events = new Events();
window.switchEventCategory = (category) => events.switchEventCategory(category);