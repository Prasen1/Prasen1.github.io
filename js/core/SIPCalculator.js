/**
 * Advanced SIP Calculator
 * Supports variable returns, step-up, and withdrawal planning
 */

import { SIPConfiguration, ReturnScenario } from './DataModels.js';

export class AdvancedSIPCalculator {
    constructor(config) {
        if (!(config instanceof SIPConfiguration)) {
            throw new TypeError('config must be an instance of SIPConfiguration');
        }

        this.config = config;
        this.schedule = [];
    }

    /**
     * Calculate SIP growth with all features
     * @param {String} scenarioName - Which return scenario to use
     * @returns {Object} Calculation results
     */
    calculate(scenarioName = 'realistic') {
        const scenario = this.config.returnScenarios[scenarioName];

        if (!scenario) {
            throw new Error(`Return scenario '${scenarioName}' not found`);
        }

        let balance = 0;
        let totalInvested = 0;
        let currentSIP = this.config.monthlyAmount;
        const months = this.config.durationYears * 12;

        this.schedule = [];

        for (let month = 1; month <= months; month++) {
            const year = Math.ceil(month / 12);

            // Check for step-up
            if (month > 1 && (month - 1) % 12 === 0) {
                // Apply step-up at the start of each year
                currentSIP = this.applySteUpSchedule(currentSIP, year);
            }

            // Get return rate for this month
            const returnRate = scenario.getReturnForYear(year);
            const monthlyReturn = returnRate / 100 / 12;

            // Invest and grow
            totalInvested += currentSIP;
            balance = (balance + currentSIP) * (1 + monthlyReturn);

            // Calculate inflation-adjusted value
            const inflationAdjusted = this.config.inflationRate > 0
                ? balance / Math.pow(1 + this.config.inflationRate / 100 / 12, month)
                : balance;

            // Store in schedule (sample for performance)
            if (month % 6 === 0 || month === 1 || month === months) {
                this.schedule.push({
                    month,
                    year,
                    sipAmount: currentSIP,
                    balance,
                    inflationAdjusted,
                    totalInvested,
                    returnRate
                });
            }
        }

        const wealthGain = balance - totalInvested;
        const realValue = this.config.inflationRate > 0
            ? balance / Math.pow(1 + this.config.inflationRate / 100, this.config.durationYears)
            : balance;

        return {
            success: true,
            finalValue: balance,
            totalInvested,
            wealthGain,
            realValue,
            effectiveReturn: this.calculateEffectiveReturn(totalInvested, balance, this.config.durationYears),
            schedule: this.schedule
        };
    }

    /**
     * Apply step-up schedule for a given year
     */
    applySteUpSchedule(currentSIP, year) {
        if (this.config.stepUpSchedules.length === 0) {
            return currentSIP;
        }

        // Find applicable step-up schedule
        for (const schedule of this.config.stepUpSchedules) {
            if (year >= schedule.startYear &&
                (schedule.endYear === null || year <= schedule.endYear)) {
                return currentSIP * (1 + schedule.stepUpPercent / 100);
            }
        }

        return currentSIP;
    }

    /**
     * Calculate effective annual return
     */
    calculateEffectiveReturn(invested, finalValue, years) {
        if (invested <= 0 || years <= 0) return 0;

        // Approximate XIRR using (FV/IV)^(1/years) - 1
        return (Math.pow(finalValue / invested, 1 / years) - 1) * 100;
    }

    /**
     * Calculate all return scenarios
     * @returns {Object} Results for all scenarios
     */
    calculateAllScenarios() {
        const results = {};

        for (const scenarioName of Object.keys(this.config.returnScenarios)) {
            results[scenarioName] = this.calculate(scenarioName);
        }

        return results;
    }
}

/**
 * Withdrawal Calculator for retirement planning
 */
export class WithdrawalCalculator {
    constructor() {
        this.schedule = [];
    }

    /**
     * Calculate corpus depletion with withdrawals
     * @param {Number} initialCorpus - Starting corpus
     * @param {Number} monthlyWithdrawal - Initial monthly withdrawal
     * @param {Number} years - Duration of withdrawals
     * @param {Number} annualReturn - Expected return during withdrawal phase
     * @param {Number} inflationRate - Inflation rate for adjusting withdrawals
     * @param {Boolean} inflationAdjusted - Whether to adjust withdrawals for inflation
     * @returns {Object} Calculation results
     */
    calculate(initialCorpus, monthlyWithdrawal, years, annualReturn, inflationRate = 0, inflationAdjusted = true) {
        let balance = initialCorpus;
        let totalWithdrawn = 0;
        let currentWithdrawal = monthlyWithdrawal;
        const months = years * 12;
        const monthlyReturn = annualReturn / 100 / 12;
        const monthlyInflation = inflationRate / 100 / 12;

        this.schedule = [];
        let depletedAt = null;

        for (let month = 1; month <= months; month++) {
            const year = Math.ceil(month / 12);

            // Adjust withdrawal for inflation annually
            if (inflationAdjusted && month > 1 && (month - 1) % 12 === 0) {
                currentWithdrawal *= (1 + inflationRate / 100);
            }

            // Check if corpus can support withdrawal
            if (balance < currentWithdrawal) {
                depletedAt = month;
                break;
            }

            // Withdraw and grow remaining corpus
            balance -= currentWithdrawal;
            totalWithdrawn += currentWithdrawal;

            if (balance > 0) {
                balance *= (1 + monthlyReturn);
            }

            // Store in schedule (sample every 6 months)
            if (month % 6 === 0 || month === 1 || balance <= 0) {
                this.schedule.push({
                    month,
                    year,
                    balance: Math.max(balance, 0),
                    withdrawal: currentWithdrawal,
                    totalWithdrawn
                });
            }

            if (balance <= 0) {
                depletedAt = month;
                break;
            }
        }

        return {
            success: true,
            initialCorpus,
            monthlyWithdrawal,
            totalWithdrawn,
            remainingCorpus: Math.max(balance, 0),
            depletedAt,
            depletedInYears: depletedAt ? depletedAt / 12 : null,
            lastsThroughPlan: depletedAt === null,
            schedule: this.schedule
        };
    }

