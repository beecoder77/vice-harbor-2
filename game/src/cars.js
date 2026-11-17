// Cars: how a Port Azura car looks, how it drives, and how the traffic
// that fills the streets behaves. One physics step is shared by the
// player's car, the police and (in spirit) the traffic, so every vehicle
// in town answers the road the same way.

import * as THREE from 'three';
import { CAR_TYPES, TRAFFIC_PAINTS, HALF, ROAD, SHORE_Z } from './config.js';
import { streetCentres } from './city.js';
import { pickFrom, between } from './rng.js';

const glassMat = new THREE.MeshLambertMaterial({ color: 0x18222e });
const tyreMat = new THREE.MeshLambertMaterial({ color: 0x14161c });
const plateMat = new THREE.MeshLambertMaterial({ color: 0xb9c2cc });

// Builds one stylised low-poly car. The nose points along +z, so a car
// with heading h travels along (sin h, cos h). Police cars get the white
// PD livery, a blue waist stripe and a red/blue light bar.
export function buildCarMesh(typeIdx, paint, police = false) {
  const type = CAR_TYPES[typeIdx];
  const car = new THREE.Group();
  const paintMat = new THREE.MeshLambertMaterial({ color: police ? 0xf2f4f8 : paint });
  const body = new THREE.Mesh(new THREE.BoxGeometry(type.wid, 0.62, type.len), paintMat);
  body.position.y = 0.62;
  body.castShadow = true;
  car.add(body);
  const bonnet = new THREE.Mesh(new THREE.BoxGeometry(type.wid * 0.92, 0.4, type.len * 0.2), paintMat);
  bonnet.position.set(0, 0.52, type.len * 0.46);
  car.add(bonnet);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(type.wid * 0.84, 0.55, type.len * 0.44), glassMat);
  cabin.position.set(0, 1.18, -type.len * 0.04);
  cabin.castShadow = true;
  car.add(cabin);
  if (police) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(type.wid + 0.04, 0.3, type.len * 0.7),
      new THREE.MeshLambertMaterial({ color: 0x2456c8 }));
    stripe.position.y = 0.62;
    car.add(stripe);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x22262e }));
    barBase.position.set(0, 1.52, -type.len * 0.04);
    car.add(barBase);
    const redLamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.44),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    redLamp.position.set(-0.31, 1.66, -type.len * 0.04);
    car.add(redLamp);
    const blueLamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.44),
      new THREE.MeshBasicMaterial({ color: 0x2a6aff }));
    blueLamp.position.set(0.31, 1.66, -type.len * 0.04);
    car.add(blueLamp);
    car.userData.lightBar = { redLamp, blueLamp };
  }
  const lampGeo = new THREE.BoxGeometry(0.34, 0.16, 0.06);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  for (const sx of [-1, 1]) {
    const head = new THREE.Mesh(lampGeo, headMat);
    head.position.set(sx * type.wid * 0.32, 0.66, type.len / 2 + 0.02);
    car.add(head);
    const tail = new THREE.Mesh(lampGeo, tailMat);
    tail.position.set(sx * type.wid * 0.32, 0.7, -type.len / 2 - 0.02);
    car.add(tail);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const wheel = new THREE.Mesh(wheelGeo, tyreMat);
    wheel.position.set(wx * (type.wid / 2 - 0.05), 0.36, wz * type.len * 0.32);
    car.add(wheel);
    wheels.push(wheel);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.04), plateMat);
  plate.position.set(0, 0.5, -type.len / 2 - 0.03);
  car.add(plate);
  car.userData.wheels = wheels;
  car.userData.type = type;
  return car;
}

