// Format currency with Indian Rupee symbol and commas
function formatCurrency(amount) {
    return '₹' + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

// Format percentage with proper rounding
function formatPercentage(rate) {
    return parseFloat(rate).toFixed(2) + '%';
}

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
        } else if (parseFloat(input.value) <= 0) {
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
    }
};

const investmentGoals = {
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
    }
};

// Example Data Functions
function showLoanExample() {
    const scenario = document.getElementById('loanScenario').value || 'home';
    document.getElementById('loanAmount').value = loanScenarios[scenario].exampleAmount;
    document.getElementById('interestRate').value = loanScenarios[scenario].defaultInterest;
    document.getElementById('loanTenure').value = loanScenarios[scenario].defaultTenure;
    document.getElementById('extraPayment').value = loanScenarios[scenario].exampleExtra;
}

function showSIPExample() {
    const goal = document.getElementById('investmentGoal').value || 'retirement';
    document.getElementById('sipAmount').value = investmentGoals[goal].exampleAmount;
    document.getElementById('sipReturn').value = investmentGoals[goal].defaultReturn;
    document.getElementById('sipYears').value = investmentGoals[goal].defaultYears;
    document.getElementById('sipStepUp').value = investmentGoals[goal].exampleStepUp;
    document.getElementById('inflationRate').value = investmentGoals[goal].exampleInflation;
}

// Clear Form Functions
function clearLoanForm() {
    document.getElementById('loanAmount').value = '';
    document.getElementById('interestRate').value = '';
    document.getElementById('loanTenure').value = '';
    document.getElementById('extraPayment').value = '';
    document.getElementById('loanResults').classList.add('hidden');
}

function clearSIPForm() {
    document.getElementById('sipAmount').value = '';
    document.getElementById('sipReturn').value = '';
    document.getElementById('sipYears').value = '';
    document.getElementById('sipStepUp').value = '';
    document.getElementById('inflationRate').value = '';
    document.getElementById('sipResults').classList.add('hidden');
}

// Dark Mode Toggle
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}

// Check for saved dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
}

