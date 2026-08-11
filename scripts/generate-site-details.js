/**
 * Generate data/site-details.json — mock WAN/VPN/hardware/BGP/security/VLAN/DHCP/
 * top-apps data for every site, seeded from real device status so it never
 * contradicts an existing alert.
 */

const fs = require('fs');
const path = require('path');

const devices = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/devices.json'), 'utf8')).devices;
const networkData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/network-data.json'), 'utf8'));
const siteNames = Object.keys(networkData.sites);
const deviceStatus = networkData.deviceStatus;

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

function wobble(base, spreadPct) {
    return Array.from({ length: 24 }, () => Math.max(0, base * (1 + (Math.random() * 2 - 1) * spreadPct)));
}

function round(n, decimals = 1) {
    const f = Math.pow(10, decimals);
    return Math.round(n * f) / f;
}

const ISPS = ['Comcast Business', 'AT&T', 'Lumen', 'Vodafone', 'BT Business', 'Airtel Business'];
const CONNECTION_TYPES = ['Fiber', 'Cable', 'MPLS'];
const TUNNEL_PEER_NAMES = ['HQ-Primary', 'DC-Backup', 'Regional-Hub'];
const VLAN_DEFS = [
    { id: 10, name: 'Corp', purpose: 'Employee workstations', share: 0.50 },
    { id: 20, name: 'Secure', purpose: 'Finance / HR', share: 0.24 },
    { id: 30, name: 'Guest', purpose: 'Guest Wi-Fi', share: 0.12 },
    { id: 40, name: 'Prod', purpose: 'IoT / building systems', share: 0.14 }
];
const TOPAPP_LABELS = ['M365', 'Teams', 'Salesforce', 'YouTube', 'Other'];
const TOPAPP_COLORS = ['#3b82f6', '#6366f1', '#0ea5e9', '#ef4444', '#9ca3af'];

// Sites that get a demo-visible problem, so the Needs Attention panel and
// BGP/security widgets have something to show without contradicting the
// existing correlated alerts (CORR-001 WAN Outage Cascade - TOK-Sales,
// CORR-002 IPSec Tunnel Failure - MUM-Hub, CORR-004 SFO-Branch IPSec & BGP Event).
const TUNNEL_DOWN_SITES = ['TOK-Sales', 'MUM-Hub', 'SFO-Branch'];
const BGP_FLAP_SITES = ['TOK-Sales', 'SFO-Branch'];
const SECURITY_SITES = ['SFO-Branch', 'MUM-Hub'];
const PSU_FAILURE_SITES = ['NJ-Warehouse'];

const AUX_DEVICE_DEFS = [
    { type: 'servers', label: 'SRV', vendors: [
        { key: 'dell', models: ['Dell PowerEdge R650', 'Dell PowerEdge R750'] },
        { key: 'hpe', models: ['HPE ProLiant DL380', 'HPE ProLiant DL360'] }
    ] },
    { type: 'ipCameras', label: 'CAM', vendors: [
        { key: 'axis', models: ['Axis P3245-LVE', 'Axis M3086-V'] },
        { key: 'hikvision', models: ['Hikvision DS-2CD2387G2', 'Hikvision DS-2CD2143G2'] }
    ] },
    { type: 'hvacUnits', label: 'HVAC', vendors: [
        { key: 'honeywell', models: ['Honeywell T7350', 'Honeywell TrueSTEAM'] },
        { key: 'trane', models: ['Trane XR16', 'Trane XL18i'] }
    ] },
    { type: 'environmentalSensors', label: 'ENV', vendors: [
        { key: 'sensorpush', models: ['SensorPush HT1', 'SensorPush HTP.xw'] },
        { key: 'monnit', models: ['Monnit MNS2-9-W2-TH', 'Monnit MNS2-9-W1-CO2'] }
    ] }
];

function pickAuxStatus() {
    const r = Math.random();
    if (r < 0.88) return 'online';
    if (r < 0.95) return 'warning';
    if (r < 0.99) return 'critical';
    return 'offline';
}

