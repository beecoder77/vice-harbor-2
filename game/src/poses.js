// Screenshot poses: ?shot=title|chase|onfoot|mission freezes the world
// and arranges one composed scene per store screenshot. Nothing here is
// a different game — the same city, cars, police and missions, placed.

import { SPOTS } from './missions.js';
import { buildCarMesh, syncCarMesh } from './cars.js';

function hideHudChrome() {
  for (const id of ['topbar', 'minimapwrap', 'bottomleft', 'jobbar', 'prompt']) {
    document.getElementById(id).style.display = 'none';
  }
}

function placeCruiser(police, idx, x, z, heading) {
  const u = police.units[idx];
  u.state.x = x;
  u.state.z = z;
  u.state.heading = heading;
  u.state.speed = 0;
  u.active = true;
  u.mesh.visible = true;
  syncCarMesh(u.state, u.mesh, 0);
  const bar = u.mesh.userData.lightBar;
  if (bar) {
    bar.redLamp.material.color.setHex(0xff2a2a);
    bar.blueLamp.material.color.setHex(0x2a6aff);
  }
}

function putPlayerInCar(world, typeIdx, paint, name, x, z, heading) {
  const { scene, player, parked } = world;
  const mesh = buildCarMesh(typeIdx, paint);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  scene.add(mesh);
  const car = {
    mesh, type: mesh.userData.type, typeIdx, name,
    parked: false, stolen: true, special: false,
    state: { x, z, heading, speed: 14, steerVis: 0 },
  };
  parked.push(car);
  player.mode = 'car';
  player.car = car;
  player.mesh.visible = false;
  player.x = x;
  player.z = z;
  player.heading = heading;
  return car;
}

export function setupShot(name, world) {
  const { player, police, missions, hud, camera } = world;
  if (name === 'title') {
    hideHudChrome();
    camera.position.set(150, 12.5, 3);
    camera.lookAt(-80, 4.5, -2);
    return;
  }
  hud.setCash(2450);
  if (name === 'chase') {
    // four stars on the boulevard: the pink GT runs, three cruisers hunt
    putPlayerInCar(world, 4, 0xff2e88, 'Marina GT', -8, 4.1, Math.PI / 2);
    placeCruiser(police, 0, -21, 5.8, Math.PI / 2);
    placeCruiser(police, 1, -26, -3.2, Math.PI / 2);
    placeCruiser(police, 2, -35, 4.4, Math.PI / 2);
    police.heat = 3.4;
    missions.beginNext();
    hud.hideToast();
    camera.position.set(-35, 5.2, 3.0);
    camera.lookAt(4, 1.2, 3.4);
    return;
  }
  if (name === 'onfoot') {
    // Rio at the market plaza, the marked GT glowing behind him
    player.x = -32;
    player.z = 126;
    player.heading = -0.66;
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.y = player.heading;
    missions.beginNext();
    hud.hideToast();
    camera.position.set(-36.5, 2.0, 131.5);
    camera.lookAt(-30.8, 1.3, 123.5);
    return;
  }
  if (name === 'mission') {
    // the Hot Package run: south down the coast road, pier marker ahead
    putPlayerInCar(world, 1, 0x3e74b8, 'Azura Family Sedan', -4.1, 168, 0);
    police.heat = 1.6; // two stars
    missions.index = 1;
    missions.beginNext();
    missions.active.stages = [
      { text: 'Drop the package at the end of the pier', at: SPOTS.pierEnd, radius: 10, need: 'car', timer: 150 },
    ];
    missions.active.phase = 0;
    missions.active.stageSeen = 0;
    missions.active.stageClock = 148;
    missions.syncMarker();
    hud.hideToast();
    camera.position.set(-5.4, 4.6, 155);
    camera.lookAt(1, 1.8, 188);
    return;
  }
}
