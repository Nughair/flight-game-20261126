// missions.js — the post round. Three sorties make a campaign: a ring run
// to learn the coast, a mail run with three parcels and a drifting wind,
// and a storm run home through a gusting crosswind on short fuel. Hull
// damage carries from one sortie to the next; so does the score. This
// module owns the rules — objectives, parcels, fuel, landing grades and
// points — while flight.js owns the aeroplane and render.js the view.

import { RUNWAY, RING_COURSE, RING_RADIUS, DROP_TARGETS, heightAt } from './world.js';

const BURN_IDLE = 0.105;   // fuel units per second, engine ticking over
const BURN_FULL = 0.44;    // fuel units per second, throttle wide open
const KT_TO_MS = 0.5144;

export const SORTIE_DEFS = [
  {
    id: 'rings',
    name: 'Sortie 1 — The Ring Run',
    weather: 'golden',
    fuelLoad: 100,
    brief: [
      'Six gold gates hang over the archipelago, set out this morning',
      'by the flying club. Thread them in order — each one you centre',
      'pays 160 points — then come home and put her back on the strip.',
      'Watch the fuel: a wide-open throttle drinks it twice as fast.',
    ],
  },
  {
    id: 'mail',
    name: 'Sortie 2 — The Mail Run',
    weather: 'golden',
    fuelLoad: 115,
    brief: [
      'Three villages are waiting on the mail: Tern Island, Kala Bay',
      'and Cinder Cay. Carry a parcel to each orange circle and let it',
      'go with Space. The parachute drifts with the wind, so aim off',
      'upwind and let the parcel walk onto the mat.',
    ],
  },
  {
    id: 'storm',
    name: 'Sortie 3 — The Storm Run',
    weather: 'storm',
    fuelLoad: 72,
    brief: [
      'Weather is coming in and the lighthouse keeper on North Rock',
      'needs his medicine before dark. Drop it on the rock, then ride',
      'the crosswind home on what fuel you have. The gusts will push',
      'you sideways — crab into them and land gentle. There is no',
      'second parcel and no second chance at the strip.',
    ],
  },
];

const LIGHTHOUSE_PAD = { name: 'North Rock lighthouse', x: -350, z: -3246, r: 34 };

export class Sortie {
  constructor(def, campaign) {
    this.def = def;
    this.campaign = campaign;
    this.fuel = def.fuelLoad;
    this.fuelMax = def.fuelLoad;
    this.timeSec = 0;
    this.score = 0;
    this.lines = [];            // score ledger: {label, points}
    this.over = false;
    this.outcome = null;        // 'complete' | 'crashed' | 'ditched' | 'stranded'
    this.headline = '';
    this.ringNext = 0;
    this.parcels = [];
    this.dropResults = [];
    this.engineOut = false;
    this.landingGrade = null;
    this.tookOff = false;
    if (def.id === 'mail') {
      this.targets = DROP_TARGETS;
      this.parcelsAboard = 3;
    } else if (def.id === 'storm') {
      this.targets = [LIGHTHOUSE_PAD];
      this.parcelsAboard = 1;
    } else {
      this.targets = [];
      this.parcelsAboard = 0;
    }
    this.targetNext = 0;
  }

  get storm() {
    return this.def.weather === 'storm';
  }

  get objectivesDone() {
    if (this.def.id === 'rings') return this.ringNext >= RING_COURSE.length;
    return this.targetNext >= this.targets.length;
  }

  // Wind as a ground-drift vector in m/s, at time t of the sortie.
  windAt(t) {
    if (this.def.id === 'storm') {
      return {
        x: 6.5 + 4.6 * Math.sin(t * 0.9) + 2.8 * Math.sin(t * 2.63 + 1.3),
        z: 2.2 * Math.sin(t * 0.57 + 0.6),
        gust: 0.6 + 0.4 * Math.sin(t * 1.7 + 2.0),
      };
    }
    if (this.def.id === 'mail') return { x: 2.6, z: 0.9, gust: 0.15 };
    return { x: 0.8, z: 0.2, gust: 0.05 };
  }

  addScore(label, points) {
    this.score += points;
    this.lines.push({ label, points });
  }

  // Drop a parcel, if one is aboard and the Wren is airborne.
  dropParcel(plane) {
    if (this.parcelsAboard <= 0 || plane.onGround || plane.crashed) return null;
    this.parcelsAboard -= 1;
    const speedMs = plane.speedKt * KT_TO_MS;
    const parcel = {
      x: plane.x, y: plane.y - 2, z: plane.z,
      vx: Math.sin(plane.heading) * Math.cos(plane.pitch) * speedMs,
      vy: plane.vy - 1,
      vz: -Math.cos(plane.heading) * Math.cos(plane.pitch) * speedMs,
      age: 0, chute: false, landed: false,
      target: this.targets[this.targetNext],
    };
    this.parcels.push(parcel);
    return { msg: 'MAIL AWAY', sub: `for ${parcel.target.name}`, sound: 'drop' };
  }

