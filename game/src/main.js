// VICE HARBOR — the harbour master. Boots the renderer and the sunset,
// builds Port Azura, wires every system together (city, traffic, crowds,
// Azura PD, Marina's jobs, HUD, sound), runs the loop, and owns the
// consequences: theft, crashes, busts, hospital bills and the save file.

import * as THREE from 'three';
import { HALF, SAVE_KEY } from './config.js';
import { mulberry32 } from './rng.js';
import { buildCity } from './city.js';
import { Traffic, spawnParkedCars, buildCarMesh, stepCar, syncCarMesh } from './cars.js';
import { Player, Input } from './player.js';
import { Pedestrians } from './people.js';
import { Police } from './police.js';
import { Missions, FIXER_NAME } from './missions.js';
import { Hud } from './hud.js';
import { SoundEngine } from './sound.js';
import { setupShot } from './poses.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdd9a68, 190, 640);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 1500);
camera.position.set(0, 9, 40);

// the sunset sky: a gradient dome and a low sun in the west
{
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 24, 14),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: [
        'varying vec3 vP;',
        'void main(){',
        '  float h = normalize(vP).y;',
        '  vec3 top = vec3(0.13, 0.25, 0.55);',
        '  vec3 mid = vec3(0.96, 0.62, 0.38);',
        '  vec3 low = vec3(1.0, 0.78, 0.52);',
        '  vec3 col = h > 0.16 ? mix(mid, top, smoothstep(0.16, 0.65, h)) : mix(low, mid, smoothstep(-0.06, 0.16, h));',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
      ].join('\n'),
    }));
  scene.add(dome);
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(34, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffe9b0, fog: false }));
  sunDisc.position.set(-760, 150, 260);
  scene.add(sunDisc);
}

const hemi = new THREE.HemisphereLight(0x9db8e8, 0xcf9a6a, 0.85);
scene.add(hemi);
const sunlight = new THREE.DirectionalLight(0xffc98a, 1.9);
sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048);
sunlight.shadow.camera.left = -95;
sunlight.shadow.camera.right = 95;
sunlight.shadow.camera.top = 95;
sunlight.shadow.camera.bottom = -95;
sunlight.shadow.camera.far = 520;
sunlight.shadow.bias = -0.0006;
scene.add(sunlight);
scene.add(sunlight.target);

// ---- build the world ---------------------------------------------------------
const rng = mulberry32(20261124);
const city = buildCity(scene, rng);
const colliders = city.colliders;
const traffic = new Traffic(scene, rng, 24);
const parked = spawnParkedCars(scene, rng, 20);
const crowds = new Pedestrians(scene, rng, 42);
const police = new Police(scene, colliders);
const player = new Player(scene);
const input = new Input(canvas);
const hud = new Hud();
const sound = new SoundEngine();

let cash = 0;
let state = 'title'; // title | play | pause | busted | wrecked | complete | shot
let bustMeter = 0;
let crashCooldown = 0;
let elapsed = 0;
let frozen = false;

// ---- save / load ---------------------------------------------------------------
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash,
      mission: missions.index,
      complete: missions.storyDone,
    }));
  } catch (e) { /* private browsing: the harbour forgets */ }
}
function loadGame() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  } catch (e) { return null; }
}
function earn(n) {
  cash = Math.max(0, cash + n);
  hud.setCash(cash);
  if (n > 0) sound.play('cash');
  saveGame();
}

const missions = new Missions(scene, {
  toast: (who, line) => hud.toast(who, line),
  cash: (n) => earn(n),
  heat: (n) => police.addHeat(n),
  sfx: (n) => sound.play(n),
  storyComplete: () => {
    saveGame();
    state = 'complete';
    fillStats('completestats');
    showScreen('complete');
  },
  specialCar: (spot) => {
    const mesh = buildCarMesh(4, 0xff2e88); // the one pink Marina GT in town
    const heading = 0.7;
    const x = spot.x + 14;
    const z = spot.z - 10;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    parked.push({
      mesh, type: mesh.userData.type, typeIdx: 4, name: 'Marina GT',
      parked: true, stolen: false, special: true,
      state: { x, z, heading, speed: 0, steerVis: 0 },
    });
  },
});

const saved = loadGame();
if (saved) {
  cash = saved.cash || 0;
  missions.index = Math.min(saved.mission || 0, 5);
  missions.storyDone = !!saved.complete;
}
hud.setCash(cash);

// a small handle so headless play-tests can place Rio and read the world
window.__vh = {
  player, parked, missions, police, traffic, crowds,
  getCash: () => cash,
  getState: () => state,
};

