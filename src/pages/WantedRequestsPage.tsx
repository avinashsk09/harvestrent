import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { WantedRequest } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DISTRICTS, CROPS } from '../lib/constants';
import { Card, Button, Badge, Toast, Modal } from '../components/ui';
import {
  Wheat,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  Layers,
  Filter,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Tractor,
} from 'lucide-react';

interface WantedRequestsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const WantedRequestsPage: React.FC<WantedRequestsPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const isOwner = user?.role === 'owner';
  const [requests, setRequests] = useState<WantedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [districtFilter, setDistrictFilter] = useState<string>(user?.district || 'All');
  const [cropFilter, setCropFilter] = useState<string>('All');
  const [pageToast, setPageToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // New Request Modal state (for farmers)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCrop, setNewCrop] = useState<string>('Paddy (Rice)');
  const [newAcres, setNewAcres] = useState<number>(3);
  const [newDistrict, setNewDistrict] = useState<string>(user?.district || 'Ballari');
  const [newVillage, setNewVillage] = useState<string>(user?.village || '');
  const [newDate, setNewDate] = useState<string>('');
  const [newType, setNewType] = useState<string>('any');
  const [newNote, setNewNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    if (!isSupabaseConfigured) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase.from('wanted_requests').select('*');

      if (isOwner) {
        // Owner sees all OPEN requests
        query = query.eq('status', 'open');
        if (districtFilter !== 'All') {
          query = query.eq('district', districtFilter);
        }
        if (cropFilter !== 'All') {
          query = query.eq('crop', cropFilter);
        }
        query = query.order('needed_date', { ascending: true });
      } else {
        // Farmer sees their own requests (or all open if guest)
        if (user) {
          query = query.eq('farmer_id', user.id).order('created_at', { ascending: false });
        } else {
          query = query.eq('status', 'open').order('needed_date', { ascending: true });
        }
      }

      const { data, error } = await query;
      if (!error && data) {
        setRequests(data as WantedRequest[]);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.warn('Error fetching wanted requests:', err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [districtFilter, cropFilter, isOwner, user]);

  const handleUpdateStatus = async (id: string, newStatus: 'fulfilled' | 'closed') => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('wanted_requests')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('farmer_id', user.id);

      if (error) {
        setPageToast({ type: 'error', message: error.message });
      } else {
        setPageToast({ type: 'success', message: `Request marked as ${newStatus}.` });
        fetchRequests();
      }
    } catch (err: any) {
      setPageToast({ type: 'error', message: err.message || 'Error updating status' });
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onNavigate('login');
      return;
    }

    if (!newDate) {
      setPageToast({ type: 'error', message: 'Please select when the harvester is needed.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('wanted_requests').insert({
        farmer_id: user.id,
        farmer_name: user.full_name || 'Farmer',
        farmer_phone: user.phone || '',
        crop: newCrop,
        acres: Number(newAcres),
        district: newDistrict,
        village: newVillage.trim(),
        needed_date: newDate,
        harvester_type: newType,
        note: newNote.trim() || null,
        status: 'open',
      });

      if (error) {
        if (error.message.includes('rate_limit') || error.message.includes('3 open')) {
          setPageToast({
            type: 'error',
            message: 'You already have 3 open harvester requests. Please fulfill or close an earlier request.',
          });
        } else {
          setPageToast({ type: 'error', message: error.message });
        }
      } else {
        setShowCreateModal(false);
        setPageToast({ type: 'success', message: t.requestPostedSuccess || 'Wanted request posted!' });
        setNewNote('');
        fetchRequests();
      }
    } catch (err: any) {
      setPageToast({ type: 'error', message: err.message || 'Error posting request' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6 pb-24">
      {/* Toast Alert */}
      {pageToast && (
        <Toast
          type={pageToast.type}
          message={pageToast.message}
          onClose={() => setPageToast(null)}
        />
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cream-border pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-forest text-cream-light flex items-center justify-center shadow-soft">
              <Wheat className="w-6 h-6 text-cream-light" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
              {isOwner
                ? (t.wantedRequestsTitle || 'Farmer Harvester Requests')
                : (t.myWantedRequestsTitle || 'My Harvester Requests')}
            </h1>
          </div>
          <p className="text-sm text-neutralText-secondary max-w-xl">
            {isOwner
              ? (t.wantedRequestsSubtitle || 'Nearby farmers waiting for harvesters. Call or WhatsApp them directly to arrange work.')
              : (t.myWantedRequestsSubtitle || 'Track your posted harvester requirements. Machine owners in your district will contact you.')}
          </p>
        </div>

        {!isOwner && (
          <Button
            variant="primary"
            size="md"
            onClick={() => {
              if (!user) {
                onNavigate('login');
              } else {
                setShowCreateModal(true);
              }
            }}
            icon={<PlusCircle className="w-4 h-4" />}
          >
            {t.postWantedRequest || 'Post Wanted Request'}
          </Button>
        )}
      </div>

      {/* Owner Filters */}
      {isOwner && (
        <Card padding="sm" className="bg-cream-light/60 border-cream-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold text-forest uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-agri" />
              Filter Requests:
            </span>

            {/* District Filter */}
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="text-xs font-bold text-forest bg-white border border-cream-border rounded-lg px-2.5 py-1.5 min-h-[40px]"
            >
              <option value="All">{t.allDistricts || 'All Districts'}</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Crop Filter */}
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              className="text-xs font-bold text-forest bg-white border border-cream-border rounded-lg px-2.5 py-1.5 min-h-[40px]"
            >
              <option value="All">{t.allCrops || 'All Crops'}</option>
              {CROPS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <span className="text-xs font-bold text-neutralText-secondary">
            {requests.length} open requirement{requests.length === 1 ? '' : 's'}
          </span>
        </Card>
      )}

      {/* Requests List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} padding="md" className="space-y-3">
              <div className="h-5 w-3/4 bg-cream-border/60 animate-pulse rounded" />
              <div className="h-4 w-1/2 bg-cream-border/40 animate-pulse rounded" />
              <div className="h-10 w-full bg-cream-border/30 animate-pulse rounded-lg" />
            </Card>
          ))}
        </div>
      ) : requests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((req) => {
            const isFarmerOwnerOfRequest = user?.id === req.farmer_id;
            const cleanPhone = req.farmer_phone ? req.farmer_phone.replace(/\D/g, '').slice(-10) : '';

            return (
              <Card key={req.id} padding="md" className="space-y-3 border-cream-border flex flex-col justify-between">
                <div className="space-y-2">
                  {/* Top line: Crop + Status + Harvester Type */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-base font-bold text-forest flex items-center gap-1.5">
                      🌾 {req.crop}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {req.harvester_type === 'track' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-forest text-white">
                          🚜 Track / Chain
                        </span>
                      )}
                      {req.harvester_type === 'wheel' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-light text-forest border border-cream-border">
                          🛞 Wheeled
                        </span>
                      )}

                      <Badge
                        variant={
                          req.status === 'open'
                            ? 'success'
                            : req.status === 'fulfilled'
                            ? 'info'
                            : 'neutral'
                        }
                      >
                        {req.status}
                      </Badge>
                    </div>
                  </div>

                  {/* Acres & Date */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-cream-light/60 rounded-lg border border-cream-border">
                      <span className="text-neutralText-secondary block font-medium">Land Area</span>
                      <strong className="text-forest text-sm">{req.acres} Acres</strong>
                    </div>

                    <div className="p-2 bg-cream-light/60 rounded-lg border border-cream-border">
                      <span className="text-neutralText-secondary block font-medium">Needed On</span>
                      <strong className="text-forest text-sm">{req.needed_date}</strong>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="flex items-center gap-1.5 text-xs text-forest">
                    <MapPin className="w-3.5 h-3.5 text-agri" />
                    <span><strong>{req.village}</strong>, {req.district}</span>
                  </div>

                  {/* Farmer Details (for Owners) */}
                  {isOwner && (
                    <div className="p-2.5 bg-white border border-cream-border rounded-lg text-xs space-y-1">
                      <span className="text-neutralText-secondary block">Farmer Contact</span>
                      <span className="font-bold text-forest text-sm block">{req.farmer_name}</span>
                    </div>
                  )}

                  {/* Note */}
                  {req.note && (
                    <p className="text-xs text-neutralText-secondary italic bg-cream-light/40 p-2 rounded border border-cream-border">
                      "{req.note}"
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-cream-border flex items-center gap-2">
                  {/* Owner Actions: Call & WhatsApp */}
                  {isOwner && cleanPhone && req.status === 'open' && (
                    <>
                      <a
                        href={`tel:${cleanPhone}`}
                        className="flex-1 py-2 px-3 bg-forest text-white rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 hover:bg-forest/90 transition-all min-h-[44px]"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{t.callFarmerBtn || 'Call Farmer'}</span>
                      </a>

                      <a
                        href={`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(
                          `Hello ${req.farmer_name}! I saw your request for a combine harvester for ${req.acres} acres of ${req.crop} in ${req.village} on Harvest Rentals. I have a machine available.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 bg-white border border-agri-border text-agri rounded-lg text-xs font-bold text-center flex items-center justify-center gap-1.5 hover:bg-agri-light/20 transition-all min-h-[44px]"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-agri" />
                        <span>WhatsApp</span>
                      </a>
                    </>
                  )}

                  {/* Farmer Management Actions */}
                  {isFarmerOwnerOfRequest && req.status === 'open' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(req.id, 'fulfilled')}
                        className="flex-1 py-2 px-3 bg-forest text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-forest/90 min-h-[44px]"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-cream-light" />
                        <span>{t.markFulfilledBtn || 'Mark Fulfilled'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(req.id, 'closed')}
                        className="flex-1 py-2 px-3 bg-white border border-cream-border text-neutralText-secondary rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-cream-light min-h-[44px]"
                      >
                        <XCircle className="w-3.5 h-3.5 text-brickRed" />
                        <span>{t.closeRequestBtn || 'Close'}</span>
                      </button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card padding="lg" className="text-center py-12 space-y-4 border-dashed border-2 border-cream-border">
          <div className="w-14 h-14 rounded-2xl bg-cream-light text-forest flex items-center justify-center mx-auto">
            <Wheat className="w-7 h-7 text-agri" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-forest">
              {t.noWantedRequests || 'No open harvester requests found.'}
            </h3>
            <p className="text-xs text-neutralText-secondary max-w-sm mx-auto">
              {isOwner
                ? 'Check back later or change district filters to see farmers in neighboring areas.'
                : 'Post a request whenever you cannot find an available harvester in your village.'}
            </p>
          </div>
          {!isOwner && (
            <Button
              variant="primary"
              onClick={() => {
                if (!user) onNavigate('login');
                else setShowCreateModal(true);
              }}
              icon={<PlusCircle className="w-4 h-4" />}
            >
              {t.postWantedRequest || 'Post a Wanted Request'}
            </Button>
          )}
        </Card>
      )}

      {/* Modal: Farmer Create Wanted Request */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title={t.postWantedRequestTitle || 'Post a Harvester Wanted Request'}
      >
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <p className="text-xs text-neutralText-secondary">
            {t.postWantedRequestSubtitle || 'Local combine harvester owners will see your requirement and call you directly.'}
          </p>

          {/* Crop */}
          <div>
            <label className="block text-xs font-bold text-forest mb-1">
              {t.cropNeededLabel || 'Crop to Harvest'} *
            </label>
            <select
              value={newCrop}
              onChange={(e) => setNewCrop(e.target.value)}
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
                value={newAcres}
                onChange={(e) => setNewAcres(parseFloat(e.target.value) || 1)}
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
                min={new Date().toISOString().split('T')[0]}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
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
                value={newDistrict}
                onChange={(e) => setNewDistrict(e.target.value)}
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
                value={newVillage}
                onChange={(e) => setNewVillage(e.target.value)}
                placeholder="e.g. Siruguppa"
                className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary min-h-[48px]"
              />
            </div>
          </div>

          {/* Harvester Type */}
          <div>
            <label className="block text-xs font-bold text-forest mb-1">
              Preferred Harvester Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'any', label: 'Any' },
                { key: 'track', label: 'Track / Chain' },
                { key: 'wheel', label: 'Wheeled' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setNewType(opt.key)}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border min-h-[44px] ${
                    newType === opt.key
                      ? 'bg-forest text-white border-forest'
                      : 'bg-white text-forest border-cream-border'
                  }`}
                >
                  {opt.label}
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
              value={newNote}
              maxLength={200}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="e.g. Near highway approach road, field drained."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            isLoading={isSubmitting}
          >
            {t.postRequestBtn || 'Submit Harvester Request'}
          </Button>
        </form>
      </Modal>
    </div>
  );
};

