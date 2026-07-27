/* ==========================================================================
   RainGuard AI V32
   Saudi Regions and Cities Registry

   Purpose:
   - Register Saudi regions and major cities
   - Attach every city to its parent region
   - Register locations inside Recovery Core
   - Prepare locations for 6 / 12 / 24 / 48 / 72 hour forecasts
   ========================================================================== */

(function initializeSaudiLocationsRegistryV32(global) {
    "use strict";

    const VERSION =
        "32.1.0";

    const BUILD =
        "V32";

    const MODULE_NAME =
        "SaudiLocationsRegistryV32";

    /* ======================================================================
       SECTION 1
       BASIC UTILITIES
       ====================================================================== */

    function now() {
        return Date.now();
    }

    function safeArray(value) {
        return Array.isArray(value)
            ? value
            : [];
    }

    function safeObject(value) {
        return (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        )
            ? value
            : {};
    }

    function normalizeText(value) {
        return String(
            value ??
            ""
        )
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "_")
            .replace(/[^\u0600-\u06FFa-z0-9_]/g, "");
    }

    function createLocationId(
        regionId,
        cityNameEn
    ) {
        return (
            "sa_" +
            normalizeText(
                regionId
            ) +
            "_" +
            normalizeText(
                cityNameEn
            )
        );
    }

    /* ======================================================================
       SECTION 2
       SAUDI REGIONS AND CITIES
       ====================================================================== */

    const SAUDI_REGIONS =
        Object.freeze([
            {
                id:
                    "riyadh",

                nameAr:
                    "منطقة الرياض",

                nameEn:
                    "Riyadh Region",

                cities: [
                    {
                        nameAr:
                            "الرياض",

                        nameEn:
                            "Riyadh",

                        latitude:
                            24.7136,

                        longitude:
                            46.6753
                    },
                    {
                        nameAr:
                            "الخرج",

                        nameEn:
                            "Al Kharj",

                        latitude:
                            24.1556,

                        longitude:
                            47.3120
                    },
                    {
                        nameAr:
                            "الدرعية",

                        nameEn:
                            "Diriyah",

                        latitude:
                            24.7346,

                        longitude:
                            46.5756
                    },
                    {
                        nameAr:
                            "الدوادمي",

                        nameEn:
                            "Dawadmi",

                        latitude:
                            24.5077,

                        longitude:
                            44.3924
                    },
                    {
                        nameAr:
                            "المجمعة",

                        nameEn:
                            "Al Majmaah",

                        latitude:
                            25.9030,

                        longitude:
                            45.3453
                    },
                    {
                        nameAr:
                            "الزلفي",

                        nameEn:
                            "Az Zulfi",

                        latitude:
                            26.2995,

                        longitude:
                            44.8154
                    },
                    {
                        nameAr:
                            "شقراء",

                        nameEn:
                            "Shaqra",

                        latitude:
                            25.2442,

                        longitude:
                            45.2524
                    },
                    {
                        nameAr:
                            "عفيف",

                        nameEn:
                            "Afif",

                        latitude:
                            23.9065,

                        longitude:
                            42.9172
                    },
                    {
                        nameAr:
                            "وادي الدواسر",

                        nameEn:
                            "Wadi Ad Dawasir",

                        latitude:
                            20.4607,

                        longitude:
                            45.5741
                    },
                    {
                        nameAr:
                            "القويعية",

                        nameEn:
                            "Al Quwayiyah",

                        latitude:
                            24.0464,

                        longitude:
                            45.2654
                    }
                ]
            },

            {
                id:
                    "makkah",

                nameAr:
                    "منطقة مكة المكرمة",

                nameEn:
                    "Makkah Region",

                cities: [
                    {
                        nameAr:
                            "مكة المكرمة",

                        nameEn:
                            "Makkah",

                        latitude:
                            21.3891,

                        longitude:
                            39.8579
                    },
                    {
                        nameAr:
                            "جدة",

                        nameEn:
                            "Jeddah",

                        latitude:
                            21.5433,

                        longitude:
                            39.1728
                    },
                    {
                        nameAr:
                            "الطائف",

                        nameEn:
                            "Taif",

                        latitude:
                            21.2854,

                        longitude:
                            40.4167
                    },
                    {
                        nameAr:
                            "رابغ",

                        nameEn:
                            "Rabigh",

                        latitude:
                            22.7986,

                        longitude:
                            39.0349
                    },
                    {
                        nameAr:
                            "خليص",

                        nameEn:
                            "Khulais",

                        latitude:
                            22.1539,

                        longitude:
                            39.3390
                    },
                    {
                        nameAr:
                            "الجموم",

                        nameEn:
                            "Al Jumum",

                        latitude:
                            21.6169,

                        longitude:
                            39.6968
                    },
                    {
                        nameAr:
                            "الكامل",

                        nameEn:
                            "Al Kamil",

                        latitude:
                            22.2707,

                        longitude:
                            39.7857
                    },
                    {
                        nameAr:
                            "الليث",

                        nameEn:
                            "Al Lith",

                        latitude:
                            20.1520,

                        longitude:
                            40.2699
                    },
                    {
                        nameAr:
                            "القنفذة",

                        nameEn:
                            "Al Qunfudhah",

                        latitude:
                            19.1264,

                        longitude:
                            41.0782
                    },
                    {
                        nameAr:
                            "تربة",

                        nameEn:
                            "Turabah",

                        latitude:
                            21.2141,

                        longitude:
                            41.6337
                    },
                    {
                        nameAr:
                            "رنية",

                        nameEn:
                            "Ranyah",

                        latitude:
                            21.2646,

                        longitude:
                            42.8540
                    },
                    {
                        nameAr:
                            "الخرمة",

                        nameEn:
                            "Al Khurmah",

                        latitude:
                            21.9167,

                        longitude:
                            42.0167
                    }
                ]
            },

            {
                id:
                    "madinah",

                nameAr:
                    "منطقة المدينة المنورة",

                nameEn:
                    "Madinah Region",

                cities: [
                    {
                        nameAr:
                            "المدينة المنورة",

                        nameEn:
                            "Madinah",

                        latitude:
                            24.5247,

                        longitude:
                            39.5692
                    },
                    {
                        nameAr:
                            "ينبع",

                        nameEn:
                            "Yanbu",

                        latitude:
                            24.0895,

                        longitude:
                            38.0618
                    },
                    {
                        nameAr:
                            "العلا",

                        nameEn:
                            "AlUla",

                        latitude:
                            26.6085,

                        longitude:
                            37.9232
                    },
                    {
                        nameAr:
                            "بدر",

                        nameEn:
                            "Badr",

                        latitude:
                            23.7829,

                        longitude:
                            38.7905
                    },
                    {
                        nameAr:
                            "خيبر",

                        nameEn:
                            "Khaybar",

                        latitude:
                            25.6943,

                        longitude:
                            39.2928
                    },
                    {
                        nameAr:
                            "المهد",

                        nameEn:
                            "Mahd Ad Dhahab",

                        latitude:
                            23.4997,

                        longitude:
                            40.8676
                    }
                ]
            },

            {
                id:
                    "qassim",

                nameAr:
                    "منطقة القصيم",

                nameEn:
                    "Al Qassim Region",

                cities: [
                    {
                        nameAr:
                            "بريدة",

                        nameEn:
                            "Buraydah",

                        latitude:
                            26.3592,

                        longitude:
                            43.9818
                    },
                    {
                        nameAr:
                            "عنيزة",

                        nameEn:
                            "Unaizah",

                        latitude:
                            26.0843,

                        longitude:
                            43.9936
                    },
                    {
                        nameAr:
                            "الرس",

                        nameEn:
                            "Ar Rass",

                        latitude:
                            25.8694,

                        longitude:
                            43.4973
                    },
                    {
                        nameAr:
                            "البكيرية",

                        nameEn:
                            "Al Bukayriyah",

                        latitude:
                            26.1442,

                        longitude:
                            43.6578
                    },
                    {
                        nameAr:
                            "المذنب",

                        nameEn:
                            "Al Mithnab",

                        latitude:
                            25.8601,

                        longitude:
                            44.2223
                    }
                ]
            },

            {
                id:
                    "eastern",

                nameAr:
                    "المنطقة الشرقية",

                nameEn:
                    "Eastern Province",

                cities: [
                    {
                        nameAr:
                            "الدمام",

                        nameEn:
                            "Dammam",

                        latitude:
                            26.4207,

                        longitude:
                            50.0888
                    },
                    {
                        nameAr:
                            "الخبر",

                        nameEn:
                            "Khobar",

                        latitude:
                            26.2172,

                        longitude:
                            50.1971
                    },
                    {
                        nameAr:
                            "الظهران",

                        nameEn:
                            "Dhahran",

                        latitude:
                            26.2361,

                        longitude:
                            50.0393
                    },
                    {
                        nameAr:
                            "الأحساء",

                        nameEn:
                            "Al Ahsa",

                        latitude:
                            25.3830,

                        longitude:
                            49.5860
                    },
                    {
                        nameAr:
                            "الجبيل",

                        nameEn:
                            "Jubail",

                        latitude:
                            27.0174,

                        longitude:
                            49.6225
                    },
                    {
                        nameAr:
                            "القطيف",

                        nameEn:
                            "Qatif",

                        latitude:
                            26.5652,

                        longitude:
                            50.0089
                    },
                    {
                        nameAr:
                            "حفر الباطن",

                        nameEn:
                            "Hafar Al Batin",

                        latitude:
                            28.4328,

                        longitude:
                            45.9708
                    },
                    {
                        nameAr:
                            "الخفجي",

                        nameEn:
                            "Khafji",

                        latitude:
                            28.4391,

                        longitude:
                            48.4913
                    },
                    {
                        nameAr:
                            "رأس تنورة",

                        nameEn:
                            "Ras Tanura",

                        latitude:
                            26.6439,

                        longitude:
                            50.1590
                    }
                ]
            },

            {
                id:
                    "asir",

                nameAr:
                    "منطقة عسير",

                nameEn:
                    "Asir Region",

                cities: [
                    {
                        nameAr:
                            "أبها",

                        nameEn:
                            "Abha",

                        latitude:
                            18.2164,

                        longitude:
                            42.5053
                    },
                    {
                        nameAr:
                            "خميس مشيط",

                        nameEn:
                            "Khamis Mushait",

                        latitude:
                            18.3064,

                        longitude:
                            42.7292
                    },
                    {
                        nameAr:
                            "بيشة",

                        nameEn:
                            "Bisha",

                        latitude:
                            19.9947,

                        longitude:
                            42.6052
                    },
                    {
                        nameAr:
                            "محايل عسير",

                        nameEn:
                            "Muhayil Asir",

                        latitude:
                            18.5470,

                        longitude:
                            42.0493
                    },
                    {
                        nameAr:
                            "النماص",

                        nameEn:
                            "Al Namas",

                        latitude:
                            19.1213,

                        longitude:
                            42.1358
                    },
                    {
                        nameAr:
                            "تنومة",

                        nameEn:
                            "Tanomah",

                        latitude:
                            18.9209,

                        longitude:
                            42.1947
                    },
                    {
                        nameAr:
                            "ظهران الجنوب",

                        nameEn:
                            "Dhahran Al Janub",

                        latitude:
                            17.6684,

                        longitude:
                            43.5027
                    },
                    {
                        nameAr:
                            "رجال ألمع",

                        nameEn:
                            "Rijal Almaa",

                        latitude:
                            18.2120,

                        longitude:
                            42.2745
                    }
                ]
            },

            {
                id:
                    "tabuk",

                nameAr:
                    "منطقة تبوك",

                nameEn:
                    "Tabuk Region",

                cities: [
                    {
                        nameAr:
                            "تبوك",

                        nameEn:
                            "Tabuk",

                        latitude:
                            28.3838,

                        longitude:
                            36.5662
                    },
                    {
                        nameAr:
                            "ضباء",

                        nameEn:
                            "Duba",

                        latitude:
                            27.3513,

                        longitude:
                            35.6901
                    },
                    {
                        nameAr:
                            "الوجه",

                        nameEn:
                            "Al Wajh",

                        latitude:
                            26.2455,

                        longitude:
                            36.4525
                    },
                    {
                        nameAr:
                            "أملج",

                        nameEn:
                            "Umluj",

                        latitude:
                            25.0213,

                        longitude:
                            37.2685
                    },
                    {
                        nameAr:
                            "تيماء",

                        nameEn:
                            "Tayma",

                        latitude:
                            27.6176,

                        longitude:
                            38.5350
                    },
                    {
                        nameAr:
                            "حقل",

                        nameEn:
                            "Haql",

                        latitude:
                            29.2833,

                        longitude:
                            34.9333
                    }
                ]
            },

            {
                id:
                    "hail",

                nameAr:
                    "منطقة حائل",

                nameEn:
                    "Hail Region",

                cities: [
                    {
                        nameAr:
                            "حائل",

                        nameEn:
                            "Hail",

                        latitude:
                            27.5114,

                        longitude:
                            41.7208
                    },
                    {
                        nameAr:
                            "بقعاء",

                        nameEn:
                            "Baqaa",

                        latitude:
                            27.8891,

                        longitude:
                            42.4030
                    },
                    {
                        nameAr:
                            "الغزالة",

                        nameEn:
                            "Al Ghazalah",

                        latitude:
                            26.7897,

                        longitude:
                            41.6999
                    },
                    {
                        nameAr:
                            "الشنان",

                        nameEn:
                            "Ash Shinan",

                        latitude:
                            27.1783,

                        longitude:
                            42.4365
                    }
                ]
            },

            {
                id:
                    "northern_borders",

                nameAr:
                    "منطقة الحدود الشمالية",

                nameEn:
                    "Northern Borders Region",

                cities: [
                    {
                        nameAr:
                            "عرعر",

                        nameEn:
                            "Arar",

                        latitude:
                            30.9753,

                        longitude:
                            41.0381
                    },
                    {
                        nameAr:
                            "رفحاء",

                        nameEn:
                            "Rafha",

                        latitude:
                            29.6200,

                        longitude:
                            43.4900
                    },
                    {
                        nameAr:
                            "طريف",

                        nameEn:
                            "Turaif",

                        latitude:
                            31.6725,

                        longitude:
                            38.6637
                    },
                    {
                        nameAr:
                            "العويقيلة",

                        nameEn:
                            "Al Uwayqilah",

                        latitude:
                            30.3317,

                        longitude:
                            42.2417
                    }
                ]
            },

            {
                id:
                    "jazan",

                nameAr:
                    "منطقة جازان",

                nameEn:
                    "Jazan Region",

                cities: [
                    {
                        nameAr:
                            "جازان",

                        nameEn:
                            "Jazan",

                        latitude:
                            16.8892,

                        longitude:
                            42.5511
                    },
                    {
                        nameAr:
                            "صبيا",

                        nameEn:
                            "Sabya",

                        latitude:
                            17.1495,

                        longitude:
                            42.6254
                    },
                    {
                        nameAr:
                            "أبو عريش",

                        nameEn:
                            "Abu Arish",

                        latitude:
                            16.9689,

                        longitude:
                            42.8325
                    },
                    {
                        nameAr:
                            "صامطة",

                        nameEn:
                            "Samtah",

                        latitude:
                            16.5960,

                        longitude:
                            42.9444
                    },
                    {
                        nameAr:
                            "بيش",

                        nameEn:
                            "Baysh",

                        latitude:
                            17.3880,

                        longitude:
                            42.5245
                    },
                    {
                        nameAr:
                            "الدرب",

                        nameEn:
                            "Ad Darb",

                        latitude:
                            17.7229,

                        longitude:
                            42.2526
                    },
                    {
                        nameAr:
                            "فيفاء",

                        nameEn:
                            "Fayfa",

                        latitude:
                            17.2500,

                        longitude:
                            43.1000
                    },
                    {
                        nameAr:
                            "فرسان",

                        nameEn:
                            "Farasan",

                        latitude:
                            16.7022,

                        longitude:
                            42.1183
                    }
                ]
            },

            {
                id:
                    "najran",

                nameAr:
                    "منطقة نجران",

                nameEn:
                    "Najran Region",

                cities: [
                    {
                        nameAr:
                            "نجران",

                        nameEn:
                            "Najran",

                        latitude:
                            17.5656,

                        longitude:
                            44.2289
                    },
                    {
                        nameAr:
                            "شرورة",

                        nameEn:
                            "Sharurah",

                        latitude:
                            17.4672,

                        longitude:
                            47.1214
                    },
                    {
                        nameAr:
                            "حبونا",

                        nameEn:
                            "Hubuna",

                        latitude:
                            17.8453,

                        longitude:
                            44.0253
                    },
                    {
                        nameAr:
                            "يدمة",

                        nameEn:
                            "Yadamah",

                        latitude:
                            18.2858,

                        longitude:
                            44.3727
                    },
                    {
                        nameAr:
                            "بدر الجنوب",

                        nameEn:
                            "Badr Al Janub",

                        latitude:
                            17.8822,

                        longitude:
                            43.7183
                    }
                ]
            },

            {
                id:
                    "baha",

                nameAr:
                    "منطقة الباحة",

                nameEn:
                    "Al Baha Region",

                cities: [
                    {
                        nameAr:
                            "الباحة",

                        nameEn:
                            "Al Baha",

                        latitude:
                            20.0129,

                        longitude:
                            41.4677
                    },
                    {
                        nameAr:
                            "بلجرشي",

                        nameEn:
                            "Baljurashi",

                        latitude:
                            19.8590,

                        longitude:
                            41.5570
                    },
                    {
                        nameAr:
                            "المندق",

                        nameEn:
                            "Al Mandaq",

                        latitude:
                            20.1683,

                        longitude:
                            41.2858
                    },
                    {
                        nameAr:
                            "العقيق",

                        nameEn:
                            "Al Aqiq",

                        latitude:
                            20.2693,

                        longitude:
                            41.6642
                    },
                    {
                        nameAr:
                            "المخواة",

                        nameEn:
                            "Al Mikhwah",

                        latitude:
                            19.7794,

                        longitude:
                            41.4375
                    },
                    {
                        nameAr:
                            "قلوة",

                        nameEn:
                            "Qilwah",

                        latitude:
                            19.7522,

                        longitude:
                            41.4289
                    }
                ]
            },

            {
                id:
                    "jouf",

                nameAr:
                    "منطقة الجوف",

                nameEn:
                    "Al Jouf Region",

                cities: [
                    {
                        nameAr:
                            "سكاكا",

                        nameEn:
                            "Sakaka",

                        latitude:
                            29.9697,

                        longitude:
                            40.2064
                    },
                    {
                        nameAr:
                            "القريات",

                        nameEn:
                            "Al Qurayyat",

                        latitude:
                            31.3318,

                        longitude:
                            37.3428
                    },
                    {
                        nameAr:
                            "دومة الجندل",

                        nameEn:
                            "Dumat Al Jandal",

                        latitude:
                            29.8153,

                        longitude:
                            39.8671
                    },
                    {
                        nameAr:
                            "طبرجل",

                        nameEn:
                            "Tabarjal",

                        latitude:
                            30.4999,

                        longitude:
                            38.2160
                    }
                ]
            }
        ]);

    /* ======================================================================
       SECTION 3
       REGISTRY CLASS
       ====================================================================== */

    class SaudiLocationsRegistryV32 {

        constructor(
            options = {}
        ) {
            this.id =
                "saudi_locations_registry_v32_" +
                now();

            this.version =
                VERSION;

            this.build =
                BUILD;

            this.moduleName =
                MODULE_NAME;

            this.options = {
                autoRegister:
                    options.autoRegister !==
                    false,

                activateLocations:
                    options.activateLocations !==
                    false,

                retryIntervalMs:
                    Number.isFinite(
                        Number(
                            options.retryIntervalMs
                        )
                    )
                        ? Number(
                            options.retryIntervalMs
                        )
                        : 1000,

                maxRetries:
                    Number.isFinite(
                        Number(
                            options.maxRetries
                        )
                    )
                        ? Number(
                            options.maxRetries
                        )
                        : 30
            };

            this.state = {
                initialized:
                    false,

                registered:
                    false,

                registrationAttempts:
                    0,

                regionCount:
                    0,

                cityCount:
                    0,

                registeredCount:
                    0,

                skippedCount:
                    0,

                failedCount:
                    0,

                lastRegisteredAt:
                    null,

                lastError:
                    null,

                errors:
                    []
            };

            this.regions =
                SAUDI_REGIONS;
        }

        /* ==================================================================
           SECTION 4
           CORE RESOLUTION
           ================================================================== */

        resolveCore() {
            return (
                global
                    .RainArrivalRecoveryCoreV32Instance ||
                global
                    .LongHorizonRecoveryCoreV32Instance ||
                global
                    .RecoveryReopeningV32Instance
                    ?.core ||
                null
            );
        }

        /* ==================================================================
           SECTION 5
           LOCATION OBJECT
           ================================================================== */

        createLocationRecord(
            region,
            city
        ) {
            return {
                id:
                    createLocationId(
                        region.id,
                        city.nameEn
                    ),

                name:
                    city.nameEn,

                nameEn:
                    city.nameEn,

                nameAr:
                    city.nameAr,

                city:
                    city.nameEn,

                cityName:
                    city.nameEn,

                cityNameAr:
                    city.nameAr,

                regionId:
                    region.id,

                region:
                    region.nameEn,

                regionName:
                    region.nameEn,

                regionNameAr:
                    region.nameAr,

                latitude:
                    city.latitude,

                longitude:
                    city.longitude,

                lat:
                    city.latitude,

                lon:
                    city.longitude,

                coordinates: {
                    latitude:
                        city.latitude,

                    longitude:
                        city.longitude
                },

                country:
                    "Saudi Arabia",

                countryCode:
                    "SA",

                enabled:
                    true,

                active:
                    this.options
                        .activateLocations,

                metadata: {
                    registry:
                        MODULE_NAME,

                    version:
                        VERSION,

                    parentRegion:
                        region.id,

                    registeredAt:
                        now()
                }
            };
        }

        /* ==================================================================
           SECTION 6
           CHECK EXISTING LOCATION
           ================================================================== */

        locationExists(
            core,
            location
        ) {
            if (
                core?.locations instanceof
                Map
            ) {
                if (
                    core.locations.has(
                        location.id
                    )
                ) {
                    return true;
                }

                return [
                    ...core.locations.values()
                ].some(
                    existing => {

                        const item =
                            safeObject(
                                existing
                            );

                        return (
                            normalizeText(
                                item.nameAr
                            ) ===
                            normalizeText(
                                location.nameAr
                            ) ||
                            normalizeText(
                                item.nameEn ||
                                item.name
                            ) ===
                            normalizeText(
                                location.nameEn
                            )
                        );
                    }
                );
            }

            return false;
        }

        /* ==================================================================
           SECTION 7
           REGISTER ONE LOCATION
           ================================================================== */

        registerLocation(
            core,
            location
        ) {
            if (
                this.locationExists(
                    core,
                    location
                )
            ) {
                this.state.skippedCount +=
                    1;

                return {
                    success:
                        true,

                    skipped:
                        true,

                    location
                };
            }

            let result =
                null;

            if (
                typeof core.registerLocation ===
                "function"
            ) {
                result =
                    core.registerLocation(
                        location
                    );

            } else if (
                typeof core.addLocation ===
                "function"
            ) {
                result =
                    core.addLocation(
                        location
                    );

            } else if (
                typeof core.setLocation ===
                "function"
            ) {
                result =
                    core.setLocation(
                        location
                    );

            } else if (
                core.locations instanceof
                Map
            ) {
                core.locations.set(
                    location.id,
                    location
                );

                result = {
                    success:
                        true,

                    location
                };

            } else {
                throw new Error(
                    "Recovery Core does not expose a location registration API."
                );
            }

            this.state.registeredCount +=
                1;

            return {
                success:
                    true,

                skipped:
                    false,

                result,

                location
            };
        }

        /* ==================================================================
           SECTION 8
           REGISTER ALL REGIONS AND CITIES
           ================================================================== */

        registerAll() {
            const core =
                this.resolveCore();

            this.state.registrationAttempts +=
                1;

            if (
                !core
            ) {
                return {
                    success:
                        false,

                    retryable:
                        true,

                    reason:
                        "Recovery Core is unavailable."
                };
            }

            this.state.regionCount =
                this.regions.length;

            this.state.cityCount =
                this.regions.reduce(
                    (
                        total,
                        region
                    ) =>
                        total +
                        safeArray(
                            region.cities
                        ).length,
                    0
                );

            this.state.registeredCount =
                0;

            this.state.skippedCount =
                0;

            this.state.failedCount =
                0;

            this.state.errors =
                [];

            this.regions.forEach(
                region => {

                    safeArray(
                        region.cities
                    ).forEach(
                        city => {

                            const location =
                                this.createLocationRecord(
                                    region,
                                    city
                                );

                            try {
                                this.registerLocation(
                                    core,
                                    location
                                );

                            } catch (error) {
                                this.state.failedCount +=
                                    1;

                                this.state.errors.push({
                                    locationId:
                                        location.id,

                                    city:
                                        location.nameAr,

                                    message:
                                        error?.message ||
                                        String(
                                            error
                                        )
                                });
                            }
                        }
                    );
                }
            );

            this.state.registered =
                this.state.failedCount ===
                0;

            this.state.lastRegisteredAt =
                now();

            this.state.lastError =
                this.state.failedCount >
                0
                    ? {
                        name:
                            "RegistrationError",

                        message:
                            this.state.failedCount +
                            " locations failed to register."
                    }
                    : null;

            global.dispatchEvent(
                new CustomEvent(
                    "rainguard:saudi-locations-registered",
                    {
                        detail: {
                            registryId:
                                this.id,

                            regionCount:
                                this.state.regionCount,

                            cityCount:
                                this.state.cityCount,

                            registeredCount:
                                this.state.registeredCount,

                            skippedCount:
                                this.state.skippedCount,

                            failedCount:
                                this.state.failedCount,

                            timestamp:
                                now()
                        }
                    }
                )
            );

            return {
                success:
                    this.state.registered,

                core,

                regionCount:
                    this.state.regionCount,

                cityCount:
                    this.state.cityCount,

                registeredCount:
                    this.state.registeredCount,

                skippedCount:
                    this.state.skippedCount,

                failedCount:
                    this.state.failedCount,

                errors:
                    this.state.errors
            };
        }

        /* ==================================================================
           SECTION 9
           AUTOMATIC REGISTRATION
           ================================================================== */

        initialize() {
            this.state.initialized =
                true;

            if (
                this.options.autoRegister
            ) {
                this.scheduleRegistration();
            }

            return this.getStatus();
        }

        scheduleRegistration() {
            let attempts =
                0;

            const execute =
                () => {
                    attempts +=
                        1;

                    const result =
                        this.registerAll();

                    if (
                        result.success ||
                        attempts >=
                            this.options.maxRetries
                    ) {
                        if (
                            this.retryTimer
                        ) {
                            global.clearInterval(
                                this.retryTimer
                            );

                            this.retryTimer =
                                null;
                        }

                        return;
                    }
                };

            execute();

            if (
                !this.state.registered
            ) {
                this.retryTimer =
                    global.setInterval(
                        execute,
                        this.options
                            .retryIntervalMs
                    );
            }
        }

        /* ==================================================================
           SECTION 10
           REGION AND CITY ACCESS
           ================================================================== */

        getRegions() {
            return this.regions.map(
                region => ({
                    id:
                        region.id,

                    nameAr:
                        region.nameAr,

                    nameEn:
                        region.nameEn,

                    cityCount:
                        safeArray(
                            region.cities
                        ).length
                })
            );
        }

        getCitiesByRegion(
            regionId
        ) {
            const region =
                this.regions.find(
                    item =>
                        item.id ===
                        regionId
                );

            return region
                ? safeArray(
                    region.cities
                ).map(
                    city => ({
                        ...city,

                        regionId:
                            region.id,

                        regionNameAr:
                            region.nameAr,

                        regionNameEn:
                            region.nameEn
                    })
                )
                : [];
        }

        getAllLocations() {
            return this.regions.flatMap(
                region =>
                    safeArray(
                        region.cities
                    ).map(
                        city =>
                            this.createLocationRecord(
                                region,
                                city
                            )
                    )
            );
        }

        /* ==================================================================
           SECTION 11
           STATUS
           ================================================================== */

        getStatus() {
            return {
                id:
                    this.id,

                version:
                    this.version,

                initialized:
                    this.state.initialized,

                registered:
                    this.state.registered,

                registrationAttempts:
                    this.state.registrationAttempts,

                regionCount:
                    this.state.regionCount,

                cityCount:
                    this.state.cityCount,

                registeredCount:
                    this.state.registeredCount,

                skippedCount:
                    this.state.skippedCount,

                failedCount:
                    this.state.failedCount,

                lastRegisteredAt:
                    this.state.lastRegisteredAt,

                lastError:
                    this.state.lastError,

                errors:
                    this.state.errors
            };
        }
    }

    /* ======================================================================
       SECTION 12
       GLOBAL EXPORT
       ====================================================================== */

    global.SaudiLocationsRegistryV32 =
        SaudiLocationsRegistryV32;

    global.SaudiLocationsRegistryV32Data =
        SAUDI_REGIONS;

    global.SaudiLocationsRegistryV32Instance =
        new SaudiLocationsRegistryV32({
            autoRegister:
                true,

            activateLocations:
                true,

            retryIntervalMs:
                1000,

            maxRetries:
                30
        });

    function initializeRegistry() {
        global
            .SaudiLocationsRegistryV32Instance
            .initialize();
    }

    if (
        global.document &&
        global.document.readyState ===
            "loading"
    ) {
        global.document.addEventListener(
            "DOMContentLoaded",
            initializeRegistry,
            {
                once:
                    true
            }
        );

    } else {
        initializeRegistry();
    }

    /* ======================================================================
       SECTION 13
       GLOBAL SHORTCUTS
       ====================================================================== */

    global.registerSaudiLocationsV32 =
        function registerSaudiLocationsV32() {
            return global
                .SaudiLocationsRegistryV32Instance
                .registerAll();
        };

    global.getSaudiRegionsV32 =
        function getSaudiRegionsV32() {
            return global
                .SaudiLocationsRegistryV32Instance
                .getRegions();
        };

    global.getSaudiCitiesByRegionV32 =
        function getSaudiCitiesByRegionV32(
            regionId
        ) {
            return global
                .SaudiLocationsRegistryV32Instance
                .getCitiesByRegion(
                    regionId
                );
        };

    console.log(
        "[RainGuard AI V32] Saudi Locations Registry loaded."
    );

})(window);
