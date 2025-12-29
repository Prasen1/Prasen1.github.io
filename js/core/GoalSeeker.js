/**
 * Goal-Seeking SIP Calculator
 * Uses Newton-Raphson method to find required SIP for a target amount
 */

export class GoalSeekingSIPCalculator {
    constructor() {
        this.maxIterations = 100;
        this.tolerance = 100; // ₹100 tolerance
    }

    /**
     * Calculate required monthly SIP to reach a target amount
     * @param {Number} targetAmount - Target corpus
     * @param {Number} years - Investment duration in years
     * @param {Number} annualReturn - Expected annual return percentage
     * @param {Number} inflationRate - Expected inflation rate percentage
     * @param {Number} stepUpPercent - Annual step-up percentage (optional)
     * @returns {Object} Calculation results
     */
    calculateRequiredSIP(targetAmount, years, annualReturn, inflationRate = 0, stepUpPercent = 0) {
        // Adjust target for inflation if provided
        const inflationAdjustedTarget = inflationRate > 0
            ? targetAmount * Math.pow(1 + inflationRate / 100, years)
            : targetAmount;

        let requiredSIP;

        if (stepUpPercent > 0) {
            // Use iterative method for step-up SIP
            requiredSIP = this.calculateStepUpSIP(inflationAdjustedTarget, years, annualReturn, stepUpPercent);
        } else {
            // Use Newton-Raphson for regular SIP
            requiredSIP = this.newtonRaphsonMethod(inflationAdjustedTarget, years, annualReturn);
        }

        // Calculate achieved amount with the required SIP
        const achievedAmount = stepUpPercent > 0
            ? this.calculateStepUpFutureValue(requiredSIP, years, annualReturn, stepUpPercent)
            : this.calculateFutureValue(requiredSIP, years, annualReturn);

        // Calculate total investment
        const totalInvestment = stepUpPercent > 0
            ? this.calculateStepUpTotalInvestment(requiredSIP, years, stepUpPercent)
            : requiredSIP * years * 12;

        // Calculate real returns (inflation adjusted)
        const realValue = inflationRate > 0
            ? achievedAmount / Math.pow(1 + inflationRate / 100, years)
            : achievedAmount;

        return {
            success: true,
            requiredSIP: Math.ceil(requiredSIP / 100) * 100, // Round to nearest 100
            targetAmount: targetAmount,
            inflationAdjustedTarget: inflationAdjustedTarget,
            achievedAmount: achievedAmount,
            totalInvestment: totalInvestment,
            wealthGain: achievedAmount - totalInvestment,
            realValue: realValue,
            years: years,
            annualReturn: annualReturn,
            inflationRate: inflationRate,
            stepUpPercent: stepUpPercent
        };
    }

    /**
     * Newton-Raphson method for finding required SIP
     * @param {Number} targetAmount - Target corpus
     * @param {Number} years - Investment duration
     * @param {Number} annualReturn - Annual return percentage
     * @returns {Number} Required SIP amount
     */
    newtonRaphsonMethod(targetAmount, years, annualReturn) {
        // Initial guess: simple average
        let sip = targetAmount / (years * 12);

        let iterations = 0;

        while (iterations < this.maxIterations) {
            const fv = this.calculateFutureValue(sip, years, annualReturn);
            const error = fv - targetAmount;

            // Check convergence
            if (Math.abs(error) < this.tolerance) {
                return sip;
            }

            // Calculate derivative (numerical approximation)
            const delta = 1; // Small increment
            const fvPlusDelta = this.calculateFutureValue(sip + delta, years, annualReturn);
            const derivative = (fvPlusDelta - fv) / delta;

            // Avoid division by zero
            if (Math.abs(derivative) < 0.001) {
                break;
            }

            // Newton-Raphson update
            sip = sip - (error / derivative);

            // Ensure SIP stays positive
            if (sip < 100) {
                sip = 100;
            }

            iterations++;
        }

        // Fallback to binary search if Newton-Raphson doesn't converge
        if (iterations >= this.maxIterations) {
            console.warn('Newton-Raphson did not converge, using binary search');
            return this.binarySearchMethod(targetAmount, years, annualReturn);
        }

        return sip;
    }

    /**
     * Binary search fallback method
     * @param {Number} targetAmount - Target corpus
     * @param {Number} years - Investment duration
     * @param {Number} annualReturn - Annual return percentage
     * @returns {Number} Required SIP amount
     */
    binarySearchMethod(targetAmount, years, annualReturn) {
        let low = 100;
        let high = targetAmount / 12; // Upper bound
        let iterations = 0;

        while (iterations < this.maxIterations && high - low > 1) {
            const mid = (low + high) / 2;
            const fv = this.calculateFutureValue(mid, years, annualReturn);

            if (Math.abs(fv - targetAmount) < this.tolerance) {
                return mid;
            }

            if (fv < targetAmount) {
                low = mid;
            } else {
                high = mid;
            }

            iterations++;
        }

        return (low + high) / 2;
    }

