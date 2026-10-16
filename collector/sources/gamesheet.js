// GameSheet public game pages (gamesheetstats.com/seasons/{s}/games/{g}).
// GameSheet's robots.txt blocks its /api/ path, so we only read the public
// page, which is server-rendered by Next.js. The page streams its data in
// `self.__next_f.push([...])` chunks; we pull the box-score objects out of
// those, and fall back to the visible text if the shape changes.
import * as cheerio from 'cheerio';

export const gameUrl = (season, game) => `https://gamesheetstats.com/seasons/${season}/games/${game}`;

const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

function flightPayload(html) {
  const chunks = [];
  const re = /self\.__next_f\.push\(\[\d+,\s*("(?:[^"\\]|\\.)*")\]\)/g;
  let m;
  while ((m = re.exec(html))) {
    try { chunks.push(JSON.parse(m[1])); } catch { /* ignore */ }
  }
  return chunks.join('');
}

// Find the first balanced JSON object/array that follows a key.
function extractAfterKey(text, key) {
  const i = text.indexOf(`"${key}":`);
  if (i < 0) return null;
  let j = i + key.length + 3;
  const open = text[j];
  const close = open === '[' ? ']' : open === '{' ? '}' : null;
  if (!close) return null;
  let depth = 0, inStr = false;
  for (let k = j; k < text.length; k++) {
    const c = text[k];
    if (inStr) { if (c === '\\') k++; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) {
      try { return JSON.parse(text.slice(j, k + 1)); } catch { return null; }
    }
  }
  return null;
}

export function parseGamePage(html) {
  const payload = flightPayload(html);
  const goals = extractAfterKey(payload, 'goals');
  const penalties = extractAfterKey(payload, 'penalties');
  const periods = extractAfterKey(payload, 'periods') ?? extractAfterKey(payload, 'scoreByPeriod');

  if (Array.isArray(goals) || Array.isArray(penalties)) {
    return {
      source: 'flight',
      periods: periods ?? null,
      goals: (goals ?? []).map(normGoal),
      penalties: (penalties ?? []).map(normPenalty),
    };
  }

  // Fallback: visible text sections. Times look like "07:51", periods "1st".
  const $ = cheerio.load(html);
  const text = $('body').text().split('\n').map(clean).filter(Boolean);
  return { source: 'text', periods: null, goals: [], penalties: [], rawLines: text.slice(0, 400) };
}

function normGoal(g) {
  return {
    period: g.period ?? g.periodNumber ?? null,
    time: g.time ?? g.gameTime ?? null,
    team: g.teamTitle ?? g.team?.title ?? g.team ?? null,
    scorer: g.scorer?.name ?? g.scorerName ?? null,
    scorerNumber: g.scorer?.jersey ?? g.scorerJersey ?? null,
    assists: (g.assists ?? g.assistedBy ?? []).map((a) => a?.name ?? a).filter(Boolean),
    type: g.type ?? g.goalType ?? null, // PP, SH, EN
  };
}

function normPenalty(p) {
  return {
    period: p.period ?? p.periodNumber ?? null,
    time: p.time ?? p.gameTime ?? null,
    team: p.teamTitle ?? p.team?.title ?? p.team ?? null,
    player: p.player?.name ?? p.playerName ?? null,
    playerNumber: p.player?.jersey ?? null,
    infraction: p.penaltyType ?? p.infraction ?? p.label ?? null,
    minutes: p.duration ?? p.minutes ?? null,
  };
}
