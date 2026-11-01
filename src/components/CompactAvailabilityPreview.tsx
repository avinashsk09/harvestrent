import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { MachineBusyDate } from '../types';
import { findNearestFreeDate, formatFriendlyDate, getTodayIST } from '../utils/calendarUtils';
import { Calendar, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { AvailabilityCalendar } from './AvailabilityCalendar';

interface CompactAvailabilityPreviewProps {
  machineId: string;
  busyDates: MachineBusyDate[];
  selectedDate?: string;
}

export const CompactAvailabilityPreview: React.FC<CompactAvailabilityPreviewProps> = ({
  machineId,
  busyDates,
  selectedDate,
}) => {
  const { language, t } = useLanguage();
  const [showFullCalendar, setShowFullCalendar] = useState(false);
  const todayStr = getTodayIST();

  const machineDates = busyDates.filter((b) => b.machine_id === machineId);
  const blockedDatesSet = new Set(machineDates.map((b) => b.busy_date));

  // Determine availability status
  let isTargetDateBusy = false;
  let isTargetDateBooked = false;

  if (selectedDate && selectedDate >= todayStr) {
    const matched = machineDates.find((b) => b.busy_date === selectedDate);
    if (matched) {
      if (matched.status === 'booked') isTargetDateBooked = true;
      else isTargetDateBusy = true;
    }
  }

  // Nearest free date
  const nearestFree = findNearestFreeDate(
    machineId,
    machineDates,
    selectedDate && selectedDate >= todayStr ? selectedDate : todayStr
  );

  return (
    <div className="space-y-2">
      {/* Availability Status Badge & Text */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 rounded-lg border text-xs bg-cream-light/60 border-cream-border">
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedDate && selectedDate >= todayStr ? (
            isTargetDateBusy || isTargetDateBooked ? (
              <span className="inline-flex items-center gap-1 font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>
                  {t.busyOnYourDate} ({formatFriendlyDate(selectedDate, language)}).{' '}
                  {nearestFree ? `${t.suggestedFreeDate} ${formatFriendlyDate(nearestFree, language)}` : ''}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-green-900 bg-green-100 border border-green-200 px-2 py-0.5 rounded">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-700" />
                <span>
                  {t.freeOnDate} {formatFriendlyDate(selectedDate, language)}
                </span>
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-forest">
              <Calendar className="w-3.5 h-3.5 text-agri" />
              <span>
                {t.nextFreeDatePrefix}{' '}
                <strong>
                  {nearestFree ? formatFriendlyDate(nearestFree, language) : 'Check with owner'}
                </strong>
              </span>
            </span>
          )}
        </div>

        {/* Toggle Expandable Calendar */}
        <button
          type="button"
          onClick={() => setShowFullCalendar(!showFullCalendar)}
          className="text-[11px] font-bold text-agri hover:text-forest underline inline-flex items-center gap-0.5 self-start sm:self-auto p-0.5"
        >
          <span>{showFullCalendar ? 'Hide Calendar' : '60-Day Calendar'}</span>
          {showFullCalendar ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Expanded Read-Only Calendar */}
      {showFullCalendar && (
        <div className="p-3 bg-white rounded-lg border border-cream-border shadow-soft">
          <AvailabilityCalendar machineId={machineId} busyDates={busyDates} isOwner={false} />
        </div>
      )}
    </div>
  );
};