    /**
     * Calculate future value of regular SIP
     * @param {Number} monthlySIP - Monthly investment
     * @param {Number} years - Duration in years
     * @param {Number} annualReturn - Annual return percentage
     * @returns {Number} Future value
     */
    calculateFutureValue(monthlySIP, years, annualReturn) {
        const months = years * 12;
        const r = annualReturn / 100 / 12;

        if (r === 0) {
            // Zero return case
            return monthlySIP * months;
        }

        // Standard SIP FV formula: P * [(1+r)^n - 1] / r * (1+r)
        return monthlySIP * ((Math.pow(1 + r, months) - 1) / r) * (1 + r);
    }

    /**
     * Calculate required SIP with step-up
     * @param {Number} targetAmount - Target corpus
     * @param {Number} years - Duration in years
     * @param {Number} annualReturn - Annual return percentage
     * @param {Number} stepUpPercent - Annual step-up percentage
     * @returns {Number} Required initial SIP
     */
    calculateStepUpSIP(targetAmount, years, annualReturn, stepUpPercent) {
        // Use iterative approach for step-up SIP
        let low = 100;
        let high = targetAmount / 12;
        let iterations = 0;

        while (iterations < this.maxIterations && high - low > 1) {
            const mid = (low + high) / 2;
            const fv = this.calculateStepUpFutureValue(mid, years, annualReturn, stepUpPercent);

            if (Math.abs(fv - targetAmount) < this.tolerance) {
                return mid;
            }

            if (fv < targetAmount) {
                low = mid;
            } else {
                high = mid;
            }

            iterations++;
        }

        return (low + high) / 2;
    }

    /**
     * Calculate future value with step-up SIP
     * @param {Number} initialSIP - Initial monthly SIP
     * @param {Number} years - Duration in years
     * @param {Number} annualReturn - Annual return percentage
     * @param {Number} stepUpPercent - Annual step-up percentage
     * @returns {Number} Future value
     */
    calculateStepUpFutureValue(initialSIP, years, annualReturn, stepUpPercent) {
        let totalAmount = 0;
        let currentSIP = initialSIP;
        const monthlyReturn = annualReturn / 100 / 12;

        for (let year = 1; year <= years; year++) {
            // Calculate for this year
            for (let month = 1; month <= 12; month++) {
                totalAmount = (totalAmount + currentSIP) * (1 + monthlyReturn);
            }

            // Step up for next year
            if (year < years) {
                currentSIP *= (1 + stepUpPercent / 100);
            }
        }

        return totalAmount;
    }

    /**
     * Calculate total investment with step-up
     * @param {Number} initialSIP - Initial monthly SIP
     * @param {Number} years - Duration in years
     * @param {Number} stepUpPercent - Annual step-up percentage
     * @returns {Number} Total invested amount
     */
    calculateStepUpTotalInvestment(initialSIP, years, stepUpPercent) {
        let totalInvestment = 0;
        let currentSIP = initialSIP;

        for (let year = 1; year <= years; year++) {
            totalInvestment += currentSIP * 12;

            // Step up for next year
            if (year < years) {
                currentSIP *= (1 + stepUpPercent / 100);
            }
        }

        return totalInvestment;
    }

    /**
     * Calculate multiple scenarios (optimistic, realistic, pessimistic)
     * @param {Number} targetAmount - Target corpus
     * @param {Number} years - Duration in years
     * @param {Object} returnScenarios - Map of scenario names to return rates
     * @param {Number} inflationRate - Expected inflation
     * @returns {Object} Results for all scenarios
     */
    calculateScenarios(targetAmount, years, returnScenarios, inflationRate = 0) {
        const results = {};

        for (const [scenarioName, returnRate] of Object.entries(returnScenarios)) {
            results[scenarioName] = this.calculateRequiredSIP(
                targetAmount,
                years,
                returnRate,
                inflationRate,
                0 // No step-up for scenario comparison
            );
        }

        return results;
    }

    /**
     * Calculate probability of reaching goal with given SIP
     * Uses Monte Carlo-like approach with different return scenarios
     * @param {Number} monthlySIP - Monthly SIP amount
     * @param {Number} targetAmount - Target corpus
     * @param {Number} years - Duration in years
     * @param {Number} expectedReturn - Expected return
     * @param {Number} volatility - Return volatility (standard deviation)
     * @returns {Object} Probability analysis
     */
    calculateGoalProbability(monthlySIP, targetAmount, years, expectedReturn, volatility = 5) {
        const scenarios = {
            worst: expectedReturn - volatility,
            pessimistic: expectedReturn - (volatility / 2),
            realistic: expectedReturn,
            optimistic: expectedReturn + (volatility / 2),
            best: expectedReturn + volatility
        };

        const outcomes = {};
        let successCount = 0;

        for (const [scenarioName, returnRate] of Object.entries(scenarios)) {
            const fv = this.calculateFutureValue(monthlySIP, years, returnRate);
            outcomes[scenarioName] = {
                returnRate: returnRate,
                achievedAmount: fv,
                success: fv >= targetAmount,
                shortfall: Math.max(0, targetAmount - fv)
            };

            if (fv >= targetAmount) {
                successCount++;
            }
        }

        return {
            probability: (successCount / Object.keys(scenarios).length) * 100,
            scenarios: outcomes,
            recommendation: successCount >= 3 ? 'Likely to achieve goal' :
                            successCount >= 2 ? 'Moderate chance of achieving goal' :
                            'Consider increasing SIP or duration'
        };
    }
}

// Create singleton instance
export const goalSeeker = new GoalSeekingSIPCalculator();
