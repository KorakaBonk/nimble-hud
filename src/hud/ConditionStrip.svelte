<script lang="ts">
	import { perimeterSlots } from '../adapter/derive.ts';
	import type { ConditionView } from '../adapter/types.ts';
	import { t } from '../localize.ts';

	interface Props {
		conditions: ConditionView[];
		/** Size of the box the icons are overlaid on, in px. */
		width: number;
		height: number;
	}

	const SIZE = 20;
	const GAP = 4;
	const PADDING = 4;

	let { conditions, width, height }: Props = $props();

	/**
	 * Condition icons are paths relative to the Foundry root. A url() inside a CSS variable is
	 * resolved against the stylesheet, not the page, so hand it an absolute URL.
	 */
	function maskUrl(path: string): string {
		return `url("${new URL(path, document.baseURI).href}")`;
	}

	const slots = $derived(perimeterSlots(conditions.length, width, height, SIZE, GAP, PADDING));
</script>

<div class="conditions" aria-label={t('conditions')}>
	{#each conditions as condition, index (condition.id)}
		<span
			class="icon"
			role="img"
			aria-label={condition.name}
			data-hud-tooltip={condition.name}
			style:left="{slots[index]?.left}px"
			style:top="{slots[index]?.top}px"
			style:--icon={maskUrl(condition.img)}
		></span>
	{/each}
</div>

<style>
	/* Overlay on the portrait; only the icons themselves take pointer events. */
	.conditions {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	/* Solid red silhouette of the condition icon, whatever color the source image has. */
	.icon {
		position: absolute;
		pointer-events: auto;
		width: 1.25rem;
		height: 1.25rem;
		background: rgb(0 0 0 / 0.65);
		border: 1px solid var(--hud-border);
		border-radius: 0.25rem;
	}

	.icon::before {
		content: '';
		position: absolute;
		inset: 2px;
		background-color: #ff3b3b;
		mask: var(--icon) center / contain no-repeat;
	}
</style>
