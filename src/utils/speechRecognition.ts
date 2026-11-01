import { LanguageCode } from '../types';

export interface ParsedVoiceQuery {
  rawTranscript: string;
  village?: string;
  crop?: string;
  acres?: number;
}

// Map language codes to BCP 47 tags for Indian speech recognition
export function getSpeechLangCode(lang: LanguageCode): string {
  switch (lang) {
    case 'kn':
      return 'kn-IN';
    case 'hi':
      return 'hi-IN';
    case 'en':
    default:
      return 'en-IN';
  }
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition || 
    (window as any).webkitSpeechRecognition
  );
}

// Common crop keywords across Kannada, Hindi, and English
const CROP_MAP: Record<string, string> = {
  // English
  'paddy': 'Paddy (Rice)',
  'rice': 'Paddy (Rice)',
  'ragi': 'Ragi',
  'finger millet': 'Ragi',
  'maize': 'Maize',
  'corn': 'Maize',
  'sugarcane': 'Sugarcane',
  'wheat': 'Wheat',
  'cotton': 'Cotton',
  'groundnut': 'Groundnut',
  'peanut': 'Groundnut',
  'sunflower': 'Sunflower',
  'soybean': 'Soybean',

  // Kannada
  'ಭತ್ತ': 'Paddy (Rice)',
  'ಭತ್ತದ': 'Paddy (Rice)',
  'ರಾಗಿ': 'Ragi',
  'ರಾಗಿಯ': 'Ragi',
  'ಮೆಕ್ಕೆಜೋಳ': 'Maize',
  'ಜೋಳ': 'Maize',
  'ಮುಸುಕಿನ ಜೋಳ': 'Maize',
  'ಕಬ್ಬು': 'Sugarcane',
  'ಕಬ್ಬಿನ': 'Sugarcane',
  'ಗೋಧಿ': 'Wheat',
  'ಹತ್ತಿ': 'Cotton',
  'ಕಡಲೆಕಾಯಿ': 'Groundnut',
  'ಸೂರ್ಯಕಾಂತಿ': 'Sunflower',

  // Hindi
  'धान': 'Paddy (Rice)',
  'चावल': 'Paddy (Rice)',
  'मक्का': 'Paddy (Rice)',
  'गेहूं': 'Wheat',
  'गेहू': 'Wheat',
  'गन्ना': 'Sugarcane',
  'कपास': 'Cotton',
  'मूंगफली': 'Groundnut',
  'सूरजमुखी': 'Sunflower',
  'सोयाबीन': 'Soybean',
};

// Known villages/towns in Karnataka
const KNOWN_VILLAGES = [
  'Mandya', 'Maddur', 'Pandavapura', 'Srirangapatna', 'Malavalli', 'Nagamangala', 'KR Pet',
  'Harihar', 'Honnali', 'Channagiri', 'Jagalur', 'Davanagere',
  'Channarayapatna', 'Arasikere', 'Holenarasipura', 'Hassan', 'Sakleshpur',
  'Bailhongal', 'Chikkodi', 'Gokak', 'Athani', 'Belagavi',
  'Bhadravati', 'Sagar', 'Shikaripura', 'Shimoga', 'Thirthahalli',
  'Sindhanur', 'Manvi', 'Lingasugur', 'Raichur',
  'Tiptur', 'Kunigal', 'Gubbi', 'Sira', 'Tumkur',
  'Jamkhandi', 'Mudhol', 'Badami', 'Bagalkot',
  'Sirsi', 'Karwar', 'Kumta', 'Yellapur',
  'Koppal', 'Gangavathi', 'Kushtagi',
  'Bellary', 'Hospet', 'Sandur',
  'Chitradurga', 'Hiriyur', 'Challakere'
];

export function parseSpeechToForm(transcript: string): ParsedVoiceQuery {
  const result: ParsedVoiceQuery = {
    rawTranscript: transcript,
  };

  if (!transcript || transcript.trim() === '') return result;

  const lower = transcript.toLowerCase();

  // 1. Extract Crop
  for (const [key, cropName] of Object.entries(CROP_MAP)) {
    if (lower.includes(key.toLowerCase())) {
      result.crop = cropName;
      break;
    }
  }

  // 2. Extract Acres (numbers followed by acre / एकड़ / ಎಕರೆ)
  // Matches: "3 acres", "5 acre", "2.5 ಎಕರೆ", "4 एकड़", or standalone number with acre
  const acreRegex = /(\d+(\.\d+)?)\s*(acre|acres|ac|ekare|ಎಕರೆ|ಏಕರೆ|एकड़|एकर)/i;
  const acreMatch = transcript.match(acreRegex);
  if (acreMatch && acreMatch[1]) {
    result.acres = parseFloat(acreMatch[1]);
  } else {
    // If user just said a number after crop
    const numberRegex = /\b(\d+(\.\d+)?)\b/;
    const numMatch = transcript.match(numberRegex);
    if (numMatch && numMatch[1]) {
      const num = parseFloat(numMatch[1]);
      if (num >= 0.5 && num <= 100) {
        result.acres = num;
      }
    }
  }

  // 3. Extract Village
  // Check against known villages first
  for (const v of KNOWN_VILLAGES) {
    if (lower.includes(v.toLowerCase())) {
      result.village = v;
      break;
    }
  }

  // If no known village found, extract first alphanumeric token or phrase before crop
  if (!result.village) {
    const tokens = transcript.split(/[, ]+/).filter(Boolean);
    for (const t of tokens) {
      const clean = t.replace(/[^a-zA-Z0-9\u0C80-\u0CFF\u0900-\u097F]/g, '');
      if (
        clean.length > 2 &&
        !CROP_MAP[clean.toLowerCase()] &&
        !clean.match(/\d+/) &&
        !['acre', 'acres', 'near', 'in', 'village', 'at', 'ಎಕರೆ', 'एकड़'].includes(clean.toLowerCase())
      ) {
        result.village = clean;
        break;
      }
    }
  }

  return result;
}

export function startSpeechListening(
  lang: LanguageCode,
  onResult: (parsed: ParsedVoiceQuery) => void,
  onError: (error: string) => void,
  onEnd: () => void
): { stop: () => void } {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError('Speech recognition not supported in this browser.');
    onEnd();
    return { stop: () => {} };
  }

  const recognition = new SpeechRecognition();
  recognition.lang = getSpeechLangCode(lang);
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    const parsed = parseSpeechToForm(transcript);
    onResult(parsed);
  };

  recognition.onerror = (event: any) => {
    console.warn('Speech recognition error:', event.error);
    onError(event.error || 'Speech capture failed');
  };

  recognition.onend = () => {
    onEnd();
  };

  try {
    recognition.start();
  } catch (err: any) {
    onError(err.message || 'Could not start microphone');
    onEnd();
  }

  return {
    stop: () => {
      try {
        recognition.stop();
      } catch {}
    },
  };
}

