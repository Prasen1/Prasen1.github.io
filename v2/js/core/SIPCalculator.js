/**
 * Advanced SIP Calculator (v2).
 *
 * Supports forward calculation, goal-based (reverse) SIP, step-up schedules,
 * multi-scenario analysis, withdrawal planning, retirement planning,
 * XIRR for irregular cash flows, tax impact estimation, and portfolio aggregation.
 *
 * SIP Future Value formula: P * [(1+r)^n - 1] / r * (1+r)
 *   The trailing (1+r) assumes investment at the BEGINNING of each month,
 *   meaning the first installment earns a full month of returns.
 *   This is the standard Indian mutual-fund SIP convention.
 *
 * When return rate is 0%, FV = P * n (no growth).
 */

import { validateSIPInputs } from '../utils/validators.js';
import { roundCurrency } from '../utils/formatters.js';

// ── Forward SIP Calculator ──

export class AdvancedSIPCalculator {
  /**
   * @param {Object} config
   * @param {number} config.monthlyAmount - Monthly SIP amount
   * @param {number} config.durationYears - Investment duration in years
   * @param {number} [config.inflationRate=0] - Expected annual inflation %
   * @param {Array} [config.stepUpSchedules=[]] - Step-up schedule entries
   * @param {Object} [config.returnScenarios={}] - Map of scenario name to { getReturnForYear(year) }
   */
  constructor(config) {
    this.config = {
      monthlyAmount: config.monthlyAmount,
      durationYears: config.durationYears,
      inflationRate: config.inflationRate || 0,
      stepUpSchedules: config.stepUpSchedules || [],
      returnScenarios: config.returnScenarios || {},
    };
    this.schedule = [];
  }

  /**
   * Run forward SIP calculation for a given return scenario.
   * @param {string} [scenarioName='realistic']
   * @returns {Object} Calculation results
   */
  calculate(scenarioName = 'realistic') {
    const scenario = this.config.returnScenarios[scenarioName];
    if (!scenario) throw new Error(`Return scenario '${scenarioName}' not found`);

    let balance = 0;
    let totalInvested = 0;
    let currentSIP = this.config.monthlyAmount;
    const months = this.config.durationYears * 12;
    this.schedule = [];

    for (let month = 1; month <= months; month++) {
      const year = Math.ceil(month / 12);

      // Step-up at the start of each new year
      if (month > 1 && (month - 1) % 12 === 0) {
        currentSIP = this._applyStepUp(currentSIP, year);
      }

      const returnRate = scenario.getReturnForYear(year);
      const mr = returnRate / 100 / 12;

      totalInvested += currentSIP;
      // Beginning-of-month investment convention: invest then grow
      balance = (balance + currentSIP) * (1 + mr);

      const inflationAdjusted =
        this.config.inflationRate > 0
          ? balance / Math.pow(1 + this.config.inflationRate / 100 / 12, month)
          : balance;

      if (month % 6 === 0 || month === 1 || month === months) {
        this.schedule.push({
          month,
          year,
          sipAmount: roundCurrency(currentSIP),
          balance: roundCurrency(balance),
          inflationAdjusted: roundCurrency(inflationAdjusted),
          totalInvested: roundCurrency(totalInvested),
          returnRate,
        });
      }
    }

    const wealthGain = balance - totalInvested;
    const realValue =
      this.config.inflationRate > 0
        ? balance / Math.pow(1 + this.config.inflationRate / 100, this.config.durationYears)
        : balance;

    return {
      success: true,
      finalValue: roundCurrency(balance),
      totalInvested: roundCurrency(totalInvested),
      wealthGain: roundCurrency(wealthGain),
      realValue: roundCurrency(realValue),
      effectiveReturn: this._effectiveReturn(totalInvested, balance, this.config.durationYears),
      schedule: this.schedule,
    };
  }

  /**
   * Calculate all configured return scenarios.
   * @returns {Object} Map of scenario name to results
   */
  calculateAllScenarios() {
    const results = {};
    for (const name of Object.keys(this.config.returnScenarios)) {
      results[name] = this.calculate(name);
    }
    return results;
  }

