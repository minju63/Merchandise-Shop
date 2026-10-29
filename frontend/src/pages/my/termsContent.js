// 담당: 연수
// 약관 본문은 아직 서버에서 내려주지 않아 자리표시 문구를 둔다. 확정 본문이 오면 이 파일만 바꾼다.
export const TERMS_DOCS = {
  service: { name: '서비스 이용약관', agreeType: 'SERVICE', required: true },
  privacy: { name: '개인정보 수집 · 이용', agreeType: 'PRIVACY', required: true },
  location: { name: '위치기반서비스 이용약관', agreeType: 'LOCATION', required: false },
  marketing: { name: '마케팅 정보 수신 안내', agreeType: 'MARKETING', required: false },
};

export const TERMS_PLACEHOLDER = [
  { title: '제1조 (목적)', body: '[약관 본문이 여기에 표시돼요.]' },
  { title: '제2조 (정의)', body: '[약관 본문이 여기에 표시돼요.]' },
  { title: '제3조 (약관의 효력 및 변경)', body: '[약관 본문이 여기에 표시돼요.]' },
];
