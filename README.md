# Animals

Nostalgic GBA inspired game about a skater collecting animals and mythological beings to make them dance battle.

## TODO

General

- [ ] Save system  
  - IndexedDB for async storage (doesn't block rendering)
  - Autosave on step/transition end
  - Autosave on activation end
  - Autoload on game start
  - Export/import save files as JSON
  - Support syncing with local file system, to enable cloud sync solutions (e.g., iCloud, Google Drive, Dropbox)

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
- [ ] RSVP dialog system
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
- [ ] Additive position offsets for animation and transition
- [ ] Stub jumps (tree trunks)  
  `src/scenes/overworld/data/start.ts`
- [ ] Roll & flip animation
  - [ ] Roll on activate (A button) when running
  - [ ] Crash animation on collision or any non-rollable transition
- [ ] Smoke effect for jumps, drops, tricks etc.
- [ ] Terrain movement  
  Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)

Bugs/Spikes

- [ ] Touch input is not working after leaving Safari on iOS and returning to the game
- [ ] Is it cleaner to only use `currentAnimation`, and not `movingToAnimation`?
- [ ] Why is `movingToAnimation` only working for jumping off the platform, and not for anything with a default `walk` animation (e.g., moving up and down ladders and stairs)?
