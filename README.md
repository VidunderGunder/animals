# Animals

Nostalgic GBA inspired game about a skater collecting animals and mythological beings to make them dance battle.

## TODO

General

- [ ] Clean up state  
  Lots of duplications in player state, should be replaced with getters (e.g., path related stuff)

World

- [ ] 💛 Animated world map  
  `worldImageLayers` in `src/scenes/overworld.ts` is static now, but we want to support simple animated layers
- [ ] Expand start area to not show map edges in 16:9 view
  Do together with animated world map

Audio

- [ ] ❤️ Ambient sounds
- [ ] ❤️ Animations sounds
- [ ] ❤️ Music

Entities

- [ ] ❤️ Entities (characters, items, animals)
- [ ] Movement support for NPCs

Character Movement & Animation

- [ ] ❤️ Smoke effect for jumps, drops, tricks etc.
- [ ] ❤️ Terrain movement  
  Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)
- [ ] 🤍 Tap to turn  
  Enable turning by tapping direction (not in facing direction) when in slow mode (e.g., walk), yet still allow smooth direction changes when moving or in fast mode (e.g., run)
- [ ] 🤍 Adjust character state in transitions  
  E.g., climbing down ladders backwards
- [ ] Additive position offsets for animation and transition
- [ ] Stub jumps (tree trunks)  
  `src/scenes/overworld/data/start.ts`
- [ ] Roll & flip animation
  - [ ] Roll on activate (A button) when running
  - [ ] Crash animation on collision or any non-rollable transition


Controls
- [ ] Fix start/select behavior (inconsistent toggling after gamepad refactor)

Bugs (clearly defined issues)

- [ ] Properly pause game (now animations still play, and the current transition continues—but we should freeze everything)
- [ ] Input is not working after leaving Safari on iOS and returning to the game

Spikes (investigation tasks)

- [ ] Is it cleaner to only use `currentAnimation`, and not `movingToAnimation`?
- [ ] Why is `movingToAnimation` only working for jumping off the platform, and not for anything with a default `walk` animation (e.g., moving up and down ladders and stairs)?
