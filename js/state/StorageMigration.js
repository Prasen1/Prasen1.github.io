/**
 * Storage Migration Module
 * Handles migration from v1 localStorage format to v2
 */

import {
    LoanConfiguration,
    InterestRatePeriod,
    MonthlyPrepayment,
    YearlyPrepayment,
    OneTimePrepayment,
    LoanScenario,
    SIPScenario,
    SIPConfiguration
} from '../core/DataModels.js';

export class StorageMigration {
    constructor() {
        this.v1Key = 'financialCalculations';
        this.v2Key = 'financialPlannerState';
        this.darkModeKey = 'darkMode';
    }

    /**
     * Check if migration is needed
     * @returns {Boolean} True if v1 data exists but v2 doesn't
     */
    needsMigration() {
        const v1Data = localStorage.getItem(this.v1Key);
        const v2Data = localStorage.getItem(this.v2Key);

        // Migration needed if v1 exists and v2 doesn't exist or is outdated
        if (v1Data && (!v2Data || !this.isV2Valid(v2Data))) {
            return true;
        }

        return false;
    }

    /**
     * Check if v2 data is valid
     */
    isV2Valid(v2DataString) {
        try {
            const data = JSON.parse(v2DataString);
            return data.version === 2;
        } catch (error) {
            return false;
        }
    }

