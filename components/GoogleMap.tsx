"use client";

import { useEffect, useRef, useState } from "react";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

interface MapPin {
  lat: number;
  lng: number;
  label?: string;
  title?: string;
  color?: "red" | "blue" | "green" | "amber" | "gray" | "terra";
}

interface GoogleMapProps {
  pins: MapPin[];
  /** Encoded polyline string from Google Directions API */
  polyline?: string | null;
  /** Center override — defaults to fitting all pins */
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: string;
  className?: string;
  /** Show the HDPM office marker */
  showOffice?: boolean;
}

const PIN_COLORS: Record<string, string> = {
  red: "#DC2626",
  blue: "#2563EB",
  green: "#16A34A",
  amber: "#D97706",
  gray: "#6B7280",
  terra: "#C2754F",
};

const HDPM_OFFICE = { lat: 44.256798, lng: -121.184346 };

// ────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────

export function GoogleMap({
  pins,
  polyline,
  center,
  zoom,
  height = "400px",
  className = "",
  showOffice = true,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  // Load Google Maps script
  useEffect(() => {
    if (!apiKey) {
      setError("Google Maps API key not configured");
      return;
    }

    if (window.google?.maps) {
      setLoaded(true);
      return;
    }

    // Check if script is already loading
    const existingScript = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => setLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,marker&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => setError("Failed to load Google Maps");
    document.head.appendChild(script);
  }, [apiKey]);

  // Initialize/update map
  useEffect(() => {
    if (!loaded || !mapRef.current) return;

    // Create map if not exists
    if (!mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapRef.current, {
        center: center || HDPM_OFFICE,
        zoom: zoom || 11,
        mapId: "hdpm-route-map",
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      });
    }

    const map = mapInstance.current;

    // Clear old markers
    for (const marker of markersRef.current) {
      marker.map = null;
    }
    markersRef.current = [];

    // Clear old polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds();

    // Add office marker
    if (showOffice) {
      const officeEl = document.createElement("div");
      officeEl.innerHTML = `
        <div style="
          width: 32px; height: 32px; background: #1F2937; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          font-size: 14px;
        ">
          <span style="color: white; font-weight: bold;">H</span>
        </div>
      `;

      const officeMarker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: HDPM_OFFICE,
        title: "HDPM Office - 1515 SW Reindeer Ave, Redmond",
        content: officeEl,
      });
      markersRef.current.push(officeMarker);
      bounds.extend(HDPM_OFFICE);
    }

    // Add pins
    for (const pin of pins) {
      if (!pin.lat || !pin.lng) continue;

      const color = PIN_COLORS[pin.color || "terra"] || PIN_COLORS.terra;
      const pinEl = document.createElement("div");
      pinEl.innerHTML = `
        <div style="
          width: ${pin.label ? "28px" : "20px"};
          height: ${pin.label ? "28px" : "20px"};
          background: ${color};
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          cursor: pointer;
          font-size: 11px; font-weight: bold; color: white;
        ">
          ${pin.label || ""}
        </div>
      `;

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: pin.lat, lng: pin.lng },
        title: pin.title || "",
        content: pinEl,
      });
      markersRef.current.push(marker);
      bounds.extend({ lat: pin.lat, lng: pin.lng });
    }

    // Draw polyline
    if (polyline && window.google?.maps?.geometry?.encoding) {
      const path =
        google.maps.geometry.encoding.decodePath(polyline);
      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#C2754F",
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map,
      });
    } else if (pins.length > 1) {
      // Draw simple lines between pins if no polyline
      const path = showOffice
        ? [HDPM_OFFICE, ...pins.filter((p) => p.lat && p.lng).map((p) => ({ lat: p.lat, lng: p.lng }))]
        : pins.filter((p) => p.lat && p.lng).map((p) => ({ lat: p.lat, lng: p.lng }));

      polylineRef.current = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#C2754F",
        strokeOpacity: 0.5,
        strokeWeight: 3,
        strokeDashArray: [8, 4],
        map,
      } as google.maps.PolylineOptions);
    }

    // Fit bounds
    if (pins.length > 0 || showOffice) {
      if (pins.length === 0 && showOffice) {
        map.setCenter(HDPM_OFFICE);
        map.setZoom(zoom || 11);
      } else if (pins.length === 1 && !showOffice) {
        map.setCenter({ lat: pins[0].lat, lng: pins[0].lng });
        map.setZoom(zoom || 14);
      } else {
        map.fitBounds(bounds, 50);
      }
    }
  }, [loaded, pins, polyline, center, zoom, showOffice]);

  if (error) {
    return (
      <div
        className={`bg-charcoal-100 rounded-lg flex items-center justify-center text-charcoal-400 text-sm ${className}`}
        style={{ height }}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ height, width: "100%" }}
    />
  );
}
