# 타일 공방

접시에서 같은 색 타일을 가져와 패턴 줄을 채우고, 벽에 이어 붙여 점수를 얻는 타일 드래프트 게임입니다. 2~4명, 30분 안팎. 둘이 할 때 상대가 원하는 색을 먼저 가져가는 견제가 가장 치열합니다.

- 접시·가운데에서 색 고르기, 선 플레이어 표식, 패턴 줄, 바닥줄 감점
- 줄을 고르기 전 놓일 자리와 넘치는 장수 미리 보기
- 라운드마다 정산 화면, 끝나면 가로줄 +2 · 세로줄 +7 · 한 색 5장 +10 보너스

## GitHub Pages에 올리기

1. GitHub에서 새 저장소를 만듭니다 (예: `tile-workshop`, Public).
2. 이 폴더 안의 파일을 모두 저장소 맨 위(루트)에 올립니다. 웹에서는 **Add file → Upload files**에 폴더 안 내용을 끌어다 놓으면 됩니다. `.nojekyll`처럼 점으로 시작하는 파일이 안 보이면 터미널로 올리세요:
   ```bash
   git init
   git add .
   git commit -m "타일 공방"
   git branch -M main
   git remote add origin https://github.com/<아이디>/tile-workshop.git
   git push -u origin main
   ```
3. **Settings → Pages**에서 Source를 `Deploy from a branch`, 브랜치 `main`, 폴더 `/ (root)`로 저장합니다.
4. 1~2분 뒤 `https://<아이디>.github.io/tile-workshop/` 에서 열립니다.

아이패드 Safari에서 공유 버튼 → **홈 화면에 추가**를 하면 앱처럼 전체 화면으로 쓸 수 있습니다.

## 알아두면 좋은 점

- 한 화면(아이패드나 브라우저 하나)에서 2~4명이 번갈아 두는 방식입니다.
- 진행 중인 게임은 그 기기의 브라우저에 자동 저장됩니다. 새로고침해도 시작 화면에서 **하던 게임 이어하기**를 누르면 됩니다.
- 외부 라이브러리 없이 HTML·CSS·JavaScript(ES 모듈)만 씁니다. `file://`로 열면 동작하지 않으니, 내 컴퓨터에서 미리 보려면 이 폴더에서 `python3 -m http.server`를 실행하고 `http://localhost:8000`을 여세요.
- 규칙 엔진 테스트: Node 18 이상에서 `npm test` (무작위 대국 수백 판으로 규칙 위반 확인)

## 파일 구성

```
index.html        게임 화면
app.js            화면 그리기와 입력 처리
engine.js         게임 규칙 (화면과 분리)
style.css         이 게임 전용 스타일
assets/base.css   글꼴·버튼·모달 공통 스타일
assets/ui.js      시작 화면, 모달, 저장 도우미
tests/            규칙 엔진 자동 테스트
.nojekyll         GitHub Pages가 파일을 그대로 내보내도록 하는 설정
```

게임 규칙(메커니즘)은 잘 알려진 보드게임에서 영감을 받았고, 이름·그림·구성 요소는 이 프로젝트를 위해 새로 만들었습니다.
