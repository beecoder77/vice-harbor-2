// Port Azura, built in code: the street grid with its markings, six by six
// blocks of sun-bleached towers, the market plaza, the fountain park,
// Marina's Workshop, the beach, the marina pier and the animated sea.
// Returns the building colliders every moving thing must respect, plus an
// update() that keeps the water and the tower beacon alive.

import * as THREE from 'three';
import { BLOCK, ROAD, PITCH, GRID, HALF, CITY, SHORE_Z, PALETTE } from './config.js';
import { pickFrom, between, intBetween } from './rng.js';

// Centre lines of every street, both directions (the grid is square).
export const streetCentres = [];
for (let k = 0; k <= GRID; k++) streetCentres.push(-HALF + ROAD / 2 + k * PITCH);

const FACADE_TONES = ['#cf7350', '#dfa75e', '#84b6cc', '#eae2cd', '#bb5f74', '#6483ab', '#8f74bd', '#dd8438', '#6cab90', '#cbc4b2'];

function paintFacade(rng, tone) {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const g = cv.getContext('2d');
  g.fillStyle = tone; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(30,20,10,0.20)'; g.fillRect(0, 244, 128, 12);
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < 6; col++) {
      const lit = rng() < 0.36;
      g.fillStyle = lit ? (rng() < 0.55 ? '#ffda8f' : '#c4ecff') : 'rgba(16,22,40,0.85)';
      g.fillRect(8 + col * 20, 12 + row * 20, 12, 12);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function paintRoof(rng) {
  const cv = document.createElement('canvas');
  cv.width = 64; cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = '#494e5c'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.09)';
  for (let i = 0; i < 26; i++) g.fillRect(rng() * 60, rng() * 60, 3, 3);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const world = new THREE.Group();
  scene.add(world);

  // ---- base ground, beach, sea ---------------------------------------------
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshLambertMaterial({ color: PALETTE.lotGround }));
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.09;
  base.receiveShadow = true;
  world.add(base);

  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(900, SHORE_Z - HALF + 26),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, -0.03, (HALF + SHORE_Z) / 2 + 9);
  beach.receiveShadow = true;
  world.add(beach);

  const seaGeo = new THREE.PlaneGeometry(900, 220, 60, 22);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshPhongMaterial({
    color: PALETTE.sea, shininess: 150, specular: 0xaaddff, transparent: true, opacity: 0.94 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.32, SHORE_Z + 104);
  world.add(sea);
  const seaRest = seaGeo.attributes.position.array.slice();

  // ---- streets ---------------------------------------------------------------
  const tarmacMat = new THREE.MeshLambertMaterial({ color: PALETTE.tarmac });
  const avenueMat = new THREE.MeshLambertMaterial({ color: PALETTE.tarmacAvenue });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf3e7c3 });
  const kerbMat = new THREE.MeshBasicMaterial({ color: 0xd9dfea });
  function layStreet(horizontal, c) {
    const len = CITY + 34;
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(horizontal ? len : ROAD, horizontal ? ROAD : len),
      horizontal && c === 0 ? avenueMat : tarmacMat);
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(horizontal ? 0 : c, 0.02, horizontal ? c : 0);
    slab.receiveShadow = true;
    world.add(slab);
    const dashGeo = new THREE.PlaneGeometry(horizontal ? 3.6 : 0.35, horizontal ? 0.35 : 3.6);
    for (let d = -CITY / 2 + 9; d < CITY / 2 - 4; d += 9.5) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(horizontal ? d : c, 0.05, horizontal ? c : d);
      world.add(dash);
    }
    for (const off of [-ROAD / 2 + 0.55, ROAD / 2 - 0.55]) {
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(horizontal ? len : 0.3, horizontal ? 0.3 : len), kerbMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(horizontal ? 0 : c + off, 0.045, horizontal ? c + off : 0);
      world.add(line);
    }
  }
  for (const c of streetCentres) { layStreet(true, c); layStreet(false, c); }

  // the boulevard's planted median
  const median = new THREE.Mesh(new THREE.BoxGeometry(CITY + 28, 0.5, 2.8),
    new THREE.MeshLambertMaterial({ color: 0x71806c }));
  median.position.set(0, 0.25, 0);
  world.add(median);

  // ---- blocks: pavement pads, towers, and the three special blocks -----------
  const facades = FACADE_TONES.map((tone) => paintFacade(rng, tone));
  const roofMat = new THREE.MeshLambertMaterial({ map: paintRoof(rng) });
  const pavementMat = new THREE.MeshLambertMaterial({ color: PALETTE.pavement });
  const plazaFloorMat = new THREE.MeshLambertMaterial({ color: 0xcfb691 });
  const lawnMat = new THREE.MeshLambertMaterial({ color: PALETTE.lawn });

  const SPECIALS = { '2,4': 'plaza', '3,1': 'park', '4,4': 'workshop' };
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const x0 = -HALF + ROAD + i * PITCH;
      const z0 = -HALF + ROAD + j * PITCH;
      const cx = x0 + BLOCK / 2;
      const cz = z0 + BLOCK / 2;
      const kind = SPECIALS[i + ',' + j] || 'towers';
      const padMat = kind === 'park' ? lawnMat
        : kind === 'plaza' || kind === 'workshop' ? plazaFloorMat : pavementMat;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(BLOCK + 3.6, 0.3, BLOCK + 3.6), padMat);
      pad.position.set(cx, 0.12, cz);
      pad.receiveShadow = true;
      world.add(pad);
      if (kind === 'park') { buildPark(world, rng, cx, cz); continue; }
      if (kind === 'plaza') { buildPlaza(world, rng, cx, cz); continue; }
      if (kind === 'workshop') { buildWorkshop(world, cx, cz, colliders); continue; }
      const cells = intBetween(rng, 2, 4);
      const cell = BLOCK / 2;
      for (let b = 0; b < cells; b++) {
        const bx = x0 + 4 + (b % 2) * cell + between(rng, 0, 3);
        const bz = z0 + 4 + Math.floor(b / 2) * cell + between(rng, 0, 3);
        const w = between(rng, 17, cell - 6);
        const d = between(rng, 17, cell - 6);
        let h = between(rng, 12, 42);
        if (rng() < 0.16) h = between(rng, 46, 68);
        const tex = pickFrom(rng, facades);
        const wallMat = new THREE.MeshLambertMaterial({
          map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.36 });
        const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
          [wallMat, wallMat, roofMat, roofMat, wallMat, wallMat]);
        tower.position.set(bx + w / 2, h / 2 + 0.25, bz + d / 2);
        tower.castShadow = true;
        tower.receiveShadow = true;
        world.add(tower);
        colliders.push({ x0: bx, z0: bz, x1: bx + w, z1: bz + d });
        if (rng() < 0.6) {
          const plant = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 2.2, d * 0.34), roofMat);
          plant.position.set(bx + w / 2, h + 1.35, bz + d / 2);
          world.add(plant);
        }
      }
    }
  }

  // ---- the Azura Tower landmark, north-west corner ----------------------------
  const towerTex = facades[3];
  const towerMat = new THREE.MeshLambertMaterial({
    map: towerTex, emissive: 0xffffff, emissiveMap: towerTex, emissiveIntensity: 0.5 });
  const tower = new THREE.Mesh(new THREE.BoxGeometry(17, 92, 17), towerMat);
  const tx = -HALF + ROAD + 10;
  const tz = -HALF + ROAD + 10;
  tower.position.set(tx + 8.5, 46.2, tz + 8.5);
  tower.castShadow = true;
  world.add(tower);
  colliders.push({ x0: tx, z0: tz, x1: tx + 17, z1: tz + 17 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff4040 }));
  beacon.position.set(tx + 8.5, 94.6, tz + 8.5);
  world.add(beacon);

  plantPalms(world, rng);
  plantLamps(world, rng);
  buildMarina(world, colliders);

  return {
    colliders,
    update(t) {
      const pos = seaGeo.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const bx = seaRest[k * 3];
        const by = seaRest[k * 3 + 1];
        pos.array[k * 3 + 2] = Math.sin(bx * 0.07 + t * 1.25) * 0.34 + Math.cos(by * 0.1 + t * 0.85) * 0.27;
      }
      pos.needsUpdate = true;
      beacon.visible = Math.sin(t * 2.4) > -0.3;
    },
  };
}

