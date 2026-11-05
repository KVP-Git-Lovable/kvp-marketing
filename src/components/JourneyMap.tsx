import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EnhancedRetailerLocation, RetailerStatus } from './gps/RetailerListModal';
import { supabase } from '@/integrations/supabase/client';

interface Position {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: Date;
}

export interface DayGroup {
  date: string;           // 'yyyy-MM-dd'
  dayLabel: string;       // 'Mon', 'Tue', etc.
  color: string;          // hex color
  retailers: EnhancedRetailerLocation[];
  startLocation?: { latitude: number; longitude: number };
}

interface JourneyMapProps {
  positions: Position[];
  retailers?: EnhancedRetailerLocation[];
  dayGroups?: DayGroup[];
  height?: string;
  totalGpsDistance?: number;
}

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Marker color URLs
const markerColors: Record<RetailerStatus, string> = {
  planned: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  productive: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  unproductive: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  pending: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
};

// Calculate distance between two points using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Nearest-neighbor algorithm for route optimization
const optimizeRoute = (retailers: EnhancedRetailerLocation[], startLat?: number, startLon?: number): EnhancedRetailerLocation[] => {
  if (retailers.length <= 1) return retailers;

  const unvisited = [...retailers];
  const optimized: EnhancedRetailerLocation[] = [];

  let currentLat = startLat ?? unvisited[0].latitude;
  let currentLon = startLon ?? unvisited[0].longitude;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateDistance(currentLat, currentLon, unvisited[i].latitude, unvisited[i].longitude);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const nearest = unvisited.splice(nearestIdx, 1)[0];
    optimized.push({ ...nearest, sequenceNumber: optimized.length + 1 });
    currentLat = nearest.latitude;
    currentLon = nearest.longitude;
  }

  return optimized;
};

// Sort and optimize a day's retailers: completed by check-in time, pending by nearest-neighbor
const buildDayRoute = (
  retailers: EnhancedRetailerLocation[],
  startLat?: number,
  startLon?: number
): EnhancedRetailerLocation[] => {
  const completed = retailers
    .filter(r => r.status === 'productive' || r.status === 'unproductive')
    .sort((a, b) => {
      if (!a.checkInTime) return 1;
      if (!b.checkInTime) return -1;
      return new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
    });

  const pending = retailers.filter(r => r.status === 'pending' || r.status === 'planned');

  // Optimize pending from last completed or start point
  const lastCompleted = completed[completed.length - 1];
  const optimizeLat = lastCompleted?.latitude ?? startLat;
  const optimizeLon = lastCompleted?.longitude ?? startLon;
  const optimizedPending = optimizeRoute(pending, optimizeLat, optimizeLon);

  const all = [...completed, ...optimizedPending];
  return all.map((r, idx) => ({ ...r, sequenceNumber: idx + 1 }));
};

// Fetch road-following route geometry via edge function proxy to OSRM
async function fetchOSRMRoute(coords: L.LatLngExpression[]): Promise<L.LatLngExpression[]> {
  if (coords.length < 2) return coords;

  try {
    const coordinates = coords.map((c) => {
      const [lat, lng] = c as [number, number];
      return [lat, lng];
    });

    const { data, error } = await supabase.functions.invoke('osrm-route', {
      body: { coordinates },
    });

    if (error) throw error;

    if (data.code !== 'Ok' || !data.routes?.[0]?.geometry?.coordinates) {
      throw new Error('No route found');
    }

    // GeoJSON coordinates are [lng, lat], convert to [lat, lng] for Leaflet
    return data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression
    );
  } catch (error) {
    console.warn('OSRM route fetch failed, falling back to straight line:', error);
    return coords; // Fallback to straight line
  }
}

