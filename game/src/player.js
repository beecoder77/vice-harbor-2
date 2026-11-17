// Rio, the player: keyboard and mouse input, the on-foot controller with
// its walk cycle, and the third-person camera rig that follows on foot
// and behind the wheel. Driving itself lives in cars.js; this module owns
// the body and the view.

import * as THREE from 'three';
import { HALF, SHORE_Z } from './config.js';
import { buildPerson, swingLimbs } from './people.js';

export class Input {
  constructor(canvas) {
    this.keys = {};
    this.orbitYaw = 0;      // extra camera yaw from mouse drags
    this.orbitPitch = 0.32; // camera height angle from mouse drags
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    let dragging = false, lastX = 0, lastY = 0;
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
    addEventListener('pointerup', () => { dragging = false; });
    addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.orbitYaw -= (e.clientX - lastX) * 0.0052;
      this.orbitPitch = Math.max(0.06, Math.min(1.15, this.orbitPitch + (e.clientY - lastY) * 0.004));
      lastX = e.clientX; lastY = e.clientY;
    });
  }
  down(...codes) { return codes.some((c) => this.keys[c]); }
  axis(negCodes, posCodes) {
    return (this.down(...posCodes) ? 1 : 0) - (this.down(...negCodes) ? 1 : 0);
  }
}

export class Player {
  constructor(scene) {
    this.mesh = buildPerson(0xff8a3a, 0x2b3a55, 0xc98a5e, 0xffd23e); // Rio: orange shirt, yellow cap
    scene.add(this.mesh);
    this.x = 6;
    this.z = HALF - 18;      // starts on the marina shore, city ahead
    this.heading = Math.PI;  // facing north, into town
    this.speed = 0;
    this.mode = 'foot';      // 'foot' or 'car'
    this.car = null;         // the parked-car record being driven
    this.walkPhase = 0;
    this.health = 100;
    this.camYaw = Math.PI;
    this.camPos = new THREE.Vector3(0, 8, 40);
  }
  // Where the world should consider "the player" to be right now.
  get pos() { return this.mode === 'car' ? this.car.state : this; }
  update(dt, input, colliders) {
    if (this.mode !== 'foot') return;
    const fwd = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp']);
    const strafe = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const sprint = input.down('ShiftLeft', 'ShiftRight');
    let mx = 0, mz = 0;
    if (fwd || strafe) {
      const len = Math.hypot(fwd, strafe) || 1;
      const fx = Math.sin(this.camYaw), fz = Math.cos(this.camYaw);
      const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
      mx = (fx * fwd + rx * strafe) / len;
      mz = (fz * fwd + rz * strafe) / len;
    }
    const top = sprint ? 8.8 : 5.4;
    this.speed = (fwd || strafe) ? top : 0;
    if (this.speed) {
      const target = Math.atan2(mx, mz);
      let dh = target - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += dh * Math.min(1, dt * 12);
      let nx = this.x + mx * top * dt;
      let nz = this.z + mz * top * dt;
      nx = Math.max(-HALF - 58, Math.min(HALF + 58, nx));
      // the pier is the only dry way out over the water
      const onPier = nx > -7.5 && nx < 7.5;
      nz = Math.max(-HALF - 22, Math.min(onPier ? HALF + 76 : SHORE_Z - 2, nz));
      if (nz > SHORE_Z - 2 && !onPier) nz = SHORE_Z - 2;
      for (const c of colliders) {
        if (c.pier) continue;
        const cx = Math.max(c.x0, Math.min(c.x1, nx));
        const cz = Math.max(c.z0, Math.min(c.z1, nz));
        const dx = nx - cx, dz = nz - cz;
        if (dx * dx + dz * dz < 0.3) {
          const d = Math.sqrt(dx * dx + dz * dz) || 0.01;
          nx = cx + (dx / d) * 0.55;
          nz = cz + (dz / d) * 0.55;
        }
      }
      this.x = nx;
      this.z = nz;
      this.walkPhase += dt * (sprint ? 11 : 8);
    }
    swingLimbs(this.mesh, this.walkPhase, this.speed ? 0.62 : 0);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
  updateCamera(dt, input, camera) {
    const p = this.pos;
    const dist = this.mode === 'car' ? 11.5 : 8;
    const baseYaw = this.mode === 'car' ? p.heading : this.heading;
    const targetYaw = baseYaw + input.orbitYaw;
    let dy = targetYaw - this.camYaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.camYaw += dy * Math.min(1, dt * (this.mode === 'car' ? 3.2 : 5));
    const pitch = input.orbitPitch + (this.mode === 'car' ? 0.1 : 0);
    const tx = p.x - Math.sin(this.camYaw) * Math.cos(pitch) * dist;
    const tz = p.z - Math.cos(this.camYaw) * Math.cos(pitch) * dist;
    const ty = Math.sin(pitch) * dist + 1.6;
    const k = Math.min(1, dt * 7);
    this.camPos.x += (tx - this.camPos.x) * k;
    this.camPos.y += (ty - this.camPos.y) * k;
    this.camPos.z += (tz - this.camPos.z) * k;
    camera.position.copy(this.camPos);
    camera.lookAt(p.x, 1.6, p.z);
  }
}
