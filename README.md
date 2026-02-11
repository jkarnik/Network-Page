# Network Dashboard - Widget Reference

A multi-page network monitoring dashboard built with vanilla JS, Chart.js, and Tailwind CSS. Four pages provide progressively deeper visibility: a global summary, then per-device views for SD-WAN gateways, switches, and access points.

---

## Page 1: Summary (`index.html`)

The summary page provides an organization-wide view. All widgets respond to a **scope selector** (Global / Region / Site).

### Row 1 - Executive Status

| Widget | Type | What It Shows |
|--------|------|---------------|
| **Network Health** | Semi-circle gauge | Weighted health score (0-100). Color shifts green > amber > red at 90/75 thresholds. |
| **Network Issues** | Big numbers + expandable alert table | Critical and Warning device counts. Expands to a filterable alert feed (severity / search). |
| **Security Posture (24h)** | Big numbers + expandable alert table | Threats Blocked and Active Rogues counts. Expands to a filterable security alert feed (threat / rogue). |
| **Active Devices** | Counts + sparklines + expandable device grid | Per-type counts (Gateways, Switches, APs) with 7-point sparklines and trend %. Expands to a searchable/filterable device card grid. Click a card to navigate to the device page. |
| **Device Status Distribution** | 3x3 matrix (device type x status) | Online / Warning / Critical counts per device type. Click any cell to see matching devices. |

### Row 2 - Analytical Charts

| Widget | Type | What It Shows | Overlay |
|--------|------|---------------|---------|
| **Top Impacted SD-WANs (Latency)** | Horizontal bar | Top 5 sites by average WAN latency (ms). Click a bar to filter dashboard by site. | Multi-line trend chart: top 5 sites over 24h. |
| **User Frustration Leaderboard** | Stacked horizontal bar | Top 5 sites by total connection time, broken into Association / Auth / DHCP / DNS components. Click a bar to filter by site. | Dual chart: top 10 site breakdown + top 5 trend lines over 24h. |
| **WAN Resilience** | Donut chart | Primary / Failover / Down link distribution (%). | Dual chart: status % trend over 24h + failover events per site. |

### Row 3 - Alert Feed

| Widget | Type | What It Shows |
|--------|------|---------------|
| **Unified Alert Feed** | Scrollable table | All alerts across the organization. Columns: Severity, Time, Vendor, Site, Device, Message. Device names link to their detail page. |

### Data Sources

All summary data is loaded via `DataLoader.load()` from `network-data.json`, `devices.json`, and `alerts.json`. No per-device defaults file is used on this page.

---

## Page 2: SD-WAN Gateway (`sdwan.html`)

Per-device view for SD-WAN gateways. Data loaded from `gateway-defaults.json` via `DataLoader.getDeviceData()`.

### Overview Tab

| Widget | Type | What It Shows | Data Field |
|--------|------|---------------|------------|
| **CPU Load** | Gauge + sparkline | Current CPU % and 24h hourly trend. | `cpuUsage`, `cpuTrend` |
| **Memory Load** | Gauge + sparkline | Current memory % and 24h hourly trend. | `memoryUsage`, `memoryTrend` |
| **Cellular Backup** | Signal bars + sparkline | Standby/Active status, signal strength (dBm), 24h signal trend. | `cellular.status`, `cellular.signalStrength`, `signalTrend` |
| **Wireless Threats** | Alert list | Active wireless threats with severity. | Hardcoded sample (2 threats) |
| **Uplink Health** | Multi-line chart (dual Y-axis) | Latency (ms), Jitter (ms), Packet Loss (%) over 10h. Click to expand. | `uplinkHealth` / `uplinkHealthExpanded` |
| **WAN Throughput** | Filled line chart | Upload (Tx) and Download (Rx) in Mbps over 24h. Click to expand. | `throughput` / `throughputExpanded` |
| **Top Applications** | Donut + legend | Traffic distribution by app (M365, Teams, Salesforce, YouTube, Other). Filterable by VLAN or VPN tunnel. Click to expand. | `topApps`, `topAppsByVlan`, `topAppsByVpn`, `topAppsTrend` |
| **DHCP Utilization** | Stacked horizontal bars | Global pool usage + per-VLAN breakdown (Corp, Secure, Guest, Prod). Click to expand. | `dhcp`, `dhcpTrend` |
| **Sequential Event Timeline** | Vertical timeline | Time-sequenced events (OSPF Flapping, Link Failure, VPN Failover, etc.). | Hardcoded sample |
| **VPN Tunnel Status** | Data table | 4 VPN peers: status, upload/download, latency, jitter, loss. Click a row for peer detail overlay. | `vpnPeers` |

