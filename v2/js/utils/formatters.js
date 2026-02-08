/**
 * Formatting utilities for currency, percentages, numbers, and data export.
 * All currency values are rounded to 2 decimal places using Math.round(x * 100) / 100.
 */

/**
 * Round a number to 2 decimal places (currency precision).
 * Uses Math.round(x * 100) / 100 to avoid floating-point drift.
 * @param {number} val
 * @returns {number}
 */
export function roundCurrency(val) {
  return Math.round(val * 100) / 100;
}

/**
 * Format a number as Indian Rupee currency with commas.
 * Uses the Indian numbering system (lakhs and crores grouping).
 * @param {number} amount - Amount to format
 * @returns {string} Formatted string like "₹12,34,567.89"
 */
export function formatCurrency(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '\u20B90.00';
  }
  const rounded = roundCurrency(parseFloat(amount));
  const parts = rounded.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian grouping: first group of 3 from right, then groups of 2
  const sign = integerPart.startsWith('-') ? '-' : '';
  const abs = integerPart.replace('-', '');

  let formatted;
  if (abs.length <= 3) {
    formatted = abs;
  } else {
    const last3 = abs.slice(-3);
    const remaining = abs.slice(0, -3);
    const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formatted = grouped + ',' + last3;
  }

  return '\u20B9' + sign + formatted + '.' + decimalPart;
}

/**
 * Format a rate as a percentage string.
 * @param {number} rate - Rate to format (e.g. 8.5 for 8.5%)
 * @returns {string} Formatted string like "8.50%"
 */
export function formatPercentage(rate) {
  if (rate === null || rate === undefined || isNaN(rate)) {
    return '0.00%';
  }
  return parseFloat(rate).toFixed(2) + '%';
}

/**
 * Format a number using the Indian numbering system (Cr / L / K suffixes).
 * @param {number} number - Number to format
 * @returns {string} Formatted string like "12.34 Cr"
 */
export function formatIndianNumber(number) {
  if (number === null || number === undefined || isNaN(number)) {
    return '0';
  }

  const num = parseFloat(number);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e7) {
    return sign + (abs / 1e7).toFixed(2) + ' Cr';
  } else if (abs >= 1e5) {
    return sign + (abs / 1e5).toFixed(2) + ' L';
  } else if (abs >= 1e3) {
    return sign + (abs / 1e3).toFixed(2) + ' K';
  }
  return sign + abs.toFixed(2);
}

/**
 * Format a number as compact Indian currency with the Rupee symbol.
 * Examples: ₹1.2Cr, ₹45L, ₹5K, ₹950
 * @param {number} amount - Amount to format
 * @param {number} [decimals=1] - Number of decimal places
 * @returns {string}
 */
export function formatCurrencyCompact(amount, decimals = 1) {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '\u20B90';
  }

  const num = parseFloat(amount);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  if (abs >= 1e7) {
    return '\u20B9' + sign + (abs / 1e7).toFixed(decimals) + 'Cr';
  } else if (abs >= 1e5) {
    return '\u20B9' + sign + (abs / 1e5).toFixed(decimals) + 'L';
  } else if (abs >= 1e3) {
    return '\u20B9' + sign + (abs / 1e3).toFixed(decimals) + 'K';
  }
  return '\u20B9' + sign + abs.toFixed(decimals);
}

/**
 * Format a duration in months as a human-readable string.
 * @param {number} months - Number of months
 * @returns {string} Formatted string like "2y 3m" or "5 months"
 */
export function formatDuration(months) {
  if (months === null || months === undefined || isNaN(months)) {
    return '0 months';
  }

  const m = Math.round(months);
  const years = Math.floor(m / 12);
  const rem = m % 12;

  if (years === 0) {
    return `${rem} ${rem === 1 ? 'month' : 'months'}`;
  } else if (rem === 0) {
    return `${years} ${years === 1 ? 'year' : 'years'}`;
  }
  return `${years}y ${rem}m`;
}

/**
 * Format a date to Indian locale format.
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date like "8 Feb 2025"
 */
export function formatDate(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Format a date and time to Indian locale format.
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date-time string
 */
export function formatDateTime(date) {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleString('en-IN', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return 'Invalid Date';
  }
}

/**
 * Parse a formatted Indian currency/number string back to a number.
 * Handles strings like "₹12,34,567.89", "45L", "1.2Cr", "5K", "12,345".
 * @param {string} str - Formatted number string
 * @returns {number} Parsed number (0 if unparsable)
 */
export function parseNumber(str) {
  if (str === null || str === undefined) return 0;
  if (typeof str === 'number') return str;

  let s = String(str).trim();

  // Remove currency symbol
  s = s.replace(/[\u20B9₹]/g, '');

  // Handle suffixes
  const suffixMatch = s.match(/^([+-]?\d+\.?\d*)\s*(Cr|cr|CR|L|l|K|k)$/);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1]);
    const suffix = suffixMatch[2].toLowerCase();
    const multipliers = { cr: 1e7, l: 1e5, k: 1e3 };
    return isNaN(num) ? 0 : num * (multipliers[suffix] || 1);
  }

  // Remove commas and parse
  const cleaned = s.replace(/,/g, '');
  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}

/**
 * Parse a formatted currency string back to a number (alias for backward compat).
 * @param {string} currencyString - Formatted currency string
 * @returns {number}
 */
export function parseCurrency(currencyString) {
  return parseNumber(currencyString);
}

/**
 * Format large numbers in compact notation (international).
 * @param {number} number - Number to format
 * @param {number} [decimals=1] - Decimal places
 * @returns {string}
 */
export function formatCompactNumber(number, decimals = 1) {
  if (number === null || number === undefined || isNaN(number)) return '0';

  const num = parseFloat(number);
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';

  const lookup = [
    { value: 1e9, symbol: 'B' },
    { value: 1e7, symbol: 'Cr' },
    { value: 1e5, symbol: 'L' },
    { value: 1e3, symbol: 'K' },
  ];

  const item = lookup.find(i => abs >= i.value);
  if (item) {
    return sign + (abs / item.value).toFixed(decimals) + item.symbol;
  }
  return sign + abs.toFixed(decimals);
}

/**
 * Convert headers and row data to a CSV string.
 * Handles quoting of fields that contain commas, quotes, or newlines.
 * @param {string[]} headers - Column headers
 * @param {Array<Array<*>>} rows - Array of row arrays
 * @returns {string} CSV string
 */
export function toCSV(headers, rows) {
  const escape = (val) => {
    const s = val === null || val === undefined ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const lines = [headers.map(escape).join(',')];
  for (const row of rows) {
    lines.push(row.map(escape).join(','));
  }
  return lines.join('\n');
}
