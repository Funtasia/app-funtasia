# Contents

-   [Key files](#key-files)
-   [About `config.js`](#about-configjs)
-   [Asset hosting](#asset-hosting)
-   [Booth data pipeline](#booth-data-pipeline)
-   [Events data pipeline](#events-data-pipeline)
-   [See also](#see-also)

# Key files

1.  `src/js/base/config.js` for main application config
2.  `vite.config.js` for building and deployment related
3.  `.env*` for environement files, also for building and deployment related

# About `config.js`

`config.js` is split into 3 **broad** sections: Locations, constants, and theming. Note that sections only convey the general outline, so some config options appear to be "in the wrong section". Most of the config options are usually either self-explanatory, or explained with comments. A few of the important config options are noted below:

### `CONFIG.MODELS.FLOORS`
>   Mapping of floor ID to the path of the .glb file relative to `ASSETS_BASE_URL`. Note that the use of ${VERSION} is completely optional, should you choose to label your files in a different format. This also applies to `CONFIG.MODELS.CHILDREN.child.path`.

### `CONFIG.MARKERS.URLS`
>   Specifies the location of the assets used for the markers, namely the icon for the directory/qr marker, as well as the JetBrainsMono font used for text markers. Note that the text is loaded in with `troika-three-text`, so consult their documentation on what font files can be used.

### `CONFIG.EVENTS.STATUS_CLASSES`
>   Theming for each entry based on its status (past, current, future) for all items in the entry. Since this is the full theming and not just the color scheme, additional TailwindCSS classes may also be present to complement the styling. (see [#theming in `config.js`](#theming-in-configjs) for more info)

### `CONFIG.THEME.TEXT_MARKER_MAP`
>   Mapping for mesh/object ID to the big location text markers shown on the map. Note that not all of them need to be interactive objects (such as NJCLOGO, njcentrance).

## Theming in `config.js`

As said in `README.md`, this project uses the `Catppuccin` color scheme mainly by utilizing the Tailwindcss port. A key feature of this port is that in addition to CSS properties that are applied to a HTML element based on its classes (via [Tailwindcss](https://tailwindcss.com/)), the color scheme can also be set based on the class of the element or its ancestors. This allows us to change between light mode (`class="latte"`) and dark mode (`class="mocha"`) by setting the class of the root element `<html>`. (You can see this in action in the first few lines of `index.html`.)

Consequently, this means that all color schemes need to be defined in terms of Catppuccin variables, to allow for usage between both light (latte) and dark (mocha) color schemes. This is why most of the theming is done with reference to Catppuccin CSS variables instead of fixed colors.

# Asset Hosting
This project pulls its data (3d models, icons, json data) from the [`funtasia_assets`](https://github.com/Funtasia/assets-funtasia/tree/main) repository/submodule. Therefore, to update the data, you will need to fork the `funtasia_assets` repo and update the data accordingly. To use this data, update `ASSETS_BASE_URL` in `vite.config.js` to the jsDelivr link [pointing to your repo](https://www.jsdelivr.com/?docs=gh). For a dev environment, you can also use a link that points to your local copy of the `funtasia_assets` repo/submodule.

# Booth data pipeline
TL;DR: Google sheets -> `.csv` -> `.json` -> promoted to `funtasia_assets` repo

The entire pipeline can been seen in [`./json_data`](./json_data/).

## Steps

1.  Booth data is collated in a [Google sheets spreadsheet](https://docs.google.com/spreadsheets/d/1XRPx2ZcikyZykce8x2-sKBLCl2eSoay8EKH2Kdq2e60/edit). 

2.  Spreadsheet is exported to a `.csv` file.

3.  `.csv` file is converted to `.json` using `parse.py`. Note that this is the only step in the entire project that uses Python.

4.  The resulting `.json` is manually screened for special characters that are not in UTF-8. Non-UTF-8 characters are encoded in the form \u\<CODEPOINT\>. Important code points: 
    -   The em-dash (—) has code point U+2014, not U+2010, U+2011, U+2012, U+2013 or U+2015
    -   Quotation marks (and apostrophes) should preferably use the UTF-8 characters of ' and " (U+0022, U+0027) instead of ‘’ and “” (U+2018, U+2019, U+201C, U+201D).

5.  The `.json` can be promoted to the `funtasia_assets` repo/submodule. Remember to follow the steps for [asset hosting](#asset-hosting).

## Notes
-   Ensure booth IDs in the spreadsheet match the object names in .glb files (e.g., a mesh named `BG1` in Blender should correspond to the `booth_id` `BG1` in the spreadsheet).
-   `booth_oneline_description` is used for the directory entry, while `booth_description` is used for the full description in the bottom sheet. Either missing will use the other as a fallback.
-   The steps above can be done anywhere, only things to note are `parse.py` and adding the resultant `funtasia_data.json` to the `funtasia_assets` repo/submodule.

# Events data pipeline
TL;DR: Data source -> Manual input

## Steps <!--Do i really need to say anything atp???-->

1.  Get data for the events.

2.  Manually input the data into the respective json files.

3.  Done!

## Notes

-   Make sure to add `endTime` for an event if there is a gap between the event and the next, or if it is the last event.

-   To add more kinds of event formats, simply ask your favorite AI assistant (i hope those still exist for free?) to edit `src/js/feature.events.js`.

-   `location` will be used for `location_id` if no `location_id` specified. `location_id` is the ID of the location in the model (i.e. Booth ID in `funtasia_data.json`), while `location` is the name displayed in the events popup.

# See also

- [Outline](./OUTLINE.md)
- [Development tips](./DEVELOPMENT.md)