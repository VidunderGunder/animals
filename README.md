# Animals

Nostalgic GBA inspired game about a skater collecting animals and mythological beings to make them dance battle.

## TODO

UI

- [x] Fullscreen toggle (F key as first draft)  
  See `src/gfx/fullscreen.ts` and `src/main.ts`

Entities

- [ ] Entities (characters, items, animals)
- [ ] RSVP dialog system
- [ ] Movement support for NPCs

Audio

- [ ] Music
- [ ] Ambient sounds
- [ ] Animations sounds

World

- [ ] Animated world map  
  `worldImageLayers` in `src/scenes/overworld.ts` is static now, but we want to support simple animated layers

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
- [x] Smooth camera offset based on position
- [ ] Smoke effect for jumps, drops, tricks etc.
- [ ] Terrain movement  
  Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)

Spikes

- [ ] Is it cleaner to only use `currentAnimation`, and not `movingToAnimation`?
- [ ] Why is `movingToAnimation` only working for jumping off the platform, and not for anything with a default `walk` animation (e.g., moving up and down ladders and stairs)?
