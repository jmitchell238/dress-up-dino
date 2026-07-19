'use strict';

/** @type {'menu'|'play'} */
let state = 'menu';

let modeId = 'free';
let categoryIndex = 0;
let bob = 0;
let danceT = 0;
let equipFlash = 0;
let skyPhase = 0;
let sessionDress = 0;
let matchTarget = null;
let matchDone = false;
let matchFlash = 0;

/** Hit regions for play UI (rebuilt each layout) */
let hitButtons = [];
let hitTray = [];
let hitCats = [];

function currentMode() {
  return MODES[modeId] || MODES.free;
}

function findItem(list, id) {
  return list.find(x => x.id === id) || list[0];
}

function bodyOf(outfit) {
  return findItem(BODY_COLORS, outfit.body);
}
function hatOf(outfit) {
  return findItem(HATS, outfit.hat);
}
function scarfOf(outfit) {
  return findItem(SCARVES, outfit.scarf);
}
function glassesOf(outfit) {
  return findItem(GLASSES, outfit.glasses);
}
function spotsOf(outfit) {
  return findItem(SPOTS, outfit.spots);
}

function randomOutfit(keepBody) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)].id;
  return {
    body: keepBody ? save.outfit.body : pick(BODY_COLORS),
    hat: pick(HATS),
    scarf: pick(SCARVES),
    glasses: pick(GLASSES),
    spots: pick(SPOTS),
  };
}

function outfitsEqual(a, b) {
  if (!a || !b) return false;
  return a.body === b.body && a.hat === b.hat && a.scarf === b.scarf &&
    a.glasses === b.glasses && a.spots === b.spots;
}

/** Valid item id for a category? */
function isValidItem(catId, itemId) {
  const cat = CATEGORIES.find(c => c.id === catId);
  if (!cat) return false;
  return cat.items.some(it => it.id === itemId);
}

/** Outfit with only known ids (clamp unknown → defaults). */
function normalizeOutfit(o) {
  const out = Object.assign({}, DEFAULT_OUTFIT);
  if (!o || typeof o !== 'object') return out;
  for (const cat of CATEGORIES) {
    if (o[cat.id] && isValidItem(cat.id, o[cat.id])) out[cat.id] = o[cat.id];
  }
  return out;
}

function enterMenu() {
  state = 'menu';
  clearParticles();
  danceT = 0;
}

function enterPlay(forceMode) {
  state = 'play';
  modeId = forceMode || save.mode || 'free';
  categoryIndex = 0;
  sessionDress = 0;
  danceT = 0;
  equipFlash = 0;
  matchDone = false;
  matchFlash = 0;
  clearParticles();

  if (currentMode().challenge) {
    matchTarget = randomOutfit(false);
    // Start player close but not exact — default body, rest none
    setFullOutfit({
      body: matchTarget.body,
      hat: 'none',
      scarf: 'none',
      glasses: 'none',
      spots: 'none',
    });
  } else {
    matchTarget = null;
  }
  rebuildHits();
}

function rebuildHits() {
  hitButtons = [];
  hitTray = [];
  hitCats = [];
  if (state !== 'play') return;

  // Category tabs
  const catY = 418;
  const catH = 40;
  const catW = (W - 24) / CATEGORIES.length;
  CATEGORIES.forEach((cat, i) => {
    hitCats.push({
      x: 12 + i * catW, y: catY, w: catW - 4, h: catH,
      index: i,
    });
  });

  // Tray items
  const cat = CATEGORIES[categoryIndex];
  const items = cat.items;
  const trayY = 470;
  const trayH = 88;
  const n = items.length;
  const cell = Math.min(64, (W - 28) / n);
  const total = n * cell;
  const x0 = (W - total) / 2;
  items.forEach((item, i) => {
    hitTray.push({
      x: x0 + i * cell + 2,
      y: trayY,
      w: cell - 4,
      h: trayH,
      item,
      catId: cat.id,
    });
  });

  // Action row
  const btnY = 580;
  const btnH = 48;
  const gap = 8;
  const labels = [
    { id: 'surprise', label: '🎲 Surprise' },
    { id: 'favorite', label: isFavorite(save.outfit) ? '★ Saved' : '☆ Save' },
    { id: 'showoff', label: '🎉 Show off' },
  ];
  const bw = (W - 24 - gap * (labels.length - 1)) / labels.length;
  labels.forEach((b, i) => {
    hitButtons.push({
      x: 12 + i * (bw + gap),
      y: btnY,
      w: bw,
      h: btnH,
      id: b.id,
      label: b.label,
    });
  });

  // Favorites row (if any)
  if (save.favorites.length) {
    const fy = 640;
    const fh = 36;
    const fw = Math.min(40, (W - 40) / Math.max(1, save.favorites.length));
    save.favorites.forEach((_, i) => {
      hitButtons.push({
        x: 20 + i * (fw + 4),
        y: fy,
        w: fw,
        h: fh,
        id: 'fav-' + i,
        label: String(i + 1),
        favIndex: i,
      });
    });
  }
}

