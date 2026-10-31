/**
 * The ONLY place that knows how the Nimble system stores and exposes its data.
 *
 * Everything the HUD needs from Nimble goes through here, so a system update that moves a
 * data path breaks one file instead of every component. Paths verified against Nimble
 * 0.10.0 (Foundry v14). See AGENTS.md for the rules this file follows.
 */
import { t, ts } from '../localize.ts';
import {
	buildActionPool,
	buildHitDice,
	dieMaxFace,
	normalizeFaces,
	applyFaceFloor,
	clampPercent,
	descriptionText,
	isBloodied,
	matchesSearch,
	nextActionCount,
	orderMonsterActions,
	truncateText,
	primaryDamageFormula,
	primaryEffectFormula,
	simplifyFormula,
} from './derive.ts';
import type {
	AssessOptionView,
	AssessView,
	AttackListView,
	CombatPhase,
	CombatView,
	ChargeView,
	ConditionView,
	DefenseView,
	HeroicActionTab,
	HeroicReactionId,
	HeroicReactionTab,
	OpportunityView,
	PoolView,
	QuickItemView,
	TargetView,
	MonsterFeatureCategory,
	MonsterFeatureEntry,
	MonsterFeatureGroup,
	MoveView,
	MovementSpeedView,
	SpellEntryView,
	SpellTierGroupView,
	WeaponEntryView,
	ManaView,
	PortraitView,
	ResourcePoolView,
	StatEntry,
	StatsView,
	VitalsView,
} from './types.ts';

/* eslint-disable @typescript-eslint/no-explicit-any */
type NimbleActor = any;

// ---------------------------------------------------------------------------
// Binding
// ---------------------------------------------------------------------------

/**
 * Which character the HUD shows. This deliberately mirrors the rule Nimble's own macros use
 * (`ChatMessage.getSpeaker()`): exactly one controlled token, otherwise the user's assigned
 * character. The system's heroic-action macros act on that same actor, so the HUD must
 * never show a different one.
 */
export function getBoundActor(): NimbleActor | null {
	const controlled: any[] = canvas?.tokens?.controlled ?? [];
	const tokenActor = controlled.length === 1 ? controlled[0]?.actor : null;
	const actor = tokenActor ?? game.user?.character ?? null;
	if (actor?.type === 'character') return actor;
	// A single controlled monster token gets the reduced monster HUD: any monster for the GM,
	// and for a player one they own, such as a minion their character summoned.
	if (!MONSTER_TYPES.has(actor?.type)) return null;
	return game.user?.isGM || actor.isOwner ? actor : null;
}

const MONSTER_TYPES = new Set(['npc', 'minion', 'soloMonster']);