  /** @private */
  _applyStepUp(currentSIP, year) {
    for (const s of this.config.stepUpSchedules) {
      if (year >= s.startYear && (s.endYear === null || year <= s.endYear)) {
        return currentSIP * (1 + s.stepUpPercent / 100);
      }
    }
    return currentSIP;
  }

  /** @private */
  _effectiveReturn(invested, finalValue, years) {
    if (invested <= 0 || years <= 0) return 0;
    return (Math.pow(finalValue / invested, 1 / years) - 1) * 100;
  }
}

// ── Goal-Seeking SIP Calculator (Newton-Raphson) ──

export class GoalSeekingSIPCalculator {
  constructor() {
    this.maxIterations = 100;
    this.tolerance = 100; // within 100 rupees
  }

  /**
   * Find the monthly SIP needed to reach a target corpus.
   * @param {number} targetAmount - Target corpus
   * @param {number} years - Duration in years
   * @param {number} annualReturn - Expected annual return %
   * @param {number} [inflationRate=0]
   * @param {number} [stepUpPercent=0]
   * @returns {Object}
   */
  calculateRequiredSIP(targetAmount, years, annualReturn, inflationRate = 0, stepUpPercent = 0) {
    const inflationAdjustedTarget =
      inflationRate > 0 ? targetAmount * Math.pow(1 + inflationRate / 100, years) : targetAmount;

    let requiredSIP;
    if (stepUpPercent > 0) {
      requiredSIP = this._stepUpSearch(inflationAdjustedTarget, years, annualReturn, stepUpPercent);
    } else {
      requiredSIP = this._newtonRaphson(inflationAdjustedTarget, years, annualReturn);
    }

    const achieved =
      stepUpPercent > 0
        ? this._stepUpFV(requiredSIP, years, annualReturn, stepUpPercent)
        : this._futureValue(requiredSIP, years, annualReturn);

    const totalInvestment =
      stepUpPercent > 0
        ? this._stepUpTotalInvested(requiredSIP, years, stepUpPercent)
        : requiredSIP * years * 12;

    const realValue = inflationRate > 0 ? achieved / Math.pow(1 + inflationRate / 100, years) : achieved;

    return {
      success: true,
      requiredSIP: Math.ceil(requiredSIP / 100) * 100,
      targetAmount,
      inflationAdjustedTarget: roundCurrency(inflationAdjustedTarget),
      achievedAmount: roundCurrency(achieved),
      totalInvestment: roundCurrency(totalInvestment),
      wealthGain: roundCurrency(achieved - totalInvestment),
      realValue: roundCurrency(realValue),
      years,
      annualReturn,
      inflationRate,
      stepUpPercent,
    };
  }

  /**
   * Calculate multiple scenarios (map of name to return rate).
   * @param {number} targetAmount
   * @param {number} years
   * @param {Object} returnScenarios - e.g. { optimistic: 15, realistic: 12, pessimistic: 8 }
   * @param {number} [inflationRate=0]
   * @returns {Object}
   */
  calculateScenarios(targetAmount, years, returnScenarios, inflationRate = 0) {
    const results = {};
    for (const [name, rate] of Object.entries(returnScenarios)) {
      results[name] = this.calculateRequiredSIP(targetAmount, years, rate, inflationRate, 0);
    }
    return results;
  }

  /**
   * Probability analysis with volatility spread.
   * @param {number} monthlySIP
   * @param {number} targetAmount
   * @param {number} years
   * @param {number} expectedReturn
   * @param {number} [volatility=5]
   * @returns {Object}
   */
  calculateGoalProbability(monthlySIP, targetAmount, years, expectedReturn, volatility = 5) {
    const scenarios = {
      worst: expectedReturn - volatility,
      pessimistic: expectedReturn - volatility / 2,
      realistic: expectedReturn,
      optimistic: expectedReturn + volatility / 2,
      best: expectedReturn + volatility,
    };

    const outcomes = {};
    let successCount = 0;

    for (const [name, rate] of Object.entries(scenarios)) {
      const fv = this._futureValue(monthlySIP, years, rate);
      const success = fv >= targetAmount;
      outcomes[name] = {
        returnRate: rate,
        achievedAmount: roundCurrency(fv),
        success,
        shortfall: roundCurrency(Math.max(0, targetAmount - fv)),
      };
      if (success) successCount++;
    }

    return {
      probability: (successCount / Object.keys(scenarios).length) * 100,
      scenarios: outcomes,
      recommendation:
        successCount >= 3
          ? 'Likely to achieve goal'
          : successCount >= 2
            ? 'Moderate chance of achieving goal'
            : 'Consider increasing SIP or duration',
    };
  }