  // Advance the sortie one step; flightEvents came from flight.js.
  update(dt, plane, flightEvents) {
    const notes = [];
    if (this.over) return notes;
    this.timeSec += dt;
    const wind = this.windAt(this.timeSec);

    // Fuel and the engine.
    if (!plane.onGround || plane.speedKt > 3) {
      this.fuel -= (BURN_IDLE + (BURN_FULL - BURN_IDLE) * plane.throttle) * dt;
    }
    if (this.fuel <= 0 && !this.engineOut) {
      this.fuel = 0;
      this.engineOut = true;
      notes.push({ msg: 'ENGINE SILENT', sub: 'Out of fuel — glide her home', colour: '#ff9a8a', sound: 'out' });
    }
    if (this.engineOut) plane.throttle = 0;

    for (const event of flightEvents) {
      if (event.type === 'liftoff') this.tookOff = true;
      if (event.type === 'crash') {
        this.finishWithCrash(event, notes);
      }
      if (event.type === 'touchdown' && !this.over) {
        this.judgeTouchdown(event, notes);
      }
    }
    if (this.over) return notes;

    // Rings (the ring sortie, and free flight where the course loops).
    if ((this.def.id === 'rings' || this.freeMode) && !plane.onGround) {
      const ring = RING_COURSE[this.ringNext % RING_COURSE.length];
      if (ring) {
        const dx = plane.x - ring.x;
        const dy = plane.y - ring.alt;
        const dz = plane.z - ring.z;
        if (dx * dx + dy * dy + dz * dz < RING_RADIUS * RING_RADIUS) {
          this.ringNext += 1;
          this.addScore(`Gate ${this.ringNext} threaded`, 160);
          const wrapped = this.freeMode && this.ringNext % RING_COURSE.length === 0;
          if (wrapped) this.addScore('The whole course, again', 300);
          notes.push({
            msg: `GATE ${this.ringNext} OF ${RING_COURSE.length}`,
            sub: this.objectivesDone ? 'Course complete — home and land' : '+160 points',
            sound: 'ring',
          });
        }
      }
    }

    // Parcels fall, drift and land.
    for (const parcel of this.parcels) {
      if (parcel.landed) continue;
      parcel.age += dt;
      if (parcel.age > 0.9) parcel.chute = true;
      if (parcel.chute) {
        parcel.vy += (-5.4 - parcel.vy) * Math.min(1, dt * 2.2);
        parcel.vx += (wind.x - parcel.vx) * dt * 0.85;
        parcel.vz += (wind.z - parcel.vz) * dt * 0.85;
      } else {
        parcel.vy -= 9.8 * dt;
        parcel.vx *= 1 - dt * 0.12;
        parcel.vz *= 1 - dt * 0.12;
      }
      parcel.x += parcel.vx * dt;
      parcel.y += parcel.vy * dt;
      parcel.z += parcel.vz * dt;
      const ground = Math.max(heightAt(parcel.x, parcel.z), 0);
      if (parcel.y <= ground + 0.4) {
        parcel.y = ground + 0.4;
        parcel.landed = true;
        this.judgeDrop(parcel, notes);
      }
    }

    // Home, stopped on the strip, work done: the sortie is complete.
    if (this.objectivesDone && this.tookOff && plane.onGround && !plane.crashed
      && plane.speedKt < 2 && Math.abs(plane.x - RUNWAY.cx) <= RUNWAY.width / 2 + 3
      && Math.abs(plane.z - RUNWAY.cz) <= RUNWAY.length / 2 + 3) {
      this.over = true;
      this.outcome = 'complete';
      const fuelBonus = Math.round(this.fuel * 2);
      if (fuelBonus > 0) this.addScore('Fuel brought home', fuelBonus);
      this.headline = 'Sortie complete';
      notes.push({ msg: 'SORTIE COMPLETE', sub: this.def.name, sound: 'win' });
    }
    return notes;
  }

  judgeDrop(parcel, notes) {
    const target = parcel.target;
    const dist = Math.hypot(parcel.x - target.x, parcel.z - target.z);
    let points;
    let verdict;
    if (dist <= 14) { points = 320; verdict = 'ON THE DOORMAT'; }
    else if (dist <= target.r) { points = 220; verdict = 'ON THE MAT'; }
    else if (dist <= target.r + 26) { points = 110; verdict = 'IN THE VILLAGE'; }
    else { points = 25; verdict = 'IN THE PARISH'; }
    this.addScore(`${target.name} — ${Math.round(dist)} m`, points);
    this.dropResults.push({ name: target.name, dist, points });
    this.targetNext += 1;
    notes.push({
      msg: verdict,
      sub: `${target.name} · ${Math.round(dist)} m · +${points}`,
      sound: points >= 220 ? 'win' : 'drop',
    });
  }

