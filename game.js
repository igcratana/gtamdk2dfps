/* ========================================
   ទីក្រុងសេរី — Open World 2.5D
   game.js — Logic ហ្គេមទាំងអស់ + Mobile Touch Controls
   ======================================== */

// ======================================
// 0. Rain & Snow Weather System States
// ======================================
const RAIN_DURATION   = 120;      // 2 នាទី (វិនាទី)
const RAIN_INTERVAL   = 600;      // 10 នាទី (វិនាទី)
const RAIN_DROP_COUNT = 350;      // ចំនួនគ្រាប់ភ្លៀង

let isRaining       = false;
let rainTimer       = 0;
let nextRainTime    = RAIN_INTERVAL;   // ភ្លៀងលើកដំបូង 10 នាទីក្រោយ
let rainFadeAlpha   = 0;               // 0=ស្ងប់, 1=ភ្លៀងពេញ
let rainAudioNode   = null;            // GainNode សម្រាប់ volume fade
let rainAudioSource = null;

const rainParticles = [];

// ====== Rain Particle Pool Init ======
for (let i = 0; i < RAIN_DROP_COUNT; i++) {
  rainParticles.push(createRainDrop(true));
}

function createRainDrop(randomY = false) {
  return {
    x    : Math.random() * 1.0,
    y    : randomY ? Math.random() * 1.0 : -0.05,
    len  : 0.018 + Math.random() * 0.025,
    speed: 0.5 + Math.random() * 0.4,
    alpha: 0.35 + Math.random() * 0.45,
    wind : 0.06 + Math.random() * 0.08
  };
}

function startRain() {
  if (isRaining) {
    rainTimer = 0;
    return;
  }
  isRaining = true;
  rainTimer = 0;
  for (const drop of rainParticles) {
    drop.x = Math.random();
    drop.y = -Math.random() * 0.2;
  }
  playRainSound();
}

function stopRain() {
  isRaining = false;
  rainTimer = 0;
  stopRainSound();
}

function playRainSound() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  stopRainSound();

  const bufferSize = audioCtx.sampleRate * 2;
  const buffer     = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data       = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.18;

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop   = true;

  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 3200;
  bp.Q.value = 0.6;

  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6000;

  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.22, audioCtx.currentTime + 1.5);

  source.connect(bp);
  bp.connect(lp);
  lp.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  source.start();

  rainAudioSource = source;
  rainAudioNode   = gainNode;
}

function stopRainSound() {
  if (rainAudioNode && audioCtx) {
    const t = audioCtx.currentTime;
    rainAudioNode.gain.cancelScheduledValues(t);
    rainAudioNode.gain.setValueAtTime(rainAudioNode.gain.value, t);
    rainAudioNode.gain.linearRampToValueAtTime(0, t + 1.5);
  }
  setTimeout(() => {
    try { if (rainAudioSource) rainAudioSource.stop(); } catch(e) {}
    rainAudioSource = null;
    rainAudioNode   = null;
  }, 1600);
}

// ====== Snow System State ======
const SNOW_DURATION   = 180;      // 3 នាទី (180 វិនាទី)
const SNOW_INTERVAL   = 600;      // 10 នាទី (600 វិនាទី)
const SNOW_FLAKE_COUNT = 300;      // ចំនួនគ្រាប់ព្រិល

let isSnowing       = false;
let snowTimer       = 0;
let nextSnowTime    = SNOW_INTERVAL;   // ព្រិលលើកដំបូង 10 នាទីក្រោយ
let snowFadeAlpha   = 0;

const snowParticles = [];

for (let i = 0; i < SNOW_FLAKE_COUNT; i++) {
  snowParticles.push(createSnowFlake(true));
}

function createSnowFlake(randomY = false) {
  return {
    x    : Math.random() * 1.0,
    y    : randomY ? Math.random() * 1.0 : -0.05,
    size : 0.003 + Math.random() * 0.005,
    speed: 0.1 + Math.random() * 0.2,
    alpha: 0.4 + Math.random() * 0.5,
    drift: (Math.random() - 0.5) * 0.05
  };
}

function startSnow() {
  if (isSnowing) {
    snowTimer = 0;
    return;
  }
  isSnowing = true;
  snowTimer = 0;
  for (const flake of snowParticles) {
    flake.x = Math.random();
    flake.y = -Math.random() * 0.2;
  }
}

function stopSnow() {
  isSnowing = false;
  snowTimer = 0;
}

// ======================================
// 1. DOM Elements
// ======================================
const canvas        = document.getElementById('gameCanvas');
const ctx           = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const mctx          = minimapCanvas.getContext('2d');
const gameContainer = document.querySelector('.game-container');

const startOverlay    = document.getElementById('startOverlay');
const startButton     = document.getElementById('startButton');
const shopModal       = document.getElementById('shopModal');
const closeShopBtn    = document.getElementById('closeShopBtn');
const exitShopModalBtn= document.getElementById('exitShopModalBtn');
const shopNotice      = document.getElementById('shopNotice');

const cheatModal    = document.getElementById('cheatModal');
const openCheatBtn  = document.getElementById('openCheatBtn');
const closeCheatBtn = document.getElementById('closeCheatBtn');
const cheatInput    = document.getElementById('cheatInput');
const submitCheatBtn= document.getElementById('submitCheatBtn');
const cheatNotice   = document.getElementById('cheatNotice');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const exitFullscreenBtn = document.getElementById('exitFullscreenBtn');

const cashHUD        = document.getElementById('cashHUD');
const shopModalCash  = document.getElementById('shopModalCash');
const weaponNameHUD  = document.getElementById('weaponNameHUD');
const clipAmmoHUD    = document.getElementById('clipAmmoHUD');
const reserveAmmoHUD = document.getElementById('reserveAmmoHUD');
const districtHUD    = document.getElementById('district');
const coordsHUD      = document.getElementById('coordsHUD');
const activityText   = document.getElementById('activityText');
const hintText       = document.getElementById('hintText');
const speedometer    = document.getElementById('speedometer');
const speedValue     = document.getElementById('speedValue');
const crosshair      = document.getElementById('crosshair');
const ammoCard       = document.getElementById('ammoCard');

const buyAmmoBtn   = document.getElementById('buyAmmoBtn');
const buyPistolBtn = document.getElementById('buyPistolBtn');
const buyShotgunBtn= document.getElementById('buyShotgunBtn');
const buyAKBtn     = document.getElementById('buyAKBtn');
const buyAWPBtn    = document.getElementById('buyAWPBtn');

// Mobile Control Elements
const touchJoystick  = document.getElementById('touchJoystick');
const joystickKnob   = document.getElementById('joystickKnob');
const btnActionE     = document.getElementById('btnActionE');
const btnShoot       = document.getElementById('btnShoot');
const btnWp1         = document.getElementById('btnWp1');
const btnWp2         = document.getElementById('btnWp2');
const btnWp3         = document.getElementById('btnWp3');
const btnWp4         = document.getElementById('btnWp4');

// ======================================
// 2. Audio Engine & Background Music
// ======================================
let audioCtx = null;
const bgmAudio = new Audio('dg.mp3');
bgmAudio.loop = true;
bgmAudio.volume = 0.4;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  
  // លេង Background Music (dg.mp3)
  bgmAudio.play().catch(err => {
    console.log("Audio autoplay prevented or error:", err);
  });
}

function playGunshotSound() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const bufferSize = audioCtx.sampleRate * 0.3;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise  = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.3);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start();
}

function playFunnyScreamSound() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const osc  = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const types = ['sine', 'sawtooth', 'triangle'];
  osc.type = types[Math.floor(Math.random() * types.length)];

  const startFreq = 400 + Math.random() * 500;
  const peakFreq  = startFreq + 300 + Math.random() * 400;
  const endFreq   = 150 + Math.random() * 200;
  const now = audioCtx.currentTime;

  osc.frequency.setValueAtTime(startFreq, now);
  osc.frequency.linearRampToValueAtTime(peakFreq, now + 0.15);
  osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.55);

  gain.gain.setValueAtTime(0.35, now);
  gain.gain.linearRampToValueAtTime(0.4, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.55);
}

function playExplosionSound() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const now = audioCtx.currentTime;
  const bufferSize = audioCtx.sampleRate * 0.8;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise  = audioCtx.createBufferSource();
  noise.buffer = buffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, now);
  filter.frequency.exponentialRampToValueAtTime(30, now + 0.8);

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.8, now);
  gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  noise.start(now);
}

// ======================================
// 3. Asset Preloading
// ======================================
const npcImages    = [];
const npcImageUrls = [
  'https://raw.githubusercontent.com/pokeapi/sprites/master/sprites/pokemon/other/showdown/1.gif',
  'https://raw.githubusercontent.com/pokeapi/sprites/master/sprites/pokemon/other/showdown/4.gif',
  'https://raw.githubusercontent.com/pokeapi/sprites/master/sprites/pokemon/other/showdown/7.gif',
  'https://raw.githubusercontent.com/pokeapi/sprites/master/sprites/pokemon/other/showdown/25.gif'
];
npcImageUrls.forEach(url => {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = url;
  npcImages.push(img);
});

const weaponSprites = {
  pistol : new Image(),
  shotgun: new Image(),
  ak     : new Image(),
  awp    : new Image()
};
weaponSprites.pistol.src  = 'https://raw.githubusercontent.com/ByMyKel/CSGO-API/main/public/images/weapons/weapon_deagle.png';
weaponSprites.shotgun.src = 'https://raw.githubusercontent.com/ByMyKel/CSGO-API/main/public/images/weapons/weapon_nova.png';
weaponSprites.ak.src      = 'https://raw.githubusercontent.com/ByMyKel/CSGO-API/main/public/images/weapons/weapon_ak47.png';
weaponSprites.awp.src     = 'https://raw.githubusercontent.com/ByMyKel/CSGO-API/main/public/images/weapons/weapon_awp.png';

