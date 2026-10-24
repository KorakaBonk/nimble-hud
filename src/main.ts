import { mount } from 'svelte';
import './styles/global.css';
import { subscribe } from './adapter/systemAdapter.ts';
import { MODULE_ID } from './constants.ts';
import { t } from './localize.ts';
import Hud from './hud/Hud.svelte';
import { installTooltips } from './hud/tooltip.ts';
import { loadSettings, registerSettings } from './settings.ts';
import { hudState } from './state/hudState.svelte.ts';

Hooks.once('init', () => {
	registerSettings();
});

Hooks.once('ready', () => {
	if (game.system.id !== 'nimble') {
		ui.notifications?.warn(t('wrongSystem'));
		return;
	}

	loadSettings();

	// The HUD lives inside Foundry's interface layer so it stacks like the rest of the UI
	// (above the canvas, below windows and dialogs).
	const host = document.createElement('div');
	host.id = `${MODULE_ID}-root`;
	(document.getElementById('interface') ?? document.body).appendChild(host);
	mount(Hud, { target: host });
	installTooltips(host);

	hudState.refresh();
	subscribe(() => hudState.refresh());
});
