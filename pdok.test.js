import { CONFIG, CATEGORY_DEFINITIONS } from "./config.js";
import { calculateMetrics, formatArea, formatNumber, formatPercent } from "./calculations.js";
import {
  buildLocationSearchUrl,
  buildParcelUrl,
  getDisplayName,
  getGeometryBounds,
  parcelKey
} from "./pdok.js";
import {
  cloneScenario,
  createId,
  createScenario,
  makeExportBundle,
  normalizeScenario,
  scenarioAsGeoJSON
} from "./scenarios.js";
import { createDemoScenario } from "./demo.js";

const dependencyError = document.getElementById("dependency-error");
if (!globalThis.L || !globalThis.turf || !globalThis.L.PM) {
  dependencyError?.classList.remove("hidden");
  throw new Error("Leaflet, Leaflet-Geoman of Turf kon niet worden geladen.");
}

const L = globalThis.L;
const turf = globalThis.turf;

const byId = (id) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Element #${id} ontbreekt.`);
  return element;
};

const elements = {
  saveStatus: byId("save-status"),
  scenarioCount: byId("scenario-count"),
  scenarioSelect: byId("scenario-select"),
  scenarioName: byId("scenario-name"),
  newScenario: byId("new-scenario-button"),
  duplicateScenario: byId("duplicate-scenario-button"),
  deleteScenario: byId("delete-scenario-button"),
  locationSearch: byId("location-search"),
  clearSearch: byId("clear-search-button"),
  searchResults: byId("search-results"),
  loadParcels: byId("load-parcels-button"),
  clearParcels: byId("clear-parcels-button"),
  parcelStatus: byId("parcel-status"),
  selectedParcelCount: byId("selected-parcel-count"),
  editMode: byId("edit-mode-button"),
  removeMode: byId("remove-mode-button"),
  stopTool: byId("stop-tool-button"),
  mapProgress: byId("map-progress"),
  mapProgressText: byId("map-progress-text"),
  mapTip: byId("map-tip"),
  toggleLoadedParcels: byId("toggle-loaded-parcels"),
  toggleSelectedParcels: byId("toggle-selected-parcels"),
  toggleScenarioObjects: byId("toggle-scenario-objects"),
  demo: byId("demo-button"),
  reset: byId("reset-button"),
  compare: byId("compare-button"),
  exportJson: byId("export-json-button"),
  exportGeoJson: byId("export-geojson-button"),
  importButton: byId("import-button"),
  importInput: byId("import-input"),
  help: byId("help-button"),
  metricWarning: byId("metric-warning"),
  metricSiteArea: byId("metric-site-area"),
  metricBvo: byId("metric-bvo"),
  metricFootprint: byId("metric-footprint"),
  metricFsi: byId("metric-fsi"),
  metricGsi: byId("metric-gsi"),
  metricGreen: byId("metric-green"),
  metricDwellings: byId("metric-dwellings"),
  metricParkingBalance: byId("metric-parking-balance"),
  metricUnallocated: byId("metric-unallocated"),
  metricsNote: byId("metrics-note"),
  assumptionNetGross: byId("assumption-net-gross"),
  assumptionDwellingArea: byId("assumption-dwelling-area"),
  assumptionParkingNorm: byId("assumption-parking-norm"),
  assumptionParkingArea: byId("assumption-parking-area"),
  objectEditor: byId("object-editor-section"),
  emptyEditor: byId("empty-editor-section"),
  closeObjectEditor: byId("close-object-editor"),
  objectType: byId("object-type"),
  objectName: byId("object-name"),
  buildingFields: byId("building-fields"),
  objectFloors: byId("object-floors"),
  objectFunction: byId("object-function"),
  objectResidentialShare: byId("object-residential-share"),
  objectResidentialOutput: byId("object-residential-output"),
  objectNotes: byId("object-notes"),
  objectArea: byId("object-area"),
  objectBvo: byId("object-bvo"),
  deleteObject: byId("delete-object-button"),
  compareDialog: byId("compare-dialog"),
  compareA: byId("compare-a"),
  compareB: byId("compare-b"),
  compareAHeading: byId("compare-a-heading"),
  compareBHeading: byId("compare-b-heading"),
  compareTableBody: byId("compare-table-body"),
  helpDialog: byId("help-dialog"),
  legendToggle: byId("legend-toggle"),
  legendContent: byId("legend-content"),
  toastContainer: byId("toast-container")
};

const drawButtons = [...document.querySelectorAll("[data-draw-type]")];

let appState = loadState();
let map;
let baseLayers;
let loadedParcelsLayer;
let selectedParcelsLayer;
let scenarioObjectsLayer;
let searchHighlightLayer;
let loadedParcelCollection = { type: "FeatureCollection", features: [] };
let objectLayersById = new Map();
let selectedObjectId = null;
let activeDrawType = null;
let editModeEnabled = false;
let removeModeEnabled = false;
let searchRequestSequence = 0;
let lastTileErrorShown = false;
let saveStatusTimer;

initialize();

function initialize() {
  initializeMap();
  bindEvents();
  renderAll();
  updateParcelZoomHint();

  const mapContainer = byId("map");
  if (globalThis.ResizeObserver) {
    new ResizeObserver(() => map.invalidateSize({ pan: false })).observe(mapContainer);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      const scenarios = Array.isArray(parsed.scenarios)
        ? parsed.scenarios.map(normalizeScenario)
        : [];
      if (scenarios.length > 0) {
        const activeScenarioId = scenarios.some((item) => item.id === parsed.activeScenarioId)
          ? parsed.activeScenarioId
          : scenarios[0].id;
        return {
          scenarios,
          activeScenarioId,
          mapView: parsed.mapView ?? null
        };
      }
    }
  } catch (error) {
    console.warn("Lokale gegevens konden niet worden gelezen.", error);
  }

  const firstScenario = createScenario("Scenario A");
  return {
    scenarios: [firstScenario],
    activeScenarioId: firstScenario.id,
    mapView: null
  };
}

function currentScenario() {
  return appState.scenarios.find((scenario) => scenario.id === appState.activeScenarioId) ?? appState.scenarios[0];
}

function touchScenario() {
  const scenario = currentScenario();
  if (scenario) scenario.updatedAt = new Date().toISOString();
}

function persistState(message = "Lokaal opgeslagen") {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(appState));
    elements.saveStatus.textContent = "Opslaan...";
    clearTimeout(saveStatusTimer);
    saveStatusTimer = setTimeout(() => {
      elements.saveStatus.textContent = message;
    }, 280);
  } catch (error) {
    console.error(error);
    elements.saveStatus.textContent = "Opslaan mislukt";
    showToast("Lokale opslag is niet beschikbaar. Exporteer het scenario om gegevens te bewaren.", "error");
  }
}