/** Whether the actor is a monster (npc, minion or solo monster) rather than a character. */
export function isMonster(actor: NimbleActor | null): boolean {
	return MONSTER_TYPES.has(actor?.type);
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function nimbleConfig(): Record<string, any> {
	return CONFIG?.NIMBLE ?? {};
}

function buildSummary(actor: NimbleActor): string {
	const parts: string[] = [];
	const ancestry = actor.ancestry?.name;
	if (ancestry) parts.push(ancestry);

	const classNames = Object.values(actor.classes ?? {})
		.map((cls: any) => cls?.name)
		.filter((name): name is string => typeof name === 'string' && name.length > 0);
	if (classNames.length > 0) parts.push(classNames.join(' / '));

	const level = actor.levels?.character;
	if (typeof level === 'number' && level > 0) parts.push(`Lv ${level}`);
	return parts.join(' · ');
}

function readMana(actor: NimbleActor): ManaView | null {
	const mana = actor.system?.resources?.mana;
	const max = Number(mana?.max) || 0;
	if (max <= 0) return null;
	const value = Number(mana?.current ?? mana?.value) || 0;
	return { value, max, percent: clampPercent(value, max) };
}

function readPortrait(actor: NimbleActor): PortraitView {
	const flags = actor.flags?.[game.system.id];
	return {
		img: actor.img ?? '',
		xOffset: Number(flags?.actorImageXOffset) || 0,
		yOffset: Number(flags?.actorImageYOffset) || 0,
		scale: Number(flags?.actorImageScale) || 100,
	};
}

export function readVitals(actor: NimbleActor): VitalsView {
	const attributes = actor.system?.attributes ?? {};
	const hpValue = Number(attributes.hp?.value) || 0;
	const hpMax = Number(attributes.hp?.max) || 0;
	const statuses: Set<string> | undefined = actor.statuses;

	const classes = Object.values(actor.classes ?? {}).map((cls: any) => ({
		size: cls?.hitDice?.size ?? 0,
		total: cls?.hitDice?.total ?? 0,
	}));

	return {
		monster: false,
		name: actor.name ?? '',
		portrait: readPortrait(actor),
		summary: buildSummary(actor),
		hp: {
			value: hpValue,
			max: hpMax,
			temp: Number(attributes.hp?.temp) || 0,
			percent: clampPercent(hpValue, hpMax),
			bloodied: isBloodied(hpValue, hpMax, statuses?.has?.('bloodied') ?? false),
		},
		showHp: true,
		defenses: [],
		wounds: {
			value: Number(attributes.wounds?.value) || 0,
			max: Number(attributes.wounds?.max) || 0,
		},
		armorLabel: String(Number(attributes.armor?.value) || 0),
		speed: Number(attributes.movement?.walk) || 0,
		mana: readMana(actor),
		resourcePools: readResourcePools(actor),
		hitDice: buildHitDice(classes, attributes.bonusHitDice ?? [], attributes.hitDice ?? {}),
	};
}

/** Damage types a monster resists, is immune to and is vulnerable to (empty groups omitted). */
function readDefenses(actor: NimbleActor): DefenseView[] {
	const attributes = actor.system?.attributes ?? {};
	const damageTypes: Record<string, string> = nimbleConfig().damageTypes ?? {};
	const typeLabel = (key: string) => (damageTypes[key] ? ts(damageTypes[key]) : key);

	const groups: { kind: DefenseView['kind']; key: string; types: unknown }[] = [
		{ kind: 'resistant', key: 'NIMBLE.npcDefenses.resistant', types: attributes.damageResistances },
		{ kind: 'immune', key: 'NIMBLE.npcDefenses.immune', types: attributes.damageImmunities },
		{
			kind: 'vulnerable',
			key: 'NIMBLE.npcDefenses.vulnerable',
			types: attributes.damageVulnerabilities,
		},
	];
	return groups
		.filter((group) => Array.isArray(group.types) && group.types.length > 0)
		.map((group) => ({
			kind: group.kind,
			label: ts(group.key),
			types: (group.types as string[]).map(typeLabel).join(', '),
		}));
}

/** Name, portrait, level line, hit points and armor of a monster (npc, minion, solo monster). */
export function readMonsterVitals(actor: NimbleActor): VitalsView {
	const config = nimbleConfig();
	const attributes = actor.system?.attributes ?? {};
	const details = actor.system?.details ?? {};
	const hpValue = Number(attributes.hp?.value) || 0;
	const hpMax = Number(attributes.hp?.max) || 0;

	const size = attributes.sizeCategory ? ts(config.sizeCategories?.[attributes.sizeCategory] ?? '') : '';
	const kind =
		actor.type === 'soloMonster'
			? t('solo')
			: actor.type === 'minion'
				? t('minion')
				: details.isFlunky
					? t('flunky')
					: '';
	const level = Number(details.level);
	const summary = [
		size,
		details.creatureType,
		kind,
		Number.isFinite(level) && level > 0 ? `Lv ${level}` : '',
	]
		.filter(Boolean)
		.join(' · ');

	return {
		monster: true,
		name: actor.name ?? '',
		portrait: readPortrait(actor),
		summary,
		hp: {
			value: hpValue,
			max: hpMax,
			temp: Number(attributes.hp?.temp) || 0,
			percent: clampPercent(hpValue, hpMax),
			bloodied: actor.type !== 'minion' && isBloodied(hpValue, hpMax, actor.statuses?.has?.('bloodied') ?? false),
		},
		showHp: actor.type !== 'minion',
		defenses: readDefenses(actor),
		wounds: null,
		armorLabel: '',
		speed: null,
		mana: null,
		resourcePools: [],
		hitDice: null,
	};
}

/** Long descriptions are cut so a tooltip never covers half the screen. */
const TOOLTIP_MAX_CHARS = 700;

const MONSTER_SUBTYPES = new Set(['feature', 'action', 'attackSequence', 'bloodied', 'lastStand']);
const MONSTER_CATEGORY_ORDER: MonsterFeatureCategory[] = ['feature', 'action', 'bloodied', 'lastStand'];

/** "Armor: Medium", "Armor: Heavy" or "Armor: none", with what the armor does as its tooltip. */
function readMonsterArmorEntry(actor: NimbleActor): MonsterFeatureEntry {
	const armor: string = actor.system?.attributes?.armor ?? 'none';
	const tone: MonsterFeatureEntry['tone'] =
		armor === 'medium' || armor === 'heavy' ? armor : 'none';

	const armorTypes: Record<string, string> = nimbleConfig().npcArmorTypes ?? {};
	const name =
		tone === 'none'
			? t('armorNone')
			: `${ts('NIMBLE.npcSheet.armor')}: ${armorTypes[tone] ? ts(armorTypes[tone]) : tone}`;
	return {
		id: 'armor',
		name,
		img: '',
		kind: 'static',
		icon: 'fa-solid fa-shield',
		tone,
		hasEffects: false,
		rangeLabel: null,
		nested: false,
		description: '',
		// What the armor does; HUD wording, as the system has no text for it.
		tooltip: tone === 'none' ? name : t(`armorTooltip.${tone}`),
	};
}

/** A monster's features grouped like the sheet's Features list. */
export function readMonsterFeatures(actor: NimbleActor): MonsterFeatureGroup[] {
	const config = nimbleConfig();
	const items: any[] = [...(actor.items ?? [])].filter((item) =>
		MONSTER_SUBTYPES.has(item.system?.subtype),
	);

	const entryFor = (item: any, nested: boolean): MonsterFeatureEntry => {
		const subtype: string = item.system?.subtype;
		const html: string = item.system?.description ?? '';
		const hasEffects = (item.system?.activation?.effects?.length ?? 0) > 0;
		const targets = item.system?.activation?.targets;
		const rangeLabel = targets?.attackType
			? ts(targets.attackType === 'reach' ? 'NIMBLE.npcSheet.reach' : 'NIMBLE.npcSheet.range', {
					distance: String(targets.distance),
				})
			: null;
		// Like the sheet: no description and no effects means a plain heading, not a card.
		const header = !html.trim() && !hasEffects;
		return {
			id: item.id,
			name: item.name ?? '',
			img: item.img ?? '',
			kind: subtype === 'attackSequence' ? 'sequence' : header ? 'header' : 'card',
			hasEffects,
			rangeLabel,
			nested,
			description: html,
			// The name goes first: the row truncates long names.
			tooltip: [item.name, truncateText(descriptionText(html), TOOLTIP_MAX_CHARS)]
				.filter(Boolean)
				.join(' — '),
		};
	};

	const categoryOf = (item: any): MonsterFeatureCategory => {
		const subtype: string = item.system?.subtype;
		return subtype === 'attackSequence' ? 'action' : (subtype as MonsterFeatureCategory);
	};

	const groups: MonsterFeatureGroup[] = [];
	for (const category of MONSTER_CATEGORY_ORDER) {
		const inCategory = items.filter((item) => categoryOf(item) === category);
		if (inCategory.length === 0) continue;

		const entries =
			category === 'action'
				? orderMonsterActions(
						inCategory.map((item) => ({
							id: item.id,
							subtype: item.system.subtype,
							parentId: item.system?.parentItemId || null,
							sort: item.sort ?? 0,
							item,
						})),
					).map(({ item, nested }) => entryFor(item.item, nested))
				: [...inCategory]
						.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
						.map((item) => entryFor(item, false));

		groups.push({ category, label: ts(config.monsterFeatureTypes?.[category] ?? category), entries });
	}

	// The creature's armor leads the Features list, styled like the other entries.
	const armor = readMonsterArmorEntry(actor);
	const features = groups.find((group) => group.category === 'feature');
	if (features) features.entries.unshift(armor);
	else
		groups.unshift({
			category: 'feature',
			label: ts(config.monsterFeatureTypes?.feature ?? 'feature'),
			entries: [armor],
		});
	return groups;
}

function readEntries(
	data: Record<string, any> | undefined,
	names: Record<string, string> | undefined,
	abbreviations: Record<string, string> | undefined,
): StatEntry[] {
	return Object.entries(data ?? {}).map(([key, entry]) => ({
		key,
		label: names?.[key] ?? key,
		abbreviation: abbreviations?.[key] ?? (names?.[key] ?? key).slice(0, 3).toUpperCase(),
		modifier: Number(entry?.mod) || 0,
		rollMode: Number(entry?.defaultRollMode) || 0,
	}));
}

export function readStats(actor: NimbleActor): StatsView {
	const config = nimbleConfig();
	const system = actor.system ?? {};

	const withAbility = (entry: StatEntry, abilityKey: string | undefined): StatEntry => {
		if (!abilityKey || !config.abilityScoreIcons?.[abilityKey]) return entry;
		return {
			...entry,
			ability: {
				key: abilityKey,
				name: config.abilityScores?.[abilityKey] ?? abilityKey,
				icon: config.abilityScoreIcons[abilityKey],
			},
		};
	};

	const skills = readEntries(system.skills, config.skills, undefined)
		.map((entry) => withAbility(entry, config.defaultSkillAbilities?.[entry.key]))
		.sort((a, b) => a.label.localeCompare(b.label));

	return {
		abilities: readEntries(
			system.abilities,
			config.abilityScores,
			config.abilityScoreAbbreviations,
		).map((entry) => withAbility(entry, entry.key)),
		saves: readEntries(
			system.savingThrows,
			config.savingThrows,
			config.savingThrowAbbreviations,
		).map((entry) => withAbility(entry, entry.key)),
		skills,
		initiative: Number(system.attributes?.initiative?.mod) || 0,
	};
}

/** Active condition effects (anything with a status id that is not disabled). */
export function readConditions(actor: NimbleActor): ConditionView[] {
	const result: ConditionView[] = [];
	for (const effect of actor.effects ?? []) {
		if (effect.disabled) continue;
		if (!effect.statuses || effect.statuses.size === 0) continue;
		result.push({ id: effect.id, name: effect.name ?? '', img: effect.img ?? '' });
	}
	return result;
}

// ---------------------------------------------------------------------------
// Combat
// ---------------------------------------------------------------------------

/** How long the system treats an initiative roll as in flight (see its initiativeRollLock). */
const INITIATIVE_LOCK_TIMEOUT_MS = 15_000;
/** Engine baseline for actions while Dying (the system's DYING_MAX_ACTIONS). */
const DYING_BASELINE_ACTIONS = 1;

/** The running (or active) combat on the viewed scene; unscene'd combats match any scene. */
function getCombatForScene(): any | null {
	const sceneId = canvas?.scene?.id;
	if (!sceneId) return null;
	const matches = (combat: any) =>
		(combat.active || combat.started) && (!combat.scene?.id || combat.scene.id === sceneId);

	if (game.combat && matches(game.combat)) return game.combat;
	return (
		game.combats?.contents?.find(matches) ??
		(game.combats?.viewed && matches(game.combats.viewed) ? game.combats.viewed : null)
	);
}

function findCombatant(combat: any, actor: NimbleActor): any | null {
	return combat?.combatants?.find((entry: any) => entry.actorId === actor.id) ?? null;
}

function hasActiveInitiativeLock(combatant: any): boolean {
	const lock = combatant.flags?.[game.system.id]?.initiativeRollLock;
	const startedAt = Number(lock?.startedAt);
	if (typeof lock?.requestId !== 'string' || !Number.isFinite(startedAt)) return false;
	return Date.now() - startedAt < INITIATIVE_LOCK_TIMEOUT_MS;
}

/** The character's place in the running combat, or null when they are not in one. */
export function readCombat(actor: NimbleActor): CombatView | null {
	const combat = getCombatForScene();
	const combatant = combat ? findCombatant(combat, actor) : null;
	if (!combat || !combatant) return null;

	let phase: CombatPhase = 'active';
	if (combatant.initiative === null || combatant.initiative === undefined) {
		phase = hasActiveInitiativeLock(combatant) ? 'initiativePending' : 'needsInitiative';
	}

	const base = combatant.system?.actions?.base;
	const current = Math.max(0, Math.trunc(Number(base?.current) || 0));
	const additional = Math.max(0, Math.trunc(Number(base?.additional) || 0));
	let max = Math.max(0, Math.trunc(Number(base?.max) || 0)) || 3;
	if (actor.statuses?.has?.('dying')) {
		const limit = Number(actor.system?.attributes?.dyingActionLimit);
		max = Math.min(max, Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : DYING_BASELINE_ACTIONS);
	}

	const active = combat.started ? combat.combatant : null;
	// Only player characters are named; every other combatant is just "the monsters".
	const playerTurn = active?.type === 'character';
	const turnName =
		playerTurn && (!active.hidden || game.user.isGM) ? (active.name ?? null) : null;

	return {
		phase,
		started: Boolean(combat.started),
		round: Number(combat.round) || 0,
		isMyTurn: Boolean(active && active.actorId === actor.id),
		turnName,
		monstersTurn: Boolean(active && !playerTurn),
		actions: {
			current,
			max,
			additional,
			pendingDelta: Math.trunc(Number(combatant.system?.actions?.pendingDelta) || 0),
			...buildActionPool(current, max, additional),
		},
		canEndTurn: Boolean(game.user.isGM || actor.isOwner),
	};
}

export async function rollInitiative(actor: NimbleActor): Promise<void> {
	const combat = getCombatForScene();
	const combatant = combat ? findCombatant(combat, actor) : null;
	if (!combatant?.id || hasActiveInitiativeLock(combatant)) return;
	try {
		await combat.rollInitiative([combatant.id], { promptRollDialog: true });
	} catch {
		ui.notifications?.warn(t('noPermissionInitiative'));
	}
}

/** Spends the pip at `index` (or restores it when already spent). */
export async function togglePip(actor: NimbleActor, index: number): Promise<void> {
	const combat = getCombatForScene();
	const combatant = combat ? findCombatant(combat, actor) : null;
	const view = readCombat(actor);
	if (!combatant || !view || view.phase !== 'active') return;
	const { current, effectiveMax } = view.actions;
	await combatant.update({
		'system.actions.base.current': nextActionCount(index, current, effectiveMax),
	});
}

/** Grants one extra action slot for this combat (same cap of 10 as the sheet). */
export async function addAdditionalAction(actor: NimbleActor): Promise<void> {
	const combat = getCombatForScene();
	const combatant = combat ? findCombatant(combat, actor) : null;
	const view = readCombat(actor);
	if (!combatant || !view || view.phase !== 'active') return;
	const { additional, max, current } = view.actions;
	if (additional >= 10 - max) return;
	await combatant.update({
		'system.actions.base.additional': additional + 1,
		'system.actions.base.current': current + 1,
	});
}

/**
 * Ends the active turn. The GM advances the combat directly; players ask the primary GM
 * client over the system's socket, which validates ownership before calling `nextTurn()`.
 */
export async function endTurn(actor: NimbleActor): Promise<void> {
	const combat = getCombatForScene();
	const active = combat?.started ? combat.combatant : null;
	if (!combat || !active || active.actorId !== actor.id) return;

	try {
		if (game.user.isGM) {
			await combat.nextTurn();
			return;
		}
		if (!actor.isOwner || !game.users.activeGM) throw new Error('cannot relay end turn');
		game.socket.emit(`system.${game.system.id}`, {
			type: 'advanceCombatTurn',
			combatId: combat.id,
			userId: game.user.id,
			activeCombatantId: active.id,
		});
	} catch {
		ui.notifications?.warn(t('noPermissionEndTurn'));
	}
}

// ---------------------------------------------------------------------------
// Heroic actions (the sheet's Attack, Cast a Spell, Move and Assess panels)
// ---------------------------------------------------------------------------

const HEROIC_PREFIX = 'NIMBLE.ui.heroicActions';

function evaluateFormula(actor: NimbleActor, formula: string | null): string {
	if (!formula) return '';
	try {
		const substituted = Roll.replaceFormulaData(formula, actor.getRollData(), { missing: '0' });
		return simplifyFormula(substituted, formula, (expression) => Roll.safeEval(expression));
	} catch {
		return formula;
	}
}

function isCustomReaction(item: any): boolean {
	return item.system?.activation?.isReaction === true;
}

/** Actor-wide spells the Cast a Spell panel lists (not reactions, not minute/hour casts). */
function castableSpells(actor: NimbleActor): any[] {
	return [...(actor.items ?? [])].filter((item: any) => {
		if (item.type !== 'spell' || isCustomReaction(item)) return false;
		const costType = item.system?.activation?.cost?.type;
		return costType !== 'minute' && costType !== 'hour';
	});
}

export function readHeroicTabs(actor: NimbleActor): HeroicActionTab[] {
	const hasSpells = castableSpells(actor).length > 0;
	const tab = (id: HeroicActionTab['id'], icon: string): HeroicActionTab => {
		const label = ts(`${HEROIC_PREFIX}.actions.${id}.label`);
		const disabled = id === 'spell' && !hasSpells;
		return {
			id,
			icon,
			label,
			disabled,
			tooltip: disabled ? `${label} (${ts(`${HEROIC_PREFIX}.noSpells`)})` : label,
		};
	};
	return [
		tab('attack', 'fa-solid fa-sword'),
		tab('spell', 'fa-solid fa-wand-sparkles'),
		tab('move', 'fa-solid fa-person-running'),
		tab('assess', 'fa-solid fa-eye'),
	];
}

function bySort(items: any[]): any[] {
	return [...items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
}

function itemDescriptionHtml(item: any): string {
	const raw = item.system?.description;
	const html = typeof raw === 'object' && raw !== null ? raw.public : raw;
	return typeof html === 'string' && descriptionText(html) ? html : '';
}

function weaponProperties(item: any): string[] {
	const props = item.system?.properties ?? {};
	const labels: Record<string, string> = nimbleConfig().weaponProperties ?? {};
	return ((props.selected ?? []) as string[])
		.map((key) => {
			if (key === 'thrown' && props.thrownRange) {
				return ts(`${HEROIC_PREFIX}.thrown`, { distance: String(props.thrownRange) });
			}
			if (key === 'range' && props.range?.max) {
				return ts('NIMBLE.npcSheet.range', { distance: String(props.range.max) });
			}
			if (key === 'reach' && props.reach?.max) {
				return ts('NIMBLE.npcSheet.reach', { distance: String(props.reach.max) });
			}
			return labels[key] ? game.i18n.localize(labels[key]) : key;
		})
		.filter(Boolean);
}

/** Weapons for the Attack panel. Unlike the sheet, action-cost features are left out. */
export function readAttackList(actor: NimbleActor, search: string): AttackListView {
	const items: any[] = bySort([...(actor.items ?? [])]);
	const matching = (item: any) =>
		matchesSearch(search, item.name ?? '', descriptionText(item.system?.description));

	const weapons = items.filter(
		(item) => item.type === 'object' && item.system?.objectType === 'weapon' && matching(item),
	);

	const entry = (item: any, properties: string[]): WeaponEntryView => ({
		id: item.id,
		name: item.name ?? '',
		img: item.img ?? '',
		damage: evaluateFormula(actor, primaryDamageFormula(item.system?.activation?.effects)),
		properties,
		description: itemDescriptionHtml(item),
	});

	const unarmedFormula: string = actor.system?.unarmedDamage ?? '1d4 + @abilities.strength.mod';
	const showUnarmed = matchesSearch(search, ts(`${HEROIC_PREFIX}.unarmedStrike`));

	return {
		unarmed: showUnarmed ? { damage: evaluateFormula(actor, unarmedFormula) } : null,
		entries: weapons.map((item) => entry(item, weaponProperties(item))),
	};
}

function spellCostLabel(cost: any): string | null {
	if (!cost?.type || cost.type === 'none') return null;
	const config = nimbleConfig();
	const quantity = Math.max(1, Number(cost.quantity) || 1);

	if (cost.type === 'reaction' || (cost.isReaction && cost.type === 'action')) {
		if (cost.quantity === 0) return ts('NIMBLE.activationCosts.freeReaction');
		if (quantity === 1) return ts('NIMBLE.activationCosts.reaction');
		return ts('NIMBLE.activationCosts.reactionWithCost', {
			cost: `${quantity} ${config.activationCostTypesPlural?.action}`,
		});
	}
	if (cost.type === 'action' && cost.quantity === 0) return ts('NIMBLE.activationCosts.free');
	if (cost.type === 'action' || cost.type === 'minute' || cost.type === 'hour') {
		const names = quantity > 1 ? config.activationCostTypesPlural : config.activationCostTypes;
		return `${quantity} ${names?.[cost.type] ?? cost.type}`;
	}
	return cost.type === 'special' ? (config.activationCostTypes?.special ?? null) : null;
}

/** A formula resolved against the actor's roll data, as a whole number (0 when it fails). */
function integerFormula(actor: NimbleActor, formula: string): number {
	try {
		const substituted = Roll.replaceFormulaData(formula, actor.getRollData(), { missing: '0' });
		const value = Number(Roll.safeEval(substituted));
		return Number.isFinite(value) ? Math.floor(value) : 0;
	} catch {
		return 0;
	}
}

/**
 * The class whose spellcasting declaration pays for this spell, or null for the default rule
 * (a tiered spell costs its tier in mana). Mirrors the system's spell cost resolver: the spell's
 * class restriction first, else the character's only class; ambiguous cases fall back to mana.
 */
function spellcastingDeclaration(actor: NimbleActor, spell: any): any | null {
	const classItems = [...(actor.items ?? [])].filter((item: any) => item.type === 'class');
	if (classItems.length < 1) return null;

	const classId = (item: any) => String(item.identifier || item.system?.identifier || '');
	const restrictedTo = ((spell.system?.classes ?? []) as string[]).filter((id) => id.length > 0);
	const candidates =
		restrictedTo.length > 0
			? classItems.filter((item: any) => restrictedTo.includes(classId(item)))
			: classItems;

	const declared = candidates
		.map((item: any) => item.system?.spellcasting)
		.filter(
			(spellcasting: any) =>
				String(spellcasting?.cost?.poolIdentifier ?? '').trim().length > 0 ||
				spellcasting?.castAtHighestTier === true,
		);
	if (declared.length !== 1) return null;

	const mana = actor.system?.resources?.mana;
	const hasMana = Math.max(Number(mana?.max) || 0, Number(mana?.baseMax) || 0) > 0;
	if (restrictedTo.length < 1 && classItems.length > 1 && hasMana) return null;
	return declared[0];
}

/** The cost label the sheet's Cast a Spell panel shows, e.g. "2 Mana" or "1 Pilfered Power". */
function spellCastCost(actor: NimbleActor, spell: any): string | null {
	const tier = Number(spell.system?.tier) || 0;
	if (tier <= 0) return null;

	const spellcasting = spellcastingDeclaration(actor, spell);
	const poolIdentifier = String(spellcasting?.cost?.poolIdentifier ?? '').trim();
	if (poolIdentifier) {
		const amount = Math.max(0, integerFormula(actor, String(spellcasting.cost.amount || '1')));
		const pool = readStoredPools(actor, 'chargePools').find(
			(stored) => stored.id === poolIdentifier || stored.id === `actor:${poolIdentifier}`,
		);
		return ts(`${HEROIC_PREFIX}.poolCost`, {
			cost: String(amount),
			pool: pool ? poolLabel(pool, actor) : poolIdentifier,
		});
	}

	// A class that always casts at its highest unlocked tier lifts scaling spells to that tier.
	let castTier = tier;
	if (spellcasting?.castAtHighestTier && (spell.system?.scaling?.mode ?? 'none') !== 'none') {
		castTier = Math.max(tier, Number(actor.system?.resources?.highestUnlockedSpellTier) || 0);
	}
	return ts(`${HEROIC_PREFIX}.mana`, { cost: String(castTier) });
}

function spellTargetType(activation: any): string | null {
	if (!activation) return null;
	if (activation.acquireTargetsFromTemplate) return ts(`${HEROIC_PREFIX}.targetTypes.aoe`);
	const count = activation.targets?.count ?? 1;
	if (count === 0) return ts(`${HEROIC_PREFIX}.targetTypes.self`);
	if (count === 1) return ts(`${HEROIC_PREFIX}.targetTypes.singleTarget`);
	if (count === 2) return ts(`${HEROIC_PREFIX}.targetTypes.twoTargets`);
	return ts(`${HEROIC_PREFIX}.targetTypes.multiTarget`, { count: String(count) });
}

function spellRange(item: any): string | null {
	const props = item.system?.properties ?? {};
	const selected: string[] = props.selected ?? [];
	if (selected.includes('range') && props.range?.max) {
		return ts(`${HEROIC_PREFIX}.rangeDistance`, { distance: String(props.range.max) });
	}
	if (selected.includes('reach') && props.reach?.max) {
		return ts(`${HEROIC_PREFIX}.reachDistance`, { distance: String(props.reach.max) });
	}
	return null;
}

/** Spells as the Cast a Spell panel lists them. */
/** The sheet's heading tier: utility spells sit with the cantrips, as on the Spells tab. */
function spellHeadingTier(item: any): number {
	const properties = (item.system?.properties?.selected ?? []) as string[];
	return properties.includes('utilitySpell') ? 0 : Number(item.system?.tier) || 0;
}

/** Castable spells grouped by tier, lowest first, with the sheet's tier headings. */
export function readSpellGroups(actor: NimbleActor, search: string): SpellTierGroupView[] {
	const spells = readSpellList(actor, search);
	const tierById = new Map<string, number>(
		castableSpells(actor).map((item) => [item.id, spellHeadingTier(item)]),
	);
	const headings: Record<number, string> = nimbleConfig().spellTierHeadings ?? {};

	const groups = new Map<number, SpellEntryView[]>();
	for (const spell of spells) {
		const tier = tierById.get(spell.id) ?? spell.tier;
		const list = groups.get(tier) ?? [];
		list.push(spell);
		groups.set(tier, list);
	}

	return [...groups.entries()]
		.sort(([a], [b]) => a - b)
		.map(([tier, tierSpells]) => ({
			tier,
			label: headings[tier] ? game.i18n.localize(headings[tier]) : String(tier),
			spells: tierSpells,
		}));
}

export function readSpellList(actor: NimbleActor, search: string): SpellEntryView[] {
	const spells = bySort(castableSpells(actor)).filter((item) =>
		matchesSearch(search, item.name ?? '', descriptionText(item.system?.description)),
	);

	return spells.map((item) => {
		const effect = primaryEffectFormula(item.system?.activation?.effects);
		const description = item.system?.description ?? {};
		const textOrNull = (html: unknown) =>
			typeof html === 'string' && descriptionText(html) ? html : null;
		return {
			id: item.id,
			name: item.name ?? '',
			img: item.img ?? '',
			tier: Number(item.system?.tier) || 0,
			cost: spellCostLabel(item.system?.activation?.cost),
			concentration: ((item.system?.properties?.selected ?? []) as string[]).includes(
				'concentration',
			),
			targetType: spellTargetType(item.system?.activation),
			range: spellRange(item),
			castCost: spellCastCost(actor, item),
			effect: effect
				? { formula: evaluateFormula(actor, effect.formula), isHealing: effect.isHealing }
				: null,
			baseEffect: textOrNull(description.baseEffect),
			higherLevelEffect: textOrNull(description.higherLevelEffect),
		};
	});
}

export function readMove(actor: NimbleActor): MoveView {
	const config = nimbleConfig();
	const movement = actor.system?.attributes?.movement ?? {};
	const speeds: MovementSpeedView[] = [];
	for (const type of ['walk', 'fly', 'climb', 'swim', 'burrow']) {
		if (!(movement[type] > 0)) continue;
		speeds.push({
			type,
			value: movement[type],
			label: game.i18n.localize(config.movementTypes?.[type] ?? type),
			icon: config.movementTypeIcons?.[type] ?? '',
		});
	}

	const combat = getCombatForScene();
	const combatant = combat ? findCombatant(combat, actor) : null;
	return {
		speeds,
		primary: speeds.find((speed) => speed.type === 'walk') ?? speeds[0] ?? null,
		inCombat: Boolean(combatant && combatant.initiative !== null),
	};
}

/** DC of an Assess check (the system's ASSESS_DC). */
const ASSESS_DC = 12;

/** The Assess options; the system keeps these in `utils/assessOptions.ts`. */
const ASSESS_OPTIONS = [
	{ id: 'ask-question', icon: 'fa-solid fa-circle-question', key: 'askQuestion' },
	{ id: 'create-opening', icon: 'fa-solid fa-crosshairs', key: 'createOpening' },
	{ id: 'anticipate-danger', icon: 'fa-solid fa-shield', key: 'anticipateDanger' },
] as const;

export function readAssess(): AssessView {
	const options: AssessOptionView[] = ASSESS_OPTIONS.map((option) => ({
		id: option.id,
		icon: option.icon,
		title: ts(`${HEROIC_PREFIX}.assess.${option.key}.title`),
		description: ts(`${HEROIC_PREFIX}.assess.${option.key}.description`),
	}));
	const skills = Object.entries(nimbleConfig().skills ?? {})
		.map(([key, name]) => ({ key, name: String(name) }))
		.sort((a, b) => a.name.localeCompare(b.name));
	return { options, skills };
}

/**
 * Rolls the chosen skill against the Assess DC and posts the system's Assess chat card.
 * The action is deducted only once the roll was not cancelled, as in the sheet's panel.
 */
export async function rollAssess(
	actor: NimbleActor,
	optionId: string,
	skillKey: string,
): Promise<void> {
	const option = ASSESS_OPTIONS.find((entry) => entry.id === optionId);
	if (!option) return;

	const { roll } = await actor.rollSkillCheck(skillKey);
	if (!roll) return;

	const combat = getCombatForScene();
	const combatant = combat ? findCombatant(combat, actor) : null;
	const remaining = Number(combatant?.system?.actions?.base?.current) || 0;
	if (combatant && remaining > 0) {
		await combatant.update({ 'system.actions.base.current': Math.max(0, remaining - 1) });
	}

	const isSuccess = (roll.total ?? 0) >= ASSESS_DC;
	const prefix = `${HEROIC_PREFIX}.assess.${option.key}`;
	await ChatMessage.create({
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor }),
		sound: CONFIG.sounds.dice,
		rolls: [roll],
		type: 'assessAction',
		system: {
			actorName: actor.name,
			actorType: actor.type,
			permissions: actor.permission,
			rollMode: 0,
			skillKey,
			dc: ASSESS_DC,
			isSuccess,
			optionTitle: ts(`${prefix}.chatTitle`),
			resultMessage: ts(`${prefix}.${isSuccess ? 'success' : 'failure'}`, {
				name: actor.name,
				target: '',
			}),
			target: null,
			targetName: null,
		},
	});
}

