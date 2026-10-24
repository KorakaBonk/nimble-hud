<script lang="ts">
	import { activateItem, readAttackList, runHeroicMacro } from '../../adapter/systemAdapter.ts';
	import { ts } from '../../localize.ts';
	import { hudState } from '../../state/hudState.svelte.ts';
	import WeaponRow from './WeaponRow.svelte';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
		onActivate: () => void;
	}

	let { actor, onActivate }: Props = $props();

	let search = $state('');

	const list = $derived.by(() => {
		void hudState.version;
		return readAttackList(actor, search);
	});
	const empty = $derived(!list.unarmed && list.entries.length === 0);

	function run(action: () => Promise<void>): void {
		void action();
		onActivate();
	}
</script>

<section class="panel">
	<h3 class="heading">{ts('NIMBLE.ui.heroicActions.selectAttack')}</h3>
	<input class="search" type="search" placeholder="Search" aria-label="Search" bind:value={search} />

	<ul class="list">
		{#if list.unarmed}
			<WeaponRow
				name={ts('NIMBLE.ui.heroicActions.unarmedStrike')}
				icon="fa-solid fa-hand-fist"
				damage={list.unarmed.damage}
				properties={[ts('NIMBLE.npcSheet.melee')]}
				onActivate={() => run(() => runHeroicMacro('unarmedStrike'))}
			/>
		{/if}
		{#each list.entries as entry (entry.id)}
			<WeaponRow
				name={entry.name}
				img={entry.img}
				damage={entry.damage}
				properties={entry.properties}
				description={entry.description}
				onActivate={() => run(() => activateItem(actor, entry.id))}
			/>
		{/each}
	</ul>

	{#if empty}
		<p class="empty">{ts('NIMBLE.ui.heroicActions.noWeapons')}</p>
	{/if}
</section>
