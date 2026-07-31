"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCrosshair, FiMapPin, FiSearch, FiX } from "react-icons/fi";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type Pin = { latitude: number; longitude: number };

/** Metro Manila. Only used when nothing is pinned and no address resolves. */
const FALLBACK_CENTER: Pin = { latitude: 14.5547, longitude: 121.0244 };
const PINNED_ZOOM = 17;
const UNPINNED_ZOOM = 12;

/**
 * Leaflet ships its marker icon as a bundled image, which breaks under most
 * bundlers. A div icon avoids the asset entirely and lets the pin match the
 * dashboard's palette.
 */
const markerIcon = L.divIcon({
  className: "location-pin",
  html: '<span class="location-pin-dot"></span><span class="location-pin-stem"></span>',
  iconSize: [22, 30],
  iconAnchor: [11, 30],
});

type NominatimResult = { lat: string; lon: string; display_name: string };

/** Keeps the map centred on the pin when it is moved from outside the map. */
function RecenterOnPin({ pin }: { pin: Pin | null }) {
  const map = useMap();
  useEffect(() => {
    if (!pin) return;
    map.setView([pin.latitude, pin.longitude], Math.max(map.getZoom(), PINNED_ZOOM));
  }, [map, pin]);
  return null;
}

function ClickToPin({ onPick }: { onPick: (pin: Pin) => void }) {
  useMapEvents({
    click(event) {
      onPick({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    },
  });
  return null;
}

/**
 * Address field with a map.
 *
 * Typing an address and searching drops a pin; clicking or dragging the pin
 * moves it and rewrites the address from what is actually there. Coordinates
 * are what the customer-facing map link opens, because a written address is
 * only as precise as a geocoder's guess.
 *
 * Geocoding uses OpenStreetMap's Nominatim: no API key, and this is a
 * low-volume admin screen. It is only called on an explicit action, never per
 * keystroke, which their usage policy asks for.
 */
export function LocationPicker({
  address,
  onAddressChange,
  onPinChange,
  pin,
}: {
  address: string;
  onAddressChange: (address: string) => void;
  onPinChange: (pin: Pin | null) => void;
  pin: Pin | null;
}) {
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const center = useMemo<Pin>(() => pin ?? FALLBACK_CENTER, [pin]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const reverseGeocode = useCallback(
    async (next: Pin) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${next.latitude}&lon=${next.longitude}`,
          { headers: { Accept: "application/json" }, signal: controller.signal },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as { display_name?: string };
        if (payload.display_name) onAddressChange(payload.display_name);
      } catch {
        // A failed lookup leaves the typed address alone — the pin is still set,
        // and the pin is what matters for the map link.
      }
    },
    [onAddressChange],
  );

  function placePin(next: Pin) {
    setNotice("");
    onPinChange(next);
    void reverseGeocode(next);
  }

  async function searchAddress() {
    const query = address.trim();
    if (!query) {
      setNotice("Type an address first.");
      return;
    }
    setSearching(true);
    setNotice("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
        { headers: { Accept: "application/json" }, signal: controller.signal },
      );
      if (!response.ok) throw new Error("Search failed");
      const results = (await response.json()) as NominatimResult[];
      const first = results[0];
      if (!first) {
        setNotice("No match found. Drop the pin on the map instead.");
        return;
      }
      onPinChange({ latitude: Number(first.lat), longitude: Number(first.lon) });
    } catch (caught) {
      if ((caught as Error)?.name === "AbortError") return;
      setNotice("Could not search right now. Drop the pin on the map instead.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="location-picker">
      <label className="field">
        <span>
          <FiMapPin aria-hidden="true" /> Address
        </span>
        <div className="location-picker-search">
          <input
            onChange={(event) => onAddressChange(event.target.value)}
            onKeyDown={(event) => {
              // Enter would otherwise submit the surrounding form.
              if (event.key === "Enter") {
                event.preventDefault();
                void searchAddress();
              }
            }}
            placeholder="123 Ayala Ave, Makati City"
            value={address}
          />
          <button
            className="location-picker-search-button"
            disabled={searching}
            onClick={() => void searchAddress()}
            type="button"
          >
            <FiSearch aria-hidden="true" />
            {searching ? "Searching..." : "Find"}
          </button>
        </div>
        <small className="muted">
          Search to drop a pin, then click or drag it to place it exactly. Customers
          tap the address to open Google Maps.
        </small>
      </label>

      <div className="location-picker-map">
        <MapContainer
          center={[center.latitude, center.longitude]}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
          zoom={pin ? PINNED_ZOOM : UNPINNED_ZOOM}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPin onPick={placePin} />
          <RecenterOnPin pin={pin} />
          {pin ? (
            <Marker
              draggable
              eventHandlers={{
                dragend(event) {
                  const { lat, lng } = event.target.getLatLng();
                  placePin({ latitude: lat, longitude: lng });
                },
              }}
              icon={markerIcon}
              position={[pin.latitude, pin.longitude]}
            />
          ) : null}
        </MapContainer>

        {!pin ? (
          <p className="location-picker-empty">
            <FiCrosshair aria-hidden="true" /> Click the map to drop a pin
          </p>
        ) : null}
      </div>

      <div className="location-picker-footer">
        {pin ? (
          <>
            <span className="location-picker-coords">
              {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
            </span>
            <button
              className="location-picker-clear"
              onClick={() => {
                onPinChange(null);
                setNotice("");
              }}
              type="button"
            >
              <FiX aria-hidden="true" /> Clear pin
            </button>
          </>
        ) : (
          <span className="muted">
            No pin set — the map link will use the written address.
          </span>
        )}
      </div>

      {notice ? <p className="location-picker-notice">{notice}</p> : null}
    </div>
  );
}