/**
 * Runs one of the system's own heroic action macros (Move and Unarmed Strike). The macro acts
 * on the speaker actor, which is the same character the HUD is bound to.
 */
export async function runHeroicMacro(actionId: 'move' | 'unarmedStrike'): Promise<void> {
	await game.nimble.macros.activateHeroicActionMacro(actionId, 'action');
}

// ---------------------------------------------------------------------------
// Heroic reactions (the sheet's Defend, Interpose, Opportunity Attack and Help panels)
// ---------------------------------------------------------------------------

const REACTION_TABS: { id: HeroicReactionId; icon: string; flag: string }[] = [
	{ id: 'defend', icon: 'fa-solid fa-shield', flag: 'defendAvailable' },
	{ id: 'interpose', icon: 'fa-solid fa-people-arrows', flag: 'interposeAvailable' },
	{ id: 'opportunity', icon: 'fa-solid fa-bullseye', flag: 'opportunityAttackAvailable' },
	{ id: 'help', icon: 'fa-solid fa-handshake-angle', flag: 'helpAvailable' },
];

/** Whether the actor's sheet shows item images (the sheet's `showEmbeddedDocumentImages` flag). */
export function readShowImages(actor: NimbleActor): boolean {
	return actor.flags?.[game.system.id]?.showEmbeddedDocumentImages ?? true;
}

