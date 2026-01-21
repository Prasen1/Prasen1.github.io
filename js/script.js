// ========================================
// ES6 MODULE IMPORTS
// ========================================
import { formatCurrency, formatPercentage, formatDuration } from './utils/formatters.js';
import { stateManager } from './state/StateManager.js';
import { autoMigrate } from './state/StorageMigration.js';
import { calculateSimpleLoan, AdvancedLoanCalculator } from './core/LoanCalculator.js';
import { calculateSimpleSIP } from './core/SIPCalculator.js';
import { goalSeeker } from './core/GoalSeeker.js';
import { chartRenderer } from './ui/ChartRenderer.js';
import { loanUIController } from './ui/LoanUIController.js';
import { scenarioComparison } from './ui/ScenarioComparison.js';
import { initLiveDashboard } from './liveDashboard.js';

// Auto-migrate localStorage on load
autoMigrate();

// Make key functions available globally for console testing
window.stateManager = stateManager;
window.goalSeeker = goalSeeker;
window.chartRenderer = chartRenderer;

// ========================================
// LEGACY FUNCTIONS (to be refactored in later phases)
// ========================================

// These formatCurrency and formatPercentage functions are now imported above
// But keeping references for backward compatibility during transition
window.formatCurrency = formatCurrency;
window.formatPercentage = formatPercentage;

// Local Storage Management
function saveCalculation(type, data) {
    let calculations = JSON.parse(localStorage.getItem('financialCalculations') || '[]');
    calculations.push({
        type, 
        data, 
        timestamp: new Date().toISOString(),
        formattedDate: new Date().toLocaleString()
    });
    
    if (calculations.length > 10) {
        calculations = calculations.slice(-10);
    }
    
    localStorage.setItem('financialCalculations', JSON.stringify(calculations));
}

function loadPreviousCalculations() {
    let calculations = JSON.parse(localStorage.getItem('financialCalculations') || '[]');
    console.log('Previous Calculations:', calculations);
}

// Input Validation Function
function validateInputs(inputs) {
    let isValid = true;
    for (let input of inputs) {
        if (!input.value || isNaN(parseFloat(input.value))) {
            input.classList.add('border-red-500');
            input.focus();
            isValid = false;
        } else if (parseFloat(input.value) < 0) { // Allow 0 for optional fields
            input.classList.add('border-red-500');
            input.focus();
            isValid = false;
        } else {
            input.classList.remove('border-red-500');
        }
    }
    return isValid;
}


// Show loading state
function showLoading(buttonId, spinnerId, btnTextId) {
    document.getElementById(buttonId).disabled = true;
    document.getElementById(spinnerId).classList.remove('hidden');
    document.getElementById(btnTextId).textContent = 'Calculating...';
}

// Hide loading state
function hideLoading(buttonId, spinnerId, btnTextId, originalText) {
    document.getElementById(buttonId).disabled = false;
    document.getElementById(spinnerId).classList.add('hidden');
    document.getElementById(btnTextId).textContent = originalText;
}

// Predefined Scenarios
const loanScenarios = {
    '': {
        // Default/empty selection - no auto-fill
        defaultInterest: null,
        defaultTenure: null,
        exampleAmount: null,
        exampleExtra: null
    },
    'home': {
        defaultInterest: 8.5,
        defaultTenure: 20,
        exampleAmount: 5000000,
        exampleExtra: 5000
    },
    'car': {
        defaultInterest: 9.5,
        defaultTenure: 7,
        exampleAmount: 800000,
        exampleExtra: 2000
    },
    'personal': {
        defaultInterest: 12,
        defaultTenure: 5,
        exampleAmount: 300000,
        exampleExtra: 1000
    },
    'custom': {
        // Custom - no auto-fill
        defaultInterest: null,
        defaultTenure: null,
        exampleAmount: null,
        exampleExtra: null
    }
};

const investmentGoals = {
    '': {
        // Default/empty selection - no auto-fill
        defaultReturn: null,
        defaultYears: null,
        exampleAmount: null,
        exampleStepUp: null,
        exampleInflation: null
    },
    'retirement': {
        defaultReturn: 12,
        defaultYears: 30,
        exampleAmount: 15000,
        exampleStepUp: 10,
        exampleInflation: 6
    },
    'education': {
        defaultReturn: 10,
        defaultYears: 15,
        exampleAmount: 10000,
        exampleStepUp: 5,
        exampleInflation: 6
    },
    'home': {
        defaultReturn: 8,
        defaultYears: 10,
        exampleAmount: 20000,
        exampleStepUp: 0,
        exampleInflation: 6
    },
    'custom': {
        // Custom - no auto-fill
        defaultReturn: null,
        defaultYears: null,
        exampleAmount: null,
        exampleStepUp: null,
        exampleInflation: null
    }
};