/**
 * Pure equip resolution (no SFX/particles). Returns next item id for the category.
 * Re-tapping the same non-body item unequips to 'none'.
 */
function resolveEquip(catId, itemId, currentOutfit) {
  if (!isValidItem(catId, itemId)) return currentOutfit[catId];
  const cur = currentOutfit[catId];
  if (catId !== 'body' && cur === itemId && itemId !== 'none') return 'none';
  return itemId;
}

function equip(catId, itemId) {
  const next = resolveEquip(catId, itemId, save.outfit);
  if (next === save.outfit[catId] && !(catId !== 'body' && itemId === save.outfit[catId])) {
    // invalid no-op
    if (!isValidItem(catId, itemId)) return;
  }
  const unequipped = next === 'none' && save.outfit[catId] !== 'none';
  if (unequipped) sfxUnequip();
  else sfxEquip();
  setOutfitPart(catId, next);
  recordDress();
  sessionDress++;
  equipFlash = 0.35;
  spawnBurst(W / 2, 260, bodyOf(save.outfit).fill, 10);
  spawnPraise(W / 2, 160);
  rebuildHits();
  checkMatch();
}

function checkMatch() {
  if (!currentMode().challenge || !matchTarget || matchDone) return;
  if (outfitsEqual(save.outfit, matchTarget)) {
    matchDone = true;
    matchFlash = 1.2;
    sfxMatch();
    spawnConfetti(W / 2, 200, 36);
    spawnPraise(W / 2, 140, 'Perfect match!');
    recordShowOff();
  }
}

function doSurprise() {
  sfxShuffle();
  const o = randomOutfit(false);
  setFullOutfit(o);
  recordDress();
  sessionDress++;
  equipFlash = 0.4;
  spawnBurst(W / 2, 260, bodyOf(o).fill, 16);
  spawnPraise(W / 2, 150, 'Surprise!');
  rebuildHits();
  checkMatch();
}

function doFavorite() {
  const added = toggleFavorite();
  if (added) {
    sfxFavorite();
    spawnBurst(W / 2, 200, '#F4D03F', 18);
    spawnPraise(W / 2, 150, 'Saved!');
  } else {
    sfxUnequip();
    spawnPraise(W / 2, 150, 'Unsaved');
  }
  rebuildHits();
}

function doShowOff() {
  sfxShowOff();
  danceT = save.reducedMotion ? 0.8 : 2.2;
  recordShowOff();
  spawnConfetti(W / 2, 180, 40);
  spawnConfetti(W / 2 - 60, 220, 16);
  spawnConfetti(W / 2 + 60, 220, 16);
  spawnPraise(W / 2, 120, 'Roar!');
  spawnPraise(W / 2, 160, PRAISE[Math.floor(Math.random() * PRAISE.length)]);
}

function doNextMatch() {
  matchTarget = randomOutfit(false);
  matchDone = false;
  matchFlash = 0;
  setFullOutfit({
    body: matchTarget.body,
    hat: 'none',
    scarf: 'none',
    glasses: 'none',
    spots: 'none',
  });
  sfxShuffle();
  spawnPraise(W / 2, 130, 'New look!');
  rebuildHits();
}

