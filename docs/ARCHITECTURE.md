# Architecture

Plain HTML, CSS and canvas with no build step. The scripts are plain `<script>` tags that share global scope, loaded in this order from `index.html`. Everything is drawn in a fixed 390×700 stage that `js/main.js` scales to fit the screen.

## Files

| File | Contents |
|------|----------|
| `js/config.js` | `GAME_VERSION`, the 390×700 stage size, modes, body colors, hats, scarves, glasses, spots, default outfit |
| `js/save.js` | Current outfit, favorite outfits and settings in localStorage |
| `js/audio.js` | Sound effects made with Web Audio |
| `js/particles.js` | Particle effects: bursts, confetti, praise text |
| `js/game.js` | Game state (`menu` and `play`). Equipping items, Match Me, Surprise and Show off, the category tray, drawing the dino |
| `js/main.js` | Canvas sizing, screens, the frame loop, pointer input, service worker registration and update checks |
| `index.html`, `css/style.css` | Page markup, menus and styles |
| `sw.js`, `manifest.webmanifest` | Offline cache and PWA install |
| `tests/run.mjs` | Test runner |

## Updates

`js/main.js` registers `sw.js` and checks for updates two ways:

- It calls `registration.update()` on load, when the tab regains focus, and every minute. A new service worker takes over as soon as it installs.
- Every two minutes, and whenever the tab becomes visible, it fetches `js/config.js` with caching disabled and compares `GAME_VERSION`.

Either way, the page reloads to pick up the new version, but not in the middle of play. A pending reload happens at the next menu.
