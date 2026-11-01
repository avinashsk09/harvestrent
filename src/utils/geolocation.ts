import { calculateDistanceKm } from '../lib/constants';

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number; // in metres
  isRough: boolean; // accuracy > 100m
  village?: string;
  district?: string;
  displayName?: string;
}

export interface GeolocationError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED' | 'INSECURE_ORIGIN' | 'UNKNOWN';
  messageKey: string;
  fallbackMessage: string;
}

// In-memory cache for reverse geocoding to respect OpenStreetMap Nominatim 1 request per second
const geocodeCache = new Map<string, { village: string; district: string; displayName: string }>();
let lastNominatimRequestTime = 0;

/**
 * Check if the current origin is secure (HTTPS or localhost)
 */
export function isSecureOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.endsWith('.localhost')
  );
}

/**
 * Reverse geocode coordinates to village, district, state using Nominatim
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<{ village: string; district: string; displayName: string }> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // Throttle to respect 1 req/sec policy
  const now = Date.now();
  const timeSinceLast = now - lastNominatimRequestTime;
  if (timeSinceLast < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - timeSinceLast));
  }
  lastNominatimRequestTime = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HarvestRentals-AgriApp/1.0 (contact@harvestrentals.in)',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim returned ${response.status}`);
    }

    const data = await response.json();
    const addr = data.address || {};

    const village =
      addr.village ||
      addr.hamlet ||
      addr.town ||
      addr.suburb ||
      addr.neighbourhood ||
      addr.locality ||
      addr.city_district ||
      '';

    const district =
      addr.state_district ||
      addr.county ||
      addr.district ||
      addr.city ||
      '';

    const displayName =
      village && district
        ? `${village}, ${district}`
        : data.display_name
        ? data.display_name.split(',').slice(0, 3).join(',')
        : `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const result = { village, district, displayName };
    geocodeCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('Reverse geocoding fallback to coordinates:', err);
    return {
      village: '',
      district: '',
      displayName: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  }
}

/**
 * Get high accuracy current location
 * Listens for up to 15 seconds if accuracy is worse than 100m to find the best reading
 */
export function getCurrentPositionAccurate(): Promise<LocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      const err: GeolocationError = {
        code: 'NOT_SUPPORTED',
        messageKey: 'geoNotSupported',
        fallbackMessage: 'Geolocation is not supported by your browser. Please enter your village manually.',
      };
      return reject(err);
    }

    if (!isSecureOrigin()) {
      const err: GeolocationError = {
        code: 'INSECURE_ORIGIN',
        messageKey: 'geoInsecureOrigin',
        fallbackMessage: 'Location requires a secure connection (HTTPS or localhost). Please enter your village manually.',
      };
      return reject(err);
    }

    let bestReading: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let timer: any = null;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const finish = async (pos: GeolocationPosition) => {
      cleanup();
      const accuracy = Math.round(pos.coords.accuracy);
      const isRough = accuracy > 100;

      // Reverse geocode
      const geoInfo = await reverseGeocodeCoordinates(pos.coords.latitude, pos.coords.longitude);

      resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy,
        isRough,
        village: geoInfo.village,
        district: geoInfo.district,
        displayName: geoInfo.displayName,
      });
    };

    // Timeout: if no reading under 100m received within 15 seconds, use best available or timeout error
    timer = setTimeout(() => {
      if (bestReading) {
        finish(bestReading);
      } else {
        cleanup();
        const err: GeolocationError = {
          code: 'TIMEOUT',
          messageKey: 'geoTimeout',
          fallbackMessage: 'GPS signal timed out. Please verify device location permissions or enter village manually.',
        };
        reject(err);
      }
    }, 15000);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestReading || pos.coords.accuracy < bestReading.coords.accuracy) {
          bestReading = pos;
        }

        // If high accuracy (< 100m) obtained, resolve immediately!
        if (pos.coords.accuracy <= 100) {
          finish(pos);
        }
      },
      (err) => {
        // If we already have a reading, resolve with it
        if (bestReading) {
          finish(bestReading);
          return;
        }

        cleanup();
        let code: GeolocationError['code'] = 'UNKNOWN';
        let messageKey = 'geoUnknown';
        let fallback = 'Unable to determine your location. Please enter village manually.';

        if (err.code === err.PERMISSION_DENIED) {
          code = 'PERMISSION_DENIED';
          messageKey = 'geoPermissionDenied';
          fallback = 'Location permission was denied. You can enable it in your browser settings or select your district manually.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          code = 'POSITION_UNAVAILABLE';
          messageKey = 'geoUnavailable';
          fallback = 'Location is unavailable on this device. Please select your district manually.';
        } else if (err.code === err.TIMEOUT) {
          code = 'TIMEOUT';
          messageKey = 'geoTimeout';
          fallback = 'Location request timed out. Please enter village manually.';
        }

        reject({ code, messageKey, fallbackMessage: fallback });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Start live location watch with 20m movement throttling
 */
export function startLiveLocationWatch(
  onLocationUpdate: (result: LocationResult) => void,
  onError: (err: GeolocationError) => void
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation || !isSecureOrigin()) {
    onError({
      code: 'NOT_SUPPORTED',
      messageKey: 'geoNotSupported',
      fallbackMessage: 'Live location is not supported in this environment.',
    });
    return () => {};
  }

  let lastLat: number | null = null;
  let lastLng: number | null = null;

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;

      // Throttle: only trigger if user moved at least 20 metres
      if (lastLat !== null && lastLng !== null) {
        const movedKm = calculateDistanceKm(lastLat, lastLng, latitude, longitude);
        if (movedKm < 0.02) {
          // Less than 20m movement, skip to preserve CPU and battery
          return;
        }
      }

      lastLat = latitude;
      lastLng = longitude;

      onLocationUpdate({
        latitude,
        longitude,
        accuracy: Math.round(accuracy),
        isRough: accuracy > 100,
      });
    },
    (err) => {
      onError({
        code: err.code === 1 ? 'PERMISSION_DENIED' : 'POSITION_UNAVAILABLE',
        messageKey: err.code === 1 ? 'geoPermissionDenied' : 'geoUnavailable',
        fallbackMessage: 'Live location update failed.',
      });
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 20000,
    }
  );

  // Return unsubscribe cleanup function
  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}

