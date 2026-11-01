import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Machine, SearchFilters, MachineBusyDate, HarvesterType, SortOption } from '../types';
import { searchHarvesterMachines, getLocalBusyDates, supabase, isSupabaseConfigured } from '../lib/supabase';
import { DISTRICTS, CROPS, COMMON_VILLAGES } from '../lib/constants';
import { MachineCard } from '../components/MachineCard';
import { VoiceSearchButton } from '../components/VoiceSearchButton';
import { ReportListingModal } from '../components/ReportListingModal';
import { HarvesterMap } from '../components/HarvesterMap';
import { ParsedVoiceQuery } from '../utils/speechRecognition';
import {
  getCurrentPositionAccurate,
  startLiveLocationWatch,
  LocationResult,
  GeolocationError,
} from '../utils/geolocation';
import { Card, Button, Input, Skeleton, Toast, Modal } from '../components/ui';
import {
  buildMonthDays,
  getMonthName,
  getLocalizedWeekdays,
  getTodayIST,
  formatFriendlyDate,
  parseISTDate,
} from '../utils/calendarUtils';
import {
  Search,
  MapPin,
  Wheat,
  Calendar,
  Layers,
  RotateCcw,
  Radio,
  Map as MapIcon,
  List as ListIcon,
  ShieldCheck,
  Compass,
  AlertCircle,
  Crosshair,
  ChevronLeft,
  ChevronRight,
  PhoneCall,
  PlusCircle,
  ArrowUpDown,
  Check,
  Filter,
  Sparkles,
  Navigation,
} from 'lucide-react';

interface FindMachinePageProps {
  onNavigate: (page: string, params?: any) => void;
  onSelectMachineForPayment: (machine: Machine, acres: number, date: string, crop: string) => void;
}

const QUICK_CROPS = [
  { key: 'All', labelKey: 'allCrops', fallback: 'All Crops', icon: '🌾' },
  { key: 'Paddy (Rice)', labelKey: 'cropPaddy', fallback: 'Paddy', icon: '🍚' },
  { key: 'Maize (Corn)', labelKey: 'cropMaize', fallback: 'Maize', icon: '🌽' },
  { key: 'Ragi (Finger Millet)', labelKey: 'cropRagi', fallback: 'Ragi', icon: '🥣' },
  { key: 'Wheat', labelKey: 'cropWheat', fallback: 'Wheat', icon: '🌾' },
  { key: 'Sugarcane', labelKey: 'cropSugarcane', fallback: 'Sugarcane', icon: '🎋' },
];

