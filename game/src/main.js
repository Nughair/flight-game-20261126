// main.js — the conductor. Owns the game's state machine (title, briefing,
// flight, debrief, the final reckoning), the fixed-step clock, and the
// order of drawing: world first, then the objective diamond, the HUD and
// the panel. Everything else lives in its own module; this file only
// keeps them playing together.

import { VIEW_W, VIEW_H } from './config.js';
import { Input } from './input.js';
import { createPlane, placeOnRunway, stepFlight } from './flight.js';
import { drawWorld, bindWorld, snapCamera } from './render.js';
import { drawPanel, drawHud, drawObjectiveMarker } from './instruments.js';
import { PROPS, CLOUDS, RUNWAY, heightAt } from './world.js';
import { Sortie, FreeFlight, SORTIE_DEFS } from './missions.js';
import { SoundBox } from './audio.js';
import { drawTitle, drawHelp, drawBrief, drawDebrief, drawCampaignEnd, drawPaused, drawFreeFlightEnd } from './ui.js';
import { initShot, updateShot } from './shots.js';

const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sound = new SoundBox();
bindWorld(PROPS, CLOUDS);

const STEP = 1 / 60;

export const G = {
  mode: 'title',           // title | help | brief | fly | debrief | end | freeEnd
  menuIndex: 0,
  paused: false,
  muted: false,
  timeSec: 0,              // wall-clock of the session, for menus and shimmer
  plane: createPlane(),
  sortie: null,
  sortieIndex: 0,
  campaign: freshCampaign(),
  message: null,           // { text, sub, colour, until }
  overAt: 0,               // session time the current sortie ended
  shotMode: false,
  titlePlane: createPlane(),
};

function freshCampaign() {
  return { hull: 100, score: 0, results: [], repairNote: 0, verdict: '' };
}

// A slow golden orbit for the title screen: the Wren herself, circling the
// home island while the player reads the menu.
function updateTitlePlane(dt) {
  const p = G.titlePlane;
  const t = G.timeSec * 0.045;
  const cx = -150, cz = -250, radius = 1050;
  p.x = cx + Math.cos(t) * radius;
  p.z = cz + Math.sin(t) * radius;
  p.y = 165 + Math.sin(G.timeSec * 0.3) * 12;
  p.heading = Math.atan2(Math.cos(t), Math.sin(t)) + Math.PI / 2; // tangent to the circle
  p.roll = -0.32;
  p.pitch = 0.02;
  p.speedKt = 84;
  p.throttle = 0.7;
  p.onGround = false;
  p.propSpin += dt * 30;
}

// --- state changes ----------------------------------------------------------

function startCampaign() {
  G.campaign = freshCampaign();
  G.sortieIndex = 0;
  G.sortie = new Sortie(SORTIE_DEFS[0], G.campaign);
  G.mode = 'brief';
}

function startFreeFlight() {
  G.campaign = freshCampaign();
  G.sortie = new FreeFlight(G.campaign);
  beginFlight('Free flight — the archipelago is yours. Gates pay 160.');
}

function beginFlight(welcome) {
  placeOnRunway(G.plane);
  snapCamera();
  G.paused = false;
  G.mode = 'fly';
  if (welcome) showMessage(welcome, '', null, 3.4);
}

function showMessage(text, sub, colour, seconds = 2.6) {
  G.message = { text, sub, colour, until: G.timeSec + seconds };
}

function finishSortieBookkeeping() {
  const sortie = G.sortie;
  G.campaign.score += sortie.score;
  G.campaign.results.push({ name: sortie.def.name, headline: sortie.headline, score: sortie.score });
  // The ground crew patches the Wren between sorties: up to 40 points of
  // hull, at 3 score points apiece, if the score can carry it.
  G.campaign.repairNote = 0;
  if (G.sortieIndex < SORTIE_DEFS.length - 1 && G.campaign.hull > 0 && G.campaign.hull < 100) {
    const restore = Math.min(100 - G.campaign.hull, 40, Math.floor(G.campaign.score / 3));
    if (restore > 0) {
      G.campaign.score -= restore * 3;
      G.campaign.hull += restore;
      G.campaign.repairNote = restore * 3;
    }
  }
}

function campaignVerdict() {
  const c = G.campaign;
  if (c.hull <= 0) return 'The Wren is beyond patching — but the mail she carried is out there, delivered.';
  const done = c.results.filter((r) => r.headline === 'Sortie complete').length;
  if (done === 3) return 'Three sorties, three landings, every village served. The coast will talk about this week.';
  if (done >= 1) return 'Not every parcel made it — but the post flew, and the Wren came home.';
  return 'A hard week for the post. The archipelago is patient; so is the Wren.';
}