export function readReactionTabs(actor: NimbleActor): HeroicReactionTab[] {
	const combat = getCombatForScene();
	const combatant = combat ? findCombatant(combat, actor) : null;
	const running = Boolean(combatant && combat.started);
	const current = Number(combatant?.system?.actions?.base?.current) || 0;
	const isActiveTurn = Boolean(running && combat.combatant?.id === combatant.id);
	const mayAct = Boolean(game.user.isGM || actor.isOwner);

	return REACTION_TABS.map(({ id, icon, flag }) => {
		const label = ts(`${HEROIC_PREFIX}.reactions.${id}.label`);
		const stored = combatant?.system?.actions?.heroic?.[flag];
		const available = typeof stored === 'boolean' ? stored : true;

		// Same wording rules as the sheet's reaction tabs.
		let tooltip = ts(`${HEROIC_PREFIX}.reactionAvailability.available`, { label });
		if (combatant && !available) {
			tooltip = ts(`${HEROIC_PREFIX}.reactionAvailability.spent`, { label });
		} else if (!running) {
			tooltip = `${label} (${ts(`${HEROIC_PREFIX}.outsideCombat`)})`;
		} else if (current <= 0) {
			tooltip = `${label} (${ts(`${HEROIC_PREFIX}.noActions`)})`;
		}

		return {
			id,
			icon,
			label,
			tooltip,
			disabled: false,
			pip: !combatant ? 'none' : available ? 'available' : 'spent',
			dimmed: !(running && available && mayAct && !isActiveTurn && current > 0),
		};
	});
}

