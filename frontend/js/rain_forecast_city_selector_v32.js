/* =========================================================
   RainGuard AI V32
   FORECAST-1H FIX2 — National City Forecast Selector
   Version: FORECAST-1H.2

   Goals:
   - Auto-start forecast UI without Console.
   - Mount city selector only once per rendered panel.
   - Preserve selected city after UI re-render.
   - Avoid duplicate forecast requests.
   - Keep compatibility with FORECAST-1G.
   ========================================================= */

(function () {
    "use strict";

    const NAME = "RainForecastCitySelectorV32";
    const VERSION = "FORECAST-1H.2";

    const DEFAULT_CITY_NAME = "جدة";

    const SELECTOR_ID =
        "rgForecastCitySelector";

    const SELECT_ID =
        "rgForecastCitySelect";

    const STATUS_ID =
        "rgForecastCityStatus";

    const STYLE_ID =
        "rgForecastCitySelectorStyles";

    /* =====================================================
       CITY DATA
       ===================================================== */

    const CITIES = [
        {
            name: "جدة",
            lat: 21.5433,
            lon: 39.1728,
            region: "مكة المكرمة"
        },
        {
            name: "مكة المكرمة",
            lat: 21.3891,
            lon: 39.8579,
            region: "مكة المكرمة"
        },
        {
            name: "الطائف",
            lat: 21.2703,
            lon: 40.4158,
            region: "مكة المكرمة"
        },

        {
            name: "المدينة المنورة",
            lat: 24.5247,
            lon: 39.5692,
            region: "المدينة المنورة"
        },
        {
            name: "ينبع",
            lat: 24.0895,
            lon: 38.0618,
            region: "المدينة المنورة"
        },

        {
            name: "الرياض",
            lat: 24.7136,
            lon: 46.6753,
            region: "الرياض"
        },
        {
            name: "الخرج",
            lat: 24.1556,
            lon: 47.3120,
            region: "الرياض"
        },

        {
            name: "الدمام",
            lat: 26.4207,
            lon: 50.0888,
            region: "المنطقة الشرقية"
        },
        {
            name: "الخبر",
            lat: 26.2172,
            lon: 50.1971,
            region: "المنطقة الشرقية"
        },
        {
            name: "الأحساء",
            lat: 25.3830,
            lon: 49.5860,
            region: "المنطقة الشرقية"
        },

        {
            name: "أبها",
            lat: 18.2465,
            lon: 42.5117,
            region: "عسير"
        },
        {
            name: "خميس مشيط",
            lat: 18.3064,
            lon: 42.7290,
            region: "عسير"
        },

        {
            name: "الباحة",
            lat: 20.0129,
            lon: 41.4677,
            region: "الباحة"
        },

        {
            name: "جازان",
            lat: 16.8892,
            lon: 42.5511,
            region: "جازان"
        },

        {
            name: "نجران",
            lat: 17.5656,
            lon: 44.2289,
            region: "نجران"
        },

        {
            name: "تبوك",
            lat: 28.3838,
            lon: 36.5550,
            region: "تبوك"
        },

        {
            name: "حائل",
            lat: 27.5114,
            lon: 41.7208,
            region: "حائل"
        },

        {
            name: "بريدة",
            lat: 26.3592,
            lon: 43.9818,
            region: "القصيم"
        },

        {
            name: "سكاكا",
            lat: 29.9697,
            lon: 40.2064,
            region: "الجوف"
        },

        {
            name: "عرعر",
            lat: 30.9753,
            lon: 41.0381,
            region: "الحدود الشمالية"
        }
    ];

    /* =====================================================
       STATE
       ===================================================== */

    let selectedCity = null;

    let initialized = false;
    let initializing = false;

    let selecting = false;

    let lastRequestedCityKey = null;

    let remountTimer = null;

    /* =====================================================
       HELPERS
       ===================================================== */

    function getUI() {
        return (
            window.RainForecastUIV32 ||
            null
        );
    }

    function getBridge() {
        return (
            window.RainForecastCityIntegrationV32 ||
            window.RG32
                ?.RainForecastCityIntegration ||
            null
        );
    }

    function getPanel() {
        return document.getElementById(
            "rainForecastNationalPanel"
        );
    }

    function getSelector() {
        return document.getElementById(
            SELECTOR_ID
        );
    }

    function getSelect() {
        return document.getElementById(
            SELECT_ID
        );
    }

    function getStatusElement() {
        return document.getElementById(
            STATUS_ID
        );
    }

    function cityKey(city) {
        if (!city) return null;

        return [
            city.name,
            Number(city.lat).toFixed(4),
            Number(city.lon).toFixed(4)
        ].join("|");
    }

    function findCityIndex(city) {
        if (!city) return -1;

        return CITIES.findIndex(
            item =>
                item.name === city.name
        );
    }

    function getDefaultCity() {
        return (
            CITIES.find(
                city =>
                    city.name ===
                    DEFAULT_CITY_NAME
            ) ||
            CITIES[0]
        );
    }

    /* =====================================================
       STYLES
       ===================================================== */

    function ensureStyles() {
        if (
            document.getElementById(
                STYLE_ID
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            STYLE_ID;

        style.textContent = `
            .rgf-city-selector {
                direction: rtl;
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;

                margin: 0 0 15px;
                padding: 12px;

                border:
                    1px solid
                    rgba(72,165,255,.28);

                border-radius: 12px;

                background:
                    rgba(255,255,255,.04);
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

                border:
                    1px solid
                    rgba(72,165,255,.45);

                background: #0c2f50;
                color: #fff;

                font-family: inherit;
                font-size: 14px;

                outline: none;
                cursor: pointer;
            }

            .rgf-city-select:focus {
                border-color:
                    rgba(80,190,255,.9);
            }

            .rgf-city-status {
                min-width: 150px;

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

        document.head.appendChild(
            style
        );
    }

    /* =====================================================
       OPTIONS
       ===================================================== */

    function buildOptions() {
        const grouped = {};

        CITIES.forEach(city => {

            if (!grouped[city.region]) {
                grouped[city.region] = [];
            }

            grouped[
                city.region
            ].push(city);

        });

        let html =
            `<option value="">
                اختر المدينة...
            </option>`;

        Object.keys(
            grouped
        ).forEach(region => {

            html +=
                `<optgroup label="${region}">`;

            grouped[
                region
            ].forEach(city => {

                const index =
                    CITIES.indexOf(city);

                html +=
                    `<option value="${index}">
                        ${city.name}
                    </option>`;

            });

            html +=
                `</optgroup>`;

        });

        return html;
    }

    /* =====================================================
       SELECTOR HTML
       ===================================================== */

    function selectorHTML() {
        return `
            <div
                class="rgf-city-selector"
                id="${SELECTOR_ID}"
            >

                <label
                    for="${SELECT_ID}"
                >
                    اختر المدينة:
                </label>

                <select
                    id="${SELECT_ID}"
                    class="rgf-city-select"
                >
                    ${buildOptions()}
                </select>

                <span
                    id="${STATUS_ID}"
                    class="rgf-city-status"
                >
                    اختر مدينة لعرض توقعاتها
                </span>

            </div>
        `;
    }

    /* =====================================================
       STATUS
       ===================================================== */

    function setStatus(
        text,
        loading = false
    ) {

        const status =
            getStatusElement();

        if (!status) return;

        status.textContent =
            text;

        status.classList.toggle(
            "loading",
            loading
        );
    }

    /* =====================================================
       RESTORE SELECTED CITY
       ===================================================== */

    function restoreSelection() {
        if (!selectedCity) {
            return;
        }

        const select =
            getSelect();

        if (!select) {
            return;
        }

        const index =
            findCityIndex(
                selectedCity
            );

        if (index >= 0) {
            select.value =
                String(index);
        }

        setStatus(
            `تم تحديث توقع ${selectedCity.name}`
        );
    }

    /* =====================================================
       MOUNT
       ===================================================== */

    function mount() {
        ensureStyles();

        const panel =
            getPanel();

        if (!panel) {
            return false;
        }

        /*
         * Already mounted in current
         * rendered panel.
         */
        const existing =
            getSelector();

        if (existing) {
            restoreSelection();
            return true;
        }

        panel.insertAdjacentHTML(
            "afterbegin",
            selectorHTML()
        );

        const select =
            getSelect();

        if (!select) {
            return false;
        }

        select.addEventListener(
            "change",
            handleChange
        );

        restoreSelection();

        console.log(
            "[FORECAST-1H.2] City selector mounted."
        );

        return true;
    }

    /* =====================================================
       SAFE REMOUNT
       ===================================================== */

    function scheduleRemount() {

        if (remountTimer) {
            clearTimeout(
                remountTimer
            );
        }

        remountTimer =
            setTimeout(
                () => {

                    remountTimer =
                        null;

                    mount();

                },
                50
            );
    }

    /* =====================================================
       SELECT CITY
       ===================================================== */

    async function selectCity(
        city,
        options = {}
    ) {

        if (!city) {
            return null;
        }

        const force =
            options.force === true;

        const key =
            cityKey(city);

        /*
         * Prevent accidental duplicate
         * user requests.
         */
        if (
            !force &&
            selecting &&
            key ===
                lastRequestedCityKey
        ) {
            return null;
        }

        selectedCity =
            city;

        lastRequestedCityKey =
            key;

        restoreSelection();

        const bridge =
            getBridge();

        if (!bridge?.setCity) {

            setStatus(
                "محرك التوقع غير متاح"
            );

            console.error(
                "[FORECAST-1H.2] " +
                "City integration unavailable."
            );

            return null;
        }

        selecting =
            true;

        setStatus(
            `جاري تحديث توقع ${city.name}...`,
            true
        );

        try {

            const result =
                await bridge.setCity(
                    city
                );

            /*
             * The UI may have replaced
             * panel.innerHTML.
             * Recreate selector safely.
             */
            scheduleRemount();

            if (
                result?.status ===
                "FUSION_READY"
            ) {

                setTimeout(
                    () => {
                        restoreSelection();
                    },
                    100
                );

            } else {

                setTimeout(
                    () => {

                        mount();

                        setStatus(
                            `تعذر استكمال توقع ${city.name}`
                        );

                    },
                    100
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

            scheduleRemount();

            setTimeout(
                () => {

                    setStatus(
                        `خطأ أثناء تحديث ${city.name}`
                    );

                },
                100
            );

            console.error(
                "[FORECAST-1H.2] " +
                "Forecast update failed:",
                error
            );

            return null;

        } finally {

            selecting =
                false;
        }
    }

    /* =====================================================
       CHANGE EVENT
       ===================================================== */

    function handleChange(
        event
    ) {

        const value =
            event.target.value;

        if (
            value === "" ||
            value === null ||
            value === undefined
        ) {
            return;
        }

        const index =
            Number(value);

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= CITIES.length
        ) {
            return;
        }

        const city =
            CITIES[index];

        selectCity(city);
    }

    /* =====================================================
       AUTO INITIALIZATION
       ===================================================== */

    async function initialize() {

        if (
            initialized ||
            initializing
        ) {
            return;
        }

        initializing =
            true;

        try {

            const ui =
                getUI();

            const bridge =
                getBridge();

            if (
                !ui?.showCity ||
                !bridge?.setCity
            ) {

                console.log(
                    "[FORECAST-1H.2] Waiting for forecast engines..."
                );

                return;
            }

            /*
             * Use current active forecast
             * city if one already exists.
             */
            const activeCity =
                window.RG32
                    ?.activeForecastCity;

            const defaultCity =
                activeCity ||
                getDefaultCity();

            selectedCity =
                defaultCity;

            console.log(
                `[FORECAST-1H.2] Initial city: ${defaultCity.name}`
            );

            /*
             * This creates the forecast
             * panel automatically.
             */
            const result =
                await bridge.setCity(
                    defaultCity
                );

            /*
             * Mount after UI render.
             */
            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        100
                    )
            );

            mount();

            restoreSelection();

            initialized =
                result?.status ===
                "FUSION_READY";

            if (initialized) {

                console.log(
                    "[FORECAST-1H.2] Automatic initialization completed."
                );

            } else {

                console.warn(
                    "[FORECAST-1H.2] Initialization completed without FUSION_READY."
                );
            }

        } catch (error) {

            console.error(
                "[FORECAST-1H.2] Initialization failed:",
                error
            );

        } finally {

            initializing =
                false;
        }
    }

    /* =====================================================
       FORECAST UI RE-RENDER
       ===================================================== */

    window.addEventListener(
        "rainguard:forecast-fusion-ready",
        () => {

            /*
             * rain_forecast_ui_v32.js
             * replaces panel.innerHTML.
             * Re-mount selector once.
             */
            scheduleRemount();

        }
    );

    /* =====================================================
       KEEP SELECTOR SYNCHRONIZED WITH
       FORECAST-1G CITY CHANGES
       ===================================================== */

    window.addEventListener(
        "rainguard:forecast-city-updated",
        event => {

            const city =
                event?.detail?.city;

            if (!city) {
                return;
            }

            selectedCity =
                city;

            scheduleRemount();

            setTimeout(
                () => {
                    restoreSelection();
                },
                100
            );
        }
    );

    /* =====================================================
       STARTUP WATCHER
       ===================================================== */

    function start() {

        let attempts =
            0;

        const maxAttempts =
            60;

        const timer =
            setInterval(
                async () => {

                    attempts += 1;

                    const uiReady =
                        !!getUI()
                            ?.showCity;

                    const bridgeReady =
                        !!getBridge()
                            ?.setCity;

                    if (
                        uiReady &&
                        bridgeReady
                    ) {

                        clearInterval(
                            timer
                        );

                        await initialize();

                        return;
                    }

                    if (
                        attempts >=
                        maxAttempts
                    ) {

                        clearInterval(
                            timer
                        );

                        console.error(
                            "[FORECAST-1H.2] Startup timeout."
                        );
                    }

                },
                250
            );
    }

    /* =====================================================
       STATUS
       ===================================================== */

    function getStatus() {

        return {
            engine: NAME,
            version: VERSION,

            ready: true,

            initialized,
            initializing,
            selecting,

            mounted:
                !!getSelector(),

            cityCount:
                CITIES.length,

            selectedCity,

            lastRequestedCityKey
        };
    }

    /* =====================================================
       EXPORT
       ===================================================== */

    window.RG32 =
        window.RG32 || {};

    const api = {
        name: NAME,
        version: VERSION,

        cities: CITIES,

        mount,
        initialize,
        selectCity,

        getStatus
    };

    window.RainForecastCitySelectorV32 =
        api;

    window.RG32.RainForecastCitySelector =
        api;

    console.log(
        `${NAME} ${VERSION} ready — ${CITIES.length} cities.`
    );

    /*
     * Automatic startup.
     */
    start();

})();
