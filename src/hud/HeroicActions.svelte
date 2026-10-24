<script lang="ts">
	import type { HeroicPopupId, HeroicTab } from '../adapter/types.ts';

	interface Props {
		label: string;
		tabs: HeroicTab[];
		active: HeroicPopupId | null;
		onSelect: (id: HeroicPopupId) => void;
	}

	let { label, tabs, active, onSelect }: Props = $props();
</script>

<div class="heroic hud-heroic">
	<span class="label">{label}</span>
	<div class="buttons">
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				class="button"
				class:active={active === tab.id}
				class:dimmed={tab.dimmed}
				aria-pressed={active === tab.id}
				aria-label={tab.label}
				data-hud-tooltip={tab.tooltip}
				disabled={tab.disabled}
				onclick={() => onSelect(tab.id)}
			>
				<i class={tab.icon}></i>
				{#if tab.pip && tab.pip !== 'none'}
					<span class="pip pip--{tab.pip}"></span>
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.heroic {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.375rem;
	}

	.label {
		color: var(--hud-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-align: left;
		text-transform: uppercase;
	}

	.buttons {
		display: flex;
		gap: var(--hud-row-gap);
	}

	.button {
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: var(--hud-row-height);
		padding: 0;
		cursor: pointer;
		color: var(--hud-text);
		font: inherit;
		background: rgb(255 255 255 / 0.06);
		border: 1px solid var(--hud-border);
		border-radius: 0.375rem;
	}

	.button:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.14);
	}

	.button.active {
		color: var(--hud-accent);
		border-color: var(--hud-accent);
	}

	.button.dimmed {
		opacity: 0.65;
	}

	/* Availability pip, same colors as the character sheet's reaction tabs. */
	.pip {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		width: 0.5rem;
		height: 0.5rem;
		box-sizing: border-box;
		border: 2px solid;
		border-radius: 50%;
	}

	.pip--available {
		background: hsl(145, 55%, 48%);
		border-color: hsl(145, 55%, 36%);
		box-shadow: 0 0 8px hsla(145, 55%, 48%, 0.35);
	}

	.pip--spent {
		background: hsla(0, 0%, 100%, 0.1);
		border-color: hsl(8, 65%, 48%);
		box-shadow: 0 0 6px hsla(8, 65%, 48%, 0.18);
	}

	.button:disabled {
		cursor: default;
		opacity: 0.4;
	}
</style>