function handleTap(x, y) {
  if (state !== 'play') return;

  // Category tabs
  for (const h of hitCats) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      categoryIndex = h.index;
      sfxClick();
      rebuildHits();
      return;
    }
  }

  // Tray
  for (const h of hitTray) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      equip(h.catId, h.item.id);
      return;
    }
  }

  // Buttons
  for (const h of hitButtons) {
    if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) {
      if (h.id === 'surprise') doSurprise();
      else if (h.id === 'favorite') doFavorite();
      else if (h.id === 'showoff') doShowOff();
      else if (h.id && h.id.startsWith('fav-')) {
        if (loadFavorite(h.favIndex)) {
          sfxEquip();
          equipFlash = 0.3;
          spawnBurst(W / 2, 260, bodyOf(save.outfit).fill, 12);
          spawnPraise(W / 2, 150, 'Favorite!');
          rebuildHits();
          checkMatch();
        }
      }
      return;
    }
  }

  // Tap dino for little roar bounce
  if (y > 80 && y < 400 && x > 60 && x < W - 60) {
    sfxRoar();
    equipFlash = 0.25;
    spawnBurst(W / 2, 260, bodyOf(save.outfit).fill, 8);
    if (currentMode().challenge && matchDone) doNextMatch();
  }
}

function updatePlay(dt) {
  bob += dt * 2.2;
  skyPhase += dt;
  if (danceT > 0) danceT = Math.max(0, danceT - dt);
  if (equipFlash > 0) equipFlash = Math.max(0, equipFlash - dt);
  if (matchFlash > 0) matchFlash = Math.max(0, matchFlash - dt);
  updateParticles(dt);
}

