/* RainGuard AI V32 — FORECAST-1J4
   HydroRIVERS / wadi proximity adapter.
   IMPORTANT: no remote dataset URL is invented.
   A real HydroRIVERS-derived GeoJSON must be supplied by the project.
*/
(function () {
  "use strict";

  const NAME = "WadiProximityAdapterV32";
  const VERSION = "FORECAST-1J4.0";

  function rad(x){ return x * Math.PI / 180; }

  function haversineM(a, b) {
    const R = 6371008.8;
    const dLat = rad(b[1] - a[1]);
    const dLon = rad(b[0] - a[0]);
    const la1 = rad(a[1]), la2 = rad(b[1]);
    const h = Math.sin(dLat/2)**2 +
      Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // Local equirectangular projection around query point.
  function xy(coord, origin) {
    const R = 6371008.8;
    const lat0 = rad(origin[1]);
    return [
      R * rad(coord[0] - origin[0]) * Math.cos(lat0),
      R * rad(coord[1] - origin[1])
    ];
  }

  function pointSegmentDistanceM(pointLonLat, aLonLat, bLonLat) {
    const p = [0, 0];
    const a = xy(aLonLat, pointLonLat);
    const b = xy(bLonLat, pointLonLat);
    const abx = b[0]-a[0], aby = b[1]-a[1];
    const denom = abx*abx + aby*aby;
    if (!denom) return Math.hypot(a[0], a[1]);
    let t = (-(a[0]*abx + a[1]*aby)) / denom;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(a[0] + t*abx, a[1] + t*aby);
  }

  function linesFromGeometry(g) {
    if (!g) return [];
    if (g.type === "LineString") return [g.coordinates];
    if (g.type === "MultiLineString") return g.coordinates;
    if (g.type === "GeometryCollection")
      return (g.geometries || []).flatMap(linesFromGeometry);
    return [];
  }

  function nearest(point, geojson) {
    const features = geojson?.type === "FeatureCollection"
      ? geojson.features || []
      : geojson?.type === "Feature"
        ? [geojson]
        : [{type:"Feature", properties:{}, geometry:geojson}];

    let best = null;

    for (const feature of features) {
      for (const line of linesFromGeometry(feature.geometry)) {
        for (let i=0; i<line.length-1; i++) {
          const d = pointSegmentDistanceM(point, line[i], line[i+1]);
          if (!best || d < best.distanceM) {
            best = {
              distanceM: d,
              properties: feature.properties || {}
            };
          }
        }
      }
    }
    return best;
  }

  async function collect(city={}, options={}) {
    const lat = Number(city.lat ?? city.latitude);
    const lon = Number(city.lon ?? city.lng ?? city.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon))
      throw new Error("INVALID_CITY_COORDINATES");

    const datasetUrl =
      options.datasetUrl ||
      window.RG32?.hydroRiversDatasetUrl ||
      null;

    const suppliedGeoJSON = options.geojson || null;

    if (!datasetUrl && !suppliedGeoJSON) {
      return {
        adapter: NAME,
        version: VERSION,
        status: "HYDRORIVERS_DATASET_NOT_CONFIGURED",
        city: city.name ?? city.nameAr ?? city.city ?? "Unknown",
        available: false,
        evidence: {
          wadi_proximity: {
            available: false,
            value: null,
            unit: "m",
            source: null,
            quality: null
          }
        },
        dataPolicy: {
          syntheticData: false,
          inventedWadiGeometry: false,
          requiresRealDataset: true
        }
      };
    }

    let geojson = suppliedGeoJSON;
    if (!geojson) {
      const r = await fetch(datasetUrl, {headers:{"Accept":"application/geo+json,application/json"}});
      if (!r.ok) throw new Error(`HYDRORIVERS_HTTP_${r.status}`);
      geojson = await r.json();
    }

    const hit = nearest([lon, lat], geojson);
    if (!hit) throw new Error("NO_RIVER_GEOMETRY_FOUND");

    const distanceM = Math.round(hit.distanceM);

    const evidence = {
      wadi_proximity: {
        available: true,
        value: distanceM,
        unit: "m",
        source: "HydroRIVERS-derived real vector dataset",
        quality: "REAL_EXTERNAL_VECTOR_DATA",
        metadata: {
          dataset: "HydroRIVERS",
          calculation: "nearest_line_distance",
          nearestReachProperties: hit.properties
        }
      }
    };

    const contextLayer = window.HydrologicalContextLayerV32;
    const context = contextLayer?.build
      ? contextLayer.build(city, evidence)
      : null;

    const result = {
      adapter: NAME,
      version: VERSION,
      status: "REAL_WADI_PROXIMITY_READY",
      city: city.name ?? city.nameAr ?? city.city ?? "Unknown",
      available: true,
      distanceM,
      evidence,
      context,
      dataPolicy: {
        syntheticData: false,
        inventedWadiGeometry: false,
        requiresRealDataset: true
      }
    };

    window.RG32 = window.RG32 || {};
    window.RG32.latestWadiProximity = result;
    window.dispatchEvent(new CustomEvent(
      "rainguard:wadi-proximity-ready",
      {detail: result}
    ));
    return result;
  }

  const api = {
    name: NAME,
    version: VERSION,
    collect,
    nearest,
    haversineM,
    getStatus(){
      return {
        adapter: NAME,
        version: VERSION,
        ready: true,
        datasetConfigured: Boolean(window.RG32?.hydroRiversDatasetUrl),
        syntheticDataAllowed: false
      };
    }
  };

  window.WadiProximityAdapterV32 = api;
  window.RG32 = window.RG32 || {};
  window.RG32.WadiProximityAdapter = api;
  console.log(`${NAME} ${VERSION} ready.`);
})();
