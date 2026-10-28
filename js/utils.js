// 공통 유틸리티: 포맷, 날짜, 계산
const U = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  num(v) {
    const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  },

  money(n) {
    return (Number(n) || 0).toLocaleString('ko-KR') + '원';
  },

  signedMoney(n) {
    n = Number(n) || 0;
    return (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('ko-KR') + '원';
  },

  signedDays(n) {
    n = Number(n) || 0;
    if (n === 0) return '변동 없음';
    return (n > 0 ? '+' : '−') + Math.abs(n) + '일';
  },

  today() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  },

  date(iso) {
    if (!iso) return '-';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return `${y}.${m}.${d}`;
  },

  addDays(iso, n) {
    if (!iso) return '';
    const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + (Number(n) || 0));
    return d.toISOString().slice(0, 10);
  },

  daysUntil(iso) {
    if (!iso) return null;
    const a = new Date(U.today() + 'T00:00:00Z');
    const b = new Date(iso.slice(0, 10) + 'T00:00:00Z');
    return Math.round((b - a) / 86400000);
  },

  timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return '방금 전';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}일 전`;
    return U.date(new Date(ts).toISOString());
  },

  isThisMonth(ts) {
    if (!ts) return false;
    const a = new Date(ts), b = new Date();
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  },

  initial(name) {
    return (String(name || '?').trim().charAt(0) || '?').toUpperCase();
  },

  hash(str) {
    let h = 0;
    for (const ch of String(str)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return h;
  },

  greeting() {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) return '좋은 아침이에요';
    if (h >= 11 && h < 17) return '좋은 오후예요';
    if (h >= 17 && h < 22) return '좋은 저녁이에요';
    return '늦은 시간까지 수고 많아요';
  },
};

const PROJECT_STATUS = {
  lead:        { label: '상담·견적', cls: 'gray' },
  planning:    { label: '기획',      cls: 'teal' },
  in_progress: { label: '진행 중',   cls: 'blue' },
  review:      { label: '검수',      cls: 'amber' },
  done:        { label: '완료',      cls: 'green' },
  on_hold:     { label: '보류',      cls: 'gray' },
};
const ACTIVE_STATUSES = ['planning', 'in_progress', 'review'];

const CHANGE_STATUS = {
  pending:  { label: '협의 중', cls: 'amber' },
  approved: { label: '승인',    cls: 'green' },
  rejected: { label: '거절',    cls: 'red' },
};

const PROJECT_ICONS = ['rocket', 'layout', 'pen', 'cart', 'code', 'image', 'film'];
const TILE_COLORS = ['blue', 'yellow', 'red', 'pink', 'green', 'purple'];

function pill(map, key) {
  const s = map[key] || { label: key, cls: 'gray' };
  return `<span class="pill ${s.cls}">${U.esc(s.label)}</span>`;
}

function projectTile(p, size = 'md') {
  const h = U.hash(p.id || p.name);
  const ic = p.icon || PROJECT_ICONS[h % PROJECT_ICONS.length];
  const color = TILE_COLORS[(h >>> 3) % TILE_COLORS.length];
  return `<span class="tile ${color} ${size}">${icon(ic, size === 'lg' ? 22 : 17)}</span>`;
}

// 프로젝트의 금액·납기·진행률 계산 (공유 스냅샷에도 동일하게 사용)
function calcProject(p) {
  const changes = p.changes || [];
  const approved = changes.filter((c) => c.status === 'approved');
  const pending = changes.filter((c) => c.status === 'pending');
  const rejected = changes.filter((c) => c.status === 'rejected');
  const sum = (arr, k) => arr.reduce((s, c) => s + (Number(c[k]) || 0), 0);
  const base = Number(p.price) || 0;
  const extra = sum(approved, 'cost');
  const extraDays = sum(approved, 'days');
  const items = (p.scope && p.scope.items) || [];
  const tasks = items.length + approved.length;
  const doneN = items.filter((i) => i.done).length + approved.filter((c) => c.done).length;
  const progress = p.status === 'done' ? 100 : tasks ? Math.round((doneN / tasks) * 100) : 0;
  const revIncluded = Number(p.scope?.revisionsIncluded) || 0;
  const revUsed = Number(p.scope?.revisionsUsed) || 0;
  return {
    base, extra, total: base + extra,
    pendingExtra: sum(pending, 'cost'),
    extraDays, pendingDays: sum(pending, 'days'),
    finalDue: p.dueDate ? U.addDays(p.dueDate, extraDays) : '',
    approved, pending, rejected,
    progress, revIncluded, revUsed,
    revOver: revIncluded > 0 && revUsed > revIncluded,
    revFull: revIncluded > 0 && revUsed >= revIncluded,
  };
}