// --- the flight step ----------------------------------------------------------

function stepFlightMode(dt) {
  const plane = G.plane;
  const sortie = G.sortie;
  if (input.pressed('Escape')) { G.mode = 'title'; return; }
  if (input.pressed('KeyP')) G.paused = !G.paused;
  if (G.paused) return;

  const stickIn = input.stick();
  const stick = {
    pitch: stickIn.pitch,
    bank: stickIn.bank,
    throttleDelta: input.throttleDelta(),
    brake: input.brake(),
  };
  // Storm turbulence worries the airframe: small, honest nudges.
  if (sortie.storm && !plane.onGround && !plane.crashed) {
    const gust = sortie.windAt(sortie.timeSec).gust;
    plane.roll += Math.sin(sortie.timeSec * 11.3) * 0.0035 * gust;
    plane.pitch += Math.sin(sortie.timeSec * 7.9 + 1.7) * 0.0022 * gust;
  }
  const wind = sortie.windAt(sortie.timeSec);
  const events = stepFlight(plane, stick, dt, wind);

  if (input.pressed('Space')) {
    const note = sortie.dropParcel(plane);
    if (note) {
      showMessage(note.msg, note.sub, null);
      sound.play(note.sound);
    }
  }
  const notes = sortie.update(dt, plane, events);
  for (const note of notes) {
    if (note.msg) showMessage(note.msg, note.sub ?? '', note.colour ?? null, note.msg.length > 14 ? 3.2 : 2.6);
    if (note.sound) sound.play(note.sound);
  }
  sound.update(plane, dt);

  if (sortie.over && !G.overAt) G.overAt = G.timeSec;
  if (sortie.over && G.timeSec - G.overAt > 1.7) {
    G.overAt = 0;
    if (sortie.freeMode) {
      G.mode = 'freeEnd';
    } else {
      finishSortieBookkeeping();
      G.mode = 'debrief';
    }
  }
  // Free flight also ends, gently, when the pilot puts her away on the strip.
  if (sortie.freeMode && !sortie.over && sortie.tookOff && plane.onGround && plane.speedKt < 2
    && Math.abs(plane.x - RUNWAY.cx) <= RUNWAY.width / 2 + 3 && Math.abs(plane.z - RUNWAY.cz) <= RUNWAY.length / 2 + 3) {
    sortie.headline = 'Back on the ground';
    G.mode = 'freeEnd';
  }
}

// --- menus --------------------------------------------------------------------

function stepMenus(dt) {
  if (G.mode === 'title') {
    updateTitlePlane(dt);
    if (input.pressed('ArrowUp') || input.pressed('KeyW')) G.menuIndex = (G.menuIndex + 2) % 3;
    if (input.pressed('ArrowDown') || input.pressed('KeyS')) G.menuIndex = (G.menuIndex + 1) % 3;
    if (input.pressed('Enter')) {
      sound.unlock();
      if (G.menuIndex === 0) startCampaign();
      else if (G.menuIndex === 1) startFreeFlight();
      else G.mode = 'help';
    }
  } else if (G.mode === 'help') {
    updateTitlePlane(dt);
    if (input.pressed('Enter') || input.pressed('Escape')) G.mode = 'title';
  } else if (G.mode === 'brief') {
    if (input.pressed('Enter')) beginFlight();
    if (input.pressed('Escape')) G.mode = 'title';
  } else if (G.mode === 'debrief') {
    if (input.pressed('Enter')) {
      if (G.campaign.hull <= 0 || G.sortieIndex >= SORTIE_DEFS.length - 1) {
        G.campaign.verdict = campaignVerdict();
        G.mode = 'end';
      } else {
        G.sortieIndex += 1;
        G.sortie = new Sortie(SORTIE_DEFS[G.sortieIndex], G.campaign);
        G.mode = 'brief';
      }
    }
    if (input.pressed('Escape')) G.mode = 'title';
  } else if (G.mode === 'end' || G.mode === 'freeEnd') {
    if (input.pressed('Enter') || input.pressed('Escape')) G.mode = 'title';
  }
}

// --- drawing --------------------------------------------------------------------

