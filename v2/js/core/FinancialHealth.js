/**
 * Financial Health Score Calculator.
 *
 * Evaluates an individual's financial health on a 0-100 scale across four pillars:
 *   1. Savings rate (25 pts)
 *   2. Debt-to-income ratio (25 pts)
 *   3. Emergency fund coverage (25 pts)
 *   4. Insurance & investment coverage (25 pts)
 *
 * Also provides actionable recommendations based on the score and underlying parameters.
 */

import { roundCurrency } from '../utils/formatters.js';

export class FinancialHealthCalculator {
  /**
   * Calculate a financial health score (0-100).
   *
   * @param {Object} params
   * @param {number} params.monthlyIncome - Gross monthly income
   * @param {number} params.monthlyExpenses - Total monthly expenses (excluding EMIs)
   * @param {number} params.totalDebt - Total outstanding debt (loans, credit cards)
   * @param {number} params.monthlyEMIs - Total monthly EMI obligations
   * @param {number} params.emergencyFund - Current emergency fund balance
   * @param {boolean} params.hasInsurance - Whether adequate life/health insurance exists
   * @param {number} params.monthlySavings - Amount saved/invested monthly
   * @param {number} params.investments - Total investment portfolio value
   * @returns {{ score: number, grade: string, breakdown: Object, details: Object }}
   */
  calculateScore(params) {
    const {
      monthlyIncome = 0,
      monthlyExpenses = 0,
      totalDebt = 0,
      monthlyEMIs = 0,
      emergencyFund = 0,
      hasInsurance = false,
      monthlySavings = 0,
      investments = 0,
    } = params;

    if (monthlyIncome <= 0) {
      throw new Error('Monthly income must be positive');
    }

    // ── 1. Savings rate score (25 pts) ──
    const savingsRate = ((monthlyIncome - monthlyExpenses - monthlyEMIs) / monthlyIncome) * 100;
    let savingsScore;
    if (savingsRate >= 20) savingsScore = 25;
    else if (savingsRate >= 10) savingsScore = 15;
    else savingsScore = 5;

    // ── 2. Debt-to-income ratio score (25 pts) ──
    const annualIncome = monthlyIncome * 12;
    const debtToIncome = annualIncome > 0 ? (totalDebt / annualIncome) * 100 : 0;
    const emiToIncome = monthlyIncome > 0 ? (monthlyEMIs / monthlyIncome) * 100 : 0;

    let debtScore;
    // Use the worse of DTI or EMI-to-income
    const worstDebtMetric = Math.max(debtToIncome, emiToIncome);
    if (worstDebtMetric < 30) debtScore = 25;
    else if (worstDebtMetric <= 50) debtScore = 15;
    else debtScore = 5;

    // ── 3. Emergency fund score (25 pts) ──
    const monthlyNeed = monthlyExpenses + monthlyEMIs;
    const emergencyMonths = monthlyNeed > 0 ? emergencyFund / monthlyNeed : 0;

    let emergencyScore;
    if (emergencyMonths >= 6) emergencyScore = 25;
    else if (emergencyMonths >= 3) emergencyScore = 15;
    else emergencyScore = 5;

    // ── 4. Insurance & investments score (25 pts) ──
    const hasInvestments = investments > 0 || monthlySavings > 0;
    let insuranceInvestScore;
    if (hasInsurance && hasInvestments) insuranceInvestScore = 25;
    else if (hasInsurance || hasInvestments) insuranceInvestScore = 15;
    else insuranceInvestScore = 5;

    // ── Total ──
    const score = savingsScore + debtScore + emergencyScore + insuranceInvestScore;

    let grade;
    if (score >= 85) grade = 'Excellent';
    else if (score >= 70) grade = 'Good';
    else if (score >= 50) grade = 'Fair';
    else if (score >= 30) grade = 'Needs Improvement';
    else grade = 'Critical';

    return {
      score,
      grade,
      breakdown: {
        savingsRate: { score: savingsScore, maxScore: 25, value: Math.round(savingsRate * 100) / 100 },
        debtToIncome: { score: debtScore, maxScore: 25, value: Math.round(worstDebtMetric * 100) / 100 },
        emergencyFund: { score: emergencyScore, maxScore: 25, months: Math.round(emergencyMonths * 10) / 10 },
        insuranceInvestments: { score: insuranceInvestScore, maxScore: 25, hasInsurance, hasInvestments },
      },
      details: {
        savingsRate: Math.round(savingsRate * 100) / 100,
        debtToIncome: Math.round(debtToIncome * 100) / 100,
        emiToIncome: Math.round(emiToIncome * 100) / 100,
        emergencyMonths: Math.round(emergencyMonths * 10) / 10,
        monthlyDisposable: roundCurrency(monthlyIncome - monthlyExpenses - monthlyEMIs),
      },
    };
  }

