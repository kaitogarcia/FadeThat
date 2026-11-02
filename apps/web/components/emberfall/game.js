// Emberfall: a small top-down bullet-hell RPG. Pure canvas, no dependencies.
// The world is a disc; danger rises the farther you walk from the Hearth at its center.

const WORLD_R = 2400;
const HEARTH_R = 280;
const RINGS = [
  { name: "The Hearth", r: HEARTH_R, ground: ["#3b3a2c", "#424030"] },
  { name: "Mosslands", r: 900, ground: ["#2f4a2a", "#355230"] },
  { name: "Ashen Fields", r: 1500, ground: ["#4a4235", "#52493a"] },
  { name: "Gloamwood", r: 2100, ground: ["#2b2a40", "#312f48"] },
  { name: "The Cinder Rim", r: WORLD_R, ground: ["#4a2622", "#552b26"] },
];

const WEAPONS = [
  { name: "Driftwood Rod", dmg: 14, shots: 1, spread: 0, rate: 3.2, speed: 520, range: 0.75 },
  { name: "Copper Rod", dmg: 18, shots: 1, spread: 0, rate: 3.4, speed: 540, range: 0.78 },
  { name: "Twin-bore Rod", dmg: 17, shots: 2, spread: 0.12, rate: 3.4, speed: 560, range: 0.8 },
  { name: "Moonsilver Rod", dmg: 24, shots: 2, spread: 0.12, rate: 3.6, speed: 580, range: 0.82 },
  { name: "Trident Rod", dmg: 24, shots: 3, spread: 0.14, rate: 3.6, speed: 600, range: 0.85 },
  { name: "Stormglass Rod", dmg: 32, shots: 3, spread: 0.13, rate: 3.9, speed: 640, range: 0.9 },
  { name: "Sunforged Rod", dmg: 40, shots: 4, spread: 0.11, rate: 4.2, speed: 680, range: 0.95 },
];

const STATS = ["atk", "def", "spd", "dex", "vit", "wis"];
const STAT_COLORS = {
  atk: "#e0525a", def: "#9aa4b5", spd: "#4fd18b", dex: "#f0a43a", vit: "#d44fb0", wis: "#5a9cf0",
};

// Enemy archetypes. `ring` is the lowest ring they appear in, `top` the highest.
const ENEMIES = {
  mote: { ring: 1, top: 2, hp: 34, speed: 55, r: 11, color: "#c9e86b", xp: 6, contact: 6, fire: { kind: "aimed", every: 1.6, dmg: 9, speed: 210, r: 5 } },
  skitter: { ring: 1, top: 2, hp: 22, speed: 135, r: 9, color: "#e8b46b", xp: 5, contact: 12, zig: true },
  hexer: { ring: 2, top: 3, hp: 90, speed: 45, r: 14, color: "#b07ae8", xp: 18, contact: 10, fire: { kind: "ring", n: 8, every: 2.1, dmg: 15, speed: 170, r: 6 } },
  lancer: { ring: 2, top: 4, hp: 130, speed: 70, r: 13, color: "#e86b6b", xp: 26, contact: 14, fire: { kind: "spread", n: 3, arc: 0.35, every: 1.3, dmg: 20, speed: 300, r: 5 } },
  gloom: { ring: 3, top: 4, hp: 260, speed: 40, r: 17, color: "#6b7ae8", xp: 55, contact: 18, fire: { kind: "spiral", n: 3, every: 0.18, dmg: 22, speed: 190, r: 6 } },
  colossus: { ring: 4, top: 4, hp: 650, speed: 32, r: 24, color: "#e8836b", xp: 130, contact: 30, fire: { kind: "spread", n: 7, arc: 0.9, every: 1.8, dmg: 38, speed: 230, r: 9 } },
};

const BOSS = {
  name: "The Ember Sovereign", hp: 7000, speed: 50, r: 38, color: "#ff7a2f", xp: 2000, contact: 40,
};

const BOSS_KILLS_NEEDED = 60;

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function ringAt(x, y) {
  const d = Math.hypot(x, y);
  for (let i = 0; i < RINGS.length; i++) if (d < RINGS[i].r) return i;
  return RINGS.length - 1;
}
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function makeRocks() {
  const rocks = [];
  for (let i = 0; i < 520; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * (WORLD_R - 40);
    if (d < HEARTH_R + 60) continue;
    rocks.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: rand(14, 34), tree: Math.random() < 0.55 });
  }
  // Pillars ringing the Hearth.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rocks.push({ x: Math.cos(a) * HEARTH_R, y: Math.sin(a) * HEARTH_R, r: 16, pillar: true });
  }
  const grid = new Map();
  const CELL = 128;
  for (const r of rocks) {
    const cx0 = Math.floor((r.x - r.r) / CELL), cx1 = Math.floor((r.x + r.r) / CELL);
    const cy0 = Math.floor((r.y - r.r) / CELL), cy1 = Math.floor((r.y + r.r) / CELL);
    for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
      const k = cx + "," + cy;
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(r);
    }
  }
  return {
    list: rocks,
    near(x, y) { return grid.get(Math.floor(x / CELL) + "," + Math.floor(y / CELL)) || EMPTY; },
  };
}
const EMPTY = [];

