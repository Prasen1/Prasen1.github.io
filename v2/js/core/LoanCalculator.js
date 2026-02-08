/**
 * Advanced Loan Calculator (v2).
 * Supports variable interest rates, multiple prepayment types (monthly / yearly / one-time),
 * strategies (REDUCE_TENURE / REDUCE_EMI), part-prepayment tax benefit estimation,
 * balance lookup at any month, break-even analysis, and strategy comparison.
 *
 * Math notes:
 * - EMI = P * r * (1+r)^n / ((1+r)^n - 1)
 * - When rate is 0%, EMI = P / n
 * - Prepayments are capped at remaining balance
 * - All final currency values rounded via Math.round(x * 100) / 100
 */

import { validateLoanInputs } from '../utils/validators.js';
import { roundCurrency } from '../utils/formatters.js';

// ── Prepayment data models (self-contained for v2) ──

class InterestRatePeriod {
  constructor(startMonth, rate, endMonth = null) {
    this.startMonth = startMonth;
    this.rate = rate;
    this.endMonth = endMonth;
  }
  isActiveForMonth(month) {
    return month >= this.startMonth && (this.endMonth === null || month <= this.endMonth);
  }
}

class MonthlyPrepayment {
  constructor(amount, startMonth = 1, endMonth = null, strategy = null) {
    this.amount = amount;
    this.startMonth = startMonth;
    this.endMonth = endMonth;
    this.strategy = strategy;
  }
  isActiveForMonth(month) {
    return month >= this.startMonth && (this.endMonth === null || month <= this.endMonth);
  }
}

class YearlyPrepayment {
  constructor(amount, targetMonth = 12, startYear = 1, endYear = null, strategy = null) {
    this.amount = amount;
    this.targetMonth = targetMonth;
    this.startYear = startYear;
    this.endYear = endYear;
    this.strategy = strategy;
  }
  isActiveForMonth(month) {
    const yearOfLoan = Math.ceil(month / 12);
    const monthInYear = ((month - 1) % 12) + 1;
    return (
      monthInYear === this.targetMonth &&
      yearOfLoan >= this.startYear &&
      (this.endYear === null || yearOfLoan <= this.endYear)
    );
  }
}

class OneTimePrepayment {
  constructor(amount, month, strategy = null) {
    this.amount = amount;
    this.month = month;
    this.strategy = strategy;
  }
  isActiveForMonth(month) {
    return month === this.month;
  }
}

// ── Loan Configuration ──

export class LoanConfiguration {
  constructor() {
    this.principal = 0;
    this.baseTenureMonths = 0;
    this.interestRateSchedule = [];
    this.prepaymentStrategy = { monthly: [], yearly: [], oneTime: [] };
    this.defaultStrategy = 'REDUCE_TENURE';
  }

  addRatePeriod(startMonth, rate, endMonth = null) {
    this.interestRateSchedule.push(new InterestRatePeriod(startMonth, rate, endMonth));
    this.interestRateSchedule.sort((a, b) => a.startMonth - b.startMonth);
  }

  addMonthlyPrepayment(amount, startMonth = 1, endMonth = null, strategy = null) {
    this.prepaymentStrategy.monthly.push(new MonthlyPrepayment(amount, startMonth, endMonth, strategy));
  }

  addYearlyPrepayment(amount, targetMonth = 12, startYear = 1, endYear = null, strategy = null) {
    this.prepaymentStrategy.yearly.push(new YearlyPrepayment(amount, targetMonth, startYear, endYear, strategy));
  }

  addOneTimePrepayment(amount, month, strategy = null) {
    this.prepaymentStrategy.oneTime.push(new OneTimePrepayment(amount, month, strategy));
  }

  getInterestRateForMonth(month) {
    let applicable = null;
    for (const period of this.interestRateSchedule) {
      if (period.isActiveForMonth(month)) applicable = period.rate;
    }
    return applicable !== null ? applicable : (this.interestRateSchedule[0]?.rate || 0);
  }

