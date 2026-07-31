"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCrosshair, FiMapPin, FiSearch, FiX } from "react-icons/fi";

export type Pin = { latitude: number; longitude: number };

const FALLBACK_CENTER: Pin = { latitude: 14.5547, longitude: 121.0244 };
const PINNED_ZOOM = 17;
const UNPINNED_ZOOM = 12;
const SCRIPT_ID = "voucher-hunt-google-maps";
const CALLBACK_NAME = "__voucherHuntGoogleMapsReady";

let mapsPromise: Promise<void> | null = null;

declare global {
  interface Window {
    __voucherHuntGoogleMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<void>((resolve, reject) => {
    window[CALLBACK_NAME] = () => {
      delete window[CALLBACK_NAME];
      resolve();
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps could not be loaded.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      mapsPromise = null;
      delete window[CALLBACK_NAME];
      reject(new Error("Google Maps could not be loaded."));
    };
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
      `&v=weekly&loading=async&callback=${CALLBACK_NAME}`;
    document.head.appendChild(script);
  });

  return mapsPromise;
}

export function GoogleLocationPicker({
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
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const onAddressChangeRef = useRef(onAddressChange);
  const onPinChangeRef = useRef(onPinChange);
  const pinRef = useRef(pin);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState("");

  onAddressChangeRef.current = onAddressChange;
  onPinChangeRef.current = onPinChange;
  pinRef.current = pin;

  const reverseGeocode = useCallback(async (next: Pin) => {
    if (!geocoderRef.current) return;
    try {
      const response = await geocoderRef.current.geocode({
        location: { lat: next.latitude, lng: next.longitude },
      });
      const formatted = response.results[0]?.formatted_address;
      if (formatted) onAddressChangeRef.current(formatted);
    } catch {
      // The coordinates remain usable when an address cannot be formatted.
    }
  }, []);

  const placePin = useCallback(
    (next: Pin) => {
      setNotice("");
      onPinChangeRef.current(next);
      void reverseGeocode(next);
    },
    [reverseGeocode],
  );

  useEffect(() => {
    if (!apiKey) {
      setNotice(
        "Google Maps is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and restart the dashboard.",
      );
      return;
    }

    let cancelled = false;
    let mapClick: google.maps.MapsEventListener | null = null;
    const previousAuthFailure = window.gm_authFailure;

    window.gm_authFailure = () => {
      if (cancelled) return;
      setMapReady(false);
      setMapError(
        "Google rejected this browser key. Use a website-restricted key with Maps JavaScript API and Geocoding API enabled.",
      );
    };

    void loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapElementRef.current) return;
        setMapError("");
        const initial = pinRef.current ?? FALLBACK_CENTER;
        const map = new google.maps.Map(mapElementRef.current, {
          center: { lat: initial.latitude, lng: initial.longitude },
          clickableIcons: false,
          fullscreenControl: false,
          mapTypeControl: false,
          streetViewControl: false,
          zoom: pinRef.current ? PINNED_ZOOM : UNPINNED_ZOOM,
        });
        mapRef.current = map;
        geocoderRef.current = new google.maps.Geocoder();
        mapClick = map.addListener(
          "click",
          (event: google.maps.MapMouseEvent) => {
            if (!event.latLng) return;
            placePin({
              latitude: event.latLng.lat(),
              longitude: event.latLng.lng(),
            });
          },
        );
        setMapReady(true);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setMapError(
            caught instanceof Error
              ? caught.message
              : "Google Maps could not be loaded.",
          );
        }
      });

    return () => {
      cancelled = true;
      if (window.gm_authFailure) {
        window.gm_authFailure = previousAuthFailure;
      }
      mapClick?.remove();
      if (markerRef.current && window.google?.maps) {
        google.maps.event.clearInstanceListeners(markerRef.current);
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      mapRef.current = null;
      geocoderRef.current = null;
    };
  }, [apiKey, placePin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    if (!pin) {
      if (markerRef.current) {
        google.maps.event.clearInstanceListeners(markerRef.current);
        markerRef.current.setMap(null);
        markerRef.current = null;
      }
      return;
    }

    const position = { lat: pin.latitude, lng: pin.longitude };
    if (!markerRef.current) {
      const marker = new google.maps.Marker({
        draggable: true,
        map,
        position,
        title: "Business location",
      });
      marker.addListener("dragend", () => {
        const next = marker.getPosition();
        if (next) {
          placePin({ latitude: next.lat(), longitude: next.lng() });
        }
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setPosition(position);
    }

    map.panTo(position);
    if ((map.getZoom() ?? 0) < PINNED_ZOOM) map.setZoom(PINNED_ZOOM);
  }, [mapReady, pin, placePin]);

  async function searchAddress() {
    const query = address.trim();
    if (!query) {
      setNotice("Type an address first.");
      return;
    }
    if (!geocoderRef.current) {
      setNotice("Wait for Google Maps to finish loading, then try again.");
      return;
    }

    setSearching(true);
    setNotice("");
    try {
      const response = await geocoderRef.current.geocode({ address: query });
      const result = response.results[0];
      if (!result) {
        setNotice("No match found. Drop the pin on the map instead.");
        return;
      }
      onAddressChangeRef.current(result.formatted_address);
      onPinChangeRef.current({
        latitude: result.geometry.location.lat(),
        longitude: result.geometry.location.lng(),
      });
    } catch {
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
            disabled={searching || !mapReady}
            onClick={() => void searchAddress()}
            type="button"
          >
            <FiSearch aria-hidden="true" />
            {searching ? "Searching..." : "Find"}
          </button>
        </div>
        <small className="muted">
          Search to drop a pin, then click or drag it to place it exactly.
          Customers use this location for Google Maps directions.
        </small>
      </label>

      <div className="location-picker-map">
        <div className="google-location-map" ref={mapElementRef} />
        {mapError ? (
          <div className="location-picker-error" role="alert">
            <strong>Google Maps configuration required</strong>
            <span>{mapError}</span>
          </div>
        ) : !mapReady ? (
          <p className="location-picker-loading">Loading Google Maps...</p>
        ) : null}
        {mapReady && !pin ? (
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
            No pin set — directions will use the written address.
          </span>
        )}
      </div>

      {notice ? <p className="location-picker-notice">{notice}</p> : null}
    </div>
  );
}
