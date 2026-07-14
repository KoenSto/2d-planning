import { CONFIG, CATEGORY_DEFINITIONS } from "./config.js";
import { calculateMetrics, formatArea, formatNumber, formatPercent } from "./calculations.js";
import {
  createScenario,
  cloneScenario,
  normalizeScenario,
  makeExportBundle,
  scenarioAsGeoJSON
} from "./scenarios.js";
import {
  buildLocationSearchUrl,
  buildParcelUrl,
  getDisplayName,
  parcelKey,
  getGeometryBounds
} from "./pdok.js";
import { createDemoScenario } from "./demo.js";

const state = {
  scenarios: [],
  activeScenarioId: null,
  loadedParcels: { type: "FeatureCollection", features: [] },
  selectedObjectId: null
};

let map;
let loadedParcelsLayer;
let selectedParcelsLayer;
let scenarioObjectsLayer;
let activeDrawType = null;
let activeMode = null;
let searchAbortController = null;
let searchDebounceId = null;
let saveDebounceId = null;

const el = (id) => document.getElementById(id);

function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.scenarios) && parsed.scenarios.length > 0) {
        state.scenarios = parsed.scenarios.map((scenario) => normalizeScenario(scenario));
        state.activeScenarioId = parsed.activeScenarioId || state.scenarios[0].id;
        return;
      }
    }
  } catch (error) {
    console.warn("Kon opgeslagen gegevens niet lezen, begin met een nieuw scenario.", error);
  }
  const scenario = createScenario("Scenario 1");
  state.scenarios = [scenario];
  state.activeScenarioId = scenario.id;
}

function persistState() {
  window.clearTimeout(saveDebounceId);
  saveDebounceId = window.setTimeout(() => {
    try {
      localStorage.setItem(
        CONFIG.storageKey,
        JSON.stringify({ scenarios: state.scenarios, activeScenarioId: state.activeScenarioId })
      );
      setSaveStatus("Lokaal opgeslagen");
    } catch (error) {
      setSaveStatus("Opslaan mislukt");
      console.error(error);
    }
  }, 250);
}

function setSaveStatus(text) {
  const target = el("save-status");
  if (target) target.textContent = text;
}

function getActiveScenario() {
  return state.scenarios.find((scenario) => scenario.id === state.activeScenarioId) || state.scenarios[0];
}

