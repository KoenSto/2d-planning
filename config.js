{
  "format": "ruimtescenario-pdok",
  "version": 1,
  "exportedAt": "2026-07-14T09:37:43.556Z",
  "scenario": {
    "id": "scenario-a4adf320-08fd-4540-92d2-8ea01a6027b1",
    "name": "Demo Utrecht",
    "createdAt": "2026-07-14T09:37:43.554Z",
    "updatedAt": "2026-07-14T09:37:43.556Z",
    "parcels": {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  5.10565,
                  52.08992
                ],
                [
                  5.10817,
                  52.09008
                ],
                [
                  5.10802,
                  52.09168
                ],
                [
                  5.10545,
                  52.09151
                ],
                [
                  5.10565,
                  52.08992
                ]
              ]
            ]
          },
          "properties": {
            "scenarioParcelId": "parcel-927d492c-d10f-4623-b6f8-904faf73718a",
            "source": "demo",
            "displayName": "Demonstratieplangebied"
          }
        }
      ]
    },
    "objects": {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  5.10595,
                  52.09023
                ],
                [
                  5.10674,
                  52.09028
                ],
                [
                  5.10668,
                  52.09124
                ],
                [
                  5.10588,
                  52.09119
                ],
                [
                  5.10595,
                  52.09023
                ]
              ]
            ]
          },
          "properties": {
            "scenarioObjectId": "object-e6b1a9bc-a2d6-45a3-a921-d9a33d755d86",
            "type": "building",
            "name": "Woonblok A",
            "floors": 5,
            "function": "wonen",
            "residentialShare": 100,
            "notes": ""
          }
        },
        {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  5.10702,
                  52.09035
                ],
                [
                  5.10774,
                  52.0904
                ],
                [
                  5.10767,
                  52.09122
                ],
                [
                  5.10696,
                  52.09117
                ],
                [
                  5.10702,
                  52.09035
                ]
              ]
            ]
          },
          "properties": {
            "scenarioObjectId": "object-e03d13bc-8784-421c-9e09-47f44a8445b5",
            "type": "building",
            "name": "Gemengd blok B",
            "floors": 4,
            "function": "gemengd",
            "residentialShare": 75,
            "notes": ""
          }
        },
        {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  5.10602,
                  52.0913
                ],
                [
                  5.10765,
                  52.09139
                ],
                [
                  5.10761,
                  52.09157
                ],
                [
                  5.10598,
                  52.09147
                ],
                [
                  5.10602,
                  52.0913
                ]
              ]
            ]
          },
          "properties": {
            "scenarioObjectId": "object-51ddb2a8-16a7-4b38-b626-71cb28119be8",
            "type": "green",
            "name": "Buurtgroen",
            "floors": 1,
            "function": "green",
            "residentialShare": 0,
            "notes": ""
          }
        },
        {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  5.1078,
                  52.0903
                ],
                [
                  5.10802,
                  52.09031
                ],
                [
                  5.10794,
                  52.0912
                ],
                [
                  5.10772,
                  52.09119
                ],
                [
                  5.1078,
                  52.0903
                ]
              ]
            ]
          },
          "properties": {
            "scenarioObjectId": "object-9bceeb46-42e4-434d-96e4-fc87d1d6e678",
            "type": "parking",
            "name": "Parkeerhof",
            "floors": 1,
            "function": "parking",
            "residentialShare": 0,
            "notes": ""
          }
        },
        {
          "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [
              [
                [
                  5.10676,
                  52.09028
                ],
                [
                  5.10699,
                  52.0903
                ],
                [
                  5.10692,
                  52.09127
                ],
                [
                  5.1067,
                  52.09125
                ],
                [
                  5.10676,
                  52.09028
                ]
              ]
            ]
          },
          "properties": {
            "scenarioObjectId": "object-51066933-5fb4-40a6-af5f-82a9fcccf6b7",
            "type": "public",
            "name": "Plein en route",
            "floors": 1,
            "function": "public",
            "residentialShare": 0,
            "notes": ""
          }
        }
      ]
    },
    "assumptions": {
      "netGrossRatio": 0.75,
      "averageDwellingArea": 75,
      "parkingNorm": 0.8,
      "parkingSpaceArea": 25
    }
  }
}
