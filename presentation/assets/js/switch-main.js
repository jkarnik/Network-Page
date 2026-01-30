        // Initialize navigation for Switch page
        NavigationManager.init('switch');

        // --- SWITCH SELECTION HANDLER ---
        function updateSwitchView(switchName) {
            console.log('Switch view changed to:', switchName);
            // Update the device info card header
            document.querySelector('h2.text-lg.font-bold').textContent = switchName;

            // In a real application, this would reload the port data for the selected switch
            // For now, it just logs the change
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
            // Hide all tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });

            // Show selected tab content
            document.getElementById('content-' + tabName).classList.remove('hidden');

            // Update tab button styles
            document.querySelectorAll('.tab-button').forEach(button => {
                button.className = 'tab-button border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
            });

            document.getElementById('tab-' + tabName).className = 'tab-button border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm';
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

            // 8. Error Monitor - Horizontal Bar Chart
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

        // Register charts for theme switching
        themeManager.registerCharts(charts);

        // Initial theme check
        if (themeManager.isDarkMode()) {
            themeManager.updateChartColors();
        }

        // --- TRAFFIC TRENDS OVERLAY ---
        let trafficTrendsChart = null;

        function openTrafficTrends() {
            const overlay = document.getElementById('trafficTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (trafficTrendsChart) {
                trafficTrendsChart.destroy();
            }

            // Time labels for 24 hours
            const timeLabels = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

            // Hardcoded traffic data - consistent with minimized view pattern
            // Minimized shows last 6h: Tx [25, 30, 55, 45, 35, 40], Rx [120, 150, 450, 320, 250, 210]
            const trafficData = {
                upload: [18, 16, 15, 14, 15, 18, 22, 25, 35, 48, 55, 52, 48, 45, 50, 52, 48, 45, 40, 35, 32, 30, 35, 40],
                download: [140, 130, 120, 115, 118, 125, 140, 165, 250, 380, 450, 420, 380, 350, 360, 370, 340, 320, 280, 250, 230, 210, 200, 210]
            };

            // Create the Traffic trend chart
            trafficTrendsChart = new Chart(document.getElementById('trafficTrendsChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Upload (Tx)',
                            data: trafficData.upload,
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
                            data: trafficData.download,
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
        let allPortsTrafficChart = null;

        function openErrorMonitorExpanded() {
            const overlay = document.getElementById('errorMonitorExpandedOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing charts if they exist
            if (errorMonitorExpandedChart) {
                errorMonitorExpandedChart.destroy();
            }
            if (allPortsTrafficChart) {
                allPortsTrafficChart.destroy();
            }

            // Hardcoded error data for all ports with errors (expanded from top 5 summary)
            const errorLabels = ['Ge48', 'Ge3', 'Ge12', 'Ge27', 'Ge42', 'Ge15', 'Ge31', 'Ge8', 'Ge22', 'Ge36', 'Ge44', 'Ge19', 'Ge7', 'Ge33', 'Ge46'];
            const errorData = [487, 342, 156, 89, 52, 45, 38, 32, 28, 24, 19, 15, 12, 8, 5];
            const errorColors = ['#ef4444', '#ef4444', '#f97316', '#f97316', '#f59e0b', '#f59e0b', '#eab308', '#eab308', '#eab308', '#84cc16', '#84cc16', '#84cc16', '#22c55e', '#22c55e', '#22c55e'];

            // Create the expanded Error Monitor chart
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
                            title: {
                                display: true,
                                text: 'Error Count',
                                font: { size: 12 }
                            },
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

            // Hardcoded port traffic data (top 15 ports by download traffic)
            const trafficLabels = ['Ge48', 'Ge24', 'Ge12', 'Ge36', 'Ge8', 'Ge16', 'Ge32', 'Ge4', 'Ge20', 'Ge28', 'Ge40', 'Ge44', 'Ge6', 'Ge18', 'Ge30'];
            // Cumulative traffic in MB
            const uploadData = [18000, 2400, 2100, 1980, 1860, 1740, 1620, 1500, 1380, 1260, 1140, 1020, 900, 780, 660];
            const downloadData = [48000, 5400, 4800, 4500, 4200, 3900, 3600, 3300, 3000, 2700, 2400, 2100, 1800, 1500, 1200];

            // Create the all ports traffic chart
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
                            labels: {
                                boxWidth: 12,
                                font: { size: 11 }
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
                                    label += context.parsed.x.toLocaleString() + ' MB';
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            stacked: false,
                            title: {
                                display: true,
                                text: 'Traffic (MB)',
                                font: { size: 12 }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toLocaleString() + ' MB';
                                },
                                font: { size: 10 }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        y: {
                            stacked: false,
                            ticks: {
                                font: { size: 11, family: 'monospace', weight: 'bold' }
                            },
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        function closeErrorMonitorExpanded() {
            const overlay = document.getElementById('errorMonitorExpandedOverlay');
            overlay.classList.add('hidden');

            // Destroy charts to prevent memory leaks
            if (errorMonitorExpandedChart) {
                errorMonitorExpandedChart.destroy();
                errorMonitorExpandedChart = null;
            }
            if (allPortsTrafficChart) {
                allPortsTrafficChart.destroy();
                allPortsTrafficChart = null;
            }
        }

        // Expose new overlay functions to global scope for onclick handlers
        window.openTrafficTrends = openTrafficTrends;
        window.closeTrafficTrends = closeTrafficTrends;
        window.openErrorMonitorExpanded = openErrorMonitorExpanded;
        window.closeErrorMonitorExpanded = closeErrorMonitorExpanded;