// One arcade physics step. state = {x, z, heading, speed, steerVis}.
// input = {throttle: -1..1, steer: -1..1, brake: bool}. Building hits
// report through onHit(impactSpeed) before the speed is eaten.
export function stepCar(state, type, input, dt, colliders, onHit) {
  const power = input.throttle > 0 ? type.accel : type.accel * 0.62;
  state.speed += input.throttle * power * dt;
  if (input.brake) {
    state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), 26 * dt);
  }
  state.speed -= state.speed * 0.55 * dt;
  if (!input.throttle) state.speed -= state.speed * 0.5 * dt;
  state.speed = Math.max(-type.top * 0.36, Math.min(type.top, state.speed));
  if (Math.abs(state.speed) < 0.04 && !input.throttle) state.speed = 0;
  const authority = Math.min(1, Math.abs(state.speed) / 6) * Math.sign(state.speed);
  state.heading += input.steer * type.grip * 0.42 * authority * dt * (input.brake ? 1.5 : 1);
  state.x += Math.sin(state.heading) * state.speed * dt;
  state.z += Math.cos(state.heading) * state.speed * dt;
  state.x = Math.max(-HALF - 60, Math.min(HALF + 60, state.x));
  // the sea is not a road: only the pier strip may cross the shoreline
  const onPier = Math.abs(state.x) < 7.5;
  const zMax = onPier ? HALF + 72 : SHORE_Z - 3;
  state.z = Math.max(-HALF - 24, Math.min(zMax, state.z));
  for (const c of colliders) {
    if (c.pier) continue;
    const cx = Math.max(c.x0, Math.min(c.x1, state.x));
    const cz = Math.max(c.z0, Math.min(c.z1, state.z));
    const dx = state.x - cx;
    const dz = state.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < 2.25) {
      const d = Math.sqrt(d2) || 0.01;
      state.x += (dx / d) * (1.5 - d);
      state.z += (dz / d) * (1.5 - d);
      if (Math.abs(state.speed) > 7 && onHit) onHit(Math.abs(state.speed));
      state.speed *= 0.35;
    }
  }
}

export function syncCarMesh(state, mesh, dt) {
  mesh.position.set(state.x, 0, state.z);
  mesh.rotation.y = state.heading;
  const spin = state.speed * dt * 2.6;
  const wheels = mesh.userData.wheels;
  for (const w of wheels) w.rotation.x += spin;
  wheels[0].rotation.y = state.steerVis || 0;
  wheels[1].rotation.y = state.steerVis || 0;
}

// ---- traffic -----------------------------------------------------------------
const LANE = 4.1; // right-hand traffic offset from a street centre line

