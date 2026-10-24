<script lang="ts">
	import { readMove, runHeroicMacro } from '../../adapter/systemAdapter.ts';
	import { ts } from '../../localize.ts';
	import { hudState } from '../../state/hudState.svelte.ts';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
		onActivate: () => void;
	}

	let { actor, onActivate }: Props = $props();

	const P = 'NIMBLE.ui.heroicActions.move';

	const move = $derived.by(() => {
		void hudState.version;
		return readMove(actor);
	});

	function confirmMove(): void {
		// The system's macro asks for confirmation when out of actions, deducts the action and
		// posts the Move chat card, exactly like the sheet's button.
		void runHeroicMacro('move');
		onActivate();
	}
</script>

<section class="action-card">
	<div class="action-card__header">
		<div class="action-card__icon"><i class="fa-solid fa-person-running"></i></div>
		<div class="action-card__title-group">
			<h3 class="action-card__title">{ts(`${P}.title`)}</h3>
			<span class="action-card__cost">
				<i class="fa-solid fa-bolt"></i>
				{ts(`${P}.cost`)}
			</span>
		</div>
		{#if move.primary}
			<div class="action-card__stat">
				<span class="action-card__stat-label">{ts(`${P}.speed`)}</span>
				<span class="action-card__stat-value">{move.primary.value}</span>
			</div>
		{/if}
	</div>

	<p class="action-card__description">{ts(`${P}.panelDescription`)}</p>

	{#if move.speeds.length > 1}
		<div class="action-card__speeds">
			{#each move.speeds as speed (speed.type)}
				<div class="action-card__speed">
					<i class={speed.icon}></i>
					<span class="action-card__speed-value">
						{speed.value}
						<span class="action-card__speed-unit">{ts(`${P}.spaces`)}</span>
					</span>
				</div>
			{/each}
		</div>
	{/if}

	<button type="button" class="action-card__button" disabled={!move.inCombat} onclick={confirmMove}>
		<i class="fa-solid fa-person-running"></i>
		{ts(`${P}.confirmMove`)}
	</button>
</section>

<style>
	.action-card {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.75rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 8px;
	}

	.action-card__header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.action-card__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		flex-shrink: 0;
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-move-primary) 0%,
			var(--nimble-reaction-move-secondary) 100%
		);
		border-radius: 6px;
	}

	.action-card__icon i {
		font-size: 1.125rem;
		color: white;
	}

	.action-card__title-group {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.125rem;
	}

	.action-card__title {
		margin: 0;
		font-size: var(--nimble-md-text);
		font-weight: 700;
		line-height: 1.2;
		color: var(--nimble-dark-text-color);
	}

	.action-card__cost {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-size: var(--nimble-xs-text);
		font-weight: 600;
		color: var(--nimble-medium-text-color);
	}

	.action-card__cost i {
		font-size: 0.625rem;
	}

	.action-card__stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.375rem 0.625rem;
		background: var(--nimble-basic-button-background-color);
		border-radius: 6px;
	}

	.action-card__stat-label {
		font-size: var(--nimble-xs-text);
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: var(--nimble-dark-text-color);
	}

	.action-card__stat-value {
		font-size: var(--nimble-lg-text);
		font-weight: 700;
		line-height: 1;
		color: var(--nimble-reaction-move-accent);
	}

	.action-card__description {
		margin: 0;
		font-size: var(--nimble-sm-text);
		font-weight: 500;
		line-height: 1.5;
		color: var(--nimble-dark-text-color);
	}

	.action-card__speeds {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.action-card__speed {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: var(--nimble-reaction-move-light);
		border-radius: 6px;
	}

	.action-card__speed i {
		font-size: 0.875rem;
		color: var(--nimble-reaction-move-secondary);
	}

	.action-card__speed-value {
		font-size: var(--nimble-sm-text);
		font-weight: 700;
		color: var(--nimble-reaction-move-text);
	}

	.action-card__speed-unit {
		font-weight: 500;
	}

	.action-card__button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.625rem 1rem;
		font: inherit;
		font-size: var(--nimble-sm-text);
		font-weight: 700;
		color: white;
		cursor: pointer;
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-move-primary) 0%,
			var(--nimble-reaction-move-secondary) 100%
		);
		border: none;
		border-radius: 6px;
		transition: var(--nimble-standard-transition);
	}

	.action-card__button:hover:not(:disabled) {
		filter: brightness(1.1);
		transform: translateY(-1px);
	}

	.action-card__button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-card__button i {
		font-size: 0.875rem;
	}
</style>
