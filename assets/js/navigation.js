/**
 * Navigation Manager
 * Handles navigation state and active page highlighting.
 *
 * @namespace NavigationManager
 */
const NavigationManager = {
    /**
     * Page-to-href matching rules.
     * @type {Object.<string, function(string): boolean>}
     * @private
     */
    _pageMatchers: {
        summary: (href) => href === 'index.html',
        sdwan: (href) => href === 'sdwan.html',
        switch: (href) => href.includes('switch'),
        ap: (href) => href.includes('access')
    },

    /**
     * Initialize navigation with the current active page.
     * @param {string} activePage - The current page identifier ('summary', 'sdwan', 'switch', 'ap')
     */
    init(activePage) {
        this.setActivePage(activePage);
        this.initMobileMenu();
    },

    /**
     * Check if a link href matches the active page.
     * @param {string} activePage - The page identifier
     * @param {string} href - The link href attribute
     * @returns {boolean}
     * @private
     */
    _isActiveLink(activePage, href) {
        const matcher = this._pageMatchers[activePage];
        return matcher ? matcher(href) : false;
    },

    /**
     * Set the active page in all navigation systems (desktop, mobile drawer, mobile tabs).
     * @param {string} activePage - The page identifier
     */
    setActivePage(activePage) {
        // Desktop nav links
        document.querySelectorAll('nav a[href]').forEach(link => {
            const isActive = this._isActiveLink(activePage, link.getAttribute('href'));
            if (isActive) {
                link.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
                link.classList.add('border-blue-500', 'text-gray-900', 'dark:text-white');
            } else {
                link.classList.remove('border-blue-500', 'text-gray-900', 'dark:text-white');
                link.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            }
        });

        // Mobile nav links + mobile tab links
        ['.mobile-nav-link', '.mobile-tab-link'].forEach(selector => {
            document.querySelectorAll(selector).forEach(link => {
                const isActive = this._isActiveLink(activePage, link.getAttribute('href'));
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
