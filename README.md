# 땀땀이의 꿈

브라우저에서 바로 돌아가는 3D 게임이에요. 설치나 빌드 없이 `index.html`을 열면 실행돼요.
GitHub Pages를 켜 두면 인터넷 주소로 누구나 플레이할 수 있어요.

## 폴더 구조

| 파일 / 폴더 | 들어 있는 것 |
|---|---|
| `index.html` | 화면 뼈대 (제목, 버튼, 설명 페이지 글자) |
| `css/style.css` | 색·크기·배치 같은 모양 |
| `js/game.js` | 게임이 움직이는 프로그램 (캐릭터, 대화, 진행) |
| `assets/img/` | 설명 페이지에 나오는 사진 6장 (`hero`, `wet`, `dry`, `inside`, `proto`, `main`) |
| `.nojekyll` | 빈 파일. GitHub Pages용이니 지우지 마세요 |

사진을 바꾸고 싶으면 `assets/img/` 안의 같은 이름 파일을 새 사진으로 덮어쓰면 돼요.

## 실행해 보기

- 그냥 `index.html`을 더블클릭해도 돼요.
- 3D 그래픽(Three.js r128)과 글꼴(Jua, Gowun Dodum)은 인터넷에서 불러오기 때문에 인터넷 연결이 필요해요.