  judgeTouchdown(event, notes) {
    if (!this.tookOff) return;
    if (event.overWater) {
      // A gentle arrival on the sea is still a ditching: she floats, the
      // sortie ends, and the hull drinks salt water.
      this.over = true;
      this.outcome = 'ditched';
      this.headline = 'Down in the sea';
      this.campaign.hull = Math.max(0, this.campaign.hull - 20);
      notes.push({ msg: 'DITCHED', sub: 'She floats — but the sortie ends here', colour: '#ff9a8a', sound: 'splash' });
      return;
    }
    if (event.onStrip) {
      let grade;
      let points;
      if (event.sinkMs >= -3.1) { grade = 'SILKY'; points = 260; }
      else if (event.sinkMs >= -5.4) { grade = 'FIRM'; points = 140; }
      else if (event.sinkMs >= -7.6) { grade = 'ROUGH'; points = 50; }
      else { grade = 'HEAVY'; points = 0; }
      this.landingGrade = grade;
      if (points > 0 || grade !== 'HEAVY') this.addScore(`Landing — ${grade.toLowerCase()}`, points);
      if (grade === 'ROUGH' || grade === 'HEAVY') {
        const hurt = grade === 'ROUGH' ? 7 : 14;
        this.campaign.hull = Math.max(0, this.campaign.hull - hurt);
        notes.push({ msg: `${grade} ARRIVAL`, sub: `The airframe felt that — hull −${hurt}`, colour: '#ffb0a5', sound: 'thud' });
      } else {
        notes.push({ msg: `${grade} LANDING`, sub: `+${points} points`, sound: 'touch' });
      }
    } else if (event.sinkMs < -4.5) {
      this.campaign.hull = Math.max(0, this.campaign.hull - 5);
      notes.push({ msg: 'ROUGH FIELD LANDING', sub: 'Hull −5 · the strip is where the points are', colour: '#ffb0a5', sound: 'thud' });
    } else {
      notes.push({ msg: 'FIELD LANDING', sub: 'Off the strip — no landing points here', sound: 'touch' });
    }
  }

  finishWithCrash(event, notes) {
    this.over = true;
    this.campaign.hull = Math.max(0, this.campaign.hull - 45);
    if (event.cause === 'ditched') {
      this.outcome = 'ditched';
      this.headline = 'Down in the sea';
      notes.push({ msg: 'DITCHED', sub: 'The Wren floats a while. The mail does not.', colour: '#ff9a8a', sound: 'splash' });
    } else if (event.cause === 'terrain') {
      this.outcome = 'crashed';
      this.headline = 'Into the hillside';
      notes.push({ msg: 'TERRAIN', sub: 'The archipelago keeps what it catches', colour: '#ff9a8a', sound: 'crash' });
    } else {
      this.outcome = 'crashed';
      this.headline = 'An arrival the airframe could not take';
      notes.push({ msg: 'BROKEN ON ARRIVAL', sub: 'Too fast, too steep, or too much bank', colour: '#ff9a8a', sound: 'crash' });
    }
  }

  // What the HUD says and where its diamond points.
  objectiveText() {
    if (this.def.id === 'rings') {
      if (!this.objectivesDone) return { objective: `Thread the gold gates — ${this.ringNext} of ${RING_COURSE.length}`, sub: 'In order, then home to the strip' };
    } else if (!this.objectivesDone) {
      const target = this.targets[this.targetNext];
      return { objective: `Mail for ${target.name}`, sub: this.parcelsAboard > 0 ? 'Space lets the parcel go — mind the drift' : 'Watch it fall…' };
    }
    return { objective: 'Work done — home to Sora Field', sub: 'Land on the strip and stop to finish' };
  }

  objectivePoint(plane) {
    if ((this.def.id === 'rings' || this.freeMode) && !this.objectivesDone) {
      const ring = RING_COURSE[this.ringNext % RING_COURSE.length];
      return { x: ring.x, y: ring.alt, z: ring.z, label: `GATE ${(this.ringNext % RING_COURSE.length) + 1}` };
    }
    if (!this.objectivesDone) {
      const target = this.targets[this.targetNext];
      return { x: target.x, y: Math.max(heightAt(target.x, target.z), 0) + 8, z: target.z, label: 'DROP' };
    }
    return { x: RUNWAY.cx, y: RUNWAY.alt + 6, z: RUNWAY.cz - RUNWAY.length / 2, label: 'STRIP' };
  }
}

// Free flight: no objectives to finish, gates forever, a full tank that
// only a crash can end. Flown from the title screen, outside the campaign.
export class FreeFlight extends Sortie {
  constructor(campaign) {
    super({ id: 'rings', name: 'Free Flight — the whole archipelago', weather: 'golden', fuelLoad: 9999, brief: [] }, campaign);
    this.def = { ...this.def, id: 'free' };
    this.freeMode = true;
  }

  get objectivesDone() {
    return false;
  }

  objectiveText() {
    return { objective: `Free flight — gates threaded: ${this.ringNext}`, sub: 'Land and stop whenever you are done' };
  }
}
