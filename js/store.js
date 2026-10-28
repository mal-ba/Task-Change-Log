// 데이터 저장소: 브라우저 localStorage에 저장하고, 로그인 상태면 Supabase에도 동기화
const Store = (() => {
  const LEGACY_KEY = 'scopelog:v1'; // 로그인 없는 모드의 저장 위치
  let key = LEGACY_KEY;

  const empty = () => ({
    settings: { name: '', business: '' },
    clients: [],
    projects: [],
    activity: [],
  });

  let state = empty();

  // 로그인 사용자마다 다른 저장 위치를 써서 계정끼리 데이터가 섞이지 않게 함
  function init(storageKey = LEGACY_KEY) {
    key = storageKey;
    state = readLocal(key) || empty();
  }

  function readLocal(k) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) {
      console.warn('저장된 데이터를 읽지 못했습니다', e);
    }
    return null;
  }

  function writeLocal() {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      return true;
    } catch (e) {
      UI.toast('저장 공간이 부족해 저장하지 못했어요. 백업 후 오래된 프로젝트를 정리해 주세요.', 'error');
      return false;
    }
  }

  // 서버에 아직 올라가지 않은 변경이 있는지 표시
  function setDirty(on) {
    try { on ? localStorage.setItem(key + ':dirty', '1') : localStorage.removeItem(key + ':dirty'); } catch {}
  }
  const isDirty = () => { try { return localStorage.getItem(key + ':dirty') === '1'; } catch { return false; } };

  // 서버에서 받은 데이터로 교체 (다시 올리지 않음)
  function adopt(data) {
    state = normalize(data);
    writeLocal();
    setDirty(false);
  }

  function clearLocal() {
    try { localStorage.removeItem(key); localStorage.removeItem(key + ':dirty'); } catch {}
    state = empty();
  }

  const hasData = (s = state) => !!(s && (s.projects.length || s.clients.length));
  const legacyData = () => readLocal(LEGACY_KEY);
  const clearLegacy = () => { try { localStorage.removeItem(LEGACY_KEY); } catch {} };

  function normalize(data) {
    const s = Object.assign(empty(), data || {});
    s.settings = Object.assign(empty().settings, s.settings);
    s.projects = (s.projects || []).map((p) => ({
      ...p,
      scope: Object.assign({ description: '', items: [], revisionsIncluded: 0, revisionsUsed: 0 }, p.scope),
      changes: p.changes || [],
    }));
    return s;
  }

  function save() {
    writeLocal();
    if (Cloud.enabled && Cloud.user) {
      setDirty(true);
      Cloud.schedulePush(() => state, (ok) => { if (ok) setDirty(false); });
    }
  }

  function actorName() {
    return state.settings.name || '나';
  }

  function log(type, { projectId = '', target = '', actor } = {}) {
    const p = projectId ? getProject(projectId) : null;
    state.activity.unshift({
      id: U.uid(), type, at: Date.now(),
      actor: actor || actorName(),
      projectId, projectName: p ? p.name : '', target,
    });
    state.activity = state.activity.slice(0, 200);
  }

  // ---- 조회 ----
  const getClient = (id) => state.clients.find((c) => c.id === id);
  const getProject = (id) => state.projects.find((p) => p.id === id);
  const clientName = (id) => getClient(id)?.name || '고객 미지정';

  // ---- 설정 ----
  function updateSettings(patch) {
    Object.assign(state.settings, patch);
    save();
  }

  // ---- 고객 ----
  function addClient(data) {
    const c = { id: U.uid(), name: '', contact: '', email: '', phone: '', memo: '', createdAt: Date.now(), ...data };
    state.clients.push(c);
    log('client_created', { target: c.name });
    save();
    return c;
  }

  function updateClient(id, patch) {
    const c = getClient(id);
    if (!c) return;
    Object.assign(c, patch);
    save();
  }

  function deleteClient(id) {
    state.clients = state.clients.filter((c) => c.id !== id);
    state.projects.forEach((p) => { if (p.clientId === id) p.clientId = ''; });
    save();
  }

  // ---- 프로젝트 ----
  function addProject(data) {
    const p = {
      id: U.uid(), name: '', clientId: '', status: 'planning',
      startDate: U.today(), dueDate: '', price: 0, memo: '',
      scope: { description: '', items: [], revisionsIncluded: 0, revisionsUsed: 0 },
      changes: [], createdAt: Date.now(), updatedAt: Date.now(),
      ...data,
    };
    state.projects.unshift(p);
    log('project_created', { projectId: p.id, target: p.name });
    save();
    return p;
  }

  function updateProject(id, patch, logType) {
    const p = getProject(id);
    if (!p) return;
    const prevStatus = p.status;
    Object.assign(p, patch, { updatedAt: Date.now() });
    if (patch.status && patch.status !== prevStatus) {
      log('project_status', { projectId: id, target: PROJECT_STATUS[patch.status]?.label });
    } else if (logType) {
      log(logType, { projectId: id, target: p.name });
    }
    save();
  }

  function deleteProject(id) {
    state.projects = state.projects.filter((p) => p.id !== id);
    state.activity = state.activity.filter((a) => a.projectId !== id);
    save();
  }

  // ---- 최초 범위 항목 ----
  function addScopeItem(pid, text) {
    const p = getProject(pid);
    if (!p || !text.trim()) return;
    p.scope.items.push({ id: U.uid(), text: text.trim(), done: false });
    p.updatedAt = Date.now();
    save();
  }

  function toggleScopeItem(pid, itemId) {
    const p = getProject(pid);
    const it = p?.scope.items.find((i) => i.id === itemId);
    if (!it) return;
    it.done = !it.done;
    p.updatedAt = Date.now();
    if (it.done) log('item_done', { projectId: pid, target: it.text });
    save();
  }

  function deleteScopeItem(pid, itemId) {
    const p = getProject(pid);
    if (!p) return;
    p.scope.items = p.scope.items.filter((i) => i.id !== itemId);
    save();
  }

  function setRevisionsUsed(pid, n) {
    const p = getProject(pid);
    if (!p) return;
    const prev = p.scope.revisionsUsed || 0;
    p.scope.revisionsUsed = Math.max(0, n);
    p.updatedAt = Date.now();
    if (p.scope.revisionsUsed > prev) log('revision_used', { projectId: pid, target: `${p.scope.revisionsUsed}회차 수정` });
    save();
  }

  // ---- 추가·변경 요청 ----
  function addChange(pid, data) {
    const p = getProject(pid);
    if (!p) return;
    const c = {
      id: U.uid(), title: '', description: '', requestedAt: U.today(),
      cost: 0, days: 0, status: 'pending', done: false, note: '',
      createdAt: Date.now(), decidedAt: null, ...data,
    };
    if (c.status !== 'pending') c.decidedAt = Date.now();
    p.changes.push(c);
    p.updatedAt = Date.now();
    log('change_added', { projectId: pid, target: c.title });
    if (c.status !== 'pending') logDecision(p, c);
    save();
    return c;
  }

  function updateChange(pid, cid, patch) {
    const p = getProject(pid);
    const c = p?.changes.find((x) => x.id === cid);
    if (!c) return;
    const prev = c.status;
    Object.assign(c, patch);
    if (patch.status && patch.status !== prev) {
      c.decidedAt = patch.status === 'pending' ? null : Date.now();
      if (patch.status !== 'approved') c.done = false;
      logDecision(p, c);
    }
    p.updatedAt = Date.now();
    save();
  }

  function logDecision(p, c) {
    const client = clientName(p.clientId);
    if (c.status === 'approved') log('change_approved', { projectId: p.id, target: c.title, actor: client });
    if (c.status === 'rejected') log('change_rejected', { projectId: p.id, target: c.title, actor: client });
  }

  function deleteChange(pid, cid) {
    const p = getProject(pid);
    if (!p) return;
    p.changes = p.changes.filter((c) => c.id !== cid);
    p.updatedAt = Date.now();
    save();
  }

  // ---- 백업 / 복원 ----
  function exportJSON() {
    return JSON.stringify({ app: 'scopelog', version: 1, exportedAt: new Date().toISOString(), data: state }, null, 2);
  }

  function importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed && parsed.app === 'scopelog' ? parsed.data : parsed;
    if (!data || !Array.isArray(data.projects) || !Array.isArray(data.clients)) {
      throw new Error('ScopeLog 백업 파일이 아니에요.');
    }
    state = normalize(data);
    save();
  }

  function reset() {
    state = empty();
    save();
  }

  // ---- 샘플 데이터 ----
  function loadSample() {
    const now = Date.now();
    const H = 3600000, D = 24 * H;
    const today = U.today();
    const settings = { ...state.settings, name: state.settings.name || '지훈', business: state.settings.business || '지훈 웹스튜디오' };
    const cl = (name, contact, email, phone, ago) => ({ id: U.uid(), name, contact, email, phone, memo: '', createdAt: now - ago });
    const c1 = cl('온도 커피', '김온도 대표', 'hello@ondo.coffee', '010-1234-5678', 20 * D);
    const c2 = cl('그린하베스트', '박하은 팀장', 'team@greenharvest.kr', '02-555-0101', 12 * D);
    const c3 = cl('다온 스튜디오', '이다온', 'daon@studio.kr', '010-9876-5432', 6 * D);
    const c4 = cl('포지텍 로보틱스', '최정우 매니저', 'jw.choi@forgetech.co.kr', '031-777-2020', 3 * D);
    const it = (text, done = false) => ({ id: U.uid(), text, done });
    const ch = (title, description, cost, days, status, ago, extra = {}) => ({
      id: U.uid(), title, description, requestedAt: U.addDays(today, -Math.round(ago / D)),
      cost, days, status, done: false, note: '', createdAt: now - ago,
      decidedAt: status === 'pending' ? null : now - ago + 6 * H, ...extra,
    });

    const p1 = {
      id: U.uid(), name: '카페 홈페이지 제작', clientId: c1.id, status: 'in_progress', icon: 'rocket',
      startDate: U.addDays(today, -5), dueDate: U.addDays(today, 2), price: 200000, memo: '',
      scope: {
        description: '반응형 홈페이지 3페이지 제작. 문구와 사진은 고객이 제공.',
        items: [it('메인 페이지', true), it('매장 소개 페이지', true), it('문의 페이지')],
        revisionsIncluded: 2, revisionsUsed: 2,
      },
      changes: [
        ch('페이지 2개 추가 (메뉴, 오시는 길)', '메뉴판 페이지와 지도 포함 오시는 길 페이지 추가 요청', 100000, 3, 'pending', 1 * D),
        ch('로고 색상 변경', '메인 컬러를 짙은 갈색으로 변경', 0, 0, 'approved', 3 * D, { done: true }),
      ],
      createdAt: now - 5 * D, updatedAt: now - 1 * D,
    };
    const p2 = {
      id: U.uid(), name: '친환경 패키지 상세페이지', clientId: c2.id, status: 'review', icon: 'cart',
      startDate: U.addDays(today, -14), dueDate: U.addDays(today, -1), price: 450000, memo: '',
      scope: {
        description: '스마트스토어 상세페이지 1종 디자인 (PSD + JPG 납품)',
        items: [it('기획안 작성', true), it('시안 2종', true), it('최종 디자인', true), it('원본 파일 전달')],
        revisionsIncluded: 3, revisionsUsed: 3,
      },
      changes: [
        ch('모바일용 GIF 3개 추가', '제품 사용 장면 GIF 제작', 90000, 2, 'approved', 6 * D, { done: true }),
        ch('영문 버전 추가', '해외 판매용 영문 상세페이지', 150000, 4, 'pending', 2 * D),
      ],
      createdAt: now - 14 * D, updatedAt: now - 2 * D,
    };
    const p3 = {
      id: U.uid(), name: '유튜브 영상 편집 (10월분)', clientId: c3.id, status: 'in_progress', icon: 'film',
      startDate: U.addDays(today, -20), dueDate: U.addDays(today, 10), price: 600000, memo: '월 4편, 편당 10분 내외',
      scope: {
        description: '월 4편 컷편집 + 자막 + 썸네일',
        items: [it('1편 편집', true), it('2편 편집', true), it('3편 편집'), it('4편 편집')],
        revisionsIncluded: 1, revisionsUsed: 1,
      },
      changes: [
        ch('쇼츠 4개 추가 제작', '본편에서 하이라이트 쇼츠 추출', 120000, 0, 'approved', 4 * D),
        ch('인트로 애니메이션 제작', '채널 로고 인트로 5초', 80000, 2, 'rejected', 8 * D),
      ],
      createdAt: now - 20 * D, updatedAt: now - 4 * D,
    };
    const p4 = {
      id: U.uid(), name: '산업용 제품 카탈로그', clientId: c4.id, status: 'planning', icon: 'pen',
      startDate: today, dueDate: U.addDays(today, 21), price: 1200000, memo: '',
      scope: {
        description: 'A4 24페이지 제품 카탈로그 편집 디자인 (인쇄용 PDF)',
        items: [it('목차·구성안'), it('표지 디자인'), it('내지 24p'), it('인쇄 감리')],
        revisionsIncluded: 2, revisionsUsed: 0,
      },
      changes: [],
      createdAt: now - 3 * H, updatedAt: now - 3 * H,
    };

    const a = (type, p, target, actor, ago) => ({ id: U.uid(), type, at: now - ago, actor, projectId: p ? p.id : '', projectName: p ? p.name : '', target });
    state = normalize({
      settings,
      clients: [c1, c2, c3, c4],
      projects: [p4, p1, p2, p3],
      activity: [
        a('project_created', p4, p4.name, settings.name, 3 * H),
        a('change_added', p1, p1.changes[0].title, settings.name, 1 * D),
        a('change_added', p2, p2.changes[1].title, settings.name, 2 * D),
        a('change_approved', p1, p1.changes[1].title, c1.name, 3 * D - 18 * H),
        a('change_approved', p3, p3.changes[0].title, c3.name, 4 * D - 18 * H),
        a('project_status', p2, '검수', settings.name, 4 * D),
        a('change_approved', p2, p2.changes[0].title, c2.name, 6 * D - 18 * H),
      ],
    });
    save();
  }

  return {
    get state() { return state; },
    get key() { return key; },
    init, adopt, clearLocal, isDirty, hasData, legacyData, clearLegacy, save,
    getClient, getProject, clientName, actorName,
    updateSettings,
    addClient, updateClient, deleteClient,
    addProject, updateProject, deleteProject,
    addScopeItem, toggleScopeItem, deleteScopeItem, setRevisionsUsed,
    addChange, updateChange, deleteChange,
    exportJSON, importJSON, reset, loadSample,
  };
})();
