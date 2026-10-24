<script lang="ts">
	import { readAssess, rollAssess } from '../../adapter/systemAdapter.ts';
	import { ts } from '../../localize.ts';
	import { hudState } from '../../state/hudState.svelte.ts';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
		onActivate: () => void;
	}

	let { actor, onActivate }: Props = $props();

	const P = 'NIMBLE.ui.heroicActions.assess';

	const assess = readAssess();

	let selectedOption = $state<string | null>(null);
	let selectedSkill = $state<string | null>(null);

	const skillName = $derived(assess.skills.find((skill) => skill.key === selectedSkill)?.name ?? '');
	const disabled = $derived(!selectedOption || !selectedSkill);

	function roll(): void {
		if (!selectedOption || !selectedSkill) return;
		void rollAssess(actor, selectedOption, selectedSkill);
		onActivate();
	}
</script>

<section class="assess">
	<h3 class="heading">{ts(`${P}.header`)}</h3>

	<div class="options">
		{#each assess.options as option (option.id)}
			<label class="option" class:option--active={selectedOption === option.id}>
				<input class="option__input" type="radio" name="assess-option" value={option.id} bind:group={selectedOption} />
				<i class="option__icon {option.icon}"></i>
				<div class="option__content">
					<span class="option__title">{option.title}</span>
					<span class="option__description">{option.description}</span>
				</div>
				<div class="option__indicator"></div>
			</label>
		{/each}
	</div>

	<select class="select" bind:value={selectedSkill}>
		<option value={null} disabled>{ts(`${P}.selectSkillPlaceholder`)}</option>
		{#each assess.skills as skill (skill.key)}
			<option value={skill.key}>{skill.name}</option>
		{/each}
	</select>

	<button type="button" class="roll" {disabled} onclick={roll}>
		<i class="fa-solid fa-dice-d20"></i>
		{#if !selectedOption}
			{ts(`${P}.selectOption`)}
		{:else if !selectedSkill}
			{ts(`${P}.selectSkill`)}
		{:else}
			{ts(`${P}.rollToAssess`, { skill: skillName })}
		{/if}
	</button>
</section>

<style>
	.assess {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.heading {
		margin: 0;
		font-size: var(--nimble-sm-text);
		font-weight: 900;
		line-height: 1;
		text-transform: uppercase;
		color: var(--nimble-dark-text-color);
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.option {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.5rem;
		cursor: pointer;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 6px;
		transition: all 0.2s ease;
	}

	.option:hover:not(.option--active) {
		border-color: var(--nimble-accent-color);
	}

	.option--active {
		border-color: hsl(45, 60%, 45%);
		background: hsla(45, 60%, 50%, 0.12);
	}

	.option__input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.option__icon {
		flex-shrink: 0;
		margin-top: 0.125rem;
		font-size: var(--nimble-sm-text);
		color: var(--nimble-medium-text-color);
		transition: color 0.2s ease;
	}

	.option--active .option__icon {
		color: hsl(45, 60%, 40%);
	}

	.option__content {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.option__title {
		font-size: var(--nimble-sm-text);
		font-weight: 600;
		line-height: 1.2;
		color: var(--nimble-dark-text-color);
	}

	.option--active .option__title {
		color: hsl(45, 50%, 30%);
	}

	.option__description {
		font-size: var(--nimble-xs-text);
		font-weight: 500;
		line-height: 1.3;
		color: var(--nimble-medium-text-color);
	}

	.option__indicator {
		position: absolute;
		top: 0.375rem;
		right: 0.375rem;
		width: 0.5rem;
		height: 0.5rem;
		background: transparent;
		border-radius: 50%;
		transition: all 0.2s ease;
	}

	.option--active .option__indicator {
		background: hsl(45, 70%, 50%);
		box-shadow: 0 0 6px hsla(45, 70%, 50%, 0.6);
	}

	/* The dark variants the sheet applies under .theme-dark. */
	:global(.theme-dark) .option {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);
	}

	:global(.theme-dark) .option:hover:not(.option--active) {
		border-color: hsl(220, 15%, 45%);
	}

	:global(.theme-dark) .option--active {
		border-color: hsl(45, 70%, 55%);
		background: hsla(45, 60%, 50%, 0.15);
	}

	:global(.theme-dark) .option--active .option__icon {
		color: hsl(45, 70%, 65%);
	}

	:global(.theme-dark) .option--active .option__title {
		color: hsl(45, 60%, 75%);
	}

	:global(.theme-dark) .option--active .option__indicator {
		background: hsl(45, 70%, 55%);
		box-shadow: 0 0 8px hsla(45, 70%, 55%, 0.7);
	}

	.select {
		width: 100%;
		padding: 0.375rem 0.5rem;
		font: inherit;
		font-size: var(--nimble-sm-text);
		font-weight: 500;
		cursor: pointer;
		color: #ece8df;
		color-scheme: dark;
		background: hsl(220, 15%, 18%);
		border: 1px solid hsl(220, 10%, 30%);
		border-radius: 4px;
	}

	/* The opened list takes its colors from the options, so set them explicitly. */
	.select option {
		color: #ece8df;
		background: hsl(220, 15%, 18%);
	}

	.select:focus {
		outline: none;
		border-color: hsl(220, 15%, 45%);
	}

	.roll {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		margin-top: 0.25rem;
		padding: 0.5rem 0.75rem;
		font: inherit;
		font-size: var(--nimble-sm-text);
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
		color: var(--nimble-dark-text-color);
		background: var(--nimble-basic-button-background-color);
		border: 0;
		border-radius: 4px;
		transition: var(--nimble-standard-transition);
	}

	.roll:hover:not(:disabled) {
		filter: brightness(1.1);
	}

	.roll:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.roll i {
		font-size: 0.875rem;
	}
</style>