// ======================================
// 4. World / Map Constants
// ======================================
const MAP_SIZE = 80;
const SHOP_POS = { x: 40.5, y: 40.5 };

const skyClouds = [
  { worldAngle: 0.15, y: 0.52, size: 95,  speed: 0.007 },
  { worldAngle: 0.45, y: 0.58, size: 120, speed: 0.005 },
  { worldAngle: 0.75, y: 0.49, size: 110, speed: 0.009 },
  { worldAngle: 1.05, y: 0.55, size: 130, speed: 0.006 },
  { worldAngle: 1.35, y: 0.50, size: 105, speed: 0.008 },
  { worldAngle: 1.65, y: 0.60, size: 115, speed: 0.004 },
  { worldAngle: 1.95, y: 0.53, size: 100, speed: 0.007 },
  { worldAngle: 2.25, y: 0.57, size: 125, speed: 0.006 },
  { worldAngle: 2.55, y: 0.48, size: 95,  speed: 0.010 },
  { worldAngle: 2.85, y: 0.56, size: 110, speed: 0.005 },
  { worldAngle: 3.15, y: 0.51, size: 120, speed: 0.008 },
  { worldAngle: 3.45, y: 0.59, size: 105, speed: 0.006 },
  { worldAngle: 3.75, y: 0.54, size: 135, speed: 0.007 },
  { worldAngle: 4.05, y: 0.50, size: 100, speed: 0.009 },
  { worldAngle: 4.35, y: 0.57, size: 115, speed: 0.005 },
  { worldAngle: 4.65, y: 0.52, size: 125, speed: 0.008 },
  { worldAngle: 4.95, y: 0.60, size: 110, speed: 0.004 },
  { worldAngle: 5.25, y: 0.49, size: 105, speed: 0.009 },
  { worldAngle: 5.55, y: 0.56, size: 120, speed: 0.006 },
  { worldAngle: 5.85, y: 0.53, size: 115, speed: 0.007 }
];

// ======================================
// 5. Game State Variables
// ======================================
let money             = 100;
let isRunning         = false;
let isShopOpen        = false;
let lastFrameTime     = 0;
let totalElapsedTime  = 0;
let screenWidth       = 0;
let screenHeight      = 0;
let focalLength       = 0;
let zBuffer           = [];
let steeringWheelAngle= 0;

// Joystick State Variables
let joystickActive = false;
let joystickMoveX  = 0; // -1 to 1
let joystickMoveY  = 0; // -1 to 1

// Touch Look Area State Variables
let lastTouchX = null;

// ======================================
// 6. Weapons
// ======================================
const weapons = {
  pistol : { name: 'Pistol',  damage: 1, range: 12, cooldown: 0.28, clipSize: 15, owned: true,  price: 0   },
  shotgun: { name: 'Shotgun', damage: 3, range: 8,  cooldown: 0.75, clipSize: 8,  owned: false, price: 120 },
  ak     : { name: 'AK-47',   damage: 1, range: 18, cooldown: 0.10, clipSize: 30, owned: false, price: 250 },
  awp    : { name: 'AWP',     damage: 5, range: 28, cooldown: 1.10, clipSize: 5,  owned: false, price: 450 }
};

let activeWeaponKey = 'pistol';
let weaponAmmo = {
  pistol : { clip: 15, reserve: 60 },
  shotgun: { clip: 8,  reserve: 32 },
  ak     : { clip: 30, reserve: 90 },
  awp    : { clip: 5,  reserve: 20 }
};

let lastShotTime = 0;
let isFiring     = false;

// ======================================
// 7. Player
// ======================================
const player = { x: 35.5, y: 40.5, angle: 0, drivingVehicle: null };
const keys   = Object.create(null);

// ======================================
// 8. City Map Generation
// ======================================
const cityMap      = Array.from({ length: MAP_SIZE }, () => Array(MAP_SIZE).fill(0));
const buildingColors = ['#8f7a6c', '#727e8a', '#a68f74', '#66757d', '#967160'];

for (let y = 0; y < MAP_SIZE; y++) {
  for (let x = 0; x < MAP_SIZE; x++) {
    if (x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1) {
      cityMap[y][x] = 1;
    }
  }
}

for (let by = 4; by < MAP_SIZE - 8; by += 12) {
  for (let bx = 4; bx < MAP_SIZE - 8; bx += 12) {
    if (bx >= 34 && bx <= 46 && by >= 34 && by <= 46) continue;
    const colorIdx = 1 + ((bx + by) % buildingColors.length);
    for (let y = by; y < by + 5; y++) {
      for (let x = bx; x < bx + 5; x++) {
        cityMap[y][x] = colorIdx;
      }
    }
  }
}

for (let y = 39; y <= 41; y++) {
  for (let x = 39; x <= 41; x++) {
    cityMap[y][x] = (x === 40 && y === 41) ? 0 : 9;
  }
}

// ======================================
// 9. Game Entities
// ======================================
const cars = [
  { x: 30.5, y: 30.5, angle: 0,             color: '#ef4444', secondaryColor: '#991b1b', typeName: 'Supercar',    speed: 0, health: 20 },
  { x: 20.5, y: 20.5, angle: Math.PI / 2,   color: '#3b82f6', secondaryColor: '#1d4ed8', typeName: 'Sports Coupe',speed: 0, health: 20 },
  { x: 60.5, y: 20.5, angle: 0,             color: '#eab308', secondaryColor: '#a16207', typeName: 'Muscle GT',   speed: 0, health: 20 },
  { x: 20.5, y: 60.5, angle: Math.PI,       color: '#10b981', secondaryColor: '#047857', typeName: 'HyperX',      speed: 0, health: 20 },
  { x: 60.5, y: 60.5, angle: -Math.PI / 2, color: '#a855f7', secondaryColor: '#6b21a8', typeName: 'Phantom V8',  speed: 0, health: 20 }
];

const npcs = [];
const npcColors = ['#f43f5e','#3b82f6','#10b981','#ec4899','#8b5cf6','#f59e0b','#06b6d4'];

for (let y = 4; y < MAP_SIZE - 4; y += 4) {
  for (let x = 4; x < MAP_SIZE - 4; x += 4) {
    if (cityMap[y][x] === 0 && !(x >= 36 && x <= 44 && y >= 36 && y <= 44)) {
      npcs.push({
        x: x + 0.5,
        y: y + 0.5,
        color   : npcColors[npcs.length % npcColors.length],
        imgIndex: npcs.length % npcImages.length,
        mode    : 'walk',
        dirX    : (Math.random() - 0.5) * 2,
        dirY    : (Math.random() - 0.5) * 2,
        health  : 2,
        vz: 0, z: 0, vx: 0, vy: 0, rot: 0,
        deadTime: 0,
        fadeAlpha: 1.0
      });
    }
  }
}

const bloodParticles   = [];
const moneyDrops       = [];
const bulletTracers    = [];
const explosionEffects = [];

// ======================================
// 10. Canvas Resize
// ======================================
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr  = Math.min(window.devicePixelRatio || 1, 1.5);
  screenWidth  = Math.max(1, Math.floor(rect.width  * dpr));
  screenHeight = Math.max(1, Math.floor(rect.height * dpr));
  canvas.width  = screenWidth;
  canvas.height = screenHeight;
  focalLength = screenWidth * 0.75;
  zBuffer     = new Float32Array(screenWidth);
}
window.addEventListener('resize', resizeCanvas);

// ======================================
// 11. Collision Helpers
// ======================================
function isTileSolid(gx, gy) {
  if (gx < 0 || gy < 0 || gx >= MAP_SIZE || gy >= MAP_SIZE) return true;
  return cityMap[gy][gx] > 0;
}

function isBlocked(x, y, isCar = false) {
  const radius = isCar ? 0.45 : 0.22;
  const minX = Math.floor(x - radius), maxX = Math.floor(x + radius);
  const minY = Math.floor(y - radius), maxY = Math.floor(y + radius);

  for (let gy = minY; gy <= maxY; gy++) {
    for (let gx = minX; gx <= maxX; gx++) {
      if (isTileSolid(gx, gy)) {
        const nearX = Math.max(gx, Math.min(x, gx + 1));
        const nearY = Math.max(gy, Math.min(y, gy + 1));
        if (Math.hypot(x - nearX, y - nearY) < radius) return true;
      }
    }
  }

  if (isCar) {
    for (const car of cars) {
      if (car !== player.drivingVehicle && Math.hypot(car.x - x, car.y - y) < 0.85) {
        return true;
      }
    }
  }
  return false;
}

// ======================================
// 12. Car Explosion
// ======================================
function triggerCarExplosion(car, carIndex) {
  playExplosionSound();

  for (let i = 0; i < 40; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.0 + Math.random() * 4.5;
    explosionEffects.push({
      x: car.x, y: car.y,
      z: 0.3 + Math.random() * 1.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      vz: 1.5 + Math.random() * 3.5,
      size: 8 + Math.random() * 16,
      life: 0.8 + Math.random() * 0.6,
      maxLife: 1.2,
      color: Math.random() > 0.3 ? '#f97316' : '#ef4444'
    });
  }

  moneyDrops.push({ x: car.x, y: car.y, amount: 150 + Math.floor(Math.random() * 100) });

  if (player.drivingVehicle === car) {
    player.drivingVehicle = null;
    speedometer.classList.add('hidden');
    crosshair.classList.remove('hidden');
    ammoCard.classList.remove('hidden');
  }

  cars.splice(carIndex, 1);
}