function showToast(message, tone = "info") {
  const container = el("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  container.appendChild(toast);
  window.setTimeout(() => toast.classList.add("toast-visible"), 10);
  window.setTimeout(() => {
    toast.classList.remove("toast-visible");
    window.setTimeout(() => toast.remove(), 250);
  }, 3200);
}

function renderScenarioSelect() {
  const select = el("scenario-select");
  if (!select) return;
  select.innerHTML = "";
  state.scenarios.forEach((scenario) => {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.name;
    select.appendChild(option);
  });
  select.value = state.activeScenarioId;
  el("scenario-count").textContent = String(state.scenarios.length);
  const active = getActiveScenario();
  el("scenario-name").value = active ? active.name : "";
  el("delete-scenario-button").disabled = state.scenarios.length <= 1;
}

function switchScenario(scenarioId) {
  const exists = state.scenarios.some((scenario) => scenario.id === scenarioId);
  state.activeScenarioId = exists ? scenarioId : (state.scenarios[0] ? state.scenarios[0].id : null);
  closeObjectEditor();
  renderScenarioSelect();
  refreshAssumptionFields();
  renderSelectedParcels();
  renderScenarioObjects();
  refreshMetrics();
}

function createNewScenario() {
  const scenario = createScenario(`Scenario ${state.scenarios.length + 1}`);
  state.scenarios.push(scenario);
  switchScenario(scenario.id);
  persistState();
  showToast("Nieuw scenario aangemaakt.");
}

function duplicateActiveScenario() {
  const active = getActiveScenario();
  if (!active) return;
  const clone = cloneScenario(active);
  state.scenarios.push(clone);
  switchScenario(clone.id);
  persistState();
  showToast("Scenario gedupliceerd.");
}

function deleteActiveScenario() {
  if (state.scenarios.length <= 1) {
    showToast("Er moet minimaal een scenario overblijven.", "warning");
    return;
  }
  const active = getActiveScenario();
  if (!active) return;
  if (!window.confirm(`Scenario "${active.name}" verwijderen?`)) return;
  state.scenarios = state.scenarios.filter((scenario) => scenario.id !== active.id);
  switchScenario(state.scenarios[0].id);
  persistState();
  showToast("Scenario verwijderd.");
}

function renameActiveScenario(name) {
  const active = getActiveScenario();
  if (!active) return;
  active.name = name.trim() || active.name;
  active.updatedAt = new Date().toISOString();
  renderScenarioSelect();
  persistState();
}

function categoryStyle(type) {
  const definition = CATEGORY_DEFINITIONS[type] || CATEGORY_DEFINITIONS.building;
  return {
    color: definition.color,
    weight: 2,
    fillColor: definition.color,
    fillOpacity: definition.fillOpacity
  };
}

function initMap() {
  map = L.map("map", {
    center: CONFIG.initialView.center,
    zoom: CONFIG.initialView.zoom
  });

  const standaard = L.tileLayer(CONFIG.pdok.tileLayers.standaard, {
    maxZoom: 19,
    attribution: "Kaartgegevens: PDOK / Kadaster"
  }).addTo(map);
  const grijs = L.tileLayer(CONFIG.pdok.tileLayers.grijs, {
    maxZoom: 19,
    attribution: "Kaartgegevens: PDOK / Kadaster"
  });
  const pastel = L.tileLayer(CONFIG.pdok.tileLayers.pastel, {
    maxZoom: 19,
    attribution: "Kaartgegevens: PDOK / Kadaster"
  });

  L.control.layers(
    { Standaard: standaard, Grijs: grijs, Pastel: pastel },
    {},
    { position: "topright" }
  ).addTo(map);

  loadedParcelsLayer = L.geoJSON(state.loadedParcels, {
    style: () => ({ color: "#1d4ed8", weight: 1.5, fillOpacity: 0.05, dashArray: "4 3" }),
    onEachFeature: (feature, layer) => {
      layer.on("click", () => toggleParcelSelection(feature));
    }
  }).addTo(map);

  const active = getActiveScenario();

  selectedParcelsLayer = L.geoJSON(active ? active.parcels : { type: "FeatureCollection", features: [] }, {
    style: () => ({ color: "#0f3d3e", weight: 2, fillOpacity: 0.08 })
  }).addTo(map);

  scenarioObjectsLayer = L.geoJSON(active ? active.objects : { type: "FeatureCollection", features: [] }, {
    style: (feature) => categoryStyle(feature.properties.type),
    onEachFeature: (feature, layer) => {
      layer.on("click", () => openObjectEditor(feature));
    }
  }).addTo(map);

  initGeomanEvents();
  map.on("zoomend moveend", updateParcelTip);
  updateParcelTip();
}

function updateParcelTip() {
  const tip = el("map-tip");
  if (!tip || !map) return;
  if (map.getZoom() < CONFIG.pdok.minParcelZoom) {
    tip.textContent = `Zoom in tot minimaal niveau ${CONFIG.pdok.minParcelZoom} om kavels te laden.`;
  } else {
    tip.textContent = "Klik op 'Laad kavels' om BRK-kavels in beeld te laden.";
  }
}

function setMapLoading(isLoading, text) {
  const progress = el("map-progress");
  if (!progress) return;
  progress.classList.toggle("hidden", !isLoading);
  if (text) el("map-progress-text").textContent = text;
}

function bindLocationSearch() {
  const input = el("location-search");
  const clearButton = el("clear-search-button");
  const results = el("search-results");

  input.addEventListener("input", () => {
    const query = input.value.trim();
    clearButton.classList.toggle("hidden", query.length === 0);
    window.clearTimeout(searchDebounceId);
    if (query.length < 2) {
      results.classList.add("hidden");
      results.innerHTML = "";
      return;
    }
    searchDebounceId = window.setTimeout(() => runLocationSearch(query), 300);
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    clearButton.classList.add("hidden");
    results.classList.add("hidden");
    results.innerHTML = "";
    input.focus();
  });

  document.addEventListener("click", (event) => {
    if (!results.contains(event.target) && event.target !== input) {
      results.classList.add("hidden");
    }
  });
}

async function runLocationSearch(query) {
  if (searchAbortController) searchAbortController.abort();
  searchAbortController = new AbortController();
  const results = el("search-results");
  try {
    const response = await fetch(buildLocationSearchUrl(query), { signal: searchAbortController.signal });
    if (!response.ok) throw new Error(`PDOK Location API antwoordde met ${response.status}`);
    const data = await response.json();
    const docs = (data && data.response && data.response.docs) || [];
    renderSearchResults(docs);
  } catch (error) {
    if (error.name === "AbortError") return;
    console.error(error);
    results.innerHTML = "";
    const item = document.createElement("div");
    item.className = "search-result search-result-empty";
    item.textContent = "Zoeken mislukt. Controleer de internetverbinding.";
    results.appendChild(item);
    results.classList.remove("hidden");
  }
}

function renderSearchResults(docs) {
  const results = el("search-results");
  results.innerHTML = "";
  if (docs.length === 0) {
    const item = document.createElement("div");
    item.className = "search-result search-result-empty";
    item.textContent = "Geen resultaten gevonden.";
    results.appendChild(item);
    results.classList.remove("hidden");
    return;
  }
  docs.forEach((doc) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    button.textContent = doc.weergavenaam || "Onbekende locatie";
    button.addEventListener("click", () => {
      const point = parsePointWkt(doc.centroide_ll);
      if (point) {
        map.setView([point.lat, point.lng], Math.max(map.getZoom(), CONFIG.pdok.minParcelZoom));
      }
      results.classList.add("hidden");
    });
    results.appendChild(button);
  });
  results.classList.remove("hidden");
}