function buildPark(world, rng, cx, cz) {
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 6.9, 1.1, 18),
    new THREE.MeshLambertMaterial({ color: 0xb9c2cc }));
  basin.position.set(cx, 0.85, cz);
  world.add(basin);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 0.4, 18),
    new THREE.MeshPhongMaterial({ color: 0x2f9ec4, shininess: 130 }));
  pool.position.set(cx, 1.35, cz);
  world.add(pool);
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.55, 3.6, 6),
    new THREE.MeshLambertMaterial({ color: 0xd9f5ff }));
  jet.position.set(cx, 2.8, cz);
  world.add(jet);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 0.9),
      new THREE.MeshLambertMaterial({ color: 0x8a6a47 }));
    bench.position.set(cx + Math.cos(a) * 10.6, 0.65, cz + Math.sin(a) * 10.6);
    bench.rotation.y = -a;
    world.add(bench);
  }
}

function buildPlaza(world, rng, cx, cz) {
  const awningTones = [0xff5e7a, 0xffb347, 0x53b06a, 0x3e74b8, 0xffd23e, 0xd96c33];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const stall = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.1, 2.6),
      new THREE.MeshLambertMaterial({ color: 0xa9835c }));
    counter.position.y = 1.05;
    counter.castShadow = true;
    stall.add(counter);
    const awning = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 3.5),
      new THREE.MeshLambertMaterial({ color: awningTones[k % awningTones.length] }));
    awning.position.y = 2.65;
    awning.rotation.z = 0.1;
    stall.add(awning);
    stall.position.set(cx + Math.cos(a) * 17.5, 0.25, cz + Math.sin(a) * 17.5);
    stall.rotation.y = -a + Math.PI / 2;
    world.add(stall);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(7, 0.7, 8, 20, Math.PI),
    new THREE.MeshLambertMaterial({ color: 0xffb347 }));
  arch.position.set(cx, 0.3, cz + 25);
  world.add(arch);
}

