# Dress-Up Dino

Dress up a friendly dinosaur with hats, scarves, glasses and spots, save your favorite outfits, and show them off with confetti. Free creative play for ages 4–6.

Play at https://jmitchell238.github.io/dress-up-dino/. It's one of the games in [Arcade Hub](https://jmitchell238.github.io/arcade-hub/).

## Modes

| Mode | Description |
|------|-------------|
| Free Play | Try on anything, no goals |
| Match Me | Copy the outfit on the faded dino to get a cheer |

## Features

- Categories: Color, Hats, Scarves, Glasses and Spots
- Save up to 8 favorite outfits
- A Surprise button for a random outfit, and a Show off button for a dance and confetti
- Mute and Calm motion settings
- Installable PWA that works offline after the first visit

There are no lives, ads, accounts or fail screens.

## Running locally

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. The service worker needs `localhost` or HTTPS.

Plain HTML, CSS and canvas with no build step.

## Tests

```bash
node tests/run.mjs
```

## Versioning

When you bump `GAME_VERSION` in `js/config.js`, set `CACHE` in `sw.js` to `'dress-up-dino-' + GAME_VERSION`.

## License

Personal project for the family.
