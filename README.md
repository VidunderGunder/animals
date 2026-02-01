# Animals

Nostalgic GBA inspired game about a skater collecting animals and mythological beings to make them dance battle.

## Sounds

Music and ambience can be high fidelity, but sound effects should be lo-fi/chiptune style to match the retro aesthetic.

Here are some in-browser synths you can create sound effects with:

- [ChipTone](https://sfbgames.itch.io/chiptone)
- [jsfxr](https://sfxr.me/)
- [Bfxr](https://www.bfxr.net/)

Make sure you export as or convert to `.mp3` before adding to the project.

But you can use any tool you like, as long as the sound effects fit the style.

## TODO

Audio

- [ ] 💛 Ambient sounds
- [ ] 💛 Music

Entities

- [ ] 💛 Movement/routines for entities

Character Movement & Animation

- [ ] 🤍 Camera control for transitions + Remove vertical camera motion for stub-to-stub-jumps
- [ ] 🤍 Smoke effect for jumps, drops, tricks etc.
- [ ] 🤍 Terrain dependant rendering 
  Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)
- [ ] 🤍 Tap to turn  
  Enable turning by tapping direction (not in facing direction) when in slow mode (e.g., walk), yet still allow smooth direction changes when moving or in fast mode (e.g., run)
- [ ] Additive position offsets for animation and transition  
  Transitions now override animation position offsets, but they should be combined (optionally maybe?)
- [ ] Roll & flip animation
  - [ ] Roll on activate (A button) when running
  - [ ] Crash animation on collision or any non-rollable transition

Controls

- [ ] Fix start/select behavior (inconsistent toggling after gamepad refactor)

Bugs (clearly defined issues)

- [ ] Game is freezed after leaving Safari on iOS and returning to the game

Spikes (investigation tasks)

- [ ] Maybe we should properly pause the game (now animations still play, and the current transition continues—but we should freeze everything), but it could be fine the way it is for now
- [ ] Is it cleaner to only use `currentAnimation`, and not `movingToAnimation`?
- [ ] Why is `movingToAnimation` only working for jumping off the platform, and not for anything with a default `walk` animation (e.g., moving up and down ladders and stairs)?
