/**
 * Data Models for Financial Planning Application
 * Contains all class definitions for loan and SIP configurations
 */

// ============================
// LOAN DATA MODELS
// ============================

/**
 * Represents an interest rate period in a loan
 */
export class InterestRatePeriod {
    constructor(startMonth, rate, endMonth = null) {
        this.startMonth = startMonth; // 1-indexed month number
        this.rate = rate; // Annual percentage rate
        this.endMonth = endMonth; // null means till end of loan
    }

    /**
     * Check if this rate period is active for the given month
     */
    isActiveForMonth(month) {
        return month >= this.startMonth &&
               (this.endMonth === null || month <= this.endMonth);
    }
}

/**
 * Represents a monthly prepayment schedule
 */
export class MonthlyPrepayment {
    constructor(amount, startMonth = 1, endMonth = null, strategy = null) {
        this.amount = amount; // Amount to prepay each month
        this.startMonth = startMonth; // Start from this month
        this.endMonth = endMonth; // null = till loan ends
        this.strategy = strategy; // 'REDUCE_TENURE' | 'REDUCE_EMI' | null (use default)
    }

    /**
     * Check if prepayment is active for the given month
     */
    isActiveForMonth(month) {
        return month >= this.startMonth &&
               (this.endMonth === null || month <= this.endMonth);
    }
}

/**
 * Represents a yearly prepayment schedule
 */
export class YearlyPrepayment {
    constructor(amount, targetMonth = 12, startYear = 1, endYear = null, strategy = null) {
        this.amount = amount; // Amount to prepay each year
        this.targetMonth = targetMonth; // Month of year (1-12) to make payment
        this.startYear = startYear; // Start from this year
        this.endYear = endYear; // null = every year
        this.strategy = strategy; // 'REDUCE_TENURE' | 'REDUCE_EMI' | null (use default)
    }

    /**
     * Check if prepayment is active for the given month
     */
    isActiveForMonth(month) {
        const yearOfLoan = Math.ceil(month / 12);
        const monthInYear = ((month - 1) % 12) + 1;

        return monthInYear === this.targetMonth &&
               yearOfLoan >= this.startYear &&
               (this.endYear === null || yearOfLoan <= this.endYear);
    }
}

/**
 * Represents a one-time lump sum prepayment
 */
export class OneTimePrepayment {
    constructor(amount, month, strategy = null) {
        this.amount = amount; // Lump sum amount
        this.month = month; // Specific month number
        this.strategy = strategy; // 'REDUCE_TENURE' | 'REDUCE_EMI' | null (use default)
    }

    /**
     * Check if prepayment is active for the given month
     */
    isActiveForMonth(month) {
        return month === this.month;
    }
}

/**
 * Represents a complete loan configuration
 */
export class LoanConfiguration {
    constructor() {
        this.principal = 0; // Loan amount
        this.baseTenureMonths = 0; // Original tenure in months
        this.interestRateSchedule = []; // Array of InterestRatePeriod
        this.prepaymentStrategy = {
            monthly: [], // Array of MonthlyPrepayment
            yearly: [],  // Array of YearlyPrepayment
            oneTime: []  // Array of OneTimePrepayment
        };
        this.defaultStrategy = 'REDUCE_TENURE'; // or 'REDUCE_EMI'
    }

    /**
     * Add an interest rate period
     */
    addRatePeriod(startMonth, rate, endMonth = null) {
        this.interestRateSchedule.push(new InterestRatePeriod(startMonth, rate, endMonth));
        // Sort by start month
        this.interestRateSchedule.sort((a, b) => a.startMonth - b.startMonth);
    }

    /**
     * Add a monthly prepayment
     */
    addMonthlyPrepayment(amount, startMonth = 1, endMonth = null, strategy = null) {
        this.prepaymentStrategy.monthly.push(
            new MonthlyPrepayment(amount, startMonth, endMonth, strategy)
        );
    }

    /**
     * Add a yearly prepayment
     */
    addYearlyPrepayment(amount, targetMonth = 12, startYear = 1, endYear = null, strategy = null) {
        this.prepaymentStrategy.yearly.push(
            new YearlyPrepayment(amount, targetMonth, startYear, endYear, strategy)
        );
    }

    /**
     * Add a one-time prepayment
     */
    addOneTimePrepayment(amount, month, strategy = null) {
        this.prepaymentStrategy.oneTime.push(
            new OneTimePrepayment(amount, month, strategy)
        );
    }

