// Supabase 연결 설정
// supabaseUrl과 supabaseAnonKey를 비워 두면 로그인 없이 이 브라우저에만 저장하는 모드로 동작해요.
// anon key는 브라우저에 공개되는 키라서 코드에 넣어도 괜찮아요. (데이터는 RLS 정책으로 본인 것만 접근 가능)
window.SCOPELOG_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  // Supabase 대시보드에서 해당 로그인 방식을 켠 뒤 true로 바꿔 주세요.
  providers: {
    google: false,
    kakao: false,
  },
};
