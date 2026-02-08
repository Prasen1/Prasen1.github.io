/**
 * Loan Calculator UI Controller
 * Handles UI interactions for advanced loan features
 */

import { stateManager } from '../state/StateManager.js';
import { LoanConfiguration, InterestRatePeriod, MonthlyPrepayment, YearlyPrepayment, OneTimePrepayment } from '../core/DataModels.js';
import { formatCurrency, formatPercentage } from '../utils/formatters.js';

export class LoanUIController {
    constructor() {
        this.rateChanges = [];
        this.multiplePrepayments = {
            monthly: [],
            yearly: [],
            oneTime: []
        };
        this.activeTab = 'monthly';
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
        this.setupEventListeners();
        this.loadFromState();
    }

    setupEventListeners() {
        // Accordion toggles
        const toggleRateChanges = document.getElementById('toggleRateChanges');
        const toggleMultiplePrepayments = document.getElementById('toggleMultiplePrepayments');

        if (toggleRateChanges) {
            toggleRateChanges.addEventListener('click', () => {
                this.toggleSection('rateChangesSection', toggleRateChanges);
            });
        }

        if (toggleMultiplePrepayments) {
            toggleMultiplePrepayments.addEventListener('click', () => {
                this.toggleSection('multiplePrepaymentsSection', toggleMultiplePrepayments);
            });
        }

        // Add buttons
        const addRateChange = document.getElementById('addRateChange');
        const addMultiplePrepayment = document.getElementById('addMultiplePrepayment');

        if (addRateChange) {
            addRateChange.addEventListener('click', () => this.addRateChange());
        }

        if (addMultiplePrepayment) {
            addMultiplePrepayment.addEventListener('click', () => this.addPrepayment());
        }

        // Tab buttons
        const tabButtons = document.querySelectorAll('[data-prepayment-tab]');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.prepaymentTab);
            });
        });
    }

    toggleSection(sectionId, buttonElement) {
        const section = document.getElementById(sectionId);
        if (!section) return;

        const isHidden = section.classList.contains('hidden');
        section.classList.toggle('hidden');

        // Update arrow indicator
        const arrow = buttonElement.querySelector('span');
        if (arrow) {
            arrow.textContent = isHidden ? '▲ ' + arrow.textContent.substring(2) : '▼ ' + arrow.textContent.substring(2);
        }
    }

    switchTab(tabName) {
        this.activeTab = tabName;

        // Update tab button states
        const tabButtons = document.querySelectorAll('[data-prepayment-tab]');
        tabButtons.forEach(button => {
            if (button.dataset.prepaymentTab === tabName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Render prepayments for active tab
        this.renderPrepayments();
    }

    addRateChange() {
        const id = Date.now().toString();
        const rateChange = {
            id,
            startMonth: 1,
            endMonth: null,
            rate: 8.5
        };

        this.rateChanges.push(rateChange);
        this.saveToState();
        this.renderRateChanges();
    }

    removeRateChange(id) {
        this.rateChanges = this.rateChanges.filter(r => r.id !== id);
        this.saveToState();
        this.renderRateChanges();
    }

    updateRateChange(id, field, value) {
        const rateChange = this.rateChanges.find(r => r.id === id);
        if (rateChange) {
            if (field === 'startMonth' || field === 'endMonth') {
                rateChange[field] = value ? parseInt(value) : null;
            } else if (field === 'rate') {
                rateChange[field] = parseFloat(value);
            }
            this.saveToState();
        }
    }

    renderRateChanges() {
        const container = document.getElementById('rateChangesList');
        if (!container) return;

        if (this.rateChanges.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-sm">No rate changes added. The loan will use the default interest rate throughout.</p>';
            return;
        }

        // Sort by start month
        const sorted = [...this.rateChanges].sort((a, b) => a.startMonth - b.startMonth);

        container.innerHTML = sorted.map(rc => `
            <div class="rate-change-item p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400">From Month</label>
                        <input type="number"
                            class="w-full p-1 border rounded text-sm"
                            value="${rc.startMonth}"
                            min="1"
                            data-rate-id="${rc.id}"
                            data-field="startMonth"
                            onchange="loanUIController.updateRateChange('${rc.id}', 'startMonth', this.value)">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400">To Month (blank = till end)</label>
                        <input type="number"
                            class="w-full p-1 border rounded text-sm"
                            value="${rc.endMonth || ''}"
                            placeholder="Till end"
                            data-rate-id="${rc.id}"
                            data-field="endMonth"
                            onchange="loanUIController.updateRateChange('${rc.id}', 'endMonth', this.value)">
                    </div>
                    <div>
                        <label class="block text-xs text-gray-600 dark:text-gray-400">Interest Rate (%)</label>
                        <input type="number"
                            class="w-full p-1 border rounded text-sm"
                            value="${rc.rate}"
                            step="0.1"
                            min="0"
                            data-rate-id="${rc.id}"
                            data-field="rate"
                            onchange="loanUIController.updateRateChange('${rc.id}', 'rate', this.value)">
                    </div>
                    <div class="flex items-end">
                        <button class="btn-danger text-sm px-2 py-1" onclick="loanUIController.removeRateChange('${rc.id}')">Remove</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    addPrepayment() {
        const id = Date.now().toString();
        const type = this.activeTab;

        let prepayment;
        if (type === 'monthly') {
            prepayment = {
                id,
                type: 'monthly',
                amount: 5000,
                startMonth: 1,
                endMonth: null,
                strategy: null
            };
            this.multiplePrepayments.monthly.push(prepayment);
        } else if (type === 'yearly') {
            prepayment = {
                id,
                type: 'yearly',
                amount: 50000,
                targetMonth: 12,
                startYear: 1,
                endYear: null,
                strategy: null
            };
            this.multiplePrepayments.yearly.push(prepayment);
        } else if (type === 'oneTime') {
            prepayment = {
                id,
                type: 'oneTime',
                amount: 100000,
                month: 12,
                strategy: null
            };
            this.multiplePrepayments.oneTime.push(prepayment);
        }

        this.saveToState();
        this.renderPrepayments();
    }

    removePrepayment(type, id) {
        this.multiplePrepayments[type] = this.multiplePrepayments[type].filter(p => p.id !== id);
        this.saveToState();
        this.renderPrepayments();
    }

    updatePrepayment(type, id, field, value) {
        const prepayment = this.multiplePrepayments[type].find(p => p.id === id);
        if (prepayment) {
            if (['amount', 'startMonth', 'endMonth', 'targetMonth', 'month', 'startYear', 'endYear'].includes(field)) {
                prepayment[field] = value ? (field === 'amount' ? parseFloat(value) : parseInt(value)) : null;
            } else if (field === 'strategy') {
                prepayment[field] = value === 'null' ? null : value;
            }
            this.saveToState();
        }
    }

    renderPrepayments() {
        const container = document.getElementById('multiplePrepaymentsLis');
        if (!container) return;

        const prepayments = this.multiplePrepayments[this.activeTab];

        if (prepayments.length === 0) {
            container.innerHTML = `<p class="text-gray-500 text-sm mt-2">No ${this.activeTab} prepayments added.</p>`;
            return;
        }

        if (this.activeTab === 'monthly') {
            container.innerHTML = prepayments.map(p => `
                <div class="prepayment-item p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 mt-2">
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">Amount (₹)</label>
                            <input type="number"
                                class="w-full p-1 border rounded text-sm"
                                value="${p.amount}"
                                min="0"
                                onchange="loanUIController.updatePrepayment('monthly', '${p.id}', 'amount', this.value)">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">Start Month</label>
                            <input type="number"
                                class="w-full p-1 border rounded text-sm"
                                value="${p.startMonth}"
                                min="1"
                                onchange="loanUIController.updatePrepayment('monthly', '${p.id}', 'startMonth', this.value)">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">End Month (optional)</label>
                            <input type="number"
                                class="w-full p-1 border rounded text-sm"
                                value="${p.endMonth || ''}"
                                placeholder="Till end"
                                onchange="loanUIController.updatePrepayment('monthly', '${p.id}', 'endMonth', this.value)">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">Strategy</label>
                            <select class="w-full p-1 border rounded text-sm"
                                onchange="loanUIController.updatePrepayment('monthly', '${p.id}', 'strategy', this.value)">
                                <option value="null" ${p.strategy === null ? 'selected' : ''}>Default</option>
                                <option value="REDUCE_TENURE" ${p.strategy === 'REDUCE_TENURE' ? 'selected' : ''}>Reduce Tenure</option>
                                <option value="REDUCE_EMI" ${p.strategy === 'REDUCE_EMI' ? 'selected' : ''}>Reduce EMI</option>
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button class="btn-danger text-sm px-2 py-1" onclick="loanUIController.removePrepayment('monthly', '${p.id}')">Remove</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else if (this.activeTab === 'yearly') {
            container.innerHTML = prepayments.map(p => `
                <div class="prepayment-item p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 mt-2">
                    <div class="grid grid-cols-1 md:grid-cols-6 gap-2">
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">Amount (₹)</label>
                            <input type="number"
                                class="w-full p-1 border rounded text-sm"
                                value="${p.amount}"
                                min="0"
                                onchange="loanUIController.updatePrepayment('yearly', '${p.id}', 'amount', this.value)">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">Month (1-12)</label>
                            <input type="number"
                                class="w-full p-1 border rounded text-sm"
                                value="${p.targetMonth}"
                                min="1" max="12"
                                onchange="loanUIController.updatePrepayment('yearly', '${p.id}', 'targetMonth', this.value)">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">Start Year</label>
                            <input type="number"
                                class="w-full p-1 border rounded text-sm"
                                value="${p.startYear}"
                                min="1"
                                onchange="loanUIController.updatePrepayment('yearly', '${p.id}', 'startYear', this.value)">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">End Year (optional)</label>
                            <input type="number"
                                class="w-full p-1 border rounded text-sm"
                                value="${p.endYear || ''}"
                                placeholder="Till end"
                                onchange="loanUIController.updatePrepayment('yearly', '${p.id}', 'endYear', this.value)">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">Strategy</label>
                            <select class="w-full p-1 border rounded text-sm"
                                onchange="loanUIController.updatePrepayment('yearly', '${p.id}', 'strategy', this.value)">
                                <option value="null" ${p.strategy === null ? 'selected' : ''}>Default</option>
                                <option value="REDUCE_TENURE" ${p.strategy === 'REDUCE_TENURE' ? 'selected' : ''}>Reduce Tenure</option>
                                <option value="REDUCE_EMI" ${p.strategy === 'REDUCE_EMI' ? 'selected' : ''}>Reduce EMI</option>
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button class="btn-danger text-sm px-2 py-1" onclick="loanUIController.removePrepayment('yearly', '${p.id}')">Remove</button>
                        </div>
                    </div>
                </div>
            `).join('');
        } else if (this.activeTab === 'oneTime') {
            container.innerHTML = prepayments.map(p => `
                <div class="prepayment-item p-3 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 mt-2">
                    <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">Amount (₹)</label>
                            <input type="number"
                                class="w-full p-1 border rounded text-sm"
                                value="${p.amount}"
                                min="0"
                                onchange="loanUIController.updatePrepayment('oneTime', '${p.id}', 'amount', this.value)">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">At Month</label>
                            <input type="number"
                                class="w-full p-1 border rounded text-sm"
                                value="${p.month}"
                                min="1"
                                onchange="loanUIController.updatePrepayment('oneTime', '${p.id}', 'month', this.value)">
                        </div>
                        <div>
                            <label class="block text-xs text-gray-600 dark:text-gray-400">Strategy</label>
                            <select class="w-full p-1 border rounded text-sm"
                                onchange="loanUIController.updatePrepayment('oneTime', '${p.id}', 'strategy', this.value)">
                                <option value="null" ${p.strategy === null ? 'selected' : ''}>Default</option>
                                <option value="REDUCE_TENURE" ${p.strategy === 'REDUCE_TENURE' ? 'selected' : ''}>Reduce Tenure</option>
                                <option value="REDUCE_EMI" ${p.strategy === 'REDUCE_EMI' ? 'selected' : ''}>Reduce EMI</option>
                            </select>
                        </div>
                        <div class="flex items-end">
                            <button class="btn-danger text-sm px-2 py-1" onclick="loanUIController.removePrepayment('oneTime', '${p.id}')">Remove</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    }

    saveToState() {
        stateManager.setState('loanCalculator.rateChanges', this.rateChanges);
        stateManager.setState('loanCalculator.multiplePrepayments', this.multiplePrepayments);
    }

    loadFromState() {
        const rateChanges = stateManager.getState('loanCalculator.rateChanges');
        const multiplePrepayments = stateManager.getState('loanCalculator.multiplePrepayments');

        if (rateChanges) {
            this.rateChanges = rateChanges;
            this.renderRateChanges();
        }

        if (multiplePrepayments) {
            this.multiplePrepayments = multiplePrepayments;
            this.renderPrepayments();
        }
    }

    /**
     * Get current configuration for calculation
     * Converts UI state to LoanConfiguration object
     */
    getCurrentConfiguration() {
        const config = new LoanConfiguration();

        // Get basic loan details from form
        config.principal = parseFloat(document.getElementById('loanAmount')?.value || 0);
        config.baseTenureMonths = parseFloat(document.getElementById('loanTenure')?.value || 0) * 12;

        // Add default rate period from form
        const defaultRate = parseFloat(document.getElementById('interestRate')?.value || 0);
        config.addRatePeriod(1, defaultRate, null);

        // Add additional rate changes
        this.rateChanges.forEach(rc => {
            config.addRatePeriod(rc.startMonth, rc.rate, rc.endMonth);
        });

        // Add multiple prepayments
        this.multiplePrepayments.monthly.forEach(p => {
            config.addMonthlyPrepayment(p.amount, p.startMonth, p.endMonth, p.strategy);
        });

        this.multiplePrepayments.yearly.forEach(p => {
            config.addYearlyPrepayment(p.amount, p.targetMonth, p.startYear, p.endYear, p.strategy);
        });

        this.multiplePrepayments.oneTime.forEach(p => {
            config.addOneTimePrepayment(p.amount, p.month, p.strategy);
        });

        return config;
    }

    /**
     * Clear all advanced features
     */
    clearAll() {
        this.rateChanges = [];
        this.multiplePrepayments = {
            monthly: [],
            yearly: [],
            oneTime: []
        };
        this.saveToState();
        this.renderRateChanges();
        this.renderPrepayments();
    }
}

// Create singleton instance and export
export const loanUIController = new LoanUIController();

// Make available globally for onclick handlers
window.loanUIController = loanUIController;