function parsePointWkt(wkt) {
  if (!wkt) return null;
  const match = /POINT\(([-\d.]+)\s+([-\d.]+)\)/.exec(wkt);
  if (!match) return null;
  return { lng: Number(match[1]), lat: Number(match[2]) };
}

function boundsSizeMeters(bounds) {
  const width = L.latLng(bounds.getSouth(), bounds.getWest()).distanceTo(
    L.latLng(bounds.getSouth(), bounds.getEast())
  );
  const height = L.latLng(bounds.getSouth(), bounds.getWest()).distanceTo(
    L.latLng(bounds.getNorth(), bounds.getWest())
  );
  return { width, height };
}

async function loadParcels() {
  if (map.getZoom() < CONFIG.pdok.minParcelZoom) {
    showToast(`Zoom in tot minimaal niveau ${CONFIG.pdok.minParcelZoom} om kavels te laden.`, "warning");
    return;
  }
  const bounds = map.getBounds();
  const size = boundsSizeMeters(bounds);
  if (size.width > CONFIG.pdok.maxParcelBoxWidthMeters || size.height > CONFIG.pdok.maxParcelBoxHeightMeters) {
    showToast("Het kaartvenster is te groot, zoom verder in.", "warning");
    return;
  }
  setMapLoading(true, "Kavels laden...");
  try {
    const box = {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth()
    };
    const response = await fetch(buildParcelUrl(box));
    if (!response.ok) throw new Error(`BRK Kadastrale Kaart antwoordde met ${response.status}`);
    const data = await response.json();
    state.loadedParcels = { type: "FeatureCollection", features: data.features || [] };
    renderLoadedParcels();
    el("parcel-status").textContent = `${state.loadedParcels.features.length} kavel(s) geladen in beeld.`;
  } catch (error) {
    console.error(error);
    showToast("Kavels laden is mislukt.", "warning");
  } finally {
    setMapLoading(false);
  }
}

function clearLoadedParcels() {
  state.loadedParcels = { type: "FeatureCollection", features: [] };
  renderLoadedParcels();
  el("parcel-status").textContent = "Zoom in tot straatniveau en laad kavels.";
}