// ---- screens ---------------------------------------------------------------------
const el = (id) => document.getElementById(id);
function showScreen(id) {
  for (const s of ['title', 'pause', 'busted', 'wrecked', 'complete']) el(s).classList.add('hidden');
  if (id) el(id).classList.remove('hidden');
}
function fillStats(id) {
  el(id).textContent = `Cash $${cash.toLocaleString('en-US')} · Jobs done ${missions.index} of 5 · Wanted level ${police.stars}`;
}
el('startbtn').onclick = () => { sound.ensure(); startGame(); };
el('resumebtn').onclick = () => { state = 'play'; showScreen(null); };
el('bustedbtn').onclick = () => respawn(-84, -84);
el('wreckedbtn').onclick = () => respawn(168, -168);
el('completebtn').onclick = () => { state = 'play'; showScreen(null); };

function startGame() {
  showScreen(null);
  state = 'play';
  if (!missions.active && !missions.storyDone) missions.beginNext();
  else if (missions.storyDone) hud.toast(FIXER_NAME, 'Free roam, Rio. The harbour is yours — the PD still has opinions.');
}
function respawn(x, z) {
  player.mode = 'foot';
  player.car = null;
  player.mesh.visible = true;
  player.x = x;
  player.z = z;
  player.health = 100;
  police.clear();
  bustMeter = 0;
  state = 'play';
  showScreen(null);
}

// ---- crime and consequences ---------------------------------------------------------
function hurt(amount) {
  player.health = Math.max(0, player.health - amount);
  if (player.health <= 0 && state === 'play') {
    sound.play('fail');
    const fee = Math.min(cash, 200);
    cash -= fee;
    hud.setCash(cash);
    fillStats('wreckedstats');
    state = 'wrecked';
    showScreen('wrecked');
    saveGame();
  }
}
function onBuildingHit(impactSpeed) {
  if (crashCooldown > 0) return;
  crashCooldown = 0.5;
  sound.play('crash');
  hurt(Math.min(22, impactSpeed * 0.9));
  if (impactSpeed > 11) police.addHeat(0.4);
}
function nearestParked() {
  let best = null, bd = 3.4;
  for (const car of parked) {
    if (car === player.car) continue;
    const d = Math.hypot(car.state.x - player.x, car.state.z - player.z);
    if (d < bd) { bd = d; best = car; }
  }
  return best;
}
function enterCar(car) {
  player.mode = 'car';
  player.car = car;
  car.parked = false;
  player.mesh.visible = false;
  sound.ensure();
  sound.play('enter');
  if (!car.stolen) {
    car.stolen = true;
    police.addHeat(1);
    hud.toast('PORT AZURA', 'Vehicle stolen. Azura PD has been notified.');
  }
}
function exitCar() {
  const car = player.car;
  car.parked = true;
  car.state.speed = 0;
  player.x = car.state.x + Math.cos(car.state.heading) * 2.4;
  player.z = car.state.z - Math.sin(car.state.heading) * 2.4;
  player.mode = 'foot';
  player.car = null;
  player.mesh.visible = true;
}

// ---- edge-triggered keys --------------------------------------------------------------
let fWas = false, pWas = false, mWas = false;
function edgeKeys() {
  const f = input.down('KeyF');
  if (f && !fWas && state === 'play') {
    if (player.mode === 'foot') {
      const car = nearestParked();
      if (car) enterCar(car);
    } else if (Math.abs(player.car.state.speed) < 1.2) {
      exitCar();
    }
  }
  fWas = f;
  const p = input.down('KeyP', 'Escape');
  if (p && !pWas) {
    if (state === 'play') { state = 'pause'; fillStats('pausestats'); showScreen('pause'); }
    else if (state === 'pause') { state = 'play'; showScreen(null); }
  }
  pWas = p;
  const m = input.down('KeyM');
  if (m && !mWas) { sound.ensure(); sound.setMuted(!sound.muted); }
  mWas = m;
}

