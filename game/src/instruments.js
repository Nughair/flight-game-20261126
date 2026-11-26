// instruments.js — the Wren's panel and the pilot's HUD. Round steam gauges
// with warm backlight across the bottom (airspeed, attitude, altimeter,
// heading, vertical speed), throttle / fuel / hull bars beside them, and
// the flight's facts across the top: ALT, SPD, HDG in plain figures, the
// current objective, and a diamond that points the way to it.

import { VIEW_W, VIEW_H } from './config.js';
import { headingDeg } from './flight.js';
import { projectPoint } from './render.js';

const PANEL_TOP = 560;
const INK = '#f5e7c8';

const PANEL = {
  face: '#1d150e',
  rim: '#4a3823',
  gaugeFace: '#14100b',
  gaugeRim: '#6d5836',
  needle: '#ffb84d',
  red: '#e0483a',
  green: '#7dc95e',
  amber: '#ffb84d',
};

export function drawPanel(ctx, plane, state) {
  // The panel board: dark wood with a warm rim light along its top edge.
  ctx.fillStyle = 'rgba(24, 17, 11, 0.92)';
  roundRect(ctx, -6, PANEL_TOP, VIEW_W + 12, VIEW_H - PANEL_TOP + 8, 18);
  ctx.fill();
  ctx.strokeStyle = PANEL.rim;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, PANEL_TOP + 1);
  ctx.lineTo(VIEW_W, PANEL_TOP + 1);
  ctx.stroke();

  const cy = PANEL_TOP + 82;
  const altFt = Math.max(0, Math.round(plane.y * 3.28084));
  drawAirspeed(ctx, 108, cy, 55, plane.speedKt);
  drawAttitude(ctx, 243, cy, 55, plane);
  drawAltimeter(ctx, 378, cy, 55, altFt);
  drawHeading(ctx, 513, cy, 55, headingDeg(plane));
  drawVerticalSpeed(ctx, 648, cy, 55, plane.vy * 196.85);

  // Right cluster: throttle, fuel and hull as labelled brass bars.
  drawBar(ctx, 748, PANEL_TOP + 38, 300, 'THROTTLE', plane.throttle, '#ffb84d');
  drawBar(ctx, 748, PANEL_TOP + 78, 300, 'FUEL', state.fuel01, state.fuel01 < 0.22 ? PANEL.red : '#7dc95e');
  drawBar(ctx, 748, PANEL_TOP + 118, 300, 'HULL', state.hull01, state.hull01 < 0.35 ? PANEL.red : '#e8dfc8');

  // Warning lamps.
  let lampX = 1090;
  const lamp = (label, on, colour) => {
    ctx.fillStyle = on ? colour : 'rgba(120, 100, 80, 0.25)';
    roundRect(ctx, lampX, PANEL_TOP + 30, 82, 24, 5);
    ctx.fill();
    ctx.fillStyle = on ? '#1d150e' : 'rgba(220, 200, 170, 0.4)';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, lampX + 41, PANEL_TOP + 46);
    lampX += 92;
  };
  lamp('STALL', plane.stalled, PANEL.red);
  lamp('LOW FUEL', state.fuel01 < 0.22, PANEL.amber);
  lampX = 1090;
  // second row of lamps sits lower
  ctx.save();
  ctx.translate(0, 40);
  lamp('ENGINE', state.engineOut, PANEL.red);
  lamp('MAIL', state.parcelsAboard > 0, PANEL.green);
  ctx.restore();

  ctx.fillStyle = 'rgba(230, 210, 175, 0.75)';
  ctx.font = 'italic 13px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText('Wren D-4 · Duskwing Post', VIEW_W - 18, VIEW_H - 12);
}

// --- the round gauges -------------------------------------------------------

