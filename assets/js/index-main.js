        // Initialize navigation for Summary page
        NavigationManager.init('summary');


        // --- 1. DATA CONFIGURATION & STATE MANAGEMENT ---
        // Data is now loaded from /data/network-data.json via DataLoader

        // Global Chart Instances
        let charts = {};
        let currentFilter = 'all'; // Alert filter (active fires, threats, etc)
        let currentScope = 'Global'; // Region Scope
        let currentSiteFilter = null; // Site-specific filter
        let isAIExpanded = false; // Track if AI Alerts widget is expanded
        let isCorrelatedExpanded = false; // Track if Correlated Alerts widget is expanded
        let currentCorrelatedFilter = 'all'; // Track correlated severity filter
        let currentAIType = 'all'; // Track AI severity filter
        let aiSearchTerm = ''; // Search term for AI alerts
        let aiSortField = null; // Current sort field for AI alerts
        let aiSortAsc = true; // Sort direction for AI alerts
        let aiSiteFilterValue = 'all'; // Site filter for AI alerts
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
        let statusSearchTerm = ''; // Search term for status devices
        let currentStatusVendor = null; // Track vendor filter for status view
        let currentStatusModel = null; // Track model filter for status view
        let fleetViewMode = 'type-vendor'; // Fleet status grouping mode
        let fleetExpandedKeys = new Set(); // Currently expanded sub-groups (e.g. 'gateways-meraki')

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
                deviceId: a.deviceId,
                msg: a.message,
                time: a.timeAgo,
                type: a.type
            }));

            const totalCrit = aData.filter(a => a.sev === 'crit').length;
            const totalWarn = aData.filter(a => a.sev === 'warn').length;

            // Get security stats from DataLoader
            const securityCounts = DataLoader.getSecurityCounts(effectiveScope);

            return { fData, lData, aData, totalCrit, totalWarn, securityCrit: securityCounts.crit, securityWarn: securityCounts.warn };
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

            // 3. Update AI Alert Counts
            const aiCounts = DataLoader.getAICounts(isSiteScope ? siteName : currentScope);
            document.getElementById('aiCritCount').innerText = aiCounts.crit;
            document.getElementById('aiWarnCount').innerText = aiCounts.warn;

            // 4. Update WAN Donut from DataLoader
            const wanData = DataLoader.getWanResilience(isSiteScope ? siteName : currentScope);
            charts.wan.data.datasets[0].data = [wanData.primary, wanData.failover, wanData.down];
            charts.wan.update();
            document.getElementById('wanPrimary').innerText = wanData.primary + '%';
            document.getElementById('wanFailover').innerText = wanData.failover + '%';
            document.getElementById('wanDown').innerText = wanData.down + '%';

            // 5. Update Frustration Chart
            charts.frustration.data.labels = data.fData.map(d => d.label);
            charts.frustration.data.datasets[0].data = data.fData.map(d => Math.floor(d.val * 0.35));
            charts.frustration.data.datasets[1].data = data.fData.map(d => Math.floor(d.val * 0.25));
            charts.frustration.data.datasets[2].data = data.fData.map(d => Math.floor(d.val * 0.25));
            charts.frustration.data.datasets[3].data = data.fData.map(d => Math.floor(d.val * 0.15));
            charts.frustration.update();

            // 6. Update Latency Chart
            charts.latency.data.labels = data.lData.map(d => d.label);
            charts.latency.data.datasets[0].data = data.lData.map(d => d.val);
            charts.latency.update();

            // 7. Update Status Matrix (dynamic grid)
            renderFleetStatusGrid();

            // 8. Update Alerts
            renderTable(currentFilter, data.aData);

            // 9. Update Correlated Alert Counts
            const effectiveScopeForCorr = isSiteScope ? siteName : currentScope;
            const corrCounts = DataLoader.getCorrelatedAlertCounts(effectiveScopeForCorr);
            document.getElementById('correlatedCritCount').innerText = corrCounts.crit;
            document.getElementById('correlatedWarnCount').innerText = corrCounts.warn;

            // 10. Update SSID Chart
            const ssidData = DataLoader.getTopSSIDs(effectiveScopeForCorr, 5);
            charts.ssid.data.labels = ssidData.map(d => d.ssid);
            charts.ssid.data.datasets[0].data = ssidData.map(d => d.clients);
            charts.ssid.update();

            // 11. Update Clients per Site Chart
            const clientsData = DataLoader.getTopSitesByClients(effectiveScopeForCorr, 5);
            charts.clients.data.labels = clientsData.map(d => d.label);
            charts.clients.data.datasets[0].data = clientsData.map(d => d.clients);
            charts.clients.update();

            // 12. Update API Quota
            renderAPIQuota(effectiveScopeForCorr);
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

            // E. SSID Chart
            const ssidCanvas = document.getElementById('ssidChart');
            charts.ssid = new Chart(ssidCanvas.getContext('2d'), {
                type: 'bar',
                data: { labels: [], datasets: [{ label: 'Clients', data: [], backgroundColor: ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6'], borderRadius: 4 }] },
                options: {
                    indexAxis: 'y',
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => ctx.parsed.x + ' clients' } }
                    },
                    scales: {
                        x: { beginAtZero: true, grid: { display: true, borderDash: [2,2] } },
                        y: { grid: { display: false } }
                    }
                }
            });

            // B. Top Applications (Donut)
            const dashAppsData = {
                labels: ['M365', 'Teams', 'Salesforce', 'YouTube', 'Other'],
                data: [35, 25, 18, 12, 10],
                colors: ['#3b82f6', '#6366f1', '#0ea5e9', '#ef4444', '#9ca3af']
            };
            charts.dashApps = new Chart(document.getElementById('dashAppsChart').getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: dashAppsData.labels,
                    datasets: [{ data: dashAppsData.data, backgroundColor: dashAppsData.colors, borderWidth: 0 }]
                },
                options: { cutout: '65%', plugins: { legend: { display: false } } }
            });
            const dashAppsLegend = document.getElementById('dashAppsLegend');
            dashAppsLegend.innerHTML = dashAppsData.labels.map((label, i) => `
                <div class="flex items-center gap-2 mb-2">
                    <div class="w-2.5 h-2.5 rounded-sm flex-shrink-0" style="background:${dashAppsData.colors[i]}"></div>
                    <div class="text-xs text-dark-text">
                        <span class="font-medium">${label}</span>
                        <span class="text-dark-muted ml-1">${dashAppsData.data[i]}%</span>
                    </div>
                </div>`).join('');

            // F. Clients per Site Chart
            const clientsCanvas = document.getElementById('clientsChart');
            charts.clients = new Chart(clientsCanvas.getContext('2d'), {
                type: 'bar',
                data: { labels: [], datasets: [{ label: 'Clients', data: [], backgroundColor: '#0ea5e9', borderRadius: 4 }] },
                options: {
                    indexAxis: 'y',
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: ctx => ctx.parsed.x + ' clients' } }
                    },
                    scales: {
                        x: { beginAtZero: true, grid: { display: true, borderDash: [2,2] } },
                        y: { grid: { display: false } }
                    }
                }
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
                row.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer";
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
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 dark:text-indigo-400 font-medium">${alert.device}</td>
                    <td class="px-6 py-4 text-sm text-dark-muted truncate max-w-xs" title="${alert.msg}">${alert.msg}</td>
                `;
                row.addEventListener('click', () => openAlertDetail(alert));
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

        // --- ALERT DETAIL DRAWER ---

        function openAlertDetail(alert) {
            const drawer = document.getElementById('alertDetailDrawer');
            drawer.classList.remove('device-mode');
            const backdrop = document.getElementById('alertDetailBackdrop');
            // Restore shared rows hidden by device detail mode
            const sharedRows = document.querySelector('#alertDetailDrawer .space-y-3');
            if (sharedRows) sharedRows.style.display = '';
            // Restore bottom border classes
            const bottomEl = document.getElementById('alertDetailBottom');
            bottomEl.classList.add('border-t', 'border-gray-200', 'dark:border-gray-700', 'pt-5');
            document.getElementById('alertDetailTitle').textContent = 'Alert Detail';

            // Severity badge
            const sevStyles = {
                crit: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-full px-2.5 py-1 text-[11px] font-bold border border-red-100 dark:border-red-900',
                warn: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-full px-2.5 py-1 text-[11px] font-bold border border-amber-100 dark:border-amber-900',
                info: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-full px-2.5 py-1 text-[11px] font-bold border border-blue-100 dark:border-blue-900'
            };
            const sevIcons = { crit: 'fa-circle-exclamation', warn: 'fa-triangle-exclamation', info: 'fa-circle-info' };
            const sev = alert.sev || alert.severity || 'info';
            const badgesEl = document.getElementById('alertDetailBadges');
            badgesEl.innerHTML = `
                <span class="${sevStyles[sev]}">
                    <i class="fa-solid ${sevIcons[sev]} mr-1"></i>${sev.toUpperCase()}
                </span>
                ${alert.type ? `<span class="text-[11px] text-dark-muted bg-gray-100 dark:bg-gray-700 rounded-full px-2.5 py-1 font-medium">${alert.type}</span>` : ''}
                ${alert.vendor ? `<span class="text-[11px] text-dark-muted bg-gray-100 dark:bg-gray-700 rounded-full px-2.5 py-1">${alert.vendor}</span>` : ''}
            `;

            // Site
            document.getElementById('alertDetailSite').textContent = alert.site || '—';

            // Device (linked)
            const deviceEl = document.getElementById('alertDetailDevice');
            const deviceName = alert.device || '—';
            const deviceUrl = alert.deviceId ? getDevicePageUrl(alert.device) : '#';
            deviceEl.textContent = deviceName;
            deviceEl.href = deviceUrl;

            // Time row
            document.getElementById('alertDetailTimeLabel').textContent = 'Time';
            document.getElementById('alertDetailTimeIcon').className = 'fa-solid fa-clock text-dark-muted text-xs mt-0.5 w-4 text-center';
            document.getElementById('alertDetailTime').textContent = alert.time || alert.timeAgo || '—';

            // Payload — build a clean object from available fields
            const payload = {};
            if (alert.type)     payload.type     = alert.type;
            if (sev)            payload.severity  = sev;
            if (alert.site)     payload.site      = alert.site;
            if (alert.region)   payload.region    = alert.region;
            if (alert.device)   payload.device    = alert.device;
            if (alert.deviceId) payload.device_id = alert.deviceId;
            if (alert.vendor)   payload.vendor    = alert.vendor;
            if (alert.msg || alert.message) payload.message = alert.msg || alert.message;
            if (alert.time || alert.timeAgo) payload.time_ago = alert.time || alert.timeAgo;
            document.getElementById('alertDetailBottom').innerHTML = `
                <div class="text-[10px] text-dark-muted uppercase tracking-wide mb-3">Alert Payload</div>
                <pre id="alertDetailPayload" class="alert-detail-payload">${JSON.stringify(payload, null, 2)}</pre>
            `;

            backdrop.classList.add('active');
            drawer.classList.add('active');
        }

        function closeAlertDetail() {
            const drawer = document.getElementById('alertDetailDrawer');
            drawer.classList.remove('active');
            drawer.classList.remove('device-mode');
            document.getElementById('alertDetailBackdrop').classList.remove('active');
            // Restore shared rows for next open
            const sharedRows = document.querySelector('#alertDetailDrawer .space-y-3');
            if (sharedRows) sharedRows.style.display = '';
            const bottomEl = document.getElementById('alertDetailBottom');
            bottomEl.classList.add('border-t', 'border-gray-200', 'dark:border-gray-700', 'pt-5');
        }

        function openDeviceDetail(device) {
            const drawer = document.getElementById('alertDetailDrawer');
            const backdrop = document.getElementById('alertDetailBackdrop');
            drawer.classList.add('device-mode');

            const statusColors = {
                online:   { border: 'border-green-500',  badge: 'text-green-400 bg-green-900/30 border border-green-700',  dot: 'bg-green-400', label: 'Online' },
                warning:  { border: 'border-amber-500',  badge: 'text-amber-400 bg-amber-900/30 border border-amber-700',  dot: 'bg-amber-400', label: 'Warning' },
                critical: { border: 'border-red-500',    badge: 'text-red-400 bg-red-900/30 border border-red-700',        dot: 'bg-red-400',   label: 'Critical' },
                offline:  { border: 'border-gray-600',   badge: 'text-gray-400 bg-gray-800 border border-gray-600',        dot: 'bg-gray-500',  label: 'Offline' },
            };
            const statusIcons = { online: 'fa-circle-check', warning: 'fa-circle-exclamation', critical: 'fa-circle-xmark', offline: 'fa-power-off' };
            const typeMap = { 'GW-': { icon: 'fa-network-wired', label: 'Gateway' }, 'SW-': { icon: 'fa-server', label: 'Switch' }, 'AP-': { icon: 'fa-wifi', label: 'Access Point' } };
            const prefix = device.name.substring(0, 3);
            const typeInfo = typeMap[prefix] || { icon: 'fa-circle', label: 'Device' };
            const st = statusColors[device.status] || statusColors.offline;

            const vendorLabel = device.vendor ? device.vendor.charAt(0).toUpperCase() + device.vendor.slice(1) : null;

            const specCells = [
                { label: 'IP Address',  value: device.ip       || '—', icon: 'fa-ethernet',     mono: true },
                { label: 'MAC',         value: device.mac      || '—', icon: 'fa-id-card',      mono: true },
                { label: 'Model',       value: device.model    || '—', icon: 'fa-microchip',    mono: false },
                { label: 'Uptime',      value: device.uptime   || '—', icon: 'fa-clock',        mono: true },
                { label: 'Serial',      value: device.serial   || '—', icon: 'fa-barcode',      mono: true },
                { label: 'Firmware',    value: device.firmware || '—', icon: 'fa-code-branch',  mono: true },
                { label: 'Site',        value: device.site     || '—', icon: 'fa-location-dot', mono: false },
            ];

            const tags = [
                device.region ? { label: device.region,  color: 'bg-indigo-900/40 text-indigo-300 border border-indigo-700/50',  icon: 'fa-globe' }        : null,
                device.vendor ? { label: vendorLabel,    color: 'bg-gray-800 text-gray-300 border border-gray-600',              icon: 'fa-building' }     : null,
                { label: typeInfo.label,                  color: 'bg-gray-800 text-gray-300 border border-gray-600',              icon: typeInfo.icon },
            ].filter(Boolean);

            const alerts = DataLoader.getAlertsByDeviceId(device.id);
            const sevBadge = {
                crit: 'text-red-400 bg-red-900/30 border border-red-700',
                warn: 'text-amber-400 bg-amber-900/30 border border-amber-700',
                info: 'text-blue-400 bg-blue-900/30 border border-blue-700'
            };

            // Inject fully custom layout — hide the shared rows, use alertDetailBadges as root container
            document.getElementById('alertDetailTitle').textContent = 'Device Detail';
            document.getElementById('alertDetailBadges').innerHTML = '';

            // Hide the shared site/device/time rows by targeting their parent .space-y-3
            const sharedRows = document.querySelector('#alertDetailDrawer .space-y-3');
            if (sharedRows) sharedRows.style.display = 'none';

            document.getElementById('alertDetailBottom').classList.remove('border-t', 'border-gray-200', 'dark:border-gray-700', 'pt-5');

            document.getElementById('alertDetailBottom').innerHTML = `
                <!-- Device identity card -->
                <div class="rounded-xl border border-white/10 bg-white/5 p-4 mb-4 ${st.border} border-l-4">
                    <div class="flex items-start justify-between gap-3 mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-9 h-9 rounded-lg bg-white/8 flex items-center justify-center flex-shrink-0 border border-white/10">
                                <i class="fa-solid ${typeInfo.icon} text-gray-300 text-sm"></i>
                            </div>
                            <div>
                                <a href="${getDevicePageUrl(device.name)}" class="text-base font-bold text-white hover:text-indigo-300 transition-colors leading-tight block">${device.name}</a>
                                ${device.model ? `<div class="text-xs text-gray-400 mt-0.5">${device.model}</div>` : ''}
                            </div>
                        </div>
                        <span class="rounded-full px-2.5 py-1 text-[11px] font-bold flex items-center gap-1.5 flex-shrink-0 ${st.badge}">
                            <i class="fa-solid ${statusIcons[device.status] || 'fa-circle'} text-[9px]"></i>${st.label}
                        </span>
                    </div>

                    <!-- 2-col spec grid -->
                    <div class="grid grid-cols-2 gap-x-4 gap-y-3">
                        ${specCells.map(c => `
                            <div>
                                <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                                    <i class="fa-solid ${c.icon} text-[9px]"></i>${c.label}
                                </div>
                                <div class="text-xs ${c.mono ? 'font-mono' : 'font-medium'} text-gray-200 truncate">${c.value}</div>
                            </div>
                        `).join('')}
                        ${device.vendor_portal ? `
                            <div>
                                <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                                    <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>Portal
                                </div>
                                <a href="${device.vendor_portal}" target="_blank" rel="noopener" class="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors">Open Portal</a>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Tags -->
                <div class="flex flex-wrap gap-1.5 mb-4">
                    ${tags.map(t => `
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${t.color}">
                            <i class="fa-solid ${t.icon} text-[9px]"></i>${t.label}
                        </span>
                    `).join('')}
                </div>

                <!-- Alerts -->
                <div class="border-t border-white/8 pt-4">
                    <div class="text-[10px] text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                        Alerts
                        ${alerts.length > 0 ? `<span class="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] font-medium text-gray-300">${alerts.length}</span>` : ''}
                    </div>
                    ${alerts.length === 0
                        ? `<div class="text-xs text-gray-500 text-center py-5 rounded-lg border border-white/5 bg-white/2">
                               <i class="fa-solid fa-circle-check text-green-500 block text-lg mb-2"></i>No active alerts
                           </div>`
                        : `<div class="space-y-2">
                            ${alerts.map((a, i) => `
                                <div class="device-alert-card rounded-lg border border-white/8 p-2.5 bg-white/4 cursor-pointer hover:border-indigo-500/50 hover:bg-white/7 transition-colors" data-alert-idx="${i}">
                                    <div class="flex items-center justify-between gap-2 mb-1">
                                        <span class="rounded-full px-2 py-0.5 text-[10px] font-bold ${sevBadge[a.severity] || sevBadge.info}">${a.severity.toUpperCase()}</span>
                                        <span class="text-[10px] text-gray-500 flex-shrink-0">${a.timeAgo}</span>
                                    </div>
                                    <div class="text-xs text-gray-200">${a.message}</div>
                                    ${a.type ? `<div class="text-[10px] text-gray-500 mt-1">${a.type}</div>` : ''}
                                </div>
                            `).join('')}
                           </div>`
                    }
                </div>
            `;

            document.getElementById('alertDetailBottom').querySelectorAll('.device-alert-card').forEach(card => {
                const a = alerts[parseInt(card.dataset.alertIdx)];
                card.addEventListener('click', () => openAlertDetail({
                    sev: a.severity,
                    site: a.site,
                    region: a.region,
                    device: a.device,
                    deviceId: a.deviceId,
                    vendor: a.vendor,
                    type: a.type,
                    msg: a.message,
                    time: a.timeAgo
                }));
            });

            backdrop.classList.add('active');
            drawer.classList.add('active');
        }

        function closeExpandedWidgets() {
            if (isStatusExpanded) {
                hideStatusDevices();
            }
            if (isIssuesExpanded) {
                hideIssuesAlerts();
            }
            if (isSecurityExpanded) {
                hideSecurityAlerts();
            }
            if (isAIExpanded) {
                hideAIAlerts();
            }
            if (isCorrelatedExpanded) {
                hideCorrelatedAlerts();
            }
        }


        // --- FLEET STATUS GRID ---

        function changeFleetView(mode) {
            fleetViewMode = mode;
            fleetExpandedKeys.clear();
            renderFleetStatusGrid();
        }

        function toggleFleetExpand(key) {
            if (fleetExpandedKeys.has(key)) {
                fleetExpandedKeys.delete(key);
            } else {
                fleetExpandedKeys.add(key);
            }
            renderFleetStatusGrid();
        }

        function renderFleetStatusGrid() {
            const grid = document.getElementById('fleetStatusGrid');
            if (!grid) return;
            grid.innerHTML = '';

            const effectiveScope = currentSiteFilter || currentScope;

            const types = [
                { key: 'gateways', label: 'Gateways', filterKey: 'gateway' },
                { key: 'switches', label: 'Switches', filterKey: 'switch' },
                { key: 'accessPoints', label: 'APs', filterKey: 'ap' }
            ];
            const vendors = [
                { key: 'meraki', label: 'Cisco Meraki' },
                { key: 'mist', label: 'Juniper Mist' }
            ];

            const statusCols = [
                { key: 'online', label: 'Healthy', headerClass: 'text-newrelic-success dark:text-green-400', cellClass: '' },
                { key: 'warn', label: 'Warning', headerClass: 'text-amber-500', cellClass: 'bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400' },
                { key: 'crit', label: 'Critical', headerClass: 'text-red-500', cellClass: 'bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 font-bold' },
                { key: 'offline', label: 'Offline', headerClass: 'text-gray-400 dark:text-gray-500', cellClass: 'bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400' }
            ];

            // Status key to filter value mapping
            const statusFilterMap = { online: 'online', warn: 'warning', crit: 'critical', offline: 'offline' };

            // Header row
            const addCell = (text, classes) => {
                const div = document.createElement('div');
                div.className = classes;
                div.innerHTML = text;
                grid.appendChild(div);
                return div;
            };

            if (fleetViewMode === 'type-vendor') {
                addCell('Type', 'status-cell status-header');
                addCell('Vendor', 'status-cell status-header');
            } else {
                addCell('Vendor', 'status-cell status-header');
                addCell('Type', 'status-cell status-header');
            }
            statusCols.forEach(s => addCell(s.label, 'status-cell status-header ' + s.headerClass));

            const groups = fleetViewMode === 'type-vendor' ? types : vendors;
            const subGroups = fleetViewMode === 'type-vendor' ? vendors : types;

            groups.forEach(group => {
                // Calculate total rows this group spans (for the group cell)
                let totalSubRows = subGroups.length;
                // Check if any sub-group under this group is expanded
                subGroups.forEach(sub => {
                    const expandKey = fleetViewMode === 'type-vendor'
                        ? `${group.key}-${sub.key}`
                        : `${sub.key}-${group.key}`;
                    if (fleetExpandedKeys.has(expandKey)) {
                        const typeKey = fleetViewMode === 'type-vendor' ? group.key : sub.key;
                        const vendorKey = fleetViewMode === 'type-vendor' ? sub.key : group.key;
                        const models = DataLoader.getModelsByVendor(typeKey, vendorKey, effectiveScope);
                        totalSubRows += models.length;
                    }
                });

                // Group label cell spanning all sub-rows
                const groupCell = addCell(group.label, 'status-cell status-group-cell clickable text-dark-muted');
                groupCell.style.gridRow = `span ${totalSubRows}`;
                if (fleetViewMode === 'type-vendor') {
                    groupCell.onclick = () => showStatusDevices(group.filterKey, 'all', null);
                } else {
                    groupCell.onclick = () => showStatusDevices('all', 'all', group.key);
                }

                subGroups.forEach((sub, subIdx) => {
                    const typeKey = fleetViewMode === 'type-vendor' ? group.key : sub.key;
                    const vendorKey = fleetViewMode === 'type-vendor' ? sub.key : group.key;
                    const typeFilterKey = fleetViewMode === 'type-vendor' ? group.filterKey : sub.filterKey;
                    const subFilterKey = fleetViewMode === 'type-vendor' ? sub.key : sub.filterKey;
                    const expandKey = fleetViewMode === 'type-vendor'
                        ? `${group.key}-${sub.key}`
                        : `${sub.key}-${group.key}`;
                    const isExpanded = fleetExpandedKeys.has(expandKey);
                    const counts = DataLoader.getDeviceStatusCountsByVendor(typeKey, vendorKey, effectiveScope);

                    // Sub-group label: chevron toggles expand, label opens overlay
                    const chevron = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
                    const subCell = addCell(
                        `<span class="flex items-center gap-1.5"><i class="fa-solid ${chevron} text-[9px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 -m-1 z-10 relative" data-expand-key="${expandKey}"></i><span class="hover:underline">${sub.label}</span></span>`,
                        'status-cell status-subgroup-cell clickable text-dark-muted'
                    );
                    subCell.onclick = (e) => {
                        if (e.target.closest('i[data-expand-key]')) {
                            toggleFleetExpand(expandKey);
                        } else if (fleetViewMode === 'type-vendor') {
                            showStatusDevices(typeFilterKey, 'all', subFilterKey);
                        } else {
                            showStatusDevices(sub.filterKey, 'all', group.key);
                        }
                    };

                    // Status count cells for this sub-group row
                    statusCols.forEach(s => {
                        const val = counts[s.key] || 0;
                        const cell = addCell(val, 'status-cell clickable ' + s.cellClass);
                        cell.onclick = () => showStatusDevices(typeFilterKey, statusFilterMap[s.key], vendorKey);
                    });

                    // Model sub-rows if expanded
                    if (isExpanded) {
                        const models = DataLoader.getModelsByVendor(typeKey, vendorKey, effectiveScope);
                        models.forEach(model => {
                            const modelCounts = DataLoader.getDeviceStatusCountsByModel(typeKey, vendorKey, model, effectiveScope);
                            // Strip vendor prefix from model name for display
                            const shortName = model.replace(/^(Meraki |Mist )/, '');
                            const modelCell = addCell(`<span class="hover:underline">${shortName}</span>`, 'status-cell status-model-cell clickable text-left');
                            modelCell.onclick = () => showStatusDevices(typeFilterKey, 'all', vendorKey, model);
                            statusCols.forEach(s => {
                                const val = modelCounts[s.key] || 0;
                                const cell = addCell(val || '', 'status-cell status-model-cell clickable ' + (val > 0 ? s.cellClass : ''));
                                cell.onclick = () => showStatusDevices(typeFilterKey, statusFilterMap[s.key], vendorKey, model);
                            });
                        });
                    }
                });
            });
        }

        // --- STATUS WIDGET FUNCTIONS ---

        function showStatusDevices(deviceType, status, vendor, model) {
            // Close other widgets if open
            if (isAIExpanded) {
                hideAIAlerts();
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
            currentStatusVendor = vendor || null;
            currentStatusModel = model || null;

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
            currentStatusModel = null;

            statusSummaryView.classList.remove('hidden');
            statusExpandedView.classList.add('hidden');
        }

        function filterStatusDevices(status) {
            currentStatusFilter = status;
            currentStatusModel = null;
            updateStatusFilterButtons(status, currentStatusDeviceType);
            renderStatusDeviceList();
        }

        function filterStatusDeviceType(deviceType) {
            currentStatusDeviceType = deviceType;
            currentStatusModel = null;
            updateStatusFilterButtons(currentStatusFilter, deviceType);
            renderStatusDeviceList();
        }

        function filterStatusVendor(vendor) {
            currentStatusVendor = vendor;
            currentStatusModel = null;
            updateStatusFilterButtons(currentStatusFilter, currentStatusDeviceType);
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
            const healthButtons = ['statusFilterAll', 'statusFilterOnline', 'statusFilterWarning', 'statusFilterCritical', 'statusFilterOffline'];
            const healthMap = { 'all': 'statusFilterAll', 'online': 'statusFilterOnline', 'warning': 'statusFilterWarning', 'critical': 'statusFilterCritical', 'offline': 'statusFilterOffline' };
            healthButtons.forEach(id => { document.getElementById(id).className = inactiveClass; });
            const activeHealthBtn = document.getElementById(healthMap[activeStatusFilter]);
            if (activeHealthBtn) activeHealthBtn.className = activeClass;

            // Device type filter buttons
            const typeButtons = ['typeFilterAll', 'typeFilterGateway', 'typeFilterSwitch', 'typeFilterAp'];
            const typeMap = { 'all': 'typeFilterAll', 'gateway': 'typeFilterGateway', 'switch': 'typeFilterSwitch', 'ap': 'typeFilterAp' };
            typeButtons.forEach(id => { document.getElementById(id).className = inactiveClass; });
            const activeTypeBtn = document.getElementById(typeMap[activeTypeFilter]);
            if (activeTypeBtn) activeTypeBtn.className = activeClass;

            // Vendor filter buttons
            const vendorButtons = ['vendorFilterAll', 'vendorFilterMeraki', 'vendorFilterMist'];
            const vendorMap = { null: 'vendorFilterAll', 'meraki': 'vendorFilterMeraki', 'mist': 'vendorFilterMist' };
            vendorButtons.forEach(id => { document.getElementById(id).className = inactiveClass; });
            const activeVendorBtn = document.getElementById(vendorMap[currentStatusVendor]);
            if (activeVendorBtn) activeVendorBtn.className = activeClass;
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

            // Apply vendor filter if set
            if (currentStatusVendor) {
                devices = devices.filter(d => d.vendor === currentStatusVendor);
            }

            // Apply site filter if active
            if (currentSiteFilter) {
                devices = devices.filter(d => d.site === currentSiteFilter);
            }

            // Apply model filter if set
            if (currentStatusModel) {
                devices = devices.filter(d => d.model === currentStatusModel);
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
                    'critical': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                    'offline': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                };

                const statusIcons = {
                    'online': 'fa-circle-check',
                    'warning': 'fa-circle-exclamation',
                    'critical': 'fa-circle-xmark',
                    'offline': 'fa-power-off'
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
                deviceCard.onclick = () => openDeviceDetail(device);
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
            if (isAIExpanded) {
                hideAIAlerts();
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
                row.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer";
                row.innerHTML = `
                    <td class="px-4 py-3 whitespace-nowrap">
                        <span class="${sevStyles[alert.sev]} flex items-center gap-1 w-fit">
                            ${sevIcons[alert.sev]} ${alert.sev.toUpperCase()}
                        </span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-xs text-dark-muted">${alert.time}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${alert.site}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-indigo-600 dark:text-indigo-400 font-medium">${alert.device}</td>
                    <td class="px-4 py-3 text-sm text-dark-muted truncate max-w-xs" title="${alert.msg}">${alert.msg}</td>
                `;
                row.addEventListener('click', () => openAlertDetail(alert));
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
            if (isAIExpanded) {
                hideAIAlerts();
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
                row.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer";
                row.innerHTML = `
                    <td class="px-4 py-3 whitespace-nowrap">
                        <span class="${sevStyles[alert.sev]} flex items-center gap-1 w-fit">
                            ${sevIcons[alert.sev]} ${sevLabels[alert.sev]}
                        </span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-xs text-dark-muted">${alert.time}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${alert.site}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-indigo-600 dark:text-indigo-400 font-medium">${alert.device}</td>
                    <td class="px-4 py-3 text-sm text-dark-muted truncate max-w-xs" title="${alert.msg}">${alert.msg}</td>
                `;
                row.addEventListener('click', () => openAlertDetail(alert));
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

        // --- AI ALERTS WIDGET FUNCTIONS ---

        function showAIAlerts(aiType) {
            // Close other widgets if open
            if (isStatusExpanded) { hideStatusDevices(); }
            if (isIssuesExpanded) { hideIssuesAlerts(); }
            if (isSecurityExpanded) { hideSecurityAlerts(); }

            const aiSummaryView = document.getElementById('aiAlertsSummaryView');
            const aiExpandedView = document.getElementById('aiAlertsExpandedView');
            const card = document.getElementById('aiAlertsCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            card.classList.add('expanded');
            backdrop.classList.add('active');
            mainContent.style.overflow = 'hidden';
            isAIExpanded = true;

            aiSummaryView.classList.add('hidden');
            aiExpandedView.classList.remove('hidden');

            currentAIType = aiType;
            document.getElementById('aiAlertTitle').innerText = 'AI Alerts';

            aiSortField = null;
            aiSortAsc = true;
            aiSiteFilterValue = 'all';

            updateAIFilterButtons(aiType);
            renderAIAlertTable();
        }

        function hideAIAlerts() {
            const aiSummaryView = document.getElementById('aiAlertsSummaryView');
            const aiExpandedView = document.getElementById('aiAlertsExpandedView');
            const card = document.getElementById('aiAlertsCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            card.classList.remove('expanded');
            backdrop.classList.remove('active');
            mainContent.style.overflow = '';
            isAIExpanded = false;

            aiSummaryView.classList.remove('hidden');
            aiExpandedView.classList.add('hidden');
        }

        function filterAIAlerts(aiType) {
            currentAIType = aiType;
            updateAIFilterButtons(aiType);
            renderAIAlertTable();
        }

        function updateAIFilterButtons(activeFilter) {
            const buttons = ['aiFilterAll', 'aiFilterCrit', 'aiFilterWarn', 'aiFilterInfo'];
            buttons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                btn.className = 'px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';
            });

            const activeMap = {
                'all': 'aiFilterAll',
                'crit': 'aiFilterCrit',
                'warn': 'aiFilterWarn',
                'info': 'aiFilterInfo'
            };

            const activeBtn = document.getElementById(activeMap[activeFilter]);
            if (activeBtn) {
                activeBtn.className = 'px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors';
            }
        }

        function renderAIAlertTable() {
            const tableBody = document.getElementById('aiAlertTableBody');
            const alertCountEl = document.getElementById('aiAlertCount');
            tableBody.innerHTML = '';

            const data = getFilteredData(currentScope, currentSiteFilter);
            let alerts = data.aData;

            // Show only AI-type alerts
            alerts = alerts.filter(a => a.type === 'ai');

            populateAISiteFilter(alerts);

            if (currentAIType !== 'all') {
                alerts = alerts.filter(a => a.sev === currentAIType);
            }

            if (aiSiteFilterValue !== 'all') {
                alerts = alerts.filter(a => a.site === aiSiteFilterValue);
            }

            if (aiSearchTerm) {
                const searchLower = aiSearchTerm.toLowerCase();
                alerts = alerts.filter(a =>
                    a.site.toLowerCase().includes(searchLower) ||
                    a.device.toLowerCase().includes(searchLower) ||
                    a.msg.toLowerCase().includes(searchLower)
                );
            }

            alerts = sortAlerts(alerts, aiSortField, aiSortAsc);

            alertCountEl.innerText = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;

            if (alerts.length === 0) {
                const row = document.createElement('tr');
                row.innerHTML = `<td colspan="5" class="px-4 py-4 text-center text-sm text-gray-400">No AI alerts found for this criteria.</td>`;
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

            const sevLabels = { crit: 'CRITICAL', warn: 'WARNING', info: 'INFO' };

            alerts.forEach(alert => {
                const row = document.createElement('tr');
                row.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer";
                row.innerHTML = `
                    <td class="px-4 py-3 whitespace-nowrap">
                        <span class="${sevStyles[alert.sev]} flex items-center gap-1 w-fit">
                            ${sevIcons[alert.sev]} ${sevLabels[alert.sev]}
                        </span>
                    </td>
                    <td class="px-4 py-3 whitespace-nowrap text-xs text-dark-muted">${alert.time}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">${alert.site}</td>
                    <td class="px-4 py-3 whitespace-nowrap text-sm text-indigo-600 dark:text-indigo-400 font-medium">${alert.device}</td>
                    <td class="px-4 py-3 text-sm text-dark-muted truncate max-w-xs" title="${alert.msg}">${alert.msg}</td>
                `;
                row.addEventListener('click', () => openAlertDetail(alert));
                tableBody.appendChild(row);
            });
        }

        function searchAIAlerts() {
            aiSearchTerm = document.getElementById('aiSearchInput').value;
            renderAIAlertTable();
        }

        function sortAIAlerts(field) {
            if (aiSortField === field) {
                aiSortAsc = !aiSortAsc;
            } else {
                aiSortField = field;
                aiSortAsc = true;
            }
            renderAIAlertTable();
        }

        function filterAIBySite(site) {
            aiSiteFilterValue = site;
            renderAIAlertTable();
        }

        function populateAISiteFilter(alerts) {
            const select = document.getElementById('aiSiteFilter');
            const currentValue = select.value;
            const sites = [...new Set(alerts.map(a => a.site))].sort();
            select.innerHTML = '<option value="all">All Sites</option>';
            sites.forEach(site => {
                select.innerHTML += `<option value="${site}"${site === currentValue ? ' selected' : ''}>${site}</option>`;
            });
            select.value = aiSiteFilterValue === 'all' || sites.includes(aiSiteFilterValue) ? aiSiteFilterValue : 'all';
        }

        // --- CORRELATED ALERTS WIDGET FUNCTIONS ---

        function showCorrelatedAlerts(severity) {
            if (isStatusExpanded) { hideStatusDevices(); }
            if (isIssuesExpanded) { hideIssuesAlerts(); }
            if (isSecurityExpanded) { hideSecurityAlerts(); }
            if (isAIExpanded) { hideAIAlerts(); }

            const summaryView = document.getElementById('correlatedSummaryView');
            const expandedView = document.getElementById('correlatedExpandedView');
            const card = document.getElementById('correlatedAlertsCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            card.classList.add('expanded');
            backdrop.classList.add('active');
            mainContent.style.overflow = 'hidden';
            isCorrelatedExpanded = true;

            summaryView.classList.add('hidden');
            expandedView.classList.remove('hidden');

            currentCorrelatedFilter = severity;
            updateCorrelatedFilterButtons(severity);
            renderCorrelatedGroupsList();
        }

        function hideCorrelatedAlerts() {
            const summaryView = document.getElementById('correlatedSummaryView');
            const expandedView = document.getElementById('correlatedExpandedView');
            const card = document.getElementById('correlatedAlertsCard');
            const backdrop = document.getElementById('expandedBackdrop');
            const mainContent = document.querySelector('main');

            card.classList.remove('expanded');
            backdrop.classList.remove('active');
            mainContent.style.overflow = '';
            isCorrelatedExpanded = false;

            summaryView.classList.remove('hidden');
            expandedView.classList.add('hidden');
        }

        function filterCorrelatedAlerts(severity) {
            currentCorrelatedFilter = severity;
            updateCorrelatedFilterButtons(severity);
            renderCorrelatedGroupsList();
        }

        function updateCorrelatedFilterButtons(active) {
            const inactive = 'px-3 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';
            const activeClass = 'px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors';
            ['corrFilterAll', 'corrFilterCrit', 'corrFilterWarn'].forEach(id => {
                document.getElementById(id).className = inactive;
            });
            const map = { all: 'corrFilterAll', crit: 'corrFilterCrit', warn: 'corrFilterWarn' };
            const btn = document.getElementById(map[active]);
            if (btn) btn.className = activeClass;
        }

        function renderCorrelatedGroupsList() {
            const container = document.getElementById('correlatedGroupsList');
            const countEl = document.getElementById('correlatedAlertCount');
            container.innerHTML = '';

            const effectiveScope = currentSiteFilter || currentScope;
            let groups = DataLoader.getCorrelatedAlerts(effectiveScope);

            if (currentCorrelatedFilter === 'crit') {
                groups = groups.filter(g => g.alerts.some(a => a.severity === 'crit'));
            } else if (currentCorrelatedFilter === 'warn') {
                groups = groups.filter(g => !g.alerts.some(a => a.severity === 'crit'));
            }

            countEl.innerText = `${groups.length} group${groups.length !== 1 ? 's' : ''}`;

            if (groups.length === 0) {
                container.innerHTML = `<div class="text-center text-sm text-gray-400 py-8">No correlated alerts found.</div>`;
                return;
            }

            const sevBadge = {
                crit: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-full px-2 py-0.5 text-[10px] font-bold border border-red-100 dark:border-red-900',
                warn: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 rounded-full px-2 py-0.5 text-[10px] font-bold border border-amber-100 dark:border-amber-900',
                info: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 rounded-full px-2 py-0.5 text-[10px] font-bold border border-blue-100 dark:border-blue-900'
            };

            groups.forEach(group => {
                const groupSev = group.alerts.some(a => a.severity === 'crit') ? 'crit' : 'warn';
                const groupIcon = groupSev === 'crit'
                    ? '<i class="fa-solid fa-circle-exclamation text-red-500"></i>'
                    : '<i class="fa-solid fa-triangle-exclamation text-amber-500"></i>';

                const el = document.createElement('div');
                el.className = 'mb-3 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden';
                el.innerHTML = `
                    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 cursor-pointer select-none" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        <div class="flex items-center gap-2 min-w-0">
                            ${groupIcon}
                            <span class="text-xs font-semibold text-dark-text truncate">${group.title}</span>
                        </div>
                        <div class="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span class="text-[10px] text-dark-muted">${group.firstSeen}</span>
                            <span class="text-[10px] text-dark-muted bg-gray-200 dark:bg-gray-700 rounded px-1.5 py-0.5">${group.alerts.length} alerts</span>
                            <i class="fa-solid fa-chevron-down text-[9px] text-gray-400"></i>
                        </div>
                    </div>
                    <div class="hidden">
                        ${group.alerts.map((a, i) => `
                            <div class="corr-alert-row flex items-start gap-2 px-3 py-2 border-t border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" data-group-idx="${groups.indexOf(group)}" data-alert-idx="${i}">
                                <span class="${sevBadge[a.severity]} flex-shrink-0 mt-0.5">${a.severity.toUpperCase()}</span>
                                <div class="min-w-0 flex-1">
                                    <div class="text-xs font-medium text-dark-text truncate">${a.device}</div>
                                    <div class="text-[10px] text-dark-muted truncate">${a.message}</div>
                                </div>
                                <span class="text-[10px] text-dark-muted flex-shrink-0">${a.timeAgo}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
                container.appendChild(el);
            });

            // Attach click handlers to correlated alert rows
            container.querySelectorAll('.corr-alert-row').forEach(row => {
                row.addEventListener('click', e => {
                    e.stopPropagation();
                    const gIdx = parseInt(row.dataset.groupIdx);
                    const aIdx = parseInt(row.dataset.alertIdx);
                    const a = groups[gIdx].alerts[aIdx];
                    openAlertDetail({
                        sev: a.severity,
                        site: a.site,
                        region: a.region,
                        device: a.device,
                        vendor: a.vendor,
                        type: a.type,
                        msg: a.message,
                        time: a.timeAgo
                    });
                });
            });
        }

        // --- API QUOTA RENDERING ---

        let merakiRpmChart = null;

        function renderAPIQuota(scope = 'Global') {
            const quota = DataLoader.getAPIQuota(scope);

            // --- Meraki: rpm trend line chart ---
            const merakiData = quota.meraki;
            if (merakiData && merakiData.rpmTrend) {
                const canvas = document.getElementById('merakiRpmChart');
                if (canvas) {
                    if (merakiRpmChart) { merakiRpmChart.destroy(); }

                    const trend = merakiData.rpmTrend;
                    const rpmLimit = merakiData.rpmLimit || 60;
                    const labels = trend.map((_, i) => {
                        const minsAgo = (trend.length - 1 - i) * 2;
                        return minsAgo === 0 ? 'now' : `-${minsAgo}m`;
                    });

                    // Color each bar: red if over limit, amber if within 10%, green otherwise
                    const barColors = trend.map(v =>
                        v >= rpmLimit ? '#ef4444' : v >= rpmLimit * 0.9 ? '#f59e0b' : '#6366f1'
                    );

                    merakiRpmChart = new Chart(canvas.getContext('2d'), {
                        type: 'bar',
                        data: {
                            labels,
                            datasets: [
                                {
                                    label: 'Requests/min',
                                    data: trend,
                                    backgroundColor: barColors,
                                    borderRadius: 2,
                                    barPercentage: 0.8,
                                    categoryPercentage: 0.9
                                },
                                {
                                    // Rate-limit annotation line rendered as a scatter line
                                    label: '60 rpm limit',
                                    data: trend.map(() => rpmLimit),
                                    type: 'line',
                                    borderColor: '#ef4444',
                                    borderWidth: 1.5,
                                    borderDash: [4, 3],
                                    pointRadius: 0,
                                    fill: false
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    callbacks: {
                                        label: ctx => ctx.datasetIndex === 0
                                            ? `${ctx.parsed.y} rpm`
                                            : `Limit: ${rpmLimit} rpm`
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    grid: { display: false },
                                    ticks: {
                                        font: { size: 8 },
                                        maxTicksLimit: 6,
                                        maxRotation: 0
                                    }
                                },
                                y: {
                                    beginAtZero: true,
                                    suggestedMax: Math.max(...trend, rpmLimit) * 1.15,
                                    grid: { color: 'rgba(128,128,128,0.1)', borderDash: [2, 2] },
                                    ticks: { font: { size: 8 }, maxTicksLimit: 4 }
                                }
                            }
                        }
                    });
                }
            }

            // --- Mist: quota progress bar ---
            const mistData = quota.mist;
            const mistContainer = document.getElementById('mistQuotaContainer');
            if (mistData && mistContainer) {
                const pct = Math.round((mistData.used / mistData.limit) * 100);
                const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-newrelic-success';
                const textColor = pct >= 90 ? 'text-red-500 dark:text-red-400' : pct >= 70 ? 'text-amber-500' : 'text-green-600 dark:text-green-400';
                mistContainer.innerHTML = `
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="text-[10px] text-dark-muted">Daily API calls</span>
                        <span class="text-xs ${textColor} font-bold">${pct}%</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-1.5">
                        <div class="${barColor} h-2.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                    <div class="flex justify-between text-[10px] text-dark-muted">
                        <span>${mistData.used.toLocaleString()} / ${mistData.limit.toLocaleString()} calls</span>
                        <span>Resets in ${mistData.resetIn}</span>
                    </div>
                `;
            }
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

        // --- WAN RESILIENCE OVERLAY ---
        let _wanActiveFilter = 'failover';

        function openWanResilienceTrends() {
            document.getElementById('wanResilienceTrendsOverlay').classList.remove('hidden');
            _wanActiveFilter = 'failover';
            renderWanSiteList();
            updateWanFilterButtons();
        }

        function closeWanResilienceTrends() {
            document.getElementById('wanResilienceTrendsOverlay').classList.add('hidden');
        }

        function filterWanSites(filter) {
            _wanActiveFilter = filter;
            renderWanSiteList();
            updateWanFilterButtons();
        }

        function updateWanFilterButtons() {
            const active = 'px-3 py-1.5 text-xs rounded-lg font-medium transition-colors';
            const inactive = active + ' bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600';
            const styles = {
                failover: active + ' bg-amber-500 text-white',
                down:     active + ' bg-red-500 text-white',
                both:     active + ' bg-indigo-500 text-white'
            };
            ['failover', 'down', 'both'].forEach(f => {
                document.getElementById('wanFilter' + f.charAt(0).toUpperCase() + f.slice(1)).className =
                    _wanActiveFilter === f ? styles[f] : inactive;
            });
        }

        function renderWanSiteList() {
            const gateways = DataLoader.getDevicesByScope
                ? DataLoader.getDevicesByScope(currentScope, 'gateways')
                : (DataLoader._data?.devices?.gateways || []);

            const rows = gateways.filter(g => {
                if (_wanActiveFilter === 'failover') return g.status === 'warning';
                if (_wanActiveFilter === 'down')     return g.status === 'critical' || g.status === 'offline';
                // both
                return g.status === 'warning' || g.status === 'critical' || g.status === 'offline';
            });

            const tbody = document.getElementById('wanSiteTableBody');
            const empty = document.getElementById('wanSiteEmpty');
            const count = document.getElementById('wanSiteCount');

            count.textContent = rows.length + ' site' + (rows.length !== 1 ? 's' : '');

            if (rows.length === 0) {
                tbody.innerHTML = '';
                empty.classList.remove('hidden');
                return;
            }
            empty.classList.add('hidden');

            // Deterministic "since" timestamp per gateway (stable across re-filters)
            const nowMs = Date.now();
            function gatewayStatusSince(g) {
                // Build a larger seed by multiplying char codes positionally
                const str = (g.id || g.serial || g.name || 'x');
                let seed = 0;
                for (let i = 0; i < str.length; i++) {
                    seed = (seed * 31 + str.charCodeAt(i)) >>> 0; // keep as 32-bit uint
                }
                const maxAgeMs = (g.status === 'critical' || g.status === 'offline' ? 6 : 12) * 3600 * 1000;
                const minAgeMs = 5 * 60 * 1000; // at least 5 minutes ago
                const offsetMs = minAgeMs + (seed % (maxAgeMs - minAgeMs));
                return new Date(nowMs - offsetMs);
            }
            function formatSince(date) {
                const diffMin = Math.round((nowMs - date.getTime()) / 60000);
                if (diffMin < 60) return diffMin + 'm ago';
                const diffH = Math.floor(diffMin / 60);
                const remMin = diffMin % 60;
                return diffH + 'h ' + (remMin > 0 ? remMin + 'm ' : '') + 'ago';
            }

            tbody.innerHTML = rows.map(g => {
                const isDown = g.status === 'critical' || g.status === 'offline';
                const badge = isDown
                    ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400"><i class="fa-solid fa-circle-xmark text-[9px]"></i> Down</span>'
                    : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400"><i class="fa-solid fa-triangle-exclamation text-[9px]"></i> Failover</span>';
                const since = gatewayStatusSince(g);
                const sinceStr = formatSince(since);
                const sinceAbsolute = since.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td class="px-4 py-2.5 text-sm font-medium text-dark-text">${g.site || '—'}</td>
                    <td class="px-4 py-2.5">${badge}</td>
                    <td class="px-4 py-2.5 text-xs text-dark-muted" title="${sinceAbsolute}">${sinceStr}</td>
                </tr>`;
            }).join('');
        }

        window.filterWanSites = filterWanSites;

        // Expose overlay functions to global scope for onclick handlers
        window.openLatencyTrends = openLatencyTrends;
        window.closeLatencyTrends = closeLatencyTrends;
        window.openFrustrationTrends = openFrustrationTrends;
        window.closeFrustrationTrends = closeFrustrationTrends;
        window.openWanResilienceTrends = openWanResilienceTrends;
        window.closeWanResilienceTrends = closeWanResilienceTrends;
        window.showCorrelatedAlerts = showCorrelatedAlerts;
        window.hideCorrelatedAlerts = hideCorrelatedAlerts;
        window.filterCorrelatedAlerts = filterCorrelatedAlerts;

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
                if (isAIExpanded) { hideAIAlerts(); return; }
                if (isCorrelatedExpanded) { hideCorrelatedAlerts(); return; }
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
                { id: 'statusSearchInput', handler: searchStatusDevices },
                { id: 'issuesSearchInput', handler: searchIssuesAlerts },
                { id: 'securitySearchInput', handler: searchSecurityAlerts },
                { id: 'aiSearchInput', handler: searchAIAlerts }
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

