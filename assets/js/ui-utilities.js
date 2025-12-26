/**
 * UI Utilities
 * Common UI helper functions used across multiple pages
 */

const UIUtilities = {
    /**
     * Generic tab switching function
     * @param {string} tabName - The name of the tab to switch to
     * @param {string} activeColor - The color for active tab (default: 'blue')
     */
    switchTab(tabName, activeColor = 'blue') {
        // Hide all tab contents
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.add('hidden');
        });

        // Remove active state from all tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.remove(`border-${activeColor}-500`, `text-${activeColor}-600`, `dark:text-${activeColor}-400`);
            button.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
        });

        // Show selected tab content
        const selectedContent = document.getElementById(`content-${tabName}`);
        if (selectedContent) {
            selectedContent.classList.remove('hidden');
        }

        // Set active state for selected tab button
        const selectedButton = document.getElementById(`tab-${tabName}`);
        if (selectedButton) {
            selectedButton.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            selectedButton.classList.add(`border-${activeColor}-500`, `text-${activeColor}-600`, `dark:text-${activeColor}-400`);
        }
    },

    /**
     * Create a gauge chart (doughnut style)
     * @param {string} canvasId - The canvas element ID
     * @param {number} value - The gauge value (0-100)
     * @param {string} color - The gauge color
     * @param {string} cutout - Cutout percentage (default: '80%')
     */
    createGaugeChart(canvasId, value, color, cutout = '80%') {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas element with id '${canvasId}' not found`);
            return null;
        }

        return new Chart(canvas, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [value, 100 - value],
                    backgroundColor: [color, '#e5e7eb'],
                    borderWidth: 0,
                    cutout: cutout
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    tooltip: { enabled: false },
                    legend: { display: false }
                }
            }
        });
    },

    /**
     * Create a sparkline chart (small line chart)
     * @param {string} canvasId - The canvas element ID
     * @param {Array} labels - Time labels
     * @param {Array} data - Data points
     * @param {string} color - Line color
     * @param {string} label - Dataset label
     * @param {Function} valueFormatter - Tooltip value formatter
     */
    createSparklineChart(canvasId, labels, data, color, label, valueFormatter = (v) => v) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas element with id '${canvasId}' not found`);
            return null;
        }

        return new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: data,
                    borderColor: color,
                    backgroundColor: ChartConfig.hexToRgba(color, 0.1),
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: color,
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: color,
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return label + ': ' + valueFormatter(context.parsed.y);
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: { display: false },
                        ticks: {
                            maxRotation: 0,
                            autoSkipPadding: 20,
                            font: { size: 9 }
                        }
                    },
                    y: {
                        display: true,
                        min: 0,
                        max: 100,
                        ticks: {
                            callback: valueFormatter,
                            font: { size: 9 },
                            stepSize: 25
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' }
                    }
                }
            }
        });
    },

    /**
     * Show overlay/modal
     * @param {string} overlayId - The overlay element ID
     */
    showOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.classList.remove('hidden');
        }
    },

    /**
     * Hide overlay/modal
     * @param {string} overlayId - The overlay element ID
     */
    hideOverlay(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.classList.add('hidden');
        }
    },

    /**
     * Update device info header
     * @param {string} deviceName - Device name
     * @param {string} deviceModel - Device model
     * @param {string} deviceIP - Device IP address
     * @param {string} deviceMAC - Device MAC address
     * @param {string} deviceUptime - Device uptime
     * @param {string} deviceStatus - Device status (ONLINE, OFFLINE, etc.)
     */
    updateDeviceInfo(deviceName, deviceModel = null, deviceIP = null, deviceMAC = null, deviceUptime = null, deviceStatus = null) {
        const nameElement = document.querySelector('h2.text-lg.font-bold');
        if (nameElement && deviceName) {
            nameElement.textContent = deviceName;
        }

        if (deviceModel) {
            const modelElement = document.querySelector('h2.text-lg.font-bold + p.text-xs');
            if (modelElement) modelElement.textContent = deviceModel;
        }

        if (deviceIP) {
            const ipElement = document.querySelector('.font-mono.text-gray-700.dark\\:text-gray-300');
            if (ipElement) ipElement.textContent = deviceIP;
        }

        // Add more updates as needed
    },

    /**
     * Format bytes to human readable format
     * @param {number} bytes - Bytes value
     * @param {number} decimals - Number of decimal places
     */
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    /**
     * Format uptime to human readable format
     * @param {number} seconds - Uptime in seconds
     */
    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
    },

    /**
     * Debounce function for search/filter inputs
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Generate random data with normal distribution (Box-Muller transform)
     * @param {number} mean - Mean value
     * @param {number} stdDev - Standard deviation
     */
    generateNormalRandom(mean = 95, stdDev = 2) {
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const value = mean + z0 * stdDev;
        return Math.min(100, Math.max(0, value));
    },

    /**
     * Create time labels for charts
     * @param {number} hours - Number of hours
     * @param {string} suffix - Suffix for "now" label
     */
    generateTimeLabels(hours = 24, suffix = 'Now') {
        const labels = [];
        for (let i = 0; i <= hours; i++) {
            if (i === hours && suffix) {
                labels.push(suffix);
            } else {
                const hour = i % 24;
                labels.push(`${hour.toString().padStart(2, '0')}:00`);
            }
        }
        return labels;
    }
};
