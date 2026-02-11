        // Initialize navigation for SD-WAN page
        NavigationManager.init('sdwan');

        // --- DEVICE MANAGEMENT ---
        let currentDevice = null;
        let currentDeviceData = null;

        /**
         * Initialize the device selector dropdown via SharedUI
         */
        async function initDeviceSelector() {
            const device = await SharedUI.initDeviceSelector('gateways', {
                onDeviceSelected: async (device) => {
                    currentDevice = device;
                    await loadDeviceData(device.id);
                },
                onDeviceChanged: (deviceId) => updateGatewayView(deviceId)
            });
            if (device) currentDevice = device;
        }

        /**
         * Handle gateway selection change via SharedUI
         */
        async function updateGatewayView(deviceId) {
            const device = SharedUI.changeDevice(deviceId, async (dev) => {
                currentDevice = dev;
                await loadDeviceData(dev.id);
            });
        }

        /**
         * Load device data and update all charts
         */
        async function loadDeviceData(deviceId) {
            currentDeviceData = await DataLoader.getDeviceData(deviceId, 'gateway');

            // Reset VLAN/VPN filters on device change
            const appsVlan = document.getElementById('appsVlanFilter');
            if (appsVlan) appsVlan.value = '';
            const appsVpn = document.getElementById('appsVpnFilter');
            if (appsVpn) appsVpn.value = '';

            // Update device info header
            updateDeviceInfo();

            // Update all charts with new data
            if (charts.cpu && currentDeviceData) {
                updateChartsWithDeviceData();
            }

            // Update device alert feed
            updateDeviceAlertFeed(deviceId);
        }

        /**
         * Update the device alert feed (delegates to SharedUI)
         */
        function updateDeviceAlertFeed(deviceId) {
            SharedUI.updateDeviceAlertFeed(deviceId);
        }

        /**
         * Update the device info header (delegates to SharedUI)
         */
        function updateDeviceInfo() {
            SharedUI.updateDeviceInfo(currentDevice);
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
                const cpuSliced = TimelineManager.sliceData(currentDeviceData.cpuTrend.labels, currentDeviceData.cpuTrend.data);
                charts.cpuSparkline.data.labels = cpuSliced.labels;
                charts.cpuSparkline.data.datasets[0].data = cpuSliced.datasets[0];
                charts.cpuSparkline.update();
            }

            // Update Memory Sparkline
            if (charts.memSparkline && currentDeviceData.memoryTrend) {
                const memSliced = TimelineManager.sliceData(currentDeviceData.memoryTrend.labels, currentDeviceData.memoryTrend.data);
                charts.memSparkline.data.labels = memSliced.labels;
                charts.memSparkline.data.datasets[0].data = memSliced.datasets[0];
                charts.memSparkline.update();
            }

            // Update Signal Sparkline
            if (charts.signal && currentDeviceData.signalTrend) {
                const sigSliced = TimelineManager.sliceData(currentDeviceData.signalTrend.labels, currentDeviceData.signalTrend.data);
                charts.signal.data.labels = sigSliced.labels;
                charts.signal.data.datasets[0].data = sigSliced.datasets[0];
                charts.signal.update();
            }

            // Update Uplink Health chart
            if (charts.uplink && currentDeviceData.uplinkHealth) {
                const uplink = currentDeviceData.uplinkHealth;
                const isEventData = uplink.spanGaps === false;

                if (isEventData) {
                    // Event/override data: use actual timestamps from labels
                    charts.uplink.data.labels = convertLabelsToTimestamps(uplink.labels);
                    charts.uplink.data.datasets[0].data = uplink.latency;
                    charts.uplink.data.datasets[1].data = uplink.jitter;
                    charts.uplink.data.datasets[2].data = uplink.loss;
                    charts.uplink.data.datasets[0].spanGaps = false;
                    charts.uplink.data.datasets[1].spanGaps = false;
                    // Keep minute-level axis for event detail
                    charts.uplink.options.scales.x.time.unit = 'minute';
                    charts.uplink.options.scales.x.time.displayFormats = { minute: 'HH:mm' };
                    charts.uplink.options.scales.x.time.tooltipFormat = 'HH:mm:ss';
                } else {
                    // Standard hourly data: spread across timeline range
                    const uplinkSliced = TimelineManager.sliceData(uplink.labels, uplink.latency, uplink.jitter, uplink.loss);
                    charts.uplink.data.labels = generateTimestampsForRange(uplinkSliced.datasets[0].length);
                    charts.uplink.data.datasets[0].data = uplinkSliced.datasets[0];
                    charts.uplink.data.datasets[1].data = uplinkSliced.datasets[1];
                    charts.uplink.data.datasets[2].data = uplinkSliced.datasets[2];
                    const timeConfig = getTimeAxisConfig();
                    charts.uplink.options.scales.x.time.unit = timeConfig.unit;
                    charts.uplink.options.scales.x.time.displayFormats = timeConfig.displayFormats;
                    charts.uplink.options.scales.x.time.tooltipFormat = timeConfig.tooltipFormat;
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

            // Update ISP Traffic chart (single chart, 4 lines)
            if (charts.ispTraffic && currentDeviceData.ispTraffic) {
                const ispSource = currentDeviceData.ispTrafficExpanded || currentDeviceData.ispTraffic;
                const ispKeys = Object.keys(ispSource);
                const isp1 = ispSource[ispKeys[0]];
                const isp2 = ispKeys[1] ? ispSource[ispKeys[1]] : { labels: isp1.labels, upload: isp1.labels.map(() => 0), download: isp1.labels.map(() => 0) };
                const sliced = TimelineManager.sliceData(isp1.labels, isp1.upload, isp1.download, isp2.upload, isp2.download);
                charts.ispTraffic.data.labels = sliced.labels;
                charts.ispTraffic.data.datasets[0].data = sliced.datasets[0]; // ISP1 Upload
                charts.ispTraffic.data.datasets[1].data = sliced.datasets[1]; // ISP1 Download
                charts.ispTraffic.data.datasets[2].data = sliced.datasets[2]; // ISP2 Upload
                charts.ispTraffic.data.datasets[3].data = sliced.datasets[3]; // ISP2 Download
                charts.ispTraffic.update();
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

            // Update DHCP (supports new VLAN-based structure)
            if (charts.dhcpGlobal && currentDeviceData.dhcp) {
                const dhcp = currentDeviceData.dhcp;

                // Check if device data has VLAN breakdown, otherwise use defaults
                const vlanData = dhcp.vlans || {
                    corp: { used: Math.floor(dhcp.used * 0.47), total: Math.floor(dhcp.total * 0.50) },
                    secure: { used: Math.floor(dhcp.used * 0.23), total: Math.floor(dhcp.total * 0.24) },
                    guest: { used: Math.floor(dhcp.used * 0.16), total: Math.floor(dhcp.total * 0.12) },
                    prod: { used: Math.floor(dhcp.used * 0.14), total: Math.floor(dhcp.total * 0.14) }
                };

                const globalUsed = vlanData.corp.used + vlanData.secure.used + vlanData.guest.used + vlanData.prod.used;
                const globalTotal = vlanData.corp.total + vlanData.secure.total + vlanData.guest.total + vlanData.prod.total;

                // Update global stacked bar
                charts.dhcpGlobal.data.datasets[0].data = [vlanData.corp.used];
                charts.dhcpGlobal.data.datasets[1].data = [vlanData.secure.used];
                charts.dhcpGlobal.data.datasets[2].data = [vlanData.guest.used];
                charts.dhcpGlobal.data.datasets[3].data = [vlanData.prod.used];
                charts.dhcpGlobal.data.datasets[4].data = [globalTotal - globalUsed];
                charts.dhcpGlobal.options.scales.x.max = globalTotal;
                charts.dhcpGlobal.update();

                // Update individual VLAN bars
                const updateVlanBar = (chart, vlan) => {
                    chart.data.datasets[0].data = [vlan.used];
                    chart.data.datasets[1].data = [vlan.total - vlan.used];
                    chart.options.scales.x.max = vlan.total;
                    chart.update();
                };

                if (charts.dhcpCorp) updateVlanBar(charts.dhcpCorp, vlanData.corp);
                if (charts.dhcpSecure) updateVlanBar(charts.dhcpSecure, vlanData.secure);
                if (charts.dhcpGuest) updateVlanBar(charts.dhcpGuest, vlanData.guest);
                if (charts.dhcpProd) updateVlanBar(charts.dhcpProd, vlanData.prod);

                // Update display values: percentage next to label, count on right
                document.getElementById('dhcpGlobalPct').textContent = '(' + ((globalUsed / globalTotal) * 100).toFixed(0) + '%)';
                document.getElementById('dhcpGlobalCount').textContent = globalUsed + ' / ' + globalTotal;
                document.getElementById('dhcpCorpPct').textContent = '(' + ((vlanData.corp.used / vlanData.corp.total) * 100).toFixed(0) + '%)';
                document.getElementById('dhcpCorpValue').textContent = vlanData.corp.used + '/' + vlanData.corp.total;
                document.getElementById('dhcpSecurePct').textContent = '(' + ((vlanData.secure.used / vlanData.secure.total) * 100).toFixed(0) + '%)';
                document.getElementById('dhcpSecureValue').textContent = vlanData.secure.used + '/' + vlanData.secure.total;
                document.getElementById('dhcpGuestPct').textContent = '(' + ((vlanData.guest.used / vlanData.guest.total) * 100).toFixed(0) + '%)';
                document.getElementById('dhcpGuestValue').textContent = vlanData.guest.used + '/' + vlanData.guest.total;
                document.getElementById('dhcpProdPct').textContent = '(' + ((vlanData.prod.used / vlanData.prod.total) * 100).toFixed(0) + '%)';
                document.getElementById('dhcpProdValue').textContent = vlanData.prod.used + '/' + vlanData.prod.total;
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

        /**
         * Filter Top Applications by VLAN or VPN tunnel
         * @param {string} source - 'vlan' or 'vpn' to indicate which filter changed
         */
        function filterTopApps(source) {
            const vlanFilter = document.getElementById('appsVlanFilter');
            const vpnFilter = document.getElementById('appsVpnFilter');

            // Mutual exclusion: reset the other filter when one is set
            if (source === 'vlan' && vlanFilter && vlanFilter.value && vpnFilter) {
                vpnFilter.value = '';
            } else if (source === 'vpn' && vpnFilter && vpnFilter.value && vlanFilter) {
                vlanFilter.value = '';
            }

            const vlanVal = vlanFilter ? vlanFilter.value : '';
            const vpnVal = vpnFilter ? vpnFilter.value : '';
            const { appData } = getFilteredAppData(vlanVal, vpnVal);

            if (!appData || !charts.apps) return;

            charts.apps.data.labels = appData.labels;
            charts.apps.data.datasets[0].data = appData.data;
            if (appData.colors) {
                charts.apps.data.datasets[0].backgroundColor = appData.colors;
            }
            charts.apps.update();
            updateAppsLegend(appData);
        }
        window.filterTopApps = filterTopApps;


        // --- TAB SWITCHING LOGIC ---
        function switchTab(tabName) {
            SharedUI.switchTab(tabName, {
                activeClasses: 'border-newrelic-cyan text-blue-600 dark:text-blue-400',
                inactiveClasses: 'border-transparent text-gray-500 dark:text-gray-400'
            });
        }

        // --- Time Helper Functions ---
        // Convert time labels to Date timestamps
        // Handles: "HH:MM" (≤24h), "MM/DD HH:00" (3d), "Day MM/DD" (7d)
        function convertLabelsToTimestamps(labels) {
            const today = new Date();
            return labels.map(label => {
                // "Tue 02/05" — 7d range
                const dayMatch = label.match(/^[A-Za-z]{3}\s+(\d{2})\/(\d{2})$/);
                if (dayMatch) {
                    return new Date(today.getFullYear(), parseInt(dayMatch[1], 10) - 1, parseInt(dayMatch[2], 10));
                }
                // "02/09 08:00" — 3d range
                const dateTimeMatch = label.match(/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
                if (dateTimeMatch) {
                    return new Date(today.getFullYear(), parseInt(dateTimeMatch[1], 10) - 1, parseInt(dateTimeMatch[2], 10), parseInt(dateTimeMatch[3], 10), parseInt(dateTimeMatch[4], 10));
                }
                // "HH:MM" or "HH:MM:SS" — ≤24h range
                const parts = label.split(':');
                return new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, parts[2] ? parseInt(parts[2], 10) : 0);
            });
        }

        /**
         * Generate evenly-spaced timestamps across the current timeline range.
         * Used for type:'time' X-axis charts instead of text-label conversion.
         */
        function generateTimestampsForRange(count) {
            const range = TimelineManager.getRange();
            const now = new Date();
            const endMs = now.getTime();
            const startMs = endMs - range.minutes * 60000;
            const interval = count > 1 ? (endMs - startMs) / (count - 1) : 0;
            return Array.from({length: count}, (_, i) => new Date(startMs + i * interval));
        }

        /**
         * Get the appropriate Chart.js time axis config for the current range.
         */
        function getTimeAxisConfig() {
            const range = TimelineManager.getRange();
            if (range.minutes <= 1440) {
                return { unit: 'hour', displayFormats: { hour: 'HH:mm', minute: 'HH:mm' }, tooltipFormat: 'HH:mm:ss' };
            }
            if (range.minutes <= 4320) {
                return { unit: 'hour', displayFormats: { hour: 'MM/dd HH:mm', minute: 'MM/dd HH:mm' }, tooltipFormat: 'MM/dd HH:mm' };
            }
            return { unit: 'day', displayFormats: { day: 'EEE MM/dd', hour: 'MM/dd HH:mm' }, tooltipFormat: 'EEE MM/dd HH:mm' };
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
            const uplinkTimeLabels = ['13:30','13:45','13:47','13:49','13:50:00','13:50:05','13:50:10','13:51','13:55','14:00'];
            const uplinkTimestamps = convertLabelsToTimestamps(uplinkTimeLabels);

            charts.uplink = new Chart(document.getElementById('uplinkChart'), {
                type: 'line',
                data: {
                    labels: uplinkTimestamps,
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
                        x: {
                            type: 'time',
                            time: {
                                unit: 'hour',
                                displayFormats: {
                                    hour: 'HH:mm',
                                    minute: 'HH:mm',
                                    day: 'EEE MM/dd'
                                },
                                tooltipFormat: 'HH:mm:ss'
                            },
                            title: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 8
                            }
                        },
                        y: { type: 'linear', display: true, position: 'left', title: {display: true, text: 'ms'}, suggestedMax: 600 },
                        y1: { type: 'linear', display: true, position: 'right', grid: {drawOnChartArea: false}, title: {display: true, text: '%'}, max: 100 }
                    }
                }
            });

            // 5. ISP Traffic Chart (single chart with 4 lines: 2 ISPs x upload/download)
            charts.ispTraffic = new Chart(document.getElementById('ispTrafficChart'), {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [
                        {
                            label: 'Comcast Upload',
                            data: [],
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
                            pointRadius: 2,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#6366f1',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2
                        },
                        {
                            label: 'Comcast Download',
                            data: [],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            pointRadius: 2,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#10b981',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2
                        },
                        {
                            label: 'AT&T Upload',
                            data: [],
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            pointRadius: 2,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#f59e0b',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            borderDash: [4, 2]
                        },
                        {
                            label: 'AT&T Download',
                            data: [],
                            borderColor: '#06b6d4',
                            backgroundColor: 'rgba(6, 182, 212, 0.08)',
                            pointRadius: 2,
                            pointHoverRadius: 5,
                            pointBackgroundColor: '#06b6d4',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            borderDash: [4, 2]
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            callbacks: {
                                label: function(ctx) {
                                    return (ctx.dataset.label || '') + ': ' + ctx.parsed.y + ' Mbps';
                                }
                            }
                        }
                    },
                    scales: {
                        x: { display: true, grid: { display: false }, ticks: { font: { size: 9 }, maxRotation: 0, autoSkipPadding: 10 } },
                        y: { beginAtZero: true, ticks: { font: { size: 9 }, callback: v => v + '' }, title: { display: true, text: 'Mbps', font: { size: 9 } } }
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

            // 7. DHCP Utilization - Global Stacked Bar + VLAN Bars
            const dhcpData = {
                corp: { used: 85, total: 126 },
                secure: { used: 42, total: 62 },
                guest: { used: 28, total: 30 },
                prod: { used: 27, total: 36 }
            };
            const dhcpGlobalUsed = dhcpData.corp.used + dhcpData.secure.used + dhcpData.guest.used + dhcpData.prod.used;
            const dhcpGlobalTotal = dhcpData.corp.total + dhcpData.secure.total + dhcpData.guest.total + dhcpData.prod.total;

            // VLAN Colors
            const vlanColors = {
                corp: '#3b82f6',    // Blue
                secure: '#8b5cf6', // Purple
                guest: '#f59e0b',  // Amber
                prod: '#10b981'    // Green
            };

            // Helper function to create DHCP bar chart
            function createDhcpBarChart(canvasId, used, total, color, isGlobal = false) {
                const available = total - used;
                return new Chart(document.getElementById(canvasId), {
                    type: 'bar',
                    data: {
                        labels: [''],
                        datasets: isGlobal ? [
                            { label: 'Corp', data: [dhcpData.corp.used], backgroundColor: vlanColors.corp, borderRadius: 0 },
                            { label: 'Secure', data: [dhcpData.secure.used], backgroundColor: vlanColors.secure, borderRadius: 0 },
                            { label: 'Guest', data: [dhcpData.guest.used], backgroundColor: vlanColors.guest, borderRadius: 0 },
                            { label: 'Prod', data: [dhcpData.prod.used], backgroundColor: vlanColors.prod, borderRadius: 0 },
                            { label: 'Available', data: [dhcpGlobalTotal - dhcpGlobalUsed], backgroundColor: '#e5e7eb', borderRadius: 4 }
                        ] : [
                            { label: 'Used', data: [used], backgroundColor: color, borderRadius: 0 },
                            { label: 'Available', data: [available], backgroundColor: '#e5e7eb', borderRadius: 4 }
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
                                        const pct = ((value / total) * 100).toFixed(1);
                                        return label + ': ' + value + ' (' + pct + '%)';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: { stacked: true, max: total, grid: { display: false }, ticks: { display: false } },
                            y: { stacked: true, grid: { display: false }, ticks: { display: false } }
                        }
                    }
                });
            }

            // Create Global Stacked Bar
            charts.dhcpGlobal = createDhcpBarChart('dhcpGlobalBar', dhcpGlobalUsed, dhcpGlobalTotal, '#3b82f6', true);

            // Create VLAN Bars
            charts.dhcpCorp = createDhcpBarChart('dhcpCorpBar', dhcpData.corp.used, dhcpData.corp.total, vlanColors.corp);
            charts.dhcpSecure = createDhcpBarChart('dhcpSecureBar', dhcpData.secure.used, dhcpData.secure.total, vlanColors.secure);
            charts.dhcpGuest = createDhcpBarChart('dhcpGuestBar', dhcpData.guest.used, dhcpData.guest.total, vlanColors.guest);
            charts.dhcpProd = createDhcpBarChart('dhcpProdBar', dhcpData.prod.used, dhcpData.prod.total, vlanColors.prod);

            // Update display values: percentage next to label, count on right
            document.getElementById('dhcpGlobalPct').textContent = '(' + ((dhcpGlobalUsed / dhcpGlobalTotal) * 100).toFixed(0) + '%)';
            document.getElementById('dhcpGlobalCount').textContent = dhcpGlobalUsed + ' / ' + dhcpGlobalTotal;
            document.getElementById('dhcpCorpPct').textContent = '(' + ((dhcpData.corp.used / dhcpData.corp.total) * 100).toFixed(0) + '%)';
            document.getElementById('dhcpCorpValue').textContent = dhcpData.corp.used + '/' + dhcpData.corp.total;
            document.getElementById('dhcpSecurePct').textContent = '(' + ((dhcpData.secure.used / dhcpData.secure.total) * 100).toFixed(0) + '%)';
            document.getElementById('dhcpSecureValue').textContent = dhcpData.secure.used + '/' + dhcpData.secure.total;
            document.getElementById('dhcpGuestPct').textContent = '(' + ((dhcpData.guest.used / dhcpData.guest.total) * 100).toFixed(0) + '%)';
            document.getElementById('dhcpGuestValue').textContent = dhcpData.guest.used + '/' + dhcpData.guest.total;
            document.getElementById('dhcpProdPct').textContent = '(' + ((dhcpData.prod.used / dhcpData.prod.total) * 100).toFixed(0) + '%)';
            document.getElementById('dhcpProdValue').textContent = dhcpData.prod.used + '/' + dhcpData.prod.total;
        }

        // Initialize Everything
        initCharts();

        // Initialize device selector and load device data
        initDeviceSelector();

        // Bind tab button click listeners (replaces inline onclick)
        SharedUI.initTabListeners(switchTab);

        // Register charts with theme manager for automatic theme updates
        themeManager.registerCharts(charts);

        // Update chart colors after initialization if dark mode is already active
        if (themeManager.isDarkMode()) {
            themeManager.updateChartColors();
        }

        // Re-render charts when timeline range changes
        TimelineManager.onChange(() => {
            if (currentDeviceData) {
                updateChartsWithDeviceData();
            }
        });

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

        /**
         * Get the active app data based on current filter state (card or overlay)
         * Returns { appData, filterLabel } for the active filter
         */
        function getFilteredAppData(vlanVal, vpnVal) {
            let appData = null;
            let filterLabel = '';

            if (vlanVal && currentDeviceData && currentDeviceData.topAppsByVlan) {
                appData = currentDeviceData.topAppsByVlan[vlanVal];
                filterLabel = 'VLAN: ' + vlanVal;
            } else if (vpnVal && currentDeviceData && currentDeviceData.topAppsByVpn) {
                appData = currentDeviceData.topAppsByVpn[vpnVal];
                filterLabel = 'Tunnel: ' + vpnVal;
            } else if (currentDeviceData && currentDeviceData.topApps) {
                appData = currentDeviceData.topApps;
            }

            return { appData, filterLabel };
        }

        /**
         * Build the trend chart using the given app data and colors
         */
        function buildAppTrendsChart(appData) {
            // Destroy existing chart
            if (appTrendsChart) {
                appTrendsChart.destroy();
            }

            const baseTimeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

            // Use device trend data if available, else generate synthetic from donut percentages
            let trendSource = (currentDeviceData && currentDeviceData.topAppsTrend) ? currentDeviceData.topAppsTrend : null;

            // Build datasets from the app labels/data
            const labels = appData.labels;
            const colors = appData.colors || ['#3b82f6', '#6366f1', '#0ea5e9', '#ef4444', '#9ca3af'];

            // Collect all raw trend data arrays for slicing
            const rawTrends = labels.map((label, i) => {
                if (trendSource && trendSource[label]) {
                    return trendSource[label];
                }
                const base = appData.data[i];
                return baseTimeLabels.map((_, j) => {
                    const variation = Math.sin((j / 24) * Math.PI * 2) * (base * 0.15);
                    return Math.max(0, +(base + variation).toFixed(1));
                });
            });

            // Slice all datasets according to the current timeline
            const sliced = TimelineManager.sliceData(baseTimeLabels, ...rawTrends);

            const datasets = labels.map((label, i) => ({
                label: label,
                data: sliced.datasets[i],
                borderColor: colors[i],
                backgroundColor: colors[i] + '20',
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: colors[i],
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2,
                tension: 0.4,
                fill: true
            }));

            appTrendsChart = new Chart(document.getElementById('appTrendsChart'), {
                type: 'line',
                data: { labels: sliced.labels, datasets: datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true, position: 'top',
                            labels: { boxWidth: 12, font: { size: 12 }, padding: 15, usePointStyle: true }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff', bodyColor: '#fff',
                            borderColor: '#3b82f6', borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) label += ': ';
                                    label += context.parsed.y.toFixed(1) + ' Mbps';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
                            ticks: { maxRotation: 45, minRotation: 45, autoSkipPadding: 10, font: { size: 10 } }
                        },
                        y: {
                            display: true, beginAtZero: true,
                            title: { display: true, text: 'Traffic (Mbps)', font: { size: 12 } },
                            ticks: { callback: function(value) { return value.toFixed(0) + ' Mbps'; }, font: { size: 10 } },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });
        }

        function openApplicationTrends() {
            const overlay = document.getElementById('appTrendsOverlay');
            overlay.classList.remove('hidden');

            // Sync overlay filters with card filters
            const cardVlan = document.getElementById('appsVlanFilter');
            const cardVpn = document.getElementById('appsVpnFilter');
            const overlayVlan = document.getElementById('appTrendsVlanFilter');
            const overlayVpn = document.getElementById('appTrendsVpnFilter');
            if (cardVlan && overlayVlan) overlayVlan.value = cardVlan.value;
            if (cardVpn && overlayVpn) overlayVpn.value = cardVpn.value;

            const vlanVal = overlayVlan ? overlayVlan.value : '';
            const vpnVal = overlayVpn ? overlayVpn.value : '';
            const { appData, filterLabel } = getFilteredAppData(vlanVal, vpnVal);

            // Update filter label
            const labelEl = document.getElementById('appTrendsFilterLabel');
            if (labelEl) labelEl.textContent = filterLabel;

            if (appData) {
                buildAppTrendsChart(appData);
            }
        }

        /**
         * Handle filter change inside the overlay
         * @param {string} source - 'vlan' or 'vpn' to indicate which filter changed
         */
        function filterAppTrendsOverlay(source) {
            const overlayVlan = document.getElementById('appTrendsVlanFilter');
            const overlayVpn = document.getElementById('appTrendsVpnFilter');

            // Mutual exclusion: reset the other filter when one is set
            if (source === 'vlan' && overlayVlan && overlayVlan.value && overlayVpn) {
                overlayVpn.value = '';
            } else if (source === 'vpn' && overlayVpn && overlayVpn.value && overlayVlan) {
                overlayVlan.value = '';
            }

            const vlanVal = overlayVlan ? overlayVlan.value : '';
            const vpnVal = overlayVpn ? overlayVpn.value : '';
            const { appData, filterLabel } = getFilteredAppData(vlanVal, vpnVal);

            // Update filter label
            const labelEl = document.getElementById('appTrendsFilterLabel');
            if (labelEl) labelEl.textContent = filterLabel;

            // Also sync card filters
            const cardVlan = document.getElementById('appsVlanFilter');
            const cardVpn = document.getElementById('appsVpnFilter');
            if (cardVlan) cardVlan.value = vlanVal;
            if (cardVpn) cardVpn.value = vpnVal;

            if (appData) {
                buildAppTrendsChart(appData);
                // Also update the donut chart on the card
                charts.apps.data.labels = appData.labels;
                charts.apps.data.datasets[0].data = appData.data;
                if (appData.colors) charts.apps.data.datasets[0].backgroundColor = appData.colors;
                charts.apps.update();
                updateAppsLegend(appData);
            }
        }
        window.filterAppTrendsOverlay = filterAppTrendsOverlay;

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
            const baseTimeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

            // Get VLAN proportions from current device data
            let vlanRatios = { corp: 0.47, secure: 0.23, guest: 0.16, prod: 0.14 };
            let dhcpTotal = 254;
            if (currentDeviceData && currentDeviceData.dhcp) {
                const dhcp = currentDeviceData.dhcp;
                const vlans = dhcp.vlans || {
                    corp: { used: Math.floor(dhcp.used * 0.47), total: Math.floor(dhcp.total * 0.50) },
                    secure: { used: Math.floor(dhcp.used * 0.23), total: Math.floor(dhcp.total * 0.24) },
                    guest: { used: Math.floor(dhcp.used * 0.16), total: Math.floor(dhcp.total * 0.12) },
                    prod: { used: Math.floor(dhcp.used * 0.14), total: Math.floor(dhcp.total * 0.14) }
                };
                const globalTotal = vlans.corp.total + vlans.secure.total + vlans.guest.total + vlans.prod.total;
                dhcpTotal = globalTotal;
                const globalUsed = vlans.corp.used + vlans.secure.used + vlans.guest.used + vlans.prod.used;
                if (globalUsed > 0) {
                    vlanRatios = {
                        corp: vlans.corp.used / globalUsed,
                        secure: vlans.secure.used / globalUsed,
                        guest: vlans.guest.used / globalUsed,
                        prod: vlans.prod.used / globalUsed
                    };
                }
            }

            // Use device trend data or hardcoded fallback
            let baseDhcpUsedData;
            if (currentDeviceData && currentDeviceData.dhcpTrend) {
                baseDhcpUsedData = currentDeviceData.dhcpTrend.used;
            } else {
                baseDhcpUsedData = [162, 160, 158, 156, 155, 158, 165, 172, 180, 186, 190, 192, 194, 193, 191, 189, 187, 185, 184, 183, 182, 181, 181, 182];
            }

            // Derive per-VLAN trend data from global using proportions
            const corpData = baseDhcpUsedData.map(v => Math.round(v * vlanRatios.corp));
            const secureData = baseDhcpUsedData.map(v => Math.round(v * vlanRatios.secure));
            const guestData = baseDhcpUsedData.map(v => Math.round(v * vlanRatios.guest));
            const prodData = baseDhcpUsedData.map(v => Math.round(v * vlanRatios.prod));
            const totalUsedData = [...baseDhcpUsedData];
            const capacityLine = new Array(baseDhcpUsedData.length).fill(dhcpTotal);

            // Slice data according to timeline
            const dhcpSliced = TimelineManager.sliceData(baseTimeLabels, corpData, secureData, guestData, prodData, totalUsedData, capacityLine);

            // Create the DHCP trend chart with per-VLAN lines
            dhcpTrendsChart = new Chart(document.getElementById('dhcpTrendsChart'), {
                type: 'line',
                data: {
                    labels: dhcpSliced.labels,
                    datasets: [
                        {
                            label: 'Corp VLAN',
                            data: dhcpSliced.datasets[0],
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
                        },
                        {
                            label: 'Secure VLAN',
                            data: dhcpSliced.datasets[1],
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
                        },
                        {
                            label: 'Guest VLAN',
                            data: dhcpSliced.datasets[2],
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 4,
                            pointHoverBackgroundColor: '#f59e0b',
                            pointHoverBorderColor: '#fff',
                            pointHoverBorderWidth: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Prod VLAN',
                            data: dhcpSliced.datasets[3],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.08)',
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 4,
                            pointHoverBackgroundColor: '#10b981',
                            pointHoverBorderColor: '#fff',
                            pointHoverBorderWidth: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Total Used',
                            data: dhcpSliced.datasets[4],
                            borderColor: '#6b7280',
                            backgroundColor: 'transparent',
                            borderWidth: 2.5,
                            borderDash: [4, 3],
                            pointRadius: 0,
                            pointHoverRadius: 4,
                            pointHoverBackgroundColor: '#6b7280',
                            pointHoverBorderColor: '#fff',
                            pointHoverBorderWidth: 2,
                            tension: 0.4,
                            fill: false
                        },
                        {
                            label: 'Max Capacity',
                            data: dhcpSliced.datasets[5],
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

            // Check if this device has event/override data (ISP failure scenario)
            const isEventData = currentDeviceData && currentDeviceData.uplinkHealth && currentDeviceData.uplinkHealth.spanGaps === false;

            // Use device-specific expanded uplink health data if available
            let baseTimeLabels, uplinkData;

            if (currentDeviceData && currentDeviceData.uplinkHealthExpanded) {
                const expanded = currentDeviceData.uplinkHealthExpanded;
                baseTimeLabels = expanded.labels;
                uplinkData = {
                    latency: expanded.latency,
                    jitter: expanded.jitter,
                    loss: expanded.loss
                };
            } else {
                baseTimeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];
                uplinkData = {
                    latency: [24, 25, 26, 27, 28, 30, 35, 40, 45, 55, 80, 120, 95, 60, 45, 40, 35, 32, 30, 28, 26, 25, 25, 26],
                    jitter: [2, 2.2, 2.5, 2.8, 3, 3.5, 4, 4.5, 5, 7, 12, 15, 10, 6, 5, 4.5, 4, 3.5, 3, 2.8, 2.5, 2.2, 2, 2],
                    loss: [0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.5, 1.0, 1.8, 2.1, 1.5, 0.8, 0.4, 0.3, 0.2, 0.1, 0.1, 0, 0, 0, 0, 0]
                };
            }

            let timeStamps, timeConfig;

            if (isEventData) {
                // Event data: use actual timestamps, no slicing (show full event)
                timeStamps = convertLabelsToTimestamps(baseTimeLabels);
                uplinkData = { latency: uplinkData.latency, jitter: uplinkData.jitter, loss: uplinkData.loss };
                timeConfig = { unit: 'minute', displayFormats: { minute: 'HH:mm' }, tooltipFormat: 'HH:mm:ss' };
            } else {
                // Standard data: slice and spread across timeline range
                const uplinkSliced = TimelineManager.sliceData(baseTimeLabels, uplinkData.latency, uplinkData.jitter, uplinkData.loss);
                uplinkData = { latency: uplinkSliced.datasets[0], jitter: uplinkSliced.datasets[1], loss: uplinkSliced.datasets[2] };
                timeStamps = generateTimestampsForRange(uplinkSliced.datasets[0].length);
                timeConfig = getTimeAxisConfig();
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
                    labels: timeStamps,
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
                            type: 'time',
                            time: {
                                unit: timeConfig.unit,
                                displayFormats: timeConfig.displayFormats,
                                tooltipFormat: timeConfig.tooltipFormat
                            },
                            display: true,
                            grid: {
                                display: true,
                                color: 'rgba(0, 0, 0, 0.05)'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                autoSkip: true,
                                maxTicksLimit: 12,
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

            // Use device-specific ISP traffic data if available (matches the 4-line minimized card)
            let baseTimeLabels, isp1Upload, isp1Download, isp2Upload, isp2Download, isp1Name, isp2Name;

            if (currentDeviceData && currentDeviceData.ispTraffic) {
                const ispSource = currentDeviceData.ispTrafficExpanded || currentDeviceData.ispTraffic;
                const ispKeys = Object.keys(ispSource);
                const isp1 = ispSource[ispKeys[0]];
                const isp2 = ispKeys[1] ? ispSource[ispKeys[1]] : { labels: isp1.labels, upload: isp1.labels.map(() => 0), download: isp1.labels.map(() => 0) };
                isp1Name = ispKeys[0] || 'Comcast';
                isp2Name = ispKeys[1] || 'AT&T';
                baseTimeLabels = isp1.labels;
                isp1Upload = isp1.upload;
                isp1Download = isp1.download;
                isp2Upload = isp2.upload;
                isp2Download = isp2.download;
            } else {
                isp1Name = 'Comcast';
                isp2Name = 'AT&T';
                baseTimeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];
                isp1Upload = [10, 9, 8, 8, 9, 10, 12, 15, 25, 35, 45, 42, 38, 35, 32, 30, 28, 25, 20, 18, 16, 15, 14, 18];
                isp1Download = [35, 32, 30, 28, 30, 35, 40, 55, 75, 100, 120, 115, 105, 95, 90, 85, 80, 70, 60, 50, 48, 45, 48, 50];
                isp2Upload = [5, 4, 4, 3, 4, 5, 6, 8, 12, 18, 22, 20, 18, 16, 15, 14, 13, 12, 10, 8, 7, 6, 6, 8];
                isp2Download = [15, 14, 12, 10, 12, 15, 18, 25, 35, 48, 55, 52, 48, 42, 38, 35, 32, 28, 24, 20, 18, 16, 18, 20];
            }

            // Slice all 4 datasets according to timeline
            const tpSliced = TimelineManager.sliceData(baseTimeLabels, isp1Upload, isp1Download, isp2Upload, isp2Download);

            // Build 2x2 HTML legend
            const legendItems = [
                { label: isp1Name + ' Up', color: '#6366f1' },
                { label: isp1Name + ' Down', color: '#10b981' },
                { label: isp2Name + ' Up', color: '#f59e0b' },
                { label: isp2Name + ' Down', color: '#06b6d4' }
            ];
            const legendEl = document.getElementById('wanThroughputLegend');
            if (legendEl) {
                legendEl.innerHTML = legendItems.map(item =>
                    `<span class="flex items-center gap-1 text-xs text-gray-500"><span class="w-2 h-2 rounded-full" style="background:${item.color}"></span> ${item.label}</span>`
                ).join('');
            }

            // Create the WAN Throughput trend chart with 4 ISP-specific lines
            wanThroughputTrendsChart = new Chart(document.getElementById('wanThroughputTrendsChart'), {
                type: 'line',
                data: {
                    labels: tpSliced.labels,
                    datasets: [
                        {
                            label: isp1Name + ' Upload',
                            data: tpSliced.datasets[0],
                            borderColor: '#6366f1',
                            backgroundColor: 'rgba(99, 102, 241, 0.1)',
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
                            label: isp1Name + ' Download',
                            data: tpSliced.datasets[1],
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
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
                            label: isp2Name + ' Upload',
                            data: tpSliced.datasets[2],
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.08)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#f59e0b',
                            pointHoverBackgroundColor: '#f59e0b',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            borderDash: [4, 2]
                        },
                        {
                            label: isp2Name + ' Download',
                            data: tpSliced.datasets[3],
                            borderColor: '#06b6d4',
                            backgroundColor: 'rgba(6, 182, 212, 0.08)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#06b6d4',
                            pointHoverBackgroundColor: '#06b6d4',
                            pointBorderColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            borderDash: [4, 2]
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
