<script lang="ts">
	import { readArmor, readReactionCost, readTargets, runReaction } from '../../adapter/systemAdapter.ts';
	import { ts } from '../../localize.ts';
	import { hudState } from '../../state/hudState.svelte.ts';
	import ReactionTargets from './ReactionTargets.svelte';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
		kind: 'defend' | 'interpose' | 'help';
		onActivate: () => void;
	}

	let { actor, kind, onActivate }: Props = $props();

	const P = 'NIMBLE.ui.heroicActions.reactions';

	const armor = $derived.by(() => {
		void hudState.version;
		return readArmor(actor);
	});
	const targets = $derived.by(() => {
		void hudState.version;
		return readTargets(actor);
	});
	// Resolved through the character's action cost rules, as the sheet's panels print them.
	const cost = $derived.by(() => {
		void hudState.version;
		return readReactionCost(actor, [kind]);
	});
	const combinedCost = $derived.by(() => {
		void hudState.version;
		return readReactionCost(actor, ['interpose', 'defend']);
	});

	// Per-kind content, mirroring the sheet's three panels.
	const content = {
		defend: {
			icon: 'fa-solid fa-shield',
			badgeIcon: 'fa-solid fa-shield',
			badgeText: () => ts(`${P}.defend.armorBadge`, { armor }),
			description: () => ts(`${P}.defend.panelDescription`, { armor }),
			confirm: ts(`${P}.defend.confirm`),
			badgeColor: 'var(--nimble-reaction-defend-text)',
			badgeBackground: 'var(--nimble-reaction-defend-light)',
		},
		interpose: {
			icon: 'fa-solid fa-people-arrows',
			badgeIcon: 'fa-solid fa-ruler',
			badgeText: () => ts(`${P}.interpose.rangeBadge`),
			description: () => ts(`${P}.interpose.panelDescription`),
			confirm: ts(`${P}.interpose.confirm`),
			badgeColor: 'var(--nimble-reaction-interpose-text)',
			badgeBackground: 'var(--nimble-reaction-interpose-light)',
		},
		help: {
			icon: 'fa-solid fa-handshake-angle',
			badgeIcon: 'fa-solid fa-dice-d20',
			badgeText: () => ts(`${P}.advantage`),
			description: () => ts(`${P}.help.panelDescription`),
			confirm: ts(`${P}.help.confirm`),
			badgeColor: 'var(--nimble-reaction-help-text)',
			badgeBackground: 'var(--nimble-reaction-help-light)',
		},
	} as const;

	const view = $derived(content[kind]);

	const target = $derived(
		kind === 'defend'
			? null
			: {
					label: kind === 'help' ? `${P}.help.helping` : `${P}.interpose.protecting`,
					noTarget: kind === 'help' ? `${P}.targetAllyOptional` : `${P}.targetAlly`,
					accent: `var(--nimble-reaction-${kind}-accent)`,
					light: `var(--nimble-reaction-${kind}-light)`,
				},
	);

	function use(id: 'defend' | 'interpose' | 'interposeAndDefend' | 'help'): void {
		void runReaction(id);
		onActivate();
	}
</script>

{#snippet combinedButton()}
	<button
		type="button"
		class="reaction-panel__button reaction-panel__button--combined"
		onclick={() => use('interposeAndDefend')}
	>
		<i class="fa-solid fa-people-arrows"></i>
		<i class="fa-solid fa-shield"></i>
		{ts(`${P}.interposeAndDefend.confirm`)}
		<span class="reaction-panel__button-cost">({combinedCost})</span>
	</button>
{/snippet}

<section
	class="reaction-panel"
	style:--primary="var(--nimble-reaction-{kind}-primary)"
	style:--secondary="var(--nimble-reaction-{kind}-secondary)"
	style:--accent="var(--nimble-reaction-{kind}-accent)"
>
	<div class="reaction-panel__header">
		<div class="reaction-panel__icon"><i class={view.icon}></i></div>
		<div class="reaction-panel__title-group">
			<h3 class="reaction-panel__title">{ts(`${P}.${kind}.title`)}</h3>
			<span class="reaction-panel__cost">
				<i class="fa-solid fa-bolt"></i>
				{cost}
			</span>
		</div>
		<div
			class="reaction-panel__badge"
			style="color: {view.badgeColor}; background: {view.badgeBackground};"
		>
			<i class={view.badgeIcon}></i>
			{view.badgeText()}
		</div>
	</div>

	<p class="reaction-panel__description">{@html view.description()}</p>

	{#if kind === 'defend'}
		<button type="button" class="reaction-panel__button" onclick={() => use('defend')}>
			<i class="fa-solid fa-shield"></i>
			{view.confirm}
		</button>

		<div class="combined-section">
			{@render combinedButton()}
			<ReactionTargets
				label={`${P}.interpose.protecting`}
				noTarget={`${P}.targetAlly`}
				multipleTargets={`${P}.selectOneTarget`}
				{targets}
				background="var(--nimble-reaction-interpose-light)"
				border="var(--nimble-reaction-interpose-accent)"
			/>
		</div>
	{:else if kind === 'interpose' && target}
		<ReactionTargets
			label={target.label}
			noTarget={target.noTarget}
			multipleTargets={`${P}.selectOneTarget`}
			{targets}
			background={target.light}
			border={target.accent}
		/>

		<div class="button-group">
			<button type="button" class="reaction-panel__button" onclick={() => use('interpose')}>
				<i class="fa-solid fa-people-arrows"></i>
				{view.confirm}
			</button>
			{@render combinedButton()}
		</div>
	{:else if target}
		<ReactionTargets
			label={target.label}
			noTarget={target.noTarget}
			multipleTargets={`${P}.selectOneTarget`}
			{targets}
			background={target.light}
			border={target.accent}
		/>

		<p class="reaction-panel__tip">
			<i class="fa-solid fa-lightbulb"></i>
			{ts(`${P}.help.tip`)}
		</p>

		<button type="button" class="reaction-panel__button" onclick={() => use('help')}>
			<i class="fa-solid fa-handshake-angle"></i>
			{view.confirm}
		</button>
	{/if}
</section>

<style>
	.reaction-panel__icon {
		background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
	}

	.reaction-panel__description :global(strong) {
		color: var(--accent);
	}

	.reaction-panel__button {
		background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
	}

	.reaction-panel__button:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.reaction-panel__button--combined {
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-interpose-secondary) 0%,
			var(--nimble-reaction-interpose-secondary) 43%,
			var(--nimble-reaction-defend-primary) 57%,
			var(--nimble-reaction-defend-primary) 100%
		);
	}

	.combined-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.button-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.reaction-panel__button-cost {
		font-size: var(--nimble-xs-text);
		font-weight: 500;
		opacity: 0.9;
	}
</style>