function initializeMap() {
  if (typeof L.PM.setOptIn === "function") L.PM.setOptIn(true);

  const savedView = appState.mapView;
  const center = savedView?.center ?? CONFIG.initialView.center;
  const zoom = savedView?.zoom ?? CONFIG.initialView.zoom;

  map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
    minZoom: 7,
    maxZoom: 20
  }).setView(center, zoom);

  const tileOptions = {
    maxZoom: 20,
    maxNativeZoom: 19,
    attribution: 'Kaartgegevens: <a href="https://www.pdok.nl/" target="_blank" rel="noopener">PDOK / Kadaster</a>, CC BY 4.0'
  };

  baseLayers = {
    "PDOK standaard": L.tileLayer(CONFIG.pdok.tileLayers.standaard, tileOptions),
    "PDOK grijs": L.tileLayer(CONFIG.pdok.tileLayers.grijs, tileOptions),
    "PDOK pastel": L.tileLayer(CONFIG.pdok.tileLayers.pastel, tileOptions)
  };

  baseLayers["PDOK pastel"].addTo(map);
  Object.values(baseLayers).forEach((layer) => {
    layer.on("tileerror", () => {
      if (!lastTileErrorShown) {
        lastTileErrorShown = true;
        showToast("Een deel van de PDOK-achtergrondkaart kon niet worden geladen.", "error");
      }
    });
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.control.scale({ position: "bottomright", imperial: false, maxWidth: 130 }).addTo(map);
  L.control.layers(baseLayers, {}, { position: "bottomright", collapsed: true }).addTo(map);

  loadedParcelsLayer = L.geoJSON(null, {
    pmIgnore: true,
    style: parcelStyle,
    onEachFeature: (feature, layer) => registerLoadedParcelLayer(feature, layer)
  }).addTo(map);

  selectedParcelsLayer = L.geoJSON(null, {
    pmIgnore: true,
    style: selectedParcelStyle,
    onEachFeature: (feature, layer) => registerSelectedParcelLayer(feature, layer)
  }).addTo(map);

  scenarioObjectsLayer = L.featureGroup([], { pmIgnore: true }).addTo(map);
  searchHighlightLayer = L.featureGroup([], { pmIgnore: true }).addTo(map);

  map.on("click", () => {
    if (!editModeEnabled && !removeModeEnabled && !activeDrawType) selectObject(null);
  });
  map.on("zoomend", updateParcelZoomHint);
  map.on("moveend", () => {
    const centerPoint = map.getCenter();
    appState.mapView = {
      center: [centerPoint.lat, centerPoint.lng],
      zoom: map.getZoom()
    };
    persistState();
  });
  map.on("pm:create", handleObjectCreated);
  map.on("pm:remove", handleObjectRemoved);
}

function parcelStyle(feature) {
  const selectedKeys = getSelectedParcelKeys();
  const isSelected = selectedKeys.has(parcelKey(feature));
  return {
    color: isSelected ? "#9d6a00" : "#4d625d",
    weight: isSelected ? 3 : 1.2,
    opacity: 0.9,
    fillColor: isSelected ? "#f6b73c" : "#ffffff",
    fillOpacity: isSelected ? 0.35 : 0.06
  };
}

function selectedParcelStyle() {
  return {
    color: "#9d6a00",
    weight: 3,
    opacity: 1,
    fillColor: "#f6b73c",
    fillOpacity: 0.28
  };
}

function objectStyle(type, isSelected = false) {
  const definition = CATEGORY_DEFINITIONS[type] ?? CATEGORY_DEFINITIONS.public;
  return {
    color: definition.color,
    fillColor: definition.color,
    fillOpacity: isSelected ? Math.min(0.7, definition.fillOpacity + 0.12) : definition.fillOpacity,
    weight: isSelected ? 4 : 2,
    opacity: 0.95
  };
}

function registerLoadedParcelLayer(feature, layer) {
  layer.options.pmIgnore = true;
  layer.bindTooltip(parcelLabel(feature), { sticky: true, opacity: 0.94 });
  layer.on("click", (event) => {
    L.DomEvent.stopPropagation(event.originalEvent);
    toggleParcelSelection(feature);
  });
}

function registerSelectedParcelLayer(feature, layer) {
  layer.options.pmIgnore = true;
  layer.bindTooltip(`${parcelLabel(feature)} - klik om te verwijderen`, { sticky: true, opacity: 0.94 });
  layer.on("click", (event) => {
    L.DomEvent.stopPropagation(event.originalEvent);
    removeSelectedParcel(feature.properties?.pdokKey ?? parcelKey(feature));
  });
}

function parcelLabel(feature) {
  const properties = feature?.properties ?? {};
  const municipality = properties.kadastrale_gemeente_waarde || properties.akr_kadastrale_gemeente_code_waarde;
  const section = properties.sectie;
  const number = properties.perceelnummer;
  const cadastralParts = [municipality, section, number].filter((value) => value !== undefined && value !== null && String(value).trim());

  return String(
    properties.kadastraleAanduiding ||
    (cadastralParts.length >= 2 ? cadastralParts.join(" ") : "") ||
    properties.identificatie_lokaal_id ||
    properties.identificatie ||
    properties.displayName ||
    number ||
    "Kadastraal perceel"
  );
}

function getSelectedParcelKeys() {
  return new Set(
    currentScenario().parcels.features.map((feature) => feature.properties?.pdokKey ?? parcelKey(feature))
  );
}

function renderAll() {
  renderScenarioControls();
  renderSelectedParcels();
  renderScenarioObjects();
  renderAssumptions();
  renderMetrics();
  renderObjectEditor();
  renderToolState();
}

function renderScenarioControls() {
  const scenario = currentScenario();
  elements.scenarioSelect.replaceChildren();
  for (const item of appState.scenarios) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    option.selected = item.id === scenario.id;
    elements.scenarioSelect.append(option);
  }
  elements.scenarioName.value = scenario.name;
  elements.scenarioCount.textContent = String(appState.scenarios.length);
  elements.deleteScenario.disabled = appState.scenarios.length <= 1;
  elements.selectedParcelCount.textContent = String(scenario.parcels.features.length);
}

