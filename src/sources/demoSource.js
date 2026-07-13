/**
 * Demo news source: synthetic Naver-shaped items for offline UI preview.
 */

const DEMO_OUTLET_HOSTS = [
  'yna.co.kr',
  'yonhapnews.co.kr',
  'hani.co.kr',
  'chosun.com',
  'mk.co.kr',
  'khan.co.kr',
  'donga.com',
];

const DEMO_ITEMS_PER_KEYWORD = 12;
const DEMO_MAX_AGE_DAYS = 70;
const MS_PER_DAY = 86_400_000;

export class DemoSource {
  /**
   * @param {string} keyword
   * @returns {Promise<object[]>} raw items (same shape as Naver items)
   */
  async fetch(keyword) {
    const nowMs = Date.now();
    const items = [];

    for (let index = 0; index < DEMO_ITEMS_PER_KEYWORD; index++) {
      const daysAgo = Math.floor(Math.random() * DEMO_MAX_AGE_DAYS);
      const publishedAt = new Date(
        nowMs - daysAgo * MS_PER_DAY - Math.random() * MS_PER_DAY
      );
      const outlet = DEMO_OUTLET_HOSTS[index % DEMO_OUTLET_HOSTS.length];

      items.push({
        title: `[데모] ${keyword} 관련 정책 동향 및 현장 반응 ${index + 1}`,
        link: `https://example.com/news/${encodeURIComponent(keyword)}-${index}`,
        originallink: `https://${outlet}/article/${index}`,
        pubDate: publishedAt.toUTCString(),
        description: `${keyword}에 관한 예시 기사 본문입니다. 실제 데이터가 아니며, 프록시 연결 시 네이버 뉴스 실시간 결과로 대체됩니다.`,
      });
    }

    return items;
  }
}
