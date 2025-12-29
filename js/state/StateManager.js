/**
 * State Manager for Financial Planning Application
 * Centralized state management with pub-sub pattern and localStorage persistence
 */

export class FinancialPlannerState {
    constructor() {
        this.state = {
            loanCalculator: {
                currentConfig: null,    // Current LoanConfiguration
                scenarios: [],          // Array of LoanScenario
                activeComparison: null, // ScenarioComparison instance
                lastResults: null       // Last calculation results
            },
            sipCalculator: {
                currentConfig: null,    // Current SIPConfiguration
                scenarios: [],          // Array of SIPScenario
                mode: 'forward',        // 'forward' | 'goal' | 'retirement'
                lastResults: null       // Last calculation results
            },
            ui: {
                activeCalculator: 'loan', // 'loan' | 'sip'
                darkMode: false,
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
        };

        this.listeners = [];
        this.persistTimer = null;

        // Load persisted state
        this.loadState();
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback function that receives the new state
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Listener must be a function');
        }

        this.listeners.push(listener);

        // Return unsubscribe function
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    /**
     * Get current state or a specific path in the state
     * @param {String} path - Dot-separated path (e.g., 'loanCalculator.scenarios')
     * @returns {Any} State value at path or entire state if no path provided
     */
    getState(path = null) {
        if (!path) {
            return this.state;
        }

        return this.getNestedValue(this.state, path.split('.'));
    }

    /**
     * Set state at a specific path
     * @param {String} path - Dot-separated path
     * @param {Any} value - New value
     */
    setState(path, value) {
        this.updateNestedState(this.state, path.split('.'), value);
        this.notifyListeners();
        this.persistState();
    }

    /**
     * Merge an object into state at a specific path
     * @param {String} path - Dot-separated path
     * @param {Object} updates - Object to merge
     */
    mergeState(path, updates) {
        const current = this.getState(path);
        if (typeof current !== 'object' || current === null) {
            throw new Error(`Cannot merge into non-object at path: ${path}`);
        }

        const merged = { ...current, ...updates };
        this.setState(path, merged);
    }

    /**
     * Reset state to initial values
     */
    resetState() {
        // Preserve preferences
        const preferences = { ...this.state.preferences };

        this.state = {
            loanCalculator: {
                currentConfig: null,
                scenarios: [],
                activeComparison: null,
                lastResults: null
            },
            sipCalculator: {
                currentConfig: null,
                scenarios: [],
                mode: 'forward',
                lastResults: null
            },
            ui: {
                activeCalculator: 'loan',
                darkMode: false,
                expandedSections: {
                    rateChanges: false,
                    prepayments: false,
                    advanced: false
                }
            },
            preferences: preferences
        };

        this.notifyListeners();
        this.persistState();
    }

    /**
     * Notify all subscribers of state changes
     */
    notifyListeners() {
        const stateSnapshot = JSON.parse(JSON.stringify(this.state));
        this.listeners.forEach(listener => {
            try {
                listener(stateSnapshot);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }

    /**
     * Save state to localStorage (debounced)
     */
    persistState() {
        // Clear existing timer
        if (this.persistTimer) {
            clearTimeout(this.persistTimer);
        }

        // Debounce persistence to avoid excessive writes
        this.persistTimer = setTimeout(() => {
            try {
                const serializedState = JSON.stringify({
                    version: 2,
                    timestamp: Date.now(),
                    state: this.state
                });

                localStorage.setItem('financialPlannerState', serializedState);
                console.log('State persisted to localStorage');
            } catch (error) {
                console.error('Error persisting state:', error);
                // Check if localStorage is full
                if (error.name === 'QuotaExceededError') {
                    console.warn('localStorage quota exceeded. Cleaning up old scenarios...');
                    this.cleanupOldScenarios();
                }
            }
        }, 500); // 500ms debounce
    }

    /**
     * Load state from localStorage
     */
    loadState() {
        try {
            const serialized = localStorage.getItem('financialPlannerState');
            if (!serialized) {
                console.log('No persisted state found');
                return;
            }

            const data = JSON.parse(serialized);

            // Version check
            if (data.version === 2 && data.state) {
                // Merge persisted state with default state (preserves new fields)
                this.state = this.deepMerge(this.state, data.state);
                console.log('State loaded from localStorage');
            } else {
                console.log('Old state version detected, migration may be needed');
            }
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }

    /**
     * Clean up old scenarios to free up space
     */
    cleanupOldScenarios() {
        // Keep only last 5 scenarios for each calculator
        if (this.state.loanCalculator.scenarios.length > 5) {
            this.state.loanCalculator.scenarios = this.state.loanCalculator.scenarios
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 5);
        }

        if (this.state.sipCalculator.scenarios.length > 5) {
            this.state.sipCalculator.scenarios = this.state.sipCalculator.scenarios
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 5);
        }

        this.notifyListeners();
        this.persistState();
    }

    /**
     * Get nested value from object using path array
     */
    getNestedValue(obj, pathArray) {
        return pathArray.reduce((current, key) => {
            return current?.[key];
        }, obj);
    }

    /**
     * Update nested value in object using path array
     */
    updateNestedState(obj, pathArray, value) {
        const lastKey = pathArray.pop();
        const target = pathArray.reduce((current, key) => {
            if (typeof current[key] !== 'object' || current[key] === null) {
                current[key] = {};
            }
            return current[key];
        }, obj);

        target[lastKey] = value;
    }

    /**
     * Deep merge two objects
     */
    deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] instanceof Object && key in target) {
                result[key] = this.deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    }

    /**
     * Get storage usage statistics
     */
    getStorageStats() {
        try {
            const state = localStorage.getItem('financialPlannerState');
            const sizeInBytes = new Blob([state]).size;
            const sizeInKB = (sizeInBytes / 1024).toFixed(2);
            const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

            // Estimate localStorage limit (usually 5-10MB)
            const estimatedLimit = 5 * 1024 * 1024; // 5MB
            const usagePercent = ((sizeInBytes / estimatedLimit) * 100).toFixed(2);

            return {
                sizeInBytes,
                sizeInKB,
                sizeInMB,
                usagePercent,
                loanScenarios: this.state.loanCalculator.scenarios.length,
                sipScenarios: this.state.sipCalculator.scenarios.length
            };
        } catch (error) {
            console.error('Error calculating storage stats:', error);
            return null;
        }
    }

    /**
     * Export state as JSON (for backup/sharing)
     */
    exportState() {
        return JSON.stringify({
            version: 2,
            exportedAt: new Date().toISOString(),
            state: this.state
        }, null, 2);
    }

    /**
     * Import state from JSON
     */
    importState(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            if (data.version !== 2) {
                throw new Error('Invalid state version');
            }

            // Merge imported state
            this.state = this.deepMerge(this.state, data.state);
            this.notifyListeners();
            this.persistState();

            return { success: true };
        } catch (error) {
            console.error('Error importing state:', error);
            return { success: false, error: error.message };
        }
    }
}

// Create singleton instance
export const stateManager = new FinancialPlannerState();