// ======================================
// 13. Shooting Logic
// ======================================
function shootWeapon() {
  if (isShopOpen || player.drivingVehicle) return;
  const w    = weapons[activeWeaponKey];
  const ammo = weaponAmmo[activeWeaponKey];

  if (totalElapsedTime - lastShotTime < w.cooldown) return;

  if (ammo.clip <= 0) {
    if (ammo.reserve > 0) {
      const needed   = w.clipSize - ammo.clip;
      const transfer = Math.min(needed, ammo.reserve);
      ammo.clip    += transfer;
      ammo.reserve -= transfer;
      updateUI();
    } else {
      showShopNotice('អស់គ្រាប់ហើយ! ទៅទិញគ្រាប់ពីហាងភ្លើងលឿង');
    }
    return;
  }

  ammo.clip--;
  lastShotTime = totalElapsedTime;
  playGunshotSound();
  updateUI();

  let maxDist = w.range;
  let targetX = player.x + Math.cos(player.angle) * maxDist;
  let targetY = player.y + Math.sin(player.angle) * maxDist;

  let hitCar = null, hitCarIndex = -1, hitNPC = null;
  let closestDist = maxDist;

  cars.forEach((car, idx) => {
    const dx = car.x - player.x;
    const dy = car.y - player.y;
    const forward = dx * Math.cos(player.angle) + dy * Math.sin(player.angle);
    if (forward > 0.2 && forward < closestDist) {
      const side = -dx * Math.sin(player.angle) + dy * Math.cos(player.angle);
      if (Math.abs(side) < 0.75) {
        closestDist = forward;
        hitCar = car; hitCarIndex = idx; hitNPC = null;
        targetX = player.x + Math.cos(player.angle) * forward;
        targetY = player.y + Math.sin(player.angle) * forward;
      }
    }
  });

  for (const npc of npcs) {
    if (npc.mode === 'dead') continue;
    const dx = npc.x - player.x;
    const dy = npc.y - player.y;
    const forward = dx * Math.cos(player.angle) + dy * Math.sin(player.angle);
    if (forward <= 0.2 || forward >= closestDist) continue;

    const side = -dx * Math.sin(player.angle) + dy * Math.cos(player.angle);
    const hitWidth = activeWeaponKey === 'shotgun' ? 0.8 : activeWeaponKey === 'awp' ? 0.3 : 0.45;

    if (Math.abs(side) < hitWidth) {
      closestDist = forward;
      hitNPC = npc; hitCar = null;
      targetX = player.x + Math.cos(player.angle) * forward;
      targetY = player.y + Math.sin(player.angle) * forward;
    }
  }

  const pellets = activeWeaponKey === 'shotgun' ? 4 : 1;
  for (let p = 0; p < pellets; p++) {
    const spreadAngle = player.angle + (Math.random() - 0.5) * (activeWeaponKey === 'shotgun' ? 0.12 : 0.02);
    bulletTracers.push({
      startX: player.x + Math.cos(player.angle + 0.3) * 0.3,
      startY: player.y + Math.sin(player.angle + 0.3) * 0.3,
      endX  : player.x + Math.cos(spreadAngle) * closestDist,
      endY  : player.y + Math.sin(spreadAngle) * closestDist,
      life  : 0.12, maxLife: 0.12,
      color : activeWeaponKey === 'awp' ? '#38bdf8' : '#fef08a'
    });
  }

  if (hitCar) {
    hitCar.health -= w.damage;
    for (let i = 0; i < 6; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      bloodParticles.push({
        x: targetX, y: targetY, z: 0.5,
        vx: Math.cos(pAngle) * 2, vy: Math.sin(pAngle) * 2,
        vz: 1 + Math.random() * 2, life: 0.25
      });
    }
    if (hitCar.health <= 0) triggerCarExplosion(hitCar, hitCarIndex);

  } else if (hitNPC) {
    hitNPC.health -= w.damage;
    playFunnyScreamSound();
    for (let i = 0; i < 10; i++) {
      const pAngle = Math.random() * Math.PI * 2;
      const pSpeed = 0.5 + Math.random() * 2;
      bloodParticles.push({
        x: hitNPC.x, y: hitNPC.y, z: 0.6 + Math.random() * 0.3,
        vx: Math.cos(pAngle) * pSpeed, vy: Math.sin(pAngle) * pSpeed,
        vz: 0.5 + Math.random() * 1.5, life: 0.6 + Math.random() * 0.4
      });
    }
    if (hitNPC.health <= 0) {
      hitNPC.mode = 'dead'; hitNPC.z = 0; hitNPC.deadTime = totalElapsedTime;
      moneyDrops.push({ x: hitNPC.x, y: hitNPC.y, amount: 20 + Math.floor(Math.random() * 30) });
    } else {
      hitNPC.mode = 'flee';
      hitNPC.dirX = Math.sign(hitNPC.x - player.x) || 1;
      hitNPC.dirY = Math.sign(hitNPC.y - player.y) || 0;
    }
  }
}

// ======================================
// 14. Weapon Management
// ======================================
function selectWeapon(key) {
  if (weapons[key] && weapons[key].owned) {
    activeWeaponKey = key;
    updateUI();
  } else if (weapons[key] && !weapons[key].owned) {
    showShopNotice(`អ្នកមិនទាន់មាន ${weapons[key].name} នៅឡើយទេ! សូមទិញពីហាង។`);
  }
}

function buyAmmo() {
  const COST = 20;
  if (money >= COST) {
    money -= COST;
    for (const key in weapons) {
      if (weapons[key].owned) weaponAmmo[key].reserve += 30;
    }
    showShopNotice('ទិញគ្រាប់បានជោគជ័យ! (+30 គ្រាប់)');
    updateUI();
  } else {
    showShopNotice('លុយមិនគ្រប់គ្រាន់ទេ ($20)!');
  }
}

function buyWeapon(key) {
  const w = weapons[key];
  if (!w) return;
  if (w.owned) {
    selectWeapon(key);
    showShopNotice(`បានជ្រើសរើសអាវុធ ${w.name}`);
    return;
  }
  if (money >= w.price) {
    money -= w.price;
    w.owned = true;
    weaponAmmo[key].clip    = w.clipSize;
    weaponAmmo[key].reserve = w.clipSize * 2;
    selectWeapon(key);
    showShopNotice(`បានទិញអាវុធ ${w.name} ដោយជោគជ័យ!`);
    updateUI();
  } else {
    showShopNotice(`លុយមិនគ្រប់គ្រាន់ទេ ($${w.price})!`);
  }
}

function showShopNotice(msg) { shopNotice.textContent = msg; }

// ======================================
// 15. Shop & Cheat Modal
// ======================================
function openShop() {
  if (player.drivingVehicle) return;
  isShopOpen = true;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  shopModal.classList.remove('hidden');
  showShopNotice('សូមជ្រើសរើសទំនិញដែលអ្នកចង់ទិញ');
  updateUI();
}

function closeShop() {
  isShopOpen = false;
  shopModal.classList.add('hidden');
}

function openCheatModal() {
  isShopOpen = true;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  cheatModal.classList.remove('hidden');
  cheatInput.value = '';
  cheatNotice.textContent = 'សូមវាយពាក្យបញ្ជា (ឧ. /gun, /car, /rain ឬ /snow)';
  setTimeout(() => cheatInput.focus(), 100);
  updateUI();
}

function closeCheatModal() {
  isShopOpen = false;
  cheatModal.classList.add('hidden');
}

function executeCheatCommand() {
  const cmd = cheatInput.value.trim().toLowerCase();
  if (cmd === '/gun') {
    for (const key in weapons) {
      weapons[key].owned = true;
      weaponAmmo[key].clip      = weapons[key].clipSize;
      weaponAmmo[key].reserve  += 100;
    }
    cheatNotice.textContent = '✅ បានបើកកូដអាវុធ! កាំភ្លើងទាំងអស់ត្រូវបានដោះសោរនិងបន្ថែមគ្រាប់ពេញ។';
    updateUI();
  } else if (cmd === '/car') {
    const spawnX = player.x + Math.cos(player.angle) * 2.5;
    const spawnY = player.y + Math.sin(player.angle) * 2.5;
    const carColors = ['#ef4444','#3b82f6','#10b981','#f59e0b','#a855f7'];
    cars.push({
      x: spawnX, y: spawnY, angle: player.angle,
      color: carColors[Math.floor(Math.random() * carColors.length)],
      secondaryColor: '#0f172a',
      typeName: 'Supercar GT', speed: 0, health: 20
    });
    cheatNotice.textContent = '✅ បានបង្កើតឡានស្ព័រថ្មីមួយនៅពីមុខអ្នករួចរាល់!';
  } else if (cmd === '/money') {
    money += 1000;
    cheatNotice.textContent = '✅ បានបន្ថែមលុយ $1000 រួចរាល់!';
    updateUI();
  } else if (cmd === '/rain') {
    if (isRaining) {
      stopRain();
      cheatNotice.textContent = '🌤  បានបញ្ឈប់ភ្លៀង!';
    } else {
      startRain();
      cheatNotice.textContent = '🌧  ភ្លៀងចាប់ផ្ដើមធ្លាក់ (អតិបរមា 2 នាទី)!';
    }
  } else if (cmd === '/snow') {
    if (isSnowing) {
      stopSnow();
      cheatNotice.textContent = '🌤  បានបញ្ឈប់ព្រិលទឹកកក!';
    } else {
      startSnow();
      cheatNotice.textContent = '❄️  ព្រិលទឹកកកចាប់ផ្ដើមធ្លាក់ (អតិបរមា 3 នាទី)!';
    }
  } else {
    cheatNotice.textContent = '❌ ពាក្យបញ្ជាមិនត្រឹមត្រូវ! សូមសាកល្បង /gun, /car, /money, /rain ឬ /snow';
  }
  cheatInput.value = '';
}

