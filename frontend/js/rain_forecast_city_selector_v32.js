/* =========================================================
   RainGuard AI V32
   FORECAST-1I3 — Full National City Forecast Selector
   Version: FORECAST-1I3.0

   Goals:
   - Use the full national registry from getRainGuardNationalCities().
   - Remove the hardcoded 20-city selector list.
   - Normalize national registry city objects for FORECAST-1G.
   - Group cities by Saudi region.
   - Preserve selected city after UI re-render.
   - Keep Jeddah as the preferred default city.
   - Fall back safely if the national registry is temporarily unavailable.
   ========================================================= */

(function () {
    "use strict";

    const NAME = "RainForecastCitySelectorV32";
    const VERSION = "FORECAST-1I3.0";

    const DEFAULT_CITY_NAME = "جدة";

    const SELECTOR_ID = "rgForecastCitySelector";
    const SELECT_ID = "rgForecastCitySelect";
    const STATUS_ID = "rgForecastCityStatus";
    const STYLE_ID = "rgForecastCitySelectorStyles";

    /* =====================================================
       STATE
       ===================================================== */

    let CITIES = [];

    let selectedCity = null;

    let initialized = false;
    let initializing = false;
    let selecting = false;

    let registryReady = false;
    let registrySource = null;

    let lastRequestedCityKey = null;
    let remountTimer = null;

    /* =====================================================
       HELPERS
       ===================================================== */

    function getUI() {
        return window.RainForecastUIV32 || null;
    }

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

    function finite(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    function cleanText(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value).trim();
    }

    function escapeHTML(value) {
        return cleanText(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function cityKey(city) {
        if (!city) return null;

        return [
            city.id || "",
            city.name || "",
            Number(city.lat).toFixed(5),
            Number(city.lon).toFixed(5)
        ].join("|");
    }

    function sameCity(a, b) {
        if (!a || !b) {
            return false;
        }

        const aLat = finite(
            a.lat ?? a.latitude
        );

        const aLon = finite(
            a.lon ?? a.longitude ?? a.lng
        );

        const bLat = finite(
            b.lat ?? b.latitude
        );

        const bLon = finite(
            b.lon ?? b.longitude ?? b.lng
        );

        if (
            aLat !== null &&
            aLon !== null &&
            bLat !== null &&
            bLon !== null
        ) {
            return (
                Math.abs(aLat - bLat) < 0.00001 &&
                Math.abs(aLon - bLon) < 0.00001
            );
        }

        const aName = cleanText(
            a.nameAr || a.name || a.nameEn
        ).toLowerCase();

        const bName = cleanText(
            b.nameAr || b.name || b.nameEn
        ).toLowerCase();

        return (
            aName.length > 0 &&
            aName === bName
        );
    }

    /* =====================================================
       NATIONAL REGISTRY
       ===================================================== */

    function normalizeNationalCity(
        raw,
        index
    ) {
        if (
            !raw ||
            typeof raw !== "object"
        ) {
            return null;
        }

        const lat = finite(
            raw.latitude ??
            raw.lat ??
            raw.location?.latitude ??
            raw.location?.lat
        );

        const lon = finite(
            raw.longitude ??
            raw.lon ??
            raw.lng ??
            raw.location?.longitude ??
            raw.location?.lon ??
            raw.location?.lng
        );

        if (
            lat === null ||
            lon === null
        ) {
            return null;
        }

        const nameAr = cleanText(
            raw.nameAr ??
            raw.arabicName ??
            raw.name ??
            raw.city ??
            raw.cityName
        );

        const nameEn = cleanText(
            raw.nameEn ??
            raw.englishName ??
            raw.nameEnglish
        );

        const name =
            nameAr ||
            nameEn ||
            `مدينة ${index + 1}`;

        const region = cleanText(
            raw.region ??
            raw.regionName ??
            raw.province ??
            raw.area
        ) || "مدن أخرى";

        const id = cleanText(
            raw.id ??
            raw.code ??
            raw.slug ??
            raw.cityId ??
            raw.locationId
        ) || `${lat}:${lon}`;

        return {
            id,
            name,
            nameAr: nameAr || name,
            nameEn: nameEn || null,
            region,
            lat,
            lon,

            /*
             * Keep both coordinate naming styles
             * for compatibility with other modules.
             */
            latitude: lat,
            longitude: lon,

            sourceRaw: raw
        };
    }

    function normalizeNationalCities(
        items
    ) {
        if (!Array.isArray(items)) {
            return [];
        }

        const result = [];
        const seen = new Set();

        items.forEach(
            (raw, index) => {
                const city =
                    normalizeNationalCity(
                        raw,
                        index
                    );

                if (!city) {
                    return;
                }

                const key = [
                    cleanText(
                        city.id
                    ).toLowerCase(),
                    city.lat.toFixed(5),
                    city.lon.toFixed(5)
                ].join("|");

                if (seen.has(key)) {
                    return;
                }

                seen.add(key);
                result.push(city);
            }
        );

        return result;
    }

    async function loadNationalCities(
        options = {}
    ) {
        const forceRefresh =
            options.forceRefresh === true;

        try {
            if (
                forceRefresh &&
                typeof window
                    .refreshRainGuardNationalCityRegistry ===
                    "function"
            ) {
                await window
                    .refreshRainGuardNationalCityRegistry();
            }

            if (
                typeof window
                    .getRainGuardNationalCities !==
                    "function"
            ) {
                registryReady = false;
                registrySource = null;
                return [];
            }

            const raw =
                window
                    .getRainGuardNationalCities();

            const normalized =
                normalizeNationalCities(
                    raw
                );

            if (
                normalized.length === 0 &&
                !forceRefresh &&
                typeof window
                    .refreshRainGuardNationalCityRegistry ===
                    "function"
            ) {
                await window
                    .refreshRainGuardNationalCityRegistry();

                const refreshed =
                    normalizeNationalCities(
                        window
                            .getRainGuardNationalCities()
                    );

                if (refreshed.length > 0) {
                    CITIES = refreshed;
                } else {
                    CITIES = [];
                }
            } else {
                CITIES = normalized;
            }

            registryReady =
                CITIES.length > 0;

            registrySource =
                window
                    .RainGuardNationalCityRegistryBridgeV39
                    ?.lastSource ||
                null;

            return CITIES;

        } catch (error) {
            registryReady = false;

            console.error(
                "[FORECAST-1I3] " +
                "National city registry load failed:",
                error
            );

            return [];
        }
    }

    function findCityIndex(city) {
        if (!city) return -1;

        return CITIES.findIndex(
            item => sameCity(
                item,
                city
            )
        );
    }

    function getDefaultCity() {
        return (
            CITIES.find(
                city =>
                    city.name ===
                        DEFAULT_CITY_NAME ||
                    city.nameAr ===
                        DEFAULT_CITY_NAME
            ) ||
            CITIES[0] ||
            null
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
        const grouped = new Map();

        CITIES.forEach(
            (city, index) => {
                const region =
                    city.region ||
                    "مدن أخرى";

                if (!grouped.has(region)) {
                    grouped.set(
                        region,
                        []
                    );
                }

                grouped.get(region).push({
                    city,
                    index
                });
            }
        );

        let html =
            `<option value="">
                اختر المدينة...
            </option>`;

        grouped.forEach(
            (items, region) => {
                html +=
                    `<optgroup label="${escapeHTML(region)}">`;

                items.forEach(
                    ({ city, index }) => {
                        html +=
                            `<option value="${index}">
                                ${escapeHTML(city.name)}
                            </option>`;
                    }
                );

                html +=
                    `</optgroup>`;
            }
        );

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
                    ${CITIES.length > 0
                        ? `اختر مدينة من ${CITIES.length} مدينة`
                        : "جاري تحميل سجل المدن الوطني..."}
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
            selectedCity =
                CITIES[index];

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
            `[FORECAST-1I3] City selector mounted — ${CITIES.length} national cities.`
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

        const normalizedIndex =
            findCityIndex(city);

        const forecastCity =
            normalizedIndex >= 0
                ? CITIES[
                    normalizedIndex
                ]
                : normalizeNationalCity(
                    city,
                    0
                );

        if (!forecastCity) {
            return null;
        }

        const key =
            cityKey(
                forecastCity
            );

        if (
            !force &&
            selecting &&
            key ===
                lastRequestedCityKey
        ) {
            return null;
        }

        selectedCity =
            forecastCity;

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
                "[FORECAST-1I3] " +
                "City integration unavailable."
            );

            return null;
        }

        selecting = true;

        setStatus(
            `جاري تحديث توقع ${forecastCity.name}...`,
            true
        );

        try {
            const result =
                await bridge.setCity(
                    forecastCity
                );

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
                            `تعذر استكمال توقع ${forecastCity.name}`
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
                            city:
                                forecastCity,
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
                        `خطأ أثناء تحديث ${forecastCity.name}`
                    );
                },
                100
            );

            console.error(
                "[FORECAST-1I3] " +
                "Forecast update failed:",
                error
            );

            return null;

        } finally {
            selecting = false;
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

        selectCity(
            CITIES[index]
        );
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

        initializing = true;

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
                    "[FORECAST-1I3] Waiting for forecast engines..."
                );

                return;
            }

            await loadNationalCities();

            if (CITIES.length === 0) {
                await loadNationalCities({
                    forceRefresh: true
                });
            }

            if (CITIES.length === 0) {
                console.error(
                    "[FORECAST-1I3] National city registry is empty."
                );

                return;
            }

            const activeCity =
                window.RG32
                    ?.activeForecastCity;

            let defaultCity = null;

            if (activeCity) {
                const activeIndex =
                    findCityIndex(
                        activeCity
                    );

                if (activeIndex >= 0) {
                    defaultCity =
                        CITIES[
                            activeIndex
                        ];
                }
            }

            if (!defaultCity) {
                defaultCity =
                    getDefaultCity();
            }

            if (!defaultCity) {
                console.error(
                    "[FORECAST-1I3] No default city available."
                );

                return;
            }

            selectedCity =
                defaultCity;

            console.log(
                `[FORECAST-1I3] Initial city: ${defaultCity.name}`
            );

            const result =
                await bridge.setCity(
                    defaultCity
                );

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
                    `[FORECAST-1I3] Automatic initialization completed — ${CITIES.length} cities loaded.`
                );
            } else {
                console.warn(
                    "[FORECAST-1I3] Initialization completed without FUSION_READY."
                );
            }

        } catch (error) {
            console.error(
                "[FORECAST-1I3] Initialization failed:",
                error
            );

        } finally {
            initializing = false;
        }
    }

    /* =====================================================
       FORECAST UI RE-RENDER
       ===================================================== */

    window.addEventListener(
        "rainguard:forecast-fusion-ready",
        () => {
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

            const index =
                findCityIndex(city);

            selectedCity =
                index >= 0
                    ? CITIES[index]
                    : city;

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
       NATIONAL REGISTRY REFRESH EVENT
       ===================================================== */

    window.addEventListener(
        "rainguard:national-city-registry-ready",
        async () => {
            await loadNationalCities();

            scheduleRemount();
        }
    );

    /* =====================================================
       STARTUP WATCHER
       ===================================================== */

    function start() {
        let attempts = 0;

        const maxAttempts = 80;

        const timer =
            setInterval(
                async () => {
                    attempts += 1;

                    const uiReady =
                        !!getUI()?.showCity;

                    const bridgeReady =
                        !!getBridge()?.setCity;

                    const registryAPIReady =
                        typeof window
                            .getRainGuardNationalCities ===
                            "function";

                    if (
                        uiReady &&
                        bridgeReady &&
                        registryAPIReady
                    ) {
                        const cities =
                            await loadNationalCities();

                        if (
                            cities.length > 0
                        ) {
                            clearInterval(
                                timer
                            );

                            await initialize();
                            return;
                        }
                    }

                    if (
                        attempts >=
                        maxAttempts
                    ) {
                        clearInterval(
                            timer
                        );

                        console.error(
                            "[FORECAST-1I3] Startup timeout — national registry or forecast engines unavailable."
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

            registryReady,
            registrySource,

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

        get cities() {
            return CITIES.map(
                city => ({
                    ...city
                })
            );
        },

        loadNationalCities,
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
        `${NAME} ${VERSION} ready — waiting for national registry.`
    );

    start();

})();
