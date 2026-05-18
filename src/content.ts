import * as maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import "./trainmap.css";

declare const __EXT_NAME__: string;
declare const __EXT_VERSION__: string;

const LOG_PREFIX = `[${__EXT_NAME__} ${__EXT_VERSION__}]`;

console.log(`${LOG_PREFIX} loaded on`, location.href);

const bannedModes = ["Rail Replacement Bus", "Timetabled Bus service", "Bus"];
const serviceType = document
  .querySelector(".detail-info .infopanel li:has(.glyphicons-folder-open)")
  ?.textContent?.trim();

if (bannedModes.some((m) => m === serviceType)) {
  console.log(`${LOG_PREFIX} Map not supported for service type ${serviceType}`);
} else {
  const pageUrl = new URL(location.href);

  // https://www.realtimetrains.co.uk/service/gb-nr:G15014/2026-05-18/detailed
  const pathParts = pageUrl.pathname.split("/");
  const namespacedServiceId = pathParts[2] ?? "";
  const departureDate = pathParts[3] ?? "";

  const [serviceNamespace, serviceUid] = namespacedServiceId.split(":");
  const departureDateValid = /^\d{4}-\d{2}-\d{2}$/.test(departureDate);

  console.log(`${LOG_PREFIX} Detected service ${namespacedServiceId} on ${departureDate}`);

  type PathResponse = {
    success: boolean;
    totalDistanceMetres: number;
    points: [number, number][];
  };

  const PATH_SOURCE_ID = "trainmap-service-path";
  const PATH_LAYER_ID = "trainmap-service-path-line";

  const GB_BOUNDS: [[number, number], [number, number]] = [
    [-8.65, 49.85],
    [1.77, 60.86],
  ];

  let pathFetchPromise: Promise<PathResponse | null> | null = null;
  let initialFitDone = false;

  function fetchServicePath(): Promise<PathResponse | null> {
    if (pathFetchPromise) return pathFetchPromise;

    if (serviceNamespace !== "gb-nr" || !serviceUid || !departureDateValid) {
      console.error(`${LOG_PREFIX} Cannot fetch service path: unexpected URL`, {
        serviceNamespace,
        serviceUid,
        departureDate,
      });
      pathFetchPromise = Promise.resolve(null);
      return pathFetchPromise;
    }

    pathFetchPromise = fetch("https://pathfinder.ilovetrains.co.uk/api/gb-nr/find-service-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceUid, departureDate }),
    })
      .then(async (res) => {
        if (!res.ok) {
          console.error(`${LOG_PREFIX} Path fetch failed: ${res.status} ${res.statusText}`);
          return null;
        }
        const data = (await res.json()) as PathResponse;
        if (!data.success || !data.points?.length) {
          console.error(`${LOG_PREFIX} Path fetch returned no usable path`, data);
          return null;
        }
        return data;
      })
      .catch((err) => {
        console.error(`${LOG_PREFIX} Path fetch error:`, err);
        return null;
      });

    return pathFetchPromise;
  }

  function renderServicePath(m: maplibregl.Map, path: PathResponse) {
    // remove the existing source and layer if present, to allow re-rendering (e.g. after style change)
    if (m.getLayer(PATH_LAYER_ID)) {
      try {
        m.removeLayer(PATH_LAYER_ID);
      } catch (err) {
        console.error(`${LOG_PREFIX} removeLayer threw`, err);
      }
    }
    if (m.getSource(PATH_SOURCE_ID)) {
      try {
        m.removeSource(PATH_SOURCE_ID);
      } catch (err) {
        console.error(`${LOG_PREFIX} removeSource threw`, err);
      }
    }

    try {
      m.addSource(PATH_SOURCE_ID, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: path.points },
        },
      });
    } catch (err) {
      console.error(`${LOG_PREFIX} addSource threw`, err);
      return;
    }

    const beforeId = m.getLayer("pois-railway-station") ? "pois-railway-station" : undefined;
    try {
      m.addLayer(
        {
          id: PATH_LAYER_ID,
          type: "line",
          source: PATH_SOURCE_ID,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#e60000", "line-width": 3 },
        },
        beforeId,
      );
    } catch (err) {
      console.error(`${LOG_PREFIX} addLayer threw`, err);
      return;
    }

    if (!initialFitDone) {
      initialFitDone = true;
      let minLon = Infinity;
      let minLat = Infinity;
      let maxLon = -Infinity;
      let maxLat = -Infinity;
      for (const [lon, lat] of path.points) {
        if (lon < minLon) minLon = lon;
        if (lat < minLat) minLat = lat;
        if (lon > maxLon) maxLon = lon;
        if (lat > maxLat) maxLat = lat;
      }
      m.resize();
      m.fitBounds(
        [
          [minLon, minLat],
          [maxLon, maxLat],
        ],
        { padding: 60, animate: false, linear: true },
      );
    }
  }

  const serviceTitle = document.querySelector("main > .grid-container:has(#servicetitle)");
  const allox = document.querySelector(
    "main > .grid-container:has(#traindiagram-parent-container)",
  );

  const siblingBefore = allox || serviceTitle;

  if (!siblingBefore) {
    console.error(`${LOG_PREFIX} Could not find a suitable element to insert the map before`);
  }

  const container =
    (document.querySelector("#trainmap-container") as HTMLDivElement) ||
    document.createElement("div");
  container.id = "trainmap-container";
  container.classList.add("grid-container");

  const mapContainer =
    (document.querySelector("#trainmap-map") as HTMLDivElement) || document.createElement("div");
  mapContainer.id = "trainmap-map";

  let mapShown = false;

  let map: maplibregl.Map | null = null;

  function showMap() {
    mapShown = true;

    mapContainer.classList.add("shown");

    if (!map) {
      map = new maplibregl.Map({
        container: mapContainer,
        style: getStyle(),
        bounds: GB_BOUNDS,
        fitBoundsOptions: { padding: 20 },
        attributionControl: {
          compact: true,
          customAttribution: [
            `<a href="https://raildata.org.uk/dataProduct/P-9b4e960e-8bb6-438b-9722-34ae5768a48f/termsAndConditions">&copy; Network Rail</a>`,
            `<a href="https://railmap.azurewebsites.net/Downloads">&copy; GB Railway Data Ltd</a>`,
          ],
        },
      });
      map.addControl(new maplibregl.FullscreenControl());

      let styleReady = false;

      const tryRender = (trigger: string) => {
        if (!map || !styleReady) return;
        pathFetchPromise?.then((path) => {
          if (path && map) renderServicePath(map, path);
        });
      };

      map.on("style.load", () => {
        styleReady = true;
        tryRender("style.load");
      });
      fetchServicePath().then(() => tryRender("fetch.resolved"));
    }
  }
  function hideMap() {
    mapShown = false;

    mapContainer.classList.remove("shown");
  }

  const mapShowHideToggle =
    (document.querySelector("#trainmap-toggle") as HTMLButtonElement) ||
    document.createElement("button");
  mapShowHideToggle.id = "trainmap-toggle";
  mapShowHideToggle.className = "button info";
  mapShowHideToggle.textContent = "Show map";
  mapShowHideToggle.addEventListener("click", () => {
    if (mapShown) {
      hideMap();
      mapShowHideToggle.textContent = "Show map";
    } else {
      showMap();
      mapShowHideToggle.textContent = "Hide map";
    }
  });

  container.appendChild(mapShowHideToggle);
  container.appendChild(mapContainer);

  siblingBefore?.insertAdjacentElement("afterend", container);

  const darkStyle = "https://osm-assets.coveragetiles.com/modern_rail_dark.min.json";
  const lightStyle = "https://osm-assets.coveragetiles.com/modern_rail_light.min.json";

  function getStyle() {
    return document.documentElement.getAttribute("data-theme") === "dark" ? darkStyle : lightStyle;
  }

  // Watch for theme changes and update the map style accordingly
  const observer = new MutationObserver(() => {
    map?.setStyle(getStyle());
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
