// 타일 공방 — 게임 규칙 엔진 (화면과 분리된 순수 로직)

export const TILE_NAMES = ['쪽빛', '호박', '석류', '먹', '옥'];
export const TILES_PER_COLOR = 20;
export const FLOOR_PENALTY = [-1, -1, -2, -2, -2, -3, -3];
export const FACTORY_COUNT = { 2: 5, 3: 7, 4: 9 };
export const FIRST = 'first'; // 선 플레이어 표식

// 벽의 r행 c열에 놓이는 색
export const wallColor = (row, col) => (col - row + 5) % 5;
// r행에서 color가 놓이는 열
export const wallCol = (row, color) => (color + row) % 5;

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function newGame(names, rng = Math.random) {
  const n = names.length;
  if (n < 2 || n > 4) throw new Error('2~4명만 가능합니다');
  const bag = [];
  for (let c = 0; c < 5; c++) for (let i = 0; i < TILES_PER_COLOR; i++) bag.push(c);
  shuffle(bag, rng);
  const s = {
    players: names.map((name) => ({
      name,
      score: 0,
      lines: Array.from({ length: 5 }, () => ({ color: null, count: 0 })),
      wall: Array.from({ length: 5 }, () => Array(5).fill(false)),
      floor: [],
    })),
    factories: Array.from({ length: FACTORY_COUNT[n] }, () => []),
    center: [],
    centerHasFirst: true,
    bag,
    lid: [],
    current: 0,
    firstNext: null,
    round: 1,
    phase: 'pick', // 'pick' | 'over'
    lastRound: null, // 마지막 라운드 정산 기록
    final: null,
  };
  fillFactories(s, rng);
  return s;
}

function draw(s, rng) {
  if (s.bag.length === 0) {
    if (s.lid.length === 0) return null;
    s.bag = shuffle(s.lid, rng);
    s.lid = [];
  }
  return s.bag.pop();
}

function fillFactories(s, rng) {
  for (const f of s.factories) {
    f.length = 0;
    for (let i = 0; i < 4; i++) {
      const t = draw(s, rng);
      if (t === null) return;
      f.push(t);
    }
  }
  s.center = [];
  s.centerHasFirst = true;
}

export function sourceTiles(s, source) {
  return source.type === 'factory' ? s.factories[source.index] : s.center;
}

// color 타일을 놓을 수 있는 패턴 라인 목록 (-1 = 바닥줄은 항상 가능)
export function legalRows(s, color, playerIdx = s.current) {
  const p = s.players[playerIdx];
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const line = p.lines[i];
    if (line.count >= i + 1) continue;
    if (line.color !== null && line.color !== color) continue;
    if (p.wall[i][wallCol(i, color)]) continue;
    rows.push(i);
  }
  rows.push(-1);
  return rows;
}

export function legalMoves(s) {
  if (s.phase !== 'pick') return [];
  const moves = [];
  const sources = s.factories.map((_, i) => ({ type: 'factory', index: i }));
  sources.push({ type: 'center' });
  for (const src of sources) {
    const colors = [...new Set(sourceTiles(s, src))];
    for (const color of colors) {
      for (const row of legalRows(s, color)) moves.push({ source: src, color, row });
    }
  }
  return moves;
}

function addToFloor(s, p, item) {
  if (p.floor.length < FLOOR_PENALTY.length) {
    p.floor.push(item);
  } else if (item === FIRST) {
    // 바닥줄이 가득 차도 선 표식은 반드시 바닥줄에 남는다
    s.lid.push(p.floor.pop());
    p.floor.push(FIRST);
  } else {
    s.lid.push(item);
  }
}

