import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Machine, MachineBusyDate } from '../types';
import {
  getLocalMachines,
  saveLocalMachines,
  getLocalBusyDates,
  saveLocalBusyDates,
  supabase,
  isSupabaseConfigured,
} from '../lib/supabase';
import { Card, Button, Badge, Modal, Toast } from '../components/ui';
import { AvailabilityCalendar } from '../components/AvailabilityCalendar';
import { parseISTDate, formatISTDate } from '../utils/calendarUtils';
import {
  Tractor,
  PauseCircle,
  PlayCircle,
  Trash2,
  Calendar,
  Plus,
  MapPin,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface ManageListingsPageProps {
  onNavigate: (page: string) => void;
}

export const ManageListingsPage: React.FC<ManageListingsPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const [myMachines, setMyMachines] = useState<Machine[]>([]);
  const [busyDates, setBusyDates] = useState<MachineBusyDate[]>([]);
  const [activeCalendarMachine, setActiveCalendarMachine] = useState<Machine | null>(null);
  const [newBusyDate, setNewBusyDate] = useState<string>('');
  const [busyReason, setBusyReason] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    let machinesList: Machine[] = [];
    let busyList: MachineBusyDate[] = [];

    if (isSupabaseConfigured && user) {
      try {
        const { data, error } = await supabase
          .from('machines')
          .select('*')
          .eq('owner_id', user.id);

        if (!error && data) {
          machinesList = data as Machine[];
        }

        const { data: bData } = await supabase.from('machine_busy_dates').select('*');
        if (bData) {
          busyList = bData as MachineBusyDate[];
        }
      } catch (err) {
        console.warn('Supabase fetch owner machines notice:', err);
      }
    }

    // Combine or fallback to local user machines
    if (machinesList.length === 0) {
      const allLocal = getLocalMachines();
      machinesList = user ? allLocal.filter((m) => m.owner_id === user.id || m.owner_phone === user.phone) : allLocal;
    }

    if (busyList.length === 0) {
      busyList = getLocalBusyDates();
    }

    setMyMachines(machinesList);
    setBusyDates(busyList);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Toggle Pause/Resume
  const handleToggleActive = async (machineId: string, currentStatus: boolean) => {
    const updated = myMachines.map((m) =>
      m.id === machineId ? { ...m, is_active: !currentStatus } : m
    );
    setMyMachines(updated);

    const all = getLocalMachines().map((m) =>
      m.id === machineId ? { ...m, is_active: !currentStatus } : m
    );
    saveLocalMachines(all);

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('machines')
          .update({ is_active: !currentStatus })
          .eq('id', machineId);
      } catch (err) {
        console.warn('Supabase toggle error:', err);
      }
    }

    showToast(currentStatus ? 'Listing paused (hidden from search)' : 'Listing resumed (active in search)');
  };

  // Delete Machine
  const handleDeleteMachine = async (machineId: string) => {
    if (window.confirm(t.confirmDelete)) {
      const updated = myMachines.filter((m) => m.id !== machineId);
      setMyMachines(updated);

      const all = getLocalMachines().filter((m) => m.id !== machineId);
      saveLocalMachines(all);

      if (isSupabaseConfigured) {
        try {
          await supabase.from('machines').delete().eq('id', machineId);
        } catch (err) {
          console.warn('Supabase delete error:', err);
        }
      }

      showToast('Machine removed from listings.');
    }
  };

  // Add Busy Date
  const handleAddBusyDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCalendarMachine || !newBusyDate) return;

    const newEntry: MachineBusyDate = {
      id: `busy-${Date.now()}`,
      machine_id: activeCalendarMachine.id,
      busy_date: newBusyDate,
      reason: busyReason.trim() || 'Pre-booked harvest job',
      created_at: new Date().toISOString(),
    };

    const updated = [newEntry, ...busyDates];
    setBusyDates(updated);
    saveLocalBusyDates(updated);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('machine_busy_dates').insert({
          machine_id: newEntry.machine_id,
          busy_date: newEntry.busy_date,
          reason: newEntry.reason,
        });
      } catch (err) {
        console.warn('Supabase insert busy date warning:', err);
      }
    }

    setNewBusyDate('');
    setBusyReason('');
    showToast(`Unavailable date added: ${newBusyDate}`);
  };

  // Remove Busy Date
  const handleRemoveBusyDate = async (busyId: string) => {
    const target = busyDates.find((b) => b.id === busyId);
    if (target?.status === 'booked') {
      showToast(t.cannotUnblockBooked);
      return;
    }

    const updated = busyDates.filter((b) => b.id !== busyId);
    setBusyDates(updated);
    saveLocalBusyDates(updated);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('machine_busy_dates').delete().eq('id', busyId);
      } catch (err) {
        console.warn('Supabase remove busy date warning:', err);
      }
    }

    showToast('Date removed from calendar.');
  };

  // Toggle single day in Availability Calendar
  const handleToggleCalendarDate = async (dateStr: string, currentStatus?: 'free' | 'busy' | 'booked') => {
    if (!activeCalendarMachine) return;
    if (currentStatus === 'booked') {
      throw new Error(t.cannotUnblockBooked);
    }

    if (currentStatus === 'busy') {
      // Remove busy date
      const toRemove = busyDates.find(
        (b) => b.machine_id === activeCalendarMachine.id && b.busy_date === dateStr
      );
      if (toRemove) {
        await handleRemoveBusyDate(toRemove.id);
      }
    } else {
      // Add busy date
      const newEntry: MachineBusyDate = {
        id: `busy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        machine_id: activeCalendarMachine.id,
        busy_date: dateStr,
        status: 'busy',
        note: 'Blocked by owner',
        reason: 'Blocked by owner',
        created_at: new Date().toISOString(),
      };

      const updated = [newEntry, ...busyDates];
      setBusyDates(updated);
      saveLocalBusyDates(updated);

      if (isSupabaseConfigured) {
        try {
          await supabase.from('machine_busy_dates').insert({
            machine_id: newEntry.machine_id,
            busy_date: newEntry.busy_date,
            status: 'busy',
            note: newEntry.note,
          });
        } catch (err) {
          console.warn('Supabase toggle busy date insert error:', err);
        }
      }
    }
  };

  // Block multiple dates (Date range) in Availability Calendar
  const handleBlockDateRange = async (startDate: string, endDate: string, note?: string) => {
    if (!activeCalendarMachine) return;
    const start = parseISTDate(startDate);
    const end = parseISTDate(endDate);

    const newEntries: MachineBusyDate[] = [];
    const existingDates = new Set(
      busyDates.filter((b) => b.machine_id === activeCalendarMachine.id).map((b) => b.busy_date)
    );

    const cur = new Date(start);
    while (cur <= end) {
      const dStr = formatISTDate(cur);
      if (!existingDates.has(dStr)) {
        newEntries.push({
          id: `busy-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          machine_id: activeCalendarMachine.id,
          busy_date: dStr,
          status: 'busy',
          note: note || 'Blocked by owner',
          reason: note || 'Blocked by owner',
          created_at: new Date().toISOString(),
        });
        existingDates.add(dStr);
      }
      cur.setDate(cur.getDate() + 1);
    }

    if (newEntries.length === 0) return;

    const updated = [...newEntries, ...busyDates];
    setBusyDates(updated);
    saveLocalBusyDates(updated);

    if (isSupabaseConfigured) {
      try {
        const payload = newEntries.map((e) => ({
          machine_id: e.machine_id,
          busy_date: e.busy_date,
          status: 'busy',
          note: e.note,
        }));
        await supabase.from('machine_busy_dates').insert(payload);
      } catch (err) {
        console.warn('Supabase block range insert error:', err);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-8 px-4 space-y-6 pb-24">
      {toastMessage && (
        <Toast type="info" message={toastMessage} onClose={() => setToastMessage(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cream-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
            {t.manageListingTitle}
          </h1>
          <p className="text-sm text-neutralText-secondary mt-0.5">
            Pause, resume, manage busy dates, or remove your registered machines
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => onNavigate('list')}
          icon={<Plus className="w-4 h-4" />}
        >
          {t.listMachine}
        </Button>
      </div>

      {/* Real Machines List */}
      {myMachines.length > 0 ? (
        <div className="space-y-4">
          {myMachines.map((m) => {
            const mBusy = busyDates.filter((b) => b.machine_id === m.id);

            return (
              <Card
                key={m.id}
                padding="md"
                className={`transition-subtle ${
                  !m.is_active ? 'opacity-80 bg-cream-light/40' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Photo & Info */}
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-20 h-20 rounded-lg overflow-hidden border border-cream-border bg-cream-dark/50 flex-shrink-0">
                      {m.photo_url ? (
                        <img
                          src={m.photo_url}
                          alt={m.model_name || m.machine_type}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-neutralText-muted font-bold">
                          🚜
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-forest text-base sm:text-lg">
                          {m.model_name || m.machine_type}
                        </h3>
                        <Badge variant={m.is_active ? 'success' : 'neutral'}>
                          {m.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </div>

                      <p className="text-xs text-neutralText-secondary flex items-center gap-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-agri" />
                        {m.village}, {m.district} • ₹{m.price_amount} / {m.price_unit.replace('per_', '')}
                      </p>

                      <div className="flex flex-wrap gap-1 pt-1">
                        {m.crops.map((crop, idx) => (
                          <span
                            key={idx}
                            className="bg-cream-light text-forest border border-cream-border text-[11px] font-medium px-2 py-0.5 rounded"
                          >
                            {crop}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap sm:flex-col items-center sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-cream-border">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggleActive(m.id, m.is_active)}
                      icon={m.is_active ? <PauseCircle className="w-4 h-4 text-forest" /> : <PlayCircle className="w-4 h-4 text-agri" />}
                    >
                      {m.is_active ? t.pauseListing : t.resumeListing}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveCalendarMachine(m)}
                      icon={<Calendar className="w-4 h-4 text-agri" />}
                    >
                      {t.setBusyDates} ({mBusy.length})
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMachine(m.id)}
                      className="text-brickRed hover:bg-brickRed-light/40"
                      icon={<Trash2 className="w-4 h-4" />}
                    >
                      {t.removeListing}
                    </Button>
                  </div>
                </div>

                {/* Unavailable Dates List */}
                {mBusy.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-cream-border flex items-center gap-2 overflow-x-auto text-xs">
                    <span className="text-neutralText-muted font-semibold whitespace-nowrap">
                      Unavailable on:
                    </span>
                    {mBusy.map((b) => (
                      <span
                        key={b.id}
                        className="bg-cream-light text-forest border border-cream-border px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex items-center gap-1.5"
                      >
                        {b.busy_date}
                        <button
                          type="button"
                          onClick={() => handleRemoveBusyDate(b.id)}
                          className="text-brickRed hover:opacity-80 font-bold"
                          title="Remove date"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        /* Friendly Empty State for Owners */
        <Card padding="lg" className="text-center max-w-md mx-auto space-y-3 py-10 border-agri/30 shadow-soft">
          <div className="w-16 h-16 rounded-full bg-agri/10 border border-agri-border text-forest flex items-center justify-center mx-auto">
            <Tractor className="w-8 h-8 text-forest" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-bold text-forest">
              Namaste Sir! Would you like to register your vehicle?
            </h3>
            <p className="text-xs text-neutralText-secondary italic">
              ನಮಸ್ತೆ ಸರ್! ನಿಮ್ಮ ವಾಹನ/ಯಂತ್ರವನ್ನು ನೋಂದಾಯಿಸಲು ಬಯಸುವಿರಾ? &bull; नमस्ते सर! क्या आप अपने वाहन को पंजीकृत करना चाहते हैं?
            </p>
            <p className="text-sm text-neutralText-secondary pt-1">
              List your harvester or tractor with photos, district and rates so local farmers can call and book your machine directly.
            </p>
          </div>
          <div className="pt-3">
            <Button
              variant="primary"
              size="lg"
              onClick={() => onNavigate('list')}
              icon={<Plus className="w-4 h-4" />}
            >
              Register Vehicle Now
            </Button>
          </div>
        </Card>
      )}

      {/* Availability Calendar Modal */}
      <Modal
        isOpen={Boolean(activeCalendarMachine)}
        onClose={() => setActiveCalendarMachine(null)}
        title={`${activeCalendarMachine?.model_name || activeCalendarMachine?.machine_type || 'Machine'} - ${t.availabilityCalendarTitle}`}
      >
        {activeCalendarMachine && (
          <div className="space-y-4">
            <p className="text-xs text-neutralText-secondary">
              Machine: <strong>{activeCalendarMachine.model_name || activeCalendarMachine.machine_type}</strong> ({activeCalendarMachine.village}, {activeCalendarMachine.district})
            </p>

            <AvailabilityCalendar
              machineId={activeCalendarMachine.id}
              busyDates={busyDates}
              isOwner={true}
              onToggleDate={handleToggleCalendarDate}
              onBlockRange={handleBlockDateRange}
            />

            <Button
              type="button"
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => setActiveCalendarMachine(null)}
            >
              {t.closeReceipt}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};
