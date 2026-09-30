/* =========================================================
   RainGuard AI V32
   VISUALCROSSING-1E — Rain Forecast UI
   Version: FORECAST-1E.2
   ========================================================= */

(function () {
    "use strict";

    const NAME = "RainForecastUIV32";
    const VERSION = "FORECAST-1E.2";
    const HORIZONS = [6, 12, 24, 48, 72];

    function esc(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function sourceLabel(source) {
        const labels = {
            ANWAA_NCM: "أنواء / المركز الوطني للأرصاد",
            OPEN_METEO: "Open-Meteo",
            VISUAL_CROSSING: "Visual Crossing",
            NO_FORECAST_SOURCE: "لا يوجد مصدر"
        };
        return labels[source] || source || "--";
    }

    function sourceState(result) {
        const s = result?.sources || {};
        return `
            <div class="rgf-sources">
                <div class="rgf-source ${s.anwaa?.available ? "ok" : "wait"}">
                    <b>أنواء / NCM</b>
                    <span>${s.anwaa?.available ? "متصل رسميًا" : "بانتظار الربط الرسمي"}</span>
                </div>
                <div class="rgf-source ${s.rainViewer?.available ? "ok" : "off"}">
                    <b>RainViewer</b>
                    <span>${s.rainViewer?.available ? "الرادار متصل" : "غير متاح"}</span>
                </div>
                <div class="rgf-source ${s.openMeteo?.available ? "ok" : "off"}">
                    <b>Open-Meteo</b>
                    <span>${s.openMeteo?.available ? "التوقع متصل" : "غير متاح"}</span>
                </div>
                <div class="rgf-source ${s.visualCrossing?.available ? "ok" : "off"}">
                    <b>Visual Crossing</b>
                    <span>${s.visualCrossing?.available ? "التوقع متصل" : "غير متاح"}</span>
                </div>
            </div>
        `;
    }

    function severityLabel(item) {
        return item?.severity?.labelAr || (item?.totalRainMm > 0 ? "أمطار متوقعة" : "لا أمطار مؤثرة");
    }

    function formatTime(value) {
        if (!value) return "--";
        try {
            const d = new Date(value);
            if (Number.isNaN(d.getTime())) return value;
            return d.toLocaleString("ar-SA", {month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
        } catch (_) { return value; }
    }

    function comparisonLabel(item) {
        const c = item?.numericalComparison;
        if (!c?.available) return "المقارنة غير متاحة";
        if (c.level === "HIGH") return "اتفاق مرتفع";
        if (c.level === "MEDIUM") return "اتفاق متوسط";
        return "اختلاف بين المصدرين";
    }

    function card(item, hours) {
        if (!item) return `<div class="rgf-card unavailable"><h4>${hours} ساعة</h4><strong>لا توجد بيانات</strong></div>`;

        const radarText = item.radarAvailable
            ? (item.radarRainDetected ? "إشارة مطر مرصودة" : "لا توجد إشارة مطر حاليًا")
            : "الرادار غير متاح";

        const om = item.openMeteo;
        const vc = item.visualCrossing;

        return `
            <div class="rgf-card">
                <div class="rgf-card-head">
                    <h4>${hours} ساعة</h4>
                    <span class="rgf-source-tag">${esc(sourceLabel(item.forecastSource))}</span>
                </div>
                <div class="rgf-probability">${Number(item.rainProbability || 0).toFixed(0)}%</div>
                <div class="rgf-caption">احتمال هطول الأمطار</div>

                <div class="rgf-grid">
                    <div><b>${Number(item.totalRainMm || 0).toFixed(1)} مم</b><span>الكمية المتوقعة</span></div>
                    <div><b>${Number(item.peakRainMmH || 0).toFixed(1)} مم/س</b><span>أعلى شدة</span></div>
                    <div><b>${esc(severityLabel(item))}</b><span>التصنيف</span></div>
                    <div><b>${Number(item.sourceAgreement || 0).toFixed(0)}%</b><span>اتفاق/توافر المصادر</span></div>
                </div>

                <div class="rgf-compare">
                    <div><span>Open-Meteo</span><b>${om?.available ? `${Number(om.rainProbability || 0).toFixed(0)}% / ${Number(om.totalRainMm || 0).toFixed(1)} مم` : "--"}</b></div>
                    <div><span>Visual Crossing</span><b>${vc?.available ? `${Number(vc.rainProbability || 0).toFixed(0)}% / ${Number(vc.totalRainMm || 0).toFixed(1)} مم` : "--"}</b></div>
                    <div class="rgf-compare-state"><span>مقارنة المصدرين</span><b>${esc(comparisonLabel(item))}</b></div>
                </div>

                <div class="rgf-times">
                    <div>بداية المطر: <b>${esc(formatTime(item.rainStart))}</b></div>
                    <div>وقت الذروة: <b>${esc(formatTime(item.peakTime))}</b></div>
                    <div>نهاية المطر: <b>${esc(formatTime(item.rainEnd))}</b></div>
                </div>

                <div class="rgf-radar">RainViewer: <b>${radarText}</b></div>
            </div>
        `;
    }

    function ensureStyles() {
        if (document.getElementById("rgForecastUIStyles")) return;
        const style = document.createElement("style");
        style.id = "rgForecastUIStyles";
        style.textContent = `
            #rainForecastNationalPanel{direction:rtl;margin:18px 0;padding:18px;border:1px solid rgba(73,168,255,.35);border-radius:18px;background:rgba(8,38,67,.94);color:#fff;font-family:inherit}
            #rainForecastNationalPanel h2{margin:0 0 6px;font-size:22px}
            .rgf-subtitle{opacity:.75;font-size:13px;margin-bottom:14px}
            .rgf-sources{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
            .rgf-source{padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04)}
            .rgf-source b,.rgf-source span{display:block}
            .rgf-source span{margin-top:4px;font-size:12px;opacity:.8}
            .rgf-source.ok{border-color:rgba(50,220,160,.55)}
            .rgf-source.wait{border-color:rgba(255,190,70,.55)}
            .rgf-cards{display:grid;grid-template-columns:repeat(5,minmax(205px,1fr));gap:10px;overflow-x:auto}
            .rgf-card{min-width:205px;padding:13px;border-radius:14px;border:1px solid rgba(71,161,255,.28);background:rgba(255,255,255,.035)}
            .rgf-card-head{display:flex;justify-content:space-between;gap:8px;align-items:center}
            .rgf-card h4{margin:0;font-size:17px}
            .rgf-source-tag{font-size:10px;opacity:.7}
            .rgf-probability{margin-top:14px;font-size:30px;font-weight:800}
            .rgf-caption{font-size:11px;opacity:.65;margin-bottom:12px}
            .rgf-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
            .rgf-grid div{padding:7px;border-radius:9px;background:rgba(255,255,255,.04)}
            .rgf-grid b,.rgf-grid span{display:block}
            .rgf-grid span{font-size:10px;opacity:.65;margin-top:3px}
            .rgf-compare{margin-top:10px;padding:8px;border-radius:10px;background:rgba(255,255,255,.035);font-size:10px}
            .rgf-compare div{display:flex;justify-content:space-between;gap:8px;padding:3px 0}
            .rgf-compare span{opacity:.65}
            .rgf-compare-state{border-top:1px solid rgba(255,255,255,.08);margin-top:4px;padding-top:6px!important}
            .rgf-times{margin-top:10px;font-size:11px;line-height:1.9;opacity:.85}
            .rgf-radar{margin-top:9px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08);font-size:11px}
            .rgf-footer{margin-top:12px;font-size:11px;opacity:.65}
            @media(max-width:800px){.rgf-sources{grid-template-columns:1fr 1fr}.rgf-cards{grid-template-columns:repeat(5,205px)}}
            @media(max-width:520px){.rgf-sources{grid-template-columns:1fr}}
        `;
        document.head.appendChild(style);
    }

    function ensurePanel() {
        let panel = document.getElementById("rainForecastNationalPanel");
        if (panel) return panel;
        panel = document.createElement("section");
        panel.id = "rainForecastNationalPanel";
        const target = document.getElementById("nationalDataHubPanel") || document.getElementById("databasePanel") || document.querySelector("main") || document.body;
        target.appendChild(panel);
        return panel;
    }

    function render(result) {
        ensureStyles();
        const panel = ensurePanel();
        if (!result) {
            panel.innerHTML = `<h2>توقع الأمطار</h2><div class="rgf-subtitle">لا توجد بيانات توقع متاحة حاليًا.</div>`;
            return;
        }
        const cards = HORIZONS.map(hours => card(result.horizons?.[`${hours}h`], hours)).join("");
        panel.innerHTML = `
            <h2>توقع الأمطار — ${esc(result.city)}</h2>
            <div class="rgf-subtitle">توقع متعدد المصادر: أنواء + RainViewer + Open-Meteo + Visual Crossing</div>
            ${sourceState(result)}
            <div class="rgf-cards">${cards}</div>
            <div class="rgf-footer">
                آخر تحديث: ${esc(formatTime(result.generatedAt))}
                — RainViewer للتحقق الراداري، وOpen-Meteo وVisual Crossing للمقارنة العددية عند عدم توفر الربط الرسمي لأنواء.
                مؤشر اتفاق/توافر المصادر ليس نسبة دقة للتنبؤ.
            </div>
        `;
    }

    async function showCity(city) {
        const fusion = window.RainForecastFusionV32;
        if (!fusion?.forecastCity) throw new Error("FORECAST_FUSION_ENGINE_NOT_AVAILABLE");
        const result = await fusion.forecastCity(city);
        render(result);
        return result;
    }

    window.addEventListener("rainguard:forecast-fusion-ready", event => render(event.detail));

    const api = {name:NAME,version:VERSION,render,showCity};
    window.RainForecastUIV32 = api;
    console.log(`${NAME} ${VERSION} ready.`);
})();
