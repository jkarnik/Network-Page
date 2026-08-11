// Initialize navigation for Site page
NavigationManager.init('site');

// --- CONSTANTS & SHARED STATE ---
const STAGE_TABS = ['stageA', 'stageAB', 'stageABC'];
const charts = {};
let currentSite = null;

// --- RENDERER REGISTRY ---
// Each widget task registers one function here instead of editing a growing
// call list — renderAllTabs() runs every registered renderer whenever the
// selected site changes.
const siteRenderers = [];

function registerSiteRenderer(fn) {
    siteRenderers.push(fn);
}

function renderAllTabs(siteName) {
    siteRenderers.forEach(fn => {
        try {
            fn(siteName);
        } catch (err) {
            console.error('Site page renderer failed:', err);
        }
    });
}

// --- SITE IDENTITY CARD (persistent, stage-independent) ---
function renderIdentityCard(siteName) {
    const site = DataLoader.getSite(siteName);
    if (!site) return;

    document.querySelector('[data-site-name]').textContent = siteName;
    document.querySelector('[data-site-region]').textContent = site.region || '—';

    const gateways = DataLoader.getDevicesBySite(siteName, 'gateways');
    const switches = DataLoader.getDevicesBySite(siteName, 'switches');
    const aps = DataLoader.getDevicesBySite(siteName, 'accessPoints');

    document.querySelector('[data-site-gateway-count]').textContent = gateways.length;
    document.querySelector('[data-site-switch-count]').textContent = switches.length;
    document.querySelector('[data-site-ap-count]').textContent = aps.length;
    document.querySelector('[data-site-circuit-count]').textContent = DataLoader.getCircuits(siteName).length;
    document.querySelector('[data-site-device-count]').textContent = gateways.length + switches.length + aps.length;
}

// --- SITE SELECTOR ---
async function initSiteSelectorController() {
    const site = await SharedUI.initSiteSelector({
        onSiteSelected: async (site) => {
            currentSite = site.name;
            await loadSiteData(site.name);
        },
        onSiteChanged: (siteName) => updateSiteView(siteName)
    });
    if (site) currentSite = site.name;
}

async function updateSiteView(siteName) {
    SharedUI.changeSite(siteName, async (site) => {
        currentSite = site.name;
        await loadSiteData(site.name);
    });
}

async function loadSiteData(siteName) {
    await DataLoader.load();
    await DataLoader.loadSiteDetails();

    renderIdentityCard(siteName);
    renderAllTabs(siteName);

    themeManager.registerCharts(charts);
}

// --- TAB SWITCHING ---
function switchTab(tabName) {
    SharedUI.switchTab(tabName, {
        activeClasses: 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400',
        inactiveClasses: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
    });
}

// --- INITIALIZE ---
ChartConfig.initDefaults();
initSiteSelectorController();
SharedUI.initTabListeners(switchTab);

if (themeManager.isDarkMode()) {
    themeManager.updateChartColors();
}

// Expose for the dropdown's inline change handling parity with other pages
window.updateSiteView = updateSiteView;