export const JourneyMap: React.FC<JourneyMapProps> = ({
  positions,
  retailers = [],
  dayGroups,
  height = '500px',
  totalGpsDistance
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [optimizedRetailers, setOptimizedRetailers] = useState<EnhancedRetailerLocation[]>([]);
  const [totalRouteDistance, setTotalRouteDistance] = useState<number>(0);
  const [visibleDays, setVisibleDays] = useState<Set<string>>(new Set());
  // Cache layer groups per day to avoid redrawing on toggle
  const dayLayerGroupsRef = useRef<Map<string, L.LayerGroup>>(new Map());

  const isMultiDay = dayGroups && dayGroups.length > 0;

  // Initialize visibleDays when dayGroups changes
  useEffect(() => {
    if (dayGroups && dayGroups.length > 0) {
      setVisibleDays(new Set(dayGroups.map(dg => dg.date)));
    }
  }, [dayGroups]);

  // Toggle day layer visibility without redrawing
  useEffect(() => {
    if (!mapRef.current || !isMultiDay) return;
    dayLayerGroupsRef.current.forEach((layerGroup, dateStr) => {
      if (visibleDays.has(dateStr)) {
        if (!mapRef.current!.hasLayer(layerGroup)) {
          layerGroup.addTo(mapRef.current!);
        }
      } else {
        if (mapRef.current!.hasLayer(layerGroup)) {
          mapRef.current!.removeLayer(layerGroup);
        }
      }
    });
  }, [visibleDays, isMultiDay]);

  // Optimize route for single-day mode
  useEffect(() => {
    if (isMultiDay) return; // Skip for multi-day mode

    if (retailers.length > 0) {
      const pendingAndPlanned = retailers.filter(r => r.status === 'pending' || r.status === 'planned');
      const completedRetailers = retailers.filter(r => r.status === 'productive' || r.status === 'unproductive');

      const startPoint = positions.length > 0
        ? { lat: positions[positions.length - 1].latitude, lon: positions[positions.length - 1].longitude }
        : undefined;

      const optimizedPending = optimizeRoute(pendingAndPlanned, startPoint?.lat, startPoint?.lon);

      const sortedCompleted = [...completedRetailers].sort((a, b) => {
        if (!a.checkInTime) return 1;
        if (!b.checkInTime) return -1;
        return new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
      }).map((r, idx) => ({ ...r, sequenceNumber: idx + 1 }));

      const allOptimized = [
        ...sortedCompleted,
        ...optimizedPending.map((r, idx) => ({ ...r, sequenceNumber: sortedCompleted.length + idx + 1 }))
      ];

      setOptimizedRetailers(allOptimized);

      let distance = 0;
      for (let i = 0; i < allOptimized.length - 1; i++) {
        distance += calculateDistance(
          allOptimized[i].latitude, allOptimized[i].longitude,
          allOptimized[i + 1].latitude, allOptimized[i + 1].longitude
        );
      }
      setTotalRouteDistance(distance);
    } else {
      setOptimizedRetailers([]);
      setTotalRouteDistance(0);
    }
  }, [retailers, positions, isMultiDay]);

  // Create status-based marker icon
  const createRetailerIcon = (status: RetailerStatus) => {
    return L.icon({
      iconUrl: markerColors[status],
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [18, 30],
      iconAnchor: [9, 30],
      popupAnchor: [1, -25],
      shadowSize: [30, 30]
    });
  };

  // Initialize map only once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 13,
      zoomAnimation: true,
      fadeAnimation: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.stop();
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Status labels for popups
  const statusLabels: Record<RetailerStatus, { label: string; color: string }> = {
    planned: { label: 'Planned', color: '#3b82f6' },
    productive: { label: 'Productive', color: '#22c55e' },
    unproductive: { label: 'Unproductive', color: '#ef4444' },
    pending: { label: 'Pending', color: '#f97316' },
  };

  // Update map layers when data changes
  useEffect(() => {
    let cancelled = false;

    const updateMap = async () => {
    if (!mapRef.current) return;

    const hasData = isMultiDay
      ? dayGroups.some(dg => dg.retailers.length > 0 || dg.startLocation)
      : (positions.length > 0 || optimizedRetailers.length > 0);

    if (!hasData) return;

    // Clear existing layers except tile layer
    mapRef.current.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        mapRef.current?.removeLayer(layer);
      }
    });
    // Clear cached layer groups
    dayLayerGroupsRef.current.clear();

    const allCoordinates: L.LatLngExpression[] = [];

    if (isMultiDay) {
      // ===== MULTI-DAY MODE =====
      // Build layer groups for ALL days (not just visible), cache them
      for (const dayGroup of dayGroups) {
        if (cancelled || !mapRef.current) return;
        const layerGroup = L.layerGroup();
        const route = buildDayRoute(
          dayGroup.retailers,
          dayGroup.startLocation?.latitude,
          dayGroup.startLocation?.longitude
        );

        // Build polyline coordinates: start location -> retailers in order
        const routeCoords: L.LatLngExpression[] = [];

        if (dayGroup.startLocation) {
          routeCoords.push([dayGroup.startLocation.latitude, dayGroup.startLocation.longitude]);
          allCoordinates.push([dayGroup.startLocation.latitude, dayGroup.startLocation.longitude]);

          // Add start marker with day label
          L.marker([dayGroup.startLocation.latitude, dayGroup.startLocation.longitude], {
            icon: L.divIcon({
              className: 'day-start-marker',
              html: `<div style="background: ${dayGroup.color}; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3); border: 2px solid white;">
                ▶ ${dayGroup.dayLabel}
              </div>`,
              iconSize: [60, 24],
              iconAnchor: [30, 12],
            })
          }).addTo(layerGroup);
        }

        route.forEach((retailer) => {
          routeCoords.push([retailer.latitude, retailer.longitude]);
          allCoordinates.push([retailer.latitude, retailer.longitude]);

          // Add retailer marker with status color
          const icon = createRetailerIcon(retailer.status);
          const statusInfo = statusLabels[retailer.status];

          L.marker([retailer.latitude, retailer.longitude], { icon })
            .addTo(layerGroup)
            .bindPopup(`
              <div style="min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="background: ${dayGroup.color}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">
                    ${retailer.sequenceNumber || ''}
                  </span>
                  <strong style="font-size: 14px;">${retailer.name}</strong>
                </div>
                <div style="color: #666; font-size: 12px;">
                  <div><strong>Day:</strong> ${dayGroup.dayLabel} (${dayGroup.date})</div>
                  <div><strong>Address:</strong> ${retailer.address || 'N/A'}</div>
                  <div><strong>Status:</strong> <span style="color: ${statusInfo.color}">${statusInfo.label}</span></div>
                  ${retailer.checkInTime ? `<div><strong>Check-in:</strong> ${new Date(retailer.checkInTime).toLocaleTimeString()}</div>` : ''}
                  ${retailer.hasOrder ? '<div style="color: #22c55e; font-weight: bold;">✓ Order Placed</div>' : ''}
                </div>
              </div>
            `);
        });

        // Draw day's polyline with road-following geometry from OSRM
        if (routeCoords.length >= 2) {
          const roadGeometry = await fetchOSRMRoute(routeCoords);
          if (cancelled || !mapRef.current) return;
          L.polyline(roadGeometry, {
            color: dayGroup.color,
            weight: 4,
            opacity: 0.85,
          }).addTo(layerGroup);
        }

        // Cache the layer group
        dayLayerGroupsRef.current.set(dayGroup.date, layerGroup);
        // Only add to map if currently visible
        if (visibleDays.has(dayGroup.date)) {
          layerGroup.addTo(mapRef.current!);
        }
      }
    } else {
      // ===== SINGLE-DAY MODE (existing behavior) =====
      if (optimizedRetailers.length > 0) {
        const routeCoordinates: L.LatLngExpression[] = optimizedRetailers.map((retailer) => [
          retailer.latitude, retailer.longitude,
        ]);

        const roadGeometry = await fetchOSRMRoute(routeCoordinates);
        if (cancelled || !mapRef.current) return;
        L.polyline(roadGeometry, {
          color: '#8b5cf6', weight: 4, opacity: 0.8, dashArray: '10, 10'
        }).addTo(mapRef.current);

        optimizedRetailers.forEach((retailer) => {
          const icon = createRetailerIcon(retailer.status);
          const statusInfo = statusLabels[retailer.status];

          L.marker([retailer.latitude, retailer.longitude], { icon })
            .addTo(mapRef.current!)
            .bindPopup(`
              <div style="min-width: 200px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                  <span style="background: ${statusInfo.color}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px;">
                    ${retailer.sequenceNumber || ''}
                  </span>
                  <strong style="color: ${statusInfo.color}; font-size: 16px;">${retailer.name}</strong>
                </div>
                <div style="color: #666;">
                  <div><strong>Address:</strong> ${retailer.address || 'N/A'}</div>
                  <div><strong>Status:</strong> <span style="color: ${statusInfo.color}">${statusInfo.label}</span></div>
                  ${retailer.checkInTime ? `<div><strong>Check-in:</strong> ${new Date(retailer.checkInTime).toLocaleTimeString()}</div>` : ''}
                  ${retailer.hasOrder ? '<div style="color: #22c55e; font-weight: bold;">✓ Order Placed</div>' : ''}
                </div>
              </div>
            `);
        });

        const distanceToShow = totalGpsDistance !== undefined && totalGpsDistance > 0
          ? totalGpsDistance : totalRouteDistance;
        const distanceLabel = totalGpsDistance !== undefined && totalGpsDistance > 0
          ? 'Traveled' : 'Route';

        if (distanceToShow > 0) {
          const midIdx = Math.floor(optimizedRetailers.length / 2);
          const midPoint = optimizedRetailers[midIdx];
          L.marker([midPoint.latitude, midPoint.longitude], {
            icon: L.divIcon({
              className: 'route-distance-label',
              html: `<div style="background: #8b5cf6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                ${distanceLabel}: ${distanceToShow.toFixed(1)} km
              </div>`,
              iconSize: [100, 24],
              iconAnchor: [50, 12],
            })
          }).addTo(mapRef.current);
        }
      }

      // Add GPS tracking path
      if (positions.length > 0) {
        const pathCoordinates: L.LatLngExpression[] = positions.map((pos) => [pos.latitude, pos.longitude]);

        L.polyline(pathCoordinates, { color: '#3b82f6', weight: 2, opacity: 0.5 }).addTo(mapRef.current);

        const blueIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
          iconSize: [15, 25], iconAnchor: [7, 25], popupAnchor: [1, -20], shadowSize: [25, 25]
        });

        L.marker([positions[0].latitude, positions[0].longitude], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
            iconSize: [20, 33], iconAnchor: [10, 33], popupAnchor: [1, -28], shadowSize: [33, 33]
          })
        })
          .addTo(mapRef.current)
          .bindPopup(`<strong>GPS Start</strong><br/>${positions[0].timestamp.toLocaleTimeString()}`);

        const waypointInterval = Math.max(1, Math.floor(positions.length / 10));
        positions.forEach((pos, index) => {
          if (index > 0 && index < positions.length - 1 && index % waypointInterval === 0) {
            L.marker([pos.latitude, pos.longitude], { icon: blueIcon })
              .addTo(mapRef.current!)
              .bindPopup(`<strong>GPS Point</strong><br/>${pos.timestamp.toLocaleTimeString()}`);
          }
        });
      }
    }

    // Fit bounds for single-day (allCoordinates already populated for multi-day)
    if (!isMultiDay) {
      if (optimizedRetailers.length > 0) {
        optimizedRetailers.forEach(r => allCoordinates.push([r.latitude, r.longitude]));
      }
      if (positions.length > 0) {
        positions.forEach(p => allCoordinates.push([p.latitude, p.longitude]));
      }
    }

    if (allCoordinates.length > 0) {
      const bounds = L.latLngBounds(allCoordinates as L.LatLngTuple[]);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], animate: false });
    }
    };

    updateMap();

    return () => { cancelled = true; };
  }, [positions, optimizedRetailers, totalRouteDistance, dayGroups, isMultiDay]);

  if (positions.length === 0 && retailers.length === 0 && (!dayGroups || dayGroups.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg" style={{ height }}>
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No retailers scheduled for this day</p>
          <p className="text-sm text-muted-foreground">Add retailers to your day plan to see the route map</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Legend */}
      {isMultiDay ? (
        /* Multi-day legend: day colors + status colors */
        <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2 px-2 py-1.5 bg-muted/50 rounded-lg text-xs">
            {dayGroups.map((dg) => {
              const isActive = visibleDays.has(dg.date);
              return (
                <button
                  key={dg.date}
                  onClick={() => {
                    setVisibleDays(prev => {
                      const next = new Set(prev);
                      if (next.has(dg.date)) {
                        next.delete(dg.date);
                      } else {
                        next.add(dg.date);
                      }
                      return next;
                    });
                  }}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all cursor-pointer ${
                    isActive ? 'opacity-100' : 'opacity-40'
                  }`}
                >
                  <div
                    className="w-6 h-1.5 rounded-full transition-colors"
                    style={{ backgroundColor: isActive ? dg.color : '#9ca3af' }}
                  ></div>
                  <span className={`font-medium ${!isActive ? 'line-through' : ''}`}>{dg.dayLabel}</span>
                  <span className="text-muted-foreground">({dg.retailers.length})</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 px-2 py-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
              <span>Planned</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
              <span>Productive</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <span>Unproductive</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
              <span>Pending</span>
            </div>
          </div>
        </div>
      ) : (
        /* Single-day legend (existing) */
        <div className="flex flex-wrap gap-3 px-2 py-1.5 bg-muted/50 rounded-lg text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Planned</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Productive</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Unproductive</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span>Pending</span>
          </div>
          {(totalGpsDistance !== undefined && totalGpsDistance > 0) ? (
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-purple-600 font-medium">Traveled: {totalGpsDistance.toFixed(1)} km</span>
            </div>
          ) : totalRouteDistance > 0 ? (
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-purple-600 font-medium">Route: {totalRouteDistance.toFixed(1)} km</span>
            </div>
          ) : null}
        </div>
      )}

      <div
        ref={containerRef}
        style={{ height, width: '100%' }}
        className="rounded-lg"
      />
    </div>
  );
};
