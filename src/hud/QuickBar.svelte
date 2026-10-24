<script lang="ts">
	import { activateQuickSlot, readQuickSlot, resolveQuickSlotDrop } from '../adapter/systemAdapter.ts';
	import {
		QUICK_BAR_MAX_COLUMNS,
		QUICK_BAR_MIN_COLUMNS,
		QUICK_BAR_ROWS,
	} from '../constants.ts';
	import { t } from '../localize.ts';
	import { changeQuickBarColumns, quickBarSlots, setQuickBarSlots } from '../settings.ts';
	import { hudState } from '../state/hudState.svelte.ts';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
	}

	let { actor }: Props = $props();

	const SLOT_DRAG_TYPE = 'NimbleHudQuickSlot';

	const slots = $derived.by(() => {
		void hudState.version;
		const ids = quickBarSlots(actor.id);
		// Only the visible columns; slots in removed columns keep their contents until re-added.
		return ids
			.slice(0, QUICK_BAR_ROWS * hudState.quickBarColumns)
			.map((id) => (id ? readQuickSlot(actor, id) : null));
	});

	let dragOver = $state<number | null>(null);

	function place(index: number, value: string | null): void {
		const next = [...quickBarSlots(actor.id)];
		next[index] = value;
		setQuickBarSlots(actor.id, next);
	}

	function swap(from: number, to: number): void {
		if (from === to) return;
		const next = [...quickBarSlots(actor.id)];
		[next[from], next[to]] = [next[to] ?? null, next[from] ?? null];
		setQuickBarSlots(actor.id, next);
	}

	function parseDrop(event: DragEvent): unknown {
		try {
			return JSON.parse(event.dataTransfer?.getData('text/plain') ?? '');
		} catch {
			return null;
		}
	}

	async function onDrop(event: DragEvent, index: number): Promise<void> {
		event.preventDefault();
		dragOver = null;
		const data = parseDrop(event) as { type?: string; index?: number } | null;

		if (data?.type === SLOT_DRAG_TYPE && typeof data.index === 'number') {
			swap(data.index, index);
			return;
		}
		const value = await resolveQuickSlotDrop(actor, data);
		if (value) place(index, value);
	}

	function onDragStart(event: DragEvent, index: number): void {
		event.dataTransfer?.setData('text/plain', JSON.stringify({ type: SLOT_DRAG_TYPE, index }));
	}
</script>

<div class="quick">
	<div class="side">
		<button
			type="button"
			class="step"
			aria-label={t('quickBarAddColumn')}
			data-hud-tooltip={t('quickBarAddColumn')}
			disabled={hudState.quickBarColumns >= QUICK_BAR_MAX_COLUMNS}
			onclick={() => changeQuickBarColumns(1)}
		>
			<i class="fa-solid fa-plus"></i>
		</button>
		<span class="label">{t('quickBar')}</span>
		<button
			type="button"
			class="step"
			aria-label={t('quickBarRemoveColumn')}
			data-hud-tooltip={t('quickBarRemoveColumn')}
			disabled={hudState.quickBarColumns <= QUICK_BAR_MIN_COLUMNS}
			onclick={() => changeQuickBarColumns(-1)}
		>
			<i class="fa-solid fa-minus"></i>
		</button>
	</div>
	<div class="slots">
		{#each slots as item, index (index)}
			<button
				type="button"
				class="slot"
				class:slot--empty={!item}
				class:slot--over={dragOver === index}
				aria-label={item?.name ?? t('quickBarEmpty')}
				data-hud-tooltip={item ? `${item.name} (${t('quickBarRemove')})` : t('quickBarEmpty')}
				draggable={item ? 'true' : 'false'}
				ondragstart={(event) => onDragStart(event, index)}
				ondragover={(event) => {
					event.preventDefault();
					dragOver = index;
				}}
				ondragleave={() => (dragOver = null)}
				ondrop={(event) => onDrop(event, index)}
				onclick={() => item && activateQuickSlot(actor, item.id)}
				oncontextmenu={(event) => {
					event.preventDefault();
					if (item) place(index, null);
				}}
			>
				{#if item}
					<img src={item.img} alt="" draggable="false" />
					{#if item.quantity}<span class="quantity">{item.quantity}</span>{/if}
				{/if}
			</button>
		{/each}
	</div>
</div>

<style>
	.quick {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.side {
		display: flex;
		flex-direction: column;
		align-items: center;
		align-self: stretch;
		justify-content: space-between;
		gap: 0.25rem;
	}

	.step {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		padding: 0;
		cursor: pointer;
		color: var(--hud-text);
		font-size: 0.625rem;
		background: rgb(255 255 255 / 0.06);
		border: 1px solid var(--hud-border);
		border-radius: 0.25rem;
	}

	.step:hover:not(:disabled) {
		background: rgb(255 255 255 / 0.14);
	}

	.step:disabled {
		cursor: default;
		opacity: 0.35;
	}

	/* Between the buttons, rotated 90 degrees counter-clockwise (reads bottom to top). */
	.label {
		color: var(--hud-muted);
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-align: center;
		text-transform: uppercase;
		white-space: nowrap;
		writing-mode: vertical-rl;
		transform: rotate(180deg);
	}

	.slots {
		display: grid;
		/* Three rows; slots fill down each column, so adding a column never moves items. */
		grid-template-rows: repeat(3, var(--hud-row-height));
		grid-auto-columns: var(--hud-row-height);
		grid-auto-flow: column;
		gap: var(--hud-row-gap);
	}

	.slot {
		position: relative;
		width: var(--hud-row-height);
		height: var(--hud-row-height);
		padding: 0;
		overflow: hidden;
		cursor: pointer;
		font: inherit;
		background: rgb(255 255 255 / 0.06);
		border: 1px solid var(--hud-border);
		border-radius: 0.375rem;
	}

	.slot--empty {
		cursor: default;
		background: transparent;
		border-style: dashed;
	}

	.slot:not(.slot--empty):hover,
	.slot--over {
		border-color: var(--hud-accent);
	}

	.slot--over {
		background: rgb(217 180 90 / 0.18);
	}

	.slot img {
		display: block;
		width: 100%;
		height: 100%;
		border: none;
		object-fit: cover;
	}

	.quantity {
		position: absolute;
		right: 0.125rem;
		bottom: 0.0625rem;
		color: #fff;
		font-size: 0.6875rem;
		font-weight: 700;
		line-height: 1;
		text-shadow: 0 0 3px #000, 0 0 3px #000;
	}
</style>
