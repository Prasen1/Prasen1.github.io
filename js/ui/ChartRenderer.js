/**
 * Chart Renderer
 * Wrapper for Chart.js with reusable configurations
 */

import { formatCurrency, formatDuration } from '../utils/formatters.js';

export class ChartRenderer {
    constructor() {
        this.charts = {};
        this.defaultColors = {
            primary: '#3b82f6',
            secondary: '#10b981',
            tertiary: '#f59e0b',
            success: '#22c55e',
            warning: '#f97316',
            danger: '#ef4444',
            info: '#06b6d4'
        };
    }

    /**
     * Render loan balance chart
     * @param {String} canvasId - Canvas element ID
     * @param {Array} data - Chart data
     * @param {Object} options - Custom options
     * @returns {Chart} Chart instance
     */
    renderLoanBalanceChart(canvasId, data, options = {}) {
        // Destroy existing chart
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return null;
        }

        const ctx = canvas.getContext('2d');

        const chartConfig = {
            type: 'line',
            data: {
                datasets: [{
                    label: options.label || 'Loan Balance',
                    data: data,
                    borderColor: this.defaultColors.primary,
                    backgroundColor: this.defaultColors.primary,
                    borderWidth: 2,
                    pointBackgroundColor: this.defaultColors.primary,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    fill: false,
                    tension: 0.1
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
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'Balance: ' + formatCurrency(context.parsed.y);
                            }
                        }
                    },
                    legend: {
                        labels: {
                            color: this.getTextColor()
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
                            color: this.getTextColor()
                        },
                        ticks: {
                            stepSize: 12,
                            color: this.getTextColor()
                        },
                        grid: {
                            color: this.getGridColor()
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Balance (₹)',
                            color: this.getTextColor()
                        },
                        ticks: {
                            callback: value => formatCurrency(value),
                            color: this.getTextColor()
                        },
                        grid: {
                            color: this.getGridColor()
                        }
                    }
                }
            }
        };

        this.charts[canvasId] = new Chart(ctx, chartConfig);
        return this.charts[canvasId];
    }

    /**
     * Render SIP growth chart
     * @param {String} canvasId - Canvas element ID
     * @param {Array} investmentData - Investment value data
     * @param {Array} investedData - Invested amount data
     * @param {Object} options - Custom options
     * @returns {Chart} Chart instance
     */
    renderSIPGrowthChart(canvasId, investmentData, investedData, options = {}) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return null;
        }

        const ctx = canvas.getContext('2d');

        const chartConfig = {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Investment Value',
                        data: investmentData,
                        borderColor: this.defaultColors.secondary,
                        backgroundColor: this.defaultColors.secondary,
                        borderWidth: 2,
                        pointBackgroundColor: this.defaultColors.secondary,
                        pointRadius: 3,
                        fill: false,
                        tension: 0.1
                    },
                    {
                        label: 'Amount Invested',
                        data: investedData,
                        borderColor: this.defaultColors.primary,
                        backgroundColor: this.defaultColors.primary,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointBackgroundColor: this.defaultColors.primary,
                        pointRadius: 3,
                        fill: false,
                        tension: 0.1
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
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                return label + ': ' + formatCurrency(context.parsed.y);
                            }
                        }
                    },
                    legend: {
                        labels: {
                            color: this.getTextColor()
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
                            color: this.getTextColor()
                        },
                        ticks: {
                            stepSize: 1,
                            color: this.getTextColor()
                        },
                        grid: {
                            color: this.getGridColor()
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Amount (₹)',
                            color: this.getTextColor()
                        },
                        ticks: {
                            callback: value => formatCurrency(value),
                            color: this.getTextColor()
                        },
                        grid: {
                            color: this.getGridColor()
                        }
                    }
                }
            }
        };

        this.charts[canvasId] = new Chart(ctx, chartConfig);
        return this.charts[canvasId];
    }

    /**
     * Render scenario comparison chart
     * @param {String} canvasId - Canvas element ID
     * @param {Array} scenarios - Array of scenario data
     * @param {Object} options - Custom options
     * @returns {Chart} Chart instance
     */
    renderScenarioComparisonChart(canvasId, scenarios, options = {}) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return null;
        }

        const ctx = canvas.getContext('2d');

        const colors = [
            this.defaultColors.primary,
            this.defaultColors.secondary,
            this.defaultColors.tertiary,
            this.defaultColors.warning,
            this.defaultColors.info
        ];

        const datasets = scenarios.map((scenario, index) => ({
            label: scenario.name,
            data: scenario.data,
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length],
            borderWidth: 2,
            pointBackgroundColor: colors[index % colors.length],
            pointRadius: 3,
            fill: false,
            tension: 0.1
        }));

        const chartConfig = {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                            }
                        }
                    },
                    legend: {
                        labels: {
                            color: this.getTextColor()
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
                            color: this.getTextColor()
                        },
                        ticks: {
                            color: this.getTextColor()
                        },
                        grid: {
                            color: this.getGridColor()
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Balance (₹)',
                            color: this.getTextColor()
                        },
                        ticks: {
                            callback: value => formatCurrency(value),
                            color: this.getTextColor()
                        },
                        grid: {
                            color: this.getGridColor()
                        }
                    }
                }
            }
        };

        this.charts[canvasId] = new Chart(ctx, chartConfig);
        return this.charts[canvasId];
    }

    /**
     * Render retirement corpus depletion chart
     * @param {String} canvasId - Canvas element ID
     * @param {Array} accumulationData - Accumulation phase data
     * @param {Array} withdrawalData - Withdrawal phase data
     * @param {Object} options - Custom options
     * @returns {Chart} Chart instance
     */
    renderRetirementChart(canvasId, accumulationData, withdrawalData, options = {}) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas ${canvasId} not found`);
            return null;
        }

        const ctx = canvas.getContext('2d');

        const chartConfig = {
            type: 'line',
            data: {
                datasets: [
                    {
                        label: 'Accumulation Phase',
                        data: accumulationData,
                        borderColor: this.defaultColors.success,
                        backgroundColor: this.defaultColors.success,
                        borderWidth: 2,
                        pointRadius: 2,
                        fill: false
                    },
                    {
                        label: 'Withdrawal Phase',
                        data: withdrawalData,
                        borderColor: this.defaultColors.warning,
                        backgroundColor: this.defaultColors.warning,
                        borderWidth: 2,
                        pointRadius: 2,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                            }
                        }
                    },
                    legend: {
                        labels: {
                            color: this.getTextColor()
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Years',
                            color: this.getTextColor()
                        },
                        ticks: {
                            color: this.getTextColor()
                        },
                        grid: {
                            color: this.getGridColor()
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Corpus (₹)',
                            color: this.getTextColor()
                        },
                        ticks: {
                            callback: value => formatCurrency(value),
                            color: this.getTextColor()
                        },
                        grid: {
                            color: this.getGridColor()
                        }
                    }
                }
            }
        };

        this.charts[canvasId] = new Chart(ctx, chartConfig);
        return this.charts[canvasId];
    }

    /**
     * Update chart colors for dark mode
     * @param {String} canvasId - Canvas element ID
     */
    updateChartColors(canvasId) {
        const chart = this.charts[canvasId];
        if (!chart) return;

        const textColor = this.getTextColor();
        const gridColor = this.getGridColor();

        // Update scales
        if (chart.options.scales) {
            Object.keys(chart.options.scales).forEach(scaleKey => {
                const scale = chart.options.scales[scaleKey];
                if (scale.title) scale.title.color = textColor;
                if (scale.ticks) scale.ticks.color = textColor;
                if (scale.grid) scale.grid.color = gridColor;
            });
        }

        // Update legend
        if (chart.options.plugins?.legend?.labels) {
            chart.options.plugins.legend.labels.color = textColor;
        }

        chart.update();
    }

    /**
     * Update all chart colors
     */
    updateAllChartColors() {
        Object.keys(this.charts).forEach(canvasId => {
            this.updateChartColors(canvasId);
        });
    }

    /**
     * Get text color based on theme
     */
    getTextColor() {
        return document.body.classList.contains('dark-mode') ? '#e2e8f0' : '#1e293b';
    }

    /**
     * Get grid color based on theme
     */
    getGridColor() {
        return document.body.classList.contains('dark-mode') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    }

    /**
     * Destroy a specific chart
     * @param {String} canvasId - Canvas element ID
     */
    destroyChart(canvasId) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            delete this.charts[canvasId];
        }
    }

    /**
     * Destroy all charts
     */
    destroyAllCharts() {
        Object.keys(this.charts).forEach(canvasId => {
            this.charts[canvasId].destroy();
        });
        this.charts = {};
    }
}

// Create singleton instance
export const chartRenderer = new ChartRenderer();