function gaugeShell(ctx, cx, cy, r, label) {
  ctx.beginPath();
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
  ctx.fillStyle = PANEL.gaugeRim;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = PANEL.gaugeFace;
  ctx.fill();
  // A breath of glass: a soft arc of reflected light.
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, Math.PI * 1.15, Math.PI * 1.55);
  ctx.strokeStyle = 'rgba(255, 230, 190, 0.16)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(245, 231, 200, 0.8)';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r - 7);
}

function needle(ctx, cx, cy, r, angle, colour = PANEL.needle) {
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(angle) * 7, cy - Math.sin(angle) * 7);
  ctx.lineTo(cx + Math.cos(angle) * (r - 9), cy + Math.sin(angle) * (r - 9));
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0a07';
  ctx.fill();
}

// Map a value onto the classic 270-degree sweep (down-left to down-right).
function sweepAngle(frac) {
  return Math.PI * 0.75 + frac * Math.PI * 1.5;
}

function ticks(ctx, cx, cy, r, count, labelEvery, labelFn, fracFn) {
  ctx.fillStyle = INK;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  for (let i = 0; i <= count; i++) {
    const frac = i / count;
    const a = sweepAngle(frac);
    const inner = r - 10;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.strokeStyle = 'rgba(245, 231, 200, 0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (labelEvery && i % labelEvery === 0) {
      ctx.fillText(labelFn(fracFn(frac)), cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22) + 3);
    }
  }
}

function drawAirspeed(ctx, cx, cy, r, kt) {
  gaugeShell(ctx, cx, cy, r, 'AIRSPEED · KT');
  // Stall band in red, working band in green, redline at the top end.
  band(ctx, cx, cy, r, 0, 38 / 160, PANEL.red);
  band(ctx, cx, cy, r, 50 / 160, 102 / 160, PANEL.green);
  band(ctx, cx, cy, r, 128 / 160, 132 / 160, PANEL.red);
  ticks(ctx, cx, cy, r, 8, 2, (v) => String(Math.round(v)), (f) => f * 160);
  needle(ctx, cx, cy, r, sweepAngle(clamp01(kt / 160)));
}

function band(ctx, cx, cy, r, fromFrac, toFrac, colour) {
  ctx.beginPath();
  ctx.arc(cx, cy, r - 6, sweepAngle(fromFrac), sweepAngle(toFrac));
  ctx.strokeStyle = colour;
  ctx.lineWidth = 4;
  ctx.stroke();
}

function drawAltimeter(ctx, cx, cy, r, altFt) {
  gaugeShell(ctx, cx, cy, r, 'ALTIMETER · FT');
  ticks(ctx, cx, cy, r, 10, 1, (v) => String(Math.round(v / 100)), (f) => f * 1000);
  needle(ctx, cx, cy, r, sweepAngle((altFt % 1000) / 1000));
  // The thousands live in a little drum window under the needle.
  ctx.fillStyle = '#0d0a07';
  ctx.fillRect(cx - 21, cy + 12, 42, 15);
  ctx.strokeStyle = 'rgba(245, 231, 200, 0.35)';
  ctx.strokeRect(cx - 21, cy + 12, 42, 15);
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(altFt), cx, cy + 23);
}

function drawAttitude(ctx, cx, cy, r, plane) {
  gaugeShell(ctx, cx, cy, r, 'ATTITUDE');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 6, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll);
  const pitchPx = clamp(plane.pitch * (180 / Math.PI), -30, 30) * 1.55;
  ctx.fillStyle = '#7a4a3a'; // warm earth below
  ctx.fillRect(-r, pitchPx, r * 2, r * 2);
  ctx.fillStyle = '#4a6a8a'; // dusk sky above
  ctx.fillRect(-r, -r * 2 + pitchPx, r * 2, r * 2);
  ctx.fillStyle = '#f5e7c8';
  ctx.fillRect(-r, pitchPx - 1, r * 2, 2);
  for (const mark of [-20, -10, 10, 20]) {
    const y = pitchPx - mark * 1.55;
    ctx.fillRect(mark % 20 === 0 ? -13 : -8, y, mark % 20 === 0 ? 26 : 16, 1.6);
  }
  ctx.restore();
  // The fixed aeroplane symbol rides above the ball.
  ctx.strokeStyle = PANEL.amber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.lineTo(cx, cy + 5);
  ctx.lineTo(cx + 8, cy);
  ctx.lineTo(cx + 24, cy);
  ctx.stroke();
  // The label is drawn last so the ball cannot swallow it.
  ctx.fillStyle = 'rgba(245, 231, 200, 0.9)';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r - 7);
  ctx.beginPath();
  ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = PANEL.amber;
  ctx.fill();
}