// ======================================
// 16. Vehicle Toggle
// ======================================
function toggleVehicle() {
  if (player.drivingVehicle) {
    const car = player.drivingVehicle;
    player.drivingVehicle = null;
    player.x = car.x + Math.sin(car.angle) * 0.9;
    player.y = car.y - Math.cos(car.angle) * 0.9;
    speedometer.classList.add('hidden');
    crosshair.classList.remove('hidden');
    ammoCard.classList.remove('hidden');
  } else {
    let nearest = null, minDist = 1.6;
    for (const car of cars) {
      const dist = Math.hypot(car.x - player.x, car.y - player.y);
      if (dist < minDist) { minDist = dist; nearest = car; }
    }
    if (nearest) {
      player.drivingVehicle = nearest;
      player.x = nearest.x; player.y = nearest.y; player.angle = nearest.angle;
      speedometer.classList.remove('hidden');
      crosshair.classList.add('hidden');
      ammoCard.classList.add('hidden');
    }
  }
  updateUI();
}

// ======================================
// 17. Game Update Loop
// ======================================
function updateGame(dt) {
  if (isShopOpen) return;

  const distToShop = Math.hypot(player.x - SHOP_POS.x, player.y - SHOP_POS.y);

  if (player.drivingVehicle) {
    const car    = player.drivingVehicle;
    let accel  = (keys.KeyW || keys.ArrowUp   ? 1 : 0) - (keys.KeyS || keys.ArrowDown  ? 1 : 0);
    let steer  = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft  ? 1 : 0);

    // Integrate Joystick to Vehicle Controls
    if (joystickActive) {
      accel = -joystickMoveY; // Push forward -> negative Y -> acceleration forward
      steer = joystickMoveX;
    }

    const maxSpeed = keys.ShiftLeft || keys.ShiftRight ? 16.0 : 12.0;

    if (accel > 0)      car.speed = Math.min( maxSpeed,        car.speed + accel * dt * 15.0);
    else if (accel < 0) car.speed = Math.max(-maxSpeed * 0.6,  car.speed + accel * dt * 18.0);
    else                car.speed *= Math.pow(0.08, dt);

    if (Math.abs(car.speed) > 0.1) {
      const steerAmt = steer * dt * (car.speed > 0 ? 2.6 : -2.6);
      car.angle += steerAmt;
      steeringWheelAngle += steerAmt * 1.5;
    } else {
      steeringWheelAngle *= 0.88;
    }

    const moveDist = car.speed * dt;
    const nextX = car.x + Math.cos(car.angle) * moveDist;
    const nextY = car.y + Math.sin(car.angle) * moveDist;

    if (!isBlocked(nextX, car.y, true)) { car.x = nextX; }
    else { car.x -= Math.cos(car.angle) * 0.25; car.speed = -car.speed * 0.3; }

    if (!isBlocked(car.x, nextY, true)) { car.y = nextY; }
    else { car.y -= Math.sin(car.angle) * 0.25; car.speed = -car.speed * 0.3; }

    if (isBlocked(car.x, car.y, true)) {
      for (let radius = 1; radius <= 3; radius++) {
        let freed = false;
        for (let dx = -radius; dx <= radius && !freed; dx++) {
          for (let dy = -radius; dy <= radius && !freed; dy++) {
            const checkX = Math.floor(car.x) + dx + 0.5;
            const checkY = Math.floor(car.y) + dy + 0.5;
            if (!isBlocked(checkX, checkY, true)) {
              car.x = checkX; car.y = checkY; car.speed = 0; freed = true;
            }
          }
        }
        if (freed) break;
      }
    }

    player.x = car.x; player.y = car.y; player.angle = car.angle;
    speedValue.textContent = Math.floor(Math.abs(car.speed) * 12);

    if (Math.abs(car.speed) > 2.5) {
      for (const npc of npcs) {
        if (npc.mode !== 'dead' && npc.mode !== 'ragdoll') {
          if (Math.hypot(npc.x - car.x, npc.y - car.y) < 0.95) {
            npc.mode = 'ragdoll'; npc.health = 0;
            playFunnyScreamSound();
            const launchAngle = car.angle + (Math.random() - 0.5) * 0.5;
            const hitPower    = Math.abs(car.speed) * 0.85;
            npc.vx = Math.cos(launchAngle) * hitPower;
            npc.vy = Math.sin(launchAngle) * hitPower;
            npc.vz = 3.2 + Math.random() * 2.0;
            npc.z  = 0.2;
            for (let i = 0; i < 20; i++) {
              const bAngle = Math.random() * Math.PI * 2;
              bloodParticles.push({
                x: npc.x, y: npc.y, z: 0.5,
                vx: Math.cos(bAngle) * (1 + Math.random() * 3.5),
                vy: Math.sin(bAngle) * (1 + Math.random() * 3.5),
                vz: 1.0 + Math.random() * 3.0,
                life: 0.8 + Math.random() * 0.5
              });
            }
            moneyDrops.push({ x: npc.x, y: npc.y, amount: 30 + Math.floor(Math.random() * 50) });
          }
        }
      }
    }

  } else {
    const moveSpeed = (keys.ShiftLeft || keys.ShiftRight ? 4.2 : 2.5) * dt;
    const turnSpeed = 2.2 * dt;

    if (keys.ArrowLeft)  player.angle -= turnSpeed;
    if (keys.ArrowRight) player.angle += turnSpeed;

    let forward = (keys.KeyW || keys.ArrowUp   ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    let strafe  = (keys.KeyD ? 1 : 0)                   - (keys.KeyA ? 1 : 0);

    // Integrate Joystick to On-Foot Movement
    if (joystickActive) {
      forward = -joystickMoveY;
      strafe  = joystickMoveX;
    }

    if (forward || strafe) {
      const norm = Math.hypot(forward, strafe) || 1;
      const dx = (Math.cos(player.angle) * forward - Math.sin(player.angle) * strafe) / norm * moveSpeed;
      const dy = (Math.sin(player.angle) * forward + Math.cos(player.angle) * strafe) / norm * moveSpeed;
      if (!isBlocked(player.x + dx, player.y)) player.x += dx;
      if (!isBlocked(player.x, player.y + dy)) player.y += dy;
    }

    if (isFiring) shootWeapon();
  }

  for (let i = npcs.length - 1; i >= 0; i--) {
    const npc = npcs[i];
    if (npc.mode === 'ragdoll') {
      npc.x += npc.vx * dt; npc.y += npc.vy * dt;
      npc.z += npc.vz * dt; npc.vz -= 12.0 * dt;
      npc.rot += 8.0 * dt;
      if (npc.z <= 0) { npc.z = 0; npc.vx = 0; npc.vy = 0; npc.mode = 'dead'; npc.deadTime = totalElapsedTime; }
    } else if (npc.mode === 'dead') {
      npc.z = 0;
      const dead = totalElapsedTime - npc.deadTime;
      if (dead > 1.5) npc.fadeAlpha = Math.max(0, 1.0 - (dead - 1.5) / 3.0);
    } else {
      const speed = npc.mode === 'flee' ? 2.2 : 0.6;
      const dx = npc.dirX * speed * dt;
      const dy = npc.dirY * speed * dt;
      if (!isBlocked(npc.x + dx, npc.y + dy)) { npc.x += dx; npc.y += dy; }
      else { npc.dirX = (Math.random() - 0.5) * 2; npc.dirY = (Math.random() - 0.5) * 2; }
    }
  }

  for (let i = bloodParticles.length - 1; i >= 0; i--) {
    const p = bloodParticles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.z += p.vz * dt; p.vz -= 9.8 * dt;
    p.life -= dt;
    if (p.life <= 0 || p.z < 0) bloodParticles.splice(i, 1);
  }

  for (let i = bulletTracers.length - 1; i >= 0; i--) {
    bulletTracers[i].life -= dt;
    if (bulletTracers[i].life <= 0) bulletTracers.splice(i, 1);
  }

  for (let i = explosionEffects.length - 1; i >= 0; i--) {
    const exp = explosionEffects[i];
    exp.x += exp.vx * dt; exp.y += exp.vy * dt;
    exp.z += exp.vz * dt; exp.vz -= 8.0 * dt;
    exp.life -= dt;
    if (exp.life <= 0) explosionEffects.splice(i, 1);
  }

  for (let i = moneyDrops.length - 1; i >= 0; i--) {
    const drop = moneyDrops[i];
    if (Math.hypot(player.x - drop.x, player.y - drop.y) < 0.8) {
      money += drop.amount;
      moneyDrops.splice(i, 1);
      updateUI();
    }
  }

  if (player.drivingVehicle) {
    activityText.textContent = 'កំពុងបើកបរឡាននៅលើផ្លូវធំទូលាយ (Cockpit View)';
    hintText.textContent = 'W/S បើកបរ/ថយក្រោយ · A/D បត់ · ចុច R ប្រសិនបើឡានគាំង · E ចុះពីឡាន';
  } else if (distToShop < 2.0) {
    activityText.textContent = 'នៅក្បែរហាងអាវុធកណ្ដាលក្រុង 🟡';
    hintText.textContent = 'ចុច E ដើម្បីចូលទិញអាវុធ និងគ្រាប់កាំភ្លើង';
  } else {
    activityText.textContent = 'រុករកទីក្រុងសេរី';
    hintText.textContent = 'ចុច E នៅជិតឡានដើម្បីជិះ · ចុច 1-4 ដូរអាវុធ · កណ្ដុរ/Space បាញ់';
  }

  coordsHUD.textContent = `X: ${Math.floor(player.x)} · Y: ${Math.floor(player.y)}`;

  // ======== Rain Timing Logic ========
  if (isRaining) {
    rainTimer += dt;
    rainFadeAlpha = Math.min(1.0, rainFadeAlpha + dt * 0.5);
    if (rainTimer >= RAIN_DURATION) {
      stopRain();
    }
  } else {
    rainFadeAlpha = Math.max(0.0, rainFadeAlpha - dt * 0.5);
    if (totalElapsedTime >= nextRainTime) {
      nextRainTime = totalElapsedTime + RAIN_INTERVAL;
      startRain();
    }
  }

  if (rainFadeAlpha > 0) {
    for (const drop of rainParticles) {
      drop.y += drop.speed * dt;
      drop.x += drop.wind * dt;
      if (drop.y > 1.05 || drop.x > 1.05) {
        drop.x   = Math.random() * 1.1 - 0.05;
        drop.y   = -0.02 - Math.random() * 0.05;
        drop.len  = 0.018 + Math.random() * 0.025;
        drop.speed= 0.5 + Math.random() * 0.4;
        drop.alpha= 0.35 + Math.random() * 0.45;
        drop.wind = 0.06 + Math.random() * 0.08;
      }
    }
  }

  // ======== Snow Timing Logic ========
  if (isSnowing) {
    snowTimer += dt;
    snowFadeAlpha = Math.min(1.0, snowFadeAlpha + dt * 0.5);
    if (snowTimer >= SNOW_DURATION) {
      stopSnow();
    }
  } else {
    snowFadeAlpha = Math.max(0.0, snowFadeAlpha - dt * 0.5);
    if (totalElapsedTime >= nextSnowTime) {
      nextSnowTime = totalElapsedTime + SNOW_INTERVAL;
      startSnow();
    }
  }

  if (snowFadeAlpha > 0) {
    for (const flake of snowParticles) {
      flake.y += flake.speed * dt;
      flake.x += flake.drift * dt;
      if (flake.y > 1.05 || flake.x > 1.05 || flake.x < -0.05) {
        flake.x     = Math.random() * 1.1 - 0.05;
        flake.y     = -0.02 - Math.random() * 0.05;
        flake.size  = 0.003 + Math.random() * 0.005;
        flake.speed = 0.1 + Math.random() * 0.2;
        flake.alpha = 0.4 + Math.random() * 0.5;
      }
    }
  }
}

