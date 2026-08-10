/**
 * SharedUI - Shared UI utilities for device pages
 * Eliminates code duplication across sdwan-main.js, switch-main.js, and access-point-main.js
 *
 * @namespace SharedUI
 */
const SharedUI = {

    // ==================== SEVERITY CONSTANTS ====================

    /**
     * Severity badge CSS classes for device alert tables
     * @type {Object.<string, string>}
     */
    SEV_STYLES: {
        crit: 'px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        warn: 'px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
        info: 'px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    },

    /**
     * Severity badge CSS classes for summary page alert tables (rounded-full style)
     * @type {Object.<string, string>}
     */
    SEV_STYLES_SUMMARY: {
        crit: 'text-newrelic-error bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-full px-2 py-0.5 text-xs font-bold border border-red-100 dark:border-red-900',
        warn: 'text-newrelic-warning bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-full px-2 py-0.5 text-xs font-bold border border-amber-100 dark:border-amber-900',
        info: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-full px-2 py-0.5 text-xs font-bold border border-blue-100 dark:border-blue-900'
    },

    /**
     * Severity FontAwesome icon markup
     * @type {Object.<string, string>}
     */
    SEV_ICONS: {
        crit: '<i class="fa-solid fa-circle-exclamation"></i>',
        warn: '<i class="fa-solid fa-triangle-exclamation"></i>',
        info: '<i class="fa-solid fa-circle-info"></i>'
    },

    // ==================== DEVICE STATUS STYLES ====================

    /**
     * Status-based styles for the device info header card.
     * Used by updateDeviceInfo() to set border color, badge classes, and label text.
     * @type {Object.<string, {border: string, badge: string, label: string}>}
     */
    STATUS_STYLES: {
        online:   { border: 'border-green-500',  badge: 'px-2 py-1 text-xs font-bold rounded text-green-700 bg-green-100 dark:bg-green-900 dark:text-green-300', label: 'HEALTHY' },
        warning:  { border: 'border-amber-500',  badge: 'px-2 py-1 text-xs font-bold rounded text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300', label: 'WARNING' },
        critical: { border: 'border-red-500',     badge: 'px-2 py-1 text-xs font-bold rounded text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300', label: 'CRITICAL' },
    },

    // ==================== DEVICE SELECTOR ====================

    /**
     * Initialize a device selector dropdown, grouped by site.
     * Handles URL param pre-selection and returns the selected device.
     *
     * @param {string} deviceType - DataLoader device type key ('gateways', 'switches', 'accessPoints')
     * @param {Object} callbacks - Callback functions
     * @param {function(Object): void} callbacks.onDeviceSelected - Called with the selected device object
     * @returns {Promise<Object|null>} The initially selected device, or null
     */
    async initDeviceSelector(deviceType, callbacks) {
        try {
            await DataLoader.load();
            const devices = DataLoader.getDevices(deviceType);
            const selector = document.getElementById('deviceSelector');

            if (!selector) {
                console.warn('Device selector element not found');
                return null;
            }
            if (devices.length === 0) {
                console.warn(`No ${deviceType} found in data`);
                return null;
            }

            // Group devices by site
            const siteGroups = {};
            devices.forEach(device => {
                if (!siteGroups[device.site]) {
                    siteGroups[device.site] = [];
                }
                siteGroups[device.site].push(device);
            });

            // Build the dropdown options
            let optionsHtml = '';
            Object.keys(siteGroups).sort().forEach(site => {
                optionsHtml += `<optgroup label="${site}">`;
                siteGroups[site].forEach(device => {
                    optionsHtml += `<option value="${device.id}">${device.name}</option>`;
                });
                optionsHtml += '</optgroup>';
            });

            selector.innerHTML = optionsHtml;

            // Check for URL parameter to pre-select device
            let selectedDevice = null;
            const urlParams = new URLSearchParams(window.location.search);
            const deviceParam = urlParams.get('device');

            if (deviceParam) {
                const device = devices.find(d => d.id === deviceParam || d.name === deviceParam);
                if (device) {
                    selector.value = device.id;
                    selectedDevice = device;
                }
            }

            // If no device selected, use the first one
            if (!selectedDevice && devices.length > 0) {
                selectedDevice = devices[0];
                selector.value = selectedDevice.id;
            }

            // Bind change event listener (replaces inline onchange)
            if (callbacks && callbacks.onDeviceChanged) {
                selector.addEventListener('change', (e) => {
                    callbacks.onDeviceChanged(e.target.value);
                });
            }

            // Invoke callback with selected device
            if (selectedDevice && callbacks && callbacks.onDeviceSelected) {
                callbacks.onDeviceSelected(selectedDevice);
            }

            return selectedDevice;
        } catch (error) {
            console.error(`initDeviceSelector(${deviceType}) failed:`, error);
            return null;
        }
    },

    // ==================== DEVICE VIEW UPDATE ====================

    /**
     * Handle device selection change from a dropdown.
     * Updates the URL and invokes a callback with the device.
     *
     * @param {string} deviceId - The selected device ID
     * @param {function(Object): void} onDeviceChanged - Callback with the device object
     * @returns {Object|null} The device object, or null if not found
     */
    changeDevice(deviceId, onDeviceChanged) {
        const device = DataLoader.getDeviceById(deviceId);
        if (!device) {
            console.warn('Device not found:', deviceId);
            return null;
        }

        // Update URL without reloading
        const url = new URL(window.location);
        url.searchParams.set('device', deviceId);
        window.history.replaceState({}, '', url);

        if (onDeviceChanged) {
            onDeviceChanged(device);
        }

        return device;
    },

    // ==================== SITE SELECTOR ====================

    /**
     * Initialize the site selector dropdown, grouped by region.
     * Handles URL param pre-selection and returns the selected site.
     *
     * @param {Object} callbacks
     * @param {function(Object): void} callbacks.onSiteSelected - Called with the selected site object (has .name)
     * @param {function(string): void} callbacks.onSiteChanged - Called with the site name on dropdown change
     * @returns {Promise<Object|null>} The initially selected site, or null
     */
    async initSiteSelector(callbacks) {
        try {
            await DataLoader.load();
            const sites = DataLoader.getSites();
            const siteNames = Object.keys(sites);
            const selector = document.getElementById('siteSelector');

            if (!selector) {
                console.warn('Site selector element not found');
                return null;
            }
            if (siteNames.length === 0) {
                console.warn('No sites found in data');
                return null;
            }

            const regionGroups = {};
            siteNames.forEach(name => {
                const region = sites[name].region || 'Other';
                if (!regionGroups[region]) regionGroups[region] = [];
                regionGroups[region].push(name);
            });

            let optionsHtml = '';
            Object.keys(regionGroups).sort().forEach(region => {
                optionsHtml += `<optgroup label="${region}">`;
                regionGroups[region].sort().forEach(name => {
                    optionsHtml += `<option value="${name}">${name}</option>`;
                });
                optionsHtml += '</optgroup>';
            });
            selector.innerHTML = optionsHtml;

            let selectedSite = null;
            const urlParams = new URLSearchParams(window.location.search);
            const siteParam = urlParams.get('site');

            if (siteParam && sites[siteParam]) {
                selector.value = siteParam;
                selectedSite = { name: siteParam, ...sites[siteParam] };
            }

            if (!selectedSite) {
                const firstName = siteNames[0];
                selector.value = firstName;
                selectedSite = { name: firstName, ...sites[firstName] };
            }

            if (callbacks && callbacks.onSiteChanged) {
                selector.addEventListener('change', (e) => {
                    callbacks.onSiteChanged(e.target.value);
                });
            }

            if (selectedSite && callbacks && callbacks.onSiteSelected) {
                callbacks.onSiteSelected(selectedSite);
            }

            return selectedSite;
        } catch (error) {
            console.error('initSiteSelector failed:', error);
            return null;
        }
    },

    /**
     * Handle site selection change from the dropdown.
     * Updates the URL and invokes a callback with the site.
     *
     * @param {string} siteName - The selected site name
     * @param {function(Object): void} onSiteChanged - Callback with the site object (has .name)
     * @returns {Object|null} The site object, or null if not found
     */
    changeSite(siteName, onSiteChanged) {
        const site = DataLoader.getSite(siteName);
        if (!site) {
            console.warn('Site not found:', siteName);
            return null;
        }
        const siteWithName = { name: siteName, ...site };

        const url = new URL(window.location);
        url.searchParams.set('site', siteName);
        window.history.replaceState({}, '', url);

        if (onSiteChanged) {
            onSiteChanged(siteWithName);
        }

        return siteWithName;
    },

    // ==================== DEVICE INFO HEADER ====================

    /**
     * Update device info card header with current device details.
     * Uses `data-device-info` attribute to locate the card in the DOM.
     *
     * @param {Object} device - The device object with name, model, ip properties
     */
    updateDeviceInfo(device) {
        if (!device) return;

        const deviceInfoCard = document.querySelector('[data-device-info]');
        if (!deviceInfoCard) return;

        const deviceNameEl = deviceInfoCard.querySelector('[data-device-name]');
        if (deviceNameEl) {
            deviceNameEl.textContent = device.name;
        }

        const modelEl = deviceInfoCard.querySelector('[data-device-model]');
        if (modelEl && device.model) {
            modelEl.textContent = device.model;
        }

        const ipEl = deviceInfoCard.querySelector('[data-device-ip]');
        if (ipEl && device.ip) {
            ipEl.textContent = device.ip;
        }

        const serialEl = deviceInfoCard.querySelector('[data-device-serial]');
        if (serialEl && device.serial) {
            serialEl.textContent = device.serial;
        }

        const firmwareEl = deviceInfoCard.querySelector('[data-device-firmware]');
        if (firmwareEl && device.firmware) {
            firmwareEl.textContent = device.firmware;
        }

        const portalEl = deviceInfoCard.querySelector('[data-device-portal]');
        if (portalEl && device.vendor_portal) {
            portalEl.href = device.vendor_portal;
        }

        // Update border color and status badge based on device status
        if (device.status) {
            const style = this.STATUS_STYLES[device.status] || this.STATUS_STYLES.online;

            // Swap border color class on the card
            deviceInfoCard.classList.remove('border-green-500', 'border-amber-500', 'border-red-500', 'border-newrelic-success');
            deviceInfoCard.classList.add(style.border);

            // Update the status badge
            const badgeEl = deviceInfoCard.querySelector('[data-device-status]');
            if (badgeEl) {
                badgeEl.className = style.badge;
                badgeEl.textContent = style.label;
            }
        }
    },

    // ==================== DEVICE ALERT FEED ====================

    /**
     * Render the device-specific alert feed table.
     *
     * @param {string} deviceId - The device ID to fetch alerts for
     * @param {Object} [options] - Optional configuration
     * @param {string} [options.tableBodyId='deviceAlertTableBody'] - ID of the tbody element
     * @param {string} [options.alertCountId='deviceAlertCount'] - ID of the alert count badge element
     */
    updateDeviceAlertFeed(deviceId, options) {
        const opts = Object.assign({
            tableBodyId: 'deviceAlertTableBody',
            alertCountId: 'deviceAlertCount'
        }, options);

        const tableBody = document.getElementById(opts.tableBodyId);
        const alertCount = document.getElementById(opts.alertCountId);
        if (!tableBody) return;

        const alerts = DataLoader.getAlertsByDeviceId(deviceId);

        // Update alert count badge
        if (alertCount) {
            alertCount.textContent = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;
            if (alerts.some(a => a.severity === 'crit')) {
                alertCount.className = 'ml-2 px-2 py-0.5 rounded text-xs font-normal bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            } else if (alerts.some(a => a.severity === 'warn')) {
                alertCount.className = 'ml-2 px-2 py-0.5 rounded text-xs font-normal bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            } else {
                alertCount.className = 'ml-2 px-2 py-0.5 rounded text-xs font-normal bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
            }
        }

        tableBody.innerHTML = '';

        if (alerts.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="4" class="px-6 py-4 text-center text-sm text-gray-400">No alerts for this device.</td>';
            tableBody.appendChild(row);
            return;
        }

        alerts.forEach(alert => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="${this.SEV_STYLES[alert.severity]} flex items-center gap-1 w-fit">
                        ${this.SEV_ICONS[alert.severity]} ${alert.severity.toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-xs text-dark-muted">${alert.timeAgo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-xs text-dark-muted capitalize">${alert.type}</td>
                <td class="px-6 py-4 text-sm text-dark-text">${alert.message}</td>
            `;
            tableBody.appendChild(row);
        });
    },

    /**
     * Render the site-specific alert feed table.
     *
     * @param {string} siteName - The site to fetch alerts for
     * @param {Object} [options] - Optional configuration
     * @param {string} [options.tableBodyId='siteAlertTableBody'] - ID of the tbody element
     * @param {string} [options.alertCountId='siteAlertCount'] - ID of the alert count badge element
     */
    updateSiteAlertFeed(siteName, options) {
        const opts = Object.assign({
            tableBodyId: 'siteAlertTableBody',
            alertCountId: 'siteAlertCount'
        }, options);

        const tableBody = document.getElementById(opts.tableBodyId);
        const alertCount = document.getElementById(opts.alertCountId);
        if (!tableBody) return;

        const alerts = DataLoader.getAlertsBySite(siteName);

        if (alertCount) {
            alertCount.textContent = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;
            if (alerts.some(a => a.severity === 'crit')) {
                alertCount.className = 'ml-2 px-2 py-0.5 rounded text-xs font-normal bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            } else if (alerts.some(a => a.severity === 'warn')) {
                alertCount.className = 'ml-2 px-2 py-0.5 rounded text-xs font-normal bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            } else {
                alertCount.className = 'ml-2 px-2 py-0.5 rounded text-xs font-normal bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
            }
        }

        tableBody.innerHTML = '';

        if (alerts.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="5" class="px-6 py-4 text-center text-sm text-gray-400">No alerts for this site.</td>';
            tableBody.appendChild(row);
            return;
        }

        alerts.forEach(alert => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="${this.SEV_STYLES[alert.severity]} flex items-center gap-1 w-fit">
                        ${this.SEV_ICONS[alert.severity]} ${alert.severity.toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-xs text-dark-muted">${alert.timeAgo}</td>
                <td class="px-6 py-4 whitespace-nowrap text-xs text-dark-muted">${this.escapeHtml(alert.device)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-xs text-dark-muted capitalize">${alert.type}</td>
                <td class="px-6 py-4 text-sm text-dark-text">${this.escapeHtml(alert.message)}</td>
            `;
            tableBody.appendChild(row);
        });
    },

    // ==================== TAB SWITCHING ====================

    /**
     * Switch between tabs in a tabbed interface.
     *
     * @param {string} tabName - The tab identifier (e.g., 'overview', 'performance')
     * @param {Object} [options] - Tab styling options
     * @param {string} [options.activeClasses='border-newrelic-cyan text-newrelic-cyan'] - Classes for the active tab
     * @param {string} [options.inactiveClasses='border-transparent text-dark-muted'] - Classes for inactive tabs
     */
    switchTab(tabName, options) {
        const opts = Object.assign({
            activeClasses: 'border-newrelic-cyan text-newrelic-cyan',
            inactiveClasses: 'border-transparent text-dark-muted'
        }, options);

        const activeArr = opts.activeClasses.split(' ');
        const inactiveArr = opts.inactiveClasses.split(' ');

        // Hide all tab contents
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => content.classList.add('hidden'));

        // Reset all tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.remove(...activeArr);
            button.classList.add(...inactiveArr);
        });

        // Show selected tab content
        const contentEl = document.getElementById(`content-${tabName}`);
        if (contentEl) contentEl.classList.remove('hidden');

        // Activate selected tab button
        const selectedButton = document.getElementById(`tab-${tabName}`);
        if (selectedButton) {
            selectedButton.classList.remove(...inactiveArr);
            selectedButton.classList.add(...activeArr);
        }
    },

    /**
     * Initialize click listeners on all [data-tab] buttons.
     * Uses event delegation - call once after DOM is ready.
     *
     * @param {function(string): void} onTabSwitch - Called with tab name when a tab is clicked
     */
    initTabListeners(onTabSwitch) {
        document.querySelectorAll('[data-tab]').forEach(button => {
            button.addEventListener('click', () => {
                const tabName = button.getAttribute('data-tab');
                if (tabName && onTabSwitch) {
                    onTabSwitch(tabName);
                }
            });
        });
    },

    // ==================== UTILITIES ====================

    /**
     * Create a debounced version of a function.
     * The function will only execute after `delay` ms of no calls.
     *
     * @param {Function} fn - The function to debounce
     * @param {number} [delay=300] - Debounce delay in milliseconds
     * @returns {Function} The debounced function
     */
    debounce(fn, delay) {
        let timer;
        return function(...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    },

    /**
     * Safely escape HTML entities to prevent XSS when rendering user-facing data.
     *
     * @param {string} str - The string to escape
     * @returns {string} The escaped string
     */
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }
};

// Make available globally
window.SharedUI = SharedUI;