### Advanced Tab

| Widget | Type | What It Shows |
|--------|------|---------------|
| **BGP Neighbors** | Status list | BGP peer IPs with ESTAB/IDLE status indicators. |
| **Active Route Table (RIB)** | Data table | Routes: destination prefix, next hop, protocol (STATIC/BGP/OSPF/CONN), interface, metric. |
| **Device Alert Feed** | Alert table | Severity, Time, Type, Message for this device. |

### Diagnostics Tab

| Widget | Type | What It Shows |
|--------|------|---------------|
| **Diagnostics Container** | Dynamic | Managed by `DiagnosticsManager.init('gateway')`. |

### Overlays

| Overlay | Triggered By | Chart Type | What It Shows |
|---------|-------------|------------|---------------|
| **Uplink Health Trends** | Uplink Health card | Line (dual Y-axis) | 24h latency, jitter, loss trends. |
| **WAN Throughput Trends** | WAN Throughput card | Filled line | 24h upload/download trends. |
| **Application Trends** | Top Applications card | Multi-line filled | 24h traffic trends per app; filterable by VLAN/VPN. |
| **DHCP Trends** | DHCP Utilization card | Line + reference | 24h used IPs vs max capacity (dashed red line). |
| **Peer Details** | VPN table row click | 2 line charts | Bandwidth (upload/download) + Performance (latency/jitter/loss) for selected peer. |

---

## Page 3: Switch (`switch.html`)

Per-device view for managed switches. Data loaded from `switch-defaults.json` via `DataLoader.getDeviceData()`.

### Overview Tab

| Widget | Type | What It Shows | Data Field |
|--------|------|---------------|------------|
| **Front Panel View** | 48-port LED faceplate | Visual port status: green (Up), gray (Down), amber (Error). PoE-capable ports show lightning bolt. | Generated `ports[]` array |
| **CPU Load** | Gauge + sparkline | Current CPU % and 24h hourly trend. | `cpuUsage`, `cpuTrend` |
| **Memory Load** | Gauge + sparkline | Current memory % and 24h hourly trend. | `memoryUsage`, `memoryTrend` |
| **PoE Budget** | Gauge + sparkline | Current PoE usage % and 24h hourly trend. | `poeUsage`, `poeTrend` |
| **Hardware Redundancy** | Status list | PSU 1, PSU 2, System Fans status (OK / Alert). | Hardcoded sample |
| **Uplink Health** | Multi-line chart (dual Y-axis) | Latency (ms), Jitter (ms), Packet Loss (%) over 10h. Click to expand. | `uplink` / `uplinkExpanded` |
| **Traffic (24h)** | Filled line chart | Upload (Tx) and Download (Rx) over 6h summary. Click to expand to 24h. | `traffic` / `trafficExpanded` |
| **Error Monitor** | Horizontal bar | Top 5 ports by error count, color-coded red-to-green. Click to expand to 15 ports. | `errorMonitor` / `errorMonitorExpanded` |
| **Traffic by Port (MB)** | Horizontal stacked bar | Top 5 ports by upload/download volume. Click to expand to 15 ports. | `trafficByPort` / `allPortsTraffic` |
| **"Shadow IT" Detector** | Data table | Flagged ports with risk level, client count, vendor info, VLAN, traffic volume. Action buttons (Disable / Whitelisted). | `shadowITPorts` + mock port data |

### Advanced Tab

| Widget | Type | What It Shows |
|--------|------|---------------|
| **Port Interface Status** | Searchable/sortable table (48 rows) | All ports: name, status, VLAN, speed, upload, download, latency, PoE, clients, errors. Click any row for port detail overlay. |
| **Device Alert Feed** | Alert table | Severity, Time, Type, Message for this device. |

### Diagnostics Tab

| Widget | Type | What It Shows |
|--------|------|---------------|
| **Diagnostics Container** | Dynamic | Managed by `DiagnosticsManager.init('switch')`. |

### Overlays

