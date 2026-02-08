/**
 * Formatting utilities for currency, percentages, and numbers
 */

/**
 * Format currency with Indian Rupee symbol and commas
 * @param {Number} amount - Amount to format
 * @returns {String} Formatted currency string
 */
export function formatCurrency(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) {
        return '₹0.00';
    }
    return '₹' + parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

/**
 * Format percentage with proper rounding
 * @param {Number} rate - Rate to format
 * @returns {String} Formatted percentage string
 */
export function formatPercentage(rate) {
    if (rate === null || rate === undefined || isNaN(rate)) {
        return '0.00%';
    }
    return parseFloat(rate).toFixed(2) + '%';
}

/**
 * Format number with Indian numbering system (lakhs, crores)
 * @param {Number} number - Number to format
 * @returns {String} Formatted number string
 */
export function formatIndianNumber(number) {
    if (number === null || number === undefined || isNaN(number)) {
        return '0';
    }

    const num = parseFloat(number);

    if (num >= 10000000) {
        // Crores
        return (num / 10000000).toFixed(2) + ' Cr';
    } else if (num >= 100000) {
        // Lakhs
        return (num / 100000).toFixed(2) + ' L';
    } else if (num >= 1000) {
        // Thousands
        return (num / 1000).toFixed(2) + ' K';
    } else {
        return num.toFixed(2);
    }
}

/**
 * Format duration in months to years and months
 * @param {Number} months - Number of months
 * @returns {String} Formatted duration string
 */
export function formatDuration(months) {
    if (months === null || months === undefined || isNaN(months)) {
        return '0 months';
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (years === 0) {
        return `${remainingMonths} ${remainingMonths === 1 ? 'month' : 'months'}`;
    } else if (remainingMonths === 0) {
        return `${years} ${years === 1 ? 'year' : 'years'}`;
    } else {
        return `${years}y ${remainingMonths}m`;
    }
}

/**
 * Format date to Indian format
 * @param {Date|String|Number} date - Date to format
 * @returns {String} Formatted date string
 */
export function formatDate(date) {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return 'Invalid Date';
        }
        return d.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

/**
 * Format date and time to Indian format
 * @param {Date|String|Number} date - Date to format
 * @returns {String} Formatted date and time string
 */
export function formatDateTime(date) {
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return 'Invalid Date';
        }
        return d.toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

/**
 * Parse formatted currency string back to number
 * @param {String} currencyString - Formatted currency string
 * @returns {Number} Parsed number
 */
export function parseCurrency(currencyString) {
    if (!currencyString) return 0;

    // Remove currency symbol and commas
    const cleaned = currencyString.replace(/[₹,]/g, '').trim();
    const number = parseFloat(cleaned);

    return isNaN(number) ? 0 : number;
}

/**
 * Format large numbers in compact notation
 * @param {Number} number - Number to format
 * @param {Number} decimals - Number of decimal places
 * @returns {String} Formatted compact number
 */
export function formatCompactNumber(number, decimals = 1) {
    if (number === null || number === undefined || isNaN(number)) {
        return '0';
    }

    const num = parseFloat(number);
    const absNum = Math.abs(num);

    const lookup = [
        { value: 1e9, symbol: 'B' },
        { value: 1e7, symbol: 'Cr' },
        { value: 1e5, symbol: 'L' },
        { value: 1e3, symbol: 'K' }
    ];

    const item = lookup.find(item => absNum >= item.value);

    if (item) {
        const formatted = (num / item.value).toFixed(decimals);
        return formatted + item.symbol;
    }

    return num.toFixed(decimals);
}
