/** Shared DOM helpers for the dashboard UI. */

const TOAST_VISIBLE_MS = 2200;

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** @param {string} selector */
export function query(selector) {
  return document.querySelector(selector);
}

export function showToast(message) {
  const toastEl = query('#toast');
  toastEl.textContent = message;
  toastEl.classList.add('on');
  setTimeout(() => toastEl.classList.remove('on'), TOAST_VISIBLE_MS);
}

/** Escape text for safe insertion into HTML content. */
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

/** Escape text for use inside HTML attribute values. */
export function escapeAttr(text) {
  return escapeHtml(text);
}

/**
 * Run an async action while a button shows a loading label.
 * Restores the original label even if the action throws.
 * @param {HTMLElement} button
 * @param {string} loadingLabel
 * @param {() => Promise<void>} action
 */
export async function withButtonLoading(button, loadingLabel, action) {
  const originalLabel = button.innerHTML;
  button.disabled = true;
  button.innerHTML = loadingLabel;
  try {
    await action();
  } finally {
    button.disabled = false;
    button.innerHTML = originalLabel;
  }
}
