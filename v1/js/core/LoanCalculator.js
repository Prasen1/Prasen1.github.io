/**
 * Advanced Loan Calculator
 * Supports variable interest rates, multiple prepayments, and flexible strategies
 */

import { LoanConfiguration } from './DataModels.js';

export class AdvancedLoanCalculator {
    constructor(config) {
        if (!(config instanceof LoanConfiguration)) {
            throw new TypeError('config must be an instance of LoanConfiguration');
        }

        this.config = config;
        this.amortizationSchedule = [];
        this.currentEMI = 0;
    }

    /**
     * Calculate loan amortization with all features
     * @returns {Object} Calculation results
     */
    calculate() {
        // Validate configuration
        const validation = this.config.validate();
        if (!validation.valid) {
            throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }

        let balance = this.config.principal;
        this.currentEMI = this.calculateInitialEMI();
        let month = 0;
        const maxMonths = this.config.baseTenureMonths * 3; // Safety limit
        let totalInterestPaid = 0;
        let totalPrincipalPaid = 0;

        // Track original loan for comparison (simulate without prepayments)
        const originalEMI = this.currentEMI;
        const originalLoan = this.calculateOriginalLoan();
        const originalMonths = originalLoan.months;
        const originalTotalInterest = originalLoan.totalInterest;

        // Log rate schedule for debugging
        if (this.config.interestRateSchedule.length > 1) {
            console.log('Interest Rate Schedule:', this.config.interestRateSchedule);
        }

        let lastRate = null;

        while (balance > 0.01 && month < maxMonths) {
            month++;

            // Get current interest rate for this month
            const currentRate = this.config.getInterestRateForMonth(month);
            const monthlyRate = currentRate / 100 / 12;

            // Log rate changes
            if (lastRate !== null && lastRate !== currentRate) {
                console.log(`Rate changed at month ${month}: ${lastRate}% → ${currentRate}%`);
            }
            lastRate = currentRate;

            // Calculate interest and principal components
            let interest = balance * monthlyRate;
            let principal = Math.min(this.currentEMI - interest, balance);

            // Ensure principal is not negative (can happen with very low EMI)
            if (principal < 0) {
                principal = 0;
            }

            // Get prepayments for this month
            const prepaymentInfo = this.getPrepaymentForMonth(month);
            let totalPrepayment = prepaymentInfo.amount;
            const strategy = prepaymentInfo.strategy || this.config.defaultStrategy;

            // Apply prepayment
            if (totalPrepayment > 0) {
                // Cap prepayment at remaining balance
                totalPrepayment = Math.min(totalPrepayment, balance - principal);

                if (strategy === 'REDUCE_EMI') {
                    // REDUCE_EMI: Add prepayment to principal, then recalculate EMI
                    principal += totalPrepayment;
                    const newBalance = balance - principal;

                    // Recalculate EMI for remaining balance
                    if (newBalance > 0.01) {
                        const remainingMonths = this.estimateRemainingMonths(newBalance, currentRate);
                        this.currentEMI = this.calculateEMI(newBalance, currentRate, remainingMonths);

                        // Ensure new EMI can cover at least the interest
                        const minEMI = newBalance * monthlyRate * 1.01; // 1% buffer
                        if (this.currentEMI < minEMI) {
                            this.currentEMI = minEMI;
                        }
                    } else {
                        this.currentEMI = 0;
                    }
                } else {
                    // REDUCE_TENURE: Keep EMI same, just add prepayment to principal
                    principal += totalPrepayment;
                }
            }

            // Final adjustment: don't overpay
            if (principal > balance) {
                principal = balance;
            }

            // Update totals
            totalInterestPaid += interest;
            totalPrincipalPaid += principal;
            balance -= principal;

            // Store row in amortization schedule (store all months for complete table)
            this.amortizationSchedule.push({
                month,
                balance: Math.max(balance, 0),
                interest,
                principal,
                emi: this.currentEMI,
                prepayment: totalPrepayment,
                prepaymentType: prepaymentInfo.type,
                rate: currentRate,
                strategy: totalPrepayment > 0 ? strategy : null
            });

            // Break if balance is effectively zero
            if (balance <= 0.01) {
                balance = 0;
                break;
            }
        }

        // Calculate summary results
        const interestSaved = Math.max(originalTotalInterest - totalInterestPaid, 0);
        const tenureReduced = originalMonths - month;
        const totalPayment = totalPrincipalPaid + totalInterestPaid;

        return {
            success: true,
            months: month,
            totalInterest: totalInterestPaid,
            totalPrincipal: totalPrincipalPaid,
            totalPayment: totalPayment,
            interestSaved: interestSaved,
            tenureReduced: tenureReduced,
            originalEMI: originalEMI,
            finalEMI: this.currentEMI,
            originalMonths: originalMonths,
            originalTotalInterest: originalTotalInterest,
            amortizationSchedule: this.amortizationSchedule,
            averageRate: this.calculateAverageRate()
        };
    }