    /**
     * Migrate from v1 to v2
     * @returns {Object} Migration result
     */
    migrate() {
        console.log('Starting migration from v1 to v2...');

        try {
            // Load v1 data
            const v1Data = this.loadV1Data();
            const darkMode = localStorage.getItem(this.darkModeKey) === 'true';

            if (!v1Data || v1Data.length === 0) {
                console.log('No v1 data to migrate');
                return { success: true, migrated: 0 };
            }

            // Convert v1 calculations to v2 scenarios
            const loanScenarios = [];
            const sipScenarios = [];

            v1Data.forEach((calc, index) => {
                try {
                    if (calc.type === 'loan') {
                        const scenario = this.convertLoanCalculation(calc, index);
                        if (scenario) {
                            loanScenarios.push(scenario);
                        }
                    } else if (calc.type === 'sip') {
                        const scenario = this.convertSIPCalculation(calc, index);
                        if (scenario) {
                            sipScenarios.push(scenario);
                        }
                    }
                } catch (error) {
                    console.error(`Error converting calculation ${index}:`, error);
                }
            });

            // Create v2 state structure
            const v2State = {
                version: 2,
                timestamp: Date.now(),
                state: {
                    loanCalculator: {
                        currentConfig: null,
                        scenarios: loanScenarios,
                        activeComparison: null,
                        lastResults: null
                    },
                    sipCalculator: {
                        currentConfig: null,
                        scenarios: sipScenarios,
                        mode: 'forward',
                        lastResults: null
                    },
                    ui: {
                        activeCalculator: 'loan',
                        darkMode: darkMode,
                        expandedSections: {
                            rateChanges: false,
                            prepayments: false,
                            advanced: false
                        }
                    },
                    preferences: {
                        defaultLoanStrategy: 'REDUCE_TENURE',
                        defaultInflationRate: 6,
                        defaultSIPReturn: 12,
                        chartPreferences: {
                            showDataPoints: true,
                            animateCharts: true
                        }
                    }
                },
                // Keep original v1 data for reference
                legacy: {
                    v1Data: v1Data,
                    migratedAt: new Date().toISOString()
                }
            };

            // Save v2 state
            localStorage.setItem(this.v2Key, JSON.stringify(v2State));

            console.log(`Migration complete: ${loanScenarios.length} loan scenarios, ${sipScenarios.length} SIP scenarios`);

            return {
                success: true,
                migrated: v1Data.length,
                loanScenarios: loanScenarios.length,
                sipScenarios: sipScenarios.length
            };
        } catch (error) {
            console.error('Migration failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Load v1 data from localStorage
     */
    loadV1Data() {
        try {
            const data = localStorage.getItem(this.v1Key);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading v1 data:', error);
            return [];
        }
    }

    /**
     * Convert v1 loan calculation to v2 LoanScenario
     */
    convertLoanCalculation(oldCalc, index) {
        try {
            const config = new LoanConfiguration();

            // Basic loan details
            config.principal = oldCalc.data.loanAmount || 0;
            config.baseTenureMonths = (oldCalc.data.loanTenure || 0) * 12;

            // Convert single interest rate to rate schedule
            const interestRate = oldCalc.data.interestRate || 8.5;
            config.addRatePeriod(1, interestRate, null);

            // Convert prepayments based on type
            const prepaymentType = oldCalc.data.prepaymentType;

            if (prepaymentType === 'monthly' && oldCalc.data.extraPayment > 0) {
                const startMonth = oldCalc.data.startPrepaymentMonth || 1;
                config.addMonthlyPrepayment(oldCalc.data.extraPayment, startMonth, null, null);
            } else if (prepaymentType === 'yearly' && oldCalc.data.yearlyPayment > 0) {
                const targetMonth = oldCalc.data.yearlyPaymentMonth || 12;
                config.addYearlyPrepayment(oldCalc.data.yearlyPayment, targetMonth, 1, null, null);
            } else if (prepaymentType === 'one-time' && oldCalc.data.lumpSumAmount > 0) {
                const month = oldCalc.data.lumpSumMonth || 12;
                config.addOneTimePrepayment(oldCalc.data.lumpSumAmount, month, null);
            }

            // Create scenario name from timestamp or index
            const timestamp = oldCalc.formattedDate || oldCalc.timestamp;
            const scenarioName = `Migrated - ${timestamp || `Scenario ${index + 1}`}`;

            const scenario = new LoanScenario(scenarioName, config);

            // Preserve old results if available
            if (oldCalc.data.totalInterestPaid !== undefined) {
                scenario.results = {
                    totalInterest: oldCalc.data.totalInterestPaid,
                    totalPayment: oldCalc.data.totalLoan,
                    months: oldCalc.data.monthsReduced
                        ? config.baseTenureMonths - oldCalc.data.monthsReduced
                        : config.baseTenureMonths,
                    interestSaved: oldCalc.data.interestSaved || 0
                };
            }

            return scenario;
        } catch (error) {
            console.error('Error converting loan calculation:', error);
            return null;
        }
    }

    /**
     * Convert v1 SIP calculation to v2 SIPScenario
     */
    convertSIPCalculation(oldCalc, index) {
        try {
            const config = new SIPConfiguration();

            // Basic SIP details
            config.monthlyAmount = oldCalc.data.sipAmount || 0;
            config.durationYears = oldCalc.data.sipYears || 0;
            config.inflationRate = oldCalc.data.inflationRate || 0;

            // Step-up (if available)
            if (oldCalc.data.sipStepUp && oldCalc.data.sipStepUp > 0) {
                // Note: Old version had simple step-up, new version has schedules
                // We'll need to convert this when implementing the full SIP calculator
                config.stepUpSchedules = [{
                    startYear: 1,
                    endYear: null,
                    stepUpPercent: oldCalc.data.sipStepUp
                }];
            }

            // Convert return rate to return scenario
            const returnRate = oldCalc.data.sipReturn || 12;
            // This will be fully implemented in SIPCalculator.js
            // For now, store the basic return rate

            // Create scenario name
            const timestamp = oldCalc.formattedDate || oldCalc.timestamp;
            const scenarioName = `Migrated - ${timestamp || `SIP ${index + 1}`}`;

            const scenario = new SIPScenario(scenarioName, config);

            // Preserve old results if available
            if (oldCalc.data.finalValue !== undefined) {
                scenario.results = {
                    finalValue: oldCalc.data.finalValue,
                    totalInvested: oldCalc.data.sipAmount * oldCalc.data.sipYears * 12,
                    realReturns: oldCalc.data.realReturns
                };
            }

            return scenario;
        } catch (error) {
            console.error('Error converting SIP calculation:', error);
            return null;
        }
    }

    /**
     * Rollback to v1 (in case of issues)
     */
    rollback() {
        try {
            // Remove v2 data
            localStorage.removeItem(this.v2Key);
            console.log('Rolled back to v1');
            return { success: true };
        } catch (error) {
            console.error('Rollback failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Clean up v1 data (after successful migration and verification)
     */
    cleanupV1Data() {
        try {
            // Don't delete, just mark as archived
            const v1Data = this.loadV1Data();
            if (v1Data && v1Data.length > 0) {
                const archived = {
                    archivedAt: new Date().toISOString(),
                    data: v1Data
                };
                localStorage.setItem('financialCalculations_archived', JSON.stringify(archived));
                localStorage.removeItem(this.v1Key);
                console.log('V1 data archived and cleaned up');
            }
            return { success: true };
        } catch (error) {
            console.error('Cleanup failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get migration status and statistics
     */
    getMigrationStatus() {
        const v1Data = this.loadV1Data();
        const v2DataString = localStorage.getItem(this.v2Key);
        const v2Data = v2DataString ? JSON.parse(v2DataString) : null;

        return {
            v1Exists: !!v1Data && v1Data.length > 0,
            v1Count: v1Data ? v1Data.length : 0,
            v2Exists: !!v2Data,
            v2Valid: v2Data && v2Data.version === 2,
            needsMigration: this.needsMigration(),
            migratedScenarios: v2Data?.state ? {
                loan: v2Data.state.loanCalculator?.scenarios?.length || 0,
                sip: v2Data.state.sipCalculator?.scenarios?.length || 0
            } : null
        };
    }
}

// Create singleton instance
export const storageMigration = new StorageMigration();

/**
 * Auto-migrate on module load if needed
 */
export function autoMigrate() {
    if (storageMigration.needsMigration()) {
        console.log('Automatic migration triggered');
        const result = storageMigration.migrate();

        if (result.success) {
            console.log('✓ Migration successful:', result);
        } else {
            console.error('✗ Migration failed:', result.error);
        }

        return result;
    } else {
        console.log('No migration needed');
        return { success: true, migrated: 0 };
    }
}
