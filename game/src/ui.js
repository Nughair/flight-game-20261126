// ui.js — the paper screens of the post office: title, sortie briefings,
// debriefs and the campaign ledger. Drawn over the world (the title flies
// a slow orbit over the archipelago), all in the same warm ink.

import { VIEW_W, VIEW_H, GAME_TITLE, GAME_SUBTITLE, CONTROLS_TEXT } from './config.js';
import { roundRect } from './instruments.js';

const INK = '#f5e7c8';
const GOLD = '#ffcf7d';
const FAINT = 'rgba(245, 231, 200, 0.72)';

export function drawTitle(ctx, menuIndex, timeSec) {
  shadeScreen(ctx, 0.34);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 74px Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.fillText(GAME_TITLE, VIEW_W / 2, 168);
  ctx.shadowBlur = 0;
  ctx.fillStyle = INK;
  ctx.font = 'italic 22px Georgia, serif';
  ctx.fillText(GAME_SUBTITLE, VIEW_W / 2, 208);

  const items = ['Fly the campaign — three sorties', 'Free flight', 'How to fly'];
  ctx.font = 'bold 25px Georgia, serif';
  items.forEach((label, i) => {
    const y = 320 + i * 52;
    if (i === menuIndex) {
      ctx.fillStyle = 'rgba(30, 19, 10, 0.66)';
      roundRect(ctx, VIEW_W / 2 - 265, y - 33, 530, 44, 10);
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.fillText(`— ${label} —`, VIEW_W / 2, y);
    } else {
      ctx.fillStyle = FAINT;
      ctx.fillText(label, VIEW_W / 2, y);
    }
  });
  ctx.font = '16px Georgia, serif';
  ctx.fillStyle = FAINT;
  ctx.fillText('W / S or ↑ / ↓ choose · Enter takes off · the mouse works too', VIEW_W / 2, 520);
  if (Math.floor(timeSec * 1.4) % 2 === 0) {
    ctx.fillStyle = 'rgba(245, 231, 200, 0.5)';
    ctx.font = 'italic 15px Georgia, serif';
    ctx.fillText('the light is best an hour before dark — fly it while it lasts', VIEW_W / 2, VIEW_H - 26);
  }
}

export function drawHelp(ctx) {
  shadeScreen(ctx, 0.55);
  paperCard(ctx, 240, 120, 800, 470);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3a2a16';
  ctx.font = 'bold 32px Georgia, serif';
  ctx.fillText('How to fly the Wren', VIEW_W / 2, 178);
  ctx.font = '17px Georgia, serif';
  ctx.fillStyle = '#4a3823';
  const lines = [
    'She lifts at 46 knots: full throttle, let the speed build,',
    'then ease the nose up. Below 38 knots the wing stalls and',
    'she mushes downward — nose down and throttle up cures it.',
    'Bank to turn; a steep bank bleeds speed and height, so keep',
    'her balanced. Land on the strip, into the light, sink gentle:',
    'under 3 m/s is silky, over 7 breaks things and costs hull.',
    '',
    ...CONTROLS_TEXT,
    '',
    'Enter — back to the title',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 224 + i * 27));
}

export function drawBrief(ctx, sortie, campaign) {
  shadeScreen(ctx, 0.5);
  paperCard(ctx, 290, 128, 700, 452);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7a4a1e';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('· DUSKWING POST · SORA FIELD ·', VIEW_W / 2, 172);
  ctx.fillStyle = '#3a2a16';
  ctx.font = 'bold 31px Georgia, serif';
  ctx.fillText(sortie.def.name, VIEW_W / 2, 214);
  ctx.strokeStyle = 'rgba(122, 74, 30, 0.5)';
  ctx.beginPath();
  ctx.moveTo(360, 234);
  ctx.lineTo(920, 234);
  ctx.stroke();
  ctx.font = '18px Georgia, serif';
  ctx.fillStyle = '#4a3823';
  sortie.def.brief.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 272 + i * 27));
  ctx.font = 'bold 16px monospace';
  ctx.fillStyle = '#7a4a1e';
  const hullNote = campaign.hull < 100 ? ` · hull ${Math.round(campaign.hull)}%${campaign.repairNote ? ` (patched: −${campaign.repairNote} pts)` : ''}` : '';
  ctx.fillText(`FUEL ${sortie.def.fuelLoad} · SCORE ${campaign.score}${hullNote}`, VIEW_W / 2, 512);
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillStyle = '#4a3823';
  ctx.fillText('Enter — roll out · Esc — title', VIEW_W / 2, 548);
}