// Example Data Functions
function showLoanExample() {
    const scenario = document.getElementById('loanScenario').value || 'home';

    if (loanScenarios[scenario]) {
        const scenarioData = loanScenarios[scenario];

        // Only fill in fields that have example data
        if (scenarioData.exampleAmount !== null) {
            document.getElementById('loanAmount').value = scenarioData.exampleAmount;
        }
        if (scenarioData.defaultInterest !== null) {
            document.getElementById('interestRate').value = scenarioData.defaultInterest;
        }
        if (scenarioData.defaultTenure !== null) {
            document.getElementById('loanTenure').value = scenarioData.defaultTenure;
        }

        console.log('Loaded loan example for scenario:', scenario);
    }

    // Note: For prepayment examples, use the advanced "Multiple Prepayments" section
}

function showSIPExample() {
    const goal = document.getElementById('investmentGoal').value || 'retirement';

    if (investmentGoals[goal]) {
        const goalData = investmentGoals[goal];

        // Only fill in fields that have example data
        if (goalData.exampleAmount !== null) {
            document.getElementById('sipAmount').value = goalData.exampleAmount;
        }
        if (goalData.defaultReturn !== null) {
            document.getElementById('sipReturn').value = goalData.defaultReturn;
        }
        if (goalData.defaultYears !== null) {
            document.getElementById('sipYears').value = goalData.defaultYears;
        }
        if (goalData.exampleStepUp !== null) {
            document.getElementById('sipStepUp').value = goalData.exampleStepUp;
        }
        if (goalData.exampleInflation !== null) {
            document.getElementById('inflationRate').value = goalData.exampleInflation;
        }

        console.log('Loaded SIP example for goal:', goal);
    }
}

// Clear Form Functions
function clearLoanForm() {
    document.getElementById('loanAmount').value = '';
    document.getElementById('interestRate').value = '';
    document.getElementById('loanTenure').value = '';
    document.getElementById('loanResults').classList.add('hidden');

    // Clear advanced features
    loanUIController.rateChanges = [];
    loanUIController.multiplePrepayments = { monthly: [], yearly: [], oneTime: [] };
    loanUIController.saveToState(); // Save the cleared state to localStorage
    loanUIController.renderRateChanges();
    loanUIController.renderPrepayments();
}

function clearSIPForm() {
    document.getElementById('sipAmount').value = '';
    document.getElementById('sipReturn').value = '';
    document.getElementById('sipYears').value = '';
    document.getElementById('sipStepUp').value = '';
    document.getElementById('inflationRate').value = '';
    document.getElementById('sipResults').classList.add('hidden');
}

// Dark Mode Management
function initDarkMode() {
    const darkModePreference = localStorage.getItem('darkMode');

    if (darkModePreference === null) {
        // First visit - use system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            document.body.classList.add('dark-mode');
        }
    } else if (darkModePreference === 'dark') {
        // User explicitly chose dark mode
        document.body.classList.add('dark-mode');
    }
    // If 'light' or any other value, keep default (light mode)
}

function toggleDarkMode() {
    // Simple two-state toggle: just alternate between dark and light
    const isDarkNow = document.body.classList.contains('dark-mode');

    if (isDarkNow) {
        // Currently dark, switch to light
        localStorage.setItem('darkMode', 'light');
        document.body.classList.remove('dark-mode');
    } else {
        // Currently light, switch to dark
        localStorage.setItem('darkMode', 'dark');
        document.body.classList.add('dark-mode');
    }

    updateChartThemes();
}

// Update all chart themes when dark mode changes
function updateChartThemes() {
    if (loanChart) {
        updateLoanChartTheme();
    }
    if (sipChart) {
        updateSIPChartTheme();
    }
}

// Initialize dark mode on page load
initDarkMode();