  // ── Private math helpers ──

  /** @private FV of regular SIP. (1+r) at end = beginning-of-month convention. */
  _futureValue(sip, years, annualReturn) {
    const n = years * 12;
    const r = annualReturn / 100 / 12;
    if (r === 0) return sip * n;
    return sip * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  }

  /** @private Newton-Raphson with binary-search fallback on non-convergence. */
  _newtonRaphson(target, years, annualReturn) {
    let sip = target / (years * 12);

    for (let i = 0; i < this.maxIterations; i++) {
      const fv = this._futureValue(sip, years, annualReturn);
      const error = fv - target;
      if (Math.abs(error) < this.tolerance) return sip;

      const delta = 1;
      const derivative = (this._futureValue(sip + delta, years, annualReturn) - fv) / delta;
      if (Math.abs(derivative) < 0.001) break; // non-convergence guard

      sip -= error / derivative;
      if (sip < 100) sip = 100;
    }

    // Fallback: binary search
    return this._binarySearch(target, years, annualReturn);
  }

  /** @private */
  _binarySearch(target, years, annualReturn) {
    let low = 100;
    let high = target / 12;
    for (let i = 0; i < this.maxIterations && high - low > 1; i++) {
      const mid = (low + high) / 2;
      const fv = this._futureValue(mid, years, annualReturn);
      if (Math.abs(fv - target) < this.tolerance) return mid;
      if (fv < target) low = mid; else high = mid;
    }
    return (low + high) / 2;
  }

  /** @private */
  _stepUpSearch(target, years, annualReturn, stepUpPercent) {
    let low = 100;
    let high = target / 12;
    for (let i = 0; i < this.maxIterations && high - low > 1; i++) {
      const mid = (low + high) / 2;
      const fv = this._stepUpFV(mid, years, annualReturn, stepUpPercent);
      if (Math.abs(fv - target) < this.tolerance) return mid;
      if (fv < target) low = mid; else high = mid;
    }
    return (low + high) / 2;
  }

  /** @private */
  _stepUpFV(initialSIP, years, annualReturn, stepUpPercent) {
    let total = 0;
    let sip = initialSIP;
    const mr = annualReturn / 100 / 12;

    for (let y = 1; y <= years; y++) {
      for (let m = 1; m <= 12; m++) {
        total = (total + sip) * (1 + mr);
      }
      if (y < years) sip *= 1 + stepUpPercent / 100;
    }
    return total;
  }

  /** @private */
  _stepUpTotalInvested(initialSIP, years, stepUpPercent) {
    let total = 0;
    let sip = initialSIP;
    for (let y = 1; y <= years; y++) {
      total += sip * 12;
      if (y < years) sip *= 1 + stepUpPercent / 100;
    }
    return total;
  }
}

// ── XIRR Calculator ──

export class XIRRCalculator {
  /**
   * Calculate XIRR (annualized internal rate of return) for irregular cash flows
   * using the Newton-Raphson method.
   *
   * @param {Array<{ amount: number, date: Date }>} cashFlows
   *   Negative amounts = investments (outflows), positive = redemptions (inflows).
   *   Must contain at least one positive and one negative value.
   * @param {number} [guess=0.1] - Initial guess for annual rate (0.1 = 10%)
   * @returns {{ xirr: number, converged: boolean }}
   *   xirr is expressed as a percentage (e.g. 12.5 for 12.5%)
   */
  calculate(cashFlows, guess = 0.1) {
    if (!cashFlows || cashFlows.length < 2) {
      throw new Error('At least 2 cash flows required');
    }

    const hasPositive = cashFlows.some(cf => cf.amount > 0);
    const hasNegative = cashFlows.some(cf => cf.amount < 0);
    if (!hasPositive || !hasNegative) {
      throw new Error('Cash flows must have at least one positive and one negative value');
    }

    const d0 = cashFlows[0].date;
    const maxIter = 200;
    const tol = 1e-7;
    let rate = guess;

    for (let i = 0; i < maxIter; i++) {
      let npv = 0;
      let dnpv = 0;

      for (const cf of cashFlows) {
        const years = (cf.date - d0) / (365.25 * 24 * 60 * 60 * 1000);
        const denom = Math.pow(1 + rate, years);
        npv += cf.amount / denom;
        dnpv -= years * cf.amount / (denom * (1 + rate));
      }

      if (Math.abs(npv) < tol) {
        return { xirr: roundCurrency(rate * 100), converged: true };
      }

      if (Math.abs(dnpv) < 1e-12) {
        // Non-convergence: derivative too small
        return { xirr: roundCurrency(rate * 100), converged: false };
      }

      rate -= npv / dnpv;

      // Guard against divergence
      if (rate < -0.99) rate = -0.99;
      if (rate > 100) rate = 100;
    }

    return { xirr: roundCurrency(rate * 100), converged: false };
  }
}