function renderSelectedParcels() {
  selectedParcelsLayer.clearLayers();
  selectedParcelsLayer.addData(currentScenario().parcels);
  loadedParcelsLayer.setStyle(parcelStyle);
  elements.selectedParcelCount.textContent = String(currentScenario().parcels.features.length);
  applyLayerVisibility();
}

function renderScenarioObjects() {
  scenarioObjectsLayer.clearLayers();
  objectLayersById = new Map();
  const scenario = currentScenario();
  const validFeatures = [];

  scenario.objects.features.forEach((feature, index) => {
    if (!feature?.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) return;
    ensureObjectProperties(feature, index);
    validFeatures.push(feature);
    const layerGroup = L.geoJSON(feature, {
      pmIgnore: false,
      style: objectStyle(feature.properties.type, feature.properties.scenarioObjectId === selectedObjectId)
    });

    layerGroup.eachLayer((layer) => registerObjectLayer(feature, layer));
  });

  if (validFeatures.length !== scenario.objects.features.length) {
    scenario.objects.features = validFeatures;
    touchScenario();
    persistState();
  }
  applyLayerVisibility();
}

function ensureObjectProperties(feature, index = 0) {
  feature.properties ??= {};
  const properties = feature.properties;
  if (!properties.scenarioObjectId) properties.scenarioObjectId = createId("object");
  if (!CATEGORY_DEFINITIONS[properties.type]) properties.type = "public";
  if (!properties.name) properties.name = `${CATEGORY_DEFINITIONS[properties.type].defaultName} ${index + 1}`;
  properties.floors = Math.max(1, Math.round(Number(properties.floors) || 1));
  properties.function ||= properties.type === "building" ? "wonen" : properties.type;
  const defaultShare = properties.type === "building" && properties.function !== "werken" ? 100 : 0;
  properties.residentialShare = Math.min(100, Math.max(0, Number(properties.residentialShare ?? defaultShare)));
  properties.notes ||= "";
}

function registerObjectLayer(feature, layer) {
  const id = feature.properties.scenarioObjectId;
  layer.feature = feature;
  layer.options.pmIgnore = false;
  layer._scenarioObjectId = id;
  layer.setStyle?.(objectStyle(feature.properties.type, id === selectedObjectId));
  scenarioObjectsLayer.addLayer(layer);
  if (typeof L.PM.reInitLayer === "function") L.PM.reInitLayer(layer);

  const existing = objectLayersById.get(id) ?? [];
  existing.push(layer);
  objectLayersById.set(id, existing);

  layer.bindTooltip(feature.properties.name, { sticky: true, opacity: 0.94 });
  layer.on("click", (event) => {
    L.DomEvent.stopPropagation(event.originalEvent);
    selectObject(id);
  });
  layer.on("pm:edit", () => syncObjectGeometry(layer));
  layer.on("pm:dragend", () => syncObjectGeometry(layer));
  layer.on("pm:rotateend", () => syncObjectGeometry(layer));
}

function renderAssumptions() {
  const assumptions = currentScenario().assumptions;
  elements.assumptionNetGross.value = String(Math.round(Number(assumptions.netGrossRatio) * 100));
  elements.assumptionDwellingArea.value = String(assumptions.averageDwellingArea);
  elements.assumptionParkingNorm.value = String(assumptions.parkingNorm);
  elements.assumptionParkingArea.value = String(assumptions.parkingSpaceArea);
}

function scenarioMetrics(scenario) {
  const siteArea = sumFeatureArea(scenario.parcels.features);
  const objects = scenario.objects.features.map((feature) => ({
    type: feature.properties?.type,
    area: featureArea(feature),
    floors: feature.properties?.floors,
    residentialShare: feature.properties?.residentialShare
  }));
  return calculateMetrics({ siteArea, objects, assumptions: scenario.assumptions });
}

function renderMetrics() {
  const metrics = scenarioMetrics(currentScenario());
  elements.metricSiteArea.textContent = formatArea(metrics.siteArea);
  elements.metricBvo.textContent = formatArea(metrics.grossFloorArea);
  elements.metricFootprint.textContent = formatArea(metrics.footprintArea);
  elements.metricFsi.textContent = formatNumber(metrics.fsi, 2);
  elements.metricGsi.textContent = formatPercent(metrics.gsi, 1);
  elements.metricGreen.textContent = formatPercent(metrics.greenRatio, 1);
  elements.metricDwellings.textContent = formatNumber(metrics.dwellings, 0);
  elements.metricParkingBalance.textContent = signedNumber(metrics.parkingBalance, 0);
  elements.metricUnallocated.textContent = formatArea(metrics.unallocatedArea);

  elements.metricParkingBalance.classList.toggle("negative", metrics.parkingBalance < -0.49);
  elements.metricParkingBalance.classList.toggle("positive", metrics.parkingBalance >= -0.49);

  const hasWarning = metrics.siteArea === 0 || metrics.overdrawnArea > 1;
  elements.metricWarning.classList.toggle("warning", hasWarning);
  if (metrics.siteArea === 0) {
    elements.metricWarning.title = "Geen plangebied geselecteerd";
    elements.metricsNote.textContent = "Selecteer minimaal een kavel voor verhoudingsgetallen.";
    elements.metricsNote.className = "inline-status";
  } else if (metrics.overdrawnArea > 1) {
    elements.metricWarning.title = "Getekende grondoppervlakken zijn groter dan het plangebied";
    elements.metricsNote.textContent = `Let op: grondfuncties overschrijden het plangebied indicatief met ${formatArea(metrics.overdrawnArea)}. Overlap kan hiervan de oorzaak zijn.`;
    elements.metricsNote.className = "inline-status error";
  } else {
    elements.metricWarning.title = "Geen oppervlaktewaarschuwingen";
    elements.metricsNote.textContent = `Parkeervraag ${formatNumber(metrics.parkingDemand, 0)} plaatsen; getekende capaciteit ${formatNumber(metrics.parkingSupply, 0)} plaatsen.`;
    elements.metricsNote.className = "inline-status success";
  }
}

function featureArea(feature) {
  try {
    return Math.max(0, turf.area(feature));
  } catch {
    return 0;
  }
}

function sumFeatureArea(features) {
  return features.reduce((total, feature) => total + featureArea(feature), 0);
}

function selectObject(id) {
  selectedObjectId = id;
  refreshObjectStyles();
  renderObjectEditor();
}

function refreshObjectStyles() {
  for (const [id, layers] of objectLayersById.entries()) {
    const feature = findObject(id);
    if (!feature) continue;
    layers.forEach((layer) => {
      layer.setStyle?.(objectStyle(feature.properties.type, id === selectedObjectId));
      layer.setTooltipContent?.(feature.properties.name);
    });
  }
}

