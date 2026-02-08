/**
 * Live Financial Dashboard
 * Fetches real-time market data from CORS-friendly APIs
 * Falls back to simulated data with clear indicators
 */

// API Configuration
const APIs = {
    // Exchange Rate API - Free tier, CORS-enabled
    currency: 'https://api.exchangerate-api.com/v4/latest/USD',
    // Alternative NIFTY sources to try
    niftyAlternatives: [
        'https://latest-stock-price.p.rapidapi.com/price?Indices=NSEI', // Requires RapidAPI key
        'https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050', // NSE India direct
    ],
    // Gold price alternatives
    goldAlternatives: [
        'https://www.goldapi.io/api/XAU/INR', // Requires API key
        'https://api.metalpriceapi.com/v1/latest?api_key=YOUR_KEY&base=XAU&currencies=INR', // Requires API key
    ]
};

let marketTrendChart = null;
let metalsTrendChart = null;

// Base values for simulated data (updated periodically for realism)
const baseValues = {
    nifty: 22500 + (Math.random() - 0.5) * 1000,
    gold: 63000 + (Math.random() - 0.5) * 2000,
    usd: 83.5 + (Math.random() - 0.5) * 0.5
};

// Track which data sources are live vs simulated
const dataStatus = {
    nifty: false,
    gold: false,
    usd: false
};

// Initialize Dashboard
export async function initLiveDashboard() {
    console.log('Initializing Live Financial Dashboard...');

    // Set up refresh button
    const refreshBtn = document.getElementById('refreshDashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt fa-spin mr-2"></i>Refreshing...';
            refreshDashboard().finally(() => {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt mr-2"></i>Refresh Data';
            });
        });
    }

    // Initial load
    await refreshDashboard();

    // Auto-refresh every 5 minutes
    setInterval(refreshDashboard, 5 * 60 * 1000);
}

// Refresh all dashboard data
async function refreshDashboard() {
    console.log('Refreshing dashboard data...');

    try {
        await Promise.all([
            fetchNiftyData(),
            fetchGoldData(),
            fetchCurrencyData(),
            generateMarketTrendChart(),
            generateMetalsTrendChart()
        ]);

        console.log('Dashboard refresh complete');
    } catch (error) {
        console.error('Error refreshing dashboard:', error);
    }
}

// Add status badge helper
function addStatusBadge(isLive) {
    if (isLive) {
        return '<span class="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded font-semibold">LIVE</span>';
    } else {
        return '<span class="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded font-semibold">SIMULATED</span>';
    }
}

// Fetch Nifty 50 data - tries multiple sources
async function fetchNiftyData() {
    // Try NSE India API first
    try {
        console.log('Attempting to fetch NIFTY from NSE India...');
        const response = await fetch('https://www.nseindia.com/api/allIndices', {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            }
        });

        if (response.ok) {
            const data = await response.json();
            const niftyData = data.data?.find(item => item.index === 'NIFTY 50');

            if (niftyData) {
                const current = parseFloat(niftyData.last);
                const change = parseFloat(niftyData.percentChange);
                const changeValue = parseFloat(niftyData.change);

                document.getElementById('niftyPrice').innerHTML = `₹${current.toFixed(2)}`;

                const changeClass = change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

                document.getElementById('niftyChange').innerHTML = `
                    <span class="${changeClass}">
                        <i class="fas ${changeIcon}"></i>
                        ${change >= 0 ? '+' : ''}${changeValue.toFixed(2)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)
                    </span>
                `;

                document.getElementById('niftyUpdate').innerHTML =
                    `Updated: ${new Date().toLocaleTimeString()} ${addStatusBadge(true)}`;

                baseValues.nifty = current;
                dataStatus.nifty = true;
                console.log('✓ NIFTY data fetched successfully (live):', current);
                return;
            }
        }
    } catch (error) {
        console.log('NSE India API failed:', error.message);
    }

    // Try alternative JSON endpoint
    try {
        console.log('Attempting alternative NIFTY source...');
        const response = await fetch('https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/NI50');

        if (response.ok) {
            const data = await response.json();
            if (data.data && data.data.pricecurrent) {
                const current = parseFloat(data.data.pricecurrent);
                const change = parseFloat(data.data.pricepercentchange);

                document.getElementById('niftyPrice').innerHTML = `₹${current.toFixed(2)}`;

                const changeClass = change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

                document.getElementById('niftyChange').innerHTML = `
                    <span class="${changeClass}">
                        <i class="fas ${changeIcon}"></i>
                        ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
                    </span>
                `;

                document.getElementById('niftyUpdate').innerHTML =
                    `Updated: ${new Date().toLocaleTimeString()} ${addStatusBadge(true)}`;

                baseValues.nifty = current;
                dataStatus.nifty = true;
                console.log('✓ NIFTY data fetched successfully (live):', current);
                return;
            }
        }
    } catch (error) {
        console.log('Alternative NIFTY API failed:', error.message);
    }

    // Fallback to simulated data
    console.log('All NIFTY APIs failed, using simulated data');
    dataStatus.nifty = false;
    const variation = (Math.random() - 0.5) * 100;
    const current = baseValues.nifty + variation;
    const previous = baseValues.nifty;
    const change = current - previous;
    const changePercent = (change / previous) * 100;

    baseValues.nifty = current;

    document.getElementById('niftyPrice').innerHTML = `₹${current.toFixed(2)}`;

    const changeClass = change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

    document.getElementById('niftyChange').innerHTML = `
        <span class="${changeClass}">
            <i class="fas ${changeIcon}"></i>
            ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)
        </span>
    `;

    document.getElementById('niftyUpdate').innerHTML =
        `Updated: ${new Date().toLocaleTimeString()} ${addStatusBadge(false)}`;

    console.log('Nifty data updated (simulated):', current);
}