function buildAuxiliaryDevices(siteName, siteIndex, gateways, switches, aps) {
    const counts = {
        servers: Math.max(1, Math.round(switches.length * 0.5)),
        ipCameras: Math.max(1, Math.round(aps.length * 0.4)),
        hvacUnits: Math.max(1, Math.round((gateways.length + switches.length + aps.length) * 0.15)),
        environmentalSensors: Math.max(1, Math.round(aps.length * 0.6))
    };

    const auxiliaryDevices = {};
    AUX_DEVICE_DEFS.forEach((def, typeIndex) => {
        const count = counts[def.type];
        const devices = [];
        for (let i = 0; i < count; i++) {
            const vendorDef = def.vendors[i % def.vendors.length];
            const model = vendorDef.models[Math.floor(i / def.vendors.length) % vendorDef.models.length];
            devices.push({
                id: `${def.label}-${siteIndex}-${i}`,
                name: `${def.label}-${siteName}-${String(i + 1).padStart(2, '0')}`,
                vendor: vendorDef.key,
                model,
                status: pickAuxStatus(),
                ip: `172.${16 + typeIndex}.${siteIndex}.${10 + i}`
            });
        }
        auxiliaryDevices[def.type] = devices;
    });
    return auxiliaryDevices;
}

function buildCircuit(gateway, index) {
    const status = (deviceStatus[gateway.id] && deviceStatus[gateway.id].status) || 'online';
    const isHealthy = status === 'online';
    const isCritical = status === 'critical' || status === 'offline';

    const baseLatency = isCritical ? 180 : isHealthy ? 18 + index * 4 : 65;
    const baseLoss = isCritical ? 8 : isHealthy ? 0.05 : 1.8;
    const baseUp = isCritical ? 5 : 300 - index * 60;
    const baseDown = isCritical ? 10 : 850 - index * 150;

    return {
        deviceId: gateway.id,
        isp: ISPS[Math.floor(Math.random() * ISPS.length)],
        tier: index === 0 ? 'Primary' : 'Secondary',
        connectionType: CONNECTION_TYPES[Math.floor(Math.random() * CONNECTION_TYPES.length)],
        status,
        throughputUpMbps: Math.round(baseUp),
        throughputDownMbps: Math.round(baseDown),
        latencyMs: round(baseLatency),
        lossPct: round(baseLoss, 2),
        latencyTrend: { labels: HOUR_LABELS, data: wobble(baseLatency, 0.25).map(v => round(v)) },
        lossTrend: { labels: HOUR_LABELS, data: wobble(baseLoss, 0.4).map(v => round(v, 2)) },
        throughputTrend: {
            labels: HOUR_LABELS,
            upload: wobble(baseUp, 0.3).map(v => round(v)),
            download: wobble(baseDown, 0.3).map(v => round(v))
        }
    };
}

function buildVpnTunnels(siteName, gateways) {
    const flapSite = TUNNEL_DOWN_SITES.includes(siteName);
    return gateways.map((gw, i) => {
        const vendor = gw.vendor;
        const forcedDown = flapSite && i === 0;
        const status = forcedDown ? 'down' : 'up';
        const baseLatency = forcedDown ? 0 : 20 + i * 15;
        const baseBandwidthUp = forcedDown ? 0 : 80 - i * 20;
        const baseBandwidthDown = forcedDown ? 0 : 200 - i * 40;
        const tunnel = {
            id: `vpn-${gw.id}`,
            peerName: TUNNEL_PEER_NAMES[i % TUNNEL_PEER_NAMES.length],
            vendor,
            status,
            latencyMs: forcedDown ? null : round(baseLatency),
            bandwidthUpMbps: Math.round(baseBandwidthUp),
            bandwidthDownMbps: Math.round(baseBandwidthDown),
            latencyTrend: forcedDown
                ? { labels: HOUR_LABELS, data: HOUR_LABELS.map(() => null) }
                : { labels: HOUR_LABELS, data: wobble(baseLatency, 0.2).map(v => round(v)) },
            bandwidthTrend: forcedDown
                ? { labels: HOUR_LABELS, upload: HOUR_LABELS.map(() => null), download: HOUR_LABELS.map(() => null) }
                : {
                    labels: HOUR_LABELS,
                    upload: wobble(baseBandwidthUp, 0.3).map(v => round(v)),
                    download: wobble(baseBandwidthDown, 0.3).map(v => round(v))
                }
        };
        if (vendor === 'meraki') {
            const baseJitter = 1.5 + i * 0.8;
            const baseLoss = 0.05 + i * 0.05;
            tunnel.jitterMs = forcedDown ? null : round(baseJitter);
            tunnel.lossPct = forcedDown ? null : round(baseLoss, 2);
            tunnel.lossTrend = forcedDown
                ? { labels: HOUR_LABELS, data: HOUR_LABELS.map(() => null) }
                : { labels: HOUR_LABELS, data: wobble(baseLoss, 0.4).map(v => round(v, 2)) };
        }
        return tunnel;
    });
}

