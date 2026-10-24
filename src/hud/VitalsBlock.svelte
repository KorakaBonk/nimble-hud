<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ConditionView, ResourcePoolView, VitalsView } from '../adapter/types.ts';
	import { t, tf, ts } from '../localize.ts';
	import ConditionStrip from './ConditionStrip.svelte';

	interface Props {
		vitals: VitalsView;
		conditions: ConditionView[];
		onOpenSheet: () => void;
		onRollHitDice: () => void;
		onSetHP: (value: number) => void;
		onSetMana: (value: number) => void;
		/** +1 / -1 mana. */
		onChangeMana: (delta: number) => void;
		/** Sets the current value of a spell-paying charge pool shown beside mana. */
		onSetPool: (pool: ResourcePoolView, value: number) => void;
		/** +1 / -1 hit point. */
		onChangeHP: (delta: number) => void;
		/** +1 on left click, -1 on right click. */
		onChangeWounds: (delta: number) => void;
		/** Shown as field and safe rest buttons on the name line (player characters only). */
		onRest?: (restType: 'field' | 'safe') => void;
		/** Rendered between the portrait and the details column. */
		children?: Snippet;
	}

	let { vitals, conditions, onOpenSheet, onRollHitDice, onSetHP, onSetMana, onChangeMana, onSetPool, onChangeHP, onChangeWounds, onRest, children }: Props = $props();

	let portraitWidth = $state(0);
	let portraitHeight = $state(0);

	const woundSlots = $derived(Math.max(0, vitals.wounds?.max ?? 0));
	// Monsters have no chips (their armor is listed with their features).
	const showChips = $derived(!vitals.monster);
	// Mana and the charge pools the sheet promotes beside it share one row.
	const hasResources = $derived(vitals.mana !== null || vitals.resourcePools.length > 0);

	interface ResourceBar {
		kind: 'mana' | 'pool';
		icon: string;
		label: string;
		value: number;
		max: number;
		percent: number;
		addLabel: string;
		removeLabel: string;
		onSet: (value: number) => void;
		onChange: (delta: number) => void;
	}
</script>

