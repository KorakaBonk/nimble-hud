<script lang="ts">
	import { formatModifier } from '../adapter/derive.ts';
	import {
		readStats,
		rollAbilityCheck,
		rollSavingThrow,
		rollSkillCheck,
	} from '../adapter/systemAdapter.ts';
	import type { StatEntry } from '../adapter/types.ts';
	import { hudState } from '../state/hudState.svelte.ts';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
		kind: 'stats' | 'saves' | 'skills';
		onRoll: () => void;
	}

	let { actor, kind, onRoll }: Props = $props();

	function roll(action: () => void): void {
		action();
		onRoll();
	}

	const stats = $derived.by(() => {
		void hudState.version;
		return readStats(actor);
	});
</script>

{#snippet rollMode(entry: StatEntry)}
	{#if entry.rollMode > 0}
		<i class="fa-solid fa-circle-plus adv"></i>
	{:else if entry.rollMode < 0}
		<i class="fa-solid fa-circle-minus dis"></i>
	{/if}
{/snippet}

{#snippet abilityIcon(entry: StatEntry)}
	{#if entry.ability}
		<span class="ability" data-ability={entry.ability.key} aria-hidden="true">
			<i class={entry.ability.icon}></i>
		</span>
	{/if}
{/snippet}

{#snippet entryButton(entry: StatEntry, roll: () => void)}
	<button
		type="button"
		class="entry"
		data-hud-tooltip={entry.label}
		aria-label="{entry.label} {formatModifier(entry.modifier)}"
		onclick={roll}
	>
		<span class="abbr">
			{@render abilityIcon(entry)}
			{entry.abbreviation}
		</span>
		<span class="mod">
			{formatModifier(entry.modifier)}
			{@render rollMode(entry)}
		</span>
	</button>
{/snippet}

{#if kind === 'stats'}
	<div class="grid grid--short">
		{#each stats.abilities as entry (entry.key)}
			{@render entryButton(entry, () => roll(() => rollAbilityCheck(actor, entry.key)))}
		{/each}
	</div>
{:else if kind === 'saves'}
	<div class="grid grid--short">
		{#each stats.saves as entry (entry.key)}
			{@render entryButton(entry, () => roll(() => rollSavingThrow(actor, entry.key)))}
		{/each}
	</div>
{:else}
	<div class="grid grid--skills">
		{#each stats.skills as entry (entry.key)}
			<button
				type="button"
				class="skill"
				aria-label="{entry.label} {formatModifier(entry.modifier)}"
				onclick={() => roll(() => rollSkillCheck(actor, entry.key))}
			>
				<span
					class="ability"
					data-ability={entry.ability?.key}
					data-hud-tooltip={entry.ability?.name}
					aria-label={entry.ability?.name}
				>
					<i class={entry.ability?.icon}></i>
				</span>
				<span class="skill-name">{entry.label}</span>
				<span class="mod">
					{formatModifier(entry.modifier)}
					{@render rollMode(entry)}
				</span>
			</button>
		{/each}
	</div>
{/if}

<style>
	.grid {
		display: grid;
		gap: 0.25rem;
	}

	.grid--short {
		grid-template-columns: repeat(4, 4.5rem);
	}

	/* Two columns of five, filled column by column like the character sheet. */
	.grid--skills {
		grid-template-columns: repeat(2, 11rem);
		grid-template-rows: repeat(5, max-content);
		grid-auto-flow: column;
		gap: 0.125rem 1rem;
	}

	.entry,
	.skill {
		cursor: pointer;
		display: flex;
		align-items: center;
		color: var(--hud-text);
		background: rgb(255 255 255 / 0.06);
		border: 1px solid var(--hud-border);
		border-radius: 0.375rem;
		font: inherit;
	}

	.entry {
		flex-direction: column;
		justify-content: center;
		gap: 0.125rem;
		min-height: 3rem;
		padding: 0.5rem;
	}

	.skill {
		gap: 0.5rem;
		padding: 0.1875rem 0.5rem;
		font-size: 0.8125rem;
	}

	.skill-name {
		flex: 1;
		text-align: start;
	}

	.entry:hover,
	.skill:hover {
		background: rgb(255 255 255 / 0.15);
		border-color: var(--hud-accent);
	}

	.abbr {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		color: var(--hud-muted);
		font-size: 0.6875rem;
		font-weight: 700;
	}

	/* Same ability colors as the character sheet. */
	.ability {
		width: 1.125rem;
		text-align: center;
		color: var(--hud-muted);
	}

	.ability[data-ability='strength'] {
		color: hsl(0 70% 55%);
	}

	.ability[data-ability='dexterity'] {
		color: hsl(140 60% 45%);
	}

	.ability[data-ability='intelligence'] {
		color: hsl(270 60% 65%);
	}

	.ability[data-ability='will'] {
		color: hsl(30 90% 55%);
	}

	.mod {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.adv {
		color: #6fcf7f;
		font-size: 0.625rem;
	}

	.dis {
		color: #e07b7b;
		font-size: 0.625rem;
	}
</style>