// Loan Calculation Function (Refactored to use new engine)
let loanChart = null;
function calculateLoan() {
    const loanInputs = [
        document.getElementById('loanAmount'),
        document.getElementById('interestRate'),
        document.getElementById('loanTenure')
    ];

    if (!validateInputs(loanInputs)) {
        alert('Please fill in all required fields with valid positive numbers.');
        return;
    }

    showLoading('loanCalculateBtn', 'loanSpinner', 'loanBtnText');

    setTimeout(() => {
        try {
            console.log('=== Starting Loan Calculation ===');

            // Gather input values
            const loanAmount = Number.parseFloat(document.getElementById('loanAmount').value);
            const interestRate = Number.parseFloat(document.getElementById('interestRate').value);
            const loanTenure = Number.parseFloat(document.getElementById('loanTenure').value);

            console.log('Inputs:', { loanAmount, interestRate, loanTenure });

            // Check if user has added advanced features (rate changes or multiple prepayments)
            const hasRateChanges = loanUIController.rateChanges.length > 0;
            const hasMultiplePrepayments = loanUIController.multiplePrepayments.monthly.length > 0 ||
                                          loanUIController.multiplePrepayments.yearly.length > 0 ||
                                          loanUIController.multiplePrepayments.oneTime.length > 0;

            console.log('Advanced features:', { hasRateChanges, hasMultiplePrepayments });

            let results;

            if (hasRateChanges || hasMultiplePrepayments) {
                // Use advanced calculator with all features
                console.log('Using advanced calculator with rate changes/multiple prepayments');
                const config = loanUIController.getCurrentConfiguration();

                // Override with current form values if they differ
                config.principal = loanAmount;
                config.baseTenureMonths = loanTenure * 12;

                // If no rate changes added, use form's interest rate
                if (config.interestRateSchedule.length === 0) {
                    config.addRatePeriod(1, interestRate, null);
                }

                const calculator = new AdvancedLoanCalculator(config);
                results = calculator.calculate();
            } else {
                // Use simple calculator for loans without advanced features
                console.log('Using simple calculator');
                results = calculateSimpleLoan({
                    loanAmount,
                    interestRate,
                    loanTenure,
                    prepaymentType: 'none',
                    extraPayment: 0,
                    startPrepaymentMonth: 1,
                    yearlyPayment: 0,
                    yearlyPaymentMonth: 12,
                    lumpSumAmount: 0,
                    lumpSumMonth: 0
                });
            }

            console.log('Calculation results:', {
                months: results.months,
                totalInterest: results.totalInterest,
                scheduleLength: results.amortizationSchedule.length,
                firstRow: results.amortizationSchedule[0]
            });

            // Build chart data from amortization schedule
            const balanceData = results.amortizationSchedule.map(row => ({
                x: row.month,
                y: row.balance
            }));

            // Build table HTML from full schedule (generate full schedule for table)
            const tableHTML = results.amortizationSchedule.map(row => {
                let rowClass = "hover:bg-gray-100 dark:hover:bg-gray-600";
                let paymentType = "Regular";

                if (row.prepayment && row.prepayment > 0) {
                    const prepType = row.prepaymentType || '';
                    if (prepType.includes('monthly')) {
                        paymentType = "Prepayment";
                        rowClass += " highlight-prepayment";
                    } else if (prepType.includes('yearly')) {
                        paymentType = "Yearly Prepayment";
                        rowClass += " highlight-lumpsum";
                    } else if (prepType.includes('lump-sum')) {
                        paymentType = "Lump Sum";
                        rowClass += " highlight-lumpsum";
                    }
                }

                return `<tr class="${rowClass}">
                    <td class='p-2'>${row.month}</td>
                    <td class='p-2'>${formatCurrency(row.balance)}</td>
                    <td class='p-2'>${formatCurrency(row.interest)}</td>
                    <td class='p-2'>${formatCurrency(row.principal)}</td>
                    <td class='p-2'>${paymentType}</td>
                </tr>`;
            }).join('');

            const originalTotalLoan = loanAmount + results.originalTotalInterest;

            // Save calculation to localStorage (legacy format for compatibility)
            saveCalculation('loan', {
                loanAmount,
                interestRate: interestRate,
                loanTenure: loanTenure,
                hasRateChanges,
                hasMultiplePrepayments,
                interestSaved: results.interestSaved,
                monthsReduced: results.tenureReduced,
                originalTotalInterest: results.originalTotalInterest,
                originalTotalLoan: originalTotalLoan,
                totalInterestPaid: results.totalInterest,
                totalLoan: results.totalPayment,
            });

            // Update results display
            document.getElementById('loanTable').querySelector('tbody').innerHTML = tableHTML;
            document.getElementById('originalLoanTerms').innerHTML =
                `Original Loan Terms: ${formatCurrency(loanAmount)} at ${formatPercentage(interestRate)} ` +
                `for ${loanTenure} years (EMI: ${formatCurrency(results.originalEMI)})`;
            document.getElementById('totalOriginalInterestPaid').innerHTML =
                `Original Total Interest Paid: ${formatCurrency(results.originalTotalInterest)}`;
            document.getElementById('totalOriginalLoan').innerHTML =
                `Original Total Loan Amount: ${formatCurrency(originalTotalLoan)}`;
            document.getElementById('totalInterestPaid').innerHTML =
                `New Total Interest Paid: ${formatCurrency(results.totalInterest)}`;
            document.getElementById('totalLoan').innerHTML =
                `New Total Loan Amount: ${formatCurrency(results.totalPayment)}`;

            // Only show interest saved and months reduced if there are prepayments or rate changes
            const hasPrepaymentOrRateChange = hasRateChanges || hasMultiplePrepayments;
            const interestSavedElement = document.getElementById('totalInterestSaved');
            const monthsReducedElement = document.getElementById('monthsReduced');

            if (hasPrepaymentOrRateChange && (results.interestSaved > 0 || results.tenureReduced !== 0)) {
                interestSavedElement.innerHTML = `Total Interest Saved: ${formatCurrency(results.interestSaved)}`;
                monthsReducedElement.innerHTML =
                    `Months Reduced: ${results.tenureReduced} (${Math.floor(results.tenureReduced/12)} years ${results.tenureReduced%12} months)`;
                interestSavedElement.classList.remove('hidden');
                monthsReducedElement.classList.remove('hidden');
            } else {
                interestSavedElement.classList.add('hidden');
                monthsReducedElement.classList.add('hidden');
            }

            const newTermsText = `New Loan Terms: Paid off in ${Math.floor(results.months/12)} years ${results.months%12} months.`;

            document.getElementById('newLoanTerms').innerHTML = newTermsText;
            document.getElementById('loanResults').classList.remove('hidden');
            
            // Update chart
            if (loanChart !== null) loanChart.destroy();

            const ctx = document.getElementById('loanChart').getContext('2d');
            const isDarkMode = document.body.classList.contains('dark-mode');

            // Create gradient for better visual appeal
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            if (isDarkMode) {
                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
                gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
            } else {
                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
                gradient.addColorStop(1, 'rgba(59, 130, 246, 0.01)');
            }

            loanChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Loan Balance',
                        data: balanceData,
                        borderColor: isDarkMode ? '#60a5fa' : '#3b82f6',
                        backgroundColor: gradient,
                        borderWidth: 3,
                        pointBackgroundColor: isDarkMode ? '#93c5fd' : '#2563eb',
                        pointBorderColor: isDarkMode ? '#1e40af' : '#1e3a8a',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                color: isDarkMode ? '#e2e8f0' : '#1e293b',
                                font: { size: 12, weight: 'bold' },
                                padding: 15
                            }
                        },
                        tooltip: {
                            backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            titleColor: isDarkMode ? '#e2e8f0' : '#1e293b',
                            bodyColor: isDarkMode ? '#cbd5e1' : '#475569',
                            borderColor: isDarkMode ? '#4b5563' : '#e2e8f0',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    return 'Balance: ' + formatCurrency(context.parsed.y);
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            title: {
                                display: true,
                                text: 'Months',
                                color: isDarkMode ? '#e2e8f0' : '#1e293b',
                                font: { size: 13, weight: 'bold' }
                            },
                            ticks: {
                                stepSize: 12,
                                color: isDarkMode ? '#cbd5e1' : '#475569',
                                font: { size: 11 }
                            },
                            grid: {
                                color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(203, 213, 225, 0.5)',
                                drawBorder: false
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: 'Balance (₹)',
                                color: isDarkMode ? '#e2e8f0' : '#1e293b',
                                font: { size: 13, weight: 'bold' }
                            },
                            ticks: {
                                callback: value => formatCurrency(value),
                                color: isDarkMode ? '#cbd5e1' : '#475569',
                                font: { size: 11 }
                            },
                            grid: {
                                color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(203, 213, 225, 0.5)',
                                drawBorder: false
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error('=== Loan Calculation Error ===');
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            console.error('Error object:', error);
            alert(`An error occurred during calculation:\n\n${error.message}\n\nCheck the console (F12) for details.`);
        } finally {
            hideLoading('loanCalculateBtn', 'loanSpinner', 'loanBtnText', 'Calculate Loan Prepayment');
        }
    }, 100);
}

