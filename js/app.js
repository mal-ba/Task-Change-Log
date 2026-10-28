// 앱 진입점: 라우터, 모달/토스트, 이벤트 처리
const UI = (() => {
  const root = () => document.getElementById('modal-root');
  let onKey = null;

  function close() {
    root().innerHTML = '';
    document.body.classList.remove('modal-open');
    if (onKey) document.removeEventListener('keydown', onKey);
    onKey = null;
  }

  function modal({ title, body, submit = '저장', onSubmit, footer = true, danger = false }) {
    root().innerHTML = `
      <div class="modal-backdrop">
        <form class="modal" novalidate>
          <header class="modal-head">
            <h3>${title}</h3>
            <button type="button" class="icon-btn" data-close title="닫기">${icon('x', 16)}</button>
          </header>
          <div class="modal-body">${body}</div>
          ${footer ? `
          <footer class="modal-foot">
            <button type="button" class="btn" data-close>취소</button>
            <button type="submit" class="btn ${danger ? 'danger' : 'primary'}">${submit}</button>
          </footer>` : ''}
        </form>
      </div>`;
    document.body.classList.add('modal-open');
    const backdrop = root().querySelector('.modal-backdrop');
    const form = root().querySelector('form');
    backdrop.addEventListener('mousedown', (ev) => { if (ev.target === backdrop) close(); });
    form.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!onSubmit) return close();
      const data = Object.fromEntries(new FormData(form));
      const invalid = [...form.querySelectorAll('[required]')].find((el) => !String(el.value).trim());
      if (invalid) {
        invalid.classList.add('invalid');
        invalid.focus();
        return;
      }
      if (onSubmit(data, form) !== false) close();
    });
    onKey = (ev) => { if (ev.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const first = form.querySelector('input:not([type=hidden]):not([readonly]), textarea, select');
    if (first) setTimeout(() => first.focus(), 30);
    return form;
  }

  function confirm(message, { ok = '삭제', danger = true, title = '확인' } = {}) {
    return new Promise((resolve) => {
      modal({
        title, submit: ok, danger,
        body: `<p class="confirm-text">${message}</p>`,
        onSubmit: () => { resolve(true); },
      });
      root().querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => resolve(false)));
    });
  }

  function toast(message, type = 'ok') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon(type === 'error' ? 'alert' : 'checkCircle', 16)}<span>${U.esc(message)}</span>`;
    document.getElementById('toast-root').appendChild(el);
    setTimeout(() => el.classList.add('hide'), 2600);
    setTimeout(() => el.remove(), 3000);
  }

  return { modal, confirm, toast, close };
})();

const App = (() => {
  const e = U.esc;
  const app = () => document.getElementById('app');
  const view = { filter: 'all', query: '' };
  // ready: 로그인 상태 확인 완료, loadingData: 계정 데이터 불러오는 중
  const auth = { ready: !Cloud.enabled, loadingData: false, mode: 'signin', notice: '' };
  let loadedUserId = null;
  let currentProjectId = null;
  let lastRoute = '';

  // ---------- 라우팅 ----------
  function parts() {
    return (location.hash.slice(1) || '/').split('/').filter(Boolean);
  }

  async function render() {
    const [page, arg] = parts();
    const routeKey = `${page || ''}/${arg || ''}`;
    const keepScroll = routeKey === lastRoute;
    const y = window.scrollY;
    currentProjectId = null;
    document.title = 'ScopeLog · 작업 변경 기록';

    let html;
    const needsLogin = Cloud.enabled && page !== 's';
    if (needsLogin && (!auth.ready || auth.loadingData)) html = Views.loading(auth.loadingData ? '내 데이터를 불러오는 중…' : '불러오는 중…');
    else if (needsLogin && !Cloud.user) { document.title = 'ScopeLog · 로그인'; html = Views.login(auth.mode, auth.notice); }
    else if (!page) html = Views.dashboard();
    else if (page === 'projects' && arg) { currentProjectId = arg; html = Views.project(arg); }
    else if (page === 'projects') html = Views.projects(view.filter, view.query);
    else if (page === 'clients') html = Views.clients();
    else if (page === 'settings') html = Views.settings();
    else if (page === 'report' && arg) {
      const p = Store.getProject(arg);
      if (p) {
        currentProjectId = arg;
        document.title = `변경내역서_${p.name}_${U.today()}`;
        html = Views.reportPage(Report.snapshot(p), { mode: 'print', projectId: arg });
      } else html = Views.notFound();
    } else if (page === 's' && arg) {
      try {
        const snap = await Report.decode(arg);
        document.title = `변경내역서_${snap.project.name}`;
        html = Views.reportPage(snap, { mode: 'share' });
      } catch (err) {
        html = `<div class="doc-layout"><div class="card"><div class="empty"><p>링크가 올바르지 않거나 일부가 잘렸어요.</p><span>작업자에게 링크를 다시 요청해 주세요.</span></div></div></div>`;
      }
    } else html = Views.notFound();

    app().innerHTML = html;
    window.scrollTo(0, keepScroll ? y : 0);
    lastRoute = routeKey;
  }

  // ---------- 로그인 / 계정 데이터 ----------
  async function handleAuth(event, user) {
    if (event === 'PASSWORD_RECOVERY') {
      auth.ready = true;
      if (user && loadedUserId !== user.id) await loadUserData(user);
      passwordForm('새 비밀번호 설정');
      return;
    }
    if (user && loadedUserId !== user.id) {
      auth.ready = true;
      await loadUserData(user);
      return;
    }
    if (!user) {
      if (loadedUserId) Store.clearLocal();
      loadedUserId = null;
      auth.ready = true;
      render();
    }
  }

  async function loadUserData(user) {
    auth.loadingData = true;
    loadedUserId = user.id;
    render();
    Store.init(`scopelog:v1:${user.id}`);
    let legacy = null;
    try {
      const remote = await Cloud.pull();
      const remoteHas = remote && remote.data && Array.isArray(remote.data.projects);
      if (remoteHas && !(Store.isDirty() && Store.hasData())) {
        Store.adopt(remote.data);
      } else if (Store.hasData()) {
        // 이 기기에만 있고 아직 서버에 못 올라간 변경 → 올림
        Store.save();
      } else {
        const old = Store.legacyData();
        if (old && Store.hasData(old)) legacy = old;
      }
    } catch (err) {
      UI.toast('서버에서 데이터를 불러오지 못했어요. 이 기기에 저장된 내용을 보여드려요.', 'error');
    }
    fillName(user);
    auth.loadingData = false;
    render();

    // 로그인 전에 이 브라우저에서 쓰던 데이터를 계정으로 옮기기
    if (legacy) {
      const n = legacy.projects.length;
      const ok = await UI.confirm(
        `이 브라우저에 로그인 전에 쓰던 데이터(프로젝트 ${n}개, 고객 ${legacy.clients.length}명)가 있어요.<br>내 계정으로 옮길까요?`,
        { ok: '계정으로 옮기기', danger: false, title: '기존 데이터 가져오기' },
      );
      if (ok) {
        Store.importJSON(JSON.stringify(legacy));
        Store.clearLegacy();
        fillName(user);
        UI.toast('기존 데이터를 계정으로 옮겼어요');
        render();
      }
    }
  }

  // 내 정보에 이름이 비어 있으면 로그인 계정의 이름으로 채움
  function fillName(user) {
    if (!Store.state.settings.name && Cloud.userName(user)) Store.updateSettings({ name: Cloud.userName(user) });
  }

  async function submitAuth(form) {
    const mode = form.dataset.mode;
    const d = Object.fromEntries(new FormData(form));
    const errEl = form.querySelector('.auth-error');
    const btn = form.querySelector('button.primary');
    const showError = (msg) => { errEl.textContent = msg; errEl.hidden = false; };
    const email = (d.email || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return showError('이메일 주소를 확인해 주세요.');
    if (mode !== 'reset' && (d.password || '').length < 6) return showError('비밀번호는 6자 이상이어야 해요.');
    errEl.hidden = true;
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = '잠시만요…';
    try {
      if (mode === 'signin') {
        await Cloud.signIn(email, d.password);
      } else if (mode === 'signup') {
        const { needsConfirm } = await Cloud.signUp(email, d.password, (d.name || '').trim());
        if (needsConfirm) {
          auth.mode = 'signin';
          auth.notice = `${email}로 가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.`;
          render();
        }
      } else {
        await Cloud.resetPassword(email);
        auth.mode = 'signin';
        auth.notice = `${email}로 비밀번호 재설정 링크를 보냈어요.`;
        render();
      }
    } catch (err) {
      showError(err.message);
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  function passwordForm(title = '비밀번호 변경') {
    UI.modal({
      title,
      submit: '변경하기',
      body: `
        <label class="field"><span>새 비밀번호 <em>6자 이상</em></span><input name="password" type="password" autocomplete="new-password" required></label>
        <label class="field"><span>새 비밀번호 확인</span><input name="confirm" type="password" autocomplete="new-password" required></label>
        <p class="auth-error" hidden></p>`,
      onSubmit(d, form) {
        const err = form.querySelector('.auth-error');
        const fail = (m) => { err.textContent = m; err.hidden = false; };
        if (d.password.length < 6) { fail('비밀번호는 6자 이상이어야 해요.'); return false; }
        if (d.password !== d.confirm) { fail('비밀번호가 서로 달라요.'); return false; }
        Cloud.updatePassword(d.password)
          .then(() => { UI.close(); UI.toast('비밀번호를 변경했어요'); })
          .catch((e2) => fail(e2.message));
        return false;
      },
    });
  }

  // ---------- 폼 ----------
  function clientOptions(selected) {
    const opts = Store.state.clients.map((c) => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${e(c.name)}</option>`).join('');
    return `<option value="">고객 선택</option>${opts}<option value="__new">＋ 새 고객 직접 입력</option>`;
  }

  function projectForm(p) {
    const isNew = !p;
    p = p || { name: '', clientId: '', status: 'planning', startDate: U.today(), dueDate: U.addDays(U.today(), 7), price: '', memo: '', scope: { description: '', items: [], revisionsIncluded: 2 } };
    const statusOpts = Object.entries(PROJECT_STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.label}</option>`).join('');
    const form = UI.modal({
      title: isNew ? '새 프로젝트' : '프로젝트 수정',
      submit: isNew ? '프로젝트 만들기' : '저장',
      body: `
        <label class="field"><span>프로젝트명 *</span><input name="name" required value="${e(p.name)}" placeholder="예) 카페 홈페이지 제작"></label>
        <div class="row">
          <label class="field"><span>고객</span><select name="clientId" class="select">${clientOptions(p.clientId)}</select></label>
          <label class="field"><span>상태</span><select name="status" class="select">${statusOpts}</select></label>
        </div>
        <label class="field new-client-field" hidden><span>새 고객 이름</span><input name="newClient" placeholder="예) 온도 커피"></label>
        <div class="section-label">${icon('checkCircle', 15)} 최초 계약 범위</div>
        <div class="row">
          <label class="field"><span>계약 금액 (원)</span><input name="price" type="number" min="0" step="1000" inputmode="numeric" value="${e(p.price)}" placeholder="200000"></label>
          <label class="field"><span>포함 수정 횟수</span><input name="revisionsIncluded" type="number" min="0" step="1" value="${e(p.scope.revisionsIncluded)}"></label>
        </div>
        <div class="row">
          <label class="field"><span>시작일</span><input name="startDate" type="date" value="${e(p.startDate)}"></label>
          <label class="field"><span>납기일</span><input name="dueDate" type="date" value="${e(p.dueDate)}"></label>
        </div>
        <label class="field"><span>작업 범위 설명</span><textarea name="description" rows="2" placeholder="예) 반응형 홈페이지 3페이지, 문구·사진은 고객 제공">${e(p.scope.description)}</textarea></label>
        ${isNew ? `<label class="field"><span>포함 작업 항목 <em>한 줄에 하나씩</em></span><textarea name="items" rows="3" placeholder="메인 페이지&#10;소개 페이지&#10;문의 페이지"></textarea></label>` : ''}
        <label class="field"><span>메모</span><input name="memo" value="${e(p.memo)}" placeholder="내부 메모 (선택)"></label>`,
      onSubmit(d) {
        let clientId = d.clientId === '__new' ? '' : d.clientId;
        if (d.clientId === '__new' && d.newClient.trim()) clientId = Store.addClient({ name: d.newClient.trim() }).id;
        const data = {
          name: d.name.trim(), clientId, status: d.status,
          startDate: d.startDate, dueDate: d.dueDate, price: U.num(d.price), memo: d.memo.trim(),
        };
        if (isNew) {
          data.scope = {
            description: d.description.trim(),
            items: d.items.split('\n').map((t) => t.trim()).filter(Boolean).map((text) => ({ id: U.uid(), text, done: false })),
            revisionsIncluded: U.num(d.revisionsIncluded), revisionsUsed: 0,
          };
          const created = Store.addProject(data);
          UI.toast('프로젝트를 만들었어요');
          location.hash = `#/projects/${created.id}`;
        } else {
          data.scope = { ...p.scope, description: d.description.trim(), revisionsIncluded: U.num(d.revisionsIncluded) };
          Store.updateProject(p.id, data, 'project_updated');
          UI.toast('저장했어요');
          render();
        }
      },
    });
    const sel = form.querySelector('[name=clientId]');
    const nc = form.querySelector('.new-client-field');
    const sync = () => { nc.hidden = sel.value !== '__new'; };
    sel.addEventListener('change', () => { sync(); if (!nc.hidden) nc.querySelector('input').focus(); });
    if (!Store.state.clients.length) { sel.value = '__new'; }
    sync();
  }

  function clientForm(c) {
    const isNew = !c;
    c = c || { name: '', contact: '', email: '', phone: '', memo: '' };
    UI.modal({
      title: isNew ? '새 고객' : '고객 정보 수정',
      submit: isNew ? '등록' : '저장',
      body: `
        <label class="field"><span>고객명 (회사·브랜드) *</span><input name="name" required value="${e(c.name)}" placeholder="예) 온도 커피"></label>
        <label class="field"><span>담당자</span><input name="contact" value="${e(c.contact)}" placeholder="예) 김온도 대표"></label>
        <div class="row">
          <label class="field"><span>이메일</span><input name="email" type="email" value="${e(c.email)}"></label>
          <label class="field"><span>연락처</span><input name="phone" value="${e(c.phone)}"></label>
        </div>
        <label class="field"><span>메모</span><input name="memo" value="${e(c.memo)}" placeholder="선택"></label>
        <p class="muted small">개인정보는 꼭 필요한 만큼만 입력하세요. 데이터는 이 브라우저에만 저장돼요.</p>`,
      onSubmit(d) {
        const data = { name: d.name.trim(), contact: d.contact.trim(), email: d.email.trim(), phone: d.phone.trim(), memo: d.memo.trim() };
        if (isNew) Store.addClient(data); else Store.updateClient(c.id, data);
        UI.toast(isNew ? '고객을 등록했어요' : '저장했어요');
        render();
      },
    });
  }

  function changeForm(pid, ch, preset) {
    const isNew = !ch;
    ch = ch || { title: '', description: '', requestedAt: U.today(), cost: '', days: 0, status: 'pending', note: '' };
    if (isNew && preset === 'revision') {
      const p = Store.getProject(pid);
      ch.title = `추가 수정 (${(p.scope.revisionsUsed || 0) + 1}회차)`;
      ch.description = `계약에 포함된 수정 ${p.scope.revisionsIncluded}회를 초과한 수정 요청`;
    }
    const opts = Object.entries(CHANGE_STATUS).map(([k, v]) => `<option value="${k}" ${ch.status === k ? 'selected' : ''}>${v.label}</option>`).join('');
    UI.modal({
      title: isNew ? '추가 요청 기록' : '추가 요청 수정',
      submit: isNew ? '기록하기' : '저장',
      body: `
        <p class="hint-box">${icon('plusCircle', 15)} 처음 약속한 범위에 없던 요청이에요. 비용·납기 영향을 함께 적어두면 나중에 다툼이 줄어요.</p>
        <label class="field"><span>요청 내용 *</span><input name="title" required value="${e(ch.title)}" placeholder="예) 페이지 2개 추가"></label>
        <label class="field"><span>상세 설명</span><textarea name="description" rows="2" placeholder="예) 메뉴 페이지, 오시는 길 페이지 추가 요청">${e(ch.description)}</textarea></label>
        <div class="row">
          <label class="field"><span>요청일</span><input name="requestedAt" type="date" value="${e(ch.requestedAt)}"></label>
          <label class="field"><span>상태</span><select name="status" class="select">${opts}</select></label>
        </div>
        <div class="row">
          <label class="field"><span>추가 비용 (원)</span><input name="cost" type="number" min="0" step="1000" inputmode="numeric" value="${e(ch.cost)}" placeholder="100000"></label>
          <label class="field"><span>납기 영향 (일)</span><input name="days" type="number" step="1" value="${e(ch.days)}" placeholder="3"></label>
        </div>
        <label class="field"><span>메모 <em>고객 문서에도 표시돼요</em></span><input name="note" value="${e(ch.note)}" placeholder="예) 카카오톡으로 10/28 요청"></label>`,
      onSubmit(d) {
        const data = {
          title: d.title.trim(), description: d.description.trim(), requestedAt: d.requestedAt || U.today(),
          cost: U.num(d.cost), days: Math.round(U.num(d.days)), status: d.status, note: d.note.trim(),
        };
        if (isNew) {
          Store.addChange(pid, data);
          if (preset === 'revision') { const p = Store.getProject(pid); Store.setRevisionsUsed(pid, (p.scope.revisionsUsed || 0) + 1); }
          UI.toast('추가 요청을 기록했어요');
        } else {
          Store.updateChange(pid, ch.id, data);
          UI.toast('저장했어요');
        }
        render();
      },
    });
  }

  async function showShareLink(pid) {
    const p = Store.getProject(pid);
    if (!p) return;
    const url = await Report.shareUrl(p);
    const fileWarn = location.protocol === 'file:'
      ? `<p class="hint-box warn">${icon('alert', 15)} 지금은 내 컴퓨터의 파일로 열려 있어서 다른 사람이 링크를 열 수 없어요. 사이트를 배포한 주소(예: GitHub Pages)에서 링크를 만들어 주세요.</p>` : '';
    const form = UI.modal({
      title: '고객 확인 링크',
      footer: false,
      body: `
        <p>고객에게 이 링크를 보내면 <b>로그인 없이</b> 최초 계약 범위와 추가 요청 내역을 확인하고 PDF로 저장할 수 있어요.</p>
        ${fileWarn}
        <div class="copy-row">
          <input readonly value="${e(url)}" class="share-input">
          <button type="button" class="btn primary" data-copy>${icon('link', 15)} 복사</button>
        </div>
        <p class="muted small">링크에는 지금 시점의 내용이 담겨 있어요. 내용이 바뀌면 링크를 새로 만들어 보내 주세요.</p>
        <div class="modal-foot inline">
          <a class="btn" href="${e(url)}" target="_blank" rel="noopener">${icon('eye', 15)} 고객 화면 미리보기</a>
          <button type="button" class="btn" data-close>닫기</button>
        </div>`,
    });
    form.querySelector('.modal-foot.inline [data-close]').addEventListener('click', UI.close);
    form.querySelector('[data-copy]').addEventListener('click', () => copy(url));
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    UI.toast('링크를 복사했어요');
  }

  function backup() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scopelog-backup-${U.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    UI.toast('백업 파일을 다운로드했어요');
  }

  // ---------- 액션 ----------
  const actions = {
    'new-project': () => projectForm(),
    'edit-project': () => projectForm(Store.getProject(currentProjectId)),
    'new-client': () => clientForm(),
    'edit-client': (el) => clientForm(Store.getClient(el.dataset.client)),
    async 'delete-client'(el) {
      const c = Store.getClient(el.dataset.client);
      if (await UI.confirm(`<b>${e(c.name)}</b> 고객을 삭제할까요?<br><span class="muted small">연결된 프로젝트는 남고 고객만 ‘미지정’이 돼요.</span>`)) {
        Store.deleteClient(c.id); UI.toast('삭제했어요'); render();
      }
    },
    async 'delete-project'() {
      const p = Store.getProject(currentProjectId);
      if (await UI.confirm(`<b>${e(p.name)}</b> 프로젝트와 모든 추가 요청 기록을 삭제할까요? 되돌릴 수 없어요.`)) {
        Store.deleteProject(p.id); UI.toast('삭제했어요'); location.hash = '#/projects';
      }
    },
    'new-change': (el) => changeForm(currentProjectId, null, el.dataset.preset),
    'edit-change': (el) => changeForm(currentProjectId, Store.getProject(currentProjectId).changes.find((c) => c.id === el.dataset.change)),
    approve: (el) => { Store.updateChange(currentProjectId, el.dataset.change, { status: 'approved' }); UI.toast('승인으로 기록했어요. 금액·납기에 반영됐어요'); render(); },
    reject: (el) => { Store.updateChange(currentProjectId, el.dataset.change, { status: 'rejected' }); UI.toast('거절로 기록했어요'); render(); },
    reopen: (el) => { Store.updateChange(currentProjectId, el.dataset.change, { status: 'pending' }); render(); },
    async 'delete-change'(el) {
      if (await UI.confirm('이 추가 요청 기록을 삭제할까요?')) {
        Store.deleteChange(currentProjectId, el.dataset.change); render();
      }
    },
    'delete-item': (el) => { Store.deleteScopeItem(currentProjectId, el.dataset.item); render(); },
    'rev-inc': () => { const p = Store.getProject(currentProjectId); Store.setRevisionsUsed(p.id, (p.scope.revisionsUsed || 0) + 1); render(); },
    'rev-dec': () => { const p = Store.getProject(currentProjectId); Store.setRevisionsUsed(p.id, (p.scope.revisionsUsed || 0) - 1); render(); },
    'share-link': (el) => showShareLink(el.dataset.project || currentProjectId),
    print: () => window.print(),
    'auth-mode': (el) => { auth.mode = el.dataset.mode; auth.notice = ''; render(); },
    async oauth(el) {
      try { await Cloud.signInWithProvider(el.dataset.provider); }
      catch (err) { UI.toast(err.message, 'error'); }
    },
    async logout() {
      if (!(await UI.confirm('로그아웃할까요?', { ok: '로그아웃', danger: false }))) return;
      await Cloud.signOut();
      Store.clearLocal();
      loadedUserId = null;
      auth.mode = 'signin';
      auth.notice = '';
      location.hash = '#/';
      render();
    },
    'change-password': () => passwordForm(),
    filter: (el) => { view.filter = el.dataset.filter; render(); },
    backup,
    'all-activity': () => UI.modal({ title: '전체 활동', footer: false, body: Views.activityModalBody() }),
    async 'load-sample'() {
      const hasData = Store.state.projects.length || Store.state.clients.length;
      if (hasData && !(await UI.confirm('지금 데이터를 샘플 데이터로 바꿀까요? 기존 데이터는 사라져요.', { ok: '바꾸기' }))) return;
      Store.loadSample(); UI.toast('샘플 데이터를 불러왔어요'); location.hash = '#/'; render();
    },
    async reset() {
      if (await UI.confirm('모든 고객·프로젝트·기록을 삭제할까요? 백업하지 않았다면 되돌릴 수 없어요.', { ok: '모두 삭제' })) {
        Store.reset(); UI.toast('모든 데이터를 삭제했어요'); location.hash = '#/'; render();
      }
    },
  };

  const changeActions = {
    'set-status': (el) => { Store.updateProject(currentProjectId, { status: el.value }); UI.toast(`상태를 ‘${PROJECT_STATUS[el.value].label}’(으)로 바꿨어요`); render(); },
    'toggle-item': (el) => { Store.toggleScopeItem(currentProjectId, el.dataset.item); render(); },
    'toggle-change-done': (el) => { Store.updateChange(currentProjectId, el.dataset.change, { done: el.checked }); render(); },
    restore(el) {
      const file = el.files[0];
      if (!file) return;
      file.text().then((text) => {
        try { Store.importJSON(text); UI.toast('백업에서 복원했어요'); location.hash = '#/'; render(); }
        catch (err) { UI.toast(err.message || '복원하지 못했어요', 'error'); }
      });
    },
  };

  function bind() {
    document.addEventListener('click', (ev) => {
      const el = ev.target.closest('[data-action]');
      if (!el || el.matches('input, select') || !document.getElementById('app').contains(el) && !el.closest('#modal-root')) return;
      const fn = actions[el.dataset.action];
      if (fn) { ev.preventDefault(); fn(el); }
    });
    document.addEventListener('change', (ev) => {
      const el = ev.target.closest('[data-action]');
      const fn = el && changeActions[el.dataset.action];
      if (fn) fn(el);
    });
    app().addEventListener('submit', (ev) => {
      const form = ev.target;
      if (form.dataset.form === 'auth') {
        ev.preventDefault();
        submitAuth(form);
      } else if (form.dataset.form === 'add-item') {
        ev.preventDefault();
        const text = form.elements.text.value;
        if (!text.trim()) return;
        Store.addScopeItem(currentProjectId, text);
        render().then(() => document.querySelector('[data-form=add-item] input')?.focus());
      } else if (form.dataset.form === 'settings') {
        ev.preventDefault();
        Store.updateSettings({ name: form.elements.name.value.trim(), business: form.elements.business.value.trim() });
        UI.toast('저장했어요');
        render();
      }
    });
    app().addEventListener('input', (ev) => {
      if (ev.target.id !== 'project-search') return;
      view.query = ev.target.value;
      render().then(() => {
        const input = document.getElementById('project-search');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
    });
    window.addEventListener('hashchange', () => { UI.close(); render(); });
    // 다른 탭에서 데이터가 바뀌면 다시 그리기
    window.addEventListener('storage', (ev) => { if (ev.key === Store.key) location.reload(); });
  }

  function start() {
    bind();
    if (!Cloud.enabled) {
      const cfg = window.SCOPELOG_CONFIG || {};
      if (cfg.supabaseUrl && !window.supabase) UI.toast('로그인 서버에 연결하지 못했어요. 새로고침해 주세요.', 'error');
      Store.init();
      render();
      return;
    }
    Cloud.onStatus((s) => {
      const el = document.getElementById('sync-status');
      if (el) el.innerHTML = Views.syncLabel(s);
    });
    render();
    Cloud.onAuth(handleAuth);
  }

  return { start, render };
})();

App.start();