// ---- Drawing ----

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawStageBg(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#F8BBD0');
  g.addColorStop(0.35, '#E1BEE7');
  g.addColorStop(0.55, '#BBDEFB');
  g.addColorStop(1, '#C8E6C9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Soft stage lights
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(W / 2, 90, 120, 40, 0, 0, Math.PI * 2);
  ctx.fill();

  // Curtains
  ctx.fillStyle = '#E57373';
  roundRect(ctx, -10, 0, 48, 380, 12);
  ctx.fill();
  roundRect(ctx, W - 38, 0, 48, 380, 12);
  ctx.fill();
  ctx.fillStyle = '#EF9A9A';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(14, 40 + i * 80, 16, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(W - 14, 40 + i * 80, 16, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stage floor
  ctx.fillStyle = '#8D6E63';
  ctx.beginPath();
  ctx.moveTo(20, 400);
  ctx.lineTo(W - 20, 400);
  ctx.lineTo(W - 50, 360);
  ctx.lineTo(50, 360);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#A1887F';
  ctx.beginPath();
  ctx.moveTo(50, 360);
  ctx.lineTo(W - 50, 360);
  ctx.lineTo(W - 70, 340);
  ctx.lineTo(70, 340);
  ctx.closePath();
  ctx.fill();

  // Spotlight oval
  ctx.fillStyle = 'rgba(255, 249, 196, 0.35)';
  ctx.beginPath();
  ctx.ellipse(W / 2, 355, 110, 28, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Dino local-space anatomy (scale=1). Accessories MUST anchor to these —
 * not free-floating magic numbers. Keep in sync with drawDino paths.
 *
 *   crown  ≈ top of head (under crest tips)
 *   eyeL/R = white of each eye (center)
 *   neck   = chin / body junction (scarf sits here)
 *   body   = torso center
 */
const DINO_RIG = {
  head:  { x: 8,  y: -48 },
  crown: { x: 8,  y: -86 },
  eyeL:  { x: -4, y: -58 },
  eyeR:  { x: 22, y: -56 },
  neck:  { x: 6,  y: -18 },
  body:  { x: 0,  y: 10 },
  // How far accessories may sit from their anchors (for unit tests)
  maxEyeLensOffset: 2,
  maxNeckBandOffset: 6,
  maxCrownOffset: 8,
};

/** Accessory anchor in dino space (for tests + drawers). */
function accessoryAnchor(kind) {
  if (kind === 'glasses') {
    return {
      x: (DINO_RIG.eyeL.x + DINO_RIG.eyeR.x) / 2,
      y: (DINO_RIG.eyeL.y + DINO_RIG.eyeR.y) / 2,
      eyeL: DINO_RIG.eyeL,
      eyeR: DINO_RIG.eyeR,
    };
  }
  if (kind === 'scarf') return { x: DINO_RIG.neck.x, y: DINO_RIG.neck.y };
  if (kind === 'hat') return { x: DINO_RIG.crown.x, y: DINO_RIG.crown.y };
  return { x: 0, y: 0 };
}

function drawSpotsPattern(ctx, spots, scale) {
  if (!spots || spots.id === 'none') return;
  ctx.save();
  // Spots live on the torso around body center
  ctx.translate(DINO_RIG.body.x * scale, DINO_RIG.body.y * scale);
  if (spots.id === 'dots') {
    ctx.fillStyle = spots.color;
    for (const [px, py, r] of [[-22, -18, 7], [20, -8, 6], [-8, 16, 5], [16, 22, 5], [-26, 28, 4]]) {
      ctx.beginPath();
      ctx.arc(px * scale, py * scale, r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (spots.id === 'stripes') {
    ctx.strokeStyle = spots.color;
    ctx.lineWidth = 5 * scale;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo((-36 + i * 3) * scale, (-30 + i * 14) * scale);
      ctx.lineTo((36 + i * 3) * scale, (-10 + i * 14) * scale);
      ctx.stroke();
    }
  } else if (spots.id === 'hearts') {
    ctx.fillStyle = spots.color;
    for (const [px, py, s] of [[-20, -12, 0.5], [18, 6, 0.42], [-6, 22, 0.38]]) {
      ctx.save();
      ctx.translate(px * scale, py * scale);
      ctx.scale(s * scale, s * scale);
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.bezierCurveTo(-12, 0, -10, -12, 0, -4);
      ctx.bezierCurveTo(10, -12, 12, 0, 0, 8);
      ctx.fill();
      ctx.restore();
    }
  } else if (spots.id === 'stars') {
    ctx.fillStyle = spots.color;
    for (const [px, py, s] of [[-18, -14, 7], [16, 4, 6], [-4, 20, 5]]) {
      ctx.save();
      ctx.translate(px * scale, py * scale);
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        const a2 = a + Math.PI / 5;
        const r = s * scale;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a2) * r * 0.4, Math.sin(a2) * r * 0.4);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * @param {{ origin?: boolean }} opts  origin=true → draw centered at 0,0 (tray icons)
 */
function drawHat(ctx, hat, scale, opts = {}) {
  if (!hat || hat.id === 'none') return;
  const s = scale;
  ctx.save();
  if (!opts.origin) {
    const a = accessoryAnchor('hat');
    ctx.translate(a.x * s, a.y * s);
  }

  if (hat.id === 'party') {
    // Cone sits on crown; base just above forehead
    ctx.fillStyle = hat.color;
    ctx.beginPath();
    ctx.moveTo(0, -36 * s);
    ctx.lineTo(26 * s, 10 * s);
    ctx.lineTo(-26 * s, 10 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hat.color2;
    ctx.lineWidth = 2 * s;
    ctx.stroke();
    // Pom-pom
    ctx.fillStyle = hat.color2;
    ctx.beginPath();
    ctx.arc(0, -38 * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    // Stripe
    ctx.strokeStyle = hat.color2;
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(-8 * s, -6 * s);
    ctx.lineTo(10 * s, -18 * s);
    ctx.stroke();
  } else if (hat.id === 'cap') {
    ctx.fillStyle = hat.color;
    // Crown dome
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 30 * s, 20 * s, 0, Math.PI, 0);
    ctx.fill();
    // Brim band
    roundRect(ctx, -32 * s, 0, 64 * s, 14 * s, 6 * s);
    ctx.fill();
    // Bill
    ctx.fillStyle = hat.color2;
    roundRect(ctx, 6 * s, 4 * s, 34 * s, 11 * s, 5 * s);
    ctx.fill();
  } else if (hat.id === 'crown') {
    ctx.fillStyle = hat.color;
    ctx.beginPath();
    ctx.moveTo(-30 * s, 12 * s);
    ctx.lineTo(-30 * s, -6 * s);
    ctx.lineTo(-16 * s, 4 * s);
    ctx.lineTo(0, -20 * s);
    ctx.lineTo(16 * s, 4 * s);
    ctx.lineTo(30 * s, -6 * s);
    ctx.lineTo(30 * s, 12 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hat.color2;
    for (const px of [-22, 0, 22]) {
      ctx.beginPath();
      ctx.arc(px * s, -2 * s, 3.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (hat.id === 'bow') {
    // Big bow on top of head
    ctx.fillStyle = hat.color;
    ctx.beginPath();
    ctx.ellipse(-18 * s, 0, 18 * s, 14 * s, -0.2, 0, Math.PI * 2);
    ctx.ellipse(18 * s, 0, 18 * s, 14 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hat.color2;
    ctx.beginPath();
    ctx.arc(0, 0, 8 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat.id === 'flower') {
    ctx.fillStyle = hat.color;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI * 2 / 6;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 14 * s, Math.sin(a) * 14 * s, 11 * s, 8 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = hat.color2;
    ctx.beginPath();
    ctx.arc(0, 0, 8 * s, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat.id === 'beanie') {
    ctx.fillStyle = hat.color;
    ctx.beginPath();
    ctx.ellipse(0, 2 * s, 34 * s, 26 * s, 0, Math.PI, 0);
    ctx.fill();
    roundRect(ctx, -36 * s, -2 * s, 72 * s, 16 * s, 7 * s);
    ctx.fill();
    // Pom
    ctx.fillStyle = hat.color2;
    ctx.beginPath();
    ctx.arc(0, -26 * s, 9 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Scarf / bowtie — MUST sit on the neck (under chin), not the belly.
 */
function drawScarf(ctx, scarf, scale, opts = {}) {
  if (!scarf || scarf.id === 'none') return;
  const s = scale;
  ctx.save();
  if (!opts.origin) {
    const a = accessoryAnchor('scarf');
    ctx.translate(a.x * s, a.y * s);
  }

  if (scarf.id === 'bowtie') {
    // Centered on neck/chin
    ctx.fillStyle = scarf.color;
    ctx.beginPath();
    ctx.moveTo(-3 * s, 0);
    ctx.lineTo(-26 * s, -14 * s);
    ctx.lineTo(-26 * s, 14 * s);
    ctx.closePath();
    ctx.moveTo(3 * s, 0);
    ctx.lineTo(26 * s, -14 * s);
    ctx.lineTo(26 * s, 14 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = scarf.color2;
    ctx.beginPath();
    ctx.arc(0, 0, 7 * s, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Soft neck wrap: thick band under chin + two hanging ends down the chest
    ctx.fillStyle = scarf.color;
    // Main loop around neck (narrower than body so it reads as a collar)
    roundRect(ctx, -30 * s, -10 * s, 60 * s, 16 * s, 9 * s);
    ctx.fill();
    // Knot
    ctx.beginPath();
    ctx.ellipse(4 * s, 4 * s, 10 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    // Hanging tails (down the chest, not around the waist)
    roundRect(ctx, -4 * s, 8 * s, 14 * s, 34 * s, 6 * s);
    ctx.fill();
    roundRect(ctx, 12 * s, 10 * s, 12 * s, 28 * s, 6 * s);
    ctx.fill();

    if (scarf.id === 'stripe' || scarf.id === 'stars') {
      ctx.fillStyle = scarf.color2;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect((-24 + i * 18) * s, -6 * s, 7 * s, 8 * s);
      }
      if (scarf.id === 'stars') {
        ctx.beginPath();
        ctx.arc(3 * s, 22 * s, 4 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = scarf.color2;
      ctx.lineWidth = 2 * s;
      roundRect(ctx, -28 * s, -8 * s, 56 * s, 12 * s, 7 * s);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Glasses — lenses centered on each eye.
 */
function drawGlasses(ctx, glasses, scale, opts = {}) {
  if (!glasses || glasses.id === 'none') return;
  const s = scale;
  ctx.save();

  let eyeL = DINO_RIG.eyeL;
  let eyeR = DINO_RIG.eyeR;
  if (opts.origin) {
    // Tray: place a compact pair around local origin
    eyeL = { x: -14, y: 0 };
    eyeR = { x: 14, y: 0 };
  }

  const lx = eyeL.x * s;
  const ly = eyeL.y * s;
  const rx = eyeR.x * s;
  const ry = eyeR.y * s;
  const lensR = 15 * s;

  ctx.strokeStyle = glasses.color;
  ctx.fillStyle = glasses.color;
  ctx.lineWidth = 3.2 * s;
  ctx.lineCap = 'round';

  if (glasses.id === 'round' || glasses.id === 'shades') {
    // Left lens
    ctx.beginPath();
    ctx.arc(lx, ly, lensR, 0, Math.PI * 2);
    // Right lens
    ctx.arc(rx, ry, lensR, 0, Math.PI * 2);
    if (glasses.id === 'shades') {
      ctx.fillStyle = 'rgba(20,20,30,0.72)';
      ctx.fill();
      ctx.strokeStyle = glasses.color;
      ctx.stroke();
    } else {
      ctx.stroke();
      // Clear glass shine
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.arc(lx - 4 * s, ly - 4 * s, 5 * s, -0.8, 0.4);
      ctx.arc(rx - 4 * s, ry - 4 * s, 5 * s, -0.8, 0.4);
      ctx.stroke();
      ctx.strokeStyle = glasses.color;
      ctx.lineWidth = 3.2 * s;
    }
    // Bridge between eyes
    ctx.beginPath();
    ctx.moveTo(lx + lensR * 0.85, ly);
    ctx.lineTo(rx - lensR * 0.85, ry);
    ctx.stroke();
    // Temples
    ctx.beginPath();
    ctx.moveTo(lx - lensR * 0.9, ly - 2 * s);
    ctx.lineTo(lx - lensR * 1.5, ly - 6 * s);
    ctx.moveTo(rx + lensR * 0.9, ry - 2 * s);
    ctx.lineTo(rx + lensR * 1.5, ry - 6 * s);
    ctx.stroke();
  } else if (glasses.id === 'star') {
    for (const [ex, ey] of [[lx, ly], [rx, ry]]) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        const a2 = a + Math.PI / 5;
        const r = 15 * s;
        if (i === 0) ctx.moveTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
        else ctx.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
        ctx.lineTo(ex + Math.cos(a2) * r * 0.42, ey + Math.sin(a2) * r * 0.42);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(lx + 12 * s, ly);
    ctx.lineTo(rx - 12 * s, ry);
    ctx.stroke();
  } else if (glasses.id === 'heart') {
    ctx.fillStyle = glasses.color;
    for (const [ex, ey] of [[lx, ly], [rx, ry]]) {
      ctx.save();
      ctx.translate(ex, ey);
      ctx.scale(s, s);
      ctx.beginPath();
      ctx.moveTo(0, 11);
      ctx.bezierCurveTo(-15, 0, -13, -14, 0, -5);
      ctx.bezierCurveTo(13, -14, 15, 0, 0, 11);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Draw the dino character with an outfit.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} outfit
 * @param {number} cx
 * @param {number} cy
 * @param {number} scale
 * @param {{ ghost?: boolean, dance?: number, flash?: number }} opts
 */
function drawDino(ctx, outfit, cx, cy, scale, opts = {}) {
  const body = bodyOf(outfit);
  const hat = hatOf(outfit);
  const scarf = scarfOf(outfit);
  const glasses = glassesOf(outfit);
  const spots = spotsOf(outfit);
  const dance = opts.dance || 0;
  const flash = opts.flash || 0;
  const s = scale;

  ctx.save();
  ctx.translate(cx, cy);
  if (opts.ghost) ctx.globalAlpha = 0.45;

  // Dance / bob
  const sway = dance > 0 ? Math.sin(dance * 14) * 8 * s : Math.sin(bob) * 3 * s;
  const hop = dance > 0 ? Math.abs(Math.sin(dance * 12)) * 10 * s : Math.sin(bob * 1.3) * 2 * s;
  ctx.translate(sway, -hop);
  if (dance > 0) ctx.rotate(Math.sin(dance * 10) * 0.08);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, 78 * s, 55 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.fillStyle = body.fill;
  ctx.strokeStyle = body.stroke;
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(-40 * s, 20 * s);
  ctx.quadraticCurveTo(-90 * s, 10 * s, -95 * s, -20 * s);
  ctx.quadraticCurveTo(-70 * s, 5 * s, -35 * s, 30 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Legs
  ctx.fillStyle = body.fill;
  roundRect(ctx, -32 * s, 48 * s, 22 * s, 32 * s, 8 * s);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 12 * s, 48 * s, 22 * s, 32 * s, 8 * s);
  ctx.fill();
  ctx.stroke();
  // Feet
  ctx.fillStyle = body.stroke;
  roundRect(ctx, -36 * s, 72 * s, 28 * s, 12 * s, 5 * s);
  ctx.fill();
  roundRect(ctx, 8 * s, 72 * s, 28 * s, 12 * s, 5 * s);
  ctx.fill();

  // Body (torso) — center DINO_RIG.body
  ctx.fillStyle = body.fill;
  ctx.beginPath();
  ctx.ellipse(DINO_RIG.body.x * s, DINO_RIG.body.y * s, 52 * s, 58 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belly
  ctx.fillStyle = body.belly;
  ctx.beginPath();
  ctx.ellipse(4 * s, 18 * s, 28 * s, 34 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  drawSpotsPattern(ctx, spots, scale);

  // Arms
  ctx.fillStyle = body.fill;
  ctx.beginPath();
  ctx.ellipse(-48 * s, 5 * s, 14 * s, 22 * s, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(48 * s, 5 * s, 14 * s, 22 * s, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Scarf under the chin (drawn before head so the chin overlaps the top of the band)
  drawScarf(ctx, scarf, scale);

  // Head — center DINO_RIG.head
  ctx.fillStyle = body.fill;
  ctx.beginPath();
  ctx.ellipse(DINO_RIG.head.x * s, DINO_RIG.head.y * s, 44 * s, 40 * s, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Snout
  ctx.fillStyle = body.belly;
  ctx.beginPath();
  ctx.ellipse(38 * s, -38 * s, 22 * s, 16 * s, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = body.stroke;
  ctx.stroke();

  // Nostrils
  ctx.fillStyle = body.stroke;
  ctx.beginPath();
  ctx.arc(42 * s, -42 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.arc(50 * s, -40 * s, 2.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Eyes — MUST match DINO_RIG.eyeL / eyeR
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(DINO_RIG.eyeL.x * s, DINO_RIG.eyeL.y * s, 12 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(DINO_RIG.eyeR.x * s, DINO_RIG.eyeR.y * s, 12 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2C3E50';
  ctx.beginPath();
  ctx.arc((DINO_RIG.eyeL.x + 3) * s, (DINO_RIG.eyeL.y + 2) * s, 6 * s, 0, Math.PI * 2);
  ctx.arc((DINO_RIG.eyeR.x + 3) * s, (DINO_RIG.eyeR.y + 2) * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc((DINO_RIG.eyeL.x + 5) * s, DINO_RIG.eyeL.y * s, 2.2 * s, 0, Math.PI * 2);
  ctx.arc((DINO_RIG.eyeR.x + 5) * s, DINO_RIG.eyeR.y * s, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = body.stroke;
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.arc(28 * s, -32 * s, 12 * s, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Blush
  ctx.fillStyle = 'rgba(241, 148, 138, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-16 * s, -40 * s, 8 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(40 * s, -28 * s, 7 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crest / spikes (above crown)
  ctx.fillStyle = body.stroke;
  for (const [sx, sy, sr] of [[-10, -82, 8], [6, -88, 9], [24, -82, 7]]) {
    ctx.beginPath();
    ctx.moveTo((sx - sr) * s, (sy + 10) * s);
    ctx.lineTo(sx * s, (sy - sr) * s);
    ctx.lineTo((sx + sr) * s, (sy + 10) * s);
    ctx.closePath();
    ctx.fill();
  }

  // Glasses on eyes, hat on crown (after head so they sit on top)
  drawGlasses(ctx, glasses, scale);
  drawHat(ctx, hat, scale);

  if (flash > 0) {
    ctx.globalAlpha = flash * 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 60 * s, 80 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawTrayThumb(ctx, catId, item, x, y, w, h, selected) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.fillStyle = selected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.72)';
  ctx.fill();
  ctx.strokeStyle = selected ? '#7E57C2' : 'rgba(0,0,0,0.12)';
  ctx.lineWidth = selected ? 3 : 1.5;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();

  const cx = x + w / 2;
  const cy = y + h / 2 - 4;

  if (item.id === 'none') {
    ctx.strokeStyle = '#90A4AE';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 8);
    ctx.lineTo(cx + 12, cy + 8);
    ctx.moveTo(cx + 12, cy - 8);
    ctx.lineTo(cx - 12, cy + 8);
    ctx.stroke();
  } else if (catId === 'body') {
    ctx.fillStyle = item.fill;
    ctx.strokeStyle = item.stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (catId === 'hat') {
    ctx.translate(cx, cy + 4);
    drawHat(ctx, item, 0.55, { origin: true });
  } else if (catId === 'scarf') {
    ctx.translate(cx, cy - 2);
    drawScarf(ctx, item, 0.55, { origin: true });
  } else if (catId === 'glasses') {
    ctx.translate(cx, cy);
    drawGlasses(ctx, item, 0.7, { origin: true });
  } else if (catId === 'spots') {
    ctx.translate(cx, cy);
    ctx.fillStyle = '#7DCEA0';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    drawSpotsPattern(ctx, item, 0.55);
  }

  ctx.restore();
  ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#5D4037';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(item.label, cx, y + h - 4);
}

function drawPlayUi(ctx) {
  // HUD
  const m = currentMode();
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  roundRect(ctx, 56, 10, W - 68, 48, 14);
  ctx.fill();
  ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(m.name, W / 2 + 10, 26);
  ctx.font = '12px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  if (m.challenge) {
    ctx.fillText(matchDone ? 'Tap dino for next look!' : 'Match the ghost look', W / 2 + 10, 44);
  } else {
    ctx.fillText('Tap clothes · ' + sessionDress + ' looks', W / 2 + 10, 44);
  }

  // Category tabs
  for (const h of hitCats) {
    const cat = CATEGORIES[h.index];
    const active = h.index === categoryIndex;
    ctx.fillStyle = active ? 'rgba(126, 87, 194, 0.95)' : 'rgba(255,255,255,0.75)';
    roundRect(ctx, h.x, h.y, h.w, h.h, 10);
    ctx.fill();
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = active ? '#fff' : '#5D4037';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat.label, h.x + h.w / 2, h.y + h.h / 2);
  }

  // Tray
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  roundRect(ctx, 8, 462, W - 16, 104, 16);
  ctx.fill();

  for (const h of hitTray) {
    const selected = save.outfit[h.catId] === h.item.id;
    drawTrayThumb(ctx, h.catId, h.item, h.x, h.y, h.w, h.h, selected);
  }

  // Action buttons
  for (const h of hitButtons) {
    if (h.id && h.id.startsWith('fav-')) {
      ctx.fillStyle = 'rgba(255, 236, 179, 0.95)';
      roundRect(ctx, h.x, h.y, h.w, h.h, 10);
      ctx.fill();
      // mini dino color
      const fav = save.favorites[h.favIndex];
      if (fav) {
        ctx.fillStyle = bodyOf(fav).fill;
        ctx.beginPath();
        ctx.arc(h.x + h.w / 2, h.y + h.h / 2, Math.min(h.w, h.h) * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      continue;
    }
    let bg = 'rgba(255,255,255,0.88)';
    if (h.id === 'showoff') bg = 'linear';
    if (h.id === 'showoff') {
      const g = ctx.createLinearGradient(h.x, h.y, h.x + h.w, h.y + h.h);
      g.addColorStop(0, '#F48FB1');
      g.addColorStop(1, '#CE93D8');
      ctx.fillStyle = g;
    } else if (h.id === 'favorite') {
      ctx.fillStyle = isFavorite(save.outfit) ? 'rgba(255, 213, 79, 0.95)' : bg;
    } else {
      ctx.fillStyle = bg;
    }
    roundRect(ctx, h.x, h.y, h.w, h.h, 12);
    ctx.fill();
    ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#4A148C';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(h.label, h.x + h.w / 2, h.y + h.h / 2);
  }

  if (save.favorites.length) {
    ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(80,40,80,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText('Favorites', 12, 634);
  }
}

function drawPlay(ctx) {
  drawStageBg(ctx);

  // Match-me ghost target (small, top-right)
  if (currentMode().challenge && matchTarget) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, W - 118, 66, 100, 110, 14);
    ctx.fill();
    ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#6A1B9A';
    ctx.textAlign = 'center';
    ctx.fillText('Goal', W - 68, 78);
    drawDino(ctx, matchTarget, W - 68, 130, 0.42, { ghost: !matchDone });
    if (matchDone) {
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#2E7D32';
      ctx.fillText('✓', W - 68, 168);
    }
  }

  drawDino(ctx, save.outfit, W / 2, 250, 1.05, {
    dance: danceT,
    flash: equipFlash,
  });

  drawPlayUi(ctx);
  drawParticles(ctx);

  if (matchFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (0.18 * Math.min(1, matchFlash)) + ')';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMenuBackdrop(ctx) {
  drawStageBg(ctx);
  drawDino(ctx, save.outfit || DEFAULT_OUTFIT, W / 2, 280, 1.15, {
    dance: 0.01,
  });
  // soft dim for menu card
  ctx.fillStyle = 'rgba(60, 30, 70, 0.38)';
  ctx.fillRect(0, 0, W, H);
}
