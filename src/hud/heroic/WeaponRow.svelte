<script lang="ts">
	import { ts } from '../../localize.ts';
	import EnrichedHtml from './EnrichedHtml.svelte';

	interface Props {
		name: string;
		img?: string;
		/** Icon class used instead of an image (the unarmed strike). */
		icon?: string;
		damage: string;
		properties: string[];
		description?: string;
		onActivate: () => void;
	}

	let { name, img = '', icon = '', damage, properties, description = '', onActivate }: Props =
		$props();

	let expanded = $state(false);
</script>

<li class="card" class:card--expanded={expanded}>
	<div
		class="row"
		role="button"
		tabindex="0"
		onclick={onActivate}
		onkeydown={(event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				onActivate();
			}
		}}
	>
		{#if img && !icon}
			<img class="img" src={img} alt={name} />
		{:else}
			<div class="icon"><i class={icon || 'fa-solid fa-sword'}></i></div>
		{/if}

		<div class="content">
			<span class="name">{name}</span>
			{#if properties.length > 0}
				<div class="meta">
					{#each properties as property (property)}
						<span class="tag">{property}</span>
					{/each}
				</div>
			{/if}
		</div>

		{#if damage}
			<span class="damage"><i class="fa-solid fa-burst"></i>{damage}</span>
		{/if}

		{#if description}
			<button
				type="button"
				class="expand"
				aria-label={ts(`NIMBLE.ui.heroicActions.${expanded ? 'collapse' : 'expand'}`)}
				onclick={(event) => {
					event.stopPropagation();
					expanded = !expanded;
				}}
			>
				<i class="fa-solid fa-caret-{expanded ? 'up' : 'down'}"></i>
			</button>
		{/if}
	</div>

	{#if expanded && description}
		<div class="description"><EnrichedHtml html={description} /></div>
	{/if}
</li>
