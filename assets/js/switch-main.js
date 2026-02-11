        // Initialize navigation for Switch page
        NavigationManager.init('switch');

        // --- DEVICE MANAGEMENT ---
        let currentDevice = null;
        let currentDeviceData = null;

        /**
         * Initialize the device selector dropdown via SharedUI
         */
        async function initDeviceSelector() {
            const device = await SharedUI.initDeviceSelector('switches', {
                onDeviceSelected: async (device) => {
                    currentDevice = device;
                    await loadDeviceData(device.id);
                },
                onDeviceChanged: (deviceId) => updateSwitchView(deviceId)
            });
            if (device) currentDevice = device;
        }

        /**
         * Handle switch selection change via SharedUI
         */
        async function updateSwitchView(deviceId) {
            const device = SharedUI.changeDevice(deviceId, async (dev) => {
                currentDevice = dev;
                await loadDeviceData(dev.id);
            });
        }

        /**
         * Load device data and update all charts
         */
        async function loadDeviceData(deviceId) {
            currentDeviceData = await DataLoader.getDeviceData(deviceId, 'switch');

            // Update device info header
            SharedUI.updateDeviceInfo(currentDevice);

            // Update all charts with new data
            if (charts.cpuGauge && currentDeviceData) {
                updateChartsWithDeviceData();
            }

            // Update device alert feed
            SharedUI.updateDeviceAlertFeed(deviceId);
        }

        // --- MOCK DATA GENERATION ---
        
        // Shadow IT ports (ports with multiple MACs)
        const shadowITPorts = [3, 12, 42];

        // Generate 48 ports data
        const ports = [];
        for (let i = 1; i <= 48; i++) {
            const isUp = Math.random() > 0.3; // 70% chance UP
            const isPoe = i <= 24 && Math.random() > 0.4; // First 24 ports are PoE capable
            const hasError = isUp && Math.random() > 0.95; // 5% chance of error if UP
            const isShadowIT = shadowITPorts.includes(i);

            let status = 'down';
            if (isUp) status = hasError ? 'alert' : 'up';

            // Generate traffic data
            const uploadSpeed = isUp ? (i === 48 ? Math.random() * 500 + 200 : Math.random() * 50 + 5) : 0;
            const downloadSpeed = isUp ? (i === 48 ? Math.random() * 800 + 400 : Math.random() * 100 + 10) : 0;

            // Generate latency and jitter data
            const latency = isUp ? (i === 48 ? Math.random() * 5 + 1 : Math.random() * 3 + 0.5) : 0;
            const jitter = isUp ? (i === 48 ? Math.random() * 2 + 0.5 : Math.random() * 1 + 0.1) : 0;

            // Generate historical trend data (24 data points for graphs)
            const uploadTrend = isUp ? Array(24).fill(0).map(() => uploadSpeed * (0.7 + Math.random() * 0.6)) : [];
            const downloadTrend = isUp ? Array(24).fill(0).map(() => downloadSpeed * (0.7 + Math.random() * 0.6)) : [];
            const latencyTrend = isUp ? Array(24).fill(0).map(() => latency * (0.8 + Math.random() * 0.4)) : [];
            const jitterTrend = isUp ? Array(24).fill(0).map(() => jitter * (0.8 + Math.random() * 0.4)) : [];
            const errorTrend = hasError ? Array(24).fill(0).map(() => Math.random() * 100) : Array(24).fill(0);

            ports.push({
                id: i,
                name: `Ge${i}`,
                desc: isUp ? (i === 48 ? 'Uplink' : `Workstation ${i}`) : 'Unused',
                status: status,
                vlan: i === 48 ? 'Trunk' : '10',
                speed: '1 Gbps',
                duplex: 'Full',
                poe: isUp && isPoe ? (Math.random() * 15).toFixed(1) : 0,
                clients: isUp ? (i === 48 ? 120 : (isShadowIT ? [5, 2, 8][shadowITPorts.indexOf(i)] : 1)) : 0,
                errors: hasError ? Math.floor(Math.random() * 500) : 0,
                uploadSpeed: uploadSpeed.toFixed(1),
                downloadSpeed: downloadSpeed.toFixed(1),
                latency: latency.toFixed(2),
                jitter: jitter.toFixed(2),
                uploadTrend: uploadTrend,
                downloadTrend: downloadTrend,
                latencyTrend: latencyTrend,
                jitterTrend: jitterTrend,
                errorTrend: errorTrend,
                isShadowIT: isShadowIT
            });
        }

        // --- RENDER FUNCTIONS ---

        // 1. Render Faceplate [cite: 50]
        function renderFaceplate() {
            const rowTop = document.getElementById('faceplateRowTop');
            const rowBottom = document.getElementById('faceplateRowBottom');
            
            ports.forEach(port => {
                const isOdd = port.id % 2 !== 0;
                const container = isOdd ? rowTop : rowBottom;
                
                // Colors based on status [cite: 45, 46, 47]
                let ledColor = 'bg-gray-500 dark:bg-gray-600'; // Default/Down
                let portColor = 'bg-gray-200 dark:bg-gray-700';

                if (port.status === 'up') {
                    ledColor = 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.9)]';
                    portColor = 'bg-gray-300 dark:bg-gray-600';
                } else if (port.status === 'alert') {
                    ledColor = 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.9)]';
                    portColor = 'bg-gray-300 dark:bg-gray-600';
                }

                const poeClass = port.poe > 0 ? 'poe-active' : '';

                const slotHtml = `
                    <div class="port-slot ${portColor} flex flex-col items-center ${poeClass}" title="Port ${port.id}: ${port.desc}">
                        <div class="port-led ${ledColor}"></div>
                        <div class="rj45-shape"></div>
                        <div class="text-[8px] text-gray-800 dark:text-gray-300 font-mono font-bold mt-auto mb-0.5">${port.id}</div>
                        <i class="fa-solid fa-bolt poe-indicator"></i>
                    </div>
                `;
                
                container.innerHTML += slotHtml;
            });
        }

        // 2. Render Port Table
        function renderPortTable() {
            const tbody = document.getElementById('portTableBody');

            ports.forEach((port, index) => {
                const statusBadge = {
                    'up': '<span class="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Connected</span>',
                    'down': '<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">Down</span>',
                    'alert': '<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Error</span>'
                };

                const tr = document.createElement('tr');
                tr.className = "hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer group";
                tr.setAttribute('data-port', port.id);
                tr.onclick = () => openPortDetails(port);
                tr.innerHTML = `
                    <td class="px-4 py-2.5 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap group-hover:underline">${port.name} <i class="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-1"></i></td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap">${port.desc}</td>
                    <td class="px-4 py-2.5 text-center whitespace-nowrap">${statusBadge[port.status]}</td>
                    <td class="px-4 py-2.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">${port.vlan}</td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap">${port.speed}</td>
                    <td class="px-4 py-2.5 text-right font-medium ${port.status === 'up' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'} whitespace-nowrap">${port.status === 'up' ? port.uploadSpeed + ' Mbps' : '-'}</td>
                    <td class="px-4 py-2.5 text-right font-medium ${port.status === 'up' ? 'text-green-600 dark:text-green-400' : 'text-gray-400'} whitespace-nowrap">${port.status === 'up' ? port.downloadSpeed + ' Mbps' : '-'}</td>
                    <td class="px-4 py-2.5 text-right font-medium ${port.status === 'up' ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'} whitespace-nowrap">${port.status === 'up' ? port.latency + ' ms' : '-'}</td>
                    <td class="px-4 py-2.5 text-right font-medium ${port.poe > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'} whitespace-nowrap">${port.poe > 0 ? port.poe + ' W' : '-'}</td>
                    <td class="px-4 py-2.5 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">${port.clients}</td>
                    <td class="px-4 py-2.5 text-right ${port.errors > 0 ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-400'} whitespace-nowrap">${port.errors}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // --- TABLE SORTING ---
        let sortColumn = null;
        let sortDirection = 'asc';

        function sortTable(column) {
            // Toggle direction if same column
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'asc';
            }

            // Sort ports array
            ports.sort((a, b) => {
                let aVal, bVal;

                switch(column) {
                    case 'port':
                        aVal = a.id;
                        bVal = b.id;
                        break;
                    case 'name':
                        aVal = a.name;
                        bVal = b.name;
                        break;
                    case 'status':
                        const statusOrder = { 'alert': 3, 'up': 2, 'down': 1 };
                        aVal = statusOrder[a.status];
                        bVal = statusOrder[b.status];
                        break;
                    case 'vlan':
                        aVal = a.vlan;
                        bVal = b.vlan;
                        break;
                    case 'speed':
                        aVal = parseFloat(a.speed);
                        bVal = parseFloat(b.speed);
                        break;
                    case 'upload':
                        aVal = parseFloat(a.uploadSpeed);
                        bVal = parseFloat(b.uploadSpeed);
                        break;
                    case 'download':
                        aVal = parseFloat(a.downloadSpeed);
                        bVal = parseFloat(b.downloadSpeed);
                        break;
                    case 'latency':
                        aVal = parseFloat(a.latency);
                        bVal = parseFloat(b.latency);
                        break;
                    case 'poe':
                        aVal = parseFloat(a.poe) || 0;
                        bVal = parseFloat(b.poe) || 0;
                        break;
                    case 'clients':
                        aVal = a.clients;
                        bVal = b.clients;
                        break;
                    case 'errors':
                        aVal = a.errors;
                        bVal = b.errors;
                        break;
                    default:
                        return 0;
                }

                if (sortDirection === 'asc') {
                    return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                } else {
                    return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
                }
            });

            // Re-render table
            document.getElementById('portTableBody').innerHTML = '';
            renderPortTable();
        }

        // --- TAB SWITCHING ---
        function switchTab(tabName) {
            SharedUI.switchTab(tabName, {
                activeClasses: 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400',
                inactiveClasses: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            });
        }

        // --- PORT DETAILS POPUP ---
        let portCharts = {};

        function openPortDetails(port) {
            const overlay = document.getElementById('portDetailsOverlay');
            const title = document.getElementById('portDetailsTitle');
            const statusSpan = document.getElementById('portDetailsStatus');

            // Set title and status
            title.textContent = `Port ${port.name} - ${port.desc}`;

            const statusBadges = {
                'up': '<span class="px-2 py-1 text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">Connected</span>',
                'down': '<span class="px-2 py-1 text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded">Down</span>',
                'alert': '<span class="px-2 py-1 text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">Error</span>'
            };
            statusSpan.innerHTML = statusBadges[port.status];

            // Show overlay
            overlay.classList.remove('hidden');

            // Generate time labels (24 hours)
            const timeLabels = Array.from({length: 24}, (_, i) => `${String(i).padStart(2, '0')}:00`);

            // Create Traffic Chart
            if (portCharts.traffic) portCharts.traffic.destroy();
            portCharts.traffic = new Chart(document.getElementById('portTrafficChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Upload',
                            data: port.uploadTrend,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Download',
                            data: port.downloadTrend,
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderWidth: 2,
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
                        legend: { position: 'top' },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + ' Mbps';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return value + ' Mbps';
                                }
                            }
                        }
                    }
                }
            });

            // Create Performance Chart
            if (portCharts.performance) portCharts.performance.destroy();
            portCharts.performance = new Chart(document.getElementById('portPerformanceChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Latency',
                            data: port.latencyTrend,
                            borderColor: '#8b5cf6',
                            backgroundColor: 'rgba(139, 92, 246, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Jitter',
                            data: port.jitterTrend,
                            borderColor: '#f97316',
                            backgroundColor: 'rgba(249, 115, 22, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Errors',
                            data: port.errorTrend,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.4,
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
                        legend: { position: 'top' }
                    },
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: 'Latency & Jitter (ms)'
                            },
                            beginAtZero: true
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: 'Errors'
                            },
                            beginAtZero: true,
                            grid: {
                                drawOnChartArea: false
                            }
                        }
                    }
                }
            });

            // Register charts with theme manager
            themeManager.registerCharts(portCharts);
        }

        function closePortDetails() {
            const overlay = document.getElementById('portDetailsOverlay');
            overlay.classList.add('hidden');

            // Destroy charts to prevent memory leaks
            if (portCharts.traffic) {
                portCharts.traffic.destroy();
                portCharts.traffic = null;
            }
            if (portCharts.performance) {
                portCharts.performance.destroy();
                portCharts.performance = null;
            }
        }

        // --- CHART INITIALIZATION ---
        const charts = {};

        function initCharts() {
            ChartConfig.initDefaults();
            DiagnosticsManager.init('switch', 'diagnostics-container');

            // 1. CPU Gauge
            charts.cpuGauge = new Chart(document.getElementById('cpuGauge'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [24, 76],
                        backgroundColor: ['#3b82f6', '#e5e7eb'],
                        borderWidth: 0,
                        cutout: '80%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { tooltip: { enabled: false }, legend: { display: false } }
                }
            });

            // 2. CPU Sparkline
            charts.cpuSparkline = new Chart(document.getElementById('cpuSparkline'), {
                type: 'line',
                data: {
                    labels: ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'],
                    datasets: [{
                        label: 'CPU Usage',
                        data: [22, 24, 23, 25, 26, 24, 23, 22, 24, 25, 27, 26, 25, 24, 23, 24, 25, 24, 23, 24, 22, 23, 24, 24],
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

            // 3. Memory Gauge
            charts.memGauge = new Chart(document.getElementById('memGauge'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [45, 55],
                        backgroundColor: ['#8b5cf6', '#e5e7eb'],
                        borderWidth: 0,
                        cutout: '80%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { tooltip: { enabled: false }, legend: { display: false } }
                }
            });

            // 4. Memory Sparkline
            charts.memSparkline = new Chart(document.getElementById('memSparkline'), {
                type: 'line',
                data: {
                    labels: ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'],
                    datasets: [{
                        label: 'Memory Usage',
                        data: [42, 43, 44, 45, 46, 45, 44, 45, 46, 47, 46, 45, 44, 45, 46, 45, 44, 45, 46, 45, 44, 45, 45, 45],
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

            // 5. PoE Gauge
            charts.poeGauge = new Chart(document.getElementById('poeGauge'), {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [51, 49],
                        backgroundColor: ['#10b981', '#e5e7eb'],
                        borderWidth: 0,
                        cutout: '80%'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: { tooltip: { enabled: false }, legend: { display: false } }
                }
            });

            // 6. PoE Sparkline
            charts.poeSparkline = new Chart(document.getElementById('poeSparkline'), {
                type: 'line',
                data: {
                    labels: ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'],
                    datasets: [{
                        label: 'PoE Usage',
                        data: [48, 49, 50, 51, 52, 51, 50, 49, 50, 51, 52, 53, 52, 51, 50, 51, 52, 51, 50, 51, 50, 51, 51, 51],
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
                                    return 'PoE: ' + context.parsed.y + '%';
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

            // 7. Traffic Trend
            charts.traffic = new Chart(document.getElementById('trafficTrendChart'), {
                type: 'line',
                data: {
                    labels: ['6h','5h','4h','3h','2h','1h'],
                    datasets: [
                        {
                            label: 'Tx (Upload)',
                            data: [25, 30, 55, 45, 35, 40],
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
                            data: [120, 150, 450, 320, 250, 210],
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

            // 8. Uplink Health (Dual Axis)
            const uplinkTimeLabels = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
            const uplinkTimestamps = uplinkTimeLabels.map(label => {
                const today = new Date();
                const parts = label.split(':');
                return new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(parts[0]), parseInt(parts[1]));
            });

            charts.uplink = new Chart(document.getElementById('uplinkChart'), {
                type: 'line',
                data: {
                    labels: uplinkTimestamps,
                    datasets: [
                        {
                            label: 'Latency (ms)',
                            data: [1.2, 1.5, 2.0, 1.8, 1.6, 1.4, 1.3, 1.5, 1.7, 1.4],
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#3b82f6',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y',
                            tension: 0.3
                        },
                        {
                            label: 'Jitter (ms)',
                            data: [0.3, 0.5, 0.8, 0.6, 0.4, 0.3, 0.4, 0.5, 0.6, 0.4],
                            borderColor: '#a855f7',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#a855f7',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            yAxisID: 'y',
                            tension: 0.3
                        },
                        {
                            label: 'Loss (%)',
                            data: [0.0, 0.0, 0.1, 0.05, 0.0, 0.0, 0.0, 0.02, 0.0, 0.0],
                            borderColor: '#f87171',
                            backgroundColor: 'rgba(248, 113, 113, 0.1)',
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#f87171',
                            pointBorderColor: '#fff',
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
                                    if (label) label += ': ';
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
                                displayFormats: { hour: 'HH:mm' },
                                tooltipFormat: 'HH:mm'
                            },
                            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }
                        },
                        y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'ms' }, suggestedMax: 3 },
                        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '%' }, max: 1 }
                    }
                }
            });

            // 9. Traffic by Port (MB) - Top 5 Ports - Horizontal Bar
            charts.trafficByPort = new Chart(document.getElementById('trafficByPortChart'), {
                type: 'bar',
                data: {
                    labels: ['Ge48', 'Ge24', 'Ge12', 'Ge36', 'Ge8'],
                    datasets: [
                        {
                            label: 'Upload',
                            data: [18000, 2400, 2100, 1980, 1860],
                            backgroundColor: '#6366f1',
                            borderRadius: 2
                        },
                        {
                            label: 'Download',
                            data: [48000, 5400, 4800, 4500, 4200],
                            backgroundColor: '#10b981',
                            borderRadius: 2
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
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
                                    if (label) label += ': ';
                                    label += context.parsed.x.toLocaleString() + ' MB';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
                                    return value;
                                },
                                font: { size: 10 }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        y: {
                            ticks: { font: { size: 11, family: 'monospace', weight: 'bold' } },
                            grid: { display: false }
                        }
                    }
                }
            });

            // 10. Error Monitor - Horizontal Bar Chart
            charts.errorMonitor = new Chart(document.getElementById('errorMonitorChart'), {
                type: 'bar',
                data: {
                    labels: ['Ge48', 'Ge3', 'Ge12', 'Ge27', 'Ge42'],
                    datasets: [{
                        label: 'Error Count',
                        data: [487, 342, 156, 89, 52],
                        backgroundColor: [
                            '#ef4444',
                            '#f97316',
                            '#f59e0b',
                            '#eab308',
                            '#84cc16'
                        ],
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#ef4444',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    return 'Errors: ' + context.parsed.x;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            ticks: {
                                font: { size: 10 }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        y: {
                            ticks: {
                                font: { size: 11, family: 'monospace', weight: 'bold' }
                            },
                            grid: { display: false }
                        }
                    }
                }
            });

        }

        // Initialize Logic
        renderFaceplate();
        renderPortTable();
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

        // Helper to convert time labels to Date timestamps
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

        function updateChartsWithDeviceData() {
            if (!currentDeviceData) return;

            // Update CPU gauge + value label
            if (charts.cpuGauge && currentDeviceData.cpuUsage !== undefined) {
                charts.cpuGauge.data.datasets[0].data = [currentDeviceData.cpuUsage, 100 - currentDeviceData.cpuUsage];
                charts.cpuGauge.update();
                const cpuValue = document.getElementById('cpuValue');
                if (cpuValue) cpuValue.textContent = currentDeviceData.cpuUsage + '%';
            }

            // Update Memory gauge + value label
            if (charts.memGauge && currentDeviceData.memoryUsage !== undefined) {
                charts.memGauge.data.datasets[0].data = [currentDeviceData.memoryUsage, 100 - currentDeviceData.memoryUsage];
                charts.memGauge.update();
                const memValue = document.getElementById('memValue');
                if (memValue) memValue.textContent = currentDeviceData.memoryUsage + '%';
            }

            // Update PoE gauge + value label
            if (charts.poeGauge && currentDeviceData.poeUsage !== undefined) {
                charts.poeGauge.data.datasets[0].data = [currentDeviceData.poeUsage, 100 - currentDeviceData.poeUsage];
                charts.poeGauge.update();
                const poeValue = document.getElementById('poeValue');
                if (poeValue) poeValue.textContent = currentDeviceData.poeUsage + '%';
            }

            // Update CPU Sparkline
            if (charts.cpuSparkline && currentDeviceData.cpuTrend) {
                const sliced = TimelineManager.sliceData(currentDeviceData.cpuTrend.labels, currentDeviceData.cpuTrend.data);
                charts.cpuSparkline.data.labels = sliced.labels;
                charts.cpuSparkline.data.datasets[0].data = sliced.datasets[0];
                charts.cpuSparkline.update();
            }

            // Update Memory Sparkline
            if (charts.memSparkline && currentDeviceData.memoryTrend) {
                const sliced = TimelineManager.sliceData(currentDeviceData.memoryTrend.labels, currentDeviceData.memoryTrend.data);
                charts.memSparkline.data.labels = sliced.labels;
                charts.memSparkline.data.datasets[0].data = sliced.datasets[0];
                charts.memSparkline.update();
            }

            // Update PoE Sparkline
            if (charts.poeSparkline && currentDeviceData.poeTrend) {
                const sliced = TimelineManager.sliceData(currentDeviceData.poeTrend.labels, currentDeviceData.poeTrend.data);
                charts.poeSparkline.data.labels = sliced.labels;
                charts.poeSparkline.data.datasets[0].data = sliced.datasets[0];
                charts.poeSparkline.update();
            }

            // Update Traffic Trend
            if (charts.traffic && currentDeviceData.traffic) {
                const t = currentDeviceData.traffic;
                const sliced = TimelineManager.sliceData(t.labels, t.upload, t.download);
                charts.traffic.data.labels = sliced.labels;
                charts.traffic.data.datasets[0].data = sliced.datasets[0];
                charts.traffic.data.datasets[1].data = sliced.datasets[1];
                charts.traffic.update();
            }

            // Update Uplink Health
            if (charts.uplink && currentDeviceData.uplink) {
                const u = currentDeviceData.uplink;
                const sliced = TimelineManager.sliceData(u.labels, u.latency, u.jitter, u.loss);
                charts.uplink.data.labels = convertLabelsToTimestamps(sliced.labels);
                charts.uplink.data.datasets[0].data = sliced.datasets[0];
                charts.uplink.data.datasets[1].data = sliced.datasets[1];
                charts.uplink.data.datasets[2].data = sliced.datasets[2];
                charts.uplink.update();
            }

            // Update Traffic by Port (top 5)
            if (charts.trafficByPort && currentDeviceData.trafficByPort) {
                const tbp = currentDeviceData.trafficByPort;
                charts.trafficByPort.data.labels = tbp.labels;
                charts.trafficByPort.data.datasets[0].data = tbp.upload;
                charts.trafficByPort.data.datasets[1].data = tbp.download;
                charts.trafficByPort.update();
            }

            // Update Error Monitor
            if (charts.errorMonitor && currentDeviceData.errorMonitor) {
                const em = currentDeviceData.errorMonitor;
                charts.errorMonitor.data.labels = em.labels;
                charts.errorMonitor.data.datasets[0].data = em.data;
                charts.errorMonitor.data.datasets[0].backgroundColor = em.colors;
                charts.errorMonitor.update();
            }
        }

        // Re-render charts when timeline range changes
        TimelineManager.onChange(() => { if (currentDeviceData) updateChartsWithDeviceData(); });

        // --- TRAFFIC TRENDS OVERLAY ---
        let trafficTrendsChart = null;

        function openTrafficTrends() {
            const overlay = document.getElementById('trafficTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (trafficTrendsChart) {
                trafficTrendsChart.destroy();
            }

            // Use expanded traffic data from DataLoader
            const te = currentDeviceData && currentDeviceData.trafficExpanded;
            if (!te) return;

            // Slice according to timeline
            const tSliced = TimelineManager.sliceData(te.labels, te.upload, te.download);

            // Create the Traffic trend chart
            trafficTrendsChart = new Chart(document.getElementById('trafficTrendsChart'), {
                type: 'line',
                data: {
                    labels: tSliced.labels,
                    datasets: [
                        {
                            label: 'Upload (Tx)',
                            data: tSliced.datasets[0],
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
                            data: tSliced.datasets[1],
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

        function closeTrafficTrends() {
            const overlay = document.getElementById('trafficTrendsOverlay');
            overlay.classList.add('hidden');

            // Destroy chart to prevent memory leaks
            if (trafficTrendsChart) {
                trafficTrendsChart.destroy();
                trafficTrendsChart = null;
            }
        }

        // --- ERROR MONITOR EXPANDED OVERLAY ---
        let errorMonitorExpandedChart = null;

        function openErrorMonitorExpanded() {
            const overlay = document.getElementById('errorMonitorExpandedOverlay');
            overlay.classList.remove('hidden');

            if (errorMonitorExpandedChart) {
                errorMonitorExpandedChart.destroy();
            }

            // Use expanded error data from DataLoader
            const eme = currentDeviceData && currentDeviceData.errorMonitorExpanded;
            if (!eme) return;

            const errorLabels = eme.labels;
            const errorData = eme.data;
            const errorColors = eme.colors;

            errorMonitorExpandedChart = new Chart(document.getElementById('errorMonitorExpandedChart'), {
                type: 'bar',
                data: {
                    labels: errorLabels,
                    datasets: [{
                        label: 'Error Count',
                        data: errorData,
                        backgroundColor: errorColors,
                        borderRadius: 4
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#ef4444',
                            borderWidth: 1,
                            callbacks: {
                                label: function(context) {
                                    return 'Errors: ' + context.parsed.x;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: { display: true, text: 'Error Count', font: { size: 12 } },
                            ticks: { font: { size: 10 } },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        y: {
                            ticks: { font: { size: 11, family: 'monospace', weight: 'bold' } },
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        function closeErrorMonitorExpanded() {
            const overlay = document.getElementById('errorMonitorExpandedOverlay');
            overlay.classList.add('hidden');

            if (errorMonitorExpandedChart) {
                errorMonitorExpandedChart.destroy();
                errorMonitorExpandedChart = null;
            }
        }

        // --- TRAFFIC BY PORT EXPANDED OVERLAY ---
        let allPortsTrafficChart = null;

        function openTrafficByPortExpanded() {
            const overlay = document.getElementById('trafficByPortExpandedOverlay');
            overlay.classList.remove('hidden');

            if (allPortsTrafficChart) {
                allPortsTrafficChart.destroy();
            }

            // Use all ports traffic data from DataLoader
            const apt = currentDeviceData && currentDeviceData.allPortsTraffic;
            if (!apt) return;

            const trafficLabels = apt.labels;
            const uploadData = apt.upload;
            const downloadData = apt.download;

            allPortsTrafficChart = new Chart(document.getElementById('allPortsTrafficChart'), {
                type: 'bar',
                data: {
                    labels: trafficLabels,
                    datasets: [
                        {
                            label: 'Upload',
                            data: uploadData,
                            backgroundColor: '#6366f1',
                            borderRadius: 2
                        },
                        {
                            label: 'Download',
                            data: downloadData,
                            backgroundColor: '#10b981',
                            borderRadius: 2
                        }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { boxWidth: 12, font: { size: 11 } }
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
                                    if (label) label += ': ';
                                    label += context.parsed.x.toLocaleString() + ' MB';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: { display: true, text: 'Traffic (MB)', font: { size: 12 } },
                            ticks: {
                                callback: function(value) { return value.toLocaleString() + ' MB'; },
                                font: { size: 10 }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        y: {
                            ticks: { font: { size: 11, family: 'monospace', weight: 'bold' } },
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        function closeTrafficByPortExpanded() {
            const overlay = document.getElementById('trafficByPortExpandedOverlay');
            overlay.classList.add('hidden');

            if (allPortsTrafficChart) {
                allPortsTrafficChart.destroy();
                allPortsTrafficChart = null;
            }
        }

        // --- UPLINK HEALTH TRENDS OVERLAY ---
        let uplinkHealthTrendsChart = null;

        function openUplinkHealthTrends() {
            const overlay = document.getElementById('uplinkHealthTrendsOverlay');
            overlay.classList.remove('hidden');

            if (uplinkHealthTrendsChart) {
                uplinkHealthTrendsChart.destroy();
            }

            // Use expanded uplink data from DataLoader
            const ue = currentDeviceData && currentDeviceData.uplinkExpanded;
            if (!ue) return;

            // Slice according to timeline
            const uSliced = TimelineManager.sliceData(ue.labels, ue.latency, ue.jitter, ue.loss);
            const timeStamps = convertLabelsToTimestamps(uSliced.labels);

            uplinkHealthTrendsChart = new Chart(document.getElementById('uplinkHealthTrendsChart'), {
                type: 'line',
                data: {
                    labels: timeStamps,
                    datasets: [
                        {
                            label: 'Latency (ms)',
                            data: uSliced.datasets[0],
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#3b82f6',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Jitter (ms)',
                            data: uSliced.datasets[1],
                            borderColor: '#a855f7',
                            backgroundColor: 'rgba(168, 85, 247, 0.2)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#a855f7',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Packet Loss (%)',
                            data: uSliced.datasets[2],
                            borderColor: '#f87171',
                            backgroundColor: 'rgba(248, 113, 113, 0.2)',
                            borderWidth: 2,
                            pointRadius: 3,
                            pointHoverRadius: 6,
                            pointBackgroundColor: '#f87171',
                            pointBorderColor: '#fff',
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
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: { boxWidth: 12, font: { size: 12 }, padding: 15, usePointStyle: true }
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
                                    if (label) label += ': ';
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
                            time: { unit: 'hour', displayFormats: { hour: 'HH:mm' }, tooltipFormat: 'HH:mm' },
                            display: true,
                            grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
                            ticks: { maxRotation: 45, minRotation: 45, autoSkip: true, maxTicksLimit: 12, font: { size: 10 } }
                        },
                        y: {
                            type: 'linear', display: true, position: 'left', beginAtZero: true, suggestedMax: 3,
                            title: { display: true, text: 'Latency & Jitter (ms)', font: { size: 12 } },
                            ticks: { callback: function(value) { return value.toFixed(1) + ' ms'; }, font: { size: 10 } },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        y1: {
                            type: 'linear', display: true, position: 'right', beginAtZero: true, max: 1,
                            title: { display: true, text: 'Packet Loss (%)', font: { size: 12 } },
                            ticks: { callback: function(value) { return value.toFixed(1) + '%'; }, font: { size: 10 } },
                            grid: { drawOnChartArea: false }
                        }
                    }
                }
            });
        }

        function closeUplinkHealthTrends() {
            const overlay = document.getElementById('uplinkHealthTrendsOverlay');
            overlay.classList.add('hidden');

            if (uplinkHealthTrendsChart) {
                uplinkHealthTrendsChart.destroy();
                uplinkHealthTrendsChart = null;
            }
        }

        // Expose overlay functions to global scope for onclick handlers
        window.openTrafficTrends = openTrafficTrends;
        window.closeTrafficTrends = closeTrafficTrends;
        window.openErrorMonitorExpanded = openErrorMonitorExpanded;
        window.closeErrorMonitorExpanded = closeErrorMonitorExpanded;
        window.openTrafficByPortExpanded = openTrafficByPortExpanded;
        window.closeTrafficByPortExpanded = closeTrafficByPortExpanded;
        window.openUplinkHealthTrends = openUplinkHealthTrends;
        window.closeUplinkHealthTrends = closeUplinkHealthTrends;

        // Expose device management function for dropdown
        window.updateSwitchView = updateSwitchView;