function drawFlightView() {
  const plane = G.plane;
  const sortie = G.sortie;
  const isRings = sortie && (sortie.def.id === 'rings' || sortie.freeMode);
  const target = sortie && !sortie.objectivesDone && sortie.targets.length > 0
    ? (() => { const t = sortie.targets[sortie.targetNext]; return { x: t.x, z: t.z, r: t.r, y: Math.max(heightAt(t.x, t.z), 0) }; })()
    : null;
  const basis = drawWorld(ctx, {
    plane,
    storm: sortie?.storm ?? false,
    timeSec: sortie ? sortie.timeSec : G.timeSec,
    dt: STEP,
    camOverride: G.camOverride ?? null,
    rings: isRings && !sortie.objectivesDone ? { nextIndex: sortie.ringNext % 6 } : null,
    target,
    parcels: sortie ? sortie.parcels : [],
  });
  if (!sortie) return;
  // Objective diamond.
  const point = sortie.objectivePoint(plane);
  const dist = Math.hypot(plane.x - point.x, plane.y - point.y, plane.z - point.z);
  drawObjectiveMarker(ctx, basis, { ...point, dist }, point.label);
  // HUD and panel.
  const wind = sortie.windAt(sortie.timeSec);
  const windKt = Math.round(Math.hypot(wind.x, wind.z) * 1.944);
  const objective = sortie.objectiveText();
  drawHud(ctx, plane, {
    objective: objective.objective,
    sub: `${objective.sub} · ${formatClock(sortie.timeSec)} · Score ${sortie.score}`,
    windText: sortie.storm ? `CROSSWIND ${windKt} KT GUSTING` : null,
    message: G.message && G.timeSec < G.message.until ? G.message.text : null,
    messageSub: G.message && G.timeSec < G.message.until ? G.message.sub : null,
    messageColour: G.message?.colour ?? null,
  });
  drawPanel(ctx, plane, {
    fuel01: Math.min(1, sortie.fuel / sortie.fuelMax),
    hull01: G.campaign.hull / 100,
    engineOut: sortie.engineOut,
    parcelsAboard: sortie.parcelsAboard,
  });
  if (G.paused) drawPaused(ctx);
}

function draw() {
  if (G.mode === 'title' || G.mode === 'help') {
    drawWorld(ctx, { plane: G.titlePlane, storm: false, timeSec: G.timeSec, dt: STEP, rings: null, target: null, parcels: [] });
    if (G.mode === 'title') drawTitle(ctx, G.menuIndex, G.timeSec);
    else drawHelp(ctx);
  } else if (G.mode === 'brief') {
    drawWorld(ctx, { plane: G.titlePlane, storm: false, timeSec: G.timeSec, dt: STEP, rings: null, target: null, parcels: [] });
    drawBrief(ctx, G.sortie, G.campaign);
  } else if (G.mode === 'fly') {
    drawFlightView();
  } else if (G.mode === 'debrief') {
    drawFlightView();
    drawDebrief(ctx, G.sortie, G.campaign, G.sortieIndex >= SORTIE_DEFS.length - 1 || G.campaign.hull <= 0);
  } else if (G.mode === 'end') {
    drawWorld(ctx, { plane: G.titlePlane, storm: false, timeSec: G.timeSec, dt: STEP, rings: null, target: null, parcels: [] });
    drawCampaignEnd(ctx, G.campaign);
  } else if (G.mode === 'freeEnd') {
    drawFlightView();
    drawFreeFlightEnd(ctx, G.sortie);
  }
}

function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// --- the clock --------------------------------------------------------------------

let lastStamp = 0;
let accumulator = 0;

function frame(stamp) {
  requestAnimationFrame(frame);
  if (!lastStamp) lastStamp = stamp;
  let dt = (stamp - lastStamp) / 1000;
  lastStamp = stamp;
  if (dt > 0.25) dt = 0.25;
  accumulator += dt;
  let steps = 0;
  while (accumulator >= STEP && steps < 5) {
    G.timeSec += STEP;
    if (G.shotMode) updateShot(G, STEP);
    else if (G.mode === 'fly') stepFlightMode(STEP);
    else stepMenus(STEP);
    accumulator -= STEP;
    steps += 1;
  }
  draw();
}

// Sound starts on the first gesture, as the browsers require.
window.addEventListener('pointerdown', () => sound.unlock(), { once: false });
window.addEventListener('keydown', (event) => {
  sound.unlock();
  if (event.code === 'KeyM') {
    G.muted = !G.muted;
    sound.setMuted(G.muted);
  }
});

// Screenshot staging (?shot=<scene>) takes over from the menus entirely.
const params = new URLSearchParams(window.location.search);
if (params.has('shot')) {
  G.shotMode = true;
  initShot(G, params.get('shot'));
}

requestAnimationFrame(frame);
