/**
 * Pure helpers with no Foundry dependency, so they can be unit tested.
 * Mirrors the arithmetic the Nimble character sheet uses.
 */
import type { HitDiceSizeView, HitDiceView } from './types.ts';

export function clampPercent(value: number, max: number): number {
	if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
	return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
}

/** Bloodied is "at half HP or less" while still above 0 (see the character sheet docs). */
export function isBloodied(hp: number, maxHp: number, hasBloodiedStatus = false): boolean {
	if (hasBloodiedStatus) return true;
	return maxHp > 0 && hp > 0 && hp <= maxHp / 2;
}

/** Formats a modifier with an explicit sign and a real minus sign, e.g. +3 / −1 / +0. */
export function formatModifier(value: number): string {
	const number = Number.isFinite(value) ? value : 0;
	const formatted = new Intl.NumberFormat('en-US', { signDisplay: 'always' }).format(number);
	return formatted.replace('-', '−');
}

interface ClassHitDice {
	size: string | number;
	total: number;
}

interface BonusHitDie {
	size: string | number;
	value: number;
}

interface HitDiceRecordEntry {
	current?: number;
}

/**
 * Total hit dice per size = every class contribution plus bonus hit dice of that size
 * (the same sums the system uses in `configureHitDice`). `current` comes from
 * `system.attributes.hitDice[size].current`.
 */
export function buildHitDice(
	classes: ClassHitDice[],
	bonusDice: BonusHitDie[],
	record: Record<string, HitDiceRecordEntry | undefined>,
): HitDiceView {
	const totals = new Map<string, number>();
	for (const cls of classes) {
		const size = String(cls.size);
		totals.set(size, (totals.get(size) ?? 0) + (Number(cls.total) || 0));
	}
	for (const bonus of bonusDice) {
		const size = String(bonus.size);
		totals.set(size, (totals.get(size) ?? 0) + (Number(bonus.value) || 0));
	}

	const sizes = new Set<string>([...totals.keys(), ...Object.keys(record)]);
	const bySize: HitDiceSizeView[] = [...sizes]
		.map((size) => ({
			size,
			current: Math.max(0, Number(record[size]?.current) || 0),
			total: Math.max(0, totals.get(size) ?? 0),
		}))
		.filter((entry) => entry.total > 0 || entry.current > 0)
		.sort((a, b) => Number(a.size) - Number(b.size));

	return {
		current: bySize.reduce((sum, entry) => sum + entry.current, 0),
		total: bySize.reduce((sum, entry) => sum + entry.total, 0),
		bySize,
	};
}

/**
 * Positions for `count` icons placed around the inside border of a `width` x `height` box,
 * starting in the lower left corner and moving clockwise (up the left edge, across the top,
 * down the right edge, back along the bottom). Returns top-left coordinates for each icon.
 */
export function perimeterSlots(
	count: number,
	width: number,
	height: number,
	size: number,
	gap: number,
	padding: number,
): { left: number; top: number }[] {
	const spanX = Math.max(0, width - 2 * padding - size);
	const spanY = Math.max(0, height - 2 * padding - size);
	const perimeter = 2 * (spanX + spanY);
	const step = size + gap;

	return Array.from({ length: count }, (_, index) => {
		let distance = perimeter > 0 ? (index * step) % perimeter : 0;
		let left = padding;
		let top = padding + spanY;

		// Left edge, going up.
		const up = Math.min(distance, spanY);
		top -= up;
		distance -= up;
		// Top edge, going right.
		const right = Math.min(distance, spanX);
		left += right;
		distance -= right;
		// Right edge, going down.
		const down = Math.min(distance, spanY);
		top += down;
		distance -= down;
		// Bottom edge, going left.
		left -= Math.min(distance, spanX);

		return { left, top };
	});
}

export interface ActionPoolShape {
	effectiveMax: number;
	/** How far `current` exceeds `effectiveMax` (granted actions beyond the usual pool). */
	overflow: number;
	/** How many pips to render: the effective max plus any overflow. */
	pipCount: number;
}

/** Pip layout for an action pool; surplus granted actions get extra overflow pips. */
export function buildActionPool(
	current: number,
	max: number,
	additional: number,
): ActionPoolShape {
	const effectiveMax = Math.max(0, max) + Math.max(0, additional);
	const overflow = Math.max(0, current - effectiveMax);
	return { effectiveMax, overflow, pipCount: effectiveMax + overflow };
}

