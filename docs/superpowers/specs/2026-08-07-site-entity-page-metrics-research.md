# Site Entity Page — Metrics & Monitoring Research

> Ideation output for a future Site entity page. This is a research document, not an implementation spec — it will be used as input when the Site entity page itself is designed and built in a separate session.

## Table of Contents

- [1. Purpose & Context](#1-purpose--context)
- [2. Design Principles](#2-design-principles)
- [3. Tiering Model](#3-tiering-model)
- [4. Metric Catalog](#4-metric-catalog)

---

## 1. Purpose & Context

This dashboard was originally built on the assumption that rich vendor telemetry (Meraki, Mist) could be pulled directly into New Relic so customers never had to leave NR. Vendor API rate limits made that infeasible at the scale of a retail fleet (hundreds of stores), so the project pivoted: device entity pages were stripped down to status + alerts + a deep link out to the vendor portal, and no longer carry deep per-device telemetry.

That pivot leaves a gap. For the retail persona (GAP/Nordstrom/McDonald's-style multi-site operators), the unit that matters isn't a single device — it's the site: "is this store's network healthy." No page currently answers that question. This document ideates the metrics, configuration views, and polling strategy for a new **Site entity page** that fills that gap — and, per the pivot's lesson, has to earn every metric it shows against a hard constraint: minimize vendor API calls at a scale of hundreds of sites per customer.

This is a research/ideation deliverable. It intentionally stops short of page layout, data model, or implementation — that's the next session's work, using this document as input.

## 2. Design Principles

These were established through discussion and hold for everything below:

- **Audience: both personas, progressive disclosure.** Store-level/regional IT staff need a plain "is my store okay" signal; central NOC/network engineers need enough networking detail (BGP, VPN, routing) to triage across hundreds of sites without opening every vendor portal. The page serves both by putting simple status up top and letting detail expand underneath, rather than building two separate pages.
- **Mostly self-contained.** Since device entity pages are now barebones (status + alerts + vendor-portal link only, per the pivot in §1), the Site page has to carry the meaningful health metrics itself. It does not assume a rich device page exists to roll up from.
- **Pure network-metric framing, not business framing.** NR has no visibility into which applications are business-critical for a given customer, so the page reports in networking terms (uplink, latency, loss, tunnel/BGP state) rather than inferring business impact like "can this store take payments."
- **Background polling for every tier, at different cadences.** All metrics poll continuously in the background (not on-demand when a user opens the page), because fleet-wide alerting and summary views need data without a human looking. The lever for minimizing calls is cadence and endpoint choice (§3), not switching to on-demand fetching.
- **Varying site topology.** A site may have one gateway or a redundant pair, one switch or several, a handful of APs or many. Rollup logic must handle counts, not assume a fixed shape per site.
- **Deep links point to our own device pages, not directly to the vendor portal.** When something is too detailed for the Site page, it links to the relevant device's page in this app — which already carries the vendor-portal link — rather than the Site page trying to construct a vendor deep link itself.

## 3. Tiering Model

Every metric below is classified into one of these bands. All tiers are background-polled continuously (see §2) — the tiers differ in cadence and in how much they cost against vendor rate limits, not in whether they're polled at all.

| Tier | Definition | Cadence band |
|---|---|---|
| **Tier 1 — Vital signs** | Drives the site health badge. Small, fixed set, same for every site regardless of topology. | 1–5 min |
| **Tier 2 — Contributing context** | Explains *why* Tier 1 looks the way it does, or flags risk before it becomes an outage. Shown on the page but doesn't drive the top badge. | 10–30 min |
| **Tier 3 — Diagnostic rollup** | Aggregated counts/flags only ("3 ports with errors"), not individual records. | 30–60 min, or event-driven off the existing alert stream instead of a clock |

**Adaptive cadence** applies within Tiers 1–3: a metric polls at its normal band while healthy, and steps up to a faster cadence only while it's in an abnormal state (e.g., a VPN tunnel that's UP polls every 20 min; the moment it goes DEGRADED, it polls every 2 min until it recovers). This buys faster detection without paying the cost fleet-wide, all the time.

## 4. Metric Catalog

### WAN / Uplink

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| Uplink status per circuit (up / down / active-failover) | 1 | 5 min (→1 min adaptive if down or failed-over) | The single most important "is this store online" signal — headline of the site badge. |
| WAN throughput, up/down (Mbps) per circuit, rolled to site total | 1 | 5 min | Answers "is bandwidth the bottleneck" at a glance; cheap counter data. |
| Latency / jitter / packet loss per circuit | 1 | 5 min (→1 min adaptive if loss/jitter crosses threshold) | Defines whether the link is usable, not just alive — packet loss especially predicts POS/card-auth timeouts. |
| Cellular/backup link status + signal strength | 2 | 20 min normal (→5 min adaptive while actively carrying traffic) | Only matters when in use; adaptive cadence earns its keep here. |
| Circuit identity (ISP, contracted tier, connection type) | Not telemetry | Refresh on config change, not clock | Static metadata — pull from inventory/config sync, same pattern as `devices.json`. |

### Application Visibility (site rollup)

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| Top applications by bandwidth, site-rolled | 3 | 30–60 min | Capacity/QoS diagnostic — which apps are consuming the most WAN bandwidth at this site. Mirrors the existing Top Applications doughnut already on the SD-WAN device page, just rolled up across the site's circuits. Every competitor researched (Cato App Analytics, VeloCloud Top Consumers) treats some version of this as standard. |

### VPN Tunnels (site-to-hub/DC/cloud overlay)

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| Tunnel status summary at site ("3/3 up") | 1 | 5 min (→2 min adaptive if any degraded/down) | A VPN outage can isolate a store from HQ/payment-processing apps even when its internet uplink is fine — a distinct failure mode from uplink status, earning its own Tier-1 slot. |
| Per-tunnel latency/jitter/loss | 2 | 15 min | Diagnostic detail once something's known to be degraded, not needed to notice the problem. |
| Per-tunnel bandwidth | 3 | 30–60 min | Capacity-planning-grade detail, not health monitoring. |

### Routing / BGP

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| BGP neighbor state summary at site ("2/2 established") | 2 | 20 min (→5 min adaptive if any peer IDLE) | BGP itself is invisible to a store-ops viewer, but a flap is often a leading indicator of an outage before packet loss/uplink status catch up. |
| Routing redundancy indicator ("2 of 2 paths available") | 2 | 20 min | A cheap derived signal — computed from the uplink/tunnel/BGP status already being polled, not a new call — answering "if the primary path fails, is there a real fallback" without needing the route table. It's a redundancy-depth metric, not a routing-health metric: uplink status (WAN/Uplink table above) already reveals an actual outage; this shows whether "still online" is fragile or solid. |

### VLAN / DHCP Segmentation (site rollup)

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| VLAN inventory (name, ID, purpose per site) | Not telemetry | Refresh on config change | Static config, same pattern as circuit identity. |
| DHCP pool utilization per VLAN, rolled up at site ("Guest: 88/100, POS: 12/64") | 2 | 15–30 min (→5 min adaptive if any VLAN >90%) | Pool exhaustion is a common, segment-specific outage cause (new devices can't get an IP) — a fleet-wide DHCP number would hide exactly the case that matters (is *this* segment at risk). Retail POS/payment traffic is almost always its own VLAN, so this is a clean, network-metric-shaped way to see "is the POS segment healthy" without inferring business impact. |
| Per-VLAN client count | 2 | Same poll as above, no extra cost | Byproduct of the DHCP data; load context per segment. |
| Per-VLAN bandwidth breakdown | 3 | 30–60 min | Capacity-planning detail; mirrors the "Top Applications by VLAN" filter already on the device pages. |

### LAN / Switching (site rollup)

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| Switch health rollup ("4/4 healthy", or "1 offline") | 1 | 5 min | Effectively free — the same per-device health status already computed for the fleet matrix, aggregated at the site level. No new API cost. |
| Hardware redundancy rollup ("1 device with a failed PSU or fan") | 1 (free) | 5 min, same call as the health rollup | A failed PSU is silent without this — same "hidden risk" reasoning as the routing redundancy indicator. Confirmed to ride in the same bulk call as the health rollup for both vendors: Meraki's `devices/statuses` already includes PSU status (`components.powerSupplies[].status`); Mist's `stats/devices` includes both PSU and fan status. **Vendor gap:** Meraki does not expose fan status via its API at all — on Meraki devices this rollup is PSU-only. |
| Memory utilization rollup ("1 device above 80% memory") | 2 | 15 min | Resource exhaustion is a real precursor to a device becoming unresponsive, distinct from the up/down rollups above. Bulk-affordable on both vendors: free on Mist (same `stats/devices` call); a separate but still org-wide bulk endpoint on Meraki (`devices/system/memory/usage/history/byInterval`) — one extra call for the whole org, not per-device. |
| CPU utilization rollup ("1 device above 80% CPU") | 2 | 15 min | Same reasoning as memory. **Scoped by vendor coverage, not uniform:** free and complete on Mist (all device types, same `stats/devices` call). On Meraki, only confirmed bulk-available for access points (a separate wireless-specific endpoint); no confirmed bulk endpoint exists for Meraki switch/gateway CPU, so Meraki switch/gateway CPU is left out of this rollup rather than implying coverage a per-device call would be needed for. |
| PoE budget rollup ("1 switch near capacity") | 3 | 30–60 min | Predicts a future constraint, not a current outage. |
| Port error count rollup ("3 ports with errors site-wide") | 3 | 30–60 min, or event-driven off the existing alert stream | Reuse alerts already generated rather than polling separately for the same signal. |
| Shadow IT / unauthorized device count | 2 | Event-driven | Security-relevant, but inherently an event ("new device detected"), not something needing periodic re-checking. |

### Wireless (site rollup)

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| AP health rollup ("6/6 healthy") | 1 | 5 min | Same free-rollup logic as switches. |
| Active client count, aggregated across site | 2 | 15 min | A load/usage indicator (staff + guest + POS devices) — useful context, but a busy store isn't itself a problem. |
| Time-to-Connect breakdown (Association/Auth/DHCP/DNS phases), aggregated at site | 2 | 15 min | Explains *where* wireless onboarding friction happens — not new data collection, it's the same onboarding-phase data behind the fleet page's existing User Frustration Leaderboard, scoped to one site. |
| Channel interference rollup ("2 APs with high interference") | 3 | 30–60 min, or event-driven | Leading indicator, not urgent. |
| Rogue AP / wireless threat count | 2 | Event-driven | Security signal, same event-driven pattern as shadow IT. |

### Security / Config Compliance

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| Firmware version compliance (site has N devices behind target version) | 3 | Daily | Changes rarely; a compliance view, not a health signal. |
| Config drift flag (device config differs from intended baseline) | 3 | Daily, or event-driven off vendor change webhooks if available | Rare-changing — better as a change-triggered flag than a poll. |

### Site Identity & Device Inventory

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| Site identity/topology header (device counts by type, WAN circuit types, region) | Not telemetry | Refresh on config change / inventory sync | Static metadata — the header card, not something polled on a clock. |
| **Device inventory table** — one row per device (Name, Type, Vendor, Model, Status, IP, Firmware, Uptime), clickable into the device's page | 1 (free) | Reuses Tier 1 status/uptime already polled; identity columns sync on config change | This is the missing link between the rollup badges and the individual device pages: if a rollup ever shows "5/6 healthy," a viewer needs somewhere to see *which* device that is before jumping to its full page. Every column shown is either already-polled or config-synced — this is a presentation-layer addition, not a new data source. |

### Alerts

| Metric | Tier | Cadence | Why |
|---|---|---|---|
| Site-scoped alert feed (filter the existing fleet alert stream by site) | 1 (zero extra cost) | N/A — a filter, not a new poll | Already generated for the fleet page; scoping to one site is a query, not a new vendor API call. Arguably the most important thing on the page, and it costs nothing additional. |

