/**
 * DataLoader - Centralized data loading and caching module
 * Loads network data from JSON file and provides accessor methods
 */
const DataLoader = {
    _data: null,
    _loading: false,
    _loaded: false,
    _callbacks: [],
    _basePath: '',

    /**
     * Initialize with base path for data file
     */
    init(basePath = '') {
        this._basePath = basePath;
    },

    /**
     * Load network data from JSON file
     * @returns {Promise<Object>} The loaded data
     */
    async load() {
        if (this._loaded) return this._data;
        if (this._loading) {
            return new Promise(resolve => this._callbacks.push(resolve));
        }

        this._loading = true;
        try {
            const dataPath = this._basePath ? `${this._basePath}/data/network-data.json` : 'data/network-data.json';
            console.log('Attempting to load data from:', dataPath);
            console.log('Current location:', window.location.href);

            // Check if we're using file:// protocol
            if (window.location.protocol === 'file:') {
                console.warn('WARNING: Using file:// protocol. Fetch may fail due to CORS restrictions.');
                console.warn('Consider using a local web server: python -m http.server 8000');
            }

            const response = await fetch(dataPath);
            if (!response.ok) {
                throw new Error(`Failed to fetch data: HTTP ${response.status}`);
            }
            this._data = await response.json();
            this._loaded = true;
            this._callbacks.forEach(cb => cb(this._data));
            this._callbacks = [];
            console.log('Network data loaded successfully:', this._data.version);
            this.validateData();
            return this._data;
        } catch (error) {
            console.error('Failed to load network data:', error);
            console.error('Full error details:', error.name, error.message);
            throw error;
        } finally {
            this._loading = false;
        }
    },

    /**
     * Check if data is loaded
     */
    isLoaded() {
        return this._loaded;
    },

    /**
     * Get raw data object
     */
    getData() {
        return this._data;
    },

    // ==================== REGION ACCESSORS ====================

    /**
     * Get all regions
     */
    getRegions() {
        return this._data?.regions || {};
    },

    /**
     * Get a specific region by name
     */
    getRegion(regionName) {
        return this._data?.regions?.[regionName] || null;
    },

    /**
     * Get region names as array
     */
    getRegionNames() {
        return Object.keys(this._data?.regions || {});
    },

    // ==================== SITE ACCESSORS ====================

    /**
     * Get all sites
     */
    getSites() {
        return this._data?.sites || {};
    },

    /**
     * Get a specific site by name
     */
    getSite(siteName) {
        return this._data?.sites?.[siteName] || null;
    },

    /**
     * Get site names as array
     */
    getSiteNames() {
        return Object.keys(this._data?.sites || {});
    },

    /**
     * Get sites filtered by region
     */
    getSitesByRegion(region) {
        if (region === 'Global') {
            return Object.values(this._data?.sites || {});
        }
        return Object.values(this._data?.sites || {})
            .filter(site => site.region === region);
    },

    /**
     * Get site names for a specific region
     */
    getSiteNamesByRegion(region) {
        if (region === 'Global') {
            return this.getSiteNames();
        }
        return Object.entries(this._data?.sites || {})
            .filter(([_, site]) => site.region === region)
            .map(([name, _]) => name);
    },

    /**
     * Get the region for a given site
     */
    getRegionForSite(siteName) {
        return this._data?.sites?.[siteName]?.region || null;
    },

    // ==================== DEVICE ACCESSORS ====================

    /**
     * Get all devices of a specific type
     * @param {string} type - 'gateways', 'switches', or 'accessPoints'
     */
    getDevices(type) {
        return this._data?.devices?.[type] || [];
    },

    /**
     * Get all devices (all types combined)
     */
    getAllDevices() {
        const devices = this._data?.devices || {};
        return [
            ...(devices.gateways || []),
            ...(devices.switches || []),
            ...(devices.accessPoints || [])
        ];
    },

    /**
     * Get devices filtered by site
     */
    getDevicesBySite(site, type = null) {
        if (type) {
            return this.getDevices(type).filter(d => d.site === site);
        }
        return this.getAllDevices().filter(d => d.site === site);
    },

    /**
     * Get devices filtered by region
     */
    getDevicesByRegion(region, type = null) {
        if (region === 'Global') {
            return type ? this.getDevices(type) : this.getAllDevices();
        }
        if (type) {
            return this.getDevices(type).filter(d => d.region === region);
        }
        return this.getAllDevices().filter(d => d.region === region);
    },

    /**
     * Get devices filtered by scope (region or site)
     */
    getDevicesByScope(scope, type = null) {
        if (scope === 'Global') {
            return type ? this.getDevices(type) : this.getAllDevices();
        }
        // Check if scope is a site name
        if (this._data?.sites?.[scope]) {
            return this.getDevicesBySite(scope, type);
        }
        // Otherwise treat as region
        return this.getDevicesByRegion(scope, type);
    },

    /**
     * Get a single device by ID
     */
    getDeviceById(deviceId) {
        const allDevices = this.getAllDevices();
        return allDevices.find(d => d.id === deviceId) || null;
    },

    /**
     * Get device counts by status for a given type and scope
     */
    getDeviceStatusCounts(type, scope = 'Global') {
        const devices = this.getDevicesByScope(scope, type);
        return {
            online: devices.filter(d => d.status === 'online').length,
            warn: devices.filter(d => d.status === 'warning').length,
            crit: devices.filter(d => d.status === 'critical').length,
            total: devices.length
        };
    },

    /**
     * Get total client count by device type for a scope
     * Sums the 'clients' field from all devices of the given type
     */
    getClientCountByType(type, scope = 'Global') {
        const devices = this.getDevicesByScope(scope, type);
        return devices.reduce((sum, device) => sum + (device.clients || 0), 0);
    },

    /**
     * Get client counts for all device types in a scope
     */
    getClientCounts(scope = 'Global') {
        return {
            gateways: this.getClientCountByType('gateways', scope),
            switches: this.getClientCountByType('switches', scope),
            accessPoints: this.getClientCountByType('accessPoints', scope)
        };
    },

    // ==================== ALERT ACCESSORS ====================

    /**
     * Get all alerts
     */
    getAlerts() {
        return this._data?.alerts || [];
    },

    /**
     * Get alerts filtered by site
     */
    getAlertsBySite(site) {
        return this.getAlerts().filter(a => a.site === site);
    },

    /**
     * Get alerts filtered by region
     */
    getAlertsByRegion(region) {
        if (region === 'Global') return this.getAlerts();
        return this.getAlerts().filter(a => a.region === region);
    },

    /**
     * Get alerts filtered by scope (region or site)
     */
    getAlertsByScope(scope) {
        if (scope === 'Global') return this.getAlerts();
        if (this._data?.sites?.[scope]) {
            return this.getAlertsBySite(scope);
        }
        return this.getAlertsByRegion(scope);
    },

    /**
     * Get alerts filtered by severity
     */
    getAlertsBySeverity(severity, scope = 'Global') {
        const alerts = this.getAlertsByScope(scope);
        if (severity === 'all') return alerts;
        return alerts.filter(a => a.severity === severity);
    },

    /**
     * Get alerts filtered by type
     */
    getAlertsByType(type, scope = 'Global') {
        const alerts = this.getAlertsByScope(scope);
        if (type === 'all') return alerts;
        return alerts.filter(a => a.type === type);
    },

    /**
     * Get alert counts by severity for a scope
     */
    getAlertCounts(scope = 'Global') {
        const alerts = this.getAlertsByScope(scope);
        return {
            total: alerts.length,
            crit: alerts.filter(a => a.severity === 'crit').length,
            warn: alerts.filter(a => a.severity === 'warn').length,
            info: alerts.filter(a => a.severity === 'info').length
        };
    },

    /**
     * Get security-related alert counts (threats and rogues)
     */
    getSecurityCounts(scope = 'Global') {
        const alerts = this.getAlertsByScope(scope);
        return {
            threats: alerts.filter(a => a.type === 'threat').length,
            rogues: alerts.filter(a => a.type === 'rogue').length
        };
    },

    // ==================== CHART DATA ACCESSORS ====================

    /**
     * Get all chart data
     */
    getChartData() {
        return this._data?.chartData || {};
    },

    /**
     * Get frustration data (Time to Connect) - calculated from AP data
     * Returns top APs with highest time to connect for the given scope
     */
    getFrustrationData(scope = 'Global', limit = 5) {
        // Get APs for the scope
        const aps = this.getDevicesByScope(scope, 'accessPoints');

        // Filter to only APs that have timeToConnect data
        const apsWithData = aps.filter(ap => ap.timeToConnect && ap.timeToConnect > 0);

        // Sort by timeToConnect descending and take top N
        const sorted = apsWithData
            .sort((a, b) => b.timeToConnect - a.timeToConnect)
            .slice(0, limit);

        // Map to expected format
        return sorted.map(ap => ({
            site: ap.site,
            region: ap.region,
            vendor: ap.vendor,
            label: ap.name,
            totalTime: ap.timeToConnect,
            breakdown: ap.connectionBreakdown || {
                association: Math.floor(ap.timeToConnect * 0.35),
                auth: Math.floor(ap.timeToConnect * 0.25),
                dhcp: Math.floor(ap.timeToConnect * 0.25),
                dns: Math.floor(ap.timeToConnect * 0.15)
            }
        }));
    },

    /**
     * Get latency data
     */
    getLatencyData(scope = 'Global', limit = 5) {
        const data = this._data?.chartData?.latencyData || [];
        let filtered = data;

        if (scope !== 'Global') {
            if (this._data?.sites?.[scope]) {
                filtered = data.filter(d => d.site === scope);
            } else {
                filtered = data.filter(d => d.region === scope);
            }
        }

        return filtered
            .sort((a, b) => b.latency - a.latency)
            .slice(0, limit);
    },

    /**
     * Get WAN resilience data for a scope (calculated from gateway status)
     * - Primary: gateways online (primary link working)
     * - Failover: gateways in warning state (on backup/degraded)
     * - Down: gateways critical (not working)
     */
    getWanResilience(scope = 'Global') {
        // Get gateways for the scope
        const gateways = this.getDevicesByScope(scope, 'gateways');
        const total = gateways.length;

        if (total === 0) {
            return { primary: 0, failover: 0, down: 0 };
        }

        const online = gateways.filter(g => g.status === 'online').length;
        const warning = gateways.filter(g => g.status === 'warning').length;
        const critical = gateways.filter(g => g.status === 'critical').length;

        // Calculate percentages
        const primary = Math.round((online / total) * 100);
        const failover = Math.round((warning / total) * 100);
        const down = Math.round((critical / total) * 100);

        // Ensure percentages add up to 100 (adjust primary for rounding errors)
        const sum = primary + failover + down;
        const adjustedPrimary = primary + (100 - sum);

        return {
            primary: adjustedPrimary,
            failover: failover,
            down: down
        };
    },

    // ==================== METRICS ACCESSORS ====================

    /**
     * Get metrics for a scope (region or site)
     */
    getMetrics(scope = 'Global') {
        if (scope === 'Global') {
            return this._data?.regions?.['Global'] || {};
        }

        // Check if it's a site
        if (this._data?.sites?.[scope]) {
            return this._data.sites[scope];
        }

        // Otherwise it's a region
        return this._data?.regions?.[scope] || {};
    },

    /**
     * Get health score for a scope
     */
    getHealthScore(scope = 'Global') {
        const metrics = this.getMetrics(scope);
        return metrics.health || 0;
    },

    // ==================== VALIDATION ====================

    /**
     * Validate data integrity
     */
    validateData() {
        if (!this._data) {
            console.warn('No data loaded');
            return false;
        }

        const issues = [];
        const sites = Object.keys(this._data.sites || {});
        const config = this._data.siteConfig?.deviceRequirements || {
            gatewaysPerSite: 2,
            switchesPerSite: { min: 3, max: 8 },
            accessPointsPerSite: { min: 20, max: 100 }
        };

        sites.forEach(siteName => {
            const gateways = (this._data.devices?.gateways || []).filter(d => d.site === siteName);
            const switches = (this._data.devices?.switches || []).filter(d => d.site === siteName);
            const aps = (this._data.devices?.accessPoints || []).filter(d => d.site === siteName);

            if (gateways.length !== config.gatewaysPerSite) {
                issues.push(`${siteName}: Expected ${config.gatewaysPerSite} gateways, found ${gateways.length}`);
            }
            if (switches.length < config.switchesPerSite.min || switches.length > config.switchesPerSite.max) {
                issues.push(`${siteName}: Expected ${config.switchesPerSite.min}-${config.switchesPerSite.max} switches, found ${switches.length}`);
            }
            if (aps.length < config.accessPointsPerSite.min || aps.length > config.accessPointsPerSite.max) {
                issues.push(`${siteName}: Expected ${config.accessPointsPerSite.min}-${config.accessPointsPerSite.max} APs, found ${aps.length}`);
            }
        });

        if (issues.length > 0) {
            console.warn('Data validation issues:', issues);
        } else {
            console.log('Data validation passed');
        }

        return issues.length === 0;
    },

    // ==================== UTILITY ====================

    /**
     * Check if a scope is a site (vs region)
     */
    isSite(scope) {
        return !!this._data?.sites?.[scope];
    },

    /**
     * Check if a scope is a region
     */
    isRegion(scope) {
        return scope === 'Global' || !!this._data?.regions?.[scope];
    },

    /**
     * Get scope type
     */
    getScopeType(scope) {
        if (scope === 'Global') return 'global';
        if (this._data?.sites?.[scope]) return 'site';
        if (this._data?.regions?.[scope]) return 'region';
        return 'unknown';
    }
};

// Make available globally
window.DataLoader = DataLoader;