/**
 * New `current` after clicking pip `index`: an available pip is spent, a spent pip restores
 * one action (never above the effective max). Mirrors the character sheet's action tracker.
 */
export function nextActionCount(index: number, current: number, effectiveMax: number): number {
	if (index < current) return Math.max(current - 1, 0);
	return Math.min(current + 1, effectiveMax);
}

/** Badge text for a pending action adjustment ("+2" / "−1"), or null when there is none. */
export function formatPendingDelta(delta: number): string | null {
	if (!Number.isFinite(delta) || delta === 0) return null;
	return `${delta < 0 ? '−' : '+'}${Math.abs(Math.trunc(delta))}`;
}

/** Plain text from system HTML, including Foundry enrichers like `@UUID[...]{Label}`. */
export function stripHtml(html: unknown): string {
	if (typeof html !== 'string') return '';
	return html
		.replace(/@\w+\[[^\]]*\]\{([^}]*)\}/g, '$1')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Item descriptions are one HTML string or an object of HTML fields. */
export function descriptionText(description: unknown): string {
	if (typeof description === 'string') return stripHtml(description);
	if (description && typeof description === 'object') {
		return Object.values(description as Record<string, unknown>)
			.map(stripHtml)
			.filter(Boolean)
			.join(' ');
	}
	return '';
}

export function matchesSearch(term: string, ...fields: string[]): boolean {
	const needle = term.trim().toLocaleLowerCase();
	if (!needle) return true;
	return fields.some((field) => field.toLocaleLowerCase().includes(needle));
}

interface EffectNode {
	type?: unknown;
	formula?: unknown;
	roll?: unknown;
	damageType?: unknown;
	children?: unknown;
}

/** Every node of an item's activation effect tree (nodes nest through `children`). */
export function flattenEffects(effects: unknown): EffectNode[] {
	const flat: EffectNode[] = [];
	const walk = (node: unknown): void => {
		if (!node || typeof node !== 'object') return;
		flat.push(node as EffectNode);
		const children = (node as EffectNode).children;
		if (Array.isArray(children)) children.forEach(walk);
	};
	if (Array.isArray(effects)) effects.forEach(walk);
	return flat;
}

function nodeFormula(node: EffectNode): string | null {
	for (const value of [node.formula, node.roll]) {
		if (typeof value === 'string' && value.trim()) return value.trim();
	}
	return null;
}

/** The first damage formula in the effect tree (what a weapon row shows). */
export function primaryDamageFormula(effects: unknown): string | null {
	for (const node of flattenEffects(effects)) {
		if (node.type !== 'damage') continue;
		const formula = nodeFormula(node);
		if (formula) return formula;
	}
	return null;
}

/** The first damage or healing formula in the effect tree (what a spell row shows). */
export function primaryEffectFormula(
	effects: unknown,
): { formula: string; isHealing: boolean } | null {
	for (const node of flattenEffects(effects)) {
		if (node.type !== 'damage' && node.type !== 'healing') continue;
		const formula = nodeFormula(node);
		if (formula) {
			return { formula, isHealing: node.type === 'healing' || node.damageType === 'healing' };
		}
	}
	return null;
}

/**
 * Splits a formula into terms and the `+`/`-` operators between them, ignoring operators
 * inside parentheses and signs that follow `*` or `/`.
 */
function splitTopLevel(formula: string): string[] {
	const tokens: string[] = [];
	let depth = 0;
	let term = '';
	for (const char of formula) {
		if (char === '(') depth += 1;
		if (char === ')') depth = Math.max(0, depth - 1);
		if (depth === 0 && (char === '+' || char === '-') && !/[*/]\s*$/.test(term)) {
			if (term.trim()) tokens.push(term.trim());
			tokens.push(char);
			term = '';
			continue;
		}
		term += char;
	}
	if (term.trim()) tokens.push(term.trim());
	return tokens;
}

/**
 * One term of a substituted formula, simplified: plain dice are kept, a computed dice count
 * such as `(floor(5 / 5))d12` becomes `1d12`, and static math is evaluated. Returns null for
 * a term that comes out as zero (no dice, or a value of 0).
 */
function simplifyTerm(term: string, evaluate: (expression: string) => unknown): string | null {
	if (/^\d*d\d+/i.test(term)) return term;

	const toInteger = (expression: string): number | null => {
		try {
			const value = evaluate(expression);
			return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null;
		} catch {
			return null;
		}
	};

	const [, countExpression, dice] = /^(.*\))\s*(d\d+.*)$/is.exec(term) ?? [];
	if (countExpression && dice) {
		const count = toInteger(countExpression);
		if (count === null) return term;
		return count <= 0 ? null : `${count}${dice}`;
	}

	const value = toInteger(term);
	if (value === null) return term;
	return value === 0 ? null : String(value);
}

