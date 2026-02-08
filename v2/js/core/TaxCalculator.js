/**
 * Indian Income Tax Calculator (AY 2025-26).
 *
 * Supports Old Regime and New Regime, with standard deduction,
 * Section 80C/80D/80CCD, HRA exemption, surcharge, and 4% Health & Education Cess.
 *
 * Old Regime slabs:
 *   0 - 2,50,000    : 0%
 *   2,50,001 - 5,00,000  : 5%
 *   5,00,001 - 10,00,000 : 20%
 *   > 10,00,000          : 30%
 *   Standard deduction: 50,000
 *
 * New Regime slabs (Budget 2024, applicable AY 2025-26):
 *   0 - 3,00,000    : 0%
 *   3,00,001 - 7,00,000  : 5%
 *   7,00,001 - 10,00,000 : 10%
 *   10,00,001 - 12,00,000: 15%
 *   12,00,001 - 15,00,000: 20%
 *   > 15,00,000          : 30%
 *   Standard deduction: 75,000
 *
 * Surcharge on income tax:
 *   50L-1Cr  : 10%
 *   1Cr-2Cr  : 15%
 *   2Cr-5Cr  : 25%
 *   > 5Cr    : 37% (old) / 25% (new, capped)
 *
 * Health & Education Cess: 4% on (tax + surcharge)
 */

import { validateTaxInputs } from '../utils/validators.js';
import { roundCurrency } from '../utils/formatters.js';

// ── Slab definitions ──

const OLD_SLABS = [
  { min: 0, max: 250000, rate: 0 },
  { min: 250000, max: 500000, rate: 5 },
  { min: 500000, max: 1000000, rate: 20 },
  { min: 1000000, max: Infinity, rate: 30 },
];

const NEW_SLABS = [
  { min: 0, max: 300000, rate: 0 },
  { min: 300000, max: 700000, rate: 5 },
  { min: 700000, max: 1000000, rate: 10 },
  { min: 1000000, max: 1200000, rate: 15 },
  { min: 1200000, max: 1500000, rate: 20 },
  { min: 1500000, max: Infinity, rate: 30 },
];

const OLD_STANDARD_DEDUCTION = 50000;
const NEW_STANDARD_DEDUCTION = 75000;
const CESS_RATE = 0.04;

// Section 80C cap
const SEC_80C_MAX = 150000;
// Section 80D caps: self 25K (50K for senior), parents 25K (50K if senior)
const SEC_80D_MAX_SELF = 25000;
const SEC_80D_MAX_SENIOR = 50000;
// Section 80CCD(1B) additional NPS
const SEC_80CCD_1B_MAX = 50000;

export class TaxCalculator {
  /**
   * Calculate tax under the Old Regime.
   * @param {number} grossIncome - Gross annual income
   * @param {Object} [deductions={}] - Deduction amounts
   * @param {number} [deductions.sec80C=0] - Section 80C (max 1.5L)
   * @param {number} [deductions.sec80D=0] - Section 80D medical insurance
   * @param {number} [deductions.sec80CCD=0] - Section 80CCD(1B) NPS (max 50K)
   * @param {number} [deductions.hra=0] - HRA exemption (pre-calculated or use calculateHRA)
   * @param {number} [deductions.otherExemptions=0] - LTA, professional tax, etc.
   * @returns {{ grossIncome: number, taxableIncome: number, taxBeforeCess: number, cess: number, totalTax: number, effectiveRate: number, slabBreakdown: Array }}
   */
  calculateOldRegime(grossIncome, deductions = {}) {
    const v = validateTaxInputs(grossIncome);
    if (!v.valid) throw new Error(`Invalid inputs: ${v.errors.join('; ')}`);

    const d = {
      sec80C: Math.min(deductions.sec80C || 0, SEC_80C_MAX),
      sec80D: Math.min(deductions.sec80D || 0, SEC_80D_MAX_SENIOR), // allow up to senior limit
      sec80CCD: Math.min(deductions.sec80CCD || 0, SEC_80CCD_1B_MAX),
      hra: deductions.hra || 0,
      otherExemptions: deductions.otherExemptions || 0,
    };

    const totalDeductions =
      OLD_STANDARD_DEDUCTION + d.sec80C + d.sec80D + d.sec80CCD + d.hra + d.otherExemptions;

    const taxableIncome = Math.max(grossIncome - totalDeductions, 0);
    const { tax: baseTax, breakdown } = this._computeSlabTax(taxableIncome, OLD_SLABS);

    // Rebate u/s 87A: if taxable income <= 5L, rebate up to 12,500
    let rebate = 0;
    if (taxableIncome <= 500000) {
      rebate = Math.min(baseTax, 12500);
    }

    const taxAfterRebate = baseTax - rebate;
    const surcharge = this._computeSurcharge(taxAfterRebate, grossIncome, 'old');
    const taxBeforeCess = taxAfterRebate + surcharge;
    const cess = roundCurrency(taxBeforeCess * CESS_RATE);
    const totalTax = roundCurrency(taxBeforeCess + cess);
    const effectiveRate = grossIncome > 0 ? Math.round((totalTax / grossIncome) * 10000) / 100 : 0;

    return {
      regime: 'old',
      grossIncome: roundCurrency(grossIncome),
      totalDeductions: roundCurrency(totalDeductions),
      taxableIncome: roundCurrency(taxableIncome),
      baseTax: roundCurrency(baseTax),
      rebate: roundCurrency(rebate),
      surcharge: roundCurrency(surcharge),
      cess,
      totalTax,
      effectiveRate,
      slabBreakdown: breakdown,
    };
  }

