        // Initialize navigation for SD-WAN page
        NavigationManager.init('sdwan');

        // --- DEVICE MANAGEMENT ---
        let currentDevice = null;
        let currentDeviceData = null;

        /**
         * Initialize the device selector dropdown
         */
        async function initDeviceSelector() {
            try {
                console.log('initDeviceSelector: Starting...');
                await DataLoader.load();
                console.log('initDeviceSelector: DataLoader loaded');
                const gateways = DataLoader.getDevices('gateways');
                console.log('initDeviceSelector: Found', gateways.length, 'gateways');
                const selector = document.getElementById('deviceSelector');
                console.log('initDeviceSelector: Selector element:', selector);

                if (!selector) {
                    console.warn('Device selector element not found');
                    return;
                }
                if (gateways.length === 0) {
                    console.warn('No gateways found in data');
                    return;
                }

            // Group gateways by site
            const siteGroups = {};
            gateways.forEach(gw => {
                if (!siteGroups[gw.site]) {
                    siteGroups[gw.site] = [];
                }
                siteGroups[gw.site].push(gw);
            });

            // Build the dropdown options
            let optionsHtml = '';
            Object.keys(siteGroups).sort().forEach(site => {
                optionsHtml += `<optgroup label="${site}">`;
                siteGroups[site].forEach(gw => {
                    optionsHtml += `<option value="${gw.id}">${gw.name}</option>`;
                });
                optionsHtml += '</optgroup>';
            });

            selector.innerHTML = optionsHtml;

            // Check for URL parameter to pre-select device
            const urlParams = new URLSearchParams(window.location.search);
            const deviceParam = urlParams.get('device');

            if (deviceParam) {
                // Try to find the device by ID or name
                const device = gateways.find(g => g.id === deviceParam || g.name === deviceParam);
                if (device) {
                    selector.value = device.id;
                    currentDevice = device;
                }
            }

            // If no device selected, use the first one
            if (!currentDevice && gateways.length > 0) {
                currentDevice = gateways[0];
                selector.value = currentDevice.id;
            }

            // Load device data and update display
            if (currentDevice) {
                await loadDeviceData(currentDevice.id);
            }
            } catch (error) {
                console.error('initDeviceSelector failed:', error);
            }
        }

        /**
         * Handle gateway selection change
         */
        async function updateGatewayView(deviceId) {
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

            // Load and apply device data
            await loadDeviceData(deviceId);
        }

        /**
         * Load device data and update all charts
         */
        async function loadDeviceData(deviceId) {
            currentDeviceData = await DataLoader.getDeviceData(deviceId, 'gateway');

            // Update device info header
            updateDeviceInfo();

            // Update all charts with new data
            if (charts.cpu && currentDeviceData) {
                updateChartsWithDeviceData();
            }
        }

        /**
         * Update the device info header
         */
        function updateDeviceInfo() {
            if (!currentDevice) return;

            // Update device name in the device info card
            const deviceInfoCard = document.querySelector('.border-l-4.border-green-500');
            if (deviceInfoCard) {
                const deviceNameEl = deviceInfoCard.querySelector('h2.text-lg.font-bold');
                if (deviceNameEl) {
                    deviceNameEl.textContent = currentDevice.name;
                }

                // Update model text
                const modelEl = deviceInfoCard.querySelector('p.text-xs.text-gray-500');
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
         * Update all charts with device-specific data
         */
        function updateChartsWithDeviceData() {
            if (!currentDeviceData) return;

            // Update CPU gauge
            if (charts.cpu && currentDeviceData.cpuUsage !== undefined) {
                charts.cpu.data.datasets[0].data = [currentDeviceData.cpuUsage, 100 - currentDeviceData.cpuUsage];
                charts.cpu.update();
                const cpuValue = document.getElementById('cpuValue');
                if (cpuValue) cpuValue.textContent = currentDeviceData.cpuUsage;
            }

            // Update Memory gauge
            if (charts.mem && currentDeviceData.memoryUsage !== undefined) {
                charts.mem.data.datasets[0].data = [currentDeviceData.memoryUsage, 100 - currentDeviceData.memoryUsage];
                charts.mem.update();
                const memValue = document.getElementById('memValue');
                if (memValue) memValue.textContent = currentDeviceData.memoryUsage;
            }

            // Update Cellular Backup status
            const cellularStatusEl = document.getElementById('cellularStatus');
            if (cellularStatusEl && currentDeviceData.cellular) {
                const status = currentDeviceData.cellular.status || 'Standby';
                cellularStatusEl.textContent = status;
                if (status === 'Active') {
                    cellularStatusEl.className = 'text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded dark:bg-blue-900/30 dark:text-blue-300';
                } else {
                    cellularStatusEl.className = 'text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded dark:bg-gray-700 dark:text-gray-300';
                }
            }

            // Update CPU Sparkline
            if (charts.cpuSparkline && currentDeviceData.cpuTrend) {
                charts.cpuSparkline.data.labels = currentDeviceData.cpuTrend.labels;
                charts.cpuSparkline.data.datasets[0].data = currentDeviceData.cpuTrend.data;
                charts.cpuSparkline.update();
            }

            // Update Memory Sparkline
            if (charts.memSparkline && currentDeviceData.memoryTrend) {
                charts.memSparkline.data.labels = currentDeviceData.memoryTrend.labels;
                charts.memSparkline.data.datasets[0].data = currentDeviceData.memoryTrend.data;
                charts.memSparkline.update();
            }

            // Update Signal Sparkline
            if (charts.signal && currentDeviceData.signalTrend) {
                charts.signal.data.labels = currentDeviceData.signalTrend.labels;
                charts.signal.data.datasets[0].data = currentDeviceData.signalTrend.data;
                charts.signal.update();
            }

            // Update Uplink Health chart
            if (charts.uplink && currentDeviceData.uplinkHealth) {
                const uplink = currentDeviceData.uplinkHealth;
                charts.uplink.data.labels = uplink.labels;
                charts.uplink.data.datasets[0].data = uplink.latency;
                charts.uplink.data.datasets[1].data = uplink.jitter;
                charts.uplink.data.datasets[2].data = uplink.loss;

                // Handle spanGaps for ISP failure scenario
                if (uplink.spanGaps === false) {
                    charts.uplink.data.datasets[0].spanGaps = false;
                    charts.uplink.data.datasets[1].spanGaps = false;
                }

                // Dynamic Y-axis adjustment based on data
                const latencyMax = Math.max(...uplink.latency.filter(v => v !== null));
                const jitterMax = Math.max(...uplink.jitter.filter(v => v !== null));
                const lossMax = Math.max(...uplink.loss.filter(v => v !== null));

                // Calculate appropriate Y-axis max with padding (20% headroom)
                const yMax = Math.ceil(Math.max(latencyMax, jitterMax) * 1.2);
                const y1Max = lossMax > 10 ? 100 : Math.ceil(lossMax * 1.5);

                charts.uplink.options.scales.y.suggestedMax = yMax;
                charts.uplink.options.scales.y1.max = y1Max;

                charts.uplink.update();
            }

            // Update Throughput chart
            if (charts.throughput && currentDeviceData.throughput) {
                const throughput = currentDeviceData.throughput;
                charts.throughput.data.labels = throughput.labels;
                charts.throughput.data.datasets[0].data = throughput.upload;
                charts.throughput.data.datasets[1].data = throughput.download;
                charts.throughput.update();
            }

            // Update Top Apps chart
            if (charts.apps && currentDeviceData.topApps) {
                const topApps = currentDeviceData.topApps;
                charts.apps.data.labels = topApps.labels;
                charts.apps.data.datasets[0].data = topApps.data;
                if (topApps.colors) {
                    charts.apps.data.datasets[0].backgroundColor = topApps.colors;
                }
                charts.apps.update();

                // Update legend
                updateAppsLegend(topApps);
            }

            // Update DHCP
            if (charts.dhcpCapacity && currentDeviceData.dhcp) {
                const dhcp = currentDeviceData.dhcp;
                const dhcpAvailable = dhcp.total - dhcp.used;
                const dhcpPercentage = ((dhcp.used / dhcp.total) * 100).toFixed(1);

                charts.dhcpCapacity.data.datasets[0].data = [dhcp.used];
                charts.dhcpCapacity.data.datasets[1].data = [dhcpAvailable];
                charts.dhcpCapacity.options.scales.x.max = dhcp.total;
                charts.dhcpCapacity.update();

                const dhcpUsedValue = document.getElementById('dhcpUsedValue');
                const dhcpAvailableValue = document.getElementById('dhcpAvailableValue');
                const dhcpPercentageValue = document.getElementById('dhcpPercentageValue');
                if (dhcpUsedValue) dhcpUsedValue.textContent = dhcp.used;
                if (dhcpAvailableValue) dhcpAvailableValue.textContent = dhcpAvailable;
                if (dhcpPercentageValue) dhcpPercentageValue.textContent = dhcpPercentage + '%';
            }
        }

        /**
         * Update the apps legend
         */
        function updateAppsLegend(topApps) {
            const legendContainer = document.getElementById('appsLegend');
            if (!legendContainer || !topApps) return;

            const colors = topApps.colors || ['#3b82f6', '#6366f1', '#0ea5e9', '#ef4444', '#9ca3af'];
            const legendHTML = topApps.labels.map((label, index) => {
                const color = colors[index];
                const value = topApps.data[index];
                return `
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-3 h-3 rounded-sm flex-shrink-0" style="background-color: ${color};"></div>
                        <div class="text-sm text-dark-text">
                            <span class="font-medium">${label}</span>
                            <span class="text-xs text-dark-muted ml-1">${value}%</span>
                        </div>
                    </div>
                `;
            }).join('');
            legendContainer.innerHTML = legendHTML;
        }

        // --- TAB SWITCHING LOGIC ---
        function switchTab(tabName) {
            // Hide all tab contents
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });

            // Remove active state from all tab buttons
            const tabButtons = document.querySelectorAll('.tab-button');
            tabButtons.forEach(button => {
                button.classList.remove('border-newrelic-cyan', 'text-blue-600', 'dark:text-blue-400');
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
                selectedButton.classList.add('border-newrelic-cyan', 'text-blue-600', 'dark:text-blue-400');
            }
        }

        // --- Chart Initialization ---
        const charts = {};

        function initCharts() {
            // Initialize Chart.js defaults using shared config
            ChartConfig.initDefaults();
            DiagnosticsManager.init('gateway', 'diagnostics-container');

            // 1. CPU Gauge
            charts.cpu = new Chart(document.getElementById('cpuGauge'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [42, 58],
                        backgroundColor: ['#3b82f6', '#e5e7eb'],
                        borderWidth: 0, cutout: '80%', circumference: 360
                    }]
                },
                options: { plugins: { tooltip: { enabled: false } } }
            });

            // 2. Memory Gauge
            charts.mem = new Chart(document.getElementById('memGauge'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [68, 32],
                        backgroundColor: ['#8b5cf6', '#e5e7eb'],
                        borderWidth: 0, cutout: '80%', circumference: 360
                    }]
                },
                options: { plugins: { tooltip: { enabled: false } } }
            });

            // 3. CPU Sparkline
            charts.cpuSparkline = new Chart(document.getElementById('cpuSparkline'), {
                type: 'line',
                data: {
                    labels: ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'],
                    datasets: [{
                        label: 'CPU Usage',
                        data: [38,40,42,45,43,41,39,42,44,46,45,42,40,38,41,43,45,44,42,40,39,41,42,42],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#3b82f6',
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
                            borderColor: '#3b82f6',
                            borderWidth: 1,
                            displayColors: false,
                            callbacks: {
                                label: function(context) {
                                    return 'CPU: ' + context.parsed.y + '%';
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
                                callback: function(value) { return value + '%'; },
                                font: { size: 9 },
                                stepSize: 25
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });

            // 4. Memory Sparkline
            charts.memSparkline = new Chart(document.getElementById('memSparkline'), {
                type: 'line',
                data: {
                    labels: ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'],
                    datasets: [{
                        label: 'Memory Usage',
                        data: [65,66,68,70,69,67,66,68,69,70,71,68,67,65,66,68,69,70,68,67,66,67,68,68],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#8b5cf6',
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
                            borderColor: '#8b5cf6',
                            borderWidth: 1,
                            displayColors: false,
                            callbacks: {
                                label: function(context) {
                                    return 'Memory: ' + context.parsed.y + '%';
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
                                callback: function(value) { return value + '%'; },
                                font: { size: 9 },
                                stepSize: 25
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });

            // 5. Cellular Sparkline
            charts.signal = new Chart(document.getElementById('signalSparkline'), {
                type: 'line',
                data: {
                    labels: ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'],
                    datasets: [{
                        label: 'Signal Strength',
                        data: [85,86,84,85,88,90,89,85,82,80,78,85,88,92,91,89,88,85,86,84,83,85,85,85],
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: '#10b981',
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
                            borderColor: '#10b981',
                            borderWidth: 1,
                            displayColors: false,
                            callbacks: {
                                label: function(context) {
                                    return 'Signal: -' + context.parsed.y + ' dBm';
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
                            min: 60,
                            max: 100,
                            ticks: {
                                callback: function(value) { return '-' + value; },
                                font: { size: 9 },
                                stepSize: 10
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });

            // 4. Uplink Health (Dual Axis) [cite: 16]
            // Timeline: Before 13:45 normal, 13:45 jitter spike, 13:50 ISP failure (100% loss momentarily), Post 13:50 failover to backup
            charts.uplink = new Chart(document.getElementById('uplinkChart'), {
                type: 'line',
                data: {
                    labels: ['13:30','13:45','13:47','13:49','13:50:00','13:50:05','13:50:10','13:51','13:55','14:00'],
                    datasets: [
                        {
                            label: 'Latency (ms)',
                            data: [20, 25, 35, 50, null, null, null, 300, 300, 300],
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#3b82f6',
                            pointHoverBackgroundColor: '#3b82f6',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y',
                            tension: 0.3,
                            spanGaps: false
                        },
                        {
                            label: 'Jitter (ms)',
                            data: [5, 100, 300, 500, null, null, null, 30, 30, 30],
                            borderColor: '#a855f7',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#a855f7',
                            pointHoverBackgroundColor: '#a855f7',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y',
                            tension: 0.3,
                            spanGaps: false
                        },
                        {
                            label: 'Loss (%)',
                            data: [0.05, 2, 5, 10, 100, 100, 100, 8, 0.4, 0.3],
                            borderColor: '#f87171',
                            backgroundColor: 'rgba(248, 113, 113, 0.1)',
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#f87171',
                            pointHoverBackgroundColor: '#f87171',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            borderDash: [5, 5],
                            yAxisID: 'y1',
                            tension: 0.3
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
                                    if (context.parsed.y === null) {
                                        return label + 'ISP Failed';
                                    }
                                    label += context.parsed.y;
                                    if (context.datasetIndex === 2) {
                                        label += '%';
                                    } else {
                                        label += ' ms';
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'ms'}, suggestedMax: 600 },
                        y1: { type: 'linear', display: true, position: 'right', grid: {drawOnChartArea: false}, title: {display: true, text: '%'}, max: 100 }
                    }
                }
            });

            // 5. Throughput (Stacked Area) [cite: 18]
            charts.throughput = new Chart(document.getElementById('throughputChart'), {
                type: 'line',
                data: {
                    labels: ['6h','5h','4h','3h','2h','1h'],
                    datasets: [
                        {
                            label: 'Tx (Upload)',
                            data: [12, 15, 45, 30, 20, 18],
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#6366f1',
                            pointHoverBackgroundColor: '#6366f1',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Rx (Download)',
                            data: [40, 55, 120, 85, 60, 50],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#10b981',
                            pointHoverBackgroundColor: '#10b981',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            fill: true,
                            tension: 0.4
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
                        legend: { position: 'bottom' },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#6366f1',
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
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Mbps',
                                font: { size: 11 }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value;
                                }
                            }
                        }
                    }
                }
            });

            // 6. Top Apps (Donut) [cite: 51]
            const appsChartData = {
                labels: ['M365', 'Teams', 'Salesforce', 'YouTube', 'Other'],
                datasets: [{
                    data: [45, 25, 15, 5, 10],
                    backgroundColor: ['#3b82f6', '#6366f1', '#0ea5e9', '#ef4444', '#9ca3af'],
                    borderWidth: 0
                }]
            };

            charts.apps = new Chart(document.getElementById('appsChart'), {
                type: 'doughnut',
                data: appsChartData,
                options: {
                    cutout: '65%',
                    radius: '100%',
                    plugins: {
                        legend: {
                            display: false  // Disable built-in legend
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    let label = context.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += context.parsed + '%';
                                    return label;
                                }
                            }
                        }
                    }
                }
            });

            // Create custom legend
            const legendContainer = document.getElementById('appsLegend');
            const legendHTML = appsChartData.labels.map((label, index) => {
                const color = appsChartData.datasets[0].backgroundColor[index];
                const value = appsChartData.datasets[0].data[index];
                return `
                    <div class="flex items-center gap-2 mb-3">
                        <div class="w-3 h-3 rounded-sm flex-shrink-0" style="background-color: ${color};"></div>
                        <div class="text-sm text-dark-text">
                            <span class="font-medium">${label}</span>
                            <span class="text-xs text-dark-muted ml-1">${value}%</span>
                        </div>
                    </div>
                `;
            }).join('');
            legendContainer.innerHTML = legendHTML;

            // 7. DHCP Utilization - Horizontal Stacked Bar
            const dhcpUsed = 182;
            const dhcpTotal = 254;
            const dhcpAvailable = dhcpTotal - dhcpUsed;
            const dhcpPercentage = (dhcpUsed / dhcpTotal * 100).toFixed(1);

            charts.dhcpCapacity = new Chart(document.getElementById('dhcpCapacityBar'), {
                type: 'bar',
                data: {
                    labels: ['DHCP Pool'],
                    datasets: [
                        {
                            label: 'Used',
                            data: [dhcpUsed],
                            backgroundColor: '#3b82f6',
                            borderRadius: 4
                        },
                        {
                            label: 'Available',
                            data: [dhcpAvailable],
                            backgroundColor: '#e5e7eb',
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.parsed.x;
                                    const percentage = ((value / dhcpTotal) * 100).toFixed(1);
                                    return label + ': ' + value + ' (' + percentage + '%)';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            max: dhcpTotal,
                            grid: { display: false },
                            ticks: { display: false }
                        },
                        y: {
                            stacked: true,
                            grid: { display: false },
                            ticks: { display: false }
                        }
                    }
                }
            });

            document.getElementById('dhcpUsedValue').textContent = dhcpUsed;
            document.getElementById('dhcpAvailableValue').textContent = dhcpAvailable;
            document.getElementById('dhcpPercentageValue').textContent = dhcpPercentage + '%';
        }

        // Initialize Everything
        initCharts();

        // Initialize device selector and load device data
        initDeviceSelector();

        // Register charts with theme manager for automatic theme updates
        themeManager.registerCharts(charts);

        // Update chart colors after initialization if dark mode is already active
        if (themeManager.isDarkMode()) {
            themeManager.updateChartColors();
        }

        // --- FIREWALL LOGS SEARCH AND FILTER ---
        const firewallSearch = document.getElementById('firewallSearch');
        const firewallFilter = document.getElementById('firewallFilter');
        const firewallTableBody = document.getElementById('firewallTableBody');
        const allRows = Array.from(firewallTableBody.getElementsByTagName('tr'));

        function filterFirewallLogs() {
            const searchTerm = firewallSearch.value.toLowerCase();
            const filterValue = firewallFilter.value;

            allRows.forEach(row => {
                const cells = row.getElementsByTagName('td');
                const rowText = Array.from(cells).map(cell => cell.textContent.toLowerCase()).join(' ');
                const action = cells[5]?.textContent.trim();

                const matchesSearch = rowText.includes(searchTerm);
                const matchesFilter = filterValue === 'all' || action === filterValue;

                if (matchesSearch && matchesFilter) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        firewallSearch.addEventListener('input', filterFirewallLogs);
        firewallFilter.addEventListener('change', filterFirewallLogs);

        // --- PEER DETAILS OVERLAY ---
        let peerCharts = {};

        function openPeerDetails(peerName) {
            const overlay = document.getElementById('peerDetailsOverlay');
            const title = document.getElementById('peerDetailsTitle');
            const statusSpan = document.getElementById('peerDetailsStatus');

            title.textContent = `VPN Tunnel Details: ${peerName}`;

            // Set status badge based on peer
            const peerStatus = {
                'DC-Primary': '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">UP</span>',
                'DC-Backup': '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">UP</span>',
                'Branch-SFO': '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">DEGRADED</span>',
                'Branch-LON': '<span class="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">UP</span>'
            };
            statusSpan.innerHTML = peerStatus[peerName] || '';

            overlay.classList.remove('hidden');

            // Destroy existing charts if they exist
            Object.values(peerCharts).forEach(chart => {
                if (chart) chart.destroy();
            });
            peerCharts = {};

            // Sample data - in a real app, this would come from an API
            const timeLabels = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

            const peerData = {
                'DC-Primary': {
                    upload: [95, 100, 105, 110, 115, 112, 108, 110, 115, 112, 110, 112],
                    download: [220, 230, 235, 240, 250, 245, 240, 245, 250, 248, 243, 245],
                    latency: [22, 23, 24, 25, 24, 23, 24, 25, 24, 23, 24, 24],
                    jitter: [1.5, 2, 2.5, 2, 1.8, 2.2, 2, 1.9, 2.1, 2, 1.9, 2],
                    loss: [0, 0, 0.1, 0, 0, 0, 0.1, 0, 0, 0, 0, 0]
                },
                'DC-Backup': {
                    upload: [25, 26, 28, 30, 29, 28, 27, 28, 29, 28, 27, 28],
                    download: [48, 50, 51, 53, 52, 51, 50, 52, 53, 52, 51, 52],
                    latency: [30, 31, 32, 33, 32, 31, 32, 33, 32, 31, 32, 32],
                    jitter: [3.5, 4, 4.5, 4, 3.8, 4.2, 4, 3.9, 4.1, 4, 3.9, 4],
                    loss: [0, 0.1, 0.1, 0.2, 0.1, 0.1, 0, 0.1, 0.1, 0.1, 0.1, 0.1]
                },
                'Branch-SFO': {
                    upload: [6, 7, 8, 9, 8, 7, 8, 9, 8, 7, 8, 8],
                    download: [15, 16, 17, 19, 18, 17, 18, 19, 18, 17, 18, 18],
                    latency: [140, 142, 145, 148, 146, 144, 145, 147, 145, 144, 145, 145],
                    jitter: [23, 24, 25, 26, 25, 24, 25, 26, 25, 24, 25, 25],
                    loss: [1.0, 1.1, 1.2, 1.3, 1.2, 1.1, 1.2, 1.3, 1.2, 1.1, 1.2, 1.2]
                },
                'Branch-LON': {
                    upload: [60, 62, 63, 65, 64, 63, 64, 65, 64, 63, 64, 64],
                    download: [122, 124, 126, 128, 127, 126, 127, 128, 127, 126, 127, 127],
                    latency: [83, 84, 85, 86, 85, 84, 85, 86, 85, 84, 85, 85],
                    jitter: [11, 11.5, 12, 12.5, 12, 11.5, 12, 12.5, 12, 11.5, 12, 12],
                    loss: [0, 0, 0, 0.1, 0, 0, 0, 0, 0, 0, 0, 0]
                }
            };

            const data = peerData[peerName] || peerData['DC-Primary'];

            // Bandwidth Chart (Upload + Download)
            peerCharts.bandwidth = new Chart(document.getElementById('peerBandwidthChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Upload',
                            data: data.upload,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Download',
                            data: data.download,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { boxWidth: 12, font: { size: 11 } }
                        }
                    },
                    scales: {
                        y: { beginAtZero: true, ticks: { callback: v => v + ' Mbps' } }
                    }
                }
            });

            // Performance Chart (Latency, Jitter, Loss)
            peerCharts.performance = new Chart(document.getElementById('peerPerformanceChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Latency (ms)',
                            data: data.latency,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Jitter (ms)',
                            data: data.jitter,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Packet Loss (%)',
                            data: data.loss,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { boxWidth: 12, font: { size: 11 } }
                        }
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            beginAtZero: true,
                            title: { display: true, text: 'Latency & Jitter (ms)' },
                            ticks: { callback: v => v + ' ms' }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            beginAtZero: true,
                            title: { display: true, text: 'Packet Loss (%)' },
                            ticks: { callback: v => v + '%' },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }

        function closePeerDetails() {
            const overlay = document.getElementById('peerDetailsOverlay');
            overlay.classList.add('hidden');

            // Destroy charts to prevent memory leaks
            Object.values(peerCharts).forEach(chart => {
                if (chart) chart.destroy();
            });
            peerCharts = {};
        }

        // --- APPLICATION TRENDS OVERLAY ---
        let appTrendsChart = null;

        function openApplicationTrends() {
            const overlay = document.getElementById('appTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (appTrendsChart) {
                appTrendsChart.destroy();
            }

            // Time labels for 24 hours
            const timeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

            // Hardcoded application trend data (in Mbps) - ends at current donut values (M365:45, Teams:25, Salesforce:15, YouTube:5, Other:10)
            const appTrendsData = {
                'M365': [38, 36, 35, 34, 35, 37, 40, 44, 48, 50, 52, 51, 49, 48, 50, 52, 51, 49, 47, 46, 45, 44, 44, 45],
                'Teams': [18, 16, 15, 14, 15, 18, 22, 26, 30, 32, 33, 32, 30, 28, 29, 30, 29, 28, 27, 26, 25, 24, 24, 25],
                'Salesforce': [12, 11, 10, 10, 10, 11, 13, 15, 17, 18, 19, 18, 17, 16, 17, 18, 17, 16, 16, 15, 15, 15, 15, 15],
                'YouTube': [3, 2, 2, 2, 2, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 5, 5, 5, 5, 5, 5, 5, 5],
                'Other': [8, 7, 7, 7, 7, 8, 9, 10, 11, 12, 12, 11, 11, 10, 10, 11, 11, 10, 10, 10, 10, 10, 10, 10]
            };

            // Colors matching the donut chart
            const colors = {
                'M365': '#3b82f6',
                'Teams': '#6366f1',
                'Salesforce': '#0ea5e9',
                'YouTube': '#ef4444',
                'Other': '#9ca3af'
            };

            // Create datasets for the trend chart
            const datasets = Object.keys(appTrendsData).map(app => ({
                label: app,
                data: appTrendsData[app],
                borderColor: colors[app],
                backgroundColor: colors[app] + '20',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: colors[app],
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
                tension: 0.4,
                fill: true
            }));

            // Create the trend chart
            appTrendsChart = new Chart(document.getElementById('appTrendsChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: datasets
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
                                    label += context.parsed.y.toFixed(1) + ' Mbps';
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
                            title: {
                                display: true,
                                text: 'Traffic (Mbps)',
                                font: { size: 12 }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(0) + ' Mbps';
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

        function closeApplicationTrends() {
            const overlay = document.getElementById('appTrendsOverlay');
            overlay.classList.add('hidden');

            // Destroy chart to prevent memory leaks
            if (appTrendsChart) {
                appTrendsChart.destroy();
                appTrendsChart = null;
            }
        }

        // --- DHCP TRENDS OVERLAY ---
        let dhcpTrendsChart = null;

        function openDHCPTrends() {
            const overlay = document.getElementById('dhcpTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (dhcpTrendsChart) {
                dhcpTrendsChart.destroy();
            }

            // Time labels for 24 hours
            const timeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

            // Hardcoded DHCP utilization data - ends at current value of 182
            const dhcpUsedData = [162, 160, 158, 156, 155, 158, 165, 172, 180, 186, 190, 192, 194, 193, 191, 189, 187, 185, 184, 183, 182, 181, 181, 182];
            const dhcpTotal = 254;
            const dhcpCapacityLine = new Array(24).fill(dhcpTotal);

            // Create the DHCP trend chart
            dhcpTrendsChart = new Chart(document.getElementById('dhcpTrendsChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Used IPs',
                            data: dhcpUsedData,
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
                            label: 'Max Capacity',
                            data: dhcpCapacityLine,
                            borderColor: '#ef4444',
                            backgroundColor: 'transparent',
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 0,
                            borderDash: [5, 5],
                            tension: 0,
                            fill: false
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
                                    label += Math.round(context.parsed.y) + ' IPs';
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
                            type: 'linear',
                            display: true,
                            beginAtZero: true,
                            max: dhcpTotal,
                            title: {
                                display: true,
                                text: 'IP Addresses',
                                font: { size: 12 }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + ' IPs';
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

        function closeDHCPTrends() {
            const overlay = document.getElementById('dhcpTrendsOverlay');
            overlay.classList.add('hidden');

            // Destroy chart to prevent memory leaks
            if (dhcpTrendsChart) {
                dhcpTrendsChart.destroy();
                dhcpTrendsChart = null;
            }
        }

        // --- UPLINK HEALTH TRENDS OVERLAY ---
        let uplinkHealthTrendsChart = null;

        function openUplinkHealthTrends() {
            const overlay = document.getElementById('uplinkHealthTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (uplinkHealthTrendsChart) {
                uplinkHealthTrendsChart.destroy();
            }

            // Use device-specific expanded uplink health data if available
            let timeLabels, uplinkData;

            if (currentDeviceData && currentDeviceData.uplinkHealthExpanded) {
                // Use data from loaded device data
                const expanded = currentDeviceData.uplinkHealthExpanded;
                timeLabels = expanded.labels;
                uplinkData = {
                    latency: expanded.latency,
                    jitter: expanded.jitter,
                    loss: expanded.loss
                };
            } else {
                // Fallback to default 24-hour pattern
                timeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];
                uplinkData = {
                    latency: [24, 25, 26, 27, 28, 30, 35, 40, 45, 55, 80, 120, 95, 60, 45, 40, 35, 32, 30, 28, 26, 25, 25, 26],
                    jitter: [2, 2.2, 2.5, 2.8, 3, 3.5, 4, 4.5, 5, 7, 12, 15, 10, 6, 5, 4.5, 4, 3.5, 3, 2.8, 2.5, 2.2, 2, 2],
                    loss: [0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.5, 1.0, 1.8, 2.1, 1.5, 0.8, 0.4, 0.3, 0.2, 0.1, 0.1, 0, 0, 0, 0, 0]
                };
            }

            // Determine if data contains ISP failure (null values or 100% loss)
            const hasIspFailure = uplinkData.latency.some(v => v === null) || uplinkData.loss.some(v => v >= 100);
            const spanGaps = hasIspFailure ? false : true;

            // Dynamic Y-axis calculation based on data
            const latencyMax = Math.max(...uplinkData.latency.filter(v => v !== null));
            const jitterMax = Math.max(...uplinkData.jitter.filter(v => v !== null));
            const lossMax = Math.max(...uplinkData.loss.filter(v => v !== null));

            // Calculate appropriate Y-axis max with padding (20% headroom)
            const yAxisMax = Math.ceil(Math.max(latencyMax, jitterMax) * 1.2);
            const y1AxisMax = lossMax > 10 ? 100 : Math.ceil(lossMax * 1.5);

            // Create the Uplink Health trend chart
            uplinkHealthTrendsChart = new Chart(document.getElementById('uplinkHealthTrendsChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Latency (ms)',
                            data: uplinkData.latency,
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
                            fill: true,
                            yAxisID: 'y',
                            spanGaps: spanGaps
                        },
                        {
                            label: 'Jitter (ms)',
                            data: uplinkData.jitter,
                            borderColor: '#a855f7',
                            backgroundColor: 'rgba(168, 85, 247, 0.2)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#a855f7',
                            pointHoverBackgroundColor: '#a855f7',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            yAxisID: 'y',
                            spanGaps: spanGaps
                        },
                        {
                            label: 'Packet Loss (%)',
                            data: uplinkData.loss,
                            borderColor: '#f87171',
                            backgroundColor: 'rgba(248, 113, 113, 0.2)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#f87171',
                            pointHoverBackgroundColor: '#f87171',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            borderDash: [5, 5],
                            tension: 0.3,
                            fill: true,
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
                                    if (context.parsed.y === null) {
                                        return label + 'ISP Failed';
                                    }
                                    if (context.dataset.yAxisID === 'y1') {
                                        label += context.parsed.y.toFixed(2) + '%';
                                    } else {
                                        label += context.parsed.y.toFixed(1) + ' ms';
                                    }
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
                            type: 'linear',
                            display: true,
                            position: 'left',
                            beginAtZero: true,
                            suggestedMax: yAxisMax,
                            title: {
                                display: true,
                                text: 'Latency & Jitter (ms)',
                                font: { size: 12 }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(0) + ' ms';
                                },
                                font: { size: 10 }
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            beginAtZero: true,
                            max: y1AxisMax,
                            title: {
                                display: true,
                                text: 'Packet Loss (%)',
                                font: { size: 12 }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(1) + '%';
                                },
                                font: { size: 10 }
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    }
                }
            });
        }

        function closeUplinkHealthTrends() {
            const overlay = document.getElementById('uplinkHealthTrendsOverlay');
            overlay.classList.add('hidden');

            // Destroy chart to prevent memory leaks
            if (uplinkHealthTrendsChart) {
                uplinkHealthTrendsChart.destroy();
                uplinkHealthTrendsChart = null;
            }
        }

        // --- WAN THROUGHPUT TRENDS OVERLAY ---
        let wanThroughputTrendsChart = null;

        function openWanThroughputTrends() {
            const overlay = document.getElementById('wanThroughputTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (wanThroughputTrendsChart) {
                wanThroughputTrendsChart.destroy();
            }

            // Time labels for 24 hours
            const timeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

            // Hardcoded WAN throughput data - consistent with minimized view pattern
            // Minimized shows last 6h: Upload [12, 15, 45, 30, 20, 18], Download [40, 55, 120, 85, 60, 50]
            const throughputData = {
                upload: [10, 9, 8, 8, 9, 10, 12, 15, 25, 35, 45, 42, 38, 35, 32, 30, 28, 25, 20, 18, 16, 15, 14, 18],
                download: [35, 32, 30, 28, 30, 35, 40, 55, 75, 100, 120, 115, 105, 95, 90, 85, 80, 70, 60, 50, 48, 45, 48, 50]
            };

            // Create the WAN Throughput trend chart
            wanThroughputTrendsChart = new Chart(document.getElementById('wanThroughputTrendsChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Upload (Tx)',
                            data: throughputData.upload,
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#6366f1',
                            pointHoverBackgroundColor: '#6366f1',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Download (Rx)',
                            data: throughputData.download,
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
                            borderColor: '#6366f1',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    label += context.parsed.y.toFixed(1) + ' Mbps';
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
                            title: {
                                display: true,
                                text: 'Throughput (Mbps)',
                                font: { size: 12 }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(0) + ' Mbps';
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

        function closeWanThroughputTrends() {
            const overlay = document.getElementById('wanThroughputTrendsOverlay');
            overlay.classList.add('hidden');

            // Destroy chart to prevent memory leaks
            if (wanThroughputTrendsChart) {
                wanThroughputTrendsChart.destroy();
                wanThroughputTrendsChart = null;
            }
        }

        // Expose new overlay functions to global scope for onclick handlers
        window.openUplinkHealthTrends = openUplinkHealthTrends;
        window.closeUplinkHealthTrends = closeUplinkHealthTrends;
        window.openWanThroughputTrends = openWanThroughputTrends;
        window.closeWanThroughputTrends = closeWanThroughputTrends;

        // Expose device management function for dropdown
        window.updateGatewayView = updateGatewayView;
