// Legitimate agricultural taxonomy and reference data for Karnataka
export const DISTRICTS = [
  'Bagalkot',
  'Ballari (Bellary)',
  'Belagavi (Belgaum)',
  'Bengaluru Rural',
  'Bengaluru Urban',
  'Bidar',
  'Chamarajanagar',
  'Chikkaballapur',
  'Chikkamagaluru',
  'Chitradurga',
  'Dakshina Kannada',
  'Davanagere',
  'Dharwad',
  'Gadag',
  'Hassan',
  'Haveri',
  'Kalaburagi (Gulbarga)',
  'Kodagu',
  'Kolar',
  'Koppal',
  'Mandya',
  'Mysuru (Mysore)',
  'Raichur',
  'Ramanagara',
  'Shivamogga (Shimoga)',
  'Tumakuru (Tumkur)',
  'Udupi',
  'Uttara Kannada',
  'Vijayapura (Bijapur)',
  'Yadgir',
] as const;

export const CROPS = [
  'Paddy (Rice)',
  'Ragi (Finger Millet)',
  'Maize (Corn)',
  'Sugarcane',
  'Wheat',
  'Sunflower',
  'Cotton',
  'Groundnut (Peanut)',
  'Soybean',
  'Jowar (Sorghum)',
  'Pulses (Tur/Gram)',
] as const;

// Karnataka prominent agricultural villages / taluk hubs for suggestions
export const COMMON_VILLAGES: Record<string, string[]> = {
  'Mandya': ['Pandavapura', 'Maddur', 'Malavalli', 'Srirangapatna', 'Nagamangala', 'K.R. Pet'],
  'Mysuru (Mysore)': ['Hunsur', 'Nanjangud', 'Periyapatna', 'T. Narasipura', 'Heggadadevankote', 'Bannur'],
  'Hassan': ['Channarayapatna', 'Arsikere', 'Holenarasipura', 'Alur', 'Sakleshpur', 'Belur'],
  'Davanagere': ['Harihar', 'Channagiri', 'Honnali', 'Jagalur', 'Nyamathi'],
  'Ballari (Bellary)': ['Siruguppa', 'Kampli', 'Sandur', 'Kudligi', 'Kurugodu'],
  'Belagavi (Belgaum)': ['Gokak', 'Bailhongal', 'Chikkodi', 'Athani', 'Raibag', 'Hukkeri'],
  'Tumakuru (Tumkur)': ['Tiptur', 'Kunigal', 'Madhugiri', 'Sira', 'Pavagada', 'Gubbi', 'Turuvekere'],
  'Shivamogga (Shimoga)': ['Bhadravathi', 'Shikaripura', 'Sagara', 'Soraba', 'Thirthahalli'],
  'Raichur': ['Sindhanur', 'Manvi', 'Devadurga', 'Lingsugur', 'Maski'],
  'Koppal': ['Gangavathi', 'Kushtagi', 'Yelburga', 'Karatagi'],
};

// Haversine formula to compute great-circle distance between two points in km
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
export function getTrigramSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = '  ' + str1.toLowerCase().trim() + ' ';
  const s2 = '  ' + str2.toLowerCase().trim() + ' ';

  const tri1 = new Set<string>();
  for (let i = 0; i < s1.length - 2; i++) {
    tri1.add(s1.substring(i, i + 3));
  }

  const tri2 = new Set<string>();
  for (let i = 0; i < s2.length - 2; i++) {
    tri2.add(s2.substring(i, i + 3));
  }

  let intersection = 0;
  tri1.forEach((t) => {
    if (tri2.has(t)) intersection++;
  });

  const union = tri1.size + tri2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

