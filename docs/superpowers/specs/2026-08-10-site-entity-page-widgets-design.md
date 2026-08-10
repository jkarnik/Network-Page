# Site Entity Page — Widget & Data Design

> Ideation output. Defines which widgets appear on the future Site entity page, how they're organized, and — critically — which are actually buildable within the vendor rate-limit constraint that forced the original pivot away from deep per-device telemetry. Input: `2026-08-07-site-entity-page-metrics-research.md`. Output of this doc feeds a future implementation-planning session; no code or mock data is produced here.

## Table of Contents

- [1. Purpose & Scope](#1-purpose--scope)
- [2. Design Principles](#2-design-principles)
- [3. Feasibility Taxonomy](#3-feasibility-taxonomy)
- [4. Page Architecture](#4-page-architecture)
- [5. Widget Catalog](#5-widget-catalog)
- [6. Phasing Plan](#6-phasing-plan)
- [7. Open Issues](#7-open-issues)

---

## 1. Purpose & Scope

The prior research doc (`2026-08-07-...-research.md`) catalogued the metrics a Site entity page could show, organized into a three-tier polling model, and made a first pass at which vendor bulk endpoints could supply each one without polling individual devices.

This doc does two things the prior one didn't:

1. **Verifies every rollup against the actual Meraki and Mist API schemas** (Postman collections in `Code/API Docs/`), not just the ones that were spot-checked before. That audit found real gaps the original catalog didn't know about — Meraki has no live BGP session state at any call level, DHCP pool utilization is device-level-only on Meraki and doesn't exist at all on Mist's REST API, and several "org-wide" Meraki endpoints are undercut by small pagination caps (20 items/page) that make them costlier than they look.
2. **Organizes the surviving (and flagged) metrics into actual page widgets** — layout, grouping, and what each widget shows — so this doc can feed directly into an implementation plan.

Nothing is dropped outright. Per direction from this session: metrics with no viable bulk data path are kept in the catalog and tagged with their blocker, not deleted — because a device-level-only metric today might become viable via a future push/websocket integration, and because losing institutional memory of "we looked at this and here's why it's hard" is worse than an unbuilt row in a table.

This is a research/ideation deliverable — it intentionally stops short of code and mock data. That's the next session's work.

## 2. Design Principles

Carried over from the prior research doc (still true, unchanged):

- **Audience: both personas, progressive disclosure.** Store-level/regional IT staff need a plain "is my store okay" signal; central NOC/network engineers need enough detail to triage across hundreds of sites without opening every vendor portal.
- **Mostly self-contained.** Device entity pages are barebones (status + alerts + vendor-portal link) — the Site page carries the meaningful health metrics itself.
- **Pure network-metric framing, not business framing.** Reports in networking terms, not inferred business impact.
- **Background polling for every tier, at different cadences.** The lever for minimizing calls is cadence and endpoint choice, not switching to on-demand fetching.
- **Varying site topology.** Rollup logic handles counts, not a fixed device shape per site.
- **Deep links point to our own device pages**, not directly to the vendor portal.

New for this doc, established through this session's API audit:

- **Bulk-safety is verified per metric per vendor, not assumed.** "Org-wide" and "cheap" are not synonyms — an org-wide endpoint with a 20-item page cap can still mean hundreds of calls per cycle at fleet scale. Every widget below states its actual verified cost, not an inferred one.
- **Vendor asymmetry is normal, not a bug to design away.** Meraki and Mist expose materially different bulk surfaces (e.g., Mist has org-wide BGP/tunnel/port telemetry via `stats/*/search` that Meraki simply doesn't have; Meraki has org-wide PSU/memory data that requires no equivalent per-device call on Mist for the same field). Widgets should degrade per-vendor rather than being designed only against whichever vendor is more capable.
- **Site-level (one call per site) is an acceptable cost for a metric deemed critical enough to justify it — device-level (one call per device) is not, ever, at fleet scale.** This is the line this session drew: hundreds-to-thousands of sites times a slow cadence is tractable; thousands of devices times any cadence recreates the exact problem that caused the original pivot.

## 3. Feasibility Taxonomy

Every metric in the catalog (§5) carries one of these tags, determined by the Meraki/Mist API audit performed in this session:

| Tag | Meaning | Cost model |
|---|---|---|
| 🟢 **BULK-SAFE** | A single org-wide (or fleet-wide) bulk call, with a pagination cap that stays cheap even at thousands of devices, returns this metric with per-device/per-circuit identity. | O(1) to low-O(pages) calls per polling cycle, independent of site count. |
| 🟡 **SITE-LEVEL** | No org-wide bulk alternative exists on this vendor; getting this metric for every site requires one call per site. | O(sites) calls per cycle. Acceptable only for metrics judged important enough to justify it, with cadence tuned down accordingly (see §6). |
| 🟠 **VENDOR-PARTIAL** | Bulk-safe (or site-level) on one vendor, missing or materially weaker on the other. | Varies by vendor; widget must degrade gracefully per-vendor rather than assume parity. |
| 🔴 **DEVICE-LEVEL (unfeasible)** | The only path to this data is one call per device. | O(devices) calls per cycle — reproduces the exact problem that caused the original pivot. Not built under the current constraint; flagged as an open issue. |
| 🔵 **PUSH-CANDIDATE** | No viable REST poll path was found, but a webhook/websocket channel might supply it without polling at all. | Zero incremental REST cost if the push integration covers it — but unconfirmed until that integration is built. |
| ⚪ **CONFIG-SYNC** | Static metadata, not telemetry — refreshed on config change, not polled on a clock. Still costs 1 call/site if no bulk config endpoint exists, but at a very low, event-driven frequency. | O(sites) per config-sync run, not per health-poll cycle. |
| ⚫ **NO DATA SOURCE** | Confirmed absent from both vendors' APIs entirely — not a cost problem, a "the data doesn't exist" problem. | N/A. Flagged as an open issue (§7), not built. |

Every row in §5 states its tag per vendor where they differ.

## 4. Page Architecture

The page is organized into six zones, top to bottom, matching the progressive-disclosure principle: a store-ops viewer reads zone 1 and stops; a NOC engineer expands into zones 4-5 for a specific problem.

1. **Site identity header** (⚪ CONFIG-SYNC) — name, region, device counts by type, WAN circuit types. Static metadata card, not polled on a health clock.
2. **Site health badge** — the Tier-1 "is my store okay" strip: uplink status, WAN throughput/latency, VPN tunnel summary, switch/AP health rollups, hardware redundancy rollup. Everything in this zone is 🟢 BULK-SAFE on both vendors (§5.1, §5.3, §5.5) — this zone's cost is the cheapest in the whole page, by design, because it's also the zone every site pays for every cycle regardless of whether anyone's looking.
3. **Needs Attention panel** — a cross-cutting list, populated from data already fetched for zones 2 and 5 (no new calls), naming the specific devices/circuits/VLANs currently in an abnormal state — "Memory >80%: SW-04", "PSU failed: GW-02", "Tunnel down: HQ-Primary". Empty/collapsed when the site is fully healthy; this is the direct answer to "which devices are the problem," in one place, regardless of which domain section it came from.
4. **Domain detail sections** (collapsed by default, one per network domain) — WAN/Uplink, VPN Tunnels, Routing/BGP, LAN/Switching, VLAN/DHCP Segmentation, Wireless, Application Visibility. Each holds that domain's Tier-2/3 metrics per §5.
5. **Device inventory table** — one row per device, reusing already-polled status/uptime (🟢 free), clickable into the device's own page.
6. **Site-scoped alert feed** — a filter over the existing fleet alert stream (🟢 zero extra cost — not a new poll, a query).

Widget shape (chart type, table vs. badge) is intentionally left to the implementation session — this doc fixes *what data* and *where*, not final visual treatment (that's `dataviz` skill territory once this becomes a build).

## 5. Widget Catalog

### 5.1 WAN / Uplink — zone 2 (badge) + zone 4 (detail)

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| Uplink status per circuit (up/down/failover) | 1, 5min→1min adaptive | 🟢 BULK-SAFE — org `uplinks/statuses`, perPage 1000 (5 calls/5,000 devices) | 🟢 BULK-SAFE — org `stats/ports/search`, `port_usage=wan` | Headline of the site badge, both vendors cheap. |
| WAN throughput up/down per circuit, rolled to site | 1, 5min | 🟢 BULK-SAFE — org `appliance/uplinks/usage/byNetwork`, unpaginated (single response; watch response size at very large org counts) | 🟢 BULK-SAFE — same `ports/search` call as above, `tx_bps`/`rx_bps` fields | Roll to site total by summing client-side. |
| Latency / packet loss per circuit | 1, 5min→1min adaptive | 🟢 BULK-SAFE (loss %, latency ms) — org `devices/uplinksLossAndLatency` | 🟢 BULK-SAFE — same `ports/search` call, `latency`/`loss` fields | **Jitter dropped from this metric for both vendors**: confirmed absent from Meraki's WAN-circuit API entirely (only exists for VPN-tunnel and wireless-client stats); Mist's `ports/search` has a `jitter` field but it wasn't populated in the example response — treat as unconfirmed, don't build a UI column around it yet. |
| Cellular/backup link status + signal strength | 2, 20min normal → 5min adaptive while carrying traffic | 🟢 BULK-SAFE, full — status + `signalStat.rsrp/rsrq` in the same org `uplinks/statuses` call | 🟠 VENDOR-PARTIAL — status is bulk-safe (`ports/search` `active`/`up`); native gateway/SSR signal strength has no confirmed field anywhere in the API. Only 3rd-party cellular modems (e.g. Cradlepoint) expose signal, and only per-device (🔴). | Show numeric signal strength on Meraki cellular gateways; on Mist, show status only and omit/gray out signal strength rather than fabricate a number. |
| Circuit identity (ISP, tier, connection type) | ⚪ CONFIG-SYNC | n/a | n/a | Static metadata, same pattern as `devices.json` today — pull from inventory/config sync, not a health poll. |

### 5.2 Application Visibility — zone 4 (detail, collapsed)

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| Top applications by bandwidth, site-rolled | 3, 30–60min | 🟡 SITE-LEVEL — org endpoint `summary/top/applications/byUsage` exists but has **no per-network breakdown**; getting "top apps for this site" means calling it once per `networkId` filter. | 🟡 SITE-LEVEL — `sites/:site_id/insights/{metric}` with `top-app-by-bytes`; site-scoped only. (Note: Mist's `countSiteApplications` looks like a fit but returns session *counts*, not bytes — don't wire that up expecting bandwidth.) | This is the costliest Tier-3 widget: unlike the hardware/memory/CPU rollups, there is no bulk shortcut on *either* vendor — it's a genuine one-call-per-site cost. The 30-60min cadence is what makes that tolerable; don't promote this to a faster tier without re-checking the math at your actual site count. |

### 5.3 VPN Tunnels — zone 2 (badge) + zone 4 (detail)

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| Tunnel status summary at site ("3/3 up") | 1, 5min→2min adaptive | 🟢 BULK-SAFE, capped — org `appliance/vpn/statuses`, perPage max 300 (≈17 calls/5,000 sites) | 🟢 BULK-SAFE — org `stats/tunnels/search`, `type=wan` | Meraki's cap is 3x costlier than its 1000-cap endpoints but still fine at a 5min cadence. |
| Per-tunnel latency/jitter/loss | 2, 15min | 🟢 BULK-SAFE, full — same org `appliance/vpn/stats` call as bandwidth below, includes latency + jitter + loss per peer | 🟠 VENDOR-PARTIAL — org `stats/vpn_peers/search` has latency + MOS (SSR/128T paths only); **no jitter or loss field at the per-tunnel level** — those only exist at the raw WAN-port level (§5.1), which can't be attributed to one tunnel if a port carries several. | Show latency universally; show jitter+loss as a Meraki-only enhancement, not a universal column. |
| Per-tunnel bandwidth | 3, 30–60min | 🟢 BULK-SAFE — same `appliance/vpn/stats` call | 🟢 BULK-SAFE — org `stats/tunnels/search`, `rx_bytes`/`tx_bytes` | Rides along with the status/latency call on both vendors — no extra cost. |

### 5.4 Routing / BGP — zone 4 (detail)

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| BGP neighbor state summary ("2/2 established") | 2, 20min normal → 5min adaptive if any peer IDLE (Mist sites only) | ⚫ **NO DATA SOURCE for live state** — `networks/:networkId/appliance/vpn/bgp` is a site-level call (confirmed, not device-level), but its response is configuration only (`asNumber`, `neighbors[].ip/remoteAsNumber/authentication/...`) with no status field anywhere, and no separate status endpoint exists for Meraki at any level. | 🟢 BULK-SAFE — org `stats/bgp_peers/search` returns per-neighbor `state`, aggregable by `site_id` in one org-wide call. | **Resolved handling**: widget appears on every site page. Mist sites show live "N/M established." Meraki sites show "not available — vendor API does not expose live BGP session state" instead of a blank or fake value. This is a genuine vendor capability gap, not a cost problem — no amount of polling budget fixes it. |
| Routing redundancy indicator ("2 of 2 paths available") | 2, 20min | 🟢 free — derived client-side from uplink + tunnel status already polled | 🟢 free — derived from uplink + tunnel + BGP status already polled | On Meraki-only sites this indicator can only draw on uplink+tunnel state (BGP is unavailable there per above), so it will read slightly shallower than on Mist sites for the same physical redundancy — that's an accurate reflection of what's knowable per vendor, not a bug to fix. |

### 5.5 VLAN / DHCP Segmentation — zone 4 (detail)

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| VLAN inventory (name, ID, purpose per site) | ⚪ CONFIG-SYNC | 🟡 SITE-LEVEL — `networks/:networkId/appliance/vlans`; no org-wide VLAN listing exists anywhere in the API. | 🟡 SITE-LEVEL — `sites/:site_id/networks/derived` (resolved) or org `networks` catalog (template). | Both need one call per site regardless of cadence — the config-change trigger keeps frequency low, but it's still O(sites) per sync, not free. **Mist field shape unconfirmed** — both candidate endpoints had zero example responses in the collection; verify actual fields before building. |
| DHCP pool utilization per VLAN ("Guest: 88/100") | 2 (target), currently blocked | 🔴 **DEVICE-LEVEL (unfeasible)** — the live data (`usedCount`/`freeCount` keyed by `vlanId`) genuinely exists, but only via `devices/:serial/appliance/dhcp/subnets`, one call per gateway. Every other DHCP endpoint on Meraki (server policy, ARP inspection, cellular DHCP) is configuration, not utilization. | ⚫ **NO DATA SOURCE via REST** — no DHCP server stat field exists anywhere in the Mist API (`dhcpd_stat` has zero occurrences in the collection). 🔵 **PUSH-CANDIDATE** — the org's planned Mist websocket integration (device-event push, or the per-device `show_dhcp_leases` streamed channel) may be able to reconstruct utilization from raw lease events, but this wasn't confirmed from the Postman collection and needs sign-off from whoever owns that integration. | **Kept per direction, not cut.** Do not build the Meraki per-device polling path — it reproduces the exact problem the original pivot fixed. Revisit once the Mist websocket integration lands and its event shape is confirmed; Meraki side remains an open issue with no fix under the current constraint (see §7). |
| Per-VLAN client count | 3 (downgraded from original Tier 2) | 🟡 SITE-LEVEL — no dedicated per-VLAN rollup endpoint exists (`byVlan` returns zero hits); pull the full per-network client list (perPage max 5,000, so one page covers a typical site) and group by `vlan` client-side. | 🟡 SITE-LEVEL for site-scoped counts — an org-wide `clients/count?distinct=vlan` exists, but it has no per-site breakdown, so isolating one site's numbers still needs a site-level call. | The original research doc treated this as a free byproduct of the DHCP data above — since that's now blocked (row above), this metric needs its own justification and its own (slower) cadence rather than riding along for free. |
| Per-VLAN bandwidth breakdown | 3, 30–60min | 🟡 SITE-LEVEL — same per-network client list, `usage.sent`/`usage.recv` per client | 🟡 SITE-LEVEL — site `stats/clients`, `vlan_id` + `tx_bytes`/`rx_bytes` per client | No vendor gives an org-wide bulk answer; already the slowest cadence tier, which is what makes this tolerable. |

### 5.6 LAN / Switching — zone 2 (badge, free items) + zone 3 (Attention panel) + zone 4 (detail)

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| Switch health rollup ("4/4 healthy") | 1, 5min, free | 🟢 same call as device status | 🟢 same call as device status | Unchanged from prior research doc. |
| Hardware redundancy rollup (PSU/fan) | 1, 5min, free | 🟠 PSU-only — confirmed via exhaustive grep that **no fan-status field or endpoint exists anywhere in the Meraki API** | 🟢 both — `module_stat[].fans[]` and `.psus[]` in the same bulk `stats/devices` call | Vendor gap carried over from the original research doc, now independently reconfirmed. |
| Memory utilization rollup ("1 device >80%") | 2, 15min | 🟢 BULK-SAFE but capped — org `devices/system/memory/usage/history/byInterval`, perPage max **20** (≈250 calls/cycle for 5,000 devices) | 🟢 BULK-SAFE, free — rides the same `stats/devices` call as everything else | Meraki's 250 calls/15min (~17/min sustained) is likely fine against typical org rate limits, but hasn't been checked against this org's actual measured quota — flag as a pre-launch verification item, not a blocker. |
| CPU utilization rollup ("1 device >80%") | 2, 15min | 🟠 **Confirmed absent for switches/gateways** — bulk CPU exists only for wireless APs (`wireless/devices/system/cpu/load/history`, same 20-item page cap as memory); no endpoint of any kind (bulk or per-device) was found for MS/MX CPU in this API | 🟢 BULK-SAFE, free, all device types — same `stats/devices` call | Upgraded from the original doc's "no *confirmed bulk* endpoint" hedge to a confirmed full absence for Meraki switch/gateway CPU — there's no per-device fallback either, this data simply isn't exposed. |
| PoE budget/utilization rollup ("1 switch near capacity") | 3, 30–60min | 🟠 org `switch/ports/statuses/bySwitch` gives only a boolean `isAllocated` + an "overload" warning string — no numeric wattage. Real wattage (`powerUsageInWh`) is 🔴 **DEVICE-LEVEL (unfeasible)**. | 🟢 BULK-SAFE, full numeric — `module_stat[].poe.{max_power, power_draw}` in the same `stats/devices` call, zero extra cost | **Resolved handling**: Mist switches get a real numeric utilization gauge; Meraki switches get the free boolean "overload" flag only — the numeric version is tagged unfeasible and not built, not silently faked. |
| Port error count rollup ("3 ports with errors") | 3, 30–60min, or event-driven off alerts | 🟢 BULK-SAFE but capped — org `switch/ports/statuses/bySwitch`, perPage max **20** (≈250 calls/cycle for 5,000 switches) | 🟢 BULK-SAFE, free — rides the same `ports/search` call as uplink status | Original doc's preferred approach (reuse the existing alert stream, event-driven) sidesteps Meraki's pagination cost entirely — keep that as primary, direct poll as fallback only. |
| Shadow IT / unauthorized device count | 2 (target), currently blocked | ⚫ **NO DATA SOURCE** — no concept of "unauthorized device" exists anywhere in the API (confirmed, zero hits) | ⚫ **NO DATA SOURCE for this concept** — the only org-wide adjacent endpoint (`stats/discovered_assets`) covers unmatched BLE beacons only, a much narrower thing than "unauthorized device on the network"; general rogue-device detection is site-level-only and is really the same metric as Rogue AP (§5.7), not a distinct one | **Kept, flagged as an open issue (§7)** — no known data source on either vendor for this concept as originally specified. Not built until either a new data source appears or the requirement is redefined around what Air Marshal/rogue-AP detection actually provides. |

### 5.7 Wireless — zone 2 (badge, free items) + zone 4 (detail)

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| AP health rollup ("6/6 healthy") | 1, 5min, free | 🟢 same call as device status | 🟢 same call as device status | Unchanged from prior research doc. |
| Active client count, aggregated across site | 2, 15min | 🟢 BULK-SAFE — org `wireless/clients/overview/byDevice`, perPage max 1000 (5 calls/5,000 APs), sum grouped by network | 🟢 BULK-SAFE, cheapest option found in this whole audit — org `stats/sites` returns `num_clients` **per site, for all sites, in a single call** | Mist's combined figure is wired+wireless together, not wireless-only; if a pure wireless-only count is required, the Mist fallback (`countSiteWirelessClients`) is SITE-LEVEL. |
| Time-to-Connect breakdown (Assoc/Auth/DHCP/DNS) at site | 2, 15min | 🟡 SITE-LEVEL — `networks/:networkId/wireless/connectionStats`, pre-aggregated per network, no org-wide variant found | 🟡 SITE-LEVEL for phase detail — `sites/:site_id/sle/.../metric/time-to-connect/summary`; an org-wide `insights/sites-sle` exists but only returns one composite score per site, not the phase breakdown | **Cost-model caveat worth calling out explicitly**: opening *one* site's page and fetching this for *that* site is cheap (1 call) regardless of tag — the O(sites) cost only shows up if this is background-polled for *every* site continuously to keep a fleet-wide view (like the existing Top-5 leaderboard) fresh. Several other SITE-LEVEL metrics in this catalog share that same distinction; see §7 for the general note. |
| Channel interference rollup ("2 APs with high interference") | 3, 30–60min | 🟢 BULK-SAFE, best case found in this audit — org `wireless/devices/channelUtilization/byNetwork` returns the metric **already pre-rolled up per network** in one org-wide call | 🟡 SITE-LEVEL — `sites/:site_id/rrm/current`; the org-wide catalog metric (`band24-util`/`band5-util`) is scoped to individual APs only, no site-level rollup | Rare case where Meraki is cheaper than Mist — tag as VENDOR-PARTIAL in the reverse direction from most other rows in this catalog. |
| Rogue AP / wireless threat count (Air Marshal / WIDS) | 2, event-driven preferred | 🟡 SITE-LEVEL for live detections — `networks/:networkId/wireless/airMarshal`; org-wide endpoints exist only for rule/policy *configuration*, not detections | 🟡 SITE-LEVEL — `sites/:site_id/insights/rogues` + `rogues/events/count`; no org-wide monitor endpoint on either vendor | Keep the original doc's event-driven design (fed by the existing alert/webhook pipeline) as primary — that's effectively free. Only fall back to direct REST polling of the endpoints above if the event pipeline doesn't cover this case, and if so, budget it as SITE-LEVEL, not free. |

### 5.8 Site Identity & Device Inventory — zone 1 (header) + zone 5 (table)

Unchanged from the prior research doc — both items are 🟢 free, reusing data already polled or config-synced elsewhere on the page. No new API surface needed; carried forward as-is.

### 5.9 Alerts — zone 6

Unchanged — 🟢 zero extra cost, a filter over the existing fleet alert stream rather than a new poll. Arguably still the most valuable zone on the page for the least cost.

## 6. Phasing Plan

Ordered by feasibility tag and cost, not by network domain — every phase is buildable end-to-end (a real page a user can look at), each just covers less of the catalog than the next.

**Phase 1 — vital signs, all 🟢 BULK-SAFE.** Site identity header, health badge (uplink status/throughput/loss, VPN tunnel status, switch/AP health, hardware redundancy), device inventory table, alert feed, and the Attention panel skeleton (populated purely from Phase-1 data at this point). Every metric in this phase is cheap on both vendors with no caveats — this is the zero-risk slice and should ship first.

**Phase 2 — confirmed-viable context (🟢 with caveats, and resolved 🟠/VENDOR-PARTIAL items).** VPN per-tunnel detail, memory/CPU rollups (with the pagination-cap watch-item noted in §5.6 tracked, not blocking), cellular signal (Meraki full, Mist status-only), BGP (Mist live, Meraki shown as unavailable), PoE (Mist numeric, Meraki flag-only), active client count. This phase introduces the first vendor-conditional widgets — the Attention panel and domain sections both need to handle "not available for this vendor" as a first-class state, not an edge case.

**Phase 3 — accepted 🟡 SITE-LEVEL costs.** Top Applications, per-VLAN client count/bandwidth, VLAN inventory, Time-to-Connect breakdown, channel interference, Rogue AP count. Each of these costs one call per site with no bulk alternative on either vendor — acceptable per this session's policy, but only once Phase 1-2 have validated actual measured API usage against the org's real rate limits, since this phase is where that budget gets spent fastest at fleet scale.

**Not phased — blocked, tracked in §7.** DHCP pool utilization and Shadow IT / unauthorized device count. Neither has a viable data path today; they stay in the catalog so the reasoning isn't lost, but neither should be scheduled into an implementation plan until its blocker is resolved.

## 7. Open Issues

Carried forward for the implementation session and for whoever owns the vendor integrations:

1. **DHCP pool utilization has no viable path today.** Meraki's data exists but is device-level-only (🔴). Mist has no REST DHCP stat at all; the org's planned Mist websocket integration is a plausible path (🔵) but its event shape wasn't confirmed against this Postman collection — needs direct confirmation from whoever owns that integration before this can move to Phase 2/3. Meraki side has no known fix under the current constraint regardless of the Mist outcome.
2. **Shadow IT / unauthorized device count has no data source on either vendor** as originally specified. The closest adjacent capability (Air Marshal / rogue-AP detection, §5.7) is a different, narrower concept. Either accept that narrower framing under a renamed widget, or leave this unbuilt.
3. **BGP live state cannot be shown for Meraki sites at any cost** — confirmed absent from the API entirely, not just uncached or unpaginated. This is permanent unless Meraki adds the capability; it isn't something an implementation session can work around.
4. **Meraki CPU utilization has no data source at all for switches/gateways** (not merely "no bulk endpoint" — no per-device endpoint either). Wireless APs are the only Meraki product type with any CPU telemetry.
5. **Pagination-cap watch items**: Meraki's memory-usage-history, CPU-load-history, and switch-ports-by-switch endpoints all cap at 20 items/page, meaning ~250 calls/cycle for a 5,000-device org even though they're technically org-wide. This should be checked against the org's actual measured rate-limit headroom before Phase 2 ships, not assumed safe from this doc alone.
6. **Two Mist endpoints have unconfirmed response shapes**: VLAN inventory (`networks/derived` and the org `networks` catalog both had zero example responses in the collection) and WAN-circuit jitter (`ports/search` has a `jitter` field but it wasn't populated in the example). Verify both against a live Mist org before building on them.
7. **The SITE-LEVEL cost model has two different meanings depending on where a metric is consumed.** Fetching a SITE-LEVEL metric for the one site a user has open is always cheap (1 call). The O(sites) cost only materializes when a metric is background-polled for *every* site continuously — which is required for this metric to feed fleet-wide views (the Attention panel rolled up to the index page, cross-site alerting, the existing Top-5 leaderboards). Phase 3's SITE-LEVEL items should be evaluated against that continuous-fleet-polling cost, not the cost of one person looking at one site page.
