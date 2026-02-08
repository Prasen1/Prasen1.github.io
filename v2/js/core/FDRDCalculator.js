/**
 * Fixed Deposit (FD) and Recurring Deposit (RD) Calculators.
 *
 * FD Formula: A = P * (1 + r/n)^(n*t)
 *   where n = compounding frequency per year.
 *
 * RD uses quarterly compounding on monthly deposits.
 * Standard RD maturity formula:
 *   For each month's deposit, interest is compounded quarterly on the
 *   remaining tenure. The total maturity is the sum of each deposit grown.
 *
 * TDS rules (AY 2025-26):
 *   - Interest > 40,000 (50,000 for seniors): TDS @ 10% if PAN provided, 20% without PAN
 */

import { validateFDInputs } from '../utils/validators.js';
import { roundCurrency } from '../utils/formatters.js';

// ── Compounding frequency mapping ──

const COMPOUNDING_MAP = {
  monthly: 12,
  quarterly: 4,
  'half-yearly': 2,
  yearly: 1,
};

// ── FD Calculator ──

export class FDCalculator {
  /**
   * Calculate FD maturity amount.
   * @param {number} principal - Deposit amount
   * @param {number} annualRate - Annual interest rate (%)
   * @param {number} tenureYears - Tenure in years
   * @param {'monthly'|'quarterly'|'half-yearly'|'yearly'} [compoundingFreq='quarterly']
   * @returns {{ maturityAmount: number, interestEarned: number, effectiveRate: number }}
   */
  calculate(principal, annualRate, tenureYears, compoundingFreq = 'quarterly') {
    const v = validateFDInputs(principal, annualRate, tenureYears);
    if (!v.valid) throw new Error(`Invalid inputs: ${v.errors.join('; ')}`);

    const n = COMPOUNDING_MAP[compoundingFreq];
    if (!n) throw new Error(`Invalid compounding frequency: ${compoundingFreq}. Use: ${Object.keys(COMPOUNDING_MAP).join(', ')}`);

    const r = annualRate / 100;
    const maturity = principal * Math.pow(1 + r / n, n * tenureYears);
    const interest = maturity - principal;

    // Effective annual rate: (1 + r/n)^n - 1
    const effectiveRate = (Math.pow(1 + r / n, n) - 1) * 100;

    return {
      maturityAmount: roundCurrency(maturity),
      interestEarned: roundCurrency(interest),
      effectiveRate: Math.round(effectiveRate * 100) / 100,
    };
  }

  /**
   * Calculate TDS (Tax Deducted at Source) on FD interest.
   * @param {number} interestEarned - Total interest earned in a financial year
   * @param {boolean} [panProvided=true] - Whether PAN is furnished
   * @param {boolean} [isSeniorCitizen=false] - Senior citizen (threshold 50K vs 40K)
   * @returns {{ tdsRate: number, tdsAmount: number, netInterest: number, threshold: number }}
   */
  calculateTDS(interestEarned, panProvided = true, isSeniorCitizen = false) {
    const threshold = isSeniorCitizen ? 50000 : 40000;

    if (interestEarned <= threshold) {
      return {
        tdsRate: 0,
        tdsAmount: 0,
        netInterest: roundCurrency(interestEarned),
        threshold,
      };
    }

    const tdsRate = panProvided ? 10 : 20;
    const tdsAmount = roundCurrency(interestEarned * (tdsRate / 100));
    const netInterest = roundCurrency(interestEarned - tdsAmount);

    return { tdsRate, tdsAmount, netInterest, threshold };
  }
}

// ── RD Calculator ──

export class RDCalculator {
  /**
   * Calculate RD maturity amount.
   * RD uses quarterly compounding on monthly deposits.
   * Each monthly deposit earns compound interest for its remaining tenure.
   *
   * @param {number} monthlyDeposit - Monthly deposit amount
   * @param {number} annualRate - Annual interest rate (%)
   * @param {number} tenureMonths - Tenure in months
   * @returns {{ maturityAmount: number, totalDeposited: number, interestEarned: number }}
   */
  calculate(monthlyDeposit, annualRate, tenureMonths) {
    if (monthlyDeposit <= 0) throw new Error('Monthly deposit must be positive');
    if (annualRate <= 0) throw new Error('Interest rate must be positive');
    if (tenureMonths <= 0 || !Number.isInteger(tenureMonths)) throw new Error('Tenure must be a positive integer (months)');

    const r = annualRate / 100;
    const n = 4; // Quarterly compounding
    const totalDeposited = monthlyDeposit * tenureMonths;

    // Each deposit grows for (tenureMonths - depositMonth + 1) months
    // with quarterly compounding: P * (1 + r/n)^(n * remainingMonths/12)
    let maturity = 0;
    for (let m = 1; m <= tenureMonths; m++) {
      const remainingMonths = tenureMonths - m + 1;
      const remainingYears = remainingMonths / 12;
      maturity += monthlyDeposit * Math.pow(1 + r / n, n * remainingYears);
    }

    const interest = maturity - totalDeposited;

    return {
      maturityAmount: roundCurrency(maturity),
      totalDeposited: roundCurrency(totalDeposited),
      interestEarned: roundCurrency(interest),
    };
  }
}