// ── Tax Impact Estimator for Mutual Fund Returns ──

export class MutualFundTaxEstimator {
  /**
   * Estimate post-tax returns on mutual fund investments.
   *
   * Equity funds (holding >= 1 year):
   *   LTCG > 1,25,000 taxed at 12.5%
   * Equity funds (holding < 1 year):
   *   STCG taxed at 20%
   * Debt funds:
   *   Gains taxed at the investor's income tax slab rate
   *
   * @param {Object} params
   * @param {number} params.investedAmount - Total amount invested
   * @param {number} params.currentValue - Current value of investment
   * @param {number} params.holdingYears - Holding period in years
   * @param {'equity'|'debt'} params.fundType - Type of fund
   * @param {number} [params.taxSlabRate=30] - Income tax slab rate for debt funds (%)
   * @returns {{ gain: number, taxableGain: number, tax: number, postTaxValue: number, effectiveReturn: number }}
   */
  estimate(params) {
    const { investedAmount, currentValue, holdingYears, fundType, taxSlabRate = 30 } = params;

    const gain = currentValue - investedAmount;
    if (gain <= 0) {
      return {
        gain: roundCurrency(gain),
        taxableGain: 0,
        tax: 0,
        postTaxValue: roundCurrency(currentValue),
        effectiveReturn: holdingYears > 0
          ? ((Math.pow(currentValue / investedAmount, 1 / holdingYears) - 1) * 100)
          : 0,
      };
    }

    let tax = 0;

    if (fundType === 'equity') {
      if (holdingYears >= 1) {
        // LTCG: exempt up to 1,25,000; excess at 12.5%
        const taxableGain = Math.max(gain - 125000, 0);
        tax = taxableGain * 0.125;
      } else {
        // STCG at 20%
        tax = gain * 0.20;
      }
    } else {
      // Debt: taxed at income slab rate
      tax = gain * (taxSlabRate / 100);
    }

    // Add 4% cess on tax
    tax = tax * 1.04;
    tax = roundCurrency(tax);

    const postTaxValue = roundCurrency(currentValue - tax);
    const postTaxGain = postTaxValue - investedAmount;
    const effectiveReturn = holdingYears > 0
      ? ((Math.pow(postTaxValue / investedAmount, 1 / holdingYears) - 1) * 100)
      : 0;

    return {
      gain: roundCurrency(gain),
      taxableGain: roundCurrency(fundType === 'equity' && holdingYears >= 1 ? Math.max(gain - 125000, 0) : gain),
      tax,
      postTaxValue,
      effectiveReturn: Math.round(effectiveReturn * 100) / 100,
    };
  }
}

// ── Portfolio Aggregation ──

