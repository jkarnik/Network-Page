        // Initialize navigation for AP page
        NavigationManager.init('ap');

        // --- DEVICE MANAGEMENT ---
        let currentDevice = null;
        let currentDeviceData = null;

        /**
         * Initialize the device selector dropdown
         */
        async function initDeviceSelector() {
            try {
                console.log('AP initDeviceSelector: Starting...');
                await DataLoader.load();
                console.log('AP initDeviceSelector: DataLoader loaded');
                const accessPoints = DataLoader.getDevices('accessPoints');
                console.log('AP initDeviceSelector: Found', accessPoints.length, 'access points');
                const selector = document.getElementById('deviceSelector');

                if (!selector) {
                    console.warn('Device selector element not found');
                    return;
                }
                if (accessPoints.length === 0) {
                    console.warn('No access points found in data');
                    return;
                }

                // Group access points by site
                const siteGroups = {};
                accessPoints.forEach(ap => {
                    if (!siteGroups[ap.site]) {
                        siteGroups[ap.site] = [];
                    }
                    siteGroups[ap.site].push(ap);
                });

                // Build the dropdown options
                let optionsHtml = '';
                Object.keys(siteGroups).sort().forEach(site => {
                    optionsHtml += `<optgroup label="${site}">`;
                    siteGroups[site].forEach(ap => {
                        optionsHtml += `<option value="${ap.id}">${ap.name}</option>`;
                    });
                    optionsHtml += '</optgroup>';
                });

                selector.innerHTML = optionsHtml;
                console.log('AP initDeviceSelector: Populated dropdown with', accessPoints.length, 'options');

                // Check for URL parameter to pre-select device
                const urlParams = new URLSearchParams(window.location.search);
                const deviceParam = urlParams.get('device');

                if (deviceParam) {
                    // Try to find the device by ID or name
                    const device = accessPoints.find(ap => ap.id === deviceParam || ap.name === deviceParam);
                    if (device) {
                        selector.value = device.id;
                        currentDevice = device;
                    }
                }

                // If no device selected, use the first one
                if (!currentDevice && accessPoints.length > 0) {
                    currentDevice = accessPoints[0];
                    selector.value = currentDevice.id;
                }

                // Update display
                if (currentDevice) {
                    updateDeviceInfo();
                    updateDeviceAlertFeed(currentDevice.id);
                }
            } catch (error) {
                console.error('AP initDeviceSelector failed:', error);
            }
        }

        /**
         * Handle access point selection change
         */
        async function updateAccessPointView(deviceId) {
            const device = DataLoader.getDeviceById(deviceId);
            if (!device) {
                console.warn('Device not found:', deviceId);
                return;
            }

            currentDevice = device;

            // Update URL without reloading
            const url = new URL(window.location);
            url.searchParams.set('device', deviceId);
            window.history.replaceState({}, '', url);

            // Update device info header
            updateDeviceInfo();

            // Update device alert feed
            updateDeviceAlertFeed(deviceId);
        }

        /**
         * Update the device info header
         */
        function updateDeviceInfo() {
            if (!currentDevice) return;

            // Update device name in the device info card
            const deviceInfoCard = document.querySelector('.border-l-4.border-newrelic-success');
            if (deviceInfoCard) {
                const deviceNameEl = deviceInfoCard.querySelector('h2.text-lg.font-bold');
                if (deviceNameEl) {
                    deviceNameEl.textContent = currentDevice.name;
                }

                // Update model text
                const modelEl = deviceInfoCard.querySelector('p.text-xs.text-dark-muted');
                if (modelEl && currentDevice.model) {
                    modelEl.textContent = currentDevice.model;
                }

                // Update IP address
                const ipSpans = deviceInfoCard.querySelectorAll('.font-mono');
                if (ipSpans[0] && currentDevice.ip) {
                    ipSpans[0].textContent = currentDevice.ip;
                }
            }
        }

        /**
         * Update the device alert feed with alerts for the current device
         */
        function updateDeviceAlertFeed(deviceId) {
            const tableBody = document.getElementById('deviceAlertTableBody');
            const alertCount = document.getElementById('deviceAlertCount');
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

            // Severity styles and icons
            const sevStyles = {
                crit: 'px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                warn: 'px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                info: 'px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
            };
            const sevIcons = {
                crit: '<i class="fa-solid fa-circle-exclamation"></i>',
                warn: '<i class="fa-solid fa-triangle-exclamation"></i>',
                info: '<i class="fa-solid fa-circle-info"></i>'
            };

            tableBody.innerHTML = '';

            if (alerts.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="4" class="px-6 py-4 text-center text-sm text-gray-400">No alerts for this device.</td>`;
                tableBody.appendChild(row);
                return;
            }

            alerts.forEach(alert => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="${sevStyles[alert.severity]} flex items-center gap-1 w-fit">
                            ${sevIcons[alert.severity]} ${alert.severity.toUpperCase()}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-xs text-dark-muted">${alert.timeAgo}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-xs text-dark-muted capitalize">${alert.type}</td>
                    <td class="px-6 py-4 text-sm text-dark-text">${alert.message}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        // --- TAB SWITCHING LOGIC ---
        function switchTab(tabName) {
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.add('hidden'));

            const tabButtons = document.querySelectorAll('.tab-button');
            tabButtons.forEach(button => {
                button.classList.remove('border-newrelic-cyan', 'text-newrelic-cyan');
                button.classList.add('border-transparent', 'text-dark-muted');
            });

            document.getElementById(`content-${tabName}`).classList.remove('hidden');
            const selectedButton = document.getElementById(`tab-${tabName}`);
            selectedButton.classList.remove('border-transparent', 'text-dark-muted');
            selectedButton.classList.add('border-newrelic-cyan', 'text-newrelic-cyan');
        }

        // --- CHART INITIALIZATION ---
        const charts = {};

        function initCharts() {
            ChartConfig.initDefaults();
            DiagnosticsManager.init('ap', 'diagnostics-container')

            // Unregister datalabels plugin globally (we'll enable it per chart)
            Chart.unregister(ChartDataLabels);

            // 1. Client Journey Funnel - Dial Gauges
            // Hardcoded percentages for each stage
            const funnelData = {
                association: 96.2,
                authentication: 94.8,
                dhcp: 95.5,
                dns: 97.1,
                success: 0 // Will be calculated as product
            };

            // Success is the product of all stages
            funnelData.success = (funnelData.association / 100) *
                                  (funnelData.authentication / 100) *
                                  (funnelData.dhcp / 100) *
                                  (funnelData.dns / 100) * 100;

            // Helper function to create gauge chart (full circle like DHCP Capacity)
            function createGauge(canvasId, value, color) {
                return new Chart(document.getElementById(canvasId), {
                    type: 'doughnut',
                    data: {
                        datasets: [{
                            data: [value, 100 - value],
                            backgroundColor: [color, '#2A3036'],
                            borderWidth: 0,
                            cutout: '75%'
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
            }

            // Association Gauge - New Relic Cyan
            charts.associationGauge = createGauge('associationGauge', funnelData.association, '#00CED1');
            document.getElementById('associationValue').textContent = funnelData.association.toFixed(1);

            // Authentication Gauge - New Relic Teal
            charts.authenticationGauge = createGauge('authenticationGauge', funnelData.authentication, '#008C99');
            document.getElementById('authenticationValue').textContent = funnelData.authentication.toFixed(1);

            // DHCP Gauge - New Relic Warning
            charts.dhcpFunnelGauge = createGauge('dhcpFunnelGauge', funnelData.dhcp, '#F5A623');
            document.getElementById('dhcpFunnelValue').textContent = funnelData.dhcp.toFixed(1);

            // DNS Gauge - New Relic Info
            charts.dnsGauge = createGauge('dnsGauge', funnelData.dns, '#0B7EBF');
            document.getElementById('dnsValue').textContent = funnelData.dns.toFixed(1);

            // Success Gauge - New Relic Success (product of all stages)
            charts.successGauge = createGauge('successGauge', funnelData.success, '#11A768');
            document.getElementById('successValue').textContent = funnelData.success.toFixed(1);

            // 2. Active Client Count - Time Series
            const timeLabels = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', 'Now'];

            // Generate realistic data for each client type
            const wiredData = [12, 12, 12, 13, 14, 15, 15, 15, 15, 14, 14, 13, 13];
            const wifi24Data = [3, 2, 2, 4, 6, 8, 10, 11, 10, 8, 6, 4, 5];
            const wifi5Data = [5, 4, 3, 6, 8, 12, 15, 16, 15, 13, 10, 8, 9];
            const wifi6Data = [2, 1, 1, 2, 3, 5, 7, 8, 8, 6, 5, 4, 5];

            // Calculate total for each time point
            const totalData = timeLabels.map((_, idx) =>
                wiredData[idx] + wifi24Data[idx] + wifi5Data[idx] + wifi6Data[idx]
            );

            charts.clientCount = new Chart(document.getElementById('clientCountTimeSeries'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Total',
                            data: totalData,
                            borderColor: '#F5A623',
                            backgroundColor: 'rgba(245, 166, 35, 0)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            pointHoverBackgroundColor: '#F5A623',
                            pointHoverBorderColor: '#fff',
                            pointHoverBorderWidth: 2,
                            borderWidth: 3,
                            borderDash: [5, 5]
                        },
                        {
                            label: 'Wired',
                            data: wiredData,
                            borderColor: '#6b7280',
                            backgroundColor: 'rgba(107, 114, 128, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#6b7280',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            borderWidth: 2
                        },
                        {
                            label: '2.4GHz',
                            data: wifi24Data,
                            borderColor: '#0B7EBF',
                            backgroundColor: 'rgba(11, 126, 191, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#0B7EBF',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            borderWidth: 2
                        },
                        {
                            label: '5GHz',
                            data: wifi5Data,
                            borderColor: '#11A768',
                            backgroundColor: 'rgba(17, 167, 104, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#11A768',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            borderWidth: 2
                        },
                        {
                            label: '6GHz',
                            data: wifi6Data,
                            borderColor: '#00CED1',
                            backgroundColor: 'rgba(0, 206, 209, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 3,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#00CED1',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            borderWidth: 2
                        }
                    ]
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
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += context.parsed.y + ' clients';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: false },
                            ticks: {
                                font: { size: 10 },
                                maxRotation: 0,
                                autoSkipPadding: 15
                            }
                        },
                        y: {
                            display: true,
                            beginAtZero: true,
                            ticks: {
                                font: { size: 10 },
                                stepSize: 5,
                                callback: function(value) {
                                    return value;
                                }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });

            // 3. Channel Utilization [cite: 157]
            // Stacked Bar for 2.4/5/6 GHz
            charts.channel = new Chart(document.getElementById('channelUtilChart'), {
                type: 'bar',
                data: {
                    labels: ['2.4 GHz', '5 GHz', '6 GHz'],
                    datasets: [
                        { label: 'WiFi Traffic', data: [45, 20, 5], backgroundColor: '#3b82f6' },
                        { label: 'Interference', data: [15, 5, 0], backgroundColor: '#f87171' },
                        { label: 'Free Airtime', data: [40, 75, 95], backgroundColor: '#e5e7eb' }
                    ]
                },
                options: {
                    scales: {
                        x: { stacked: true, grid: { display: false } },
                        y: { stacked: true, max: 100, ticks: { callback: v => v + '%' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });

            // 4. SNR Distribution
            charts.snr = new Chart(document.getElementById('snrChart'), {
                type: 'bar',
                data: {
                    labels: ['Poor (<15dB)', 'Fair (15-25dB)', 'Good (25-35dB)', 'Excellent (>35dB)'],
                    datasets: [{
                        label: 'Client Count',
                        data: [2, 5, 18, 17],
                        backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'],
                        borderRadius: 4
                    }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true },
                        x: { grid: { display: false } }
                    }
                }
            });

             // 5. Top SSIDs
             charts.ssids = new Chart(document.getElementById('ssidChart'), {
                type: 'bar',
                data: {
                    labels: ['Corp-Secure', 'Guest-WiFi', 'IoT-Devices', 'Legacy-App'],
                    datasets: [{
                        label: 'Clients',
                        data: [28, 8, 4, 2],
                        backgroundColor: '#6366f1',
                        borderRadius: 4,
                        barThickness: 20
                    }]
                },
                options: {
                    indexAxis: 'y',
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
                            ticks: { font: { size: 10 } }
                        },
                        y: { grid: { display: false } }
                    }
                }
            });
        }

        // Initialize Everything
        initCharts();

        // Initialize device selector and load device data
        initDeviceSelector();

        // Register charts for theme switching
        themeManager.registerCharts(charts);

        // Initial theme check
        if (themeManager.isDarkMode()) {
            themeManager.updateChartColors();
        }

        // --- FUNNEL TIME SERIES OVERLAY ---
        let funnelTimeSeriesChart = null;

        function openFunnelTimeSeries() {
            const overlay = document.getElementById('funnelTimeSeriesOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (funnelTimeSeriesChart) {
                funnelTimeSeriesChart.destroy();
            }

            // Time series data - hardcoded to end at current gauge values
            const timeLabels = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', 'Now'];

            // Hardcoded percentages for time series - ends at gauge values (association: 96.2, authentication: 94.8, dhcp: 95.5, dns: 97.1)
            const percentageData = {
                association: [95.8, 95.5, 95.2, 95.0, 95.3, 95.8, 96.0, 96.3, 96.5, 96.4, 96.3, 96.1, 96.2],
                authentication: [94.2, 94.0, 93.8, 93.5, 93.8, 94.2, 94.5, 94.8, 95.0, 95.1, 95.0, 94.9, 94.8],
                dhcp: [95.0, 94.8, 94.5, 94.2, 94.5, 95.0, 95.2, 95.5, 95.8, 95.7, 95.6, 95.5, 95.5],
                dns: [96.8, 96.5, 96.2, 96.0, 96.3, 96.8, 97.0, 97.2, 97.4, 97.3, 97.2, 97.1, 97.1],
                success: [] // Will be calculated as product
            };

            // Calculate success as product of all stages
            percentageData.success = timeLabels.map((_, idx) => {
                const product = (percentageData.association[idx] / 100) *
                               (percentageData.authentication[idx] / 100) *
                               (percentageData.dhcp[idx] / 100) *
                               (percentageData.dns[idx] / 100) * 100;
                return parseFloat(product.toFixed(2));
            });

            // Generate corresponding raw client counts for tooltips
            const baseClients = 1200;
            const rawData = {
                association: percentageData.association.map(() => baseClients),
                authentication: percentageData.authentication.map((pct) => Math.round(baseClients * pct / 100)),
                dhcp: percentageData.dhcp.map((pct, idx) => Math.round(percentageData.authentication[idx] * baseClients / 100)),
                dns: percentageData.dns.map((pct, idx) => Math.round(percentageData.dhcp[idx] * percentageData.authentication[idx] * baseClients / 10000)),
                success: percentageData.success.map((pct) => Math.round(baseClients * pct / 100))
            };

            // Find the minimum value across all datasets
            const allValues = [
                ...percentageData.association,
                ...percentageData.authentication,
                ...percentageData.dhcp,
                ...percentageData.dns,
                ...percentageData.success
            ];
            const minValue = Math.min(...allValues);
            const yAxisMin = Math.max(0, minValue - 5); // 5% below the lowest value, but not below 0

            // Create time series chart
            funnelTimeSeriesChart = new Chart(document.getElementById('funnelTimeSeriesChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Association',
                            data: percentageData.association,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            rawData: rawData.association
                        },
                        {
                            label: 'Authentication',
                            data: percentageData.authentication,
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            rawData: rawData.authentication
                        },
                        {
                            label: 'DHCP',
                            data: percentageData.dhcp,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            rawData: rawData.dhcp
                        },
                        {
                            label: 'DNS',
                            data: percentageData.dns,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            rawData: rawData.dns
                        },
                        {
                            label: 'Success',
                            data: percentageData.success,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            borderWidth: 3,
                            rawData: rawData.success
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                boxWidth: 12,
                                font: { size: 12 },
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    const percentage = context.parsed.y;
                                    const absoluteValue = context.dataset.rawData[context.dataIndex];
                                    label += percentage + '% (' + absoluteValue + ' clients)';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
                            ticks: {
                                font: { size: 11 }
                            }
                        },
                        y: {
                            display: true,
                            beginAtZero: false,
                            min: yAxisMin,
                            max: 101,
                            ticks: {
                                font: { size: 11 },
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                },
                plugins: [ChartDataLabels] // Disable datalabels for this chart
            });

            // Disable datalabels plugin for this specific chart
            funnelTimeSeriesChart.options.plugins.datalabels = { display: false };
            funnelTimeSeriesChart.update();
        }

        function closeFunnelTimeSeries() {
            const overlay = document.getElementById('funnelTimeSeriesOverlay');
            overlay.classList.add('hidden');

            // Destroy chart to prevent memory leaks
            if (funnelTimeSeriesChart) {
                funnelTimeSeriesChart.destroy();
                funnelTimeSeriesChart = null;
            }
        }

        // --- CLIENT DETAILS OVERLAY ---
        let clientCharts = {};

        function openClientDetails(clientMAC, clientIP, clientOS, clientSSID) {
            const overlay = document.getElementById('clientDetailsOverlay');
            const title = document.getElementById('clientDetailsTitle');
            const info = document.getElementById('clientDetailsInfo');

            title.textContent = `Client Details: ${clientMAC}`;
            info.textContent = `${clientIP} • ${clientOS} • ${clientSSID}`;

            overlay.classList.remove('hidden');

            // Destroy existing charts if they exist
            Object.values(clientCharts).forEach(chart => {
                if (chart) chart.destroy();
            });
            clientCharts = {};

            // Sample data - in a real app, this would come from an API
            const timeLabels = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

            // Generate different data based on client MAC
            const clientData = {
                'a4:b1:c2:d3:e4:f5': {
                    upload: [8, 8.5, 9, 9.5, 10, 9.8, 9.2, 9, 8.8, 8.5, 8.3, 8.5],
                    download: [40, 42, 43, 45, 46, 44, 42, 43, 42.5, 42.3, 42, 42.3],
                    packetLoss: [0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0, 0],
                    snr: [42, 42, 41, 41, 40, 41, 42, 42, 42, 42, 42, 42]
                },
                'b2:c3:d4:e5:f6:a1': {
                    upload: [3, 3.2, 3.3, 3.5, 3.4, 3.3, 3.2, 3.3, 3.2, 3.2, 3.1, 3.2],
                    download: [18, 18.5, 18.7, 19, 19.2, 19, 18.8, 18.7, 18.7, 18.7, 18.5, 18.7],
                    packetLoss: [0.1, 0.1, 0, 0.2, 0.1, 0.1, 0.1, 0, 0.1, 0.1, 0.1, 0.1],
                    snr: [38, 38, 38, 37, 37, 38, 38, 38, 38, 38, 38, 38]
                },
                'c3:d4:e5:f6:a1:b2': {
                    upload: [1.5, 1.6, 1.8, 1.9, 1.8, 1.7, 1.8, 1.8, 1.8, 1.8, 1.7, 1.8],
                    download: [6, 6.2, 6.4, 6.5, 6.6, 6.5, 6.4, 6.4, 6.4, 6.4, 6.3, 6.4],
                    packetLoss: [0.8, 0.9, 0.8, 1.0, 0.9, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8],
                    snr: [18, 18, 18, 17, 17, 18, 18, 18, 18, 18, 18, 18]
                }
            };

            const data = clientData[clientMAC] || clientData['a4:b1:c2:d3:e4:f5'];

            // Create Bandwidth Chart
            clientCharts.bandwidth = new Chart(document.getElementById('clientBandwidthChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Upload',
                            data: data.upload,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            borderWidth: 2
                        },
                        {
                            label: 'Download',
                            data: data.download,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                boxWidth: 12,
                                font: { size: 12 },
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += context.parsed.y + ' Mbps';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
                            ticks: {
                                font: { size: 11 }
                            }
                        },
                        y: {
                            display: true,
                            beginAtZero: true,
                            ticks: {
                                font: { size: 11 },
                                callback: function(value) {
                                    return value + ' Mbps';
                                }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });

            // Disable datalabels for this chart
            clientCharts.bandwidth.options.plugins.datalabels = { display: false };
            clientCharts.bandwidth.update();

            // Create Performance Chart (Dual Axis: Packet Loss & SNR)
            clientCharts.performance = new Chart(document.getElementById('clientPerformanceChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Packet Loss',
                            data: data.packetLoss,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            borderWidth: 2,
                            yAxisID: 'y'
                        },
                        {
                            label: 'SNR',
                            data: data.snr,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            fill: false,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            borderWidth: 2,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                boxWidth: 12,
                                font: { size: 12 },
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#8b5cf6',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.dataset.yAxisID === 'y') {
                                        label += context.parsed.y + '%';
                                    } else {
                                        label += context.parsed.y + ' dB';
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
                            ticks: {
                                font: { size: 11 }
                            }
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Packet Loss (%)',
                                font: { size: 12 }
                            },
                            ticks: {
                                font: { size: 11 },
                                callback: function(value) {
                                    return value + '%';
                                }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: 'SNR (dB)',
                                font: { size: 12 }
                            },
                            ticks: {
                                font: { size: 11 },
                                callback: function(value) {
                                    return value + ' dB';
                                }
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    }
                }
            });

            // Disable datalabels for this chart
            clientCharts.performance.options.plugins.datalabels = { display: false };
            clientCharts.performance.update();
        }

        function closeClientDetails() {
            const overlay = document.getElementById('clientDetailsOverlay');
            overlay.classList.add('hidden');

            // Destroy charts to prevent memory leaks
            Object.values(clientCharts).forEach(chart => {
                if (chart) chart.destroy();
            });
            clientCharts = {};
        }

        // --- CHANNEL UTILIZATION TRENDS OVERLAY ---
        let channelUtilTrendsChart = null;

        function openChannelUtilTrends() {
            const overlay = document.getElementById('channelUtilTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (channelUtilTrendsChart) {
                channelUtilTrendsChart.destroy();
            }

            // Time labels for 24 hours
            const timeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

            // Hardcoded channel utilization data - ends at current bar chart values
            // Minimized shows: 2.4GHz [45, 15], 5GHz [20, 5], 6GHz [5, 0]
            const band24Data = {
                wifi: [32, 30, 28, 26, 28, 32, 38, 42, 48, 52, 55, 54, 52, 50, 51, 52, 50, 48, 46, 45, 44, 43, 44, 45],
                interference: [12, 11, 10, 9, 10, 12, 13, 14, 15, 16, 17, 17, 16, 15, 15, 16, 16, 15, 15, 15, 14, 14, 14, 15]
            };
            const band5Data = {
                wifi: [14, 13, 12, 11, 12, 14, 16, 18, 22, 25, 28, 27, 25, 23, 24, 25, 24, 22, 21, 20, 19, 19, 19, 20],
                interference: [4, 4, 3, 3, 3, 4, 4, 5, 5, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5]
            };
            const band6Data = {
                wifi: [3, 3, 2, 2, 2, 3, 4, 4, 5, 6, 7, 7, 6, 6, 6, 6, 6, 5, 5, 5, 5, 5, 5, 5],
                interference: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            };

            // Create the Channel Utilization trend chart
            channelUtilTrendsChart = new Chart(document.getElementById('channelUtilTrendsChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: '2.4 GHz WiFi',
                            data: band24Data.wifi,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#3b82f6',
                            pointHoverBackgroundColor: '#3b82f6',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: '2.4 GHz Interference',
                            data: band24Data.interference,
                            borderColor: '#f87171',
                            backgroundColor: 'rgba(248, 113, 113, 0.2)',
                            borderWidth: 2,
                            pointRadius: 2,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#f87171',
                            pointHoverBackgroundColor: '#f87171',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            borderDash: [5, 5]
                        },
                        {
                            label: '5 GHz WiFi',
                            data: band5Data.wifi,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#10b981',
                            pointHoverBackgroundColor: '#10b981',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: '5 GHz Interference',
                            data: band5Data.interference,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            borderWidth: 2,
                            pointRadius: 2,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#f59e0b',
                            pointHoverBackgroundColor: '#f59e0b',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            borderDash: [5, 5]
                        },
                        {
                            label: '6 GHz WiFi',
                            data: band6Data.wifi,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.2)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#8b5cf6',
                            pointHoverBackgroundColor: '#8b5cf6',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                boxWidth: 12,
                                font: { size: 12 },
                                padding: 15,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += context.parsed.y.toFixed(1) + '%';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: {
                                display: true,
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                autoSkipPadding: 10,
                                font: { size: 10 }
                            }
                        },
                        y: {
                            display: true,
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Channel Utilization (%)',
                                font: { size: 12 }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                },
                                font: { size: 10 }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        }
                    }
                }
            });
        }

        function closeChannelUtilTrends() {
            const overlay = document.getElementById('channelUtilTrendsOverlay');
            overlay.classList.add('hidden');

            // Destroy chart to prevent memory leaks
            if (channelUtilTrendsChart) {
                channelUtilTrendsChart.destroy();
                channelUtilTrendsChart = null;
            }
        }

        // Expose functions to global scope for onclick handlers
        window.updateAccessPointView = updateAccessPointView;
        window.openFunnelTimeSeries = openFunnelTimeSeries;
        window.closeFunnelTimeSeries = closeFunnelTimeSeries;
        window.openChannelUtilTrends = openChannelUtilTrends;
        window.closeChannelUtilTrends = closeChannelUtilTrends;

