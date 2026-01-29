/**
 * Navigation Manager
 * Handles navigation state and active page highlighting
 */

const NavigationManager = {
    /**
     * Initialize navigation with the current active page
     * @param {string} activePage - The current page identifier ('summary', 'sdwan', 'switch', 'ap')
     */
    init(activePage) {
        this.setActivePage(activePage);
        this.initScopeSelector();
        this.initMobileMenu();
    },

    /**
     * Set the active page in navigation
     */
    setActivePage(activePage) {
        const navLinks = document.querySelectorAll('nav a[href]');

        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            let isActive = false;

            // Determine if this link should be active
            if (activePage === 'summary' && href === 'index.html') {
                isActive = true;
            } else if (activePage === 'sdwan' && href === 'sdwan.html') {
                isActive = true;
            } else if (activePage === 'switch' && href.includes('switch')) {
                isActive = true;
            } else if (activePage === 'ap' && href.includes('access')) {
                isActive = true;
            }

            // Apply active styles
            if (isActive) {
                link.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
                link.classList.add('border-blue-500', 'text-gray-900', 'dark:text-white');
            } else {
                link.classList.remove('border-blue-500', 'text-gray-900', 'dark:text-white');
                link.classList.add('border-transparent', 'text-gray-500', 'dark:text-gray-400');
            }
        });

        // Set active state for mobile nav links
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
        mobileNavLinks.forEach(link => {
            const href = link.getAttribute('href');
            let isActive = false;

            if (activePage === 'summary' && href === 'index.html') {
                isActive = true;
            } else if (activePage === 'sdwan' && href === 'sdwan.html') {
                isActive = true;
            } else if (activePage === 'switch' && href.includes('switch')) {
                isActive = true;
            } else if (activePage === 'ap' && href.includes('access')) {
                isActive = true;
            }

            if (isActive) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Set active state for mobile tab links
        const mobileTabLinks = document.querySelectorAll('.mobile-tab-link');
        mobileTabLinks.forEach(link => {
            const href = link.getAttribute('href');
            let isActive = false;

            if (activePage === 'summary' && href === 'index.html') {
                isActive = true;
            } else if (activePage === 'sdwan' && href === 'sdwan.html') {
                isActive = true;
            } else if (activePage === 'switch' && href.includes('switch')) {
                isActive = true;
            } else if (activePage === 'ap' && href.includes('access')) {
                isActive = true;
            }

            if (isActive) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    },

    /**
     * Initialize scope selector functionality
     */
    initScopeSelector() {
        const scopeSelector = document.getElementById('scopeSelector');
        if (scopeSelector && !scopeSelector.hasAttribute('data-initialized')) {
            scopeSelector.setAttribute('data-initialized', 'true');
            // Event listener is already on the element via onchange attribute
        }
    },

    /**
     * Get current scope from selector
     */
    getCurrentScope() {
        const scopeSelector = document.getElementById('scopeSelector');
        return scopeSelector ? scopeSelector.value : 'Global';
    },

    /**
     * Initialize mobile menu functionality
     */
    initMobileMenu() {
        const menuButton = document.getElementById('mobileMenuButton');
        const navDrawer = document.getElementById('mobileNavDrawer');
        const navOverlay = document.getElementById('mobileNavOverlay');
        const closeButton = document.getElementById('mobileNavClose');

        if (!menuButton || !navDrawer || !navOverlay) return;

        // Open menu
        menuButton.addEventListener('click', () => {
            navDrawer.classList.add('active');
            navOverlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        // Close menu
        const closeMenu = () => {
            navDrawer.classList.remove('active');
            navOverlay.classList.remove('active');
            document.body.style.overflow = '';
        };

        if (closeButton) {
            closeButton.addEventListener('click', closeMenu);
        }

        navOverlay.addEventListener('click', closeMenu);

        // Close menu when a link is clicked
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', closeMenu);
        });
    }
};
