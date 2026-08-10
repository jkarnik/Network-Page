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
