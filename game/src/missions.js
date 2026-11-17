// Marina Sol's five jobs: the story of VICE HARBOR. Each job is a short
// list of stages; a stage is a place to reach (with a glowing gold marker
// in the world), a condition to meet there, and sometimes a clock. The
// runner talks to the rest of the game through hooks: toasts for Marina's
// dialogue, cash for payouts, heat for police attention, sfx for stingers,
// specialCar to roll the pink Marina GT out at the plaza.

import * as THREE from 'three';
import { HALF } from './config.js';

export const FIXER_NAME = 'MARINA SOL';

// World anchors, in one place so the marker, the HUD distance and the
// minimap ring always point at the same spot. Block centres sit at
// -210 + i * 84 on each axis.
export const SPOTS = {
  plaza: { x: -42, z: 126 },              // market plaza, block (2,4)
  workshop: { x: 126, z: 148 },           // Marina's Workshop forecourt, block (4,4)
  downtown: { x: -84, z: -84 },           // the courier's corner
  pierEnd: { x: 0, z: HALF + 66 },        // the yacht at the pier's end
  pierCrate: { x: 0, z: HALF + 30 },      // halfway down the pier
  park: { x: 42, z: -126 },               // the fountain, block (3,1)
  tower: { x: -170, z: -170 },            // Azura Tower's street corner
  safehouse: { x: -162, z: 88 },          // a quiet corner in the south-west
  shore: { x: 6, z: HALF - 18 },          // where Rio starts the game
};

export const JOB_LIST = [
  {
    id: 'wheels', title: 'FIRST WHEELS', pay: 600,
    intro: 'Rio. A Marina GT is sitting pretty at the market plaza, keys in. Bring it to my workshop — gently, hm?',
    outro: 'Clean work. The workshop door is always open to you now.',
  },
  {
    id: 'package', title: 'HOT PACKAGE', pay: 900,
    intro: 'A courier downtown holds a package that burns pockets. Fetch it, drop it at the pier. The PD would love to ask questions — do not let them.',
    outro: 'Package swims with the fishes now. Figuratively. Mostly.',
  },
  {
    id: 'cred', title: 'STREET CRED', pay: 1200,
    intro: 'The street scene does not know your name yet. Eight checkpoints, one lap of my city. Show them how Port Azura drives.',
    outro: 'They know your name now, Rio. The whole boulevard heard it.',
  },
  {
    id: 'heat', title: 'HEAT RUN', pay: 1600,
    intro: 'My accountant Nico saw things a man should not see. He is hiding by the park fountain. Pick him up, and whatever happens — lose the heat before you come home.',
    outro: 'Nico is safe, and already cooking new books. You are a professional.',
  },
  {
    id: 'finale', title: 'HARBOR FINALE', pay: 2500,
    intro: 'Last job, biggest tide. Three crates scattered across my city — the plaza, the tower, the pier. All of them on my yacht before the light goes. Then we drink.',
    outro: 'That is the harbour, Rio. All of it. Welcome home.',
  },
];

