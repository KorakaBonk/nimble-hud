# Agent Guidelines: Nimble HUD

A Foundry VTT **v14** module that adds a hideable bottom-of-screen character HUD for the
**Nimble** system (verified against Nimble **0.10.0**). These rules keep AI-assisted sessions
consistent. They mirror the conventions of the Nimble system repo where they apply.

## Critical rules

- **All Nimble-specific access lives in `src/adapter/systemAdapter.ts`.** Components never
  read `actor.system...`, `CONFIG.NIMBLE`, combatant fields or system hooks directly. If a
  system update moves a data path, only that file should need to change.
- **Never mutate documents directly.** Use `actor.update()`, `item.update()`,
  `combatant.update()` or the system's own methods.
- **Delegate game logic to the system.** Rolls, item use, rests, reactions and action
  spending go through Nimble's methods (`actor.rollSkillCheckToChat`, `actor.activateItem`,
  `game.nimble.macros.activateHeroicActionMacro`, `combat.useHeroicReactions`) so chat cards
  and automation match the character sheet. Never compute action or reaction costs in the
  HUD, and never deduct actions after `actor.activateItem` (it already does).
- **Never hardcode the system id** in hook names, flags or paths. Use `game.system.id`.
  (`main.ts` refuses to run unless the active system is `nimble`.)
- **The HUD cannot import system code.** The system's `#utils/...` aliases are internal to its
  bundle. Reach it only through runtime globals (`game.nimble`, `CONFIG.NIMBLE`, documents).
- **Bound actor = the system's macro speaker rule:** exactly one controlled token, otherwise
  the user's assigned character. The heroic-action macros act on that same actor. A GM who controls
  a single monster token (npc, minion, soloMonster) gets the reduced monster HUD instead
  (`isMonster`, `readMonsterVitals`, `MonsterFeatures.svelte`); players never get one.
- **Reactivity is hook-driven.** The system's `actor.reactive` belongs to the system's own
  Svelte instance and cannot be subscribed to from this bundle. Components read inside
  `$derived.by` blocks that touch `hudState.version`; the adapter's `subscribe()` bumps it.
- **No Svelte 4 syntax.** Use `$props()`, `$state`, `$derived`, `$effect`, `onclick`.
- **Runes outside `.svelte` files need the `.svelte.ts` extension.**
- **Foundry documents are class instances:** store them with `$state.raw`, never `$state`.
- **No barrel files** (`index.ts` re-exports).
- **Localization:** user-facing strings go in `public/lang/en.json` under `NIMBLE_HUD`
  and are read with `t('key')`. English only; do not generate other locales.
- **System wording:** text that must match the character sheet (heroic action panels) is read
  from the system's own lang keys with `ts('NIMBLE...')`. HUD-only text still goes in
  `en.json` under `NIMBLE_HUD` and is read with `t()`.
- **Tooltips:** every HUD tooltip uses `data-hud-tooltip="..."` (handled by `src/hud/tooltip.ts`):
  shown after a 1 second hover, always above the element, one fixed font size. Never use
  Foundry's `data-tooltip`, `title`, or CSS-only tooltips, and never set a tooltip font size.
- **`@ts-expect-error`, not `@ts-ignore`**, with a comment explaining why.

## Commands

- `pnpm install`, then `pnpm dev` (rebuilds `dist/` on change) or `pnpm build`.
- `pnpm check` runs `svelte-check` and the Vitest suite. Run it before finishing a task.
- `dist/` is a complete Foundry module folder; symlink it to `Data/modules/nimble-hud`.

## Layout

| Path | Purpose |
| --- | --- |
| `src/main.ts` | Hook registration, mounts the HUD at `ready` |
| `src/adapter/systemAdapter.ts` | The only file that knows Nimble's data model |
| `src/adapter/derive.ts` | Pure helpers (tested in `derive.test.ts`) |
| `src/adapter/types.ts` | View types produced by the adapter |
| `src/state/hudState.svelte.ts` | Reactive HUD state (bound actor, settings, `version`) |
| `src/hud/*.svelte` | UI components |
| `public/module.json`, `public/lang/` | Copied into `dist/` unchanged |

## Known unknowns (verify in Foundry, then delete from this list)

- The macro bar id `#hotbar` is confirmed in Foundry 14.368's source. The collapsed tab docks beside
  it (`dock` in `Hud.svelte`) and is untested in Foundry.
- Hit dice totals are computed as class totals plus `bonusHitDice` per die size, matching the
  system's `configureHitDice`; confirm they match the sheet's Hit Dice bar.
- `actor.rollSavingThrowToChat` is used by the sheet's Saving Throws component; confirmed
  there, not yet exercised from the HUD.
- Condition icons are read from active effects that carry a status id.

- Phase 2 combat bar is untested in Foundry: verify pip toggling, initiative roll (prompt dialog),
  and the player End Turn socket relay (needs a GM client connected).

- Heroic action popups (`src/hud/heroic`) are untested in Foundry. They mirror the sheet's panels
  but omit charge indicators, feature toggle switches and drag-to-macro. Unarmed Strike and Move
  call the system macro (`activateHeroicActionMacro`); the Assess option table and DC 12 are
  copied from `utils/assessOptions.ts` and must be re-checked after system updates.

- Heroic reaction popups: Defend, Interpose and Help call `activateHeroicActionMacro` (same chat
  cards as the sheet). The Opportunity Attack weapon rows are implemented in the adapter
  (`useOpportunityWeapon`); its Unarmed row opens the sheet panel. The panels reuse the sheet's
  global `reaction-panel__*` classes, so they depend on the system's `_reaction-card.scss`.

- Quick bar (`src/hud/QuickBar.svelte`): untested in Foundry. Slots hold owned item ids, stored
  per user in the `quickBar` client setting, keyed by actor id; the column count (1 to 10, three slots each) is the `quickBarColumns` setting
  and removing a column only hides its slots. It accepts the sheet's standard
  Item drag data and activates with `actor.activateItem`, like the sheet's feature and inventory rows.

- Dice pool tabs (`src/hud/PoolTabs.svelte`) are untested in Foundry. They read the pool state the
  system persists in flags (`flags.<system>.dicePools` / `chargePools`, on the actor and on items)
  and mirror its roll, discard and spend steps, including the `dicePool.changed` /
  `chargePool.changed` hooks. The sheet's per-pool spend panel ("Use a feature", edit dice) is not
  replicated. Plain charge counters (no die size, not hidden) get their own read-only tabs showing
  current/max. Re-check after system updates.

- Monster HUD is untested in Foundry: the combat bar is not shown for monsters, minions have no HP
  bar (like the sheet), armor is read-only, and features call `actor.activateItem` like the NPC
  sheet's feature cards (no charge indicators, no editing).

## Roadmap

1. (done) Shell, vitals, stats drawer with click-to-roll, conditions, collapse, macro-bar hiding.
2. (done) Combat bar: turn banner, action pips with overflow and pending badge, initiative states,
   End Turn (GM: `combat.nextTurn()`; player: relay over socket `system.${game.system.id}`).
3. Drawers: Attack, Spell (with upcast and mana), Features, Items; Assess and Opportunity Attack flows.
4. Heroic actions via `activateHeroicActionMacro`; reaction chips; dice pools and charges.
5. Rest and hit-dice buttons, equip toggle, scale/theme polish, release workflow.
