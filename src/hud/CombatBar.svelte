<script lang="ts">
	import { formatPendingDelta } from '../adapter/derive.ts';
	import type { CombatView } from '../adapter/types.ts';
	import { t, tf } from '../localize.ts';

	interface Props {
		combat: CombatView;
		onRollInitiative: () => void;
		onTogglePip: (index: number) => void;
		onAddAction: () => void;
		onEndTurn: () => void;
	}

	let { combat, onRollInitiative, onTogglePip, onAddAction, onEndTurn }: Props = $props();

	const DICE_ICONS = [
		'fa-dice-one',
		'fa-dice-two',
		'fa-dice-three',
		'fa-dice-four',
		'fa-dice-five',
		'fa-dice-six',
	];

	const actions = $derived(combat.actions);
	const pending = $derived.by(() => {
		const text = formatPendingDelta(actions.pendingDelta);
		if (!text) return null;
		const key =
			(actions.pendingDelta < 0 ? 'pendingLoss' : 'pendingGain') +
			(Math.abs(actions.pendingDelta) === 1 ? '' : 'Plural');
		return { text, tooltip: tf(key, { count: Math.abs(actions.pendingDelta) }) };
	});
	const banner = $derived.by(() => {
		if (!combat.started) return t('combatNotStarted');
		if (combat.isMyTurn) return t('yourTurn');
		if (combat.monstersTurn) return t('monstersTurn');
		return combat.turnName ? tf('turnOf', { name: combat.turnName }) : t('waitingForTurn');
	});
	const canAddAction = $derived(actions.effectiveMax < 10);
</script>

<div class="combat" class:combat--my-turn={combat.isMyTurn}>
	<div class="combat-banner">
		{#if combat.round > 0}
			<span class="combat-round">{tf('round', { round: combat.round })}</span>
		{/if}
		<span class="combat-turn">{banner}</span>
	</div>

	{#if combat.phase !== 'active'}
		<button
			type="button"
			class="combat-button combat-initiative"
			disabled={combat.phase === 'initiativePending'}
			onclick={onRollInitiative}
		>
			<i class="fa-solid fa-dice-d20"></i>
			<span>{t('rollInitiative')}</span>
		</button>
	{:else}
		<div class="combat-pips">
			{#each { length: actions.pipCount } as _, index (index)}
				{@const available = index < actions.current}
				{@const icon = DICE_ICONS[index]}
				<button
					type="button"
					class="combat-pip"
					class:available
					class:additional={index >= actions.max}
					class:overflow={index >= actions.effectiveMax}
					aria-label={tf(available ? 'spendAction' : 'restoreAction', { number: index + 1 })}
					data-hud-tooltip={t(available ? 'spendActionTip' : 'restoreActionTip')}
					onclick={() => onTogglePip(index)}
				>
					{#if icon}
						<i class="fa-solid {icon}"></i>
					{:else}
						<span>{index + 1}</span>
					{/if}
				</button>
			{/each}

			{#if canAddAction}
				<button
					type="button"
					class="combat-button combat-add"
					aria-label={t('addAction')}
					data-hud-tooltip={t('addAction')}
					onclick={onAddAction}
				>
					<i class="fa-solid fa-plus"></i>
				</button>
			{/if}

			{#if pending}
				<span
					class="combat-pending"
					class:negative={actions.pendingDelta < 0}
					data-hud-tooltip={pending.tooltip}
					aria-label={pending.tooltip}
				>
					{pending.text}
				</span>
			{/if}
		</div>

		{#if combat.isMyTurn && combat.canEndTurn}
			<button
				type="button"
				class="combat-button combat-end"
				class:ready={actions.current === 0}
				onclick={onEndTurn}
			>
				<i class="fa-solid fa-forward-step"></i>
				<span>{t('endTurn')}</span>
			</button>
		{/if}
	{/if}
</div>

<style>
	.combat {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		align-self: center;
		/* Lifts the bar 5px off the HUD below it (popups above it move up with it). */
		margin-bottom: 5px;
		padding: 0.375rem 0.75rem;
		background: var(--hud-bg);
		border: 1px solid var(--hud-border);
		border-radius: 0.5rem;
		box-shadow: 0 4px 18px rgb(0 0 0 / 0.55);
	}

	.combat--my-turn {
		border-color: var(--hud-accent);
	}

	.combat-banner {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
		min-width: 6rem;
	}

	.combat-round {
		color: var(--hud-muted);
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.combat-turn {
		font-weight: 600;
	}

	.combat--my-turn .combat-turn {
		color: var(--hud-accent);
	}

	.combat-pips {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.combat-pip,
	.combat-button {
		cursor: pointer;
		color: var(--hud-text);
		background: rgb(255 255 255 / 0.06);
		border: 1px solid var(--hud-border);
		border-radius: 0.375rem;
		font: inherit;
	}

	.combat-pip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.875rem;
		height: 1.875rem;
		padding: 0;
		font-weight: 700;
	}

	.combat-pip i {
		font-size: 1.25rem;
		color: var(--hud-muted);
		opacity: 0.5;
	}

	.combat-pip span {
		color: var(--hud-muted);
		opacity: 0.5;
	}

	.combat-pip.available i,
	.combat-pip.available span {
		color: #4fb36f;
		opacity: 1;
	}

	.combat-pip.available.additional i,
	.combat-pip.available.additional span {
		color: #5aa7e0;
	}

	.combat-pip.available.overflow {
		border-color: #d9b45a;
	}

	.combat-pip.available.overflow i,
	.combat-pip.available.overflow span {
		color: #d9b45a;
	}

	.combat-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		height: 1.875rem;
		padding: 0 0.625rem;
	}

	.combat-add {
		width: 1.875rem;
		padding: 0;
		opacity: 0.6;
	}

	.combat-pip:hover,
	.combat-button:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.14);
	}

	.combat-add:hover {
		opacity: 1;
	}

	.combat-button:disabled {
		cursor: wait;
		opacity: 0.6;
	}

	.combat-initiative {
		border-color: #5aa7e0;
	}

	.combat-end.ready {
		background: #2f7a4a;
		border-color: #4fb36f;
	}

	.combat-end.ready:hover {
		background: #38905a;
	}

	.combat-pending {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.875rem;
		height: 1.25rem;
		font-size: 0.6875rem;
		font-weight: 700;
		color: #4fb36f;
		border: 1px dashed currentcolor;
		border-radius: 0.25rem;
		cursor: help;
	}

	.combat-pending.negative {
		color: #d96a6a;
	}
</style>