export class Missions {
  constructor(scene, hooks) {
    this.hooks = hooks; // {toast, cash, heat, sfx, specialCar, storyComplete}
    this.index = 0;     // the next job to run
    this.active = null; // the job in progress
    this.storyDone = false;
    this.t = 0;
    const pillarGeo = new THREE.CylinderGeometry(1.7, 1.7, 26, 14, 1, true);
    this.pillar = new THREE.Mesh(pillarGeo, new THREE.MeshBasicMaterial({
      color: 0xffd23e, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    this.pillar.position.y = 13;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.1, 26),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.15;
    this.pillar.visible = false;
    this.ring.visible = false;
    scene.add(this.pillar);
    scene.add(this.ring);
  }
  get nextJob() { return JOB_LIST[this.index] || null; }
  stage() { return this.active ? this.active.stages[this.active.phase] : null; }
  beginNext() {
    const job = this.nextJob;
    if (!job) { this.storyDone = true; return; }
    const S = SPOTS;
    const fresh = { job, phase: 0, clock: null, stageClock: null, stageSeen: -1, race: false };
    if (job.id === 'wheels') {
      const gtSpot = { x: S.plaza.x + 14, z: S.plaza.z - 10 }; // where specialCar parks it
      fresh.stages = [
        { text: 'Reach the marked Marina GT at the market plaza', at: gtSpot, radius: 11, need: 'any' },
        { text: 'Get in the Marina GT', at: gtSpot, radius: 11, need: 'theGT' },
        { text: 'Deliver the GT to Marina’s workshop', at: S.workshop, radius: 11, need: 'theGT' },
      ];
      this.hooks.specialCar(S.plaza);
    } else if (job.id === 'package') {
      fresh.stages = [
        { text: 'Pick up the package downtown', at: S.downtown, radius: 9, need: 'car' },
        { text: 'Drop the package at the end of the pier', at: S.pierEnd, radius: 10, need: 'car', timer: 165, onStart: () => this.hooks.heat(2) },
      ];
    } else if (job.id === 'cred') {
      const lap = [[-234, -84], [-84, -234], [84, -168], [234, -84], [168, 84], [0, 168], [-150, 234], [-234, 0]];
      fresh.race = true;
      fresh.clock = 300;
      fresh.stages = lap.map(([x, z], k) => ({
        text: `Checkpoint ${k + 1} of ${lap.length} — burn rubber`, at: { x, z }, radius: 10, need: 'car',
      }));
    } else if (job.id === 'heat') {
      fresh.stages = [
        { text: 'Pick up Nico at the park fountain', at: S.park, radius: 9, need: 'car', onArrive: () => this.hooks.heat(3) },
        { text: 'Reach the safehouse in the south-west', at: S.safehouse, radius: 11, need: 'car' },
        { text: 'Lose the heat — break Azura PD’s line of sight', at: null, need: 'cool' },
      ];
    } else if (job.id === 'finale') {
      fresh.stages = [
        { text: 'Collect the crate at the market plaza', at: S.plaza, radius: 9, need: 'any', onArrive: () => this.hooks.heat(1) },
        { text: 'Collect the crate at Azura Tower', at: S.tower, radius: 9, need: 'any', onArrive: () => this.hooks.heat(1) },
        { text: 'Collect the crate on the pier', at: S.pierCrate, radius: 9, need: 'any', onArrive: () => this.hooks.heat(1) },
        { text: 'Deliver everything to the yacht at the pier’s end', at: S.pierEnd, radius: 11, need: 'any', timer: 240 },
      ];
    }
    this.active = fresh;
    this.hooks.toast(FIXER_NAME, job.intro);
    this.syncMarker();
  }
  syncMarker() {
    const st = this.stage();
    const show = !!(st && st.at);
    this.pillar.visible = show;
    this.ring.visible = show;
    if (show) {
      this.pillar.position.x = st.at.x;
      this.pillar.position.z = st.at.z;
      this.ring.position.x = st.at.x;
      this.ring.position.z = st.at.z;
      const tone = this.active.race ? 0x3fd2ff : 0xffd23e;
      this.pillar.material.color.setHex(tone);
      this.ring.material.color.setHex(tone);
    }
  }
  objectiveLine(playerPos) {
    const st = this.stage();
    if (!st) return '';
    if (!st.at) return st.text;
    const d = Math.hypot(playerPos.x - st.at.x, playerPos.z - st.at.z);
    return `${st.text} — ${Math.round(d)} m`;
  }
  clockLine() {
    if (!this.active) return null;
    const t = this.active.stageClock != null ? this.active.stageClock : this.active.clock;
    if (t == null) return null;
    const s = Math.max(0, Math.ceil(t));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  // ctx = {pos, inCar, inSpecialCar, heat}
  update(dt, ctx) {
    this.t += dt;
    this.pillar.material.opacity = 0.24 + Math.sin(this.t * 3.2) * 0.1;
    const a = this.active;
    if (!a) return;
    const st = this.stage();
    if (!st) return;
    if (a.stageSeen !== a.phase) {
      a.stageSeen = a.phase;
      a.stageClock = st.timer != null ? st.timer : null;
      if (st.onStart) st.onStart();
    }
    if (a.clock != null) {
      a.clock -= dt;
      if (a.clock <= 0) { this.failJob(); return; }
    }
    if (a.stageClock != null) {
      a.stageClock -= dt;
      if (a.stageClock <= 0) { this.failJob(); return; }
    }
    if (st.need === 'cool') {
      if (ctx.heat <= 0) this.advanceStage();
      return;
    }
    if (!st.at) return;
    const d = Math.hypot(ctx.pos.x - st.at.x, ctx.pos.z - st.at.z);
    if (d > st.radius) return;
    if (st.need === 'car' && !ctx.inCar) return;
    if (st.need === 'theGT' && !ctx.inSpecialCar) return;
    this.advanceStage();
  }
  advanceStage() {
    const a = this.active;
    const st = this.stage();
    if (st && st.onArrive) st.onArrive();
    a.phase++;
    a.stageClock = null;
    if (a.race) this.hooks.sfx('checkpoint');
    if (a.phase >= a.stages.length) {
      const job = a.job;
      this.active = null;
      this.index++;
      this.pillar.visible = false;
      this.ring.visible = false;
      this.hooks.cash(job.pay);
      this.hooks.toast(FIXER_NAME, job.outro);
      this.hooks.sfx('complete');
      if (this.nextJob) this.beginNext();
      else { this.storyDone = true; this.hooks.storyComplete(); }
    } else {
      this.syncMarker();
    }
  }
  failJob() {
    this.active = null;
    this.pillar.visible = false;
    this.ring.visible = false;
    this.hooks.toast(FIXER_NAME, 'Out of time. Marina is not pleased — the job is still yours, run it again.');
    this.hooks.sfx('fail');
    this.beginNext(); // same job again; index has not moved
  }
}