function clearSelectedParcels() {
  const active = getActiveScenario();
  if (!active) return;
  active.parcels.features = [];
  active.updatedAt = new Date().toISOString();
  renderSelectedParcels();
  renderLoadedParcels();
  refreshMetrics();
  persistState();
}

function renderLoadedParcels() {
  if (!loadedParcelsLayer) return;
  loadedParcelsLayer.clearLayers();
  loadedParcelsLayer.addData(state.loadedParcels);
}

function renderSelectedParcels() {
  if (!selectedParcelsLayer) return;
  const active = getActiveScenario();
  selectedParcelsLayer.clearLayers();
  if (active) selectedParcelsLayer.addData(active.parcels);
  const countEl = el("selected-parcel-count");
  if (countEl) countEl.textContent = active ? String(active.parcels.features.length) : "0";
}

function toggleParcelSelection(feature) {
  const active = getActiveScenario();
  if (!active) return;
  const key = parcelKey(feature);
  const existingIndex = active.parcels.features.findIndex((item) => parcelKey(item) === key);
  if (existingIndex >= 0) {
    active.parcels.features.splice(existingIndex, 1);
  } else {
    active.parcels.features.push({
      type: "Feature",
      geometry: feature.geometry,
      properties: {
        scenarioParcelId: key,
        source: "pdok",
        displayName: getDisplayName(feature)
      }
    });
  }
  active.updatedAt = new Date().toISOString();
  renderSelectedParcels();
  refreshMetrics();
  persistState();
}

function setActiveDrawButton(type) {
  document.querySelectorAll(".draw-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.drawType === type);
  });
}

function updateStopToolButton() {
  const stopButton = el("stop-tool-button");
  if (!stopButton) return;
  stopButton.classList.toggle("hidden", !activeMode);
}

function stopActiveTool() {
  if (!map) return;
  if (map.pm.globalDrawModeEnabled()) map.pm.disableDraw();
  if (map.pm.globalEditModeEnabled()) map.pm.disableGlobalEditMode();
  if (map.pm.globalRemovalModeEnabled()) map.pm.disableGlobalRemovalMode();
  activeDrawType = null;
  activeMode = null;
  setActiveDrawButton(null);
  el("edit-mode-button").classList.remove("active");
  el("remove-mode-button").classList.remove("active");
  updateStopToolButton();
}

function startDrawing(type) {
  stopActiveTool();
  activeDrawType = type;
  activeMode = "draw";
  setActiveDrawButton(type);
  updateStopToolButton();
  map.pm.enableDraw("Polygon", {
    snappable: true,
    templineStyle: categoryStyle(type),
    hintlineStyle: { color: CATEGORY_DEFINITIONS[type].color, dashArray: "4 4" },
    pathOptions: categoryStyle(type)
  });
}

function startEditMode() {
  stopActiveTool();
  activeMode = "edit";
  el("edit-mode-button").classList.add("active");
  updateStopToolButton();
  map.pm.enableGlobalEditMode();
}

function startRemoveMode() {
  stopActiveTool();
  activeMode = "remove";
  el("remove-mode-button").classList.add("active");
  updateStopToolButton();
  map.pm.enableGlobalRemovalMode();
}

function initGeomanEvents() {
  map.pm.setGlobalOptions({ layerGroup: scenarioObjectsLayer });

  map.on("pm:create", (event) => {
    const layer = event.layer;
    const geojson = layer.toGeoJSON();
    const type = activeDrawType || "building";
    const definition = CATEGORY_DEFINITIONS[type];
    const feature = {
      type: "Feature",
      geometry: geojson.geometry,
      properties: {
        scenarioObjectId: createIdLocal("object"),
        type,
        name: definition.defaultName,
        floors: 1,
        function: type === "building" ? "wonen" : type,
        residentialShare: 100,
        notes: ""
      }
    };
    map.removeLayer(layer);
    const active = getActiveScenario();
    if (active) {
      active.objects.features.push(feature);
      active.updatedAt = new Date().toISOString();
      renderScenarioObjects();
      refreshMetrics();
      persistState();
      openObjectEditor(feature);
    }
    stopActiveTool();
  });

  scenarioObjectsLayer.on("pm:edit pm:dragend pm:vertexadded pm:vertexremoved", (event) => {
    const layer = event.layer || event.target;
    if (!layer || !layer.feature) return;
    updateFeatureGeometry(layer.feature, layer.toGeoJSON().geometry);
  });

  scenarioObjectsLayer.on("pm:remove", (event) => {
    const layer = event.layer;
    if (!layer || !layer.feature) return;
    removeScenarioObject(layer.feature.properties.scenarioObjectId);
  });
}

