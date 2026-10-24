<script lang="ts">
	import {
		addAdditionalAction,
		canRest,
		changeHP,
		changeMana,
		changeWounds,
		endTurn,
		openSheet,
		readCharges,
		readPools,
		readHeroicTabs,
		readReactionTabs,
		readCombat,
		readConditions,
		isMonster,
		readMonsterVitals,
		readVitals,
		rollHitDice,
		rollInitiative,
		setCurrentHP,
		setCurrentMana,
		setResourcePool,
		togglePip,
		triggerRest,
	} from '../adapter/systemAdapter.ts';
	import type { HeroicPopupId } from '../adapter/types.ts';
	import { BODY_OPEN_CLASS, DOCK_GAP_PX } from '../constants.ts';
	import { t, ts } from '../localize.ts';
	import { openModuleSettings, setCollapsed } from '../settings.ts';
	import { hudState } from '../state/hudState.svelte.ts';
	import CombatBar from './CombatBar.svelte';
	import HeroicActions from './HeroicActions.svelte';
	import PoolTabs from './PoolTabs.svelte';
	import MonsterFeatures from './MonsterFeatures.svelte';
	import QuickBar from './QuickBar.svelte';
	import AssessPanel from './heroic/AssessPanel.svelte';
	import AttackPanel from './heroic/AttackPanel.svelte';
	import MovePanel from './heroic/MovePanel.svelte';
	import OpportunityPanel from './heroic/OpportunityPanel.svelte';
	import ReactionPanel from './heroic/ReactionPanel.svelte';
	import SpellPanel from './heroic/SpellPanel.svelte';
	import StatsDrawer from './StatsDrawer.svelte';
	import VitalsBlock from './VitalsBlock.svelte';

	const actor = $derived(hudState.actor);
	// Monsters (GM only) get a reduced HUD: portrait, name, hit points, armor and their features.
	const monster = $derived(isMonster(actor));
	const visible = $derived(
		actor !== null && (monster || !game.user.isGM || hudState.showForGM),
	);

	const vitals = $derived.by(() => {
		void hudState.version;
		if (!actor) return null;
		return monster ? readMonsterVitals(actor) : readVitals(actor);
	});
	const conditions = $derived.by(() => {
		void hudState.version;
		return actor ? readConditions(actor) : [];
	});

	const combat = $derived.by(() => {
		void hudState.version;
		return actor && !monster ? readCombat(actor) : null;
	});

	async function confirmEndTurn(): Promise<void> {
		if (!actor || !combat) return;
		if (combat.actions.current > 0) {
			const confirmed = await foundry.applications.api.DialogV2.confirm({
				window: { title: t('confirmEndTurnTitle') },
				content: `<p>${t('confirmEndTurnBody')}</p>`,
				rejectClose: false,
			});
			if (!confirmed) return;
		}
		await endTurn(actor);
	}

	type DrawerName = 'stats' | 'saves' | 'skills';

	const DRAWER_BUTTONS: { name: DrawerName; icon: string }[] = [
		{ name: 'stats', icon: 'fa-dice-d20' },
		{ name: 'saves', icon: 'fa-shield-halved' },
		{ name: 'skills', icon: 'fa-list-check' },
	];

	let drawer = $state<DrawerName | null>(null);
	let popup = $state<HeroicPopupId | null>(null);

	const heroicTabs = $derived.by(() => {
		void hudState.version;
		return actor ? readHeroicTabs(actor) : [];
	});

	const pools = $derived.by(() => {
		void hudState.version;
		return actor ? readPools(actor) : [];
	});

	const charges = $derived.by(() => {
		void hudState.version;
		return actor ? readCharges(actor) : [];
	});

	const reactionTabs = $derived.by(() => {
		void hudState.version;
		return actor ? readReactionTabs(actor) : [];
	});

	// While collapsed, the "Show HUD" tab docks to the right of Foundry's macro bar (when that is
	// visible) instead of sitting at the bottom center where the two would overlap.
	let dock = $state<{ left: number; top: number } | null>(null);

	$effect(() => {
		if (!hudState.collapsed) {
			dock = null;
			return;
		}

		const measure = () => {
			const bar = document.getElementById('hotbar');
			const rect = bar && getComputedStyle(bar).display !== 'none' ? bar.getBoundingClientRect() : null;
			dock =
				rect && rect.width > 0 && rect.height > 0
					? { left: rect.right + DOCK_GAP_PX, top: rect.top + rect.height / 2 }
					: null;
		};
		measure();

		const bar = document.getElementById('hotbar');
		const resize = new ResizeObserver(measure);
		if (bar) resize.observe(bar);
		// The macro bar can be hidden by our own body class or minimized by Foundry.
		const mutations = new MutationObserver(measure);
		mutations.observe(document.body, { attributes: true, attributeFilter: ['class'] });
		if (bar) mutations.observe(bar, { attributes: true, attributeFilter: ['class', 'style'] });
		window.addEventListener('resize', measure);

		return () => {
			resize.disconnect();
			mutations.disconnect();
			window.removeEventListener('resize', measure);
		};
	});

	// A heroic action popup and a stats drawer never show at the same time.
	function toggleDrawer(name: DrawerName): void {
		popup = null;
		drawer = drawer === name ? null : name;
	}

	function togglePopup(id: HeroicPopupId): void {
		drawer = null;
		popup = popup === id ? null : id;
	}

	// Dismiss the popup on Escape or on a click anywhere outside it and the heroic buttons.
	$effect(() => {
		if (!popup) return;
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Element | null;
			if (!target?.closest('.hud-popup, .hud-heroic')) popup = null;
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') popup = null;
		};
		document.addEventListener('pointerdown', onPointerDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	});

	// Hide the macro bar while the full HUD is showing, or always if that setting is on.
	$effect(() => {
		const open =
			hudState.alwaysHideMacroBar || (visible && !hudState.collapsed && hudState.hideMacroBar);
		document.body.classList.toggle(BODY_OPEN_CLASS, open);
		return () => document.body.classList.remove(BODY_OPEN_CLASS);
	});