function findObject(id) {
  return currentScenario().objects.features.find((feature) => feature.properties?.scenarioObjectId === id);
}

function renderObjectEditor() {
  const feature = selectedObjectId ? findObject(selectedObjectId) : null;
  const visible = Boolean(feature);
  elements.objectEditor.classList.toggle("hidden", !visible);
  elements.emptyEditor.classList.toggle("hidden", visible);
  if (!feature) return;

  ensureObjectProperties(feature);
  const properties = feature.properties;
  elements.objectType.value = properties.type;
  elements.objectName.value = properties.name;
  elements.objectFloors.value = String(properties.floors);
  elements.objectFunction.value = properties.function;
  elements.objectResidentialShare.value = String(properties.residentialShare);
  elements.objectResidentialOutput.value = `${Math.round(properties.residentialShare)}%`;
  elements.objectNotes.value = properties.notes;
  elements.buildingFields.classList.toggle("hidden", properties.type !== "building");

  const area = featureArea(feature);
  const bvo = properties.type === "building" ? area * properties.floors : 0;
  elements.objectArea.textContent = formatArea(area);
  elements.objectBvo.textContent = formatArea(bvo);
}

function updateSelectedObjectFromForm() {
  const feature = selectedObjectId ? findObject(selectedObjectId) : null;
  if (!feature) return;
  const properties = feature.properties;
  properties.type = elements.objectType.value;
  properties.name = elements.objectName.value.trim() || CATEGORY_DEFINITIONS[properties.type].defaultName;
  properties.floors = Math.max(1, Math.round(Number(elements.objectFloors.value) || 1));
  properties.function = elements.objectFunction.value;
  properties.residentialShare = properties.type === "building"
    ? Math.min(100, Math.max(0, Number(elements.objectResidentialShare.value) || 0))
    : 0;
  properties.notes = elements.objectNotes.value;
  elements.objectResidentialOutput.value = `${Math.round(properties.residentialShare)}%`;
  elements.buildingFields.classList.toggle("hidden", properties.type !== "building");
  touchScenario();
  persistState();
  refreshObjectStyles();
  renderMetrics();

  const area = featureArea(feature);
  elements.objectArea.textContent = formatArea(area);
  elements.objectBvo.textContent = formatArea(properties.type === "building" ? area * properties.floors : 0);
}

function syncObjectGeometry(layer) {
  const id = layer._scenarioObjectId;
  const feature = findObject(id);
  if (!feature) return;
  const geometry = layer.toGeoJSON(7).geometry;
  if (!geometry) return;

  if ((objectLayersById.get(id)?.length ?? 0) > 1) {
    showToast("Een geïmporteerd meerdelig object wordt bij bewerken als afzonderlijk vlak opgeslagen.");
  }
  feature.geometry = geometry;
  touchScenario();
  persistState();
  renderMetrics();
  if (selectedObjectId === id) renderObjectEditor();
}

function handleObjectCreated(event) {
  if (event.shape !== "Polygon" && event.shape !== "Rectangle") return;
  const type = activeDrawType ?? "building";
  const layer = event.layer;
  map.removeLayer(layer);

  const feature = layer.toGeoJSON(7);
  feature.properties = {
    scenarioObjectId: createId("object"),
    type,
    name: CATEGORY_DEFINITIONS[type].defaultName,
    floors: type === "building" ? 3 : 1,
    function: type === "building" ? "wonen" : type,
    residentialShare: type === "building" ? 100 : 0,
    notes: ""
  };
  currentScenario().objects.features.push(feature);
  registerObjectLayer(feature, layer);
  selectedObjectId = feature.properties.scenarioObjectId;
  touchScenario();
  persistState();
  stopAllTools();
  renderMetrics();
  renderObjectEditor();
  refreshObjectStyles();
  showToast(`${CATEGORY_DEFINITIONS[type].label} toegevoegd.`, "success");
}

function handleObjectRemoved(event) {
  const id = event.layer?._scenarioObjectId;
  if (!id) return;
  const scenario = currentScenario();
  scenario.objects.features = scenario.objects.features.filter((feature) => feature.properties?.scenarioObjectId !== id);
  objectLayersById.delete(id);
  if (selectedObjectId === id) selectedObjectId = null;
  touchScenario();
  persistState();
  renderMetrics();
  renderObjectEditor();
}

function startDrawing(type) {
  stopAllTools({ keepSelection: true });
  activeDrawType = type;
  const definition = CATEGORY_DEFINITIONS[type];
  map.pm.enableDraw("Polygon", {
    allowSelfIntersection: false,
    snappable: true,
    snapDistance: 20,
    finishOn: "dblclick",
    pathOptions: {
      ...objectStyle(type, false),
      pmIgnore: false
    },
    templineStyle: { color: definition.color, dashArray: "6,5" },
    hintlineStyle: { color: definition.color, dashArray: "3,5" }
  });
  elements.mapTip.textContent = `Teken ${definition.label.toLowerCase()}: klik hoekpunten en dubbelklik om af te ronden.`;
  renderToolState();
}

function toggleEditMode() {
  if (editModeEnabled) {
    stopAllTools({ keepSelection: true });
    return;
  }
  if (currentScenario().objects.features.length === 0) {
    showToast("Teken eerst een scenario-object.");
    return;
  }
  stopAllTools({ keepSelection: true });
  map.pm.enableGlobalEditMode({
    allowSelfIntersection: false,
    snappable: true,
    snapDistance: 20
  });
  editModeEnabled = true;
  elements.mapTip.textContent = "Versleep hoekpunten. Klik opnieuw op Bewerken om af te ronden.";
  renderToolState();
}

function toggleRemoveMode() {
  if (removeModeEnabled) {
    stopAllTools({ keepSelection: true });
    return;
  }
  if (currentScenario().objects.features.length === 0) {
    showToast("Er zijn geen scenario-objecten om te verwijderen.");
    return;
  }
  stopAllTools({ keepSelection: true });
  map.pm.enableGlobalRemovalMode();
  removeModeEnabled = true;
  elements.mapTip.textContent = "Klik een scenario-object om het direct te verwijderen.";
  renderToolState();
}

