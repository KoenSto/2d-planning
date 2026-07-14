import test from "node:test";
import assert from "node:assert/strict";
import { buildLocationSearchUrl, buildParcelUrl, parcelKey } from "../src/pdok.js";

test("Location API URL activeert de gewenste collecties", () => {
  const url = new URL(buildLocationSearchUrl("Stationsplein 1 Utrecht"));
  assert.equal(url.searchParams.get("q"), "Stationsplein 1 Utrecht");
  assert.equal(url.searchParams.get("adres[version]"), "1");
  assert.equal(url.searchParams.get("woonplaats[version]"), "1");
  assert.equal(url.searchParams.get("perceel[version]"), "1");
});

test("Perceel-URL gebruikt CRS84 en een bbox", () => {
  const url = new URL(buildParcelUrl({ west: 5.1, south: 52.08, east: 5.13, north: 52.1 }, 250));
  assert.equal(url.searchParams.get("bbox"), "5.1000000,52.0800000,5.1300000,52.1000000");
  assert.match(url.searchParams.get("bbox-crs"), /CRS84$/);
  assert.equal(url.searchParams.get("limit"), "250");
});

test("parcelKey gebruikt een stabiele identificatie", () => {
  assert.equal(parcelKey({ id: "perceel-123", geometry: null, properties: {} }), "perceel-123");
  assert.equal(parcelKey({ geometry: null, properties: { identificatie: "NL-42" } }), "NL-42");
});

test("parcelKey ondersteunt de actuele BRK veldnaam identificatie_lokaal_id", () => {
  assert.equal(parcelKey({ properties: { identificatie_lokaal_id: "NL.IMKAD.PERCEEL.123" } }), "NL.IMKAD.PERCEEL.123");
});
