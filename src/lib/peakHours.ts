// Heuristic peak-hour model for Delhi NCR commute forecasting.
// Placeholder for a future model trained on real historical ridership/traffic data.

import { istParts } from "@/lib/istTime";

export function isMetroPeakHour(hour: number) {
  return (hour >= 8 && hour < 11) || (hour >= 17 && hour < 21);
}

export function isRoadPeakHour(hour: number) {
  return (hour >= 8 && hour < 11) || (hour >= 17 && hour < 22);
}

export function isLateNight(hour: number) {
  return hour >= 22 || hour < 5;
}

export interface Forecast {
  hour: number;
  dayOfWeek: number;
  recommendation: string;
  reasoning: string[];
}

export function forecastJourney(date: Date): Forecast {
  const { hour, dayOfWeek, isWeekend } = istParts(date);
  const reasoning: string[] = [];
  let recommendation = "metro";

  if (isLateNight(hour)) {
    recommendation = "cab";
    reasoning.push("Late-night hours: metro/bus frequency drops sharply — a cab is safer and more reliable.");
  } else if (isWeekend) {
    recommendation = isMetroPeakHour(hour) ? "metro" : "auto";
    reasoning.push("Weekend: lighter overall traffic and metro crowding than weekdays.");
  } else if (isMetroPeakHour(hour)) {
    recommendation = "metro";
    reasoning.push("Weekday peak hour: metro is crowded but still fastest and most predictable — avoid road transport due to congestion.");
  } else if (isRoadPeakHour(hour)) {
    recommendation = "metro";
    reasoning.push("Road traffic peak: metro avoids congestion delays that cabs/autos would face.");
  } else {
    recommendation = "auto";
    reasoning.push("Off-peak hour: roads are clearer, so auto-rickshaw or cab is comparably fast and door-to-door.");
  }

  if (isLateNight(hour) || hour >= 20) {
    reasoning.push("After sunset: prioritize well-lit, populated routes and share your live location before departing.");
  }

  return { hour, dayOfWeek, recommendation, reasoning };
}