// 한 수 두기. 성공하면 결과 정보를 돌려준다.
export function take(s, { source, color, row }, rng = Math.random) {
  if (s.phase !== 'pick') throw new Error('지금은 타일을 가져올 수 없습니다');
  const tiles = sourceTiles(s, source);
  const picked = tiles.filter((t) => t === color);
  if (picked.length === 0) throw new Error('그 색 타일이 없습니다');
  if (!legalRows(s, color).includes(row)) throw new Error('그 줄에는 놓을 수 없습니다');

  const p = s.players[s.current];
  const rest = tiles.filter((t) => t !== color);
  let tookFirst = false;
  if (source.type === 'factory') {
    s.factories[source.index] = [];
    s.center.push(...rest);
  } else {
    s.center = rest;
    if (s.centerHasFirst) {
      s.centerHasFirst = false;
      s.firstNext = s.current;
      addToFloor(s, p, FIRST);
      tookFirst = true;
    }
  }

  let overflow = picked.length;
  if (row >= 0) {
    const line = p.lines[row];
    const put = Math.min(row + 1 - line.count, picked.length);
    line.color = color;
    line.count += put;
    overflow = picked.length - put;
  }
  for (let i = 0; i < overflow; i++) addToFloor(s, p, color);

  const result = { player: s.current, count: picked.length, overflow, tookFirst, roundEnded: false };

  const empty = s.factories.every((f) => f.length === 0) && s.center.length === 0;
  if (empty) {
    endRound(s, rng);
    result.roundEnded = true;
  } else {
    s.current = (s.current + 1) % s.players.length;
  }
  return result;
}

export function scorePlacement(wall, r, c) {
  let h = 1;
  for (let x = c - 1; x >= 0 && wall[r][x]; x--) h++;
  for (let x = c + 1; x < 5 && wall[r][x]; x++) h++;
  let v = 1;
  for (let y = r - 1; y >= 0 && wall[y][c]; y--) v++;
  for (let y = r + 1; y < 5 && wall[y][c]; y++) v++;
  if (h === 1 && v === 1) return 1;
  return (h > 1 ? h : 0) + (v > 1 ? v : 0);
}

function endRound(s, rng) {
  const record = { round: s.round, players: [] };
  for (const p of s.players) {
    const rec = { placements: [], floorPenalty: 0, before: p.score };
    for (let i = 0; i < 5; i++) {
      const line = p.lines[i];
      if (line.count === i + 1) {
        const col = wallCol(i, line.color);
        p.wall[i][col] = true;
        const pts = scorePlacement(p.wall, i, col);
        p.score += pts;
        rec.placements.push({ row: i, col, color: line.color, points: pts });
        for (let k = 0; k < i; k++) s.lid.push(line.color);
        line.color = null;
        line.count = 0;
      }
    }
    let pen = 0;
    p.floor.forEach((t, k) => {
      pen += FLOOR_PENALTY[k];
      if (t !== FIRST) s.lid.push(t);
    });
    p.floor = [];
    rec.floorPenalty = pen;
    p.score = Math.max(0, p.score + pen);
    rec.after = p.score;
    record.players.push(rec);
  }
  s.lastRound = record;

  const finished = s.players.some((p) => p.wall.some((row) => row.every(Boolean)));
  if (finished) {
    finishGame(s);
    return;
  }
  s.round++;
  if (s.firstNext !== null) s.current = s.firstNext;
  s.firstNext = null;
  fillFactories(s, rng);
}

export function bonuses(p) {
  let rows = 0, cols = 0, colors = 0;
  for (let r = 0; r < 5; r++) if (p.wall[r].every(Boolean)) rows++;
  for (let c = 0; c < 5; c++) if (p.wall.every((row) => row[c])) cols++;
  for (let k = 0; k < 5; k++) {
    let all = true;
    for (let r = 0; r < 5; r++) if (!p.wall[r][wallCol(r, k)]) all = false;
    if (all) colors++;
  }
  return { rows, cols, colors, points: rows * 2 + cols * 7 + colors * 10 };
}

function finishGame(s) {
  const results = s.players.map((p, i) => {
    const b = bonuses(p);
    const base = p.score;
    p.score += b.points;
    return { index: i, name: p.name, base, bonus: b, score: p.score };
  });
  const ranked = [...results].sort((a, b) => b.score - a.score || b.bonus.rows - a.bonus.rows);
  const top = ranked[0];
  const winners = ranked.filter((r) => r.score === top.score && r.bonus.rows === top.bonus.rows).map((r) => r.index);
  s.phase = 'over';
  s.final = { results, ranked, winners };
}

// 테스트용: 전체 타일 수가 항상 100개인지
export function countTiles(s) {
  let n = s.bag.length + s.lid.length + s.center.length;
  for (const f of s.factories) n += f.length;
  for (const p of s.players) {
    n += p.floor.filter((t) => t !== FIRST).length;
    for (const l of p.lines) n += l.count;
    for (const row of p.wall) n += row.filter(Boolean).length;
  }
  return n;
}
