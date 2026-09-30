/* RainGuard AI V32 — FORECAST-1J5
   Real Wadi Dataset Integration Bridge
   Version: FORECAST-1J5.0

   Connects a REAL HydroRIVERS-derived Saudi/Middle-East GeoJSON dataset
   to WadiProximityAdapterV32. It never creates river/wadi geometry.
*/
(function () {
  "use strict";

  const NAME = "RealWadiDatasetBridgeV32";
  const VERSION = "FORECAST-1J5.0";
  const DEFAULT_URL = "data/hydrology/saudi_hydrorivers.geojson";

  function validGeoJSON(data) {
    if (!data || typeof data !== "object") return false;
    if (data.type === "FeatureCollection")
      return Array.isArray(data.features) && data.features.length > 0;
    return data.type === "Feature" || !!data.coordinates;
  }

  async function probe(url = DEFAULT_URL) {
    try {
      const r = await fetch(url, {
        cache: "no-store",
        headers: {"Accept":"application/geo+json,application/json"}
      });
      if (!r.ok) {
        return {available:false, status:"REAL_WADI_DATASET_NOT_DEPLOYED",
                httpStatus:r.status, url};
      }
      const data = await r.json();
      if (!validGeoJSON(data)) {
        return {available:false, status:"INVALID_REAL_WADI_DATASET", url};
      }
      const featureCount =
        data.type === "FeatureCollection" ? data.features.length : 1;
      return {
        available:true,
        status:"REAL_WADI_DATASET_READY",
        url,
        featureCount,
        geojson:data
      };
    } catch (e) {
      return {available:false, status:"REAL_WADI_DATASET_NOT_DEPLOYED",
              error:String(e?.message || e), url};
    }
  }

  async function connect(url = DEFAULT_URL) {
    const checked = await probe(url);

    window.RG32 = window.RG32 || {};

    if (!checked.available) {
      window.RG32.hydroRiversDatasetUrl = null;
      return {
        bridge:NAME, version:VERSION,
        status:checked.status,
        available:false,
        datasetUrl:url,
        syntheticData:false,
        inventedGeometry:false,
        featureCount:0,
        error:checked.error || null,
        httpStatus:checked.httpStatus || null
      };
    }

    window.RG32.hydroRiversDatasetUrl = url;

    const result = {
      bridge:NAME,
      version:VERSION,
      status:"REAL_WADI_DATASET_CONNECTED",
      available:true,
      datasetUrl:url,
      featureCount:checked.featureCount,
      source:"HydroRIVERS-derived project GeoJSON",
      syntheticData:false,
      inventedGeometry:false
    };

    window.RG32.latestRealWadiDataset = result;
    window.dispatchEvent(new CustomEvent(
      "rainguard:real-wadi-dataset-connected",
      {detail:result}
    ));
    return result;
  }

  async function evaluateCity(city, url = DEFAULT_URL) {
    const connection = await connect(url);
    if (!connection.available) {
      return {
        bridge:NAME,
        version:VERSION,
        status:connection.status,
        available:false,
        connection,
        proximity:null
      };
    }

    const adapter = window.WadiProximityAdapterV32;
    if (!adapter?.collect)
      throw new Error("WADI_PROXIMITY_ADAPTER_NOT_LOADED");

    const proximity = await adapter.collect(city, {datasetUrl:url});

    return {
      bridge:NAME,
      version:VERSION,
      status: proximity?.available
        ? "REAL_WADI_PROXIMITY_CONNECTED"
        : "REAL_WADI_PROXIMITY_UNAVAILABLE",
      available: proximity?.available === true,
      connection,
      proximity
    };
  }

  const api = {
    name:NAME,
    version:VERSION,
    defaultDatasetUrl:DEFAULT_URL,
    probe,
    connect,
    evaluateCity,
    getStatus(){
      return {
        bridge:NAME,
        version:VERSION,
        ready:true,
        defaultDatasetUrl:DEFAULT_URL,
        configured:Boolean(window.RG32?.hydroRiversDatasetUrl),
        syntheticDataAllowed:false
      };
    }
  };

  window.RealWadiDatasetBridgeV32 = api;
  window.RG32 = window.RG32 || {};
  window.RG32.RealWadiDatasetBridge = api;

  console.log(`${NAME} ${VERSION} ready.`);
})();