/** The system's keys for the heroic reactions, as `actionCost` rules name them. */
export type HeroicReactionKey = 'defend' | 'interpose' | 'opportunityAttack' | 'help';

/**
 * The action cost of using these heroic reactions together, after the actor's `actionCost`
 * rules (e.g. "1 Action", "Free"), as the sheet's reaction panels print it. Each reaction
 * starts at 1 action; matching rules apply in priority order (`set` overwrites, otherwise adds).
 */
export function readReactionCost(actor: NimbleActor, keys: HeroicReactionKey[]): string {
	const rules = ([...(actor.rules ?? [])] as any[])
		.filter((rule) => rule?.type === 'actionCost' && rule.appliesTo?.() !== false)
		.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));

	let total = 0;
	for (const key of new Set(keys)) {
		let cost = 1;
		for (const rule of rules) {
			if (!rule.matchesReaction?.(key)) continue;
			const value = rule.resolveValue?.();
			if (typeof value !== 'number' || !Number.isFinite(value)) continue;
			cost = rule.mode === 'set' ? value : cost + value;
		}
		total += Math.max(0, cost);
	}
	return spellCostLabel({ type: 'action', quantity: total }) ?? '';
}

/** The character's armor value, as the Defend panel shows it. */
export function readArmor(actor: NimbleActor): number {
	return Number(actor.system?.attributes?.armor?.value) || 0;
}

/** The tokens the user currently targets, excluding the acting character's own. */
export function readTargets(actor: NimbleActor): TargetView[] {
	return [...(game.user?.targets ?? [])]
		.filter((token: any) => token.actor?.id !== actor.id)
		.map((token: any) => ({
			name: token.actor?.name || token.name || ts(`${HEROIC_PREFIX}.unknown`),
			img: token.document?.texture?.src || 'icons/svg/mystery-man.svg',
		}));
}

