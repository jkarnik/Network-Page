/**
 * Theme Manager
 * Handles dark/light mode toggling and persistence across pages
 */

class ThemeManager {
    constructor() {
        this.htmlElement = document.documentElement;
        this.isDark = false;
        this.charts = {};

        // Load saved theme preference
        this.loadTheme();

        // Initialize toggle button if exists
        this.initToggleButton();
    }

    /**
     * Load saved theme preference from sessionStorage
     */
    loadTheme() {
        const savedTheme = sessionStorage.getItem('theme');
        if (savedTheme === 'dark') {
            this.isDark = true;
            this.htmlElement.classList.add('dark');
        } else {
            this.isDark = false;
            this.htmlElement.classList.remove('dark');
        }
    }

    /**
     * Save theme preference to sessionStorage
     */
    saveTheme() {
        sessionStorage.setItem('theme', this.isDark ? 'dark' : 'light');
    }

    /**
     * Toggle between light and dark mode
     */
    toggle() {
        this.isDark = !this.isDark;
        if (this.isDark) {
            this.htmlElement.classList.add('dark');
        } else {
            this.htmlElement.classList.remove('dark');
        }
        this.saveTheme();
        this.updateChartColors();
    }

    /**
     * Register charts for theme updates
     */
    registerCharts(chartsObject) {
        this.charts = chartsObject;
    }

    /**
     * Update Chart.js colors based on current theme
     */
    updateChartColors() {
        const textColor = this.isDark ? '#9ca3af' : '#6b7280';
        const gridColor = this.isDark ? '#374151' : '#e5e7eb';

        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = textColor;
            Chart.defaults.borderColor = gridColor;

            // Update all registered charts
            Object.values(this.charts).forEach(chart => {
                if (chart && chart.update) {
                    chart.update();
                }
            });
        }
    }

    /**
     * Initialize the theme toggle button
     */
    initToggleButton() {
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }
    }

    /**
     * Get current theme
     */
    getTheme() {
        return this.isDark ? 'dark' : 'light';
    }

    /**
     * Check if dark mode is active
     */
    isDarkMode() {
        return this.isDark;
    }
}

// Create and export global instance
const themeManager = new ThemeManager();