function buildWorkshop(world, cx, cz, colliders) {
  // Marina's Workshop: the delivery point for the first and last jobs.
  const shell = new THREE.Mesh(new THREE.BoxGeometry(32, 8.5, 21),
    new THREE.MeshLambertMaterial({ color: 0x776c5f }));
  shell.position.set(cx, 4.4, cz - 9);
  shell.castShadow = true;
  world.add(shell);
  colliders.push({ x0: cx - 16, z0: cz - 19.5, x1: cx + 16, z1: cz + 1.5 });
  const sign = new THREE.Mesh(new THREE.BoxGeometry(25, 2.7, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xff5e7a }));
  sign.position.set(cx, 9.9, cz + 1.8);
  world.add(sign);
  const door = new THREE.Mesh(new THREE.BoxGeometry(11, 5.6, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2b2f38 }));
  door.position.set(cx, 3, cz + 1.7);
  world.add(door);
}

function plantPalms(world, rng) {
  const spots = [];
  for (let x = -HALF + 14; x < HALF - 8; x += 26) {
    spots.push([x, -6.6]);
    spots.push([x + 12, 6.6]);
  }
  for (let x = -HALF + 22; x < HALF - 8; x += 34) spots.push([x, HALF + 13 + (x % 3)]);
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      if (rng() < 0.55) continue;
      spots.push([-HALF + ROAD + i * PITCH - 3.6, -HALF + ROAD + j * PITCH - 3.6]);
    }
  }
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.48, 7.6, 6);
  trunkGeo.translate(0, 3.8, 0);
  const frondGeo = new THREE.ConeGeometry(3.1, 2.5, 7);
  frondGeo.translate(0, 8.1, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo,
    new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk }), spots.length);
  const fronds = new THREE.InstancedMesh(frondGeo,
    new THREE.MeshLambertMaterial({ color: PALETTE.palmFrond }), spots.length);
  const m = new THREE.Object3D();
  spots.forEach(([x, z], idx) => {
    m.position.set(x, 0, z);
    m.rotation.set(between(rng, -0.07, 0.07), rng() * Math.PI * 2, between(rng, -0.07, 0.07));
    const s = between(rng, 0.85, 1.3);
    m.scale.set(s, s, s);
    m.updateMatrix();
    trunks.setMatrixAt(idx, m.matrix);
    fronds.setMatrixAt(idx, m.matrix);
  });
  trunks.castShadow = true;
  world.add(trunks);
  world.add(fronds);
}

