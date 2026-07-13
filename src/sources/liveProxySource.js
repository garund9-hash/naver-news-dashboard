/**
 * Live news source: Cloudflare Worker proxy → Naver Search API.
 * Contract: GET ?query=&display=&sort=date
 * Optional: X-Nnd-Token when Worker ACCESS_TOKEN is configured.
 */

export class LiveProxySource {
  /**
   * @param {string} proxyBaseUrl - Worker origin; trailing slash is stripped
   * @param {{ accessToken?: string }} options
   */
  constructor(proxyBaseUrl, { accessToken = '' } = {}) {
    this.proxyBaseUrl = proxyBaseUrl.replace(/\/$/, '');
    this.accessToken = accessToken;
  }

  /**
   * @param {string} keyword
   * @param {{ displayCount?: number, sort?: string }} options
   * @returns {Promise<object[]>} raw Naver-style items
   */
  async fetch(keyword, { displayCount = 50, sort = 'date' } = {}) {
    const requestUrl =
      `${this.proxyBaseUrl}?query=${encodeURIComponent(keyword)}` +
      `&display=${displayCount}&sort=${sort}`;

    const headers = {};
    if (this.accessToken) {
      headers['X-Nnd-Token'] = this.accessToken;
    }

    const response = await fetch(requestUrl, { headers });
    if (!response.ok) {
      throw new Error(`Proxy request failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    return payload.items || [];
  }
}
