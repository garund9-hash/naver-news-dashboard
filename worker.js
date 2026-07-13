/**
 * 네이버 뉴스 검색 API 프록시 (Cloudflare Worker)
 * -------------------------------------------------
 * 역할:
 *  1) 브라우저(GitHub Pages)의 CORS 제한을 우회
 *  2) 네이버 Client ID/Secret 을 코드에 노출하지 않고 서버 측에 안전 보관
 *
 * 사용법:  GET https://<worker>.workers.dev?query=키워드&display=50&sort=date
 *
 * 필요한 환경변수(Secret):
 *   NAVER_CLIENT_ID      - 네이버 개발자센터 애플리케이션 Client ID
 *   NAVER_CLIENT_SECRET  - 네이버 개발자센터 애플리케이션 Client Secret
 * 선택 환경변수:
 *   ALLOW_ORIGIN         - 허용할 출처(예: https://myid.github.io). 미설정 시 "*"
 */

export default {
  async fetch(request, env) {
    const allowOrigin = env.ALLOW_ORIGIN || "*";
    const cors = {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "GET") {
      return json({ error: "GET only" }, 405, cors);
    }

    if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) {
      return json({ error: "서버에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다." }, 500, cors);
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("query") || "").trim();
    if (!query) return json({ error: "query 파라미터가 필요합니다." }, 400, cors);

    // 파라미터 정규화 (네이버 API 한도: display 1~100, start 1~1000, sort sim|date)
    const display = clamp(parseInt(searchParams.get("display") || "50", 10), 1, 100);
    const start = clamp(parseInt(searchParams.get("start") || "1", 10), 1, 1000);
    const sort = searchParams.get("sort") === "sim" ? "sim" : "date";

    const api = `https://openapi.naver.com/v1/search/news.json`
      + `?query=${encodeURIComponent(query)}&display=${display}&start=${start}&sort=${sort}`;

    let upstream;
    try {
      upstream = await fetch(api, {
        headers: {
          "X-Naver-Client-Id": env.NAVER_CLIENT_ID,
          "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
        },
      });
    } catch (e) {
      return json({ error: "네이버 API 호출 실패", detail: String(e) }, 502, cors);
    }

    const body = await upstream.text();
    // 네이버 응답(JSON)을 그대로 CORS 헤더만 붙여 전달
    return new Response(body, {
      status: upstream.status,
      headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
    });
  },
};

function clamp(n, lo, hi) { n = isNaN(n) ? lo : n; return Math.max(lo, Math.min(hi, n)); }
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