function drawHeading(ctx, cx, cy, r, hdg) {
  gaugeShell(ctx, cx, cy, r, 'HEADING');
  const cardinals = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
  ctx.fillStyle = INK;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  for (const [deg, label] of cardinals) {
    const a = -Math.PI / 2 + ((deg - hdg) * Math.PI) / 180;
    const lx = cx + Math.cos(a) * (r - 16);
    const ly = cy + Math.sin(a) * (r - 16) + 4;
    ctx.fillText(label, lx, ly);
  }
  for (let deg = 0; deg < 360; deg += 30) {
    const a = -Math.PI / 2 + ((deg - hdg) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
    ctx.lineTo(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1));
    ctx.strokeStyle = 'rgba(245, 231, 200, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Lubber line at the top.
  ctx.beginPath();
  ctx.moveTo(cx, cy - r - 2);
  ctx.lineTo(cx - 6, cy - r - 11);
  ctx.lineTo(cx + 6, cy - r - 11);
  ctx.closePath();
  ctx.fillStyle = PANEL.amber;
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(String(Math.round(hdg)).padStart(3, '0') + '°', cx, cy + 25);
}

function drawVerticalSpeed(ctx, cx, cy, r, fpm) {
  gaugeShell(ctx, cx, cy, r, 'VERT SPEED · FPM');
  ctx.fillStyle = INK;
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  for (const v of [-2000, -1000, 0, 1000, 2000]) {
    const a = Math.PI + ((v + 2000) / 4000) * Math.PI;
    ctx.fillText(v === 0 ? '0' : String(Math.abs(v) / 1000) + (v > 0 ? '+' : '−'), cx + Math.cos(a) * (r - 17), cy + Math.sin(a) * (r - 17) + 3);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 9), cy + Math.sin(a) * (r - 9));
    ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.strokeStyle = 'rgba(245, 231, 200, 0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const a = Math.PI + ((clamp(fpm, -2000, 2000) + 2000) / 4000) * Math.PI;
  needle(ctx, cx, cy, r, a);
}

function drawBar(ctx, x, y, w, label, frac, colour) {
  ctx.fillStyle = 'rgba(245, 231, 200, 0.85)';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y + 4);
  const bx = x + 86;
  const bw = w - 86 - 44;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  roundRect(ctx, bx, y - 6, bw, 13, 4);
  ctx.fill();
  ctx.fillStyle = colour;
  if (frac > 0.01) {
    roundRect(ctx, bx + 1.5, y - 4.5, (bw - 3) * clamp01(frac), 10, 3);
    ctx.fill();
  }
  ctx.fillStyle = INK;
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(frac * 100) + '%', x + w, y + 5);
}

// --- the HUD across the top -------------------------------------------------

