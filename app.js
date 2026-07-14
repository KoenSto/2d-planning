import { CONFIG } from "./config.js";

export function createId(prefix = "id") {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emptyFeatureCollection() {
  return { type: "FeatureCollection", features: [] };
}

export function createScenario(name = "Nieuw scenario") {
  const now = new Date().toISOString();
  return {
    id: createId("scenario"),
    name,
    createdAt: now,
    updatedAt: now,
    parcels: emptyFeatureCollection(),
    objects: emptyFeatureCollection(),
    assumptions: { ...CONFIG.assumptions }
  };
}

export function cloneScenario(source, name = `${source.name} - kopie`) {
  const clone = structuredClone(source);
  clone.id = createId("scenario");
  clone.name = name;
  clone.createdAt = new Date().toISOString();
  clone.updatedAt = clone.createdAt;
  clone.parcels.features = clone.parcels.features.map((feature) => ({
    ...feature,
    properties: {
      ...(feature.properties ?? {}),
      scenarioParcelId: createId("parcel")
    }
  }));
  clone.objects.features = clone.objects.features.map((feature) => ({
    ...feature,
    properties: {
      ...(feature.properties ?? {}),
      scenarioObjectId: createId("object")
    }
  }));
  return clone;
}

export function normalizeScenario(input) {
  const scenario = structuredClone(input ?? {});
  const normalized = createScenario(String(scenario.name || "Geimporteerd scenario"));
  normalized.id = String(scenario.id || normalized.id);
  normalized.createdAt = scenario.createdAt || normalized.createdAt;
  normalized.updatedAt = scenario.updatedAt || normalized.updatedAt;
  normalized.parcels = normalizeFeatureCollection(scenario.parcels);
  normalized.objects = normalizeFeatureCollection(scenario.objects);
  normalized.assumptions = {
    ...CONFIG.assumptions,
    ...(scenario.assumptions ?? {})
  };
  return normalized;
}

export function normalizeFeatureCollection(value) {
  if (value?.type === "FeatureCollection" && Array.isArray(value.features)) {
    return structuredClone(value);
  }
  return emptyFeatureCollection();
}

export function makeExportBundle(scenario) {
  return {
    format: "ruimtescenario-pdok",
    version: 1,
    exportedAt: new Date().toISOString(),
    scenario: structuredClone(scenario)
  };
}

export function scenarioAsGeoJSON(scenario) {
  const parcelFeatures = scenario.parcels.features.map((feature) => ({
    ...structuredClone(feature),
    properties: {
      ...(feature.properties ?? {}),
      scenarioRole: "plangebied",
      scenarioName: scenario.name
    }
  }));

  const objectFeatures = scenario.objects.features.map((feature) => ({
    ...structuredClone(feature),
    properties: {
      ...(feature.properties ?? {}),
      scenarioRole: "scenario-object",
      scenarioName: scenario.name
    }
  }));

  return {
    type: "FeatureCollection",
    name: scenario.name,
    features: [...parcelFeatures, ...objectFeatures]
  };
}