// Update loan chart theme when dark mode toggles
function updateLoanChartTheme() {
    if (!loanChart) return;

    const isDarkMode = document.body.classList.contains('dark-mode');
    const ctx = document.getElementById('loanChart').getContext('2d');

    // Recreate gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    if (isDarkMode) {
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    } else {
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.01)');
    }

    // Update colors
    loanChart.data.datasets[0].borderColor = isDarkMode ? '#60a5fa' : '#3b82f6';
    loanChart.data.datasets[0].backgroundColor = gradient;
    loanChart.data.datasets[0].pointBackgroundColor = isDarkMode ? '#93c5fd' : '#2563eb';
    loanChart.data.datasets[0].pointBorderColor = isDarkMode ? '#1e40af' : '#1e3a8a';

    // Update axis colors
    loanChart.options.plugins.legend.labels.color = isDarkMode ? '#e2e8f0' : '#1e293b';
    loanChart.options.plugins.tooltip.backgroundColor = isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    loanChart.options.plugins.tooltip.titleColor = isDarkMode ? '#e2e8f0' : '#1e293b';
    loanChart.options.plugins.tooltip.bodyColor = isDarkMode ? '#cbd5e1' : '#475569';
    loanChart.options.plugins.tooltip.borderColor = isDarkMode ? '#4b5563' : '#e2e8f0';

    loanChart.options.scales.x.title.color = isDarkMode ? '#e2e8f0' : '#1e293b';
    loanChart.options.scales.x.ticks.color = isDarkMode ? '#cbd5e1' : '#475569';
    loanChart.options.scales.x.grid.color = isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(203, 213, 225, 0.5)';

    loanChart.options.scales.y.title.color = isDarkMode ? '#e2e8f0' : '#1e293b';
    loanChart.options.scales.y.ticks.color = isDarkMode ? '#cbd5e1' : '#475569';
    loanChart.options.scales.y.grid.color = isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(203, 213, 225, 0.5)';

    loanChart.update('none');
}

