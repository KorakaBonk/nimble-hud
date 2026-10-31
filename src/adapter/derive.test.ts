import { describe, expect, it } from 'vitest';
import {
	buildActionPool,
	buildHitDice,
	applyFaceFloor,
	clampPercent,
	descriptionText,
	dieFaceIcon,
	dieMaxFace,
	formatModifier,
	formatPendingDelta,
	isBloodied,
	matchesSearch,
	nextActionCount,
	orderMonsterActions,
	normalizeFaces,
	perimeterSlots,
	primaryDamageFormula,
	primaryEffectFormula,
	simplifyFormula,
	stripHtml,
	truncateText,
} from './derive.ts';

describe('clampPercent', () => {
	it('rounds and clamps', () => {
		expect(clampPercent(5, 10)).toBe(50);
		expect(clampPercent(-3, 10)).toBe(0);
		expect(clampPercent(15, 10)).toBe(100);
	});
	it('returns 0 for a zero or invalid max', () => {
		expect(clampPercent(5, 0)).toBe(0);
		expect(clampPercent(5, Number.NaN)).toBe(0);
	});
});

describe('isBloodied', () => {
	it('is true at half HP or less while above 0', () => {
		expect(isBloodied(10, 20)).toBe(true);
		expect(isBloodied(11, 20)).toBe(false);
		expect(isBloodied(0, 20)).toBe(false);
	});
	it('honors an explicit bloodied status', () => {
		expect(isBloodied(19, 20, true)).toBe(true);
	});
});

describe('formatModifier', () => {
	it('always shows a sign and uses a real minus', () => {
		expect(formatModifier(3)).toBe('+3');
		expect(formatModifier(0)).toBe('+0');
		expect(formatModifier(-1)).toBe('−1');
	});
});

describe('buildHitDice', () => {
	it('sums class and bonus dice per size and reads current from the record', () => {
		const result = buildHitDice(
			[
				{ size: 8, total: 3 },
				{ size: 10, total: 2 },
			],
			[{ size: '8', value: 1 }],
			{ '8': { current: 2 }, '10': { current: 2 } },
		);
		expect(result.total).toBe(6);
		expect(result.current).toBe(4);
		expect(result.bySize).toEqual([
			{ size: '8', current: 2, total: 4 },
			{ size: '10', current: 2, total: 2 },
		]);
	});
	it('drops empty sizes', () => {
		const result = buildHitDice([], [], { '6': { current: 0 } });
		expect(result.bySize).toEqual([]);
	});
});

describe('perimeterSlots', () => {
	// 100x60 box, 10px icons, no gap, 5px padding: icon origins span x 5..85, y 5..45.
	it('starts in the lower left corner and goes clockwise', () => {
		const slots = perimeterSlots(3, 100, 60, 10, 0, 5);
		expect(slots[0]).toEqual({ left: 5, top: 45 });
		expect(slots[1]).toEqual({ left: 5, top: 35 });
		expect(slots[2]).toEqual({ left: 5, top: 25 });
	});

	it('turns along the top edge after the left edge', () => {
		const slots = perimeterSlots(6, 100, 60, 10, 0, 5);
		expect(slots[4]).toEqual({ left: 5, top: 5 });
		expect(slots[5]).toEqual({ left: 15, top: 5 });
	});

	it('returns nothing for no icons', () => {
		expect(perimeterSlots(0, 100, 60, 10, 0, 5)).toEqual([]);
	});
});

describe('action pool helpers', () => {
	it('builds pips with overflow', () => {
		expect(buildActionPool(2, 3, 0)).toEqual({ effectiveMax: 3, overflow: 0, pipCount: 3 });
		expect(buildActionPool(3, 3, 1)).toEqual({ effectiveMax: 4, overflow: 0, pipCount: 4 });
		expect(buildActionPool(5, 3, 0)).toEqual({ effectiveMax: 3, overflow: 2, pipCount: 5 });
	});

	it('spends available pips and restores spent ones up to the max', () => {
		expect(nextActionCount(0, 3, 3)).toBe(2);
		expect(nextActionCount(1, 1, 3)).toBe(2);
		expect(nextActionCount(2, 3, 3)).toBe(2);
		expect(nextActionCount(2, 0, 3)).toBe(1);
		expect(nextActionCount(0, 0, 0)).toBe(0);
	});

	it('formats pending deltas', () => {
		expect(formatPendingDelta(0)).toBeNull();
		expect(formatPendingDelta(2)).toBe('+2');
		expect(formatPendingDelta(-1)).toBe('−1');
	});
});

describe('item helpers', () => {
	it('strips html and enrichers', () => {
		expect(stripHtml('<p>Deal <b>fire</b> damage &nbsp;to @UUID[abc]{Goblin}.</p>')).toBe(
			'Deal fire damage to Goblin.',
		);
		expect(stripHtml(undefined)).toBe('');
	});

	it('reads string and object descriptions', () => {
		expect(descriptionText('<p>a</p>')).toBe('a');
		expect(descriptionText({ baseEffect: '<p>base</p>', higherLevelEffect: '' })).toBe('base');
		expect(descriptionText(null)).toBe('');
	});

	it('matches searches case-insensitively across fields', () => {
		expect(matchesSearch('', 'x')).toBe(true);
		expect(matchesSearch('SWORD', 'Longsword', '')).toBe(true);
		expect(matchesSearch('fire', 'Longsword', 'cold')).toBe(false);
	});
});

