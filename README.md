# Nimble HUD

A hideable character HUD at the bottom of the screen for the [Nimble](https://github.com/Nimble-Co/FoundryVTT-Nimble)
game system on Foundry VTT v14. It shows your character's portrait, vitals, stats and actions in one
overlay, so you rarely need to open the character sheet during play.

## Features

- Portrait, HP with wounds, mana, hit dice, conditions, field rest and safe rest.
- Click-to-roll stats, saves and skills.
- Heroic actions (Attack, Cast a Spell, Move, Assess) and heroic reactions (Defend, Interpose,
  Opportunity Attack, Help), using the same chat cards and automation as the character sheet.
- A quick bar for items and macros, dice pool and charge pool tabs, and a spell pool bar beside mana.
- A combat bar with initiative, remaining actions and End Turn.
- A reduced monster HUD for the GM.
- Hides Foundry's macro bar while the HUD is open (configurable).

The HUD follows the same rule as Nimble's own macros: it shows the one character token you control,
otherwise your assigned character.

## Installation

In Foundry, open **Add-on Modules → Install Module** and paste this manifest URL:

```
https://github.com/KorakaBonk/nimble-hud/releases/latest/download/module.json
```

Then enable **Nimble HUD** in your world's module settings.

Requires Foundry VTT v14 and the Nimble system 0.10.0 or later.

## Settings (per client)

HUD scale, hide the macro bar, show the combat bar, and show the HUD for the GM.

## Development

```sh
npm ci
npm run dev     # rebuilds dist/ whenever a source file changes
npm run check   # type-check + tests
```

`dist/` is a complete module folder. Symlink it into your Foundry data folder as
`Data/modules/nimble-hud` and refresh the browser after each rebuild.

Releases are built by GitHub Actions: publishing a release tagged `vX.Y.Z` attaches `module.json`
and `module.zip` to it.

## License

The code is released under the [MIT License](LICENSE).

Nimble HUD is an independent product published under the Nimble 3rd Party Creator License.
Nimble © Nimble Co. It is not an official Nimble product and is not endorsed by Nimble Co.

Nimble HUD is free. If you enjoy Nimble, please support the game by buying the official content at
[nimbleRPG.com](https://nimblerpg.com).
