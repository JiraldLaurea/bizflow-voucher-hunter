export type MapTarget = {
  address?: string;
  latitude?: number;
  longitude?: number;
};

/**
 * Google Maps link for a venue.
 *
 * Coordinates win when a pin has been dropped: a written address is only as
 * good as the geocoder's guess, and "123 Ayala Ave" resolves to several places.
 * The address string is the fallback for venues pinned before this existed.
 *
 * Uses the documented Maps URL scheme rather than a `geo:` or
 * `comgooglemaps://` URI, so it opens the Maps app when installed and the
 * browser otherwise.
 */
export function buildMapsUrl(target: MapTarget | string): string {
  if (typeof target === "string") {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(target.trim())}`;
  }

  const { address, latitude, longitude } = target;
  if (isCoordinate(latitude) && isCoordinate(longitude)) {
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((address ?? "").trim())}`;
}

/**
 * Google Maps directions link with the venue as the destination.
 *
 * The origin is intentionally omitted so Google Maps uses the device's
 * current location. `dir_action=navigate` opens the route ready to navigate
 * when a Maps app is installed, and falls back to Google Maps on the web.
 */
export function buildDirectionsUrl(target: MapTarget | string): string {
  const destination =
    typeof target === "string"
      ? target.trim()
      : isCoordinate(target.latitude) && isCoordinate(target.longitude)
        ? `${target.latitude},${target.longitude}`
        : (target.address ?? "").trim();

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving&dir_action=navigate`;
}

/** Guards against NaN and the nulls a database column can hand back. */
export function isCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function hasPin(target: MapTarget): boolean {
  return isCoordinate(target.latitude) && isCoordinate(target.longitude);
}

/**
 * A `tel:` URI for a contact number.
 *
 * Strips spaces, dashes and brackets, which are common in written numbers and
 * which some dialers refuse. A leading `+` is kept: it is significant.
 */
export function buildTelUrl(contactNumber: string): string {
  return `tel:${contactNumber.trim().replace(/(?!^\+)[^\d]/g, "")}`;
}
