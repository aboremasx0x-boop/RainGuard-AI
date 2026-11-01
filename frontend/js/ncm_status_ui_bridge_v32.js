/* RainGuard AI — FORECAST-1J6G39C — NCM backend status UI bridge */
(function () {
  'use strict';
  const VERSION = 'FORECAST-1J6G39C.0';
  const ENDPOINT = 'https://rainguard-ai.onrender.com/api/ncm/status';
  const PERIOD_MS = 60000;
  let last = null;
  let pending = false;
  let timer = null;

  function labelFor(data) {
    if (!data) return 'تعذر التحقق من حالة الربط';
    if (data.status === 'PENDING_API') return 'بانتظار الربط الرسمي';
    if (data.status === 'CONFIGURED_NOT_VERIFIED' || (data.configured && !data.connection_verified))
      return 'تم إعداد الاتصال — بانتظار التحقق';
    if (data.connection_verified === true && data.data_live === true && data.available === true)
      return 'متصل رسميًا';
    if (data.status === 'ERROR' || data.status === 'CONNECTION_ERROR') return 'تعذر الاتصال بأنواء';
    return 'لم يتم التحقق من البيانات الرسمية';
  }

  function updatePanel() {
    const panel = document.getElementById('rainForecastNationalPanel');
    if (!panel) return false;
    const sources = panel.querySelector('.rgf-sources');
    if (!sources) return false;
    const card = Array.from(sources.querySelectorAll('.rgf-source')).find(el =>
      /أنواء|NCM/.test(el.querySelector('b')?.textContent || '')
    );
    if (!card) return false;
    const span = card.querySelector('span');
    if (!span) return false;
    span.textContent = labelFor(last);
    const verified = !!(last?.connection_verified === true && last?.data_live === true && last?.available === true);
    card.classList.toggle('ok', verified);
    card.classList.toggle('wait', !verified);
    card.dataset.ncmStatus = last?.status || 'UNREACHABLE';
    card.dataset.ncmStatusSource = 'backend';
    card.title = 'حالة الربط من خادم RainGuard AI، وليست تحققًا مستقلًا من صحة التنبؤ';
    return true;
  }

  async function refresh() {
    if (pending) return last;
    pending = true;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(ENDPOINT, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('HTTP_' + response.status);
        const result = await response.json();
        if (!result || typeof result.status !== 'string' || !/NCM|Anwaa/i.test(String(result.source || result.provider || '')))
          throw new Error('INVALID_NCM_STATUS');
        last = result;
      } finally { clearTimeout(timeout); }
    } catch (error) {
      last = { status: 'UNREACHABLE', available: false, connection_verified: false, data_live: false };
      console.warn('[NCM Status UI] Backend status unavailable:', error.message);
    } finally {
      pending = false;
      updatePanel();
    }
    return last;
  }

  function start() {
    if (timer) return;
    refresh();
    timer = setInterval(refresh, PERIOD_MS);
  }

  document.addEventListener('DOMContentLoaded', start, { once: true });
  if (document.readyState !== 'loading') start();
  window.addEventListener('rainguard:forecast-fusion-ready', () => queueMicrotask(updatePanel));
  const observer = new MutationObserver(() => {
    const panel = document.getElementById('rainForecastNationalPanel');
    const card = panel?.querySelector('.rgf-sources .rgf-source');
    if (card && card.dataset.ncmStatusSource !== 'backend') updatePanel();
  });
  function observe() { observer.observe(document.body, { childList: true, subtree: true }); }
  if (document.body) observe();
  else document.addEventListener('DOMContentLoaded', observe, { once: true });
  window.RainGuardNCMStatusUIV32 = {
    version: VERSION, refresh, updatePanel,
    getStatus: () => ({ version: VERSION, backend: last, panelUpdated: updatePanel() })
  };
})();
