/**
 * Generate alerts for all devices
 * Distribution: 15% critical, 25% warning, 60% info
 * 3-4 alerts per device
 */

const fs = require('fs');
const path = require('path');

// Load devices
const devicesPath = path.join(__dirname, '../data/devices.json');
const devices = JSON.parse(fs.readFileSync(devicesPath, 'utf8'));

// Alert message templates by device type
const alertTemplates = {
    gateway: {
        crit: [
            'WAN link down - primary circuit failure',
            'BGP session lost with upstream peer',
            'High CPU utilization (>95%)',
            'Memory exhaustion detected',
            'IPsec tunnel collapsed - all SAs down',
            'Routing table overflow detected',
            'Hardware failure detected on interface',
            'Critical firmware vulnerability detected'
        ],
        warn: [
            'High latency detected on WAN link (>150ms)',
            'Packet loss exceeding threshold (>2%)',
            'BGP route flapping detected',
            'Secondary WAN failover active',
            'High memory utilization (85%)',
            'Certificate expiring in 7 days',
            'QoS policy violation detected',
            'Unusual traffic pattern detected',
            'DHCP pool utilization above 80%',
            'VPN tunnel rekeying failures'
        ],
        info: [
            'Configuration backup completed',
            'Firmware update available',
            'Scheduled maintenance window starting',
            'Traffic report generated',
            'New BGP route learned',
            'DHCP lease renewed',
            'NTP sync completed',
            'Security policy updated',
            'Interface statistics reset',
            'Log rotation completed',
            'Health check passed',
            'Backup link test successful'
        ]
    },
    switch: {
        crit: [
            'STP root bridge election in progress',
            'Port channel all members down',
            'Stack member disconnected',
            'Power supply failure',
            'Temperature critical (>75C)',
            'Spanning tree loop detected',
            'MAC address table overflow',
            'PoE power budget exceeded'
        ],
        warn: [
            'High port utilization (>80%)',
            'STP topology change detected',
            'Port flapping detected',
            'PoE power draw high on port',
            'VLAN mismatch detected',
            'Trunk negotiation failed',
            'MAC address learning anomaly',
            'Broadcast storm warning',
            'Port error rate elevated',
            'Temperature warning (>65C)'
        ],
        info: [
            'Port came online',
            'New MAC address learned',
            'VLAN configuration updated',
            'Trunk port negotiated successfully',
            'PoE device connected',
            'Configuration saved',
            'Firmware check completed',
            'Port statistics cleared',
            'LLDP neighbor discovered',
            'QoS policy applied',
            'Access control list updated',
            'Diagnostic test passed'
        ]
    },
    accessPoint: {
        crit: [
            'Radio hardware failure',
            'Lost connection to controller',
            'PoE power insufficient',
            'Firmware corruption detected',
            'Authentication server unreachable',
            'DFS radar detected - channel change required',
            'Memory critical',
            'Certificate validation failed'
        ],
        warn: [
            'High channel utilization (>70%)',
            'Co-channel interference detected',
            'Client authentication failures',
            'Rogue AP detected nearby',
            'Low SNR on multiple clients',
            'Channel congestion detected',
            'Roaming failures increasing',
            'Airtime fairness warning',
            'Client density high',
            'Band steering failures'
        ],
        info: [
            'Channel optimization completed',
            'Client roamed successfully',
            'Power level adjusted',
            'New client associated',
            'Radar scan completed',
            'Configuration sync completed',
            'Radio calibration finished',
            'Interference mitigation active',
            'Load balancing active',
            'WIDS scan completed',
            'Spectrum analysis updated',
            'Client deauthenticated normally'
        ]
    }
};

// Time ago values (for realistic timestamps)
const timeAgos = [
    '1m ago', '2m ago', '3m ago', '5m ago', '8m ago', '10m ago', '12m ago', '15m ago',
    '18m ago', '20m ago', '25m ago', '30m ago', '35m ago', '40m ago', '45m ago', '50m ago',
    '1h ago', '1h 15m ago', '1h 30m ago', '1h 45m ago', '2h ago', '2h 30m ago', '3h ago',
    '3h 30m ago', '4h ago', '4h 30m ago', '5h ago', '6h ago', '8h ago', '10h ago', '12h ago'
];

