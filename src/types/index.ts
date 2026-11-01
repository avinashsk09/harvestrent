export type UserRole = 'farmer' | 'owner' | 'admin';

export type HarvesterType = 'track' | 'wheel';

export type FuelPolicy = 'included' | 'by_farmer';

export type MachineCondition = 'good' | 'average' | 'needs_care';

export type SortOption = 'best_match' | 'nearest' | 'price_asc' | 'newest';

export type PriceUnit = 'per_acre' | 'per_hour' | 'per_day';

export type BookingStatus = 'pending' | 'confirmed' | 'paid' | 'cancelled';

export type PaymentMethod = 'upi' | 'card' | 'netbanking' | 'cash';

export type PaymentStatus = 'created' | 'success' | 'failed' | 'pending';

export type LanguageCode = 'en' | 'kn' | 'hi';

export interface Profile {
  id: string;
  phone?: string;
  email?: string;
  full_name: string;
  role: UserRole;
  village?: string;
  district?: string;
  avatar_url?: string;
  created_at: string;
  last_sign_in_at?: string;
  email_news_subscribed?: boolean;
}

export interface AuthEvent {
  id: string;
  user_id: string;
  event_type: 'sign_up' | 'sign_in' | 'sign_out';
  role?: string;
  user_agent?: string;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export interface Machine {
  id: string;
  owner_id: string;
  owner_name: string;
  owner_phone: string;
  machine_type: string;
  model_name?: string;
  village: string;
  district: string;
  photo_url: string;
  crops: string[];
  price_amount: number;
  price_unit: PriceUnit;
  is_active: boolean;
  description?: string;
  created_at: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  match_type?: string;
  harvester_type?: HarvesterType;
  fuel_policy?: FuelPolicy;
  driver_included?: boolean;
  header_width_ft?: number;
  has_straw_chopper?: boolean;
  manufacture_year?: number;
  condition?: MachineCondition;
  min_acres?: number;
  owner_note?: string;
  photos?: string[];
}

export interface MachinePhoto {
  id: string;
  machine_id: string;
  url: string;
  position: number;
  created_at?: string;
}

export interface WantedRequest {
  id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_phone: string;
  crop: string;
  acres: number;
  district: string;
  village: string;
  needed_date: string;
  harvester_type?: HarvesterType;
  note?: string;
  status: 'open' | 'fulfilled' | 'closed';
  expires_at: string;
  created_at: string;
}

export interface MachineBusyDate {
  id: string;
  machine_id: string;
  busy_date: string; // YYYY-MM-DD
  status?: 'busy' | 'booked';
  note?: string;
  reason?: string;
  created_at: string;
}

export interface Booking {
  id: string;
  machine_id: string;
  machine?: Machine;
  farmer_id?: string;
  farmer_name: string;
  farmer_phone: string;
  booking_date: string;
  acres: number;
  crop: string;
  price_amount: number;
  price_unit: PriceUnit;
  total_estimate: number;
  advance_amount: number;
  payment_mode: PaymentMethod;
  status: BookingStatus;
  receipt_data?: {
    receipt_no: string;
    transaction_id?: string;
    payment_method: string;
    paid_at: string;
    owner_name: string;
    owner_phone: string;
    machine_type: string;
    village: string;
    district: string;
  };
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  booking_id: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string;
  created_at: string;
}

export interface Report {
  id: string;
  machine_id: string;
  reporter_phone: string;
  reason: string;
  details?: string;
  created_at: string;
}

export interface SearchFilters {
  crop: string;
  village: string;
  district: string;
  acres?: number;
  neededDate?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  harvesterType?: HarvesterType | 'all';
  sortBy?: SortOption;
}

export interface NewsItem {
  id: string;
  title: string;
  source_name: string;
  source_url: string;
  summary?: string;
  image_url?: string;
  published_at: string;
  state?: string;
  category?: string;
  price_trend?: 'up' | 'down' | 'stable';
  crop_name?: string;
  price_change?: string;
  fetched_at: string;
}

export interface NewsRun {
  id: string;
  run_at: string;
  items_fetched: number;
  emails_sent: number;
  error_log?: string;
}

