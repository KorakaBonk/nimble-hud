<script lang="ts">
	import { dieFaceIcon } from '../adapter/derive.ts';
	import {
		canEditPools,
		rollAndSpendCharge,
		rollIntoPool,
		setPoolFaces,
	} from '../adapter/systemAdapter.ts';
	import type { ChargeView, PoolView } from '../adapter/types.ts';
	import { ts } from '../localize.ts';
	import { hudState } from '../state/hudState.svelte.ts';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
		pools: PoolView[];
		charges: ChargeView[];
	}

	let { actor, pools, charges }: Props = $props();

	const P = 'NIMBLE.dicePoolTracker';

	const owner = $derived.by(() => {
		void hudState.version;
		return canEditPools(actor);
	});

	function chargeTooltip(charge: ChargeView): string {
		const recoveries =
			charge.recoveries.length > 0
				? charge.recoveries.join('; ')
				: ts('NIMBLE.charges.noRecoveryConfigured');
		return `${charge.label} (${charge.current}/${charge.max}) · ${ts('NIMBLE.charges.recoveryMethods')}: ${recoveries}`;
	}

	function discard(event: MouseEvent, pool: PoolView, index: number | 'all'): void {
		event.preventDefault();
		if (pool.kind !== 'rolled') return;
		void setPoolFaces(actor, pool, index === 'all' ? [] : pool.faces.filter((_, i) => i !== index));
	}
</script>

<div class="pool-tabs">
	{#each pools as pool (pool.id)}
		<div class="tab">
			{#if pool.kind === 'count'}
				<span
					class="badge"
					data-hud-tooltip={ts(`${P}.countTooltip`, {
						label: pool.label,
						current: pool.current,
						max: pool.max,
					})}
				>
					<i class="fa-solid {dieFaceIcon(pool.dieSize)}"></i>
				</span>
				{#each { length: pool.max } as _, index (index)}
					{@const available = index < pool.current}
					<button
						type="button"
						class="pip"
						class:available
						disabled={!available}
						aria-label={available
							? ts(`${P}.rollAndSpendOne`, { label: pool.label })
							: ts(`${P}.spent`, { label: pool.label })}
						data-hud-tooltip={available
							? ts(`${P}.clickToRoll`)
							: ts(`${P}.spent`, { label: pool.label })}
						onclick={() => rollAndSpendCharge(actor, pool)}
					>
						<i class="fa-solid {dieFaceIcon(pool.dieSize)}"></i>
					</button>
				{/each}
			{:else}
				<span
					class="badge"
					data-hud-tooltip={pool.faces.length > 0
						? ts(`${P}.rolledTooltip`, {
								label: pool.label,
								count: pool.faces.length,
								max: pool.max,
								total: pool.total,
							})
						: ts(`${P}.emptyTooltip`, { label: pool.label, max: pool.max })}
				>
					<i class="fa-solid {dieFaceIcon(pool.dieSize)}"></i>
				</span>

				{#each pool.faces as face, index (index)}
					<button
						type="button"
						class="chip"
						aria-label={ts(`${P}.discardDieAria`, { label: pool.label, value: face })}
						data-hud-tooltip={ts(`${P}.rightClickToDiscard`, { value: face })}
						oncontextmenu={(event) => discard(event, pool, index)}
					>
						{face}
					</button>
				{/each}

				{#if pool.faces.length < pool.max && owner}
					<button
						type="button"
						class="chip chip--add chip--step"
						aria-label={ts(`${P}.rollOneIntoPool`)}
						data-hud-tooltip={ts(`${P}.rollOneIntoPool`)}
						onclick={() => rollIntoPool(actor, pool)}
					>
						<i class="fa-solid fa-plus"></i>
					</button>
				{/if}

				{#if pool.faces.length > 1}
					<button
						type="button"
						class="chip chip--total"
						aria-label={ts(`${P}.discardAllAria`, { label: pool.label, total: pool.total })}
						data-hud-tooltip={ts(`${P}.rightClickToDiscardAll`, { total: pool.total })}
						oncontextmenu={(event) => discard(event, pool, 'all')}
					>
						{pool.total}
					</button>
				{/if}
			{/if}
		</div>
	{/each}

	{#each charges as charge (charge.id)}
		<div class="tab tab--charge">
			<span class="badge badge--charge" data-hud-tooltip={chargeTooltip(charge)}>
				<i class={charge.icon}></i>
				<span class="name">{charge.label}</span>
			</span>
			<span
				class="value"
				class:full={charge.current >= charge.max}
				class:empty={charge.current <= 0}
			>
				{charge.current}/{charge.max}
			</span>
		</div>
	{/each}
</div>

<style>
	/* Tabs sticking out above the bar's top-left corner, one per dice pool. */
	.pool-tabs {
		position: absolute;
		left: 0.75rem;
		bottom: 100%;
		display: flex;
		gap: 0.25rem;
	}

	.tab {
		display: flex;
		align-items: center;
		box-sizing: border-box;
		gap: 0.25rem;
		/* Taller than the buttons inside, so their borders keep clear of the tab's border. */
		height: var(--hud-tab-height);
		padding: 0 0.5rem;
		background: var(--hud-bg);
		border: 1px solid var(--hud-border);
		border-bottom: none;
		border-radius: 0.375rem 0.375rem 0 0;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		color: var(--hud-accent);
		font-size: 0.9375rem;
		cursor: help;
	}

	.badge--charge {
		gap: 0.25rem;
	}

	.badge--charge i {
		font-size: 0.75rem;
	}

	.name {
		max-width: 8rem;
		overflow: hidden;
		color: var(--hud-text);
		font-size: 0.75rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.value {
		min-width: 1.75rem;
		color: #d9b45a;
		font-size: 0.75rem;
		font-weight: 700;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.value.full {
		color: #4fb36f;
	}

	.value.empty {
		color: #d96a6a;
	}

	.chip,
	.pip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.125rem;
		height: 1.125rem;
		padding: 0 0.1875rem;
		color: var(--hud-text);
		font: inherit;
		font-size: 0.75rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		background: rgb(255 255 255 / 0.08);
		border: 1px solid var(--hud-border);
		border-radius: 0.25rem;
		cursor: pointer;
	}

	.chip:hover,
	.pip:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.18);
		border-color: var(--hud-accent);
	}

	.chip--add {
		opacity: 0.7;
	}

	/* The roll-into-pool + button is smaller than the die chips. */
	.chip--step {
		min-width: 0.5rem;
		height: 0.5rem;
		padding: 0 0.17rem;
		font-size: 0.5rem;
	}

	.chip--total {
		color: var(--hud-accent);
	}

	.pip {
		padding: 0;
		font-size: 0.8125rem;
		color: var(--hud-muted);
	}

	.pip.available {
		color: #4fb36f;
	}

	.pip:disabled {
		cursor: default;
		opacity: 0.45;
	}
</style>
