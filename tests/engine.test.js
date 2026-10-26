import * as E from '../engine.js';

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// 점수 계산 단위 테스트
{
  const w = Array.from({ length: 5 }, () => Array(5).fill(false));
  w[0][0] = true; assert(E.scorePlacement(w, 0, 0) === 1, 'single tile = 1');
  w[0][1] = true; assert(E.scorePlacement(w, 0, 1) === 2, 'pair = 2');
  w[1][1] = true; assert(E.scorePlacement(w, 1, 1) === 2, 'vertical pair = 2');
  w[1][0] = true; assert(E.scorePlacement(w, 1, 0) === 4, 'h2 + v2 = 4');
  // 벽 패턴은 각 행/열에 모든 색이 한 번씩
  for (let r = 0; r < 5; r++) {
    assert(new Set([0, 1, 2, 3, 4].map((c) => E.wallColor(r, c))).size === 5, 'row latin');
    for (let k = 0; k < 5; k++) assert(E.wallColor(r, E.wallCol(r, k)) === k, 'wallCol inverse');
  }
}

let games = 0, rounds = 0, maxScore = 0;
for (let seed = 1; seed <= 400; seed++) {
  const rng = mulberry32(seed);
  const n = 2 + (seed % 3);
  const s = E.newGame(Array.from({ length: n }, (_, i) => `P${i + 1}`), rng);
  let guard = 0;
  while (s.phase === 'pick') {
    const moves = E.legalMoves(s);
    assert(moves.length > 0, 'no legal moves while picking');
    // 바닥 대신 줄을 더 선호하는 무작위 플레이
    const rowMoves = moves.filter((m) => m.row >= 0);
    const pool = rowMoves.length && rng() < 0.85 ? rowMoves : moves;
    E.take(s, pool[Math.floor(rng() * pool.length)], rng);
    assert(E.countTiles(s) === 100, `tile count broken: ${E.countTiles(s)} (seed ${seed})`);
    for (const p of s.players) {
      assert(p.score >= 0, 'negative score');
      assert(p.floor.length <= 7, 'floor overflow');
      assert(p.floor.filter((t) => t === E.FIRST).length <= 1, 'dup first');
      p.lines.forEach((l, i) => assert(l.count <= i + 1, 'line overflow'));
    }
    if (++guard > 2000) throw new Error('game did not end');
  }
  rounds += s.round;
  games++;
  maxScore = Math.max(maxScore, ...s.players.map((p) => p.score));
  assert(s.final.winners.length >= 1, 'no winner');
}
console.log(`tiles: ${games} games ok, avg rounds ${(rounds / games).toFixed(1)}, max score ${maxScore}`);