function newPlayer() {
  return {
    x: 0, y: 40, r: 11, vx: 0, vy: 0,
    hp: 120, maxHp: 120, mp: 80, maxMp: 80,
    atk: 10, def: 0, spd: 10, dex: 10, vit: 10, wis: 10,
    level: 1, xp: 0, weapon: 0, potions: 2,
    cooldown: 0, contactCd: 0, abilityCd: 0, recallCd: 0, hurtFlash: 0, aim: 0,
  };
}

function xpForLevel(l) { return Math.floor(40 * Math.pow(l, 1.6)); }

export function createGame(canvas, { onExit } = {}) {
  const ctx = canvas.getContext("2d");
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let raf = 0;
  let last = performance.now();
  let w = 0, h = 0, dpr = 1;

  let best = 0;
  try { best = Number(localStorage.getItem("emberfall-best") || 0); } catch {}

  let s; // run state
  function reset() {
    s = {
      p: newPlayer(), rocks: makeRocks(), enemies: [], bullets: [], bags: [], texts: [], particles: [],
      cam: { x: 0, y: 0 }, time: 0, kills: 0, bossSpawned: false, bossDead: false, banner: null,
      over: false, paused: false, autofire: false, spawnTimer: 0, lastRing: 0, score: 0,
    };
    say("Welcome to the Hearth. Walk outward — if you dare.", 4);
  }

  function say(text, dur = 3) { s.banner = { text, t: dur }; }
  function floatText(x, y, text, color) { s.texts.push({ x, y, text, color, t: 1.1 }); }
  function burst(x, y, color, n = 10, spd = 140) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(0.3, 1) * spd;
      s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: rand(0.3, 0.7), color });
    }
  }

  function blocked(x, y, r) {
    if (Math.hypot(x, y) > WORLD_R - r) return true;
    for (const k of s.rocks.near(x, y)) if (dist2(x, y, k.x, k.y) < (r + k.r) ** 2) return true;
    return false;
  }

  function moveBody(b, dx, dy) {
    if (!blocked(b.x + dx, b.y, b.r)) b.x += dx;
    if (!blocked(b.x, b.y + dy, b.r)) b.y += dy;
  }

  function fireEnemy(e, f, ang) {
    s.bullets.push({ x: e.x, y: e.y, vx: Math.cos(ang) * f.speed, vy: Math.sin(ang) * f.speed, r: f.r, dmg: f.dmg, life: 3.2, enemy: true, color: e.color });
  }

  function spawnEnemy() {
    const p = s.p;
    for (let tries = 0; tries < 8; tries++) {
      const a = Math.random() * Math.PI * 2, d = rand(520, 900);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      const ring = ringAt(x, y);
      if (ring === 0 || Math.hypot(x, y) > WORLD_R - 40) continue;
      const types = Object.entries(ENEMIES).filter(([, t]) => ring >= t.ring && ring <= t.top);
      if (!types.length) continue;
      const [kind, t] = pick(types);
      if (blocked(x, y, t.r)) continue;
      const pack = kind === "skitter" ? 3 : kind === "mote" ? 2 : 1;
      for (let i = 0; i < pack; i++) {
        const ex = x + rand(-30, 30), ey = y + rand(-30, 30);
        if (blocked(ex, ey, t.r)) continue;
        s.enemies.push({ kind, t, color: t.color, x: ex, y: ey, r: t.r, hp: t.hp, maxHp: t.hp, cd: rand(0, 1.5), spin: 0, wander: Math.random() * 6.28, flash: 0 });
      }
      return;
    }
  }

  function spawnBoss() {
    const a = Math.atan2(s.p.y, s.p.x);
    const d = Math.min(WORLD_R - 120, Math.hypot(s.p.x, s.p.y) + 350);
    const b = { kind: "boss", t: BOSS, color: BOSS.color, boss: true, x: Math.cos(a) * d, y: Math.sin(a) * d, r: BOSS.r, hp: BOSS.hp, maxHp: BOSS.hp, cd: 2, spin: 0, phase: 0, flash: 0, wander: 0 };
    s.enemies.push(b);
    s.bossSpawned = true;
    say("The Ember Sovereign wakes at the Rim!", 4);
  }

  function dropLoot(e) {
    const ring = e.boss ? 5 : ringAt(e.x, e.y);
    const items = [];
    const chance = e.boss ? 1 : 0.12 + ring * 0.05 + (e.t.xp > 50 ? 0.25 : 0);
    if (Math.random() < chance) {
      const roll = Math.random();
      if (roll < 0.45) items.push({ type: "potion" });
      else if (roll < 0.8) items.push({ type: "shard", stat: pick(STATS) });
      else {
        const tier = Math.min(WEAPONS.length - 1, Math.max(1, ring + Math.floor(rand(-1, 2))));
        items.push({ type: "weapon", tier });
      }
    }
    if (e.boss) {
      items.push({ type: "weapon", tier: WEAPONS.length - 1 });
      for (let i = 0; i < 4; i++) items.push({ type: "shard", stat: pick(STATS) });
      items.push({ type: "potion" }, { type: "potion" });
    }
    if (!items.length) return;
    const rarity = items.some((i) => i.type === "weapon" && i.tier >= 5) || e.boss ? "gold" : items.some((i) => i.type !== "potion") ? "violet" : "brown";
    s.bags.push({ x: e.x, y: e.y, items, rarity, t: 45 });
  }

  function gainXp(n) {
    const p = s.p;
    if (p.level >= 20) return;
    p.xp += n;
    while (p.level < 20 && p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      p.maxHp += 22; p.maxMp += 6;
      for (const st of STATS) p[st] += Math.random() < 0.6 ? 1 : 0;
      p.atk += 1; p.dex += 1;
      p.hp = p.maxHp; p.mp = p.maxMp;
      floatText(p.x, p.y - 24, `LEVEL ${p.level}`, "#ffe27a");
      burst(p.x, p.y, "#ffe27a", 24, 200);
    }
  }

  function pickupBag(b) {
    const p = s.p;
    for (const it of b.items) {
      if (it.type === "potion") { p.potions = Math.min(9, p.potions + 1); floatText(b.x, b.y, "+1 tonic", "#ff6b8a"); }
      else if (it.type === "shard") {
        p[it.stat] += 1;
        if (it.stat === "vit") { p.maxHp += 10; p.hp += 10; }
        if (it.stat === "wis") { p.maxMp += 5; }
        floatText(b.x, b.y - 14, `+1 ${it.stat.toUpperCase()}`, STAT_COLORS[it.stat]);
      } else if (it.type === "weapon") {
        if (it.tier > p.weapon) { p.weapon = it.tier; floatText(b.x, b.y - 28, WEAPONS[it.tier].name, "#ffd36b"); say(`Equipped ${WEAPONS[it.tier].name}`, 2.5); }
        else { gainXp(10 * it.tier); floatText(b.x, b.y - 28, "salvaged", "#aaa"); }
      }
    }
  }

  function die() {
    s.over = true;
    s.score = s.kills * 10 + s.p.level * 100 + (s.bossDead ? 5000 : 0);
    if (s.score > best) { best = s.score; try { localStorage.setItem("emberfall-best", String(best)); } catch {} }
  }

  function damagePlayer(dmg) {
    const p = s.p;
    const taken = Math.max(Math.ceil(dmg * 0.15), Math.round(dmg - p.def));
    p.hp -= taken;
    p.hurtFlash = 0.15;
    floatText(p.x, p.y - 18, `-${taken}`, "#ff5a5a");
    if (p.hp <= 0) { p.hp = 0; die(); }
  }

  function playerShoot() {
    const p = s.p, wpn = WEAPONS[p.weapon];
    const dmgMul = 0.5 + p.atk / 20;
    const n = wpn.shots;
    for (let i = 0; i < n; i++) {
      const a = p.aim + (i - (n - 1) / 2) * wpn.spread;
      s.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * wpn.speed, vy: Math.sin(a) * wpn.speed, r: 5, dmg: Math.round(wpn.dmg * dmgMul * rand(0.85, 1.15)), life: wpn.range, enemy: false, color: "#7ae8ff" });
    }
    p.cooldown = 1 / (wpn.rate * (0.6 + p.dex / 25));
  }

  function useAbility() {
    const p = s.p;
    if (p.abilityCd > 0 || p.mp < 35) return;
    p.mp -= 35; p.abilityCd = 0.6;
    const wpn = WEAPONS[p.weapon], dmgMul = 0.5 + p.atk / 20;
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      s.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 7, dmg: Math.round(wpn.dmg * dmgMul * 1.6), life: 0.7, enemy: false, color: "#ffd36b", pierce: true, hit: new Set() });
    }
    burst(p.x, p.y, "#ffd36b", 18, 260);
  }

  function update(dt) {
    if (s.banner) { s.banner.t -= dt; if (s.banner.t <= 0) s.banner = null; }
    for (const t of s.texts) { t.t -= dt; t.y -= 30 * dt; }
    s.texts = s.texts.filter((t) => t.t > 0);
    for (const q of s.particles) { q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.92; q.vy *= 0.92; }
    s.particles = s.particles.filter((q) => q.t > 0);
    if (s.over || s.paused) return;

    s.time += dt;
    const p = s.p;

    // Movement
    let mx = 0, my = 0;
    if (keys.has("KeyW")) my -= 1;
    if (keys.has("KeyS")) my += 1;
    if (keys.has("KeyA")) mx -= 1;
    if (keys.has("KeyD")) mx += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my), sp = 120 + p.spd * 5;
      moveBody(p, (mx / len) * sp * dt, (my / len) * sp * dt);
    }

    // Aim
    p.aim = Math.atan2(mouse.y - h / 2 - (p.y - s.cam.y), mouse.x - w / 2 - (p.x - s.cam.x));

    p.cooldown -= dt; p.contactCd -= dt; p.abilityCd -= dt; p.recallCd -= dt; p.hurtFlash -= dt;
    if ((mouse.down || s.autofire) && p.cooldown <= 0) playerShoot();

    const inHearth = Math.hypot(p.x, p.y) < HEARTH_R;
    p.hp = Math.min(p.maxHp, p.hp + (1 + p.vit * 0.12) * dt * (inHearth ? 8 : 1));
    p.mp = Math.min(p.maxMp, p.mp + (1 + p.wis * 0.25) * dt * (inHearth ? 4 : 1));

    const ring = ringAt(p.x, p.y);
    if (ring !== s.lastRing) { say(RINGS[ring].name, 2); s.lastRing = ring; }

    // Spawning
    s.spawnTimer -= dt;
    const cap = 18 + ring * 7;
    if (s.spawnTimer <= 0 && ring > 0 && s.enemies.length < cap) { spawnEnemy(); s.spawnTimer = 0.5; }
    if (!s.bossSpawned && s.kills >= BOSS_KILLS_NEEDED && ring >= 3) spawnBoss();

    // Enemies
    for (const e of s.enemies) {
      e.flash -= dt;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      const aggro = e.boss ? 1400 : 420;
      let vx = 0, vy = 0;
      if (d < aggro && !inHearth) {
        const keep = e.t.fire && !e.boss ? 160 : 0;
        const dir = d > keep ? 1 : -0.6;
        vx = (dx / d) * dir; vy = (dy / d) * dir;
        if (e.t.zig) { const z = Math.sin(s.time * 8 + e.wander) * 0.8; vx += (-dy / d) * z; vy += (dx / d) * z; }
      } else {
        e.wander += rand(-1, 1) * dt;
        vx = Math.cos(e.wander) * 0.4; vy = Math.sin(e.wander) * 0.4;
      }
      // Monsters never step into the Hearth.
      const nx = e.x + vx * e.t.speed * dt, ny = e.y + vy * e.t.speed * dt;
      if (Math.hypot(nx, ny) > HEARTH_R + 30) moveBody(e, vx * e.t.speed * dt, vy * e.t.speed * dt);

      if (d < e.r + p.r && !inHearth && p.contactCd <= 0) { damagePlayer(e.t.contact); p.contactCd = 0.5; }

      e.cd -= dt;
      if (d < aggro && !inHearth && e.cd <= 0) {
        if (e.boss) bossAttack(e, Math.atan2(dy, dx));
        else if (e.t.fire) {
          const f = e.t.fire, base = Math.atan2(dy, dx);
          if (f.kind === "aimed") fireEnemy(e, f, base);
          else if (f.kind === "ring") for (let i = 0; i < f.n; i++) fireEnemy(e, f, e.spin + (i / f.n) * Math.PI * 2);
          else if (f.kind === "spread") for (let i = 0; i < f.n; i++) fireEnemy(e, f, base + (i / (f.n - 1) - 0.5) * f.arc * 2);
          else if (f.kind === "spiral") for (let i = 0; i < f.n; i++) fireEnemy(e, f, e.spin + (i / f.n) * Math.PI * 2);
          e.spin += f.kind === "spiral" ? 0.32 : 0.4;
          e.cd = f.every;
        }
      }
    }
    // Despawn far-off monsters (never the boss).
    s.enemies = s.enemies.filter((e) => e.boss || dist2(e.x, e.y, p.x, p.y) < 1500 * 1500);

    // Bullets
    for (const b of s.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) continue;
      let hitRock = Math.hypot(b.x, b.y) > WORLD_R;
      if (!hitRock) for (const k of s.rocks.near(b.x, b.y)) if (dist2(b.x, b.y, k.x, k.y) < k.r * k.r) { hitRock = true; break; }
      if (hitRock) { b.life = 0; burst(b.x, b.y, b.color, 3, 60); continue; }
      if (b.enemy) {
        if (!inHearth && dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) ** 2) { damagePlayer(b.dmg); b.life = 0; }
      } else {
        for (const e of s.enemies) {
          if (e.hp <= 0 || (b.hit && b.hit.has(e))) continue;
          if (dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) ** 2) {
            e.hp -= b.dmg; e.flash = 0.08;
            floatText(e.x + rand(-6, 6), e.y - e.r, String(b.dmg), "#ffffff");
            if (b.pierce) b.hit.add(e); else { b.life = 0; }
            if (e.hp <= 0) killEnemy(e);
            if (!b.pierce) break;
          }
        }
      }
    }
    s.bullets = s.bullets.filter((b) => b.life > 0);
    s.enemies = s.enemies.filter((e) => e.hp > 0);

    // Bags
    for (const b of s.bags) {
      b.t -= dt;
      if (dist2(b.x, b.y, p.x, p.y) < 22 * 22) { pickupBag(b); b.t = 0; }
    }
    s.bags = s.bags.filter((b) => b.t > 0);

    // Camera
    s.cam.x += (p.x - s.cam.x) * Math.min(1, dt * 10);
    s.cam.y += (p.y - s.cam.y) * Math.min(1, dt * 10);
  }

  function bossAttack(e, toPlayer) {
    const enraged = e.hp < e.maxHp * 0.4;
    const f = { dmg: 30, speed: 200, r: 8 };
    e.phase = (e.phase + 1) % 4;
    if (e.phase === 0) {
      for (let i = 0; i < 24; i++) fireEnemy(e, f, e.spin + (i / 24) * Math.PI * 2);
      e.cd = enraged ? 0.8 : 1.2;
    } else if (e.phase === 1) {
      const g = { dmg: 40, speed: 340, r: 7 };
      for (let i = -3; i <= 3; i++) fireEnemy(e, g, toPlayer + i * 0.12);
      e.cd = enraged ? 0.5 : 0.8;
    } else if (e.phase === 2) {
      for (let k = 0; k < (enraged ? 4 : 3); k++) for (let i = 0; i < 5; i++) {
        const sp = { dmg: 25, speed: 150 + k * 45, r: 6 };
        fireEnemy(e, sp, e.spin * 2 + (i / 5) * Math.PI * 2 + k * 0.2);
      }
      e.cd = 1;
    } else {
      // Charge
      const d = 120;
      moveBody(e, Math.cos(toPlayer) * d, Math.sin(toPlayer) * d);
      burst(e.x, e.y, e.color, 20, 240);
      e.cd = enraged ? 0.7 : 1.1;
    }
    e.spin += 0.25;
  }

  function killEnemy(e) {
    s.kills++;
    gainXp(e.t.xp);
    burst(e.x, e.y, e.color, e.boss ? 80 : 14, e.boss ? 360 : 160);
    dropLoot(e);
    if (e.boss) { s.bossDead = true; say("The Ember Sovereign falls. You have conquered Emberfall!", 6); }
    else if (s.kills === BOSS_KILLS_NEEDED && !s.bossSpawned) say("Something stirs in the outer dark… (reach the Gloamwood)", 4);
  }

  // ---------- Rendering ----------
  function draw() {
    const p = s.p;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#0b0a10";
    ctx.fillRect(0, 0, w, h);

    const ox = w / 2 - s.cam.x, oy = h / 2 - s.cam.y;
    const T = 48;
    const x0 = Math.floor((s.cam.x - w / 2) / T) - 1, x1 = Math.floor((s.cam.x + w / 2) / T) + 1;
    const y0 = Math.floor((s.cam.y - h / 2) / T) - 1, y1 = Math.floor((s.cam.y + h / 2) / T) + 1;
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
      const cx = tx * T + T / 2, cy = ty * T + T / 2;
      if (Math.hypot(cx, cy) > WORLD_R + T) continue;
      const g = RINGS[ringAt(cx, cy)].ground;
      ctx.fillStyle = g[hash(tx, ty) < 0.5 ? 0 : 1];
      ctx.fillRect(tx * T + ox, ty * T + oy, T + 1, T + 1);
    }
    // World edge
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(ox, oy, WORLD_R, 0, Math.PI * 2, true);
    ctx.fillStyle = "#0b0a10";
    ctx.fill("evenodd");
    ctx.restore();
    // Hearth
    ctx.beginPath(); ctx.arc(ox, oy, HEARTH_R, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,190,90,0.07)"; ctx.fill();
    ctx.strokeStyle = "rgba(255,190,90,0.25)"; ctx.lineWidth = 2; ctx.stroke();
    const flick = 1 + Math.sin(s.time * 9) * 0.08;
    ctx.beginPath(); ctx.arc(ox, oy, 26 * flick, 0, Math.PI * 2); ctx.fillStyle = "#ff9a3a"; ctx.fill();
    ctx.beginPath(); ctx.arc(ox, oy, 14 * flick, 0, Math.PI * 2); ctx.fillStyle = "#ffe08a"; ctx.fill();

    const onScreen = (x, y, pad = 60) => Math.abs(x - s.cam.x) < w / 2 + pad && Math.abs(y - s.cam.y) < h / 2 + pad;

    // Bags
    for (const b of s.bags) {
      if (!onScreen(b.x, b.y)) continue;
      const col = b.rarity === "gold" ? "#ffd36b" : b.rarity === "violet" ? "#b07ae8" : "#8a6440";
      const bob = Math.sin(s.time * 4 + b.x) * 2;
      ctx.fillStyle = col;
      ctx.fillRect(b.x + ox - 8, b.y + oy - 8 + bob, 16, 14);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(b.x + ox - 8, b.y + oy - 8 + bob, 16, 4);
    }

    // Rocks / trees
    for (const k of s.rocks.list) {
      if (!onScreen(k.x, k.y, k.r + 10)) continue;
      const x = k.x + ox, y = k.y + oy;
      if (k.pillar) {
        ctx.fillStyle = "#6b5a44"; ctx.beginPath(); ctx.arc(x, y, k.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffb35a"; ctx.beginPath(); ctx.arc(x, y - 3, 5 * flick, 0, Math.PI * 2); ctx.fill();
      } else if (k.tree) {
        const ring = ringAt(k.x, k.y);
        ctx.fillStyle = ["#2d5a2a", "#3a6b30", "#5a5a3a", "#3b3560", "#5a2a24"][ring];
        ctx.beginPath(); ctx.arc(x, y, k.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath(); ctx.arc(x - k.r * 0.3, y - k.r * 0.3, k.r * 0.55, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "#5a5560"; ctx.beginPath(); ctx.arc(x, y, k.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#6e6a75"; ctx.beginPath(); ctx.arc(x - 3, y - 3, k.r * 0.7, 0, Math.PI * 2); ctx.fill();
      }
    }

    // Enemies
    for (const e of s.enemies) {
      if (!onScreen(e.x, e.y, e.r + 20)) continue;
      const x = e.x + ox, y = e.y + oy;
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = e.flash > 0 ? "#ffffff" : e.color;
      ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 2;
      drawEnemyShape(e);
      ctx.restore();
      if (e.hp < e.maxHp && !e.boss) {
        ctx.fillStyle = "#300"; ctx.fillRect(x - e.r, y + e.r + 4, e.r * 2, 3);
        ctx.fillStyle = "#e33"; ctx.fillRect(x - e.r, y + e.r + 4, (e.r * 2 * e.hp) / e.maxHp, 3);
      }
    }

    // Player
    {
      const x = p.x + ox, y = p.y + oy;
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(0, 10, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.hurtFlash > 0 ? "#ff8080" : "#3a6ee8";
      ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(10, 10); ctx.lineTo(5, -6); ctx.lineTo(-5, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#f2d2b0"; ctx.beginPath(); ctx.arc(0, -9, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2a3a8a"; ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(8, -10); ctx.lineTo(0, -24); ctx.closePath(); ctx.fill();
      ctx.rotate(p.aim);
      ctx.strokeStyle = "#c8a070"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(20, 0); ctx.stroke();
      ctx.fillStyle = "#7ae8ff"; ctx.beginPath(); ctx.arc(21, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // Bullets
    for (const b of s.bullets) {
      if (!onScreen(b.x, b.y, 10)) continue;
      const x = b.x + ox, y = b.y + oy;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = b.enemy ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.8)";
      ctx.beginPath(); ctx.arc(x, y, b.r * 0.45, 0, Math.PI * 2); ctx.fill();
    }

    // Particles
    for (const q of s.particles) {
      ctx.globalAlpha = Math.max(0, q.t * 1.6);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x + ox - 2, q.y + oy - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // Floating texts
    ctx.font = "bold 13px ui-monospace, monospace";
    ctx.textAlign = "center";
    for (const t of s.texts) {
      ctx.globalAlpha = Math.min(1, t.t * 2);
      ctx.fillStyle = "#000"; ctx.fillText(t.text, t.x + ox + 1, t.y + oy + 1);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x + ox, t.y + oy);
    }
    ctx.globalAlpha = 1;

    drawHud();
  }

  function drawEnemyShape(e) {
    const r = e.r, k = e.kind;
    if (k === "skitter") ctx.rotate(Math.atan2(s.p.y - e.y, s.p.x - e.x));
    ctx.beginPath();
    if (k === "mote") { ctx.arc(0, 0, r, 0, Math.PI * 2); }
    else if (k === "skitter") { ctx.moveTo(r, 0); ctx.lineTo(-r, r * 0.8); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r, -r * 0.8); ctx.closePath(); }
    else if (k === "hexer") { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + s.time; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); }
    else if (k === "lancer") { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath(); }
    else if (k === "gloom") { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - s.time * 0.8, rr = i % 2 ? r * 0.55 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); }
    else if (k === "colossus") { ctx.rect(-r, -r, r * 2, r * 2); }
    else if (e.boss) {
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + s.time * 0.5, rr = i % 2 ? r * 0.7 : r * (1 + Math.sin(s.time * 6 + i) * 0.08); ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
    // eyes
    ctx.fillStyle = "#1a0a0a";
    const er = Math.max(2, r * 0.16);
    ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.15, er, 0, Math.PI * 2); ctx.arc(r * 0.3, -r * 0.15, er, 0, Math.PI * 2); ctx.fill();
  }

  function bar(x, y, bw, bh, frac, col, label) {
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = col; ctx.fillRect(x, y, bw * Math.max(0, Math.min(1, frac)), bh);
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px ui-monospace, monospace"; ctx.textAlign = "center";
    ctx.fillText(label, x + bw / 2, y + bh - 3);
  }

  function drawHud() {
    const p = s.p;
    const panelW = Math.min(220, w - 32);
    const px = 16, py = h - 150;
    ctx.fillStyle = "rgba(10,8,16,0.75)"; ctx.fillRect(px - 8, py - 8, panelW + 16, 146);
    ctx.textAlign = "left"; ctx.font = "bold 13px ui-monospace, monospace"; ctx.fillStyle = "#ffe27a";
    ctx.fillText(`Lv ${p.level}  ${WEAPONS[p.weapon].name}`, px, py + 6);
    bar(px, py + 14, panelW, 15, p.level >= 20 ? 1 : p.xp / xpForLevel(p.level), "#4fa84f", p.level >= 20 ? "MAX" : `XP ${p.xp}/${xpForLevel(p.level)}`);
    bar(px, py + 33, panelW, 15, p.hp / p.maxHp, "#d43a3a", `HP ${Math.ceil(p.hp)}/${p.maxHp}`);
    bar(px, py + 52, panelW, 15, p.mp / p.maxMp, "#3a6ed4", `MP ${Math.floor(p.mp)}/${p.maxMp}`);
    ctx.font = "12px ui-monospace, monospace"; ctx.textAlign = "left";
    STATS.forEach((st, i) => {
      const cx = px + (i % 3) * (panelW / 3), cy = py + 88 + Math.floor(i / 3) * 18;
      ctx.fillStyle = STAT_COLORS[st]; ctx.fillText(`${st.toUpperCase()} ${p[st]}`, cx, cy);
    });
    ctx.fillStyle = "#ff6b8a"; ctx.fillText(`Tonics ×${p.potions} [F]`, px, py + 128);
    ctx.fillStyle = "#aaa"; ctx.fillText(`Kills ${s.kills}`, px + panelW * 0.62, py + 128);

    // Minimap
    const mm = Math.min(150, w * 0.3), mx = w - mm - 16, my = 16, sc = mm / (WORLD_R * 2);
    ctx.fillStyle = "rgba(10,8,16,0.75)"; ctx.fillRect(mx - 4, my - 4, mm + 8, mm + 8);
    for (let i = RINGS.length - 1; i >= 0; i--) {
      ctx.beginPath(); ctx.arc(mx + mm / 2, my + mm / 2, RINGS[i].r * sc, 0, Math.PI * 2);
      ctx.fillStyle = RINGS[i].ground[1]; ctx.fill();
    }
    ctx.fillStyle = "#e33";
    for (const e of s.enemies) { if (!e.boss) ctx.fillRect(mx + mm / 2 + e.x * sc - 1, my + mm / 2 + e.y * sc - 1, 2, 2); }
    const boss = s.enemies.find((e) => e.boss);
    if (boss) { ctx.fillStyle = "#ff7a2f"; ctx.beginPath(); ctx.arc(mx + mm / 2 + boss.x * sc, my + mm / 2 + boss.y * sc, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(mx + mm / 2 + p.x * sc, my + mm / 2 + p.y * sc, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = "11px ui-monospace, monospace"; ctx.textAlign = "right"; ctx.fillStyle = "#ccc";
    ctx.fillText(RINGS[ringAt(p.x, p.y)].name, mx + mm, my + mm + 18);

    // Boss bar
    if (boss) {
      const bw = Math.min(420, w - 40);
      bar((w - bw) / 2, 16, bw, 18, boss.hp / boss.maxHp, "#ff7a2f", `${BOSS.name}  ${Math.ceil(boss.hp)}`);
    }

    // Help
    ctx.textAlign = "left"; ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "11px ui-monospace, monospace";
    ctx.fillText("WASD move · mouse aim/shoot · SPACE flare (35mp) · F tonic · R recall · I autofire · P pause", 16, 20);
    if (!s.bossSpawned) ctx.fillText(`Sovereign wakes at ${BOSS_KILLS_NEEDED} kills (${Math.max(0, BOSS_KILLS_NEEDED - s.kills)} to go)`, 16, 36);
    if (s.autofire) { ctx.fillStyle = "#ffd36b"; ctx.fillText("AUTOFIRE", 16, 52); }

    if (s.banner) {
      ctx.globalAlpha = Math.min(1, s.banner.t);
      ctx.textAlign = "center"; ctx.font = "bold 20px ui-monospace, monospace";
      ctx.fillStyle = "#000"; ctx.fillText(s.banner.text, w / 2 + 2, h * 0.28 + 2);
      ctx.fillStyle = "#ffe27a"; ctx.fillText(s.banner.text, w / 2, h * 0.28);
      ctx.globalAlpha = 1;
    }

    if (s.paused || s.over) {
      ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(0, 0, w, h);
      ctx.textAlign = "center"; ctx.fillStyle = s.over ? "#ff5a5a" : "#fff";
      ctx.font = "bold 36px ui-monospace, monospace";
      ctx.fillText(s.over ? "YOU HAVE FALLEN" : "PAUSED", w / 2, h / 2 - 40);
      ctx.font = "15px ui-monospace, monospace"; ctx.fillStyle = "#ddd";
      if (s.over) {
        ctx.fillText(`Level ${p.level} · ${s.kills} kills · ${Math.floor(s.time)}s${s.bossDead ? " · Sovereign slain" : ""}`, w / 2, h / 2);
        ctx.fillText(`Score ${s.score}   Best ${best}`, w / 2, h / 2 + 24);
        ctx.fillStyle = "#ffe27a"; ctx.fillText("Press ENTER to rise again", w / 2, h / 2 + 60);
      } else ctx.fillText("Press P to resume", w / 2, h / 2);
    }
  }

  // ---------- Loop & input ----------
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }

  function onKeyDown(e) {
    if (["Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === "Escape" && onExit) onExit();
    if (s.over) { if (e.code === "Enter") reset(); return; }
    if (e.code === "KeyP") s.paused = !s.paused;
    if (s.paused) return;
    if (e.code === "Space") useAbility();
    if (e.code === "KeyI") s.autofire = !s.autofire;
    if (e.code === "KeyF" && s.p.potions > 0 && s.p.hp < s.p.maxHp) {
      s.p.potions--; s.p.hp = Math.min(s.p.maxHp, s.p.hp + 120);
      floatText(s.p.x, s.p.y - 20, "+120", "#6bff8a");
    }
    if (e.code === "KeyR") {
      if (s.p.recallCd > 0) say(`Recall ready in ${Math.ceil(s.p.recallCd)}s`, 1.5);
      else { s.p.x = 0; s.p.y = 40; s.cam.x = 0; s.cam.y = 0; s.p.recallCd = 20; burst(0, 40, "#ffb35a", 30, 200); }
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; }
  function onMouseDown(e) { onMouseMove(e); if (e.button === 0) mouse.down = true; }
  function onMouseUp(e) { if (e.button === 0) mouse.down = false; }
  function onBlur() { keys.clear(); mouse.down = false; }
  function onContext(e) { e.preventDefault(); }

  reset();
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("contextmenu", onContext);
  raf = requestAnimationFrame(frame);

  return function destroy() {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    canvas.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("contextmenu", onContext);
  };
}
