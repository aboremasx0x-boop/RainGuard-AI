/* =========================================================
   RainGuard AI V32
   FORECAST-1H — National City Forecast Selector
   ========================================================= */

(function () {
    "use strict";

    const NAME = "RainForecastCitySelectorV32";
    const VERSION = "FORECAST-1H.1";

    /*
     * المرحلة الأولى:
     * مدن رئيسية موزعة على مناطق المملكة.
     * يمكن لاحقًا استبدالها مباشرة بقاعدة مدن RainGuard الكاملة.
     */
    const CITIES = [
        { name: "جدة", lat: 21.5433, lon: 39.1728, region: "مكة المكرمة" },
        { name: "مكة المكرمة", lat: 21.3891, lon: 39.8579, region: "مكة المكرمة" },
        { name: "الطائف", lat: 21.2703, lon: 40.4158, region: "مكة المكرمة" },

        { name: "المدينة المنورة", lat: 24.5247, lon: 39.5692, region: "المدينة المنورة" },
        { name: "ينبع", lat: 24.0895, lon: 38.0618, region: "المدينة المنورة" },

        { name: "الرياض", lat: 24.7136, lon: 46.6753, region: "الرياض" },
        { name: "الخرج", lat: 24.1556, lon: 47.3120, region: "الرياض" },

        { name: "الدمام", lat: 26.4207, lon: 50.0888, region: "المنطقة الشرقية" },
        { name: "الخبر", lat: 26.2172, lon: 50.1971, region: "المنطقة الشرقية" },
        { name: "الأحساء", lat: 25.3830, lon: 49.5860, region: "المنطقة الشرقية" },

        { name: "أبها", lat: 18.2465, lon: 42.5117, region: "عسير" },
        { name: "خميس مشيط", lat: 18.3064, lon: 42.7290, region: "عسير" },

        { name: "الباحة", lat: 20.0129, lon: 41.4677, region: "الباحة" },

        { name: "جازان", lat: 16.8892, lon: 42.5511, region: "جازان" },

        { name: "نجران", lat: 17.5656, lon: 44.2289, region: "نجران" },

        { name: "تبوك", lat: 28.3838, lon: 36.5550, region: "تبوك" },

        { name: "حائل", lat: 27.5114, lon: 41.7208, region: "حائل" },

        { name: "بريدة", lat: 26.3592, lon: 43.9818, region: "القصيم" },

        { name: "سكاكا", lat: 29.9697, lon: 40.2064, region: "الجوف" },

        { name: "عرعر", lat: 30.9753, lon: 41.0381, region: "الحدود الشمالية" }
    ];

    let selectedCity = null;
    let selectorMounted = false;

    function getBridge() {
        return (
            window.RainForecastCityIntegrationV32 ||
            window.RG32?.RainForecastCityIntegration ||
            null
        );
    }

    function getPanel() {
        return document.getElementById(
            "rainForecastNationalPanel"
        );
    }

    function ensureStyles() {
        if (
            document.getElementById(
                "rgForecastCitySelectorStyles"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "rgForecastCitySelectorStyles";

        style.textContent = `
            .rgf-city-selector {
                direction: rtl;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                margin: 0 0 15px;
                padding: 12px;
                border: 1px solid rgba(72,165,255,.28);
                border-radius: 12px;
                background: rgba(255,255,255,.04);
            }

            .rgf-city-selector label {
                font-size: 13px;
                font-weight: 700;
                white-space: nowrap;
            }

            .rgf-city-select {
                flex: 1;
                min-width: 190px;
                padding: 10px 12px;
                border-radius: 9px;
                border: 1px solid rgba(72,165,255,.45);
                background: #0c2f50;
                color: #fff;
                font-family: inherit;
                font-size: 14px;
                outline: none;
                cursor: pointer;
            }

            .rgf-city-select:focus {
                border-color: rgba(80,190,255,.9);
            }

            .rgf-city-status {
                font-size: 11px;
                opacity: .75;
            }

            .rgf-city-status.loading {
                opacity: 1;
            }

            @media (max-width: 650px) {
                .rgf-city-selector {
                    display: block;
                }

                .rgf-city-selector label,
                .rgf-city-select,
                .rgf-city-status {
                    display: block;
                    width: 100%;
                }

                .rgf-city-select {
                    margin-top: 7px;
                }

                .rgf-city-status {
                    margin-top: 7px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function buildOptions() {
        const grouped = {};

        CITIES.forEach(city => {
            if (!grouped[city.region]) {
                grouped[city.region] = [];
            }

            grouped[city.region].push(city);
        });

        let html =
            `<option value="">اختر المدينة...</option>`;

        Object.keys(grouped).forEach(region => {

            html +=
                `<optgroup label="${region}">`;

            grouped[region].forEach(city => {

                const index =
                    CITIES.indexOf(city);

                html +=
                    `<option value="${index}">
                        ${city.name}
                    </option>`;
            });

            html += `</optgroup>`;
        });

        return html;
    }

    function selectorHTML() {
        return `
            <div
                class="rgf-city-selector"
                id="rgForecastCitySelector"
            >
                <label for="rgForecastCitySelect">
                    اختر المدينة:
                </label>

                <select
                    id="rgForecastCitySelect"
                    class="rgf-city-select"
                >
                    ${buildOptions()}
                </select>

                <span
                    id="rgForecastCityStatus"
                    class="rgf-city-status"
                >
                    اختر مدينة لعرض توقعاتها
                </span>
            </div>
        `;
    }

    function setStatus(text, loading = false) {
        const status =
            document.getElementById(
                "rgForecastCityStatus"
            );

        if (!status) return;

        status.textContent = text;

        status.classList.toggle(
            "loading",
            loading
        );
    }

    async function selectCity(city) {
        if (!city) return null;

        const bridge =
            getBridge();

        if (!bridge?.setCity) {
            setStatus(
                "محرك التوقع غير متاح"
            );

            console.error(
                "[FORECAST-1H] City integration unavailable."
            );

            return null;
        }

        selectedCity = city;

        setStatus(
            `جاري تحديث توقع ${city.name}...`,
            true
        );

        try {

            const result =
                await bridge.setCity(city);

            if (
                result?.status ===
                "FUSION_READY"
            ) {
                setStatus(
                    `تم تحديث توقع ${city.name}`
                );
            } else {
                setStatus(
                    `تعذر استكمال توقع ${city.name}`
                );
            }

            window.dispatchEvent(
                new CustomEvent(
                    "rainguard:forecast-selector-changed",
                    {
                        detail: {
                            city,
                            result
                        }
                    }
                )
            );

            return result;

        } catch (error) {

            setStatus(
                `خطأ أثناء تحديث ${city.name}`
            );

            console.error(
                "[FORECAST-1H] Forecast update failed:",
                error
            );

            return null;
        }
    }

    function handleChange(event) {
        const index =
            Number(event.target.value);

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= CITIES.length
        ) {
            return;
        }

        selectCity(
            CITIES[index]
        );
    }

    function mount() {
        ensureStyles();

        const panel =
            getPanel();

        if (!panel) {
            return false;
        }

        if (
            document.getElementById(
                "rgForecastCitySelector"
            )
        ) {
            selectorMounted = true;
            return true;
        }

        panel.insertAdjacentHTML(
            "afterbegin",
            selectorHTML()
        );

        const select =
            document.getElementById(
                "rgForecastCitySelect"
            );

        select?.addEventListener(
            "change",
            handleChange
        );

        selectorMounted = true;

        console.log(
            "[FORECAST-1H] City selector mounted."
        );

        return true;
    }

    /*
     * The forecast panel may be created later by the UI.
     * Watch until it becomes available.
     */
    function startMountWatcher() {
        if (mount()) return;

        const observer =
            new MutationObserver(() => {

                if (mount()) {
                    observer.disconnect();
                }

            });

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );
    }

    /*
     * The UI rewrites panel.innerHTML whenever a new
     * forecast is rendered. Re-mount the selector afterward.
     */
    window.addEventListener(
        "rainguard:forecast-fusion-ready",
        () => {
            setTimeout(
                () => {
                    selectorMounted = false;
                    mount();

                    if (selectedCity) {
                        const select =
                            document.getElementById(
                                "rgForecastCitySelect"
                            );

                        const index =
                            CITIES.findIndex(
                                city =>
                                    city.name ===
                                    selectedCity.name
                            );

                        if (
                            select &&
                            index >= 0
                        ) {
                            select.value =
                                String(index);
                        }

                        setStatus(
                            `تم تحديث توقع ${selectedCity.name}`
                        );
                    }
                },
                0
            );
        }
    );

    function getStatus() {
        return {
            engine: NAME,
            version: VERSION,
            ready: true,
            mounted:
                !!document.getElementById(
                    "rgForecastCitySelector"
                ),
            cityCount:
                CITIES.length,
            selectedCity
        };
    }

    window.RG32 =
        window.RG32 || {};

    const api = {
        name: NAME,
        version: VERSION,
        cities: CITIES,
        mount,
        selectCity,
        getStatus
    };

    window.RainForecastCitySelectorV32 =
        api;

    window.RG32.RainForecastCitySelector =
        api;

    startMountWatcher();

    console.log(
        `${NAME} ${VERSION} ready — ${CITIES.length} cities.`
    );

})();