// --- HEALTH BADGE (Stage A) ---

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function renderSparkline(id, dataset, color = '#3b82f6') {
    const canvas = document.getElementById(id);
    if (!canvas || !dataset) return;

    if (charts[id]) {
        charts[id].data.labels = dataset.labels;
        charts[id].data.datasets[0].data = dataset.data;
        charts[id].update();
        return;
    }

    charts[id] = new Chart(canvas, {
        type: 'line',
        data: {
            labels: dataset.labels,
            datasets: [{
                data: dataset.data,
                borderColor: color,
                backgroundColor: color + '1a',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: true } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

function statusCounts(devices) {
    return {
        online: devices.filter(d => d.status === 'online').length,
        warning: devices.filter(d => d.status === 'warning').length,
        critical: devices.filter(d => d.status === 'critical').length,
        offline: devices.filter(d => d.status === 'offline').length,
        total: devices.length
    };
}

function formatStatusCounts(counts) {
    const parts = [];
    if (counts.online) parts.push(`${counts.online} online`);
    if (counts.warning) parts.push(`${counts.warning} alerting`);
    if (counts.critical) parts.push(`${counts.critical} critical`);
    if (counts.offline) parts.push(`${counts.offline} offline`);
    return parts.join(', ') || 'no devices';
}

function computeCircuitSummary(siteName) {
    const circuits = DataLoader.getCircuits(siteName);
    const up = circuits.filter(c => c.status !== 'critical' && c.status !== 'offline').length;
    const totalUp = circuits.reduce((s, c) => s + c.throughputUpMbps, 0);
    const totalDown = circuits.reduce((s, c) => s + c.throughputDownMbps, 0);
    const maxLoss = circuits.reduce((m, c) => Math.max(m, c.lossPct), 0);
    const primary = circuits.find(c => c.tier === 'Primary') || circuits[0] || null;
    return { up, total: circuits.length, totalUp, totalDown, maxLoss, primary };
}

function computeVpnSummary(siteName) {
    const tunnels = DataLoader.getVpnTunnels(siteName);
    const up = tunnels.filter(t => t.status === 'up').length;
    return { up, total: tunnels.length };
}

function renderHealthBadge(siteName) {
    const circuitSummary = computeCircuitSummary(siteName);
    const vpnSummary = computeVpnSummary(siteName);
    const switches = statusCounts(DataLoader.getDevicesBySite(siteName, 'switches'));
    const aps = statusCounts(DataLoader.getDevicesBySite(siteName, 'accessPoints'));
    const hardware = DataLoader.getHardwareRollup(siteName);
    // Each flagged device counts as exactly one failed PSU (of its 2) — a
    // simplification for the mock rollup, not a claim about real PSU counts.
    const psuOk = hardware.psuTotal - hardware.psuFailedDeviceIds.length;
    const routingPaths = circuitSummary.up + vpnSummary.up;
    const routingTotal = circuitSummary.total + vpnSummary.total;

    STAGE_TABS.forEach(tab => {
        setText(`healthUplinkStatus-${tab}`, `${circuitSummary.up}/${circuitSummary.total} up`);
        setText(`healthUplinkThroughput-${tab}`, `${circuitSummary.totalUp}/${circuitSummary.totalDown} Mbps`);
        setText(`healthUplinkLoss-${tab}`, `${circuitSummary.maxLoss.toFixed(2)}% loss`);
        setText(`healthVpnStatus-${tab}`, `${vpnSummary.up}/${vpnSummary.total} up`);
        setText(`healthSwitchStatus-${tab}`, formatStatusCounts(switches));
        setText(`healthApStatus-${tab}`, formatStatusCounts(aps));
        setText(`healthPsuStatus-${tab}`, `${psuOk}/${hardware.psuTotal} OK`);
        setText(`healthRoutingRedundancy-${tab}`, `${routingPaths}/${routingTotal} paths available`);
        if (circuitSummary.primary) {
            renderSparkline(`healthUplinkSparkline-${tab}`, circuitSummary.primary.latencyTrend, '#3b82f6');
        }
    });
}

registerSiteRenderer(renderHealthBadge);

// --- NEEDS ATTENTION PANEL (Stage A, grows in B/C) ---

const NEEDS_ATTENTION_OPTS_BY_TAB = {
    stageA: {},
    stageAB: { includeBgp: true },
    stageABC: { includeBgp: true, includeSecurity: true }
};

function renderNeedsAttention(siteName) {
    STAGE_TABS.forEach(tab => {
        const container = document.getElementById(`needsAttentionList-${tab}`);
        if (!container) return;

        const items = DataLoader.getNeedsAttention(siteName, NEEDS_ATTENTION_OPTS_BY_TAB[tab]);

        if (items.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-400 italic">All systems normal — nothing needs attention.</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="flex items-center gap-2 py-1.5 px-2 rounded ${item.severity === 'crit' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}">
                <i class="fa-solid ${item.severity === 'crit' ? 'fa-circle-exclamation text-red-500' : 'fa-triangle-exclamation text-amber-500'}"></i>
                <span class="text-sm text-dark-text">${SharedUI.escapeHtml(item.text)}</span>
            </div>
        `).join('');
    });
}

registerSiteRenderer(renderNeedsAttention);

// --- WAN/UPLINK DETAIL SECTION (Stage A, cellular column filled by Task 12) ---

const CIRCUIT_STATUS_BADGES = {
    online: '<span class="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Online</span>',
    warning: '<span class="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Alerting</span>',
    critical: '<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Critical</span>',
    offline: '<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">Offline</span>'
};

function renderWanSection(siteName) {
    const circuits = DataLoader.getCircuits(siteName);

    STAGE_TABS.forEach(tab => {
        const tbody = document.getElementById(`circuitsTableBody-${tab}`);
        if (!tbody) return;

        if (circuits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="px-4 py-3 text-center text-sm text-gray-400">No WAN circuits at this site.</td></tr>';
            return;
        }

        tbody.innerHTML = circuits.map(c => {
            const device = DataLoader.getDeviceFromManifest(c.deviceId);
            const statusBadge = CIRCUIT_STATUS_BADGES[c.status] || CIRCUIT_STATUS_BADGES.online;
            return `
                <tr>
                    <td class="px-4 py-2.5 font-bold text-dark-text whitespace-nowrap">${device ? device.name : c.deviceId}</td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap">${SharedUI.escapeHtml(c.isp)}</td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap">${c.tier}</td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap">${c.connectionType}</td>
                    <td class="px-4 py-2.5 whitespace-nowrap">${statusBadge}</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">${c.throughputUpMbps} / ${c.throughputDownMbps} Mbps</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">${c.latencyMs} ms</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">${c.lossPct}%</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap text-gray-400" id="circuitCellular-${c.deviceId}-${tab}">—</td>
                </tr>
            `;
        }).join('');
    });
}

registerSiteRenderer(renderWanSection);

// --- LAN/SWITCHING DETAIL SECTION (Stage A) ---

function renderLanSection(siteName) {
    const switches = DataLoader.getDevicesBySite(siteName, 'switches');
    const hardware = DataLoader.getHardwareRollup(siteName);

    STAGE_TABS.forEach(tab => {
        const tbody = document.getElementById(`lanTableBody-${tab}`);
        if (!tbody) return;

        if (switches.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-400">No switches at this site.</td></tr>';
            return;
        }

        tbody.innerHTML = switches.map(sw => {
            const statusBadge = CIRCUIT_STATUS_BADGES[sw.status] || CIRCUIT_STATUS_BADGES.online;
            const psuFailed = hardware.psuFailedDeviceIds.includes(sw.id);
            const psuBadge = psuFailed
                ? '<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Failed</span>'
                : '<span class="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">OK</span>';
            return `
                <tr>
                    <td class="px-4 py-2.5 font-bold text-dark-text whitespace-nowrap">${sw.name}</td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap">${sw.model}</td>
                    <td class="px-4 py-2.5 whitespace-nowrap">${statusBadge}</td>
                    <td class="px-4 py-2.5 whitespace-nowrap">${psuBadge}</td>
                </tr>
            `;
        }).join('');
    });
}

registerSiteRenderer(renderLanSection);

// --- DEVICE INVENTORY + SITE ALERT FEED (Stage A) ---

const DEVICE_TYPE_PAGES = { gateway: 'sdwan.html', switch: 'switch.html', accessPoint: 'access-point.html' };

function renderDeviceInventory(siteName) {
    const devices = DataLoader.getAllDevices().filter(d => d.site === siteName);

    STAGE_TABS.forEach(tab => {
        const tbody = document.getElementById(`deviceInventoryTableBody-${tab}`);
        if (!tbody) return;

        if (devices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-4 py-3 text-center text-sm text-gray-400">No devices at this site.</td></tr>';
            return;
        }

        tbody.innerHTML = devices.map(d => {
            const statusBadge = CIRCUIT_STATUS_BADGES[d.status] || CIRCUIT_STATUS_BADGES.online;
            const page = DEVICE_TYPE_PAGES[d.type] || 'sdwan.html';
            return `
                <tr class="hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <td class="px-4 py-2.5 whitespace-nowrap">
                        <a href="${page}?device=${d.id}" class="font-bold text-blue-600 dark:text-blue-400 hover:underline">${d.name}</a>
                    </td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap">${d.model}</td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap capitalize">${d.type}</td>
                    <td class="px-4 py-2.5 whitespace-nowrap">${statusBadge}</td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap">${d.uptime || '—'}</td>
                </tr>
            `;
        }).join('');
    });
}

registerSiteRenderer(renderDeviceInventory);

function renderSiteAlertFeeds(siteName) {
    STAGE_TABS.forEach(tab => {
        SharedUI.updateSiteAlertFeed(siteName, {
            tableBodyId: `siteAlertTableBody-${tab}`,
            alertCountId: `siteAlertCount-${tab}`
        });
    });
}

registerSiteRenderer(renderSiteAlertFeeds);

// --- CELLULAR SIGNAL + VPN TUNNELS DETAIL (Stage A+B) ---

async function renderCellularSignal(siteName) {
    const circuits = DataLoader.getCircuits(siteName);

    for (const circuit of circuits) {
        const device = DataLoader.getDeviceFromManifest(circuit.deviceId);
        if (!device) continue;

        const deviceData = await DataLoader.getDeviceData(circuit.deviceId, 'gateway');
        const cellular = deviceData && deviceData.cellular;

        let text = '—';
        if (cellular) {
            text = device.vendor === 'meraki'
                ? `${cellular.status} (${cellular.signalStrength} dBm)`
                : cellular.status;
        }

        ['stageAB', 'stageABC'].forEach(tab => {
            setText(`circuitCellular-${circuit.deviceId}-${tab}`, text);
        });
    }
}

registerSiteRenderer(renderCellularSignal);

function renderVpnTunnels(siteName) {
    const tunnels = DataLoader.getVpnTunnels(siteName);

    ['stageAB', 'stageABC'].forEach(tab => {
        const tbody = document.getElementById(`vpnTunnelsTableBody-${tab}`);
        if (!tbody) return;

        if (tunnels.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-3 text-center text-sm text-gray-400">No VPN tunnels at this site.</td></tr>';
            return;
        }

        tbody.innerHTML = tunnels.map(t => {
            const statusBadge = t.status === 'up'
                ? '<span class="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Up</span>'
                : '<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Down</span>';
            return `
                <tr>
                    <td class="px-4 py-2.5 font-bold text-dark-text whitespace-nowrap">${SharedUI.escapeHtml(t.peerName)}</td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap capitalize">${t.vendor}</td>
                    <td class="px-4 py-2.5 whitespace-nowrap">${statusBadge}</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">${t.latencyMs != null ? t.latencyMs + ' ms' : '—'}</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">${t.jitterMs != null ? t.jitterMs + ' ms' : '—'}</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">${t.lossPct != null ? t.lossPct + '%' : '—'}</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">${t.bandwidthUpMbps} / ${t.bandwidthDownMbps} Mbps</td>
                </tr>
            `;
        }).join('');
    });
}

registerSiteRenderer(renderVpnTunnels);

// --- BGP FLAP DETECTOR (Stage A+B) ---

function renderBgpFlapDetector(siteName) {
    const flaps = DataLoader.getBgpFlaps(siteName);

    ['stageAB', 'stageABC'].forEach(tab => {
        const countEl = document.getElementById(`bgpFlapCount-${tab}`);
        const listEl = document.getElementById(`bgpFlapList-${tab}`);
        if (countEl) countEl.textContent = `${flaps.length} flap${flaps.length !== 1 ? 's' : ''}`;
        if (!listEl) return;

        if (flaps.length === 0) {
            listEl.innerHTML = '<p class="text-sm text-gray-400 italic">No BGP flaps detected.</p>';
            return;
        }

        listEl.innerHTML = flaps.map(f => `
            <div class="flex items-center justify-between py-1.5 px-2 rounded bg-amber-50 dark:bg-amber-900/20">
                <span class="text-sm text-dark-text">${SharedUI.escapeHtml(f.neighbor)}: ${f.previousState} → ${f.currentState}</span>
                <span class="text-xs text-gray-400">${f.timeAgo}</span>
            </div>
        `).join('');
    });
}

registerSiteRenderer(renderBgpFlapDetector);

// --- WIRELESS SECTION (Stage A+B; Time-to-Connect appended in Task 17) ---

function renderWirelessSection(siteName) {
    const aps = statusCounts(DataLoader.getDevicesBySite(siteName, 'accessPoints'));
    const activeClients = DataLoader.getClientCountByType('accessPoints', siteName);

    ['stageAB', 'stageABC'].forEach(tab => {
        setText(`wirelessApHealth-${tab}`, formatStatusCounts(aps));
        setText(`wirelessActiveClients-${tab}`, `${activeClients} clients`);
    });
}

registerSiteRenderer(renderWirelessSection);

// --- APPLICATION VISIBILITY (Stage A+B+C) ---

function renderTopApplications(siteName) {
    const topApps = DataLoader.getTopApplications(siteName);
    const canvas = document.getElementById('topAppsChart-stageABC');
    if (!canvas) return;

    if (charts['topAppsChart-stageABC']) {
        charts['topAppsChart-stageABC'].data.labels = topApps.labels;
        charts['topAppsChart-stageABC'].data.datasets[0].data = topApps.data;
        charts['topAppsChart-stageABC'].data.datasets[0].backgroundColor = topApps.colors;
        charts['topAppsChart-stageABC'].update();
    } else {
        charts['topAppsChart-stageABC'] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: topApps.labels,
                datasets: [{ data: topApps.data, backgroundColor: topApps.colors, borderWidth: 0 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    const legendEl = document.getElementById('topAppsLegend-stageABC');
    if (legendEl) {
        legendEl.innerHTML = topApps.labels.map((label, i) => `
            <div class="flex items-center gap-2 mb-2">
                <div class="w-3 h-3 rounded-sm flex-shrink-0" style="background-color: ${topApps.colors[i]};"></div>
                <div class="text-sm text-dark-text">
                    <span class="font-medium">${SharedUI.escapeHtml(label)}</span>
                    <span class="text-xs text-dark-muted ml-1">${topApps.data[i]}%</span>
                </div>
            </div>
        `).join('');
    }
}

registerSiteRenderer(renderTopApplications);

// --- VLAN/SEGMENTATION + DHCP POOL UTILIZATION (Stage A+B+C) ---

const VLAN_COLORS = { Corp: '#3b82f6', Secure: '#8b5cf6', Guest: '#f59e0b', Prod: '#10b981' };
const VLAN_DHCP_ID_PREFIX = { Corp: 'dhcpCorp', Secure: 'dhcpSecure', Guest: 'dhcpGuest', Prod: 'dhcpProd' };

function createOrUpdateDhcpBar(id, used, total, color, isGlobal, vlans) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const available = Math.max(0, total - used);

    const datasets = isGlobal
        ? vlans.map(v => ({ label: v.name, data: [v.dhcpUsed], backgroundColor: VLAN_COLORS[v.name] || '#6b7280', borderRadius: 0 }))
            .concat([{ label: 'Available', data: [available], backgroundColor: '#e5e7eb', borderRadius: 4 }])
        : [
            { label: 'Used', data: [used], backgroundColor: color, borderRadius: 0 },
            { label: 'Available', data: [available], backgroundColor: '#e5e7eb', borderRadius: 4 }
        ];

    if (charts[id]) {
        charts[id].data.datasets = datasets;
        charts[id].options.scales.x.max = total;
        charts[id].update();
        return;
    }

    charts[id] = new Chart(canvas, {
        type: 'bar',
        data: { labels: [''], datasets },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { stacked: true, max: total, grid: { display: false }, ticks: { display: false } },
                y: { stacked: true, grid: { display: false }, ticks: { display: false } }
            }
        }
    });
}

function renderDhcpBars(siteName, vlans) {
    const dhcp = DataLoader.getSiteDhcp(siteName);

    createOrUpdateDhcpBar('dhcpGlobalBar-stageABC', dhcp.used, dhcp.total, null, true, vlans);
    setText('dhcpGlobalPct-stageABC', dhcp.total ? `(${Math.round((dhcp.used / dhcp.total) * 100)}%)` : '');
    setText('dhcpGlobalCount-stageABC', `${dhcp.used} / ${dhcp.total}`);

    vlans.forEach(v => {
        const prefix = VLAN_DHCP_ID_PREFIX[v.name];
        if (!prefix) return;
        createOrUpdateDhcpBar(`${prefix}Bar-stageABC`, v.dhcpUsed, v.dhcpTotal, VLAN_COLORS[v.name], false, null);
        setText(`${prefix}Pct-stageABC`, v.dhcpTotal ? `(${Math.round((v.dhcpUsed / v.dhcpTotal) * 100)}%)` : '');
        setText(`${prefix}Value-stageABC`, `${v.dhcpUsed}/${v.dhcpTotal}`);
    });
}

function renderVlanSection(siteName) {
    const vlans = DataLoader.getVlanInventory(siteName);

    const tbody = document.getElementById('vlanTableBody-stageABC');
    if (tbody) {
        tbody.innerHTML = vlans.length === 0
            ? '<tr><td colspan="4" class="px-4 py-3 text-center text-sm text-gray-400">No VLANs configured.</td></tr>'
            : vlans.map(v => `
                <tr>
                    <td class="px-4 py-2.5 font-bold text-dark-text whitespace-nowrap">${v.id} - ${SharedUI.escapeHtml(v.name)}</td>
                    <td class="px-4 py-2.5 text-dark-muted whitespace-nowrap">${SharedUI.escapeHtml(v.purpose)}</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">${v.clientCount}</td>
                    <td class="px-4 py-2.5 text-right whitespace-nowrap">${v.bandwidthMbps} Mbps</td>
                </tr>
            `).join('');
    }

    renderDhcpBars(siteName, vlans);
}

registerSiteRenderer(renderVlanSection);

// --- TIME-TO-CONNECT BREAKDOWN (Stage A+B+C) ---

function computeSiteTimeToConnect(siteName) {
    const aps = DataLoader.getDevicesBySite(siteName, 'accessPoints');
    const withData = aps.filter(ap => ap.timeToConnect && ap.timeToConnect > 0);
    if (withData.length === 0) return null;

    const frustrationData = DataLoader.getFrustrationData(siteName, withData.length);
    const totals = { association: 0, auth: 0, dhcp: 0, dns: 0 };
    frustrationData.forEach(d => {
        totals.association += d.breakdown.association;
        totals.auth += d.breakdown.auth;
        totals.dhcp += d.breakdown.dhcp;
        totals.dns += d.breakdown.dns;
    });

    const n = frustrationData.length;
    return {
        association: Math.round(totals.association / n),
        auth: Math.round(totals.auth / n),
        dhcp: Math.round(totals.dhcp / n),
        dns: Math.round(totals.dns / n)
    };
}

function renderTimeToConnect(siteName) {
    const container = document.getElementById('timeToConnectContainer-stageABC');
    if (!container) return;

    const breakdown = computeSiteTimeToConnect(siteName);
    if (!breakdown) {
        container.innerHTML = '<p class="text-sm text-gray-400 italic mt-2">No Time-to-Connect data for this site.</p>';
        return;
    }

    if (!container.querySelector('canvas')) {
        container.innerHTML = `
            <p class="text-xs text-gray-400 mb-2">Time-to-Connect Breakdown (ms)</p>
            <div style="height: 60px;"><canvas id="timeToConnectChart-stageABC"></canvas></div>
        `;
    }

    const total = breakdown.association + breakdown.auth + breakdown.dhcp + breakdown.dns;
    const datasets = [
        { label: 'Association', data: [breakdown.association], backgroundColor: '#ef4444', borderRadius: 0 },
        { label: 'Authentication', data: [breakdown.auth], backgroundColor: '#f97316', borderRadius: 0 },
        { label: 'DHCP', data: [breakdown.dhcp], backgroundColor: '#f59e0b', borderRadius: 0 },
        { label: 'DNS Resolution', data: [breakdown.dns], backgroundColor: '#22c55e', borderRadius: 4 }
    ];

    if (charts['timeToConnectChart-stageABC']) {
        charts['timeToConnectChart-stageABC'].data.datasets = datasets;
        charts['timeToConnectChart-stageABC'].options.scales.x.max = total;
        charts['timeToConnectChart-stageABC'].update();
        return;
    }

    charts['timeToConnectChart-stageABC'] = new Chart(document.getElementById('timeToConnectChart-stageABC'), {
        type: 'bar',
        data: { labels: [''], datasets },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + context.parsed.x + ' ms';
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

registerSiteRenderer(renderTimeToConnect);

// --- SECURITY INTELLIGENCE (Stage A+B+C) ---

function renderSecurityIntelligence(siteName) {
    const detections = DataLoader.getSecurityDetections(siteName);
    const listEl = document.getElementById('securityIntelList-stageABC');
    const countEl = document.getElementById('securityIntelCount-stageABC');

    if (countEl) countEl.textContent = `${detections.length} detection${detections.length !== 1 ? 's' : ''}`;
    if (!listEl) return;

    if (detections.length === 0) {
        listEl.innerHTML = '<p class="text-sm text-gray-400 italic">No rogue APs or wireless threats detected.</p>';
        return;
    }

    listEl.innerHTML = detections.map(d => `
        <div class="flex items-center justify-between py-1.5 px-2 rounded bg-red-50 dark:bg-red-900/20">
            <span class="text-sm text-dark-text">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 uppercase mr-2">${SharedUI.escapeHtml(d.classification)}</span>
                ${SharedUI.escapeHtml(d.ssid)} (${SharedUI.escapeHtml(d.bssid)}) — ${d.band}, ${d.rssi} dBm
            </span>
            <span class="text-xs text-gray-400">${d.detectedAt}</span>
        </div>
    `).join('');
}

registerSiteRenderer(renderSecurityIntelligence);

// --- ALERT SUMMARY CARDS: INFRASTRUCTURE / SECURITY / AI (Stage A) ---

const ALERT_CARD_META = {
    infra: {
        idPrefix: 'infra',
        countsFn: siteName => DataLoader.getInfrastructureCounts(siteName),
        alertsFn: siteName => DataLoader.getAlertsBySite(siteName).filter(a => ['network', 'hardware', 'performance', 'system'].includes(a.type))
    },
    security: {
        idPrefix: 'security',
        countsFn: siteName => DataLoader.getSecurityCounts(siteName),
        alertsFn: siteName => DataLoader.getAlertsBySite(siteName).filter(a => a.type === 'security')
    },
    ai: {
        idPrefix: 'ai',
        countsFn: siteName => DataLoader.getAICounts(siteName),
        alertsFn: siteName => DataLoader.getAlertsBySite(siteName).filter(a => a.type === 'ai')
    }
};

const alertCardState = {};
STAGE_TABS.forEach(tab => {
    alertCardState[tab] = {
        infra: { severity: 'all', search: '', sortField: null, sortAsc: true },
        security: { severity: 'all', search: '', sortField: null, sortAsc: true },
        ai: { severity: 'all', search: '', sortField: null, sortAsc: true }
    };
});

function renderAlertCards(siteName) {
    STAGE_TABS.forEach(tab => {
        Object.keys(ALERT_CARD_META).forEach(cardKey => {
            const meta = ALERT_CARD_META[cardKey];
            const counts = meta.countsFn(siteName);
            setText(`${meta.idPrefix}CritCount-${tab}`, counts.crit);
            setText(`${meta.idPrefix}WarnCount-${tab}`, counts.warn);
        });
    });
}

registerSiteRenderer(renderAlertCards);

function showAlertCard(cardKey, severity, tab) {
    const meta = ALERT_CARD_META[cardKey];
    document.getElementById(`${meta.idPrefix}AlertsSummaryView-${tab}`).classList.add('hidden');
    document.getElementById(`${meta.idPrefix}AlertsExpandedView-${tab}`).classList.remove('hidden');

    const state = alertCardState[tab][cardKey];
    state.severity = severity;
    state.search = '';
    state.sortField = null;
    state.sortAsc = true;
    document.getElementById(`${meta.idPrefix}SearchInput-${tab}`).value = '';

    updateAlertFilterButtons(cardKey, tab, severity);
    renderAlertCardTable(cardKey, tab);
}

function hideAlertCard(cardKey, tab) {
    const meta = ALERT_CARD_META[cardKey];
    document.getElementById(`${meta.idPrefix}AlertsSummaryView-${tab}`).classList.remove('hidden');
    document.getElementById(`${meta.idPrefix}AlertsExpandedView-${tab}`).classList.add('hidden');
}

function filterAlertCard(cardKey, severity, tab) {
    alertCardState[tab][cardKey].severity = severity;
    updateAlertFilterButtons(cardKey, tab, severity);
    renderAlertCardTable(cardKey, tab);
}

function searchAlertCard(cardKey, tab) {
    const meta = ALERT_CARD_META[cardKey];
    alertCardState[tab][cardKey].search = document.getElementById(`${meta.idPrefix}SearchInput-${tab}`).value;
    renderAlertCardTable(cardKey, tab);
}

function sortAlertCard(cardKey, field, tab) {
    const state = alertCardState[tab][cardKey];
    if (state.sortField === field) {
        state.sortAsc = !state.sortAsc;
    } else {
        state.sortField = field;
        state.sortAsc = true;
    }
    renderAlertCardTable(cardKey, tab);
}

function updateAlertFilterButtons(cardKey, tab, activeSeverity) {
    const meta = ALERT_CARD_META[cardKey];
    const inactiveClass = 'px-2 py-1 text-[11px] rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
    const activeClass = 'px-2 py-1 text-[11px] rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium';
    const suffixMap = { all: 'FilterAll', crit: 'FilterCrit', warn: 'FilterWarn', info: 'FilterInfo' };

    Object.values(suffixMap).forEach(suffix => {
        const el = document.getElementById(`${meta.idPrefix}${suffix}-${tab}`);
        if (el) el.className = inactiveClass;
    });
    const activeEl = document.getElementById(`${meta.idPrefix}${suffixMap[activeSeverity]}-${tab}`);
    if (activeEl) activeEl.className = activeClass;
}

function sortAlertCardRows(alerts, field, asc) {
    if (!field) return alerts;
    const sevOrder = { crit: 0, warn: 1, info: 2 };
    return [...alerts].sort((a, b) => {
        let valA, valB;
        if (field === 'sev') {
            valA = sevOrder[a.severity] ?? 3;
            valB = sevOrder[b.severity] ?? 3;
        } else if (field === 'time') {
            valA = a.timeAgo;
            valB = b.timeAgo;
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

function renderAlertCardTable(cardKey, tab) {
    const meta = ALERT_CARD_META[cardKey];
    const state = alertCardState[tab][cardKey];
    const tableBody = document.getElementById(`${meta.idPrefix}AlertTableBody-${tab}`);
    const countEl = document.getElementById(`${meta.idPrefix}AlertCount-${tab}`);
    if (!tableBody || !currentSite) return;

    let alerts = meta.alertsFn(currentSite);

    if (state.severity !== 'all') {
        alerts = alerts.filter(a => a.severity === state.severity);
    }
    if (state.search) {
        const searchLower = state.search.toLowerCase();
        alerts = alerts.filter(a =>
            a.device.toLowerCase().includes(searchLower) ||
            a.message.toLowerCase().includes(searchLower)
        );
    }
    alerts = sortAlertCardRows(alerts, state.sortField, state.sortAsc);

    if (countEl) countEl.innerText = `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`;

    if (alerts.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="px-2 py-3 text-center text-xs text-gray-400">No alerts found for this criteria.</td></tr>';
        return;
    }

    tableBody.innerHTML = alerts.map(alert => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <td class="px-2 py-1.5 whitespace-nowrap">
                <span class="${SharedUI.SEV_STYLES_SUMMARY[alert.severity]} flex items-center gap-1 w-fit">
                    ${SharedUI.SEV_ICONS[alert.severity]} ${alert.severity.toUpperCase()}
                </span>
            </td>
            <td class="px-2 py-1.5 whitespace-nowrap text-dark-muted">${alert.timeAgo}</td>
            <td class="px-2 py-1.5 whitespace-nowrap text-indigo-600 dark:text-indigo-400 font-medium">${SharedUI.escapeHtml(alert.device)}</td>
            <td class="px-2 py-1.5 text-dark-muted truncate max-w-[220px]" title="${SharedUI.escapeHtml(alert.message)}">${SharedUI.escapeHtml(alert.message)}</td>
        </tr>
    `).join('');
}
