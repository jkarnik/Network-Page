        // Initialize navigation for AP page
        NavigationManager.init('ap');

        // --- ACCESS POINT SELECTOR ---
        function updateAccessPointView(apName) {
            console.log('Access point view changed to:', apName);
            // Update the device info card header
            document.querySelector('h2.text-lg.font-bold').textContent = apName;

            // In a real application, this would reload the data for the selected access point
            // For now, it just logs the change
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
            // Generate random percentages with mean 95% and std dev 2% (using Box-Muller transform)
            function generateRandomPercentage(mean = 95, stdDev = 2) {
                // Box-Muller transform for normal distribution
                const u1 = Math.random();
                const u2 = Math.random();
                const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                const value = mean + z0 * stdDev;
                // Cap at 100%
                return Math.min(100, value);
            }

            // Generate percentages for each stage
            const funnelData = {
                association: generateRandomPercentage(), // Random ~95%
                authentication: generateRandomPercentage(), // Random ~95%
                dhcp: generateRandomPercentage(), // Random ~95%
                dns: generateRandomPercentage(), // Random ~95%
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

            // Sample time series data - in a real app, this would come from an API
            const timeLabels = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', 'Now'];

            // Helper function to generate random percentage with normal distribution
            function generateRandomPercentageTS(mean = 95, stdDev = 2) {
                const u1 = Math.random();
                const u2 = Math.random();
                const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                const value = mean + z0 * stdDev;
                return Math.min(100, value);
            }

            // Generate random percentages for time series (mean 95%, std dev 2%)
            const percentageData = {
                association: timeLabels.map(() => parseFloat(generateRandomPercentageTS().toFixed(2))),
                authentication: timeLabels.map(() => parseFloat(generateRandomPercentageTS().toFixed(2))),
                dhcp: timeLabels.map(() => parseFloat(generateRandomPercentageTS().toFixed(2))),
                dns: timeLabels.map(() => parseFloat(generateRandomPercentageTS().toFixed(2))),
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