    /**
     * Get the interest rate for a specific month
     * Returns the LAST matching rate period (most recent override)
     */
    getInterestRateForMonth(month) {
        let applicableRate = null;

        // Iterate through all periods and find the last one that applies
        for (const period of this.interestRateSchedule) {
            if (period.isActiveForMonth(month)) {
                applicableRate = period.rate;
            }
        }

        // Return the last matching rate, or first rate as fallback
        return applicableRate !== null ? applicableRate : (this.interestRateSchedule[0]?.rate || 0);
    }

    /**
     * Validate the configuration
     */
    validate() {
        const errors = [];

        if (this.principal <= 0) {
            errors.push('Principal must be greater than 0');
        }

        if (this.baseTenureMonths <= 0) {
            errors.push('Tenure must be greater than 0');
        }

        if (this.interestRateSchedule.length === 0) {
            errors.push('At least one interest rate period is required');
        }

        // Check for problematic overlapping rate periods
        // Note: We allow overlaps where an earlier period has endMonth=null and is overridden by a later period
        // The getInterestRateForMonth method handles this by returning the last matching period
        for (let i = 0; i < this.interestRateSchedule.length - 1; i++) {
            const current = this.interestRateSchedule[i];
            const next = this.interestRateSchedule[i + 1];

            // Only warn about overlaps if the current period has a specific end month
            // and it overlaps with the next period's start
            if (current.endMonth !== null && next.startMonth <= current.endMonth) {
                errors.push(`Rate periods have explicit overlap at month ${next.startMonth}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

/**
 * Represents a saved loan scenario
 */
export class LoanScenario {
    constructor(name, config) {
        this.id = this.generateUUID();
        this.name = name;
        this.config = config; // LoanConfiguration instance
        this.results = null; // Calculated results (set after calculation)
        this.createdAt = Date.now();
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}

/**
 * Manages comparison of multiple loan scenarios
 */
export class ScenarioComparison {
    constructor() {
        this.scenarios = []; // Array of LoanScenario
        this.baseScenarioId = null; // Reference scenario for comparisons
    }

    addScenario(scenario) {
        this.scenarios.push(scenario);
        if (this.scenarios.length === 1) {
            this.baseScenarioId = scenario.id;
        }
    }

    removeScenario(scenarioId) {
        this.scenarios = this.scenarios.filter(s => s.id !== scenarioId);
        if (this.baseScenarioId === scenarioId && this.scenarios.length > 0) {
            this.baseScenarioId = this.scenarios[0].id;
        }
    }

    getScenarioById(scenarioId) {
        return this.scenarios.find(s => s.id === scenarioId);
    }

    /**
     * Get comparison metrics relative to base scenario
     */
    getComparativeMetrics() {
        const baseScenario = this.getScenarioById(this.baseScenarioId);
        if (!baseScenario || !baseScenario.results) {
            return [];
        }

        return this.scenarios.map(scenario => {
            if (!scenario.results) return null;

            const interestSaved = baseScenario.results.totalInterest - scenario.results.totalInterest;
            const tenureReduced = baseScenario.results.months - scenario.results.months;

            return {
                id: scenario.id,
                name: scenario.name,
                totalInterest: scenario.results.totalInterest,
                totalPayment: scenario.results.totalPayment,
                months: scenario.results.months,
                interestSavedVsBase: interestSaved,
                tenureReducedVsBase: tenureReduced,
                isBase: scenario.id === this.baseScenarioId
            };
        }).filter(m => m !== null);
    }
}

// ============================
// SIP DATA MODELS
// ============================

/**
 * Represents a return period for SIP calculations
 */
export class ReturnPeriod {
    constructor(startYear, endYear, annualReturn) {
        this.startYear = startYear;
        this.endYear = endYear; // null = till end
        this.annualReturn = annualReturn; // Annual percentage return
    }

    isActiveForYear(year) {
        return year >= this.startYear &&
               (this.endYear === null || year <= this.endYear);
    }
}

/**
 * Represents a return scenario (optimistic/realistic/pessimistic)
 */
export class ReturnScenario {
    constructor(name, periods = []) {
        this.name = name; // "Optimistic", "Realistic", "Pessimistic", etc.
        this.periods = periods; // Array of ReturnPeriod
    }

    addPeriod(startYear, endYear, annualReturn) {
        this.periods.push(new ReturnPeriod(startYear, endYear, annualReturn));
        // Sort by start year
        this.periods.sort((a, b) => a.startYear - b.startYear);
    }

    getReturnForYear(year) {
        for (const period of this.periods) {
            if (period.isActiveForYear(year)) {
                return period.annualReturn;
            }
        }
        // Return first period's return as fallback
        return this.periods[0]?.annualReturn || 0;
    }
}

/**
 * Represents a step-up schedule for SIP
 */
export class StepUpSchedule {
    constructor(startYear, endYear, stepUpPercent) {
        this.startYear = startYear;
        this.endYear = endYear; // null = till end
        this.stepUpPercent = stepUpPercent; // Annual step-up percentage
    }
}

/**
 * Represents a withdrawal plan for retirement planning
 */
export class WithdrawalPlan {
    constructor(startMonth, monthlyWithdrawal, inflationAdjusted = true) {
        this.startMonth = startMonth; // Month to start withdrawals
        this.monthlyWithdrawal = monthlyWithdrawal; // Initial withdrawal amount
        this.inflationAdjusted = inflationAdjusted; // Whether to adjust for inflation
    }
}

/**
 * Represents a goal-based SIP calculation
 */
export class GoalBasedSIP {
    constructor(targetAmount, durationYears, inflationRate = 0) {
        this.targetAmount = targetAmount; // Target corpus
        this.durationYears = durationYears; // Time horizon
        this.inflationRate = inflationRate; // Expected inflation
        this.calculatedSIP = 0; // Reverse-calculated SIP (set after calculation)
    }
}

/**
 * Represents a complete SIP configuration
 */
export class SIPConfiguration {
    constructor() {
        this.monthlyAmount = 0; // Monthly SIP amount
        this.durationYears = 0; // Investment duration
        this.stepUpSchedules = []; // Array of StepUpSchedule
        this.returnScenarios = {}; // Map of scenario name to ReturnScenario
        this.withdrawalPlan = null; // WithdrawalPlan instance
        this.inflationRate = 0; // Expected inflation rate
    }

    addReturnScenario(name, scenario) {
        this.returnScenarios[name] = scenario;
    }

    setWithdrawalPlan(startMonth, monthlyWithdrawal, inflationAdjusted = true) {
        this.withdrawalPlan = new WithdrawalPlan(startMonth, monthlyWithdrawal, inflationAdjusted);
    }

    /**
     * Validate the configuration
     */
    validate() {
        const errors = [];

        if (this.monthlyAmount <= 0) {
            errors.push('Monthly SIP amount must be greater than 0');
        }

        if (this.durationYears <= 0) {
            errors.push('Duration must be greater than 0');
        }

        if (Object.keys(this.returnScenarios).length === 0) {
            errors.push('At least one return scenario is required');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}

/**
 * Represents an asset allocation entry
 */
export class AssetAllocation {
    constructor(name, monthlySIP, currentValue, targetPercent) {
        this.name = name; // e.g., "Equity Large Cap"
        this.monthlySIP = monthlySIP; // Monthly SIP for this asset
        this.currentValue = currentValue; // Current portfolio value
        this.targetPercent = targetPercent; // Target allocation percentage
    }
}

/**
 * Manages portfolio asset allocation
 */
export class PortfolioAllocation {
    constructor() {
        this.allocations = []; // Array of AssetAllocation
    }

    addAllocation(name, monthlySIP, currentValue, targetPercent) {
        this.allocations.push(new AssetAllocation(name, monthlySIP, currentValue, targetPercent));
    }

    /**
     * Calculate current allocation percentages
     */
    calculateCurrentAllocation() {
        const totalValue = this.allocations.reduce((sum, a) => sum + a.currentValue, 0);

        return this.allocations.map(a => ({
            name: a.name,
            currentPercent: totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0,
            targetPercent: a.targetPercent,
            currentValue: a.currentValue
        }));
    }

    /**
     * Calculate rebalancing requirements
     */
    calculateRebalancing() {
        const totalValue = this.allocations.reduce((sum, a) => sum + a.currentValue, 0);

        return this.allocations.map(a => {
            const currentPercent = totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0;
            const targetValue = (a.targetPercent / 100) * totalValue;
            const rebalanceAmount = targetValue - a.currentValue;

            return {
                name: a.name,
                currentValue: a.currentValue,
                targetValue: targetValue,
                rebalanceAmount: rebalanceAmount,
                action: rebalanceAmount > 0 ? 'BUY' : rebalanceAmount < 0 ? 'SELL' : 'HOLD'
            };
        });
    }
}

/**
 * Represents a saved SIP scenario
 */
export class SIPScenario {
    constructor(name, config) {
        this.id = this.generateUUID();
        this.name = name;
        this.config = config; // SIPConfiguration instance
        this.results = null; // Calculated results (set after calculation)
        this.createdAt = Date.now();
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
