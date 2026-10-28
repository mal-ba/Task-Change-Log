// 화면 렌더링 (HTML 문자열을 반환)
const Views = (() => {
  const e = U.esc;

  function shell(active, content) {
    const { settings } = Store.state;
    const name = settings.name || '나';
    const nav = [
      ['home', '#/', '홈', 'home'],
      ['clients', '#/clients', '고객', 'users'],
      ['projects', '#/projects', '프로젝트', 'folder'],
      ['settings', '#/settings', '설정', 'settings'],
    ];
    return `
      <div class="layout">
        <aside class="sidebar no-print">
          <a class="brand" href="#/">
            ${LOGO_SVG}
            <div><strong>ScopeLog</strong><span>작업 범위를 지키는 기록</span></div>
          </a>
          <nav class="nav">
            ${nav.map(([key, href, label, ic]) => `
              <a href="${href}" class="nav-item ${active === key ? 'active' : ''}">${icon(ic, 19)}<span>${label}</span></a>`).join('')}
          </nav>
          <div class="side-user">
            <div class="side-user-row">
              <span class="avatar">${e(U.initial(name))}</span>
              <div class="side-user-name"><strong>${e(name)}</strong><span>${e(Cloud.user?.email || settings.business || '프리랜서')}</span></div>
            </div>
            ${Cloud.user ? `
            <div class="sync" id="sync-status">${syncLabel(Cloud.status)}</div>
            <button class="btn sm block" data-action="logout">${icon('logout', 15)} 로그아웃</button>` : `
            <button class="btn sm block" data-action="backup">${icon('download', 15)} 데이터 백업</button>`}
          </div>
        </aside>
        <main class="main">${content}</main>
      </div>`;
  }

  function syncLabel(status) {
    const map = {
      idle: ['cloud', '클라우드에 저장돼요', ''],
      saved: ['cloud', '모든 변경 저장됨', 'ok'],
      saving: ['refresh', '저장 중…', ''],
      error: ['alert', '저장 실패 · 자동 재시도', 'bad'],
      offline: ['alert', '오프라인 · 연결되면 저장', 'bad'],
    };
    const [ic, text, cls] = map[status] || map.idle;
    return `<span class="${cls}">${icon(ic, 13)} ${text}</span>`;
  }

  // ---------- 로그인 ----------
  const GOOGLE_SVG = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>`;
  const KAKAO_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.48 2 10.78c0 2.77 1.86 5.2 4.66 6.58l-.95 3.48c-.08.3.26.54.52.37l4.15-2.74c.53.06 1.07.09 1.62.09 5.52 0 10-3.48 10-7.78S17.52 3 12 3z"/></svg>`;

  function login(mode = 'signin', notice = '') {
    const p = Cloud.providers;
    const social = [
      p.google ? `<button class="btn social google" data-action="oauth" data-provider="google">${GOOGLE_SVG} Google로 계속하기</button>` : '',
      p.kakao ? `<button class="btn social kakao" data-action="oauth" data-provider="kakao">${KAKAO_SVG} 카카오로 계속하기</button>` : '',
    ].join('');
    const titles = {
      signin: ['다시 오신 걸 환영해요', '로그인하고 프로젝트를 이어서 관리하세요.'],
      signup: ['ScopeLog 시작하기', '무료로 가입하고 어느 기기에서든 기록을 확인하세요.'],
      reset: ['비밀번호 찾기', '가입한 이메일로 비밀번호 재설정 링크를 보내드려요.'],
    };
    const [title, sub] = titles[mode];
    const submit = { signin: '로그인', signup: '가입하기', reset: '재설정 링크 보내기' }[mode];
    return `
      <div class="auth">
        <section class="auth-card">
          <a class="brand" href="#/">${LOGO_SVG}<div><strong>ScopeLog</strong><span>작업 범위를 지키는 기록</span></div></a>
          <h1>${title}</h1>
          <p class="muted">${sub}</p>
          ${notice ? `<p class="hint-box">${icon('checkCircle', 15)} ${e(notice)}</p>` : ''}
          ${mode !== 'reset' && social ? `<div class="social-list">${social}</div><div class="divider"><span>또는 이메일로</span></div>` : ''}
          <form class="auth-form" data-form="auth" data-mode="${mode}" novalidate>
            ${mode === 'signup' ? `<label class="field"><span>이름</span><input name="name" autocomplete="name" placeholder="예) 김지훈"></label>` : ''}
            <label class="field"><span>이메일</span><input name="email" type="email" autocomplete="email" required placeholder="you@example.com"></label>
            ${mode !== 'reset' ? `
            <label class="field"><span>비밀번호${mode === 'signup' ? ' <em>6자 이상</em>' : ''}</span>
              <input name="password" type="password" required minlength="6" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}"></label>` : ''}
            <p class="auth-error" hidden></p>
            <button class="btn primary block lg">${submit}</button>
          </form>
          <div class="auth-links">
            ${mode === 'signin' ? `
              <button class="link-btn" data-action="auth-mode" data-mode="reset">비밀번호를 잊으셨나요?</button>
              <span>계정이 없으신가요? <button class="link-btn" data-action="auth-mode" data-mode="signup">회원가입</button></span>` : `
              <span>이미 계정이 있으신가요? <button class="link-btn" data-action="auth-mode" data-mode="signin">로그인</button></span>`}
          </div>
        </section>
        <aside class="auth-side">
          <h2>처음 약속한 작업과<br>나중에 추가된 작업,<br>이제 헷갈리지 마세요</h2>
          <ul>
            <li>${icon('checkCircle', 18)}<div><strong>최초 계약 범위</strong><span>페이지 3개, 수정 2회, 납기 7일</span></div></li>
            <li>${icon('plusCircle', 18)}<div><strong>추가 요청 기록</strong><span>페이지 2개 추가 · 비용·납기 협의</span></div></li>
            <li>${icon('fileText', 18)}<div><strong>고객 확인용 변경 내역</strong><span>PDF와 링크로 바로 공유</span></div></li>
          </ul>
        </aside>
      </div>`;
  }

  function loading(text = '불러오는 중…') {
    return `<div class="loading"><div class="spinner"></div><p>${e(text)}</p></div>`;
  }

  // ---------- 공통 조각 ----------
  function statCard(label, value, sub, ic, tone = '') {
    return `
      <div class="card stat">
        <div class="stat-icon">${icon(ic, 40)}</div>
        <span class="stat-label">${label}</span>
        <strong class="stat-value ${tone}">${value}</strong>
        <span class="stat-sub">${sub}</span>
      </div>`;
  }

  function projectRow(p, { detailed = false } = {}) {
    const c = calcProject(p);
    const pendingBadge = c.pending.length ? `<span class="badge-warn">${icon('clock', 12)} 승인 대기 ${c.pending.length}</span>` : '';
    const left = U.daysUntil(c.finalDue);
    let dueText = '';
    if (c.finalDue && p.status !== 'done') {
      dueText = left < 0 ? `<span class="due late">납기 ${-left}일 지남</span>` : left === 0 ? `<span class="due soon">오늘 납기</span>` : `<span class="due ${left <= 3 ? 'soon' : ''}">D-${left}</span>`;
    }
    return `
      <a class="proj-row" href="#/projects/${p.id}">
        <div class="proj-top">
          ${projectTile(p)}
          <div class="proj-name">
            <strong>${e(p.name)}</strong>
            <span>고객: ${e(Store.clientName(p.clientId))}</span>
          </div>
          <div class="proj-right">
            ${pendingBadge}
            ${pill(PROJECT_STATUS, p.status)}
          </div>
        </div>
        ${detailed ? `
        <div class="proj-meta">
          <span>${icon('coins', 14)} ${U.money(c.base)}${c.extra ? ` <b class="plus">${U.signedMoney(c.extra)}</b>` : ''}</span>
          <span>${icon('calendar', 14)} ${U.date(c.finalDue || p.dueDate)} ${dueText}</span>
          <span>${icon('fileText', 14)} 추가 요청 ${p.changes.length}건</span>
        </div>` : ''}
        <div class="proj-progress">
          <div class="bar"><span style="width:${c.progress}%"></span></div>
          <b>${c.progress}%</b>
        </div>
      </a>`;
  }

  function activityItem(a) {
    const actor = `<b>${e(a.actor)}</b>`;
    const t = `<b>${e(a.target)}</b>`;
    const map = {
      project_created: [`${actor} 님이 프로젝트 ${t} 생성`, 'blue'],
      project_status: [`${actor} 님이 상태를 ${t}(으)로 변경`, 'gray'],
      project_updated: [`${actor} 님이 프로젝트 정보 수정`, 'gray'],
      change_added: [`${actor} 님이 추가 요청 ${t} 기록`, 'amber'],
      change_approved: [`${actor} 님이 추가 요청 ${t} 승인`, 'green'],
      change_rejected: [`${actor} 님이 추가 요청 ${t} 거절`, 'red'],
      client_created: [`${actor} 님이 고객 ${t} 등록`, 'blue'],
      item_done: [`${actor} 님이 작업 ${t} 완료`, 'green'],
      revision_used: [`${actor} 님이 ${t} 기록`, 'gray'],
    };
    const [text, tone] = map[a.type] || [`${actor} ${t}`, 'gray'];
    const sub = [a.projectName, U.timeAgo(a.at)].filter(Boolean).map(e).join(' • ');
    return `<li class="act"><span class="dot ${tone}"></span><div><p>${text}</p><span>${sub}</span></div></li>`;
  }

  function attentionList(projects) {
    const items = [];
    projects.forEach((p) => {
      const c = calcProject(p);
      if (c.pending.length) {
        items.push(`
          <a class="attn" href="#/projects/${p.id}">
            ${icon('alert', 18)}
            <div><strong>${e(p.name)}</strong> — 추가 요청 ${c.pending.length}건 승인 대기 (${U.signedMoney(c.pendingExtra)})
            <span>승인 전에는 추가 작업을 시작하지 않는 것이 안전해요</span></div>
          </a>`);
      }
      if (c.revOver && p.status !== 'done') {
        items.push(`
          <a class="attn" href="#/projects/${p.id}">
            ${icon('alert', 18)}
            <div><strong>${e(p.name)}</strong> — 포함 수정 횟수 초과 (${c.revUsed}/${c.revIncluded}회)
            <span>초과 수정은 추가 요청으로 기록하고 비용을 협의하세요</span></div>
          </a>`);
      }
    });
    return items;
  }

  // ---------- 홈 ----------
  function dashboard() {
    const { projects, clients, activity, settings } = Store.state;
    const name = settings.name || '';

    if (!projects.length && !clients.length) {
      return shell('home', `
        <header class="page-head">
          <div class="greet">
            <span class="avatar lg">${e(U.initial(name || 'S'))}</span>
            <div><h1>${U.greeting()}${name ? `, ${e(name)}님` : ''}</h1><p>ScopeLog에 오신 걸 환영해요.</p></div>
          </div>
        </header>
        <section class="card onboard">
          <h2>처음 약속한 작업과 나중에 추가된 작업, 이제 헷갈리지 마세요</h2>
          <ol class="steps">
            <li><span>${icon('checkCircle', 20)}</span><div><strong>최초 계약 범위</strong><p>예) 페이지 3개, 수정 2회, 납기 7일, 20만 원</p></div></li>
            <li><span>${icon('plusCircle', 20)}</span><div><strong>추가 요청 기록</strong><p>예) 페이지 2개 추가 — 추가 비용·납기 협의</p></div></li>
            <li><span>${icon('fileText', 20)}</span><div><strong>고객 확인용 변경 내역</strong><p>기존 작업과 추가 작업을 분리한 문서를 PDF나 링크로 공유</p></div></li>
          </ol>
          <div class="onboard-actions">
            <button class="btn primary" data-action="new-project">${icon('plus', 16)} 첫 프로젝트 만들기</button>
            <button class="btn" data-action="load-sample">${icon('eye', 16)} 샘플 데이터로 둘러보기</button>
          </div>
        </section>`);
    }

    const active = projects.filter((p) => ACTIVE_STATUSES.includes(p.status));
    const newThisWeek = projects.filter((p) => Date.now() - p.createdAt < 7 * 864e5).length;
    const newClients = clients.filter((c) => U.isThisMonth(c.createdAt)).length;
    let securedMonth = 0, pendingCount = 0, pendingSum = 0;
    projects.forEach((p) => p.changes.forEach((c) => {
      if (c.status === 'approved' && U.isThisMonth(c.decidedAt)) securedMonth += Number(c.cost) || 0;
      if (c.status === 'pending') { pendingCount++; pendingSum += Number(c.cost) || 0; }
    }));

    const attn = attentionList(projects);
    const recent = [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

    return shell('home', `
      <header class="page-head">
        <div class="greet">
          <span class="avatar lg">${e(U.initial(name || 'S'))}</span>
          <div>
            <h1>${U.greeting()}${name ? `, ${e(name)}님` : ''}</h1>
            <p>진행 중인 프로젝트가 ${active.length}개 있어요. 오늘도 힘내세요.</p>
          </div>
        </div>
        <div class="head-actions">
          <button class="btn" data-action="new-client">${icon('userPlus', 16)} 새 고객</button>
          <button class="btn primary" data-action="new-project">${icon('plus', 16)} 새 프로젝트</button>
        </div>
      </header>

      <section class="stats">
        ${statCard('전체 고객', clients.length, newClients ? `<span class="up">${icon('trendUp', 13)} +${newClients}</span> 이번 달 신규` : '이번 달 신규 없음', 'users')}
        ${statCard('진행 중 프로젝트', active.length, newThisWeek ? `<span class="up">+ ${newThisWeek}</span> 이번 주 생성` : `전체 ${projects.length}개`, 'folder')}
        ${statCard('이번 달 추가 확보 금액', U.money(securedMonth), '승인된 추가 요청 기준', 'shield', 'accent')}
        ${statCard('승인 대기 요청', `${pendingCount}건`, pendingCount ? `협의 중 금액 ${U.money(pendingSum)}` : '모두 정리됐어요', 'clipboard')}
      </section>

      ${attn.length ? `
      <section class="card attention">
        <h3>${icon('zap', 16)} 확인이 필요해요</h3>
        <div class="attn-list">${attn.slice(0, 4).join('')}</div>
      </section>` : ''}

      <section class="grid-2">
        <div>
          <div class="sec-head"><h2>최근 프로젝트</h2><a href="#/projects">모두 보기</a></div>
          <div class="card list">
            ${recent.length ? recent.map((p) => projectRow(p)).join('') : `<div class="empty">아직 프로젝트가 없어요.</div>`}
          </div>
        </div>
        <div class="card activity">
          <h3>최근 활동</h3>
          <ul class="acts">${activity.slice(0, 6).map(activityItem).join('') || '<li class="empty">활동 기록이 없어요.</li>'}</ul>
          ${activity.length > 6 ? `<button class="link-btn" data-action="all-activity">전체 활동 보기</button>` : ''}
        </div>
      </section>`);
  }

  function activityModalBody() {
    return `<ul class="acts">${Store.state.activity.map(activityItem).join('')}</ul>`;
  }

  // ---------- 프로젝트 목록 ----------
  function projects(filter = 'all', query = '') {
    const all = Store.state.projects;
    const q = query.trim().toLowerCase();
    const list = all.filter((p) => {
      if (filter === 'active' && !ACTIVE_STATUSES.includes(p.status)) return false;
      if (filter === 'pending' && !p.changes.some((c) => c.status === 'pending')) return false;
      if (!['all', 'active', 'pending'].includes(filter) && p.status !== filter) return false;
      if (q && !(`${p.name} ${Store.clientName(p.clientId)}`.toLowerCase().includes(q))) return false;
      return true;
    });
    const chips = [['all', '전체'], ['active', '진행 중'], ['pending', '승인 대기'], ['lead', '상담·견적'], ['done', '완료'], ['on_hold', '보류']];
    return shell('projects', `
      <header class="page-head">
        <div><h1>프로젝트</h1><p>최초 계약 범위와 추가 요청을 프로젝트별로 관리해요.</p></div>
        <div class="head-actions"><button class="btn primary" data-action="new-project">${icon('plus', 16)} 새 프로젝트</button></div>
      </header>
      <div class="toolbar">
        <div class="chips">
          ${chips.map(([k, l]) => `<button class="chip ${filter === k ? 'on' : ''}" data-action="filter" data-filter="${k}">${l}</button>`).join('')}
        </div>
        <label class="search">${icon('search', 16)}<input id="project-search" type="search" placeholder="프로젝트·고객 검색" value="${e(query)}"></label>
      </div>
      <div class="card list">
        ${list.length ? list.map((p) => projectRow(p, { detailed: true })).join('') : `
          <div class="empty">
            ${all.length ? '조건에 맞는 프로젝트가 없어요.' : '아직 프로젝트가 없어요. 첫 프로젝트를 만들어 보세요.'}
          </div>`}
      </div>`);
  }

  // ---------- 프로젝트 상세 ----------
  function project(id) {
    const p = Store.getProject(id);
    if (!p) return notFound();
    const client = Store.getClient(p.clientId);
    const c = calcProject(p);

    const statusOptions = Object.entries(PROJECT_STATUS)
      .map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.label}</option>`).join('');

    const changeList = p.changes.length
      ? [...p.changes].reverse().map((ch) => changeItem(p, ch)).join('')
      : `<div class="empty">
           <p>아직 추가 요청이 없어요.</p>
           <span>고객이 처음 약속에 없던 작업을 요청하면 여기에 기록하세요.</span>
         </div>`;

    const items = p.scope.items.map((it) => `
      <li class="check-item ${it.done ? 'done' : ''}">
        <label><input type="checkbox" data-action="toggle-item" data-item="${it.id}" ${it.done ? 'checked' : ''}><span>${e(it.text)}</span></label>
        <button class="icon-btn" data-action="delete-item" data-item="${it.id}" title="삭제">${icon('x', 14)}</button>
      </li>`).join('');

    const revWarn = c.revFull
      ? `<div class="rev-warn">${icon('alert', 15)}<div>${c.revOver ? `포함된 수정 횟수를 ${c.revUsed - c.revIncluded}회 초과했어요.` : '포함된 수정 횟수를 모두 사용했어요.'} 다음 수정부터는 추가 요청으로 기록하세요.
          <button class="link-btn" data-action="new-change" data-preset="revision">추가 수정으로 기록</button></div></div>`
      : '';

    const left = U.daysUntil(c.finalDue);
    const dueSub = c.finalDue && p.status !== 'done'
      ? (left < 0 ? `<span class="due late">${-left}일 지남</span>` : `<span class="due ${left <= 3 ? 'soon' : ''}">D-${left}</span>`) : '';

    return shell('projects', `
      <a class="back" href="#/projects">${icon('arrowLeft', 16)} 프로젝트 목록</a>
      <header class="page-head detail-head">
        <div class="greet">
          ${projectTile(p, 'lg')}
          <div>
            <h1>${e(p.name)}</h1>
            <p>고객: ${client ? `<a href="#/clients">${e(client.name)}</a>` : '미지정'} · ${U.date(p.startDate)} ~ ${U.date(p.dueDate)}</p>
          </div>
        </div>
        <div class="head-actions">
          <select class="select status-select" data-action="set-status" aria-label="프로젝트 상태">${statusOptions}</select>
          <button class="btn" data-action="edit-project">${icon('edit', 15)} 수정</button>
          <button class="btn" data-action="share-link">${icon('link', 15)} 고객 확인 링크</button>
          <a class="btn primary" href="#/report/${p.id}">${icon('fileText', 15)} 변경 내역서 (PDF)</a>
        </div>
      </header>

      <section class="stats three">
        <div class="card stat compare">
          <span class="stat-label">계약 금액</span>
          <div class="flow">${c.extra ? `<span class="old">${U.money(c.base)}</span>${icon('arrowRight', 16)}` : ''}<strong>${U.money(c.total)}</strong></div>
          <span class="stat-sub">승인된 추가 <b class="plus">${U.signedMoney(c.extra)}</b>${c.pendingExtra ? ` · 협의 중 ${U.signedMoney(c.pendingExtra)}` : ''}</span>
        </div>
        <div class="card stat compare">
          <span class="stat-label">납기</span>
          <div class="flow">${c.extraDays ? `<span class="old">${U.date(p.dueDate)}</span>${icon('arrowRight', 16)}` : ''}<strong>${U.date(c.finalDue || p.dueDate)}</strong></div>
          <span class="stat-sub">승인된 일정 변경 ${U.signedDays(c.extraDays)} ${dueSub}</span>
        </div>
        <div class="card stat">
          <span class="stat-label">진행률</span>
          <strong class="stat-value">${c.progress}%</strong>
          <div class="bar"><span style="width:${c.progress}%"></span></div>
        </div>
      </section>

      <section class="detail-grid">
        <div class="card pad">
          <div class="card-head">
            <div>
              <h3>추가·변경 요청 기록</h3>
              <p class="muted small">처음 약속에 없던 요청을 날짜·비용·납기 영향과 함께 남겨요.</p>
            </div>
            <button class="btn primary sm" data-action="new-change">${icon('plus', 15)} 추가 요청 기록</button>
          </div>
          <div class="changes">${changeList}</div>
        </div>

        <div class="side-col">
          <div class="card pad">
            <div class="card-head">
              <h3>${icon('checkCircle', 17)} 최초 계약 범위</h3>
              <button class="icon-btn" data-action="edit-project" title="수정">${icon('edit', 15)}</button>
            </div>
            ${p.scope.description ? `<p class="scope-desc">${e(p.scope.description)}</p>` : ''}
            <ul class="checklist">${items}</ul>
            <form class="add-item" data-form="add-item">
              <input name="text" placeholder="포함 작업 추가 (예: 메인 페이지)" autocomplete="off">
              <button class="icon-btn solid" title="추가">${icon('plus', 15)}</button>
            </form>
            <div class="revisions">
              <div>
                <strong>수정 횟수</strong>
                <span class="muted small">계약에 포함 ${c.revIncluded}회</span>
              </div>
              <div class="stepper">
                <button class="icon-btn" data-action="rev-dec" title="줄이기">${icon('minus', 14)}</button>
                <span class="${c.revOver ? 'over' : ''}">${c.revUsed} / ${c.revIncluded}</span>
                <button class="icon-btn" data-action="rev-inc" title="수정 1회 사용">${icon('plus', 14)}</button>
              </div>
            </div>
            ${revWarn}
          </div>

          <div class="card pad">
            <h3>프로젝트 정보</h3>
            <dl class="info">
              <dt>고객</dt><dd>${e(client?.name || '-')}</dd>
              ${client?.contact ? `<dt>담당자</dt><dd>${e(client.contact)}</dd>` : ''}
              ${client?.email ? `<dt>이메일</dt><dd>${e(client.email)}</dd>` : ''}
              ${client?.phone ? `<dt>연락처</dt><dd>${e(client.phone)}</dd>` : ''}
              <dt>시작일</dt><dd>${U.date(p.startDate)}</dd>
              <dt>최초 납기</dt><dd>${U.date(p.dueDate)}</dd>
              ${p.memo ? `<dt>메모</dt><dd>${e(p.memo)}</dd>` : ''}
            </dl>
            <button class="btn danger-ghost sm" data-action="delete-project">${icon('trash', 14)} 프로젝트 삭제</button>
          </div>
        </div>
      </section>`);
  }

  function changeItem(p, ch) {
    const actions = ch.status === 'pending'
      ? `<button class="btn sm success" data-action="approve" data-change="${ch.id}">${icon('check', 14)} 승인</button>
         <button class="btn sm" data-action="reject" data-change="${ch.id}">${icon('x', 14)} 거절</button>`
      : `<button class="btn sm ghost" data-action="reopen" data-change="${ch.id}">협의 중으로 되돌리기</button>`;
    return `
      <div class="change ${ch.status}">
        <div class="change-top">
          <div class="change-title">
            <strong>${e(ch.title)}</strong>
            <span class="muted small">${U.date(ch.requestedAt)} 요청</span>
          </div>
          ${pill(CHANGE_STATUS, ch.status)}
        </div>
        ${ch.description ? `<p class="change-desc">${e(ch.description)}</p>` : ''}
        <div class="change-meta">
          <span class="${ch.cost ? 'plus' : ''}">${icon('coins', 14)} ${ch.cost ? U.signedMoney(ch.cost) : '추가 비용 없음'}</span>
          <span>${icon('calendar', 14)} 납기 ${U.signedDays(ch.days)}</span>
          ${ch.note ? `<span>${icon('fileText', 14)} ${e(ch.note)}</span>` : ''}
        </div>
        <div class="change-actions">
          ${ch.status === 'approved' ? `<label class="done-toggle"><input type="checkbox" data-action="toggle-change-done" data-change="${ch.id}" ${ch.done ? 'checked' : ''}> 작업 완료</label>` : ''}
          <div class="spacer"></div>
          ${actions}
          <button class="icon-btn" data-action="edit-change" data-change="${ch.id}" title="수정">${icon('edit', 14)}</button>
          <button class="icon-btn" data-action="delete-change" data-change="${ch.id}" title="삭제">${icon('trash', 14)}</button>
        </div>
      </div>`;
  }

  // ---------- 고객 ----------
  function clients() {
    const { clients, projects } = Store.state;
    const cards = clients.map((c) => {
      const ps = projects.filter((p) => p.clientId === c.id);
      const total = ps.reduce((s, p) => s + calcProject(p).total, 0);
      const extra = ps.reduce((s, p) => s + calcProject(p).extra, 0);
      return `
        <div class="card client">
          <div class="client-top">
            <span class="avatar">${e(U.initial(c.name))}</span>
            <div class="client-name"><strong>${e(c.name)}</strong><span>${e(c.contact || '담당자 미입력')}</span></div>
            <button class="icon-btn" data-action="edit-client" data-client="${c.id}" title="수정">${icon('edit', 14)}</button>
            <button class="icon-btn" data-action="delete-client" data-client="${c.id}" title="삭제">${icon('trash', 14)}</button>
          </div>
          <div class="client-info">
            ${c.email ? `<span>${e(c.email)}</span>` : ''}
            ${c.phone ? `<span>${e(c.phone)}</span>` : ''}
            ${c.memo ? `<span class="muted">${e(c.memo)}</span>` : ''}
          </div>
          <div class="client-stats">
            <div><span>프로젝트</span><strong>${ps.length}개</strong></div>
            <div><span>총 계약</span><strong>${U.money(total)}</strong></div>
            <div><span>추가 확보</span><strong class="plus">${U.money(extra)}</strong></div>
          </div>
          ${ps.length ? `<div class="client-projects">${ps.map((p) => `<a href="#/projects/${p.id}">${e(p.name)} ${pill(PROJECT_STATUS, p.status)}</a>`).join('')}</div>` : ''}
        </div>`;
    }).join('');
    return shell('clients', `
      <header class="page-head">
        <div><h1>고객</h1><p>고객별 프로젝트와 추가로 확보한 금액을 한눈에 봐요.</p></div>
        <div class="head-actions"><button class="btn primary" data-action="new-client">${icon('userPlus', 16)} 새 고객</button></div>
      </header>
      ${clients.length ? `<div class="client-grid">${cards}</div>` : `<div class="card"><div class="empty">아직 등록된 고객이 없어요.</div></div>`}`);
  }

  // ---------- 설정 ----------
  function settings() {
    const s = Store.state.settings;
    return shell('settings', `
      <header class="page-head"><div><h1>설정</h1><p>내 정보와 데이터를 관리해요.</p></div></header>
      <div class="settings-grid">
        ${Cloud.user ? accountCard() : ''}
        <form class="card pad" data-form="settings">
          <h3>내 정보</h3>
          <p class="muted small">변경 내역서와 고객 확인 링크에 작업자 이름으로 표시돼요.</p>
          <label class="field"><span>이름</span><input name="name" value="${e(s.name)}" placeholder="예) 김지훈"></label>
          <label class="field"><span>상호 / 활동명</span><input name="business" value="${e(s.business)}" placeholder="예) 지훈 웹스튜디오"></label>
          <button class="btn primary">저장</button>
        </form>
        <div class="card pad">
          <h3>${icon('database', 17)} 데이터</h3>
          <p class="muted small">${Cloud.user
            ? '데이터는 내 계정에 저장되고, 로그인한 모든 기기에서 같은 내용을 볼 수 있어요. 필요하면 파일로도 백업해 두세요.'
            : '모든 데이터는 지금 사용하는 브라우저에만 저장돼요. 다른 기기로 옮기거나 브라우저 기록을 지우기 전에 꼭 백업하세요.'}</p>
          <div class="btn-col">
            <button class="btn" data-action="backup">${icon('download', 15)} 백업 파일 다운로드 (JSON)</button>
            <label class="btn">${icon('upload', 15)} 백업 파일에서 복원<input type="file" accept="application/json,.json" data-action="restore" hidden></label>
            <button class="btn" data-action="load-sample">${icon('eye', 15)} 샘플 데이터 불러오기</button>
            <button class="btn danger-ghost" data-action="reset">${icon('trash', 15)} 모든 데이터 삭제</button>
          </div>
        </div>
      </div>`);
  }

  function accountCard() {
    const u = Cloud.user;
    const provider = { email: '이메일', google: 'Google', kakao: '카카오' }[Cloud.userProvider()] || Cloud.userProvider();
    return `
      <div class="card pad">
        <h3>${icon('user', 17)} 계정</h3>
        <dl class="info">
          <dt>이메일</dt><dd>${e(u.email || '-')}</dd>
          <dt>로그인 방식</dt><dd>${e(provider)}</dd>
          <dt>가입일</dt><dd>${U.date(u.created_at)}</dd>
        </dl>
        <div class="btn-col">
          ${Cloud.userProvider() === 'email' ? `<button class="btn" data-action="change-password">${icon('lock', 15)} 비밀번호 변경</button>` : ''}
          <button class="btn" data-action="logout">${icon('logout', 15)} 로그아웃</button>
        </div>
      </div>`;
  }

  // ---------- 변경 내역서 (인쇄 / 공유) ----------
  function reportPage(snap, { mode, projectId }) {
    const bar = mode === 'share'
      ? `<div class="doc-bar no-print">
           <div class="doc-bar-info">${icon('shield', 16)} <span><b>${e(snap.issuer.business || snap.issuer.name || '작업자')}</b>님이 공유한 작업 변경 내역이에요. 내용을 확인해 주세요.</span></div>
           <button class="btn primary sm" data-action="print">${icon('printer', 15)} PDF로 저장</button>
         </div>`
      : `<div class="doc-bar no-print">
           <a class="btn sm" href="#/projects/${projectId}">${icon('arrowLeft', 15)} 프로젝트로</a>
           <div class="spacer"></div>
           <button class="btn sm" data-action="share-link" data-project="${projectId}">${icon('link', 15)} 고객 확인 링크 복사</button>
           <button class="btn primary sm" data-action="print">${icon('printer', 15)} 인쇄 / PDF 저장</button>
         </div>`;
    return `
      <div class="doc-layout">
        ${bar}
        ${mode !== 'share' ? `<p class="doc-tip no-print">인쇄 창에서 대상(프린터)을 <b>‘PDF로 저장’</b>으로 선택하면 PDF 파일로 받을 수 있어요.</p>` : ''}
        ${Report.html(snap)}
        <p class="doc-foot no-print">ScopeLog로 작성된 문서입니다.</p>
      </div>`;
  }

  function notFound(msg = '페이지를 찾을 수 없어요.') {
    return shell('', `<div class="card"><div class="empty"><p>${e(msg)}</p><a class="btn" href="#/">홈으로</a></div></div>`);
  }

  return { dashboard, projects, project, clients, settings, reportPage, notFound, activityModalBody, login, loading, syncLabel };
})();