// SIP Calculation Function
let sipChart = null;
function calculateSIP() {
    // Check mode
    const mode = document.querySelector('input[name="sipMode"]:checked')?.value || 'forward';

    // Validate based on mode
    let sipInputs;
    if (mode === 'goal') {
        sipInputs = [
            document.getElementById('targetAmount'),
            document.getElementById('sipReturn'),
            document.getElementById('sipYears')
        ];
    } else {
        sipInputs = [
            document.getElementById('sipAmount'),
            document.getElementById('sipReturn'),
            document.getElementById('sipYears')
        ];
    }

    if (!validateInputs(sipInputs)) {
        alert('Please fill in all required fields with valid positive numbers.');
        return;
    }

    showLoading('sipCalculateBtn', 'sipSpinner', 'sipBtnText');

    setTimeout(() => {
        try {
            if (mode === 'goal') {
                calculateGoalBasedSIP();
            } else {
                calculateForwardSIP();
            }
        } catch (error) {
            console.error('SIP calculation error:', error);
            alert('An error occurred during calculation. Please check your inputs and try again.');
        } finally {
            const btnText = mode === 'goal' ? 'Calculate Required SIP' : 'Calculate SIP Growth';
            hideLoading('sipCalculateBtn', 'sipSpinner', 'sipBtnText', btnText);
        }
    }, 100);
}

// Forward SIP Calculation (Original Logic)
function calculateForwardSIP() {
    try {
            const inflationInput = document.getElementById('inflationRate');
            let inflationRate = parseFloat(inflationInput.value || 0) / 100 / 12;

            let sipAmount = parseFloat(document.getElementById('sipAmount').value);
            let sipReturn = parseFloat(document.getElementById('sipReturn').value) / 100 / 12;
            let sipYears = parseFloat(document.getElementById('sipYears').value) * 12;
            let sipStepUp = parseFloat(document.getElementById('sipStepUp').value || 0) / 100;
            
            let totalAmount = 0;
            let totalInvested = 0;
            let sipData = [];
            let tableHTML = "";
            let yearlyData = [];
            let currentYear = 1;
            let yearlyInvestment = 0;
            
            // Create full SIP growth table
            for (let i = 1; i <= sipYears; i++) {
                if (i % 12 === 1 && i > 1) {
                    sipAmount *= (1 + sipStepUp);
                }
                
                totalInvested += sipAmount;
                totalAmount = (totalAmount + sipAmount) * (1 + sipReturn);
                let inflationAdjusted = inflationRate > 0 ? totalAmount / Math.pow(1 + inflationRate, i) : totalAmount;
                
                yearlyInvestment += sipAmount;
                if (i % 12 === 0 || i === sipYears) {
                    yearlyData.push({
                        x: currentYear,
                        y: totalAmount,
                        invested: yearlyInvestment
                    });
                    currentYear++;
                    yearlyInvestment = 0;
                }
                
                // Add to full growth table (monthly)
                tableHTML += `<tr class="hover:bg-gray-100 dark:hover:bg-gray-600">
                    <td class='p-2'>${i}</td>
                    <td class='p-2'>${formatCurrency(totalAmount)}</td>
                    <td class='p-2'>${inflationRate > 0 ? formatCurrency(inflationAdjusted) : 'N/A'}</td>
                </tr>`;
            }
            
            // Calculate real returns (if inflation rate provided)
            let realReturns = inflationRate > 0 ? 
                totalAmount / Math.pow(1 + (inflationRate * 12), document.getElementById('sipYears').value) : 
                totalAmount;
            let wealthGain = totalAmount - totalInvested;
            
            saveCalculation('sip', {
                sipAmount,
                sipReturn: document.getElementById('sipReturn').value,
                sipYears: document.getElementById('sipYears').value,
                sipStepUp: document.getElementById('sipStepUp').value,
                inflationRate: document.getElementById('inflationRate').value,
                finalValue: totalAmount,
                realReturns
            });
            
            // Update results with full growth table
            document.getElementById('sipTable').querySelector('tbody').innerHTML = tableHTML;
            document.getElementById('totalInvestment').innerHTML = 
                `Total Invested: ${formatCurrency(totalInvested)}`;
            document.getElementById('finalValue').innerHTML = 
                `Final Investment Value: ${formatCurrency(totalAmount)}`;
            document.getElementById('realReturns').innerHTML = 
                inflationRate > 0 ? 
                `Inflation Adjusted Value: ${formatCurrency(realReturns)}` : 
                `Inflation adjustment not calculated (rate not provided)`;
            document.getElementById('wealthGain').innerHTML = 
                `Wealth Gain: ${formatCurrency(wealthGain)}`;
            document.getElementById('sipResults').classList.remove('hidden');
            
            // Update chart
            if (sipChart !== null) sipChart.destroy();

            const ctx = document.getElementById('sipChart').getContext('2d');
            const isDarkMode = document.body.classList.contains('dark-mode');

            // Create gradients for both datasets
            const investmentGradient = ctx.createLinearGradient(0, 0, 0, 400);
            const investedGradient = ctx.createLinearGradient(0, 0, 0, 400);

            if (isDarkMode) {
                investmentGradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
                investmentGradient.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
                investedGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
                investedGradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
            } else {
                investmentGradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
                investmentGradient.addColorStop(1, 'rgba(16, 185, 129, 0.01)');
                investedGradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                investedGradient.addColorStop(1, 'rgba(59, 130, 246, 0.01)');
            }

            sipChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [
                        {
                            label: 'Investment Value',
                            data: yearlyData,
                            borderColor: isDarkMode ? '#34d399' : '#10b981',
                            backgroundColor: investmentGradient,
                            borderWidth: 3,
                            pointBackgroundColor: isDarkMode ? '#6ee7b7' : '#059669',
                            pointBorderColor: isDarkMode ? '#047857' : '#065f46',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Amount Invested',
                            data: yearlyData.map(item => ({x: item.x, y: item.invested})),
                            borderColor: isDarkMode ? '#60a5fa' : '#3b82f6',
                            backgroundColor: investedGradient,
                            borderWidth: 3,
                            borderDash: [8, 4],
                            pointBackgroundColor: isDarkMode ? '#93c5fd' : '#2563eb',
                            pointBorderColor: isDarkMode ? '#1e40af' : '#1e3a8a',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            labels: {
                                color: isDarkMode ? '#e2e8f0' : '#1e293b',
                                font: { size: 12, weight: 'bold' },
                                padding: 15,
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                            titleColor: isDarkMode ? '#e2e8f0' : '#1e293b',
                            bodyColor: isDarkMode ? '#cbd5e1' : '#475569',
                            borderColor: isDarkMode ? '#4b5563' : '#e2e8f0',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    if (context.datasetIndex === 0) {
                                        return 'Value: ' + formatCurrency(context.parsed.y);
                                    } else {
                                        return 'Invested: ' + formatCurrency(context.parsed.y);
                                    }
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'linear',
                            position: 'bottom',
                            title: {
                                display: true,
                                text: 'Years',
                                color: isDarkMode ? '#e2e8f0' : '#1e293b',
                                font: { size: 13, weight: 'bold' }
                            },
                            ticks: {
                                stepSize: 1,
                                color: isDarkMode ? '#cbd5e1' : '#475569',
                                font: { size: 11 }
                            },
                            grid: {
                                color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(203, 213, 225, 0.5)',
                                drawBorder: false
                            }
                        },
                        y: {
                            id: 'y',
                            title: {
                                display: true,
                                text: 'Amount (₹)',
                                color: isDarkMode ? '#e2e8f0' : '#1e293b',
                                font: { size: 13, weight: 'bold' }
                            },
                            ticks: {
                                color: isDarkMode ? '#cbd5e1' : '#475569',
                                font: { size: 11 },
                                callback: function(value) {
                                    return formatCurrency(value);
                                }
                            },
                            grid: {
                                color: isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(203, 213, 225, 0.5)',
                                drawBorder: false
                            }
                        }
                    }
                }
            });

        // Hide goal planning results, show forward results
        document.getElementById('goalPlanningResults').classList.add('hidden');
        document.getElementById('sipResults').classList.remove('hidden');
    } catch (error) {
        throw error; // Rethrow to be caught by parent
    }
}

