/**
 * Factory: choose Live vs Demo source from settings.
 */

import { LiveProxySource } from './liveProxySource.js';
import { DemoSource } from './demoSource.js';

/**
 * @param {{ proxyUrl?: string, accessToken?: string }} config
 * @returns {LiveProxySource | DemoSource}
 */
export function createNewsSource(config = {}) {
  const proxyUrl = (config.proxyUrl || '').trim();
  if (proxyUrl) {
    return new LiveProxySource(proxyUrl, {
      accessToken: config.accessToken || '',
    });
  }
  return new DemoSource();
}
