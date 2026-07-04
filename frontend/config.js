/*
RainGuard AI v11 - Config
frontend/config.js
*/

const API_BASE_URL = "https://rainguard-ai.onrender.com";

const DEFAULT_CITY = {
    name: "جدة",
    lat: 21.5433,
    lon: 39.1728
};

const APP_VERSION = "v11.0.0";

const REFRESH_INTERVAL_MINUTES = 10;

const RAIN_ALERT_THRESHOLD = 30;
const HIGH_RISK_THRESHOLD = 70;
const FLOOD_ALERT_THRESHOLD = 30;

window.RAINGUARD_CONFIG = {
    API_BASE_URL,
    DEFAULT_CITY,
    APP_VERSION,
    REFRESH_INTERVAL_MINUTES,
    RAIN_ALERT_THRESHOLD,
    HIGH_RISK_THRESHOLD,
    FLOOD_ALERT_THRESHOLD
};
