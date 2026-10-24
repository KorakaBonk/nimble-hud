/** Read-only views of a Nimble character, produced by the system adapter. */

export interface HitPointsView {
	value: number;
	max: number;
	temp: number;
	percent: number;
	bloodied: boolean;
}

export interface WoundsView {
	value: number;
	max: number;
}

export interface ManaView {
	value: number;
	max: number;
	percent: number;
}

/** A charge pool the system shows beside mana in the sheet header ("Show As Resource"). */
export interface ResourcePoolView {
	id: string;
	identifier: string;
	itemId: string | null;
	label: string;
	icon: string;
	value: number;
	max: number;
	percent: number;
}

export interface HitDiceSizeView {
	size: string;
	current: number;
	total: number;
}

export interface HitDiceView {
	current: number;
	total: number;
	bySize: HitDiceSizeView[];
}

export interface PortraitView {
	img: string;
	/** Sheet portrait adjustments: offsets in px, scale in percent. */
	xOffset: number;
	yOffset: number;
	scale: number;
}

export interface DefenseView {
	kind: 'resistant' | 'immune' | 'vulnerable';
	label: string;
	/** Comma-separated damage type names. */
	types: string;
}

export interface VitalsView {
	/** A monster (reduced HUD) rather than a character. */
	monster: boolean;
	name: string;
	portrait: PortraitView;
	summary: string;
	hp: HitPointsView;
	/** Minions do not track hit points, so their HP bar is hidden. */
	showHp: boolean;
	/** Characters only. */
	wounds: WoundsView | null;
	/** Monsters: damage resistances, immunities and vulnerabilities that are set. */
	defenses: DefenseView[];
	/** Armor chip text (characters only); empty for monsters, whose armor is a feature entry. */
	armorLabel: string;
	/** Walking speed; characters only. */
	speed: number | null;
	mana: ManaView | null;
	/** Charge pools promoted beside mana; characters only. */
	resourcePools: ResourcePoolView[];
	/** Characters only. */
	hitDice: HitDiceView | null;
}

export interface StatEntry {
	key: string;
	label: string;
	abbreviation: string;
	modifier: number;
	/** Positive = advantage by default, negative = disadvantage by default, 0 = neither. */
	rollMode: number;
	/** Skills only: the ability the skill derives from. */
	ability?: { key: string; name: string; icon: string };
}

export interface StatsView {
	abilities: StatEntry[];
	saves: StatEntry[];
	skills: StatEntry[];
	initiative: number;
}

export interface ConditionView {
	id: string;
	name: string;
	img: string;
}

export interface ActionPoolView {
	current: number;
	max: number;
	additional: number;
	effectiveMax: number;
	overflow: number;
	pipCount: number;
	/** Adjustment folded into `current` at the start of the next turn. May be negative. */
	pendingDelta: number;
}

/**
 * - `needsInitiative` / `initiativePending`: the roll button / a roll in flight
 * - `active`: initiative rolled, pips are usable
 */
export type CombatPhase = 'needsInitiative' | 'initiativePending' | 'active';

export interface CombatView {
	phase: CombatPhase;
	started: boolean;
	round: number;
	isMyTurn: boolean;
	/** Name of the player character holding the turn (null for monsters or when hidden). */
	turnName: string | null;
	/** A non-player combatant holds the turn. */
	monstersTurn: boolean;
	actions: ActionPoolView;
	canEndTurn: boolean;
}

export type HeroicActionId = 'attack' | 'spell' | 'move' | 'assess';
export type HeroicReactionId = 'defend' | 'interpose' | 'opportunity' | 'help';
export type HeroicPopupId = HeroicActionId | HeroicReactionId;

/** One button of a heroic section (the actions row or the reactions row). */
export interface HeroicTab<Id extends string = HeroicPopupId> {
	id: Id;
	icon: string;
	label: string;
	tooltip: string;
	disabled: boolean;
	/** Looks unusable right now (but stays clickable, like the sheet's tabs). */
	dimmed?: boolean;
	/** Availability pip for reactions; absent for actions, `none` outside combat. */
	pip?: 'available' | 'spent' | 'none';
}