/**
 * Simplifies a formula whose `@data` references are already substituted: static arithmetic
 * is evaluated with `evaluate`, dice terms are kept, computed dice counts are resolved and
 * zero terms are dropped. Falls back to `original` when nothing is left.
 */
export function simplifyFormula(
	substituted: string,
	original: string,
	evaluate: (expression: string) => unknown,
): string {
	let result = '';
	let sign: '+' | '-' = '+';
	for (const token of splitTopLevel(substituted)) {
		if (token === '+' || token === '-') {
			sign = sign === token ? '+' : '-';
			continue;
		}
		let term = simplifyTerm(token, evaluate);
		let termSign = sign;
		sign = '+';
		if (term === null) continue;
		if (term.startsWith('-')) {
			term = term.slice(1);
			termSign = termSign === '-' ? '+' : '-';
		}
		if (!result) result = termSign === '-' ? `-${term}` : term;
		else result += ` ${termSign} ${term}`;
	}
	return result || original;
}

const DIE_FACE_ICONS: Record<string, string> = {
	d4: 'fa-dice-d4',
	d6: 'fa-dice-d6',
	d8: 'fa-dice-d8',
	d10: 'fa-dice-d10',
	d12: 'fa-dice-d12',
	d20: 'fa-dice-d20',
};

/** Font Awesome class for a die size such as `d8`. */
export function dieFaceIcon(dieSize: string | null | undefined): string {
	return (dieSize && DIE_FACE_ICONS[dieSize]) || 'fa-dice-d6';
}

/** The highest face of a die size, e.g. `d8` -> 8. */
export function dieMaxFace(dieSize: string): number {
	const faces = Number(dieSize.slice(1));
	return Number.isFinite(faces) && faces > 0 ? faces : 6;
}

/** Stored dice faces, clamped to the die and truncated to the pool's maximum. */
export function normalizeFaces(value: unknown, dieSize: string, max: number): number[] {
	if (!Array.isArray(value)) return [];
	const maxFace = dieMaxFace(dieSize);
	const faces: number[] = [];
	for (const entry of value) {
		const face = Number(entry);
		if (!Number.isFinite(face)) continue;
		faces.push(Math.max(1, Math.min(maxFace, Math.floor(face))));
		if (faces.length >= max) break;
	}
	return faces;
}

/** Raises a rolled face to the pool's minimum face, when it has one. */
export function applyFaceFloor(face: number, minFace: number | null | undefined): number {
	return typeof minFace === 'number' && Number.isFinite(minFace)
		? Math.max(face, Math.floor(minFace))
		: face;
}

export interface MonsterFeatureSource {
	id: string;
	subtype: string;
	parentId: string | null;
	sort: number;
}

/**
 * Display order of a monster's actions, like the sheet: standalone actions first, then each
 * attack sequence followed by the actions that belong to it. An action whose parent is not an
 * attack sequence of this monster counts as standalone.
 */
export function orderMonsterActions<T extends MonsterFeatureSource>(
	actions: T[],
): { item: T; nested: boolean }[] {
	const bySort = (a: T, b: T) => a.sort - b.sort;
	const sequences = actions.filter((item) => item.subtype === 'attackSequence').sort(bySort);
	const sequenceIds = new Set(sequences.map((item) => item.id));
	const plain = actions.filter((item) => item.subtype !== 'attackSequence');

	const children = new Map<string, T[]>();
	const standalone: T[] = [];
	for (const action of plain) {
		if (action.parentId && sequenceIds.has(action.parentId)) {
			children.set(action.parentId, [...(children.get(action.parentId) ?? []), action]);
		} else {
			standalone.push(action);
		}
	}

	const ordered: { item: T; nested: boolean }[] = standalone
		.sort(bySort)
		.map((item) => ({ item, nested: false }));
	for (const sequence of sequences) {
		ordered.push({ item: sequence, nested: false });
		for (const child of (children.get(sequence.id) ?? []).sort(bySort)) {
			ordered.push({ item: child, nested: true });
		}
	}
	return ordered;
}

/** Cuts text to `max` characters (at a word boundary when possible), adding an ellipsis. */
export function truncateText(text: string, max: number): string {
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const space = cut.lastIndexOf(' ');
	return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
