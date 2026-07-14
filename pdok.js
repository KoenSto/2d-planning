export const CONFIG = Object.freeze({
  appName: "RuimteScenario PDOK",
  appVersion: "1.0.0",
  storageKey: "ruimtescenario-pdok-v1",
  initialView: {
    center: [52.0907, 5.1214],
    zoom: 13
  },
  pdok: {
    locationSearch: "https://api.pdok.nl/kadaster/location-api/v1/search",
    parcels: "https://api.pdok.nl/kadaster/brk-kadastrale-kaart/ogc/v1/collections/perceel/items",
    crs84: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
    parcelLimit: 1000,
    minParcelZoom: 15,
    maxParcelBoxWidthMeters: 3500,
    maxParcelBoxHeightMeters: 3500,
    tileLayers: {
      standaard: "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png",
      grijs: "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png",
      pastel: "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/pastel/EPSG:3857/{z}/{x}/{y}.png"
    }
  },
  assumptions: {
    netGrossRatio: 0.75,
    averageDwellingArea: 75,
    parkingNorm: 0.8,
    parkingSpaceArea: 25
  }
});

export const CATEGORY_DEFINITIONS = Object.freeze({
  building: {
    label: "Bebouwing",
    color: "#dd4b39",
    fillOpacity: 0.48,
    defaultName: "Bouwvlak"
  },
  green: {
    label: "Groen",
    color: "#238636",
    fillOpacity: 0.46,
    defaultName: "Groen"
  },
  parking: {
    label: "Parkeren",
    color: "#6b7280",
    fillOpacity: 0.5,
    defaultName: "Parkeren"
  },
  public: {
    label: "Openbare ruimte",
    color: "#2563eb",
    fillOpacity: 0.3,
    defaultName: "Openbare ruimte"
  }
});
