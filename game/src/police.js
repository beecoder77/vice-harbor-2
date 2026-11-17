// The Azura PD: a wanted-heat model (a float from 0 to 5; the stars on
// the HUD are its ceiling) and a pool of six Interceptor cruisers that
// spawn on streets near the player and hunt with predictive steering.
// Heat fades only while no cruiser is close enough to see the player.

import { CAR_TYPES, HALF } from './config.js';
import { buildCarMesh, stepCar, syncCarMesh } from './cars.js';
import { streetCentres } from './city.js';

const CRUISER_TYPE = 0; // the Cielo shell, in PD livery

export class Police {
  constructor(scene, colliders) {
    this.colliders = colliders;
    this.heat = 0;
    this.unseenFor = 0;
    this.units = [];
    for (let n = 0; n < 6; n++) {
      const mesh = buildCarMesh(CRUISER_TYPE, 0xffffff, true);
      mesh.visible = false;
      scene.add(mesh);
      this.units.push({
        mesh, active: false,
        type: { ...CAR_TYPES[CRUISER_TYPE], name: 'Azura PD Interceptor' },
        state: { x: 0, z: 0, heading: 0, speed: 0, steerVis: 0 },
      });
    }
  }
  get stars() { return Math.ceil(this.heat); }
  addHeat(amount) { this.heat = Math.min(5, this.heat + amount); }
  clear() {
    this.heat = 0;
    this.unseenFor = 0;
    for (const u of this.units) { u.active = false; u.mesh.visible = false; }
  }
  nearestStreetPoint(x, z) {
    let best = null, bd = Infinity;
    for (const c of streetCentres) {
      for (const cand of [[c, z], [x, c]]) {
        const d = (cand[0] - x) ** 2 + (cand[1] - z) ** 2;
        if (d < bd) { bd = d; best = cand; }
      }
    }
    return best;
  }
  deploy(unit, target) {
    const ang = Math.random() * Math.PI * 2;
    const tx = Math.max(-HALF, Math.min(HALF, target.x + Math.sin(ang) * 84));
    const tz = Math.max(-HALF, Math.min(HALF, target.z + Math.cos(ang) * 84));
    const [rx, rz] = this.nearestStreetPoint(tx, tz);
    unit.state.x = rx;
    unit.state.z = rz;
    unit.state.heading = Math.atan2(target.x - rx, target.z - rz);
    unit.state.speed = 8;
    unit.active = true;
    unit.mesh.visible = true;
  }
  update(dt, player, tNow) {
    const stars = this.stars;
    const p = player.pos;
    const wanted = stars === 0 ? 0 : Math.min(6, stars + 1);
    let active = 0;
    let anyNear = false;
    for (const u of this.units) {
      if (!u.active) continue;
      active++;
      const dx = p.x - u.state.x;
      const dz = p.z - u.state.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 60) anyNear = true;
      if (dist > 190 && stars <= 1) { u.active = false; u.mesh.visible = false; active--; continue; }
      // aim where the player is about to be, not where they are
      const pvx = player.mode === 'car' ? Math.sin(p.heading) * p.speed : 0;
      const pvz = player.mode === 'car' ? Math.cos(p.heading) * p.speed : 0;
      const aimX = p.x + pvx * dist * 0.03;
      const aimZ = p.z + pvz * dist * 0.03;
      const targetHeading = Math.atan2(aimX - u.state.x, aimZ - u.state.z);
      let dh = targetHeading - u.state.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, dh * 1.7));
      const throttle = Math.abs(dh) > 2.2 ? -0.7 : 1;
      u.type.top = 34 + stars * 2.4;
      u.state.steerVis = steer * 0.4;
      stepCar(u.state, u.type,
        { throttle, steer, brake: dist < 6 && Math.abs(p.speed || 0) < 2 },
        dt, this.colliders, null);
      syncCarMesh(u.state, u.mesh, dt);
      const bar = u.mesh.userData.lightBar;
      if (bar) {
        const phase = Math.sin(tNow * 11 + u.state.x) > 0;
        bar.redLamp.material.color.setHex(phase ? 0xff2a2a : 0x5f1010);
        bar.blueLamp.material.color.setHex(phase ? 0x0f2450 : 0x2a6aff);
      }
    }
    if (active < wanted) {
      const idle = this.units.find((u) => !u.active);
      if (idle) this.deploy(idle, p);
    }
    if (stars > 0) {
      this.unseenFor = anyNear ? 0 : this.unseenFor + dt;
      if (this.unseenFor > 7 - stars * 0.7) {
        this.heat = Math.max(0, this.heat - dt * 0.12);
        if (this.heat < 0.05) this.clear();
      }
    }
  }
}
