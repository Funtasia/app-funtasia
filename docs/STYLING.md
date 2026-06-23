# HTML and CSS Architecture

The project’s visual styling is a mix of **CSS‑first** rules written in several files and a heavy use of **Tailwind CSS** (v4) utilities.  

## TL;DR

- **CSS‑first** modules (`main.css`, `modal.css`, `events.css`, `onboarding.css`) contain project‑specific overrides, utilities and helper classes that cannot be expressed purely with Tailwind.
- **Tailwind** is used for atomic, composable styling (spacing, typography, colors, utilities) and the `@apply` directive bridges back‑to‑CSS for complex selectors.
- The **`@catppuccin/tailwindcss/`** plugin injects the Catppuccin color palette and custom variables; all colors in the project reference `var(--color-ctp‑…)`.

---

## File‑by‑file walk‑through

| File | Purpose |
|------|---------|
| **`src/css/input.css`** | Entry point to all the tailwind stylesheets. <br>It imports `tailwindcss` and plugins, the Catppuccin theme, and the other stylesheets; it also defines custom utilities (`hide-scrollbar`, `material-symbols-outlined`). |
| **`src/css/main.css`** | Main CSS stylesheet which does NOT use `tailwindcss` and is imported directly in `index.html`. <br>Has styling for main UI elements, including the FABs, the level selector, the `#bottom-sheet`, the toast popup and other global modal UI helpers. |
| **`src/css/modal.css`** | All modal related styling – modal wrapper, card, search bar, list items, dropdowns, tags, etc. | 
| **`src/css/events.css`** | Styling for the events modal (timeline, tags, badges). |
| **`src/css/directory.css`** | Styling for the directory modal (dropdown, filter pills, search bar) |
| **`src/css/qr.css`** | Styling for QR marker modal (QR video, torch button, etc) | 

---

## Tailwind Integration

1. **Import the theme**  
   `src/css/input.css` pulls in `@catppuccin/tailwindcss/mocha.css`, giving Tailwind access to all Catppuccin CSS custom properties (e.g., `--color-ctp-base`).  
2. **Global @apply**  
   `@apply` directive is used to apply the theming of the specified class to the selected elements. 
   
   (e.g. `@apply h-[300px]` is equivalent to `height: 300px`, as `h-[300px]` is the Tailwind class to use to style an element with `height: 300px`)  
3. **Custom utilities**  
   ```
   @utility hide-scrollbar { /* ... */ }
   @utility material-symbols-outlined { /* ... */ }
   ```  
   Allow you to write:
   ```html
   <div class="hide-scrollbar"></div>
   <span class="material-symbols-outlined">chevron_right</span>
   ```
---

## Modal element structure

### Document tree:
```html
<div class="modal-wrapper">
    <div class="modal-container">
        <div class="modal-backdrop"> <!--The backdrop that blurs the background--> </div>
        <div class="modal-card"> <!--The content area-->

            <div class="modal-header">
                <div>
                    <h1 class="modal-title">Modal title</h1>
                    <p class="modal-subtitle">Modal subtitle</p>
                </div>
                <button class="modal-close-btn">
                    <span class="material-symbols-outlined text-[20px]">close</span>
                </button>
            </div>

            <div class=modal-content>
                <!--Content here-->
            </div>

            <div class="modal-footer-fade"></div>

        </div>
    </div>
</div>
```
### Note:
* Remember to set the `id` attribute and to `setupModal()` in `index.html`.
* For dynamically injected content, take a look at the `settings-modal` and `events-modal` as examples of different ways to insert content.
* For static content, take a look at `info-modal`.
* There are also other modal elements that have styling, refer to `modal.css` for more info.
---


## FAQ

* **How are colors managed?**  
  Catppuccin theme `mocha.css` declares the `--color-ctp-…` variables; Tailwind’s plugin exposes them as `var(--color-ctp-…)`.  
  Example: `bg-ctp-surface0` expands to `background-color: var(--color-ctp-surface0)`.

* **Why use `color-mix()`?**  
  It allows the same color palette to be lightened or darkened for shadows, borders or hover states without hard‑coding a separate shade.

---