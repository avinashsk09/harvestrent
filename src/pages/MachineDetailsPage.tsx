import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Machine, MachinePhoto, MachineBusyDate } from '../types';
import { supabase, isSupabaseConfigured, getLocalMachines, getLocalBusyDates } from '../lib/supabase';
import { calculateHonestPrice } from '../utils/priceCalculator';
import { Card, Button, Badge } from '../components/ui';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  Share2,
  MapPin,
  Fuel,
  Users,
  Ruler,
  Scissors,
  Layers,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Lock,
} from 'lucide-react';

interface MachineDetailsPageProps {
  machineId: string;
  onNavigate: (page: string, params?: any) => void;
  onSelectMachineForPayment: (machine: Machine, acres: number, date: string, crop: string) => void;
}

export const MachineDetailsPage: React.FC<MachineDetailsPageProps> = ({
  machineId,
  onNavigate,
  onSelectMachineForPayment,
}) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [busyDates, setBusyDates] = useState<MachineBusyDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  // Load machine details
  useEffect(() => {
    let isMounted = true;

    const loadMachineData = async () => {
      setLoading(true);
      setNotFound(false);

      let foundMachine: Machine | null = null;
      let machinePhotoUrls: string[] = [];
      let machineBusy: MachineBusyDate[] = [];

      // 1. Fetch from Supabase
      if (isSupabaseConfigured && machineId) {
        try {
          const { data, error } = await supabase
            .from('machines')
            .select('*')
            .eq('id', machineId)
            .maybeSingle();

          if (!error && data && data.is_active) {
            foundMachine = data as Machine;

            // Fetch extra photos
            const { data: photoData } = await supabase
              .from('machine_photos')
              .select('photo_url')
              .eq('machine_id', machineId)
              .order('display_order', { ascending: true });

            if (photoData && photoData.length > 0) {
              machinePhotoUrls = photoData.map((p) => p.photo_url);
            }

            // Fetch busy dates
            const { data: dateData } = await supabase
              .from('machine_busy_dates')
              .select('*')
              .eq('machine_id', machineId);

            if (dateData) {
              machineBusy = dateData as MachineBusyDate[];
            }
          }
        } catch (err) {
          console.warn('Error fetching machine from Supabase:', err);
        }
      }

      // 2. Fallback to local storage if not found in Supabase
      if (!foundMachine) {
        const local = getLocalMachines().find((m) => m.id === machineId && m.is_active);
        if (local) {
          foundMachine = local;
          machineBusy = getLocalBusyDates().filter((b) => b.machine_id === machineId);
        }
      }

      if (!isMounted) return;

      if (!foundMachine) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Assemble all photos
      const allUrls: string[] = [];
      if (foundMachine.photo_url) allUrls.push(foundMachine.photo_url);
      if (Array.isArray(foundMachine.photos)) {
        foundMachine.photos.forEach((u) => {
          if (!allUrls.includes(u)) allUrls.push(u);
        });
      }
      machinePhotoUrls.forEach((u) => {
        if (!allUrls.includes(u)) allUrls.push(u);
      });

      setMachine(foundMachine);
      setPhotos(allUrls);
      setBusyDates(machineBusy);
      setLoading(false);
    };

    loadMachineData();

    return () => {
      isMounted = false;
    };
  }, [machineId]);

  // Share handler
  const handleShare = async () => {
    if (!machine) return;
    const shareUrl = window.location.href;
    const harvesterTypeLabel = machine.harvester_type === 'track' ? 'Track' : 'Wheeled';
    const shareText = `Look at this combine harvester on Harvest Rentals:\n🌾 ${machine.model_name || machine.machine_type} (${harvesterTypeLabel})\n📍 ${machine.village}, ${machine.district}\n💰 ₹${machine.price_amount} / ${machine.price_unit.replace('_', ' ')}\n${t.shareHelperLine || 'Share with neighbouring farmers to pool 5 to 10 acres.'}\n🔗 ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Harvest Rentals - ${machine.model_name || machine.machine_type}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 3000);
    } catch {
      const waShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
      window.open(waShareUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // Login protected actions
  const requireLogin = () => {
    sessionStorage.setItem('harvestrent_return_to', window.location.pathname);
    onNavigate('login');
  };

  const handleCall = () => {
    if (!user) {
      requireLogin();
      return;
    }
    if (machine?.owner_phone) {
      window.location.href = `tel:${machine.owner_phone}`;
    }
  };

  const handleWhatsApp = () => {
    if (!user) {
      requireLogin();
      return;
    }
    if (!machine) return;

    const rawPhone = machine.owner_phone || '';
    const cleanDigits = rawPhone.replace(/\D/g, '').slice(-10);
    if (!cleanDigits || cleanDigits.length !== 10) {
      alert('Owner phone number not formatted for WhatsApp.');
      return;
    }

    const message = t.whatsappMessagePrefix
      ? t.whatsappMessagePrefix
          .replace('{machine}', machine.model_name || machine.machine_type)
          .replace('{crop}', machine.crops?.[0] || 'harvest')
          .replace('{village}', machine.village || 'village')
          .replace('{date}', new Date().toISOString().split('T')[0])
      : `Hello! I saw your ${machine.model_name || machine.machine_type} on Harvest Rentals. Is it available for harvest?`;

    const waUrl = `https://wa.me/91${cleanDigits}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleBookToken = () => {
    if (!user) {
      requireLogin();
      return;
    }
    if (!machine) return;
    onSelectMachineForPayment(
      machine,
      machine.min_acres || 3,
      new Date().toISOString().split('T')[0],
      machine.crops?.[0] || 'Paddy (Rice)'
    );
    onNavigate('payment');
  };

  // Loading state
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
        <div className="h-8 w-48 bg-cream-border/60 animate-pulse rounded" />
        <div className="h-72 w-full bg-cream-border/40 animate-pulse rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 bg-cream-border/40 animate-pulse rounded-xl" />
          <div className="h-40 bg-cream-border/40 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  // 404 / Unavailable state
  if (notFound || !machine) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto shadow-soft">
          <AlertCircle className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold text-forest">
            {t.machineUnavailableTitle || 'This machine is not available'}
          </h1>
          <p className="text-sm text-neutralText-secondary max-w-sm mx-auto">
            {t.machineUnavailableDesc || 'The machine you are looking for has been removed, paused, or does not exist.'}
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          onClick={() => onNavigate('find')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          {t.backToFindMachines || 'Back to Find Machines'}
        </Button>
      </div>
    );
  }

  const honestPrice = calculateHonestPrice(machine.price_amount, machine.price_unit, 1);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 space-y-6 pb-32">
      {/* Toast Alert */}
      {shareToast && (
        <div className="fixed top-4 right-4 z-50 p-3 bg-forest text-white rounded-lg shadow-lg text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cream-light" />
          <span>{t.shareCopied || 'Listing link copied to clipboard!'}</span>
        </div>
      )}

      {/* Top Bar with Back and Share */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigate('find')}
          className="inline-flex items-center gap-2 text-sm font-bold text-forest hover:text-agri transition-colors min-h-[44px] px-2 py-1 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.backToFindMachines || 'Back to Find Machines'}</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-cream-light text-forest border border-cream-border rounded-lg text-xs font-bold shadow-soft transition-all min-h-[44px]"
          title="Share Listing"
        >
          <Share2 className="w-4 h-4 text-agri" />
          <span>{t.shareBtn || 'Share'}</span>
        </button>
      </div>

      {/* Title & Location Header */}
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
            {machine.model_name || machine.machine_type}
          </h1>

          {/* Harvester Type Badge */}
          {machine.harvester_type === 'track' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-forest text-cream-light shadow-soft">
              🚜 {t.trackBadge || 'Track / Chain'}
            </span>
          )}
          {machine.harvester_type === 'wheel' && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-white text-forest border border-cream-border shadow-soft">
              🛞 {t.wheelBadge || 'Wheeled / Tyre'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-neutralText-secondary">
          <MapPin className="w-4 h-4 text-agri" />
          <span>
            <strong>{machine.village}</strong>, {machine.district}
          </span>
          {machine.latitude && machine.longitude && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${machine.latitude},${machine.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-agri hover:underline ml-2"
            >
              Google Maps ↗
            </a>
          )}
        </div>
      </div>

      {/* PART 6: PHOTO GALLERY (Up to 4 photos) */}
      <div className="space-y-3">
        <div className="relative h-64 sm:h-96 w-full rounded-2xl overflow-hidden bg-cream-dark/50 border border-cream-border shadow-soft">
          {photos.length > 0 ? (
            <img
              src={photos[activePhotoIndex]}
              alt={machine.model_name || machine.machine_type}
              className="w-full h-full object-cover transition-all duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-neutralText-muted">
              <span className="text-5xl">🌾</span>
              <span className="text-sm font-semibold mt-2">No photo available</span>
            </div>
          )}

          {/* Navigation Arrows for Mobile / Multi-photo */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActivePhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-forest/80 hover:bg-forest text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                aria-label="Previous photo"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => setActivePhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-forest/80 hover:bg-forest text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                aria-label="Next photo"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-bold">
                {activePhotoIndex + 1} / {photos.length}
              </div>
            </>
          )}
        </div>

        {/* Thumbnail Row */}
        {photos.length > 1 && (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {photos.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActivePhotoIndex(idx)}
                className={`relative w-20 h-16 sm:w-24 sm:h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                  activePhotoIndex === idx
                    ? 'border-forest ring-2 ring-forest/30 shadow-md scale-105'
                    : 'border-cream-border opacity-70 hover:opacity-100'
                }`}
              >
                <img src={url} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Primary Info & Rate Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Rate Box */}
        <Card padding="md" className="md:col-span-1 border-forest/30 bg-gradient-to-br from-white to-cream-light/60 flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase text-neutralText-secondary">
              Rental Rate
            </span>
            <div className="text-3xl font-extrabold text-forest">
              {honestPrice.displayPrice}
            </div>
            <p className="text-xs text-neutralText-muted">
              {machine.price_unit === 'per_acre'
                ? 'Standard per-acre pricing for complete cutting & threshing.'
                : 'Hourly/Daily rate. Confirm field output with owner.'}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-cream-border">
            <div className="text-xs text-forest">
              Owner: <strong>{machine.owner_name}</strong>
            </div>
            {machine.min_acres && machine.min_acres > 0 && (
              <div className="text-xs text-neutralText-secondary">
                Min. trip size: <strong>{machine.min_acres} acres</strong>
              </div>
            )}
          </div>
        </Card>

        {/* Fuel, Operator & Bata Information */}
        <Card padding="md" className="md:col-span-2 space-y-3">
          <h3 className="text-sm font-bold text-forest uppercase tracking-wider flex items-center gap-1.5">
            <Fuel className="w-4 h-4 text-agri" />
            Operational & Fuel Policy
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Fuel Policy */}
            <div className="p-3 bg-cream-light/60 rounded-xl border border-cream-border space-y-1">
              <span className="text-[11px] font-bold text-neutralText-secondary uppercase block">
                {t.fuelPolicyLabel || 'Fuel Policy'}
              </span>
              <span className="text-sm font-bold text-forest flex items-center gap-1.5">
                <Fuel className="w-4 h-4 text-agri" />
                {machine.fuel_policy === 'included'
                  ? (t.fuelIncludedBadge || 'Fuel included in rental')
                  : (t.fuelByFarmerBadge || 'Fuel provided by farmer')}
              </span>
              <p className="text-[11px] text-neutralText-muted">
                {machine.fuel_policy === 'included'
                  ? 'Machine arrives fully fueled with diesel for agreed acreage.'
                  : 'Farmer supplies good quality diesel at the farm.'}
              </p>
            </div>

            {/* Driver Included */}
            <div className="p-3 bg-cream-light/60 rounded-xl border border-cream-border space-y-1">
              <span className="text-[11px] font-bold text-neutralText-secondary uppercase block">
                {t.driverIncludedLabel || 'Driver & Operator'}
              </span>
              <span className="text-sm font-bold text-forest flex items-center gap-1.5">
                <Users className="w-4 h-4 text-agri" />
                {machine.driver_included !== false
                  ? (t.driverIncludedBadge || 'Driver & helper included')
                  : (t.driverNotIncludedBadge || 'Machine only (no driver)')}
              </span>
              <p className="text-[11px] text-neutralText-muted">
                {machine.driver_included !== false
                  ? 'Skilled combine driver operates the machine.'
                  : 'Farmer must arrange qualified combine driver.'}
              </p>
            </div>
          </div>

          {/* Bata Notice */}
          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>
              <strong>Bata & Allowance:</strong> {t.bataNotice || 'Confirm diesel and driver food (bata) with the owner before booking.'}
            </span>
          </div>
        </Card>
      </div>

      {/* Technical Specifications */}
      <Card padding="md" className="space-y-4">
        <h3 className="text-sm font-bold text-forest uppercase tracking-wider flex items-center gap-1.5 border-b border-cream-border pb-2">
          <Layers className="w-4 h-4 text-agri" />
          {t.technicalSpecifications || 'Technical Specifications'}
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Cutter Bar Width */}
          <div className="p-3 bg-cream-light/40 rounded-xl border border-cream-border space-y-1">
            <span className="text-neutralText-secondary block font-medium">Header / Cutter Bar</span>
            <span className="text-sm font-bold text-forest flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-agri" />
              {machine.header_width_ft ? `${machine.header_width_ft} ft` : 'Not specified'}
            </span>
          </div>

          {/* Straw Chopper */}
          <div className="p-3 bg-cream-light/40 rounded-xl border border-cream-border space-y-1">
            <span className="text-neutralText-secondary block font-medium">Straw Chopper</span>
            <span className="text-sm font-bold text-forest flex items-center gap-1">
              <Scissors className="w-3.5 h-3.5 text-agri" />
              {machine.has_straw_chopper ? 'Yes (Equipped)' : 'No (Standard)'}
            </span>
          </div>

          {/* Year */}
          <div className="p-3 bg-cream-light/40 rounded-xl border border-cream-border space-y-1">
            <span className="text-neutralText-secondary block font-medium">Year of Manufacture</span>
            <span className="text-sm font-bold text-forest">
              {machine.manufacture_year || 'Not specified'}
            </span>
          </div>

          {/* Condition */}
          <div className="p-3 bg-cream-light/40 rounded-xl border border-cream-border space-y-1">
            <span className="text-neutralText-secondary block font-medium">Condition</span>
            <span className="text-sm font-bold text-forest capitalize">
              {machine.condition || 'Good'}
            </span>
          </div>
        </div>

        {/* Supported Crops */}
        <div className="pt-2 border-t border-cream-border space-y-2">
          <span className="text-xs font-bold text-forest block">
            Supported Crops
          </span>
          <div className="flex flex-wrap gap-2">
            {machine.crops?.map((c) => (
              <span
                key={c}
                className="px-3 py-1 rounded-full text-xs font-bold bg-cream-light text-forest border border-cream-border"
              >
                🌾 {c}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* Owner Note */}
      {machine.owner_note && (
        <Card padding="md" className="space-y-2 border-cream-border bg-white">
          <span className="text-xs font-bold text-forest uppercase tracking-wider block">
            {t.ownerNoteBadge || "Owner's Note / Weather Policy"}
          </span>
          <p className="text-sm text-neutralText-primary italic bg-cream-light/50 p-3 rounded-lg border border-cream-border">
            "{machine.owner_note}"
          </p>
          <p className="text-[11px] text-neutralText-muted">
            {t.ownerNoteDisclaimer || "Owner's note about weather or cancellation, not enforced by the app."}
          </p>
        </Card>
      )}

      {/* Availability Calendar */}
      <Card padding="md" className="space-y-3">
        <div className="flex items-center justify-between border-b border-cream-border pb-2">
          <h3 className="text-sm font-bold text-forest uppercase tracking-wider flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-agri" />
            {t.availabilityCalendarSec || 'Availability & 60-Day Calendar'}
          </h3>
          <span className="text-xs text-neutralText-secondary">
            Green: Available &bull; Amber: Busy
          </span>
        </div>

        <AvailabilityCalendar
          machineId={machine.id}
          busyDates={busyDates}
          isOwner={false}
        />
      </Card>

      {/* STICKY BOTTOM ACTION BAR (Mobile & Desktop) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-cream-border p-3.5 shadow-card">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="hidden sm:block">
            <span className="text-xs text-neutralText-secondary block">Total Rate</span>
            <span className="text-lg font-bold text-forest">
              {honestPrice.displayPrice}
            </span>
          </div>

          <div className="flex items-center gap-2.5 flex-1 sm:flex-none justify-end">
            {/* Call Owner */}
            <Button
              variant="outline"
              size="lg"
              onClick={handleCall}
              icon={<Phone className="w-4 h-4 text-forest" />}
              className="flex-1 sm:flex-none min-h-[48px]"
            >
              {t.callOwner || 'Call Owner'}
            </Button>

            {/* WhatsApp */}
            <Button
              variant="outline"
              size="lg"
              onClick={handleWhatsApp}
              icon={<MessageCircle className="w-4 h-4 text-agri" />}
              className="flex-1 sm:flex-none min-h-[48px] border-agri-border hover:bg-agri-light/20"
            >
              {t.whatsappBtn || 'WhatsApp'}
            </Button>

            {/* Pay Token Advance */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleBookToken}
              className="flex-1 sm:flex-none min-h-[48px]"
            >
              {t.bookAdvance || 'Book / Advance'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
