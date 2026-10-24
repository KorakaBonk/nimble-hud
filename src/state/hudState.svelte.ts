import { getBoundActor } from '../adapter/systemAdapter.ts';

/**
 * HUD state. Foundry documents are not reactive for this module's Svelte instance (the
 * system's `actor.reactive` belongs to the system's own copy of Svelte), so components read
 * fresh data inside `$derived` blocks that depend on `version`, and the adapter's hook
 * subscription bumps it whenever something relevant changes.
 */
class HudState {
	/** Bumped on every relevant Foundry change; components depend on it to re-read. */
	version = $state(0);
	/** The bound character. Raw: documents are class instances and must not be proxied. */
	actor = $state.raw<ReturnType<typeof getBoundActor>>(null);

	collapsed = $state(false);
	scale = $state(1);
	hideMacroBar = $state(false);
	alwaysHideMacroBar = $state(true);
	showForGM = $state(true);
	showCombatBar = $state(true);
	/** Quick bar contents per actor id: owned item ids or macro uuids, null for an empty slot. */
	quickBar = $state<Record<string, (string | null)[]>>({});
	/** Visible quick bar columns (three slots each). */
	quickBarColumns = $state(3);

	/** Re-resolve the bound character and trigger a re-read in every component. */
	refresh(): void {
		this.actor = getBoundActor();
		this.version += 1;
	}
}

export const hudState = new HudState();
