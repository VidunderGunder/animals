# Animals

Nostalgic GBA inspired game about a skater collecting animals and mythological beings to make them dance battle.

## TODO

General

- [ ] Save system  
  - IndexedDB for async storage (doesn't block rendering)
  - Manual save function (META + S for now)
  - Autosave on step/transition end
  - Autoload on game start
  - Export/import save files as JSON (functionality first, we'll have to design UI before implementing the visual part)
  - Support syncing with local file system, to enable agnostic cloud sync solutions (e.g., iCloud, Google Drive, Dropbox)

World

- [ ] Expand start area to not show map edges in 16:9 view
- [ ] Animated world map  
  `worldImageLayers` in `src/scenes/overworld.ts` is static now, but we want to support simple animated layers

Audio

- [ ] Ambient sounds
- [ ] Animations sounds
- [ ] Music

Entities

- [ ] Entities (characters, items, animals)
- [ ] Movement support for NPCs

Character Movement & Animation

- [ ] Tap to turn  
  Enable turning by tapping direction (not in facing direction) when in slow mode (e.g., walk), yet still allow smooth direction changes when moving or in fast mode (e.g., run)
- [ ] Decouple transition speed from player speed
- [ ] Curved transition paths  
  Bezier curves for position and speed?
- [ ] Adjust character state in transitions (e.g., climbing down ladders backwards)
- [ ] Multiple transitions per edge  
  E.g., moving faster or slower for jumping shorter or longer distances. We currently only support one condition and one transition per edge.  
  The player should be able to jump down ladders if running, but climb down normally if walking.
- [ ] Additive position offsets for animation and transition
- [ ] Stub jumps (tree trunks)  
  `src/scenes/overworld/data/start.ts`
- [ ] Roll & flip animation
  - [ ] Roll on activate (A button) when running
  - [ ] Crash animation on collision or any non-rollable transition
- [ ] Smoke effect for jumps, drops, tricks etc.
- [ ] Terrain movement  
  Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)

Controls
- [ ] Fix start/select behavior (inconsistent toggling after gamepad refactor)

Bugs/Spikes

- [ ] User has to touch to activate gamepad input on iOS Safari
  Should be automatic after opening, give a prompt if controller is connected or require touch to enable gamepad—which also would help with audio activation
- [ ] Input is not working after leaving Safari on iOS and returning to the game
- [ ] Is it cleaner to only use `currentAnimation`, and not `movingToAnimation`?
- [ ] Why is `movingToAnimation` only working for jumping off the platform, and not for anything with a default `walk` animation (e.g., moving up and down ladders and stairs)?