function createIdLocal(prefix) {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function updateFeatureGeometry(feature, geometry) {
  const active = getActiveScenario();
  if (!active) return;
  const target = active.objects.features.find(
    (item) => item.properties.scenarioObjectId === feature.properties.scenarioObjectId
  );
  if (!target) return;
  target.geometry = geometry;
  active.updatedAt = new Date().toISOString();
  refreshMetrics();
  persistState();
  if (state.selectedObjectId === feature.properties.scenarioObjectId) {
    openObjectEditor(target);
  }
}

function removeScenarioObject(scenarioObjectId) {
  const active = getActiveScenario();
  if (!active) return;
  active.objects.features = active.objects.features.filter(
    (item) => item.properties.scenarioObjectId !== scenarioObjectId
  );
  active.updatedAt = new Date().toISOString();
  if (state.selectedObjectId === scenarioObjectId) closeObjectEditor();
  refreshMetrics();
  persistState();
}

function renderScenarioObjects() {
  if (!scenarioObjectsLayer) return;
  scenarioObjectsLayer.clearLayers();
  const active = getActiveScenario();
  if (active) scenarioObjectsLayer.addData(active.objects);
}

function openObjectEditor(feature) {
  state.selectedObjectId = feature.properties.scenarioObjectId;
  el("object-editor-section").classList.remove("hidden");
  el("empty-editor-section").classList.add("hidden");

  el("object-type").value = feature.properties.type;
  el("object-name").value = feature.properties.name || "";
  el("object-floors").value = feature.properties.floors || 1;
  el("object-function").value = feature.properties.function || "wonen";
  el("object-residential-share").value = feature.properties.residentialShare || 0;
  el("object-residential-output").textContent = `${feature.properties.residentialShare || 0}%`;
  el("object-notes").value = feature.properties.notes || "";
  el("building-fields").classList.toggle("hidden", feature.properties.type !== "building");

  const area = turf.area(feature);
  el("object-area").textContent = formatArea(area);
  const floors = feature.properties.type === "building" ? Math.max(1, Number(feature.properties.floors) || 1) : 1;
  el("object-bvo").textContent = formatArea(feature.properties.type === "building" ? area * floors : area);
}

function closeObjectEditor() {
  state.selectedObjectId = null;
  el("object-editor-section").classList.add("hidden");
  el("empty-editor-section").classList.remove("hidden");
}

function getSelectedObjectFeature() {
  const active = getActiveScenario();
  if (!active || !state.selectedObjectId) return null;
  return active.objects.features.find((item) => item.properties.scenarioObjectId === state.selectedObjectId) || null;
}

function updateSelectedObject() {
  const feature = getSelectedObjectFeature();
  if (!feature) return;
  const active = getActiveScenario();
  feature.properties.type = el("object-type").value;
  feature.properties.name = el("object-name").value;
  feature.properties.floors = Math.max(1, Number(el("object-floors").value) || 1);
  feature.properties.function = el("object-function").value;
  feature.properties.residentialShare = Number(el("object-residential-share").value) || 0;
  feature.properties.notes = el("object-notes").value;
  el("object-residential-output").textContent = `${feature.properties.residentialShare}%`;
  el("building-fields").classList.toggle("hidden", feature.properties.type !== "building");
  active.updatedAt = new Date().toISOString();
  renderScenarioObjects();
  openObjectEditor(feature);
  refreshMetrics();
  persistState();
}

function deleteSelectedObject() {
  if (!state.selectedObjectId) return;
  removeScenarioObject(state.selectedObjectId);
  renderScenarioObjects();
}

function computeScenarioMetrics(scenario) {
  const siteArea = scenario.parcels.features.reduce((sum, feature) => sum + turf.area(feature), 0);
  const objects = scenario.objects.features.map((feature) => ({
    type: feature.properties.type,
    area: turf.area(feature),
    floors: feature.properties.floors,
    residentialShare: feature.properties.residentialShare
  }));
  return calculateMetrics({ siteArea, objects, assumptions: scenario.assumptions });
}

function refreshMetrics() {
  const active = getActiveScenario();
  if (!active) return;
  const metrics = computeScenarioMetrics(active);

  el("metric-site-area").textContent = formatArea(metrics.siteArea);
  el("metric-bvo").textContent = formatArea(metrics.grossFloorArea);
  el("metric-footprint").textContent = formatArea(metrics.footprintArea);
  el("metric-fsi").textContent = formatNumber(metrics.fsi, 2);
  el("metric-gsi").textContent = formatPercent(metrics.gsi);
  el("metric-green").textContent = formatPercent(metrics.greenRatio);
  el("metric-dwellings").textContent = formatNumber(metrics.dwellings, 0);
  el("metric-parking-balance").textContent = formatNumber(metrics.parkingBalance, 1);
  el("metric-unallocated").textContent = formatArea(metrics.unallocatedArea);

  const note = el("metrics-note");
  const warningDot = el("metric-warning");
  if (active.parcels.features.length === 0) {
    note.textContent = "Selecteer minimaal een kavel voor verhoudingsgetallen.";
    warningDot.title = "Geen plangebied geselecteerd";
    warningDot.classList.add("status-dot-warning");
  } else if (metrics.overdrawnArea > 0) {
    note.textContent = `Programma overschrijdt het plangebied met ${formatArea(metrics.overdrawnArea)}.`;
    warningDot.title = "Programma past niet binnen het plangebied";
    warningDot.classList.add("status-dot-warning");
  } else {
    note.textContent = `${formatArea(metrics.unallocatedArea)} nog niet toegewezen binnen het plangebied.`;
    warningDot.title = "Geen waarschuwingen";
    warningDot.classList.remove("status-dot-warning");
  }
}

function refreshAssumptionFields() {
  const active = getActiveScenario();
  if (!active) return;
  const assumptions = active.assumptions;
  el("assumption-net-gross").value = Math.round(assumptions.netGrossRatio * 100);
  el("assumption-dwelling-area").value = assumptions.averageDwellingArea;
  el("assumption-parking-norm").value = assumptions.parkingNorm;
  el("assumption-parking-area").value = assumptions.parkingSpaceArea;
}

function applyAssumptionsFromForm() {
  const active = getActiveScenario();
  if (!active) return;
  active.assumptions = {
    netGrossRatio: Math.min(1, Math.max(0.01, Number(el("assumption-net-gross").value) / 100 || 0.75)),
    averageDwellingArea: Math.max(20, Number(el("assumption-dwelling-area").value) || 75),
    parkingNorm: Math.max(0, Number(el("assumption-parking-norm").value) || 0.8),
    parkingSpaceArea: Math.max(10, Number(el("assumption-parking-area").value) || 25)
  };
  active.updatedAt = new Date().toISOString();
  refreshMetrics();
  persistState();
}

const COMPARE_ROWS = [
  { key: "siteArea", label: "Plangebied", format: formatArea },
  { key: "grossFloorArea", label: "BVO", format: formatArea },
  { key: "footprintArea", label: "Bebouwd oppervlak", format: formatArea },
  { key: "fsi", label: "FSI", format: (value) => formatNumber(value, 2) },
  { key: "gsi", label: "GSI", format: formatPercent },
  { key: "greenRatio", label: "Groen", format: formatPercent },
  { key: "dwellings", label: "Woningen", format: (value) => formatNumber(value, 0) },
  { key: "parkingBalance", label: "Parkeerbalans", format: (value) => formatNumber(value, 1) }
];

function populateCompareSelect(select, preferredId) {
  select.innerHTML = "";
  state.scenarios.forEach((scenario) => {
    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = scenario.name;
    select.appendChild(option);
  });
  if (preferredId && state.scenarios.some((scenario) => scenario.id === preferredId)) {
    select.value = preferredId;
  }
}

function openCompareDialog() {
  if (state.scenarios.length < 1) return;
  const selectA = el("compare-a");
  const selectB = el("compare-b");
  const active = getActiveScenario();
  const other = state.scenarios.find((scenario) => scenario.id !== active.id) || active;
  populateCompareSelect(selectA, active.id);
  populateCompareSelect(selectB, other.id);
  updateCompareTable();
  el("compare-dialog").showModal();
}

function updateCompareTable() {
  const scenarioA = state.scenarios.find((scenario) => scenario.id === el("compare-a").value);
  const scenarioB = state.scenarios.find((scenario) => scenario.id === el("compare-b").value);
  el("compare-a-heading").textContent = scenarioA ? scenarioA.name : "A";
  el("compare-b-heading").textContent = scenarioB ? scenarioB.name : "B";
  const body = el("compare-table-body");
  body.innerHTML = "";
  if (!scenarioA || !scenarioB) return;

  const metricsA = computeScenarioMetrics(scenarioA);
  const metricsB = computeScenarioMetrics(scenarioB);

  COMPARE_ROWS.forEach((row) => {
    const tr = document.createElement("tr");
    const diff = metricsB[row.key] - metricsA[row.key];
    tr.innerHTML = `<td>${row.label}</td><td>${row.format(metricsA[row.key])}</td><td>${row.format(metricsB[row.key])}</td><td>${diff >= 0 ? "+" : ""}${row.format(diff)}</td>`;
    body.appendChild(tr);
  });
}

function downloadFile(filename, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "scenario";
}

function exportScenarioJson() {
  const active = getActiveScenario();
  if (!active) return;
  const bundle = makeExportBundle(active);
  downloadFile(`${slugify(active.name)}.json`, JSON.stringify(bundle, null, 2), "application/json");
  showToast("Scenario geexporteerd als JSON.");
}

function exportScenarioGeoJson() {
  const active = getActiveScenario();
  if (!active) return;
  const geojson = scenarioAsGeoJSON(active);
  downloadFile(`${slugify(active.name)}.geojson`, JSON.stringify(geojson, null, 2), "application/geo+json");
  showToast("Scenario geexporteerd als GeoJSON.");
}

function scenarioFromGeoJson(parsed, fallbackName) {
  const scenario = createScenario(fallbackName);
  const features = Array.isArray(parsed.features) ? parsed.features : [];
  features.forEach((feature) => {
    const role = feature.properties && feature.properties.scenarioRole;
    if (role === "scenario-object") {
      scenario.objects.features.push(feature);
    } else {
      scenario.parcels.features.push(feature);
    }
  });
  return scenario;
}

function importScenarioFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      let scenario;
      if (parsed && parsed.format === "ruimtescenario-pdok" && parsed.scenario) {
        scenario = normalizeScenario(parsed.scenario);
      } else if (parsed && parsed.type === "FeatureCollection") {
        scenario = scenarioFromGeoJson(parsed, parsed.name || "Geimporteerd scenario");
      } else if (parsed && (parsed.parcels || parsed.objects)) {
        scenario = normalizeScenario(parsed);
      } else {
        throw new Error("Onbekend bestandsformaat");
      }
      state.scenarios.push(scenario);
      switchScenario(scenario.id);
      persistState();
      showToast("Scenario geimporteerd.");
    } catch (error) {
      console.error(error);
      showToast("Kon dit bestand niet importeren.", "warning");
    }
  };
  reader.readAsText(file);
}

