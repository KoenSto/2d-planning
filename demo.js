import { CONFIG } from "./config.js";

export function buildLocationSearchUrl(query, limit = 10) {
  const url = new URL(CONFIG.pdok.locationSearch);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("adres[version]", "1");
  url.searchParams.set("woonplaats[version]", "1");
  url.searchParams.set("perceel[version]", "1");
  url.searchParams.set("adres[relevance]", "0.7");
  url.searchParams.set("woonplaats[relevance]", "0.2");
  url.searchParams.set("perceel[relevance]", "0.1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("f", "json");
  return url.toString();
}

export function buildParcelUrl(bounds, limit = CONFIG.pdok.parcelLimit) {
  const url = new URL(CONFIG.pdok.parcels);
  const bbox = [bounds.west, bounds.south, bounds.east, bounds.north]
    .map((value) => Number(value).toFixed(7))
    .join(",");
  url.searchParams.set("f", "json");
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("bbox-crs", CONFIG.pdok.crs84);
  url.searchParams.set("crs", CONFIG.pdok.crs84);
  url.searchParams.set("limit", String(limit));
  return url.toString();
}

export function getDisplayName(feature) {
  const properties = feature?.properties ?? {};
  return (
    properties.display_name ||
    properties.weergavenaam ||
    properties.identificatie ||
    properties.kadastraleAanduiding ||
    properties.perceelnummer ||
    "Onbekende locatie"
  );
}

export function parcelKey(feature) {
  const properties = feature?.properties ?? {};
  const preferred = [
    feature?.id,
    properties.id,
    properties.identificatie_lokaal_id,
    properties.identificatie,
    properties.lokaalID,
    properties.kadastraleAanduiding,
    properties.perceelnummer
  ].find((value) => value !== undefined && value !== null && String(value).length > 0);

  if (preferred) return String(preferred);
  return geometryHash(feature?.geometry);
}

export function geometryHash(geometry) {
  const input = JSON.stringify(geometry ?? {});
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `geom-${(hash >>> 0).toString(16)}`;
}

export function getGeometryBounds(geometry) {
  if (!geometry?.coordinates) return null;
  const points = [];

  const collect = (coordinates) => {
    if (!Array.isArray(coordinates)) return;
    if (coordinates.length >= 2 && typeof coordinates[0] === "number") {
      points.push(coordinates);
      return;
    }
    coordinates.forEach(collect);
  };

  collect(geometry.coordinates);
  if (points.length === 0) return null;

  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return {
    west: Math.min(...lngs),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    north: Math.max(...lats)
  };
}
