import { PriceUnit } from '../types';

export interface PriceEstimateResult {
  hasFixedEstimate: boolean;
  estimatedTotal: number;
  unitPrice: number;
  unit: PriceUnit;
  advanceAmount: number;
  displayPrice: string;
  displayEstimate: string;
  explanation: string;
}

export function calculateHonestPrice(
  priceAmount: number,
  priceUnit: PriceUnit,
  acres: number = 1
): PriceEstimateResult {
  const safeAcres = Math.max(0.5, Number(acres) || 1);

  if (priceUnit === 'per_acre') {
    const total = Math.round(priceAmount * safeAcres);
    // 20% advance token to hold booking (min ₹500)
    const advance = Math.max(500, Math.round(total * 0.20));

    return {
      hasFixedEstimate: true,
      estimatedTotal: total,
      unitPrice: priceAmount,
      unit: priceUnit,
      advanceAmount: advance,
      displayPrice: `₹${priceAmount.toLocaleString('en-IN')} / acre`,
      displayEstimate: `₹${total.toLocaleString('en-IN')} (${safeAcres} acres × ₹${priceAmount})`,
      explanation: 'Calculated directly: acres × per-acre price.',
    };
  }

  if (priceUnit === 'per_hour') {
    // For per-hour, NEVER guess total hours; show unit price with honest explanation
    return {
      hasFixedEstimate: false,
      estimatedTotal: priceAmount, // Base single unit reference
      unitPrice: priceAmount,
      unit: priceUnit,
      advanceAmount: 1000, // Fixed advance token for hourly machine booking
      displayPrice: `₹${priceAmount.toLocaleString('en-IN')} / hour`,
      displayEstimate: `₹${priceAmount.toLocaleString('en-IN')} / hour (Meter basis)`,
      explanation: 'Total cost depends on machine operating hours. Pay advance ₹1,000 now; balance based on final meter runtime.',
    };
  }

  // priceUnit === 'per_day'
  return {
    hasFixedEstimate: false,
    estimatedTotal: priceAmount,
    unitPrice: priceAmount,
    unit: priceUnit,
    advanceAmount: 2000, // Fixed advance token for full day booking
    displayPrice: `₹${priceAmount.toLocaleString('en-IN')} / day`,
    displayEstimate: `₹${priceAmount.toLocaleString('en-IN')} / day (Full day)`,
    explanation: 'Total cost depends on number of work days. Pay advance ₹2,000 now; balance upon harvest completion.',
  };
}

