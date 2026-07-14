const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value)));
}

export function safeDivide(numerator, denominator) {
  const a = finite(numerator);
  const b = finite(denominator);
  return b > 0 ? a / b : 0;
}

export function calculateMetrics({ siteArea = 0, objects = [], assumptions = {} }) {
  const normalizedSiteArea = Math.max(0, finite(siteArea));
  const netGrossRatio = clamp(assumptions.netGrossRatio ?? 0.75, 0, 1);
  const averageDwellingArea = Math.max(1, finite(assumptions.averageDwellingArea, 75));
  const parkingNorm = Math.max(0, finite(assumptions.parkingNorm, 0.8));
  const parkingSpaceArea = Math.max(1, finite(assumptions.parkingSpaceArea, 25));

  let footprintArea = 0;
  let grossFloorArea = 0;
  let residentialGrossFloorArea = 0;
  let greenArea = 0;
  let parkingArea = 0;
  let publicArea = 0;

  for (const object of objects) {
    const area = Math.max(0, finite(object.area));
    const type = object.type;

    if (type === "building") {
      const floors = Math.max(1, Math.round(finite(object.floors, 1)));
      const residentialShare = clamp(object.residentialShare ?? 100, 0, 100) / 100;
      const objectGrossFloorArea = area * floors;
      footprintArea += area;
      grossFloorArea += objectGrossFloorArea;
      residentialGrossFloorArea += objectGrossFloorArea * residentialShare;
    } else if (type === "green") {
      greenArea += area;
    } else if (type === "parking") {
      parkingArea += area;
    } else if (type === "public") {
      publicArea += area;
    }
  }

  const netResidentialArea = residentialGrossFloorArea * netGrossRatio;
  const dwellings = netResidentialArea / averageDwellingArea;
  const parkingDemand = dwellings * parkingNorm;
  const parkingSupply = parkingArea / parkingSpaceArea;
  const accountedGroundArea = footprintArea + greenArea + parkingArea + publicArea;

  return {
    siteArea: normalizedSiteArea,
    footprintArea,
    grossFloorArea,
    residentialGrossFloorArea,
    netResidentialArea,
    greenArea,
    parkingArea,
    publicArea,
    unallocatedArea: Math.max(0, normalizedSiteArea - accountedGroundArea),
    overdrawnArea: Math.max(0, accountedGroundArea - normalizedSiteArea),
    gsi: safeDivide(footprintArea, normalizedSiteArea),
    fsi: safeDivide(grossFloorArea, normalizedSiteArea),
    greenRatio: safeDivide(greenArea, normalizedSiteArea),
    parkingRatio: safeDivide(parkingArea, normalizedSiteArea),
    publicRatio: safeDivide(publicArea, normalizedSiteArea),
    dwellings,
    parkingDemand,
    parkingSupply,
    parkingBalance: parkingSupply - parkingDemand
  };
}

export function formatArea(value) {
  const area = Math.max(0, finite(value));
  if (area >= 10000) {
    return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 2 }).format(area / 10000)} ha`;
  }
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 0 }).format(area)} m2`;
}

export function formatNumber(value, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("nl-NL", { maximumFractionDigits }).format(finite(value));
}

export function formatPercent(value, maximumFractionDigits = 1) {
  return `${new Intl.NumberFormat("nl-NL", { maximumFractionDigits }).format(finite(value) * 100)}%`;
}
