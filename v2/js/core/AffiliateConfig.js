// ── Affiliate Configuration ──
// Single source of truth for all affiliate links and CTA card definitions.
// Update REFERRAL_CODE below with your actual referral code.

import { formatCurrencyCompact } from '../utils/formatters.js';

// ── Edit this section ──
const REFERRAL_LINK = 'https://app.groww.in/v3cO/edflej4r';

export const AFFILIATE_LINKS = {
  groww_sip: REFERRAL_LINK,
  groww_general: REFERRAL_LINK,
  groww_elss: REFERRAL_LINK,
  groww_nps: REFERRAL_LINK,
};

export const CTA_DEFINITIONS = {
  loan: [
    {
      icon: 'fa-solid fa-chart-line',
      gradient: 'from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700',
      headline: 'Start a SIP to prepay your loan faster',
      description: 'A small monthly SIP alongside your EMI can help you build a prepayment corpus and close your loan early.',
      dynamicText: (result) => {
        if (!result?.originalEMI) return null;
        const sipSuggest = Math.round(result.originalEMI * 0.1 / 100) * 100;
        if (sipSuggest <= 0) return null;
        return `Even ${formatCurrencyCompact(sipSuggest)}/mo invested could help you prepay faster.`;
      },
      buttonText: 'Explore SIP on Groww',
      linkKey: 'groww_sip',
    },
  ],

  sip: [
    {
      icon: 'fa-solid fa-rocket',
      gradient: 'from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400',
      btnColor: 'bg-blue-600 hover:bg-blue-700',
      headline: 'Ready to start this SIP?',
      description: 'Open a free account on Groww and set up your SIP in under 5 minutes.',
      dynamicText: (result) => {
        if (!result?._config) return null;
        const amount = result._config.amount || result._config.target;
        if (!amount) return null;
        if (result._mode === 'goal' || result._mode === 'retirement') {
          const reqSIP = result.requiredSIP;
          return reqSIP ? `Start your ${formatCurrencyCompact(reqSIP)}/mo SIP on Groww today.` : null;
        }
        return `Set up your ${formatCurrencyCompact(amount)}/mo SIP on Groww today.`;
      },
      buttonText: 'Start SIP on Groww',
      linkKey: 'groww_sip',
    },
  ],

  emi: [
    {
      icon: 'fa-solid fa-scale-balanced',
      gradient: 'from-violet-500/10 to-purple-500/10 dark:from-violet-500/20 dark:to-purple-500/20',
      borderColor: 'border-violet-200 dark:border-violet-800',
      iconColor: 'text-violet-600 dark:text-violet-400',
      btnColor: 'bg-violet-600 hover:bg-violet-700',
      headline: 'Compare loan offers',
      description: 'Check competitive interest rates and find the best loan for your needs.',
      dynamicText: null,
      buttonText: 'Compare on Groww',
      linkKey: 'groww_general',
    },
  ],

  fdrd: [
    {
      icon: 'fa-solid fa-arrow-trend-up',
      gradient: 'from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20',
      borderColor: 'border-amber-200 dark:border-amber-800',
      iconColor: 'text-amber-600 dark:text-amber-400',
      btnColor: 'bg-amber-600 hover:bg-amber-700',
      headline: 'Want higher returns? Consider a SIP',
      description: 'Equity mutual funds have historically delivered higher long-term returns than FDs.',
      dynamicText: (result) => {
        if (!result?.interestEarned) return null;
        return `Your FD/RD earns ${formatCurrencyCompact(result.interestEarned)} in interest \u2014 a SIP could potentially grow faster over the long term.`;
      },
      buttonText: 'Explore SIPs on Groww',
      linkKey: 'groww_sip',
    },
  ],

  tax: [
    {
      icon: 'fa-solid fa-shield-halved',
      gradient: 'from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20',
      borderColor: 'border-green-200 dark:border-green-800',
      iconColor: 'text-green-600 dark:text-green-400',
      btnColor: 'bg-green-600 hover:bg-green-700',
      headline: 'Save tax with ELSS mutual funds',
      description: 'ELSS funds offer Section 80C deduction up to \u20B91.5 lakh with a 3-year lock-in and potential for high returns.',
      dynamicText: null,
      buttonText: 'Explore ELSS on Groww',
      linkKey: 'groww_elss',
    },
    {
      icon: 'fa-solid fa-piggy-bank',
      gradient: 'from-cyan-500/10 to-sky-500/10 dark:from-cyan-500/20 dark:to-sky-500/20',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
      btnColor: 'bg-cyan-600 hover:bg-cyan-700',
      headline: 'Extra \u20B950K deduction with NPS',
      description: 'Section 80CCD(1B) gives an additional \u20B950,000 deduction over the \u20B91.5L 80C limit.',
      dynamicText: null,
      buttonText: 'Open NPS on Groww',
      linkKey: 'groww_nps',
    },
  ],
};