| Overlay | Triggered By | Chart Type | What It Shows |
|---------|-------------|------------|---------------|
| **Traffic Trends** | Traffic card | Filled line | 24h upload/download trends. |
| **Error Monitor Expanded** | Error Monitor card | Horizontal bar | Top 15 ports by error count, color-coded. |
| **Traffic by Port Expanded** | Traffic by Port card | Horizontal stacked bar | Top 15 ports by upload/download volume. |
| **Uplink Health Trends** | Uplink Health card | Line (dual Y-axis) | 24h latency, jitter, loss trends. |
| **Port Details** | Port table row click | 2 line charts | Traffic (upload/download) + Performance (latency/jitter/errors) for selected port. |

---

## Page 4: Access Point (`access-point.html`)

Per-device view for wireless access points. Data loaded from `accesspoint-defaults.json` via `DataLoader.getDeviceData()`.

### Overview Tab

| Widget | Type | What It Shows | Data Field |
|--------|------|---------------|------------|
| **Client Journey Funnel** | 5 circular gauges | Success rate for each onboarding stage: Association, Authentication, DHCP, DNS, and overall Success (product of all). "View Time Series" button opens overlay. | `funnelData` / `funnelTimeSeries` |
| **Active Client Count** | Multi-line chart | Total, Wired, 2.4 GHz, 5 GHz, 6 GHz client counts over 13 time points. | `clientCount` (labels, wired, wifi24, wifi5, wifi6) |
| **Top SSIDs** | Horizontal bar | Top 4 SSIDs by client count (e.g., Corp-Secure: 28, Guest-WiFi: 8). | `topSSIDs` |
| **Channel Utilization** | Stacked bar | Per-band breakdown: WiFi Traffic %, Interference %, Free Airtime % for 2.4/5/6 GHz. Click to expand. | `channelUtilization` / `channelUtilTrends` |
| **Signal Quality (SNR)** | Vertical bar | Client distribution across 4 SNR tiers: Poor (<15dB), Fair (15-25), Good (25-35), Excellent (>35). | `snrDistribution` |

### Advanced Tab

| Widget | Type | What It Shows |
|--------|------|---------------|
| **Interfering Neighbors** | Data table | Nearby APs: SSID, BSSID, Channel, RSSI, Classification (Rogue / Interfering / Managed). "2 High Impact" badge. |
| **Active Client List** | Searchable table (3 rows) | Per-client: MAC, IP, OS, SSID, Upload, Download, Latency, Packet Loss, SNR, Usage. Click any row for client detail overlay. |
| **Device Alert Feed** | Alert table | Severity, Time, Type, Message for this device. |

### Diagnostics Tab

| Widget | Type | What It Shows |
|--------|------|---------------|
| **Diagnostics Container** | Dynamic | Managed by `DiagnosticsManager.init('ap')`. |

### Overlays

| Overlay | Triggered By | Chart Type | What It Shows |
|---------|-------------|------------|---------------|
| **Funnel Time Series** | "View Time Series" button | Multi-line | 13-point trends for all 5 funnel stages (Association, Auth, DHCP, DNS, Success). Dual tooltip: % and estimated client count. |
| **Client Details** | Client table row click | 2 line charts | Bandwidth (upload/download) + Performance (packet loss/SNR) for selected client over 12h. |
| **Channel Utilization Trends** | Channel Utilization card | Multi-line | 24h trends: WiFi traffic + interference per band (2.4/5/6 GHz). |

---

## Cross-Page Features

| Feature | Description |
|---------|-------------|
| **Timeline Selector** | Nav bar dropdown (all pages). Presets: 5m, 30m, 1h, 2h, 6h, 12h, 24h, 3d, 7d + custom date range. Persists via localStorage. Slices all time-series charts. |
| **Device Selector** | Nav bar dropdown (device pages). Loads per-device data via DataLoader. |
| **Theme Toggle** | Dark/light mode. Persists via localStorage. All charts auto-update colors. |
| **Navigation** | Desktop sidebar + mobile drawer. Links: Summary, SD-WAN, Switch, Access Point. |
| **Alert Feed** | Per-device alert table on Advanced tab (device pages). Populated by `SharedUI.updateDeviceAlertFeed()`. |

---

## Data Architecture

```
data/
  network-data.json      -- Summary page: regions, sites, metrics, latency, frustration, WAN
  devices.json           -- All devices: gateways, switches, accessPoints (name, site, status, IP, clients)
  alerts.json            -- All alerts: severity, vendor, site, device, message, type, timeAgo
  gateway-defaults.json  -- SD-WAN defaults: CPU/mem trends, uplink, throughput, apps, DHCP, VPN peers
  switch-defaults.json   -- Switch defaults: CPU/mem/PoE trends, traffic, uplink, errors, ports
  accesspoint-defaults.json -- AP defaults: funnel, clients, channels, SNR, SSIDs, client details
```