// ======================================
// 18. Render
// ======================================
function render() {
  if (!screenWidth || !screenHeight) return;

  const horizon = Math.floor(screenHeight * 0.5);
  const FOV     = Math.PI / 3;

  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizon);
  skyGrad.addColorStop(0,   '#030712');
  skyGrad.addColorStop(0.6, '#0f172a');
  skyGrad.addColorStop(1,   '#1e1b4b');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, screenWidth, horizon);

  ctx.save();
  const MOON_WORLD_ANGLE = Math.PI * 0.35;
  let relMoonAngle = MOON_WORLD_ANGLE - player.angle;
  while (relMoonAngle < -Math.PI) relMoonAngle += Math.PI * 2;
  while (relMoonAngle >  Math.PI) relMoonAngle -= Math.PI * 2;

  if (Math.abs(relMoonAngle) < FOV / 1.1) {
    const moonScreenX = (screenWidth / 2) + (Math.tan(relMoonAngle) / Math.tan(FOV / 2)) * (screenWidth / 2);
    const moonScreenY = horizon * 0.32;

    const moonGlow = ctx.createRadialGradient(moonScreenX, moonScreenY, 10, moonScreenX, moonScreenY, 70);
    moonGlow.addColorStop(0,   'rgba(254, 243, 199, 0.9)');
    moonGlow.addColorStop(0.3, 'rgba(253, 224, 71, 0.25)');
    moonGlow.addColorStop(1,   'rgba(253, 224, 71, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath(); ctx.arc(moonScreenX, moonScreenY, 70, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath(); ctx.arc(moonScreenX, moonScreenY, 22, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(moonScreenX - 6, moonScreenY - 5, 4, 0, Math.PI * 2);
    ctx.arc(moonScreenX + 8, moonScreenY + 4, 5, 0, Math.PI * 2);
    ctx.arc(moonScreenX - 2, moonScreenY + 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  for (const cloud of skyClouds) {
    const currentAngle = (cloud.worldAngle + totalElapsedTime * cloud.speed) % (Math.PI * 2);
    let relCloudAngle  = currentAngle - player.angle;
    while (relCloudAngle < -Math.PI) relCloudAngle += Math.PI * 2;
    while (relCloudAngle >  Math.PI) relCloudAngle -= Math.PI * 2;

    if (Math.abs(relCloudAngle) < FOV / 0.85) {
      const cx       = (screenWidth / 2) + (Math.tan(relCloudAngle) / Math.tan(FOV / 2)) * (screenWidth / 2);
      const cy       = cloud.y * horizon;
      const baseSize = cloud.size;

      ctx.fillStyle = 'rgba(71, 85, 105, 0.28)';
      ctx.beginPath();
      ctx.arc(cx, cy + 6, baseSize * 0.58, 0, Math.PI * 2);
      ctx.arc(cx + baseSize * 0.45, cy + 8, baseSize * 0.5,  0, Math.PI * 2);
      ctx.arc(cx - baseSize * 0.45, cy + 8, baseSize * 0.48, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(148, 163, 184, 0.42)';
      ctx.beginPath();
      ctx.arc(cx,                   cy,                   baseSize * 0.52, 0, Math.PI * 2);
      ctx.arc(cx + baseSize * 0.38, cy - baseSize * 0.15, baseSize * 0.44, 0, Math.PI * 2);
      ctx.arc(cx - baseSize * 0.38, cy - baseSize * 0.12, baseSize * 0.42, 0, Math.PI * 2);
      ctx.arc(cx + baseSize * 0.72, cy + baseSize * 0.05, baseSize * 0.38, 0, Math.PI * 2);
      ctx.arc(cx - baseSize * 0.70, cy + baseSize * 0.05, baseSize * 0.36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(241, 245, 249, 0.65)';
      ctx.beginPath();
      ctx.arc(cx + baseSize * 0.12, cy - baseSize * 0.28, baseSize * 0.34, 0, Math.PI * 2);
      ctx.arc(cx - baseSize * 0.18, cy - baseSize * 0.22, baseSize * 0.30, 0, Math.PI * 2);
      ctx.arc(cx + baseSize * 0.45, cy - baseSize * 0.12, baseSize * 0.26, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  const groundGrad = ctx.createLinearGradient(0, horizon, 0, screenHeight);
  groundGrad.addColorStop(0, '#1e293b');
  groundGrad.addColorStop(1, '#0f172a');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, horizon, screenWidth, screenHeight - horizon);

  const numRays = screenWidth;
  const fov     = Math.PI / 3;

  for (let x = 0; x < numRays; x += 2) {
    const cameraX  = (2 * x / screenWidth) - 1;
    const rayAngle = player.angle + Math.atan(cameraX * Math.tan(fov / 2));

    let mapX = Math.floor(player.x);
    let mapY = Math.floor(player.y);
    const rayDirX  = Math.cos(rayAngle);
    const rayDirY  = Math.sin(rayAngle);
    const deltaDistX = Math.abs(1 / (rayDirX || 1e-5));
    const deltaDistY = Math.abs(1 / (rayDirY || 1e-5));

    let stepX, stepY, sideDistX, sideDistY;
    if (rayDirX < 0) { stepX = -1; sideDistX = (player.x - mapX) * deltaDistX; }
    else             { stepX =  1; sideDistX = (mapX + 1 - player.x) * deltaDistX; }
    if (rayDirY < 0) { stepY = -1; sideDistY = (player.y - mapY) * deltaDistY; }
    else             { stepY =  1; sideDistY = (mapY + 1 - player.y) * deltaDistY; }

    let hit = 0, side = 0;
    while (!hit) {
      if (sideDistX < sideDistY) { sideDistX += deltaDistX; mapX += stepX; side = 0; }
      else                        { sideDistY += deltaDistY; mapY += stepY; side = 1; }
      if (mapX < 0 || mapY < 0 || mapX >= MAP_SIZE || mapY >= MAP_SIZE) { hit = 1; break; }
      hit = cityMap[mapY][mapX];
    }

    const perpWallDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
    const correctedDist= Math.max(0.1, perpWallDist * Math.cos(rayAngle - player.angle));
    zBuffer[x] = zBuffer[x + 1] = correctedDist;

    const lineHeight = Math.min(screenHeight * 2, focalLength / correctedDist);
    const drawStart  = Math.max(0, horizon - lineHeight / 2);
    const drawEnd    = Math.min(screenHeight, horizon + lineHeight / 2);

    let wallColor = hit === 9 ? '#f59e0b' : buildingColors[(hit - 1) % buildingColors.length];
    if (side === 1 && hit !== 9) wallColor = '#475569';

    ctx.fillStyle = wallColor;
    ctx.fillRect(x, drawStart, 2, drawEnd - drawStart);

    if (hit === 9) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.fillRect(x, drawStart, 2, drawEnd - drawStart);
    }
  }

  const sprites = [];
  sprites.push({ x: SHOP_POS.x, y: SHOP_POS.y, type: 'shopLight' });
  for (const car of cars) {
    if (car !== player.drivingVehicle) sprites.push({ x: car.x, y: car.y, type: 'car', data: car });
  }
  for (const npc of npcs) {
    if (npc.fadeAlpha > 0.01) sprites.push({ x: npc.x, y: npc.y, z: npc.z || 0, type: 'npc', data: npc });
  }
  for (const drop of moneyDrops) sprites.push({ x: drop.x, y: drop.y, type: 'money' });

  sprites.sort((a, b) =>
    Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y)
  );

  for (const s of sprites) {
    const dx      = s.x - player.x;
    const dy      = s.y - player.y;
    const forward = dx * Math.cos(player.angle) + dy * Math.sin(player.angle);
    if (forward <= 0.2) continue;

    const side    = -dx * Math.sin(player.angle) + dy * Math.cos(player.angle);
    const screenX = screenWidth / 2 + (side / forward) * focalLength;
    const scale   = Math.min(focalLength / forward, screenHeight * 1.2);
    const groundY = horizon + scale * 0.45;

    const depthIdx = Math.max(0, Math.min(screenWidth - 1, Math.floor(screenX)));
    if (zBuffer[depthIdx] <= forward) continue;

    if (s.type === 'shopLight') {
      ctx.save();
      ctx.fillStyle  = '#fbbf24';
      ctx.globalAlpha = 0.4 + Math.sin(totalElapsedTime * 4) * 0.15;
      const w = scale * 0.6;
      ctx.fillRect(screenX - w / 2, horizon - scale * 0.8, w, scale * 1.2);
      ctx.restore();

    } else if (s.type === 'car') {
      renderCarSprite(s.data, screenX, groundY, scale, horizon);

    } else if (s.type === 'npc') {
      renderNPCSprite(s.data, screenX, groundY, scale, s.z);

    } else if (s.type === 'money') {
      ctx.fillStyle = '#22c55e';
      ctx.font = `bold ${Math.max(12, scale * 0.2)}px monospace`;
      ctx.fillText('💵 $', screenX - 10, groundY - 10);
    }
  }

  for (const p of bloodParticles) {
    const dx      = p.x - player.x;
    const dy      = p.y - player.y;
    const forward = dx * Math.cos(player.angle) + dy * Math.sin(player.angle);
    if (forward <= 0.2) continue;
    const side    = -dx * Math.sin(player.angle) + dy * Math.cos(player.angle);
    const sx      = screenWidth / 2 + (side / forward) * focalLength;
    const sc      = focalLength / forward;
    const sy      = horizon + sc * (0.45 - p.z);
    ctx.fillStyle = p.vx > 1.5 ? '#f59e0b' : '#dc2626';
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(2, sc * 0.03), 0, Math.PI * 2); ctx.fill();
  }

  for (const tracer of bulletTracers) {
    const dx1 = tracer.startX - player.x, dy1 = tracer.startY - player.y;
    const f1  = dx1 * Math.cos(player.angle) + dy1 * Math.sin(player.angle);
    const dx2 = tracer.endX - player.x,   dy2 = tracer.endY - player.y;
    const f2  = dx2 * Math.cos(player.angle) + dy2 * Math.sin(player.angle);
    if (f1 > 0.1 || f2 > 0.1) {
      const s1 = -dx1 * Math.sin(player.angle) + dy1 * Math.cos(player.angle);
      const x1 = screenWidth / 2 + (s1 / Math.max(0.1, f1)) * focalLength;
      const y1 = horizon + (focalLength / Math.max(0.1, f1)) * 0.2;
      const s2 = -dx2 * Math.sin(player.angle) + dy2 * Math.cos(player.angle);
      const x2 = screenWidth / 2 + (s2 / Math.max(0.1, f2)) * focalLength;
      const y2 = horizon + (focalLength / Math.max(0.1, f2)) * 0.1;
      ctx.save();
      ctx.strokeStyle  = tracer.color;
      ctx.lineWidth    = Math.max(2, (1 / Math.max(0.5, f2)) * 12);
      ctx.globalAlpha  = tracer.life / tracer.maxLife;
      ctx.shadowColor  = tracer.color;
      ctx.shadowBlur   = 12;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    }
  }

  for (const exp of explosionEffects) {
    const dx      = exp.x - player.x;
    const dy      = exp.y - player.y;
    const forward = dx * Math.cos(player.angle) + dy * Math.sin(player.angle);
    if (forward <= 0.2) continue;
    const side    = -dx * Math.sin(player.angle) + dy * Math.cos(player.angle);
    const sx      = screenWidth / 2 + (side / forward) * focalLength;
    const sc      = focalLength / forward;
    const sy      = horizon + sc * (0.45 - exp.z);
    ctx.save();
    ctx.fillStyle  = exp.color;
    ctx.globalAlpha = exp.life / exp.maxLife;
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(4, sc * (exp.size / 100)), 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (player.drivingVehicle) drawCarCockpitView();
  else                       drawRetroFPSGun();

  // Weather Effects Render
  drawRain();
  drawSnow();

  drawMinimap();
}

// ======================================
// 19. Car Sprite Renderer
// ======================================
function renderCarSprite(car, screenX, groundY, scale, horizon) {
  const carW = scale * 1.1;
  const carH = scale * 0.52;
  const carY = groundY - carH;

  ctx.save();

  const beamW   = carW * 1.4;
  const beamGrad = ctx.createRadialGradient(screenX, groundY, 2, screenX, groundY + scale * 0.3, beamW);
  beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
  beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
  ctx.fillStyle = beamGrad;
  ctx.beginPath(); ctx.ellipse(screenX, groundY + scale * 0.05, beamW / 2, scale * 0.1, 0, 0, Math.PI * 2); ctx.fill();

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.ellipse(screenX, groundY - scale * 0.02, carW * 0.52, scale * 0.08, 0, 0, Math.PI * 2); ctx.fill();

  const bodyGrad = ctx.createLinearGradient(screenX - carW / 2, carY, screenX + carW / 2, carY + carH);
  bodyGrad.addColorStop(0, car.color);
  bodyGrad.addColorStop(0.5, '#ffffff33');
  bodyGrad.addColorStop(1, car.secondaryColor || '#000000');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.roundRect(screenX - carW / 2, carY + carH * 0.3, carW, carH * 0.55, 8); ctx.fill();
  ctx.strokeStyle = '#0f172a'; ctx.lineWidth = Math.max(1, scale * 0.02); ctx.stroke();

  if (car.health < 20) {
    const barW = carW * 0.8, barH = Math.max(4, scale * 0.05);
    const barX = screenX - barW / 2, barY2 = carY - barH * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(barX, barY2, barW, barH);
    const hpRatio = Math.max(0, car.health / 20);
    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : hpRatio > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(barX, barY2, barW * hpRatio, barH);
  }

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(screenX - carW * 0.32, carY + carH * 0.35);
  ctx.lineTo(screenX - carW * 0.22, carY + carH * 0.02);
  ctx.lineTo(screenX + carW * 0.22, carY + carH * 0.02);
  ctx.lineTo(screenX + carW * 0.32, carY + carH * 0.35);
  ctx.closePath(); ctx.fill();

  const glassGrad = ctx.createLinearGradient(screenX, carY, screenX, carY + carH * 0.3);
  glassGrad.addColorStop(0, '#38bdf8aa'); glassGrad.addColorStop(1, '#0284c788');
  ctx.fillStyle = glassGrad;
  ctx.beginPath();
  ctx.moveTo(screenX - carW * 0.28, carY + carH * 0.33);
  ctx.lineTo(screenX - carW * 0.18, carY + carH * 0.06);
  ctx.lineTo(screenX + carW * 0.18, carY + carH * 0.06);
  ctx.lineTo(screenX + carW * 0.28, carY + carH * 0.33);
  ctx.closePath(); ctx.fill();

  const wheelR = carH * 0.26;
  const wheelY2 = groundY - wheelR * 0.8;
  [screenX - carW * 0.34, screenX + carW * 0.34].forEach(wX => {
    ctx.fillStyle = '#090d16'; ctx.beginPath(); ctx.arc(wX, wheelY2, wheelR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.arc(wX, wheelY2, wheelR * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(wX, wheelY2, wheelR * 0.25, 0, Math.PI * 2); ctx.fill();
  });

  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(screenX - carW * 0.42, carY + carH * 0.48, carH * 0.1, 0, Math.PI * 2);
  ctx.arc(screenX + carW * 0.42, carY + carH * 0.48, carH * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = car.color;
  ctx.fillRect(screenX - carW * 0.52, carY + carH * 0.28, carW * 0.08, carH * 0.12);
  ctx.fillRect(screenX + carW * 0.44, carY + carH * 0.28, carW * 0.08, carH * 0.12);

  ctx.restore();
}

// ======================================
// 20. NPC Sprite Renderer
// ======================================
function renderNPCSprite(npc, screenX, groundY, scale, z) {
  const h = scale * 0.8;
  const w = h * 0.7;
  ctx.save();
  ctx.globalAlpha = npc.fadeAlpha !== undefined ? npc.fadeAlpha : 1.0;

  if (npc.mode === 'dead') {
    const corpseW = scale * 0.8, corpseH = scale * 0.3;
    const corpseY2 = groundY - corpseH;
    ctx.translate(screenX, corpseY2 + corpseH / 2);
    ctx.rotate(Math.PI / 2);
    const img = npcImages[npc.imgIndex];
    if (img && img.complete && img.naturalWidth !== 0) ctx.drawImage(img, -corpseH / 2, -corpseW / 2, corpseH, corpseW);
    else { ctx.fillStyle = '#7f1d1d'; ctx.fillRect(-corpseH / 2, -corpseW / 2, corpseH, corpseW); }
  } else {
    const spriteY = groundY - h - (z * scale);
    ctx.translate(screenX, spriteY + h / 2);
    if (npc.mode === 'ragdoll') ctx.rotate(npc.rot);
    const img = npcImages[npc.imgIndex];
    if (img && img.complete && img.naturalWidth !== 0) ctx.drawImage(img, -w / 2, -h / 2, w, h);
    else { ctx.fillStyle = npc.color; ctx.fillRect(-w / 2, -h / 2, w, h * 0.65); }
  }

  ctx.restore();
}

// ======================================
// 21. Cockpit View
// ======================================
function drawCarCockpitView() {
  ctx.save();
  const car      = player.drivingVehicle;
  const carColor = car ? car.color : '#ef4444';

  ctx.fillStyle = '#0f172a';

  ctx.beginPath();
  ctx.moveTo(0, screenHeight);
  ctx.lineTo(0, screenHeight * 0.65);
  ctx.quadraticCurveTo(screenWidth * 0.5, screenHeight * 0.58, screenWidth, screenHeight * 0.65);
  ctx.lineTo(screenWidth, screenHeight);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(screenWidth * 0.18, 0);
  ctx.lineTo(screenWidth * 0.1, screenHeight * 0.68);
  ctx.lineTo(0, screenHeight * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(screenWidth, 0);
  ctx.lineTo(screenWidth * 0.82, 0);
  ctx.lineTo(screenWidth * 0.9, screenHeight * 0.68);
  ctx.lineTo(screenWidth, screenHeight * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(0, 0, screenWidth, screenHeight * 0.08);

  ctx.fillStyle = carColor;
  ctx.beginPath();
  ctx.moveTo(screenWidth * 0.25, screenHeight * 0.64);
  ctx.lineTo(screenWidth * 0.75, screenHeight * 0.64);
  ctx.lineTo(screenWidth * 0.85, screenHeight * 0.7);
  ctx.lineTo(screenWidth * 0.15, screenHeight * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(screenWidth * 0.42, screenHeight * 0.05, screenWidth * 0.16, screenHeight * 0.09);
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 3;
  ctx.strokeRect(screenWidth * 0.42, screenHeight * 0.05, screenWidth * 0.16, screenHeight * 0.09);

  const wheelX = screenWidth * 0.35;
  const wheelY = screenHeight * 0.82;
  const wheelRadius = screenHeight * 0.22;
  ctx.save();
  ctx.translate(wheelX, wheelY);
  ctx.rotate(steeringWheelAngle);

  ctx.strokeStyle = '#334155'; ctx.lineWidth = 18;
  ctx.beginPath(); ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#020617'; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(0, 0, wheelRadius * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(0, 0, wheelRadius * 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#475569'; ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-wheelRadius, 0); ctx.lineTo(wheelRadius, 0);
  ctx.moveTo(0, 0); ctx.lineTo(0, wheelRadius);
  ctx.stroke();
  ctx.restore();

  const gaugeX = screenWidth * 0.65;
  const gaugeY = screenHeight * 0.78;
  ctx.fillStyle = '#020617'; ctx.beginPath(); ctx.arc(gaugeX, gaugeY, 32, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 12px monospace';
  ctx.fillText(`${Math.floor(Math.abs(car ? car.speed : 0) * 12)} KM/H`, gaugeX - 22, gaugeY + 4);

  ctx.restore();
}

// ======================================
// 22. FPS Gun Renderer
// ======================================
function drawRetroFPSGun() {
  const img = weaponSprites[activeWeaponKey];
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const isShooting = totalElapsedTime - lastShotTime < 0.12;
  const kickbackY  = isShooting ? 18 : 0;
  const kickbackX  = isShooting ? (Math.random() - 0.5) * 8 : 0;
  const gunWidth   = screenWidth * 0.38;
  const gunHeight  = gunWidth * (img.naturalHeight / img.naturalWidth);
  const gunX       = screenWidth * 0.62 - gunWidth / 2 + kickbackX;
  const gunY       = screenHeight - gunHeight + 30 + kickbackY;

  ctx.save();
  if (isShooting) {
    ctx.fillStyle = '#fef08a'; ctx.beginPath(); ctx.arc(gunX + gunWidth * 0.15, gunY + gunHeight * 0.2, 35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f97316'; ctx.beginPath(); ctx.arc(gunX + gunWidth * 0.15, gunY + gunHeight * 0.2, 20, 0, Math.PI * 2); ctx.fill();
  }
  ctx.drawImage(img, gunX, gunY, gunWidth, gunHeight);
  ctx.restore();
}

// ======================================
// 23-A. Rain Renderer
// ======================================
function drawRain() {
  if (rainFadeAlpha <= 0) return;

  const W = screenWidth;
  const H = screenHeight;
  const masterAlpha = rainFadeAlpha;

  ctx.save();

  ctx.fillStyle = `rgba(10, 20, 40, ${0.28 * masterAlpha})`;
  ctx.fillRect(0, 0, W, H);

  ctx.lineCap = 'round';

  for (const drop of rainParticles) {
    const x1 = drop.x * W;
    const y1 = drop.y * H;
    const x2 = x1 + drop.wind  * W * drop.len * 0.9;
    const y2 = y1 + drop.speed * H * drop.len * 1.2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, `rgba(180, 210, 255, ${drop.alpha * masterAlpha})`);
    grad.addColorStop(1, `rgba(130, 180, 255, 0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth   = 1.1;
    ctx.stroke();
  }

  const splashCount = Math.floor(6 * masterAlpha);
  for (let i = 0; i < splashCount; i++) {
    const t    = (totalElapsedTime * (1.3 + i * 0.37)) % 1.0;
    const sx   = ((i * 137.5 + totalElapsedTime * 18) % 1.0) * W;
    const sy   = screenHeight * 0.5 + ((i * 97.3) % 1.0) * screenHeight * 0.5;
    const r    = t * 10 * masterAlpha;
    const sAlpha = (1 - t) * 0.35 * masterAlpha;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(140, 190, 255, ${sAlpha})`;
    ctx.lineWidth   = 0.8;
    ctx.stroke();
  }

  if (masterAlpha > 0.3) {
    const badgeAlpha = Math.min(1, (masterAlpha - 0.3) / 0.7);
    const timeLeft   = Math.max(0, Math.ceil(RAIN_DURATION - rainTimer));
    const mm         = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const ss         = (timeLeft % 60).toString().padStart(2, '0');

    ctx.globalAlpha = badgeAlpha;
    ctx.fillStyle   = 'rgba(15, 30, 60, 0.82)';
    const bx = W / 2 - 68, by = 10, bw = 136, bh = 28;
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();

    ctx.fillStyle = 'rgba(100, 180, 255, 0.5)';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();

    ctx.fillStyle   = '#bfdbfe';
    ctx.font        = 'bold 12px system-ui, sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(`🌧  ភ្លៀង — ${mm}:${ss} នៅសល់`, W / 2, by + bh / 2);
    ctx.textAlign   = 'left';
    ctx.textBaseline= 'alphabetic';
  }

  ctx.restore();
}

// ======================================
// 23-B. Snow Renderer
// ======================================
function drawSnow() {
  if (snowFadeAlpha <= 0) return;

  const W = screenWidth;
  const H = screenHeight;
  const masterAlpha = snowFadeAlpha;

  ctx.save();

  ctx.fillStyle = `rgba(240, 244, 248, ${0.15 * masterAlpha})`;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = `rgba(255, 255, 255, ${masterAlpha})`;
  for (const flake of snowParticles) {
    const fx = flake.x * W;
    const fy = flake.y * H;
    const fSize = Math.max(1.5, flake.size * W);

    ctx.globalAlpha = flake.alpha * masterAlpha;
    ctx.beginPath();
    ctx.arc(fx, fy, fSize, 0, Math.PI * 2);
    ctx.fill();
  }

  if (masterAlpha > 0.3) {
    const badgeAlpha = Math.min(1, (masterAlpha - 0.3) / 0.7);
    const timeLeft   = Math.max(0, Math.ceil(SNOW_DURATION - snowTimer));
    const mm         = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const ss         = (timeLeft % 60).toString().padStart(2, '0');

    ctx.globalAlpha = badgeAlpha;
    ctx.fillStyle   = 'rgba(30, 41, 59, 0.82)';
    const bx = W / 2 - 75, by = 45, bw = 150, bh = 28;
    
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 8);
    ctx.fill();

    ctx.fillStyle   = '#e2e8f0';
    ctx.font        = 'bold 12px system-ui, sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(`❄️ ព្រិលធ្លាក់ — ${mm}:${ss} នៅសល់`, W / 2, by + bh / 2);
    ctx.textAlign   = 'left';
    ctx.textBaseline= 'alphabetic';
  }

  ctx.restore();
}

// ======================================
// 24. Minimap Renderer
// ======================================
function drawMinimap() {
  const size = minimapCanvas.width;
  const cell = size / MAP_SIZE;
  mctx.fillStyle = '#0f172a'; mctx.fillRect(0, 0, size, size);

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      if (cityMap[y][x] === 9)       { mctx.fillStyle = '#f59e0b'; mctx.fillRect(x * cell, y * cell, cell, cell); }
      else if (cityMap[y][x] > 0)    { mctx.fillStyle = '#475569'; mctx.fillRect(x * cell, y * cell, cell, cell); }
    }
  }

  mctx.fillStyle = '#ffffff'; mctx.font = 'bold 9px sans-serif';
  mctx.fillText('S', SHOP_POS.x * cell - 3, SHOP_POS.y * cell + 3);

  for (const car of cars) {
    mctx.fillStyle = car.color;
    mctx.fillRect(car.x * cell - 2, car.y * cell - 2, 4, 4);
  }

  mctx.fillStyle = '#38bdf8';
  mctx.beginPath(); mctx.arc(player.x * cell, player.y * cell, 3, 0, Math.PI * 2); mctx.fill();
  mctx.strokeStyle = '#38bdf8';
  mctx.beginPath();
  mctx.moveTo(player.x * cell, player.y * cell);
  mctx.lineTo(player.x * cell + Math.cos(player.angle) * 8, player.y * cell + Math.sin(player.angle) * 8);
  mctx.stroke();
}

// ======================================
// 25. UI Update
// ======================================
function updateUI() {
  cashHUD.textContent     = money;
  shopModalCash.textContent = money;
  const w    = weapons[activeWeaponKey];
  const ammo = weaponAmmo[activeWeaponKey];
  weaponNameHUD.textContent  = w.name;
  clipAmmoHUD.textContent    = ammo.clip;
  reserveAmmoHUD.textContent = ammo.reserve;

  buyShotgunBtn.textContent = weapons.shotgun.owned ? 'មានស្រាប់' : `ទិញ $${weapons.shotgun.price}`;
  buyAKBtn.textContent      = weapons.ak.owned      ? 'មានស្រាប់' : `ទិញ $${weapons.ak.price}`;
  buyAWPBtn.textContent     = weapons.awp.owned     ? 'មានស្រាប់' : `ទិញ $${weapons.awp.price}`;
}

// ======================================
// 26. Game Loop
// ======================================
function gameLoop(timestamp) {
  if (!isRunning) return;
  const dt = Math.min((timestamp - lastFrameTime) / 1000 || 0, 0.05);
  lastFrameTime     = timestamp;
  totalElapsedTime += dt;
  updateGame(dt);
  render();
  requestAnimationFrame(gameLoop);
}

// ======================================
// 27. Event Listeners & Touch Controls
// ======================================
startButton.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  isRunning     = true;
  lastFrameTime = performance.now();
  initAudio();
  if (!('ontouchstart' in window)) {
    canvas.requestPointerLock();
  }
  requestAnimationFrame(gameLoop);
});

closeShopBtn.addEventListener('click', closeShop);
exitShopModalBtn.addEventListener('click', closeShop);
buyAmmoBtn.addEventListener('click', buyAmmo);
buyPistolBtn.addEventListener('click',  () => buyWeapon('pistol'));
buyShotgunBtn.addEventListener('click', () => buyWeapon('shotgun'));
buyAKBtn.addEventListener('click',      () => buyWeapon('ak'));
buyAWPBtn.addEventListener('click',     () => buyWeapon('awp'));

openCheatBtn.addEventListener('click', openCheatModal);
closeCheatBtn.addEventListener('click', closeCheatModal);
submitCheatBtn.addEventListener('click', executeCheatCommand);
cheatInput.addEventListener('keydown', e => { if (e.key === 'Enter') executeCheatCommand(); });

// Fullscreen Toggle
fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    gameContainer.requestFullscreen().catch(err => {
      console.log('Fullscreen error:', err);
    });
  } else {
    document.exitFullscreen();
  }
});

// Exit Fullscreen Button
exitFullscreenBtn.addEventListener('click', () => {
  document.exitFullscreen();
});

// Handle fullscreen change to update UI
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    exitFullscreenBtn.classList.remove('hidden');
  } else {
    exitFullscreenBtn.classList.add('hidden');
  }
  resizeCanvas();
});

// Mouse Input
const MOUSE_SENSITIVITY = 0.0035;

document.addEventListener('mousemove', e => {
  if (!isRunning || isShopOpen) return;
  if (document.pointerLockElement === canvas) {
    player.angle += e.movementX * MOUSE_SENSITIVITY;
    if (player.drivingVehicle) {
      player.drivingVehicle.angle = player.angle;
      steeringWheelAngle += e.movementX * 0.01;
    }
  }
});

canvas.addEventListener('click', () => {
  if (isRunning && !isShopOpen && document.pointerLockElement !== canvas && !('ontouchstart' in window)) {
    canvas.requestPointerLock();
  }
});

// Keyboard Input
window.addEventListener('keydown', e => {
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;

  if ((e.key === '/' || e.code === 'Slash') && !isShopOpen && startOverlay.classList.contains('hidden')) {
    e.preventDefault();
    openCheatModal();
    return;
  }

  if (e.code === 'KeyR' && player.drivingVehicle) {
    const car = player.drivingVehicle;
    car.x = Math.floor(car.x) + 0.5;
    car.y = Math.floor(car.y) + 0.5;
    car.speed = 0;
    showShopNotice('ដោះឡានគាំងជោគជ័យ!');
  }

  if (e.code === 'KeyE') {
    const distToShop = Math.hypot(player.x - SHOP_POS.x, player.y - SHOP_POS.y);
    if (distToShop < 2.0 && !player.drivingVehicle) openShop();
    else toggleVehicle();
  }

  if (e.code === 'Digit1') selectWeapon('pistol');
  if (e.code === 'Digit2') selectWeapon('shotgun');
  if (e.code === 'Digit3') selectWeapon('ak');
  if (e.code === 'Digit4') selectWeapon('awp');
});

window.addEventListener('keyup', e => { keys[e.code] = false; });

window.addEventListener('mousedown', e => {
  if (e.button === 0 && document.pointerLockElement === canvas && !isShopOpen) {
    isFiring = true;
    shootWeapon();
  }
});

window.addEventListener('mouseup', e => { if (e.button === 0) isFiring = false; });

// ======================================
// Touch Control Handlers (Mobile Support)
// ======================================
if (touchJoystick) {
  const maxRadius = 40;

  touchJoystick.addEventListener('touchstart', e => {
    e.preventDefault();
    joystickActive = true;
    updateJoystick(e.touches[0]);
  });

  touchJoystick.addEventListener('touchmove', e => {
    e.preventDefault();
    if (joystickActive) updateJoystick(e.touches[0]);
  });

  const resetJoystick = e => {
    e.preventDefault();
    joystickActive = false;
    joystickMoveX  = 0;
    joystickMoveY  = 0;
    joystickKnob.style.transform = 'translate(0px, 0px)';
  };

  touchJoystick.addEventListener('touchend', resetJoystick);
  touchJoystick.addEventListener('touchcancel', resetJoystick);

  function updateJoystick(touch) {
    const rect = touchJoystick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    joystickMoveX = dx / maxRadius;
    joystickMoveY = dy / maxRadius;
  }
}

// Touch Screen Look Area (Slide right side of screen to rotate view)
canvas.addEventListener('touchstart', e => {
  if (!isRunning || isShopOpen) return;
  for (let i = 0; i < e.touches.length; i++) {
    if (e.touches[i].clientX > window.innerWidth / 2) {
      lastTouchX = e.touches[i].clientX;
    }
  }
});

canvas.addEventListener('touchmove', e => {
  if (!isRunning || isShopOpen) return;
  for (let i = 0; i < e.touches.length; i++) {
    if (e.touches[i].clientX > window.innerWidth / 2) {
      if (lastTouchX !== null) {
        const deltaX = e.touches[i].clientX - lastTouchX;
        player.angle += deltaX * 0.008;
        if (player.drivingVehicle) {
          player.drivingVehicle.angle = player.angle;
          steeringWheelAngle += deltaX * 0.02;
        }
      }
      lastTouchX = e.touches[i].clientX;
    }
  }
});

canvas.addEventListener('touchend', () => { lastTouchX = null; });

// Mobile Buttons Event Listeners
if (btnActionE) {
  btnActionE.addEventListener('touchstart', e => {
    e.preventDefault();
    const distToShop = Math.hypot(player.x - SHOP_POS.x, player.y - SHOP_POS.y);
    if (distToShop < 2.0 && !player.drivingVehicle) openShop();
    else toggleVehicle();
  });
}

if (btnShoot) {
  btnShoot.addEventListener('touchstart', e => {
    e.preventDefault();
    isFiring = true;
    shootWeapon();
  });
  btnShoot.addEventListener('touchend', e => {
    e.preventDefault();
    isFiring = false;
  });
}

if (btnWp1) btnWp1.addEventListener('touchstart', e => { e.preventDefault(); selectWeapon('pistol'); });
if (btnWp2) btnWp2.addEventListener('touchstart', e => { e.preventDefault(); selectWeapon('shotgun'); });
if (btnWp3) btnWp3.addEventListener('touchstart', e => { e.preventDefault(); selectWeapon('ak'); });
if (btnWp4) btnWp4.addEventListener('touchstart', e => { e.preventDefault(); selectWeapon('awp'); });

// ======================================
// 28. Init
// ======================================
resizeCanvas();
updateUI();
