import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Booking, BookingStatus } from '../types';
import { getLocalBookings, saveLocalBookings, supabase, isSupabaseConfigured } from '../lib/supabase';
import { BookingReceiptModal } from '../components/BookingReceiptModal';
import { Card, Button, Badge } from '../components/ui';
import {
  Calendar,
  Receipt,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  CalendarCheck,
} from 'lucide-react';

interface MyBookingsPageProps {
  onNavigate: (page: string) => void;
}

export const MyBookingsPage: React.FC<MyBookingsPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadBookings = async () => {
    setLoading(true);
    let list: Booking[] = [];

    if (isSupabaseConfigured && user) {
      try {
        const query = supabase.from('bookings').select('*, machines(*)');
        if (isOwner) {
          query.eq('machines.owner_id', user.id);
        } else {
          query.eq('farmer_id', user.id);
        }
        const { data, error } = await query;
        if (!error && data) {
          list = data as Booking[];
        }
      } catch (err) {
        console.warn('Supabase fetch bookings notice:', err);
      }
    }

    if (list.length === 0) {
      const local = getLocalBookings();
      list = local;
    }

    setBookings(list);
    setLoading(false);
  };

  useEffect(() => {
    loadBookings();
  }, [user, isOwner]);

  const handleUpdateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    const updated = bookings.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b));
    setBookings(updated);
    saveLocalBookings(updated);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId);
      } catch (err) {
        console.warn('Supabase update status notice:', err);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-8 px-4 space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cream-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
            {isOwner ? t.ownerRequestsTitle : t.farmerBookingsTitle}
          </h1>
          <p className="text-sm text-neutralText-secondary mt-0.5">
            {isOwner
              ? 'Review and manage harvester rental requests from farmers'
              : 'Track your harvester reservations, receipts, and field schedules'}
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => onNavigate('find')}
        >
          {t.btnFindMachine}
        </Button>
      </div>

      {/* Bookings List */}
      {bookings.length > 0 ? (
        <div className="space-y-4">
          {bookings.map((b) => (
            <Card key={b.id} padding="md" className="space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-border pb-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-neutralText-muted">
                    REF: {b.id.substring(0, 10)}
                  </span>
                  <span className="text-cream-border">•</span>
                  <span className="font-semibold text-forest flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-agri" />
                    {b.booking_date}
                  </span>
                </div>
                <div>
                  <Badge status={b.status} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <h3 className="font-bold text-forest text-base">
                    {b.machine?.model_name || b.receipt_data?.machine_type || 'Combine Harvester'}
                  </h3>
                  <p className="text-neutralText-secondary text-xs mt-0.5">
                    <strong>{b.acres} {t.acresUnit}</strong> • Crop: {b.crop}
                  </p>
                  <p className="text-xs text-neutralText-muted mt-1">
                    Total Estimate: <strong>₹{b.total_estimate.toLocaleString('en-IN')}</strong> | Advance Paid:{' '}
                    <strong className="text-forest">₹{b.advance_amount.toLocaleString('en-IN')}</strong>
                  </p>
                </div>

                <div className="bg-cream-light/60 p-3 rounded-lg border border-cream-border space-y-1 text-xs">
                  <div className="font-bold text-forest flex items-center justify-between">
                    <span>{isOwner ? 'Farmer Contact' : 'Owner Contact'}</span>
                    <a
                      href={`tel:${isOwner ? b.farmer_phone : b.machine?.owner_phone || b.receipt_data?.owner_phone}`}
                      className="text-agri underline flex items-center gap-1 font-bold"
                    >
                      <Phone className="w-3 h-3" />
                      {isOwner ? b.farmer_phone : b.machine?.owner_phone || b.receipt_data?.owner_phone}
                    </a>
                  </div>
                  <p className="text-neutralText-secondary">
                    Name: <strong>{isOwner ? b.farmer_name : b.machine?.owner_name || b.receipt_data?.owner_name}</strong>
                  </p>
                  <p className="text-neutralText-muted">
                    Payment: <span className="uppercase font-semibold">{b.payment_mode}</span>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cream-border">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedReceiptBooking(b)}
                  icon={<Receipt className="w-4 h-4 text-forest" />}
                >
                  {t.btnViewReceipt}
                </Button>

                {isOwner && (
                  <div className="flex items-center gap-2">
                    {b.status === 'pending' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                      >
                        Confirm Request
                      </Button>
                    )}
                    {b.status !== 'cancelled' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUpdateStatus(b.id, 'cancelled')}
                        className="text-brickRed hover:bg-brickRed-light/30"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Friendly Empty State */
        <Card padding="lg" className="text-center max-w-md mx-auto space-y-3 py-10">
          <div className="w-14 h-14 rounded-full bg-cream-light border border-cream-border text-forest flex items-center justify-center mx-auto">
            <CalendarCheck className="w-7 h-7 text-neutralText-muted" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-forest">{t.noBookingsYet}</h3>
            <p className="text-sm text-neutralText-secondary">
              Search nearby harvesting machines to make your first field reservation.
            </p>
          </div>
          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => onNavigate('find')}
            >
              {t.btnFindMachine}
            </Button>
          </div>
        </Card>
      )}

      {/* Booking Receipt Modal */}
      <BookingReceiptModal
        booking={selectedReceiptBooking}
        onClose={() => setSelectedReceiptBooking(null)}
      />
    </div>
  );
};