export function drawHud(ctx, plane, hud) {
  const altFt = Math.max(0, Math.round(plane.y * 3.28084));
  const spd = Math.round(plane.speedKt);
  const hdg = Math.round(headingDeg(plane));
  ctx.textAlign = 'left';
  ctx.font = 'bold 21px monospace';
  ctx.fillStyle = 'rgba(10, 8, 6, 0.45)';
  roundRect(ctx, 14, 12, 218, 62, 8);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(`ALT ${altFt.toLocaleString('en-US')} FT`, 26, 38);
  ctx.fillText(`SPD ${spd} KT`, 26, 64);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(10, 8, 6, 0.45)';
  roundRect(ctx, VIEW_W - 232, 12, 218, hud.windText ? 62 : 38, 8);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, VIEW_W - 26, 38);
  if (hud.windText) {
    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#ffd9a0';
    ctx.fillText(hud.windText, VIEW_W - 26, 64);
  }

  // Objective banner, top centre.
  if (hud.objective) {
    ctx.font = 'bold 18px Georgia, serif';
    const w1 = ctx.measureText(hud.objective).width;
    ctx.font = '14px Georgia, serif';
    const w2 = hud.sub ? ctx.measureText(hud.sub).width : 0;
    const w = Math.max(w1, w2) + 44;
    ctx.fillStyle = 'rgba(24, 15, 9, 0.62)';
    roundRect(ctx, VIEW_W / 2 - w / 2, 12, w, hud.sub ? 58 : 38, 9);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe9bb';
    ctx.font = 'bold 18px Georgia, serif';
    ctx.fillText(hud.objective, VIEW_W / 2, 36);
    if (hud.sub) {
      ctx.fillStyle = 'rgba(245, 231, 200, 0.85)';
      ctx.font = '14px Georgia, serif';
      ctx.fillText(hud.sub, VIEW_W / 2, 58);
    }
  }

  // Centre-screen event messages (ring taken, mail away, warnings).
  if (hud.message) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillStyle = hud.messageColour ?? '#ffe9bb';
    ctx.shadowColor = 'rgba(0,0,0,0.65)';
    ctx.shadowBlur = 12;
    ctx.fillText(hud.message, VIEW_W / 2, 170);
    ctx.shadowBlur = 0;
    if (hud.messageSub) {
      ctx.font = '18px Georgia, serif';
      ctx.fillStyle = 'rgba(245, 231, 200, 0.9)';
      ctx.fillText(hud.messageSub, VIEW_W / 2, 200);
    }
  }
  if (plane.stalled) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = Math.floor(performance.now() / 280) % 2 ? PANEL.red : '#ffb0a5';
    ctx.fillText('— STALL —', VIEW_W / 2, 248);
  }
}

// A diamond that marks the active objective in the world, clamped to the
// screen edge with its distance, so the pilot always knows where to go.
export function drawObjectiveMarker(ctx, basis, target, label) {
  const p = projectPoint(basis, target.x, target.y, target.z);
  let x, y, offscreen = false;
  if (p && p.x > 30 && p.x < VIEW_W - 30 && p.y > 30 && p.y < PANEL_TOP - 16) {
    x = p.x; y = p.y;
  } else {
    offscreen = true;
    // Clamp the direction from screen centre onto a safe frame.
    const dx = p ? p.x - VIEW_W / 2 : Math.sin(target.bearing ?? 0);
    const dy = p ? p.y - (PANEL_TOP - 40) / 2 : 1;
    const len = Math.hypot(dx, dy) || 1;
    x = VIEW_W / 2 + (dx / len) * (VIEW_W / 2 - 56);
    y = (PANEL_TOP - 40) / 2 + (dy / len) * ((PANEL_TOP - 40) / 2 - 26);
    y = Math.max(96, y);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = offscreen ? 'rgba(255, 157, 77, 0.55)' : '#ff9d4d';
  ctx.fillRect(-8, -8, 16, 16);
  ctx.strokeStyle = '#fff0d0';
  ctx.lineWidth = 2;
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.restore();
  const dist = Math.round(target.dist);
  const text = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${dist} m`;
  ctx.textAlign = 'center';
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#ffe9bb';
  ctx.fillText(label, x, y - 16);
  ctx.fillText(text, x, y + 28);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function clamp(v, low, high) {
  return Math.min(high, Math.max(low, v));
}
