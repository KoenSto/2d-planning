import test from "node:test";
import assert from "node:assert/strict";
import { calculateMetrics, safeDivide } from "../src/calculations.js";

test("calculateMetrics berekent BVO, dichtheid en woningen", () => {
  const metrics = calculateMetrics({
    siteArea: 10000,
    objects: [
      { type: "building", area: 2000, floors: 5, residentialShare: 80 },
      { type: "green", area: 2500 },
      { type: "parking", area: 1000 },
      { type: "public", area: 1500 }
    ],
    assumptions: {
      netGrossRatio: 0.75,
      averageDwellingArea: 75,
      parkingNorm: 0.8,
      parkingSpaceArea: 25
    }
  });

  assert.equal(metrics.grossFloorArea, 10000);
  assert.equal(metrics.residentialGrossFloorArea, 8000);
  assert.equal(metrics.dwellings, 80);
  assert.equal(metrics.gsi, 0.2);
  assert.equal(metrics.fsi, 1);
  assert.equal(metrics.greenRatio, 0.25);
  assert.equal(metrics.parkingSupply, 40);
  assert.equal(metrics.parkingDemand, 64);
  assert.equal(metrics.parkingBalance, -24);
  assert.equal(metrics.unallocatedArea, 3000);
});

test("safeDivide geeft nul bij een leeg plangebied", () => {
  assert.equal(safeDivide(100, 0), 0);
  assert.equal(safeDivide(100, -1), 0);
});
