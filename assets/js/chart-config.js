/**
 * Chart Configuration
 * Centralized Chart.js configuration and defaults
 */

const ChartConfig = {
    /**
     * Color schemes for light and dark themes
     */
    colors: {
        light: {
            text: '#6b7280',
            grid: '#e5e7eb',
            background: 'rgba(255, 255, 255, 0.8)'
        },
        dark: {
            text: '#9ca3af',
            grid: '#374151',
            background: 'rgba(31, 41, 55, 0.8)'
        }
    },

    /**
     * Chart color palette
     */
    palette: {
        blue: '#3b82f6',
        indigo: '#6366f1',
        purple: '#8b5cf6',
        pink: '#ec4899',
        red: '#ef4444',
        orange: '#f97316',
        amber: '#f59e0b',
        yellow: '#eab308',
        lime: '#84cc16',
        green: '#10b981',
        emerald: '#10b981',
        teal: '#14b8a6',
        cyan: '#06b6d4',
        sky: '#0ea5e9',
        gray: '#6b7280'
    },

    /**
     * Initialize Chart.js defaults
     */
    initDefaults() {
        if (typeof Chart !== 'undefined') {
            Chart.defaults.font.family = "'Inter', sans-serif";
            Chart.defaults.color = this.colors.light.text;
            Chart.defaults.borderColor = this.colors.light.grid;
            Chart.defaults.responsive = true;
            Chart.defaults.maintainAspectRatio = false;
        }
    },

    /**
     * Apply theme-specific colors to Chart.js
     */
    applyTheme(isDark) {
        if (typeof Chart !== 'undefined') {
            const theme = isDark ? this.colors.dark : this.colors.light;
            Chart.defaults.color = theme.text;
            Chart.defaults.borderColor = theme.grid;
        }
    },

    /**
     * Common tooltip configuration
     */
    getTooltipConfig(options = {}) {
        return {
            enabled: true,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: options.borderColor || this.palette.blue,
            borderWidth: 1,
            displayColors: options.displayColors !== false,
            ...options
        };
    },

    /**
     * Common legend configuration
     */
    getLegendConfig(options = {}) {
        return {
            display: options.display !== false,
            position: options.position || 'top',
            labels: {
                boxWidth: options.boxWidth || 12,
                font: {
                    size: options.fontSize || 11
                }
            }
        };
    },

    /**
     * Create a line chart dataset configuration
     */
    createLineDataset(label, data, color, options = {}) {
        return {
            label: label,
            data: data,
            borderColor: color,
            backgroundColor: options.fill ? this.hexToRgba(color, 0.1) : 'transparent',
            borderWidth: options.borderWidth || 2,
            pointRadius: options.pointRadius !== undefined ? options.pointRadius : 3,
            pointHoverRadius: options.pointHoverRadius || 6,
            pointBackgroundColor: color,
            pointHoverBackgroundColor: color,
            pointBorderColor: '#fff',
            pointHoverBorderColor: '#fff',
            pointBorderWidth: 2,
            tension: options.tension !== undefined ? options.tension : 0.4,
            fill: options.fill || false,
            ...options
        };
    },

    /**
     * Create a doughnut chart dataset configuration
     */
    createDoughnutDataset(data, colors, options = {}) {
        return {
            data: data,
            backgroundColor: colors,
            borderWidth: options.borderWidth || 0,
            ...options
        };
    },

    /**
     * Convert hex color to rgba
     */
    hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    /**
     * Common scale configuration for time-based charts
     */
    getTimeScaleConfig(options = {}) {
        return {
            x: {
                display: options.displayX !== false,
                grid: {
                    display: options.gridX || false
                },
                ticks: {
                    maxRotation: 0,
                    autoSkipPadding: 20,
                    font: { size: 9 }
                }
            },
            y: {
                display: options.displayY !== false,
                beginAtZero: options.beginAtZero !== false,
                ticks: {
                    callback: options.yCallback || function(value) { return value; },
                    font: { size: 9 }
                },
                grid: {
                    color: options.gridColor || 'rgba(0, 0, 0, 0.05)'
                }
            }
        };
    },

    /**
     * Create gauge chart options
     */
    getGaugeOptions(cutout = '80%') {
        return {
            cutout: cutout,
            circumference: 360,
            rotation: 0,
            plugins: {
                tooltip: { enabled: false },
                legend: { display: false }
            }
        };
    }
};

// Initialize defaults when script loads
if (typeof Chart !== 'undefined') {
    ChartConfig.initDefaults();
}