function stopAllTools({ keepSelection = false } = {}) {
  try { map.pm.disableDraw(); } catch { /* geen actieve tekenmodus */ }
  try { map.pm.disableGlobalEditMode(); } catch { /* geen actieve bewerkmodus */ }
  try { map.pm.disableGlobalRemovalMode(); } catch { /* geen actieve verwijdermodus */ }
  activeDrawType = null;
  editModeEnabled = false;
  removeModeEnabled = false;
  elements.mapTip.textContent = "Zoek een locatie of zoom in en kies 'Laad kavels'.";
  if (!keepSelection) selectedObjectId = null;
  renderToolState();
  refreshObjectStyles();
  renderObjectEditor();
}

function renderToolState() {
  drawButtons.forEach((button) => button.classList.toggle("active", button.dataset.drawType === activeDrawType));
  elements.editMode.classList.toggle("active", editModeEnabled);
  elements.removeMode.classList.toggle("active", removeModeEnabled);
  elements.stopTool.classList.toggle("hidden", !activeDrawType && !editModeEnabled && !removeModeEnabled);
}

function bindEvents() {
  elements.scenarioSelect.addEventListener("change", () => {
    stopAllTools();
    appState.activeScenarioId = elements.scenarioSelect.value;
    selectedObjectId = null;
    persistState();
    renderAll();
  });

  elements.scenarioName.addEventListener("input", debounce(() => {
    const scenario = currentScenario();
    scenario.name = elements.scenarioName.value.trim() || "Naamloos scenario";
    touchScenario();
    persistState();
    renderScenarioControls();
  }, 250));

  elements.newScenario.addEventListener("click", () => {
    const scenario = createScenario(`Scenario ${nextScenarioLetter()}`);
    appState.scenarios.push(scenario);
    appState.activeScenarioId = scenario.id;
    selectedObjectId = null;
    stopAllTools();
    persistState();
    renderAll();
    showToast("Nieuw scenario aangemaakt.", "success");
  });

  elements.duplicateScenario.addEventListener("click", () => {
    const duplicate = cloneScenario(currentScenario());
    appState.scenarios.push(duplicate);
    appState.activeScenarioId = duplicate.id;
    selectedObjectId = null;
    stopAllTools();
    persistState();
    renderAll();
    showToast("Scenario gekopieerd.", "success");
  });

  elements.deleteScenario.addEventListener("click", () => {
    if (appState.scenarios.length <= 1) return;
    const scenario = currentScenario();
    if (!globalThis.confirm(`Scenario '${scenario.name}' verwijderen?`)) return;
    appState.scenarios = appState.scenarios.filter((item) => item.id !== scenario.id);
    appState.activeScenarioId = appState.scenarios[0].id;
    selectedObjectId = null;
    stopAllTools();
    persistState();
    renderAll();
    showToast("Scenario verwijderd.");
  });

  elements.locationSearch.addEventListener("input", debounce(handleSearchInput, 300));
  elements.locationSearch.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearSearchResults();
  });
  elements.clearSearch.addEventListener("click", () => {
    searchRequestSequence += 1;
    elements.locationSearch.value = "";
    elements.clearSearch.classList.add("hidden");
    clearSearchResults();
    searchHighlightLayer.clearLayers();
    elements.locationSearch.focus();
  });

  elements.loadParcels.addEventListener("click", () => loadParcels());
  elements.clearParcels.addEventListener("click", clearSelectedParcels);

  drawButtons.forEach((button) => {
    button.addEventListener("click", () => startDrawing(button.dataset.drawType));
  });
  elements.editMode.addEventListener("click", toggleEditMode);
  elements.removeMode.addEventListener("click", toggleRemoveMode);
  elements.stopTool.addEventListener("click", () => stopAllTools({ keepSelection: true }));

  elements.toggleLoadedParcels.addEventListener("change", applyLayerVisibility);
  elements.toggleSelectedParcels.addEventListener("change", applyLayerVisibility);
  elements.toggleScenarioObjects.addEventListener("change", applyLayerVisibility);

  [
    elements.assumptionNetGross,
    elements.assumptionDwellingArea,
    elements.assumptionParkingNorm,
    elements.assumptionParkingArea
  ].forEach((input) => input.addEventListener("input", updateAssumptions));

  [
    elements.objectType,
    elements.objectName,
    elements.objectFloors,
    elements.objectFunction,
    elements.objectResidentialShare,
    elements.objectNotes
  ].forEach((input) => input.addEventListener("input", updateSelectedObjectFromForm));
  elements.objectType.addEventListener("change", updateSelectedObjectFromForm);
  elements.objectFunction.addEventListener("change", updateSelectedObjectFromForm);
  elements.closeObjectEditor.addEventListener("click", () => selectObject(null));
  elements.deleteObject.addEventListener("click", deleteSelectedObject);

  elements.compare.addEventListener("click", openComparison);
  elements.compareA.addEventListener("change", renderComparison);
  elements.compareB.addEventListener("change", renderComparison);
  elements.help.addEventListener("click", () => elements.helpDialog.showModal());

  elements.exportJson.addEventListener("click", exportCurrentScenarioJson);
  elements.exportGeoJson.addEventListener("click", exportCurrentScenarioGeoJson);
  elements.importButton.addEventListener("click", () => elements.importInput.click());
  elements.importInput.addEventListener("change", importScenarioFile);

  elements.demo.addEventListener("click", addDemoScenario);
  elements.reset.addEventListener("click", resetLocalData);

  elements.legendToggle.addEventListener("click", () => {
    const isHidden = elements.legendContent.classList.toggle("hidden");
    elements.legendToggle.setAttribute("aria-expanded", String(!isHidden));
  });

  document.addEventListener("click", (event) => {
    if (!elements.searchResults.contains(event.target) && event.target !== elements.locationSearch) {
      clearSearchResults();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") stopAllTools({ keepSelection: true });
  });
  globalThis.addEventListener("offline", () => showToast("Offline: lokale scenario's blijven beschikbaar, PDOK-data niet.", "error"));
  globalThis.addEventListener("online", () => showToast("Internetverbinding hersteld.", "success"));
}

function nextScenarioLetter() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const index = appState.scenarios.length;
  return alphabet[index] ?? String(index + 1);
}

function updateAssumptions() {
  const assumptions = currentScenario().assumptions;
  assumptions.netGrossRatio = clampNumber(Number(elements.assumptionNetGross.value) / 100, 0.01, 1, 0.75);
  assumptions.averageDwellingArea = clampNumber(elements.assumptionDwellingArea.value, 20, 300, 75);
  assumptions.parkingNorm = clampNumber(elements.assumptionParkingNorm.value, 0, 5, 0.8);
  assumptions.parkingSpaceArea = clampNumber(elements.assumptionParkingArea.value, 10, 60, 25);
  touchScenario();
  persistState();
  renderMetrics();
  if (elements.compareDialog.open) renderComparison();
}