</script>

{#if visible && actor && vitals}
	<div
		class="hud"
		class:hud--collapsed={hudState.collapsed}
		class:hud--docked={hudState.collapsed && dock}
		style:--hud-scale={hudState.scale}
	>
		{#if hudState.collapsed}
			<button
				type="button"
				class="hud-tab"
				class:hud-tab--docked={dock}
				style:left={dock ? `${dock.left}px` : undefined}
				style:top={dock ? `${dock.top}px` : undefined}
				data-hud-tooltip={t('expand')}
				aria-label={t('expand')}
				onclick={() => setCollapsed(false)}
			>
				<i class="fa-solid fa-chevron-up"></i>
				<span>{t('openHud')}</span>
			</button>
		{:else}
			{#if drawer && !monster}
				<div class="hud-drawer">
					<StatsDrawer {actor} kind={drawer} onRoll={() => (drawer = null)} />
				</div>
			{/if}

			{#if popup && !monster}
				<div class="hud-popup nhud-popup">
					{#if popup === 'attack'}
						<AttackPanel {actor} onActivate={() => (popup = null)} />
					{:else if popup === 'spell'}
						<SpellPanel {actor} onActivate={() => (popup = null)} />
					{:else if popup === 'move'}
						<MovePanel {actor} onActivate={() => (popup = null)} />
					{:else if popup === 'assess'}
						<AssessPanel {actor} onActivate={() => (popup = null)} />
					{:else if popup === 'opportunity'}
						<OpportunityPanel {actor} onActivate={() => (popup = null)} />
					{:else}
						<ReactionPanel {actor} kind={popup} onActivate={() => (popup = null)} />
					{/if}
				</div>
			{/if}

			{#if combat && hudState.showCombatBar}
				<CombatBar
					{combat}
					onRollInitiative={() => rollInitiative(actor)}
					onTogglePip={(index) => togglePip(actor, index)}
					onAddAction={() => addAdditionalAction(actor)}
					onEndTurn={confirmEndTurn}
				/>
			{/if}

			<div class="hud-bar">
				{#if !monster && pools.length + charges.length > 0}
					<PoolTabs {actor} {pools} {charges} />
				{/if}

				<VitalsBlock
					{vitals}
					{conditions}
					onOpenSheet={() => openSheet(actor)}
					onRollHitDice={() => rollHitDice(actor)}
					onSetHP={(value) => setCurrentHP(actor, value)}
					onChangeHP={(delta) => changeHP(actor, delta)}
					onSetMana={(value) => setCurrentMana(actor, value)}
					onChangeMana={(delta) => changeMana(actor, delta)}
					onSetPool={(pool, value) => void setResourcePool(actor, pool, value)}
					onChangeWounds={(delta) => changeWounds(actor, delta)}
					onRest={canRest(actor) ? (restType) => triggerRest(actor, restType) : undefined}
				>
					{#if !monster}
					<div class="hud-buttons">
						{#each DRAWER_BUTTONS as button (button.name)}
							<button
								type="button"
								class="hud-button"
								class:active={drawer === button.name}
								aria-pressed={drawer === button.name}
								aria-label={t(button.name)}
								data-hud-tooltip={t(button.name)}
								onclick={() => toggleDrawer(button.name)}
							>
								<i class="fa-solid {button.icon}"></i>
							</button>
						{/each}
					</div>
					{/if}
				</VitalsBlock>

				{#if monster}
					<MonsterFeatures {actor} />
				{:else}
				<div class="hud-heroic-column">
					<HeroicActions
						label={ts('NIMBLE.ui.heroicActions.title')}
						tabs={heroicTabs}
						active={popup}
						onSelect={togglePopup}
					/>
					<HeroicActions
						label={ts('NIMBLE.ui.heroicActions.reactionsTitle')}
						tabs={reactionTabs}
						active={popup}
						onSelect={togglePopup}
					/>
				</div>

				<QuickBar {actor} />

				<button
					type="button"
					class="hud-collapse hud-settings"
					data-hud-tooltip={t('openSettings')}
					aria-label={t('openSettings')}
					onclick={openModuleSettings}
				>
					<i class="fa-solid fa-gears"></i>
				</button>
				{/if}

				<button
					type="button"
					class="hud-collapse"
					data-hud-tooltip={t('collapse')}
					aria-label={t('collapse')}
					onclick={() => setCollapsed(true)}
				>
					<i class="fa-solid fa-chevron-down"></i>
				</button>
			</div>
		{/if}
	</div>
{/if}

<style>
	.hud {
		--hud-bg: rgb(18 16 22 / 0.92);
		--hud-border: rgb(255 255 255 / 0.14);
		--hud-text: #ece8df;
		--hud-muted: #a8a193;
		--hud-accent: #d9b45a;
		/* The three drawer buttons and the vitals rows share one row height. */
		--hud-row-height: 2.25rem;
		--hud-row-gap: 0.375rem;
		/* Height of every tab sticking out above the bar (dice pools, settings, collapse). */
		--hud-tab-height: 1.75rem;

		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
		color: var(--hud-text);
		font-family: var(--font-body, 'Signika', sans-serif);
		transform: scale(var(--hud-scale, 1));
		transform-origin: bottom center;
	}

	.hud--collapsed {
		margin-bottom: 0;
	}

	/* A transform would make this the containing block of the fixed, docked tab. */
	.hud--docked {
		transform: none;
	}

	.hud-bar,
	.hud-drawer,
	.hud-popup {
		pointer-events: auto;
		background: var(--hud-bg);
		border: 1px solid var(--hud-border);
		border-radius: 0.5rem;
		box-shadow: 0 4px 18px rgb(0 0 0 / 0.55);
	}

	/* The top margin makes room for the tabs above the bar, so they never cover a popup or drawer. */
	.hud-bar {
		position: relative;
		display: flex;
		margin-top: calc(var(--hud-tab-height) - 0.25rem);
		align-items: stretch;
		gap: 0.75rem;
		padding: 0.5rem 0.625rem;
	}

	.hud-drawer {
		align-self: center;
		padding: 0.5rem 0.75rem;
		max-width: min(56rem, 96vw);
	}

	/* The heroic action panels use the character sheet's colors, not the HUD's dark ones. */
	.hud-popup {
		align-self: flex-end;
		box-sizing: border-box;
		width: min(26rem, 96vw);
		max-height: min(60vh, 34rem);
		padding: 0.75rem;
		overflow-y: auto;
		background: var(--nimble-sheet-background);
		border-color: var(--nimble-card-border-color);
	}

	.hud-heroic-column {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.5rem;
		margin-left: auto;
	}

	.hud-buttons {
		display: flex;
		flex-direction: column;
		gap: var(--hud-row-gap);
	}

	.hud-button,
	.hud-tab,
	.hud-collapse {
		pointer-events: auto;
		cursor: pointer;
		color: var(--hud-text);
		background: rgb(255 255 255 / 0.06);
		border: 1px solid var(--hud-border);
		border-radius: 0.375rem;
		font: inherit;
		line-height: 1.2;
	}

	.hud-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: var(--hud-row-height);
		padding: 0 0.75rem;
	}

	.hud-button:hover,
	.hud-collapse:hover,
	.hud-tab:hover {
		background: rgb(255 255 255 / 0.14);
	}

	.hud-button.active {
		border-color: var(--hud-accent);
		color: var(--hud-accent);
	}

	/* A small tab sticking out above the bar's upper-right corner, clear of the bar's content. */
	.hud-collapse {
		position: absolute;
		right: 0.75rem;
		bottom: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 2rem;
		height: var(--hud-tab-height);
		padding: 0;
		font-size: 0.75rem;
		background: var(--hud-bg);
		border-bottom: none;
		border-radius: 0.375rem 0.375rem 0 0;
	}

	/* The settings tab sits beside the collapse tab, to its left. */
	.hud-settings {
		right: 3rem;
	}

	/* Keep the tab's own dark background under the hover tint. */
	.hud-collapse:hover {
		background:
			linear-gradient(rgb(255 255 255 / 0.14), rgb(255 255 255 / 0.14)), var(--hud-bg);
	}

	.hud-tab {
		align-self: center;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.875rem;
		background: var(--hud-bg);
		border-radius: 0.5rem 0.5rem 0 0;
		margin-bottom: 0;
	}

	/* Beside the macro bar, vertically centered on it. */
	.hud-tab--docked {
		position: fixed;
		transform: translateY(-50%);
		border-radius: 0.5rem;
	}
</style>
