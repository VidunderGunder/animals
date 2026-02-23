# Animals

Nostalgic GBA inspired game about a skater collecting animals and mythological beings to make them dance battle.

## 🎨 Art

Use [Aseprite](https://www.aseprite.org/) for pixel art and animations

[Figma Mood Board](https://www.figma.com/design/VW1gLuo6uHi9OP6OOCYgSk/Mood-Board?node-id=0-1&t=HpaZA41md53X1G4u-1)

Inspiration:

- [Interface In Game](https://interfaceingame.com/games/?themes=pixel-art)
- [Pinterest](https://pinterest.com/search/pins/?q=pixel%20art)

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

Priority

- [x] ~~🤖 Add game time to game state (not ticking if paused)~~
- [x] ~~🤖 Save/load game state~~
- [x] ~~🤖 Following~~
- [ ] 🎨 Design menu
  - [ ] Bag
  - [ ] Crew
  - [ ] Beastiary
  - [ ] Settings
- [ ] 🧠 Obstacle course mini-game (checkpoints, timer, leaderboard)
  - [ ] 🎨 UI overlay

Character Movement & Animation

- [ ] 🎨 Poof (spawn/despawn effect)
- [ ] 🤖 Dizzy if trick is repeated 3 times in quick sucession
- [ ] 🎨 Dizzy effect (starts/planets/chickens spinning)
- [ ] 🧠 Teleport command
- [ ] 🤖 Ensure current cell is occupied during spin-in-place
- [ ] 🎨 Create Roll & Flip sprites
- [ ] 🎨 Terrain dependent rendering:
  Cut off lower part of sprite (dynamic height), add animated overlay (e.g., water, grass, mud)

Bugs (clearly defined issues)

- [ ] 🤖 Re-opening Chrome with the app as the current tab opens a new tab
- [ ] 🤖 Loaded entities are not snapped to the beginning or end of a transition that was in progress when saving (causing noclipping if mid ladder or jump)
- [ ] 🔊 Looping ambience (forest definitely, beach maybe) has a small gap/pause when looping
- [ ] Browser audio issues
  - [ ] 🤖 Current ambience implementation hijacks audio on iOS, stopping music playback from other apps—we want to allow both to play simultaneously
  - [ ] 🤖 Ambience can be muted by pressing play/pause on iOS
  - [ ] 🤖 Ambience may keep playing when changing tabs
  - [ ] 🤖 I suspect there's a bug causing the same track to be triggered multiple time (weird distortions/phasing can happen during longer sessions)
- [ ] 🤖 Getting stuck in a zoom-in on iOS Safari is still happening occasionally when using the touch controller (primarily on the d-pad)
- [ ] 🔻 Blurry menu (pause menu will be remade soon, so will probably not fix)

Spikes (investigation tasks)

- [ ] 🧠 Trick system
  - [ ] 🤖 Make it possible to rotate (spin/flip) while jumping (jump transitions)
  - [ ] 🤖 Don't allow jump/flip if navigation is one z-layer above (and y + 1), as the entity is probably blocked
- [ ] 🧠 Add rendering px offset to entity state?  
  xPx and yPx are now responsible for Camera, Rendering and Logical, but we should split them  
  Camera + Logical/Rendering or Logical/Camera + Rendering?
  Alternatively: Logical required, and Camera and Rendering as optional overrides (defaulting to logical if not set)
  - [ ] 🤖 Ensure animation rotation, position offsets and other effects work in the overworld (only works in the menu as of now)
  - [ ] 🤖 Camera control for transitions (e.g., remove vertical camera motion for slow/walking stub-to-stub-jumps)
  - [ ] 🧠 Issue: Crashing with cell based camera offset leads to too much movement (E.g., crash at tip of docks)
- [x] ~~🧠 Maybe we should properly pause the game (now animations and sound still play, and the current transition continues—but we should probably freeze everything), but it could be fine the way it is for now?~~
- [ ] 🧠🔻 Research and redo pathfinding that 
- [ ] 🧠🔻 Research and redo following