function deleteSelectedObject() {
  if (!selectedObjectId) return;
  const feature = findObject(selectedObjectId);
  if (!feature) return;
  if (!globalThis.confirm(`Object '${feature.properties.name}' verwijderen?`)) return;
  const id = selectedObjectId;
  currentScenario().objects.features = currentScenario().objects.features.filter(
    (item) => item.properties?.scenarioObjectId !== id
  );
  (objectLayersById.get(id) ?? []).forEach((layer) => scenarioObjectsLayer.removeLayer(layer));
  objectLayersById.delete(id);
  selectedObjectId = null;
  touchScenario();
  persistState();
  renderMetrics();
  renderObjectEditor();
  showToast("Object verwijderd.");
}

async function handleSearchInput() {
  const requestNumber = ++searchRequestSequence;
  const query = elements.locationSearch.value.trim();
  elements.clearSearch.classList.toggle("hidden", query.length === 0);
  if (query.length < 2) {
    clearSearchResults();
    return;
  }
  elements.searchResults.replaceChildren(createSearchMessage("Zoeken..."));
  elements.searchResults.classList.remove("hidden");

  try {
    const data = await fetchJson(buildLocationSearchUrl(query), 12000);
    if (requestNumber !== searchRequestSequence) return;
    const features = Array.isArray(data.features) ? data.features.slice(0, 10) : [];
    renderSearchResults(features);
  } catch (error) {
    if (requestNumber !== searchRequestSequence) return;
    console.error(error);
    elements.searchResults.replaceChildren(createSearchMessage("Zoeken via PDOK is tijdelijk niet beschikbaar."));
  }
}

function renderSearchResults(features) {
  elements.searchResults.replaceChildren();
  if (features.length === 0) {
    elements.searchResults.append(createSearchMessage("Geen locaties gevonden."));
    elements.searchResults.classList.remove("hidden");
    return;
  }

  features.forEach((feature) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "search-result";
    button.setAttribute("role", "option");
    const title = document.createElement("strong");
    title.textContent = getDisplayName(feature);
    const subtitle = document.createElement("span");
    subtitle.textContent = String(feature.properties?.collection || feature.properties?.type || feature.geometry?.type || "locatie").replaceAll("_", " ");
    button.append(title, subtitle);
    button.addEventListener("click", () => selectSearchFeature(feature));
    elements.searchResults.append(button);
  });
  elements.searchResults.classList.remove("hidden");
}

function createSearchMessage(text) {
  const message = document.createElement("div");
  message.className = "search-message";
  message.textContent = text;
  return message;
}

function clearSearchResults() {
  elements.searchResults.classList.add("hidden");
  elements.searchResults.replaceChildren();
}

function selectSearchFeature(feature) {
  elements.locationSearch.value = getDisplayName(feature);
  elements.clearSearch.classList.remove("hidden");
  clearSearchResults();
  searchHighlightLayer.clearLayers();

  const highlight = L.geoJSON(feature, {
    pmIgnore: true,
    pointToLayer: (_pointFeature, latlng) => L.circleMarker(latlng, {
      radius: 8,
      color: "#0f3d3e",
      weight: 3,
      fillColor: "#f6b73c",
      fillOpacity: 0.9,
      pmIgnore: true
    }),
    style: {
      color: "#0f3d3e",
      weight: 4,
      fillColor: "#f6b73c",
      fillOpacity: 0.24,
      pmIgnore: true
    }
  });
  highlight.eachLayer((layer) => searchHighlightLayer.addLayer(layer));

  const geometryBounds = getGeometryBounds(feature.geometry);
  if (feature.geometry?.type === "Point") {
    const [lng, lat] = feature.geometry.coordinates;
    map.setView([lat, lng], 18, { animate: true });
  } else if (geometryBounds) {
    map.fitBounds(
      [[geometryBounds.south, geometryBounds.west], [geometryBounds.north, geometryBounds.east]],
      { padding: [45, 45], maxZoom: 18, animate: true }
    );
  }

  elements.mapTip.textContent = "Locatie gevonden. De kadastrale kavels worden geladen.";
  setTimeout(() => loadParcels({ quietValidation: true }), 550);
}

async function loadParcels({ quietValidation = false } = {}) {
  const bounds = map.getBounds();
  const width = map.distance(bounds.getSouthWest(), bounds.getSouthEast());
  const height = map.distance(bounds.getSouthWest(), bounds.getNorthWest());

  if (map.getZoom() < CONFIG.pdok.minParcelZoom) {
    if (!quietValidation) showToast(`Zoom in tot minimaal niveau ${CONFIG.pdok.minParcelZoom}.`);
    setParcelStatus("Zoom verder in om kadastrale kavels op te halen.", "error");
    return;
  }
  if (width > CONFIG.pdok.maxParcelBoxWidthMeters || height > CONFIG.pdok.maxParcelBoxHeightMeters) {
    if (!quietValidation) showToast("Het kaartbeeld is te groot. Zoom verder in.");
    setParcelStatus("Het zichtbare gebied is te groot voor een snelle kavelbevraging.", "error");
    return;
  }

  setMapProgress(true, "PDOK-kavels laden...");
  elements.loadParcels.disabled = true;
  setParcelStatus("Kadastrale percelen worden opgehaald...");

  try {
    const data = await fetchJson(buildParcelUrl({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth()
    }), 18000);

    if (data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
      throw new Error("PDOK gaf geen geldige FeatureCollection terug.");
    }

    loadedParcelCollection = data;
    loadedParcelsLayer.clearLayers();
    loadedParcelsLayer.addData(data);
    loadedParcelsLayer.setStyle(parcelStyle);
    applyLayerVisibility();

    const count = data.features.length;
    const truncated = Number(data.numberMatched) > count || count >= CONFIG.pdok.parcelLimit;
    setParcelStatus(
      truncated
        ? `${count} kavels geladen. Zoom verder in voor een volledige selectie.`
        : `${count} kavels geladen. Klik kavels om ze aan het scenario toe te voegen.`,
      count > 0 ? "success" : ""
    );
    elements.mapTip.textContent = count > 0
      ? "Klik op een of meerdere kavels om het plangebied samen te stellen."
      : "Geen kavels gevonden in dit kaartbeeld.";
  } catch (error) {
    console.error(error);
    setParcelStatus("PDOK-kavels konden niet worden geladen. Probeer opnieuw of gebruik het demonstratiescenario.", "error");
    showToast("De BRK Kadastrale Kaart API is niet bereikbaar.", "error");
  } finally {
    setMapProgress(false);
    elements.loadParcels.disabled = false;
  }
}