// Alert types
const alertTypes = ['network', 'hardware', 'security', 'system', 'performance', 'ai'];

// Generate a random item from array
function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Generate timestamp
function generateTimestamp(hoursAgo) {
    const now = new Date();
    now.setHours(now.getHours() - hoursAgo);
    return now.toISOString();
}

// Get device type key for templates
function getDeviceTypeKey(type) {
    if (type === 'gateway') return 'gateway';
    if (type === 'switch') return 'switch';
    if (type === 'accessPoint') return 'accessPoint';
    return 'gateway';
}

// Generate alerts for all devices
const alerts = [];
let alertId = 1;
let critCount = 0, warnCount = 0, infoCount = 0;

// Calculate target counts (for 181 devices with ~3.5 alerts each = ~634 alerts)
// 15% crit, 25% warn, 60% info
const totalAlerts = devices.devices.length * 3.5;
const targetCrit = Math.floor(totalAlerts * 0.15);
const targetWarn = Math.floor(totalAlerts * 0.25);

devices.devices.forEach((device, index) => {
    const numAlerts = Math.random() < 0.5 ? 3 : 4; // 3 or 4 alerts per device
    const typeKey = getDeviceTypeKey(device.type);
    const templates = alertTemplates[typeKey];

    for (let i = 0; i < numAlerts; i++) {
        // Determine severity based on distribution
        let severity;
        const totalSoFar = critCount + warnCount + infoCount;
        const critRatio = critCount / (totalSoFar || 1);
        const warnRatio = warnCount / (totalSoFar || 1);

        if (critRatio < 0.15 && critCount < targetCrit) {
            severity = Math.random() < 0.3 ? 'crit' : (warnRatio < 0.25 ? 'warn' : 'info');
        } else if (warnRatio < 0.25 && warnCount < targetWarn) {
            severity = Math.random() < 0.4 ? 'warn' : 'info';
        } else {
            severity = 'info';
        }

        // Occasionally force crit/warn to meet targets
        if (severity === 'info' && critCount < targetCrit && Math.random() < 0.1) {
            severity = 'crit';
        } else if (severity === 'info' && warnCount < targetWarn && Math.random() < 0.2) {
            severity = 'warn';
        }

        // Update counts
        if (severity === 'crit') critCount++;
        else if (severity === 'warn') warnCount++;
        else infoCount++;

        const message = randomItem(templates[severity]);
        const timeAgo = randomItem(timeAgos);

        // Parse timeAgo to generate timestamp
        let hoursAgo = 0;
        if (timeAgo.includes('h')) {
            const match = timeAgo.match(/(\d+)h/);
            hoursAgo = match ? parseInt(match[1]) : 1;
        }
        const minutesAgo = timeAgo.match(/(\d+)m/);
        if (minutesAgo) {
            hoursAgo += parseInt(minutesAgo[1]) / 60;
        }

        alerts.push({
            id: `alert-${String(alertId++).padStart(4, '0')}`,
            severity: severity,
            type: randomItem(alertTypes),
            vendor: device.vendor || (Math.random() < 0.5 ? 'mist' : 'meraki'),
            site: device.site,
            region: device.region,
            device: device.name,
            deviceId: device.id,
            message: message,
            timestamp: generateTimestamp(hoursAgo),
            timeAgo: timeAgo
        });
    }
});

// Sort by timestamp (most recent first)
alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

// Output stats
console.log(`Generated ${alerts.length} alerts:`);
console.log(`  Critical: ${critCount} (${(critCount/alerts.length*100).toFixed(1)}%)`);
console.log(`  Warning: ${warnCount} (${(warnCount/alerts.length*100).toFixed(1)}%)`);
console.log(`  Info: ${infoCount} (${(infoCount/alerts.length*100).toFixed(1)}%)`);

// Write to file
const output = {
    version: "1.0.0",
    generated: new Date().toISOString().split('T')[0],
    stats: {
        total: alerts.length,
        critical: critCount,
        warning: warnCount,
        info: infoCount
    },
    alerts: alerts
};

const outputPath = path.join(__dirname, '../data/alerts.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nAlerts written to ${outputPath}`);
