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

Character Movement & Animation

- [ ] 💛 Tap to turn  
  Enable turning by tapping direction (not in facing direction) when in slow mode (e.g., walk), yet still allow smooth direction changes when moving or in fast mode (e.g., run)
- [ ] 🤍 Smoke effect for jumps, drops, tricks etc.
- [ ] 🤍 Terrain dependant rendering
  Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)
- [ ] 🤍 Camera control for transitions (e.g., remove vertical camera motion for stub-to-stub-jumps)
- [ ] Ensure animation rotation, position offsets and other effects work in the overworld (only works in the menu as of now)
- [ ] Roll & flip animation
  - [ ] Roll on activate (A button) when running
  - [ ] Crash animation on collision or any non-rollable transition (e.g., blocked cells or ladder transitions)

Controls

- [ ] Fix start/select behavior (inconsistent toggling after gamepad refactor)

Bugs (clearly defined issues)

- [ ] 💛 Saving/loading is broken (due to entity brains that uses classes and functions)  
  We want to be able to save/load entity positions, states, routines, etc.
- [ ] Looping ambience (forest definitely, beach maybe) has a small gap/pause when looping
- [ ] Current ambience implementation hijacks audio on iOS, stopping music playback from other apps—we want to allow both to play simultaneously
- [ ] Getting stuck in a zoom-in on iOS Safari is still happening occasionally when using the touch controller (primarily on the d-pad)

Spikes (investigation tasks)

- [ ] Is it cleaner to only use `animationCurrent`, and not `movingToAnimation`?
- [ ] Maybe we should properly pause the game (now animations and sound still play, and the current transition continues—but we should probably freeze everything), but it could be fine the way it is for now?