function toggleParcelSelection(feature) {
  const key = parcelKey(feature);
  const scenario = currentScenario();
  const existingIndex = scenario.parcels.features.findIndex(
    (item) => (item.properties?.pdokKey ?? parcelKey(item)) === key
  );

  if (existingIndex >= 0) {
    scenario.parcels.features.splice(existingIndex, 1);
  } else {
    const selected = structuredClone(feature);
    selected.properties = {
      ...(selected.properties ?? {}),
      scenarioParcelId: createId("parcel"),
      pdokKey: key,
      source: "PDOK BRK Kadastrale Kaart"
    };
    scenario.parcels.features.push(selected);
  }
  touchScenario();
  persistState();
  renderSelectedParcels();
  renderMetrics();
}

function removeSelectedParcel(key) {
  const scenario = currentScenario();
  scenario.parcels.features = scenario.parcels.features.filter(
    (feature) => (feature.properties?.pdokKey ?? parcelKey(feature)) !== key
  );
  touchScenario();
  persistState();
  renderSelectedParcels();
  renderMetrics();
}

function clearSelectedParcels() {
  const scenario = currentScenario();
  if (scenario.parcels.features.length === 0) return;
  scenario.parcels.features = [];
  touchScenario();
  persistState();
  renderSelectedParcels();
  renderMetrics();
  showToast("Kavelselectie gewist.");
}

function updateParcelZoomHint() {
  if (map.getZoom() < CONFIG.pdok.minParcelZoom) {
    setParcelStatus(`Zoom in tot niveau ${CONFIG.pdok.minParcelZoom} om kavels te laden.`);
  } else if (loadedParcelCollection.features.length === 0) {
    setParcelStatus("Straatniveau bereikt. Kies 'Laad kavels'.", "success");
  }
}

function setParcelStatus(message, type = "") {
  elements.parcelStatus.textContent = message;
  elements.parcelStatus.className = "inline-status";
  if (type) elements.parcelStatus.classList.add(type);
}

function setMapProgress(visible, message = "Gegevens laden...") {
  elements.mapProgress.classList.toggle("hidden", !visible);
  elements.mapProgressText.textContent = message;
}

function applyLayerVisibility() {
  setLayerVisibility(loadedParcelsLayer, elements.toggleLoadedParcels.checked);
  setLayerVisibility(selectedParcelsLayer, elements.toggleSelectedParcels.checked);
  setLayerVisibility(scenarioObjectsLayer, elements.toggleScenarioObjects.checked);
}

function setLayerVisibility(layer, shouldShow) {
  if (shouldShow && !map.hasLayer(layer)) layer.addTo(map);
  if (!shouldShow && map.hasLayer(layer)) map.removeLayer(layer);
}

function openComparison() {
  populateCompareSelectors();
  renderComparison();
  elements.compareDialog.showModal();
}

function populateCompareSelectors() {
  const previousA = elements.compareA.value || currentScenario().id;
  const otherScenario = appState.scenarios.find((scenario) => scenario.id !== currentScenario().id);
  const previousB = elements.compareB.value || otherScenario?.id || currentScenario().id;

  [elements.compareA, elements.compareB].forEach((select) => select.replaceChildren());
  for (const scenario of appState.scenarios) {
    const optionA = document.createElement("option");
    optionA.value = scenario.id;
    optionA.textContent = scenario.name;
    elements.compareA.append(optionA);

    const optionB = optionA.cloneNode(true);
    elements.compareB.append(optionB);
  }
  elements.compareA.value = appState.scenarios.some((item) => item.id === previousA) ? previousA : currentScenario().id;
  elements.compareB.value = appState.scenarios.some((item) => item.id === previousB) ? previousB : currentScenario().id;
}

function renderComparison() {
  const scenarioA = appState.scenarios.find((scenario) => scenario.id === elements.compareA.value) ?? currentScenario();
  const scenarioB = appState.scenarios.find((scenario) => scenario.id === elements.compareB.value) ?? currentScenario();
  const metricsA = scenarioMetrics(scenarioA);
  const metricsB = scenarioMetrics(scenarioB);

  elements.compareAHeading.textContent = scenarioA.name;
  elements.compareBHeading.textContent = scenarioB.name;
  elements.compareTableBody.replaceChildren();

  const rows = [
    { label: "Plangebied", key: "siteArea", format: formatArea, delta: formatSignedArea },
    { label: "BVO", key: "grossFloorArea", format: formatArea, delta: formatSignedArea },
    { label: "FSI", key: "fsi", format: (value) => formatNumber(value, 2), delta: (value) => signedNumber(value, 2) },
    { label: "GSI", key: "gsi", format: (value) => formatPercent(value, 1), delta: formatSignedPercent },
    { label: "Groen", key: "greenRatio", format: (value) => formatPercent(value, 1), delta: formatSignedPercent },
    { label: "Woningen", key: "dwellings", format: (value) => formatNumber(value, 0), delta: (value) => signedNumber(value, 0) },
    { label: "Parkeerbalans", key: "parkingBalance", format: (value) => signedNumber(value, 0), delta: (value) => signedNumber(value, 0) }
  ];

  for (const row of rows) {
    const tr = document.createElement("tr");
    const valueA = metricsA[row.key];
    const valueB = metricsB[row.key];
    const difference = valueB - valueA;
    const cells = [row.label, row.format(valueA), row.format(valueB), row.delta(difference)];
    cells.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      if (index === 3 && difference !== 0) cell.className = difference > 0 ? "positive" : "negative";
      tr.append(cell);
    });
    elements.compareTableBody.append(tr);
  }
}

function exportCurrentScenarioJson() {
  const scenario = currentScenario();
  downloadJson(makeExportBundle(scenario), `${slugify(scenario.name)}.scenario.json`);
  showToast("Scenario als JSON geëxporteerd.", "success");
}

function exportCurrentScenarioGeoJson() {
  const scenario = currentScenario();
  downloadJson(scenarioAsGeoJSON(scenario), `${slugify(scenario.name)}.geojson`, "application/geo+json");
  showToast("Scenario als GeoJSON geëxporteerd.", "success");
}