    /**
     * Calculate required corpus for a given withdrawal plan
     * @param {Number} monthlyWithdrawal - Desired monthly withdrawal
     * @param {Number} years - Duration of withdrawals
     * @param {Number} annualReturn - Expected return
     * @param {Number} inflationRate - Inflation rate
     * @param {Boolean} inflationAdjusted - Adjust withdrawals for inflation
     * @returns {Number} Required initial corpus
     */
    calculateRequiredCorpus(monthlyWithdrawal, years, annualReturn, inflationRate = 0, inflationAdjusted = true) {
        // Use binary search to find required corpus
        let low = monthlyWithdrawal * years * 12; // Minimum (no returns)
        let high = low * 3; // Upper bound
        let iterations = 0;
        const maxIterations = 100;

        while (iterations < maxIterations && high - low > 1000) {
            const mid = (low + high) / 2;
            const result = this.calculate(mid, monthlyWithdrawal, years, annualReturn, inflationRate, inflationAdjusted);

            if (result.depletedAt === null) {
                // Corpus lasted, try lower
                high = mid;
            } else {
                // Corpus depleted, need more
                low = mid;
            }

            iterations++;
        }

        return Math.ceil(high / 100000) * 100000; // Round to nearest lakh
    }

    /**
     * Calculate safe withdrawal rate
     * @param {Number} corpus - Available corpus
     * @param {Number} years - Expected duration
     * @param {Number} annualReturn - Expected return
     * @param {Number} inflationRate - Inflation rate
     * @returns {Number} Safe monthly withdrawal amount
     */
    calculateSafeWithdrawalRate(corpus, years, annualReturn, inflationRate = 0) {
        // Use 4% rule as starting point, adjusted for duration and returns
        const baseRate = 4; // 4% annual
        const adjustedRate = baseRate * (annualReturn / 12); // Adjust for expected returns

        const monthlyRate = adjustedRate / 12 / 100;
        return corpus * monthlyRate;
    }
}

/**
 * Integrated calculator for accumulation + withdrawal
 */
export class RetirementPlanningCalculator {
    constructor() {
        this.sipCalculator = null;
        this.withdrawalCalculator = new WithdrawalCalculator();
    }

    /**
     * Calculate full retirement plan: accumulation + withdrawal
     * @param {Object} accumulationParams - SIP parameters
     * @param {Object} withdrawalParams - Withdrawal parameters
     * @returns {Object} Complete retirement plan
     */
    calculateFullPlan(accumulationParams, withdrawalParams) {
        // Phase 1: Accumulation
        const sipConfig = this.buildSIPConfig(accumulationParams);
        this.sipCalculator = new AdvancedSIPCalculator(sipConfig);
        const accumulationResults = this.sipCalculator.calculate('realistic');

        // Phase 2: Withdrawal
        const withdrawalResults = this.withdrawalCalculator.calculate(
            accumulationResults.finalValue,
            withdrawalParams.monthlyWithdrawal,
            withdrawalParams.years,
            withdrawalParams.returnDuringWithdrawal,
            withdrawalParams.inflationRate,
            withdrawalParams.inflationAdjusted
        );

        return {
            accumulation: accumulationResults,
            withdrawal: withdrawalResults,
            totalDuration: accumulationParams.years + (withdrawalResults.depletedInYears || withdrawalParams.years),
            success: withdrawalResults.lastsThroughPlan
        };
    }

    /**
     * Build SIP configuration from parameters
     */
    buildSIPConfig(params) {
        const config = new SIPConfiguration();
        config.monthlyAmount = params.monthlySIP;
        config.durationYears = params.years;
        config.inflationRate = params.inflationRate || 0;

        // Add return scenario
        const scenario = new ReturnScenario('realistic', []);
        scenario.addPeriod(1, null, params.returnRate);
        config.addReturnScenario('realistic', scenario);

        // Add step-up if provided
        if (params.stepUpPercent && params.stepUpPercent > 0) {
            config.stepUpSchedules.push({
                startYear: 1,
                endYear: null,
                stepUpPercent: params.stepUpPercent
            });
        }

        return config;
    }
}

/**
 * Convenience function for simple SIP calculation (backward compatibility)
 */
export function calculateSimpleSIP(params) {
    const config = new SIPConfiguration();
    config.monthlyAmount = params.sipAmount;
    config.durationYears = params.sipYears;
    config.inflationRate = params.inflationRate || 0;

    // Add return scenario
    const scenario = new ReturnScenario('realistic', []);
    scenario.addPeriod(1, null, params.sipReturn);
    config.addReturnScenario('realistic', scenario);

    // Add step-up if provided
    if (params.sipStepUp && params.sipStepUp > 0) {
        config.stepUpSchedules.push({
            startYear: 1,
            endYear: null,
            stepUpPercent: params.sipStepUp
        });
    }

    const calculator = new AdvancedSIPCalculator(config);
    return calculator.calculate('realistic');
}

// Export instances
export const withdrawalCalculator = new WithdrawalCalculator();
export const retirementPlanner = new RetirementPlanningCalculator();