/** Melee-capable weapons for an Opportunity Attack (everything but ranged-only weapons). */
export function readOpportunity(actor: NimbleActor): OpportunityView {
	const weapons = bySort([...(actor.items ?? [])]).filter((item: any) => {
		if (item.type !== 'object' || item.system?.objectType !== 'weapon') return false;
		const selected: string[] = item.system?.properties?.selected ?? [];
		return !(selected.includes('range') && !selected.includes('reach') && !selected.includes('thrown'));
	});

	return {
		unarmedDamage: evaluateFormula(actor, actor.system?.unarmedDamage ?? '1d4 + @abilities.strength.mod'),
		weapons: weapons.map((item: any) => ({
			id: item.id,
			name: item.name ?? '',
			img: item.img ?? '',
			damage: evaluateFormula(actor, primaryDamageFormula(item.system?.activation?.effects)),
			// Range and thrown are left out for opportunity attacks, as on the sheet.
			properties: weaponProperties(item).filter((_, index) => {
				const key = (item.system?.properties?.selected ?? [])[index];
				return key !== 'range' && key !== 'thrown';
			}),
			description: '',
		})),
	};
}

/**
 * Runs one of the system's own reaction macros: Defend, Interpose, Interpose & Defend and Help
 * confirm soft blocks, spend the reaction and post the same chat cards as the sheet's buttons.
 * `opportunity` opens the character sheet on its Opportunity Attack panel instead.
 */
export async function runReaction(
	id: 'defend' | 'interpose' | 'interposeAndDefend' | 'help' | 'opportunity',
): Promise<void> {
	await game.nimble.macros.activateHeroicActionMacro(id, 'reaction');
}

/**
 * Makes an Opportunity Attack with a weapon: attacks with disadvantage without spending
 * actions, then spends the reaction. Like the sheet, a spent reaction, an empty action pool or
 * the character's own turn asks for confirmation first, and confirming forces the reaction.
 */
export async function useOpportunityWeapon(actor: NimbleActor, itemId: string): Promise<void> {
	const combat = getCombatForScene();
	const combatant = combat ? findCombatant(combat, actor) : null;
	const reacting = Boolean(combatant && combat.started && combatant.id);

	let force = false;
	if (reacting) {
		const spent = combatant.system?.actions?.heroic?.opportunityAttackAvailable === false;
		const noActions = (Number(combatant.system?.actions?.base?.current) || 0) <= 0;
		const isActiveTurn = combat.combatant?.id === combatant.id;

		if (spent || noActions || isActiveTurn) {
			const name = ts(`${HEROIC_PREFIX}.reactions.opportunity.label`);
			const prefix = `${HEROIC_PREFIX}.confirmReaction`;
			const message = [
				isActiveTurn ? ts(`${prefix}.activeTurnMessage`) : '',
				noActions ? ts(`${prefix}.noActionsMessage`) : '',
				spent ? ts(`${prefix}.spentMessage`, { reaction: name }) : '',
			]
				.filter(Boolean)
				.join(' ');
			const confirmed = await foundry.applications.api.DialogV2.confirm({
				window: { title: ts(`${prefix}.title`) },
				content: `<p>${message}</p><p>${ts(`${prefix}.confirmQuestion`, { reaction: name })}</p>`,
				yes: { label: ts(`${prefix}.confirm`) },
				no: { label: ts(`${prefix}.cancel`) },
				rejectClose: false,
			});
			if (confirmed !== true) return;
			force = true;
		}
	}

	const result = await actor.activateItem(itemId, { rollMode: -1, skipActionDeduction: true });
	if (result && reacting) {
		await combat.useHeroicReactions(combatant.id, ['opportunityAttack'], force ? { force: true } : undefined);
	}
}

// ---------------------------------------------------------------------------
// Quick bar
// ---------------------------------------------------------------------------

/** Slots holding a macro store its world uuid; owned item ids never contain a dot. */
const MACRO_SLOT_PREFIX = 'Macro.';

function slotMacro(value: string): any {
	return value.startsWith(MACRO_SLOT_PREFIX)
		? game.macros?.get(value.slice(MACRO_SLOT_PREFIX.length))
		: null;
}

/** What a quick bar slot holds (an owned item or a macro), or null when it no longer exists. */
export function readQuickSlot(actor: NimbleActor, value: string): QuickItemView | null {
	if (value.startsWith(MACRO_SLOT_PREFIX)) {
		const macro = slotMacro(value);
		if (!macro) return null;
		return { id: value, kind: 'macro', name: macro.name ?? '', img: macro.img ?? '', quantity: null };
	}

	const item = actor.items?.get(value);
	if (!item) return null;
	const quantity = item.type === 'object' ? Number(item.system?.quantity) || 0 : 0;
	return {
		id: item.id,
		kind: 'item',
		name: item.name ?? '',
		img: item.img ?? '',
		quantity: quantity > 1 ? quantity : null,
	};
}

/**
 * The slot value for a drop: the actor's own item (Foundry's standard `{type: 'Item', uuid}`
 * drag data, as the character sheet produces) or a macro (`{type: 'Macro', uuid}`, from the
 * macro directory or the core hotbar). Compendium macros are imported into the world first,
 * as the core hotbar does. Anything else gives null, with a warning for foreign items.
 */
export async function resolveQuickSlotDrop(actor: NimbleActor, data: unknown): Promise<string | null> {
	const drop = data as { type?: string; uuid?: string } | null;
	if (!drop?.uuid) return null;

	if (drop.type === 'Macro') {
		let macro: any = await fromUuid(drop.uuid);
		if (!macro) return null;
		if (macro.pack) {
			try {
				macro = await game.macros.importFromCompendium(game.packs.get(macro.pack), macro.id);
			} catch (error) {
				console.error(error);
				macro = null;
			}
			if (!macro) {
				ui.notifications?.warn(t('quickBarMacroImportFailed'));
				return null;
			}
		}
		return `${MACRO_SLOT_PREFIX}${macro.id}`;
	}

	if (drop.type !== 'Item') return null;
	const item: any = await fromUuid(drop.uuid);
	if (!item?.id || item.parent?.id !== actor.id) {
		ui.notifications?.warn(t('quickBarForeignItem'));
		return null;
	}
	return item.id;
}

/** Uses a slot: items go through the sheet's own activation, macros run as from the core hotbar. */
export async function activateQuickSlot(actor: NimbleActor, value: string): Promise<void> {
	if (value.startsWith(MACRO_SLOT_PREFIX)) {
		await slotMacro(value)?.execute();
		return;
	}
	await activateItem(actor, value);
}

// ---------------------------------------------------------------------------
// Dice pools (the sheet's dice pool tracker)
// ---------------------------------------------------------------------------

const DIE_SIZES = new Set(['d4', 'd6', 'd8', 'd10', 'd12', 'd20']);

function nonNegativeInt(value: unknown): number {
	const number = Math.floor(Number(value));
	return Number.isFinite(number) && number > 0 ? number : 0;
}

interface StoredPool {
	id: string;
	identifier: string;
	itemId: string | null;
	raw: Record<string, any>;
}

/**
 * Pool state the system persists in flags: actor-scoped pools on the actor (ids start with
 * `actor:`), item-scoped pools on the item that defines them, keyed by identifier.
 */
function readStoredPools(actor: NimbleActor, flagKey: 'dicePools' | 'chargePools'): StoredPool[] {
	const result: StoredPool[] = [];
	const systemId = game.system.id;

	const actorPools = actor.flags?.[systemId]?.[flagKey];
	for (const [id, raw] of Object.entries(actorPools ?? {}) as [string, any][]) {
		if (!id.startsWith('actor:') || !raw || typeof raw !== 'object') continue;
		result.push({ id, identifier: String(raw.identifier ?? ''), itemId: null, raw });
	}
	for (const item of actor.items ?? []) {
		const itemPools = item.flags?.[systemId]?.[flagKey];
		for (const [identifier, raw] of Object.entries(itemPools ?? {}) as [string, any][]) {
			if (!raw || typeof raw !== 'object') continue;
			result.push({ id: identifier, identifier, itemId: item.id, raw });
		}
	}
	return result;
}

function poolLabel(stored: StoredPool, actor: NimbleActor): string {
	const itemName = stored.itemId ? actor.items.get(stored.itemId)?.name : stored.raw.sourceItemName;
	return String(stored.raw.label || itemName || stored.identifier);
}

