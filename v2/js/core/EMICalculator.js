/**
 * Simple EMI Calculator.
 * Provides standalone EMI computation, affordability analysis,
 * tenure estimation, max-loan estimation, and full amortization breakdown.
 *
 * EMI Formula: P * r * (1+r)^n / ((1+r)^n - 1)
 * When rate is 0%, EMI = P / n.
 */

import { validateLoanInputs } from '../utils/validators.js';
import { roundCurrency } from '../utils/formatters.js';

export class EMICalculator {
  /**
   * Calculate EMI and summary totals.
   * @param {number} principal - Loan amount
   * @param {number} annualRate - Annual interest rate percentage (e.g. 8.5)
   * @param {number} tenureMonths - Tenure in months
   * @returns {{ emi: number, totalInterest: number, totalPayment: number }}
   */
  calculateEMI(principal, annualRate, tenureMonths) {
    const v = validateLoanInputs(principal, annualRate, tenureMonths);
    if (!v.valid) throw new Error(`Invalid inputs: ${v.errors.join('; ')}`);

    const emi = this._emi(principal, annualRate, tenureMonths);
    const totalPayment = roundCurrency(emi * tenureMonths);
    const totalInterest = roundCurrency(totalPayment - principal);

    return {
      emi: roundCurrency(emi),
      totalInterest,
      totalPayment,
    };
  }

  /**
   * Calculate maximum loan a borrower can afford.
   * Uses the rule that total EMIs (existing + new) must not exceed
   * maxEMIPercent of monthly income.
   * @param {number} monthlyIncome - Gross monthly income
   * @param {number} existingEMIs - Sum of all current EMI obligations
   * @param {number} maxEMIPercent - Max percent of income for EMIs (default 50)
   * @param {number} rate - Annual interest rate percentage
   * @param {number} tenure - Tenure in months
   * @returns {{ maxLoanAmount: number, maxNewEMI: number }}
   */
  calculateAffordability(monthlyIncome, existingEMIs, maxEMIPercent = 50, rate, tenure) {
    if (monthlyIncome <= 0) throw new Error('Monthly income must be positive');
    if (existingEMIs < 0) throw new Error('Existing EMIs cannot be negative');

    const maxTotalEMI = monthlyIncome * (maxEMIPercent / 100);
    const maxNewEMI = roundCurrency(Math.max(maxTotalEMI - existingEMIs, 0));

    if (maxNewEMI <= 0) {
      return { maxLoanAmount: 0, maxNewEMI: 0 };
    }

    const maxLoan = this.calculateMaxLoan(maxNewEMI, rate, tenure);
    return { maxLoanAmount: maxLoan, maxNewEMI };
  }

  /**
   * Given a fixed EMI, calculate how many months to repay the loan.
   * Formula: n = -log(1 - P*r/EMI) / log(1+r)
   * @param {number} principal - Loan amount
   * @param {number} emi - Fixed monthly EMI
   * @param {number} annualRate - Annual interest rate percentage
   * @returns {{ tenureMonths: number, totalPayment: number, totalInterest: number }}
   */
  calculateTenure(principal, emi, annualRate) {
    if (principal <= 0) throw new Error('Principal must be positive');
    if (emi <= 0) throw new Error('EMI must be positive');
    if (annualRate < 0) throw new Error('Rate cannot be negative');

    if (annualRate === 0) {
      const months = Math.ceil(principal / emi);
      return {
        tenureMonths: months,
        totalPayment: roundCurrency(emi * months),
        totalInterest: roundCurrency(emi * months - principal),
      };
    }

    const r = annualRate / 100 / 12;

    // EMI must be greater than interest-only payment
    if (emi <= principal * r) {
      throw new Error('EMI is too low to repay the loan at this rate');
    }

    const months = Math.ceil(-Math.log(1 - (principal * r) / emi) / Math.log(1 + r));
    const totalPayment = roundCurrency(emi * months);
    const totalInterest = roundCurrency(totalPayment - principal);

    return { tenureMonths: months, totalPayment, totalInterest };
  }

  /**
   * Given a fixed EMI, calculate the maximum loan amount.
   * Inverse of EMI formula: P = EMI * ((1+r)^n - 1) / (r * (1+r)^n)
   * @param {number} emi - Fixed monthly EMI
   * @param {number} annualRate - Annual interest rate percentage
   * @param {number} tenureMonths - Tenure in months
   * @returns {number} Maximum loan amount
   */
  calculateMaxLoan(emi, annualRate, tenureMonths) {
    if (emi <= 0) throw new Error('EMI must be positive');
    if (annualRate < 0) throw new Error('Rate cannot be negative');
    if (tenureMonths <= 0) throw new Error('Tenure must be positive');

    if (annualRate === 0) {
      return roundCurrency(emi * tenureMonths);
    }

    const r = annualRate / 100 / 12;
    const factor = Math.pow(1 + r, tenureMonths);
    return roundCurrency(emi * (factor - 1) / (r * factor));
  }

  /**
   * Generate a full month-by-month amortization breakdown.
   * @param {number} principal - Loan amount
   * @param {number} annualRate - Annual interest rate percentage
   * @param {number} tenureMonths - Tenure in months
   * @returns {Array<{ month: number, emi: number, principal: number, interest: number, balance: number }>}
   */
  getEMIBreakdown(principal, annualRate, tenureMonths) {
    const v = validateLoanInputs(principal, annualRate, tenureMonths);
    if (!v.valid) throw new Error(`Invalid inputs: ${v.errors.join('; ')}`);

    const emi = this._emi(principal, annualRate, tenureMonths);
    const r = annualRate / 100 / 12;
    let balance = principal;
    const schedule = [];

    for (let m = 1; m <= tenureMonths && balance > 0.01; m++) {
      const interest = roundCurrency(balance * r);
      let principalPart = roundCurrency(emi - interest);

      // Final month adjustment
      if (principalPart > balance) {
        principalPart = roundCurrency(balance);
      }

      balance = roundCurrency(balance - principalPart);
      if (balance < 0) balance = 0;

      schedule.push({
        month: m,
        emi: roundCurrency(m < tenureMonths ? emi : principalPart + interest),
        principal: principalPart,
        interest,
        balance,
      });
    }

    return schedule;
  }

  /**
   * Internal EMI calculation with 0% guard.
   * @private
   */
  _emi(principal, annualRate, months) {
    if (annualRate === 0) {
      return principal / months;
    }
    const r = annualRate / 100 / 12;
    const factor = Math.pow(1 + r, months);
    return (principal * r * factor) / (factor - 1);
  }
}
