window.RG26 = window.RG26 || {};

RG26.EarlyWarningAI = {

    lastWarnings: [],

    analyze(cityData, verification) {

        if (!cityData || !verification) return null;

        const meteo = cityData.verification.openMeteo;

        const warning = {
            city: cityData.city,
            region: cityData.region || cityData.city,
            sourceOfficial: cityData.official.source,
            officialStatus: cityData.official.status,
            confidence: verification.finalConfidence || 80,
            generatedAt: new Date().toLocaleTimeString("ar-SA"),

            windows: {
                h6: this.evaluateWindow("6h", meteo.rainProbability6h, meteo.expectedRain6h),
                h24: this.evaluateWindow("24h", meteo.rainProbability24h, meteo.expectedRain24h),
                h72: this.evaluateWindow("72h", meteo.rainProbability72h, meteo.expectedRain72h)
            }
        };

        warning.overallLevel = this.getOverallLevel(warning.windows);
        warning.recommendedAction = this.getRecommendedAction(warning.overallLevel);

        this.lastWarnings.unshift(warning);

        if (this.lastWarnings.length > 30) {
            this.lastWarnings.pop();
        }

        this.render();

        return warning;
    },

    evaluateWindow(label, probability, expectedRain) {

        probability = Number(probability || 0);
        expectedRain = Number(expectedRain || 0);

        let level = "NORMAL";
        let color = "success";
        let message = "لا يوجد إنذار مهم حاليًا.";

        if (probability >= 85 || expectedRain >= 30) {
            level = "EMERGENCY";
            color = "danger";
            message = "احتمالية أمطار قوية أو خطر سيول مرتفع.";
        } else if (probability >= 70 || expectedRain >= 15) {
            level = "WARNING";
            color = "warning";
            message = "احتمالية أمطار رعدية تستدعي رفع الجاهزية.";
        } else if (probability >= 50 || expectedRain >= 5) {
            level = "WATCH";
            color = "warning";
            message = "احتمالية أمطار متوسطة؛ يوصى بالمراقبة.";
        }

        return {
            label,
            probability,
            expectedRain,
            level,
            color,
            message
        };
    },

    getOverallLevel(windows) {
        const levels = [
            windows.h6.level,
            windows.h24.level,
            windows.h72.level
        ];

        if (levels.includes("EMERGENCY")) return "EMERGENCY";
        if (levels.includes("WARNING")) return "WARNING";
        if (levels.includes("WATCH")) return "WATCH";
        return "NORMAL";
    },

    getRecommendedAction(level) {
        if (level === "EMERGENCY") {
            return "رفع جاهزية الدفاع المدني والبلديات ومراقبة الأودية والطرق فورًا.";
        }

        if (level === "WARNING") {
            return "رفع الجاهزية التشغيلية ومتابعة الرادار والتنبيه المبكر للجهات المعنية.";
        }

        if (level === "WATCH") {
            return "استمرار المراقبة وتحديث التوقعات كل ساعة.";
        }

        return "لا يوجد إجراء ميداني مطلوب حاليًا، مع استمرار المتابعة.";
    },

    render() {

        const panel = document.getElementById("earlyWarningPanel");
        if (!panel) return;

        if (!this.lastWarnings.length) {
            panel.innerHTML = `
                <div class="item">
                    لا توجد إنذارات مبكرة حالياً.
                </div>
            `;
            return;
        }

        panel.innerHTML = this.lastWarnings.slice(0, 10).map(w => {

            const mainClass =
                w.overallLevel === "EMERGENCY" ? "danger" :
                w.overallLevel === "WARNING" ? "warning" :
                w.overallLevel === "WATCH" ? "warning" :
                "success";

            return `
                <div class="item ${mainClass}">
                    <h3>Early Warning — ${w.city}</h3>

                    <b>Overall Level:</b> ${w.overallLevel}<br>
                    <b>Confidence:</b> ${w.confidence}%<br>
                    <b>Official Source:</b> ${w.sourceOfficial}<br>
                    <b>Official Status:</b> ${w.officialStatus}<br><br>

                    <b>0–6 Hours:</b><br>
                    Probability: ${w.windows.h6.probability}% |
                    Expected Rain: ${w.windows.h6.expectedRain} mm<br>
                    Level: ${w.windows.h6.level}<br><br>

                    <b>6–24 Hours:</b><br>
                    Probability: ${w.windows.h24.probability}% |
                    Expected Rain: ${w.windows.h24.expectedRain} mm<br>
                    Level: ${w.windows.h24.level}<br><br>

                    <b>24–72 Hours:</b><br>
                    Probability: ${w.windows.h72.probability}% |
                    Expected Rain: ${w.windows.h72.expectedRain} mm<br>
                    Level: ${w.windows.h72.level}<br><br>

                    <b>Recommended Action:</b><br>
                    ${w.recommendedAction}

                    <br><br>
                    <span class="small">Generated: ${w.generatedAt}</span>
                </div>
            `;
        }).join("");
    }

};
