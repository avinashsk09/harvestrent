import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { PriceUnit, Machine, HarvesterType, FuelPolicy, MachineCondition } from '../types';
import { DISTRICTS, CROPS, COMMON_VILLAGES } from '../lib/constants';
import { supabase, isSupabaseConfigured, getLocalMachines, saveLocalMachines, uploadMachinePhoto } from '../lib/supabase';
import { getCurrentPositionAccurate } from '../utils/geolocation';
import { HarvesterMap } from '../components/HarvesterMap';
import { Card, Button, Input, Toast } from '../components/ui';
import {
  Tractor,
  Upload,
  Check,
  CheckCircle2,
  DollarSign,
  MapPin,
  Phone,
  User,
  ShieldCheck,
  Image as ImageIcon,
  Crosshair,
  Compass,
  Fuel,
  Users,
  Ruler,
  Scissors,
  CalendarDays,
  FileText,
  Trash2,
} from 'lucide-react';

interface ListMachinePageProps {
  onNavigate: (page: string) => void;
}

export const ListMachinePage: React.FC<ListMachinePageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user, updateProfile } = useAuth();

  const [ownerName, setOwnerName] = useState(user?.full_name || '');
  const [enteredPhone, setEnteredPhone] = useState(
    user?.phone ? user.phone.replace('+91', '') : ''
  );
  const [machineType, setMachineType] = useState('Combine Harvester');
  const [harvesterType, setHarvesterType] = useState<HarvesterType>('track');
  const [modelName, setModelName] = useState('');
  const [village, setVillage] = useState(user?.village || '');
  const [district, setDistrict] = useState(user?.district || DISTRICTS[0]);
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [locAccuracy, setLocAccuracy] = useState<number | null>(null);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [selectedCrops, setSelectedCrops] = useState<string[]>(['Paddy (Rice)']);
  const [priceAmount, setPriceAmount] = useState<number>(2200);
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('per_acre');
  
  // Tech specs & policies (Parts 1 & 3)
  const [fuelPolicy, setFuelPolicy] = useState<FuelPolicy>('included');
  const [driverIncluded, setDriverIncluded] = useState<boolean>(true);
  const [headerWidthFt, setHeaderWidthFt] = useState<string>('');
  const [hasStrawChopper, setHasStrawChopper] = useState<boolean>(false);
  const [manufactureYear, setManufactureYear] = useState<string>('');
  const [condition, setCondition] = useState<MachineCondition>('good');
  const [minAcres, setMinAcres] = useState<string>('1');
  const [ownerNote, setOwnerNote] = useState<string>('');

  // Photos (Part 6)
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync owner name and phone when user profile loads
  React.useEffect(() => {
    if (user) {
      if (!ownerName && user.full_name) setOwnerName(user.full_name);
      if (!enteredPhone && user.phone) setEnteredPhone(user.phone.replace('+91', ''));
    }
  }, [user]);

  // Detect owner's current location with high accuracy
  const handleDetectLocation = async () => {
    setIsDetectingLocation(true);
    setError(null);
    try {
      const res = await getCurrentPositionAccurate();
      setLatitude(res.latitude);
      setLongitude(res.longitude);
      setLocAccuracy(res.accuracy);

      if (res.district) {
        const matchedDistrict = DISTRICTS.find(
          (d) => d.toLowerCase().includes(res.district!.toLowerCase()) || res.district!.toLowerCase().includes(d.toLowerCase())
        );
        if (matchedDistrict) setDistrict(matchedDistrict);
      }
      if (res.village) {
        setVillage(res.village);
      }
    } catch (err: any) {
      setError(err?.fallbackMessage || 'Failed to determine GPS location.');
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Toggle crop selection
  const handleToggleCrop = (c: string) => {
    if (selectedCrops.includes(c)) {
      if (selectedCrops.length > 1) {
        setSelectedCrops(selectedCrops.filter((crop) => crop !== c));
      }
    } else {
      setSelectedCrops([...selectedCrops, c]);
    }
  };

  // Real device multi-photo upload (up to 4 photos)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (photoFiles.length + files.length > 4) {
      setError('You can upload a maximum of 4 photos per machine.');
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload valid image files (JPEG, PNG, WebP).');
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        setError('Each photo must be smaller than 3 MB.');
        return;
      }
    }

    const updatedFiles = [...photoFiles, ...files].slice(0, 4);
    setPhotoFiles(updatedFiles);
    const updatedPreviews = updatedFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(updatedPreviews);
    setError(null);
  };

  const handleRemovePhoto = (idx: number) => {
    const updatedFiles = photoFiles.filter((_, i) => i !== idx);
    setPhotoFiles(updatedFiles);
    const updatedPreviews = updatedFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(updatedPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      onNavigate('login');
      return;
    }

    let finalOwnerPhone = user.phone || '';

    // If owner has no phone on profile, require it now
    if (!finalOwnerPhone) {
      const cleanPhone = enteredPhone.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        setError('Please enter a valid 10-digit Indian mobile number so farmers can reach you.');
        return;
      }
      finalOwnerPhone = `+91${cleanPhone}`;
      await updateProfile({ phone: finalOwnerPhone });
    }

    if (!village.trim()) {
      setError('Please provide your village or town name.');
      return;
    }

    if (!harvesterType) {
      setError('Please select a harvester type (Track / Chain or Wheeled).');
      return;
    }

    if (!fuelPolicy) {
      setError('Please select a fuel policy.');
      return;
    }

    if (selectedCrops.length === 0) {
      setError('Please select at least one harvestable crop.');
      return;
    }

    // Validate technical specs
    if (headerWidthFt) {
      const hw = parseFloat(headerWidthFt);
      if (isNaN(hw) || hw < 4 || hw > 30) {
        setError('Cutter bar width must be between 4 and 30 feet.');
        return;
      }
    }

    if (manufactureYear) {
      const yr = parseInt(manufactureYear, 10);
      const currentYear = new Date().getFullYear();
      if (isNaN(yr) || yr < 1990 || yr > currentYear) {
        setError(`Manufacturing year must be between 1990 and ${currentYear}.`);
        return;
      }
    }

    if (minAcres) {
      const ma = parseFloat(minAcres);
      if (isNaN(ma) || ma < 0 || ma > 100) {
        setError('Minimum acres must be between 0 and 100 acres.');
        return;
      }
    }

    if (ownerNote && ownerNote.length > 300) {
      setError('Owner note must be 300 characters or less.');
      return;
    }

    setLoading(true);

    try {
      // Upload genuine photos to Supabase Storage bucket 'machine-photos'
      const uploadedPhotoUrls: string[] = [];
      for (const pFile of photoFiles) {
        const url = await uploadMachinePhoto(pFile, user.id);
        if (url) uploadedPhotoUrls.push(url);
      }
      if (uploadedPhotoUrls.length === 0 && photoPreviews.length > 0) {
        photoPreviews.forEach((p) => uploadedPhotoUrls.push(p));
      }
      const primaryPhotoUrl = uploadedPhotoUrls[0] || '';

      const machineUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
      const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      const newMachine: Machine = {
        id: machineUuid || `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        owner_id: user.id,
        owner_name: ownerName.trim() || user.full_name,
        owner_phone: finalOwnerPhone,
        machine_type: machineType,
        model_name: modelName.trim() || `${machineType} (${district})`,
        village: village.trim(),
        district,
        photo_url: primaryPhotoUrl,
        crops: selectedCrops,
        price_amount: Number(priceAmount),
        price_unit: priceUnit,
        is_active: true,
        latitude,
        longitude,
        description: description.trim(),
        created_at: new Date().toISOString(),
        harvester_type: harvesterType,
        fuel_policy: fuelPolicy,
        driver_included: driverIncluded,
        header_width_ft: headerWidthFt ? parseFloat(headerWidthFt) : undefined,
        has_straw_chopper: hasStrawChopper,
        manufacture_year: manufactureYear ? parseInt(manufactureYear, 10) : undefined,
        condition,
        min_acres: minAcres ? parseFloat(minAcres) : 0,
        owner_note: ownerNote.trim() || undefined,
        photos: uploadedPhotoUrls,
      };

      if (isSupabaseConfigured) {
        const insertPayload: any = {
          owner_name: newMachine.owner_name,
          owner_phone: newMachine.owner_phone,
          machine_type: newMachine.machine_type,
          model_name: newMachine.model_name,
          village: newMachine.village,
          district: newMachine.district,
          photo_url: newMachine.photo_url,
          crops: newMachine.crops,
          price_amount: newMachine.price_amount,
          price_unit: newMachine.price_unit,
          is_active: true,
          latitude: newMachine.latitude,
          longitude: newMachine.longitude,
          description: newMachine.description,
          harvester_type: newMachine.harvester_type,
          fuel_policy: newMachine.fuel_policy,
          driver_included: newMachine.driver_included,
          header_width_ft: newMachine.header_width_ft,
          has_straw_chopper: newMachine.has_straw_chopper,
          manufacture_year: newMachine.manufacture_year,
          condition: newMachine.condition,
          min_acres: newMachine.min_acres,
          owner_note: newMachine.owner_note,
          photos: newMachine.photos,
        };
        if (machineUuid) insertPayload.id = machineUuid;
        if (isUuid(user.id)) insertPayload.owner_id = user.id;

        try {
          const { data: insertedData, error: sbError } = await supabase
            .from('machines')
            .insert(insertPayload)
            .select('id')
            .maybeSingle();

          if (sbError) {
            console.error('Supabase machine insert failed:', sbError);
            setLoading(false);
            setError(`Failed to register vehicle in database: ${sbError.message}`);
            return;
          }

          if (insertedData?.id) {
            newMachine.id = insertedData.id;

            // Also insert into machine_photos table
            if (uploadedPhotoUrls.length > 0) {
              const photoRows = uploadedPhotoUrls.map((url, pos) => ({
                machine_id: insertedData.id,
                url,
                position: pos,
              }));
              await supabase.from('machine_photos').insert(photoRows);
            }
          }
        } catch (dbErr: any) {
          console.error('Supabase machine insert exception:', dbErr);
          setLoading(false);
          setError(`Database connection error: ${dbErr?.message || 'Failed to save machine.'}`);
          return;
        }
      }

      // Save locally to user machines
      const existing = getLocalMachines();
      saveLocalMachines([newMachine, ...existing]);

      setLoading(false);
      setSuccess(true);
      setTimeout(() => {
        onNavigate('manage');
      }, 2000);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to list machine.');
    }
  };

  // Protected route gate
  if (!user) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-xl bg-agri-light text-forest flex items-center justify-center mx-auto">
          <Tractor className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-forest">{t.listMachineTitle}</h2>
        <p className="text-sm text-neutralText-secondary">
          Please sign in with a verified mobile number as a <strong>Machine Owner</strong> to list your combine harvester.
        </p>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => onNavigate('login')}
        >
          {t.login} →
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 sm:py-8 px-4 space-y-6 pb-24">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
          {t.listMachineTitle}
        </h1>
        <p className="text-sm text-neutralText-secondary mt-1">
          {t.listMachineSubtitle}
        </p>
      </div>

      {success ? (
        <Card padding="lg" className="border-agri-border text-center space-y-3">
          <CheckCircle2 className="w-14 h-14 text-agri mx-auto" />
          <h2 className="text-xl font-bold text-forest">{t.machineListedSuccess}</h2>
          <p className="text-xs text-neutralText-secondary">Redirecting to your machine manager...</p>
        </Card>
      ) : (
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Toast type="error" message={error} onClose={() => setError(null)} />}

            {/* Owner Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t.ownerName}
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Suresh Gowda"
                leftIcon={<User className="w-4 h-4 text-agri" />}
              />

              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5 flex items-center justify-between">
                  <span>{t.ownerPhone}</span>
                  {user?.phone ? (
                    <span className="text-xs font-semibold text-agri flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {t.verifiedPhoneBadge}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Unverified
                    </span>
                  )}
                </label>
                {user?.phone ? (
                  <div className="relative">
                    <Phone className="w-4 h-4 text-agri absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      readOnly
                      value={user.phone}
                      className="w-full pl-10 pr-3.5 py-2.5 text-base font-semibold text-forest bg-cream-light/60 border border-cream-border rounded-lg cursor-not-allowed"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex">
                      <span className="inline-flex items-center px-3 text-sm font-bold text-forest bg-cream-light border border-r-0 border-cream-border rounded-l-lg select-none">
                        +91
                      </span>
                      <input
                        type="tel"
                        required
                        maxLength={10}
                        value={enteredPhone}
                        onChange={(e) => setEnteredPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        className="flex-1 px-3.5 py-2.5 text-base rounded-r-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri min-h-[44px]"
                      />
                    </div>
                    <p className="text-xs text-amber-800 font-medium">{t.phoneNotVerifiedNotice}</p>
                  </div>
                )}
                <p className="text-xs text-neutralText-muted mt-1">{t.ownerPhoneHelp}</p>
              </div>
            </div>

            {/* PART 1: Harvester Type Selection (Required) */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-forest">
                {t.harvesterTypeLabel} <span className="text-brickRed">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setHarvesterType('track')}
                  className={`p-4 rounded-xl text-left border-2 transition-subtle flex flex-col justify-between min-h-[96px] ${
                    harvesterType === 'track'
                      ? 'border-forest bg-agri-light/30 shadow-soft'
                      : 'border-cream-border bg-white hover:bg-cream-light/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-base font-bold text-forest block">
                        {t.trackTypeCardTitle}
                      </span>
                      <p className="text-xs text-neutralText-secondary mt-1 leading-relaxed">
                        {t.trackTypeCardHelp}
                      </p>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        harvesterType === 'track'
                          ? 'border-forest bg-forest text-white'
                          : 'border-cream-border bg-white'
                      }`}
                    >
                      {harvesterType === 'track' && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setHarvesterType('wheel')}
                  className={`p-4 rounded-xl text-left border-2 transition-subtle flex flex-col justify-between min-h-[96px] ${
                    harvesterType === 'wheel'
                      ? 'border-forest bg-agri-light/30 shadow-soft'
                      : 'border-cream-border bg-white hover:bg-cream-light/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-base font-bold text-forest block">
                        {t.wheelTypeCardTitle}
                      </span>
                      <p className="text-xs text-neutralText-secondary mt-1 leading-relaxed">
                        {t.wheelTypeCardHelp}
                      </p>
                    </div>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        harvesterType === 'wheel'
                          ? 'border-forest bg-forest text-white'
                          : 'border-cream-border bg-white'
                      }`}
                    >
                      {harvesterType === 'wheel' && <Check className="w-3.5 h-3.5" />}
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Machine Classification & Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">
                  {t.machineType}
                </label>
                <select
                  value={machineType}
                  onChange={(e) => setMachineType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-base rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri min-h-[44px]"
                >
                  <option value="Combine Harvester">Combine Harvester (Standard)</option>
                  <option value="Crawler Track Harvester">Crawler Track Harvester (Wet Field)</option>
                  <option value="Tractor Mounted Harvester">Tractor Mounted Harvester</option>
                  <option value="Sugarcane Harvester">Sugarcane Harvester</option>
                  <option value="Multi-Crop Thresher">Multi-Crop Thresher</option>
                </select>
              </div>

              <Input
                label={t.modelNameLabel}
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder={t.machineTypePlaceholder}
              />
            </div>

            {/* PART 3: Fuel Policy & Driver Included (Required) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Fuel Policy */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-forest flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-agri" />
                  <span>{t.fuelPolicyLabel}</span> <span className="text-brickRed">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setFuelPolicy('included')}
                    className={`p-3 rounded-lg text-left border transition-subtle flex items-center justify-between min-h-[48px] ${
                      fuelPolicy === 'included'
                        ? 'border-forest bg-agri-light/30 font-bold text-forest'
                        : 'border-cream-border bg-white text-neutralText-secondary hover:bg-cream-light/40'
                    }`}
                  >
                    <span className="text-sm">{t.fuelIncluded}</span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        fuelPolicy === 'included' ? 'border-forest bg-forest text-white' : 'border-cream-border'
                      }`}
                    >
                      {fuelPolicy === 'included' && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFuelPolicy('by_farmer')}
                    className={`p-3 rounded-lg text-left border transition-subtle flex items-center justify-between min-h-[48px] ${
                      fuelPolicy === 'by_farmer'
                        ? 'border-forest bg-agri-light/30 font-bold text-forest'
                        : 'border-cream-border bg-white text-neutralText-secondary hover:bg-cream-light/40'
                    }`}
                  >
                    <span className="text-sm">{t.fuelByFarmer}</span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        fuelPolicy === 'by_farmer' ? 'border-forest bg-forest text-white' : 'border-cream-border'
                      }`}
                    >
                      {fuelPolicy === 'by_farmer' && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                </div>
              </div>

              {/* Driver & Operator Included */}
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-forest flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-agri" />
                  <span>{t.driverIncludedLabel}</span> <span className="text-brickRed">*</span>
                </label>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setDriverIncluded(true)}
                    className={`p-3 rounded-lg text-left border transition-subtle flex items-center justify-between min-h-[48px] ${
                      driverIncluded
                        ? 'border-forest bg-agri-light/30 font-bold text-forest'
                        : 'border-cream-border bg-white text-neutralText-secondary hover:bg-cream-light/40'
                    }`}
                  >
                    <span className="text-sm">{t.driverIncludedYes}</span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        driverIncluded ? 'border-forest bg-forest text-white' : 'border-cream-border'
                      }`}
                    >
                      {driverIncluded && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriverIncluded(false)}
                    className={`p-3 rounded-lg text-left border transition-subtle flex items-center justify-between min-h-[48px] ${
                      !driverIncluded
                        ? 'border-forest bg-agri-light/30 font-bold text-forest'
                        : 'border-cream-border bg-white text-neutralText-secondary hover:bg-cream-light/40'
                    }`}
                  >
                    <span className="text-sm">{t.driverIncludedNo}</span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        !driverIncluded ? 'border-forest bg-forest text-white' : 'border-cream-border'
                      }`}
                    >
                      {!driverIncluded && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-forest">
                  Machine Location & District
                </label>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={isDetectingLocation}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-cream-light text-forest text-xs font-bold rounded-md border border-cream-border shadow-soft transition-subtle disabled:opacity-50"
                >
                  <Crosshair className={`w-3.5 h-3.5 text-agri ${isDetectingLocation ? 'animate-spin' : ''}`} />
                  <span>{isDetectingLocation ? t.detectingLocation : t.useCurrentLocation}</span>
                </button>
              </div>

              {locAccuracy !== null && (
                <p className="text-xs text-agri font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t.accurateTo} ~{locAccuracy}m
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Input
                    label={t.villageLabel}
                    required
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    placeholder="e.g. Pandavapura"
                    leftIcon={<MapPin className="w-4 h-4 text-agri" />}
                  />
                  {COMMON_VILLAGES[district] && !village && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[10px] text-neutralText-muted mr-1">Suggestions:</span>
                      {COMMON_VILLAGES[district].slice(0, 4).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setVillage(v)}
                          className="text-[10px] bg-white hover:bg-cream-light text-forest px-1.5 py-0.5 rounded border border-cream-border"
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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
                    className="w-full px-3.5 py-2.5 text-base rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri min-h-[44px]"
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Map Pin Fine-Tuning */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-forest">{t.dragPinHelp}</span>
                  {latitude && longitude && (
                    <span className="text-neutralText-muted font-mono">
                      {latitude.toFixed(4)}, {longitude.toFixed(4)}
                    </span>
                  )}
                </div>
                <HarvesterMap
                  isDraggableOwnerPin
                  ownerPinLocation={latitude && longitude ? { latitude, longitude } : null}
                  onLocationSelected={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  height="220px"
                  zoom={12}
                />
              </div>
            </div>

            {/* Crops Multi-Select */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-forest">
                {t.cropsHandled}
              </label>
              <div className="flex flex-wrap gap-2">
                {CROPS.map((c) => {
                  const isSelected = selectedCrops.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleToggleCrop(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-subtle flex items-center gap-1.5 border min-h-[44px] ${
                        isSelected
                          ? 'bg-agri text-white border-agri shadow-soft font-bold'
                          : 'bg-white text-neutralText-primary border-cream-border hover:bg-cream-light'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                      <span>{c}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pricing Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-forest mb-1.5">
                  {t.pricingType}
                </label>
                <select
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(e.target.value as PriceUnit)}
                  className="w-full px-3.5 py-2.5 text-base rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri min-h-[44px]"
                >
                  <option value="per_acre">{t.pricePerAcre}</option>
                  <option value="per_hour">{t.pricePerHour}</option>
                  <option value="per_day">{t.pricePerDay}</option>
                </select>
              </div>

              <Input
                label={t.priceAmountLabel}
                type="number"
                required
                min={100}
                step={50}
                value={priceAmount}
                onChange={(e) => setPriceAmount(parseFloat(e.target.value) || 0)}
                placeholder="2200"
                leftIcon={<DollarSign className="w-4 h-4 text-agri" />}
              />
            </div>

            {/* PART 3: Tech Specs (Optional with validation) */}
            <div className="p-4 rounded-xl bg-cream-light/40 border border-cream-border space-y-4">
              <h3 className="text-sm font-bold text-forest uppercase tracking-wider flex items-center gap-2">
                <Ruler className="w-4 h-4 text-agri" />
                <span>{t.technicalSpecifications} (Optional)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Cutter width */}
                <div>
                  <label className="block text-xs font-semibold text-forest mb-1">
                    {t.headerWidthLabel}
                  </label>
                  <input
                    type="number"
                    min={4}
                    max={30}
                    step={0.5}
                    value={headerWidthFt}
                    onChange={(e) => setHeaderWidthFt(e.target.value)}
                    placeholder={t.headerWidthPlaceholder}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri min-h-[44px]"
                  />
                  <p className="text-[10px] text-neutralText-muted mt-0.5">{t.headerWidthHelp}</p>
                </div>

                {/* Manufacture year */}
                <div>
                  <label className="block text-xs font-semibold text-forest mb-1">
                    {t.manufactureYearLabel}
                  </label>
                  <input
                    type="number"
                    min={1990}
                    max={new Date().getFullYear()}
                    value={manufactureYear}
                    onChange={(e) => setManufactureYear(e.target.value)}
                    placeholder={t.manufactureYearPlaceholder}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri min-h-[44px]"
                  />
                  <p className="text-[10px] text-neutralText-muted mt-0.5">1990 - {new Date().getFullYear()}</p>
                </div>

                {/* Min acres */}
                <div>
                  <label className="block text-xs font-semibold text-forest mb-1">
                    {t.minAcresLabel}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={minAcres}
                    onChange={(e) => setMinAcres(e.target.value)}
                    placeholder={t.minAcresPlaceholder}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri min-h-[44px]"
                  />
                  <p className="text-[10px] text-neutralText-muted mt-0.5">{t.minAcresHelp}</p>
                </div>
              </div>

              {/* Straw Chopper & Machine Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-forest mb-1.5 flex items-center gap-1">
                    <Scissors className="w-3.5 h-3.5 text-agri" />
                    <span>{t.strawChopperLabel}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setHasStrawChopper(!hasStrawChopper)}
                    className={`w-full p-2.5 rounded-lg border text-xs font-semibold transition-subtle flex items-center justify-between min-h-[44px] ${
                      hasStrawChopper
                        ? 'border-forest bg-agri-light/40 text-forest'
                        : 'border-cream-border bg-white text-neutralText-secondary'
                    }`}
                  >
                    <span>{hasStrawChopper ? t.strawChopperYes : t.strawChopperNo}</span>
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        hasStrawChopper ? 'border-forest bg-forest text-white' : 'border-cream-border'
                      }`}
                    >
                      {hasStrawChopper && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-forest mb-1.5">
                    {t.conditionLabel}
                  </label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value as MachineCondition)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri min-h-[44px]"
                  >
                    <option value="good">{t.conditionGood}</option>
                    <option value="average">{t.conditionAverage}</option>
                    <option value="needs_care">{t.conditionNeedsCare}</option>
                  </select>
                </div>
              </div>

              {/* Owner Note / Weather Policy */}
              <div>
                <label className="block text-xs font-semibold text-forest mb-1 flex items-center justify-between">
                  <span>{t.ownerNoteLabel}</span>
                  <span className="text-[11px] text-neutralText-muted">{ownerNote.length}/300</span>
                </label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={ownerNote}
                  onChange={(e) => setOwnerNote(e.target.value)}
                  placeholder={t.ownerNotePlaceholder}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri"
                />
                <p className="text-[10px] text-neutralText-muted mt-0.5">{t.ownerNoteHelp}</p>
              </div>
            </div>

            {/* PART 6: Photos Upload Gallery (Up to 4 real photos) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-forest">
                  {t.photosLabel}
                </label>
                <span className="text-xs text-neutralText-muted font-semibold">
                  {photoPreviews.length} / 4 photos
                </span>
              </div>
              <p className="text-xs text-neutralText-secondary">{t.photosHelp}</p>

              {/* Thumbnails row */}
              <div className="flex flex-wrap gap-3 pt-2">
                {photoPreviews.map((preview, idx) => (
                  <div
                    key={idx}
                    className="relative w-24 h-24 rounded-lg overflow-hidden border border-cream-border bg-cream-light shadow-soft flex-shrink-0"
                  >
                    <img
                      src={preview}
                      alt={`Machine photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-forest text-white text-[9px] font-bold rounded">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 w-5 h-5 bg-brickRed text-white rounded-full flex items-center justify-center hover:opacity-90"
                      title="Remove photo"
                      aria-label="Remove photo"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {photoPreviews.length < 4 && (
                  <label className="w-24 h-24 rounded-lg border-2 border-dashed border-cream-border bg-white hover:bg-cream-light flex flex-col items-center justify-center text-neutralText-muted cursor-pointer transition-subtle flex-shrink-0 min-h-[48px]">
                    <Upload className="w-5 h-5 text-agri mb-1" />
                    <span className="text-[11px] font-bold text-forest">Add Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              isLoading={loading}
              icon={<Tractor className="w-5 h-5" />}
            >
              {t.submitMachineBtn}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
};