    /**
     * Calculate initial EMI with first interest rate
     */
    calculateInitialEMI() {
        const rate = this.config.interestRateSchedule[0].rate;
        return this.calculateEMI(
            this.config.principal,
            rate,
            this.config.baseTenureMonths
        );
    }

    /**
     * Calculate EMI using standard formula
     * @param {Number} principal - Loan amount
     * @param {Number} annualRate - Annual interest rate percentage
     * @param {Number} months - Tenure in months
     * @returns {Number} EMI amount
     */
    calculateEMI(principal, annualRate, months) {
        if (principal <= 0 || months <= 0) {
            return 0;
        }

        const r = annualRate / 100 / 12;

        if (r === 0) {
            // Special case: zero interest
            return principal / months;
        }

        return (principal * r * Math.pow(1 + r, months)) /
               (Math.pow(1 + r, months) - 1);
    }

    /**
     * Estimate remaining months for a given balance and current EMI
     */
    estimateRemainingMonths(balance, annualRate) {
        if (balance <= 0 || this.currentEMI <= 0) {
            return 0;
        }

        const r = annualRate / 100 / 12;

        if (r === 0) {
            return Math.ceil(balance / this.currentEMI);
        }

        // Using formula: n = log(EMI / (EMI - P*r)) / log(1 + r)
        const numerator = Math.log(this.currentEMI / (this.currentEMI - balance * r));
        const denominator = Math.log(1 + r);

        const months = Math.ceil(numerator / denominator);

        // Sanity check
        if (months < 1) return 1;
        if (months > this.config.baseTenureMonths * 2) return this.config.baseTenureMonths * 2;

        return months;
    }

    /**
     * Get all prepayments for a specific month
     * @param {Number} month - Month number
     * @returns {Object} Prepayment info
     */
    getPrepaymentForMonth(month) {
        let totalAmount = 0;
        const types = [];
        let strategy = null;

        // Check monthly prepayments
        this.config.prepaymentStrategy.monthly.forEach(prep => {
            if (prep.isActiveForMonth(month)) {
                totalAmount += prep.amount;
                types.push('monthly');
                if (prep.strategy) strategy = prep.strategy;
            }
        });

        // Check yearly prepayments
        this.config.prepaymentStrategy.yearly.forEach(prep => {
            if (prep.isActiveForMonth(month)) {
                totalAmount += prep.amount;
                types.push('yearly');
                if (prep.strategy) strategy = prep.strategy;
            }
        });

        // Check one-time prepayments
        this.config.prepaymentStrategy.oneTime.forEach(prep => {
            if (prep.isActiveForMonth(month)) {
                totalAmount += prep.amount;
                types.push('lump-sum');
                if (prep.strategy) strategy = prep.strategy;
            }
        });

        return {
            amount: totalAmount,
            type: types.length > 0 ? types.join(' + ') : 'none',
            strategy: strategy
        };
    }

    /**
     * Calculate original loan (no prepayments) for comparison
     * This method actually simulates the loan to get accurate baseline
     * @returns {Object} Original loan details {months, totalInterest}
     */
    calculateOriginalLoan() {
        let balance = this.config.principal;
        const emi = this.calculateInitialEMI();
        let totalInterest = 0;
        let month = 0;
        const maxMonths = this.config.baseTenureMonths * 2; // Safety limit

        while (balance > 0.01 && month < maxMonths) {
            month++;

            // Get interest rate for this month
            const currentRate = this.config.getInterestRateForMonth(month);
            const monthlyRate = currentRate / 100 / 12;

            // Calculate interest and principal
            const interest = balance * monthlyRate;
            let principal = Math.min(emi - interest, balance);

            if (principal < 0) principal = 0;

            totalInterest += interest;
            balance -= principal;

            if (balance <= 0.01) {
                break;
            }
        }

        return {
            months: month,
            totalInterest: totalInterest
        };
    }

