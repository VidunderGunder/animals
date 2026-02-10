# Animals

Nostalgic GBA inspired game about a skater collecting animals and mythological beings to make them dance battle.

## 🔊 Sounds

Music and ambience can be high fidelity, but sound effects should be lo-fi/chiptune style to match the retro aesthetic.

Here are some in-browser synths you can create sound effects with:

- [ChipTone](https://sfbgames.itch.io/chiptone)
- [jsfxr](https://sfxr.me/)
- [Bfxr](https://www.bfxr.net/)

Make sure you export as or convert to `.mp3` before adding to the project.

But you can use any tool you like, as long as the sound effects fit the style.

## ✅ TODO

- 🧠 Requires human thought and care
- 🎨 Requires pixel art
- 🔊 Audio related (requires DAW or synth)
- 🤖 Good vibe coding task
- 🔻 Not prioritized (might be a waste of time)
- ⬅️ My current focus

Priority

- [ ] 🎨 Design menu
- [ ] 🎨 Design beastiary

Character Movement & Animation

- [ ] 🤖 Trick improvements ⬅️
  - [ ] 🔊 Spin sound effect
  - [ ] 🤖 Occupy all tiles involved when doing a trick transition (if possible)
  - [ ] 🤖 Collide if traversing through an occupied tile
  - [ ] 🤖 Collide if traversing through an edge with a transition
  - [ ] 🤖 Allow trick through certain transtions (e.g., stairs)
- [ ] 🤖 Make it possible to rotate while jumping (jump transitions)
- [ ] 🤖 Ensure animation rotation, position offsets and other effects work in the overworld (only works in the menu as of now)
- [ ] Roll & flip tricks
  - [ ] 🎨 Create new sprites
  - [ ] 🤖 Possible to roll and flip whenever (pressing A)
  - [ ] 🤖 Crash animation on collision or any non-rollable/flipable transition (e.g., blocked cells or ladder)
  - [ ] 🤖 Don't allow jump/flip if navigation is one z-layer above (and y + 1), as the entity is probably blocked
- [ ] 🎨 Smoke effect for jumps, drops, tricks etc.
- [ ] 🎨 Terrain dependant rendering
  Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)
- [ ] 🤖 Camera control for transitions (e.g., remove vertical camera motion for stub-to-stub-jumps)

Bugs (clearly defined issues)

- [ ] 🤖 Loaded entities are not snapped to the beginning or end of a transition that was in progress when saving
- [ ] 🔊 Looping ambience (forest definitely, beach maybe) has a small gap/pause when looping
- [ ] 🤖 Current ambience implementation hijacks audio on iOS, stopping music playback from other apps—we want to allow both to play simultaneously
- [ ] 🤖 Getting stuck in a zoom-in on iOS Safari is still happening occasionally when using the touch controller (primarily on the d-pad)
- [ ] 🔻 Blurry menu (pause menu will be remade soon, so will probably not fix)

Spikes (investigation tasks)
- [ ] 🧠 Maybe we should properly pause the game (now animations and sound still play, and the current transition continues—but we should probably freeze everything), but it could be fine the way it is for now?