  /**
   * Validate the configuration.
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validate() {
    const errors = [];
    if (this.principal <= 0) errors.push('Principal must be greater than 0');
    if (this.baseTenureMonths <= 0) errors.push('Tenure must be greater than 0');
    if (this.interestRateSchedule.length === 0) errors.push('At least one interest rate period is required');

    for (let i = 0; i < this.interestRateSchedule.length - 1; i++) {
      const cur = this.interestRateSchedule[i];
      const nxt = this.interestRateSchedule[i + 1];
      if (cur.endMonth !== null && nxt.startMonth <= cur.endMonth) {
        errors.push(`Rate periods have explicit overlap at month ${nxt.startMonth}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

// ── Advanced Loan Calculator ──

export class AdvancedLoanCalculator {
  /**
   * @param {LoanConfiguration} config
   */
  constructor(config) {
    if (!(config instanceof LoanConfiguration)) {
      throw new TypeError('config must be an instance of LoanConfiguration');
    }
    this.config = config;
    this.amortizationSchedule = [];
    this.currentEMI = 0;
  }

  /**
   * Run the full loan simulation with prepayments.
   * @returns {Object} Detailed calculation results
   */
  calculate() {
    const validation = this.config.validate();
    if (!validation.valid) throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);

    let balance = this.config.principal;
    this.currentEMI = this._calculateInitialEMI();
    let month = 0;
    const maxMonths = this.config.baseTenureMonths * 3;
    let totalInterestPaid = 0;
    let totalPrincipalPaid = 0;
    let totalPrepaymentMade = 0;

    const originalEMI = this.currentEMI;
    const originalLoan = this._simulateOriginal();
    this.amortizationSchedule = [];

    while (balance > 0.01 && month < maxMonths) {
      month++;
      const currentRate = this.config.getInterestRateForMonth(month);
      const monthlyRate = currentRate / 100 / 12;

      let interest = balance * monthlyRate;
      let principal = Math.min(this.currentEMI - interest, balance);
      if (principal < 0) principal = 0;

      const prepInfo = this._getPrepaymentForMonth(month);
      let prepayment = prepInfo.amount;
      const strategy = prepInfo.strategy || this.config.defaultStrategy;

      if (prepayment > 0) {
        // Cap at remaining balance after regular principal
        prepayment = Math.min(prepayment, balance - principal);
        if (prepayment < 0) prepayment = 0;

        if (strategy === 'REDUCE_EMI') {
          principal += prepayment;
          const newBalance = balance - principal;
          if (newBalance > 0.01) {
            const remaining = this._estimateRemainingMonths(newBalance, currentRate);
            this.currentEMI = this._emi(newBalance, currentRate, remaining);
            const minEMI = newBalance * monthlyRate * 1.01;
            if (this.currentEMI < minEMI) this.currentEMI = minEMI;
          } else {
            this.currentEMI = 0;
          }
        } else {
          principal += prepayment;
        }

        totalPrepaymentMade += prepayment;
      }

      if (principal > balance) principal = balance;

      totalInterestPaid += interest;
      totalPrincipalPaid += principal;
      balance -= principal;
      if (balance < 0) balance = 0;

      this.amortizationSchedule.push({
        month,
        balance: roundCurrency(Math.max(balance, 0)),
        interest: roundCurrency(interest),
        principal: roundCurrency(principal),
        emi: roundCurrency(this.currentEMI),
        prepayment: roundCurrency(prepayment),
        prepaymentType: prepInfo.type,
        rate: currentRate,
        strategy: prepayment > 0 ? strategy : null,
      });

      if (balance <= 0.01) { balance = 0; break; }
    }

    const interestSaved = Math.max(originalLoan.totalInterest - totalInterestPaid, 0);
    const tenureReduced = originalLoan.months - month;

