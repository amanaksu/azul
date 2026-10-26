import * as E from './engine.js';
import { PLAYER_COLORS, esc, openModal, closeModal, toast, store, openSetup } from './assets/ui.js';

const SAVE_KEY = 'tile-workshop:game';
const NAME_KEY = 'tile-workshop:names';

let s = null;        // 게임 상태
let sel = null;      // { source, color }
let fresh = new Set(); // 방금 벽에 붙은 칸 "p-r-c"

const $ = (id) => document.getElementById(id);

// ---------- 타일 그림 (직접 그린 무늬) ----------
const MOTIF = [
  // 쪽빛: 고리
  '<circle cx="20" cy="20" r="10.5" fill="none" stroke="#e9f0fb" stroke-width="3.4"/><circle cx="20" cy="20" r="2.6" fill="#e9f0fb"/>',
  // 호박: 마름모
  '<path d="M20 8.5 31.5 20 20 31.5 8.5 20Z" fill="none" stroke="#5a3a07" stroke-width="3.2" stroke-linejoin="round"/><path d="M20 15.5 24.5 20 20 24.5 15.5 20Z" fill="#5a3a07"/>',
  // 석류: 네 잎 꽃
  '<g fill="#f7dfe3"><circle cx="20" cy="12.2" r="5.2"/><circle cx="27.8" cy="20" r="5.2"/><circle cx="20" cy="27.8" r="5.2"/><circle cx="12.2" cy="20" r="5.2"/></g><circle cx="20" cy="20" r="3" fill="#b4384a"/>',
  // 먹: 붓 자국 세 줄
  '<g stroke="#cfcac0" stroke-width="2.8" stroke-linecap="round" fill="none"><path d="M10 13.5c5-1.4 13-1.6 20 .2"/><path d="M8.5 20.2c7-1.2 15-.9 23 .4"/><path d="M12 26.8c5-1 11-1.1 16 .3"/></g>',
  // 옥: 겹 사각
  '<rect x="10.5" y="10.5" width="19" height="19" rx="2" fill="none" stroke="#effaf6" stroke-width="3"/><rect x="16.5" y="16.5" width="7" height="7" rx="1" fill="#effaf6"/>',
];
const svg = (c) => `<svg viewBox="0 0 40 40" aria-hidden="true">${MOTIF[c]}</svg>`;
const tileDiv = (c, cls = '') => `<div class="tile c${c} ${cls}">${svg(c)}</div>`;

// ---------- 저장 ----------
let started = false; // 시작 화면 뒤의 빈 테이블은 저장하지 않음
function save() { if (s && started) store.set(SAVE_KEY, s); }

// ---------- 그리기 ----------
function render() {
  document.body.dataset.players = s.players.length;
  renderStatus();
  renderMarket();
  renderBoards();
  save();
}

function renderStatus() {
  const p = s.players[s.current];
  $('status').innerHTML = s.phase === 'over'
    ? '게임 끝'
    : `라운드 ${s.round} · <b style="color:${PLAYER_COLORS[s.current]}">${esc(p.name)}</b> 차례`;
}

