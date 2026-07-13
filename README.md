# 네이버 뉴스 키워드 대시보드

키워드별 네이버 뉴스를 **월별·일별**로 정리하고, **업데이트 버튼**으로 실시간 동기화하며, 키워드를 **추가·삭제**할 수 있는 대시보드입니다.

- 대시보드: GitHub Pages (정적 호스팅)
- 실시간 수집: Cloudflare Worker 프록시가 네이버 검색 API를 대신 호출

---

## 왜 프록시가 필요한가

GitHub Pages는 정적 페이지만 호스팅하므로 브라우저가 네이버 API를 직접 부를 수 없습니다. 두 가지 이유입니다.

1. **CORS 차단** — 네이버 API는 브라우저에서의 직접 호출을 허용하지 않습니다.
2. **키 노출 위험** — Client Secret을 페이지 코드에 넣으면 누구나 볼 수 있습니다.

그래서 무료 서버리스인 **Cloudflare Worker**가 키를 안전하게 보관하고 CORS를 우회해 중계합니다. 대시보드는 이 프록시 주소만 알면 됩니다.

```
[GitHub Pages 대시보드]  ──(query=키워드)──▶  [Cloudflare Worker]  ──(키 부착)──▶  [네이버 검색 API]
                          ◀──── 뉴스 JSON ────                      ◀──── 뉴스 JSON ────
```

---

## 설치 순서 (약 15분)

### 1단계 · 네이버 검색 API 키 발급 (무료)

1. [네이버 개발자센터](https://developers.naver.com/apps/#/register) 접속 → 로그인
2. **애플리케이션 등록**
   - 애플리케이션 이름: 자유 (예: `뉴스대시보드`)
   - 사용 API: **검색** 선택
   - 환경 추가: **WEB 설정** → 서비스 URL에 본인 GitHub Pages 주소 입력 (예: `https://myid.github.io`)
3. 등록 후 발급되는 **Client ID** 와 **Client Secret** 을 메모해 둡니다.

> 뉴스 검색 API는 하루 **25,000회**까지 무료입니다.

### 2단계 · Cloudflare Worker 프록시 배포

Cloudflare 계정(무료)이 필요합니다. 터미널에서 이 폴더로 이동한 뒤:

```bash
# Cloudflare 로그인
npx wrangler login

# 네이버 키를 Secret 으로 등록 (입력 시 화면에 보이지 않음)
npx wrangler secret put NAVER_CLIENT_ID
npx wrangler secret put NAVER_CLIENT_SECRET

# 배포
npx wrangler deploy
```

배포가 끝나면 `https://naver-news-proxy.<계정>.workers.dev` 형태의 주소가 출력됩니다. 이 주소를 복사해 둡니다.

정상 동작 확인 — 브라우저 주소창에 아래를 넣어 JSON이 나오면 성공입니다.

```
https://naver-news-proxy.<계정>.workers.dev?query=규제개혁&display=5&sort=date
```

### 3단계 · GitHub Pages에 대시보드 배포

1. GitHub에서 새 저장소 생성 (예: `naver-news-dashboard`)
2. 이 폴더의 **`index.html`** 을 저장소에 업로드 (드래그&드롭 또는 git push)
3. 저장소 → **Settings → Pages** → Source를 `main` 브랜치 / `/ (root)` 로 지정 → Save
4. 잠시 후 `https://myid.github.io/naver-news-dashboard/` 주소로 접속됩니다.

> Worker의 `ALLOW_ORIGIN` 을 위 GitHub Pages 주소로 제한하면 더 안전합니다. (`wrangler.toml` 참고)

### 4단계 · 대시보드에 프록시 연결

1. 대시보드 접속 → 우측 상단 **⚙ 설정**
2. **프록시 URL** 에 2단계에서 받은 Worker 주소 입력 → 저장
3. 키워드를 추가하고 **↻ 업데이트** 클릭 → 네이버 뉴스가 월별·일별로 채워집니다.

---

## 사용법

- **키워드 추가/삭제**: 상단 입력창에서 추가, 칩의 `✕` 로 삭제
- **업데이트**: 등록된 모든 키워드에 대해 최신 뉴스를 수집하고, 기존 데이터에 **누적**(중복 자동 제거)
- **월별 / 일별 전환**: 결과 상단 토글
- **키워드 필터**: 특정 키워드만 골라 보기
- 데이터·설정은 **브라우저(localStorage)** 에 저장됩니다. 다른 PC·브라우저에서는 각각 다시 설정·수집이 필요합니다.

## 파일 구성

| 파일 | 역할 |
|------|------|
| `index.html` | 대시보드 (GitHub Pages에 배포) |
| `worker.js` | 네이버 API 프록시 (Cloudflare Worker에 배포) |
| `wrangler.toml` | Worker 배포 설정 |
| `README.md` | 이 문서 |

## 참고 · 제약

- **프록시 없이도** 프록시 URL을 비워 두면 **데모 모드**로 UI를 미리 볼 수 있습니다(가짜 데이터).
- 네이버 검색 API는 검색 시점 기준 최신순으로 제공되므로, 과거 데이터는 업데이트를 꾸준히 눌러 누적하면 월별 이력이 쌓입니다.
- 완전 자동(사람 개입 없는) 주기적 갱신이 필요하면, 별도로 Cloudflare Worker의 Cron Triggers 또는 GitHub Actions 스케줄을 추가하는 방식으로 확장할 수 있습니다.

## 출처

- 네이버 검색 API(뉴스) 공식 문서: https://api.ncloud-docs.com/docs/naver-api-hub-search-news
- 애플리케이션 등록: https://developers.naver.com/apps/#/register
