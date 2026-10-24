/** Localizes a key under the NIMBLE_HUD namespace, e.g. t('hp') -> "Hit Points". */
export function t(key: string): string {
	return game.i18n.localize(`NIMBLE_HUD.${key}`);
}

/** Like `t`, but fills `{placeholder}` slots from `data`. */
export function tf(key: string, data: Record<string, string | number>): string {
	return game.i18n.format(`NIMBLE_HUD.${key}`, data);
}

/**
 * Localizes a key owned by the Nimble system itself (e.g. `NIMBLE.ui.heroicActions.title`).
 * Only for wording that must stay identical to the character sheet; HUD-only text uses `t`.
 */
export function ts(key: string, data?: Record<string, string | number>): string {
	return data ? game.i18n.format(key, data) : game.i18n.localize(key);
}
