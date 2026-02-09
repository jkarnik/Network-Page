/**
 * DataLoader - Centralized data loading and caching module.
 * Loads network data, device manifests, and alerts from JSON files.
 * Provides accessor methods for filtered data by scope, device type, etc.
 *
 * @namespace DataLoader
 */
const DataLoader = {
    /** @type {Object|null} Loaded network-data.json */
    _data: null,
    /** @type {Object|null} Loaded devices.json manifest */
    _deviceManifest: null,
    /** @type {Object|null} Loaded alerts.json */
    _alertsData: null,
    /** @type {boolean} True while a load is in progress */
    _loading: false,
    /** @type {boolean} True after data has been loaded successfully */
    _loaded: false,
    /** @type {Array<Function>} Pending callbacks waiting for data load */
    _callbacks: [],
    /** @type {string} Base path prefix for data files */
    _basePath: '',

    /**
     * Initialize with base path for data file
     */
    init(basePath = '') {
        this._basePath = basePath;
    },

    /**
     * Load device manifest from JSON file
     * @returns {Promise<Object>} The loaded manifest
     */
    async loadDeviceManifest() {
        if (this._deviceManifest) return this._deviceManifest;

        const manifestPath = this._basePath
            ? `${this._basePath}/data/devices.json`
            : 'data/devices.json';

        try {
            const response = await fetch(manifestPath);
            if (!response.ok) {
                throw new Error(`Failed to load device manifest: HTTP ${response.status}`);
            }
            this._deviceManifest = await response.json();
            console.log('Device manifest loaded:', this._deviceManifest.version);
            return this._deviceManifest;
        } catch (error) {
            console.error('Failed to load device manifest:', error);
            throw error;
        }
    },

    /**
     * Load alerts from JSON file
     * @returns {Promise<Object>} The loaded alerts data
     */
    async loadAlerts() {
        if (this._alertsData) return this._alertsData;

        const alertsPath = this._basePath
            ? `${this._basePath}/data/alerts.json`
            : 'data/alerts.json';

        try {
            const response = await fetch(alertsPath);
            if (!response.ok) {
                throw new Error(`Failed to load alerts: HTTP ${response.status}`);
            }
            this._alertsData = await response.json();
            console.log('Alerts loaded:', this._alertsData.stats);
            return this._alertsData;
        } catch (error) {
            console.error('Failed to load alerts:', error);
            throw error;
        }
    },

    /**
     * Build device arrays from manifest + deviceStatus
     * @private
     */
    _buildDeviceArrays() {
        if (!this._deviceManifest || !this._data) return;

        const deviceStatus = this._data.deviceStatus || {};
        const defaultStatus = { status: 'online', clients: 0 };

        // Initialize device arrays
        this._data.devices = {
            gateways: [],
            switches: [],
            accessPoints: []
        };

        // Map type to array key
        const typeMap = {
            'gateway': 'gateways',
            'switch': 'switches',
            'accessPoint': 'accessPoints'
        };

        // Build arrays from manifest
        this._deviceManifest.devices.forEach(device => {
            const arrayKey = typeMap[device.type];
            if (!arrayKey) return;

            // Merge manifest data with operational status
            const status = deviceStatus[device.id] || defaultStatus;
            const mergedDevice = {
                ...device,
                status: status.status || 'online',
                clients: status.clients || 0
            };

            // Add timeToConnect for access points if available
            if (device.type === 'accessPoint' && status.timeToConnect) {
                mergedDevice.timeToConnect = status.timeToConnect;
            }

            this._data.devices[arrayKey].push(mergedDevice);
        });

        console.log('Built device arrays from manifest:', {
            gateways: this._data.devices.gateways.length,
            switches: this._data.devices.switches.length,
            accessPoints: this._data.devices.accessPoints.length
        });
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
            // Load device manifest and alerts in parallel
            await Promise.all([
                this.loadDeviceManifest(),
                this.loadAlerts()
            ]);

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

            // Build device arrays from manifest + deviceStatus
            this._buildDeviceArrays();

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
     * Get all alerts (from separate alerts.json file)
     */
    getAlerts() {
        return this._alertsData?.alerts || [];
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
     * Get alerts filtered by device ID
     */
    getAlertsByDeviceId(deviceId) {
        return this.getAlerts().filter(a => a.deviceId === deviceId);
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
    },

    // ==================== DEVICE DATA ACCESSORS ====================

    _deviceDefaults: {},
    _deviceOverrides: null,

    /**
     * Load device defaults for a specific type
     * @param {string} deviceType - 'gateway', 'switch', or 'accesspoint'
     * @returns {Promise<Object|null>} The defaults data or null if not found
     */
    async loadDeviceDefaults(deviceType) {
        if (this._deviceDefaults[deviceType]) {
            return this._deviceDefaults[deviceType];
        }

        const typeMap = {
            'gateway': 'gateway-defaults.json',
            'gateways': 'gateway-defaults.json',
            'switch': 'switch-defaults.json',
            'switches': 'switch-defaults.json',
            'accesspoint': 'accesspoint-defaults.json',
            'accessPoints': 'accesspoint-defaults.json'
        };

        const filename = typeMap[deviceType];
        if (!filename) {
            console.warn('Unknown device type:', deviceType);
            return null;
        }

        try {
            const dataPath = this._basePath ? `${this._basePath}/data/${filename}` : `data/${filename}`;
            const response = await fetch(dataPath);
            if (!response.ok) {
                console.warn(`Failed to load device defaults for ${deviceType}: HTTP ${response.status}`);
                return null;
            }
            this._deviceDefaults[deviceType] = await response.json();
            return this._deviceDefaults[deviceType];
        } catch (error) {
            console.warn(`Failed to load device defaults for ${deviceType}:`, error);
            return null;
        }
    },

    /**
     * Load all device overrides from consolidated file
     * @returns {Promise<Object>} The overrides object keyed by device ID
     */
    async loadDeviceOverrides() {
        if (this._deviceOverrides !== null) {
            return this._deviceOverrides;
        }

        try {
            const dataPath = this._basePath
                ? `${this._basePath}/data/device-overrides.json`
                : 'data/device-overrides.json';
            const response = await fetch(dataPath);
            if (!response.ok) {
                console.warn('Failed to load device overrides:', response.status);
                this._deviceOverrides = {};
                return this._deviceOverrides;
            }
            const data = await response.json();
            this._deviceOverrides = data.overrides || {};
            console.log('Device overrides loaded:', Object.keys(this._deviceOverrides).length, 'devices');
            return this._deviceOverrides;
        } catch (error) {
            console.warn('Failed to load device overrides:', error);
            this._deviceOverrides = {};
            return this._deviceOverrides;
        }
    },

    /**
     * Get device override for a specific device ID
     * @param {string} deviceId - The device ID (e.g., 'gw-nj-primary')
     * @returns {Promise<Object|null>} The override data or null if not found
     */
    async loadDeviceOverride(deviceId) {
        const overrides = await this.loadDeviceOverrides();
        return overrides[deviceId] || null;
    },

    /**
     * Get merged device data (defaults + override)
     * @param {string} deviceId - The device ID
     * @param {string} deviceType - The device type ('gateway', 'switch', 'accesspoint')
     * @returns {Promise<Object>} The merged device data
     */
    async getDeviceData(deviceId, deviceType) {
        const defaults = await this.loadDeviceDefaults(deviceType);
        const override = await this.loadDeviceOverride(deviceId);

        if (!defaults) {
            return override || {};
        }

        if (!override) {
            return defaults;
        }

        // Deep merge: override takes precedence
        return this._deepMerge(defaults, override);
    },

    /**
     * Deep merge two objects
     * @private
     */
    _deepMerge(target, source) {
        const result = { ...target };

        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this._deepMerge(target[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }

        return result;
    },

    /**
     * Get device by name from network-data.json
     * @param {string} name - The device name (e.g., 'GW-NYC-Core-01')
     * @returns {Object|null} The device object or null if not found
     */
    getDeviceByName(name) {
        const allDevices = this.getAllDevices();
        return allDevices.find(d => d.name === name || d.id === name) || null;
    },

    /**
     * Get device from manifest by ID
     * @param {string} deviceId - The device ID
     * @returns {Object|null} The device from manifest or null
     */
    getDeviceFromManifest(deviceId) {
        if (!this._deviceManifest) return null;
        return this._deviceManifest.devices.find(d => d.id === deviceId) || null;
    },

    /**
     * Get the device manifest
     * @returns {Object|null} The device manifest
     */
    getManifest() {
        return this._deviceManifest;
    },

    /**
     * Get device type from device ID or name
     * @param {string} deviceIdOrName - The device ID or name
     * @returns {string|null} The device type ('gateways', 'switches', 'accessPoints') or null
     */
    getDeviceType(deviceIdOrName) {
        // First check manifest for faster lookup
        const manifestDevice = this.getDeviceFromManifest(deviceIdOrName);
        if (manifestDevice) {
            const typeMap = {
                'gateway': 'gateways',
                'switch': 'switches',
                'accessPoint': 'accessPoints'
            };
            return typeMap[manifestDevice.type] || null;
        }

        const device = this.getDeviceByName(deviceIdOrName);
        if (!device) return null;

        // Check which array contains this device
        if (this._data?.devices?.gateways?.some(d => d.id === device.id || d.name === device.name)) {
            return 'gateways';
        }
        if (this._data?.devices?.switches?.some(d => d.id === device.id || d.name === device.name)) {
            return 'switches';
        }
        if (this._data?.devices?.accessPoints?.some(d => d.id === device.id || d.name === device.name)) {
            return 'accessPoints';
        }
        return null;
    }
};

// Make available globally
window.DataLoader = DataLoader;
