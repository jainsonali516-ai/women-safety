interface Point {
  latitude: number;
  longitude: number;
  label?: string;
}

export function buildUberLinks(pickup: Point, dropoff: Point) {
  const params = new URLSearchParams({
    action: "setPickup",
    "pickup[latitude]": String(pickup.latitude),
    "pickup[longitude]": String(pickup.longitude),
    "dropoff[latitude]": String(dropoff.latitude),
    "dropoff[longitude]": String(dropoff.longitude),
  });
  if (pickup.label) params.set("pickup[nickname]", pickup.label);
  if (dropoff.label) params.set("dropoff[nickname]", dropoff.label);

  return {
    app: `uber://?${params.toString()}`,
    web: `https://m.uber.com/ul/?${params.toString()}`,
  };
}

export function buildOlaLinks(pickup: Point, dropoff: Point) {
  const params = new URLSearchParams({
    lat: String(pickup.latitude),
    lng: String(pickup.longitude),
    drop_lat: String(dropoff.latitude),
    drop_lng: String(dropoff.longitude),
  });

  return {
    app: `olacabs://app/launch?${params.toString()}`,
    web: `https://book.olacabs.com/?${params.toString()}`,
  };
}
