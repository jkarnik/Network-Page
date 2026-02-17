        // Initialize navigation for Summary page
        NavigationManager.init('summary');


        // --- 1. DATA CONFIGURATION & STATE MANAGEMENT ---
        // Data is now loaded from /data/network-data.json via DataLoader

        // Global Chart Instances
        let charts = {};
        let currentFilter = 'all'; // Alert filter (active fires, threats, etc)
        let currentScope = 'Global'; // Region Scope
        let currentSiteFilter = null; // Site-specific filter
        let isDevicesExpanded = false; // Track if Active Devices widget is expanded
        let currentDeviceFilter = 'all'; // Track current device type filter
        let isStatusExpanded = false; // Track if Status widget is expanded
        let currentStatusDeviceType = 'all'; // Track device type for status view
        let currentStatusFilter = 'all'; // Track status filter (online/warning/critical)
        let isIssuesExpanded = false; // Track if Network Issues widget is expanded
        let currentIssuesSeverity = 'all'; // Track severity filter for issues view
        let isSecurityExpanded = false; // Track if Security widget is expanded
        let currentSecurityType = 'all'; // Track security severity filter (crit/warn/info)
        let issuesSearchTerm = ''; // Search term for issues
        let issuesSortField = null; // Current sort field for issues
        let issuesSortAsc = true; // Sort direction for issues
        let issuesSiteFilterValue = 'all'; // Site filter for issues
        let securitySearchTerm = ''; // Search term for security alerts
        let securitySortField = null; // Current sort field for security
        let securitySortAsc = true; // Sort direction for security
        let securitySiteFilterValue = 'all'; // Site filter for security
        let clientsSearchTerm = ''; // Search term for client devices
        let statusSearchTerm = ''; // Search term for status devices

        // Severity sort order for consistent ranking
        const sevOrder = { crit: 0, warn: 1, info: 2 };

        function sortAlerts(alerts, field, asc) {
            if (!field) return alerts;
            return [...alerts].sort((a, b) => {
                let valA, valB;
                if (field === 'sev') {
                    valA = sevOrder[a.sev] ?? 3;
                    valB = sevOrder[b.sev] ?? 3;
                } else if (field === 'time') {
                    valA = a.time;
                    valB = b.time;
                } else if (field === 'site') {
                    valA = a.site.toLowerCase();
                    valB = b.site.toLowerCase();
                } else if (field === 'device') {
                    valA = a.device.toLowerCase();
                    valB = b.device.toLowerCase();
                } else {
                    return 0;
                }
                if (valA < valB) return asc ? -1 : 1;
                if (valA > valB) return asc ? 1 : -1;
                return 0;
            });
        }

        // --- 2. LOGIC FUNCTIONS ---

        function getFilteredData(scope, siteFilter = null) {
            // Determine if this is a site-level filter
            const isSiteFilter = siteFilter !== null;
            const effectiveScope = isSiteFilter ? siteFilter : scope;

            // Get frustration data from DataLoader
            const frustrationData = DataLoader.getFrustrationData(effectiveScope, 5);
            const fData = frustrationData.map(d => ({
                label: d.label,
                region: d.region,
                val: d.totalTime,
                breakdown: d.breakdown
            }));

            // Get latency data from DataLoader
            const latencyData = DataLoader.getLatencyData(effectiveScope, 5);
            const lData = latencyData.map(d => ({
                label: d.label,
                region: d.region,
                val: d.latency
            }));

            // Get alerts from DataLoader
            const aData = DataLoader.getAlertsByScope(effectiveScope).map(a => ({
                sev: a.severity,
                vendor: a.vendor,
                site: a.site,
                region: a.region,
                device: a.device,
                msg: a.message,
                time: a.timeAgo,
                type: a.type
            }));

            // Get device stats from DataLoader
            const gwStats = DataLoader.getDeviceStatusCounts('gateways', effectiveScope);
            const swStats = DataLoader.getDeviceStatusCounts('switches', effectiveScope);
            const apStats = DataLoader.getDeviceStatusCounts('accessPoints', effectiveScope);

            const stats = {
                gateway: { online: gwStats.online, warn: gwStats.warn, crit: gwStats.crit },
                switch: { online: swStats.online, warn: swStats.warn, crit: swStats.crit },
                ap: { online: apStats.online, warn: apStats.warn, crit: apStats.crit }
            };

            const totalCrit = aData.filter(a => a.sev === 'crit').length;
            const totalWarn = aData.filter(a => a.sev === 'warn').length;

            // Get security stats from DataLoader
            const securityCounts = DataLoader.getSecurityCounts(effectiveScope);

            return { fData, lData, aData, stats, totalCrit, totalWarn, securityCrit: securityCounts.crit, securityWarn: securityCounts.warn };
        }

        function updateDashboardScope(scope) {
            // Check if this is a site-specific filter
            let isSiteScope = false;
            let siteName = null;

            if (scope.startsWith('site:')) {
                isSiteScope = true;
                siteName = scope.substring(5); // Remove 'site:' prefix
                currentScope = DataLoader.getRegionForSite(siteName); // Set scope to parent region
                currentSiteFilter = siteName;
            } else {
                currentScope = scope;
                currentSiteFilter = null;
            }

            const data = getFilteredData(currentScope, siteName);
            const scopeInfo = DataLoader.getMetrics(isSiteScope ? siteName : currentScope);

            // 1. Update Big Numbers
            document.getElementById('criticalCount').innerText = data.totalCrit;
            document.getElementById('warningCount').innerText = data.totalWarn;
            document.getElementById('securityCritCount').innerText = data.securityCrit;
            document.getElementById('securityWarnCount').innerText = data.securityWarn;

            // 3. Update Active Device Counts by Type (from actual device data)
            const effectiveScopeForDevices = isSiteScope ? siteName : currentScope;
            const gwCount = DataLoader.getDevicesByScope(effectiveScopeForDevices, 'gateways').length;
            const swCount = DataLoader.getDevicesByScope(effectiveScopeForDevices, 'switches').length;
            const apCount = DataLoader.getDevicesByScope(effectiveScopeForDevices, 'accessPoints').length;

            document.getElementById('gwClientCount').innerText = gwCount.toLocaleString();
            document.getElementById('swClientCount').innerText = swCount.toLocaleString();
            document.getElementById('apClientCount').innerText = apCount.toLocaleString();

            // Set trends (from scope metrics)
            const baseTrend = parseFloat(scopeInfo.trend) || 0;
            document.getElementById('gwClientTrend').innerText = (baseTrend * 0.5).toFixed(1) + '%';
            document.getElementById('swClientTrend').innerText = (baseTrend * 1.2).toFixed(1) + '%';
            document.getElementById('apClientTrend').innerText = (baseTrend * 0.9).toFixed(1) + '%';

            // 4. Update WAN Donut from DataLoader
            const wanData = DataLoader.getWanResilience(isSiteScope ? siteName : currentScope);
            charts.wan.data.datasets[0].data = [wanData.primary, wanData.failover, wanData.down];
            charts.wan.update();
            document.getElementById('wanPrimary').innerText = wanData.primary + '%';
            document.getElementById('wanFailover').innerText = wanData.failover + '%';
            document.getElementById('wanDown').innerText = wanData.down + '%';

            // 5. Update Frustration Chart
            // Data is already sorted descending (highest first), which displays at the top in horizontal bar charts
            charts.frustration.data.labels = data.fData.map(d => d.label);
            // Split the total time into 4 components with consistent percentages to maintain ordering
            charts.frustration.data.datasets[0].data = data.fData.map(d => {
                return Math.floor(d.val * 0.35); // 35% Association
            });
            charts.frustration.data.datasets[1].data = data.fData.map(d => {
                return Math.floor(d.val * 0.25); // 25% Auth
            });
            charts.frustration.data.datasets[2].data = data.fData.map(d => {
                return Math.floor(d.val * 0.25); // 25% DHCP
            });
            charts.frustration.data.datasets[3].data = data.fData.map(d => {
                return Math.floor(d.val * 0.15); // 15% DNS Resolution
            });
            charts.frustration.update();

            // 6. Update Latency Chart
            charts.latency.data.labels = data.lData.map(d => d.label);
            charts.latency.data.datasets[0].data = data.lData.map(d => d.val);
            charts.latency.update();

            // 7. Update Status Matrix
            document.getElementById('gw-online').innerText = data.stats.gateway.online;
            document.getElementById('gw-warn').innerText = data.stats.gateway.warn;
            document.getElementById('gw-crit').innerText = data.stats.gateway.crit;
            document.getElementById('sw-online').innerText = data.stats.switch.online;
            document.getElementById('sw-warn').innerText = data.stats.switch.warn;
            document.getElementById('sw-crit').innerText = data.stats.switch.crit;
            document.getElementById('ap-online').innerText = data.stats.ap.online;
            document.getElementById('ap-warn').innerText = data.stats.ap.warn;
            document.getElementById('ap-crit').innerText = data.stats.ap.crit;

            // 8. Update Alerts
            renderTable(currentFilter, data.aData);
        }

        // --- 3. CHART INITIALIZATION ---

        function initCharts() {
            // Initialize Chart.js defaults using shared config
            ChartConfig.initDefaults();

            // A. Frustration
            const frustrationCanvas = document.getElementById('frustrationChart');
            charts.frustration = new Chart(frustrationCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [
                        { label: 'Association', data: [], backgroundColor: '#dc2626', borderRadius: 4 },
                        { label: 'Auth', data: [], backgroundColor: '#ea580c', borderRadius: 4 },
                        { label: 'DHCP', data: [], backgroundColor: '#f59e0b', borderRadius: 4 },
                        { label: 'DNS Resolution', data: [], backgroundColor: '#16a34a', borderRadius: 4 }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    onClick: (event, elements, chart) => {
                        // Only filter if clicking on a bar, not legend
                        if (elements.length > 0 && elements[0].datasetIndex !== undefined) {
                            const index = elements[0].index;
                            const siteName = chart.data.labels[index];
                            filterBySite(siteName);
                        }
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                boxWidth: 12,
                                padding: 8,
                                font: { size: 10 }
                            },
                            onClick: () => {} // Disable legend click
                        },
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    return context[0].label + ' (click to filter)';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            beginAtZero: true,
                            grid: { display: true, borderDash: [2, 2] },
                            title: { display: true, text: 'Time (ms)', font: { size: 10 } }
                        },
                        y: {
                            stacked: true,
                            grid: { display: false }
                        }
                    }
                }
            });

            // C. Latency
            const latencyCanvas = document.getElementById('latencyChart');
            charts.latency = new Chart(latencyCanvas.getContext('2d'), {
                type: 'bar',
                data: { labels: [], datasets: [{ label: 'Latency (ms)', data: [], backgroundColor: '#6366f1', borderRadius: 4 }] },
                options: {
                    indexAxis: 'y',
                    onClick: (event, elements, chart) => {
                        // Only filter if clicking on a bar
                        if (elements.length > 0 && elements[0].datasetIndex !== undefined) {
                            const index = elements[0].index;
                            const siteName = chart.data.labels[index];
                            filterBySite(siteName);
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    return context[0].label + ' (click to filter)';
                                }
                            }
                        }
                    },
                    scales: {
                        x: { beginAtZero: true, grid: { display: true, borderDash: [2, 2] } },
                        y: {
                            grid: { display: false }
                        }
                    }
                }
            });

            // D. WAN
            charts.wan = new Chart(document.getElementById('wanDonut').getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Primary', 'Backup', 'Down'],
                    datasets: [{ data: [91, 8, 1], backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444'], borderWidth: 0, cutout: '70%' }]
                },
                options: { plugins: { legend: { display: false } } }
            });

            // E. Sparklines for each device type
            charts.gwSpark = new Chart(document.getElementById('gwSparkline').getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['6h', '5h', '4h', '3h', '2h', '1h', 'Now'],
                    datasets: [{ data: [3000, 3050, 3100, 3150, 3180, 3190, 3200], borderColor: '#3b82f6', borderWidth: 2, tension: 0.4, pointRadius: 0 }]
                },
                options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }
            });

            charts.swSpark = new Chart(document.getElementById('swSparkline').getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['6h', '5h', '4h', '3h', '2h', '1h', 'Now'],
                    datasets: [{ data: [7200, 7300, 7450, 7600, 7700, 7750, 7800], borderColor: '#9333ea', borderWidth: 2, tension: 0.4, pointRadius: 0 }]
                },
                options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }
            });

            charts.apSpark = new Chart(document.getElementById('apSparkline').getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['6h', '5h', '4h', '3h', '2h', '1h', 'Now'],
                    datasets: [{ data: [4050, 4100, 4150, 4200, 4280, 4310, 4342], borderColor: '#16a34a', borderWidth: 2, tension: 0.4, pointRadius: 0 }]
                },
                options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }
            });
        }

        // --- 4. ALERT TABLE LOGIC ---

        const sevStyles = SharedUI.SEV_STYLES_SUMMARY;
        const sevIcons = SharedUI.SEV_ICONS;

        function renderTable(filter, alertsOverride = null) {
            const tableBody = document.getElementById('alertTableBody');
            tableBody.innerHTML = '';

            // Determine active alerts source (current scope vs passed override)
            let alertsToFilter = alertsOverride || getFilteredData(currentScope).aData;

            const badge = document.getElementById('activeFilterBadge');
            // Determine what badges to show
            let badgeText = '';
            if (currentSiteFilter) {
                badgeText = `Site: ${currentSiteFilter}`;
            }
            if (filter !== 'all') {
                if (badgeText) badgeText += ' | ';
                if (filter === 'fires') badgeText += 'Active Fires';
                if (filter === 'threat') badgeText += 'Security Threats';
                if (filter === 'rogue') badgeText += 'Rogue Devices';
            }

            if (badgeText) {
                badge.classList.remove('hidden');
                badge.textContent = badgeText;
            } else {
                badge.classList.add('hidden');
                badge.textContent = '';
            }

            const filteredAlerts = alertsToFilter.filter(a => {
                // Apply alert type filter (site filter already applied in getFilteredData)
                if (filter === 'all') return true;
                if (filter === 'fires') return a.sev === 'crit' || a.sev === 'warn';
                if (filter === 'threat') return a.type === 'threat';
                if (filter === 'rogue') return a.type === 'rogue';
                return true;
            });

            if (filteredAlerts.length === 0) {
                 const row = document.createElement('tr');
                 row.innerHTML = `<td colspan="6" class="px-6 py-4 text-center text-sm text-gray-400">No alerts found for this criteria in ${currentScope}.</td>`;
                 tableBody.appendChild(row);
                 return;
            }

            filteredAlerts.forEach(alert => {
                const row = document.createElement('tr');
                row.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors";
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="${sevStyles[alert.sev]} flex items-center gap-1 w-fit">
                            ${sevIcons[alert.sev]} ${alert.sev.toUpperCase()}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-xs text-dark-muted">${alert.time}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-dark-muted">
                        <div class="flex items-center gap-2">
                            ${alert.vendor === 'meraki'
                                ? '<img src="images/cisco-logo.svg" class="h-4 w-auto opacity-70" alt="Meraki">'
                                : '<img src="images/juniper-logo.svg" class="h-3 w-auto opacity-70" alt="Mist">'}
                            <span class="capitalize text-xs font-medium">${alert.vendor}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${alert.site}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <a href="${getDevicePageUrl(alert.device)}" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium hover:underline">${alert.device}</a>
                    </td>
                    <td class="px-6 py-4 text-sm text-dark-muted truncate max-w-xs" title="${alert.msg}">${alert.msg}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        // Action Handlers
        function filterAlerts(type) {
            // If clicking the same filter, toggle off
            if (currentFilter === type) {
                currentFilter = 'all';
            } else {
                currentFilter = type;
            }

            renderTable(currentFilter);
        }

        function filterBySite(siteName) {
            // Extract site name without vendor info (e.g., "NYC-HQ (Mist)" -> "NYC-HQ")
            const cleanSiteName = siteName.split(' (')[0];

            // Toggle site filter
            if (currentSiteFilter === cleanSiteName) {
                // Clear filter - go back to global
                currentSiteFilter = null;
                document.getElementById('scopeSelector').value = 'Global';
                updateDashboardScope('Global');
            } else {
                // Apply site filter
                document.getElementById('scopeSelector').value = 'site:' + cleanSiteName;
                updateDashboardScope('site:' + cleanSiteName);
            }
        }

        // --- DEVICE LIST FUNCTIONS ---

        function getDevicePageUrl(deviceName) {
            // Find the device to get its ID
            const device = DataLoader.getDeviceByName(deviceName);
            const deviceId = device ? device.id : deviceName.toLowerCase().replace(/\s+/g, '-');

            // Determine device type from name prefix
            const prefix = deviceName.substring(0, 3);
            if (prefix === 'GW-') {
                return `sdwan.html?device=${deviceId}`;
            } else if (prefix === 'SW-') {
                return `switch.html?device=${deviceId}`;
            } else if (prefix === 'AP-') {
                return `access-point.html?device=${deviceId}`;
            }
            return '#'; // Fallback
        }

        function closeExpandedWidgets() {
            if (isDevicesExpanded) {
                hideDeviceList();
            }
            if (isStatusExpanded) {
                hideStatusDevices();
            }
            if (isIssuesExpanded) {
                hideIssuesAlerts();
            }
            if (isSecurityExpanded) {
                hideSecurityAlerts();
            }
        }

        function showDeviceList(deviceType) {
            // Close other widgets if open
            if (isStatusExpanded) {
                hideStatusDevices();
            }
            if (isIssuesExpanded) {
                hideIssuesAlerts();
            }
            if (isSecurityExpanded) {
                hideSecurityAlerts();
            }

            const summaryView = document.getElementById('summaryView');
            const expandedView = document.getElementById('expandedView');
            const card = document.getElementById('activeDevicesCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            // Expand the card to overlay mode
            card.classList.add('expanded');
            backdrop.classList.add('active');
            mainContent.style.overflow = 'hidden';
            isDevicesExpanded = true;

            summaryView.classList.add('hidden');
            expandedView.classList.remove('hidden');

            // Update title
            const titles = {
                'gateway': 'Gateway Devices',
                'switch': 'Switch Devices',
                'ap': 'Access Point Devices',
                'all': 'All Devices'
            };
            document.getElementById('deviceListTitle').innerText = titles[deviceType] || 'Devices';

            // Set initial filter
            currentDeviceFilter = deviceType;
            updateDeviceFilterButtons(deviceType);
            renderDeviceList(deviceType);
        }

        function hideDeviceList() {
            const summaryView = document.getElementById('summaryView');
            const expandedView = document.getElementById('expandedView');
            const card = document.getElementById('activeDevicesCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            // Collapse back
            card.classList.remove('expanded');
            backdrop.classList.remove('active');
            mainContent.style.overflow = '';
            isDevicesExpanded = false;

            summaryView.classList.remove('hidden');
            expandedView.classList.add('hidden');
        }

        function filterDevices(deviceType) {
            currentDeviceFilter = deviceType;
            updateDeviceFilterButtons(deviceType);
            renderDeviceList(deviceType);
        }

        function searchDeviceList() {
            clientsSearchTerm = document.getElementById('clientsSearchInput').value;
            renderDeviceList(currentDeviceFilter);
        }

        function updateDeviceFilterButtons(activeFilter) {
            // Reset all buttons
            const buttons = ['filterAll', 'filterGateway', 'filterSwitch', 'filterAp'];
            buttons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                btn.className = 'px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';
            });

            // Activate selected button
            const activeMap = {
                'all': 'filterAll',
                'gateway': 'filterGateway',
                'switch': 'filterSwitch',
                'ap': 'filterAp'
            };

            const activeBtn = document.getElementById(activeMap[activeFilter]);
            if (activeBtn) {
                activeBtn.className = 'px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors';
            }
        }

        function renderDeviceList(deviceType) {
            const container = document.getElementById('deviceListContainer');
            const deviceCountEl = document.getElementById('deviceCount');
            container.innerHTML = '';

            // Gather devices based on filter using DataLoader
            let devices = [];
            const typeMap = { 'gateway': 'gateways', 'switch': 'switches', 'ap': 'accessPoints' };
            if (deviceType === 'all') {
                devices = DataLoader.getAllDevices();
            } else {
                devices = DataLoader.getDevices(typeMap[deviceType]) || [];
            }

            // Apply site filter if active
            if (currentSiteFilter) {
                devices = devices.filter(d => d.site === currentSiteFilter);
            }

            // Apply search filter
            if (clientsSearchTerm) {
                const searchLower = clientsSearchTerm.toLowerCase();
                devices = devices.filter(d =>
                    d.name.toLowerCase().includes(searchLower) ||
                    d.site.toLowerCase().includes(searchLower) ||
                    d.ip.toLowerCase().includes(searchLower)
                );
            }

            // Sort by clients (descending)
            devices.sort((a, b) => b.clients - a.clients);

            // Update device count
            deviceCountEl.innerText = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;

            // Render device cards
            devices.forEach(device => {
                const statusColors = {
                    'online': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    'warning': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                    'critical': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                };

                const statusIcons = {
                    'online': 'fa-circle-check',
                    'warning': 'fa-circle-exclamation',
                    'critical': 'fa-circle-xmark'
                };

                const deviceTypeIcons = {
                    'GW-': { icon: 'fa-network-wired', color: 'text-newrelic-cyan' },
                    'SW-': { icon: 'fa-server', color: 'text-purple-600 dark:text-purple-400' },
                    'AP-': { icon: 'fa-wifi', color: 'text-newrelic-success dark:text-green-400' }
                };

                const prefix = device.name.substring(0, 3);
                const iconInfo = deviceTypeIcons[prefix] || { icon: 'fa-circle', color: 'text-gray-600' };

                const deviceCard = document.createElement('div');
                deviceCard.className = 'bg-gray-50 dark:bg-gray-800 p-4 rounded-xl hover:shadow-md hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800';
                deviceCard.innerHTML = `
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
                                <i class="fa-solid ${iconInfo.icon} ${iconInfo.color} text-lg"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-bold text-gray-900 dark:text-white truncate mb-0.5">${device.name}</div>
                                <div class="text-xs text-dark-muted">${device.site}</div>
                            </div>
                        </div>
                        <span class="px-2 py-1 text-[10px] rounded-lg font-semibold ${statusColors[device.status]} flex items-center gap-1">
                            <i class="fa-solid ${statusIcons[device.status]}"></i>
                            ${device.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div class="flex items-center gap-2 text-xs text-dark-muted">
                            <i class="fa-solid fa-network-wired text-[10px]"></i>
                            <span>${device.ip}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <i class="fa-solid fa-users text-newrelic-cyan text-xs"></i>
                            <span class="text-sm font-bold text-gray-900 dark:text-white">${device.clients}</span>
                            <span class="text-[10px] text-dark-muted">clients</span>
                        </div>
                    </div>
                `;
                deviceCard.onclick = () => {
                    window.location.href = getDevicePageUrl(device.name);
                };
                container.appendChild(deviceCard);
            });

            // Show "no devices" message if empty
            if (devices.length === 0) {
                container.innerHTML = '<div class="col-span-full text-center text-sm text-gray-400 py-12">No devices found</div>';
            }
        }

        // --- STATUS WIDGET FUNCTIONS ---

        function showStatusDevices(deviceType, status) {
            // Close other widgets if open
            if (isDevicesExpanded) {
                hideDeviceList();
            }
            if (isIssuesExpanded) {
                hideIssuesAlerts();
            }
            if (isSecurityExpanded) {
                hideSecurityAlerts();
            }

            const statusSummaryView = document.getElementById('statusSummaryView');
            const statusExpandedView = document.getElementById('statusExpandedView');
            const card = document.getElementById('deviceStatusCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            // Expand the card to overlay mode
            card.classList.add('expanded');
            backdrop.classList.add('active');
            mainContent.style.overflow = 'hidden';
            isStatusExpanded = true;

            statusSummaryView.classList.add('hidden');
            statusExpandedView.classList.remove('hidden');

            // Set the filters
            currentStatusDeviceType = deviceType;
            currentStatusFilter = status;

            updateStatusFilterButtons(status, deviceType);
            renderStatusDeviceList();
        }

        function hideStatusDevices() {
            const statusSummaryView = document.getElementById('statusSummaryView');
            const statusExpandedView = document.getElementById('statusExpandedView');
            const card = document.getElementById('deviceStatusCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            // Collapse back
            card.classList.remove('expanded');
            backdrop.classList.remove('active');
            mainContent.style.overflow = '';
            isStatusExpanded = false;

            statusSummaryView.classList.remove('hidden');
            statusExpandedView.classList.add('hidden');
        }

        function filterStatusDevices(status) {
            currentStatusFilter = status;
            updateStatusFilterButtons(status, currentStatusDeviceType);
            renderStatusDeviceList();
        }

        function filterStatusDeviceType(deviceType) {
            currentStatusDeviceType = deviceType;
            updateStatusFilterButtons(currentStatusFilter, deviceType);
            renderStatusDeviceList();
        }

        function searchStatusDevices() {
            statusSearchTerm = document.getElementById('statusSearchInput').value;
            renderStatusDeviceList();
        }

        function updateStatusFilterButtons(activeStatusFilter, activeTypeFilter) {
            const inactiveClass = 'px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';
            const activeClass = 'px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors';

            // Health filter buttons
            const healthButtons = ['statusFilterAll', 'statusFilterOnline', 'statusFilterWarning', 'statusFilterCritical'];
            const healthMap = { 'all': 'statusFilterAll', 'online': 'statusFilterOnline', 'warning': 'statusFilterWarning', 'critical': 'statusFilterCritical' };
            healthButtons.forEach(id => { document.getElementById(id).className = inactiveClass; });
            const activeHealthBtn = document.getElementById(healthMap[activeStatusFilter]);
            if (activeHealthBtn) activeHealthBtn.className = activeClass;

            // Device type filter buttons
            const typeButtons = ['typeFilterAll', 'typeFilterGateway', 'typeFilterSwitch', 'typeFilterAp'];
            const typeMap = { 'all': 'typeFilterAll', 'gateway': 'typeFilterGateway', 'switch': 'typeFilterSwitch', 'ap': 'typeFilterAp' };
            typeButtons.forEach(id => { document.getElementById(id).className = inactiveClass; });
            const activeTypeBtn = document.getElementById(typeMap[activeTypeFilter]);
            if (activeTypeBtn) activeTypeBtn.className = activeClass;
        }

        function renderStatusDeviceList() {
            const container = document.getElementById('statusDeviceListContainer');
            const deviceCountEl = document.getElementById('statusDeviceCount');
            container.innerHTML = '';

            // Get devices based on type using DataLoader
            let devices = [];
            const typeMap = { 'gateway': 'gateways', 'switch': 'switches', 'ap': 'accessPoints' };
            if (currentStatusDeviceType === 'all') {
                devices = DataLoader.getAllDevices();
            } else {
                devices = DataLoader.getDevices(typeMap[currentStatusDeviceType]) || [];
            }

            // Apply site filter if active
            if (currentSiteFilter) {
                devices = devices.filter(d => d.site === currentSiteFilter);
            }

            // Apply status filter
            if (currentStatusFilter !== 'all') {
                devices = devices.filter(d => d.status === currentStatusFilter);
            }

            // Apply search filter
            if (statusSearchTerm) {
                const searchLower = statusSearchTerm.toLowerCase();
                devices = devices.filter(d =>
                    d.name.toLowerCase().includes(searchLower) ||
                    d.site.toLowerCase().includes(searchLower) ||
                    d.ip.toLowerCase().includes(searchLower)
                );
            }

            // Sort by clients (descending)
            devices.sort((a, b) => b.clients - a.clients);

            // Update device count
            deviceCountEl.innerText = `${devices.length} device${devices.length !== 1 ? 's' : ''}`;

            // Render device cards (reuse the same rendering logic)
            devices.forEach(device => {
                const statusColors = {
                    'online': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    'warning': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                    'critical': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                };

                const statusIcons = {
                    'online': 'fa-circle-check',
                    'warning': 'fa-circle-exclamation',
                    'critical': 'fa-circle-xmark'
                };

                const deviceTypeIcons = {
                    'GW-': { icon: 'fa-network-wired', color: 'text-newrelic-cyan' },
                    'SW-': { icon: 'fa-server', color: 'text-purple-600 dark:text-purple-400' },
                    'AP-': { icon: 'fa-wifi', color: 'text-newrelic-success dark:text-green-400' }
                };

                const prefix = device.name.substring(0, 3);
                const iconInfo = deviceTypeIcons[prefix] || { icon: 'fa-circle', color: 'text-gray-600' };

                const deviceCard = document.createElement('div');
                deviceCard.className = 'bg-gray-50 dark:bg-gray-800 p-4 rounded-xl hover:shadow-md hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800';
                deviceCard.innerHTML = `
                    <div class="flex items-start justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm">
                                <i class="fa-solid ${iconInfo.icon} ${iconInfo.color} text-lg"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-bold text-gray-900 dark:text-white truncate mb-0.5">${device.name}</div>
                                <div class="text-xs text-dark-muted">${device.site}</div>
                            </div>
                        </div>
                        <span class="px-2 py-1 text-[10px] rounded-lg font-semibold ${statusColors[device.status]} flex items-center gap-1">
                            <i class="fa-solid ${statusIcons[device.status]}"></i>
                            ${device.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div class="flex items-center gap-2 text-xs text-dark-muted">
                            <i class="fa-solid fa-network-wired text-[10px]"></i>
                            <span>${device.ip}</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <i class="fa-solid fa-users text-newrelic-cyan text-xs"></i>
                            <span class="text-sm font-bold text-gray-900 dark:text-white">${device.clients}</span>
                            <span class="text-[10px] text-dark-muted">clients</span>
                        </div>
                    </div>
                `;
                deviceCard.onclick = () => {
                    window.location.href = getDevicePageUrl(device.name);
                };
                container.appendChild(deviceCard);
            });

            // Show "no devices" message if empty
            if (devices.length === 0) {
                container.innerHTML = '<div class="col-span-full text-center text-sm text-gray-400 py-12">No devices found</div>';
            }
        }

        // --- NETWORK ISSUES WIDGET FUNCTIONS ---

        function showIssuesAlerts(severity) {
            // Close other widgets if open
            if (isDevicesExpanded) {
                hideDeviceList();
            }
            if (isStatusExpanded) {
                hideStatusDevices();
            }

            const issuesSummaryView = document.getElementById('issuesSummaryView');
            const issuesExpandedView = document.getElementById('issuesExpandedView');
            const card = document.getElementById('networkIssuesCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            // Expand the card to overlay mode
            card.classList.add('expanded');
            backdrop.classList.add('active');
            mainContent.style.overflow = 'hidden';
            isIssuesExpanded = true;

            issuesSummaryView.classList.add('hidden');
            issuesExpandedView.classList.remove('hidden');

            // Set the filter
            currentIssuesSeverity = severity;

            document.getElementById('issuesAlertTitle').innerText = 'Network Alerts';

            // Reset sort/filter state
            issuesSortField = null;
            issuesSortAsc = true;
            issuesSiteFilterValue = 'all';

            updateIssuesFilterButtons(severity);
            renderIssuesAlertTable();
        }

        function hideIssuesAlerts() {
            const issuesSummaryView = document.getElementById('issuesSummaryView');
            const issuesExpandedView = document.getElementById('issuesExpandedView');
            const card = document.getElementById('networkIssuesCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            // Collapse back
            card.classList.remove('expanded');
            backdrop.classList.remove('active');
            mainContent.style.overflow = '';
            isIssuesExpanded = false;

            issuesSummaryView.classList.remove('hidden');
            issuesExpandedView.classList.add('hidden');
        }

        function filterIssuesAlerts(severity) {
            currentIssuesSeverity = severity;
            updateIssuesFilterButtons(severity);
            renderIssuesAlertTable();
        }

        function updateIssuesFilterButtons(activeFilter) {
            // Reset all buttons
            const buttons = ['issuesFilterAll', 'issuesFilterCrit', 'issuesFilterWarn', 'issuesFilterInfo'];
            buttons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                btn.className = 'px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';
            });

            // Activate selected button
            const activeMap = {
                'all': 'issuesFilterAll',
                'crit': 'issuesFilterCrit',
                'warn': 'issuesFilterWarn',
                'info': 'issuesFilterInfo'
            };

            const activeBtn = document.getElementById(activeMap[activeFilter]);
            if (activeBtn) {
                activeBtn.className = 'px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors';
            }
        }

        function renderIssuesAlertTable() {
            const tableBody = document.getElementById('issuesAlertTableBody');
            const alertCountEl = document.getElementById('issuesAlertCount');
            tableBody.innerHTML = '';

            // Get alerts from current scope
            const data = getFilteredData(currentScope, currentSiteFilter);
            let alerts = data.aData;

            // Populate site filter dropdown (before filtering by site)
            populateIssuesSiteFilter(alerts);

            // Apply severity filter
            if (currentIssuesSeverity !== 'all') {
                alerts = alerts.filter(a => a.sev === currentIssuesSeverity);
            }

            // Apply site filter
            if (issuesSiteFilterValue !== 'all') {
                alerts = alerts.filter(a => a.site === issuesSiteFilterValue);
            }

            // Apply search filter
            if (issuesSearchTerm) {
                const searchLower = issuesSearchTerm.toLowerCase();
                alerts = alerts.filter(a =>
                    a.site.toLowerCase().includes(searchLower) ||
                    a.device.toLowerCase().includes(searchLower) ||
                    a.msg.toLowerCase().includes(searchLower)
                );
            }

            // Apply sorting
            alerts = sortAlerts(alerts, issuesSortField, issuesSortAsc);

            // Update alert count
            alertCountEl.innerText = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;

            if (alerts.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="5" class="px-4 py-4 text-center text-sm text-gray-400">No alerts found for this criteria.</td>`;
                tableBody.appendChild(row);
                return;
            }

            alerts.forEach(alert => {
                const row = document.createElement('tr');
                row.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors";
                row.innerHTML = `
                    <td class="px-4 py-3 whitespace-nowrap">
                        <span class="${sevStyles[alert.sev]} flex items-center gap-1 w-fit">
                            ${sevIcons[alert.sev]} ${alert.sev.toUpperCase()}
                        </span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-xs text-dark-muted">${alert.time}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${alert.site}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">
                        <a href="${getDevicePageUrl(alert.device)}" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium hover:underline">${alert.device}</a>
                    </td>
                    <td class="px-4 py-3 text-sm text-dark-muted truncate max-w-xs" title="${alert.msg}">${alert.msg}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        function searchIssuesAlerts() {
            issuesSearchTerm = document.getElementById('issuesSearchInput').value;
            renderIssuesAlertTable();
        }

        function sortIssuesAlerts(field) {
            if (issuesSortField === field) {
                issuesSortAsc = !issuesSortAsc;
            } else {
                issuesSortField = field;
                issuesSortAsc = true;
            }
            renderIssuesAlertTable();
        }

        function filterIssuesBySite(site) {
            issuesSiteFilterValue = site;
            renderIssuesAlertTable();
        }

        function populateIssuesSiteFilter(alerts) {
            const select = document.getElementById('issuesSiteFilter');
            const currentValue = select.value;
            const sites = [...new Set(alerts.map(a => a.site))].sort();
            select.innerHTML = '<option value="all">All Sites</option>';
            sites.forEach(site => {
                select.innerHTML += `<option value="${site}"${site === currentValue ? ' selected' : ''}>${site}</option>`;
            });
            select.value = issuesSiteFilterValue === 'all' || sites.includes(issuesSiteFilterValue) ? issuesSiteFilterValue : 'all';
        }

        // --- SECURITY POSTURE WIDGET FUNCTIONS ---

        function showSecurityAlerts(securityType) {
            // Close other widgets if open
            if (isDevicesExpanded) {
                hideDeviceList();
            }
            if (isStatusExpanded) {
                hideStatusDevices();
            }
            if (isIssuesExpanded) {
                hideIssuesAlerts();
            }

            const securitySummaryView = document.getElementById('securitySummaryView');
            const securityExpandedView = document.getElementById('securityExpandedView');
            const card = document.getElementById('securityCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            // Expand the card to overlay mode
            card.classList.add('expanded');
            backdrop.classList.add('active');
            mainContent.style.overflow = 'hidden';
            isSecurityExpanded = true;

            securitySummaryView.classList.add('hidden');
            securityExpandedView.classList.remove('hidden');

            // Set the filter
            currentSecurityType = securityType;

            // Update title
            document.getElementById('securityAlertTitle').innerText = 'Security Alerts';

            // Reset sort/filter state
            securitySortField = null;
            securitySortAsc = true;
            securitySiteFilterValue = 'all';

            updateSecurityFilterButtons(securityType);
            renderSecurityAlertTable();
        }

        function hideSecurityAlerts() {
            const securitySummaryView = document.getElementById('securitySummaryView');
            const securityExpandedView = document.getElementById('securityExpandedView');
            const card = document.getElementById('securityCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            // Collapse back
            card.classList.remove('expanded');
            backdrop.classList.remove('active');
            mainContent.style.overflow = '';
            isSecurityExpanded = false;

            securitySummaryView.classList.remove('hidden');
            securityExpandedView.classList.add('hidden');
        }

        function filterSecurityAlerts(securityType) {
            currentSecurityType = securityType;
            updateSecurityFilterButtons(securityType);
            renderSecurityAlertTable();
        }

        function updateSecurityFilterButtons(activeFilter) {
            // Reset all buttons
            const buttons = ['securityFilterAll', 'securityFilterCrit', 'securityFilterWarn', 'securityFilterInfo'];
            buttons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                btn.className = 'px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';
            });

            // Activate selected button
            const activeMap = {
                'all': 'securityFilterAll',
                'crit': 'securityFilterCrit',
                'warn': 'securityFilterWarn',
                'info': 'securityFilterInfo'
            };

            const activeBtn = document.getElementById(activeMap[activeFilter]);
            if (activeBtn) {
                activeBtn.className = 'px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors';
            }
        }

        function renderSecurityAlertTable() {
            const tableBody = document.getElementById('securityAlertTableBody');
            const alertCountEl = document.getElementById('securityAlertCount');
            tableBody.innerHTML = '';

            // Get alerts from current scope
            const data = getFilteredData(currentScope, currentSiteFilter);
            let alerts = data.aData;

            // Show only security-type alerts
            alerts = alerts.filter(a => a.type === 'security');

            // Populate site filter dropdown (before filtering by site)
            populateSecuritySiteFilter(alerts);

            // Apply severity filter
            if (currentSecurityType !== 'all') {
                alerts = alerts.filter(a => a.sev === currentSecurityType);
            }

            // Apply site filter
            if (securitySiteFilterValue !== 'all') {
                alerts = alerts.filter(a => a.site === securitySiteFilterValue);
            }

            // Apply search filter
            if (securitySearchTerm) {
                const searchLower = securitySearchTerm.toLowerCase();
                alerts = alerts.filter(a =>
                    a.site.toLowerCase().includes(searchLower) ||
                    a.device.toLowerCase().includes(searchLower) ||
                    a.msg.toLowerCase().includes(searchLower)
                );
            }

            // Apply sorting
            alerts = sortAlerts(alerts, securitySortField, securitySortAsc);

            // Update alert count
            alertCountEl.innerText = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;

            if (alerts.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="5" class="px-4 py-4 text-center text-sm text-gray-400">No security alerts found for this criteria.</td>`;
                tableBody.appendChild(row);
                return;
            }

            const sevStyles = {
                crit: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-full px-2 py-0.5 text-xs font-bold border border-red-100 dark:border-red-900',
                warn: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-full px-2 py-0.5 text-xs font-bold border border-amber-100 dark:border-amber-900',
                info: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-full px-2 py-0.5 text-xs font-bold border border-blue-100 dark:border-blue-900'
            };

            const sevIcons = {
                crit: '<i class="fa-solid fa-circle-exclamation"></i>',
                warn: '<i class="fa-solid fa-triangle-exclamation"></i>',
                info: '<i class="fa-solid fa-circle-info"></i>'
            };

            const sevLabels = {
                crit: 'CRITICAL',
                warn: 'WARNING',
                info: 'INFO'
            };

            alerts.forEach(alert => {
                const row = document.createElement('tr');
                row.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors";
                row.innerHTML = `
                    <td class="px-4 py-3 whitespace-nowrap">
                        <span class="${sevStyles[alert.sev]} flex items-center gap-1 w-fit">
                            ${sevIcons[alert.sev]} ${sevLabels[alert.sev]}
                        </span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-xs text-dark-muted">${alert.time}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${alert.site}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm">
                        <a href="${getDevicePageUrl(alert.device)}" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 font-medium hover:underline">${alert.device}</a>
                    </td>
                    <td class="px-4 py-3 text-sm text-dark-muted truncate max-w-xs" title="${alert.msg}">${alert.msg}</td>
                `;
                tableBody.appendChild(row);
            });
        }

        function searchSecurityAlerts() {
            securitySearchTerm = document.getElementById('securitySearchInput').value;
            renderSecurityAlertTable();
        }

        function sortSecurityAlerts(field) {
            if (securitySortField === field) {
                securitySortAsc = !securitySortAsc;
            } else {
                securitySortField = field;
                securitySortAsc = true;
            }
            renderSecurityAlertTable();
        }

        function filterSecurityBySite(site) {
            securitySiteFilterValue = site;
            renderSecurityAlertTable();
        }

        function populateSecuritySiteFilter(alerts) {
            const select = document.getElementById('securitySiteFilter');
            const currentValue = select.value;
            const sites = [...new Set(alerts.map(a => a.site))].sort();
            select.innerHTML = '<option value="all">All Sites</option>';
            sites.forEach(site => {
                select.innerHTML += `<option value="${site}"${site === currentValue ? ' selected' : ''}>${site}</option>`;
            });
            select.value = securitySiteFilterValue === 'all' || sites.includes(securitySiteFilterValue) ? securitySiteFilterValue : 'all';
        }

        // --- LATENCY TRENDS OVERLAY ---
        let latencyTrendsChart = null;

        function openLatencyTrends() {
            const overlay = document.getElementById('latencyTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing chart if it exists
            if (latencyTrendsChart) {
                latencyTrendsChart.destroy();
            }

            // Generate time labels based on timeline selection
            const timeLabels = TimelineManager.generateLabels(24);
            const pointCount = timeLabels.length;

            // Get top 5 SD-WANs from current data
            const latencyData = DataLoader.getLatencyData(currentSiteFilter || currentScope, 5);
            const siteNames = latencyData.map(d => d.label);
            const siteColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

            // Generate realistic latency trends for each site
            const datasets = siteNames.map((site, idx) => {
                const baseLatency = latencyData[idx].latency;
                const data = [];
                for (let i = 0; i < pointCount; i++) {
                    const isBusinessHours = (i / pointCount) >= 0.33 && (i / pointCount) < 0.75;
                    const hourMultiplier = isBusinessHours ? 1.2 : 0.8;
                    data.push(Math.max(5, baseLatency * hourMultiplier + (Math.random() - 0.5) * 20));
                }
                return {
                    label: site,
                    data: data,
                    borderColor: siteColors[idx],
                    backgroundColor: siteColors[idx] + '33',
                    borderWidth: 2,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    tension: 0.4,
                    fill: false
                };
            });

            // Create the Latency trend chart
            latencyTrendsChart = new Chart(document.getElementById('latencyTrendsChart'), {
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
                                font: { size: 11 },
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
                                    return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + ' ms';
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
                                text: 'Latency (ms)',
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
                        }
                    }
                }
            });
        }

        function closeLatencyTrends() {
            const overlay = document.getElementById('latencyTrendsOverlay');
            overlay.classList.add('hidden');

            if (latencyTrendsChart) {
                latencyTrendsChart.destroy();
                latencyTrendsChart = null;
            }
        }

        // --- FRUSTRATION TRENDS OVERLAY ---
        let frustrationBreakdownChart = null;
        let frustrationTrendsChart = null;

        function openFrustrationTrends() {
            const overlay = document.getElementById('frustrationTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing charts if they exist
            if (frustrationBreakdownChart) {
                frustrationBreakdownChart.destroy();
            }
            if (frustrationTrendsChart) {
                frustrationTrendsChart.destroy();
            }

            // Get frustration data from current scope
            const frustrationData = DataLoader.getFrustrationData(currentSiteFilter || currentScope, 10);
            const siteNames = frustrationData.map(d => d.label);

            // Create breakdown chart (stacked horizontal bar)
            const breakdownData = frustrationData.map(d => ({
                association: Math.floor(d.totalTime * 0.35),
                auth: Math.floor(d.totalTime * 0.25),
                dhcp: Math.floor(d.totalTime * 0.25),
                dns: Math.floor(d.totalTime * 0.15)
            }));

            frustrationBreakdownChart = new Chart(document.getElementById('frustrationBreakdownChart'), {
                type: 'bar',
                data: {
                    labels: siteNames,
                    datasets: [
                        { label: 'Association', data: breakdownData.map(d => d.association), backgroundColor: '#dc2626', borderRadius: 2 },
                        { label: 'Auth', data: breakdownData.map(d => d.auth), backgroundColor: '#ea580c', borderRadius: 2 },
                        { label: 'DHCP', data: breakdownData.map(d => d.dhcp), backgroundColor: '#f59e0b', borderRadius: 2 },
                        { label: 'DNS', data: breakdownData.map(d => d.dns), backgroundColor: '#16a34a', borderRadius: 2 }
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
                                font: { size: 10 },
                                padding: 10
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.x + ' ms';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            stacked: true,
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Time (ms)',
                                font: { size: 11 }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        y: {
                            stacked: true,
                            ticks: { font: { size: 10 } },
                            grid: { display: false }
                        }
                    }
                }
            });

            // Generate time labels based on timeline selection
            const timeLabels = TimelineManager.generateLabels(24);
            const pointCount = timeLabels.length;

            // Generate trends data for top 5 sites
            const top5Sites = frustrationData.slice(0, 5);
            const trendColors = ['#dc2626', '#ea580c', '#f59e0b', '#16a34a', '#3b82f6'];

            const trendDatasets = top5Sites.map((site, idx) => {
                const baseTime = site.totalTime;
                const data = [];
                for (let i = 0; i < pointCount; i++) {
                    const isBusinessHours = (i / pointCount) >= 0.33 && (i / pointCount) < 0.75;
                    const hourMultiplier = isBusinessHours ? 1.3 : 0.7;
                    data.push(Math.max(50, baseTime * hourMultiplier + (Math.random() - 0.5) * 100));
                }
                return {
                    label: site.label,
                    data: data,
                    borderColor: trendColors[idx],
                    backgroundColor: trendColors[idx] + '33',
                    borderWidth: 2,
                    pointRadius: 2,
                    tension: 0.4,
                    fill: false
                };
            });

            frustrationTrendsChart = new Chart(document.getElementById('frustrationTrendsChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: trendDatasets
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
                                font: { size: 10 },
                                padding: 10,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y.toFixed(0) + ' ms';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { color: 'rgba(0, 0, 0, 0.05)' },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                font: { size: 9 }
                            }
                        },
                        y: {
                            display: true,
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Connection Time (ms)',
                                font: { size: 11 }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });
        }

        function closeFrustrationTrends() {
            const overlay = document.getElementById('frustrationTrendsOverlay');
            overlay.classList.add('hidden');

            if (frustrationBreakdownChart) {
                frustrationBreakdownChart.destroy();
                frustrationBreakdownChart = null;
            }
            if (frustrationTrendsChart) {
                frustrationTrendsChart.destroy();
                frustrationTrendsChart = null;
            }
        }

        // --- WAN RESILIENCE TRENDS OVERLAY ---
        let wanStatusTrendsChart = null;
        let failoverEventsChart = null;

        function openWanResilienceTrends() {
            const overlay = document.getElementById('wanResilienceTrendsOverlay');
            overlay.classList.remove('hidden');

            // Destroy existing charts if they exist
            if (wanStatusTrendsChart) {
                wanStatusTrendsChart.destroy();
            }
            if (failoverEventsChart) {
                failoverEventsChart.destroy();
            }

            // Generate time labels based on timeline selection
            const timeLabels = TimelineManager.generateLabels(24);
            const pointCount = timeLabels.length;

            // Generate WAN status trends data
            const primaryData = [];
            const failoverData = [];
            const downData = [];

            for (let i = 0; i < pointCount; i++) {
                // Simulate some variation in WAN status
                const fraction = i / pointCount;
                const baseDown = fraction >= 0.08 && fraction <= 0.17 ? 3 : 1;
                const basePrimary = 91 - (fraction >= 0.08 && fraction <= 0.17 ? 5 : 0);
                const baseFailover = 100 - basePrimary - baseDown;

                primaryData.push(basePrimary + (Math.random() - 0.5) * 2);
                failoverData.push(baseFailover + (Math.random() - 0.5) * 2);
                downData.push(Math.max(0, baseDown + (Math.random() - 0.5) * 1));
            }

            wanStatusTrendsChart = new Chart(document.getElementById('wanStatusTrendsChart'), {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: [
                        {
                            label: 'Primary',
                            data: primaryData,
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            borderWidth: 2,
                            pointRadius: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Failover',
                            data: failoverData,
                            borderColor: '#f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.2)',
                            borderWidth: 2,
                            pointRadius: 2,
                            tension: 0.4,
                            fill: true
                        },
                        {
                            label: 'Down',
                            data: downData,
                            borderColor: '#ef4444',
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            borderWidth: 2,
                            pointRadius: 2,
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
                                font: { size: 11 },
                                padding: 15,
                                usePointStyle: true
                            }
                        },
                        tooltip: {
                            enabled: true,
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: { color: 'rgba(0, 0, 0, 0.05)' },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                font: { size: 10 }
                            }
                        },
                        y: {
                            display: true,
                            beginAtZero: true,
                            max: 100,
                            title: {
                                display: true,
                                text: 'Link Status (%)',
                                font: { size: 12 }
                            },
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                },
                                font: { size: 10 }
                            },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    }
                }
            });

            // Get sites for failover events chart
            const sites = DataLoader.getSites ? DataLoader.getSites() : ['NYC-HQ', 'NJ-Warehouse', 'SFO-Branch', 'TOK-Sales', 'MUM-Hub'];
            const siteNames = Object.keys(sites).slice(0, 8);

            // Generate failover events data
            const failoverCounts = siteNames.map(() => Math.floor(Math.random() * 5) + 1);
            const failoverColors = failoverCounts.map(c => c >= 4 ? '#ef4444' : c >= 2 ? '#f59e0b' : '#10b981');

            failoverEventsChart = new Chart(document.getElementById('failoverEventsChart'), {
                type: 'bar',
                data: {
                    labels: siteNames,
                    datasets: [{
                        label: 'Failover Events',
                        data: failoverCounts,
                        backgroundColor: failoverColors,
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
                            callbacks: {
                                label: function(context) {
                                    return 'Failover Events: ' + context.parsed.x;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Number of Events',
                                font: { size: 12 }
                            },
                            ticks: { font: { size: 10 } },
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        },
                        y: {
                            ticks: {
                                font: { size: 11 }
                            },
                            grid: { display: false }
                        }
                    }
                }
            });
        }

        function closeWanResilienceTrends() {
            const overlay = document.getElementById('wanResilienceTrendsOverlay');
            overlay.classList.add('hidden');

            if (wanStatusTrendsChart) {
                wanStatusTrendsChart.destroy();
                wanStatusTrendsChart = null;
            }
            if (failoverEventsChart) {
                failoverEventsChart.destroy();
                failoverEventsChart = null;
            }
        }

        // Expose overlay functions to global scope for onclick handlers
        window.openLatencyTrends = openLatencyTrends;
        window.closeLatencyTrends = closeLatencyTrends;
        window.openFrustrationTrends = openFrustrationTrends;
        window.closeFrustrationTrends = closeFrustrationTrends;
        window.openWanResilienceTrends = openWanResilienceTrends;
        window.closeWanResilienceTrends = closeWanResilienceTrends;

        // Global Escape key and click-outside handler for all overlays
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                // Close modal overlays first (higher z-index)
                const latency = document.getElementById('latencyTrendsOverlay');
                const frustration = document.getElementById('frustrationTrendsOverlay');
                const wan = document.getElementById('wanResilienceTrendsOverlay');

                if (!latency.classList.contains('hidden')) { closeLatencyTrends(); return; }
                if (!frustration.classList.contains('hidden')) { closeFrustrationTrends(); return; }
                if (!wan.classList.contains('hidden')) { closeWanResilienceTrends(); return; }

                // Then close card overlays
                if (isIssuesExpanded) { hideIssuesAlerts(); return; }
                if (isSecurityExpanded) { hideSecurityAlerts(); return; }
                if (isDevicesExpanded) { hideDeviceList(); return; }
                if (isStatusExpanded) { hideStatusDevices(); return; }
            }
        });

        // Initialize - Load data first, then initialize charts
        console.log('Starting data load...');
        DataLoader.load().then(() => {
            console.log('Data loaded successfully, initializing charts...');
            initCharts();
            updateDashboardScope('Global'); // Load Global Data initially
            console.log('Dashboard initialized with Global scope');

            // Bind scope selector change listener (replaces inline onchange)
            const scopeSelector = document.getElementById('scopeSelector');
            if (scopeSelector) {
                scopeSelector.addEventListener('change', (e) => updateDashboardScope(e.target.value));
            }

            // Bind debounced search listeners (replaces inline oninput)
            const searchBindings = [
                { id: 'clientsSearchInput', handler: searchDeviceList },
                { id: 'statusSearchInput', handler: searchStatusDevices },
                { id: 'issuesSearchInput', handler: searchIssuesAlerts },
                { id: 'securitySearchInput', handler: searchSecurityAlerts }
            ];
            searchBindings.forEach(({ id, handler }) => {
                const input = document.getElementById(id);
                if (input) {
                    input.addEventListener('input', SharedUI.debounce(handler, 200));
                }
            });

            // Register charts with theme manager for automatic theme updates
            themeManager.registerCharts(charts);

            // Update chart colors after initialization if dark mode is already active
            if (themeManager.isDarkMode()) {
                themeManager.updateChartColors();
            }
        }).catch(error => {
            console.error('Failed to initialize dashboard:', error);
            // Show user-visible error message
            const errorMsg = document.createElement('div');
            errorMsg.className = 'fixed top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50';
            errorMsg.innerHTML = `
                <strong>Data Loading Error:</strong> ${error.message}<br>
                <span class="text-sm">If using file://, please use a local web server (e.g., "python -m http.server 8000")</span>
            `;
            document.body.appendChild(errorMsg);
        });

