/**
 * Theme Manager
 * Handles dark/light mode toggling and persistence across pages.
 * Uses localStorage for persistent theme preference across sessions.
 *
 * @namespace ThemeManager
 */
const ThemeManager = {
    /** @type {HTMLElement} */
    _htmlElement: document.documentElement,

    /** @type {boolean} */
    _isDark: false,

    /** @type {Object.<string, Object>} */
    _charts: {},

    /**
     * Initialize theme manager - loads saved preference and sets up toggle button.
     * Called automatically when the script loads.
     */
    init() {
        this.loadTheme();
        this.initToggleButton();
    },

    /**
     * Load saved theme preference from localStorage.
     * Defaults to dark mode if no preference is saved.
     */
    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            this._isDark = false;
            this._htmlElement.classList.remove('dark');
        } else {
            this._isDark = true;
            this._htmlElement.classList.add('dark');
        }
    },

    /**
     * Save theme preference to localStorage.
     */
    saveTheme() {
        localStorage.setItem('theme', this._isDark ? 'dark' : 'light');
    },

    /**
     * Toggle between light and dark mode.
     */
    toggle() {
        this._isDark = !this._isDark;
        if (this._isDark) {
            this._htmlElement.classList.add('dark');
        } else {
            this._htmlElement.classList.remove('dark');
        }
        this.saveTheme();
        this.updateChartColors();
    },

    /**
     * Register charts for theme updates.
     * @param {Object.<string, Object>} chartsObject - Map of chart name to Chart.js instance
     */
    registerCharts(chartsObject) {
        this._charts = chartsObject;
    },

    /**
     * Update Chart.js colors based on current theme.
     */
    updateChartColors() {
        const textColor = this._isDark ? '#9ca3af' : '#6b7280';
        const gridColor = this._isDark ? '#374151' : '#e5e7eb';

        if (typeof Chart !== 'undefined') {
            Chart.defaults.color = textColor;
            Chart.defaults.borderColor = gridColor;

            Object.values(this._charts).forEach(chart => {
                if (chart && chart.update) {
                    chart.update();
                }
            });
        }
    },

    /**
     * Initialize the theme toggle button listener.
     */
    initToggleButton() {
        const toggleBtn = document.getElementById('themeToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }
    },

    /**
     * Get current theme string.
     * @returns {string} 'dark' or 'light'
     */
    getTheme() {
        return this._isDark ? 'dark' : 'light';
    },

    /**
     * Check if dark mode is active.
     * @returns {boolean}
     */
    isDarkMode() {
        return this._isDark;
    }
};

// Initialize on load and expose as global
ThemeManager.init();
const themeManager = ThemeManager;
window.themeManager = themeManager;