export class Traffic {
  constructor(scene, rng, count = 24) {
    this.rng = rng;
    this.cars = [];
    for (let n = 0; n < count; n++) {
      const typeIdx = Math.floor(rng() * CAR_TYPES.length);
      const mesh = buildCarMesh(typeIdx, pickFrom(rng, TRAFFIC_PAINTS));
      scene.add(mesh);
      const car = {
        mesh, type: CAR_TYPES[typeIdx],
        vertical: rng() < 0.5,
        centre: pickFrom(rng, streetCentres),
        dir: rng() < 0.5 ? 1 : -1,
        x: 0, z: 0,
        speed: between(rng, 7, 11.5),
        cruise: 0, turning: false, turnT: 0, from: null, to: null,
      };
      car.cruise = car.speed;
      this.placeOnLane(car, between(rng, -HALF + 16, HALF - 16));
      this.cars.push(car);
    }
  }
  laneOffset(vertical, dir) {
    return vertical ? (dir > 0 ? -LANE : LANE) : (dir > 0 ? LANE : -LANE);
  }
  placeOnLane(car, along) {
    const off = this.laneOffset(car.vertical, car.dir);
    if (car.vertical) { car.x = car.centre + off; car.z = along; }
    else { car.x = along; car.z = car.centre + off; }
  }
  headingOf(car) {
    if (car.turning) return car.turnHeading;
    return car.vertical
      ? (car.dir > 0 ? 0 : Math.PI)
      : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  }
  update(dt, playerPos) {
    for (const car of this.cars) {
      let wanted = car.cruise;
      const hx = car.vertical ? 0 : car.dir;
      const hz = car.vertical ? car.dir : 0;
      for (const other of this.cars) {
        if (other === car) continue;
        const ahead = (other.x - car.x) * hx + (other.z - car.z) * hz;
        const side = Math.abs((other.x - car.x) * hz - (other.z - car.z) * hx);
        if (ahead > 0 && ahead < 11 && side < 2.4) {
          wanted = Math.min(wanted, Math.max(0, (ahead - 5.5) * 1.4));
        }
      }
      if (playerPos) {
        const ahead = (playerPos.x - car.x) * hx + (playerPos.z - car.z) * hz;
        const side = Math.abs((playerPos.x - car.x) * hz - (playerPos.z - car.z) * hx);
        if (ahead > 0 && ahead < 8 && side < 2.2) wanted = 0;
      }
      car.speed += Math.max(-14 * dt, Math.min(6 * dt, wanted - car.speed));
      if (car.turning) {
        car.turnT += dt / 1.15;
        const t = Math.min(1, car.turnT);
        const e = t * t * (3 - 2 * t);
        car.x = car.from.x + (car.to.x - car.from.x) * e;
        car.z = car.from.z + (car.to.z - car.from.z) * e;
        car.turnHeading = car.from.h + (car.to.h - car.from.h) * e;
        if (t >= 1) {
          car.turning = false;
          this.placeOnLane(car, car.vertical ? car.z : car.x);
        }
      } else {
        if (car.vertical) car.z += car.dir * car.speed * dt;
        else car.x += car.dir * car.speed * dt;
        const along = car.vertical ? car.z : car.x;
        for (const c of streetCentres) {
          if (Math.abs(along - c) < Math.max(1.2, car.speed * dt) && this.rng() < 0.4) {
            this.beginTurn(car, c);
            break;
          }
        }
        if (along > HALF + 30) { if (car.vertical) car.z = -HALF - 30; else car.x = -HALF - 30; }
        if (along < -HALF - 30) { if (car.vertical) car.z = HALF + 30; else car.x = HALF + 30; }
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = this.headingOf(car);
      const spin = car.speed * dt * 2.6;
      for (const w of car.mesh.userData.wheels) w.rotation.x += spin;
    }
  }
  beginTurn(car, crossCentre) {
    const newVertical = !car.vertical;
    const newDir = this.rng() < 0.5 ? 1 : -1;
    const fromH = this.headingOf(car);
    const off = this.laneOffset(newVertical, newDir);
    const to = { x: 0, z: 0, h: 0 };
    if (newVertical) { to.x = crossCentre + off; to.z = car.z + car.dir * (ROAD / 2 + 2); }
    else { to.z = crossCentre + off; to.x = car.x + car.dir * (ROAD / 2 + 2); }
    to.h = newVertical ? (newDir > 0 ? 0 : Math.PI) : (newDir > 0 ? Math.PI / 2 : -Math.PI / 2);
    while (to.h - fromH > Math.PI) to.h -= Math.PI * 2;
    while (to.h - fromH < -Math.PI) to.h += Math.PI * 2;
    car.from = { x: car.x, z: car.z, h: fromH };
    car.to = to;
    car.turnT = 0;
    car.turning = true;
    car.vertical = newVertical;
    car.centre = crossCentre;
    car.dir = newDir;
  }
}

// Parked cars along the kerbs: the player's rolling stock.
export function spawnParkedCars(scene, rng, count = 20) {
  const parked = [];
  const spots = [];
  for (const c of streetCentres) {
    for (let d = -HALF + 34; d < HALF - 20; d += 27) {
      spots.push({ x: c + ROAD / 2 - 1.7, z: d, h: 0 });
      spots.push({ x: d, z: c - ROAD / 2 + 1.7, h: Math.PI / 2 });
    }
  }
  for (let n = 0; n < count && spots.length; n++) {
    const spot = spots.splice(Math.floor(rng() * spots.length), 1)[0];
    const typeIdx = Math.floor(rng() * CAR_TYPES.length);
    const mesh = buildCarMesh(typeIdx, pickFrom(rng, TRAFFIC_PAINTS));
    const heading = spot.h + (rng() < 0.5 ? 0 : Math.PI);
    mesh.position.set(spot.x, 0, spot.z);
    mesh.rotation.y = heading;
    scene.add(mesh);
    parked.push({
      mesh, type: CAR_TYPES[typeIdx], typeIdx,
      name: CAR_TYPES[typeIdx].name,
      parked: true, stolen: false, special: false,
      state: { x: spot.x, z: spot.z, heading, speed: 0, steerVis: 0 },
    });
  }
  return parked;
}
