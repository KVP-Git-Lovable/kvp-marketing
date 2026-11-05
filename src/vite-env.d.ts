/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_PROJECT_ID: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_GOOGLE_GEOCODING_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Google Maps types
declare namespace google.maps {
  class Map {
    constructor(element: HTMLElement, options?: MapOptions);
    fitBounds(bounds: LatLngBounds, padding?: number | Padding): void;
    setCenter(center: LatLng | LatLngLiteral): void;
    setZoom(zoom: number): void;
    getCenter(): LatLng | null;
    getZoom(): number | undefined;
  }
  
  interface MapOptions {
    center?: LatLngLiteral;
    zoom?: number;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
    zoomControl?: boolean;
    styles?: MapTypeStyle[];
  }
  
  interface MapTypeStyle {
    featureType?: string;
    elementType?: string;
    stylers?: object[];
  }
  
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }
  
  interface Padding {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }
  
  class LatLngBounds {
    constructor();
    extend(point: LatLngLiteral | LatLng): LatLngBounds;
    getCenter(): LatLng;
    isEmpty(): boolean;
  }
  
  class Marker {
    constructor(options?: MarkerOptions);
    setMap(map: Map | null): void;
    addListener(event: string, handler: () => void): void;
  }
  
  interface MarkerOptions {
    position?: LatLngLiteral;
    map?: Map;
    title?: string;
    icon?: string | Symbol;
    label?: string | MarkerLabel;
  }
  
  interface MarkerLabel {
    text: string;
    color?: string;
    fontSize?: string;
    fontWeight?: string;
  }
  
  interface Symbol {
    path: SymbolPath;
    scale?: number;
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeWeight?: number;
  }
  
  enum SymbolPath {
    CIRCLE = 0,
    FORWARD_CLOSED_ARROW = 1,
    FORWARD_OPEN_ARROW = 2,
    BACKWARD_CLOSED_ARROW = 3,
    BACKWARD_OPEN_ARROW = 4
  }
  
  class InfoWindow {
    constructor(options?: InfoWindowOptions);
    open(map?: Map, anchor?: Marker): void;
  }
  
  interface InfoWindowOptions {
    content?: string | HTMLElement;
  }
  
  class Geocoder {
    constructor();
    geocode(
      request: GeocoderRequest,
      callback: (results: GeocoderResult[] | null, status: GeocoderStatus) => void
    ): void;
  }
  
  interface GeocoderRequest {
    address?: string;
    location?: LatLngLiteral;
    placeId?: string;
  }
  
  interface GeocoderResult {
    formatted_address: string;
    geometry: {
      location: LatLng;
    };
    place_id: string;
  }
  
  type GeocoderStatus = 'OK' | 'ZERO_RESULTS' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'INVALID_REQUEST' | 'UNKNOWN_ERROR';
}

interface Window {
  google?: {
    maps?: typeof google.maps;
  };
}
