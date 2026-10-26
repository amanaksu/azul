// 두 게임이 함께 쓰는 화면 도우미: 모달, 토스트, 시작 화면, 저장

export const PLAYER_COLORS = ['#f0b429', '#6cc3d5', '#ec8fae', '#a5d27a'];

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let modalClose = null;
export function openModal(html, { onClose, dismissable = true } = {}) {
  closeModal();
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const backdrop = root.firstElementChild;
  const close = () => {
    root.innerHTML = '';
    document.removeEventListener('keydown', onKey);
    modalClose = null;
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(); };
  document.addEventListener('keydown', onKey);
  if (dismissable) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  modalClose = close;
  const first = backdrop.querySelector('[autofocus], .btn.primary, button');
  first?.focus({ preventScroll: true });
  return backdrop.querySelector('.modal');
}
export function closeModal() { modalClose?.(); }

let toastTimer;
export function toast(msg, ms = 2200) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), ms);
}

export const store = {
  get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 저장 불가 환경 */ } },
  del(key) { try { localStorage.removeItem(key); } catch { /* 무시 */ } },
};

// 시작 화면: 인원과 이름을 고르고 onStart(names) 호출
export function openSetup({ title, intro, canResume, onStart, onResume, nameKey }) {
  const saved = store.get(nameKey) || [];
  let count = Math.min(4, Math.max(2, saved.length || 2));
  const defaults = (i) => saved[i] || `플레이어 ${i + 1}`;

  const modal = openModal(`
    <div class="setup">
      <h2>${esc(title)}</h2>
      <p>${intro}</p>
      <label id="lbl-count">인원</label>
      <div class="seg" role="group" aria-labelledby="lbl-count">
        ${[2, 3, 4].map((n) => `<button type="button" data-n="${n}">${n}명</button>`).join('')}
      </div>
      <label>이름</label>
      <div class="names"></div>
      <div class="row-actions">
        ${canResume ? '<button class="btn light" data-act="resume">하던 게임 이어하기</button>' : ''}
        <button class="btn primary" data-act="start">게임 시작</button>
      </div>
    </div>`, { dismissable: false });

  const namesEl = modal.querySelector('.names');
  const values = Array.from({ length: 4 }, (_, i) => defaults(i));
  const draw = () => {
    modal.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === count)));
    namesEl.innerHTML = Array.from({ length: count }, (_, i) => `
      <div class="name-row">
        <span class="pdot" style="background:${PLAYER_COLORS[i]}"></span>
        <input data-i="${i}" maxlength="10" value="${esc(values[i])}" aria-label="플레이어 ${i + 1} 이름">
      </div>`).join('');
  };
  draw();
  namesEl.addEventListener('input', (e) => { const i = e.target.dataset.i; if (i !== undefined) values[i] = e.target.value; });
  modal.querySelector('.seg').addEventListener('click', (e) => {
    const n = e.target.closest('button')?.dataset.n;
    if (n) { count = +n; draw(); }
  });
  modal.querySelector('[data-act="start"]').addEventListener('click', () => {
    const names = values.slice(0, count).map((v, i) => v.trim() || `플레이어 ${i + 1}`);
    store.set(nameKey, names);
    closeModal();
    onStart(names);
  });
  modal.querySelector('[data-act="resume"]')?.addEventListener('click', () => { closeModal(); onResume(); });
}
