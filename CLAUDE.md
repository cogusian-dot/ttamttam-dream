# 땀땀이의 꿈 — 개발 메모 (Claude Code용)

빌드 단계 없는 정적 사이트. GitHub Pages로 배포. README.md는 비개발자용이라 쉬운 말로 유지.

## 구조
- `index.html` → `css/style.css`, CDN Three.js **r128**, Google Fonts(Jua, Gowun Dodum), `js/game.js`
- `js/game.js`: 원본 단일 HTML의 IIFE 스크립트를 그대로 옮김. 맨 위 `IMG` 맵이 `assets/img/*.jpg` 경로를 가리킴 (원래는 base64)
- 원본: 단일 파일 `땀땀이의 꿈.html` (2026-11-22에 동작 변경 없이 분리)

## 검증
- 로컬 서버로 열어 콘솔 에러 확인. 이미지 src는 설명 화면을 열 때 설정됨