// Update SIP chart theme when dark mode toggles
function updateSIPChartTheme() {
    if (!sipChart) return;

    const isDarkMode = document.body.classList.contains('dark-mode');
    const ctx = document.getElementById('sipChart').getContext('2d');

    // Recreate gradients
    const investmentGradient = ctx.createLinearGradient(0, 0, 0, 400);
    const investedGradient = ctx.createLinearGradient(0, 0, 0, 400);

    if (isDarkMode) {
        investmentGradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
        investmentGradient.addColorStop(1, 'rgba(16, 185, 129, 0.05)');
        investedGradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        investedGradient.addColorStop(1, 'rgba(59, 130, 246, 0.02)');
    } else {
        investmentGradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
        investmentGradient.addColorStop(1, 'rgba(16, 185, 129, 0.01)');
        investedGradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        investedGradient.addColorStop(1, 'rgba(59, 130, 246, 0.01)');
    }

    // Update colors for Investment Value dataset
    sipChart.data.datasets[0].borderColor = isDarkMode ? '#34d399' : '#10b981';
    sipChart.data.datasets[0].backgroundColor = investmentGradient;
    sipChart.data.datasets[0].pointBackgroundColor = isDarkMode ? '#6ee7b7' : '#059669';
    sipChart.data.datasets[0].pointBorderColor = isDarkMode ? '#047857' : '#065f46';

    // Update colors for Amount Invested dataset
    sipChart.data.datasets[1].borderColor = isDarkMode ? '#60a5fa' : '#3b82f6';
    sipChart.data.datasets[1].backgroundColor = investedGradient;
    sipChart.data.datasets[1].pointBackgroundColor = isDarkMode ? '#93c5fd' : '#2563eb';
    sipChart.data.datasets[1].pointBorderColor = isDarkMode ? '#1e40af' : '#1e3a8a';

    // Update legend and tooltip colors
    sipChart.options.plugins.legend.labels.color = isDarkMode ? '#e2e8f0' : '#1e293b';
    sipChart.options.plugins.tooltip.backgroundColor = isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    sipChart.options.plugins.tooltip.titleColor = isDarkMode ? '#e2e8f0' : '#1e293b';
    sipChart.options.plugins.tooltip.bodyColor = isDarkMode ? '#cbd5e1' : '#475569';
    sipChart.options.plugins.tooltip.borderColor = isDarkMode ? '#4b5563' : '#e2e8f0';

    // Update axis colors
    sipChart.options.scales.x.title.color = isDarkMode ? '#e2e8f0' : '#1e293b';
    sipChart.options.scales.x.ticks.color = isDarkMode ? '#cbd5e1' : '#475569';
    sipChart.options.scales.x.grid.color = isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(203, 213, 225, 0.5)';

    sipChart.options.scales.y.title.color = isDarkMode ? '#e2e8f0' : '#1e293b';
    sipChart.options.scales.y.ticks.color = isDarkMode ? '#cbd5e1' : '#475569';
    sipChart.options.scales.y.grid.color = isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(203, 213, 225, 0.5)';

    sipChart.update('none');
}

