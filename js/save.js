'use strict';

const defaultSave = () => ({
  muted: false,
  reducedMotion: false,
  mode: 'free',
  outfit: Object.assign({}, DEFAULT_OUTFIT),
  favorites: [],
  dresses: 0,
  showOffs: 0,
});

let save = defaultSave();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { save = defaultSave(); return save; }
    save = Object.assign(defaultSave(), JSON.parse(raw));
    if (!MODE_ORDER.includes(save.mode)) save.mode = 'free';
    if (!save.outfit || typeof save.outfit !== 'object') save.outfit = Object.assign({}, DEFAULT_OUTFIT);
    for (const k of Object.keys(DEFAULT_OUTFIT)) {
      if (!save.outfit[k]) save.outfit[k] = DEFAULT_OUTFIT[k];
    }
    if (!Array.isArray(save.favorites)) save.favorites = [];
    save.favorites = save.favorites.slice(0, MAX_FAVORITES).map(f => {
      const o = Object.assign({}, DEFAULT_OUTFIT, f || {});
      return o;
    });
  } catch { save = defaultSave(); }
  return save;
}

function persistSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* */ }
}

function setMuted(v) { save.muted = !!v; persistSave(); }
function setReducedMotion(v) { save.reducedMotion = !!v; persistSave(); }
function setMode(id) {
  if (MODE_ORDER.includes(id)) { save.mode = id; persistSave(); }
}

function setOutfitPart(cat, id) {
  save.outfit[cat] = id;
  persistSave();
}

function setFullOutfit(outfit) {
  save.outfit = Object.assign({}, DEFAULT_OUTFIT, outfit || {});
  persistSave();
}

function recordDress() {
  save.dresses = (save.dresses | 0) + 1;
  persistSave();
}

function recordShowOff() {
  save.showOffs = (save.showOffs | 0) + 1;
  persistSave();
}

function outfitKey(o) {
  return [o.body, o.hat, o.scarf, o.glasses, o.spots].join('|');
}

function isFavorite(outfit) {
  const k = outfitKey(outfit || save.outfit);
  return save.favorites.some(f => outfitKey(f) === k);
}

function toggleFavorite() {
  const k = outfitKey(save.outfit);
  const idx = save.favorites.findIndex(f => outfitKey(f) === k);
  if (idx >= 0) {
    save.favorites.splice(idx, 1);
    persistSave();
    return false;
  }
  if (save.favorites.length >= MAX_FAVORITES) save.favorites.shift();
  save.favorites.push(Object.assign({}, save.outfit));
  persistSave();
  return true;
}

function loadFavorite(i) {
  const f = save.favorites[i];
  if (!f) return false;
  setFullOutfit(f);
  return true;
}

loadSave();
