# Changelog

## 1.1.2

- Cast a Spell panel: spells are grouped under the character sheet's tier headings (Cantrips and Utility Spells, Tier 1 Spells, ...). Each tier can be collapsed.
- Roll formulas resolve computed dice counts, so Shadow Blast shows `1d12 + 2 + 1d12` at level 5 instead of `(floor(5 / 5))d12`.

## 1.1.1

- Reverted the 1.1.0 layering change: the HUD stacks below app windows again, as in 1.0.0.

## 1.1.0

- Players see the monster HUD for minion tokens they own (for example ones their character summoned) when they select the token.
- The HUD now always renders above character, item and journal sheets and other windows. Confirm dialogs it opens stay above it.

## 1.0.0

First public release.

- Character HUD at the bottom of the screen: portrait, HP with wounds, mana, hit dice, conditions and rests.
- Click-to-roll stats, saves and skills.
- Heroic actions (Attack, Cast a Spell, Move, Assess) and heroic reactions (Defend, Interpose, Opportunity Attack, Help).
- Quick bar for items and macros, dice pool and charge pool tabs, spell pool bar beside mana.
- Combat bar with initiative, action pips and End Turn.
- Reduced monster HUD for the GM.
- Requires Foundry VTT v14 and Nimble 0.10.0.