{#snippet resourceBar(bar: ResourceBar)}
	<div
		class="bar bar--{bar.kind}"
		style:--fill="{bar.percent}%"
		role="meter"
		aria-label={bar.label}
		aria-valuenow={bar.value}
		aria-valuemin={0}
		aria-valuemax={bar.max}
	>
		<span class="bar-label bar-label--hp">
			<button
				type="button"
				class="step"
				aria-label={bar.removeLabel}
				data-hud-tooltip={bar.removeLabel}
				onclick={() => bar.onChange(-1)}
			>
				<i class="fa-solid fa-minus"></i>
			</button>

			<span class="hp-value" data-hud-tooltip={bar.kind === 'pool' ? bar.label : undefined}>
				<i class={bar.icon}></i>
				<input
					class="hp-input"
					type="number"
					min="0"
					max={bar.max}
					aria-label={bar.label}
					value={bar.value}
					onfocus={(event) => event.currentTarget.select()}
					onchange={(event) => {
						const input = event.currentTarget;
						if (input.value === '') input.value = String(bar.value);
						else bar.onSet(Number(input.value));
					}}
				/>
				/ {bar.max}
			</span>

			<button
				type="button"
				class="step"
				aria-label={bar.addLabel}
				data-hud-tooltip={bar.addLabel}
				onclick={() => bar.onChange(1)}
			>
				<i class="fa-solid fa-plus"></i>
			</button>
		</span>
	</div>
{/snippet}

<div class="vitals">
	<div
		class="portrait-column"
		style:width={portraitHeight > 0 ? `${portraitHeight}px` : undefined}
		bind:clientWidth={portraitWidth}
		bind:clientHeight={portraitHeight}
	>
		<button
			type="button"
			class="portrait"
			data-hud-tooltip={t('openSheet')}
			aria-label={t('openSheet')}
			onclick={onOpenSheet}
		>
			<img
				src={vitals.portrait.img}
				alt={vitals.name}
				draggable="false"
				style:--x-offset="{vitals.portrait.xOffset}px"
				style:--y-offset="{vitals.portrait.yOffset}px"
				style:--scale="{vitals.portrait.scale}%"
			/>
		</button>
		<ConditionStrip {conditions} width={portraitWidth} height={portraitHeight} />
	</div>

	{@render children?.()}

	<div
		class="details"
		class:details--monster={vitals.monster}
		class:details--mana={hasResources}
	>
		<div class="title">
			<div class="title-row" class:title-row--rest={!!onRest}>
				<span class="name">{vitals.name}</span>
				{#if onRest}
					<span class="rest-buttons">
						<button
							type="button"
							class="rest"
							aria-label={ts('NIMBLE.prompts.fieldRest')}
							data-hud-tooltip={ts('NIMBLE.prompts.fieldRest')}
							onclick={() => onRest('field')}
						>
							<i class="fa-regular fa-hourglass-half"></i>
						</button>
						<button
							type="button"
							class="rest"
							aria-label={ts('NIMBLE.prompts.safeRest')}
							data-hud-tooltip={ts('NIMBLE.prompts.safeRest')}
							onclick={() => onRest('safe')}
						>
							<i class="fa-solid fa-moon"></i>
						</button>
					</span>
				{/if}
			</div>
			{#if vitals.summary}<span class="summary">{vitals.summary}</span>{/if}
			{#each vitals.defenses as defense (defense.kind)}
				<span class="summary defense">
					<strong class="defense--{defense.kind}">{defense.label}:</strong>
					{defense.types}
				</span>
			{/each}
		</div>

		{#if vitals.showHp}
		<div
			class="bar bar--hp"
			class:bar--low={vitals.hp.percent <= 50}
			style:--fill="{vitals.hp.percent}%"
			role="meter"
			aria-label={t('hp')}
			aria-valuenow={vitals.hp.value}
			aria-valuemin={0}
			aria-valuemax={vitals.hp.max}
		>
			<span class="bar-label bar-label--hp">
				<button
					type="button"
					class="step"
					aria-label={t('removeHp')}
					data-hud-tooltip={t('removeHp')}
					onclick={() => onChangeHP(-1)}
				>
					<i class="fa-solid fa-minus"></i>
				</button>

				<span class="hp-value">
					{#if vitals.hp.bloodied}
						<i class="fa-solid fa-heart-crack" data-hud-tooltip={t('bloodied')}></i>
					{:else}
						<i class="fa-solid fa-heart"></i>
					{/if}
					<input
						class="hp-input"
						type="number"
						min="0"
						max={vitals.hp.max}
						aria-label={t('hp')}
						value={vitals.hp.value}
						onfocus={(event) => event.currentTarget.select()}
						onchange={(event) => {
							const input = event.currentTarget;
							if (input.value === '') input.value = String(vitals.hp.value);
							else onSetHP(Number(input.value));
						}}
					/>
					/ {vitals.hp.max}
					{#if vitals.hp.temp > 0}
						<span class="temp" data-hud-tooltip={t('tempHp')}>+{vitals.hp.temp}</span>
					{/if}
				</span>

				<button
					type="button"
					class="step"
					aria-label={t('addHp')}
					data-hud-tooltip={t('addHp')}
					onclick={() => onChangeHP(1)}
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			</span>
		</div>
		{/if}

		{#if hasResources}
			<div class="resources">
				{#if vitals.mana}
					{@render resourceBar({
						kind: 'mana',
						icon: 'fa-solid fa-sparkles',
						label: t('mana'),
						value: vitals.mana.value,
						max: vitals.mana.max,
						percent: vitals.mana.percent,
						addLabel: t('addMana'),
						removeLabel: t('removeMana'),
						onSet: onSetMana,
						onChange: onChangeMana,
					})}
				{/if}
				{#each vitals.resourcePools as pool (pool.id)}
					{@render resourceBar({
						kind: 'pool',
						icon: pool.icon,
						label: pool.label,
						value: pool.value,
						max: pool.max,
						percent: pool.percent,
						addLabel: tf('addPool', { pool: pool.label }),
						removeLabel: tf('removePool', { pool: pool.label }),
						onSet: (value) => onSetPool(pool, value),
						onChange: (delta) => onSetPool(pool, pool.value + delta),
					})}
				{/each}
			</div>
		{/if}

		{#if showChips}
		<div class="chips">
			{#if vitals.speed !== null}
				<span class="chip">
					<i class="fa-solid fa-person-walking"></i>
					{vitals.speed}
				</span>
			{/if}

			{#if vitals.armorLabel}
				<span class="chip" data-hud-tooltip={t('armor')}>
					<i class="fa-solid fa-shield"></i>
					{vitals.armorLabel}
				</span>
			{/if}

			{#if vitals.hitDice && vitals.hitDice.total > 0}
				<button
					type="button"
					class="chip chip--button"
					aria-label={t('rollHitDice')}
					data-hud-tooltip={t('rollHitDice')}
					onclick={onRollHitDice}
				>
					<i class="fa-solid fa-heart-circle-plus"></i>
					{vitals.hitDice.current}/{vitals.hitDice.total}
				</button>
			{/if}

			{#if vitals.wounds && woundSlots > 0}
				<button
					type="button"
					class="wounds"
					aria-label="{t('wounds')} {vitals.wounds.value}/{vitals.wounds.max}"
					data-hud-tooltip="{t('wounds')} {vitals.wounds.value}/{vitals.wounds.max}"
					onclick={() => onChangeWounds(1)}
					oncontextmenu={(event) => {
						event.preventDefault();
						onChangeWounds(-1);
					}}
				>
					{#each { length: woundSlots }, index}
						<i
							class="fa-solid fa-droplet drop"
							class:drop--filled={index < vitals.wounds.value}
						></i>
					{/each}
				</button>
			{/if}
		</div>
		{/if}
	</div>
</div>

<style>
	.vitals {
		display: flex;
		align-items: stretch;
		gap: 0.75rem;
	}

	.portrait-column {
		position: relative;
		display: flex;
		flex: none;
		flex-direction: column;
		/* Until the height is measured; afterwards the width is set to it, so the portrait is square. */
		width: 6.25rem;
	}

	.portrait {
		pointer-events: auto;
		width: 100%;
		flex: 1;
		min-height: 0;
		/* The image must not drive the HUD height; the portrait fills whatever the details column needs. */
		contain: size;
		padding: 0;
		overflow: hidden;
		cursor: pointer;
		background: #000;
		border: 2px solid var(--hud-accent);
		border-radius: 0.5rem;
	}

	.portrait img {
		position: relative;
		top: var(--y-offset, 0);
		left: var(--x-offset, 0);
		display: block;
		width: 100%;
		height: auto;
		max-height: 100%;
		scale: var(--scale, 100%);
		transform-origin: top center;
		object-fit: contain;
		object-position: top center;
		border: 0;
	}

	.details {
		display: flex;
		flex-direction: column;
		gap: var(--hud-row-gap);
		min-width: 14rem;
	}

	/* Monsters: keep the height of the character HUD and sit the HP bar at the bottom. */
	.details--monster {
		min-height: calc(3 * var(--hud-row-height) + 2 * var(--hud-row-gap));
	}

	.details--monster .bar--hp {
		margin-top: auto;
	}

	/*
	 * With a mana bar the section has five rows instead of four. Slimmer bars (and a slimmer chip
	 * row) keep it within the three-row height the HUD has without mana:
	 * 2.25 (title) + 1.25 + 1.25 (bars) + 1.625 (chips) + 3 row gaps stays within 7.5rem.
	 */
	.details--mana {
		--hud-row-gap: 0.28rem;
	}

	.details--mana .bar {
		height: 1.25rem;
	}

	.details--mana .chips {
		min-height: 1.625rem;
	}

	.details--mana .bar-label {
		font-size: 0.75rem;
	}

	.details--mana .hp-input {
		height: 1.0625rem;
		font-size: 0.75rem;
	}

	.title {
		display: flex;
		flex-direction: column;
		justify-content: center;
		min-height: var(--hud-row-height);
		line-height: 1.15;
	}

	.title-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	/* The name line never widens the HUD: a long name is cut off to make room for the rest buttons. */
	.title-row--rest {
		contain: inline-size;
	}

	.name {
		min-width: 0;
		overflow: hidden;
		font-size: 1.125rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* Same font size as the name, and no taller than its line, so the title row keeps its height. */
	.rest-buttons {
		display: inline-flex;
		flex-shrink: 0;
		gap: 0.25rem;
		font-size: 1.125rem;
	}

	.rest {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		width: 1.15em;
		height: 1.15em;
		min-height: 0;
		margin: 0;
		padding: 0;
		cursor: pointer;
		color: var(--hud-muted);
		font-size: inherit;
		line-height: 1;
		background: transparent;
		border: none;
		border-radius: 0.25rem;
	}

	.rest i {
		font-size: 0.75em;
		margin: 0;
	}

	.rest:hover {
		color: var(--hud-accent);
		background: rgb(255 255 255 / 0.1);
	}

	.summary {
		color: var(--hud-muted);
		font-size: 0.75rem;
	}

	.defense--resistant {
		color: #6fcf7f;
	}

	.defense--immune {
		color: #5aa7e0;
	}

	.defense--vulnerable {
		color: #e07b7b;
	}

	.bar {
		position: relative;
		height: var(--hud-row-height);
		overflow: hidden;
		background: rgb(255 255 255 / 0.08);
		border: 1px solid var(--hud-border);
		border-radius: 0.25rem;
	}

	.bar::before {
		content: '';
		position: absolute;
		inset: 0 auto 0 0;
		width: var(--fill, 0%);
		background: var(--bar-color);
		transition: width 0.25s ease;
	}

	.bar--hp {
		--bar-color: #3f8f4a;
	}

	.bar--hp.bar--low {
		--bar-color: #a53a3a;
	}

	.bar--mana {
		--bar-color: #3a6ea5;
	}

	.bar--pool {
		--bar-color: #7a4fa5;
	}

	.resources {
		display: flex;
		gap: 0.25rem;
	}

	.resources .bar {
		flex: 1 1 0;
		min-width: 0;
	}

	.bar-label {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		height: 100%;
		font-size: 0.8125rem;
		font-weight: 600;
		text-shadow: 0 1px 2px #000;
	}

	.temp {
		color: #8fd0ff;
	}

	.bar-label--hp {
		justify-content: space-between;
		gap: 0;
	}

	.hp-value {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.hp-input {
		width: 2.75rem;
		height: 1.5rem;
		padding: 0;
		color: inherit;
		font: inherit;
		text-align: center;
		text-shadow: inherit;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 0.25rem;
		appearance: textfield;
	}

	.hp-input::-webkit-inner-spin-button,
	.hp-input::-webkit-outer-spin-button {
		appearance: none;
		margin: 0;
	}

	.hp-input:hover,
	.hp-input:focus {
		background: rgb(0 0 0 / 0.35);
		border-color: var(--hud-border);
		outline: none;
	}

	/* The - and + buttons sit at the two ends of the bar. */
	.step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		height: 100%;
		padding: 0;
		cursor: pointer;
		color: inherit;
		font: inherit;
		background: transparent;
		border: none;
	}

	.step:hover {
		background: rgb(255 255 255 / 0.18);
	}

	.chips {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.5rem;
		min-height: var(--hud-row-height);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3125rem;
		padding: 0.125rem 0.5rem;
		font-size: 0.8125rem;
		background: rgb(255 255 255 / 0.07);
		border: 1px solid var(--hud-border);
		border-radius: 999px;
	}

	/* The hit dice button must match the speed and armor chips exactly, so undo button defaults. */
	.chip--button {
		box-sizing: border-box;
		height: auto;
		min-height: 0;
		margin: 0;
		cursor: pointer;
		color: inherit;
		font: inherit;
		font-size: 0.8125rem;
		line-height: inherit;
	}

	.chip--button:hover {
		background: rgb(255 255 255 / 0.15);
		border-color: var(--hud-accent);
	}

	.wounds {
		display: inline-flex;
		gap: 0.125rem;
		margin-left: auto;
		padding: 0.125rem 0.25rem;
		cursor: pointer;
		font: inherit;
		background: none;
		border: none;
		border-radius: 0.25rem;
	}

	.wounds:hover {
		background: rgb(255 255 255 / 0.1);
	}

	.drop {
		color: rgb(255 255 255 / 0.2);
		font-size: 0.8125rem;
	}

	.drop--filled {
		color: #d94a4a;
	}
</style>