describe('effect formulas', () => {
	const tree = [
		{ type: 'savingThrow', children: [{ type: 'damage', formula: ' 2d6 ', damageType: 'fire' }] },
	];

	it('walks nested children', () => {
		expect(primaryDamageFormula(tree)).toBe('2d6');
		expect(primaryEffectFormula(tree)).toEqual({ formula: '2d6', isHealing: false });
	});

	it('flags healing and ignores empty formulas', () => {
		expect(primaryEffectFormula([{ type: 'healing', formula: '1d8' }])?.isHealing).toBe(true);
		expect(primaryDamageFormula([{ type: 'healing', formula: '1d8' }])).toBeNull();
		expect(primaryDamageFormula([{ type: 'damage', formula: ' ' }])).toBeNull();
		expect(primaryDamageFormula(undefined)).toBeNull();
	});
});

describe('simplifyFormula', () => {
	const evaluate = (expression: string) => Function(`return (${expression})`)();

	it('evaluates static math and keeps dice', () => {
		expect(simplifyFormula('1d4 + 2 + 1', '1d4 + @x', evaluate)).toBe('1d4 + 2 + 1');
		expect(simplifyFormula('1d6 + 0', '1d6 + @x', evaluate)).toBe('1d6');
		expect(simplifyFormula('1d6 - 1', '1d6 - @x', evaluate)).toBe('1d6 - 1');
	});

	it('resolves computed dice counts', () => {
		const withMath = (expression: string) =>
			Function('Math', `with (Math) { return (${expression}); }`)(Math);
		const original = '1d12+@key + (floor(@level / 5))d12';
		expect(simplifyFormula('1d12+2 + (floor(2 / 5))d12', original, withMath)).toBe('1d12 + 2');
		expect(simplifyFormula('1d12+2 + (floor(5 / 5))d12', original, withMath)).toBe(
			'1d12 + 2 + 1d12',
		);
		expect(simplifyFormula('1d12+3 + (floor(10 / 5))d12', original, withMath)).toBe(
			'1d12 + 3 + 2d12',
		);
		expect(simplifyFormula('(1 + 1)d6 + 0', '(1 + @x)d6', withMath)).toBe('2d6');
	});

	it('keeps signs and parenthesized math intact', () => {
		expect(simplifyFormula('1d8 + (3 - 1) * 2', '', evaluate)).toBe('1d8 + 4');
		expect(simplifyFormula('1d8 + -2', '', evaluate)).toBe('1d8 - 2');
		expect(simplifyFormula('0 - 1d4', '', evaluate)).toBe('-1d4');
		expect(simplifyFormula('2 * -1 + 1d6', '', evaluate)).toBe('-2 + 1d6');
	});

	it('falls back to the original when nothing is left', () => {
		expect(simplifyFormula('+ 0', '@x', evaluate)).toBe('@x');
	});
});

describe('dice pool helpers', () => {
	it('maps die sizes to icons and faces', () => {
		expect(dieFaceIcon('d8')).toBe('fa-dice-d8');
		expect(dieFaceIcon(null)).toBe('fa-dice-d6');
		expect(dieMaxFace('d12')).toBe(12);
		expect(dieMaxFace('x')).toBe(6);
	});

	it('normalizes stored faces', () => {
		expect(normalizeFaces([0, 3, 99, 'x', 4.7], 'd6', 5)).toEqual([1, 3, 6, 4]);
		expect(normalizeFaces([1, 2, 3], 'd6', 2)).toEqual([1, 2]);
		expect(normalizeFaces(undefined, 'd6', 2)).toEqual([]);
	});

	it('applies the minimum face', () => {
		expect(applyFaceFloor(1, 3)).toBe(3);
		expect(applyFaceFloor(5, 3)).toBe(5);
		expect(applyFaceFloor(2, null)).toBe(2);
	});
});

describe('orderMonsterActions', () => {
	const make = (id: string, subtype: string, parentId: string | null, sort: number) => ({
		id,
		subtype,
		parentId,
		sort,
	});

	it('puts standalone actions first, then each sequence with its children', () => {
		const ordered = orderMonsterActions([
			make('child-b', 'action', 'seq', 30),
			make('seq', 'attackSequence', null, 5),
			make('solo', 'action', null, 50),
			make('child-a', 'action', 'seq', 10),
		]);
		expect(ordered.map((entry) => [entry.item.id, entry.nested])).toEqual([
			['solo', false],
			['seq', false],
			['child-a', true],
			['child-b', true],
		]);
	});

	it('treats an action with an unknown parent as standalone', () => {
		const ordered = orderMonsterActions([make('lost', 'action', 'missing', 1)]);
		expect(ordered).toEqual([{ item: make('lost', 'action', 'missing', 1), nested: false }]);
	});
});

describe('truncateText', () => {
	it('leaves short text alone', () => {
		expect(truncateText('short', 10)).toBe('short');
	});

	it('cuts long text at a word boundary with an ellipsis', () => {
		expect(truncateText('alpha beta gamma delta', 14)).toBe('alpha beta…');
		expect(truncateText('abcdefghijklmnop', 8)).toBe('abcdefgh…');
	});
});
