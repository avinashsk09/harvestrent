import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Machine } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Modal, Button, Input, Toast } from './ui';

interface ReportListingModalProps {
  machine: Machine | null;
  onClose: () => void;
}

export const ReportListingModal: React.FC<ReportListingModalProps> = ({ machine, onClose }) => {
  const { t } = useLanguage();
  const [reason, setReason] = useState<string>('unreachable');
  const [phone, setPhone] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!machine) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSupabaseConfigured) {
      try {
        await supabase.from('reports').insert({
          machine_id: machine.id,
          reporter_phone: phone.trim() || 'Anonymous',
          reason,
          details: details.trim(),
        });
      } catch (err) {
        console.warn('Report submit notice:', err);
      }
    }

    setLoading(false);
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 2200);
  };

  return (
    <Modal
      isOpen={Boolean(machine)}
      onClose={onClose}
      title={t.reportModalTitle}
      maxWidth="md"
    >
      {submitted ? (
        <div className="py-8 text-center space-y-2.5">
          <CheckCircle2 className="w-12 h-12 text-agri mx-auto" />
          <h4 className="text-base font-bold text-forest">{t.reportSuccess}</h4>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-xs text-neutralText-secondary">
            Reporting listing for: <strong>{machine.model_name || machine.machine_type}</strong> ({machine.village})
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-forest uppercase tracking-wider">
              {t.reportReasonLabel}
            </label>
            <div className="space-y-1.5 text-xs sm:text-sm">
              {[
                { id: 'unreachable', label: t.reportReason1 },
                { id: 'sold_or_unavailable', label: t.reportReason2 },
                { id: 'high_price', label: t.reportReason3 },
                { id: 'wrong_location', label: t.reportReason4 },
              ].map((item) => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-cream-light border border-cream-border cursor-pointer transition-subtle"
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={item.id}
                    checked={reason === item.id}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-4 h-4 text-agri"
                  />
                  <span className="text-neutralText-primary text-xs font-medium">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Input
            label={`${t.phoneLabel} (Optional)`}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t.phonePlaceholder}
          />

          <div>
            <label className="block text-xs font-bold text-forest mb-1">
              Details
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t.reportDetailsPlaceholder}
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-neutralText-primary focus:ring-2 focus:ring-agri focus:border-agri outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              variant="danger"
              size="md"
              fullWidth
              isLoading={loading}
            >
              {t.submitReport}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
            >
              {t.closeReceipt}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