Each device page loads defaults via `DataLoader.getDeviceData(deviceId, type)`, which deep-merges the defaults JSON with any per-device override file (`data/overrides/{deviceId}.json`).

---

## JSON Schema Reference

### gateway-defaults.json
| Field | Type | Description |
|-------|------|-------------|
| `cpuUsage` | number | Current CPU % |
| `memoryUsage` | number | Current memory % |
| `cpuTrend` | `{labels, data}` | 24-point hourly CPU trend |
| `memoryTrend` | `{labels, data}` | 24-point hourly memory trend |
| `cellular` | `{status, signalStrength}` | Cellular backup state |
| `signalTrend` | `{labels, data}` | 24-point signal strength trend |
| `uplinkHealth` | `{labels, latency, jitter, loss}` | 10-point uplink metrics (card) |
| `uplinkHealthExpanded` | `{labels, latency, jitter, loss}` | 24-point uplink metrics (overlay) |
| `throughput` | `{labels, upload, download}` | 6-point throughput (card) |
| `throughputExpanded` | `{labels, upload, download}` | 24-point throughput (overlay) |
| `topApps` | `{labels, data, colors}` | App traffic distribution |
| `topAppsByVlan` | `{vlanName: {labels, data, colors}}` | App distribution filtered by VLAN |
| `topAppsByVpn` | `{tunnelName: {labels, data, colors}}` | App distribution filtered by VPN tunnel |
| `topAppsTrend` | `{labels, datasets[]}` | 24-point per-app traffic trends |
| `dhcp` | `{used, total}` | Global DHCP pool usage |
| `dhcpTrend` | `{labels, used}` | 24-point DHCP utilization trend |
| `vpnPeers` | `{peerName: {upload, download, latency, jitter, loss}}` | Per-peer 24-point metrics |

### switch-defaults.json
| Field | Type | Description |
|-------|------|-------------|
| `cpuUsage` | number | Current CPU % |
| `memoryUsage` | number | Current memory % |
| `poeUsage` | number | Current PoE budget % |
| `cpuTrend` | `{labels, data}` | 24-point hourly CPU trend |
| `memoryTrend` | `{labels, data}` | 24-point hourly memory trend |
| `poeTrend` | `{labels, data}` | 24-point hourly PoE trend |
| `traffic` | `{labels, upload, download}` | 6-point traffic summary (card) |
| `trafficExpanded` | `{labels, upload, download}` | 24-point traffic (overlay) |
| `uplink` | `{labels, latency, jitter, loss}` | 10-point uplink metrics (card) |
| `uplinkExpanded` | `{labels, latency, jitter, loss}` | 24-point uplink metrics (overlay) |
| `errorMonitor` | `{labels, data, colors}` | Top 5 ports by errors (card) |
| `errorMonitorExpanded` | `{labels, data, colors}` | Top 15 ports by errors (overlay) |
| `trafficByPort` | `{labels, upload, download}` | Top 5 ports by traffic (card) |
| `allPortsTraffic` | `{labels, upload, download}` | Top 15 ports by traffic (overlay) |
| `shadowITPorts` | `number[]` | Port numbers flagged as shadow IT |
| `portCount` | number | Total physical ports |
| `poeCapablePorts` | number | Number of PoE-capable ports |

### accesspoint-defaults.json
| Field | Type | Description |
|-------|------|-------------|
| `funnelData` | `{association, authentication, dhcp, dns}` | Current success rates (%) |
| `funnelTimeSeries` | `{labels, association, authentication, dhcp, dns}` | 13-point hourly funnel trends |
| `clientCount` | `{labels, wired, wifi24, wifi5, wifi6}` | 13-point client count by band |
| `channelUtilization` | `{labels, wifi, interference, free}` | Per-band utilization (card) |
| `channelUtilTrends` | `{labels, band24, band5, band6}` | 24-point per-band trends (overlay); each band has `{wifi, interference}` |
| `snrDistribution` | `{labels, data, colors}` | Client count per SNR tier |
| `topSSIDs` | `{labels, data}` | Top SSIDs by client count |
| `clientDetails` | `{mac: {upload, download, packetLoss, snr}}` | Per-client 12-point metrics |