function renderMarket() {
  const plates = s.factories.map((f, i) => {
    const tiles = f.map((c) => tileBtn(c, { type: 'factory', index: i })).join('');
    return `<div class="plate ${f.length ? '' : 'empty'}" aria-label="접시 ${i + 1}">
      <div class="grid">${tiles}</div></div>`;
  }).join('');

  const groups = [0, 1, 2, 3, 4]
    .map((c) => s.center.filter((t) => t === c))
    .filter((g) => g.length)
    .map((g) => `<div class="center-group">${g.map((c) => tileBtn(c, { type: 'center' })).join('')}</div>`)
    .join('');
  const first = s.centerHasFirst ? '<div class="first-token" title="선 플레이어 표식 (가져가면 바닥줄 -1)">1</div>' : '';
  const centerBody = groups || first
    ? `${first}${groups}`
    : '<span class="center-empty">비어 있음</span>';

  let hint;
  if (s.phase === 'over') hint = '게임이 끝났어요. <strong>새 게임</strong>으로 다시 시작할 수 있어요.';
  else if (!sel) hint = `<strong>${esc(s.players[s.current].name)}</strong>님, 접시나 가운데에서 한 가지 색을 고르세요. 그 색은 모두 가져오고, 접시의 나머지는 가운데로 갑니다.`;
  else {
    const n = E.sourceTiles(s, sel.source).filter((t) => t === sel.color).length;
    const extra = sel.source.type === 'center' && s.centerHasFirst ? ' 가운데에서 처음 가져가므로 선 표식(-1)도 함께 받아요.' : '';
    hint = `<strong>${E.TILE_NAMES[sel.color]} ${n}장</strong>을 놓을 줄을 보드에서 고르세요. 넘치는 타일은 바닥줄로 갑니다.${extra} 다른 색을 누르면 바꿀 수 있어요.`;
  }

  $('market').className = `market ${sel ? 'has-sel' : ''}`;
  $('market').innerHTML = `
    <div class="hint">${hint}</div>
    <div class="plates">${plates}</div>
    <div class="center-tray"><h2>가운데</h2><div class="center-tiles">${centerBody}</div></div>`;
}

function tileBtn(c, source) {
  const picked = sel && sel.color === c && sameSource(sel.source, source);
  const src = source.type === 'factory' ? `f${source.index}` : 'c';
  return `<button class="tile c${c} ${picked ? 'picked' : ''}" data-src="${src}" data-color="${c}"
    aria-label="${E.TILE_NAMES[c]} 타일" ${s.phase === 'over' ? 'disabled' : ''}>${svg(c)}</button>`;
}
const sameSource = (a, b) => a.type === b.type && (a.type === 'center' || a.index === b.index);

function renderBoards() {
  const legal = sel ? E.legalRows(s, sel.color) : [];
  const n = sel ? E.sourceTiles(s, sel.source).filter((t) => t === sel.color).length : 0;

  $('boards').innerHTML = s.players.map((p, pi) => {
    const active = pi === s.current && s.phase === 'pick';
    const lines = p.lines.map((line, r) => {
      const isLegal = active && legal.includes(r);
      const put = isLegal ? Math.min(r + 1 - line.count, n) : 0;
      const over = isLegal ? n - put : 0;
      const slots = [];
      for (let k = 0; k <= r; k++) {
        // 오른쪽(벽 쪽)부터 채운다
        const filledFrom = r + 1 - line.count;
        if (k >= filledFrom) slots.push(tileDiv(line.color));
        else if (k >= filledFrom - put) slots.push(tileDiv(sel.color, 'ghost-prev'));
        else slots.push('<div class="slot"></div>');
      }
      const preview = over > 0
        ? `<span class="overflow" style="--k:${r + 1}">넘침 ${over}</span>` : '';
      return `<button class="line ${isLegal ? 'legal' : ''}" data-row="${r}" ${isLegal ? '' : 'disabled tabindex="-1"'}
        aria-label="${r + 1}번째 줄">${preview}${slots.join('')}</button>`;
    }).join('');

    const wall = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
      const col = E.wallColor(r, c);
      const on = p.wall[r][c];
      const isFresh = fresh.has(`${pi}-${r}-${c}`);
      wall.push(`<div class="cell tile c${col} ${on ? '' : 'ghost'} ${isFresh ? 'fresh' : ''}">${svg(col)}</div>`);
    }

    const floorLegal = active && sel;
    const fslots = E.FLOOR_PENALTY.map((pen, k) => {
      const t = p.floor[k];
      const inner = t === undefined ? '<div class="slot"></div>'
        : t === E.FIRST ? '<div class="first-token">1</div>'
        : tileDiv(t);
      return `<div class="fslot">${inner}<span>${pen}</span></div>`;
    }).join('');
    const floorPreview = floorLegal ? `<span class="label">여기를 누르면<br>모두 바닥으로</span>` : '';

    return `<article class="board ${active ? 'active' : ''}" data-p="${pi}" aria-label="${esc(p.name)} 보드">
      <header>
        <span class="pdot" style="background:${PLAYER_COLORS[pi]}"></span>
        <h2>${esc(p.name)}</h2>
        ${active ? '<span class="turn-badge">차례</span>' : ''}
        <span class="score">${p.score}<small>점</small></span>
      </header>
      <div class="board-body">
        <div class="lines">${lines}</div>
        <div class="wall" aria-label="벽">${wall.join('')}</div>
      </div>
      <button class="floor ${floorLegal ? 'legal' : ''}" data-row="-1" ${floorLegal ? '' : 'disabled tabindex="-1"'} aria-label="바닥줄">
        ${fslots}${floorPreview}
      </button>
    </article>`;
  }).join('');
}