// Goal-Based SIP Calculation
function calculateGoalBasedSIP() {
    try {
        const targetAmount = parseFloat(document.getElementById('targetAmount').value);
        const sipReturn = parseFloat(document.getElementById('sipReturn').value);
        const sipYears = parseFloat(document.getElementById('sipYears').value);
        const sipStepUp = parseFloat(document.getElementById('sipStepUp').value || 0);
        const inflationRate = parseFloat(document.getElementById('inflationRate').value || 0);

        // Use goal seeker to calculate required SIP
        const result = goalSeeker.calculateRequiredSIP(
            targetAmount,
            sipYears,
            sipReturn,
            inflationRate,
            sipStepUp
        );

        // Display results
        document.getElementById('requiredSIP').innerHTML =
            `<strong>Required Monthly SIP:</strong> ${formatCurrency(result.requiredSIP)}`;
        document.getElementById('totalInvestmentGoal').innerHTML =
            `Total Investment: ${formatCurrency(result.totalInvestment)}`;
        document.getElementById('achievedAmount').innerHTML =
            `Expected Final Value: ${formatCurrency(result.achievedAmount)}`;
        document.getElementById('realValueGoal').innerHTML =
            inflationRate > 0 ?
            `Real Value (inflation-adjusted): ${formatCurrency(result.realValue)}` :
            `Real Value: ${formatCurrency(result.achievedAmount)} (no inflation adjustment)`;
        document.getElementById('successProbability').innerHTML =
            `✓ Goal is achievable - Required SIP calculated successfully`;

        // Hide forward results, show goal planning results
        document.getElementById('sipResults').classList.add('hidden');
        document.getElementById('goalPlanningResults').classList.remove('hidden');

    } catch (error) {
        throw error; // Rethrow to be caught by parent
    }
}

// Export Functions
function exportLoanReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Loan Prepayment Report', 105, 15, null, null, 'center');
    
    doc.setFontSize(12);
    doc.text('Loan Details:', 14, 25);
    doc.text(`Loan Amount: ${document.getElementById('loanAmount').value}`, 20, 35);
    doc.text(`Interest Rate: ${document.getElementById('interestRate').value}%`, 20, 45);
    doc.text(`Loan Tenure: ${document.getElementById('loanTenure').value} years`, 20, 55);
    
    doc.text('Summary:', 14, 80);
    doc.text(document.getElementById('originalLoanTerms').textContent, 20, 90);
    doc.text(document.getElementById('totalInterestSaved').textContent, 20, 100);
    doc.text(document.getElementById('monthsReduced').textContent, 20, 110);
    doc.text(document.getElementById('newLoanTerms').textContent, 20, 120);
    
    const loanChartCanvas = document.getElementById('loanChart');
    const chartImage = loanChartCanvas.toDataURL('image/png');
    doc.addImage(chartImage, 'PNG', 30, 130, 150, 80);
    
    doc.save('loan_prepayment_report.pdf');
}

function exportSIPReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('SIP Growth Report', 105, 15, null, null, 'center');
    
    doc.setFontSize(12);
    doc.text('Investment Details:', 14, 25);
    doc.text(`Monthly SIP: ${document.getElementById('sipAmount').value}`, 20, 35);
    doc.text(`Expected Return: ${document.getElementById('sipReturn').value}%`, 20, 45);
    doc.text(`Investment Duration: ${document.getElementById('sipYears').value} years`, 20, 55);
    doc.text(`Annual Step-Up: ${document.getElementById('sipStepUp').value || 0}%`, 20, 65);
    doc.text(`Inflation Rate: ${document.getElementById('inflationRate').value || 'Not provided'}%`, 20, 75);
    
    doc.text('Summary:', 14, 90);
    doc.text(document.getElementById('totalInvestment').textContent, 20, 100);
    doc.text(document.getElementById('finalValue').textContent, 20, 110);
    doc.text(document.getElementById('realReturns').textContent, 20, 120);
    doc.text(document.getElementById('wealthGain').textContent, 20, 130);
    
    const sipChartCanvas = document.getElementById('sipChart');
    const chartImage = sipChartCanvas.toDataURL('image/png');
    doc.addImage(chartImage, 'PNG', 30, 140, 150, 80);
    
    doc.save('sip_growth_report.pdf');
}

