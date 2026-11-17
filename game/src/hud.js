// The HUD: cash and wanted stars, the mission banner with its objective
// and countdown, Marina's dialogue toasts, the interaction prompt, the
// vitals bar, the current ride's name and speed — and the round minimap
// that ties the whole city together in the corner of the screen.

import { HALF, SHORE_Z } from './config.js';
import { streetCentres } from './city.js';

const el = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.cashEl = el('cash');
    this.starsEl = el('stars');
    this.jobEl = el('jobname');
    this.objectiveEl = el('objective');
    this.clockEl = el('clock');
    this.toastEl = el('toast');
    this.promptEl = el('prompt');
    this.vitalsEl = el('vitalsfill');
    this.rideEl = el('rideinfo');
    this.mapCtx = el('minimap').getContext('2d');
    this.toastUntil = 0;
    this.starsShown = -1;
  }
  setCash(n) {
    this.cashEl.innerHTML = '$' + n.toLocaleString('en-US') + '<small>PORT AZURA</small>';
  }
  setStars(n) {
    if (n === this.starsShown) return;
    this.starsShown = n;
    let html = '';
    for (let i = 0; i < 5; i++) html += `<span class="${i < n ? 'lit' : ''}">★</span>`;
    this.starsEl.innerHTML = html;
  }
  setJob(title, objective, clock) {
    if (title) {
      this.jobEl.textContent = title;
      this.jobEl.classList.remove('hidden');
    } else {
      this.jobEl.classList.add('hidden');
    }
    this.objectiveEl.textContent = objective || '';
    if (clock) {
      this.clockEl.textContent = clock;
      this.clockEl.classList.remove('hidden');
      const [m, s] = clock.split(':').map(Number);
      this.clockEl.classList.toggle('low', m * 60 + s <= 30);
    } else {
      this.clockEl.classList.add('hidden');
    }
  }
  toast(who, line, seconds = 6) {
    this.toastEl.querySelector('.who').textContent = who;
    this.toastEl.querySelector('.say').textContent = line;
    this.toastEl.style.opacity = 1;
    this.toastUntil = performance.now() + seconds * 1000;
  }
  hideToast() {
    this.toastEl.style.opacity = 0;
    this.toastUntil = 0;
  }
  prompt(html) {
    if (html) {
      this.promptEl.innerHTML = html;
      this.promptEl.style.opacity = 1;
    } else {
      this.promptEl.style.opacity = 0;
    }
  }
  setVitals(frac) {
    this.vitalsEl.style.width = Math.max(0, Math.min(100, frac * 100)) + '%';
  }
  setRide(html) { this.rideEl.innerHTML = html || ''; }
  update() {
    if (this.toastUntil && performance.now() > this.toastUntil) this.hideToast();
  }
  drawMap(view, objective, policeUnits, t) {
    const g = this.mapCtx;
    const S = 196, C = S / 2;
    const scale = S / 210; // the dial shows about 210 m across
    const px = (x) => C + (x - view.x) * scale;
    const pz = (z) => C + (z - view.z) * scale;
    g.fillStyle = '#131b3d';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#7a6742';
    g.fillRect(0, pz(HALF), S, Math.max(0, pz(SHORE_Z) - pz(HALF)));
    g.fillStyle = '#1b6d8c';
    g.fillRect(0, pz(SHORE_Z), S, S);
    g.fillStyle = '#232c52';
    const lot = 66 * scale;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        g.fillRect(px(-243 + i * 84), pz(-243 + j * 84), lot, lot);
      }
    }
    g.strokeStyle = '#4a587f';
    g.lineWidth = Math.max(2, 15 * scale);
    for (const c of streetCentres) {
      g.beginPath(); g.moveTo(px(c), 0); g.lineTo(px(c), S); g.stroke();
      g.beginPath(); g.moveTo(0, pz(c)); g.lineTo(S, pz(c)); g.stroke();
    }
    g.strokeStyle = '#8a6f4d';
    g.beginPath(); g.moveTo(0, pz(0)); g.lineTo(S, pz(0)); g.stroke();
    for (const u of policeUnits) {
      if (!u.active) continue;
      g.fillStyle = Math.sin(t * 9) > 0 ? '#ff4040' : '#4d7dff';
      g.beginPath();
      g.arc(px(u.state.x), pz(u.state.z), 3.4, 0, 7);
      g.fill();
    }
    if (objective) {
      const ox = Math.max(14, Math.min(S - 14, px(objective.x)));
      const oz = Math.max(14, Math.min(S - 14, pz(objective.z)));
      const offDial = ox !== px(objective.x) || oz !== pz(objective.z);
      g.strokeStyle = '#ffd23e';
      g.lineWidth = 2.4;
      g.beginPath();
      g.arc(ox, oz, offDial ? 5 : 7 + Math.sin(t * 4) * 1.4, 0, 7);
      g.stroke();
    }
    g.save();
    g.translate(C, C);
    g.rotate(view.heading);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -7.5);
    g.lineTo(5, 5.5);
    g.lineTo(0, 2.6);
    g.lineTo(-5, 5.5);
    g.closePath();
    g.fill();
    g.restore();
  }
}