export class PortfolioAggregator {
  /**
   * Combine multiple SIP investments into an aggregated portfolio view.
   * @param {Array<Object>} sips - Array of { name, monthlyAmount, currentValue, investedAmount, returnRate }
   * @returns {{ totalMonthly: number, totalInvested: number, totalValue: number, totalGain: number, weightedReturn: number, allocations: Array }}
   */
  aggregate(sips) {
    if (!sips || sips.length === 0) {
      return { totalMonthly: 0, totalInvested: 0, totalValue: 0, totalGain: 0, weightedReturn: 0, allocations: [] };
    }

    let totalMonthly = 0;
    let totalInvested = 0;
    let totalValue = 0;

    for (const sip of sips) {
      totalMonthly += sip.monthlyAmount || 0;
      totalInvested += sip.investedAmount || 0;
      totalValue += sip.currentValue || 0;
    }

    const totalGain = totalValue - totalInvested;

    // Value-weighted return
    let weightedReturn = 0;
    if (totalValue > 0) {
      for (const sip of sips) {
        const weight = (sip.currentValue || 0) / totalValue;
        weightedReturn += weight * (sip.returnRate || 0);
      }
    }

    const allocations = sips.map((sip) => ({
      name: sip.name,
      monthlyAmount: roundCurrency(sip.monthlyAmount || 0),
      investedAmount: roundCurrency(sip.investedAmount || 0),
      currentValue: roundCurrency(sip.currentValue || 0),
      gain: roundCurrency((sip.currentValue || 0) - (sip.investedAmount || 0)),
      allocationPercent: totalValue > 0 ? Math.round(((sip.currentValue || 0) / totalValue) * 10000) / 100 : 0,
    }));

    return {
      totalMonthly: roundCurrency(totalMonthly),
      totalInvested: roundCurrency(totalInvested),
      totalValue: roundCurrency(totalValue),
      totalGain: roundCurrency(totalGain),
      weightedReturn: Math.round(weightedReturn * 100) / 100,
      allocations,
    };
  }
}

// ── Withdrawal Calculator ──

export class WithdrawalCalculator {
  constructor() {
    this.schedule = [];
  }

  /**
   * Simulate corpus depletion with regular withdrawals.
   * @param {number} initialCorpus
   * @param {number} monthlyWithdrawal
   * @param {number} years
   * @param {number} annualReturn - Expected return during withdrawal phase (%)
   * @param {number} [inflationRate=0]
   * @param {boolean} [inflationAdjusted=true]
   * @returns {Object}
   */
  calculate(initialCorpus, monthlyWithdrawal, years, annualReturn, inflationRate = 0, inflationAdjusted = true) {
    let balance = initialCorpus;
    let totalWithdrawn = 0;
    let currentWithdrawal = monthlyWithdrawal;
    const months = years * 12;
    const mr = annualReturn / 100 / 12;
    this.schedule = [];
    let depletedAt = null;

    for (let month = 1; month <= months; month++) {
      if (inflationAdjusted && month > 1 && (month - 1) % 12 === 0) {
        currentWithdrawal *= 1 + inflationRate / 100;
      }

      if (balance < currentWithdrawal) {
        depletedAt = month;
        break;
      }

      balance -= currentWithdrawal;
      totalWithdrawn += currentWithdrawal;
      if (balance > 0) balance *= 1 + mr;

      if (month % 6 === 0 || month === 1 || balance <= 0) {
        this.schedule.push({
          month,
          year: Math.ceil(month / 12),
          balance: roundCurrency(Math.max(balance, 0)),
          withdrawal: roundCurrency(currentWithdrawal),
          totalWithdrawn: roundCurrency(totalWithdrawn),
        });
      }

      if (balance <= 0) { depletedAt = month; break; }
    }

    return {
      success: true,
      initialCorpus: roundCurrency(initialCorpus),
      monthlyWithdrawal: roundCurrency(monthlyWithdrawal),
      totalWithdrawn: roundCurrency(totalWithdrawn),
      remainingCorpus: roundCurrency(Math.max(balance, 0)),
      depletedAt,
      depletedInYears: depletedAt ? depletedAt / 12 : null,
      lastsThroughPlan: depletedAt === null,
      schedule: this.schedule,
    };
  }

  /**
   * Calculate required initial corpus for a withdrawal plan (binary search).
   * @param {number} monthlyWithdrawal
   * @param {number} years
   * @param {number} annualReturn
   * @param {number} [inflationRate=0]
   * @param {boolean} [inflationAdjusted=true]
   * @returns {number} Required corpus (rounded to nearest lakh)
   */
  calculateRequiredCorpus(monthlyWithdrawal, years, annualReturn, inflationRate = 0, inflationAdjusted = true) {
    let low = monthlyWithdrawal * years * 12;
    let high = low * 3;

    for (let i = 0; i < 100 && high - low > 1000; i++) {
      const mid = (low + high) / 2;
      const result = this.calculate(mid, monthlyWithdrawal, years, annualReturn, inflationRate, inflationAdjusted);
      if (result.depletedAt === null) high = mid; else low = mid;
    }

    return Math.ceil(high / 100000) * 100000;
  }

