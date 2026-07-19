#!/usr/bin/env node
/**
 * Dress-Up Dino — unit + shell tests (no browser / no deps).
 * Run: node tests/run.mjs
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, msg) {
  if (cond) {
    passed++;
    process.stdout.write('.');
    return;
  }
  failed++;
  failures.push(msg);
  console.error('\n  ✗', msg);
}

function assertEq(a, b, msg) {
  assert(Object.is(a, b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

function section(name) {
  process.stdout.write('\n• ' + name + ' ');
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function loadGame() {
  const files = [
    'js/config.js',
    'js/save.js',
    'js/audio.js',
    'js/particles.js',
    'js/game.js',
  ];
  const code = files
    .map(rel => `// ---- ${rel} ----\n` + read(rel))
    .join('\n;\n');

  const exportFooter = `
    globalThis.__TEST__ = {
      GAME_VERSION, GAME_NAME, W, H, MODES, MODE_ORDER, CATEGORIES,
      BODY_COLORS, HATS, SCARVES, GLASSES, SPOTS, DEFAULT_OUTFIT, MAX_FAVORITES,
      DINO_RIG, accessoryAnchor,
      outfitsEqual, isValidItem, normalizeOutfit, resolveEquip, randomOutfit,
      bodyOf, hatOf, findItem,
      equip, enterPlay, enterMenu, doSurprise, doFavorite, doShowOff,
      checkMatch, rebuildHits, handleTap,
      state: () => state,
      modeId: () => modeId,
      matchTarget: () => matchTarget,
      matchDone: () => matchDone,
      sessionDress: () => sessionDress,
      categoryIndex: () => categoryIndex,
      hitButtons: () => hitButtons,
      hitTray: () => hitTray,
      hitCats: () => hitCats,
      save,
      setMode, setMuted, setFullOutfit, setOutfitPart,
      toggleFavorite, isFavorite, loadFavorite, outfitKey,
    };
  `;

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Math,
    performance: { now: () => Date.now() },
    localStorage: {
      _data: {},
      getItem(k) { return this._data[k] ?? null; },
      setItem(k, v) { this._data[k] = String(v); },
      removeItem(k) { delete this._data[k]; },
      clear() { this._data = {}; },
    },
    document: {
      getElementById() { return null; },
      querySelectorAll() { return []; },
    },
    window: {},
    globalThis: {},
    requestAnimationFrame: (fn) => setTimeout(() => fn(Date.now()), 0),
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.runInNewContext(code + '\n' + exportFooter, sandbox, { filename: 'dress-up-dino-test.js' });
  return sandbox.__TEST__;
}

// -------------------- shell --------------------
section('PWA shell files');
{
  for (const f of [
    'index.html', 'css/style.css', 'js/config.js', 'js/save.js', 'js/audio.js',
    'js/particles.js', 'js/game.js', 'js/main.js',
    'manifest.webmanifest', 'sw.js', 'README.md',
  ]) {
    assert(exists(f), `exists ${f}`);
  }
  for (const f of [
    'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
    'apple-touch-icon.png', 'art/cover.jpg',
  ]) {
    assert(exists(f), `exists ${f}`);
  }
}

section('version / SW cache sync');
{
  const cfg = read('js/config.js');
  const sw = read('sw.js');
  const m = cfg.match(/GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
  assert(!!m, 'GAME_VERSION');
  assert(sw.includes(`dress-up-dino-${m[1]}`), 'SW CACHE sync');
}

// -------------------- cosmetics data --------------------
section('cosmetics data integrity');
{
  const T = loadGame();
  assert(T.CATEGORIES.length >= 4, '≥4 categories');
  assert(T.BODY_COLORS.length >= 4, '≥4 body colors');
  assert(T.HATS.some(h => h.id === 'none'), 'hats has none');
  assert(T.SCARVES.some(h => h.id === 'none'), 'scarves has none');
  // Unique ids per list
  for (const cat of T.CATEGORIES) {
    const ids = cat.items.map(i => i.id);
    assert(new Set(ids).size === ids.length, `${cat.id} unique ids`);
  }
  // Default outfit valid
  for (const cat of T.CATEGORIES) {
    assert(T.isValidItem(cat.id, T.DEFAULT_OUTFIT[cat.id]), `default ${cat.id}`);
  }
}

// -------------------- equip / unequip --------------------
section('resolveEquip');
{
  const T = loadGame();
  const base = Object.assign({}, T.DEFAULT_OUTFIT);
  assertEq(T.resolveEquip('hat', 'party', base), 'party', 'equip party hat');
  assertEq(
    T.resolveEquip('hat', 'party', Object.assign({}, base, { hat: 'party' })),
    'none',
    're-tap unequips hat'
  );
  assertEq(
    T.resolveEquip('body', 'sky', Object.assign({}, base, { body: 'sky' })),
    'sky',
    'body does not unequip on re-tap'
  );
  assertEq(T.resolveEquip('hat', 'nope', base), base.hat, 'invalid id ignored');
}

// -------------------- outfitsEqual / normalize --------------------
section('outfit helpers');
{
  const T = loadGame();
  const a = { body: 'mint', hat: 'party', scarf: 'none', glasses: 'none', spots: 'none' };
  const b = Object.assign({}, a);
  const c = Object.assign({}, a, { hat: 'crown' });
  assert(T.outfitsEqual(a, b) === true, 'equal outfits');
  assert(T.outfitsEqual(a, c) === false, 'different outfits');
  const dirty = { body: 'mint', hat: 'hacked', scarf: 'blue' };
  const norm = T.normalizeOutfit(dirty);
  assertEq(norm.hat, 'none', 'invalid hat → default');
  assertEq(norm.scarf, 'blue', 'valid scarf kept');
  assertEq(norm.body, 'mint', 'valid body kept');
}

// -------------------- favorites --------------------
section('favorites persist');
{
  const T = loadGame();
  T.setFullOutfit({ body: 'coral', hat: 'crown', scarf: 'stars', glasses: 'round', spots: 'dots' });
  assert(T.isFavorite(T.save.outfit) === false, 'not favorite yet');
  const added = T.toggleFavorite();
  assert(added === true, 'added favorite');
  assert(T.isFavorite(T.save.outfit) === true, 'is favorite');
  assert(T.save.favorites.length === 1, '1 favorite stored');
  // Toggle off
  assert(T.toggleFavorite() === false, 'removed favorite');
  assert(T.save.favorites.length === 0, 'empty favorites');
  // Cap at MAX
  for (let i = 0; i < T.MAX_FAVORITES + 3; i++) {
    T.setFullOutfit({
      body: T.BODY_COLORS[i % T.BODY_COLORS.length].id,
      hat: T.HATS[i % T.HATS.length].id,
      scarf: T.SCARVES[i % T.SCARVES.length].id,
      glasses: T.GLASSES[i % T.GLASSES.length].id,
      spots: T.SPOTS[i % T.SPOTS.length].id,
    });
    T.toggleFavorite();
  }
  assert(T.save.favorites.length <= T.MAX_FAVORITES, `cap ≤ ${T.MAX_FAVORITES}`);
}

// -------------------- play / match mode --------------------
section('play modes');
{
  const T = loadGame();
  T.enterPlay('free');
  assertEq(T.state(), 'play', 'play state');
  assertEq(T.modeId(), 'free', 'free mode');
  assert(T.matchTarget() === null, 'no match target in free');
  assert(T.hitCats().length === T.CATEGORIES.length, 'category hits');
  assert(T.hitTray().length > 0, 'tray hits');

  T.enterPlay('match');
  assert(T.matchTarget() !== null, 'match has target');
  assert(T.matchDone() === false, 'not done yet');
  // Body matches target at start; accessories none
  assertEq(T.save.outfit.body, T.matchTarget().body, 'start body = target body');
  assertEq(T.save.outfit.hat, 'none', 'start hat none');

  // Equip exact target
  const target = T.matchTarget();
  T.setFullOutfit(target);
  T.checkMatch();
  assert(T.matchDone() === true, 'match complete when outfit equals target');
}

// -------------------- equip via game API --------------------
section('equip API');
{
  const T = loadGame();
  T.enterPlay('free');
  const before = T.save.dresses | 0;
  T.equip('hat', 'party');
  assertEq(T.save.outfit.hat, 'party', 'hat equipped');
  assert(T.save.dresses > before, 'dress counted');
  T.equip('hat', 'party');
  assertEq(T.save.outfit.hat, 'none', 'hat unequipped');
}

// -------------------- random outfit valid --------------------
section('randomOutfit');
{
  const T = loadGame();
  for (let i = 0; i < 20; i++) {
    const o = T.randomOutfit(false);
    for (const cat of T.CATEGORIES) {
      assert(T.isValidItem(cat.id, o[cat.id]), `random ${cat.id}=${o[cat.id]}`);
    }
  }
}

// -------------------- surprise --------------------
section('doSurprise');
{
  const T = loadGame();
  T.enterPlay('free');
  T.doSurprise();
  assert(T.sessionDress() >= 1, 'session dress bumped');
  for (const cat of T.CATEGORIES) {
    assert(T.isValidItem(cat.id, T.save.outfit[cat.id]), `surprise ${cat.id}`);
  }
}

// -------------------- accessory rig alignment --------------------
// Guards against the "scarf is a belt / glasses below eyes" class of bugs.
section('accessory anchors vs anatomy');
{
  const T = loadGame();
  const R = T.DINO_RIG;
  assert(!!R && !!R.eyeL && !!R.eyeR && !!R.neck && !!R.crown, 'DINO_RIG present');

  // Eyes are on the head (above body center, near head center)
  assert(R.eyeL.y < R.head.y + 5, 'left eye on/near head (not mid-body)');
  assert(R.eyeR.y < R.head.y + 5, 'right eye on/near head');
  assert(R.eyeL.y < -40, 'eyes high on face (y < -40)');
  assert(R.eyeR.y < -40, 'right eye high on face');

  // Neck is between head center and body center
  assert(R.neck.y > R.head.y, 'neck below head center');
  assert(R.neck.y < R.body.y, 'neck above body center');
  assert(R.neck.y < 0, 'neck above origin (not belly)');
  // Scarf must not land near belly (old bug was y=28)
  assert(R.neck.y < 5, 'neck not mid-torso');

  // Crown above head center
  assert(R.crown.y < R.head.y, 'crown above head');
  assert(R.crown.y < R.eyeL.y, 'crown above eyes');

  const g = T.accessoryAnchor('glasses');
  assertClose(
    g.x, (R.eyeL.x + R.eyeR.x) / 2, 0.01,
    'glasses anchor X = mid eyes'
  );
  assertClose(
    g.y, (R.eyeL.y + R.eyeR.y) / 2, 0.01,
    'glasses anchor Y = mid eyes'
  );
  // Lenses must sit on eyes — not 30px below (old bug: translate y=-28 vs eyes y≈-57)
  assert(Math.abs(g.y - R.eyeL.y) <= R.maxEyeLensOffset, 'glasses near left eye');
  assert(Math.abs(g.y - R.eyeR.y) <= R.maxEyeLensOffset + 2, 'glasses near right eye');

  const sc = T.accessoryAnchor('scarf');
  assertClose(sc.x, R.neck.x, 0.01, 'scarf X = neck');
  assertClose(sc.y, R.neck.y, 0.01, 'scarf Y = neck');
  // Explicit regression: scarf must not be at old belt position (~28)
  assert(sc.y < 0, 'scarf above waist (regression: was y=28 belt)');
  assert(Math.abs(sc.y - R.body.y) > 15, 'scarf far from body center');

  const h = T.accessoryAnchor('hat');
  assertClose(h.x, R.crown.x, 0.01, 'hat X = crown');
  assertClose(h.y, R.crown.y, 0.01, 'hat Y = crown');
  assert(h.y < R.eyeL.y, 'hat above eyes');

  // Source-level regression: drawers must call accessoryAnchor / DINO_RIG
  const src = read('js/game.js');
  assert(src.includes('DINO_RIG'), 'game.js defines DINO_RIG');
  assert(src.includes("accessoryAnchor('scarf')"), 'scarf uses accessoryAnchor');
  assert(src.includes("accessoryAnchor('hat')") || src.includes('accessoryAnchor("hat")'), 'hat uses accessoryAnchor');
  assert(src.includes('DINO_RIG.eyeL'), 'eyes drawn from DINO_RIG');
  // Old broken offsets must not return
  assert(!/translate\(\s*0\s*,\s*28\s*\*\s*scale\s*\)/.test(src), 'no scarf translate(0, 28*scale)');
  assert(!/translate\(\s*6\s*\*\s*scale\s*,\s*-28\s*\*\s*scale\s*\)/.test(src), 'no glasses translate(6, -28)');
}

function assertClose(a, b, eps, msg) {
  assert(Math.abs(a - b) <= eps, `${msg} (got ${a}, expected ~${b})`);
}

console.log('\n');
if (failed) {
  console.error(`Failed: ${failed}  Passed: ${passed}`);
  for (const f of failures) console.error('  •', f);
  process.exit(1);
}
console.log(`Passed: ${passed}  Failed: 0`);
console.log('All Dress-Up Dino tests passed.');
process.exit(0);
