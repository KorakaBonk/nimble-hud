export const MODULE_ID = 'nimble-hud';

/** CSS class toggled on <body> while the HUD is open and the macro bar should be hidden. */
export const BODY_OPEN_CLASS = 'nimble-hud-open';

/** Class on dialogs the HUD opens, so they stack above the HUD (see styles/global.css). */
export const HUD_DIALOG_CLASS = 'nimble-hud-dialog';

/** The quick bar is a fixed number of rows; the user adds or removes columns. */
export const QUICK_BAR_ROWS = 3;
export const QUICK_BAR_DEFAULT_COLUMNS = 3;
export const QUICK_BAR_MIN_COLUMNS = 1;
export const QUICK_BAR_MAX_COLUMNS = 10;
/** Slots kept in storage; removing a column only hides its slots, so nothing is lost. */
export const QUICK_BAR_SLOTS = QUICK_BAR_ROWS * QUICK_BAR_MAX_COLUMNS;

/** Space between Foundry's macro bar and the collapsed HUD tab docked beside it. */
export const DOCK_GAP_PX = 8;