function plantLamps(world, rng) {
  const poleGeo = new THREE.CylinderGeometry(0.13, 0.17, 5.6, 5);
  poleGeo.translate(0, 2.8, 0);
  const bulbGeo = new THREE.SphereGeometry(0.42, 8, 6);
  bulbGeo.translate(0, 5.7, 0);
  const spots = [];
  for (const c of streetCentres) {
    for (let d = -HALF + 24; d < HALF; d += 44) {
      spots.push([c + ROAD / 2 - 1, d]);
      spots.push([d, c - ROAD / 2 + 1]);
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo,
    new THREE.MeshLambertMaterial({ color: 0x3a4152 }), spots.length);
  const bulbs = new THREE.InstancedMesh(bulbGeo,
    new THREE.MeshBasicMaterial({ color: 0xffe3a8 }), spots.length);
  const m = new THREE.Object3D();
  spots.forEach(([x, z], idx) => {
    m.position.set(x, 0, z);
    m.rotation.set(0, 0, 0);
    m.scale.set(1, 1, 1);
    m.updateMatrix();
    poles.setMatrixAt(idx, m.matrix);
    bulbs.setMatrixAt(idx, m.matrix);
  });
  world.add(poles);
  world.add(bulbs);
}

function buildMarina(world, colliders) {
  const timber = new THREE.MeshLambertMaterial({ color: 0x9a7a54 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 84), timber);
  pier.position.set(0, 0.7, HALF + 38);
  pier.castShadow = true;
  world.add(pier);
  colliders.push({ x0: -7, z0: HALF - 4, x1: 7, z1: HALF + 78, pier: true });
  for (let z = HALF + 4; z < HALF + 76; z += 8) {
    for (const x of [-6.4, 6.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 2.6, 6), timber);
      post.position.set(x, 0.2, z);
      world.add(post);
    }
  }
  // the yacht SOL MARINA, moored at the pier's end
  const yacht = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5.4, 2.2, 15),
    new THREE.MeshLambertMaterial({ color: 0xf2f4f8 }));
  hull.position.y = 1.2;
  yacht.add(hull);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.9, 7),
    new THREE.MeshLambertMaterial({ color: 0xbfd9e8 }));
  cabin.position.set(0, 3.1, -0.8);
  yacht.add(cabin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 9, 5),
    new THREE.MeshLambertMaterial({ color: 0x8a8f9a }));
  mast.position.set(0, 6.4, 3.4);
  yacht.add(mast);
  yacht.position.set(16, 0.4, HALF + 62);
  yacht.rotation.y = 0.12;
  world.add(yacht);
  for (const [bx, bz, col] of [[-14, HALF + 22, 0xc94f42], [-13, HALF + 48, 0x3e74b8], [15, HALF + 16, 0xe0aa34]]) {
    const boat = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.3, 7.6),
      new THREE.MeshLambertMaterial({ color: col }));
    boat.position.set(bx, 0.75, bz);
    boat.rotation.y = 0.06;
    world.add(boat);
  }
}
