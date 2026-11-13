import scenario from '../config/mission-scenario.json';

export interface Resources {
  minutes: number;
  oxygen: number;
  energy: number;
}

const config = scenario.consumables;
export const zeroResources: Resources = { minutes: 0, oxygen: 0, energy: 0 };
export const budget: Resources = {
  minutes: scenario.timeBudgetMinutes, oxygen: config.oxygenBudgetLiters, energy: config.energyBudgetWh,
};
export const reserve: Resources = {
  minutes: scenario.reserveMinutes, oxygen: config.oxygenReserveLiters, energy: config.energyReserveWh,
};

export function addResources(a: Resources, b: Resources): Resources {
  return { minutes: a.minutes + b.minutes, oxygen: a.oxygen + b.oxygen, energy: a.energy + b.energy };
}

export function subtractResources(a: Resources, b: Resources): Resources {
  return { minutes: a.minutes - b.minutes, oxygen: a.oxygen - b.oxygen, energy: a.energy - b.energy };
}

export function scienceResources(minutes: number): Resources {
  return { minutes, oxygen: minutes * config.oxygenScienceLitersPerMinute, energy: minutes * config.energyScienceWhPerMinute };
}

export function travelResources(minutes: number, grade: number): Resources {
  const uphill = Math.max(grade, 0), downhill = Math.max(-grade, 0);
  return {
    minutes,
    oxygen: minutes * config.oxygenTravelLitersPerMinute *
      (1 + config.oxygenUphillCoefficient * uphill + config.oxygenDownhillCoefficient * downhill),
    energy: minutes * config.energyTravelWhPerMinute * (1 + config.energyUphillCoefficient * uphill),
  };
}

export function atSpeed(consumption: Resources, speed: number): Resources {
  return { minutes: consumption.minutes / speed, oxygen: consumption.oxygen / speed, energy: consumption.energy / speed };
}

export function hasReserve(margin: Resources): boolean {
  return margin.minutes >= 0 && margin.oxygen >= 0 && margin.energy >= 0;
}
