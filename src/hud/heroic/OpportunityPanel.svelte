<script lang="ts">
	import {
		readOpportunity,
		readReactionCost,
		readShowImages,
		readTargets,
		runReaction,
		useOpportunityWeapon,
	} from '../../adapter/systemAdapter.ts';
	import { ts } from '../../localize.ts';
	import { hudState } from '../../state/hudState.svelte.ts';
	import ReactionTargets from './ReactionTargets.svelte';
	import WeaponRow from './WeaponRow.svelte';

	interface Props {
		actor: NonNullable<typeof hudState.actor>;
		onActivate: () => void;
	}

	let { actor, onActivate }: Props = $props();

	const P = 'NIMBLE.ui.heroicActions.reactions';

	const view = $derived.by(() => {
		void hudState.version;
		return readOpportunity(actor);
	});
	const targets = $derived.by(() => {
		void hudState.version;
		return readTargets(actor);
	});
	const cost = $derived.by(() => {
		void hudState.version;
		return readReactionCost(actor, ['opportunityAttack']);
	});
	const showImages = $derived.by(() => {
		void hudState.version;
		return readShowImages(actor);
	});

	function run(action: () => Promise<void>): void {
		void action();
		onActivate();
	}
</script>

<section class="reaction-panel">
	<div class="reaction-panel__header">
		<div class="reaction-panel__icon"><i class="fa-solid fa-bullseye"></i></div>
		<div class="reaction-panel__title-group">
			<h3 class="reaction-panel__title">{ts(`${P}.opportunity.title`)}</h3>
			<span class="reaction-panel__cost">
				<i class="fa-solid fa-bolt"></i>
				{cost}
			</span>
		</div>
		<div class="reaction-panel__badge">
			<i class="fa-solid fa-dice"></i>
			{ts(`${P}.disadvantage`)}
		</div>
	</div>

	<p class="reaction-panel__description">{ts(`${P}.opportunity.panelDescription`)}</p>

	<ReactionTargets
		label={`${P}.target`}
		noTarget={`${P}.targetEnemy`}
		multipleTargets={`${P}.multipleTargets`}
		{targets}
		background="var(--nimble-reaction-opportunity-light)"
		border="var(--nimble-reaction-opportunity-secondary)"
	/>

	<ul class="reaction-panel__weapons">
		<!-- The unarmed opportunity attack needs system internals, so it opens the character
		     sheet on its Opportunity Attack panel instead. -->
		<WeaponRow
			name={ts('NIMBLE.ui.heroicActions.unarmedStrike')}
			icon="fa-solid fa-hand-fist"
			damage={view.unarmedDamage}
			properties={[ts('NIMBLE.npcSheet.melee')]}
			onActivate={() => run(() => runReaction('opportunity'))}
		/>

		{#each view.weapons as weapon (weapon.id)}
			<WeaponRow
				name={weapon.name}
				img={showImages ? weapon.img : ''}
				damage={weapon.damage}
				properties={weapon.properties}
				onActivate={() => run(() => useOpportunityWeapon(actor, weapon.id))}
			/>
		{/each}
	</ul>
</section>

<style>
	.reaction-panel__icon {
		background: linear-gradient(
			135deg,
			var(--nimble-reaction-opportunity-primary) 0%,
			var(--nimble-reaction-opportunity-secondary) 100%
		);
	}

	.reaction-panel__badge {
		color: var(--nimble-reaction-opportunity-text);
		background: var(--nimble-reaction-opportunity-accent);
	}
</style>