// Loan Calculation Function
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
            let loanAmount = parseFloat(document.getElementById('loanAmount').value);
            let interestRate = parseFloat(document.getElementById('interestRate').value) / 100 / 12;
            let loanTenure = parseFloat(document.getElementById('loanTenure').value) * 12;
            let extraPayment = parseFloat(document.getElementById('extraPayment').value || 0);
            let startPrepaymentMonth = parseInt(document.getElementById('startPrepaymentMonth').value || 1);
            let lumpSumAmount = parseFloat(document.getElementById('lumpSumAmount').value || 0);
            let lumpSumMonth = parseInt(document.getElementById('lumpSumMonth').value || 0);
            
            let emi = (loanAmount * interestRate * Math.pow(1 + interestRate, loanTenure)) / 
                    (Math.pow(1 + interestRate, loanTenure) - 1);
            let remainingBalance = loanAmount;
            let months = 0;
            let balanceData = [];
            let tableHTML = "";
            let totalInterestPaid = 0;
            let totalPrincipalPaid = 0;
            let originalMonths = loanTenure;
            let originalTotalInterest = (emi * originalMonths) - loanAmount;
            let originalEmi = emi;
            let lumpSumApplied = false;
            let lumpSumDetails = "";
            
            while (remainingBalance > 0 && months < originalMonths * 2) {
                months++;
                let interest = remainingBalance * interestRate;
                let principal = emi - interest;
                let paymentType = "Regular";
                
                // Apply extra payment only after start month
                if (months >= startPrepaymentMonth) {
                    principal += extraPayment;
                    paymentType = "Prepayment";
                }
                
                // Apply lump sum payment in specified month
                if (lumpSumMonth > 0 && months === lumpSumMonth) {
                    principal += lumpSumAmount;
                    paymentType = "Lump Sum";
                    lumpSumApplied = true;
                    lumpSumDetails = `Lump sum of ${formatCurrency(lumpSumAmount)} applied in month ${months}`;
                }
                
                // Adjust principal if it would overpay the loan
                if (principal > remainingBalance) {
                    principal = remainingBalance;
                }
                
                totalInterestPaid += interest;
                totalPrincipalPaid += principal;
                remainingBalance -= principal;
                
                // Add to chart data (every 6 months for performance)
                if (months % 6 === 0 || months === 1 || remainingBalance <= 0) {
                    balanceData.push({x: months, y: Math.max(remainingBalance, 0)});
                }
                
                // Add to full amortization table with appropriate highlighting
                let rowClass = "hover:bg-gray-100 dark:hover:bg-gray-600";
                if (paymentType === "Lump Sum") {
                    rowClass += " highlight-lumpsum";
                } else if (paymentType === "Prepayment") {
                    rowClass += " highlight-prepayment";
                }
                
                tableHTML += `<tr class="${rowClass}">
                    <td class='p-2'>${months}</td>
                    <td class='p-2'>${formatCurrency(Math.max(remainingBalance, 0))}</td>
                    <td class='p-2'>${formatCurrency(interest)}</td>
                    <td class='p-2'>${formatCurrency(principal)}</td>
                    <td class='p-2'>${paymentType}</td>
                </tr>`;
                
                if (remainingBalance <= 0) break;
            }
            
            let interestSaved = Math.max(originalTotalInterest - totalInterestPaid, 0);
            
            saveCalculation('loan', {
                loanAmount,
                interestRate: document.getElementById('interestRate').value,
                loanTenure: document.getElementById('loanTenure').value,
                extraPayment,
                startPrepaymentMonth,
                lumpSumAmount,
                lumpSumMonth,
                interestSaved,
                monthsReduced: originalMonths - months
            });
            
            // Update results
            document.getElementById('loanTable').querySelector('tbody').innerHTML = tableHTML;
            document.getElementById('originalLoanTerms').innerHTML = 
                `Original Loan Terms: ${formatCurrency(loanAmount)} at ${formatPercentage(document.getElementById('interestRate').value)} ` +
                `for ${document.getElementById('loanTenure').value} years (EMI: ${formatCurrency(originalEmi)})`;
            document.getElementById('totalInterestSaved').innerHTML = 
                `Total Interest Saved: ${formatCurrency(interestSaved)}`;
            document.getElementById('monthsReduced').innerHTML = 
                `Months Reduced: ${originalMonths - months} (${Math.floor((originalMonths - months)/12)} years ${(originalMonths - months)%12} months)`;
            
            let newTermsText = `New Loan Terms: Paid off in ${Math.floor(months/12)} years ${months%12} months ` +
                `with ${extraPayment > 0 ? formatCurrency(emi + extraPayment) : formatCurrency(emi)} monthly payment`;
            
            if (lumpSumApplied) {
                newTermsText += `<br>${lumpSumDetails}`;
            }
            
            if (startPrepaymentMonth > 1) {
                newTermsText += `<br>Prepayments started from month ${startPrepaymentMonth}`;
            }
            
            document.getElementById('newLoanTerms').innerHTML = newTermsText;
            document.getElementById('loanResults').classList.remove('hidden');
            
            // Update chart
            if (loanChart !== null) loanChart.destroy();
            
            const ctx = document.getElementById('loanChart').getContext('2d');
            loanChart = new Chart(ctx, {
                type: 'line',
                data: { 
                    datasets: [{ 
                        label: 'Loan Balance', 
                        data: balanceData, 
                        borderColor: '#3b82f6',
                        backgroundColor: '#3b82f6',
                        borderWidth: 2,
                        pointBackgroundColor: '#1d4ed8',
                        pointRadius: 3,
                        fill: false 
                    }] 
                },
                options: {
                    responsive: true,
                    plugins: {
                        tooltip: {
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
                            title: { display: true, text: 'Months' },
                            ticks: { stepSize: 12 }
                        },
                        y: { 
                            title: { display: true, text: 'Balance (₹)' },
                            ticks: { callback: value => formatCurrency(value) }
                        }
                    }
                }
            });
            
            // Update chart colors for dark mode
            if (document.body.classList.contains('dark-mode')) {
                loanChart.options.scales.x.ticks.color = '#e2e8f0';
                loanChart.options.scales.x.title.color = '#e2e8f0';
                loanChart.options.scales.y.ticks.color = '#e2e8f0';
                loanChart.options.scales.y.title.color = '#e2e8f0';
                loanChart.update();
            }
            
        } catch (error) {
            console.error('Loan calculation error:', error);
            alert('An error occurred during calculation. Please check your inputs and try again.');
        } finally {
            hideLoading('loanCalculateBtn', 'loanSpinner', 'loanBtnText', 'Calculate Loan Prepayment');
        }
    }, 100);
}

