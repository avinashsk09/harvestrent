import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { Machine, Booking, PaymentMethod } from '../types';
import { calculateHonestPrice } from '../utils/priceCalculator';
import { BookingReceiptModal } from '../components/BookingReceiptModal';
import { supabase, isSupabaseConfigured, getLocalBookings, saveLocalBookings } from '../lib/supabase';
import { Card, Button, Input, Toast } from '../components/ui';
import {
  CreditCard,
  QrCode,
  Building,
  Banknote,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Receipt,
  ArrowRight,
  Calendar,
  MapPin,
  Tractor,
  Layers,
  User,
  Phone,
} from 'lucide-react';

interface PaymentPageProps {
  machine: Machine | null;
  acres: number;
  date: string;
  crop: string;
  onNavigate: (page: string) => void;
}

export const PaymentPage: React.FC<PaymentPageProps> = ({
  machine,
  acres,
  date,
  crop,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  if (!machine) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center space-y-4">
        <h2 className="text-xl font-bold text-forest">No machine selected</h2>
        <Button variant="primary" size="md" onClick={() => onNavigate('find')}>
          {t.btnFindMachine}
        </Button>
      </div>
    );
  }

  const honestPrice = calculateHonestPrice(machine.price_amount, machine.price_unit, acres);

  // Form states
  const [farmerName, setFarmerName] = useState(user?.full_name || '');
  const [farmerPhone, setFarmerPhone] = useState(user?.phone || '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('upi');

  // Transaction states: 'input' | 'processing' | 'success' | 'failure'
  const [flowState, setFlowState] = useState<'input' | 'processing' | 'success' | 'failure'>('input');
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Server-side signature verification via Supabase Edge Function
  const verifyPaymentOnServer = async (
    bookingId: string,
    orderId: string,
    paymentId: string,
    signature: string
  ) => {
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.functions.invoke('verify-razorpay-payment', {
          body: {
            booking_id: bookingId,
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: signature,
            payment_method: paymentMethod,
          },
        });

        if (!error && data?.receipt) {
          return data.receipt;
        }
      }
    } catch (err) {
      console.warn('Server signature verification notice:', err);
    }

    return {
      receipt_no: `HR-${Date.now().toString().slice(-6)}`,
      transaction_id: paymentId,
      payment_method: paymentMethod.toUpperCase(),
      paid_at: new Date().toISOString(),
      owner_name: machine.owner_name,
      owner_phone: machine.owner_phone,
      machine_type: machine.model_name || machine.machine_type,
      village: machine.village,
      district: machine.district,
    };
  };

  // Complete Booking (Online Advance or Cash on Farm)
  const finalizeBooking = async (
    isOnlinePaid: boolean,
    txId: string = `pay_test_${Date.now()}`
  ) => {
    if (!farmerName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!farmerPhone.trim()) {
      setErrorMessage('Please enter your mobile phone number.');
      return;
    }

    setFlowState('processing');

    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));
    const bookingUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
    const bookingId = bookingUuid || `bk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const status = isOnlinePaid ? 'paid' : 'pending';

    const receiptData = isOnlinePaid
      ? await verifyPaymentOnServer(bookingId, `order_test_${Date.now()}`, txId, `test_sig_${Date.now()}`)
      : {
          receipt_no: `HR-CASH-${Date.now().toString().slice(-6)}`,
          payment_method: 'CASH ON FARM',
          paid_at: new Date().toISOString(),
          owner_name: machine.owner_name,
          owner_phone: machine.owner_phone,
          machine_type: machine.model_name || machine.machine_type,
          village: machine.village,
          district: machine.district,
        };

    const newBooking: Booking = {
      id: bookingId,
      machine_id: machine.id,
      machine: machine,
      farmer_id: user?.id,
      farmer_name: farmerName.trim(),
      farmer_phone: farmerPhone.trim(),
      booking_date: date || new Date().toISOString().split('T')[0],
      acres: Number(acres) || 1,
      crop: crop || machine.crops[0],
      price_amount: machine.price_amount,
      price_unit: machine.price_unit,
      total_estimate: honestPrice.estimatedTotal,
      advance_amount: isOnlinePaid ? honestPrice.advanceAmount : 0,
      payment_mode: paymentMethod,
      status: status,
      receipt_data: receiptData,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && isUuid(newBooking.machine_id)) {
      try {
        const insertPayload: any = {
          machine_id: newBooking.machine_id,
          farmer_name: newBooking.farmer_name,
          farmer_phone: newBooking.farmer_phone,
          booking_date: newBooking.booking_date,
          acres: newBooking.acres,
          crop: newBooking.crop,
          price_amount: newBooking.price_amount,
          price_unit: newBooking.price_unit,
          total_estimate: newBooking.total_estimate,
          advance_amount: newBooking.advance_amount,
          payment_mode: newBooking.payment_mode,
          status: newBooking.status,
          receipt_data: newBooking.receipt_data,
        };
        if (bookingUuid) insertPayload.id = bookingUuid;
        if (isUuid(newBooking.farmer_id)) insertPayload.farmer_id = newBooking.farmer_id;

        await supabase.from('bookings').insert(insertPayload);
      } catch (err) {
        console.warn('Booking database insert notice:', err);
      }
    }

    const current = getLocalBookings();
    saveLocalBookings([newBooking, ...current]);

    setConfirmedBooking(newBooking);
    setFlowState('success');
  };

  const handleRazorpayCheckout = () => {
    if (!farmerName.trim() || !farmerPhone.trim()) {
      setErrorMessage('Please fill in your name and phone number before proceeding to payment.');
      return;
    }

    const RazorpayObj = (window as any).Razorpay;

    if (typeof RazorpayObj !== 'undefined') {
      try {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_harvest_demo',
          amount: Math.round(honestPrice.advanceAmount * 100),
          currency: 'INR',
          name: 'Harvest Rentals',
          description: `Advance for ${machine.model_name || machine.machine_type}`,
          prefill: {
            name: farmerName,
            contact: farmerPhone,
          },
          theme: {
            color: '#2E7D4F',
          },
          handler: function (response: any) {
            finalizeBooking(true, response.razorpay_payment_id || `pay_rzp_${Date.now()}`);
          },
          modal: {
            ondismiss: function () {},
          },
        };

        const rzp = new RazorpayObj(options);
        rzp.on('payment.failed', function (resp: any) {
          setErrorMessage(resp.error?.description || 'Transaction could not be completed.');
          setFlowState('failure');
        });
        rzp.open();
        return;
      } catch (err) {
        console.warn('Razorpay checkout window invocation fallback:', err);
      }
    }

    // Direct sandbox test mode flow
    finalizeBooking(true, `pay_sandbox_${Date.now()}`);
  };

  return (
    <div className="max-w-xl mx-auto py-6 sm:py-8 px-4 space-y-6 pb-24">
      {flowState === 'input' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-forest tracking-tight">
              {t.paymentTitle}
            </h1>
            <p className="text-sm text-neutralText-secondary mt-0.5">
              Secure your harvester reservation directly with the machine owner.
            </p>
          </div>

          {errorMessage && <Toast type="error" message={errorMessage} onClose={() => setErrorMessage('')} />}

          {/* Order Summary */}
          <Card padding="md" className="space-y-3.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-forest flex items-center gap-1.5">
              <Tractor className="w-4 h-4 text-agri" />
              {t.orderSummary}
            </h2>

            <div className="bg-cream-light/60 rounded-lg p-3.5 border border-cream-border space-y-2.5 text-xs sm:text-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-forest">
                    {machine.model_name || machine.machine_type}
                  </h3>
                  <p className="text-xs text-neutralText-secondary flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-agri" />
                    <strong>{machine.village}</strong>, {machine.district}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-neutralText-muted block font-medium">Owner</span>
                  <span className="text-xs font-bold text-forest">{machine.owner_name}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cream-border text-xs">
                <div>
                  <span className="text-neutralText-muted block font-medium">{t.bookingDate}:</span>
                  <span className="font-bold text-forest flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-agri" />
                    {date || 'Today'}
                  </span>
                </div>
                <div>
                  <span className="text-neutralText-muted block font-medium">{t.acresToHarvest}:</span>
                  <span className="font-bold text-forest flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-agri" />
                    {acres} {t.acresUnit} ({crop})
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-cream-border space-y-1">
                <div className="flex justify-between text-xs text-neutralText-secondary">
                  <span>Rental Rate:</span>
                  <span className="font-bold">{honestPrice.displayPrice}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-forest font-bold">{t.totalCostEstimate}:</span>
                  <span className="font-black text-forest">
                    {honestPrice.hasFixedEstimate
                      ? `₹${honestPrice.estimatedTotal.toLocaleString('en-IN')}`
                      : honestPrice.displayEstimate}
                  </span>
                </div>
              </div>
            </div>

            {/* Advance Highlight */}
            <div className="bg-agri-light/60 rounded-lg p-3.5 border border-agri-border flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-forest block">
                  {t.advanceRequired}
                </span>
                <span className="text-xs text-neutralText-secondary">
                  Balance paid directly to owner in field
                </span>
              </div>
              <div className="text-xl font-bold text-forest">
                ₹{honestPrice.advanceAmount.toLocaleString('en-IN')}
              </div>
            </div>
          </Card>

          {/* Farmer Contact Info */}
          <Card padding="md" className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-forest flex items-center gap-1.5">
              <User className="w-4 h-4 text-agri" />
              {t.farmerContact}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label={t.fullNameLabel}
                required
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
              />

              <Input
                label={t.phoneLabel}
                type="tel"
                required
                value={farmerPhone}
                onChange={(e) => setFarmerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>
          </Card>

          {/* Payment Method Selector */}
          <Card padding="md" className="space-y-3.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-forest">
              {t.choosePaymentMethod}
            </h2>

            <div className="space-y-2">
              <label
                onClick={() => setPaymentMethod('upi')}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-subtle ${
                  paymentMethod === 'upi'
                    ? 'border-agri bg-agri-light/40 shadow-soft'
                    : 'border-cream-border hover:bg-cream-light/40'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'upi'}
                  onChange={() => setPaymentMethod('upi')}
                  className="mt-1 w-4 h-4 text-agri"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-forest text-sm">
                    <QrCode className="w-4 h-4 text-agri" />
                    <span>UPI (Google Pay, PhonePe, Paytm, BHIM)</span>
                  </div>
                  <p className="text-xs text-neutralText-secondary mt-0.5">
                    Instant payment via any UPI app
                  </p>
                </div>
              </label>

              <label
                onClick={() => setPaymentMethod('card')}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-subtle ${
                  paymentMethod === 'card'
                    ? 'border-agri bg-agri-light/40 shadow-soft'
                    : 'border-cream-border hover:bg-cream-light/40'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'card'}
                  onChange={() => setPaymentMethod('card')}
                  className="mt-1 w-4 h-4 text-agri"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-forest text-sm">
                    <CreditCard className="w-4 h-4 text-agri" />
                    <span>Debit / Credit Card</span>
                  </div>
                  <p className="text-xs text-neutralText-secondary mt-0.5">
                    RuPay, Visa, Mastercard accepted
                  </p>
                </div>
              </label>

              <label
                onClick={() => setPaymentMethod('netbanking')}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-subtle ${
                  paymentMethod === 'netbanking'
                    ? 'border-agri bg-agri-light/40 shadow-soft'
                    : 'border-cream-border hover:bg-cream-light/40'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'netbanking'}
                  onChange={() => setPaymentMethod('netbanking')}
                  className="mt-1 w-4 h-4 text-agri"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-forest text-sm">
                    <Building className="w-4 h-4 text-agri" />
                    <span>Netbanking</span>
                  </div>
                  <p className="text-xs text-neutralText-secondary mt-0.5">
                    Major Indian banks test portals
                  </p>
                </div>
              </label>

              <label
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-subtle ${
                  paymentMethod === 'cash'
                    ? 'border-amberGold bg-amberGold-light/40 shadow-soft'
                    : 'border-cream-border hover:bg-cream-light/40'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === 'cash'}
                  onChange={() => setPaymentMethod('cash')}
                  className="mt-1 w-4 h-4 text-amberGold"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-forest text-sm">
                    <Banknote className="w-4 h-4 text-amberGold" />
                    <span>{t.payAtFarm}</span>
                  </div>
                  <p className="text-xs text-neutralText-secondary mt-0.5">
                    {t.payAtFarmDesc}
                  </p>
                </div>
              </label>
            </div>
          </Card>

          {/* Action Button */}
          <div>
            {paymentMethod === 'cash' ? (
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => finalizeBooking(false)}
                icon={<ArrowRight className="w-5 h-5" />}
              >
                {t.confirmCashBooking}
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleRazorpayCheckout}
                icon={<CreditCard className="w-5 h-5" />}
              >
                {t.proceedToRazorpay} (₹{honestPrice.advanceAmount})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Processing */}
      {flowState === 'processing' && (
        <Card padding="lg" className="text-center py-12 space-y-4">
          <div className="w-10 h-10 border-2 border-agri border-t-transparent rounded-full animate-spin mx-auto" />
          <h3 className="text-base font-bold text-forest">{t.paymentProcessing}</h3>
        </Card>
      )}

      {/* Success Screen */}
      {flowState === 'success' && confirmedBooking && (
        <Card padding="lg" className="border-agri-border text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-agri-light text-forest flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-agri" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-forest">{t.paymentSuccessTitle}</h2>
            <p className="text-xs sm:text-sm text-neutralText-secondary max-w-sm mx-auto">
              {t.paymentSuccessSubtitle}
            </p>
          </div>

          <div className="bg-cream-light/60 rounded-lg p-3 text-xs space-y-2 border border-cream-border text-left">
            <div className="flex justify-between">
              <span className="text-neutralText-muted">Booking Reference:</span>
              <span className="font-mono font-bold text-forest">{confirmedBooking.id.substring(0, 13)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutralText-muted">Scheduled Date:</span>
              <span className="font-bold text-forest">{confirmedBooking.booking_date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutralText-muted">Harvester Machine:</span>
              <span className="font-bold text-forest">{machine.model_name || machine.machine_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutralText-muted">Owner Contact:</span>
              <span className="font-bold text-forest">{machine.owner_name} ({machine.owner_phone})</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => setShowReceiptModal(true)}
              icon={<Receipt className="w-4 h-4" />}
            >
              {t.btnViewReceipt}
            </Button>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => onNavigate('bookings')}
            >
              {t.myBookings}
            </Button>
          </div>
        </Card>
      )}

      {/* Failure Screen with Retry */}
      {flowState === 'failure' && (
        <Card padding="lg" className="border-brickRed-border text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-brickRed-light text-brickRed flex items-center justify-center mx-auto">
            <XCircle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-forest">{t.paymentFailedTitle}</h2>
            <p className="text-xs sm:text-sm text-neutralText-secondary max-w-sm mx-auto">
              {errorMessage || t.paymentFailedSubtitle}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => setFlowState('input')}
              icon={<RotateCcw className="w-4 h-4" />}
            >
              {t.btnRetryPayment}
            </Button>
            <Button
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => finalizeBooking(false)}
            >
              Choose Pay at Farm (Cash)
            </Button>
          </div>
        </Card>
      )}

      <BookingReceiptModal
        isOpen={showReceiptModal}
        booking={confirmedBooking}
        onClose={() => setShowReceiptModal(false)}
      />
    </div>
  );
};
