import React from 'react';
import { Printer, CheckCircle, Clock } from 'lucide-react';
import { Booking } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Modal, Button, Badge } from './ui';

interface BookingReceiptModalProps {
  isOpen?: boolean;
  booking: Booking | null;
  onClose: () => void;
}

export const BookingReceiptModal: React.FC<BookingReceiptModalProps> = ({
  isOpen = true,
  booking,
  onClose,
}) => {
  const { t } = useLanguage();

  if (!booking) return null;

  const handlePrint = () => {
    window.print();
  };

  const receipt = booking.receipt_data;
  const balance = Math.max(0, booking.total_estimate - booking.advance_amount);

  return (
    <Modal
      isOpen={isOpen && Boolean(booking)}
      onClose={onClose}
      title={t.receiptTitle}
      maxWidth="md"
    >
      <div className="space-y-4 text-neutralText-primary">
        <div className="flex items-center justify-between border-b border-cream-border pb-3">
          <div>
            <span className="text-xs font-semibold text-neutralText-muted uppercase">{t.bookingId}</span>
            <p className="text-sm font-bold font-mono text-forest">{booking.id.substring(0, 13)}</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-neutralText-muted uppercase">{t.receiptNo}</span>
            <p className="text-sm font-bold font-mono text-forest">
              {receipt?.receipt_no || `HR-${booking.id.substring(0, 6)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-forest">{t.paymentStatus}:</span>
          <Badge status={booking.status} />
        </div>

        {/* Details Table */}
        <div className="bg-cream-light/60 rounded-lg p-3.5 border border-cream-border space-y-2 text-xs sm:text-sm">
          <div className="flex justify-between">
            <span className="text-neutralText-secondary">{t.farmerContact}:</span>
            <span className="font-bold text-forest">
              {booking.farmer_name} ({booking.farmer_phone})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutralText-secondary">{t.machineDetails}:</span>
            <span className="font-bold text-forest">
              {receipt?.machine_type || booking.machine?.model_name || 'Combine Harvester'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutralText-secondary">{t.ownerName}:</span>
            <span className="font-bold text-forest">
              {receipt?.owner_name || booking.machine?.owner_name} ({receipt?.owner_phone || booking.machine?.owner_phone})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutralText-secondary">{t.bookingDate}:</span>
            <span className="font-bold text-forest">{booking.booking_date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutralText-secondary">{t.acresToHarvest}:</span>
            <span className="font-bold text-forest">
              {booking.acres} {t.acresUnit} ({booking.crop})
            </span>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="border-t border-b border-cream-border py-2.5 space-y-1.5 text-sm">
          <div className="flex justify-between text-neutralText-secondary text-xs">
            <span>{t.totalCostEstimate}:</span>
            <span className="font-bold text-forest">₹{booking.total_estimate.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-bold text-forest">{t.paidAmount}:</span>
            <span className="font-black text-forest">₹{booking.advance_amount.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-xs border-t border-dashed border-cream-border pt-1.5">
            <span className="text-neutralText-secondary">{t.balanceDue}:</span>
            <span className="font-bold text-amberGold">₹{balance.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <p className="text-xs text-neutralText-secondary italic bg-cream-light p-2.5 rounded border border-cream-border">
          {t.cashNotice}
        </p>

        {/* Action Buttons */}
        <div className="pt-2 flex gap-2">
          <Button
            variant="primary"
            size="md"
            fullWidth
            onClick={handlePrint}
            icon={<Printer className="w-4 h-4" />}
          >
            {t.printReceipt}
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            {t.closeReceipt}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
