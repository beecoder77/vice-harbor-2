// People: one low-poly human figure factory (Rio and every pedestrian
// share it) and the crowd system that strolls Port Azura's pavements,
// loops each block, crosses to neighbouring blocks, and runs when a fast
// car gets close.

import * as THREE from 'three';
import { BLOCK, ROAD, PITCH, GRID, HALF } from './config.js';
import { pickFrom, between } from './rng.js';

// A stylised figure ~1.9 m tall. Limbs pivot at the shoulder/hip so the
// walk cycle is just two sine swings. userData.limbs = [legL, legR, armL, armR].
export function buildPerson(shirtTone = 0xff8a3a, trouserTone = 0x2b3a55, skinTone = 0xc98a5e, capTone = 0xffd23e) {
  const figure = new THREE.Group();
  const trousers = new THREE.MeshLambertMaterial({ color: trouserTone });
  const shirt = new THREE.MeshLambertMaterial({ color: shirtTone });
  const skin = new THREE.MeshLambertMaterial({ color: skinTone });
  const limbs = [];
  for (const sx of [-1, 1]) {
    const legGeo = new THREE.BoxGeometry(0.21, 0.78, 0.24);
    legGeo.translate(0, -0.39, 0);
    const leg = new THREE.Mesh(legGeo, trousers);
    leg.position.set(sx * 0.14, 0.82, 0);
    figure.add(leg);
    limbs.push(leg);
  }
  for (const sx of [-1, 1]) {
    const armGeo = new THREE.BoxGeometry(0.16, 0.68, 0.19);
    armGeo.translate(0, -0.3, 0);
    const arm = new THREE.Mesh(armGeo, shirt);
    arm.position.set(sx * 0.36, 1.48, 0);
    figure.add(arm);
    limbs.push(arm);
  }
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), shirt);
  torso.position.y = 1.16;
  torso.castShadow = true;
  figure.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.34), skin);
  head.position.y = 1.7;
  head.castShadow = true;
  figure.add(head);
  if (capTone) {
    const capMat = new THREE.MeshLambertMaterial({ color: capTone });
    const crown = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.38), capMat);
    crown.position.y = 1.92;
    figure.add(crown);
    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.24), capMat);
    peak.position.set(0, 1.88, 0.28);
    figure.add(peak);
  }
  figure.userData.limbs = limbs;
  return figure;
}

export function swingLimbs(figure, phase, amount) {
  const limbs = figure.userData.limbs;
  const s = Math.sin(phase) * amount;
  limbs[0].rotation.x = s;
  limbs[1].rotation.x = -s;
  limbs[2].rotation.x = -s;
  limbs[3].rotation.x = s;
}

const SHIRTS = [0xeae2cd, 0x3e74b8, 0xd96c33, 0x4da564, 0xc94f42, 0xf2f2f2, 0x8757ad, 0xffd23e, 0x35b3a4];
const TROUSERS = [0x2b3a55, 0x5a4632, 0x22262e, 0x74584a, 0x3a4a3a];
const SKINS = [0xc98a5e, 0x8a5a34, 0xe8b48c, 0x6e4525];

// The pavement loop around one block, as four corners just off the lot edge.
function pavementLoop(i, j) {
  const x0 = -HALF + ROAD + i * PITCH - 1.9;
  const z0 = -HALF + ROAD + j * PITCH - 1.9;
  const s = BLOCK + 3.8;
  return [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]];
}

export class Pedestrians {
  constructor(scene, rng, count = 42) {
    this.rng = rng;
    this.walkers = [];
    for (let n = 0; n < count; n++) {
      const mesh = buildPerson(pickFrom(rng, SHIRTS), pickFrom(rng, TROUSERS), pickFrom(rng, SKINS), 0);
      mesh.scale.setScalar(between(rng, 0.92, 1.05));
      scene.add(mesh);
      const i = Math.floor(rng() * GRID);
      const j = Math.floor(rng() * GRID);
      const corner = Math.floor(rng() * 4);
      const [x, z] = pavementLoop(i, j)[corner];
      this.walkers.push({
        mesh, i, j, corner,
        x: x + between(rng, -1, 1), z: z + between(rng, -1, 1),
        speed: between(rng, 1.2, 1.9),
        phase: rng() * 6,
        fleeFor: 0, fleeX: 0, fleeZ: 0, downFor: 0,
      });
    }
  }
  knockDown(walker) {
    walker.downFor = 6;
    walker.mesh.rotation.x = -Math.PI / 2;
    walker.mesh.position.y = 0.3;
  }
  update(dt, threats) {
    for (const w of this.walkers) {
      if (w.downFor > 0) {
        w.downFor -= dt;
        if (w.downFor <= 0) { w.mesh.rotation.x = 0; w.mesh.position.y = 0.28; }
        continue;
      }
      if (w.fleeFor <= 0) {
        for (const t of threats) {
          const dx = w.x - t.x;
          const dz = w.z - t.z;
          if (dx * dx + dz * dz < 30 && t.speed > 5) {
            const d = Math.sqrt(dx * dx + dz * dz) || 1;
            w.fleeX = dx / d;
            w.fleeZ = dz / d;
            w.fleeFor = 1.6;
            break;
          }
        }
      }
      let mx, mz, pace;
      if (w.fleeFor > 0) {
        w.fleeFor -= dt;
        mx = w.fleeX; mz = w.fleeZ; pace = 5.6;
      } else {
        const loop = pavementLoop(w.i, w.j);
        const [tx, tz] = loop[(w.corner + 1) % 4];
        const dx = tx - w.x;
        const dz = tz - w.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.7) {
          w.corner = (w.corner + 1) % 4;
          if (this.rng() < 0.22) {
            const ni = Math.max(0, Math.min(GRID - 1, w.i + (this.rng() < 0.5 ? -1 : 1)));
            const nj = Math.max(0, Math.min(GRID - 1, w.j + (this.rng() < 0.5 ? -1 : 1)));
            if (ni !== w.i || nj !== w.j) {
              w.i = ni; w.j = nj;
              const next = pavementLoop(ni, nj);
              let best = 0, bd = Infinity;
              next.forEach(([cx, cz], idx) => {
                const dd = (cx - w.x) ** 2 + (cz - w.z) ** 2;
                if (dd < bd) { bd = dd; best = idx; }
              });
              w.corner = best;
            }
          }
          continue;
        }
        mx = dx / d; mz = dz / d; pace = w.speed;
      }
      w.x += mx * pace * dt;
      w.z += mz * pace * dt;
      w.phase += dt * pace * 3.4;
      swingLimbs(w.mesh, w.phase, 0.55);
      w.mesh.position.set(w.x, 0.28, w.z);
      w.mesh.rotation.y = Math.atan2(mx, mz);
    }
  }
}
