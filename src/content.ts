import * as maplibregl from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";
import "./trainmap.css";

declare const __EXT_NAME__: string;
declare const __EXT_VERSION__: string;

console.log(`[${__EXT_NAME__} ${__EXT_VERSION__}] loaded on`, location.href);

const pageUrl = new URL(location.href);

// https://www.realtimetrains.co.uk/service/gb-nr:G15014/2026-05-18/detailed
const namespacedServiceId = pageUrl.pathname.split("/")[2];

console.log(`Service ${namespacedServiceId}`);

const serviceTitle = document.querySelector("main > .grid-container:has(#servicetitle)");
const allox = document.querySelector("main > .grid-container:has(#traindiagram-parent-container)");

const siblingBefore = allox || serviceTitle;

if (!siblingBefore) {
  console.error("Could not find a suitable element to insert the map before");
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
      center: [0, 0],
      zoom: 2,
    });
    map.addControl(new maplibregl.FullscreenControl());
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