export function drawDebrief(ctx, sortie, campaign, isLast) {
  shadeScreen(ctx, 0.52);
  const lines = sortie.lines;
  const h = 300 + lines.length * 27 + (isLast ? 60 : 0);
  paperCard(ctx, 330, 118, 620, Math.min(h, 520));
  ctx.textAlign = 'center';
  ctx.fillStyle = sortie.outcome === 'complete' ? '#4a6a2a' : '#9c3a22';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText(sortie.headline, VIEW_W / 2, 168);
  ctx.fillStyle = '#7a4a1e';
  ctx.font = '15px monospace';
  ctx.fillText(sortie.def.name.toUpperCase(), VIEW_W / 2, 196);
  ctx.font = '17px Georgia, serif';
  ctx.fillStyle = '#4a3823';
  let y = 236;
  if (lines.length === 0) ctx.fillText('Nothing on the ledger this time.', VIEW_W / 2, y += 4);
  for (const line of lines) {
    ctx.textAlign = 'left';
    ctx.fillText(line.label, 392, y);
    ctx.textAlign = 'right';
    ctx.fillText(line.points > 0 ? `+${line.points}` : '0', 888, y);
    ctx.textAlign = 'center';
    y += 27;
  }
  ctx.strokeStyle = 'rgba(122, 74, 30, 0.5)';
  ctx.beginPath();
  ctx.moveTo(392, y - 16);
  ctx.lineTo(888, y - 16);
  ctx.stroke();
  ctx.font = 'bold 19px Georgia, serif';
  ctx.fillStyle = '#3a2a16';
  ctx.fillText(`Sortie ${sortie.score} · Campaign ${campaign.score} · Hull ${Math.round(campaign.hull)}%`, VIEW_W / 2, y + 16);
  ctx.font = 'italic 17px Georgia, serif';
  ctx.fillStyle = '#4a3823';
  ctx.fillText(isLast ? 'Enter — the final reckoning' : 'Enter — next sortie · Esc — title', VIEW_W / 2, y + 50);
}

export function drawCampaignEnd(ctx, campaign) {
  shadeScreen(ctx, 0.45);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 46px Georgia, serif';
  ctx.fillText('THE POST IS DELIVERED', VIEW_W / 2, 210);
  ctx.fillStyle = INK;
  ctx.font = '21px Georgia, serif';
  ctx.fillText(campaign.verdict, VIEW_W / 2, 262);
  ctx.font = 'bold 30px monospace';
  ctx.fillStyle = GOLD;
  ctx.fillText(`FINAL SCORE ${campaign.score}`, VIEW_W / 2, 330);
  ctx.font = '18px Georgia, serif';
  ctx.fillStyle = FAINT;
  campaign.results.forEach((result, i) => {
    ctx.fillText(`${result.name} — ${result.headline} · ${result.score} pts`, VIEW_W / 2, 386 + i * 30);
  });
  ctx.fillText('Enter — fly it again · the light will be just as good', VIEW_W / 2, 540);
}

export function drawPaused(ctx) {
  shadeScreen(ctx, 0.45);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 10);
  ctx.font = '18px Georgia, serif';
  ctx.fillStyle = FAINT;
  ctx.fillText('P — back to the sky · Esc — title', VIEW_W / 2, VIEW_H / 2 + 28);
}

export function drawFreeFlightEnd(ctx, sortie) {
  shadeScreen(ctx, 0.45);
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.font = 'bold 38px Georgia, serif';
  ctx.fillText(sortie.headline || 'Back on the ground', VIEW_W / 2, 240);
  ctx.fillStyle = INK;
  ctx.font = '21px Georgia, serif';
  ctx.fillText(`Gates threaded: ${sortie.ringNext} · Score ${sortie.score}`, VIEW_W / 2, 296);
  ctx.font = 'italic 18px Georgia, serif';
  ctx.fillStyle = FAINT;
  ctx.fillText('Enter — title', VIEW_W / 2, 350);
}

function shadeScreen(ctx, alpha) {
  ctx.fillStyle = `rgba(16, 10, 7, ${alpha})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

// A postcard of heavy cream paper with a deckled warm edge.
function paperCard(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundRect(ctx, x + 6, y + 9, w, h, 10);
  ctx.fill();
  ctx.fillStyle = '#efe0bc';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = '#b98d4f';
  ctx.lineWidth = 2;
  roundRect(ctx, x + 7, y + 7, w - 14, h - 14, 7);
  ctx.stroke();
}
