// shots.js — screenshot staging. With ?shot=<scene> in the address, the
// game sets up one honest moment of itself — a real sortie state, a real
// aeroplane pose, the real renderer — and holds it still so a screenshot
// can be taken. Nothing is drawn here that the game does not draw in play;
// these are the game's own scenes, posed. Scenes: cover, maildrop, storm,
// debrief (the names in shots.json).

import { createPlane, placeOnRunway } from './flight.js';
import { Sortie, SORTIE_DEFS } from './missions.js';
import { RUNWAY } from './world.js';

let frames = 0;

export function initShot(G, scene) {
  frames = 0;
  if (scene === 'maildrop') stageMaildrop(G);
  else if (scene === 'storm') stageStorm(G);
  else if (scene === 'debrief') stageDebrief(G);
  else stageCover(G);
}

export function updateShot(G, dt) {
  // The pose is held; only the propeller and the light keep living.
  G.plane.propSpin += dt * 34;
  if (G.sortie) G.sortie.timeSec += dt;
  frames += 1;
  if (frames > 14) window.__shotReady = true;
}

// A chase camera for a posed plane: behind and above, rolled with her.
function chaseCam(plane, back = 19.5, up = 6.9) {
  const fx = Math.sin(plane.heading);
  const fz = -Math.cos(plane.heading);
  return {
    x: plane.x - fx * back,
    y: plane.y + up,
    z: plane.z - fz * back,
    yaw: plane.heading,
    pitch: plane.pitch * 0.55 - 0.088,
    roll: plane.roll * 0.72,
  };
}

function posePlane(G, pose) {
  const plane = G.plane;
  Object.assign(plane, {
    onGround: false, crashed: false, ditched: false, stalled: false, vy: 0,
    pitch: 0, roll: 0, throttle: 0.7, speedKt: 80,
  }, pose);
  G.camOverride = chaseCam(plane, pose.camBack, pose.camUp);
}

// Sortie 1, one gate down, banking toward the second over the home island's
// shoulder: the archipelago, the gold gate ahead, the strip in reach.
function stageCover(G) {
  const campaign = { hull: 100, score: 0, results: [], repairNote: 0, verdict: '' };
  const sortie = new Sortie(SORTIE_DEFS[0], campaign);
  sortie.ringNext = 1;
  sortie.addScore('Gate 1 threaded', 160);
  sortie.timeSec = 74;
  sortie.fuel = 88;
  sortie.tookOff = true;
  G.campaign = campaign;
  G.sortie = sortie;
  G.sortieIndex = 0;
  posePlane(G, {
    x: -318, y: 130, z: -500,
    heading: -0.66, pitch: 0.02, roll: -0.27,
    speedKt: 86, throttle: 0.74,
  });
  G.mode = 'fly';
}

// Sortie 2 over Tern Island: a parcel under its parachute, walking down
// the wind toward the orange circle, two more aboard.
function stageMaildrop(G) {
  const campaign = { hull: 100, score: 1120, results: [], repairNote: 0, verdict: '' };
  const sortie = new Sortie(SORTIE_DEFS[1], campaign);
  sortie.timeSec = 188;
  sortie.fuel = 79;
  sortie.tookOff = true;
  G.campaign = campaign;
  G.sortie = sortie;
  G.sortieIndex = 1;
  posePlane(G, {
    x: 415, y: 128, z: -1215,
    heading: 0.62, pitch: -0.02, roll: 0.14,
    speedKt: 78, throttle: 0.62,
  });
  sortie.parcels.push({
    x: 545, y: 66, z: -1395, vx: 2.6, vy: -5.4, vz: 0.9,
    age: 3, chute: true, landed: false, target: sortie.targets[0],
  });
  sortie.parcelsAboard = 2;
  G.message = { text: 'MAIL AWAY', sub: 'for Tern Island village', colour: null, until: 1e9 };
  G.mode = 'fly';
}

// Sortie 3: the medicine is delivered, the tank is low, and the Wren is on
// a gusty final for the home strip with the rain coming through the light.
function stageStorm(G) {
  const campaign = { hull: 78, score: 2210, results: [], repairNote: 0, verdict: '' };
  const sortie = new Sortie(SORTIE_DEFS[2], campaign);
  sortie.timeSec = 342;
  sortie.fuel = 13;
  sortie.tookOff = true;
  sortie.targetNext = 1; // the lighthouse has its medicine
  sortie.parcelsAboard = 0;
  G.campaign = campaign;
  G.sortie = sortie;
  G.sortieIndex = 2;
  posePlane(G, {
    x: 96, y: 44, z: 1470,
    heading: -0.1, pitch: -0.055, roll: 0.09,
    speedKt: 63, throttle: 0.34,
  });
  G.mode = 'fly';
}

// The debrief card after the mail run: every village served, a silky
// landing, and the ledger to prove it. The Wren sits parked behind it.
function stageDebrief(G) {
  const campaign = { hull: 93, score: 0, results: [], repairNote: 0, verdict: '' };
  const sortie = new Sortie(SORTIE_DEFS[1], campaign);
  sortie.addScore('Tern Island village — 9 m', 320);
  sortie.addScore('Kala Bay village — 22 m', 220);
  sortie.addScore('Cinder Cay village — 41 m', 110);
  sortie.addScore('Landing — silky', 260);
  sortie.addScore('Fuel brought home', 46);
  sortie.outcome = 'complete';
  sortie.headline = 'Sortie complete';
  sortie.timeSec = 402;
  sortie.fuel = 41;
  campaign.score = 956 + 1180; // this sortie, on top of the ring run
  G.campaign = campaign;
  G.sortie = sortie;
  G.sortieIndex = 1;
  const plane = createPlane();
  placeOnRunway(plane);
  plane.z = RUNWAY.cz - 60;
  plane.throttle = 0;
  G.plane = plane;
  G.camOverride = null;
  G.mode = 'debrief';
}
