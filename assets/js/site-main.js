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
    siteRenderers.forEach(fn => fn(siteName));
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
    const up = circuits.filter(c => c.status === 'online').length;
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
