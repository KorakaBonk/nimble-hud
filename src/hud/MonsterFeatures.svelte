<script lang="ts">
	import { activateItem, readMonsterFeatures } from '../adapter/systemAdapter.ts';
	import { ts } from '../localize.ts';
	import { hudState } from '../state/hudState.svelte.ts';
	import EnrichedHtml from './heroic/EnrichedHtml.svelte';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
	}

	let { actor }: Props = $props();

	const groups = $derived.by(() => {
		void hudState.version;
		return readMonsterFeatures(actor);
	});

	// Two sections side by side: the actions, and everything else (features, Bloodied, Last Stand).
	const columns = $derived(
		[
			groups.filter((group) => group.category !== 'action'),
			groups.filter((group) => group.category === 'action'),
		].filter((column) => column.length > 0),
	);
</script>

<div class="sections">
	{#each columns as column (column[0]?.category)}
		<section class="features">
			<div class="scroll">
				{#each column as group (group.category)}
					<div class="group">
						<span class="group-label">
							{group.category === 'feature' ? ts('NIMBLE.npcSheet.features') : group.label}
						</span>

						{#each group.entries as entry (entry.id)}
							{#if entry.kind === 'card'}
								<button
									type="button"
									class="feature"
									class:feature--nested={entry.nested}
									data-hud-tooltip={entry.tooltip || undefined}
									onclick={() => activateItem(actor, entry.id)}
								>
									{#if entry.img}
										<img src={entry.img} alt="" draggable="false" />
									{/if}
									<i class="indicator fa-solid {entry.hasEffects ? 'fa-dice-d20' : 'fa-comment'}"></i>
									<span class="name">{entry.name}</span>
									{#if entry.rangeLabel}
										<span class="range">{entry.rangeLabel}</span>
									{/if}
								</button>
							{:else if entry.kind === 'static'}
								<div class="feature feature--static" data-hud-tooltip={entry.tooltip || undefined}>
									<span class="static-icon static-icon--{entry.tone}"><i class={entry.icon}></i></span>
									<span class="name">{entry.name}</span>
								</div>
							{:else if entry.kind === 'sequence'}
								<div class="sequence"><EnrichedHtml html={entry.description} /></div>
							{:else}
								<span class="header">{entry.name}</span>
							{/if}
						{/each}
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>

<style>
	.sections {
		display: flex;
		gap: 0.5rem;
		margin-left: auto;
	}

	/* Each section scrolls inside a box that takes its height from the rest of the bar. */
	.features {
		position: relative;
		flex: none;
		width: 12rem;
	}

	.scroll {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding-right: 0.25rem;
		overflow-y: auto;
		scrollbar-width: thin;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: 0.1875rem;
	}

	.group-label {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 0.0625rem 0;
		color: var(--hud-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		background: var(--hud-bg);
	}

	.feature {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.125rem 0.375rem 0.125rem 0.125rem;
		color: var(--hud-text);
		font: inherit;
		font-size: 0.8125rem;
		text-align: left;
		cursor: pointer;
		background: rgb(255 255 255 / 0.06);
		border: 1px solid var(--hud-border);
		border-radius: 0.375rem;
	}

	.feature:hover {
		background: rgb(255 255 255 / 0.15);
		border-color: var(--hud-accent);
	}

	/* Nothing to activate: same look as a feature, without the hover and click affordance. */
	.feature--static {
		cursor: default;
	}

	.feature--static:hover {
		background: rgb(255 255 255 / 0.06);
		border-color: var(--hud-border);
	}

	.static-icon {
		display: inline-flex;
		flex: none;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		color: var(--hud-muted);
		background: rgb(255 255 255 / 0.08);
		border-radius: 0.25rem;
	}

	/* Armor: none is green, medium orange, heavy red. */
	.static-icon--none {
		color: #4fb36f;
	}

	.static-icon--medium {
		color: #e0954a;
	}

	.static-icon--heavy {
		color: #d96a6a;
	}

	.feature--nested {
		margin-left: 1rem;
	}

	.feature img {
		flex: none;
		width: 1.5rem;
		height: 1.5rem;
		border: none;
		border-radius: 0.25rem;
		object-fit: cover;
	}

	.indicator {
		flex: none;
		width: 1rem;
		color: var(--hud-muted);
		font-size: 0.75rem;
		text-align: center;
	}

	.name {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.range {
		flex: none;
		color: var(--hud-muted);
		font-size: 0.6875rem;
	}

	.header {
		color: var(--hud-text);
		font-size: 0.8125rem;
		font-weight: 700;
	}

	.sequence {
		color: var(--hud-muted);
		font-size: 0.75rem;
		line-height: 1.35;
	}

	.sequence :global(p) {
		margin: 0;
	}
</style>