async function importScenarioFile(event) {
  const [file] = event.target.files ?? [];
  event.target.value = "";
  if (!file) return;

  try {
    const content = await file.text();
    const parsed = JSON.parse(content);
    let scenario;

    if (parsed?.format === "ruimtescenario-pdok" && parsed.scenario) {
      scenario = normalizeScenario(parsed.scenario);
    } else if (parsed?.scenario?.objects && parsed?.scenario?.parcels) {
      scenario = normalizeScenario(parsed.scenario);
    } else if (parsed?.type === "FeatureCollection") {
      scenario = scenarioFromGeoJSON(parsed, file.name);
    } else {
      throw new Error("Niet-herkend scenarioformaat.");
    }

    prepareImportedScenario(scenario);
    appState.scenarios.push(scenario);
    appState.activeScenarioId = scenario.id;
    selectedObjectId = null;
    stopAllTools();
    persistState();
    renderAll();
    fitScenario(scenario);
    showToast("Scenario geïmporteerd.", "success");
  } catch (error) {
    console.error(error);
    showToast("Importeren mislukt. Gebruik een exportbestand uit deze tool of geldige GeoJSON.", "error");
  }
}

function scenarioFromGeoJSON(collection, filename) {
  const scenario = createScenario(collection.name || filename.replace(/\.(geo)?json$/i, "") || "GeoJSON-import");
  const parcelFeatures = [];
  const objectFeatures = [];

  for (const feature of collection.features ?? []) {
    if (!feature?.geometry) continue;
    const role = feature.properties?.scenarioRole;
    if (role === "plangebied") {
      parcelFeatures.push(structuredClone(feature));
      continue;
    }
    if (role === "scenario-object" || CATEGORY_DEFINITIONS[feature.properties?.type]) {
      objectFeatures.push(...splitObjectFeature(feature));
    }
  }

  if (parcelFeatures.length === 0 && objectFeatures.length === 0) {
    for (const feature of collection.features ?? []) {
      if (!feature?.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) continue;
      objectFeatures.push(...splitObjectFeature({
        ...structuredClone(feature),
        properties: {
          ...(feature.properties ?? {}),
          type: CATEGORY_DEFINITIONS[feature.properties?.type] ? feature.properties.type : "public"
        }
      }));
    }
  }

  scenario.parcels.features = parcelFeatures;
  scenario.objects.features = objectFeatures;
  return scenario;
}

function splitObjectFeature(feature) {
  const copy = structuredClone(feature);
  if (copy.geometry?.type === "Polygon") return [copy];
  if (copy.geometry?.type !== "MultiPolygon") return [];
  return copy.geometry.coordinates.map((coordinates, index) => ({
    type: "Feature",
    geometry: { type: "Polygon", coordinates },
    properties: {
      ...(copy.properties ?? {}),
      name: `${copy.properties?.name || "Geimporteerd object"} ${index + 1}`,
      scenarioObjectId: createId("object")
    }
  }));
}

function prepareImportedScenario(scenario) {
  if (appState.scenarios.some((item) => item.id === scenario.id)) scenario.id = createId("scenario");
  scenario.name = uniqueScenarioName(scenario.name || "Geimporteerd scenario");
  scenario.parcels.features = scenario.parcels.features.filter(
    (feature) => feature?.geometry && ["Polygon", "MultiPolygon"].includes(feature.geometry.type)
  );
  scenario.parcels.features.forEach((feature) => {
    feature.properties ??= {};
    feature.properties.scenarioParcelId ||= createId("parcel");
    feature.properties.pdokKey ||= parcelKey(feature);
  });

  scenario.objects.features = scenario.objects.features.flatMap(splitObjectFeature);
  scenario.objects.features.forEach((feature, index) => ensureObjectProperties(feature, index));
  scenario.updatedAt = new Date().toISOString();
}

function uniqueScenarioName(preferredName) {
  const names = new Set(appState.scenarios.map((scenario) => scenario.name));
  if (!names.has(preferredName)) return preferredName;
  let counter = 2;
  while (names.has(`${preferredName} (${counter})`)) counter += 1;
  return `${preferredName} (${counter})`;
}

function addDemoScenario() {
  const scenario = createDemoScenario();
  scenario.name = uniqueScenarioName(scenario.name);
  appState.scenarios.push(scenario);
  appState.activeScenarioId = scenario.id;
  selectedObjectId = null;
  stopAllTools();
  persistState();
  renderAll();
  fitScenario(scenario);
  showToast("Demonstratiescenario toegevoegd.", "success");
}

function resetLocalData() {
  if (!globalThis.confirm("Alle lokaal opgeslagen scenario's en instellingen verwijderen?")) return;
  const firstScenario = createScenario("Scenario A");
  appState = {
    scenarios: [firstScenario],
    activeScenarioId: firstScenario.id,
    mapView: null
  };
  localStorage.removeItem(CONFIG.storageKey);
  loadedParcelCollection = { type: "FeatureCollection", features: [] };
  loadedParcelsLayer.clearLayers();
  searchHighlightLayer.clearLayers();
  selectedObjectId = null;
  stopAllTools();
  map.setView(CONFIG.initialView.center, CONFIG.initialView.zoom);
  persistState();
  renderAll();
  updateParcelZoomHint();
  showToast("Lokale gegevens zijn hersteld.", "success");
}

function fitScenario(scenario) {
  const features = [...scenario.parcels.features, ...scenario.objects.features];
  if (features.length === 0) return;
  const temporaryLayer = L.geoJSON({ type: "FeatureCollection", features });
  const bounds = temporaryLayer.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [55, 55], maxZoom: 18 });
}

function downloadJson(data, filename, mimeType = "application/json") {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function fetchJson(url, timeoutMilliseconds) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/geo+json, application/json" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function showToast(message, type = "") {
  const toast = document.createElement("div");
  toast.className = `toast${type ? ` ${type}` : ""}`;
  toast.textContent = message;
  elements.toastContainer.append(toast);
  setTimeout(() => toast.remove(), 4200);
}

function signedNumber(value, decimals = 1) {
  const rounded = Number(value) || 0;
  const formatted = formatNumber(Math.abs(rounded), decimals);
  if (Math.abs(rounded) < 10 ** (-decimals) / 2) return formatNumber(0, decimals);
  return `${rounded > 0 ? "+" : "-"}${formatted}`;
}

function formatSignedPercent(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) < 0.0005) return "0,0 pp";
  return `${number > 0 ? "+" : "-"}${formatNumber(Math.abs(number) * 100, 1)} pp`;
}

function formatSignedArea(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) < 0.5) return "0 m2";
  return `${number > 0 ? "+" : "-"}${formatArea(Math.abs(number))}`;
}

function slugify(value) {
  return String(value || "scenario")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "scenario";
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function debounce(callback, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), wait);
  };
}