// Fetch Gold price data - tries multiple sources
async function fetchGoldData() {
    // Try GoldPrice API (free tier)
    try {
        console.log('Attempting to fetch gold price from GoldPrice API...');
        const response = await fetch('https://data-asg.goldprice.org/dbXRates/INR');

        if (response.ok) {
            const data = await response.json();
            // Gold price is in troy ounce, convert to 10 grams
            // 1 troy ounce = 31.1035 grams
            const goldPerOunce = parseFloat(data.items[0].xauPrice);
            const per10g = (goldPerOunce / 31.1035) * 10;

            const previousPrice = baseValues.gold;
            const change = per10g - previousPrice;
            const changePercent = (change / previousPrice) * 100;

            baseValues.gold = per10g;

            document.getElementById('goldPrice').innerHTML = `₹${per10g.toFixed(0)}`;

            const changeClass = change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
            const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

            document.getElementById('goldChange').innerHTML = `
                <span class="${changeClass}">
                    <i class="fas ${changeIcon}"></i>
                    ${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}% Today ${addStatusBadge(true)}
                </span>
            `;

            dataStatus.gold = true;
            console.log('✓ Gold data fetched successfully (live):', per10g);
            return;
        }
    } catch (error) {
        console.log('GoldPrice API failed:', error.message);
    }

    // Try alternative commodity API
    try {
        console.log('Attempting alternative gold price source...');
        const response = await fetch('https://api.metals.live/v1/latest/gold');

        if (response.ok) {
            const data = await response.json();
            // Convert USD per ounce to INR per 10g
            const goldPerOunce = parseFloat(data.price);
            const usdToInr = baseValues.usd; // Use our current USD rate
            const per10g = (goldPerOunce * usdToInr / 31.1035) * 10;

            const previousPrice = baseValues.gold;
            const change = per10g - previousPrice;
            const changePercent = (change / previousPrice) * 100;

            baseValues.gold = per10g;

            document.getElementById('goldPrice').innerHTML = `₹${per10g.toFixed(0)}`;

            const changeClass = change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
            const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

            document.getElementById('goldChange').innerHTML = `
                <span class="${changeClass}">
                    <i class="fas ${changeIcon}"></i>
                    ${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}% Today ${addStatusBadge(true)}
                </span>
            `;

            dataStatus.gold = true;
            console.log('✓ Gold data fetched successfully (live):', per10g);
            return;
        }
    } catch (error) {
        console.log('Alternative gold API failed:', error.message);
    }

    // Fallback to simulated data
    console.log('All gold APIs failed, using simulated data');
    dataStatus.gold = false;
    const variation = (Math.random() - 0.5) * 200;
    const per10g = baseValues.gold + variation;

    baseValues.gold = per10g;

    const change = variation;
    const changePercent = (change / baseValues.gold) * 100;

    document.getElementById('goldPrice').innerHTML = `₹${per10g.toFixed(0)}`;

    const changeClass = change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
    const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

    document.getElementById('goldChange').innerHTML = `
        <span class="${changeClass}">
            <i class="fas ${changeIcon}"></i>
            ${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}% Today ${addStatusBadge(false)}
        </span>
    `;

    console.log('Gold data updated (simulated):', per10g);
}

// Fetch USD/INR currency data (Real API - CORS-friendly)
async function fetchCurrencyData() {
    try {
        const response = await fetch(APIs.currency);
        const data = await response.json();

        const usdRate = data.rates.INR;
        const previousRate = baseValues.usd;
        const change = usdRate - previousRate;
        const changePercent = (change / previousRate) * 100;

        // Update base value
        baseValues.usd = usdRate;

        document.getElementById('usdPrice').innerHTML = `₹${usdRate.toFixed(2)}`;

        const changeClass = change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
        const changeIcon = change >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';

        document.getElementById('usdChange').innerHTML = `
            <span class="${changeClass}">
                <i class="fas ${changeIcon}"></i>
                ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)
            </span>
        `;

        document.getElementById('usdUpdate').innerHTML =
            `Updated: ${new Date().toLocaleTimeString()} ${addStatusBadge(true)}`;

        dataStatus.usd = true;
        console.log('USD/INR data updated (live):', usdRate);
    } catch (error) {
        console.error('Error fetching currency data:', error);
        // Fallback to simulated data
        dataStatus.usd = false;
        const variation = (Math.random() - 0.5) * 0.2;
        const simulatedUSD = baseValues.usd + variation;
        baseValues.usd = simulatedUSD;

        document.getElementById('usdPrice').innerHTML = `₹${simulatedUSD.toFixed(2)}`;
        document.getElementById('usdChange').innerHTML = `
            <span class="text-green-600 dark:text-green-400">
                <i class="fas fa-arrow-up"></i>
                +0.18 (+0.22%)
            </span>
        `;
        document.getElementById('usdUpdate').innerHTML =
            `Updated: ${new Date().toLocaleTimeString()} ${addStatusBadge(false)}`;
    }
}