// SIP Calculation Function
let sipChart = null;
function calculateSIP() {
    const sipInputs = [
        document.getElementById('sipAmount'),
        document.getElementById('sipReturn'),
        document.getElementById('sipYears')
    ];
    
    // Make inflation rate optional
    const inflationInput = document.getElementById('inflationRate');
    let inflationRate = parseFloat(inflationInput.value || 0) / 100 / 12;
    
    if (!validateInputs(sipInputs)) {
        alert('Please fill in all required fields with valid positive numbers.');
        return;
    }
    
    showLoading('sipCalculateBtn', 'sipSpinner', 'sipBtnText');
    
    setTimeout(() => {
        try {
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
            sipChart = new Chart(ctx, {
                type: 'line',
                data: { 
                    datasets: [
                        { 
                            label: 'Investment Value', 
                            data: yearlyData, 
                            borderColor: '#10b981',
                            backgroundColor: '#10b981',
                            borderWidth: 2,
                            pointBackgroundColor: '#047857',
                            pointRadius: 3,
                            fill: false,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Amount Invested',
                            data: yearlyData.map(item => ({x: item.x, y: item.invested})),
                            borderColor: '#3b82f6',
                            backgroundColor: '#3b82f6',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            pointBackgroundColor: '#1d4ed8',
                            pointRadius: 3,
                            fill: false,
                            yAxisID: 'y'
                        }
                    ] 
                },
                options: { 
                    responsive: true,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    if (context.datasetIndex === 0) {
                                        return 'Value: ' + formatCurrency(context.parsed.y);
                                    } else {
                                        return 'Invested: ' + formatCurrency(context.parsed.y);
                                    }
                                }
                            }
                        },
                        legend: {
                            labels: {
                                color: '#1e293b'
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
                                color: '#1e293b'
                            },
                            ticks: {
                                color: '#1e293b',
                                stepSize: 1
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        },
                        y: { 
                            id: 'y',
                            title: { 
                                display: true, 
                                text: 'Amount (₹)',
                                color: '#1e293b'
                            },
                            ticks: {
                                color: '#1e293b',
                                callback: function(value) {
                                    return formatCurrency(value);
                                }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.1)'
                            }
                        }
                    } 
                }
            });
            
            if (document.body.classList.contains('dark-mode')) {
                sipChart.options.scales.x.ticks.color = '#e2e8f0';
                sipChart.options.scales.x.title.color = '#e2e8f0';
                sipChart.options.scales.y.ticks.color = '#e2e8f0';
                sipChart.options.scales.y.title.color = '#e2e8f0';
                sipChart.options.plugins.legend.labels.color = '#e2e8f0';
                sipChart.update();
            }
            
        } catch (error) {
            console.error('SIP calculation error:', error);
            alert('An error occurred during calculation. Please check your inputs and try again.');
        } finally {
            hideLoading('sipCalculateBtn', 'sipSpinner', 'sipBtnText', 'Calculate SIP Growth');
        }
    }, 100);
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
    doc.text(`Extra Payment: ${document.getElementById('extraPayment').value || 0}`, 20, 65);
    
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

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    loadPreviousCalculations();
    
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
        if (loanScenarios[scenario]) {
            document.getElementById('interestRate').value = loanScenarios[scenario].defaultInterest;
            document.getElementById('loanTenure').value = loanScenarios[scenario].defaultTenure;
        }
    });
    
    document.getElementById('investmentGoal').addEventListener('change', function() {
        const goal = this.value;
        if (investmentGoals[goal]) {
            document.getElementById('sipReturn').value = investmentGoals[goal].defaultReturn;
            document.getElementById('sipYears').value = investmentGoals[goal].defaultYears;
            document.getElementById('inflationRate').value = investmentGoals[goal].exampleInflation;
        }
    });
});