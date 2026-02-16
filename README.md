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

- [ ] 🎨 Create Roll & Flip sprites ⬅️
- [ ] 🤖 Ensure animation rotation, position offsets and other effects work in the overworld (only works in the menu as of now)
- [ ] 🧠 Trick system
  - [ ] 🤖 Make it possible to rotate (spin/flip) while jumping (jump transitions)
  - [ ] 🤖 Don't allow jump/flip if navigation is one z-layer above (and y + 1), as the entity is probably blocked
- [ ] 🎨 Terrain dependant rendering
  Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)
- [ ] 🤖 Camera control for transitions (e.g., remove vertical camera motion for slow/walking stub-to-stub-jumps)

Bugs (clearly defined issues)

- [ ] 🤖 Loaded entities are not snapped to the beginning or end of a transition that was in progress when saving (causing noclipping if mid ladder or jump)
- [ ] 🔊 Looping ambience (forest definitely, beach maybe) has a small gap/pause when looping
- [ ] Browser audio issues
  - [ ] 🤖 Current ambience implementation hijacks audio on iOS, stopping music playback from other apps—we want to allow both to play simultaneously
  - [ ] 🤖 Ambience can be muted by pressing play/pause on iOS
  - [ ] 🤖 Ambience may keep playing when changing tabs
- [ ] 🤖 Getting stuck in a zoom-in on iOS Safari is still happening occasionally when using the touch controller (primarily on the d-pad)
- [ ] 🔻 Blurry menu (pause menu will be remade soon, so will probably not fix)

Spikes (investigation tasks)
- [ ] 🧠 Maybe we should properly pause the game (now animations and sound still play, and the current transition continues—but we should probably freeze everything), but it could be fine the way it is for now?
