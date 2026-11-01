import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  getTodayIST,
  buildMonthDays,
  getMonthName,
  getLocalizedWeekdays,
  formatFriendlyDate,
  parseISTDate,
  formatISTDate,
} from '../utils/calendarUtils';
import { MachineBusyDate } from '../types';
import { Button, Card, Toast } from './ui';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar as CalendarIcon,
  AlertCircle,
  Plus,
} from 'lucide-react';

interface AvailabilityCalendarProps {
  machineId: string;
  busyDates: MachineBusyDate[];
  isOwner?: boolean;
  onToggleDate?: (dateStr: string, currentStatus?: 'free' | 'busy' | 'booked') => Promise<void>;
  onBlockRange?: (startDate: string, endDate: string, note?: string) => Promise<void>;
}

export const AvailabilityCalendar: React.FC<AvailabilityCalendarProps> = ({
  machineId,
  busyDates,
  isOwner = false,
  onToggleDate,
  onBlockRange,
}) => {
  const { language, t } = useLanguage();
  const todayStr = getTodayIST();
  const todayDate = parseISTDate(todayStr);

  const [currentYear, setCurrentYear] = useState<number>(todayDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(todayDate.getMonth());

  // Focus tracking for keyboard navigation
  const [focusedDateStr, setFocusedDateStr] = useState<string>(todayStr);
  const gridRef = useRef<HTMLDivElement>(null);

  // Range blocking state
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<string>('');
  const [rangeEnd, setRangeEnd] = useState<string>('');
  const [rangeNote, setRangeNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Month days & weekdays
  const days = buildMonthDays(currentYear, currentMonth);
  const weekdays = getLocalizedWeekdays(language);

  // Map dates of this machine
  const dateMap = new Map<string, { status: 'busy' | 'booked'; note?: string }>();
  busyDates
    .filter((b) => b.machine_id === machineId)
    .forEach((b) => {
      dateMap.set(b.busy_date, {
        status: b.status === 'booked' ? 'booked' : 'busy',
        note: b.note || b.reason,
      });
    });

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Click on a date cell
  const handleDateClick = async (dateStr: string) => {
    if (!isOwner || !onToggleDate || isSubmitting) return;

    if (dateStr < todayStr) {
      showToast('error', t.pastDatesDisabled);
      return;
    }

    const current = dateMap.get(dateStr);
    if (current?.status === 'booked') {
      showToast('error', t.cannotUnblockBooked);
      return;
    }

    setIsSubmitting(true);
    try {
      await onToggleDate(dateStr, current ? current.status : 'free');
      if (current) {
        showToast('success', `${formatFriendlyDate(dateStr, language)}: ${t.dateUnblockedSuccess}`);
      } else {
        showToast('success', `${formatFriendlyDate(dateStr, language)}: ${t.dateBlockedSuccess}`);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update date status');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Range Submission
  const handleRangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rangeStart || !rangeEnd || !onBlockRange || isSubmitting) return;

    if (rangeStart < todayStr || rangeEnd < todayStr) {
      showToast('error', t.pastDatesDisabled);
      return;
    }

    if (rangeEnd < rangeStart) {
      showToast('error', 'End date cannot be earlier than start date.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onBlockRange(rangeStart, rangeEnd, rangeNote.trim() || undefined);
      showToast('success', t.dateRangeBlockedSuccess);
      setRangeStart('');
      setRangeEnd('');
      setRangeNote('');
      setIsRangeMode(false);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to block date range');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation within the calendar grid
  const handleKeyDown = (e: React.KeyboardEvent, dateStr: string) => {
    const curDate = parseISTDate(dateStr);
    let targetDate: Date | null = null;

    if (e.key === 'ArrowRight') {
      targetDate = new Date(curDate);
      targetDate.setDate(curDate.getDate() + 1);
    } else if (e.key === 'ArrowLeft') {
      targetDate = new Date(curDate);
      targetDate.setDate(curDate.getDate() - 1);
    } else if (e.key === 'ArrowDown') {
      targetDate = new Date(curDate);
      targetDate.setDate(curDate.getDate() + 7);
    } else if (e.key === 'ArrowUp') {
      targetDate = new Date(curDate);
      targetDate.setDate(curDate.getDate() - 7);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDateClick(dateStr);
      return;
    }

    if (targetDate) {
      e.preventDefault();
      const newDateStr = formatISTDate(targetDate);
      setFocusedDateStr(newDateStr);

      // Change displayed month if moving out of view
      if (targetDate.getMonth() !== currentMonth || targetDate.getFullYear() !== currentYear) {
        setCurrentMonth(targetDate.getMonth());
        setCurrentYear(targetDate.getFullYear());
      }

      // Move DOM focus
      setTimeout(() => {
        const btn = gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${newDateStr}"]`);
        btn?.focus();
      }, 50);
    }
  };

  return (
    <div className="space-y-4">
      {toastMessage && (
        <Toast type={toastMessage.type} message={toastMessage.text} onClose={() => setToastMessage(null)} />
      )}

      {/* Calendar Header Controls */}
      <div className="flex items-center justify-between bg-cream-light p-3 rounded-lg border border-cream-border">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-forest" />
          <h3 className="font-bold text-forest text-base sm:text-lg">
            {getMonthName(currentYear, currentMonth, language)}
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="p-2 rounded-md hover:bg-cream-dark/50 text-forest transition-subtle min-w-[44px] min-h-[44px] flex items-center justify-center border border-transparent hover:border-cream-border focus:ring-2 focus:ring-agri"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentYear(todayDate.getFullYear());
              setCurrentMonth(todayDate.getMonth());
              setFocusedDateStr(todayStr);
            }}
            className="px-2.5 py-1 text-xs font-bold text-forest hover:bg-white rounded border border-cream-border min-h-[44px] flex items-center justify-center focus:ring-2 focus:ring-agri"
          >
            {t.today}
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="p-2 rounded-md hover:bg-cream-dark/50 text-forest transition-subtle min-w-[44px] min-h-[44px] flex items-center justify-center border border-transparent hover:border-cream-border focus:ring-2 focus:ring-agri"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Owner Help & Range Toggle */}
      {isOwner && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-cream-light/50 p-3 rounded-lg border border-cream-border text-xs">
          <div className="text-neutralText-secondary">
            <span>{t.blockSingleDayHelp}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsRangeMode(!isRangeMode)}
            className="text-agri hover:text-forest font-bold inline-flex items-center gap-1 underline focus:ring-2 focus:ring-agri p-1 rounded"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isRangeMode ? 'Hide Range Tool' : t.blockDateRangeTitle}</span>
          </button>
        </div>
      )}

      {/* Date Range Selection Panel for Owners */}
      {isOwner && isRangeMode && (
        <form onSubmit={handleRangeSubmit} className="p-4 bg-white rounded-lg border-2 border-agri/40 shadow-soft space-y-3">
          <h4 className="font-bold text-forest text-sm flex items-center gap-1.5">
            <CalendarIcon className="w-4 h-4 text-agri" />
            <span>{t.blockDateRangeTitle}</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-forest mb-1">{t.startDateLabel}</label>
              <input
                type="date"
                required
                min={todayStr}
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-forest focus:ring-2 focus:ring-agri min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-forest mb-1">{t.endDateLabel}</label>
              <input
                type="date"
                required
                min={rangeStart || todayStr}
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-forest focus:ring-2 focus:ring-agri min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-forest mb-1">Reason (Max 100 characters)</label>
            <input
              type="text"
              maxLength={100}
              value={rangeNote}
              onChange={(e) => setRangeNote(e.target.value)}
              placeholder={t.blockNotePlaceholder}
              className="w-full px-3 py-2 text-sm rounded-lg border border-cream-border bg-white text-forest focus:ring-2 focus:ring-agri min-h-[44px]"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              {t.blockRangeBtn}
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsRangeMode(false)}>
              {t.cancel}
            </Button>
          </div>
        </form>
      )}

      {/* Weekday Headers: Monday to Sunday */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-forest uppercase tracking-wider pb-1 border-b border-cream-border">
        {weekdays.map((w, idx) => (
          <div key={idx} className="py-1" title={w.full}>
            {w.short}
          </div>
        ))}
      </div>

      {/* Calendar Grid (Min 44px tap target per cell) */}
      <div ref={gridRef} className="grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label={t.availabilityCalendarTitle}>
        {days.map((day) => {
          const match = dateMap.get(day.dateStr);
          const status = match ? match.status : 'free';
          const isBusy = status === 'busy';
          const isBooked = status === 'booked';
          const isFree = status === 'free';

          const statusLabel = isBooked
            ? t.availabilityLegendBooked
            : isBusy
              ? t.availabilityLegendBusy
              : t.availabilityLegendFree;

          return (
            <button
              key={day.dateStr}
              type="button"
              data-date={day.dateStr}
              disabled={!isOwner && day.isPast}
              onClick={() => handleDateClick(day.dateStr)}
              onKeyDown={(e) => handleKeyDown(e, day.dateStr)}
              tabIndex={day.dateStr === focusedDateStr ? 0 : -1}
              aria-label={`${formatFriendlyDate(day.dateStr, language)}, ${statusLabel}${match?.note ? `, ${match.note}` : ''
                }`}
              className={`
                relative p-1 sm:p-1.5 rounded-lg border text-left transition-subtle flex flex-col justify-between
                min-h-[48px] sm:min-h-[54px] min-w-[44px]
                focus:outline-none focus:ring-2 focus:ring-agri focus:z-10
                ${!day.isCurrentMonth ? 'opacity-40 bg-cream/40' : ''}
                ${day.isPast ? 'opacity-50 cursor-not-allowed bg-cream-dark/30 border-cream-border' : ''}
                ${day.isToday
                  ? 'ring-2 ring-forest font-black'
                  : ''
                }
                ${isBooked
                  ? 'bg-amber-100 border-amber-300 text-amber-900 cursor-not-allowed'
                  : isBusy
                    ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
                    : 'bg-white hover:bg-agri-light/40 border-cream-border text-forest'
                }
              `}
            >
              {/* Day Number & Today indicator */}
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-xs sm:text-sm font-bold ${day.isToday ? 'bg-forest text-white px-1.5 py-0.5 rounded-full' : ''
                    }`}
                >
                  {day.dayNumber}
                </span>

                {/* Status Indicator Icon (Accessibility for Color Blindness) */}
                <span title={statusLabel}>
                  {isBooked ? (
                    <Clock className="w-3.5 h-3.5 text-amber-700" />
                  ) : isBusy ? (
                    <XCircle className="w-3.5 h-3.5 text-neutral-600" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-agri/70" />
                  )}
                </span>
              </div>

              {/* Status Label & Note */}
              <div className="truncate w-full mt-0.5">
                <span
                  className={`text-[9px] sm:text-[10px] font-semibold uppercase block truncate ${isBooked
                      ? 'text-amber-800'
                      : isBusy
                        ? 'text-neutral-600'
                        : 'text-agri'
                    }`}
                >
                  {isBooked ? 'Booked' : isBusy ? 'Busy' : 'Free'}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend: Free, Busy, Booked (Color-blind accessible with text and icons) */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 pt-2 border-t border-cream-border text-xs text-forest">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-cream-border bg-white flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-agri" />
          </div>
          <span className="font-semibold">{t.availabilityLegendFree}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-neutral-300 bg-neutral-100 flex items-center justify-center">
            <XCircle className="w-3 h-3 text-neutral-600" />
          </div>
          <span className="font-semibold">{t.availabilityLegendBusy}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded border border-amber-300 bg-amber-100 flex items-center justify-center">
            <Clock className="w-3 h-3 text-amber-700" />
          </div>
          <span className="font-semibold">{t.availabilityLegendBooked}</span>
        </div>
      </div>
    </div>
  );
};
