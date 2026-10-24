import {
	MODULE_ID,
	QUICK_BAR_DEFAULT_COLUMNS,
	QUICK_BAR_MAX_COLUMNS,
	QUICK_BAR_MIN_COLUMNS,
	QUICK_BAR_SLOTS,
} from './constants.ts';
import { hudState } from './state/hudState.svelte.ts';

const PREFIX = 'NIMBLE_HUD.settings';

function register(key: string, data: Record<string, unknown>): void {
	game.settings.register(MODULE_ID, key, {
		scope: 'client',
		config: true,
		name: `${PREFIX}.${key}.name`,
		hint: `${PREFIX}.${key}.hint`,
		...data,
	});
}

export function registerSettings(): void {
	// Not shown in the settings menu: toggled with the HUD's own tab.
	register('collapsed', { type: Boolean, default: false, config: false });

	// Not shown in the settings menu: filled by dragging items or macros onto the quick bar.
	register('quickBar', {
		type: new foundry.data.fields.ObjectField(),
		default: {},
		config: false,
		onChange: (value: unknown) => {
			hudState.quickBar = normalizeQuickBar(value);
		},
	});

	// Not shown in the settings menu: changed with the quick bar's + and - buttons.
	register('quickBarColumns', {
		type: Number,
		default: QUICK_BAR_DEFAULT_COLUMNS,
		config: false,
		onChange: (value: unknown) => {
			hudState.quickBarColumns = clampColumns(value);
		},
	});

	register('scale', {
		type: new foundry.data.fields.NumberField({
			min: 0.6,
			max: 1.4,
			step: 0.05,
			initial: 1,
			nullable: false,
		}),
		default: 1,
		onChange: (value: number) => {
			hudState.scale = Number(value) || 1;
		},
	});

	register('hideMacroBar', {
		type: Boolean,
		default: false,
		onChange: (value: boolean) => {
			hudState.hideMacroBar = Boolean(value);
		},
	});

	register('alwaysHideMacroBar', {
		type: Boolean,
		default: true,
		onChange: (value: boolean) => {
			hudState.alwaysHideMacroBar = Boolean(value);
		},
	});

	register('showCombatBar', {
		type: Boolean,
		default: true,
		onChange: (value: boolean) => {
			hudState.showCombatBar = Boolean(value);
		},
	});

	register('showForGM', {
		type: Boolean,
		default: true,
		onChange: (value: boolean) => {
			hudState.showForGM = Boolean(value);
		},
	});
}

function clampColumns(value: unknown): number {
	const columns = Math.trunc(Number(value));
	if (!Number.isFinite(columns)) return QUICK_BAR_DEFAULT_COLUMNS;
	return Math.min(QUICK_BAR_MAX_COLUMNS, Math.max(QUICK_BAR_MIN_COLUMNS, columns));
}

function normalizeQuickBar(value: unknown): Record<string, (string | null)[]> {
	const result: Record<string, (string | null)[]> = {};
	if (!value || typeof value !== 'object') return result;
	for (const [actorId, slots] of Object.entries(value as Record<string, unknown>)) {
		if (!Array.isArray(slots)) continue;
		result[actorId] = Array.from({ length: QUICK_BAR_SLOTS }, (_, index) => {
			const id = slots[index];
			return typeof id === 'string' && id ? id : null;
		});
	}
	return result;
}

/** Copies the stored settings into the reactive HUD state. Call once the game is ready. */
export function loadSettings(): void {
	hudState.collapsed = Boolean(game.settings.get(MODULE_ID, 'collapsed'));
	hudState.scale = Number(game.settings.get(MODULE_ID, 'scale')) || 1;
	hudState.hideMacroBar = Boolean(game.settings.get(MODULE_ID, 'hideMacroBar'));
	hudState.alwaysHideMacroBar = Boolean(game.settings.get(MODULE_ID, 'alwaysHideMacroBar'));
	hudState.showForGM = Boolean(game.settings.get(MODULE_ID, 'showForGM'));
	hudState.showCombatBar = Boolean(game.settings.get(MODULE_ID, 'showCombatBar'));
	hudState.quickBar = normalizeQuickBar(game.settings.get(MODULE_ID, 'quickBar'));
	hudState.quickBarColumns = clampColumns(game.settings.get(MODULE_ID, 'quickBarColumns'));
}

export function setCollapsed(collapsed: boolean): void {
	hudState.collapsed = collapsed;
	void game.settings.set(MODULE_ID, 'collapsed', collapsed);
}

/** The quick bar slots for an actor, always `QUICK_BAR_SLOTS` long. */
export function quickBarSlots(actorId: string): (string | null)[] {
	return hudState.quickBar[actorId] ?? Array.from({ length: QUICK_BAR_SLOTS }, () => null);
}

/** Replaces an actor's quick bar and stores it (per user, per browser). */
export function setQuickBarSlots(actorId: string, slots: (string | null)[]): void {
	hudState.quickBar = { ...hudState.quickBar, [actorId]: slots };
	void game.settings.set(MODULE_ID, 'quickBar', hudState.quickBar);
}

/** Adds (or, when negative, removes) quick bar columns within the allowed range. */
export function changeQuickBarColumns(delta: number): void {
	const columns = clampColumns(hudState.quickBarColumns + delta);
	if (columns === hudState.quickBarColumns) return;
	hudState.quickBarColumns = columns;
	void game.settings.set(MODULE_ID, 'quickBarColumns', columns);
}

/**
 * Opens Foundry's settings window straight on this module's tab. The tab is given as
 * `{categories: id}`: the plain string form is applied to the window's first tab group, which
 * does not exist yet on the first render.
 */
export function openModuleSettings(): void {
	void game.settings.sheet.render({ force: true, tab: { categories: MODULE_ID } });
}