export const FindMachinePage: React.FC<FindMachinePageProps> = ({
  onNavigate,
  onSelectMachineForPayment,
}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  // URL search params for persistent sort
  const getInitialSort = (): SortOption => {
    if (typeof window === 'undefined') return 'best_match';
    const params = new URLSearchParams(window.location.search);
    const s = params.get('sort');
    if (s === 'nearest' || s === 'price_asc' || s === 'newest') return s;
    return 'best_match';
  };

  // Filter states
  const [village, setVillage] = useState<string>('');
  const [district, setDistrict] = useState<string>('All');
  const [crop, setCrop] = useState<string>('All');
  const [acres, setAcres] = useState<number>(3);
  const [neededDate, setNeededDate] = useState<string>('');
  const [radiusKm, setRadiusKm] = useState<number | undefined>(undefined);
  const [harvesterType, setHarvesterType] = useState<HarvesterType | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>(getInitialSort);

  // View state: 'list' | 'map'
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Geolocation & Live Location state
  const [userLocation, setUserLocation] = useState<LocationResult | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLiveLocationOn, setIsLiveLocationOn] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const liveLocationCleanupRef = useRef<(() => void) | null>(null);

  // Results state
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [busyDates, setBusyDates] = useState<MachineBusyDate[]>([]);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showMoreCropsModal, setShowMoreCropsModal] = useState(false);
  const [showWantedModal, setShowWantedModal] = useState(false);

  // Toast notices
  const [pageToast, setPageToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Wanted form state
  const [wantedCrop, setWantedCrop] = useState<string>('Paddy (Rice)');
  const [wantedAcres, setWantedAcres] = useState<number>(3);
  const [wantedDistrict, setWantedDistrict] = useState<string>(district !== 'All' ? district : 'Ballari');
  const [wantedVillage, setWantedVillage] = useState<string>(village || '');
  const [wantedDate, setWantedDate] = useState<string>('');
  const [wantedType, setWantedType] = useState<string>('any');
  const [wantedNote, setWantedNote] = useState<string>('');
  const [isSubmittingWanted, setIsSubmittingWanted] = useState(false);

  const todayStr = getTodayIST();
  const todayDate = parseISTDate(todayStr);
  const [pickerYear, setPickerYear] = useState<number>(todayDate.getFullYear());
  const [pickerMonth, setPickerMonth] = useState<number>(todayDate.getMonth());

  useEffect(() => {
    const fetchBusyDates = async () => {
      let bList: MachineBusyDate[] = [];
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.from('machine_busy_dates').select('*');
          if (data) bList = data as MachineBusyDate[];
        } catch {}
      }
      const local = getLocalBusyDates();
      const combined = [...bList, ...local.filter((l) => !bList.some((b) => b.id === l.id))];
      setBusyDates(combined);
    };
    fetchBusyDates();
  }, []);

  // Sync sort with URL search param
  const updateSortBy = (newSort: SortOption) => {
    setSortBy(newSort);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (newSort === 'best_match') {
        url.searchParams.delete('sort');
      } else {
        url.searchParams.set('sort', newSort);
      }
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Report modal state
  const [reportingMachine, setReportingMachine] = useState<Machine | null>(null);

  // Village suggestions based on selected district
  const districtVillages = district !== 'All' ? COMMON_VILLAGES[district] || [] : [];

  // Stop live location on unmount
  useEffect(() => {
    return () => {
      if (liveLocationCleanupRef.current) {
        liveLocationCleanupRef.current();
        liveLocationCleanupRef.current = null;
      }
    };
  }, []);

  // Search request counter to prevent out-of-order race conditions
  const searchSeqRef = useRef<number>(0);

  // Search logic
  const handleSearch = async (overrideFilters?: Partial<SearchFilters>) => {
    const currentSeq = ++searchSeqRef.current;
    setLoading(true);
    setHasSearched(true);

    const activeFilters: SearchFilters = {
      village: overrideFilters?.village !== undefined ? overrideFilters.village : village.trim(),
      district: overrideFilters?.district !== undefined ? overrideFilters.district : district,
      crop: overrideFilters?.crop !== undefined ? overrideFilters.crop : crop,
      acres: overrideFilters?.acres !== undefined ? overrideFilters.acres : acres,
      neededDate: overrideFilters?.neededDate !== undefined ? overrideFilters.neededDate : neededDate,
      latitude: overrideFilters?.latitude !== undefined ? overrideFilters.latitude : userLocation?.latitude,
      longitude: overrideFilters?.longitude !== undefined ? overrideFilters.longitude : userLocation?.longitude,
      radiusKm: overrideFilters?.radiusKm !== undefined ? overrideFilters.radiusKm : radiusKm,
      harvesterType: overrideFilters?.harvesterType !== undefined ? overrideFilters.harvesterType : harvesterType,
      sortBy: overrideFilters?.sortBy !== undefined ? overrideFilters.sortBy : sortBy,
    };

    try {
      const results = await searchHarvesterMachines(activeFilters);
      if (currentSeq === searchSeqRef.current) {
        setMachines(results);
      }
    } catch (err) {
      if (currentSeq === searchSeqRef.current) {
        console.error('Search failed:', err);
        setMachines([]);
      }
    } finally {
      if (currentSeq === searchSeqRef.current) {
        setLoading(false);
      }
    }
  };

  // Re-run search when sort or radius or harvesterType changes
  useEffect(() => {
    handleSearch({ harvesterType, sortBy, radiusKm });
  }, [harvesterType, sortBy, radiusKm]);

  // Request Current Location
  const handleTriggerLocation = async () => {
    const hasExplained = sessionStorage.getItem('harvestrent_location_explained');
    if (!hasExplained) {
      setShowPermissionModal(true);
      return;
    }
    executeGetLocation();
  };

  const executeGetLocation = async () => {
    setShowPermissionModal(false);
    sessionStorage.setItem('harvestrent_location_explained', 'true');
    setIsDetectingLocation(true);
    setGeoError(null);

    try {
      const result = await getCurrentPositionAccurate();
      setUserLocation(result);

      if (result.district) {
        const matchedDistrict = DISTRICTS.find(
          (d) => d.toLowerCase().includes(result.district!.toLowerCase()) || result.district!.toLowerCase().includes(d.toLowerCase())
        );
        if (matchedDistrict) {
          setDistrict(matchedDistrict);
        }
      }

      if (result.village) {
        setVillage(result.village);
      }

      handleSearch({
        latitude: result.latitude,
        longitude: result.longitude,
        village: result.village || village,
        district: result.district || district,
      });
    } catch (err: any) {
      const gErr = err as GeolocationError;
      const translatedMsg = (t as any)[gErr?.messageKey] || gErr?.fallbackMessage || 'Failed to detect location.';
      setGeoError(translatedMsg);
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Toggle Live Location
  const toggleLiveLocation = () => {
    if (isLiveLocationOn) {
      if (liveLocationCleanupRef.current) {
        liveLocationCleanupRef.current();
        liveLocationCleanupRef.current = null;
      }
      setIsLiveLocationOn(false);
    } else {
      setIsLiveLocationOn(true);
      setGeoError(null);

      const cleanup = startLiveLocationWatch(
        (updatedLoc) => {
          setUserLocation(updatedLoc);
          handleSearch({
            latitude: updatedLoc.latitude,
            longitude: updatedLoc.longitude,
          });
        },
        (err) => {
          const msg = (t as any)[err.messageKey] || err.fallbackMessage;
          setGeoError(msg);
          setIsLiveLocationOn(false);
        }
      );

      liveLocationCleanupRef.current = cleanup;
    }
  };

  // Voice Search Handler
  const handleVoiceParsed = (query: ParsedVoiceQuery) => {
    const newVillage = query.village || village;
    const newCrop = query.crop || crop;
    const newAcres = query.acres || acres;

    if (query.village) setVillage(query.village);
    if (query.crop) setCrop(query.crop);
    if (query.acres) setAcres(query.acres);

    handleSearch({
      village: newVillage,
      crop: newCrop,
      acres: newAcres,
    });
  };

  const handleClearFilters = () => {
    setVillage('');
    setDistrict('All');
    setCrop('All');
    setAcres(3);
    setNeededDate('');
    setRadiusKm(undefined);
    setHarvesterType('all');
    updateSortBy('best_match');
    setUserLocation(null);
    if (isLiveLocationOn && liveLocationCleanupRef.current) {
      liveLocationCleanupRef.current();
      liveLocationCleanupRef.current = null;
      setIsLiveLocationOn(false);
    }
    handleSearch({
      village: '',
      district: 'All',
      crop: 'All',
      acres: 3,
      neededDate: '',
      latitude: undefined,
      longitude: undefined,
      radiusKm: undefined,
      harvesterType: 'all',
      sortBy: 'best_match',
    });
  };

  const handleBook = (machine: Machine) => {
    onSelectMachineForPayment(
      machine,
      acres,
      neededDate || new Date().toISOString().split('T')[0],
      crop === 'All' ? machine.crops[0] : crop
    );
    onNavigate('payment');
  };

  // Zero Results Action 1: Search Whole District
  const handleSearchWholeDistrict = () => {
    setVillage('');
    setRadiusKm(undefined);
    handleSearch({ village: '', radiusKm: undefined });
  };

  // Post Wanted Request submission
  const handlePostWantedRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onNavigate('login');
      return;
    }

    if (!wantedDate) {
      setPageToast({ type: 'error', message: 'Please select the date when the harvester is needed.' });
      return;
    }

    setIsSubmittingWanted(true);
    try {
      const { data, error } = await supabase.from('wanted_requests').insert({
        farmer_id: user.id,
        farmer_name: user.full_name || 'Farmer',
        farmer_phone: user.phone || '',
        crop: wantedCrop,
        acres: Number(wantedAcres),
        district: wantedDistrict,
        village: wantedVillage.trim(),
        needed_date: wantedDate,
        harvester_type: wantedType,
        note: wantedNote.trim() || null,
        status: 'open',
      }).select().single();

      if (error) {
        if (error.message.includes('rate_limit') || error.message.includes('3 open')) {
          setPageToast({
            type: 'error',
            message: 'You already have 3 open harvester requests. Please fulfill or close an earlier request.',
          });
        } else {
          setPageToast({ type: 'error', message: error.message || 'Failed to post wanted request.' });
        }
      } else {
        setShowWantedModal(false);
        setPageToast({
          type: 'success',
          message: t.requestPostedSuccess || 'Wanted request posted successfully! Local machine owners can now call you.',
        });
        setWantedNote('');
      }
    } catch (err: any) {
      setPageToast({ type: 'error', message: err.message || 'Error posting request' });
    } finally {
      setIsSubmittingWanted(false);
    }
  };

  // Check if warning should show for Paddy + Wheeled
  const isPaddy = crop.toLowerCase().includes('paddy') || crop.toLowerCase().includes('rice');
  const showPaddyWheelWarning = isPaddy && harvesterType === 'wheel';

  // Check if any non-per-acre machines are shown under price_asc sort
  const hasHourlyOrDaily = sortBy === 'price_asc' && machines.some((m) => m.price_unit !== 'per_acre');

  return (
    <div className="space-y-6 pb-24">
      {/* Toast Notification */}
      {pageToast && (
        <Toast
          type={pageToast.type}
          message={pageToast.message}
          onClose={() => setPageToast(null)}
        />
      )}

      {/* Geolocation Explanation Modal */}
      <Modal
        isOpen={showPermissionModal}
        onClose={() => setShowPermissionModal(false)}
        title={t.locationPermissionModalTitle || 'Allow Location Access'}
      >
        <div className="space-y-4">
          <div className="w-12 h-12 rounded-xl bg-agri-light text-forest flex items-center justify-center mx-auto">
            <Compass className="w-6 h-6 text-agri" />
          </div>
          <p className="text-sm text-neutralText-secondary text-center leading-relaxed">
            {t.locationPermissionModalDesc}
          </p>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowPermissionModal(false)}
            >
              {t.cancel || 'Cancel'}
            </Button>
            <Button
              variant="primary"
              fullWidth
              onClick={executeGetLocation}
            >
              {t.allowLocationBtn || 'Allow Location'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* PART 4: HORIZONTAL 1-TAP QUICK CROP PILLS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-forest uppercase tracking-wider flex items-center gap-1.5">
            <Wheat className="w-3.5 h-3.5 text-agri" />
            {t.cropLabel || 'Select Crop'}
          </span>
          {crop !== 'All' && (
            <button
              type="button"
              onClick={() => {
                setCrop('All');
                handleSearch({ crop: 'All' });
              }}
              className="text-xs font-semibold text-agri hover:text-forest underline"
            >
              Show all crops
            </button>
          )}
        </div>

        <div
          className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scroll-smooth focus:outline-none"
          tabIndex={0}
          role="region"
          aria-label="Quick crop filters"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {QUICK_CROPS.map((qc) => {
            const isSelected = crop === qc.key;
            const label = (t as any)[qc.labelKey] || qc.fallback;
            return (
              <button
                key={qc.key}
                type="button"
                onClick={() => {
                  setCrop(qc.key);
                  handleSearch({ crop: qc.key });
                }}
                style={{ scrollSnapAlign: 'start' }}
                aria-pressed={isSelected}
                className={`min-h-[48px] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 whitespace-nowrap transition-all shadow-soft flex-shrink-0 border ${
                  isSelected
                    ? 'bg-forest text-white border-forest ring-2 ring-forest/20 shadow-md'
                    : 'bg-white text-forest border-cream-border hover:bg-cream-light/60 hover:border-agri'
                }`}
              >
                <span className="text-base" aria-hidden="true">{qc.icon}</span>
                <span>{label}</span>
                {isSelected && (
                  <Check className="w-4 h-4 text-cream-light ml-0.5" aria-hidden="true" />
                )}
              </button>
            );
          })}

          {/* More Crops Button */}
          <button
            type="button"
            onClick={() => setShowMoreCropsModal(true)}
            style={{ scrollSnapAlign: 'start' }}
            className={`min-h-[48px] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-all shadow-soft flex-shrink-0 border ${
              !QUICK_CROPS.some((qc) => qc.key === crop) && crop !== 'All'
                ? 'bg-forest text-white border-forest ring-2 ring-forest/20'
                : 'bg-cream-light text-forest border-cream-border hover:bg-white'
            }`}
          >
            <span>{t.moreCrops || 'More crops'}</span>
            <span className="text-xs">▼</span>
            {!QUICK_CROPS.some((qc) => qc.key === crop) && crop !== 'All' && (
              <span className="text-xs bg-white text-forest px-1.5 py-0.5 rounded-full font-bold">
                {crop}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* PART 1: HARVESTER TYPE FILTER CHIP ROW */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-forest uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-agri" />
            {t.harvesterTypeLabel || 'Harvester Type'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* All types */}
          <button
            type="button"
            onClick={() => {
              setHarvesterType('all');
              handleSearch({ harvesterType: 'all' });
            }}
            className={`min-h-[48px] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all ${
              harvesterType === 'all'
                ? 'bg-forest text-white border-forest shadow-soft ring-2 ring-forest/20'
                : 'bg-white text-forest border-cream-border hover:bg-cream-light'
            }`}
          >
            <span>🚜</span>
            <span>{t.allHarvesterTypes || 'All types'}</span>
            {harvesterType === 'all' && <Check className="w-4 h-4 ml-1" />}
          </button>

          {/* Track / Chain */}
          <button
            type="button"
            onClick={() => {
              setHarvesterType('track');
              handleSearch({ harvesterType: 'track' });
            }}
            className={`min-h-[48px] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all ${
              harvesterType === 'track'
                ? 'bg-forest text-white border-forest shadow-soft ring-2 ring-forest/20'
                : 'bg-white text-forest border-cream-border hover:bg-cream-light'
            }`}
          >
            <span>🚜</span>
            <span>{t.trackSafeFilter || 'Track / Chain (wet paddy safe)'}</span>
            {harvesterType === 'track' && <Check className="w-4 h-4 ml-1" />}
          </button>

          {/* Wheeled */}
          <button
            type="button"
            onClick={() => {
              setHarvesterType('wheel');
              handleSearch({ harvesterType: 'wheel' });
            }}
            className={`min-h-[48px] px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all ${
              harvesterType === 'wheel'
                ? 'bg-forest text-white border-forest shadow-soft ring-2 ring-forest/20'
                : 'bg-white text-forest border-cream-border hover:bg-cream-light'
            }`}
          >
            <span>🛞</span>
            <span>{t.wheeledFilter || 'Wheeled (dry field)'}</span>
            {harvesterType === 'wheel' && <Check className="w-4 h-4 ml-1" />}
          </button>
        </div>

        {/* PART 1: Amber Warning Banner for Paddy + Wheeled */}
        {showPaddyWheelWarning && (
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-900 flex items-start gap-2.5 shadow-soft animate-fadeIn">
            <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">
                {t.paddyWheelWarning || 'Wet paddy fields usually need a track machine. Confirm field conditions with the owner.'}
              </p>
              <p className="text-xs text-amber-800">
                Wheeled harvesters can sink or get bogged down in soft/muddy paddy soil. If your land is firm and completely dry, wheeled is fine; otherwise choose Track / Chain.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Search Header Banner */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cream-border pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
              {t.searchTitle}
            </h1>
            <p className="text-sm text-neutralText-secondary mt-0.5">
              {t.searchSubtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <VoiceSearchButton onParsed={handleVoiceParsed} />
          </div>
        </div>

        {geoError && <Toast type="error" message={geoError} onClose={() => setGeoError(null)} />}

        {/* Location Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-cream-light/70 rounded-lg border border-cream-border text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerLocation}
              disabled={isDetectingLocation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-cream-light text-forest font-bold rounded-md border border-cream-border shadow-soft transition-subtle disabled:opacity-50 min-h-[44px]"
            >
              <Crosshair className={`w-3.5 h-3.5 text-agri ${isDetectingLocation ? 'animate-spin' : ''}`} />
              <span>{isDetectingLocation ? t.detectingLocation : t.useCurrentLocation}</span>
            </button>

            {userLocation && (
              <span className="text-agri font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {t.accurateTo} ~{userLocation.accuracy}m
              </span>
            )}
          </div>

          {/* Live Location Toggle */}
          <div className="flex items-center gap-2">
            {isLiveLocationOn ? (
              <div className="flex items-center gap-2 bg-agri-light border border-agri-border px-2.5 py-1 rounded-md text-forest font-bold animate-pulse">
                <Radio className="w-3.5 h-3.5 text-agri" />
                <span>{t.liveLocationOn}</span>
                <button
                  type="button"
                  onClick={toggleLiveLocation}
                  className="ml-1 px-1.5 py-0.5 bg-brickRed text-white rounded text-[10px] font-bold min-h-[36px]"
                >
                  {t.stopLiveLocation}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={toggleLiveLocation}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-neutralText-secondary hover:text-forest hover:bg-white rounded border border-transparent hover:border-cream-border transition-subtle min-h-[44px]"
              >
                <Radio className="w-3.5 h-3.5 text-neutralText-muted" />
                <span>{t.liveLocation}</span>
              </button>
            )}
          </div>
        </div>

        {/* Rough Location Notice */}
        {userLocation?.isRough && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>{t.locationRoughNotice}</span>
          </div>
        )}

        {/* Search Inputs Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Village */}
            <div>
              <Input
                label={t.villageLabel}
                value={village}
                onChange={(e) => setVillage(e.target.value)}
                placeholder={t.villagePlaceholder}
                leftIcon={<MapPin className="w-4 h-4 text-agri" />}
              />
              {districtVillages.length > 0 && !village && (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-[10px] text-neutralText-muted mr-1">Suggestions:</span>
                  {districtVillages.slice(0, 4).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setVillage(v);
                        handleSearch({ village: v });
                      }}
                      className="text-[10px] bg-white hover:bg-cream-light text-forest px-1.5 py-0.5 rounded border border-cream-border"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* District */}
            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">
                {t.districtLabel}
              </label>
              <select
                value={district}
                onChange={(e) => {
                  setDistrict(e.target.value);
                  setVillage('');
                }}
                className="w-full px-3.5 py-2.5 text-base rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri min-h-[48px]"
              >
                <option value="All">{t.allDistricts}</option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Crop Select */}
            <div>
              <label className="block text-sm font-semibold text-forest mb-1.5">
                {t.cropLabel}
              </label>
              <select
                value={crop}
                onChange={(e) => {
                  setCrop(e.target.value);
                  handleSearch({ crop: e.target.value });
                }}
                className="w-full px-3.5 py-2.5 text-base rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri min-h-[48px]"
              >
                <option value="All">{t.allCrops}</option>
                {CROPS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Acres & Date */}
            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t.acresUnit}
                type="number"
                min="0.5"
                max="100"
                step="0.5"
                value={acres}
                onChange={(e) => setAcres(parseFloat(e.target.value) || 1)}
                placeholder="3"
                leftIcon={<Layers className="w-4 h-4 text-agri" />}
              />

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-semibold text-forest">
                    {t.neededDateLabel}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowDatePickerModal(true)}
                    className="text-xs font-bold text-agri hover:text-forest underline inline-flex items-center gap-1"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Calendar</span>
                  </button>
                </div>
                <input
                  type="date"
                  value={neededDate}
                  min={todayStr}
                  onChange={(e) => {
                    setNeededDate(e.target.value);
                    handleSearch({ neededDate: e.target.value });
                  }}
                  className="w-full px-2.5 py-2.5 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri min-h-[48px]"
                />
              </div>
            </div>
          </div>

          {/* Form Actions: Search, Reset, Radius */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={loading}
                icon={<Search className="w-4 h-4" />}
              >
                {t.btnSearch}
              </Button>

              {/* Distance / Radius filter (always visible for farmer) */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-forest flex items-center gap-1">
                  <Navigation className="w-3.5 h-3.5 text-agri" />
                  <span>{t.radiusFilter}:</span>
                </span>
                <select
                  value={radiusKm || 'all'}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? undefined : Number(e.target.value);
                    setRadiusKm(val);
                    if (val && !userLocation) {
                      handleTriggerLocation();
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs rounded-md border border-cream-border bg-white text-forest font-semibold min-h-[44px]"
                >
                  <option value="all">{t.allDistances}</option>
                  <option value="5">{t.within5km}</option>
                  <option value="10">{t.within10km}</option>
                  <option value="25">{t.within25km}</option>
                  <option value="50">{t.within50km}</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-semibold text-neutralText-secondary hover:text-forest flex items-center gap-1.5 p-2 rounded-md hover:bg-cream-light transition-subtle min-h-[44px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          </div>
        </form>
      </Card>

      {/* Results Header with PART 5: HONEST SORT DROPDOWN + View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-base font-bold text-forest">
            {loading ? 'Searching...' : `${machines.length} ${t.searchResultsCount}`}
          </h2>

          {/* PART 5: Honest Sort Control */}
          <div className="flex items-center gap-1.5 bg-white border border-cream-border rounded-lg px-2.5 py-1 shadow-soft">
            <ArrowUpDown className="w-3.5 h-3.5 text-forest" />
            <label htmlFor="sortSelect" className="text-xs font-bold text-forest">
              {t.sortLabel || 'Sort by:'}
            </label>
            <select
              id="sortSelect"
              value={sortBy}
              onChange={(e) => updateSortBy(e.target.value as SortOption)}
              className="text-xs font-bold text-forest bg-transparent border-0 focus:ring-0 cursor-pointer py-1"
            >
              <option value="best_match">{t.sortBestMatch || 'Best match'}</option>
              <option
                value="nearest"
                disabled={!userLocation}
                title={!userLocation ? (t.sortNearestDisabledHint || 'Turn on GPS location to sort by nearest distance') : undefined}
              >
                {t.sortNearest || 'Nearest first'} {!userLocation ? '(Location needed)' : ''}
              </option>
              <option value="price_asc">{t.sortPriceLowHigh || 'Price: low to high'}</option>
              <option value="newest">{t.sortNewest || 'Newest first'}</option>
            </select>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-white border border-cream-border rounded-lg p-1 shadow-soft self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-subtle flex items-center gap-1.5 min-h-[36px] ${
              viewMode === 'list'
                ? 'bg-forest text-white shadow-soft'
                : 'text-neutralText-secondary hover:text-forest'
            }`}
          >
            <ListIcon className="w-3.5 h-3.5" />
            <span>{t.listView}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-subtle flex items-center gap-1.5 min-h-[36px] ${
              viewMode === 'map'
                ? 'bg-forest text-white shadow-soft'
                : 'text-neutralText-secondary hover:text-forest'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>{t.mapView}</span>
          </button>
        </div>
      </div>

      {/* PART 5: Notice when sorting by price with mixed per-hour/per-day units */}
      {hasHourlyOrDaily && (
        <div className="p-2.5 bg-cream-light border border-cream-border rounded-lg text-xs text-neutralText-secondary flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-agri flex-shrink-0" />
          <span>
            <strong>Honest Pricing:</strong> Per-acre harvesters are shown first. {t.perHourDayCompareNotice || 'Priced per hour/day, compare carefully'}. Confirm expected harvest speed with the owner.
          </span>
        </div>
      )}

      {/* MAP VIEW */}
      {viewMode === 'map' && (
        <div className="space-y-4">
          <HarvesterMap
            machines={machines}
            userLocation={userLocation}
            onSelectMachine={(m) => handleBook(m)}
            height="460px"
          />
          <p className="text-xs text-neutralText-secondary text-center">
            Tap any harvester pin on the map to see rates, call the owner, or get GPS directions.
          </p>
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <Card key={i} padding="none" className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          ) : machines.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {machines.map((machine) => (
                <MachineCard
                  key={machine.id}
                  machine={machine}
                  acres={acres}
                  selectedDate={neededDate}
                  busyDates={busyDates}
                  onBook={handleBook}
                  onReport={(m) => setReportingMachine(m)}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          ) : (
            /* PART 8: UPGRADED ZERO RESULTS SCREEN */
            <Card padding="lg" className="text-center py-10 px-4 sm:px-8 space-y-6 border-dashed border-2 border-cream-border">
              <div className="w-16 h-16 rounded-2xl bg-cream-light text-forest flex items-center justify-center mx-auto shadow-soft">
                <Wheat className="w-8 h-8 text-agri" />
              </div>

              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-xl font-bold text-forest">
                  {t.noResultsFound || 'No Harvesters Found in This Immediate Area'}
                </h3>
                <p className="text-sm text-neutralText-secondary leading-relaxed">
                  {t.noResultsTip || 'Try widening your search area or post a wanted request so nearby machine owners can reach you.'}
                </p>
              </div>

              {/* 3 Main Action Choices */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto pt-2">
                {/* Action 1: Search Whole District */}
                <button
                  type="button"
                  onClick={handleSearchWholeDistrict}
                  className="p-3.5 rounded-xl border border-cream-border bg-white hover:bg-cream-light text-forest font-bold text-sm text-center transition-all shadow-soft flex flex-col items-center justify-center gap-1.5 min-h-[56px]"
                >
                  <MapPin className="w-5 h-5 text-agri" />
                  <span>{t.searchWholeDistrict || 'Search whole district'}</span>
                </button>

                {/* Action 2: Post Wanted Request */}
                <button
                  type="button"
                  onClick={() => setShowWantedModal(true)}
                  className="p-3.5 rounded-xl border border-forest bg-forest text-white font-bold text-sm text-center transition-all shadow-soft flex flex-col items-center justify-center gap-1.5 min-h-[56px] hover:bg-forest/90"
                >
                  <PlusCircle className="w-5 h-5 text-cream-light" />
                  <span>{t.postWantedRequest || 'Post a Wanted Request'}</span>
                </button>

                {/* Action 3: Kisan Helpline */}
                <a
                  href="tel:18001801551"
                  className="p-3.5 rounded-xl border border-cream-border bg-white hover:bg-cream-light text-forest font-bold text-sm text-center transition-all shadow-soft flex flex-col items-center justify-center gap-1.5 min-h-[56px]"
                >
                  <PhoneCall className="w-5 h-5 text-agri" />
                  <span className="text-xs">Kisan Helpline</span>
                  <span className="text-[11px] font-mono text-neutralText-secondary">1800-180-1551</span>
                </a>
              </div>

              {/* Owner Option */}
              {user?.role === 'owner' && (
                <div className="pt-3 border-t border-cream-border">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => onNavigate('list')}
                    icon={<MapPin className="w-4 h-4" />}
                  >
                    {t.listMachine || 'List My Machine'}
                  </Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {/* Report Modal */}
      {reportingMachine && (
        <ReportListingModal
          machine={reportingMachine}
          onClose={() => setReportingMachine(null)}
        />
      )}

      {/* More Crops Modal */}
      <Modal
        isOpen={showMoreCropsModal}
        onClose={() => setShowMoreCropsModal(false)}
        title="Choose a Crop"
      >
        <div className="space-y-4">
          <p className="text-xs text-neutralText-secondary">
            Select any crop cultivated in your region to filter compatible combine harvesters.
          </p>
          <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
            {CROPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCrop(c);
                  setShowMoreCropsModal(false);
                  handleSearch({ crop: c });
                }}
                className={`p-2.5 text-left text-sm rounded-lg border font-semibold transition-all min-h-[48px] ${
                  crop === c
                    ? 'border-forest bg-forest text-white'
                    : 'border-cream-border bg-white text-forest hover:bg-cream-light'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* PART 8: POST WANTED REQUEST MODAL */}
      <Modal
        isOpen={showWantedModal}
        onClose={() => setShowWantedModal(false)}
        title={t.postWantedRequestTitle || 'Post a Harvester Wanted Request'}
      >
        {!user ? (
          <div className="space-y-4 text-center py-4">
            <Wheat className="w-10 h-10 text-agri mx-auto" />
            <div className="space-y-1">
              <h3 className="font-bold text-forest text-lg">Please Sign In to Post a Request</h3>
              <p className="text-xs text-neutralText-secondary">
                Machine owners need your contact details to call you and arrange harvester visits.
              </p>
            </div>
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setShowWantedModal(false);
                onNavigate('login');
              }}
            >
              Go to Sign In →
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePostWantedRequest} className="space-y-4">
            <p className="text-xs text-neutralText-secondary">
              {t.postWantedRequestSubtitle || 'Machine owners in your district will see this requirement and call you directly.'}
            </p>

            {/* Crop */}
            <div>
              <label className="block text-xs font-bold text-forest mb-1">
                {t.cropNeededLabel || 'Crop to Harvest'} *
              </label>
              <select
                value={wantedCrop}
                onChange={(e) => setWantedCrop(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary min-h-[48px]"
                required
              >
                {CROPS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Acres & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-forest mb-1">
                  {t.acresNeededLabel || 'Land Area (Acres)'} *
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="500"
                  step="0.5"
                  required
                  value={wantedAcres}
                  onChange={(e) => setWantedAcres(parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary min-h-[48px]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-forest mb-1">
                  {t.dateNeededLabel || 'Date Needed'} *
                </label>
                <input
                  type="date"
                  required
                  min={todayStr}
                  value={wantedDate}
                  onChange={(e) => setWantedDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary min-h-[48px]"
                />
              </div>
            </div>

            {/* District & Village */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-forest mb-1">
                  {t.districtLabel || 'District'} *
                </label>
                <select
                  value={wantedDistrict}
                  onChange={(e) => setWantedDistrict(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary min-h-[48px]"
                  required
                >
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-forest mb-1">
                  {t.villageLabel || 'Village / Hobli'} *
                </label>
                <input
                  type="text"
                  required
                  value={wantedVillage}
                  onChange={(e) => setWantedVillage(e.target.value)}
                  placeholder="e.g. Siruguppa"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary min-h-[48px]"
                />
              </div>
            </div>

            {/* Harvester Type Preference */}
            <div>
              <label className="block text-xs font-bold text-forest mb-1">
                Preferred Harvester Type
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'any', label: 'Any' },
                  { key: 'track', label: 'Track / Chain' },
                  { key: 'wheel', label: 'Wheeled' },
                ].map((typeOption) => (
                  <button
                    key={typeOption.key}
                    type="button"
                    onClick={() => setWantedType(typeOption.key)}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border min-h-[44px] ${
                      wantedType === typeOption.key
                        ? 'bg-forest text-white border-forest'
                        : 'bg-white text-forest border-cream-border'
                    }`}
                  >
                    {typeOption.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-forest mb-1">
                {t.farmerNoteLabel || 'Special Field Notes (Optional)'}
              </label>
              <textarea
                value={wantedNote}
                maxLength={200}
                onChange={(e) => setWantedNote(e.target.value)}
                placeholder={t.farmerNotePlaceholder || 'e.g. Field has good road access; water drained 2 days ago.'}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary"
              />
              <span className="text-[10px] text-neutralText-muted block text-right">
                {wantedNote.length}/200
              </span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isSubmittingWanted}
            >
              {t.postRequestBtn || 'Submit Harvester Request'}
            </Button>
          </form>
        )}
      </Modal>

      {/* Farmer Date Picker Modal */}
      <Modal
        isOpen={showDatePickerModal}
        onClose={() => setShowDatePickerModal(false)}
        title={`${t.neededDateLabel} - ${t.availabilityCalendarTitle}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-neutralText-secondary">
            Select the date you need a harvester for your farmland. Dates with no machines available will be indicated.
          </p>

          {/* Month Header */}
          <div className="flex items-center justify-between bg-cream-light p-3 rounded-lg border border-cream-border">
            <h3 className="font-bold text-forest text-base">
              {getMonthName(pickerYear, pickerMonth, language)}
            </h3>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (pickerMonth === 0) {
                    setPickerMonth(11);
                    setPickerYear(pickerYear - 1);
                  } else {
                    setPickerMonth(pickerMonth - 1);
                  }
                }}
                className="p-1.5 rounded hover:bg-cream-dark/50 text-forest min-h-[44px] min-w-[44px] flex items-center justify-center border border-transparent hover:border-cream-border"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setPickerYear(todayDate.getFullYear());
                  setPickerMonth(todayDate.getMonth());
                }}
                className="px-2 py-1 text-xs font-bold text-forest hover:bg-white rounded border border-cream-border min-h-[44px] flex items-center justify-center"
              >
                {t.today}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (pickerMonth === 11) {
                    setPickerMonth(0);
                    setPickerYear(pickerYear + 1);
                  } else {
                    setPickerMonth(pickerMonth + 1);
                  }
                }}
                className="p-1.5 rounded hover:bg-cream-dark/50 text-forest min-h-[44px] min-w-[44px] flex items-center justify-center border border-transparent hover:border-cream-border"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 text-center font-bold text-xs text-neutralText-secondary pb-1 border-b border-cream-border">
            {getLocalizedWeekdays(language).map((d) => (
              <span key={d.full}>{d.short}</span>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {buildMonthDays(pickerYear, pickerMonth).map((dayObj, idx) => {
              const isSelected = neededDate === dayObj.dateStr;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={dayObj.isPast}
                  onClick={() => {
                    setNeededDate(dayObj.dateStr);
                    setShowDatePickerModal(false);
                    handleSearch({ neededDate: dayObj.dateStr });
                  }}
                  className={`min-h-[44px] p-2 rounded-lg text-sm font-semibold flex flex-col items-center justify-center transition-all border ${
                    dayObj.isPast
                      ? 'opacity-30 cursor-not-allowed bg-cream-light/30 border-transparent text-neutralText-muted'
                      : isSelected
                      ? 'bg-forest text-white border-forest font-bold shadow-soft'
                      : 'bg-white hover:bg-cream-light border-cream-border text-forest'
                  }`}
                >
                  <span>{dayObj.dayNumber}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
};
