'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Search, LocateFixed } from 'lucide-react';

// Fix leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export interface LocationData {
  lat: number;
  lng: number;
  address?: string;
  province?: string;
  city?: string;
  district?: string;
  postalCode?: string;
}

interface MapPickerProps {
  onLocationSelect: (location: LocationData) => void;
  defaultLat?: number;
  defaultLng?: number;
}

async function reverseGeocode(lat: number, lng: number): Promise<Partial<LocationData>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { 'Accept-Language': 'id' } }
    );
    const data = await res.json();
    const addr = data.address || {};
    return {
      address: data.display_name,
      province: addr.state || '',
      city: addr.city || addr.town || addr.county || '',
      district: addr.suburb || addr.village || addr.neighbourhood || '',
      postalCode: addr.postcode || '',
    };
  } catch {
    return {};
  }
}

function DraggableMarker({
  position,
  onDragEnd,
}: {
  position: [number, number];
  onDragEnd: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      onDragEnd(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      position={position}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend: () => {
          const marker = markerRef.current;
          if (marker) {
            const { lat, lng } = marker.getLatLng();
            onDragEnd(lat, lng);
          }
        },
      }}
    />
  );
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [map, lat, lng]);
  return null;
}

export function MapPicker({ onLocationSelect, defaultLat, defaultLng }: MapPickerProps) {
  const [position, setPosition] = useState<[number, number]>([
    defaultLat ?? -6.2088,
    defaultLng ?? 106.8456,
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  const handlePositionChange = useCallback(
    async (lat: number, lng: number) => {
      setPosition([lat, lng]);
      const geo = await reverseGeocode(lat, lng);
      onLocationSelect({ lat, lng, ...geo });
    },
    [onLocationSelect]
  );

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`,
        { headers: { 'Accept-Language': 'id' } }
      );
      const results = await res.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        await handlePositionChange(parseFloat(lat), parseFloat(lon));
      }
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handlePositionChange(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        // geolocation error — silently ignore
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Cari lokasi..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
        />
        <Button type="button" variant="outline" size="icon" onClick={handleSearch} disabled={searching}>
          <Search className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={handleUseCurrentLocation}>
          <LocateFixed className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-[300px] rounded-lg overflow-hidden border">
        <MapContainer
          center={position}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DraggableMarker position={position} onDragEnd={handlePositionChange} />
          <RecenterMap lat={position[0]} lng={position[1]} />
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        Klik peta atau geser pin untuk memilih lokasi. Lat: {position[0].toFixed(6)}, Lng: {position[1].toFixed(6)}
      </p>
    </div>
  );
}