function addDemoScenario() {
  const scenario = createDemoScenario();
  state.scenarios.push(scenario);
  switchScenario(scenario.id);
  persistState();
  const bounds = getGeometryBounds(scenario.parcels.features[0].geometry);
  if (bounds) {
    map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]], { padding: [40, 40] });
  }
  showToast("Demonstratiescenario toegevoegd.");
}

function resetAllData() {
  if (!window.confirm("Alle lokale scenario's en instellingen verwijderen?")) return;
  localStorage.removeItem(CONFIG.storageKey);
  const scenario = createScenario("Scenario 1");
  state.scenarios = [scenario];
  state.activeScenarioId = scenario.id;
  state.loadedParcels = { type: "FeatureCollection", features: [] };
  renderLoadedParcels();
  switchScenario(scenario.id);
  persistState();
  showToast("Lokale gegevens zijn hersteld.");
}

function bindLayerToggles() {
  el("toggle-loaded-parcels").addEventListener("change", (event) => {
    toggleMapLayer(loadedParcelsLayer, event.target.checked);
  });
  el("toggle-selected-parcels").addEventListener("change", (event) => {
    toggleMapLayer(selectedParcelsLayer, event.target.checked);
  });
  el("toggle-scenario-objects").addEventListener("change", (event) => {
    toggleMapLayer(scenarioObjectsLayer, event.target.checked);
  });
}

