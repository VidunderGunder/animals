# Animals

Nostalgic GBA inspired game about a skater collecting animals and mythological beings to make them dance battle.

## TODO

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

Character Movement & Animation

- [ ] Tap to turn  
  Enable turning by tapping direction (not in facing direction) when in slow mode (e.g., walk), yet still allow smooth direction changes when moving or in fast mode (e.g., run)
- [ ] Decouple transition speed from player speed
- [ ] Support different transitions given conditions (e.g., moving faster or slower)
- [ ] Functions for curved transition paths
- [ ] Adjust character state in transitions (e.g., climbing down ladders backwards)
- [ ] Additive position offsets for animation and transition
- [ ] Stub jumps (tree trunks)
- [ ] Roll & flip animation
- [ ] **Smooth camera offset (cutscene > transition > player state > position)** 
  - [ ] Cutscene
  - [ ] **Position** ⬅
  - [ ] Position
  - [ ] Position
- [ ] Smoke effect for jumps, drops, tricks etc.
- [ ] Terrain movement  
Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)

Spikes

- [ ] Is it cleaner to only use `currentAnimation`, and not `movingToAnimation`?
- [ ] Why is `movingToAnimation` only working for jumping off the platform, and not for anything with a default `walk` animation (e.g., moving up and down ladders and stairs)?