  /**
   * Calculate tax under the New Regime.
   * Limited deductions allowed (standard deduction only).
   * @param {number} grossIncome - Gross annual income
   * @returns {{ grossIncome: number, taxableIncome: number, taxBeforeCess: number, cess: number, totalTax: number, effectiveRate: number, slabBreakdown: Array }}
   */
  calculateNewRegime(grossIncome) {
    const v = validateTaxInputs(grossIncome);
    if (!v.valid) throw new Error(`Invalid inputs: ${v.errors.join('; ')}`);

    const taxableIncome = Math.max(grossIncome - NEW_STANDARD_DEDUCTION, 0);
    const { tax: baseTax, breakdown } = this._computeSlabTax(taxableIncome, NEW_SLABS);

    // Rebate u/s 87A in new regime: if taxable income <= 7L, rebate up to 25,000
    let rebate = 0;
    if (taxableIncome <= 700000) {
      rebate = Math.min(baseTax, 25000);
    }

    const taxAfterRebate = baseTax - rebate;
    const surcharge = this._computeSurcharge(taxAfterRebate, grossIncome, 'new');
    const taxBeforeCess = taxAfterRebate + surcharge;
    const cess = roundCurrency(taxBeforeCess * CESS_RATE);
    const totalTax = roundCurrency(taxBeforeCess + cess);
    const effectiveRate = grossIncome > 0 ? Math.round((totalTax / grossIncome) * 10000) / 100 : 0;

    return {
      regime: 'new',
      grossIncome: roundCurrency(grossIncome),
      totalDeductions: roundCurrency(NEW_STANDARD_DEDUCTION),
      taxableIncome: roundCurrency(taxableIncome),
      baseTax: roundCurrency(baseTax),
      rebate: roundCurrency(rebate),
      surcharge: roundCurrency(surcharge),
      cess,
      totalTax,
      effectiveRate,
      slabBreakdown: breakdown,
    };
  }

  /**
   * Compare both regimes and recommend the beneficial one.
   * @param {number} grossIncome
   * @param {Object} [deductions={}]
   * @returns {{ oldTax: number, newTax: number, savings: number, recommendation: string, oldResult: Object, newResult: Object }}
   */
  compare(grossIncome, deductions = {}) {
    const oldResult = this.calculateOldRegime(grossIncome, deductions);
    const newResult = this.calculateNewRegime(grossIncome);

    const savings = roundCurrency(Math.abs(oldResult.totalTax - newResult.totalTax));
    const recommendation =
      oldResult.totalTax <= newResult.totalTax
        ? 'Old Regime is beneficial'
        : 'New Regime is beneficial';

    return {
      oldTax: oldResult.totalTax,
      newTax: newResult.totalTax,
      savings,
      recommendation,
      oldResult,
      newResult,
    };
  }

  /**
   * Calculate HRA exemption.
   * Least of:
   *   1. Actual HRA received
   *   2. 50% of basic (metro) or 40% (non-metro)
   *   3. Rent paid - 10% of basic
   * @param {number} basicSalary - Annual basic salary
   * @param {number} hra - Annual HRA received
   * @param {number} rentPaid - Annual rent paid
   * @param {boolean} [isMetro=false] - Whether city is metro (Delhi, Mumbai, Chennai, Kolkata)
   * @returns {{ exemption: number, breakdown: Object }}
   */
  calculateHRA(basicSalary, hra, rentPaid, isMetro = false) {
    if (basicSalary <= 0 || hra <= 0 || rentPaid <= 0) {
      return { exemption: 0, breakdown: { actualHRA: hra, salaryPercent: 0, rentMinusBasic: 0 } };
    }

    const salaryPercent = isMetro ? basicSalary * 0.5 : basicSalary * 0.4;
    const rentMinusBasic = Math.max(rentPaid - basicSalary * 0.1, 0);

    const exemption = roundCurrency(Math.min(hra, salaryPercent, rentMinusBasic));

    return {
      exemption,
      breakdown: {
        actualHRA: roundCurrency(hra),
        salaryPercent: roundCurrency(salaryPercent),
        rentMinusBasic: roundCurrency(rentMinusBasic),
      },
    };
  }

  // ── Private helpers ──

  /** @private */
  _computeSlabTax(taxableIncome, slabs) {
    let remaining = taxableIncome;
    let tax = 0;
    const breakdown = [];

    for (const slab of slabs) {
      if (remaining <= 0) break;
      const slabWidth = slab.max === Infinity ? remaining : Math.min(slab.max - slab.min, remaining);
      const taxForSlab = slabWidth * (slab.rate / 100);

      breakdown.push({
        slab: slab.max === Infinity ? `Above ${this._formatLakh(slab.min)}` : `${this._formatLakh(slab.min)} - ${this._formatLakh(slab.max)}`,
        rate: slab.rate,
        taxableAmount: roundCurrency(slabWidth),
        tax: roundCurrency(taxForSlab),
      });

      tax += taxForSlab;
      remaining -= slabWidth;
    }

    return { tax: roundCurrency(tax), breakdown };
  }

  /** @private */
  _computeSurcharge(tax, grossIncome, regime) {
    if (grossIncome <= 5000000) return 0;

    let rate = 0;
    if (grossIncome <= 10000000) rate = 10;
    else if (grossIncome <= 20000000) rate = 15;
    else if (grossIncome <= 50000000) rate = 25;
    else rate = regime === 'new' ? 25 : 37; // New regime caps at 25%

    return roundCurrency(tax * (rate / 100));
  }

  /** @private */
  _formatLakh(amount) {
    if (amount >= 10000000) return (amount / 10000000).toFixed(1) + 'Cr';
    if (amount >= 100000) return (amount / 100000).toFixed(1) + 'L';
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K';
    return String(amount);
  }
}
