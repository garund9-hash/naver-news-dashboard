/**
 * Naver News Search API proxy (Cloudflare Worker)
 * -------------------------------------------------
 * Responsibilities:
 *  1) Bypass CORS so a GitHub Pages dashboard can call Naver safely
 *  2) Keep Client ID/Secret on the server (never in browser code)
 *  3) Optional shared secret (ACCESS_TOKEN) so the Worker is not an open proxy
 *
 * Usage: GET https://<worker>.workers.dev?query=keyword&display=50&sort=date
 * Optional header: X-Nnd-Token: <ACCESS_TOKEN>
 *
 * Required secrets:
 *   NAVER_CLIENT_ID, NAVER_CLIENT_SECRET
 * Optional secrets/vars:
 *   ALLOW_ORIGIN   — allowed browser Origin (default "*"; set to your Pages URL)
 *   ACCESS_TOKEN   — if set, requests must send matching X-Nnd-Token
 */

const NAVER_NEWS_SEARCH_URL = 'https://openapi.naver.com/v1/search/news.json';
const MAX_QUERY_LENGTH = 200;

export default {
  async fetch(request, env) {
    const allowOrigin = env.ALLOW_ORIGIN || '*';
    const corsHeaders = buildCorsHeaders(allowOrigin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'GET only' }, 405, corsHeaders);
    }

    // When a concrete Origin is configured, reject browser calls from other sites.
    // Non-browser clients may omit Origin; ACCESS_TOKEN is the real anti-abuse control.
    if (!isOriginAllowed(request, allowOrigin)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, corsHeaders);
    }

    if (env.ACCESS_TOKEN) {
      const provided =
        request.headers.get('X-Nnd-Token') ||
        request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ||
        '';
      if (!secureEquals(provided, env.ACCESS_TOKEN)) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders);
      }
    }

    if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) {
      return jsonResponse(
        {
          error:
            '서버에 NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 환경변수가 설정되지 않았습니다.',
        },
        500,
        corsHeaders
      );
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get('query') || '').trim();
    if (!query) {
      return jsonResponse({ error: 'query 파라미터가 필요합니다.' }, 400, corsHeaders);
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return jsonResponse(
        { error: `query는 ${MAX_QUERY_LENGTH}자 이하여야 합니다.` },
        400,
        corsHeaders
      );
    }

    // Naver limits: display 1–100, start 1–1000, sort sim|date
    const display = clampInt(searchParams.get('display'), 50, 1, 100);
    const start = clampInt(searchParams.get('start'), 1, 1, 1000);
    const sort = searchParams.get('sort') === 'sim' ? 'sim' : 'date';

    const naverUrl =
      `${NAVER_NEWS_SEARCH_URL}` +
      `?query=${encodeURIComponent(query)}` +
      `&display=${display}&start=${start}&sort=${sort}`;

    let upstreamResponse;
    try {
      upstreamResponse = await fetch(naverUrl, {
        headers: {
          'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
        },
      });
    } catch {
      // Do not echo internal exception strings to clients.
      return jsonResponse({ error: '네이버 API 호출 실패' }, 502, corsHeaders);
    }

    const body = await upstreamResponse.text();
    return new Response(body, {
      status: upstreamResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    });
  },
};

/** @internal exported for unit tests */
export function buildCorsHeaders(allowOrigin) {
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    // X-Nnd-Token must be listed for browser preflight when ACCESS_TOKEN is used.
    'Access-Control-Allow-Headers': 'Content-Type, X-Nnd-Token, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** @internal exported for unit tests */
export function isOriginAllowed(request, allowOrigin) {
  if (!allowOrigin || allowOrigin === '*') return true;

  const origin = request.headers.get('Origin');
  if (origin) {
    return origin === allowOrigin;
  }

  // Some navigations send Referer instead of Origin.
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      return new URL(referer).origin === new URL(allowOrigin).origin;
    } catch {
      return false;
    }
  }

  // No Origin/Referer: allow (curl, server-to-server). Rely on ACCESS_TOKEN for abuse control.
  return true;
}

/** Constant-time string compare to reduce trivial timing leaks on tokens. */
export function secureEquals(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function clampInt(rawValue, defaultValue, min, max) {
  const parsed = parseInt(rawValue || String(defaultValue), 10);
  const safe = Number.isNaN(parsed) ? defaultValue : parsed;
  return Math.max(min, Math.min(max, safe));
}

export { MAX_QUERY_LENGTH };

function jsonResponse(payload, status, corsHeaders) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
