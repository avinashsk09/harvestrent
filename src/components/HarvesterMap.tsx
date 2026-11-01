import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Machine } from '../types';
import { calculateDistanceKm } from '../lib/constants';

interface HarvesterMapProps {
  userLocation?: { latitude: number; longitude: number; accuracy?: number } | null;
  machines?: Machine[];
  selectedMachineId?: string | null;
  onSelectMachine?: (machine: Machine) => void;
  isDraggableOwnerPin?: boolean;
  ownerPinLocation?: { latitude: number; longitude: number } | null;
  onLocationSelected?: (lat: number, lng: number) => void;
  height?: string;
  zoom?: number;
}

// Custom Leaflet Icons styled with project palette
const createMachineIcon = (isSelected = false) => {
  return L.divIcon({
    className: 'custom-harvester-pin',
    html: `
      <div style="
        background-color: ${isSelected ? '#0F3D26' : '#2E7D4F'};
        color: white;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        cursor: pointer;
        transition: transform 0.15s ease;
      ">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 11V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/>
          <path d="M15 11h6a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2h-1"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5h12v5a2 2 0 0 1-2 2H6"/>
          <circle cx="7" cy="18" r="2"/>
          <circle cx="17" cy="18" r="2"/>
        </svg>
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
};

const createUserIcon = () => {
  return L.divIcon({
    className: 'custom-user-pin',
    html: `
      <div style="
        background-color: #2563EB;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 0 0 2px #2563EB, 0 2px 6px rgba(0,0,0,0.3);
      "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const createDraggableIcon = () => {
  return L.divIcon({
    className: 'custom-draggable-pin',
    html: `
      <div style="
        background-color: #0F3D26;
        color: #F5F0E1;
        width: 38px;
        height: 38px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.35);
        cursor: grab;
      ">
        <div style="transform: rotate(45deg); font-size: 16px;">📍</div>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
  });
};

export const HarvesterMap: React.FC<HarvesterMapProps> = ({
  userLocation,
  machines = [],
  selectedMachineId,
  onSelectMachine,
  isDraggableOwnerPin = false,
  ownerPinLocation,
  onLocationSelected,
  height = '380px',
  zoom = 11,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const draggableMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center: Karnataka center (Mandya / Hassan area)
    const initialLat = userLocation?.latitude || ownerPinLocation?.latitude || 12.9716;
    const initialLng = userLocation?.longitude || ownerPinLocation?.longitude || 77.5946;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([initialLat, initialLng], zoom);

    // OpenStreetMap standard tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers & User position
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // 1. User Position marker + accuracy circle
    if (userLocation?.latitude && userLocation?.longitude) {
      const { latitude, longitude, accuracy } = userLocation;
      const userMarker = L.marker([latitude, longitude], { icon: createUserIcon() });
      userMarker.bindTooltip('You are here', { permanent: false, direction: 'top' });
      layer.addLayer(userMarker);

      // Accuracy circle
      if (accuracy && accuracy > 0) {
        if (accuracyCircleRef.current) {
          map.removeLayer(accuracyCircleRef.current);
        }
        const circle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: '#2563EB',
          fillColor: '#93C5FD',
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(map);
        accuracyCircleRef.current = circle;
      }
    }

    // 2. Machine Markers
    const bounds: L.LatLngExpression[] = [];

    if (userLocation?.latitude && userLocation?.longitude) {
      bounds.push([userLocation.latitude, userLocation.longitude]);
    }

    machines.forEach((m) => {
      if (m.latitude && m.longitude) {
        const isSelected = m.id === selectedMachineId;
        const marker = L.marker([m.latitude, m.longitude], {
          icon: createMachineIcon(isSelected),
        });

        const distText =
          userLocation?.latitude && userLocation?.longitude
            ? `${calculateDistanceKm(userLocation.latitude, userLocation.longitude, m.latitude, m.longitude)} km away`
            : m.distance_km
            ? `${m.distance_km} km away`
            : `${m.village}, ${m.district}`;

        const popupContent = document.createElement('div');
        popupContent.className = 'harvester-popup p-2 max-w-[240px]';
        popupContent.innerHTML = `
          <div style="font-family: inherit;">
            <div style="font-weight: 700; color: #0F3D26; font-size: 14px; margin-bottom: 2px;">
              ${m.model_name || m.machine_type}
            </div>
            <div style="font-size: 12px; color: #526359; margin-bottom: 4px;">
              ${m.village}, ${m.district}
            </div>
            <div style="font-size: 12px; font-weight: 600; color: #2E7D4F; margin-bottom: 6px;">
              ₹${m.price_amount} / ${m.price_unit.replace('_', ' ')}
            </div>
            <div style="font-size: 11px; color: #0F3D26; background: #F5F0E1; padding: 2px 6px; border-radius: 4px; display: inline-block; margin-bottom: 8px;">
              📍 ${distText}
            </div>
            <div style="display: flex; gap: 6px; flex-direction: column;">
              <a href="tel:${m.owner_phone}" style="display: block; text-align: center; background: #0F3D26; color: white; padding: 6px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none;">
                📞 Call Owner (${m.owner_phone})
              </a>
              <a href="https://www.google.com/maps/dir/?api=1&destination=${m.latitude},${m.longitude}" target="_blank" rel="noopener noreferrer" style="display: block; text-align: center; background: #F5F0E1; color: #0F3D26; border: 1px solid #DED7C4; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-decoration: none;">
                🗺️ Get Directions (Google Maps)
              </a>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.on('click', () => {
          if (onSelectMachine) onSelectMachine(m);
        });

        layer.addLayer(marker);
        bounds.push([m.latitude, m.longitude]);
      }
    });

    // 3. Draggable Owner Pin for listing creation
    if (isDraggableOwnerPin) {
      const pinLat = ownerPinLocation?.latitude || userLocation?.latitude || 12.9716;
      const pinLng = ownerPinLocation?.longitude || userLocation?.longitude || 77.5946;

      if (draggableMarkerRef.current) {
        draggableMarkerRef.current.remove();
      }

      const draggableMarker = L.marker([pinLat, pinLng], {
        icon: createDraggableIcon(),
        draggable: true,
      }).addTo(map);

      draggableMarker.bindTooltip('Drag this pin to fine-tune your machine location', {
        permanent: true,
        direction: 'top',
        offset: [0, -38],
      });

      draggableMarker.on('dragend', () => {
        const pos = draggableMarker.getLatLng();
        if (onLocationSelected) {
          onLocationSelected(pos.lat, pos.lng);
        }
      });

      draggableMarkerRef.current = draggableMarker;
      bounds.push([pinLat, pinLng]);
    }

    // Auto-fit bounds if we have positions
    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [40, 40], maxZoom: 14 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0] as L.LatLngExpression, 13);
    }
  }, [userLocation, machines, selectedMachineId, isDraggableOwnerPin, ownerPinLocation]);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: '100%' }}
      className="rounded-xl border border-cream-border overflow-hidden shadow-soft z-0"
    />
  );
};