    /**
     * Calculate weighted average interest rate
     */
    calculateAverageRate() {
        if (this.amortizationSchedule.length === 0) {
            return this.config.interestRateSchedule[0]?.rate || 0;
        }

        let totalRate = 0;
        let count = 0;

        this.amortizationSchedule.forEach(row => {
            totalRate += row.rate;
            count++;
        });

        return count > 0 ? totalRate / count : 0;
    }

    /**
     * Generate full amortization table (all months)
     * @returns {Array} Full schedule
     */
    generateFullSchedule() {
        // Re-run calculation without sampling
        const originalSchedule = this.amortizationSchedule;

        let balance = this.config.principal;
        this.currentEMI = this.calculateInitialEMI();
        let month = 0;
        const maxMonths = this.config.baseTenureMonths * 3;
        const fullSchedule = [];

        while (balance > 0.01 && month < maxMonths) {
            month++;

            const currentRate = this.config.getInterestRateForMonth(month);
            const monthlyRate = currentRate / 100 / 12;

            let interest = balance * monthlyRate;
            let principal = Math.min(this.currentEMI - interest, balance);

            if (principal < 0) principal = 0;

            const prepaymentInfo = this.getPrepaymentForMonth(month);
            let totalPrepayment = prepaymentInfo.amount;
            const strategy = prepaymentInfo.strategy || this.config.defaultStrategy;

            if (totalPrepayment > 0) {
                totalPrepayment = Math.min(totalPrepayment, balance - principal);

                if (strategy === 'REDUCE_EMI') {
                    principal += totalPrepayment;
                    const newBalance = balance - principal;

                    if (newBalance > 0.01) {
                        const remainingMonths = this.estimateRemainingMonths(newBalance, currentRate);
                        this.currentEMI = this.calculateEMI(newBalance, currentRate, remainingMonths);

                        const minEMI = newBalance * monthlyRate * 1.01;
                        if (this.currentEMI < minEMI) {
                            this.currentEMI = minEMI;
                        }
                    } else {
                        this.currentEMI = 0;
                    }
                } else {
                    principal += totalPrepayment;
                }
            }

            if (principal > balance) {
                principal = balance;
            }

            balance -= principal;

            fullSchedule.push({
                month,
                balance: Math.max(balance, 0),
                interest,
                principal,
                emi: this.currentEMI,
                prepayment: totalPrepayment,
                prepaymentType: prepaymentInfo.type,
                rate: currentRate,
                strategy: totalPrepayment > 0 ? strategy : null
            });

            if (balance <= 0.01) {
                break;
            }
        }

        // Restore original schedule
        this.amortizationSchedule = originalSchedule;

        return fullSchedule;
    }
}

/**
 * Convenience function to calculate simple loan (backward compatibility)
 * @param {Object} params - Loan parameters
 * @returns {Object} Calculation results
 */
export function calculateSimpleLoan(params) {
    const config = new LoanConfiguration();

    config.principal = params.loanAmount;
    config.baseTenureMonths = params.loanTenure * 12;
    config.addRatePeriod(1, params.interestRate, null);

    // Add prepayments if specified
    if (params.prepaymentType === 'monthly' && params.extraPayment > 0) {
        const startMonth = params.startPrepaymentMonth || 1;
        config.addMonthlyPrepayment(params.extraPayment, startMonth, null, null);
    } else if (params.prepaymentType === 'yearly' && params.yearlyPayment > 0) {
        const targetMonth = params.yearlyPaymentMonth || 12;
        config.addYearlyPrepayment(params.yearlyPayment, targetMonth, 1, null, null);
    } else if (params.prepaymentType === 'one-time' && params.lumpSumAmount > 0) {
        const month = params.lumpSumMonth || 12;
        config.addOneTimePrepayment(params.lumpSumAmount, month, null);
    }

    const calculator = new AdvancedLoanCalculator(config);
    return calculator.calculate();
}
