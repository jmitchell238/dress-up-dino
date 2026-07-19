'use strict';

// Dress-Up Dino — Keep CACHE in sw.js in sync: 'dress-up-dino-' + GAME_VERSION
const GAME_VERSION = '1.0.000';
const GAME_VERSION_LABEL = 'v' + GAME_VERSION;
const GAME_NAME = 'Dress-Up Dino';

const W = 390;
const H = 700;
const SAVE_KEY = 'dress-up-dino-save-v1';

const MODES = {
  free:  { id: 'free',  name: 'Free Play',  tagline: 'Dress forever', challenge: false },
  match: { id: 'match', name: 'Match Me',   tagline: 'Copy the look', challenge: true },
};
const MODE_ORDER = ['free', 'match'];

const MAX_FAVORITES = 8;
const PRAISE = ['Cute!', 'Wow!', 'Fancy!', 'Yay!', 'Roar!', 'Style!', 'Yes!', 'Dino!'];

/** Body / skin color options */
const BODY_COLORS = [
  { id: 'mint',   label: 'Mint',   fill: '#7DCEA0', stroke: '#1E8449', belly: '#D5F5E3' },
  { id: 'sky',    label: 'Sky',    fill: '#5DADE2', stroke: '#1A5276', belly: '#D6EAF8' },
  { id: 'coral',  label: 'Coral',  fill: '#F1948A', stroke: '#922B21', belly: '#FADBD8' },
  { id: 'grape',  label: 'Grape',  fill: '#AF7AC5', stroke: '#6C3483', belly: '#E8DAEF' },
  { id: 'honey',  label: 'Honey',  fill: '#F5B041', stroke: '#B9770E', belly: '#FCF3CF' },
  { id: 'rose',   label: 'Rose',   fill: '#F5B7B1', stroke: '#C0392B', belly: '#FDEDEC' },
];

/** Hat cosmetics (none = bare head) */
const HATS = [
  { id: 'none',     label: 'None' },
  { id: 'party',    label: 'Party',   color: '#E74C3C', color2: '#F9E79F' },
  { id: 'cap',      label: 'Cap',     color: '#3498DB', color2: '#1A5276' },
  { id: 'crown',    label: 'Crown',   color: '#F4D03F', color2: '#B7950B' },
  { id: 'bow',      label: 'Bow',     color: '#E91E63', color2: '#AD1457' },
  { id: 'flower',   label: 'Flower',  color: '#EC7063', color2: '#F9E79F' },
  { id: 'beanie',   label: 'Beanie',  color: '#8E44AD', color2: '#F5B041' },
];

/** Scarf / neck accessories */
const SCARVES = [
  { id: 'none',    label: 'None' },
  { id: 'stripe',  label: 'Stripe',  color: '#E74C3C', color2: '#FDFEFE' },
  { id: 'blue',    label: 'Blue',    color: '#3498DB', color2: '#AED6F1' },
  { id: 'green',   label: 'Green',   color: '#27AE60', color2: '#ABEBC6' },
  { id: 'stars',   label: 'Stars',   color: '#8E44AD', color2: '#F4D03F' },
  { id: 'bowtie',  label: 'Bowtie',  color: '#E67E22', color2: '#FDEBD0' },
];

/** Face extras */
const GLASSES = [
  { id: 'none',    label: 'None' },
  { id: 'round',   label: 'Round',   color: '#2C3E50' },
  { id: 'star',    label: 'Star',    color: '#F4D03F' },
  { id: 'heart',   label: 'Heart',   color: '#E91E63' },
  { id: 'shades',  label: 'Shades',  color: '#1C2833' },
];

/** Spot / pattern overlays */
const SPOTS = [
  { id: 'none',    label: 'None' },
  { id: 'dots',    label: 'Dots',    color: 'rgba(0,0,0,0.18)' },
  { id: 'stripes', label: 'Stripes', color: 'rgba(0,0,0,0.14)' },
  { id: 'hearts',  label: 'Hearts',  color: '#F1948A' },
  { id: 'stars',   label: 'Stars',   color: '#F9E79F' },
];

const CATEGORIES = [
  { id: 'body',   label: 'Color',  items: BODY_COLORS },
  { id: 'hat',    label: 'Hats',   items: HATS },
  { id: 'scarf',  label: 'Scarves', items: SCARVES },
  { id: 'glasses', label: 'Glasses', items: GLASSES },
  { id: 'spots',  label: 'Spots',  items: SPOTS },
];

const DEFAULT_OUTFIT = {
  body: 'mint',
  hat: 'none',
  scarf: 'none',
  glasses: 'none',
  spots: 'none',
};
