import { createScenario, createId } from "./scenarios.js";

function polygon(coordinates) {
  return { type: "Polygon", coordinates: [coordinates] };
}

function closeRing(points) {
  const first = points[0];
  const last = points[points.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? points : [...points, first];
}

export function createDemoScenario() {
  const scenario = createScenario("Demo Utrecht");
  scenario.parcels.features = [
    {
      type: "Feature",
      geometry: polygon(closeRing([
        [5.10565, 52.08992],
        [5.10817, 52.09008],
        [5.10802, 52.09168],
        [5.10545, 52.09151]
      ])),
      properties: {
        scenarioParcelId: createId("parcel"),
        source: "demo",
        displayName: "Demonstratieplangebied"
      }
    }
  ];

  const objects = [
    {
      type: "building",
      name: "Woonblok A",
      floors: 5,
      function: "wonen",
      residentialShare: 100,
      coordinates: [
        [5.10595, 52.09023],
        [5.10674, 52.09028],
        [5.10668, 52.09124],
        [5.10588, 52.09119]
      ]
    },
    {
      type: "building",
      name: "Gemengd blok B",
      floors: 4,
      function: "gemengd",
      residentialShare: 75,
      coordinates: [
        [5.10702, 52.09035],
        [5.10774, 52.0904],
        [5.10767, 52.09122],
        [5.10696, 52.09117]
      ]
    },
    {
      type: "green",
      name: "Buurtgroen",
      coordinates: [
        [5.10602, 52.0913],
        [5.10765, 52.09139],
        [5.10761, 52.09157],
        [5.10598, 52.09147]
      ]
    },
    {
      type: "parking",
      name: "Parkeerhof",
      coordinates: [
        [5.1078, 52.0903],
        [5.10802, 52.09031],
        [5.10794, 52.0912],
        [5.10772, 52.09119]
      ]
    },
    {
      type: "public",
      name: "Plein en route",
      coordinates: [
        [5.10676, 52.09028],
        [5.10699, 52.0903],
        [5.10692, 52.09127],
        [5.1067, 52.09125]
      ]
    }
  ];

  scenario.objects.features = objects.map((item) => ({
    type: "Feature",
    geometry: polygon(closeRing(item.coordinates)),
    properties: {
      scenarioObjectId: createId("object"),
      type: item.type,
      name: item.name,
      floors: item.floors ?? 1,
      function: item.function ?? item.type,
      residentialShare: item.residentialShare ?? 0,
      notes: ""
    }
  }));
  scenario.updatedAt = new Date().toISOString();
  return scenario;
}
