# Network Monitoring Dashboard

> Widget reference — auto-generated. Describes every widget across all 4 pages and the insights each provides.

---

## Table of Contents

- [Overview / Summary Page (index.html)](#overview--summary-page)
- [SD-WAN Device Detail (sdwan.html)](#sd-wan-device-detail)
- [Switch Detail (switch.html)](#switch-detail)
- [Access Point Detail (access-point.html)](#access-point-detail)

---

## Overview / Summary Page

The landing page gives a fleet-wide snapshot of all network devices, active alerts, and top performance issues across all sites.

### 1. Fleet Status (Device Status Matrix)

**Data displayed:** A grid of all network devices organized by device type (Gateways, Switches, Access Points) and vendor (Cisco Meraki, Juniper Mist). Each cell shows device counts broken down by health status: Healthy, Warning, Critical, and Offline. Supports two view modes — Type-by-Vendor or Vendor-by-Type — and cells expand to show specific device models.

**Insights:**
- At-a-glance assessment of which device types or vendors have the most problems
- Drill down to individual device models to identify the source of issues
- Reveals the overall risk profile of the fleet

---

### 2. Infrastructure Alerts

**Data displayed:** A summary card showing Critical and Warning counts for infrastructure alerts, with an expandable table showing Severity, Time, Site, Device, and Message. Filterable by site, searchable by device/message, sortable by any column.

**Insights:**
- Immediate visibility into active network infrastructure problems
- Prioritize response by severity level
- Quickly identify which sites are experiencing issues

---

### 3. Security Alerts

**Data displayed:** Same structure as Infrastructure Alerts but scoped to security-type events only.

**Insights:**
- Dedicated visibility into security threats separate from operational issues
- Enables security teams to triage without noise from infrastructure events
- Audit trail of security events with device and timing context

---

### 4. AI Alerts

**Data displayed:** Same structure as above, scoped to AI-generated anomaly detection alerts.

**Insights:**
- Machine learning-driven detection of abnormal patterns
- Proactive alerting before issues become critical
- Separate category enables tuning and review of AI model behavior

---

### 5. Top Impacted SD-WANs (Latency Chart)

**Data displayed:** Horizontal bar chart of the top 5 SD-WAN sites ranked by average latency in milliseconds, color-coded by connection type (Fiber, MPLS, Cable, Starlink). Clickable to open a detailed latency trends overlay.

**Insights:**
- Immediately identifies which WAN sites are degrading user experience
- Compares latency across connection types — fiber consistently outperforms satellite/MPLS
- Baseline for SLA compliance monitoring and circuit upgrade decisions

---

### 6. User Frustration Leaderboard

**Data displayed:** Stacked horizontal bar chart showing "Time to Connect" broken down by phase — Association (red), Authentication (orange), DHCP (amber), DNS Resolution (green) — for the top 5 slowest sites. Clickable for detailed trends.

**Insights:**
- Identifies sites where users experience the slowest network onboarding
- Shows *which phase* of connection causes delays, pointing to the right fix (auth server, DHCP pool, DNS config)
- High connection times correlate directly with user frustration and support tickets

---

### 7. WAN Resilience (Donut Chart)

**Data displayed:** Donut chart showing the fleet-wide distribution of WAN link states — Primary (blue), Failover (amber), Down (red) — as percentages. Clickable for trends overlay.

**Insights:**
- Single-number view of overall WAN health posture
- Active failover percentage reveals how many sites are currently running on backup links
- Downtime percentage surfaces critical outages requiring immediate action

---

### 8. Unified Alert Feed

**Data displayed:** Full-width table combining all alert categories (network, security, AI, hardware, performance). Columns: Severity, Time, Vendor, Site, Device, Message. Searchable, exportable to CSV, with live event streaming.

**Insights:**
- Cross-functional view for operations teams who need the full picture
- Device names are clickable links to the relevant device detail page
- Export capability supports incident reports and post-mortems

---

### Overlay Charts (accessible from main widgets)

| Overlay | Triggered from | What it shows |
|---|---|---|
| Latency Trends | Top Impacted SD-WANs | Line chart of top 5 sites' latency over 24 hours |
| User Frustration Trends | Frustration Leaderboard | Connection time breakdown by phase + trend over time |
| WAN Resilience Trends | WAN Resilience donut | Stacked area of link states over time + failover events by site |

---

## SD-WAN Device Detail

A deep-dive page for a single SD-WAN appliance. Accessed by clicking a device from the fleet view. Contains an Overview tab and a Diagnostics tab.

### Device Info Card (persistent header)

**Data displayed:** Device name, model, management IP, MAC address, uptime, and a color-coded health status badge.

**Insights:** Confirms identity and baseline health of the device being investigated. Uptime indicates stability and when the device last rebooted.

---

### CPU Load

**Data displayed:** Current CPU usage as a doughnut gauge (blue), plus a 24-hour sparkline trend.

**Insights:** Identifies processor bottlenecks. Sustained high CPU may require traffic optimization or hardware upgrade. Spikes suggest traffic bursts or processing-intensive operations.

---

### Memory Load

**Data displayed:** Current memory usage as a doughnut gauge (purple), plus a 24-hour sparkline trend.

**Insights:** Sustained high memory can indicate memory leaks or excessive concurrent connections — memory exhaustion causes packet loss on SD-WAN devices.

---

### Cellular Backup

**Data displayed:** Current cellular status (Standby/Active), a 5-bar signal strength indicator, signal in dBm, and a 24-hour signal sparkline.

**Insights:** Shows whether the primary uplinks have failed and the device is routing over cellular. Degraded signal predicts potential failover reliability issues.

---

### Wireless Threats

**Data displayed:** Count of active wireless security threats, with a list showing threat type (Rogue AP, Spoof Detected), SSID/MAC of the threat source, detection location, and RSSI.

**Insights:** Identifies active wireless security incidents. Rogue APs indicate unauthorized access points; MAC spoofing reveals potential man-in-the-middle attacks. RSSI shows proximity/severity.

---

### Uplink Health

**Data displayed:** Dual-axis line chart over 24 hours — Latency (ms, blue), Jitter (ms, purple) on the left axis; Packet Loss (%, red) on the right. Handles ISP failure scenarios with gaps in the line where the connection was lost.

**Insights:** The three metrics together define link quality. Any packet loss >0.5% impacts critical applications. Jitter >5ms degrades VoIP/video. Gaps in the line indicate complete outage events.

---

### Uplink Traffic

**Data displayed:** Line chart with 4 series — Comcast Upload/Download and AT&T Upload/Download — in Mbps over 24 hours.

**Insights:** Tracks bandwidth utilization across primary and backup ISPs. Compares load distribution and helps validate whether load balancing is working. If the backup ISP (AT&T) carries zero traffic, it may be misconfigured.

---

### Top Applications

**Data displayed:** Doughnut chart showing traffic distribution across top 5 applications, with VLAN and VPN tunnel filter dropdowns.

**Insights:** Reveals which apps consume the most WAN bandwidth. VLAN filtering shows per-segment app usage (e.g., Guest = streaming). Tunnel filtering shows app distribution to specific destinations. Useful for QoS policy tuning.

---

### DHCP Utilization

**Data displayed:** Stacked horizontal bar charts — one global pool bar and one per VLAN (Corp, Secure, Guest, Prod) — showing used vs. available DHCP addresses with percentage and count.

**Insights:** Shows DHCP pool exhaustion risk globally and per VLAN. Imbalance across VLANs reveals over-subscribed segments. High Corp VLAN usage may indicate too many devices or long lease times.

---

### VPN Tunnel Status Table

**Data displayed:** Table of all VPN peers with columns: Peer name, Status (UP/DEGRADED/DOWN), Upload Mbps, Download Mbps, Latency, Jitter, and Packet Loss. Rows are clickable.

**Insights:** Single-table view of all tunnel health. DEGRADED status flags tunnels needing attention. Clicking any row opens a detailed bandwidth + performance chart overlay for that specific peer.

---

### BGP Neighbors

**Data displayed:** List of BGP peer relationships showing IP address, peer label (ISP-A, ISP-B, Core), and state (ESTAB/IDLE).

**Insights:** IDLE state on any neighbor indicates a BGP session failure, which can cause traffic blackholes or failover. Having 2+ ESTAB ISP peers confirms routing redundancy.

---

### Active Route Table (RIB)

**Data displayed:** Table of active routes showing Destination Prefix, Next Hop IP, Protocol (STATIC/BGP/OSPF/CONN), Interface, and Metric.

**Insights:** Shows exactly how traffic is being routed. Missing expected routes indicate BGP/OSPF convergence issues. Metric values show route preference in multi-path scenarios. Helps diagnose asymmetric routing.

---

### Device Alert Feed

**Data displayed:** Scrollable table of device-specific alerts — Severity, Time, Type, and Message.

**Insights:** Chronological alert history for root cause analysis. Recurring alert types (e.g., repeated BGP flaps) reveal systemic issues. Correlate timestamps with performance dips visible in other widgets.

---

### Overlays on SD-WAN page

| Overlay | Triggered from | What it shows |
|---|---|---|
| Peer Details | Click VPN tunnel row | Bandwidth chart + performance chart (latency/jitter/loss) for that peer over 24h |
| Application Trends | Top Applications card | Stacked area chart of traffic volume by app over 24h, filterable by VLAN/tunnel |
| DHCP Utilization Trends | DHCP Utilization card | Multi-line area chart of DHCP usage per VLAN over 24h with capacity reference line |
| Uplink Health Trends | Uplink Health card | Dual-axis line chart of latency/jitter/packet loss over 24h |
| Uplink Traffic Trends | Uplink Traffic card | 4-series line chart of ISP upload/download over 24h |

---

## Switch Detail

A deep-dive page for a single network switch. Contains an Overview tab and a Diagnostics tab.

### Device Info Card (persistent header)

**Data displayed:** Device name, model, IP, MAC, uptime, and health status badge.

**Insights:** Quick identification and health status. Uptime shows stability; status badge drives immediate action priority.

---

### Front Panel View (Port Faceplate)

**Data displayed:** Visual representation of all 48 ports in a grid. Each port has a color-coded LED (green = up, gray = down, amber = error) and a PoE lightning bolt icon on ports supplying power. Hovering shows port number and description.

**Insights:** The fastest way to spot problem areas on the switch without reading a table. Amber LEDs immediately draw the eye to ports with errors. PoE indicators show where powered devices (APs, phones, cameras) are connected.

---

### CPU Load

**Data displayed:** Current CPU usage as a doughnut gauge (blue) + 24-hour sparkline.

**Insights:** Identifies processor bottlenecks. Spikes during business hours are normal; sustained high CPU indicates misconfiguration or excessive traffic.

---

### Memory Load

**Data displayed:** Current memory usage as a doughnut gauge (purple) + 24-hour sparkline.

**Insights:** Detects memory leaks or excessive buffering. Memory approaching 100% can cause instability or unexpected reboots.

---

### PoE Budget

**Data displayed:** Current PoE power consumption as a doughnut gauge (green) + 24-hour sparkline showing power usage trend.

**Insights:** Prevents oversubscription of the power budget before adding new PoE devices. Shows whether the switch can safely support additional APs, phones, or cameras.

---

### Hardware Redundancy

**Data displayed:** Status of PSU 1, PSU 2, and System Fans — each showing a status badge (OK/FAIL) and fan RPM.

**Insights:** Confirms power supply redundancy is intact. A failed PSU is silent without this widget. Fan RPM indicates thermal management is working correctly.

---

### Uplink Health

**Data displayed:** Dual-axis line chart — Latency (ms, blue), Jitter (ms, purple) on the left; Packet Loss (%, red dashed) on the right — over a time window.

**Insights:** Shows WAN link quality from the switch's perspective. Latency/jitter spikes indicate upstream congestion. Any packet loss points to reliability issues affecting connected devices.

---

### Uplink Traffic

**Data displayed:** Line chart showing Tx (upload, indigo) and Rx (download, green) throughput in Mbps over the last 6 hours.

**Insights:** Shows current network load on uplink ports. Download/upload asymmetry is normal; extreme spikes may indicate unusual traffic or a broadcast storm.

---

### Error Monitor

**Data displayed:** Horizontal bar chart of the top 5 ports by error count, color-coded from red (high) to green (low), with exact counts on hover.

**Insights:** Instantly surfaces the most problematic ports. Uplink port errors indicate WAN issues; access port errors suggest end-device or cable problems. Color gradient makes severity immediately obvious.

---

### Traffic by Port

**Data displayed:** Horizontal stacked bar chart of the top 5 ports by traffic volume, split by Upload (indigo) and Download (green) in GB.

**Insights:** Identifies bandwidth-heavy ports and devices. Detects bandwidth hogging. The uplink port (typically Ge48) should dominate — if an access port rivals it, investigate that device.

---

### Shadow IT Detector

**Data displayed:** Table of ports where multiple MAC addresses were detected (indicating an unauthorized hub/switch). Columns: Port, Location, Risk level, Client count, Device vendors, VLAN, Traffic volume, First seen. Each row has a Disable or Whitelist action button.

**Insights:** Detects unauthorized network equipment that bypasses security policies. High-risk ports (e.g., 8 clients from TP-Link/RPi on a lab bench) indicate potential policy violations or data exfiltration risk. First-seen timestamps help trace when unauthorized devices were introduced.

---

### Port Interface Status Table

**Data displayed:** Full table of all 48 ports with columns: Port, Name/description, Status (Connected/Down/Error), VLAN, Speed, Upload Mbps, Download Mbps, Latency, PoE watts, Client count, Error count. Searchable, filterable by status, sortable by any column. Rows are clickable for details.

**Insights:** The definitive port inventory. Sort by errors to find problematic ports; sort by clients to find busy ports; sort by PoE to find power-hungry devices. Click any port for a 24-hour performance history.

---

### Device Alert Feed

**Data displayed:** Scrollable alert table — Severity, Time, Type, Message — for this device specifically.

**Insights:** Chronological event log for root cause analysis. Helps correlate port errors or traffic spikes with specific alert events (e.g., "PoE Overload" matching a spike in the PoE gauge).

---

### Overlays on Switch page

| Overlay | Triggered from | What it shows |
|---|---|---|
| Port Details | Click any row in Port Interface Status | Traffic (upload/download) + performance (latency/jitter/errors) over 24h for that port |
| Traffic Trends | Uplink Traffic card | Detailed Tx/Rx line chart supporting 24h/3d/7d views |
| Error Monitor Details | Error Monitor card | All ports with errors (not just top 5), color-coded bar chart |
| Traffic by Port Details | Traffic by Port card | All 48 ports by traffic volume (not just top 5) |
| Uplink Health Trends | Uplink Health card | Dual-axis latency/jitter/loss line chart supporting extended timeframes |

---

## Access Point Detail

A deep-dive page for a single wireless access point. Contains an Overview tab and a Diagnostics tab.

### Device Info Card (persistent header)

**Data displayed:** Device name, model, IP, MAC, uptime, and health status badge.

**Insights:** Quick identification of which AP is being monitored. Status badge drives immediate action priority.

---

### Active Client Count

**Data displayed:** Time-series line chart with 5 series — Total clients (orange dashed), Wired (gray), 2.4 GHz (blue), 5 GHz (green), 6 GHz (cyan) — with a VLAN filter dropdown.

**Insights:** Shows how clients are distributed across connection types over time. Reveals whether users are adopting newer bands (5/6 GHz vs. 2.4 GHz). VLAN filtering segments analysis by network type (Corp vs. Guest vs. IoT). Peak times identify capacity pressure.

---

### Channel Utilization

**Data displayed:** Three horizontal stacked bars (one per WiFi band: 2.4 GHz, 5 GHz, 6 GHz), each split into WiFi traffic (blue), non-WiFi interference (red), and free airtime (gray). VLAN filter available. Clickable to expand into trends overlay.

**Insights:** Shows airtime efficiency per band in real time. High interference segments indicate channel problems. A fully saturated bar (little free airtime) means the band is at capacity. Helps decide which band to steer clients toward.

---

### Retransmission Rate

**Data displayed:** Time-series line chart showing packet retransmission rate (%) per band — 2.4 GHz (blue), 5 GHz (green), 6 GHz (cyan) — with dashed threshold lines at 10% and 20%.

**Insights:** High retransmission = poor link quality, usually caused by low SNR or interference. If the 2.4 GHz line consistently exceeds the threshold while 5 GHz is fine, clients should be steered to 5 GHz. Crossing the 20% threshold typically causes noticeable application degradation.

---

### Top SSIDs

**Data displayed:** Horizontal bar chart showing client count per SSID (top 4), with VLAN filter.

**Insights:** Shows which SSIDs are most popular. Identifies load imbalance across SSIDs. VLAN filtering reveals per-segment SSID usage patterns. Helps plan capacity and identify underutilized SSIDs.

---

### Signal Quality Distribution (SNR)

**Data displayed:** Bar chart with 4 bins — Poor (<15 dB, red), Fair (15–25 dB, amber), Good (25–35 dB, blue), Excellent (>35 dB, green) — showing how many clients fall into each SNR range.

**Insights:** A large "Poor" bar signals coverage holes or interference problems. Ideally most clients should be in "Good" or "Excellent." This widget justifies adding more APs or adjusting transmit power. Can be filtered by VLAN to isolate specific network segments.

---

### SSID-to-VLAN Mapping Table

**Data displayed:** Table showing every SSID with its VLAN name, VLAN ID, security protocol (WPA3-Enterprise, WPA2-PSK, etc.), supported bands (2.4/5/6 GHz), current client count, and Active/Inactive status.

**Insights:** Complete SSID security posture in one view. Verify correct VLAN assignments, security levels, and band support. Spot inactive SSIDs that should be cleaned up. Identify if any SSID is missing 6 GHz support or using a weaker security protocol than policy requires.

---

### Interfering Neighbors / Rogue AP Detection

**Data displayed:** Table of detected neighboring APs showing SSID, BSSID (MAC), channel and band, RSSI (dBm), and classification — ROGUE (red), INTERFERING (orange), or MANAGED (cyan).

**Insights:** Identifies security threats (rogue APs) and channel interference sources. Strong RSSI (e.g., -55 dBm) means the neighboring AP is physically close and causing significant interference. Same-channel neighbors have the highest impact. Action should be taken on any ROGUE classification.

---

### Active Client List

**Data displayed:** Detailed table of all connected clients with columns: MAC, IP, OS (with icons), SSID, Upload Mbps, Download Mbps, Latency (ms), Packet Loss (%), SNR (dB), Total data usage. Searchable. Each row is clickable for client history.

**Insights:** The most granular view of client health on the AP. Sort by packet loss to find struggling clients. Sort by SNR to find clients in poor coverage. Sort by data usage to find heavy bandwidth consumers. Click any client to see their 24-hour bandwidth and performance history.

---

### Device Alert Feed

**Data displayed:** Scrollable table of AP-specific alerts — Severity, Time, Type, Message.

**Insights:** Chronological event log for this AP. Helps correlate alert timestamps with performance dips visible in other widgets (e.g., an interference alert matching a retransmission spike).

---

### Overlays on Access Point page

| Overlay | Triggered from | What it shows |
|---|---|---|
| Client Details | Click any row in Active Client List | Bandwidth chart (upload/download) + performance chart (packet loss / SNR) over 24h for that client |
| Channel Utilization Trends | Channel Utilization expand icon | Multi-line time series showing WiFi traffic vs. interference per band over 24h |

---