// ---------- 입력 ----------
$('market').addEventListener('click', (e) => {
  const b = e.target.closest('button.tile');
  if (!b || s.phase !== 'pick') return;
  const source = b.dataset.src === 'c' ? { type: 'center' } : { type: 'factory', index: +b.dataset.src.slice(1) };
  const color = +b.dataset.color;
  if (sel && sel.color === color && sameSource(sel.source, source)) sel = null;
  else sel = { source, color };
  render();
});

$('boards').addEventListener('click', (e) => {
  const b = e.target.closest('[data-row]');
  if (!b || b.disabled || !sel) return;
  const row = +b.dataset.row;
  const res = E.take(s, { source: sel.source, color: sel.color, row });
  sel = null;
  fresh = new Set();
  if (res.overflow > 0 && row >= 0) toast(`${res.overflow}장이 넘쳐서 바닥줄로 갔어요`);
  if (res.roundEnded) {
    s.lastRound.players.forEach((rec, pi) => rec.placements.forEach((pl) => fresh.add(`${pi}-${pl.row}-${pl.col}`)));
    render();
    showRoundSummary();
  } else {
    render();
  }
});

$('btn-new').addEventListener('click', () => {
  if (s && s.phase !== 'over') {
    const m = openModal(`<h2>새 게임을 시작할까요?</h2><p>지금 하던 게임은 사라져요.</p>
      <div class="row-actions"><button class="btn light" data-act="no">계속하기</button><button class="btn primary" data-act="yes">새 게임</button></div>`);
    m.querySelector('[data-act="no"]').onclick = closeModal;
    m.querySelector('[data-act="yes"]').onclick = () => { closeModal(); setup(false); };
  } else setup(false);
});
$('btn-rules').addEventListener('click', showRules);

// ---------- 모달 ----------
function showRoundSummary() {
  const rec = s.lastRound;
  const list = rec.players.map((r, pi) => {
    const p = s.players[pi];
    const items = r.placements.map((pl) =>
      `<li>${tileDiv(pl.color)} ${pl.row + 1}번째 줄 → 벽 <span class="gain">+${pl.points}</span></li>`).join('');
    const floor = r.floorPenalty ? `<li>바닥줄 감점 <span class="loss">${r.floorPenalty}</span></li>` : '';
    const none = !items && !floor ? '<li>이번 라운드는 변화 없음</li>' : '';
    return `<div class="round-player">
      <div class="top"><span class="pdot" style="background:${PLAYER_COLORS[pi]}"></span>${esc(p.name)}
        <span class="total">${r.before} → ${r.after}</span></div>
      <ul>${items}${floor}${none}</ul></div>`;
  }).join('');

  const over = s.phase === 'over';
  const m = openModal(`<h2>라운드 ${rec.round} 정산</h2>
    <div class="round-list">${list}</div>
    <div class="row-actions"><button class="btn primary" data-act="next">${over ? '최종 결과 보기' : `라운드 ${s.round} 시작`}</button></div>`,
    { dismissable: false });
  m.querySelector('[data-act="next"]').onclick = () => {
    closeModal();
    if (over) showFinal();
    else {
      toast(`${s.players[s.current].name}님이 선 플레이어예요`);
    }
  };
}

