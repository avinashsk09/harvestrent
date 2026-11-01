import { createClient } from '@supabase/supabase-js';
import { getTrigramSimilarity, calculateDistanceKm } from './constants';
import { Machine, Booking, SearchFilters, MachineBusyDate } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://')
);

// Supabase client
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://api.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'sb-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// Local storage keys for genuine user data persistence
const STORAGE_MACHINES_KEY = 'harvestrent_user_machines';
const STORAGE_BOOKINGS_KEY = 'harvestrent_user_bookings';
const STORAGE_BUSY_KEY = 'harvestrent_user_busy_dates';

// Read real machines created by users
export function getLocalMachines(): Machine[] {
  try {
    const raw = localStorage.getItem(STORAGE_MACHINES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalMachines(machines: Machine[]) {
  try {
    localStorage.setItem(STORAGE_MACHINES_KEY, JSON.stringify(machines));
  } catch (err) {
    console.error('Failed to save machines:', err);
  }
}

export function getLocalBookings(): Booking[] {
  try {
    const raw = localStorage.getItem(STORAGE_BOOKINGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalBookings(bookings: Booking[]) {
  try {
    localStorage.setItem(STORAGE_BOOKINGS_KEY, JSON.stringify(bookings));
  } catch (err) {
    console.error('Failed to save bookings:', err);
  }
}

export function getLocalBusyDates(): MachineBusyDate[] {
  try {
    const raw = localStorage.getItem(STORAGE_BUSY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalBusyDates(busyDates: MachineBusyDate[]) {
  try {
    localStorage.setItem(STORAGE_BUSY_KEY, JSON.stringify(busyDates));
  } catch (err) {
    console.error('Failed to save busy dates:', err);
  }
}

// Upload machine photo to Supabase Storage bucket 'machine-photos'
export async function uploadMachinePhoto(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg';
  const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

  if (isSupabaseConfigured) {
    try {
      const { error: uploadError } = await supabase.storage
        .from('machine-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (!uploadError) {
        const { data } = supabase.storage.from('machine-photos').getPublicUrl(filePath);
        if (data?.publicUrl) {
          return data.publicUrl;
        }
      } else {
        console.warn('Supabase storage upload failed:', uploadError);
      }
    } catch (err) {
      console.warn('Storage upload exception:', err);
    }
  }

  // Fallback: Read as data URL for persistent offline display
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

// Honest machine sorter
export function sortMachines(list: Machine[], sortBy?: string): Machine[] {
  if (!sortBy || sortBy === 'best_match') {
    // Default order: same village first, then same district, then rest
    return [...list].sort((a, b) => {
      const aRank = a.match_type === 'same_village' ? 3 : a.match_type === 'same_district' ? 2 : a.distance_km !== undefined ? 1 : 0;
      const bRank = b.match_type === 'same_village' ? 3 : b.match_type === 'same_district' ? 2 : b.distance_km !== undefined ? 1 : 0;
      if (aRank !== bRank) return bRank - aRank;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  if (sortBy === 'nearest') {
    return [...list].sort((a, b) => (a.distance_km ?? 999999) - (b.distance_km ?? 999999));
  }

  if (sortBy === 'newest') {
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  if (sortBy === 'price_asc') {
    // Honest price sort: Sort per-acre prices first (low to high),
    // and show per-hour and per-day in their own groups. Do not convert between units.
    const perAcre = list.filter((m) => m.price_unit === 'per_acre').sort((a, b) => a.price_amount - b.price_amount);
    const perHour = list.filter((m) => m.price_unit === 'per_hour').sort((a, b) => a.price_amount - b.price_amount);
    const perDay = list.filter((m) => m.price_unit === 'per_day').sort((a, b) => a.price_amount - b.price_amount);
    const others = list.filter((m) => m.price_unit !== 'per_acre' && m.price_unit !== 'per_hour' && m.price_unit !== 'per_day').sort((a, b) => a.price_amount - b.price_amount);
    return [...perAcre, ...perHour, ...perDay, ...others];
  }

  return list;
}

// Search function querying real user machines via PostgreSQL search_machines or local user data
export async function searchHarvesterMachines(filters: SearchFilters): Promise<Machine[]> {
  const { crop, village, district, neededDate, latitude, longitude, radiusKm, harvesterType, sortBy } = filters;

  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc('search_machines', {
        p_crop: crop && crop !== 'All' ? crop : null,
        p_village: village || null,
        p_district: district && district !== 'All' ? district : null,
        p_needed_date: neededDate || null,
        p_lat: latitude || null,
        p_lng: longitude || null,
        p_radius_km: radiusKm || null,
        p_harvester_type: harvesterType && harvesterType !== 'all' ? harvesterType : null,
      });

      if (!error && Array.isArray(data)) {
        const localBusyDates = getLocalBusyDates();
        const local = getLocalMachines().filter((lm) => {
          if (!lm.is_active || data.some((d) => d.id === lm.id)) return false;
          if (harvesterType && harvesterType !== 'all') {
            if (lm.harvester_type !== harvesterType) return false;
          }
          // Strict crop check
          if (crop && crop !== 'All') {
            const hasCrop = lm.crops.some(
              (c) =>
                c.toLowerCase().includes(crop.toLowerCase()) ||
                crop.toLowerCase().includes(c.toLowerCase())
            );
            if (!hasCrop) return false;
          }
          // Strict radius check
          if (radiusKm) {
            if (!latitude || !longitude || !lm.latitude || !lm.longitude) return false;
            const dist = calculateDistanceKm(latitude, longitude, lm.latitude, lm.longitude);
            if (dist > radiusKm) return false;
          }
          // Strict district check
          if (district && district !== 'All') {
            if (lm.district.toLowerCase() !== district.toLowerCase()) return false;
          }
          // Strict village check
          if (village) {
            const matchesVillage =
              lm.village.toLowerCase() === village.toLowerCase() ||
              lm.village.toLowerCase().includes(village.toLowerCase()) ||
              village.toLowerCase().includes(lm.village.toLowerCase());
            if (!matchesVillage) return false;
          }
          if (neededDate) {
            const isBusy = localBusyDates.some((b) => b.machine_id === lm.id && b.busy_date === neededDate);
            if (isBusy) return false;
          }
          return true;
        });
        const combined = local.length > 0 ? [...(data as Machine[]), ...local] : (data as Machine[]);
        return sortMachines(combined, sortBy);
      }
    } catch (err) {
      console.warn('Supabase RPC call fallback to local:', err);
    }
  }

  // Local matching for machines created by real users in the current session/browser
  const allMachines = getLocalMachines();
  const busyDates = getLocalBusyDates();
  const bookings = getLocalBookings();

  // Filter out non-active machines
  let candidates = allMachines.filter((m) => m.is_active);

  // Filter by harvester_type if selected (old listings without a type appear only under 'all')
  if (harvesterType && harvesterType !== 'all') {
    candidates = candidates.filter((m) => m.harvester_type === harvesterType);
  }

  // Filter out busy machines on neededDate
  if (neededDate) {
    candidates = candidates.filter((m) => {
      const hasBusyDate = busyDates.some((b) => b.machine_id === m.id && b.busy_date === neededDate);
      const hasPaidBooking = bookings.some(
        (bk) =>
          bk.machine_id === m.id &&
          bk.booking_date === neededDate &&
          (bk.status === 'confirmed' || bk.status === 'paid')
      );
      return !hasBusyDate && !hasPaidBooking;
    });
  }

  // Filter by crop if selected
  if (crop && crop !== 'All') {
    candidates = candidates.filter((m) =>
      m.crops.some(
        (c) =>
          c.toLowerCase().includes(crop.toLowerCase()) ||
          crop.toLowerCase().includes(c.toLowerCase())
      )
    );
  }

  // If user searched by Coordinates
  if (latitude && longitude) {
    const withDistance = candidates.map((m) => {
      let dist = m.distance_km;
      if (m.latitude && m.longitude) {
        dist = calculateDistanceKm(latitude, longitude, m.latitude, m.longitude);
      }
      return {
        ...m,
        distance_km: dist,
        match_type: 'distance',
      };
    });

    let filtered = withDistance;
    if (radiusKm) {
      filtered = filtered.filter((m) => m.distance_km !== undefined && m.distance_km <= radiusKm);
    }

    filtered.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
    return sortMachines(filtered, sortBy);
  }

  // If user requested radius filter but location coordinates are not available, return []
  if (radiusKm) {
    return [];
  }

  // If no village or district is specified, return active candidates
  if (!village && (!district || district === 'All')) {
    return sortMachines(candidates, sortBy);
  }

  // Rule-based matching with strict conditions
  const scored = candidates.map((m) => {
    let score = 0;
    let matchType = 'nearby';

    if (village) {
      const vSim = getTrigramSimilarity(m.village, village);
      if (m.village.toLowerCase() === village.toLowerCase()) {
        score += 20;
        matchType = 'same_village';
      } else if (m.village.toLowerCase().includes(village.toLowerCase()) || village.toLowerCase().includes(m.village.toLowerCase())) {
        score += 15;
        matchType = 'same_village';
      } else if (vSim > 0.4) {
        score += vSim * 10;
        matchType = 'same_village';
      }
    }

    if (district && district !== 'All') {
      const dSim = getTrigramSimilarity(m.district, district);
      if (m.district.toLowerCase() === district.toLowerCase()) {
        score += 10;
        if (matchType !== 'same_village') matchType = 'same_district';
      } else if (dSim > 0.4) {
        score += dSim * 5;
      }
    }

    return { machine: { ...m, match_type: matchType }, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const matches = scored.filter((s) => s.score > 0).map((s) => s.machine);
  if (matches.length > 0) {
    // If village was searched, strictly only return machines that match the village or district
    if (village) {
      const villageMatches = matches.filter(
        (m) =>
          m.village.toLowerCase().includes(village.toLowerCase()) ||
          village.toLowerCase().includes(m.village.toLowerCase())
      );
      if (villageMatches.length > 0) {
        return sortMachines(villageMatches, sortBy);
      }
      // If no machine in this village, don't return machines from other villages; return empty
      return [];
    }
    return sortMachines(matches, sortBy);
  }

  if (district && district !== 'All' && !village) {
    const fallbackDistrictMatches = candidates
      .filter((m) => m.district.toLowerCase() === district.toLowerCase())
      .map((m) => ({ ...m, match_type: 'same_district' }));
    return sortMachines(fallbackDistrictMatches, sortBy);
  }

  return [];
}