  /**
   * Calculate safe monthly withdrawal using the 4% rule adjusted for returns.
   * @param {number} corpus
   * @param {number} years
   * @param {number} annualReturn
   * @returns {number}
   */
  calculateSafeWithdrawalRate(corpus, years, annualReturn) {
    const r = annualReturn / 100 / 12;
    if (r === 0) return roundCurrency(corpus / (years * 12));
    const n = years * 12;
    // Present-value annuity formula: PMT = PV * r / (1 - (1+r)^-n)
    return roundCurrency(corpus * r / (1 - Math.pow(1 + r, -n)));
  }
}

// ── Retirement Planning (accumulation + withdrawal) ──

export class RetirementPlanningCalculator {
  /**
   * Calculate a full retirement plan: accumulation phase then withdrawal phase.
   * @param {Object} accumulationParams - { monthlySIP, years, returnRate, inflationRate?, stepUpPercent? }
   * @param {Object} withdrawalParams - { monthlyWithdrawal, years, returnDuringWithdrawal, inflationRate?, inflationAdjusted? }
   * @returns {Object}
   */
  calculateFullPlan(accumulationParams, withdrawalParams) {
    // Phase 1: Accumulation
    const scenario = {
      getReturnForYear: () => accumulationParams.returnRate,
    };
    const sipCalc = new AdvancedSIPCalculator({
      monthlyAmount: accumulationParams.monthlySIP,
      durationYears: accumulationParams.years,
      inflationRate: accumulationParams.inflationRate || 0,
      stepUpSchedules: accumulationParams.stepUpPercent
        ? [{ startYear: 1, endYear: null, stepUpPercent: accumulationParams.stepUpPercent }]
        : [],
      returnScenarios: { realistic: scenario },
    });
    const accResult = sipCalc.calculate('realistic');

    // Phase 2: Withdrawal
    const wCalc = new WithdrawalCalculator();
    const wResult = wCalc.calculate(
      accResult.finalValue,
      withdrawalParams.monthlyWithdrawal,
      withdrawalParams.years,
      withdrawalParams.returnDuringWithdrawal,
      withdrawalParams.inflationRate || 0,
      withdrawalParams.inflationAdjusted !== false,
    );

    return {
      accumulation: accResult,
      withdrawal: wResult,
      totalDuration: accumulationParams.years + (wResult.depletedInYears || withdrawalParams.years),
      success: wResult.lastsThroughPlan,
    };
  }
}

// ── Convenience function (backward compatibility) ──

/**
 * @param {Object} params - { sipAmount, sipYears, sipReturn, inflationRate?, sipStepUp? }
 * @returns {Object}
 */
export function calculateSimpleSIP(params) {
  const v = validateSIPInputs(params.sipAmount, params.sipReturn, params.sipYears);
  if (!v.valid) throw new Error(`Invalid inputs: ${v.errors.join('; ')}`);

  const scenario = { getReturnForYear: () => params.sipReturn };
  const config = {
    monthlyAmount: params.sipAmount,
    durationYears: params.sipYears,
    inflationRate: params.inflationRate || 0,
    stepUpSchedules:
      params.sipStepUp && params.sipStepUp > 0
        ? [{ startYear: 1, endYear: null, stepUpPercent: params.sipStepUp }]
        : [],
    returnScenarios: { realistic: scenario },
  };

  const calc = new AdvancedSIPCalculator(config);
  return calc.calculate('realistic');
}

// ── Singleton exports ──

export const goalSeeker = new GoalSeekingSIPCalculator();
export const xirrCalculator = new XIRRCalculator();
export const mutualFundTaxEstimator = new MutualFundTaxEstimator();
export const portfolioAggregator = new PortfolioAggregator();
export const withdrawalCalculator = new WithdrawalCalculator();
export const retirementPlanner = new RetirementPlanningCalculator();