  /**
   * Generate actionable recommendations based on the score and parameters.
   * @param {number} score - Health score from calculateScore
   * @param {Object} params - Same params object passed to calculateScore
   * @returns {string[]} Array of recommendation strings
   */
  getRecommendations(score, params) {
    const {
      monthlyIncome = 0,
      monthlyExpenses = 0,
      totalDebt = 0,
      monthlyEMIs = 0,
      emergencyFund = 0,
      hasInsurance = false,
      monthlySavings = 0,
      investments = 0,
    } = params;

    const recommendations = [];

    // Savings rate
    const savingsRate = monthlyIncome > 0
      ? ((monthlyIncome - monthlyExpenses - monthlyEMIs) / monthlyIncome) * 100
      : 0;

    if (savingsRate < 10) {
      recommendations.push(
        'Your savings rate is below 10%. Review monthly expenses and identify areas to cut back. Aim to save at least 20% of your income.'
      );
    } else if (savingsRate < 20) {
      recommendations.push(
        'Your savings rate is moderate (10-20%). Try to increase it to at least 20% by optimizing discretionary spending.'
      );
    }

    // Debt
    const annualIncome = monthlyIncome * 12;
    const debtToIncome = annualIncome > 0 ? (totalDebt / annualIncome) * 100 : 0;
    const emiToIncome = monthlyIncome > 0 ? (monthlyEMIs / monthlyIncome) * 100 : 0;

    if (emiToIncome > 50) {
      recommendations.push(
        `Your EMI-to-income ratio is ${Math.round(emiToIncome)}%, which is very high. Consider prepaying high-interest loans or consolidating debt.`
      );
    } else if (emiToIncome > 30) {
      recommendations.push(
        `Your EMI-to-income ratio is ${Math.round(emiToIncome)}%. Try to bring it below 30% by accelerating loan repayments.`
      );
    }

    if (debtToIncome > 100) {
      recommendations.push(
        'Your total debt exceeds your annual income. Prioritize debt repayment, starting with the highest interest-rate loans.'
      );
    }

    // Emergency fund
    const monthlyNeed = monthlyExpenses + monthlyEMIs;
    const emergencyMonths = monthlyNeed > 0 ? emergencyFund / monthlyNeed : 0;

    if (emergencyMonths < 3) {
      const target = roundCurrency(monthlyNeed * 6);
      recommendations.push(
        `Your emergency fund covers only ${Math.round(emergencyMonths * 10) / 10} months. Build it up to at least 6 months of expenses (approximately ${target}).`
      );
    } else if (emergencyMonths < 6) {
      recommendations.push(
        `Your emergency fund covers ${Math.round(emergencyMonths * 10) / 10} months. Top it up to 6 months for a comfortable safety net.`
      );
    }

    // Insurance
    if (!hasInsurance) {
      recommendations.push(
        'You lack adequate insurance coverage. Get a term life insurance (10x annual income) and a health insurance policy.'
      );
    }

    // Investments
    if (investments === 0 && monthlySavings === 0) {
      recommendations.push(
        'You have no active investments. Start a SIP in a diversified equity mutual fund, even with a small amount.'
      );
    } else if (monthlySavings > 0 && monthlySavings < monthlyIncome * 0.1) {
      recommendations.push(
        'Your monthly investment is less than 10% of income. Consider increasing your SIP to build long-term wealth.'
      );
    }

    // Overall
    if (score >= 85) {
      recommendations.push(
        'Your financial health is excellent. Focus on optimizing tax efficiency and exploring higher-return investment options.'
      );
    } else if (score < 30) {
      recommendations.push(
        'Your financial health needs urgent attention. Consider consulting a certified financial planner for a personalized action plan.'
      );
    }

    return recommendations;
  }
}
