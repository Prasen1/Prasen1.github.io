/**
 * Input validation utilities for all financial calculators.
 * Each validator returns { valid: boolean, error?: string }.
 * Compound validators return { valid: boolean, errors: string[] }.
 */

/**
 * Check if a value is a finite positive number.
 * @param {*} val - Value to check
 * @returns {{ valid: boolean, error?: string }}
 */
export function isPositiveNumber(val) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val <= 0) {
    return { valid: false, error: `Expected a positive number, got ${val}` };
  }
  return { valid: true };
}

/**
 * Check if a value is a valid percentage (0-100 inclusive).
 * @param {*} val - Value to check
 * @returns {{ valid: boolean, error?: string }}
 */
export function isPercentage(val) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0 || val > 100) {
    return { valid: false, error: `Expected a percentage (0-100), got ${val}` };
  }
  return { valid: true };
}

/**
 * Check if a value is a number within a given range (inclusive).
 * @param {*} val - Value to check
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {{ valid: boolean, error?: string }}
 */
export function isInRange(val, min, max) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < min || val > max) {
    return { valid: false, error: `Expected a number between ${min} and ${max}, got ${val}` };
  }
  return { valid: true };
}

/**
 * Check if a value is a non-negative finite number (zero allowed).
 * @param {*} val - Value to check
 * @returns {{ valid: boolean, error?: string }}
 */
export function isNonNegativeNumber(val) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
    return { valid: false, error: `Expected a non-negative number, got ${val}` };
  }
  return { valid: true };
}

/**
 * Validate loan calculator inputs.
 * @param {number} principal - Loan amount
 * @param {number} rate - Annual interest rate percentage
 * @param {number} tenure - Tenure in months
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateLoanInputs(principal, rate, tenure) {
  const errors = [];

  const p = isPositiveNumber(principal);
  if (!p.valid) errors.push(`Principal: ${p.error}`);

  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) {
    errors.push(`Interest rate: Expected a non-negative number, got ${rate}`);
  }

  if (typeof tenure !== 'number' || !Number.isFinite(tenure) || tenure <= 0 || !Number.isInteger(tenure)) {
    errors.push(`Tenure: Expected a positive integer (months), got ${tenure}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate SIP calculator inputs.
 * @param {number} amount - Monthly SIP amount
 * @param {number} rate - Expected annual return percentage
 * @param {number} years - Duration in years
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSIPInputs(amount, rate, years) {
  const errors = [];

  const a = isPositiveNumber(amount);
  if (!a.valid) errors.push(`SIP amount: ${a.error}`);

  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) {
    errors.push(`Return rate: Expected a non-negative number, got ${rate}`);
  }

  const y = isPositiveNumber(years);
  if (!y.valid) errors.push(`Duration: ${y.error}`);

  return { valid: errors.length === 0, errors };
}

/**
 * Validate FD calculator inputs.
 * @param {number} principal - Deposit amount
 * @param {number} rate - Annual interest rate percentage
 * @param {number} tenure - Tenure in years
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFDInputs(principal, rate, tenure) {
  const errors = [];

  const p = isPositiveNumber(principal);
  if (!p.valid) errors.push(`Principal: ${p.error}`);

  const r = isPositiveNumber(rate);
  if (!r.valid) errors.push(`Interest rate: ${r.error}`);

  const t = isPositiveNumber(tenure);
  if (!t.valid) errors.push(`Tenure: ${t.error}`);

  return { valid: errors.length === 0, errors };
}

/**
 * Validate tax calculator inputs.
 * @param {number} income - Gross annual income
 * @param {Object} [deductions] - Deductions object
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateTaxInputs(income, deductions) {
  const errors = [];

  if (typeof income !== 'number' || !Number.isFinite(income) || income < 0) {
    errors.push(`Income: Expected a non-negative number, got ${income}`);
  }

  if (deductions !== undefined && deductions !== null) {
    if (typeof deductions !== 'object') {
      errors.push('Deductions: Expected an object');
    } else {
      for (const [key, val] of Object.entries(deductions)) {
        if (typeof val === 'number' && (val < 0 || !Number.isFinite(val))) {
          errors.push(`Deductions.${key}: Expected a non-negative number, got ${val}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export const validators = {
  isPositiveNumber,
  isPercentage,
  isInRange,
  isNonNegativeNumber,
  validateLoanInputs,
  validateSIPInputs,
  validateFDInputs,
  validateTaxInputs,
};