// ---- the loop ----------------------------------------------------------------------------
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;
  crashCooldown = Math.max(0, crashCooldown - dt);
  const ppos = player.pos;

  sunlight.position.set(ppos.x - 190, 150, ppos.z + 90);
  sunlight.target.position.set(ppos.x, 0, ppos.z);
  city.update(elapsed);

  if (!frozen && state !== 'pause') {
    if (state === 'play' || state === 'title') {
      const threats = traffic.cars.map((c) => ({ x: c.x, z: c.z, speed: c.speed }));
      if (player.mode === 'car') threats.push({ x: ppos.x, z: ppos.z, speed: Math.abs(ppos.speed) });
      traffic.update(dt, state === 'play' ? ppos : null);
      crowds.update(dt, threats);
    }
    if (state === 'play') {
      edgeKeys();
      if (player.mode === 'foot') {
        player.update(dt, input, colliders);
        const near = nearestParked();
        hud.prompt(near ? '<b>F</b> — take the ' + near.name : null);
        sound.engine(0, false);
      } else {
        const car = player.car;
        hud.prompt(Math.abs(car.state.speed) < 1.2 ? '<b>F</b> — get out' : null);
        const drive = {
          throttle: input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']),
          steer: input.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']),
          brake: input.down('Space'),
        };
        car.state.steerVis = drive.steer * 0.42;
        stepCar(car.state, car.type, drive, dt, colliders, onBuildingHit);
        syncCarMesh(car.state, car.mesh, dt);
        player.x = car.state.x;
        player.z = car.state.z;
        player.heading = car.state.heading;
        for (const t of traffic.cars) {
          if (Math.hypot(t.x - car.state.x, t.z - car.state.z) < 3.1 &&
              Math.abs(car.state.speed) > 6 && crashCooldown <= 0) {
            crashCooldown = 0.6;
            sound.play('crash');
            hurt(5);
            police.addHeat(0.7);
            car.state.speed *= 0.5;
          }
        }
        for (const w of crowds.walkers) {
          if (w.downFor > 0) continue;
          if (Math.hypot(w.x - car.state.x, w.z - car.state.z) < 1.8 && Math.abs(car.state.speed) > 3.5) {
            crowds.knockDown(w);
            sound.play('crash');
            hurt(3);
            police.addHeat(1.5);
            hud.toast('PORT AZURA', 'You hit a pedestrian. The whole street saw it.');
          }
        }
        sound.engine(car.state.speed / car.type.top, true);
      }
      police.update(dt, player, elapsed);
      let nearestCop = Infinity;
      for (const u of police.units) {
        if (!u.active) continue;
        const d = Math.hypot(u.state.x - ppos.x, u.state.z - ppos.z);
        nearestCop = Math.min(nearestCop, d);
        if (player.mode === 'car' && d < 3.2 && Math.abs(player.car.state.speed) > 4 && crashCooldown <= 0) {
          crashCooldown = 0.7;
          sound.play('crash');
          hurt(6);
          player.car.state.speed *= 0.45;
        }
      }
      sound.siren(nearestCop < 70 ? 1 - nearestCop / 80 : 0, elapsed);
      const mySpeed = player.mode === 'car' ? Math.abs(player.car.state.speed) : player.speed;
      if (police.stars > 0 && nearestCop < 8 && mySpeed < 2.2) {
        bustMeter += dt;
        if (bustMeter > 3) {
          const fine = Math.min(cash, 150 + police.stars * 100);
          cash -= fine;
          hud.setCash(cash);
          sound.play('busted');
          fillStats('bustedstats');
          state = 'busted';
          showScreen('busted');
          saveGame();
        }
      } else {
        bustMeter = Math.max(0, bustMeter - dt * 1.6);
      }
      if (police.stars === 0 && player.health > 0) {
        player.health = Math.min(100, player.health + dt * 1.4);
      }
      missions.update(dt, {
        pos: ppos,
        inCar: player.mode === 'car',
        inSpecialCar: player.mode === 'car' && !!player.car.special,
        heat: police.heat,
      });
    }
    if (state === 'title') {
      const t = elapsed * 0.05;
      camera.position.set(Math.sin(t) * 120, 26 + Math.sin(elapsed * 0.13) * 5, Math.cos(t) * 120 - 10);
      camera.lookAt(0, 6, 0);
    } else if (state !== 'shot') {
      player.updateCamera(dt, input, camera);
    }
  }

  hud.setStars(police.stars);
  hud.setVitals(player.health / 100);
  if (state === 'play' || state === 'title' || state === 'shot') {
    const active = missions.active;
    hud.setJob(
      active ? active.job.title : (missions.storyDone ? 'FREE ROAM' : 'VICE HARBOR'),
      active ? missions.objectiveLine(ppos) : (missions.storyDone ? 'Every job done — Port Azura is yours.' : ''),
      missions.clockLine());
    hud.setRide(player.mode === 'car'
      ? `${player.car.name} · <span>${Math.round(Math.abs(player.car.state.speed) * 3.6)} km/h</span>`
      : '');
    const st = missions.stage();
    hud.drawMap(
      { x: ppos.x, z: ppos.z, heading: player.heading },
      st && st.at ? st.at : null,
      police.units, elapsed);
  }
  hud.update();
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// screenshot poses (?shot=title|chase|onfoot|mission) — see poses.js
const shotName = new URLSearchParams(location.search).get('shot');
if (shotName) {
  frozen = true;
  setupShot(shotName, { scene, player, police, traffic, crowds, missions, hud, camera, parked });
  if (shotName === 'title') {
    state = 'title';
    showScreen('title');
  } else {
    state = 'shot';
    showScreen(null);
  }
}
animate();