/** Dice pools with rolled dice, then roll-on-spend pools, as the sheet's tracker lists them. */
export function readPools(actor: NimbleActor): PoolView[] {
	if (actor.type !== 'character') return [];
	const pools: PoolView[] = [];

	for (const stored of readStoredPools(actor, 'dicePools')) {
		const dieSize = DIE_SIZES.has(stored.raw.dieSize) ? String(stored.raw.dieSize) : 'd6';
		const max = nonNegativeInt(stored.raw.max);
		if (max < 1) continue;
		const faces = normalizeFaces(stored.raw.faces, dieSize, max);
		const minFace = Number(stored.raw.minFace);
		pools.push({
			kind: 'rolled',
			id: stored.id,
			identifier: stored.identifier,
			itemId: stored.itemId,
			label: poolLabel(stored, actor),
			dieSize,
			max,
			faces,
			total: faces.reduce((sum, face) => sum + face, 0),
			minFace: Number.isFinite(minFace) ? minFace : null,
		});
	}
	pools.sort((a, b) => a.label.localeCompare(b.label));

	// Charge pools without a die size are plain counters shown elsewhere; hidden ones are internal.
	const charges: PoolView[] = [];
	for (const stored of readStoredPools(actor, 'chargePools')) {
		if (!DIE_SIZES.has(stored.raw.dieSize) || stored.raw.hidden === true) continue;
		const max = nonNegativeInt(stored.raw.max);
		if (max < 1) continue;
		charges.push({
			kind: 'count',
			id: stored.id,
			identifier: stored.identifier,
			itemId: stored.itemId,
			label: poolLabel(stored, actor),
			dieSize: String(stored.raw.dieSize),
			max,
			current: Math.min(max, nonNegativeInt(stored.raw.current)),
		});
	}
	charges.sort((a, b) => a.label.localeCompare(b.label));

	return [...pools, ...charges];
}

/** Trigger labels, as the system's charge tooltip shows them (its ChargeUiConfig). */
const RECOVERY_TRIGGER_KEYS: Record<string, string> = {
	safeRest: 'NIMBLE.restTypes.safeRest',
	fieldRest: 'NIMBLE.restTypes.fieldRest',
	onHit: 'NIMBLE.activationEffects.onHit',
	onCriticalHit: 'NIMBLE.activationEffects.onCriticalHit',
	encounterStart: 'NIMBLE.charges.recoveryTrigger.encounterStart',
	encounterEnd: 'NIMBLE.charges.recoveryTrigger.encounterEnd',
	onInitiativeRolled: 'NIMBLE.charges.recoveryTrigger.onInitiativeRolled',
	onWound: 'NIMBLE.charges.recoveryTrigger.onWound',
	onTurnStart: 'NIMBLE.charges.recoveryTrigger.onTurnStart',
	onTurnEnd: 'NIMBLE.charges.recoveryTrigger.onTurnEnd',
	onKill: 'NIMBLE.charges.recoveryTrigger.onKill',
	onBloodied: 'NIMBLE.charges.recoveryTrigger.onBloodied',
};

function describeRecovery(entry: any): string {
	const triggerKey = RECOVERY_TRIGGER_KEYS[entry?.trigger];
	const trigger = triggerKey ? ts(triggerKey) : String(entry?.trigger ?? '');
	const mode =
		entry?.mode === 'refresh'
			? ts('NIMBLE.charges.recoveryMode.refresh')
			: ['add', 'set'].includes(entry?.mode)
				? ts(`NIMBLE.charges.recoveryMode.${entry.mode}`, { value: String(entry.value ?? '') })
				: `${entry?.mode}: ${entry?.value}`;
	return `${trigger}: ${mode}`;
}

/** Plain charge counters (pools without a die); pools with a die are the dice pool tabs. */
export function readCharges(actor: NimbleActor): ChargeView[] {
	if (actor.type !== 'character') return [];
	const charges: ChargeView[] = [];
	const spellPools = spellPoolIdentifiers(actor);
	for (const stored of readStoredPools(actor, 'chargePools')) {
		if (DIE_SIZES.has(stored.raw.dieSize) || stored.raw.hidden === true) continue;
		// Pools that pay for spells are shown beside mana instead (readResourcePools).
		if (isSpellResourcePool(stored, spellPools)) continue;
		const max = nonNegativeInt(stored.raw.max);
		if (max < 1) continue;
		charges.push({
			id: stored.id,
			identifier: stored.identifier,
			itemId: stored.itemId,
			label: poolLabel(stored, actor),
			icon: typeof stored.raw.icon === 'string' && stored.raw.icon ? stored.raw.icon : 'fa-solid fa-bolt',
			current: Math.min(max, nonNegativeInt(stored.raw.current)),
			max,
			recoveries: Array.isArray(stored.raw.recoveries)
				? stored.raw.recoveries.map(describeRecovery)
				: [],
		});
	}
	return charges.sort((a, b) => a.label.localeCompare(b.label));
}

/** Identifiers of the charge pools a class pays its spells from (e.g. Pilfered Power). */
function spellPoolIdentifiers(actor: NimbleActor): Set<string> {
	const identifiers = new Set<string>();
	for (const item of actor.items ?? []) {
		if (item.type !== 'class') continue;
		const identifier = String(item.system?.spellcasting?.cost?.poolIdentifier ?? '').trim();
		if (identifier) identifiers.add(identifier);
	}
	return identifiers;
}

/**
 * Whether a pool stands in for mana: the sheet promotes it ("Show As Resource") and a class
 * pays its spells from it, like the Shadowmancer's Pilfered Power. Other promoted pools stay
 * charge tabs.
 */
function isSpellResourcePool(stored: StoredPool, spellPools: Set<string>): boolean {
	if (stored.raw.showAsResource !== true || stored.raw.hidden === true) return false;
	if (DIE_SIZES.has(stored.raw.dieSize)) return false;
	return spellPools.has(stored.identifier) || spellPools.has(stored.id.replace(/^actor:/, ''));
}

/** Pools that pay for spells, shown beside mana (see isSpellResourcePool). */
function readResourcePools(actor: NimbleActor): ResourcePoolView[] {
	if (actor.type !== 'character') return [];
	const spellPools = spellPoolIdentifiers(actor);
	const pools: ResourcePoolView[] = [];
	for (const stored of readStoredPools(actor, 'chargePools')) {
		if (!isSpellResourcePool(stored, spellPools)) continue;
		const max = nonNegativeInt(stored.raw.max);
		if (max < 1) continue;
		const value = Math.min(max, nonNegativeInt(stored.raw.current));
		pools.push({
			id: stored.id,
			identifier: stored.identifier,
			itemId: stored.itemId,
			label: poolLabel(stored, actor),
			icon: typeof stored.raw.icon === 'string' && stored.raw.icon ? stored.raw.icon : 'fa-solid fa-bolt',
			value,
			max,
			percent: clampPercent(value, max),
		});
	}
	return pools.sort((a, b) => a.label.localeCompare(b.label));
}

/** Sets a spell-paying pool's current value (clamped to 0..max), as the mana bar does for mana. */
export async function setResourcePool(
	actor: NimbleActor,
	pool: ResourcePoolView,
	value: number,
): Promise<void> {
	const next = Math.min(pool.max, Math.max(0, Math.floor(Number(value))));
	if (!Number.isFinite(next) || next === pool.value) return;
	await writePoolField(actor, pool, 'chargePools', 'current', next);
	Hooks.call(`${game.system.id}.chargePool.changed`, {
		actor,
		poolId: pool.id,
		poolLabel: pool.label,
		previousValue: pool.value,
		newValue: next,
		maxValue: pool.max,
		reason: 'adjust',
		trigger: 'manual',
	});
}

/** Writes one field of a stored pool, without triggering the system's pool re-sync. */
async function writePoolField(
	actor: NimbleActor,
	pool: { id: string; identifier: string; itemId: string | null },
	flagKey: 'dicePools' | 'chargePools',
	field: 'faces' | 'current',
	value: number | number[],
): Promise<void> {
	const systemId = game.system.id;
	const document = pool.itemId ? actor.items.get(pool.itemId) : actor;
	if (!document) return;
	const key = pool.itemId ? pool.identifier : pool.id;
	const skip = flagKey === 'dicePools' ? 'skipDicePoolSync' : 'skipChargePoolSync';
	await document.update(
		{ [`flags.${systemId}.${flagKey}.${key}.${field}`]: value },
		{ [systemId]: { [skip]: true } },
	);
}

