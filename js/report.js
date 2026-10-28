// 고객 확인용 변경 내역서: 인쇄(PDF)와 공유 링크에서 같은 화면을 사용
const Report = (() => {
  // 공유/인쇄에 필요한 정보만 담은 스냅샷
  function snapshot(p) {
    const client = Store.getClient(p.clientId);
    const { settings } = Store.state;
    return {
      v: 1,
      at: Date.now(),
      issuer: { name: settings.name || '', business: settings.business || '' },
      client: { name: client?.name || '', contact: client?.contact || '' },
      project: {
        name: p.name, status: p.status, startDate: p.startDate, dueDate: p.dueDate, price: p.price,
        scope: {
          description: p.scope.description,
          items: p.scope.items.map((i) => ({ text: i.text, done: i.done })),
          revisionsIncluded: p.scope.revisionsIncluded, revisionsUsed: p.scope.revisionsUsed,
        },
        changes: p.changes.map((c) => ({
          title: c.title, description: c.description, requestedAt: c.requestedAt,
          cost: c.cost, days: c.days, status: c.status, done: c.done, note: c.note,
        })),
      },
    };
  }

  // ---- 링크 인코딩 (URL # 뒤에 압축해 담음: 서버 없이 공유 가능) ----
  function toB64url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromB64url(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if ('CompressionStream' in window) {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return 'z' + toB64url(new Uint8Array(await new Response(stream).arrayBuffer()));
    }
    return 'p' + toB64url(bytes);
  }

  async function decode(token) {
    const kind = token[0];
    let bytes = fromB64url(token.slice(1));
    if (kind === 'z') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    } else if (kind !== 'p') {
      throw new Error('unknown format');
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function shareUrl(p) {
    const token = await encode(snapshot(p));
    return `${location.origin}${location.pathname}#/s/${token}`;
  }

  // ---- 문서 HTML ----
  function html(s) {
    const e = U.esc;
    const p = s.project;
    const c = calcProject(p);
    const all = p.changes || [];
    const issuer = [s.issuer.business, s.issuer.name].filter(Boolean).join(' · ') || '-';

    const rows = all.length
      ? all.map((ch, i) => `
        <tr class="${ch.status === 'rejected' ? 'is-rejected' : ''}">
          <td class="c">${i + 1}</td>
          <td>${U.date(ch.requestedAt)}</td>
          <td><strong>${e(ch.title)}</strong>${ch.description ? `<div class="r-sub">${e(ch.description)}</div>` : ''}${ch.note ? `<div class="r-sub">메모: ${e(ch.note)}</div>` : ''}</td>
          <td class="r">${ch.cost ? U.signedMoney(ch.cost) : '없음'}</td>
          <td class="r">${U.signedDays(ch.days)}</td>
          <td class="c">${pill(CHANGE_STATUS, ch.status)}</td>
        </tr>`).join('')
      : `<tr><td colspan="6" class="c muted">기록된 추가 요청이 없습니다.</td></tr>`;

    const items = p.scope.items.length
      ? `<ul class="r-items">${p.scope.items.map((i) => `<li>${icon('checkCircle', 15)}<span>${e(i.text)}</span></li>`).join('')}</ul>`
      : '';

    const pendingNote = c.pending.length
      ? `<p class="r-callout">${icon('alert', 15)} 협의 중인 요청 ${c.pending.length}건(${U.signedMoney(c.pendingExtra)}, 납기 ${U.signedDays(c.pendingDays)})은 아직 최종 금액·납기에 반영되지 않았습니다.</p>`
      : '';

    return `
      <article class="report">
        <header class="r-head">
          <div>
            <div class="r-brand">${LOGO_SVG}<span>ScopeLog</span></div>
            <h1>작업 변경 내역서</h1>
            <p class="muted">처음 약속한 작업과 나중에 추가된 작업을 구분해 정리한 문서입니다.</p>
          </div>
          <dl class="r-meta">
            <dt>프로젝트</dt><dd>${e(p.name)}</dd>
            <dt>고객</dt><dd>${e(s.client.name || '-')}${s.client.contact ? ` (${e(s.client.contact)})` : ''}</dd>
            <dt>작업자</dt><dd>${e(issuer)}</dd>
            <dt>작성일</dt><dd>${U.date(new Date(s.at).toISOString())}</dd>
          </dl>
        </header>

        <section class="r-summary">
          <div class="r-box">
            <span class="r-label">계약 금액</span>
            <div class="r-flow"><span>${U.money(c.base)}</span>${icon('arrowRight', 14)}<strong>${U.money(c.total)}</strong></div>
            <span class="r-hint">승인된 추가 ${U.signedMoney(c.extra)}</span>
          </div>
          <div class="r-box">
            <span class="r-label">납기</span>
            <div class="r-flow"><span>${U.date(p.dueDate)}</span>${icon('arrowRight', 14)}<strong>${U.date(c.finalDue)}</strong></div>
            <span class="r-hint">승인된 일정 변경 ${U.signedDays(c.extraDays)}</span>
          </div>
          <div class="r-box">
            <span class="r-label">추가 요청</span>
            <div class="r-flow"><strong>${all.length}건</strong></div>
            <span class="r-hint">승인 ${c.approved.length} · 협의 중 ${c.pending.length} · 거절 ${c.rejected.length}</span>
          </div>
        </section>

        <section class="r-sec">
          <h2><span class="r-num">1</span>최초 계약 범위</h2>
          ${p.scope.description ? `<p class="r-desc">${e(p.scope.description)}</p>` : ''}
          ${items}
          <div class="r-facts">
            <span>계약 금액 <strong>${U.money(c.base)}</strong></span>
            <span>작업 기간 <strong>${U.date(p.startDate)} ~ ${U.date(p.dueDate)}</strong></span>
            ${c.revIncluded ? `<span>포함 수정 <strong>${c.revIncluded}회</strong> (사용 ${c.revUsed}회)</span>` : ''}
          </div>
        </section>

        <section class="r-sec">
          <h2><span class="r-num">2</span>추가·변경 요청 기록</h2>
          <div class="r-table-wrap">
            <table class="r-table">
              <thead><tr><th class="c">No</th><th>요청일</th><th>내용</th><th class="r">추가 비용</th><th class="r">납기 영향</th><th class="c">상태</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${pendingNote}
        </section>

        <section class="r-sec">
          <h2><span class="r-num">3</span>최종 정리</h2>
          <div class="r-table-wrap">
            <table class="r-table r-final">
              <thead><tr><th>구분</th><th class="r">금액</th><th class="r">납기</th></tr></thead>
              <tbody>
                <tr><td>최초 계약</td><td class="r">${U.money(c.base)}</td><td class="r">${U.date(p.dueDate)}</td></tr>
                <tr><td>승인된 추가 요청 (${c.approved.length}건)</td><td class="r">${U.signedMoney(c.extra)}</td><td class="r">${U.signedDays(c.extraDays)}</td></tr>
                <tr class="total"><td>최종</td><td class="r">${U.money(c.total)}</td><td class="r">${U.date(c.finalDue)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <footer class="r-sign">
          <p>위 내용을 확인하였습니다.</p>
          <div class="r-sign-grid">
            <div><span>고객</span><span class="line">${e(s.client.name)}</span><span class="muted">(서명)</span></div>
            <div><span>작업자</span><span class="line">${e(s.issuer.business || s.issuer.name)}</span><span class="muted">(서명)</span></div>
          </div>
        </footer>
      </article>`;
  }

  return { snapshot, shareUrl, decode, html };
})();