const result = { version: '1.0.0', sites: {} };

siteNames.forEach((siteName, siteIndex) => {
    const siteDevices = devices.filter(d => d.site === siteName);
    const gateways = siteDevices.filter(d => d.type === 'gateway');
    const switches = siteDevices.filter(d => d.type === 'switch');
    const aps = siteDevices.filter(d => d.type === 'accessPoint');

    const circuits = gateways.map((gw, i) => buildCircuit(gw, i));
    const vpnTunnels = buildVpnTunnels(siteName, gateways);

    const psuTotal = (gateways.length + switches.length) * 2;
    const psuFailedDeviceIds = PSU_FAILURE_SITES.includes(siteName) && switches.length > 0
        ? [switches[0].id]
        : [];

    const bgpFlaps = BGP_FLAP_SITES.includes(siteName)
        ? [{ neighbor: vpnTunnels[0].peerName, previousState: 'ESTAB', currentState: 'IDLE', timeAgo: '12m ago' }]
        : [];

    const security = SECURITY_SITES.includes(siteName)
        ? [{
            ssid: 'Free_Public_WiFi',
            bssid: ('02:1A:' + Math.random().toString(16).slice(2, 10).toUpperCase().replace(/(..)/g, '$1:')).slice(0, -1),
            band: '2.4GHz',
            rssi: -Math.round(50 + Math.random() * 20),
            classification: 'rogue',
            detectedAt: '8m ago'
        }]
        : [];

    const clientScale = Math.max(1, aps.length);
    const vlans = VLAN_DEFS.map(v => {
        const clientCount = Math.round(clientScale * 8 * v.share);
        const dhcpTotal = Math.round(clientCount * 1.6) + 10;
        return {
            id: v.id,
            name: v.name,
            purpose: v.purpose,
            clientCount,
            bandwidthMbps: Math.round(clientScale * 4 * v.share),
            dhcpUsed: Math.round(dhcpTotal * (0.55 + Math.random() * 0.25)),
            dhcpTotal
        };
    });
    const dhcp = {
        used: vlans.reduce((sum, v) => sum + v.dhcpUsed, 0),
        total: vlans.reduce((sum, v) => sum + v.dhcpTotal, 0)
    };

    const topAppsBase = [42, 26, 16, 6, 10];
    const jittered = topAppsBase.map(v => Math.max(1, v * (0.85 + Math.random() * 0.3)));
    const jitteredSum = jittered.reduce((a, b) => a + b, 0);
    const normalized = jittered.map(v => Math.round((v / jitteredSum) * 100));
    const roundingDiff = 100 - normalized.reduce((a, b) => a + b, 0);
    normalized[0] += roundingDiff;
    const topApplications = {
        labels: TOPAPP_LABELS,
        data: normalized,
        colors: TOPAPP_COLORS
    };

    result.sites[siteName] = {
        circuits,
        vpnTunnels,
        hardware: { psuTotal, psuFailedDeviceIds },
        bgpFlaps,
        security,
        vlans,
        dhcp,
        topApplications,
        auxiliaryDevices: buildAuxiliaryDevices(siteName, siteIndex, gateways, switches, aps)
    };
});

const outPath = path.join(__dirname, '../data/site-details.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
console.log(`Wrote ${outPath} for ${siteNames.length} sites.`);
