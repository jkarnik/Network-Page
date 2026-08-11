/**
 * Navigation Manager
 * Renders the shared header (nav bar, mobile drawer, mobile tab bar)
 * and handles navigation state and active page highlighting.
 *
 * @namespace NavigationManager
 */
const NavigationManager = {
    _activePage: null,

    /**
     * Page configuration: labels, hrefs, icons.
     * @private
     */
    _pages: [
        { key: 'summary', label: 'Summary', href: 'index.html', icon: 'fa-chart-line' },
        { key: 'sdwan',   label: 'SD-WAN',  href: 'sdwan.html', icon: 'fa-network-wired' },
        { key: 'switch',  label: 'Switch',   href: 'switch.html', icon: 'fa-server' },
        { key: 'ap',      label: 'Access Point', href: 'access-point.html', icon: 'fa-wifi' },
        { key: 'site', label: 'Sites', href: 'site.html', icon: 'fa-building' }
    ],

    /**
     * Scope selector options for the summary page.
     * @private
     */
    _scopeOptions: [
        { value: 'Global', label: 'Global Organization' },
        { group: 'Regions', items: [
            { value: 'North America', label: 'North America' },
            { value: 'EMEA', label: 'EMEA' },
            { value: 'APAC', label: 'APAC' }
        ]},
        { group: 'Sites', items: [
            { value: 'site:NYC-HQ', label: 'NYC-HQ' },
            { value: 'site:NJ-Warehouse', label: 'NJ-Warehouse' },
            { value: 'site:SFO-Branch', label: 'SFO-Branch' },
            { value: 'site:TOK-Sales', label: 'TOK-Sales' },
            { value: 'site:MUM-Hub', label: 'MUM-Hub' },
            { value: 'site:ATL-Retail', label: 'ATL-Retail' },
            { value: 'site:CHI-Dist', label: 'CHI-Dist' },
            { value: 'site:BER-R&D', label: 'BER-R&D' },
            { value: 'site:PAR-Office', label: 'PAR-Office' },
            { value: 'site:SYD-Office', label: 'SYD-Office' },
            { value: 'site:BRA-Remote', label: 'BRA-Remote' }
        ]}
    ],

    /**
     * Initialize navigation: render shared header, set active page, bind mobile menu.
     * @param {string} activePage - The current page identifier ('summary', 'sdwan', 'switch', 'ap')
     */
    init(activePage) {
        this._activePage = activePage;
        this._renderHeader();
        this._renderMobileTabBar();
        this.setActivePage(activePage);
        this.initMobileMenu();
    },

    // --- Rendering ---

    /**
     * Render the mobile nav overlay, drawer, and top nav bar into #appHeader.
     * @private
     */
    _renderHeader() {
        const container = document.getElementById('appHeader');
        if (!container) return;

        const isSummary = this._activePage === 'summary';

        // Build nav links
        const desktopLinks = this._pages.map(p => {
            const isActive = p.key === this._activePage;
            const cls = isActive
                ? 'border-newrelic-cyan text-dark-text inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'
                : 'border-transparent text-dark-muted hover:border-newrelic-cyan hover:text-newrelic-cyan inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors';
            return `<a href="${p.href}" class="${cls}">${p.label}</a>`;
        }).join('\n                        ');

        const mobileLinks = this._pages.map(p =>
            `<a href="${p.href}" class="mobile-nav-link">
                <i class="fa-solid ${p.icon}"></i>
                <span>${p.label}</span>
            </a>`
        ).join('\n            ');

        // Build right-side selector
        const selectorHtml = isSummary
            ? this._buildScopeSelector()
            : (this._activePage === 'site' ? this._buildSiteSelector() : this._buildDeviceSelector());

        container.innerHTML = `
    <!-- Mobile Navigation Overlay -->
    <div id="mobileNavOverlay" class="mobile-nav-overlay"></div>

    <!-- Mobile Navigation Drawer -->
    <div id="mobileNavDrawer" class="mobile-nav-drawer">
        <div class="mobile-nav-header">
            <div class="flex items-center gap-2">
                <div class="bg-gradient-to-br from-newrelic-cyan to-newrelic-teal text-white p-2 rounded-lg shadow-md">
                    <i class="fa-solid fa-network-wired"></i>
                </div>
                <span class="font-bold text-dark-text">Menu</span>
            </div>
            <div id="mobileNavClose" class="mobile-nav-close">
                <i class="fa-solid fa-times text-xl"></i>
            </div>
        </div>
        <div class="mobile-nav-links">
            ${mobileLinks}
        </div>
    </div>

    <!-- Top Navigation -->
    <nav class="bg-dark-card border-b border-dark-border h-16 flex-none z-10 shadow-lg">
        <div class="max-w-full mx-auto px-4 sm:px-6 lg:px-8 h-full">
            <div class="flex justify-between h-full">
                <div class="flex items-center">
                    <button id="mobileMenuButton" class="mobile-menu-button mr-3">
                        <i class="fa-solid fa-bars text-xl"></i>
                    </button>
                    <div class="flex-shrink-0 flex items-center gap-3">
                        <div class="bg-gradient-to-br from-newrelic-cyan to-newrelic-teal text-white p-2 rounded-lg shadow-md">
                            <i class="fa-solid fa-network-wired text-xl"></i>
                        </div>
                        <span class="font-bold text-xl tracking-tight text-dark-text">Network Performance Monitoring</span>
                    </div>
                    <div class="hidden sm:ml-8 sm:flex sm:space-x-8">
                        ${desktopLinks}
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    ${selectorHtml}

                    <!-- Timeline Selector -->
                    <div id="timelineSelector" class="relative"></div>

                    <div class="flex items-center gap-3 border-l pl-4 border-dark-border">
                        <div class="text-right hidden md:block">
                            <p class="text-sm font-medium text-dark-text">Admin User</p>
                            <p class="text-xs text-dark-muted">NetOps Lead</p>
                        </div>
                        <div class="h-8 w-8 rounded-full bg-gradient-to-br from-newrelic-cyan to-newrelic-teal flex items-center justify-center text-white font-bold shadow-md">
                            AU
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </nav>`;
    },

    /**
     * Render the mobile bottom tab bar into #mobileTabBar.
     * @private
     */
    _renderMobileTabBar() {
        const container = document.getElementById('mobileTabBar');
        if (!container) return;

        const tabs = this._pages.map(p =>
            `<a href="${p.href}" class="mobile-tab-link">
                <i class="fa-solid ${p.icon}"></i>
                <span>${p.label}</span>
            </a>`
        ).join('\n            ');

        container.innerHTML = `
    <div class="mobile-tab-menu">
        <div class="mobile-tab-container">
            ${tabs}
        </div>
    </div>`;
    },

    /**
     * Build the scope selector dropdown HTML (summary page).
     * @returns {string}
     * @private
     */
    _buildScopeSelector() {
        let optionsHtml = '';
        for (const opt of this._scopeOptions) {
            if (opt.group) {
                const items = opt.items.map(i => `<option value="${i.value}">${i.label}</option>`).join('\n');
                optionsHtml += `<optgroup label="${opt.group}">\n${items}\n</optgroup>\n`;
            } else {
                optionsHtml += `<option value="${opt.value}">${opt.label}</option>\n`;
            }
        }
        return `<div class="relative">
                        <select id="scopeSelector" class="block w-full pl-3 pr-10 py-2 text-sm border-dark-border focus:outline-none focus:ring-newrelic-cyan focus:border-newrelic-cyan sm:text-sm rounded-md bg-dark-bg border text-dark-text transition-all">
                            ${optionsHtml}
                        </select>
                    </div>`;
    },

    /**
     * Build the device selector dropdown HTML (device pages).
     * @returns {string}
     * @private
     */
    _buildDeviceSelector() {
        return `<div class="relative">
                        <select id="deviceSelector" class="block w-full pl-3 pr-10 py-2 text-sm border-dark-border focus:outline-none focus:ring-newrelic-cyan focus:border-newrelic-cyan sm:text-sm rounded-md bg-dark-bg border text-dark-text transition-all">
                            <!-- Options populated dynamically by JavaScript -->
                        </select>
                    </div>`;
    },

    /**
     * Build the site selector dropdown HTML (site page).
     * @returns {string}
     * @private
     */
    _buildSiteSelector() {
        return `<div class="relative">
                        <select id="siteSelector" class="block w-full pl-3 pr-10 py-2 text-sm border-dark-border focus:outline-none focus:ring-newrelic-cyan focus:border-newrelic-cyan sm:text-sm rounded-md bg-dark-bg border text-dark-text transition-all">
                            <!-- Options populated dynamically by JavaScript -->
                        </select>
                    </div>`;
    },

    // --- Active Page ---

    /**
     * Set the active page in all navigation systems (desktop, mobile drawer, mobile tabs).
     * @param {string} activePage - The page identifier
     */
    setActivePage(activePage) {
        // Mobile nav links + mobile tab links
        ['.mobile-nav-link', '.mobile-tab-link'].forEach(selector => {
            document.querySelectorAll(selector).forEach(link => {
                const href = link.getAttribute('href');
                const page = this._pages.find(p => p.href === href);
                const isActive = page && page.key === activePage;
                link.classList.toggle('active', isActive);
            });
        });
    },

    /**
     * Get current scope from the scope selector dropdown.
     * @returns {string} The current scope value, defaults to 'Global'
     */
    getCurrentScope() {
        const scopeSelector = document.getElementById('scopeSelector');
        return scopeSelector ? scopeSelector.value : 'Global';
    },

    /**
     * Initialize mobile menu open/close functionality.
     */
    initMobileMenu() {
        const menuButton = document.getElementById('mobileMenuButton');
        const navDrawer = document.getElementById('mobileNavDrawer');
        const navOverlay = document.getElementById('mobileNavOverlay');
        const closeButton = document.getElementById('mobileNavClose');

        if (!menuButton || !navDrawer || !navOverlay) return;

        const closeMenu = () => {
            navDrawer.classList.remove('active');
            navOverlay.classList.remove('active');
            document.body.style.overflow = '';
        };

        menuButton.addEventListener('click', () => {
            navDrawer.classList.add('active');
            navOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        if (closeButton) {
            closeButton.addEventListener('click', closeMenu);
        }

        navOverlay.addEventListener('click', closeMenu);

        document.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }
};