function emitDiceChanged(actor: NimbleActor, pool: PoolView, previous: number[], next: number[]) {
	Hooks.call(`${game.system.id}.dicePool.changed`, {
		actor,
		poolId: pool.id,
		poolLabel: pool.label,
		previousFaces: previous,
		newFaces: next,
		reason: 'manual',
		trigger: 'manual',
	});
}

/** Sets the dice of a rolled pool (right-click to discard one die or all of them). */
export async function setPoolFaces(actor: NimbleActor, pool: PoolView, faces: number[]): Promise<void> {
	if (pool.kind !== 'rolled') return;
	const next = normalizeFaces(faces, pool.dieSize, pool.max);
	await writePoolField(actor, pool, 'dicePools', 'faces', next);
	emitDiceChanged(actor, pool, pool.faces, next);
}

/**
 * Rolls one die for a rolled pool, posts the roll, and adds it unless the pool is full
 * (then the die is only shown, as in the sheet). A pool floor raises low rolls.
 */
export async function rollIntoPool(actor: NimbleActor, pool: PoolView): Promise<void> {
	if (pool.kind !== 'rolled') return;
	const roll = new Roll(`1d${dieMaxFace(pool.dieSize)}`);
	await roll.evaluate();
	const rolled = roll.total ?? 1;
	const face = applyFaceFloor(rolled, pool.minFace);

	await roll.toMessage({
		speaker: ChatMessage.getSpeaker({ actor }),
		flavor:
			face !== rolled
				? ts('NIMBLE.dicePoolTracker.raisedToFloor', {
						flavor: pool.label,
						rolled: String(rolled),
						face: String(face),
					})
				: pool.label,
	});

	if (pool.faces.length >= pool.max) return;
	const next = [...pool.faces, face];
	await writePoolField(actor, pool, 'dicePools', 'faces', next);
	emitDiceChanged(actor, pool, pool.faces, next);
}

/** Rolls the die of a roll-on-spend pool and spends one charge. */
export async function rollAndSpendCharge(actor: NimbleActor, pool: PoolView): Promise<void> {
	if (pool.kind !== 'count' || pool.current < 1) return;
	const roll = new Roll(`1d${dieMaxFace(pool.dieSize)}`);
	await roll.evaluate();
	await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: pool.label });

	const next = pool.current - 1;
	await writePoolField(actor, pool, 'chargePools', 'current', next);
	Hooks.call(`${game.system.id}.chargePool.changed`, {
		actor,
		poolId: pool.id,
		poolLabel: pool.label,
		previousValue: pool.current,
		newValue: next,
		maxValue: pool.max,
		reason: 'consume',
		trigger: 'manual',
	});
}

/** Whether the user may change this character's pools (the sheet gates the same actions). */
export function canEditPools(actor: NimbleActor): boolean {
	return actor.isOwner === true;
}

// ---------------------------------------------------------------------------
// Actions (all delegated to the system so chat cards and automation match the sheet)
// ---------------------------------------------------------------------------

export function rollAbilityCheck(actor: NimbleActor, abilityKey: string): void {
	void actor.rollAbilityCheckToChat(abilityKey);
}

export function rollSavingThrow(actor: NimbleActor, saveKey: string): void {
	void actor.rollSavingThrowToChat(saveKey);
}

export function rollSkillCheck(actor: NimbleActor, skillKey: string): void {
	void actor.rollSkillCheckToChat(skillKey);
}

/** Sets current hit points through the system, which clamps between 0 and the maximum. */
export function setCurrentHP(actor: NimbleActor, value: number): void {
	void actor.setCurrentHP(value);
}

/** Adds (or, when negative, removes) hit points, e.g. the HUD's +/- buttons. */
export function changeHP(actor: NimbleActor, delta: number): void {
	const current = Number(actor.system?.attributes?.hp?.value) || 0;
	void actor.setCurrentHP(current + delta);
}

/** Sets current mana (clamped to 0..max), as the character sheet's mana bar does. */
export function setCurrentMana(actor: NimbleActor, value: number): void {
	const mana = actor.system?.resources?.mana;
	const max = Math.max(0, Number(mana?.max || mana?.baseMax) || 0);
	const next = Math.min(max, Math.max(0, Math.floor(Number(value))));
	if (!Number.isFinite(next)) return;
	void actor.update({ 'system.resources.mana.current': next });
}

/** Adds (or, when negative, removes) mana, e.g. the HUD's +/- buttons. */
export function changeMana(actor: NimbleActor, delta: number): void {
	const mana = actor.system?.resources?.mana;
	setCurrentMana(actor, (Number(mana?.current ?? mana?.value) || 0) + delta);
}

/** Adds or removes wounds, clamped between 0 and the actor's wound maximum. */
export function changeWounds(actor: NimbleActor, delta: number): void {
	const wounds = actor.system?.attributes?.wounds;
	const max = Math.max(0, Number(wounds?.max) || 0);
	const current = Number(wounds?.value) || 0;
	const next = Math.min(max, Math.max(0, current + delta));
	if (next === current) return;
	void actor.update({ 'system.attributes.wounds.value': next });
}

/** Opens the system's Roll Hit Dice dialog, exactly as the character sheet's hit dice button. */
export function rollHitDice(actor: NimbleActor): void {
	void actor.rollHitDice();
}

/**
 * Activates an item through the system, which confirms an overspend, opens its configuration
 * and upcast dialogs, posts the chat card and deducts actions, mana and charges.
 */
export async function activateItem(actor: NimbleActor, itemId: string): Promise<void> {
	await actor.activateItem(itemId);
}

/** Only player characters can rest; the sheet's rest buttons exist on the character sheet only. */
export function canRest(actor: NimbleActor | null): boolean {
	return actor?.type === 'character';
}

/** Starts a field or safe rest exactly as the character sheet's rest buttons do. */
export function triggerRest(actor: NimbleActor, restType: 'field' | 'safe'): void {
	void actor.triggerRest({ restType });
}

export function openSheet(actor: NimbleActor): void {
	void actor.sheet?.render(true);
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

/** Foundry hooks that can change anything the HUD displays. */
const CORE_HOOKS = [
	'updateActor',
	'createItem',
	'updateItem',
	'deleteItem',
	'createActiveEffect',
	'updateActiveEffect',
	'deleteActiveEffect',
	'controlToken',
	// Unlinked tokens (such as summoned minions) keep their actor changes on the token.
	'updateToken',
	'updateUser',
	'canvasReady',
	'deleteToken',
	'targetToken',
	'combatStart',
	'combatTurn',
	'combatRound',
	'createCombat',
	'updateCombat',
	'deleteCombat',
	'createCombatant',
	'updateCombatant',
	'deleteCombatant',
	'createMacro',
	'updateMacro',
	'deleteMacro',
] as const;

/** Hooks the system fires itself. Names are prefixed with the system id (never hardcoded). */
const SYSTEM_HOOK_SUFFIXES = [
	'damageApplied',
	'restCompleted',
	'conditionApplied',
	'dicePool.changed',
	'dicePool.refilled',
	'chargePool.changed',
	'chargePool.recovered',
] as const;

/**
 * Calls `listener` (coalesced to one call per animation frame) whenever something that might
 * change the HUD happens. Returns an unsubscribe function.
 */
export function subscribe(listener: () => void): () => void {
	let scheduled = false;
	const schedule = () => {
		if (scheduled) return;
		scheduled = true;
		requestAnimationFrame(() => {
			scheduled = false;
			listener();
		});
	};

	const registered: Array<[string, number]> = [];
	const hookNames = [
		...CORE_HOOKS,
		...SYSTEM_HOOK_SUFFIXES.map((suffix) => `${game.system.id}.${suffix}`),
	];
	for (const name of hookNames) {
		registered.push([name, Hooks.on(name, schedule)]);
	}

	return () => {
		for (const [name, id] of registered) Hooks.off(name, id);
	};
}
