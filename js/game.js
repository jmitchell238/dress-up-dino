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

function equip(catId, itemId) {
  const cur = save.outfit[catId];
  let next = itemId;
  // Toggle off for non-body categories when re-tapping same
  if (catId !== 'body' && cur === itemId && itemId !== 'none') {
    next = 'none';
    sfxUnequip();
  } else {
    sfxEquip();
  }
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

function drawSpotsPattern(ctx, spots, scale) {
  if (!spots || spots.id === 'none') return;
  ctx.save();
  if (spots.id === 'dots') {
    ctx.fillStyle = spots.color;
    for (const [px, py, r] of [[-28, -10, 7], [24, 5, 6], [-10, 30, 5], [18, -35, 5], [-30, 40, 4]]) {
      ctx.beginPath();
      ctx.arc(px * scale, py * scale, r * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (spots.id === 'stripes') {
    ctx.strokeStyle = spots.color;
    ctx.lineWidth = 5 * scale;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo((-40 + i * 4) * scale, (-50 + i * 18) * scale);
      ctx.lineTo((40 + i * 4) * scale, (-20 + i * 18) * scale);
      ctx.stroke();
    }
  } else if (spots.id === 'hearts') {
    ctx.fillStyle = spots.color;
    for (const [px, py, s] of [[-26, -8, 0.55], [22, 12, 0.45], [-8, 36, 0.4]]) {
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
    for (const [px, py, s] of [[-24, -12, 7], [20, 8, 6], [-6, 34, 5]]) {
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

function drawHat(ctx, hat, scale) {
  if (!hat || hat.id === 'none') return;
  ctx.save();
  ctx.translate(8 * scale, -78 * scale);

  if (hat.id === 'party') {
    ctx.fillStyle = hat.color;
    ctx.beginPath();
    ctx.moveTo(0, -42 * scale);
    ctx.lineTo(28 * scale, 8 * scale);
    ctx.lineTo(-28 * scale, 8 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hat.color2;
    ctx.beginPath();
    ctx.arc(0, -44 * scale, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Pom stripes
    ctx.strokeStyle = hat.color2;
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.moveTo(-10 * scale, -10 * scale);
    ctx.lineTo(12 * scale, -22 * scale);
    ctx.stroke();
  } else if (hat.id === 'cap') {
    ctx.fillStyle = hat.color;
    roundRect(ctx, -30 * scale, -18 * scale, 60 * scale, 22 * scale, 8 * scale);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -16 * scale, 28 * scale, 18 * scale, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = hat.color2;
    roundRect(ctx, 8 * scale, -8 * scale, 32 * scale, 10 * scale, 4 * scale);
    ctx.fill();
  } else if (hat.id === 'crown') {
    ctx.fillStyle = hat.color;
    ctx.beginPath();
    ctx.moveTo(-28 * scale, 6 * scale);
    ctx.lineTo(-28 * scale, -10 * scale);
    ctx.lineTo(-14 * scale, 0);
    ctx.lineTo(0, -22 * scale);
    ctx.lineTo(14 * scale, 0);
    ctx.lineTo(28 * scale, -10 * scale);
    ctx.lineTo(28 * scale, 6 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hat.color2;
    for (const px of [-20, 0, 20]) {
      ctx.beginPath();
      ctx.arc(px * scale, -4 * scale, 3.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (hat.id === 'bow') {
    ctx.fillStyle = hat.color;
    ctx.beginPath();
    ctx.ellipse(-18 * scale, -8 * scale, 16 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(18 * scale, -8 * scale, 16 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hat.color2;
    ctx.beginPath();
    ctx.arc(0, -8 * scale, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat.id === 'flower') {
    ctx.fillStyle = hat.color;
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 12 * scale, -10 * scale + Math.sin(a) * 12 * scale, 10 * scale, 8 * scale, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = hat.color2;
    ctx.beginPath();
    ctx.arc(0, -10 * scale, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else if (hat.id === 'beanie') {
    ctx.fillStyle = hat.color;
    ctx.beginPath();
    ctx.ellipse(0, -6 * scale, 32 * scale, 22 * scale, 0, Math.PI, 0);
    ctx.fill();
    roundRect(ctx, -34 * scale, -10 * scale, 68 * scale, 16 * scale, 6 * scale);
    ctx.fill();
    ctx.fillStyle = hat.color2;
    ctx.beginPath();
    ctx.arc(0, -28 * scale, 8 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawScarf(ctx, scarf, scale) {
  if (!scarf || scarf.id === 'none') return;
  ctx.save();
  ctx.translate(0, 28 * scale);

  if (scarf.id === 'bowtie') {
    ctx.fillStyle = scarf.color;
    ctx.beginPath();
    ctx.moveTo(-4 * scale, 0);
    ctx.lineTo(-28 * scale, -12 * scale);
    ctx.lineTo(-28 * scale, 12 * scale);
    ctx.closePath();
    ctx.moveTo(4 * scale, 0);
    ctx.lineTo(28 * scale, -12 * scale);
    ctx.lineTo(28 * scale, 12 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = scarf.color2;
    ctx.beginPath();
    ctx.arc(0, 0, 7 * scale, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Loop scarf
    ctx.fillStyle = scarf.color;
    roundRect(ctx, -36 * scale, -8 * scale, 72 * scale, 18 * scale, 8 * scale);
    ctx.fill();
    // Hanging ends
    roundRect(ctx, 10 * scale, 6 * scale, 16 * scale, 36 * scale, 6 * scale);
    ctx.fill();
    roundRect(ctx, 28 * scale, 4 * scale, 14 * scale, 30 * scale, 6 * scale);
    ctx.fill();
    if (scarf.id === 'stripe' || scarf.id === 'stars') {
      ctx.fillStyle = scarf.color2;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect((-28 + i * 22) * scale, -4 * scale, 8 * scale, 10 * scale);
      }
      if (scarf.id === 'stars') {
        ctx.beginPath();
        ctx.arc(18 * scale, 20 * scale, 4 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = scarf.color2;
      ctx.lineWidth = 2 * scale;
      roundRect(ctx, -34 * scale, -6 * scale, 68 * scale, 14 * scale, 6 * scale);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawGlasses(ctx, glasses, scale) {
  if (!glasses || glasses.id === 'none') return;
  ctx.save();
  ctx.translate(6 * scale, -28 * scale);
  ctx.strokeStyle = glasses.color;
  ctx.fillStyle = glasses.color;
  ctx.lineWidth = 3.5 * scale;

  if (glasses.id === 'round' || glasses.id === 'shades') {
    ctx.beginPath();
    ctx.arc(-16 * scale, 0, 14 * scale, 0, Math.PI * 2);
    ctx.arc(16 * scale, 0, 14 * scale, 0, Math.PI * 2);
    if (glasses.id === 'shades') {
      ctx.fillStyle = 'rgba(20,20,30,0.75)';
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-2 * scale, 0);
    ctx.lineTo(2 * scale, 0);
    ctx.stroke();
  } else if (glasses.id === 'star') {
    for (const ox of [-16, 16]) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
        const a2 = a + Math.PI / 5;
        const r = 13 * scale;
        const cx = ox * scale;
        if (i === 0) ctx.moveTo(cx + Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(cx + Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a2) * r * 0.42, Math.sin(a2) * r * 0.42);
      }
      ctx.closePath();
      ctx.stroke();
    }
  } else if (glasses.id === 'heart') {
    ctx.fillStyle = glasses.color;
    for (const ox of [-16, 16]) {
      ctx.save();
      ctx.translate(ox * scale, 0);
      ctx.scale(scale, scale);
      ctx.beginPath();
      ctx.moveTo(0, 10);
      ctx.bezierCurveTo(-14, 0, -12, -14, 0, -4);
      ctx.bezierCurveTo(12, -14, 14, 0, 0, 10);
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

  ctx.save();
  ctx.translate(cx, cy);
  if (opts.ghost) ctx.globalAlpha = 0.45;

  // Dance / bob
  const sway = dance > 0 ? Math.sin(dance * 14) * 8 * scale : Math.sin(bob) * 3 * scale;
  const hop = dance > 0 ? Math.abs(Math.sin(dance * 12)) * 10 * scale : Math.sin(bob * 1.3) * 2 * scale;
  ctx.translate(sway, -hop);
  if (dance > 0) ctx.rotate(Math.sin(dance * 10) * 0.08);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, 78 * scale, 55 * scale, 14 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.fillStyle = body.fill;
  ctx.strokeStyle = body.stroke;
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo(-40 * scale, 20 * scale);
  ctx.quadraticCurveTo(-90 * scale, 10 * scale, -95 * scale, -20 * scale);
  ctx.quadraticCurveTo(-70 * scale, 5 * scale, -35 * scale, 30 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Legs
  ctx.fillStyle = body.fill;
  roundRect(ctx, -32 * scale, 48 * scale, 22 * scale, 32 * scale, 8 * scale);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 12 * scale, 48 * scale, 22 * scale, 32 * scale, 8 * scale);
  ctx.fill();
  ctx.stroke();
  // Feet
  ctx.fillStyle = body.stroke;
  roundRect(ctx, -36 * scale, 72 * scale, 28 * scale, 12 * scale, 5 * scale);
  ctx.fill();
  roundRect(ctx, 8 * scale, 72 * scale, 28 * scale, 12 * scale, 5 * scale);
  ctx.fill();

  // Body
  ctx.fillStyle = body.fill;
  ctx.beginPath();
  ctx.ellipse(0, 10 * scale, 52 * scale, 58 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Belly
  ctx.fillStyle = body.belly;
  ctx.beginPath();
  ctx.ellipse(4 * scale, 18 * scale, 28 * scale, 34 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  drawSpotsPattern(ctx, spots, scale);

  // Arms
  ctx.fillStyle = body.fill;
  ctx.beginPath();
  ctx.ellipse(-48 * scale, 5 * scale, 14 * scale, 22 * scale, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(48 * scale, 5 * scale, 14 * scale, 22 * scale, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = body.fill;
  ctx.beginPath();
  ctx.ellipse(8 * scale, -48 * scale, 44 * scale, 40 * scale, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Snout
  ctx.fillStyle = body.belly;
  ctx.beginPath();
  ctx.ellipse(38 * scale, -38 * scale, 22 * scale, 16 * scale, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = body.stroke;
  ctx.stroke();

  // Nostrils
  ctx.fillStyle = body.stroke;
  ctx.beginPath();
  ctx.arc(42 * scale, -42 * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.arc(50 * scale, -40 * scale, 2.5 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-4 * scale, -58 * scale, 12 * scale, 14 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(22 * scale, -56 * scale, 12 * scale, 14 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2C3E50';
  ctx.beginPath();
  ctx.arc(-1 * scale, -56 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.arc(25 * scale, -54 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(1 * scale, -58 * scale, 2.2 * scale, 0, Math.PI * 2);
  ctx.arc(27 * scale, -56 * scale, 2.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Smile
  ctx.strokeStyle = body.stroke;
  ctx.lineWidth = 2.5 * scale;
  ctx.beginPath();
  ctx.arc(28 * scale, -32 * scale, 12 * scale, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Blush
  ctx.fillStyle = 'rgba(241, 148, 138, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-16 * scale, -40 * scale, 8 * scale, 5 * scale, 0, 0, Math.PI * 2);
  ctx.ellipse(40 * scale, -28 * scale, 7 * scale, 4 * scale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Crest / spikes
  ctx.fillStyle = body.stroke;
  for (const [sx, sy, sr] of [[-10, -82, 8], [6, -88, 9], [24, -82, 7]]) {
    ctx.beginPath();
    ctx.moveTo((sx - sr) * scale, (sy + 10) * scale);
    ctx.lineTo(sx * scale, (sy - sr) * scale);
    ctx.lineTo((sx + sr) * scale, (sy + 10) * scale);
    ctx.closePath();
    ctx.fill();
  }

  drawGlasses(ctx, glasses, scale);
  drawHat(ctx, hat, scale);
  drawScarf(ctx, scarf, scale);

  if (flash > 0) {
    ctx.globalAlpha = flash * 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 60 * scale, 80 * scale, 0, 0, Math.PI * 2);
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
    ctx.translate(cx, cy + 16);
    drawHat(ctx, item, 0.7);
  } else if (catId === 'scarf') {
    ctx.translate(cx, cy);
    drawScarf(ctx, item, 0.65);
  } else if (catId === 'glasses') {
    ctx.translate(cx, cy);
    drawGlasses(ctx, item, 0.85);
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
