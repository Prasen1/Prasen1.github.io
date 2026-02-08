/**
 * Scenario Comparison UI Component
 * Handles saving, loading, and comparing loan/SIP scenarios
 */

import { stateManager } from '../state/StateManager.js';
import { formatCurrency, formatPercentage, formatDuration } from '../utils/formatters.js';
import { chartRenderer } from './ChartRenderer.js';

export class ScenarioComparisonController {
    constructor() {
        this.scenarios = {
            loan: [],
            sip: []
        };
        this.selectedScenarios = [];
        this.currentType = 'loan';
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;
        console.log('Initializing Scenario Comparison...');
        this.loadFromState();
        this.setupEventListeners();
        this.updateScenarioDropdowns();
        this.renderScenarioList();
        console.log('Scenario Comparison initialized with:', this.scenarios);
    }

    setupEventListeners() {
        // Save scenario button
        const saveLoanScenario = document.getElementById('saveLoanScenario');
        const saveSIPScenario = document.getElementById('saveSIPScenario');

        if (saveLoanScenario) {
            saveLoanScenario.addEventListener('click', () => this.saveScenario('loan'));
        }

        if (saveSIPScenario) {
            saveSIPScenario.addEventListener('click', () => this.saveScenario('sip'));
        }

        // Comparison type radio buttons
        const comparisonTypeRadios = document.querySelectorAll('input[name="comparisonType"]');
        comparisonTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentType = e.target.value;
                this.updateScenarioDropdowns();
            });
        });

        // Compare scenarios button
        const compareScenarios = document.getElementById('compareScenarios');
        if (compareScenarios) {
            compareScenarios.addEventListener('click', () => this.showComparison());
        }

        // Close comparison button
        const closeComparison = document.getElementById('closeComparison');
        if (closeComparison) {
            closeComparison.addEventListener('click', () => this.hideComparison());
        }
    }

    saveScenario(type) {
        console.log('Attempting to save', type, 'scenario');

        // Prompt for scenario name
        const name = prompt(`Enter a name for this ${type} scenario:`, `${type.toUpperCase()} Scenario ${this.scenarios[type].length + 1}`);
        if (!name) {
            console.log('Save cancelled - no name provided');
            return;
        }

        // Get current configuration and results
        let config, results;

        if (type === 'loan') {
            config = this.getLoanConfiguration();
            results = this.getLoanResults();
        } else if (type === 'sip') {
            config = this.getSIPConfiguration();
            results = this.getSIPResults();
        }

        console.log('Configuration:', config);
        console.log('Results:', results);

        if (!config || !results) {
            alert('Please calculate first before saving a scenario.');
            return;
        }

        // Create scenario object
        const scenario = {
            id: Date.now().toString(),
            name,
            type,
            config,
            results,
            createdAt: new Date().toISOString()
        };

        console.log('Created scenario:', scenario);

        // Add to scenarios
        this.scenarios[type].push(scenario);
        console.log('Scenarios after save:', this.scenarios);

        this.saveToState();
        this.updateScenarioDropdowns();
        this.renderScenarioList();

        alert(`Scenario "${name}" saved successfully!`);
    }

    getLoanConfiguration() {
        const loanAmount = document.getElementById('loanAmount')?.value;
        const interestRate = document.getElementById('interestRate')?.value;
        const loanTenure = document.getElementById('loanTenure')?.value;
        const prepaymentType = document.getElementById('prepaymentType')?.value;
        const extraPayment = document.getElementById('extraPayment')?.value;
        const yearlyPayment = document.getElementById('yearlyPayment')?.value;
        const lumpSumAmount = document.getElementById('lumpSumAmount')?.value;
        const lumpSumMonth = document.getElementById('lumpSumMonth')?.value;

        if (!loanAmount || !interestRate || !loanTenure) return null;

        return {
            loanAmount: parseFloat(loanAmount),
            interestRate: parseFloat(interestRate),
            loanTenure: parseFloat(loanTenure),
            prepaymentType,
            extraPayment: parseFloat(extraPayment || 0),
            yearlyPayment: parseFloat(yearlyPayment || 0),
            lumpSumAmount: parseFloat(lumpSumAmount || 0),
            lumpSumMonth: parseInt(lumpSumMonth || 0)
        };
    }

    getLoanResults() {
        // Check if results are displayed
        const resultsDiv = document.getElementById('loanResults');
        if (!resultsDiv || resultsDiv.classList.contains('hidden')) return null;

        // Extract results from DOM
        return {
            totalInterestPaid: this.extractNumberFromElement('totalInterestPaid'),
            totalLoan: this.extractNumberFromElement('totalLoan'),
            interestSaved: this.extractNumberFromElement('totalInterestSaved'),
            monthsReduced: this.extractMonthsFromElement('monthsReduced'),
            originalTotalInterest: this.extractNumberFromElement('totalOriginalInterestPaid'),
            originalTotalLoan: this.extractNumberFromElement('totalOriginalLoan')
        };
    }

    getSIPConfiguration() {
        const sipAmount = document.getElementById('sipAmount')?.value;
        const sipReturn = document.getElementById('sipReturn')?.value;
        const sipYears = document.getElementById('sipYears')?.value;
        const sipStepUp = document.getElementById('sipStepUp')?.value;
        const inflationRate = document.getElementById('inflationRate')?.value;

        if (!sipAmount || !sipReturn || !sipYears) return null;

        return {
            sipAmount: parseFloat(sipAmount),
            sipReturn: parseFloat(sipReturn),
            sipYears: parseFloat(sipYears),
            sipStepUp: parseFloat(sipStepUp || 0),
            inflationRate: parseFloat(inflationRate || 0)
        };
    }

    getSIPResults() {
        const resultsDiv = document.getElementById('sipResults');
        if (!resultsDiv || resultsDiv.classList.contains('hidden')) return null;

        return {
            totalInvestment: this.extractNumberFromElement('totalInvestment'),
            finalValue: this.extractNumberFromElement('finalValue'),
            wealthGain: this.extractNumberFromElement('wealthGain')
        };
    }

    extractNumberFromElement(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return 0;

        const text = element.textContent;
        // Extract number from currency format
        const match = text.match(/₹\s*([\d,]+(?:\.\d+)?)/);
        if (match) {
            return parseFloat(match[1].replace(/,/g, ''));
        }
        return 0;
    }

    extractMonthsFromElement(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return 0;

        const text = element.textContent;
        // Extract months from text like "Months Reduced: 48"
        const match = text.match(/Months Reduced:\s*(\d+)/);
        if (match) {
            return parseInt(match[1]);
        }
        return 0;
    }

    updateScenarioDropdowns() {
        const dropdown1 = document.getElementById('scenarioSelect1');
        const dropdown2 = document.getElementById('scenarioSelect2');

        // Get current comparison type
        const type = this.currentType;
        const scenarios = this.scenarios[type] || [];

        // Create capitalized type name for display
        const typeName = type.charAt(0).toUpperCase() + type.slice(1);

        // Update both dropdowns with the same type of scenarios
        const optionHTML = `<option value="">Select a ${typeName} scenario...</option>` +
            scenarios.map(s => `<option value="${s.id}">${s.name}</option>`).join('');

        if (dropdown1) {
            dropdown1.innerHTML = optionHTML;
            console.log(`Updated Scenario 1 dropdown with ${scenarios.length} ${type} scenarios`);
        }

        if (dropdown2) {
            dropdown2.innerHTML = optionHTML;
            console.log(`Updated Scenario 2 dropdown with ${scenarios.length} ${type} scenarios`);
        }
    }

    showComparison() {
        // Get selected scenarios
        const type = document.querySelector('input[name="comparisonType"]:checked')?.value || 'loan';
        this.currentType = type;

        // Get selected IDs from both dropdowns
        const select1 = document.getElementById('scenarioSelect1');
        const select2 = document.getElementById('scenarioSelect2');

        const selectedIds = [select1?.value, select2?.value].filter(id => id);

        if (selectedIds.length < 2) {
            alert('Please select at least 2 different scenarios to compare.');
            return;
        }

        // Get full scenario objects
        this.selectedScenarios = selectedIds
            .map(id => this.scenarios[type].find(s => s.id === id))
            .filter(s => s);

        if (this.selectedScenarios.length < 2) {
            alert('Please select at least 2 scenarios to compare.');
            return;
        }

        console.log('Comparing', this.selectedScenarios.length, type, 'scenarios');

        // Show comparison view
        document.getElementById('comparisonView').classList.remove('hidden');
        document.getElementById('mainContent').classList.add('hidden');

        // Render comparison
        if (type === 'loan') {
            this.renderLoanComparison();
        } else {
            this.renderSIPComparison();
        }
    }

    hideComparison() {
        document.getElementById('comparisonView').classList.add('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
    }

    renderLoanComparison() {
        const container = document.getElementById('comparisonTable');
        if (!container) return;

        // Build comparison table
        const headers = ['<th class="p-3 text-left">Metric</th>'];
        this.selectedScenarios.forEach(scenario => {
            headers.push(`<th class="p-3 text-left">${scenario.name}</th>`);
        });
        headers.push('<th class="p-3 text-left">Best</th>');

        const rows = [
            this.buildComparisonRow('Loan Amount', this.selectedScenarios, s => formatCurrency(s.config.loanAmount), false),
            this.buildComparisonRow('Interest Rate', this.selectedScenarios, s => formatPercentage(s.config.interestRate), false),
            this.buildComparisonRow('Loan Tenure', this.selectedScenarios, s => `${s.config.loanTenure} years`, false),
            this.buildComparisonRow('Total Interest Paid', this.selectedScenarios, s => formatCurrency(s.results.totalInterestPaid), true, 'min'),
            this.buildComparisonRow('Total Amount Paid', this.selectedScenarios, s => formatCurrency(s.results.totalLoan), true, 'min'),
            this.buildComparisonRow('Interest Saved', this.selectedScenarios, s => formatCurrency(s.results.interestSaved), true, 'max'),
            this.buildComparisonRow('Months Reduced', this.selectedScenarios, s => s.results.monthsReduced, true, 'max')
        ];

        container.innerHTML = `
            <table class="w-full border border-gray-300 dark:border-gray-600">
                <thead class="bg-blue-100 dark:bg-blue-800">
                    <tr>${headers.join('')}</tr>
                </thead>
                <tbody>
                    ${rows.join('')}
                </tbody>
            </table>
        `;

        // Render comparison chart
        this.renderComparisonChart('loan');
    }

    renderSIPComparison() {
        const container = document.getElementById('comparisonTable');
        if (!container) return;

        const headers = ['<th class="p-3 text-left">Metric</th>'];
        this.selectedScenarios.forEach(scenario => {
            headers.push(`<th class="p-3 text-left">${scenario.name}</th>`);
        });
        headers.push('<th class="p-3 text-left">Best</th>');

        const rows = [
            this.buildComparisonRow('Monthly SIP', this.selectedScenarios, s => formatCurrency(s.config.sipAmount), false),
            this.buildComparisonRow('Expected Return', this.selectedScenarios, s => formatPercentage(s.config.sipReturn), false),
            this.buildComparisonRow('Duration', this.selectedScenarios, s => `${s.config.sipYears} years`, false),
            this.buildComparisonRow('Total Investment', this.selectedScenarios, s => formatCurrency(s.results.totalInvestment), true, 'min'),
            this.buildComparisonRow('Final Value', this.selectedScenarios, s => formatCurrency(s.results.finalValue), true, 'max'),
            this.buildComparisonRow('Wealth Gain', this.selectedScenarios, s => formatCurrency(s.results.wealthGain), true, 'max')
        ];

        container.innerHTML = `
            <table class="w-full border border-gray-300 dark:border-gray-600">
                <thead class="bg-green-100 dark:bg-green-800">
                    <tr>${headers.join('')}</tr>
                </thead>
                <tbody>
                    ${rows.join('')}
                </tbody>
            </table>
        `;

        // Render comparison chart
        this.renderComparisonChart('sip');
    }

    buildComparisonRow(label, scenarios, valueExtractor, highlight = false, bestType = null) {
        const values = scenarios.map(s => {
            const rawValue = valueExtractor(s);
            const numericValue = typeof rawValue === 'string' ?
                parseFloat(rawValue.replace(/[₹,\s]/g, '')) : rawValue;
            return { display: rawValue, numeric: numericValue };
        });

        // Find best value
        let bestIndex = -1;
        if (highlight && bestType) {
            if (bestType === 'min') {
                bestIndex = values.reduce((minIdx, val, idx, arr) =>
                    val.numeric < arr[minIdx].numeric ? idx : minIdx, 0);
            } else if (bestType === 'max') {
                bestIndex = values.reduce((maxIdx, val, idx, arr) =>
                    val.numeric > arr[maxIdx].numeric ? idx : maxIdx, 0);
            }
        }

        const cells = [`<td class="p-3 font-semibold">${label}</td>`];
        values.forEach((val, idx) => {
            const highlightClass = idx === bestIndex ?
                'bg-green-100 dark:bg-green-900 font-semibold' : '';
            cells.push(`<td class="p-3 ${highlightClass}">${val.display}</td>`);
        });

        // Add best column
        if (bestIndex >= 0) {
            cells.push(`<td class="p-3 text-green-600 dark:text-green-400 font-semibold">${scenarios[bestIndex].name}</td>`);
        } else {
            cells.push(`<td class="p-3">-</td>`);
        }

        return `<tr class="border-t border-gray-200 dark:border-gray-600">${cells.join('')}</tr>`;
    }

    renderComparisonChart(type) {
        // For now, just show a placeholder
        // In a full implementation, we would overlay the actual amortization schedules
        const canvas = document.getElementById('comparisonChart');
        if (!canvas) return;

        // Placeholder: Generate sample data for visualization
        const scenarioData = this.selectedScenarios.map(scenario => ({
            name: scenario.name,
            data: this.generateChartData(scenario, type)
        }));

        chartRenderer.renderScenarioComparisonChart('comparisonChart', scenarioData);
    }

    generateChartData(scenario, type) {
        // Generate sample data points for the chart
        // In a full implementation, this would use the actual amortization schedule
        if (type === 'loan') {
            const months = scenario.config.loanTenure * 12;
            const points = [];
            for (let i = 0; i <= months; i += 12) {
                // Simple linear approximation for demo
                const balance = scenario.config.loanAmount * (1 - i / months);
                points.push({ x: i, y: Math.max(balance, 0) });
            }
            return points;
        } else if (type === 'sip') {
            const years = scenario.config.sipYears;
            const points = [];
            for (let i = 0; i <= years; i++) {
                // Simple compound interest approximation
                const months = i * 12;
                const rate = scenario.config.sipReturn / 100 / 12;
                const fv = scenario.config.sipAmount * (Math.pow(1 + rate, months) - 1) / rate * (1 + rate);
                points.push({ x: i, y: fv });
            }
            return points;
        }
        return [];
    }

    deleteScenario(type, id) {
        console.log('Attempting to delete', type, 'scenario with id:', id);

        if (!confirm('Are you sure you want to delete this scenario?')) {
            console.log('Delete cancelled by user');
            return;
        }

        const beforeCount = this.scenarios[type].length;
        this.scenarios[type] = this.scenarios[type].filter(s => s.id !== id);
        const afterCount = this.scenarios[type].length;

        console.log(`Deleted scenario. Before: ${beforeCount}, After: ${afterCount}`);

        this.saveToState();
        this.updateScenarioDropdowns();
        this.renderScenarioList();
    }

    renderScenarioList() {
        console.log('Rendering scenario lists...');
        console.log('Loan scenarios:', this.scenarios.loan.length);
        console.log('SIP scenarios:', this.scenarios.sip.length);

        // Render saved scenarios list for management
        const loanListContainer = document.getElementById('savedLoanScenarios');
        const sipListContainer = document.getElementById('savedSIPScenarios');

        if (!loanListContainer || !sipListContainer) {
            console.error('Scenario list containers not found!');
            return;
        }

        if (loanListContainer) {
            loanListContainer.innerHTML = this.scenarios.loan.length === 0 ?
                '<p class="text-gray-500 dark:text-gray-400 text-sm">No saved loan scenarios</p>' :
                this.scenarios.loan.map(s => `
                    <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <span class="font-medium dark:text-gray-200">${s.name}</span>
                        <button class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded transition-colors" onclick="scenarioComparison.deleteScenario('loan', '${s.id}')">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                `).join('');
            console.log('Rendered', this.scenarios.loan.length, 'loan scenarios');
        }

        if (sipListContainer) {
            sipListContainer.innerHTML = this.scenarios.sip.length === 0 ?
                '<p class="text-gray-500 dark:text-gray-400 text-sm">No saved SIP scenarios</p>' :
                this.scenarios.sip.map(s => `
                    <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg mb-2 border border-gray-200 dark:border-gray-600 hover:shadow-md transition-shadow">
                        <span class="font-medium dark:text-gray-200">${s.name}</span>
                        <button class="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1 rounded transition-colors" onclick="scenarioComparison.deleteScenario('sip', '${s.id}')">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                `).join('');
            console.log('Rendered', this.scenarios.sip.length, 'SIP scenarios');
        }
    }

    saveToState() {
        console.log('Saving scenarios to state:', this.scenarios);
        stateManager.setState('scenarios', this.scenarios);
        console.log('Scenarios saved to localStorage');
    }

    loadFromState() {
        const scenarios = stateManager.getState('scenarios');
        console.log('Loading scenarios from state:', scenarios);

        if (scenarios && typeof scenarios === 'object') {
            // Ensure proper structure
            this.scenarios = {
                loan: Array.isArray(scenarios.loan) ? scenarios.loan : [],
                sip: Array.isArray(scenarios.sip) ? scenarios.sip : []
            };
            console.log('Loaded scenarios:', this.scenarios);
        } else {
            // Initialize empty structure
            this.scenarios = {
                loan: [],
                sip: []
            };
            console.log('No scenarios in state, initialized empty structure');
        }
    }
}

// Create singleton instance and export
export const scenarioComparison = new ScenarioComparisonController();

// Make available globally for onclick handlers
window.scenarioComparison = scenarioComparison;
