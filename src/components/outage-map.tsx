"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";

const outagePosition: [number, number] = [37.7749, -122.4194];

export function OutageMap() {
  const mapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const container = mapRef.current as HTMLDivElement & {
      _leaflet_id?: number;
    };
    const existingMap = container._leaflet_id;

    if (existingMap) {
      container._leaflet_id = undefined;
    }

    const map = L.map(container, {
      center: outagePosition,
      zoom: 14,
      scrollWheelZoom: false,
      zoomControl: false,
    });

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    ).addTo(map);

    L.circle(outagePosition, {
      radius: 900,
      color: "#fb7185",
      weight: 2,
      fillColor: "#fb7185",
      fillOpacity: 0.14,
    }).addTo(map);

    const markerHtml = `
      <div style="
        width: 72px;
        height: 72px;
        border-radius: 9999px;
        background: #f43f5e;
        border: 5px solid white;
        box-shadow: 0 18px 36px rgba(244,63,94,0.38);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 700;
        font-size: 20px;
        letter-spacing: -0.02em;
      ">428</div>
    `;

    const marker = L.marker(outagePosition, {
      icon: L.divIcon({
        className: "gridops-marker",
        html: markerHtml,
        iconSize: [72, 72],
        iconAnchor: [36, 36],
      }),
    }).addTo(map);

    marker.bindPopup(`
      <div style="min-width:180px">
        <div style="font-weight:700">Westmore Ave and Union Yard</div>
        <div>Distribution transformer outage</div>
        <div>428 affected customers</div>
      </div>
    `);

    return () => {
      map.remove();
    };
  }, []);

  return <div ref={mapRef} className="h-full w-full" />;
}