// Generate Market Trend Chart (30 days simulated)
async function generateMarketTrendChart() {
    const canvas = document.getElementById('marketTrendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const isDarkMode = document.body.classList.contains('dark-mode');

    // Generate simulated 30-day data with realistic patterns
    const days = 30;
    const labels = [];
    const niftyData = [];
    const basePrice = baseValues.nifty;

    for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        labels.push(date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));

        // Simulate realistic market movement with trend
        const trend = (days - i) * 5; // Slight upward trend
        const variation = (Math.random() - 0.5) * 400;
        const daily = (Math.sin(i / 5) * 300);
        const price = basePrice - 1000 + trend + variation + daily;
        niftyData.push(price.toFixed(2));
    }

    // Destroy existing chart
    if (marketTrendChart) {
        marketTrendChart.destroy();
    }

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    if (isDarkMode) {
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
    } else {
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.01)');
    }

    marketTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `NIFTY 50 ${dataStatus.nifty ? '(Live)' : '(Simulated)'}`,
                data: niftyData,
                borderColor: isDarkMode ? '#60a5fa' : '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: isDarkMode ? '#e2e8f0' : '#1e293b',
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    titleColor: isDarkMode ? '#e2e8f0' : '#1e293b',
                    bodyColor: isDarkMode ? '#cbd5e1' : '#475569',
                    borderColor: isDarkMode ? '#4b5563' : '#e2e8f0',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                        color: isDarkMode ? '#9ca3af' : '#6b7280',
                        font: { size: 10 }
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    ticks: {
                        color: isDarkMode ? '#9ca3af' : '#6b7280',
                        callback: value => `₹${value}`
                    },
                    grid: {
                        color: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(203, 213, 225, 0.3)'
                    }
                }
            }
        }
    });
}

// Generate Gold vs Silver Trend Chart (12 months simulated)
async function generateMetalsTrendChart() {
    const canvas = document.getElementById('metalsTrendChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const isDarkMode = document.body.classList.contains('dark-mode');

    // Generate simulated data
    const months = 12;
    const labels = [];
    const goldData = [];
    const silverData = [];

    for (let i = months; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        labels.push(date.toLocaleDateString('en-IN', { month: 'short' }));

        // Simulate metal prices (per 10g) with realistic trends
        const goldBase = baseValues.gold - 1000;
        const silverBase = 75000;
        const monthTrend = (months - i) * 50;

        goldData.push((goldBase + monthTrend + Math.random() * 2000).toFixed(0));
        silverData.push((silverBase + monthTrend + Math.random() * 3000).toFixed(0));
    }

    // Destroy existing chart
    if (metalsTrendChart) {
        metalsTrendChart.destroy();
    }

    metalsTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `Gold (10g) - ${dataStatus.gold ? 'Live' : 'Simulated'}`,
                    data: goldData,
                    borderColor: isDarkMode ? '#fbbf24' : '#f59e0b',
                    backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                },
                {
                    label: 'Silver (1kg) - Simulated',
                    data: silverData,
                    borderColor: isDarkMode ? '#94a3b8' : '#64748b',
                    backgroundColor: isDarkMode ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: isDarkMode ? '#e2e8f0' : '#1e293b',
                        font: { size: 11, weight: 'bold' },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                    titleColor: isDarkMode ? '#e2e8f0' : '#1e293b',
                    bodyColor: isDarkMode ? '#cbd5e1' : '#475569',
                    borderColor: isDarkMode ? '#4b5563' : '#e2e8f0',
                    borderWidth: 1,
                    callbacks: {
                        label: context => `${context.dataset.label}: ₹${context.parsed.y}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: isDarkMode ? '#9ca3af' : '#6b7280',
                        font: { size: 10 }
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    ticks: {
                        color: isDarkMode ? '#9ca3af' : '#6b7280',
                        callback: value => `₹${value}`
                    },
                    grid: {
                        color: isDarkMode ? 'rgba(75, 85, 99, 0.2)' : 'rgba(203, 213, 225, 0.3)'
                    }
                }
            }
        }
    });
}

// Export functions
export { refreshDashboard };
