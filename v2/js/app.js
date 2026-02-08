// ── Imports ──
import { AdvancedLoanCalculator, LoanConfiguration } from './core/LoanCalculator.js';
import { AdvancedSIPCalculator, GoalSeekingSIPCalculator, goalSeeker, retirementPlanner, mutualFundTaxEstimator } from './core/SIPCalculator.js';
import { EMICalculator } from './core/EMICalculator.js';
import { FDCalculator, RDCalculator } from './core/FDRDCalculator.js';
import { TaxCalculator } from './core/TaxCalculator.js';
import { FinancialHealthCalculator } from './core/FinancialHealth.js';
import { formatCurrency, formatCurrencyCompact, formatPercentage, formatDuration, toCSV } from './utils/formatters.js';
import { AFFILIATE_LINKS, CTA_DEFINITIONS } from './core/AffiliateConfig.js';

// ── Instances ──
const emiCalc = new EMICalculator();
const fdCalc = new FDCalculator();
const rdCalc = new RDCalculator();
const taxCalc = new TaxCalculator();
const healthCalc = new FinancialHealthCalculator();

// ── State ──
let currentSection = 'dashboard';
let sipMode = 'forward';
let emiMode = 'calculate';
let fdrdMode = 'fd';
let loanStrategy = 'REDUCE_TENURE';
let loanChartInstance = null;
let sipChartInstance = null;
let emiChartInstance = null;
let fdrdChartInstance = null;
let compareChartInstance = null;
let loanScenarios = JSON.parse(localStorage.getItem('v2_loan_scenarios') || '[]');
let sipScenarios = JSON.parse(localStorage.getItem('v2_sip_scenarios') || '[]');
let lastLoanResult = null;
let lastSIPResult = null;

// ── Utility helpers ──
const $ = (id) => document.getElementById(id);
const $val = (id) => {
  const el = $(id);
  if (!el) return 0;
  const v = parseFloat(el.value);
  return isNaN(v) ? 0 : v;
};

function destroyChart(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
  return null;
}

function getChartColors() {
  const isDark = document.documentElement.classList.contains('dark');
  return {
    text: isDark ? '#e2e8f0' : '#1e293b',
    muted: isDark ? '#94a3b8' : '#64748b',
    grid: isDark ? '#334155' : '#e2e8f0',
    primary: '#3b82f6',
    accent: '#059669',
    violet: '#7c3aed',
    amber: '#d97706',
    rose: '#e11d48',
    green: '#059669',
    isDark,
  };
}

function animateValue(el, start, end, duration = 600) {
  if (!el) return;
  const range = end - start;
  if (range === 0) { el.textContent = formatCurrency(end); return; }
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatCurrency(start + range * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  const colors = {
    info: 'bg-blue-600',
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-amber-600',
  };
  toast.className = `fixed bottom-4 right-4 z-50 px-5 py-3 rounded-lg text-white text-sm font-medium shadow-lg ${colors[type] || colors.info} transition-all transform translate-y-0 opacity-100`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function addRecentCalculation(type, summary) {
  const container = $('recent-calculations');
  if (!container) return;
  const existing = container.querySelector('.italic');
  if (existing) existing.remove();
  const item = document.createElement('div');
  item.className = 'flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-surface-900 text-sm';
  const icons = { loan: 'fa-building-columns', sip: 'fa-chart-line', emi: 'fa-calculator', fdrd: 'fa-piggy-bank', tax: 'fa-receipt' };
  item.innerHTML = `<div class="flex items-center gap-2"><i class="fa-solid ${icons[type] || 'fa-calculator'} text-gray-400"></i><span class="text-gray-700 dark:text-gray-300">${summary}</span></div><span class="text-xs text-gray-400">${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>`;
  container.prepend(item);
  // Keep max 5 recent items
  while (container.children.length > 5) container.lastChild.remove();
}

// ── Affiliate CTA Renderer ──
function renderAffiliateCTAs(section, resultData) {
  const container = $(`${section}-affiliate-ctas`);
  if (!container) return;

  const definitions = CTA_DEFINITIONS[section];
  if (!definitions || definitions.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.innerHTML = definitions.map(cta => {
    const link = AFFILIATE_LINKS[cta.linkKey] || '#';
    let description = cta.description;
    if (cta.dynamicText && resultData) {
      const dynamic = cta.dynamicText(resultData);
      if (dynamic) description = dynamic;
    }

    return `
      <div class="affiliate-cta-card bg-gradient-to-r ${cta.gradient} rounded-xl border ${cta.borderColor} p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all duration-200">
        <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-white/80 dark:bg-white/10 flex items-center justify-center">
          <i class="${cta.icon} ${cta.iconColor} text-lg"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">${cta.headline}</p>
          <p class="text-xs text-gray-600 dark:text-gray-400 mt-0.5">${description}</p>
        </div>
        <div class="flex flex-col items-end gap-1 flex-shrink-0">
          <a href="${link}" target="_blank" rel="sponsored noopener noreferrer"
             class="px-4 py-2 rounded-lg ${cta.btnColor} text-white text-xs font-medium transition-colors whitespace-nowrap">
            ${cta.buttonText} <i class="fa-solid fa-arrow-up-right-from-square ml-1 text-[10px]"></i>
          </a>
          <span class="text-[10px] text-gray-400 dark:text-gray-500">Partner link</span>
        </div>
      </div>
    `;
  }).join('');

  container.classList.remove('hidden');
}

// ── DOM Ready ──
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initDarkMode();
  initSidebarToggle();
  initDashboard();
  initLoanSection();
  initSIPSection();
  initEMISection();
  initFDRDSection();
  initTaxSection();
  initCompareSection();

  // Check hash for direct navigation
  const hash = window.location.hash.replace('#', '');
  if (hash) navigateTo(hash);
});

// ══════════════════════════════════════════════════
// 1. NAVIGATION
// ══════════════════════════════════════════════════

function initNavigation() {
  document.querySelectorAll('.nav-item[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.section);
      // Close sidebar only on mobile
      if (window.innerWidth < 1024) {
        const sidebar = $('sidebar');
        const overlay = $('sidebar-overlay');
        if (sidebar) sidebar.classList.add('-translate-x-full');
        if (overlay) overlay.classList.add('hidden');
      }
    });
  });

  // Quick action cards on dashboard
  document.querySelectorAll('[data-navigate]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.navigate));
  });

  // Logo / brand home link
  document.querySelectorAll('[data-action="go-home"]').forEach(el => {
    el.addEventListener('click', (e) => { e.preventDefault(); navigateTo('dashboard'); });
  });
}