export type HeroicActionTab = HeroicTab<HeroicActionId>;
export type HeroicReactionTab = HeroicTab<HeroicReactionId>;

export interface TargetView {
	name: string;
	img: string;
}

export interface OpportunityView {
	unarmedDamage: string;
	weapons: WeaponEntryView[];
}

export interface WeaponEntryView {
	id: string;
	name: string;
	img: string;
	damage: string;
	properties: string[];
	/** Raw description HTML, empty when the item has none. */
	description: string;
}

export interface AttackListView {
	/** Null when the search term filters the unarmed strike out. */
	unarmed: { damage: string } | null;
	entries: WeaponEntryView[];
}

export interface SpellEntryView {
	id: string;
	name: string;
	img: string;
	tier: number;
	/** Activation cost label, e.g. "1 Action". */
	cost: string | null;
	concentration: boolean;
	targetType: string | null;
	range: string | null;
	/** What a cast costs: its tier in mana, or the pool cost the class declares. Null when free. */
	castCost: string | null;
	effect: { formula: string; isHealing: boolean } | null;
	baseEffect: string | null;
	higherLevelEffect: string | null;
}

export interface MovementSpeedView {
	type: string;
	value: number;
	label: string;
	icon: string;
}

export interface MoveView {
	speeds: MovementSpeedView[];
	/** The walk speed, else the first one. */
	primary: MovementSpeedView | null;
	/** Rolled initiative in an active combat; the panel's button needs this. */
	inCombat: boolean;
}

export interface AssessOptionView {
	id: string;
	icon: string;
	title: string;
	description: string;
}

export interface AssessView {
	options: AssessOptionView[];
	skills: { key: string; name: string }[];
}

export interface QuickItemView {
	/** The stored slot value: an owned item id, or a world macro uuid (`Macro.<id>`). */
	id: string;
	kind: 'item' | 'macro';
	name: string;
	img: string;
	/** Shown as a badge for stackable gear (more than one). */
	quantity: number | null;
}

interface PoolBase {
	/** Key under `flags.<system>.dicePools|chargePools`. */
	id: string;
	label: string;
	dieSize: string;
	max: number;
	/** Where the pool's state is stored: on the actor, or on the item that defines it. */
	itemId: string | null;
	identifier: string;
}

/** A dice pool that holds rolled dice (e.g. Judgment Dice). */
export interface RolledPoolView extends PoolBase {
	kind: 'rolled';
	faces: number[];
	total: number;
	minFace: number | null;
}

/** A roll-on-spend pool: one charge per roll (e.g. Combat Dice). */
export interface CountPoolView extends PoolBase {
	kind: 'count';
	current: number;
}

export type PoolView = RolledPoolView | CountPoolView;

/** A plain charge counter on a feature or item (no die), e.g. "Second Wind 1/1". */
export interface ChargeView {
	id: string;
	identifier: string;
	itemId: string | null;
	label: string;
	icon: string;
	current: number;
	max: number;
	/** Plain-text recovery methods for the tooltip, e.g. "Safe Rest: Refill to max". */
	recoveries: string[];
}

export type MonsterFeatureCategory = 'feature' | 'action' | 'bloodied' | 'lastStand';

export interface MonsterFeatureEntry {
	id: string;
	name: string;
	img: string;
	/**
	 * `card` is clickable, `header` is a plain heading, `sequence` an attack sequence's text and
	 * `static` a card with nothing to activate (the armor line).
	 */
	kind: 'card' | 'header' | 'sequence' | 'static';
	/** Font Awesome classes shown instead of an image (static entries). */
	icon?: string;
	/** Colors the icon of a static entry (armor: none, medium, heavy). */
	tone?: 'none' | 'medium' | 'heavy';
	/** The feature rolls something (dice icon) rather than just posting text (speech icon). */
	hasEffects: boolean;
	rangeLabel: string | null;
	/** An action that belongs to an attack sequence. */
	nested: boolean;
	/** Raw description HTML, used for attack sequences. */
	description: string;
	/** Tooltip text: the name, then the plain-text description when there is one. */
	tooltip: string;
}

export interface MonsterFeatureGroup {
	category: MonsterFeatureCategory;
	label: string;
	entries: MonsterFeatureEntry[];
}
