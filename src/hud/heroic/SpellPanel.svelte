<script lang="ts">
	import { activateItem, readSpellList } from '../../adapter/systemAdapter.ts';
	import { ts } from '../../localize.ts';
	import { hudState } from '../../state/hudState.svelte.ts';
	import EnrichedHtml from './EnrichedHtml.svelte';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
		onActivate: () => void;
	}

	let { actor, onActivate }: Props = $props();

	const P = 'NIMBLE.ui.heroicActions';

	let search = $state('');
	let expanded = $state(new Set<string>());

	const spells = $derived.by(() => {
		void hudState.version;
		return readSpellList(actor, search);
	});

	function toggle(id: string): void {
		const next = new Set(expanded);
		if (!next.delete(id)) next.add(id);
		expanded = next;
	}

	function cast(id: string): void {
		void activateItem(actor, id);
		onActivate();
	}
</script>

<section class="panel">
	<h3 class="heading">{ts(`${P}.selectSpell`)}</h3>
	<input class="search" type="search" placeholder="Search" aria-label="Search" bind:value={search} />

	{#if spells.length > 0}
		<ul class="list">
			{#each spells as spell (spell.id)}
				{@const open = expanded.has(spell.id)}
				{@const hasText = spell.baseEffect || spell.higherLevelEffect}
				{@const tier = spell.tier === 0 ? ts(`${P}.cantrip`) : ts(`${P}.spellTier`, { tier: spell.tier })}
				<li class="card" class:card--expanded={open}>
					<div
						class="row"
						role="button"
						tabindex="0"
						onclick={() => cast(spell.id)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') {
								event.preventDefault();
								cast(spell.id);
							}
						}}
					>
						<img class="img" src={spell.img} alt={spell.name} />

						<div class="content">
							<div class="header">
								<span class="name">{spell.name},</span>
								<span class="small">{tier}{spell.cost || spell.concentration ? ',' : ''}</span>
								{#if spell.cost}
									<span class="small">{@html spell.cost}{spell.concentration ? ',' : ''}</span>
								{/if}
								{#if spell.concentration}<span class="tag">C</span>{/if}
							</div>
							<div class="meta meta--wide">
								{#if spell.targetType}
									<span class="small">{spell.targetType}{spell.range || spell.castCost ? ',' : ''}</span>
								{/if}
								{#if spell.range}
									<span class="small">{spell.range}{spell.castCost ? ',' : ''}</span>
								{/if}
								{#if spell.castCost}
									<span class="mana">
										<i class="fa-solid fa-sparkles"></i>
										{spell.castCost}
									</span>
								{/if}
							</div>
						</div>

						{#if spell.effect}
							<span class="damage" class:damage--healing={spell.effect.isHealing}>
								<i class="fa-solid {spell.effect.isHealing ? 'fa-heart' : 'fa-burst'}"></i>
								{spell.effect.formula}
							</span>
						{/if}

						{#if hasText}
							<button
								type="button"
								class="expand"
								aria-label={ts(`${P}.${open ? 'collapse' : 'expand'}`)}
								onclick={(event) => {
									event.stopPropagation();
									toggle(spell.id);
								}}
							>
								<i class="fa-solid fa-caret-{open ? 'up' : 'down'}"></i>
							</button>
						{/if}
					</div>

					{#if open && hasText}
						<div class="description">
							{#if spell.baseEffect}
								<div class="effect-section">
									<strong>{ts(`${P}.baseEffect`)}</strong>
									<EnrichedHtml html={spell.baseEffect} />
								</div>
							{/if}
							{#if spell.higherLevelEffect}
								<div class="effect-section">
									<strong>{ts(`${P}.higherLevelEffect`)}</strong>
									<EnrichedHtml html={spell.higherLevelEffect} />
								</div>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="empty">{ts(`${P}.noSpellsFound`)}</p>
	{/if}
</section>