    return {
      success: true,
      months: month,
      totalInterest: roundCurrency(totalInterestPaid),
      totalPrincipal: roundCurrency(totalPrincipalPaid),
      totalPayment: roundCurrency(totalPrincipalPaid + totalInterestPaid),
      totalPrepayment: roundCurrency(totalPrepaymentMade),
      interestSaved: roundCurrency(interestSaved),
      tenureReduced,
      originalEMI: roundCurrency(originalEMI),
      finalEMI: roundCurrency(this.currentEMI),
      originalMonths: originalLoan.months,
      originalTotalInterest: roundCurrency(originalLoan.totalInterest),
      amortizationSchedule: this.amortizationSchedule,
      averageRate: this._calculateAverageRate(),
    };
  }

  /**
   * Get the outstanding loan balance at any arbitrary month.
   * Runs the simulation up to that month.
   * @param {number} targetMonth - Month number (1-indexed)
   * @returns {{ month: number, balance: number, totalInterestPaid: number, totalPrincipalPaid: number }}
   */
  getBalanceAtMonth(targetMonth) {
    if (targetMonth < 1) throw new Error('Month must be >= 1');

    const validation = this.config.validate();
    if (!validation.valid) throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);

    let balance = this.config.principal;
    let emi = this._calculateInitialEMI();
    let totalInterest = 0;
    let totalPrincipal = 0;

    for (let m = 1; m <= targetMonth && balance > 0.01; m++) {
      const rate = this.config.getInterestRateForMonth(m);
      const mr = rate / 100 / 12;
      const interest = balance * mr;
      let principal = Math.min(emi - interest, balance);
      if (principal < 0) principal = 0;

      const prepInfo = this._getPrepaymentForMonth(m);
      let prepayment = Math.min(prepInfo.amount, balance - principal);
      if (prepayment < 0) prepayment = 0;
      const strategy = prepInfo.strategy || this.config.defaultStrategy;

      if (prepayment > 0) {
        if (strategy === 'REDUCE_EMI') {
          principal += prepayment;
          const nb = balance - principal;
          if (nb > 0.01) {
            const rem = this._estimateRemainingMonths(nb, rate);
            emi = this._emi(nb, rate, rem);
          }
        } else {
          principal += prepayment;
        }
      }

      if (principal > balance) principal = balance;
      totalInterest += interest;
      totalPrincipal += principal;
      balance -= principal;
      if (balance < 0) balance = 0;
    }

    return {
      month: targetMonth,
      balance: roundCurrency(balance),
      totalInterestPaid: roundCurrency(totalInterest),
      totalPrincipalPaid: roundCurrency(totalPrincipal),
    };
  }

  /**
   * Estimate tax benefit from prepayments under Section 80C.
   * Section 80C allows deduction up to 1,50,000 per financial year.
   * Assumes a given tax bracket (default 30%).
   * @param {number} totalPrepayment - Total prepayment made in the financial year
   * @param {number} existingSec80C - Already-claimed 80C deductions this year
   * @param {number} taxBracketPercent - Marginal tax bracket (default 30)
   * @returns {{ eligibleDeduction: number, taxSaved: number }}
   */
  estimatePrepaymentTaxBenefit(totalPrepayment, existingSec80C = 0, taxBracketPercent = 30) {
    const MAX_80C = 150000;
    const available = Math.max(MAX_80C - existingSec80C, 0);
    const eligible = Math.min(totalPrepayment, available);
    const taxSaved = roundCurrency(eligible * (taxBracketPercent / 100));
    return { eligibleDeduction: roundCurrency(eligible), taxSaved };
  }

  /**
   * Break-even analysis: when does interest saved from prepayment
   * exceed the returns that the same money could have earned elsewhere?
   * @param {number} prepaymentAmount - Amount to prepay
   * @param {number} prepaymentMonth - Month at which prepayment happens
   * @param {number} alternateReturnRate - Annual return rate of alternative investment (%)
   * @returns {{ breakEvenMonth: number|null, interestSaved: number, investmentValue: number, recommendation: string }}
   */
  breakEvenAnalysis(prepaymentAmount, prepaymentMonth, alternateReturnRate) {
    if (prepaymentAmount <= 0) throw new Error('Prepayment amount must be positive');
    if (alternateReturnRate < 0) throw new Error('Alternate return rate cannot be negative');

    // Calculate interest saved by making the prepayment
    // Compare: loan WITH prepayment vs loan WITHOUT prepayment
    const configWith = this._cloneConfig();
    configWith.addOneTimePrepayment(prepaymentAmount, prepaymentMonth);
    const calcWith = new AdvancedLoanCalculator(configWith);
    const resultWith = calcWith.calculate();

    const configWithout = this._cloneConfig();
    const calcWithout = new AdvancedLoanCalculator(configWithout);
    const resultWithout = calcWithout.calculate();

    const interestSaved = roundCurrency(resultWithout.totalInterest - resultWith.totalInterest);

    // Remaining months from prepayment point to end of loan without prepayment
    const remainingMonths = resultWithout.months - prepaymentMonth;

    // Future value of prepaymentAmount invested at alternate rate for those months
    const mr = alternateReturnRate / 100 / 12;
    const investmentValue = mr === 0
      ? prepaymentAmount
      : roundCurrency(prepaymentAmount * Math.pow(1 + mr, remainingMonths));

    const investmentGain = roundCurrency(investmentValue - prepaymentAmount);

    // Find break-even month
    let breakEvenMonth = null;
    if (interestSaved > 0) {
      for (let m = 1; m <= remainingMonths; m++) {
        const invVal = mr === 0 ? 0 : prepaymentAmount * (Math.pow(1 + mr, m) - 1);
        // Interest saved accumulates roughly linearly — use proportional estimate
        const savedSoFar = interestSaved * (m / remainingMonths);
        if (savedSoFar >= invVal) {
          breakEvenMonth = prepaymentMonth + m;
          break;
        }
      }
    }

    let recommendation;
    if (interestSaved >= investmentGain) {
      recommendation = 'Prepayment is beneficial: interest saved exceeds potential investment returns';
    } else {
      recommendation = 'Investment may be better: potential returns exceed interest saved from prepayment';
    }

    return {
      breakEvenMonth,
      interestSaved,
      investmentValue,
      investmentGain,
      recommendation,
    };
  }

  /**
   * Compare REDUCE_TENURE vs REDUCE_EMI strategies for the same prepayment.
   * @param {number} prepaymentAmount - Amount to prepay
   * @param {number} prepaymentMonth - Month at which prepayment happens
   * @returns {{ reduceTenure: Object, reduceEMI: Object, comparison: Object }}
   */
  compareStrategies(prepaymentAmount, prepaymentMonth) {
    // REDUCE_TENURE
    const configRT = this._cloneConfig();
    configRT.defaultStrategy = 'REDUCE_TENURE';
    configRT.addOneTimePrepayment(prepaymentAmount, prepaymentMonth, 'REDUCE_TENURE');
    const calcRT = new AdvancedLoanCalculator(configRT);
    const resultRT = calcRT.calculate();

    // REDUCE_EMI
    const configRE = this._cloneConfig();
    configRE.defaultStrategy = 'REDUCE_EMI';
    configRE.addOneTimePrepayment(prepaymentAmount, prepaymentMonth, 'REDUCE_EMI');
    const calcRE = new AdvancedLoanCalculator(configRE);
    const resultRE = calcRE.calculate();

    return {
      reduceTenure: {
        months: resultRT.months,
        totalInterest: resultRT.totalInterest,
        totalPayment: resultRT.totalPayment,
        finalEMI: resultRT.finalEMI,
      },
      reduceEMI: {
        months: resultRE.months,
        totalInterest: resultRE.totalInterest,
        totalPayment: resultRE.totalPayment,
        finalEMI: resultRE.finalEMI,
      },
      comparison: {
        interestDifference: roundCurrency(resultRE.totalInterest - resultRT.totalInterest),
        tenureDifference: resultRE.months - resultRT.months,
        recommendation:
          resultRT.totalInterest <= resultRE.totalInterest
            ? 'REDUCE_TENURE saves more interest overall'
            : 'REDUCE_EMI saves more interest in this configuration',
      },
    };
  }

  // ── Private helpers ──

  /** @private */
  _calculateInitialEMI() {
    const rate = this.config.interestRateSchedule[0].rate;
    return this._emi(this.config.principal, rate, this.config.baseTenureMonths);
  }

  /** @private */
  _emi(principal, annualRate, months) {
    if (principal <= 0 || months <= 0) return 0;
    if (annualRate === 0) return principal / months;
    const r = annualRate / 100 / 12;
    const factor = Math.pow(1 + r, months);
    return (principal * r * factor) / (factor - 1);
  }

  /** @private */
  _estimateRemainingMonths(balance, annualRate) {
    if (balance <= 0 || this.currentEMI <= 0) return 0;
    if (annualRate === 0) return Math.ceil(balance / this.currentEMI);
    const r = annualRate / 100 / 12;
    if (this.currentEMI <= balance * r) return this.config.baseTenureMonths;
    const months = Math.ceil(Math.log(this.currentEMI / (this.currentEMI - balance * r)) / Math.log(1 + r));
    if (months < 1) return 1;
    if (months > this.config.baseTenureMonths * 2) return this.config.baseTenureMonths * 2;
    return months;
  }

  /** @private */
  _getPrepaymentForMonth(month) {
    let totalAmount = 0;
    const types = [];
    let strategy = null;

    for (const prep of this.config.prepaymentStrategy.monthly) {
      if (prep.isActiveForMonth(month)) {
        totalAmount += prep.amount;
        types.push('monthly');
        if (prep.strategy) strategy = prep.strategy;
      }
    }
    for (const prep of this.config.prepaymentStrategy.yearly) {
      if (prep.isActiveForMonth(month)) {
        totalAmount += prep.amount;
        types.push('yearly');
        if (prep.strategy) strategy = prep.strategy;
      }
    }
    for (const prep of this.config.prepaymentStrategy.oneTime) {
      if (prep.isActiveForMonth(month)) {
        totalAmount += prep.amount;
        types.push('lump-sum');
        if (prep.strategy) strategy = prep.strategy;
      }
    }

    return {
      amount: totalAmount,
      type: types.length > 0 ? types.join(' + ') : 'none',
      strategy,
    };
  }

  /** @private */
  _simulateOriginal() {
    let balance = this.config.principal;
    const emi = this._calculateInitialEMI();
    let totalInterest = 0;
    let month = 0;
    const maxMonths = this.config.baseTenureMonths * 2;

    while (balance > 0.01 && month < maxMonths) {
      month++;
      const rate = this.config.getInterestRateForMonth(month);
      const mr = rate / 100 / 12;
      const interest = balance * mr;
      let principal = Math.min(emi - interest, balance);
      if (principal < 0) principal = 0;
      totalInterest += interest;
      balance -= principal;
      if (balance <= 0.01) break;
    }

    return { months: month, totalInterest };
  }

  /** @private */
  _calculateAverageRate() {
    if (this.amortizationSchedule.length === 0) {
      return this.config.interestRateSchedule[0]?.rate || 0;
    }
    const sum = this.amortizationSchedule.reduce((s, row) => s + row.rate, 0);
    return sum / this.amortizationSchedule.length;
  }

  /** @private – creates a deep-enough clone of the current config (without prepayments) */
  _cloneConfig() {
    const c = new LoanConfiguration();
    c.principal = this.config.principal;
    c.baseTenureMonths = this.config.baseTenureMonths;
    c.defaultStrategy = this.config.defaultStrategy;
    for (const p of this.config.interestRateSchedule) {
      c.addRatePeriod(p.startMonth, p.rate, p.endMonth);
    }
    return c;
  }
}

/**
 * Convenience function for simple loan calculation (backward compatibility).
 * @param {Object} params
 * @returns {Object}
 */
export function calculateSimpleLoan(params) {
  const config = new LoanConfiguration();
  config.principal = params.loanAmount;
  config.baseTenureMonths = params.loanTenure * 12;
  config.addRatePeriod(1, params.interestRate, null);

  if (params.prepaymentType === 'monthly' && params.extraPayment > 0) {
    config.addMonthlyPrepayment(params.extraPayment, params.startPrepaymentMonth || 1, null, null);
  } else if (params.prepaymentType === 'yearly' && params.yearlyPayment > 0) {
    config.addYearlyPrepayment(params.yearlyPayment, params.yearlyPaymentMonth || 12, 1, null, null);
  } else if (params.prepaymentType === 'one-time' && params.lumpSumAmount > 0) {
    config.addOneTimePrepayment(params.lumpSumAmount, params.lumpSumMonth || 12, null);
  }

  const calculator = new AdvancedLoanCalculator(config);
  return calculator.calculate();
}