function toggleMapLayer(layer, visible) {
  if (!layer || !map) return;
  if (visible && !map.hasLayer(layer)) map.addLayer(layer);
  if (!visible && map.hasLayer(layer)) map.removeLayer(layer);
}

function bindLegend() {
  const toggle = el("legend-toggle");
  const content = el("legend-content");
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    content.classList.toggle("hidden", expanded);
  });
}

function bindUI() {
  el("scenario-select").addEventListener("change", (event) => switchScenario(event.target.value));
  el("scenario-name").addEventListener("input", (event) => renameActiveScenario(event.target.value));
  el("new-scenario-button").addEventListener("click", createNewScenario);
  el("duplicate-scenario-button").addEventListener("click", duplicateActiveScenario);
  el("delete-scenario-button").addEventListener("click", deleteActiveScenario);

  bindLocationSearch();

  el("load-parcels-button").addEventListener("click", loadParcels);
  el("clear-parcels-button").addEventListener("click", clearSelectedParcels);

  document.querySelectorAll(".draw-button").forEach((button) => {
    button.addEventListener("click", () => startDrawing(button.dataset.drawType));
  });
  el("edit-mode-button").addEventListener("click", startEditMode);
  el("remove-mode-button").addEventListener("click", startRemoveMode);
  el("stop-tool-button").addEventListener("click", stopActiveTool);

  bindLayerToggles();
  bindLegend();

  el("close-object-editor").addEventListener("click", closeObjectEditor);
  el("delete-object-button").addEventListener("click", deleteSelectedObject);
  ["object-type", "object-name", "object-floors", "object-function", "object-notes"].forEach((id) => {
    el(id).addEventListener("input", updateSelectedObject);
    el(id).addEventListener("change", updateSelectedObject);
  });
  el("object-residential-share").addEventListener("input", updateSelectedObject);

  ["assumption-net-gross", "assumption-dwelling-area", "assumption-parking-norm", "assumption-parking-area"].forEach(
    (id) => el(id).addEventListener("input", applyAssumptionsFromForm)
  );

  el("compare-button").addEventListener("click", openCompareDialog);
  el("compare-a").addEventListener("change", updateCompareTable);
  el("compare-b").addEventListener("change", updateCompareTable);

  el("export-json-button").addEventListener("click", exportScenarioJson);
  el("export-geojson-button").addEventListener("click", exportScenarioGeoJson);
  el("import-button").addEventListener("click", () => el("import-input").click());
  el("import-input").addEventListener("change", (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) importScenarioFile(file);
    event.target.value = "";
  });

  el("demo-button").addEventListener("click", addDemoScenario);
  el("reset-button").addEventListener("click", resetAllData);

  el("help-button").addEventListener("click", () => el("help-dialog").showModal());
}

function init() {
  if (!window.L || !window.L.PM || !window.turf) {
    el("dependency-error").classList.remove("hidden");
    return;
  }
  loadState();
  initMap();
  renderScenarioSelect();
  refreshAssumptionFields();
  renderLoadedParcels();
  renderSelectedParcels();
  renderScenarioObjects();
  refreshMetrics();
  bindUI();
}

document.addEventListener("DOMContentLoaded", init);
