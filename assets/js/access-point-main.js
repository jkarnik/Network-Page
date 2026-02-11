        // Initialize navigation for AP page
        NavigationManager.init('ap');

        // --- DEVICE MANAGEMENT ---
        let currentDevice = null;
        let currentDeviceData = null;

        /**
         * Initialize the device selector dropdown via SharedUI
         */
        async function initDeviceSelector() {
            const device = await SharedUI.initDeviceSelector('accessPoints', {
                onDeviceSelected: async (device) => {
                    currentDevice = device;
                    await loadDeviceData(device.id);
                },
                onDeviceChanged: (deviceId) => updateAccessPointView(deviceId)
            });
            if (device) currentDevice = device;
        }

        /**
         * Handle access point selection change via SharedUI
         */
        async function updateAccessPointView(deviceId) {
            SharedUI.changeDevice(deviceId, async (dev) => {
                currentDevice = dev;
                await loadDeviceData(dev.id);
            });
        }

        /**
         * Load device data and update all charts
         */
        async function loadDeviceData(deviceId) {
            currentDeviceData = await DataLoader.getDeviceData(deviceId, 'accesspoint');

            // Reset all VLAN filters on device change
            ['funnelVlanFilter', 'clientCountVlanFilter', 'ssidVlanFilter', 'channelVlanFilter', 'snrVlanFilter'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            SharedUI.updateDeviceInfo(currentDevice);

            if (charts.associationGauge && currentDeviceData) {
                updateChartsWithDeviceData();
            }

            SharedUI.updateDeviceAlertFeed(deviceId);
        }

        // --- TAB SWITCHING LOGIC ---
        function switchTab(tabName) {
            SharedUI.switchTab(tabName);
        }

        // --- CHART INITIALIZATION ---
        const charts = {};

        function initCharts() {
            ChartConfig.initDefaults();
            DiagnosticsManager.init('ap', 'diagnostics-container')

            // Unregister datalabels plugin globally (we'll enable it per chart)
            Chart.unregister(ChartDataLabels);

            // 1. Client Journey Funnel - Dial Gauges (placeholder data, updated by loadDeviceData)
            const funnelData = { association: 0, authentication: 0, dhcp: 0, dns: 0, success: 0 };

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

            // 2. Active Client Count - Time Series (placeholder, updated by loadDeviceData)
            const placeholderLabels = [''];
            const placeholderData = [0];
            const clientSliced = { labels: placeholderLabels, datasets: [placeholderData, placeholderData, placeholderData, placeholderData, placeholderData] };

            charts.clientCount = new Chart(document.getElementById('clientCountTimeSeries'), {
                type: 'line',
                data: {
                    labels: clientSliced.labels,
                    datasets: [
                        {
                            label: 'Total',
                            data: clientSliced.datasets[0],
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
                            data: clientSliced.datasets[1],
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
                            data: clientSliced.datasets[2],
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
                            data: clientSliced.datasets[3],
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
                            data: clientSliced.datasets[4],
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

            // 3. Channel Utilization (placeholder, updated by loadDeviceData)
            charts.channel = new Chart(document.getElementById('channelUtilChart'), {
                type: 'bar',
                data: {
                    labels: ['2.4 GHz', '5 GHz', '6 GHz'],
                    datasets: [
                        { label: 'WiFi Traffic', data: [0, 0, 0], backgroundColor: '#3b82f6' },
                        { label: 'Interference', data: [0, 0, 0], backgroundColor: '#f87171' },
                        { label: 'Free Airtime', data: [100, 100, 100], backgroundColor: '#e5e7eb' }
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

            // 4. SNR Distribution (placeholder, updated by loadDeviceData)
            charts.snr = new Chart(document.getElementById('snrChart'), {
                type: 'bar',
                data: {
                    labels: ['Poor (<15dB)', 'Fair (15-25dB)', 'Good (25-35dB)', 'Excellent (>35dB)'],
                    datasets: [{
                        label: 'Client Count',
                        data: [0, 0, 0, 0],
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

             // 5. Top SSIDs (placeholder, updated by loadDeviceData)
             charts.ssids = new Chart(document.getElementById('ssidChart'), {
                type: 'bar',
                data: {
                    labels: ['', '', '', ''],
                    datasets: [{
                        label: 'Clients',
                        data: [0, 0, 0, 0],
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

        // Bind tab button click listeners (replaces inline onclick)
        SharedUI.initTabListeners(switchTab);

        // Register charts for theme switching
        themeManager.registerCharts(charts);

        // Initial theme check
        if (themeManager.isDarkMode()) {
            themeManager.updateChartColors();
        }

        /**
         * Get the active VLAN filter value from a specific filter dropdown.
         */
        function getVlanFilter(filterId) {
            const el = document.getElementById(filterId);
            return el ? el.value : '';
        }

        /**
         * Handle VLAN filter change — update the specific widget that changed.
         */
        function filterApVlan() {
            if (!currentDeviceData) return;
            updateChartsWithDeviceData();
        }

        /**
         * Render the SSID-to-VLAN mapping table from device data.
         */
        function renderSsidVlanMapping() {
            const tbody = document.getElementById('ssidVlanMappingBody');
            const countEl = document.getElementById('ssidVlanMappingCount');
            if (!tbody) return;

            const mapping = currentDeviceData && currentDeviceData.ssidVlanMapping;
            if (!mapping || !mapping.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-dark-muted text-sm">No SSID mappings available</td></tr>';
                if (countEl) countEl.textContent = '0 SSIDs';
                return;
            }

            if (countEl) countEl.textContent = mapping.length + ' SSID' + (mapping.length !== 1 ? 's' : '');

            tbody.innerHTML = mapping.map(m => {
                const statusClass = m.status === 'Active'
                    ? 'bg-newrelic-success/20 text-newrelic-success'
                    : 'bg-newrelic-error/20 text-newrelic-error';
                return `<tr class="hover:bg-newrelic-cyan/10 transition-colors">
                    <td class="px-6 py-2.5 font-bold text-dark-text">${m.ssid}</td>
                    <td class="px-6 py-2.5 text-dark-text">${m.vlan}</td>
                    <td class="px-6 py-2.5 text-dark-muted">${m.vlanId}</td>
                    <td class="px-6 py-2.5"><span class="text-xs bg-newrelic-info/20 text-newrelic-info px-2 py-0.5 rounded font-medium">${m.security}</span></td>
                    <td class="px-6 py-2.5 text-dark-muted">${m.band}</td>
                    <td class="px-6 py-2.5 text-right text-dark-text font-bold">${m.clients}</td>
                    <td class="px-6 py-2.5"><span class="text-xs ${statusClass} px-2 py-0.5 rounded font-medium">${m.status}</span></td>
                </tr>`;
            }).join('');
        }

        /**
         * Update all charts with data from DataLoader
         */
        function updateChartsWithDeviceData() {
            if (!currentDeviceData) return;

            // Update Funnel Gauges (respecting VLAN filter)
            if (currentDeviceData.funnelData) {
                const funnelVlan = getVlanFilter('funnelVlanFilter');
                let fd;
                if (funnelVlan && currentDeviceData.funnelDataByVlan && currentDeviceData.funnelDataByVlan[funnelVlan]) {
                    fd = currentDeviceData.funnelDataByVlan[funnelVlan];
                } else {
                    fd = currentDeviceData.funnelData;
                }
                const success = (fd.association / 100) * (fd.authentication / 100) * (fd.dhcp / 100) * (fd.dns / 100) * 100;

                if (charts.associationGauge) {
                    charts.associationGauge.data.datasets[0].data = [fd.association, 100 - fd.association];
                    charts.associationGauge.update();
                    document.getElementById('associationValue').textContent = fd.association.toFixed(1);
                }
                if (charts.authenticationGauge) {
                    charts.authenticationGauge.data.datasets[0].data = [fd.authentication, 100 - fd.authentication];
                    charts.authenticationGauge.update();
                    document.getElementById('authenticationValue').textContent = fd.authentication.toFixed(1);
                }
                if (charts.dhcpFunnelGauge) {
                    charts.dhcpFunnelGauge.data.datasets[0].data = [fd.dhcp, 100 - fd.dhcp];
                    charts.dhcpFunnelGauge.update();
                    document.getElementById('dhcpFunnelValue').textContent = fd.dhcp.toFixed(1);
                }
                if (charts.dnsGauge) {
                    charts.dnsGauge.data.datasets[0].data = [fd.dns, 100 - fd.dns];
                    charts.dnsGauge.update();
                    document.getElementById('dnsValue').textContent = fd.dns.toFixed(1);
                }
                if (charts.successGauge) {
                    charts.successGauge.data.datasets[0].data = [success, 100 - success];
                    charts.successGauge.update();
                    document.getElementById('successValue').textContent = success.toFixed(1);
                }
            }

            // Update Client Count chart (respecting VLAN filter)
            if (charts.clientCount && currentDeviceData.clientCount) {
                const ccVlan = getVlanFilter('clientCountVlanFilter');
                let cc;
                if (ccVlan && currentDeviceData.clientCountByVlan && currentDeviceData.clientCountByVlan[ccVlan]) {
                    cc = currentDeviceData.clientCountByVlan[ccVlan];
                } else {
                    cc = currentDeviceData.clientCount;
                }
                const totalData = cc.labels.map((_, idx) =>
                    (cc.wired[idx] || 0) + (cc.wifi24[idx] || 0) + (cc.wifi5[idx] || 0) + (cc.wifi6[idx] || 0)
                );
                const sliced = TimelineManager.sliceData(cc.labels, totalData, cc.wired, cc.wifi24, cc.wifi5, cc.wifi6);
                charts.clientCount.data.labels = sliced.labels;
                charts.clientCount.data.datasets[0].data = sliced.datasets[0];
                charts.clientCount.data.datasets[1].data = sliced.datasets[1];
                charts.clientCount.data.datasets[2].data = sliced.datasets[2];
                charts.clientCount.data.datasets[3].data = sliced.datasets[3];
                charts.clientCount.data.datasets[4].data = sliced.datasets[4];
                charts.clientCount.update();
            }

            // Update Channel Utilization (respecting VLAN filter)
            if (charts.channel && currentDeviceData.channelUtilization) {
                const chVlan = getVlanFilter('channelVlanFilter');
                let cu;
                if (chVlan && currentDeviceData.channelUtilizationByVlan && currentDeviceData.channelUtilizationByVlan[chVlan]) {
                    cu = currentDeviceData.channelUtilizationByVlan[chVlan];
                } else {
                    cu = currentDeviceData.channelUtilization;
                }
                charts.channel.data.labels = cu.labels;
                charts.channel.data.datasets[0].data = cu.wifi;
                charts.channel.data.datasets[1].data = cu.interference;
                charts.channel.data.datasets[2].data = cu.free;
                charts.channel.update();
            }

            // Update SNR Distribution (respecting VLAN filter)
            if (charts.snr && currentDeviceData.snrDistribution) {
                const snrVlan = getVlanFilter('snrVlanFilter');
                let snr;
                if (snrVlan && currentDeviceData.snrDistributionByVlan && currentDeviceData.snrDistributionByVlan[snrVlan]) {
                    snr = currentDeviceData.snrDistributionByVlan[snrVlan];
                } else {
                    snr = currentDeviceData.snrDistribution;
                }
                charts.snr.data.labels = snr.labels;
                charts.snr.data.datasets[0].data = snr.data;
                charts.snr.data.datasets[0].backgroundColor = snr.colors;
                charts.snr.update();
            }

            // Update Top SSIDs (respecting VLAN filter)
            if (charts.ssids && currentDeviceData.topSSIDs) {
                const ssidVlan = getVlanFilter('ssidVlanFilter');
                let ssids;
                if (ssidVlan && currentDeviceData.topSSIDsByVlan && currentDeviceData.topSSIDsByVlan[ssidVlan]) {
                    ssids = currentDeviceData.topSSIDsByVlan[ssidVlan];
                } else {
                    ssids = currentDeviceData.topSSIDs;
                }
                charts.ssids.data.labels = ssids.labels;
                charts.ssids.data.datasets[0].data = ssids.data;
                charts.ssids.update();
            }

            // Render SSID-to-VLAN mapping table
            renderSsidVlanMapping();
        }

        // Re-render charts when timeline range changes
        TimelineManager.onChange(() => { if (currentDeviceData) updateChartsWithDeviceData(); });

        // --- FUNNEL TIME SERIES OVERLAY ---
        let funnelTimeSeriesChart = null;

        function openFunnelTimeSeries() {
            const overlay = document.getElementById('funnelTimeSeriesOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (funnelTimeSeriesChart) {
                funnelTimeSeriesChart.destroy();
            }

            // Use funnel time series data from DataLoader
            const fts = currentDeviceData && currentDeviceData.funnelTimeSeries;
            if (!fts) return;

            // Calculate success as product of all stages
            const baseSuccessData = fts.labels.map((_, idx) => {
                const product = (fts.association[idx] / 100) *
                               (fts.authentication[idx] / 100) *
                               (fts.dhcp[idx] / 100) *
                               (fts.dns[idx] / 100) * 100;
                return parseFloat(product.toFixed(2));
            });

            // Slice according to timeline
            const fSliced = TimelineManager.sliceData(fts.labels,
                fts.association, fts.authentication,
                fts.dhcp, fts.dns, baseSuccessData);

            const percentageData = {
                association: fSliced.datasets[0],
                authentication: fSliced.datasets[1],
                dhcp: fSliced.datasets[2],
                dns: fSliced.datasets[3],
                success: fSliced.datasets[4]
            };

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
            const yAxisMin = Math.max(0, minValue - 5);

            // Create time series chart
            funnelTimeSeriesChart = new Chart(document.getElementById('funnelTimeSeriesChart'), {
                type: 'line',
                data: {
                    labels: fSliced.labels,
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

            // Use client details data from DataLoader
            const timeLabels = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
            const clientDetails = currentDeviceData && currentDeviceData.clientDetails;
            const fallbackData = { upload: [0], download: [0], packetLoss: [0], snr: [0] };
            const data = (clientDetails && clientDetails[clientMAC]) || fallbackData;

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

            // Use channel utilization trends data from DataLoader
            const cut = currentDeviceData && currentDeviceData.channelUtilTrends;
            if (!cut) return;

            const timeLabels = cut.labels;
            const band24Data = cut.band24;
            const band5Data = cut.band5;
            const band6Data = cut.band6;

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
        window.filterApVlan = filterApVlan;

