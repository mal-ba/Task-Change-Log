// Supabase 로그인 + 데이터 동기화
// 설정(js/config.js)이 비어 있으면 enabled=false 로, 앱은 로그인 없이 브라우저 저장 모드로 동작
const Cloud = (() => {
  const cfg = window.SCOPELOG_CONFIG || {};
  const enabled = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);
  const providers = cfg.providers || {};
  const TABLE = 'app_state';

  let client = null;
  let user = null;
  let status = 'idle'; // idle | saving | saved | error | offline
  let timer = null;
  let pending = null;
  const listeners = [];

  if (enabled) {
    client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    });
  }

  function setStatus(s) {
    status = s;
    listeners.forEach((fn) => fn(s));
  }

  function redirectUrl() {
    return location.origin + location.pathname;
  }

  // 로그인 후 주소창에 남는 ?code=... 등을 정리
  function cleanUrl() {
    if (location.search) history.replaceState(null, '', location.pathname + location.hash);
  }

  // Supabase 오류 메시지를 한국어로
  function message(err) {
    const m = String(err?.message || err || '');
    if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 올바르지 않아요.';
    if (/Email not confirmed/i.test(m)) return '이메일 인증이 아직 안 됐어요. 받은 메일함에서 인증 링크를 눌러 주세요.';
    if (/User already registered/i.test(m)) return '이미 가입된 이메일이에요. 로그인해 주세요.';
    if (/Password should be at least/i.test(m)) return '비밀번호는 6자 이상이어야 해요.';
    if (/rate limit|too many/i.test(m)) return '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
    if (/provider is not enabled|Unsupported provider/i.test(m)) return '이 로그인 방식이 아직 설정되지 않았어요.';
    if (/Failed to fetch|NetworkError/i.test(m)) return '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.';
    return m || '알 수 없는 오류가 발생했어요.';
  }

  function onAuth(cb) {
    client.auth.onAuthStateChange((event, session) => {
      user = session?.user || null;
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') cleanUrl();
      // Supabase 콜백 안에서 다른 Supabase 호출을 await 하지 않도록 다음 틱으로 넘김
      setTimeout(() => cb(event, user), 0);
    });
  }

  // ---- 인증 ----
  async function signIn(email, password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(message(error));
  }

  async function signUp(email, password, name) {
    const { data, error } = await client.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl(), data: { name } },
    });
    if (error) throw new Error(message(error));
    // 이메일 인증이 켜져 있으면 session 이 없음
    return { needsConfirm: !data.session };
  }

  async function signInWithProvider(provider) {
    const { error } = await client.auth.signInWithOAuth({ provider, options: { redirectTo: redirectUrl() } });
    if (error) throw new Error(message(error));
  }

  async function resetPassword(email) {
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
    if (error) throw new Error(message(error));
  }

  async function updatePassword(password) {
    const { error } = await client.auth.updateUser({ password });
    if (error) throw new Error(message(error));
  }

  async function signOut() {
    await flush();
    await client.auth.signOut();
    user = null;
  }

  // ---- 데이터 ----
  async function pull() {
    const { data, error } = await client.from(TABLE).select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw new Error(message(error));
    return data; // 없으면 null
  }

  async function push(state) {
    if (!user) return false;
    setStatus('saving');
    const { error } = await client.from(TABLE).upsert({ user_id: user.id, data: state, updated_at: new Date().toISOString() });
    if (error) {
      setStatus(navigator.onLine ? 'error' : 'offline');
      return false;
    }
    setStatus('saved');
    return true;
  }

  // 입력이 몰릴 때 매번 저장하지 않도록 잠깐 모았다가 저장
  function schedulePush(getState, onDone) {
    if (!user) return;
    pending = { getState, onDone };
    setStatus('saving');
    clearTimeout(timer);
    timer = setTimeout(flush, 800);
  }

  async function flush() {
    clearTimeout(timer);
    if (!pending) return;
    const { getState, onDone } = pending;
    pending = null;
    const ok = await push(getState());
    if (onDone) onDone(ok);
  }

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('online', () => { if (pending) flush(); });

  function userName(u = user) {
    const m = u?.user_metadata || {};
    return m.name || m.full_name || m.nickname || m.preferred_username || (u?.email || '').split('@')[0] || '';
  }

  function userProvider(u = user) {
    return u?.app_metadata?.provider || 'email';
  }

  return {
    enabled, providers,
    get user() { return user; },
    get status() { return status; },
    onStatus: (fn) => listeners.push(fn),
    onAuth, signIn, signUp, signInWithProvider, resetPassword, updatePassword, signOut,
    pull, push, schedulePush, flush, userName, userProvider,
  };
})();