function showFinal() {
  const f = s.final;
  const winNames = f.winners.map((i) => esc(s.players[i].name)).join(', ');
  const rows = f.ranked.map((r) => `<tr class="${f.winners.includes(r.index) ? 'win' : ''}">
      <td><span class="pdot" style="display:inline-block;vertical-align:-2px;background:${PLAYER_COLORS[r.index]}"></span> ${esc(r.name)}</td>
      <td>${r.base}</td><td>${r.bonus.rows}×2</td><td>${r.bonus.cols}×7</td><td>${r.bonus.colors}×10</td>
      <td class="total">${r.score}</td></tr>`).join('');
  const m = openModal(`<h2>최종 결과</h2>
    <p class="winner-line">${f.winners.length > 1 ? `${winNames} 공동 우승` : `${winNames} 우승!`}</p>
    <table class="result-table">
      <thead><tr><th>이름</th><th>게임 중</th><th>가로줄</th><th>세로줄</th><th>한 색 5장</th><th>합계</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <div class="row-actions"><button class="btn light" data-act="close">보드 보기</button><button class="btn primary" data-act="again">같은 사람들과 다시</button></div>`);
  m.querySelector('[data-act="close"]').onclick = closeModal;
  m.querySelector('[data-act="again"]').onclick = () => { closeModal(); start(s.players.map((p) => p.name)); };
}

function showRules() {
  const tiles = [0, 1, 2, 3, 4].map((c) => tileDiv(c)).join('');
  const m = openModal(`<h2>타일 공방 규칙</h2>
    <div class="rule-tiles">${tiles}</div>
    <p>다섯 가지 타일로 자기 벽을 채워 점수를 얻는 게임이에요. 2~4명, 30분 안팎.</p>
    <h3>내 차례</h3>
    <ol>
      <li><b>접시 하나</b>에서 한 색을 모두 가져오고 나머지는 가운데로 보내거나, <b>가운데</b>에서 한 색을 모두 가져와요.</li>
      <li>가운데에서 처음 가져가는 사람은 <b>선 표식</b>도 받아 바닥줄에 놓아요(-1). 다음 라운드는 이 사람이 먼저 해요.</li>
      <li>가져온 타일을 왼쪽 <b>패턴 줄</b> 하나에 놓아요. 한 줄에는 한 색만, 벽의 같은 줄에 이미 그 색이 있으면 놓을 수 없어요.</li>
      <li>줄에 다 못 들어가는 타일은 <b>바닥줄</b>로 가서 감점돼요. 일부러 바닥줄에 다 놓을 수도 있어요.</li>
    </ol>
    <h3>라운드 끝</h3>
    <p>접시와 가운데가 모두 비면, 꽉 찬 줄의 타일 1장이 벽의 같은 색 칸으로 옮겨져요. 붙어 있는 가로·세로 타일 수만큼 점수를 받고(외톨이면 1점), 바닥줄 감점을 빼요.</p>
    <h3>게임 끝</h3>
    <p>누군가 벽의 가로 한 줄을 완성하면 그 라운드로 끝나요. 완성한 가로줄 +2, 세로줄 +7, 한 색 5장 모두 +10을 더해 가장 높은 사람이 이겨요. 동점이면 가로줄을 더 많이 완성한 사람이 이겨요.</p>
    <div class="row-actions"><button class="btn primary" data-act="ok">알겠어요</button></div>`);
  m.querySelector('[data-act="ok"]').onclick = closeModal;
}

// ---------- 시작 ----------
function start(names) {
  s = E.newGame(names);
  started = true;
  sel = null;
  fresh = new Set();
  render();
}

function setup(allowResume) {
  const saved = store.get(SAVE_KEY);
  const canResume = allowResume && saved && saved.phase === 'pick';
  openSetup({
    title: '타일 공방',
    intro: '한 화면에서 번갈아 두는 타일 놓기 게임이에요. 2명일 때 가장 치열해요.',
    canResume,
    nameKey: NAME_KEY,
    onStart: start,
    onResume: () => { s = saved; started = true; render(); },
  });
}

// 첫 화면: 빈 테이블을 그린 뒤 시작 화면
s = E.newGame(['플레이어 1', '플레이어 2']);
render();
setup(true);
