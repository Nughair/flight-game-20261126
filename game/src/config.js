// config.js — every shared constant of Duskwing Post in one place: canvas
// size, the golden-hour palette, flight-model tuning and the words the game
// shows the pilot. Nothing here runs; it only declares.

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const GAME_TITLE = 'DUSKWING POST';
export const GAME_SUBTITLE = 'Golden-Hour Air Mail over the Sora Archipelago';
export const PLANE_NAME = 'Wren D-4 “Duskwing”';

// Golden-hour palette: one warm light over sea, sand and pine.
export const PALETTE = {
  skyTop: '#3a2b52',
  skyMid: '#8a4a63',
  skyLow: '#e8804f',
  skyHorizon: '#ffc37a',
  sunCore: '#fff3c4',
  sunGlow: 'rgba(255, 178, 92, 0.55)',
  seaDeep: '#274b63',
  seaLight: '#3d6a80',
  sand: '#d9b878',
  grassLow: '#7d8f4a',
  grassHigh: '#a8a354',
  pine: '#4a6f3e',
  rock: '#8a7364',
  snow: '#f2e7d5',
  cloudWarm: '#f7c489',
  cloudShade: '#c97e63',
};

// Storm sortie palette shift (sortie 3 flies into weather).
export const STORM = {
  skyTop: '#232733',
  skyMid: '#454a5c',
  skyLow: '#7d6a5e',
  skyHorizon: '#b99a72',
  seaDeep: '#1d3038',
  seaLight: '#2c4650',
  dim: 0.74,
};

// Flight-model tuning, in metres, seconds and knots.
export const FLIGHT = {
  minSpeed: 0,
  maxSpeed: 118,          // knots, full throttle level
  stallSpeed: 38,         // knots; below this the wing gives up
  rotateSpeed: 46,        // knots; she will lift at this on the roll
  throttleRate: 0.45,     // throttle travel per second
  accelFull: 9.5,         // knots per second at full throttle, no drag
  dragQuad: 0.00072,      // quadratic drag coefficient
  climbAtFull: 11,        // m/s best climb
  sinkAtIdle: 6.5,        // m/s glide sink at idle near cruise
  bankMax: 62,            // degrees of bank at full stick
  pitchMax: 26,           // degrees nose up at full stick
  turnRateAt45: 16,       // degrees per second in a 45-degree bank
  fuelBurnFull: 1.0,      // fuel units per second at full throttle
  fuelBurnIdle: 0.22,
  crosswindStorm: 14,     // knots of gusting crosswind on sortie 3
};

export const CONTROLS_TEXT = [
  'W / S or ↑ / ↓ — pitch        A / D or ← / → — bank and turn',
  'R / F — throttle up / down    Space — drop the mail parcel',
  'B — wheel brakes (on the strip)   P — pause   M — sound on/off',
  'Mouse also flies: hold the pointer where you want the nose to go.',
];
