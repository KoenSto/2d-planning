import test from "node:test";
import assert from "node:assert/strict";
import { cloneScenario, createScenario, scenarioAsGeoJSON } from "../src/scenarios.js";
import { createDemoScenario } from "../src/demo.js";

test("cloneScenario maakt onafhankelijke identifiers", () => {
  const source = createDemoScenario();
  const clone = cloneScenario(source);
  assert.notEqual(clone.id, source.id);
  assert.notEqual(
    clone.objects.features[0].properties.scenarioObjectId,
    source.objects.features[0].properties.scenarioObjectId
  );
  assert.notEqual(
    clone.parcels.features[0].properties.scenarioParcelId,
    source.parcels.features[0].properties.scenarioParcelId
  );
});

test("scenarioAsGeoJSON markeert plangebied en objecten", () => {
  const scenario = createDemoScenario();
  const collection = scenarioAsGeoJSON(scenario);
  assert.equal(collection.type, "FeatureCollection");
  assert.equal(collection.features.length, 6);
  assert.equal(collection.features[0].properties.scenarioRole, "plangebied");
  assert.equal(collection.features[1].properties.scenarioRole, "scenario-object");
});

test("een leeg scenario heeft geldige FeatureCollections", () => {
  const scenario = createScenario("Test");
  assert.deepEqual(scenario.parcels, { type: "FeatureCollection", features: [] });
  assert.deepEqual(scenario.objects, { type: "FeatureCollection", features: [] });
});