// Handle SIP Mode Switching
function handleSIPModeChange() {
    const mode = document.querySelector('input[name="sipMode"]:checked')?.value || 'forward';
    const goalInputs = document.getElementById('goalPlanningInputs');
    const forwardInputs = document.getElementById('forwardCalculationInputs');
    const sipBtnText = document.getElementById('sipBtnText');

    if (mode === 'goal') {
        goalInputs.classList.remove('hidden');
        forwardInputs.classList.add('hidden');
        sipBtnText.textContent = 'Calculate Required SIP';
    } else {
        goalInputs.classList.add('hidden');
        forwardInputs.classList.remove('hidden');
        sipBtnText.textContent = 'Calculate SIP Growth';
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize UI controllers
    loanUIController.init();
    scenarioComparison.init();

    // Initialize live dashboard
    initLiveDashboard().catch(err => {
        console.error('Failed to initialize live dashboard:', err);
    });

    loadPreviousCalculations();

    // Set up SIP mode change listeners
    document.querySelectorAll('input[name="sipMode"]').forEach(radio => {
        radio.addEventListener('change', handleSIPModeChange);
    });

    document.getElementById('loanCalculateBtn').addEventListener('click', calculateLoan);
    document.getElementById('sipCalculateBtn').addEventListener('click', calculateSIP);
    document.getElementById('clearLoanBtn').addEventListener('click', clearLoanForm);
    document.getElementById('clearSIPBtn').addEventListener('click', clearSIPForm);
    document.getElementById('exportLoanBtn').addEventListener('click', exportLoanReport);
    document.getElementById('exportSIPBtn').addEventListener('click', exportSIPReport);
    document.getElementById('loanExampleBtn').addEventListener('click', showLoanExample);
    document.getElementById('sipExampleBtn').addEventListener('click', showSIPExample);
    document.getElementById('darkModeToggle').addEventListener('click', toggleDarkMode);

    document.getElementById('loanScenario').addEventListener('change', function() {
        const scenario = this.value;
        console.log('Loan scenario changed to:', scenario);

        if (loanScenarios[scenario]) {
            const scenarioData = loanScenarios[scenario];
            const updatedFields = [];

            // Only update fields if the scenario has defined values
            if (scenarioData.defaultInterest !== null) {
                const field = document.getElementById('interestRate');
                field.value = scenarioData.defaultInterest;
                field.classList.add('scenario-applied');
                setTimeout(() => field.classList.remove('scenario-applied'), 600);
                updatedFields.push('Interest Rate');
            }
            if (scenarioData.defaultTenure !== null) {
                const field = document.getElementById('loanTenure');
                field.value = scenarioData.defaultTenure;
                field.classList.add('scenario-applied');
                setTimeout(() => field.classList.remove('scenario-applied'), 600);
                updatedFields.push('Loan Tenure');
            }

            if (updatedFields.length > 0) {
                console.log('Applied loan scenario:', scenario, '- Updated:', updatedFields.join(', '));
            }
        }
    });

    document.getElementById('investmentGoal').addEventListener('change', function() {
        const goal = this.value;
        console.log('Investment goal changed to:', goal);

        if (investmentGoals[goal]) {
            const goalData = investmentGoals[goal];
            const updatedFields = [];

            // Only update fields if the goal has defined values
            if (goalData.defaultReturn !== null) {
                const field = document.getElementById('sipReturn');
                field.value = goalData.defaultReturn;
                field.classList.add('scenario-applied');
                setTimeout(() => field.classList.remove('scenario-applied'), 600);
                updatedFields.push('Expected Return');
            }
            if (goalData.defaultYears !== null) {
                const field = document.getElementById('sipYears');
                field.value = goalData.defaultYears;
                field.classList.add('scenario-applied');
                setTimeout(() => field.classList.remove('scenario-applied'), 600);
                updatedFields.push('Investment Duration');
            }
            if (goalData.exampleInflation !== null) {
                const field = document.getElementById('inflationRate');
                field.value = goalData.exampleInflation;
                field.classList.add('scenario-applied');
                setTimeout(() => field.classList.remove('scenario-applied'), 600);
                updatedFields.push('Inflation Rate');
            }

            if (updatedFields.length > 0) {
                console.log('Applied investment goal:', goal, '- Updated:', updatedFields.join(', '));
            }
        }
    });
});