function navigateTo(section) {
  currentSection = section;
  // Hide all content sections
  document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
  // Show target
  const target = $(`${section}-section`);
  if (target) target.classList.remove('hidden');
  // Update nav active state
  document.querySelectorAll('.nav-item[data-section]').forEach(link => {
    link.classList.toggle('active', link.dataset.section === section);
    if (link.dataset.section === section) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  window.location.hash = section === 'dashboard' ? '' : section;
}

// ══════════════════════════════════════════════════
// 2. DARK MODE
// ══════════════════════════════════════════════════

function initDarkMode() {
  const saved = localStorage.getItem('v2_dark_mode');
  if (saved === 'true' || (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
  const toggle = $('dark-mode-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('v2_dark_mode', document.documentElement.classList.contains('dark'));
    });
  }
}

// ══════════════════════════════════════════════════
// 3. SIDEBAR TOGGLE
// ══════════════════════════════════════════════════

function initSidebarToggle() {
  const sidebar = $('sidebar');
  const overlay = $('sidebar-overlay');
  const openBtn = $('sidebar-open-btn');
  const closeBtn = $('sidebar-collapse-btn');

  if (!sidebar) return;

  // Start collapsed on mobile
  if (window.innerWidth < 1024) {
    sidebar.classList.add('-translate-x-full');
  }

  if (openBtn) {
    openBtn.addEventListener('click', () => {
      sidebar.classList.remove('-translate-x-full');
      if (overlay) overlay.classList.remove('hidden');
    });
  }

  const closeSidebar = () => {
    sidebar.classList.add('-translate-x-full');
    if (overlay) overlay.classList.add('hidden');
  };

  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);
}

// ══════════════════════════════════════════════════
// 4. DASHBOARD
// ══════════════════════════════════════════════════

function initDashboard() {
  // Set date
  const dateEl = $('dashboard-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  // Static data (no reliable free CORS API for NIFTY; Repo changes infrequently)
  setKPI('nifty', { value: '25,694', change: 'Indicative', up: true, static: true });
  setKPI('repo', { value: '6.50%', change: 'RBI Policy Rate' });

  // Show loading state for live KPIs
  setKPI('gold', { value: '...', change: 'Fetching', up: true });
  setKPI('usd', { value: '...', change: 'Fetching', up: true });

  // Fetch live data
  fetchLiveMarketData();

  // Draw empty health gauge
  drawHealthGauge(0);
}

async function fetchLiveMarketData() {
  // USD/INR from currency-api (CORS-friendly, no key needed)
  try {
    const [todayRes, yesterdayRes] = await Promise.all([
      fetch('https://latest.currency-api.pages.dev/v1/currencies/usd.json'),
      fetch('https://latest.currency-api.pages.dev/v1/currencies/usd.min.json'),
    ]);
    if (todayRes.ok) {
      const today = await todayRes.json();
      const usdInr = today.usd?.inr;
      if (usdInr) {
        // Try to get yesterday's rate for change calculation
        let change = '';
        let up = false;
        try {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          const yStr = d.toISOString().slice(0, 10);
          const yRes = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${yStr}/v1/currencies/usd.json`);
          if (yRes.ok) {
            const yData = await yRes.json();
            const yRate = yData.usd?.inr;
            if (yRate) {
              const diff = ((usdInr - yRate) / yRate * 100).toFixed(2);
              change = (diff >= 0 ? '+' : '') + diff + '%';
              up = diff >= 0;
            }
          }
        } catch { /* ignore, just won't show change */ }
        setKPI('usd', { value: usdInr.toFixed(2), change: change || 'Live', up, live: true });
      }
    }
  } catch {
    setKPI('usd', { value: '86.42', change: 'Offline', up: false, static: true });
  }

  // Gold price from gold-api.com (CORS-friendly, no key needed)
  try {
    const goldRes = await fetch('https://api.gold-api.com/price/XAU');
    if (goldRes.ok) {
      const goldData = await goldRes.json();
      const xauUsd = goldData.price;
      if (xauUsd) {
        // Convert XAU/USD to INR per 10 grams
        // 1 troy ounce = 31.1035 grams
        // Get current USD/INR rate (may already be fetched)
        let usdInr = 86.42; // fallback
        try {
          const rateRes = await fetch('https://latest.currency-api.pages.dev/v1/currencies/usd.json');
          if (rateRes.ok) {
            const rateData = await rateRes.json();
            if (rateData.usd?.inr) usdInr = rateData.usd.inr;
          }
        } catch { /* use fallback */ }
        const xauInr = xauUsd * usdInr;
        const per10g = Math.round(xauInr / 31.1035 * 10);
        const formatted = per10g.toLocaleString('en-IN');
        setKPI('gold', { value: `₹${formatted}/10g`, change: 'Live (24K)', up: true, live: true });
      }
    }
  } catch {
    setKPI('gold', { value: '₹78,450/10g', change: 'Offline', up: true, static: true });
  }
}

function setKPI(key, data) {
  const valEl = $(`kpi-${key}-value`);
  const changeEl = $(`kpi-${key}-change`);
  if (valEl) valEl.textContent = data.value;
  if (changeEl && key !== 'repo') {
    const liveIcon = data.live ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>' : '';
    const staticLabel = data.static ? ' <span class="text-gray-400">(indicative)</span>' : '';
    changeEl.innerHTML = liveIcon + (data.change || '') + staticLabel;
    changeEl.className = `text-xs mt-1 ${data.up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`;
  }
}

function drawHealthGauge(score) {
  const canvas = $('health-score-gauge');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 80, cy = 80, r = 60;
  const isDark = document.documentElement.classList.contains('dark');
  ctx.clearRect(0, 0, 160, 160);

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI);
  ctx.strokeStyle = isDark ? '#334155' : '#e2e8f0';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Score arc
  if (score > 0) {
    const angle = 0.75 * Math.PI + (score / 100) * 1.5 * Math.PI;
    let color = '#ef4444';
    if (score >= 70) color = '#22c55e';
    else if (score >= 50) color = '#f59e0b';
    else if (score >= 30) color = '#f97316';

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0.75 * Math.PI, angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

// ══════════════════════════════════════════════════
// 5. LOAN ANALYZER
// ══════════════════════════════════════════════════

function initLoanSection() {
  // Presets
  document.querySelectorAll('.loan-preset[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => loadLoanPreset(btn.dataset.preset));
  });

  // Strategy toggle
  document.querySelectorAll('.prepay-strategy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.prepay-strategy-btn').forEach(b => {
        b.className = b === btn
          ? 'prepay-strategy-btn px-4 py-2 text-sm font-medium bg-primary-600 text-white'
          : 'prepay-strategy-btn px-4 py-2 text-sm font-medium bg-white dark:bg-surface-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';
      });
      const strategy = btn.dataset.strategy;
      $('loan-prepay-strategy').value = strategy;
      loanStrategy = strategy === 'reduce-emi' ? 'REDUCE_EMI' : 'REDUCE_TENURE';
    });
  });

  // Advanced options accordion
  const advToggle = $('loan-advanced-toggle');
  const advPanel = $('loan-advanced-panel');
  const advChevron = $('loan-advanced-chevron');
  if (advToggle && advPanel) {
    advToggle.addEventListener('click', () => {
      const expanded = !advPanel.classList.contains('hidden');
      advPanel.classList.toggle('hidden');
      if (advChevron) advChevron.classList.toggle('rotate-180', !expanded);
      advToggle.setAttribute('aria-expanded', String(!expanded));
    });
  }

  // Prepayment tabs
  document.querySelectorAll('.prepay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.prepay-tab').forEach(t => {
        const isActive = t === tab;
        t.classList.toggle('border-primary-500', isActive);
        t.classList.toggle('text-primary-600', isActive);
        t.classList.toggle('dark:text-primary-400', isActive);
        t.classList.toggle('border-transparent', !isActive);
        t.classList.toggle('text-gray-500', !isActive);
        t.setAttribute('aria-selected', String(isActive));
      });
      document.querySelectorAll('.prepay-panel').forEach(p => p.classList.add('hidden'));
      const panel = $(`prepay-${tab.dataset.prepayTab}-panel`);
      if (panel) panel.classList.remove('hidden');
    });
  });

  // Add prepayment row buttons
  document.querySelectorAll('.add-prepay-btn').forEach(btn => {
    btn.addEventListener('click', () => addPrepaymentRow(btn.dataset.prepayType));
  });

  // Add rate change
  const addRateBtn = $('add-rate-change');
  if (addRateBtn) addRateBtn.addEventListener('click', addRateChangeRow);

  // Calculate / Clear / Example
  const calcBtn = $('loan-calculate-btn');
  if (calcBtn) calcBtn.addEventListener('click', calculateLoan);

  const clearBtn = $('loan-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearLoanForm);

  const exampleBtn = $('loan-example-btn');
  if (exampleBtn) exampleBtn.addEventListener('click', loadLoanExample);

  // Amortization table accordion
  const tableToggle = $('loan-table-toggle');
  const tableWrapper = $('loan-table-wrapper');
  const tableChevron = $('loan-table-chevron');
  if (tableToggle && tableWrapper) {
    tableToggle.addEventListener('click', () => {
      const expanded = !tableWrapper.classList.contains('hidden');
      tableWrapper.classList.toggle('hidden');
      if (tableChevron) tableChevron.classList.toggle('rotate-180', !expanded);
      tableToggle.setAttribute('aria-expanded', String(!expanded));
    });
  }

  // Table search
  const searchInput = $('loan-table-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const term = searchInput.value.toLowerCase();
      const rows = document.querySelectorAll('#loan-amortization-table tbody tr');
      rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  }

  // Export buttons
  const exportCSV = $('loan-export-csv');
  if (exportCSV) exportCSV.addEventListener('click', exportLoanCSV);

  const exportPDF = $('loan-export-pdf');
  if (exportPDF) exportPDF.addEventListener('click', exportLoanPDF);

  // Save scenario
  const saveBtn = $('loan-save-scenario');
  if (saveBtn) saveBtn.addEventListener('click', saveLoanScenario);

  // Render saved scenarios
  renderLoanScenarios();
}

function loadLoanPreset(type) {
  const presets = {
    home: { amount: 5000000, rate: 8.5, tenure: 20 },
    car: { amount: 800000, rate: 9.5, tenure: 7 },
    personal: { amount: 500000, rate: 14, tenure: 5 },
    education: { amount: 1000000, rate: 8, tenure: 10 },
    custom: { amount: '', rate: '', tenure: '' },
  };
  const p = presets[type];
  if (!p) return;
  $('loan-amount').value = p.amount;
  $('loan-rate').value = p.rate;
  $('loan-tenure').value = p.tenure;
}

function loadLoanExample() {
  $('loan-amount').value = 5000000;
  $('loan-rate').value = 8.5;
  $('loan-tenure').value = 20;
  loanStrategy = 'REDUCE_TENURE';
  // Reset strategy buttons
  document.querySelectorAll('.prepay-strategy-btn').forEach(b => {
    const isTenure = b.dataset.strategy === 'reduce-tenure';
    b.className = isTenure
      ? 'prepay-strategy-btn px-4 py-2 text-sm font-medium bg-primary-600 text-white'
      : 'prepay-strategy-btn px-4 py-2 text-sm font-medium bg-white dark:bg-surface-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';
  });
  // Open advanced panel
  const panel = $('loan-advanced-panel');
  const chevron = $('loan-advanced-chevron');
  if (panel) panel.classList.remove('hidden');
  if (chevron) chevron.classList.add('rotate-180');

  // Ensure monthly tab is active
  document.querySelectorAll('.prepay-tab').forEach(t => {
    const isMonthly = t.dataset.prepayTab === 'monthly';
    t.classList.toggle('border-primary-500', isMonthly);
    t.classList.toggle('text-primary-600', isMonthly);
    t.classList.toggle('border-transparent', !isMonthly);
    t.classList.toggle('text-gray-500', !isMonthly);
    t.setAttribute('aria-selected', String(isMonthly));
  });
  document.querySelectorAll('.prepay-panel').forEach(p => p.classList.add('hidden'));
  const monthlyPanel = $('prepay-monthly-panel');
  if (monthlyPanel) monthlyPanel.classList.remove('hidden');

  // Clear existing prepayment rows and add example
  $('prepay-monthly-list').innerHTML = '';
  addPrepaymentRow('monthly');
  const rows = $('prepay-monthly-list').querySelectorAll('.prepay-row');
  const lastRow = rows[rows.length - 1];
  if (lastRow) {
    const inputs = lastRow.querySelectorAll('input');
    if (inputs[0]) inputs[0].value = 10000; // amount
    if (inputs[1]) inputs[1].value = 1;     // from month
  }

  showToast('Example loaded: 50L home loan @ 8.5% with 10K/month prepayment', 'info');
}

function clearLoanForm() {
  $('loan-amount').value = '';
  $('loan-rate').value = '';
  $('loan-tenure').value = '';
  $('rate-changes-list').innerHTML = '';
  $('prepay-monthly-list').innerHTML = '';
  $('prepay-yearly-list').innerHTML = '';
  $('prepay-onetime-list').innerHTML = '';
  $('loan-results').classList.add('hidden');
  const loanCtas = $('loan-affiliate-ctas');
  if (loanCtas) loanCtas.classList.add('hidden');
  lastLoanResult = null;
  loanChartInstance = destroyChart(loanChartInstance);
}

function addRateChangeRow() {
  const list = $('rate-changes-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'rate-change-row flex items-center gap-2';
  row.innerHTML = `
    <input type="number" placeholder="From month" min="1" class="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500">
    <input type="number" placeholder="New rate %" min="0" max="30" step="0.01" class="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-primary-500">
    <button type="button" class="remove-row-btn p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400" aria-label="Remove row"><i class="fa-solid fa-xmark"></i></button>
  `;
  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function addPrepaymentRow(type) {
  const listId = `prepay-${type}-list`;
  const list = $(listId);
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'prepay-row flex items-center gap-2';

  if (type === 'monthly') {
    row.innerHTML = `
      <input type="number" placeholder="Amount" min="100" class="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-accent-500">
      <input type="number" placeholder="From month" min="1" class="w-24 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-accent-500">
      <input type="number" placeholder="To month (opt)" min="1" class="w-28 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-accent-500">
      <button type="button" class="remove-row-btn p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button>
    `;
  } else if (type === 'yearly') {
    row.innerHTML = `
      <input type="number" placeholder="Amount" min="100" class="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-accent-500">
      <input type="number" placeholder="Month of year (1-12)" min="1" max="12" class="w-40 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-accent-500">
      <button type="button" class="remove-row-btn p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button>
    `;
  } else if (type === 'onetime') {
    row.innerHTML = `
      <input type="number" placeholder="Amount" min="100" class="flex-1 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-accent-500">
      <input type="number" placeholder="At month" min="1" class="w-28 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-900 text-sm text-gray-900 dark:text-white outline-none focus:ring-1 focus:ring-accent-500">
      <button type="button" class="remove-row-btn p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400" aria-label="Remove"><i class="fa-solid fa-xmark"></i></button>
    `;
  }

  row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function calculateLoan() {
  try {
    const principal = $val('loan-amount');
    const rate = $val('loan-rate');
    const tenureYears = $val('loan-tenure');

    if (principal <= 0 || rate < 0 || tenureYears <= 0) {
      showToast('Please fill in all required loan fields', 'error');
      return;
    }

    const config = new LoanConfiguration();
    config.principal = principal;
    config.baseTenureMonths = Math.round(tenureYears * 12);
    config.defaultStrategy = loanStrategy;

    // Base rate
    config.addRatePeriod(1, rate);

    // Additional rate changes
    const rateRows = $('rate-changes-list').querySelectorAll('.rate-change-row');
    rateRows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const fromMonth = parseInt(inputs[0]?.value);
      const newRate = parseFloat(inputs[1]?.value);
      if (fromMonth > 0 && !isNaN(newRate) && newRate >= 0) {
        config.addRatePeriod(fromMonth, newRate);
      }
    });

    // Monthly prepayments
    $('prepay-monthly-list').querySelectorAll('.prepay-row').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const amount = parseFloat(inputs[0]?.value);
      const fromMonth = parseInt(inputs[1]?.value) || 1;
      const toMonth = parseInt(inputs[2]?.value) || null;
      if (amount > 0) {
        config.addMonthlyPrepayment(amount, fromMonth, toMonth);
      }
    });

    // Yearly prepayments
    $('prepay-yearly-list').querySelectorAll('.prepay-row').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const amount = parseFloat(inputs[0]?.value);
      const targetMonth = parseInt(inputs[1]?.value) || 12;
      if (amount > 0) {
        config.addYearlyPrepayment(amount, targetMonth);
      }
    });

    // One-time prepayments
    $('prepay-onetime-list').querySelectorAll('.prepay-row').forEach(row => {
      const inputs = row.querySelectorAll('input');
      const amount = parseFloat(inputs[0]?.value);
      const atMonth = parseInt(inputs[1]?.value);
      if (amount > 0 && atMonth > 0) {
        config.addOneTimePrepayment(amount, atMonth);
      }
    });

    const calc = new AdvancedLoanCalculator(config);
    const result = calc.calculate();
    lastLoanResult = result;
    lastLoanResult._config = { principal, rate, tenureYears, strategy: loanStrategy };

    displayLoanResults(result);
    const hasPrepay = result.totalPrepayment > 0;
    addRecentCalculation('loan',
      hasPrepay
        ? `${formatCurrencyCompact(principal)} @ ${rate}% for ${tenureYears}y - Saved ${formatCurrencyCompact(result.interestSaved)}`
        : `${formatCurrencyCompact(principal)} @ ${rate}% for ${tenureYears}y - EMI ${formatCurrency(result.originalEMI)}`
    );
    showToast('Loan calculation complete', 'success');
  } catch (err) {
    showToast(`Calculation error: ${err.message}`, 'error');
  }
}

function displayLoanResults(result) {
  $('loan-results').classList.remove('hidden');

  const hasPrepayments = result.totalPrepayment > 0;

  // Toggle KPI panels
  const noPrepayKPI = $('loan-kpi-no-prepay');
  const withPrepayKPI = $('loan-kpi-with-prepay');
  const summaryNoPrepay = $('loan-summary-no-prepay');
  const whatIfPanel = $('loan-whatif');
  const comparisonCards = $('loan-comparison-cards');

  if (hasPrepayments) {
    if (noPrepayKPI) noPrepayKPI.classList.add('hidden');
    if (summaryNoPrepay) summaryNoPrepay.classList.add('hidden');
    if (whatIfPanel) whatIfPanel.classList.add('hidden');
    if (withPrepayKPI) withPrepayKPI.classList.remove('hidden');
    if (comparisonCards) { comparisonCards.classList.remove('hidden'); comparisonCards.style.display = ''; }

    // Prepayment KPI cards
    animateValue($('loan-kpi-orig-interest'), 0, result.originalTotalInterest);
    animateValue($('loan-kpi-new-interest'), 0, result.totalInterest);
    animateValue($('loan-kpi-saved'), 0, result.interestSaved);
    const monthsSavedEl = $('loan-kpi-months-saved');
    if (monthsSavedEl) monthsSavedEl.textContent = formatDuration(result.tenureReduced);

    // Original loan details
    const origDetails = $('loan-original-details');
    if (origDetails) {
      origDetails.innerHTML = `
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">EMI</span><span class="font-semibold">${formatCurrency(result.originalEMI)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Tenure</span><span class="font-semibold">${formatDuration(result.originalMonths)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Total Interest</span><span class="font-semibold">${formatCurrency(result.originalTotalInterest)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Total Payment</span><span class="font-semibold">${formatCurrency(result.originalTotalInterest + lastLoanResult._config.principal)}</span></div>
      `;
    }

    // New loan details
    const newDetails = $('loan-new-details');
    if (newDetails) {
      newDetails.innerHTML = `
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Final EMI</span><span class="font-semibold">${formatCurrency(result.finalEMI)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">New Tenure</span><span class="font-semibold">${formatDuration(result.months)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Total Interest</span><span class="font-semibold text-accent-600 dark:text-accent-500">${formatCurrency(result.totalInterest)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Total Prepayment</span><span class="font-semibold">${formatCurrency(result.totalPrepayment)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Total Payment</span><span class="font-semibold">${formatCurrency(result.totalPayment)}</span></div>
      `;
    }
  } else {
    // No prepayments mode
    if (withPrepayKPI) withPrepayKPI.classList.add('hidden');
    if (comparisonCards) { comparisonCards.classList.add('hidden'); comparisonCards.style.display = 'none'; }
    if (noPrepayKPI) noPrepayKPI.classList.remove('hidden');
    if (summaryNoPrepay) summaryNoPrepay.classList.remove('hidden');
    if (whatIfPanel) whatIfPanel.classList.remove('hidden');

    // Plain KPI cards
    animateValue($('loan-kpi-emi'), 0, result.originalEMI);
    animateValue($('loan-kpi-total-interest'), 0, result.totalInterest);
    animateValue($('loan-kpi-total-payment'), 0, result.totalPayment);
    const tenureEl = $('loan-kpi-tenure');
    if (tenureEl) tenureEl.textContent = formatDuration(result.months);

    // Loan summary
    const summaryDetails = $('loan-summary-details');
    if (summaryDetails) {
      const principal = lastLoanResult._config.principal;
      const interestPercent = principal > 0 ? ((result.totalInterest / principal) * 100).toFixed(1) : 0;
      summaryDetails.innerHTML = `
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Loan Amount</span><span class="font-semibold">${formatCurrency(principal)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Monthly EMI</span><span class="font-semibold">${formatCurrency(result.originalEMI)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Tenure</span><span class="font-semibold">${formatDuration(result.months)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Interest Rate</span><span class="font-semibold">${lastLoanResult._config.rate}%</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Total Interest</span><span class="font-semibold text-rose-600 dark:text-rose-400">${formatCurrency(result.totalInterest)}</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Interest as % of Loan</span><span class="font-semibold text-rose-600 dark:text-rose-400">${interestPercent}%</span></div>
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Total Payment</span><span class="font-semibold">${formatCurrency(result.totalPayment)}</span></div>
      `;
    }

    // What-if prepayment scenarios
    generateWhatIfScenarios(result);
  }

  renderLoanChart(result);
  renderAmortizationTable(result.amortizationSchedule);
  renderAffiliateCTAs('loan', result);
}

function generateWhatIfScenarios(baseResult) {
  const container = $('loan-whatif-scenarios');
  if (!container) return;

  const principal = lastLoanResult._config.principal;
  const rate = lastLoanResult._config.rate;
  const tenureYears = lastLoanResult._config.tenureYears;
  const tenureMonths = Math.round(tenureYears * 12);

  // Generate 3 prepayment scenarios: ~2%, ~5%, ~10% of EMI
  const emi = baseResult.originalEMI;
  const scenarios = [
    { label: 'Small', amount: Math.round(emi * 0.05 / 100) * 100 },
    { label: 'Moderate', amount: Math.round(emi * 0.15 / 100) * 100 },
    { label: 'Aggressive', amount: Math.round(emi * 0.3 / 100) * 100 },
  ];

  container.innerHTML = scenarios.map(sc => {
    try {
      const config = new LoanConfiguration();
      config.principal = principal;
      config.baseTenureMonths = tenureMonths;
      config.addRatePeriod(1, rate);
      config.addMonthlyPrepayment(sc.amount);
      const calc = new AdvancedLoanCalculator(config);
      const r = calc.calculate();
      const saved = baseResult.totalInterest - r.totalInterest;
      const monthsSaved = baseResult.months - r.months;

      return `
        <div class="bg-white dark:bg-surface-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center">
          <p class="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium">${sc.label}</p>
          <p class="text-lg font-bold text-primary-600 dark:text-primary-400 mt-1">${formatCurrency(sc.amount)}<span class="text-xs font-normal text-gray-400">/mo</span></p>
          <div class="mt-2 space-y-1 text-xs">
            <p class="text-green-600 dark:text-green-400 font-semibold">Save ${formatCurrencyCompact(saved)}</p>
            <p class="text-gray-500 dark:text-gray-400">${monthsSaved} months earlier</p>
          </div>
        </div>
      `;
    } catch {
      return '';
    }
  }).join('');
}

function renderLoanChart(result) {
  const ctx = $('loanChart');
  if (!ctx) return;
  loanChartInstance = destroyChart(loanChartInstance);
  const colors = getChartColors();

  // Build original schedule (no prepayments) for comparison
  const schedule = result.amortizationSchedule;
  const labels = schedule.map(m => m.month);

  // Simulate original balance line
  const origConfig = new LoanConfiguration();
  origConfig.principal = lastLoanResult._config.principal;
  origConfig.baseTenureMonths = Math.round(lastLoanResult._config.tenureYears * 12);
  origConfig.addRatePeriod(1, lastLoanResult._config.rate);
  let origCalc;
  try {
    origCalc = new AdvancedLoanCalculator(origConfig);
    origCalc.calculate();
  } catch { origCalc = null; }
  const origSchedule = origCalc ? origCalc.amortizationSchedule : [];

  // Align datasets to the longer schedule's month range
  const maxMonth = Math.max(
    schedule.length > 0 ? schedule[schedule.length - 1].month : 0,
    origSchedule.length > 0 ? origSchedule[origSchedule.length - 1].month : 0
  );

  const allLabels = [];
  const origBalances = [];
  const newBalances = [];

  const origMap = new Map(origSchedule.map(m => [m.month, m.balance]));
  const newMap = new Map(schedule.map(m => [m.month, m.balance]));

  for (let m = 1; m <= maxMonth; m++) {
    if (m % Math.max(1, Math.floor(maxMonth / 60)) === 0 || m === 1 || m === maxMonth) {
      allLabels.push(m);
      origBalances.push(origMap.has(m) ? origMap.get(m) : (m > origSchedule.length ? 0 : null));
      newBalances.push(newMap.has(m) ? newMap.get(m) : (m > schedule.length ? 0 : null));
    }
  }

  loanChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        {
          label: 'Original Balance',
          data: origBalances,
          borderColor: colors.muted,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'With Prepayments',
          data: newBalances,
          borderColor: colors.accent,
          fill: true,
          backgroundColor: colors.isDark ? 'rgba(5,150,105,0.1)' : 'rgba(5,150,105,0.08)',
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: colors.text } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrencyCompact(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Month', color: colors.muted },
          ticks: { color: colors.muted },
          grid: { color: colors.grid },
        },
        y: {
          title: { display: true, text: 'Balance', color: colors.muted },
          ticks: { color: colors.muted, callback: v => formatCurrencyCompact(v) },
          grid: { color: colors.grid },
        },
      },
    },
  });
}

function renderAmortizationTable(schedule) {
  const tbody = document.querySelector('#loan-amortization-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  schedule.forEach(row => {
    const tr = document.createElement('tr');
    const hasPrepay = row.prepayment > 0;
    if (hasPrepay) tr.className = 'bg-green-50 dark:bg-green-900/10';
    tr.innerHTML = `
      <td class="px-4 py-2.5 font-medium">${row.month}</td>
      <td class="px-4 py-2.5">${formatCurrency(row.emi)}</td>
      <td class="px-4 py-2.5">${formatCurrency(row.principal)}</td>
      <td class="px-4 py-2.5">${formatCurrency(row.interest)}</td>
      <td class="px-4 py-2.5 ${hasPrepay ? 'text-green-600 dark:text-green-400 font-semibold' : ''}">${hasPrepay ? formatCurrency(row.prepayment) : '-'}</td>
      <td class="px-4 py-2.5 font-semibold">${formatCurrency(row.balance)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function exportLoanCSV() {
  if (!lastLoanResult) { showToast('No loan result to export', 'warning'); return; }
  const headers = ['Month', 'EMI', 'Principal', 'Interest', 'Prepayment', 'Balance', 'Rate'];
  const rows = lastLoanResult.amortizationSchedule.map(r => [
    r.month, r.emi, r.principal, r.interest, r.prepayment, r.balance, r.rate,
  ]);
  downloadCSV('loan_amortization.csv', toCSV(headers, rows));
  showToast('CSV downloaded', 'success');
}

function exportLoanPDF() {
  if (!lastLoanResult) { showToast('No loan result to export', 'warning'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Loan Amortization Report', 14, 20);
    doc.setFontSize(10);

    const cfg = lastLoanResult._config;
    doc.text(`Loan: ${formatCurrency(cfg.principal)} @ ${cfg.rate}% for ${cfg.tenureYears} years`, 14, 30);
    doc.text(`Strategy: ${cfg.strategy}`, 14, 36);
    doc.text(`Interest Saved: ${formatCurrency(lastLoanResult.interestSaved)}`, 14, 42);
    doc.text(`Tenure Reduced: ${formatDuration(lastLoanResult.tenureReduced)}`, 14, 48);
    doc.text(`Original Interest: ${formatCurrency(lastLoanResult.originalTotalInterest)}`, 14, 54);
    doc.text(`New Interest: ${formatCurrency(lastLoanResult.totalInterest)}`, 14, 60);

    let y = 72;
    doc.setFontSize(8);
    doc.text('Month', 14, y);
    doc.text('EMI', 35, y);
    doc.text('Principal', 60, y);
    doc.text('Interest', 90, y);
    doc.text('Prepayment', 120, y);
    doc.text('Balance', 155, y);
    y += 6;

    const schedule = lastLoanResult.amortizationSchedule;
    const maxRows = Math.min(schedule.length, 60);
    for (let i = 0; i < maxRows; i++) {
      const r = schedule[i];
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(String(r.month), 14, y);
      doc.text(String(r.emi), 35, y);
      doc.text(String(r.principal), 60, y);
      doc.text(String(r.interest), 90, y);
      doc.text(String(r.prepayment || 0), 120, y);
      doc.text(String(r.balance), 155, y);
      y += 5;
    }
    if (schedule.length > maxRows) {
      doc.text(`... and ${schedule.length - maxRows} more rows`, 14, y + 5);
    }

    doc.save('loan_report.pdf');
    showToast('PDF downloaded', 'success');
  } catch (err) {
    showToast('PDF export failed: ' + err.message, 'error');
  }
}

function saveLoanScenario() {
  if (!lastLoanResult) { showToast('Calculate a loan first', 'warning'); return; }
  const cfg = lastLoanResult._config;
  const scenario = {
    id: Date.now(),
    name: `${formatCurrencyCompact(cfg.principal)} @ ${cfg.rate}% / ${cfg.tenureYears}y`,
    config: cfg,
    interestSaved: lastLoanResult.interestSaved,
    tenureReduced: lastLoanResult.tenureReduced,
    totalInterest: lastLoanResult.totalInterest,
    originalInterest: lastLoanResult.originalTotalInterest,
    months: lastLoanResult.months,
    originalMonths: lastLoanResult.originalMonths,
  };
  loanScenarios.push(scenario);
  localStorage.setItem('v2_loan_scenarios', JSON.stringify(loanScenarios));
  renderLoanScenarios();
  showToast('Loan scenario saved', 'success');
}

function renderLoanScenarios() {
  const container = $('loan-saved-scenarios');
  if (!container) return;
  if (loanScenarios.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400 dark:text-gray-500 italic">No saved loan scenarios</p>';
    return;
  }
  container.innerHTML = loanScenarios.map((s, i) => `
    <div class="flex items-center justify-between px-4 py-3 rounded-lg bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 text-sm">
      <div>
        <span class="font-medium text-gray-900 dark:text-white">${s.name}</span>
        <span class="text-gray-400 mx-2">|</span>
        <span class="text-green-600 dark:text-green-400">Saved ${formatCurrencyCompact(s.interestSaved)}</span>
        <span class="text-gray-400 mx-1">&middot;</span>
        <span class="text-green-600 dark:text-green-400">${formatDuration(s.tenureReduced)} shorter</span>
      </div>
      <button class="delete-loan-scenario text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1" data-index="${i}" aria-label="Delete scenario"><i class="fa-solid fa-trash-can text-xs"></i></button>
    </div>
  `).join('');

  container.querySelectorAll('.delete-loan-scenario').forEach(btn => {
    btn.addEventListener('click', () => {
      loanScenarios.splice(parseInt(btn.dataset.index), 1);
      localStorage.setItem('v2_loan_scenarios', JSON.stringify(loanScenarios));
      renderLoanScenarios();
      showToast('Scenario deleted', 'info');
    });
  });
}

// ══════════════════════════════════════════════════
// 6. SIP PLANNER
// ══════════════════════════════════════════════════

function initSIPSection() {
  // Mode toggle
  document.querySelectorAll('.sip-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      sipMode = btn.dataset.sipMode;
      document.querySelectorAll('.sip-mode-btn').forEach(b => {
        const isActive = b === btn;
        b.className = isActive
          ? 'sip-mode-btn px-4 py-2 rounded-lg text-sm font-medium bg-accent-600 text-white'
          : 'sip-mode-btn px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';
        b.setAttribute('aria-selected', String(isActive));
      });
      document.querySelectorAll('.sip-mode-panel').forEach(p => p.classList.add('hidden'));
      const panel = $(`sip-${sipMode}-inputs`);
      if (panel) panel.classList.remove('hidden');
    });
  });

  // Return presets
  document.querySelectorAll('.sip-return-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      $('sip-return').value = btn.dataset.return;
    });
  });

  // Buttons
  const calcBtn = $('sip-calculate-btn');
  if (calcBtn) calcBtn.addEventListener('click', calculateSIP);

  const clearBtn = $('sip-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', clearSIPForm);

  const exampleBtn = $('sip-example-btn');
  if (exampleBtn) exampleBtn.addEventListener('click', loadSIPExample);

  // Export
  const exportCSV = $('sip-export-csv');
  if (exportCSV) exportCSV.addEventListener('click', exportSIPCSV);

  const exportPDF = $('sip-export-pdf');
  if (exportPDF) exportPDF.addEventListener('click', exportSIPPDF);

  // Save scenario
  const saveBtn = $('sip-save-scenario');
  if (saveBtn) saveBtn.addEventListener('click', saveSIPScenario);

  renderSIPScenarios();
}

function loadSIPExample() {
  sipMode = 'forward';
  document.querySelectorAll('.sip-mode-btn').forEach(b => {
    const isForward = b.dataset.sipMode === 'forward';
    b.className = isForward
      ? 'sip-mode-btn px-4 py-2 rounded-lg text-sm font-medium bg-accent-600 text-white'
      : 'sip-mode-btn px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';
    b.setAttribute('aria-selected', String(isForward));
  });
  document.querySelectorAll('.sip-mode-panel').forEach(p => p.classList.add('hidden'));
  $('sip-forward-inputs').classList.remove('hidden');

  $('sip-amount').value = 15000;
  $('sip-return').value = 12;
  $('sip-duration').value = 20;
  $('sip-stepup').value = 10;
  $('sip-inflation').value = 6;
  showToast('Example loaded: 15K SIP @ 12% for 20y with 10% step-up', 'info');
}

function clearSIPForm() {
  ['sip-amount', 'sip-return', 'sip-duration', 'sip-stepup', 'sip-inflation',
   'sip-target-amount', 'sip-goal-horizon', 'sip-goal-return', 'sip-goal-stepup', 'sip-goal-inflation',
   'sip-current-age', 'sip-retirement-age', 'sip-monthly-expenses', 'sip-retire-inflation',
   'sip-pre-retire-return', 'sip-post-retire-return'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });
  $('sip-results').classList.add('hidden');
  const sipCtas = $('sip-affiliate-ctas');
  if (sipCtas) sipCtas.classList.add('hidden');
  lastSIPResult = null;
  sipChartInstance = destroyChart(sipChartInstance);
}

function calculateSIP() {
  try {
    if (sipMode === 'forward') {
      calculateForwardSIP();
    } else if (sipMode === 'goal') {
      calculateGoalSIP();
    } else if (sipMode === 'retirement') {
      calculateRetirementSIP();
    }
  } catch (err) {
    showToast(`Calculation error: ${err.message}`, 'error');
  }
}

function calculateForwardSIP() {
  const amount = $val('sip-amount');
  const returnRate = $val('sip-return');
  const years = $val('sip-duration');
  const stepUp = $val('sip-stepup');
  const inflation = $val('sip-inflation');

  if (amount <= 0 || years <= 0) {
    showToast('Please fill in required SIP fields', 'error');
    return;
  }

  const scenario = { getReturnForYear: () => returnRate };
  const config = {
    monthlyAmount: amount,
    durationYears: years,
    inflationRate: inflation,
    stepUpSchedules: stepUp > 0 ? [{ startYear: 1, endYear: null, stepUpPercent: stepUp }] : [],
    returnScenarios: { realistic: scenario },
  };

  const calc = new AdvancedSIPCalculator(config);
  const result = calc.calculate('realistic');
  lastSIPResult = { ...result, _mode: 'forward', _config: { amount, returnRate, years, stepUp, inflation } };

  displaySIPResults(result);
  addRecentCalculation('sip', `${formatCurrencyCompact(amount)}/mo @ ${returnRate}% for ${years}y = ${formatCurrencyCompact(result.finalValue)}`);
  showToast('SIP calculation complete', 'success');
}

function calculateGoalSIP() {
  const target = $val('sip-target-amount');
  const years = $val('sip-goal-horizon');
  const returnRate = $val('sip-goal-return');
  const stepUp = $val('sip-goal-stepup');
  const inflation = $val('sip-goal-inflation');

  if (target <= 0 || years <= 0) {
    showToast('Please fill in target amount and time horizon', 'error');
    return;
  }

  const result = goalSeeker.calculateRequiredSIP(target, years, returnRate, inflation, stepUp);
  lastSIPResult = { ...result, _mode: 'goal', _config: { target, years, returnRate, stepUp, inflation } };

  // Display goal results
  $('sip-results').classList.remove('hidden');
  const investedEl = $('sip-kpi-invested');
  if (investedEl) investedEl.textContent = formatCurrency(result.totalInvestment);
  const finalEl = $('sip-kpi-final');
  if (finalEl) finalEl.textContent = formatCurrency(result.achievedAmount);
  const gainEl = $('sip-kpi-gain');
  if (gainEl) gainEl.textContent = formatCurrency(result.wealthGain);
  const realEl = $('sip-kpi-real');
  if (realEl) realEl.textContent = `${formatCurrency(result.requiredSIP)}/mo`;

  // Build simple schedule for chart
  const schedule = [];
  let bal = 0;
  let sip = result.requiredSIP;
  const mr = returnRate / 100 / 12;
  let cumInvested = 0;
  for (let y = 1; y <= years; y++) {
    for (let m = 1; m <= 12; m++) {
      cumInvested += sip;
      bal = (bal + sip) * (1 + mr);
    }
    schedule.push({ year: y, balance: bal, totalInvested: cumInvested, sipAmount: sip });
    if (stepUp > 0 && y < years) sip *= (1 + stepUp / 100);
  }

  renderSIPChart(schedule);
  renderSIPTable(schedule);
  renderAffiliateCTAs('sip', lastSIPResult);
  addRecentCalculation('sip', `Goal: ${formatCurrencyCompact(target)} in ${years}y = ${formatCurrency(result.requiredSIP)}/mo`);
  showToast('Goal SIP calculated', 'success');
}

function calculateRetirementSIP() {
  const currentAge = $val('sip-current-age');
  const retirementAge = $val('sip-retirement-age');
  const monthlyExpenses = $val('sip-monthly-expenses');
  const inflation = $val('sip-retire-inflation');
  const preReturn = $val('sip-pre-retire-return');
  const postReturn = $val('sip-post-retire-return');

  if (currentAge <= 0 || retirementAge <= currentAge || monthlyExpenses <= 0) {
    showToast('Please fill in all retirement planning fields', 'error');
    return;
  }

  const yearsToRetire = retirementAge - currentAge;
  const lifeExpectancy = 85;
  const retirementYears = lifeExpectancy - retirementAge;

  // Calculate corpus needed at retirement
  const inflatedExpenses = monthlyExpenses * Math.pow(1 + inflation / 100, yearsToRetire);
  const annualExpenses = inflatedExpenses * 12;

  // Using 4% rule adjusted
  const requiredCorpus = annualExpenses / ((postReturn - inflation) / 100 || 0.04);

  // Calculate required SIP
  const result = goalSeeker.calculateRequiredSIP(requiredCorpus, yearsToRetire, preReturn, 0, 0);
  lastSIPResult = { ...result, _mode: 'retirement', _config: { currentAge, retirementAge, monthlyExpenses, inflation, preReturn, postReturn } };

  $('sip-results').classList.remove('hidden');
  const investedEl = $('sip-kpi-invested');
  if (investedEl) investedEl.textContent = formatCurrency(result.totalInvestment);
  const finalEl = $('sip-kpi-final');
  if (finalEl) finalEl.textContent = formatCurrency(requiredCorpus);
  const gainEl = $('sip-kpi-gain');
  if (gainEl) gainEl.textContent = formatCurrency(result.wealthGain);
  const realEl = $('sip-kpi-real');
  if (realEl) realEl.textContent = `${formatCurrency(result.requiredSIP)}/mo`;

  // Build schedule
  const schedule = [];
  let bal = 0;
  const sip = result.requiredSIP;
  const mr = preReturn / 100 / 12;
  let cumInvested = 0;
  for (let y = 1; y <= yearsToRetire; y++) {
    for (let m = 1; m <= 12; m++) {
      cumInvested += sip;
      bal = (bal + sip) * (1 + mr);
    }
    schedule.push({ year: y, balance: bal, totalInvested: cumInvested, sipAmount: sip });
  }

  renderSIPChart(schedule);
  renderSIPTable(schedule);
  renderAffiliateCTAs('sip', lastSIPResult);

  // Update tax info with retirement-specific info
  const taxInfo = $('sip-tax-info');
  if (taxInfo) {
    taxInfo.innerHTML = `
      <p><strong>Retirement Plan Summary:</strong></p>
      <p class="mt-1">Monthly expenses at retirement (age ${retirementAge}): ${formatCurrency(inflatedExpenses)}</p>
      <p>Required corpus: ${formatCurrency(requiredCorpus)}</p>
      <p>Required monthly SIP: ${formatCurrency(result.requiredSIP)}</p>
      <p class="mt-1 text-xs">Assumptions: Life expectancy ${lifeExpectancy} years, ${inflation}% inflation, ${postReturn}% post-retirement returns</p>
    `;
  }

  addRecentCalculation('sip', `Retirement: Age ${currentAge}-${retirementAge}, need ${formatCurrency(result.requiredSIP)}/mo`);
  showToast('Retirement plan calculated', 'success');
}

function displaySIPResults(result) {
  $('sip-results').classList.remove('hidden');

  animateValue($('sip-kpi-invested'), 0, result.totalInvested);
  animateValue($('sip-kpi-final'), 0, result.finalValue);
  animateValue($('sip-kpi-gain'), 0, result.wealthGain);
  animateValue($('sip-kpi-real'), 0, result.realValue);

  // Build year-by-year data from schedule
  const yearData = [];
  let prevInvested = 0;
  for (const entry of result.schedule) {
    if (entry.month % 12 === 0 || entry.month === result.schedule[result.schedule.length - 1].month) {
      yearData.push({
        year: entry.year,
        sipAmount: entry.sipAmount,
        balance: entry.balance,
        totalInvested: entry.totalInvested,
        inflationAdjusted: entry.inflationAdjusted,
      });
    }
  }

  renderSIPChart(yearData);
  renderSIPTable(yearData);

  // Tax estimate
  if (result.wealthGain > 0) {
    const taxEst = mutualFundTaxEstimator.estimate({
      investedAmount: result.totalInvested,
      currentValue: result.finalValue,
      holdingYears: lastSIPResult._config.years,
      fundType: 'equity',
    });
    const taxInfo = $('sip-tax-info');
    if (taxInfo) {
      taxInfo.innerHTML = `
        <p>Estimated LTCG on equity: ${formatCurrency(taxEst.taxableGain)} taxable at 12.5%</p>
        <p class="mt-1">Estimated tax: ${formatCurrency(taxEst.tax)} | Post-tax value: ${formatCurrency(taxEst.postTaxValue)}</p>
        <p class="mt-1 text-xs">ELSS investments qualify for Section 80C deduction up to &#8377;1.5 lakh.</p>
      `;
    }
  }
  renderAffiliateCTAs('sip', lastSIPResult);
}

function renderSIPChart(yearData) {
  const ctx = $('sipChart');
  if (!ctx) return;
  sipChartInstance = destroyChart(sipChartInstance);
  const colors = getChartColors();

  sipChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: yearData.map(d => `Year ${d.year}`),
      datasets: [
        {
          label: 'Invested',
          data: yearData.map(d => d.totalInvested),
          backgroundColor: colors.isDark ? 'rgba(59,130,246,0.6)' : 'rgba(59,130,246,0.5)',
          borderRadius: 4,
        },
        {
          label: 'Portfolio Value',
          data: yearData.map(d => d.balance),
          backgroundColor: colors.isDark ? 'rgba(5,150,105,0.6)' : 'rgba(5,150,105,0.5)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: colors.text } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrencyCompact(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: colors.muted }, grid: { color: colors.grid } },
        y: {
          ticks: { color: colors.muted, callback: v => formatCurrencyCompact(v) },
          grid: { color: colors.grid },
        },
      },
    },
  });
}

function renderSIPTable(yearData) {
  const tbody = document.querySelector('#sip-breakdown-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  yearData.forEach(d => {
    const tr = document.createElement('tr');
    const yearlyInvestment = d.sipAmount * 12;
    const realVal = d.inflationAdjusted || d.balance;
    tr.innerHTML = `
      <td class="px-4 py-2.5 font-medium">${d.year}</td>
      <td class="px-4 py-2.5">${formatCurrency(d.sipAmount)}</td>
      <td class="px-4 py-2.5">${formatCurrency(yearlyInvestment)}</td>
      <td class="px-4 py-2.5">${formatCurrency(d.totalInvested)}</td>
      <td class="px-4 py-2.5 font-semibold text-accent-600 dark:text-accent-500">${formatCurrency(d.balance)}</td>
      <td class="px-4 py-2.5 text-amber-600 dark:text-amber-400">${formatCurrency(realVal)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function exportSIPCSV() {
  if (!lastSIPResult) { showToast('No SIP result to export', 'warning'); return; }
  const headers = ['Year', 'Monthly SIP', 'Cumulative Invested', 'Portfolio Value'];
  const schedule = lastSIPResult.schedule || [];
  const rows = schedule.filter(s => s.month % 12 === 0 || s.month === schedule[schedule.length - 1]?.month).map(s => [
    s.year, s.sipAmount, s.totalInvested, s.balance,
  ]);
  downloadCSV('sip_plan.csv', toCSV(headers, rows));
  showToast('CSV downloaded', 'success');
}

function exportSIPPDF() {
  if (!lastSIPResult) { showToast('No SIP result to export', 'warning'); return; }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('SIP Investment Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Final Value: ${formatCurrency(lastSIPResult.finalValue || lastSIPResult.achievedAmount || 0)}`, 14, 30);
    doc.text(`Total Invested: ${formatCurrency(lastSIPResult.totalInvested || lastSIPResult.totalInvestment || 0)}`, 14, 36);
    doc.text(`Wealth Gain: ${formatCurrency(lastSIPResult.wealthGain)}`, 14, 42);
    doc.save('sip_report.pdf');
    showToast('PDF downloaded', 'success');
  } catch (err) {
    showToast('PDF export failed: ' + err.message, 'error');
  }
}

function saveSIPScenario() {
  if (!lastSIPResult) { showToast('Calculate a SIP first', 'warning'); return; }
  const cfg = lastSIPResult._config;
  const scenario = {
    id: Date.now(),
    name: sipMode === 'forward'
      ? `${formatCurrencyCompact(cfg.amount)}/mo @ ${cfg.returnRate}% / ${cfg.years}y`
      : sipMode === 'goal'
        ? `Goal: ${formatCurrencyCompact(cfg.target)} in ${cfg.years}y`
        : `Retirement: Age ${cfg.currentAge}-${cfg.retirementAge}`,
    mode: sipMode,
    config: cfg,
    finalValue: lastSIPResult.finalValue || lastSIPResult.achievedAmount || 0,
    totalInvested: lastSIPResult.totalInvested || lastSIPResult.totalInvestment || 0,
    wealthGain: lastSIPResult.wealthGain,
  };
  sipScenarios.push(scenario);
  localStorage.setItem('v2_sip_scenarios', JSON.stringify(sipScenarios));
  renderSIPScenarios();
  showToast('SIP scenario saved', 'success');
}

function renderSIPScenarios() {
  const container = $('sip-saved-scenarios');
  if (!container) return;
  if (sipScenarios.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400 dark:text-gray-500 italic">No saved SIP scenarios</p>';
    return;
  }
  container.innerHTML = sipScenarios.map((s, i) => `
    <div class="flex items-center justify-between px-4 py-3 rounded-lg bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 text-sm">
      <div>
        <span class="font-medium text-gray-900 dark:text-white">${s.name}</span>
        <span class="text-gray-400 mx-2">|</span>
        <span class="text-accent-600 dark:text-accent-500">Value: ${formatCurrencyCompact(s.finalValue)}</span>
        <span class="text-gray-400 mx-1">&middot;</span>
        <span class="text-green-600 dark:text-green-400">Gain: ${formatCurrencyCompact(s.wealthGain)}</span>
      </div>
      <button class="delete-sip-scenario text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1" data-index="${i}" aria-label="Delete scenario"><i class="fa-solid fa-trash-can text-xs"></i></button>
    </div>
  `).join('');

  container.querySelectorAll('.delete-sip-scenario').forEach(btn => {
    btn.addEventListener('click', () => {
      sipScenarios.splice(parseInt(btn.dataset.index), 1);
      localStorage.setItem('v2_sip_scenarios', JSON.stringify(sipScenarios));
      renderSIPScenarios();
      showToast('Scenario deleted', 'info');
    });
  });
}

// ══════════════════════════════════════════════════
// 7. EMI CALCULATOR
// ══════════════════════════════════════════════════

function initEMISection() {
  // Mode toggle
  document.querySelectorAll('.emi-mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      emiMode = btn.dataset.emiMode;
      document.querySelectorAll('.emi-mode-btn').forEach(b => {
        const isActive = b === btn;
        b.className = isActive
          ? 'emi-mode-btn px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white'
          : 'emi-mode-btn px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';
        b.setAttribute('aria-selected', String(isActive));
      });
      document.querySelectorAll('.emi-mode-panel').forEach(p => p.classList.add('hidden'));
      $(`emi-${emiMode}-inputs`).classList.remove('hidden');
      // Toggle result panels
      document.querySelectorAll('.emi-result-panel').forEach(p => p.classList.add('hidden'));
      $(`emi-result-${emiMode}`).classList.remove('hidden');
    });
  });

  // Auto-calculate on input change
  document.querySelectorAll('[data-auto-calc="true"]').forEach(input => {
    input.addEventListener('input', debounce(calculateEMI, 300));
  });
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function calculateEMI() {
  try {
    if (emiMode === 'calculate') {
      const principal = $val('emi-loan-amount');
      const rate = $val('emi-interest-rate');
      const tenureYears = $val('emi-tenure');

      if (principal <= 0 || rate < 0 || tenureYears <= 0) return;

      const tenureMonths = Math.round(tenureYears * 12);
      const result = emiCalc.calculateEMI(principal, rate, tenureMonths);

      $('emi-result-value').textContent = formatCurrency(result.emi);
      $('emi-total-interest').textContent = formatCurrency(result.totalInterest);
      $('emi-total-payment').textContent = formatCurrency(result.totalPayment);

      renderEMIPieChart(principal, result.totalInterest);
      renderEMISummaryTable(principal, rate, tenureMonths);
      renderAffiliateCTAs('emi', null);
      addRecentCalculation('emi', `EMI: ${formatCurrency(result.emi)} for ${formatCurrencyCompact(principal)} @ ${rate}%`);
    } else {
      const income = $val('emi-monthly-income');
      const existing = $val('emi-existing-emis');
      const maxPercent = $val('emi-max-percent') || 40;
      const rate = $val('emi-afford-rate');
      const tenureYears = $val('emi-afford-tenure');

      if (income <= 0 || rate < 0 || tenureYears <= 0) return;

      const tenureMonths = Math.round(tenureYears * 12);
      const result = emiCalc.calculateAffordability(income, existing, maxPercent, rate, tenureMonths);

      $('emi-max-loan').textContent = formatCurrency(result.maxLoanAmount);
      $('emi-recommended').textContent = formatCurrency(result.maxNewEMI);
      $('emi-available').textContent = formatCurrency(income * (maxPercent / 100) - existing);

      renderEMIPieChart(result.maxLoanAmount, result.maxLoanAmount > 0 ? emiCalc.calculateEMI(result.maxLoanAmount, rate, tenureMonths).totalInterest : 0);
      if (result.maxLoanAmount > 0) renderEMISummaryTable(result.maxLoanAmount, rate, tenureMonths);
      renderAffiliateCTAs('emi', null);
      addRecentCalculation('emi', `Affordability: Max loan ${formatCurrencyCompact(result.maxLoanAmount)}`);
    }
  } catch (err) {
    // Silent fail for auto-calc — inputs may be partial
  }
}

function renderEMIPieChart(principal, interest) {
  const ctx = $('emiPieChart');
  if (!ctx) return;
  emiChartInstance = destroyChart(emiChartInstance);
  const colors = getChartColors();

  emiChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Principal', 'Interest'],
      datasets: [{
        data: [principal, interest],
        backgroundColor: [colors.isDark ? 'rgba(59,130,246,0.7)' : 'rgba(59,130,246,0.6)', colors.isDark ? 'rgba(239,68,68,0.7)' : 'rgba(239,68,68,0.6)'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: colors.text, padding: 16 } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

function renderEMISummaryTable(principal, rate, tenureMonths) {
  const tbody = document.querySelector('#emi-summary-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  try {
    const breakdown = emiCalc.getEMIBreakdown(principal, rate, tenureMonths);
    // Group by year
    const yearMap = new Map();
    breakdown.forEach(m => {
      const year = Math.ceil(m.month / 12);
      if (!yearMap.has(year)) yearMap.set(year, { principal: 0, interest: 0, balance: 0 });
      const d = yearMap.get(year);
      d.principal += m.principal;
      d.interest += m.interest;
      d.balance = m.balance;
    });

    yearMap.forEach((data, year) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="px-3 py-2 font-medium">${year}</td>
        <td class="px-3 py-2">${formatCurrencyCompact(data.principal)}</td>
        <td class="px-3 py-2">${formatCurrencyCompact(data.interest)}</td>
        <td class="px-3 py-2 font-semibold">${formatCurrencyCompact(data.balance)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch {
    // pass
  }
}

// ══════════════════════════════════════════════════
// 8. FD/RD CALCULATOR
// ══════════════════════════════════════════════════

function initFDRDSection() {
  // Tab toggle
  document.querySelectorAll('.fdrd-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      fdrdMode = tab.dataset.fdrdTab;
      document.querySelectorAll('.fdrd-tab').forEach(t => {
        const isActive = t === tab;
        t.classList.toggle('border-primary-500', isActive);
        t.classList.toggle('text-primary-600', isActive);
        t.classList.toggle('dark:text-primary-400', isActive);
        t.classList.toggle('border-transparent', !isActive);
        t.classList.toggle('text-gray-500', !isActive);
        t.setAttribute('aria-selected', String(isActive));
      });
      document.querySelectorAll('.fdrd-tab-panel').forEach(p => p.classList.add('hidden'));
      const panel = $(`fdrd-${fdrdMode}-inputs`);
      if (panel) panel.classList.remove('hidden');
    });
  });

  const calcBtn = $('fdrd-calculate-btn');
  if (calcBtn) calcBtn.addEventListener('click', calculateFDRD);

  const clearBtn = $('fdrd-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    ['fd-principal', 'fd-rate', 'fd-tenure', 'rd-monthly-deposit', 'rd-rate', 'rd-tenure'].forEach(id => {
      const el = $(id);
      if (el) el.value = '';
    });
    $('fdrd-results').classList.add('hidden');
    const fdrdCtas = $('fdrd-affiliate-ctas');
    if (fdrdCtas) fdrdCtas.classList.add('hidden');
    fdrdChartInstance = destroyChart(fdrdChartInstance);
  });
}

function calculateFDRD() {
  try {
    if (fdrdMode === 'fd') {
      const principal = $val('fd-principal');
      const rate = $val('fd-rate');
      const tenureMonths = $val('fd-tenure');
      const compounding = $('fd-compounding')?.value || 'quarterly';
      const isSenior = $('fd-senior-citizen')?.checked || false;

      if (principal <= 0 || rate <= 0 || tenureMonths <= 0) {
        showToast('Please fill in all FD fields', 'error');
        return;
      }

      const tenureYears = tenureMonths / 12;
      const result = fdCalc.calculate(principal, rate, tenureYears, compounding);
      const tds = fdCalc.calculateTDS(result.interestEarned, true, isSenior);

      displayFDRDResults(result, tds, 'FD', principal, tenureMonths);
      addRecentCalculation('fdrd', `FD: ${formatCurrencyCompact(principal)} @ ${rate}% = ${formatCurrencyCompact(result.maturityAmount)}`);
    } else {
      const monthly = $val('rd-monthly-deposit');
      const rate = $val('rd-rate');
      const tenureMonths = $val('rd-tenure');

      if (monthly <= 0 || rate <= 0 || tenureMonths <= 0) {
        showToast('Please fill in all RD fields', 'error');
        return;
      }

      const result = rdCalc.calculate(monthly, rate, Math.round(tenureMonths));
      const tds = fdCalc.calculateTDS(result.interestEarned, true, false);

      displayFDRDResults(result, tds, 'RD', monthly * tenureMonths, tenureMonths);
      addRecentCalculation('fdrd', `RD: ${formatCurrencyCompact(monthly)}/mo @ ${rate}% = ${formatCurrencyCompact(result.maturityAmount)}`);
    }
    showToast('Calculation complete', 'success');
  } catch (err) {
    showToast(`Calculation error: ${err.message}`, 'error');
  }
}

function displayFDRDResults(result, tds, type, depositAmount, tenureMonths) {
  $('fdrd-results').classList.remove('hidden');
  $('fdrd-maturity').textContent = formatCurrency(result.maturityAmount);
  $('fdrd-interest-earned').textContent = formatCurrency(result.interestEarned);

  const effectiveEl = $('fdrd-effective-rate');
  if (effectiveEl) {
    effectiveEl.textContent = result.effectiveRate
      ? formatPercentage(result.effectiveRate)
      : '--';
  }

  const tdsEl = $('fdrd-tds');
  if (tdsEl) {
    if (tds.tdsAmount > 0) {
      tdsEl.textContent = `${formatCurrency(tds.tdsAmount)} (${tds.tdsRate}%)`;
    } else {
      tdsEl.textContent = 'Nil (below threshold)';
      tdsEl.classList.remove('text-red-600', 'dark:text-red-400');
      tdsEl.classList.add('text-green-600', 'dark:text-green-400');
    }
  }

  renderFDRDChart(depositAmount, result.interestEarned, type);
  renderAffiliateCTAs('fdrd', result);
}

function renderFDRDChart(deposit, interest, type) {
  const ctx = $('fdrdChart');
  if (!ctx) return;
  fdrdChartInstance = destroyChart(fdrdChartInstance);
  const colors = getChartColors();

  fdrdChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [type === 'FD' ? 'Principal' : 'Total Deposited', 'Interest Earned'],
      datasets: [{
        data: [deposit, interest],
        backgroundColor: [
          colors.isDark ? 'rgba(59,130,246,0.7)' : 'rgba(59,130,246,0.6)',
          colors.isDark ? 'rgba(5,150,105,0.7)' : 'rgba(5,150,105,0.6)',
        ],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: colors.text, padding: 16 } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.parsed)}`,
          },
        },
      },
    },
  });
}

// ══════════════════════════════════════════════════
// 9. TAX PLANNER
// ══════════════════════════════════════════════════

function initTaxSection() {
  // Deduction accordion toggles
  document.querySelectorAll('.tax-deduction-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const panel = toggle.nextElementSibling;
      if (panel && panel.classList.contains('tax-deduction-panel')) {
        panel.classList.toggle('hidden');
        const chevron = toggle.querySelector('.fa-chevron-down');
        if (chevron) chevron.classList.toggle('rotate-180');
        toggle.setAttribute('aria-expanded', String(!panel.classList.contains('hidden')));
      }
    });
  });

  // 80C total calculator
  document.querySelectorAll('[data-tax-deduction="80c"]').forEach(input => {
    input.addEventListener('input', () => {
      const total = ['tax-80c-epf', 'tax-80c-ppf', 'tax-80c-elss', 'tax-80c-insurance', 'tax-80c-tuition', 'tax-80c-principal']
        .reduce((sum, id) => sum + $val(id), 0);
      const totalEl = $('tax-80c-total');
      if (totalEl) totalEl.textContent = formatCurrency(Math.min(total, 150000));
    });
  });

  const calcBtn = $('tax-calculate-btn');
  if (calcBtn) calcBtn.addEventListener('click', calculateTax);

  const clearBtn = $('tax-clear-btn');
  if (clearBtn) clearBtn.addEventListener('click', () => {
    document.querySelectorAll('#tax-section input[type="number"]').forEach(i => i.value = '');
    document.querySelectorAll('#tax-section input[type="checkbox"]').forEach(i => i.checked = false);
    $('tax-results').classList.add('hidden');
    $('tax-recommendation').classList.add('hidden');
    const taxCtas = $('tax-affiliate-ctas');
    if (taxCtas) taxCtas.classList.add('hidden');
    const totalEl = $('tax-80c-total');
    if (totalEl) totalEl.textContent = '\u20B90';
  });
}

function calculateTax() {
  try {
    const grossIncome = $val('tax-gross-income');
    if (grossIncome <= 0) {
      showToast('Please enter your gross income', 'error');
      return;
    }

    // Gather 80C
    const sec80C = Math.min(
      $val('tax-80c-epf') + $val('tax-80c-ppf') + $val('tax-80c-elss') +
      $val('tax-80c-insurance') + $val('tax-80c-tuition') + $val('tax-80c-principal'),
      150000
    );

    // 80D
    const sec80D = $val('tax-80d-self') + $val('tax-80d-parents');

    // 80CCD
    const sec80CCD = $val('tax-80ccd-nps');

    // HRA
    let hraExemption = 0;
    const hraBasic = $val('tax-hra-basic');
    const hraReceived = $val('tax-hra-received');
    const hraRent = $val('tax-hra-rent');
    const isMetro = $('tax-hra-metro')?.checked || false;
    if (hraBasic > 0 && hraReceived > 0 && hraRent > 0) {
      const hraResult = taxCalc.calculateHRA(hraBasic, hraReceived, hraRent, isMetro);
      hraExemption = hraResult.exemption;
    }

    // Section 24
    const sec24 = $val('tax-sec24-interest');

    const deductions = {
      sec80C: sec80C,
      sec80D: sec80D,
      sec80CCD: sec80CCD,
      hra: hraExemption,
      otherExemptions: sec24,
    };

    const result = taxCalc.compare(grossIncome, deductions);
    displayTaxResults(result);
    addRecentCalculation('tax', `Tax: Old ${formatCurrencyCompact(result.oldTax)} vs New ${formatCurrencyCompact(result.newTax)}`);
    showToast('Tax comparison complete', 'success');
  } catch (err) {
    showToast(`Tax calculation error: ${err.message}`, 'error');
  }
}

function displayTaxResults(result) {
  $('tax-results').classList.remove('hidden');

  // Old regime
  $('tax-old-taxable').textContent = formatCurrency(result.oldResult.taxableIncome);
  $('tax-old-tax').textContent = formatCurrency(result.oldResult.baseTax);
  $('tax-old-cess').textContent = formatCurrency(result.oldResult.cess);
  $('tax-old-total').textContent = formatCurrency(result.oldResult.totalTax);

  // New regime
  $('tax-new-taxable').textContent = formatCurrency(result.newResult.taxableIncome);
  $('tax-new-tax').textContent = formatCurrency(result.newResult.baseTax);
  $('tax-new-cess').textContent = formatCurrency(result.newResult.cess);
  $('tax-new-total').textContent = formatCurrency(result.newResult.totalTax);

  // Recommendation badge
  const badge = $('tax-recommendation');
  if (badge) {
    badge.classList.remove('hidden');
    const oldBetter = result.oldTax <= result.newTax;
    badge.className = `p-4 rounded-xl border-2 font-medium text-sm text-center ${
      oldBetter
        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
        : 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
    }`;
    badge.innerHTML = `<i class="fa-solid fa-circle-check mr-2"></i>${result.recommendation} &mdash; You save ${formatCurrency(result.savings)}`;
  }
  renderAffiliateCTAs('tax', result);
}

// ══════════════════════════════════════════════════
// 10. COMPARE SECTION
// ══════════════════════════════════════════════════

function initCompareSection() {
  const typeSelect = $('compare-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', renderCompareScenarioList);
    renderCompareScenarioList();
  }

  const compareBtn = $('compare-btn');
  if (compareBtn) compareBtn.addEventListener('click', runComparison);
}

function renderCompareScenarioList() {
  const type = $('compare-type')?.value || 'loan';
  const container = $('compare-scenario-list');
  const compareBtn = $('compare-btn');
  if (!container) return;

  const scenarios = type === 'loan' ? loanScenarios : sipScenarios;
  if (scenarios.length === 0) {
    container.innerHTML = '<p class="text-sm text-gray-400 dark:text-gray-500 italic">No saved scenarios available. Save scenarios from Loan Analyzer or SIP Planner first.</p>';
    if (compareBtn) compareBtn.disabled = true;
    return;
  }

  container.innerHTML = scenarios.map((s, i) => `
    <label class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-surface-900 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
      <input type="checkbox" class="compare-checkbox w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500" data-index="${i}" data-type="${type}">
      <span class="text-sm text-gray-700 dark:text-gray-300">${s.name}</span>
    </label>
  `).join('');

  // Enable compare button when 2-4 are selected
  container.querySelectorAll('.compare-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = container.querySelectorAll('.compare-checkbox:checked').length;
      if (compareBtn) compareBtn.disabled = checked < 2 || checked > 4;
    });
  });
  if (compareBtn) compareBtn.disabled = true;
}

function runComparison() {
  const type = $('compare-type')?.value || 'loan';
  const scenarios = type === 'loan' ? loanScenarios : sipScenarios;
  const container = $('compare-scenario-list');
  if (!container) return;

  const selected = [];
  container.querySelectorAll('.compare-checkbox:checked').forEach(cb => {
    const idx = parseInt(cb.dataset.index);
    if (scenarios[idx]) selected.push(scenarios[idx]);
  });

  if (selected.length < 2) {
    showToast('Select at least 2 scenarios', 'warning');
    return;
  }

  $('compare-results').classList.remove('hidden');

  // Build comparison table
  const table = $('compare-table');
  if (table) {
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (type === 'loan') {
      thead.innerHTML = `<tr><th class="px-4 py-3">Metric</th>${selected.map(s => `<th class="px-4 py-3">${s.name}</th>`).join('')}</tr>`;
      const metrics = [
        { label: 'Total Interest', key: 'totalInterest', fmt: formatCurrency },
        { label: 'Interest Saved', key: 'interestSaved', fmt: formatCurrency },
        { label: 'Tenure', key: 'months', fmt: formatDuration },
        { label: 'Tenure Reduced', key: 'tenureReduced', fmt: formatDuration },
      ];
      tbody.innerHTML = metrics.map(m => `
        <tr><td class="px-4 py-2.5 font-medium">${m.label}</td>${selected.map(s => `<td class="px-4 py-2.5">${m.fmt(s[m.key])}</td>`).join('')}</tr>
      `).join('');
    } else {
      thead.innerHTML = `<tr><th class="px-4 py-3">Metric</th>${selected.map(s => `<th class="px-4 py-3">${s.name}</th>`).join('')}</tr>`;
      const metrics = [
        { label: 'Final Value', key: 'finalValue', fmt: formatCurrency },
        { label: 'Total Invested', key: 'totalInvested', fmt: formatCurrency },
        { label: 'Wealth Gain', key: 'wealthGain', fmt: formatCurrency },
      ];
      tbody.innerHTML = metrics.map(m => `
        <tr><td class="px-4 py-2.5 font-medium">${m.label}</td>${selected.map(s => `<td class="px-4 py-2.5">${m.fmt(s[m.key])}</td>`).join('')}</tr>
      `).join('');
    }
  }

  // Chart
  renderCompareChart(selected, type);
  showToast('Comparison ready', 'success');
}

function renderCompareChart(selected, type) {
  const ctx = $('compareChart');
  if (!ctx) return;
  compareChartInstance = destroyChart(compareChartInstance);
  const colors = getChartColors();
  const chartColors = ['#3b82f6', '#059669', '#f59e0b', '#e11d48'];

  if (type === 'loan') {
    compareChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: selected.map(s => s.name),
        datasets: [
          {
            label: 'Total Interest',
            data: selected.map(s => s.totalInterest),
            backgroundColor: chartColors.slice(0, selected.length).map(c => c + '99'),
            borderRadius: 4,
          },
          {
            label: 'Interest Saved',
            data: selected.map(s => s.interestSaved),
            backgroundColor: chartColors.slice(0, selected.length).map(c => c + '44'),
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.text } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrencyCompact(ctx.parsed.y)}` } },
        },
        scales: {
          x: { ticks: { color: colors.muted }, grid: { color: colors.grid } },
          y: { ticks: { color: colors.muted, callback: v => formatCurrencyCompact(v) }, grid: { color: colors.grid } },
        },
      },
    });
  } else {
    compareChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: selected.map(s => s.name),
        datasets: [
          {
            label: 'Total Invested',
            data: selected.map(s => s.totalInvested),
            backgroundColor: 'rgba(59,130,246,0.5)',
            borderRadius: 4,
          },
          {
            label: 'Final Value',
            data: selected.map(s => s.finalValue),
            backgroundColor: 'rgba(5,150,105,0.5)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: colors.text } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatCurrencyCompact(ctx.parsed.y)}` } },
        },
        scales: {
          x: { ticks: { color: colors.muted }, grid: { color: colors.grid } },
          y: { ticks: { color: colors.muted, callback: v => formatCurrencyCompact(v) }, grid: { color: colors.grid } },
        },
      },
    });
  }
}

// ══════════════════════════════════════════════════
// 11. FINANCIAL HEALTH
// ══════════════════════════════════════════════════

// The health widget is on the dashboard. We use a simple approach:
// Collect some quick inputs from the user's last calculations if available.
// For now, clicking the score widget shows a simple modal.
// We integrate with the gauge on the dashboard.

function updateHealthScore(params) {
  try {
    const result = healthCalc.calculateScore(params);
    const recommendations = healthCalc.getRecommendations(result.score, params);

    $('health-score-value').textContent = result.score;
    $('health-score-label').textContent = result.grade;
    drawHealthGauge(result.score);

    return { ...result, recommendations };
  } catch {
    return null;
  }
}
