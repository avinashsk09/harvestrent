import React, { useState } from 'react';
import {
  Phone,
  Calendar,
  MapPin,
  AlertTriangle,
  Check,
  Share2,
  MessageCircle,
  Fuel,
  Users,
  Ruler,
  Scissors,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Machine, MachineBusyDate } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { calculateHonestPrice } from '../utils/priceCalculator';
import { Card, Button, Badge } from './ui';
import { CompactAvailabilityPreview } from './CompactAvailabilityPreview';

interface MachineCardProps {
  machine: Machine;
  acres?: number;
  selectedDate?: string;
  selectedCrop?: string;
  busyDates?: MachineBusyDate[];
  onBook: (machine: Machine) => void;
  onReport: (machine: Machine) => void;
  onNavigate?: (page: string, params?: any) => void;
}

export const MachineCard: React.FC<MachineCardProps> = ({
  machine,
  acres = 1,
  selectedDate,
  selectedCrop,
  busyDates = [],
  onBook,
  onReport,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [shareToast, setShareToast] = useState(false);

  const honestPrice = calculateHonestPrice(machine.price_amount, machine.price_unit, acres);

  // Sanitize 10-digit Indian phone number
  const rawDigits = machine.owner_phone.replace(/\D/g, '');
  const phone10 = rawDigits.length === 12 && rawDigits.startsWith('91')
    ? rawDigits.slice(2)
    : rawDigits.slice(-10);

  // Build pre-filled WhatsApp message omitting empty parts
  const machineName = machine.model_name || machine.machine_type;
  const cropText = selectedCrop && selectedCrop !== 'All' ? selectedCrop : (machine.crops[0] || 'harvesting');
  const dateText = selectedDate ? ` around ${selectedDate}` : '';
  const villageText = machine.village ? ` in ${machine.village}` : '';

  const waMessage = t.whatsappMessagePrefix
    ? t.whatsappMessagePrefix
        .replace('{machine}', machineName)
        .replace('{crop}', cropText)
        .replace('{village}', machine.village)
        .replace('{date}', selectedDate || 'upcoming harvest')
    : `Hello! I saw your ${machineName} on Harvest Rentals. Is it available for ${cropText}${villageText}${dateText}?`;

  const waLink = `https://wa.me/91${phone10}?text=${encodeURIComponent(waMessage)}`;

  // Handler for protected actions (Call, WhatsApp, Book require login)
  const handleProtectedAction = (action: () => void) => {
    if (!user) {
      sessionStorage.setItem('harvestrent_redirect_after_login', window.location.pathname);
      if (onNavigate) {
        onNavigate('login');
      } else {
        window.location.href = '/login';
      }
      return;
    }
    action();
  };

  // Share Listing Handler (Web Share API with WhatsApp fallback)
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const detailUrl = `${window.location.origin}/machine/${machine.id}`;
    const shareText = t.shareTextTemplate
      ? t.shareTextTemplate
          .replace('{type}', machineName)
          .replace('{village}', machine.village)
          .replace('{price}', honestPrice.displayPrice)
          .replace('{link}', detailUrl)
      : `Look at this harvester on Harvest Rentals: ${machineName}, ${machine.village}, ${honestPrice.displayPrice} - ${detailUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Harvest Rentals - ${machineName}`,
          text: shareText,
          url: detailUrl,
        });
        return;
      } catch (err) {
        // User cancelled or fallback
      }
    }

    // WhatsApp Web / App Fallback
    const waShareUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waShareUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCardClick = () => {
    if (onNavigate) {
      onNavigate(`machine/${machine.id}`);
    } else {
      window.location.href = `/machine/${machine.id}`;
    }
  };

  return (
    <Card
      padding="none"
      className="overflow-hidden flex flex-col justify-between hover:shadow-card transition-all cursor-pointer group border-cream-border"
      onClick={handleCardClick}
    >
      <div>
        {/* Machine Photo */}
        <div className="relative h-48 sm:h-52 w-full bg-cream-dark/60 overflow-hidden border-b border-cream-border">
          {machine.photo_url ? (
            <img
              src={machine.photo_url}
              alt={machine.model_name || machine.machine_type}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-neutralText-muted">
              <span className="text-3xl">🌾</span>
              <span className="text-xs font-semibold mt-1">Harvester Machine</span>
            </div>
          )}

          {/* Active status & Harvester Type Badge */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <Badge variant="success">
              {t.activeStatus}
            </Badge>

            {/* PART 1: Harvester Type Badge */}
            {machine.harvester_type === 'track' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-forest text-cream-light shadow-soft">
                🚜 {t.trackBadge}
              </span>
            )}
            {machine.harvester_type === 'wheel' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-forest border border-cream-border shadow-soft">
                🛞 {t.wheelBadge}
              </span>
            )}
          </div>

          {/* Price Badge */}
          <div className="absolute bottom-3 right-3 bg-forest text-white px-3 py-1 rounded-md text-xs font-bold shadow-soft">
            {honestPrice.displayPrice}
          </div>
        </div>

        {/* Details */}
        <div className="p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-lg font-bold text-forest leading-tight group-hover:text-agri transition-colors">
              {machine.model_name || machine.machine_type}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-neutralText-secondary mt-1">
              <span>{t.ownerName}: <strong>{machine.owner_name}</strong></span>
            </div>
          </div>

          {/* Location & Distance Badge */}
          <div className="flex flex-col gap-1.5 bg-cream-light p-2.5 rounded-lg border border-cream-border">
            <div className="flex items-center justify-between gap-1 text-xs font-medium text-forest">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-agri flex-shrink-0" />
                <strong>{machine.village}</strong>, {machine.district}
              </span>
              {machine.latitude && machine.longitude && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${machine.latitude},${machine.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] font-semibold text-agri hover:underline inline-flex items-center gap-0.5"
                  title="Open in Google Maps"
                >
                  Maps ↗
                </a>
              )}
            </div>

            {/* Match / Distance Badge */}
            <div className="flex items-center gap-2">
              {machine.distance_km !== undefined && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-forest bg-agri-light/60 border border-agri-border px-2 py-0.5 rounded-full">
                  📍 {machine.distance_km} km away
                </span>
              )}
              {machine.match_type === 'same_village' && machine.distance_km === undefined && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-800 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
                  ✓ Same village
                </span>
              )}
              {machine.match_type === 'same_district' && machine.distance_km === undefined && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-forest bg-cream-light border border-cream-border px-2 py-0.5 rounded-full">
                  Same district
                </span>
              )}
            </div>
          </div>

          {/* PART 3: Tech Specs Badges (Show only badges that have data) */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {/* Fuel Policy */}
            {machine.fuel_policy === 'included' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <Fuel className="w-3 h-3 text-emerald-700" />
                <span>{t.fuelIncludedBadge}</span>
              </span>
            )}
            {machine.fuel_policy === 'by_farmer' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                <Fuel className="w-3 h-3 text-amber-700" />
                <span>{t.fuelByFarmerBadge}</span>
              </span>
            )}

            {/* Driver & Operator */}
            {machine.driver_included === true && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-cream-light text-forest border border-cream-border">
                <Users className="w-3 h-3 text-agri" />
                <span>{t.driverIncludedBadge}</span>
              </span>
            )}

            {/* Cutter bar width */}
            {machine.header_width_ft && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-cream-light text-forest border border-cream-border">
                <Ruler className="w-3 h-3 text-agri" />
                <span>{t.headerWidthBadge.replace('{width}', String(machine.header_width_ft))}</span>
              </span>
            )}

            {/* Straw chopper */}
            {machine.has_straw_chopper && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-cream-light text-forest border border-cream-border">
                <Scissors className="w-3 h-3 text-agri" />
                <span>{t.strawChopperBadge}</span>
              </span>
            )}

            {/* Minimum acres */}
            {machine.min_acres !== undefined && machine.min_acres > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-cream-light text-forest border border-cream-border">
                <span>{t.minAcresBadge.replace('{acres}', String(machine.min_acres))}</span>
              </span>
            )}
          </div>

          {/* Crops handled */}
          <div>
            <span className="text-[11px] font-bold text-neutralText-muted uppercase tracking-wider block mb-1">
              {t.cropsSupported}:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {machine.crops.map((crop, idx) => (
                <span
                  key={idx}
                  className="bg-agri-light text-forest border border-agri-border px-2 py-0.5 rounded text-xs font-medium"
                >
                  {crop}
                </span>
              ))}
            </div>
          </div>

          {/* Honest Price Estimate Box */}
          <div className="p-3 bg-cream-light/70 rounded-lg border border-cream-border space-y-1">
            <div className="flex items-center justify-between text-xs font-bold text-forest uppercase tracking-wider">
              <span>{t.estimatedCost}</span>
              {honestPrice.hasFixedEstimate ? (
                <span className="text-forest text-sm font-black">
                  ₹{honestPrice.estimatedTotal.toLocaleString('en-IN')}
                </span>
              ) : (
                <span className="text-neutralText-primary font-bold text-xs">
                  {honestPrice.displayPrice}
                </span>
              )}
            </div>

            <div className="text-xs text-neutralText-secondary">
              {honestPrice.hasFixedEstimate ? (
                <span>
                  For {acres} {t.acresUnit}: <strong>{honestPrice.displayEstimate}</strong>
                </span>
              ) : (
                <span className="italic text-amberGold font-medium">
                  {t.fixedUnitNotice}
                </span>
              )}
            </div>

            {/* PART 3: Tiny line under price */}
            <p className="text-[11px] text-neutralText-muted italic pt-1 border-t border-cream-border/60">
              {t.bataNotice}
            </p>
          </div>

          {/* Compact Availability & 60-Day Calendar Preview */}
          <CompactAvailabilityPreview
            machineId={machine.id}
            busyDates={busyDates}
            selectedDate={selectedDate}
          />
        </div>
      </div>

      {/* Action Buttons: Call Owner, WhatsApp, Book Advance & Share */}
      <div className="p-4 sm:p-5 pt-0 space-y-2.5" onClick={(e) => e.stopPropagation()}>
        {/* Row 1: Call Owner & WhatsApp Button */}
        <div className="grid grid-cols-2 gap-2">
          {/* Call Owner */}
          <button
            type="button"
            onClick={() =>
              handleProtectedAction(() => {
                window.location.href = `tel:${machine.owner_phone}`;
              })
            }
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-forest text-white hover:bg-forest-dark font-semibold rounded-lg text-sm transition-subtle shadow-soft min-h-[48px]"
          >
            <Phone className="w-4 h-4" />
            <span>{t.callOwner}</span>
          </button>

          {/* PART 2: WhatsApp Button (calm green style, no neon) */}
          <button
            type="button"
            onClick={() =>
              handleProtectedAction(() => {
                window.open(waLink, '_blank', 'noopener,noreferrer');
              })
            }
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 bg-[#1E7E34] hover:bg-[#19692c] text-white font-semibold rounded-lg text-sm transition-subtle shadow-soft min-h-[48px]"
            title="Chat with owner on WhatsApp"
          >
            <MessageCircle className="w-4 h-4 text-cream-light" />
            <span>{t.whatsappBtn}</span>
          </button>
        </div>

        {/* Row 2: Book Advance & Share */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => handleProtectedAction(() => onBook(machine))}
            icon={<Calendar className="w-4 h-4 text-forest" />}
            className="min-h-[48px]"
          >
            {t.bookAdvance}
          </Button>

          {/* PART 7: Share button */}
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-white hover:bg-cream-light text-forest border border-cream-border rounded-lg text-xs font-semibold transition-subtle shadow-soft min-h-[48px]"
            title={t.shareBtn}
          >
            <Share2 className="w-3.5 h-3.5 text-agri" />
            <span>{t.shareBtn}</span>
          </button>
        </div>

        {/* Helper Line & Report */}
        <div className="flex items-center justify-between pt-1 text-[11px] text-neutralText-muted">
          <p className="italic leading-snug max-w-[200px] sm:max-w-xs">
            {t.shareHelperLine}
          </p>

          <button
            type="button"
            onClick={() => onReport(machine)}
            className="text-neutralText-muted hover:text-brickRed transition-subtle inline-flex items-center gap-1 font-medium p-1"
          >
            <AlertTriangle className="w-3 h-3" />
            <span>{t.reportListing}</span>
          </button>
        </div>
      </div>
    </Card>
  );
};
