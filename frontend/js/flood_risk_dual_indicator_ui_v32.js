/* RainGuard AI — FORECAST-1J6G38.0 — additive dual indicator display */
(function (global) {
  'use strict';
  const VERSION = 'FORECAST-1J6G38.0';
  const HOURS = [6,12,24,48,72];
  let sequence = 0;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = v => v == null || !Number.isFinite(Number(v)) ? 'غير متاح' : Number(v).toFixed(0) + '/100';
  const label = v => ({LOW:'منخفض',MODERATE:'متوسط',HIGH:'مرتفع',VERY_HIGH:'مرتفع جدًا',UNKNOWN:'غير متاح'})[v] || 'غير متاح';
  function ensurePanel() {
    let el = document.getElementById('rgDualFloodIndicators');
    if (!el) {
      el = document.createElement('section');
      el.id = 'rgDualFloodIndicators';
      el.dir = 'rtl';
      el.style.cssText = 'margin:16px 0;padding:16px;border:1px solid #4383af;border-radius:14px;background:#0c2945;color:white;font-family:inherit;';
      const target = document.getElementById('rainForecastNationalPanel');
      if (target?.parentNode) target.insertAdjacentElement('afterend', el);
      else (document.querySelector('main') || document.body).appendChild(el);
    }
    return el;
  }
  function render(r) {
    const el = ensurePanel();
    const cells = HOURS.map(hours => {
      const h = r?.horizons?.[hours+'h'];
      const ready = h?.status === 'DUAL_INDICATOR_SCREENING_READY';
      return `<article style="border:1px solid #345b7c;border-radius:10px;padding:10px;min-width:155px;flex:1;background:#153653">
        <strong>${hours} ساعة</strong>
        <div style="margin-top:8px">القابلية المكانية: <b>${ready?num(h.spatialSusceptibilityScore):'غير متاح'}</b></div>
        <small>${ready?label(h.spatialSusceptibilityLevel):'بيانات غير كافية'}</small>
        <div style="margin-top:8px">خطر الأمطار المتوقع: <b>${ready?num(h.forecastFloodRiskScore):'غير متاح'}</b></div>
        <small>${ready?label(h.forecastFloodRiskLevel):'بيانات غير كافية'}</small>
        <div style="margin-top:8px;font-size:12px">الأمطار: ${h?.evidence?.totalRainMm == null?'غير متاح':esc(h.evidence.totalRainMm)+' ملم'}</div>
        <div style="font-size:12px">احتمال المطر: ${h?.evidence?.rainProbability == null?'غير متاح':esc(h.evidence.rainProbability)+'%'}</div>
      </article>`;
    }).join('');
    el.innerHTML = `<h3 style="margin:0 0 6px">مؤشرا السيول — ${esc(r?.city || 'المدينة المختارة')}</h3>
      <p style="margin:0 0 12px;font-size:12px">القابلية المكانية مستقلة عن خطر الأمطار المتوقع</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">${cells}</div>
      <p style="font-size:12px;margin:12px 0 0">تقييم أولي غير معاير محليًا، وليس إنذارًا رسميًا. غياب الأمطار عند إحداثيات المدينة لا يستبعد السيول القادمة من المنبع.</p>`;
    return el;
  }
  async function showCity(city) {
    const token = ++sequence;
    const engine = global.FloodRiskDualIndicatorV32;
    if (!engine?.evaluateCity) { ensurePanel().textContent = 'محرك مؤشري السيول غير متاح'; return null; }
    try {
      const result = await engine.evaluateCity(city);
      if (token === sequence) render(result);
      return result;
    } catch (error) {
      if (token === sequence) ensurePanel().textContent = 'تعذر حساب مؤشري السيول: البيانات غير متاحة حاليًا';
      console.warn('[FORECAST-1J6G38] Dual indicators unavailable', error);
      return null;
    }
  }
  global.addEventListener('rainguard:forecast-city-updated', e => {
    const city = e.detail?.city;
    if (city?.lat != null && city?.lon != null) showCity(city);
  });
  global.addEventListener('rainguard:dual-indicator-flood-risk-ready', e => {
    // Render results only for the latest active city, preventing cross-city display.
    const city = global.RG32?.activeForecastCity;
    if (!city || e.detail?.city === city.name) render(e.detail);
  });
  global.RainGuardDualFloodUIV32 = {version:VERSION,render,showCity,getStatus:()=>({version:VERSION,loaded:true})};
})(window);
