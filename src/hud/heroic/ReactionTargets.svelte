<script lang="ts">
	import type { TargetView } from '../../adapter/types.ts';
	import { ts } from '../../localize.ts';

	interface Props {
		label: string;
		noTarget: string;
		multipleTargets: string;
		targets: TargetView[];
		/** CSS color values for a single selected target. */
		background: string;
		border: string;
	}

	let { label, noTarget, multipleTargets, targets, background, border }: Props = $props();

	const single = $derived(targets.length === 1 ? (targets[0] ?? null) : null);
</script>

<div class="reaction-panel__target-section">
	<span class="reaction-panel__target-label">
		<i class="fa-solid fa-crosshairs"></i>
		{ts(label)}
	</span>
	{#if targets.length === 0}
		<div class="reaction-panel__no-target">
			<span>{ts(noTarget)}</span>
		</div>
	{:else if single}
		<div class="reaction-panel__target" style="background: {background}; border-color: {border};">
			<img
				class="reaction-panel__target-img"
				style="border-color: {border};"
				src={single.img}
				alt={single.name}
			/>
			<span class="reaction-panel__target-name">{single.name}</span>
			<i class="fa-solid fa-check reaction-panel__target-check"></i>
		</div>
	{:else}
		<div class="reaction-panel__no-target reaction-panel__no-target--warning">
			<i class="fa-solid fa-triangle-exclamation"></i>
			<span>{ts(multipleTargets)}</span>
		</div>
	{/if}
</div>
