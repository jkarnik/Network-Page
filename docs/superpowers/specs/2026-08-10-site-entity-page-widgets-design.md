# Site Entity Page — Widget & Data Design

> Ideation output. Defines which widgets appear on the future Site entity page, how they're organized, and — critically — which are actually buildable within the vendor rate-limit constraint that forced the original pivot away from deep per-device telemetry. Input: `2026-08-07-site-entity-page-metrics-research.md`. Output of this doc feeds a future implementation-planning session; no code or mock data is produced here.

## Table of Contents

- [1. Purpose & Scope](#1-purpose--scope)
- [2. Design Principles](#2-design-principles)
- [3. Feasibility Taxonomy](#3-feasibility-taxonomy)
- [4. Page Architecture](#4-page-architecture)
- [5. Widget Catalog](#5-widget-catalog)
- [6. Rejected / Merged Items](#6-rejected--merged-items)
- [7. Site vs. Org-Level Placement](#7-site-vs-org-level-placement)
- [8. Rollout Staging](#8-rollout-staging)
- [9. Open Issues](#9-open-issues)

**A note on numbering**: "Tier" (1/2/3, from §2) and the rollout stages in §8 (A/B/C) both order things, but along different axes — Tier is a *polling cadence band* (how often a metric refreshes once built), Stage is a *build/ship order* (which slice ships first). A Tier-1 metric and a Stage-A metric usually overlap but aren't the same concept — this doc uses letters for stages specifically so the two are never confused for each other again.

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
| 🟡 **SITE-LEVEL** | No org-wide bulk alternative exists on this vendor; getting this metric for every site requires one call per site. | O(sites) calls per cycle. Acceptable only for metrics judged important enough to justify it, with cadence tuned down accordingly (see §8). |
| 🟠 **VENDOR-PARTIAL** | Bulk-safe (or site-level) on one vendor, missing or materially weaker on the other. | Varies by vendor; widget must degrade gracefully per-vendor rather than assume parity. |
| 🔴 **DEVICE-LEVEL (unfeasible)** | The only path to this data is one call per device. | O(devices) calls per cycle — reproduces the exact problem that caused the original pivot. Not built under the current constraint; flagged as an open issue. |
| 🔵 **PUSH-CANDIDATE** | No viable REST poll path was found, but a webhook/websocket channel might supply it without polling at all. | Zero incremental REST cost if the push integration covers it — but unconfirmed until that integration is built. |
| ⚪ **CONFIG-SYNC** | Static metadata, not telemetry — refreshed on config change, not polled on a clock. Still costs 1 call/site if no bulk config endpoint exists, but at a very low, event-driven frequency. | O(sites) per config-sync run, not per health-poll cycle. |
| ⚫ **NO DATA SOURCE** | Confirmed absent from both vendors' APIs entirely — not a cost problem, a "the data doesn't exist" problem. | N/A. Flagged as an open issue (§9), not built. |

Every row in §5 states its tag per vendor where they differ.

## 4. Page Architecture

The page is organized into six zones, top to bottom, matching the progressive-disclosure principle: a store-ops viewer reads zone 1 and stops; a NOC engineer expands into zones 4-5 for a specific problem.

1. **Site identity header** (⚪ CONFIG-SYNC) — name, region, device counts by type, WAN circuit types. Static metadata card, not polled on a health clock.
2. **Site health badge** — the Tier-1 "is my store okay" strip: uplink status, WAN throughput/latency, VPN tunnel summary, switch/AP health rollups, hardware (PSU) redundancy rollup. Everything in this zone is 🟢 BULK-SAFE on both vendors (§5.1, §5.3, §5.5) — this zone's cost is the cheapest in the whole page, by design, because it's also the zone every site pays for every cycle regardless of whether anyone's looking. Note: "health" here is not strictly binary — Meraki's device status has four values (`online`/`alerting`/`offline`/`dormant`), so a rollup reads as "4 online, 1 alerting, 1 offline" rather than a simple up/down count; the badge should surface "alerting" distinctly since it means the device is reachable but has an active issue, not the same as fully down.
3. **Needs Attention panel** — a cross-cutting list, populated from data already fetched for zones 2 and 5 plus the event-driven feeds in zone 4 (no new calls), naming the specific devices/circuits currently in an abnormal state — "PSU failed: GW-02", "Tunnel down: HQ-Primary", "BGP flap detected 12m ago: HQ-Primary (Mist sites only)". Empty/collapsed when the site is fully healthy; this is the direct answer to "which devices are the problem," in one place, regardless of which domain section it came from.
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
| Per-tunnel latency/jitter/loss | 2, 15min | 🟢 BULK-SAFE, full — same org `appliance/vpn/stats` call as bandwidth below, includes latency + jitter + loss per peer | 🟠 VENDOR-PARTIAL — org `stats/vpn_peers/search` has latency + MOS (SSR/128T paths only); **no jitter or loss field at the per-tunnel level** — those only exist at the raw WAN-port level (§5.1), which can't be attributed to one tunnel if a port carries several. | Show latency universally; show jitter+loss as a Meraki-only enhancement, not a universal column. Meraki also supports these as a threshold-based **alert-profile condition** (`jitter_ms`/`loss_ratio`/`latency_ms`/`mos` in `createOrganizationAlertsProfile`) — an event-driven path to the same data exists alongside the polled one, worth using for the Attention panel instead of waiting for the next 15min poll. |
| Per-tunnel bandwidth | 3, 30–60min | 🟢 BULK-SAFE — same `appliance/vpn/stats` call | 🟢 BULK-SAFE — org `stats/tunnels/search`, `rx_bytes`/`tx_bytes` | Rides along with the status/latency call on both vendors — no extra cost. |

### 5.4 Routing / BGP — zone 3 (Attention panel) + zone 4 (detail)

Redesigned this session from a polled "N/M established" status tile into an **event-driven BGP Flap Detector** — a better fit for what BGP monitoring is actually for (catching instability, not displaying a steady-state number) and, on Mist, genuinely free.

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| BGP flap detector — count of flap events in a filterable time window (e.g. "3 flaps in last 2h") | 2, event-driven (no clock) | ⚫ **NO DATA SOURCE, at any granularity, event-driven or polled** — confirmed no BGP-related entry exists anywhere in Meraki's alert-type/alert-profile system (the only alert-profile condition fields found — `jitter_ms`/`loss_ratio`/`latency_ms`/`mos`/`bit_rate_bps`, §5.3 — are VPN/uplink-shaped, not BGP). Reframing as event-driven doesn't help here; there's no event to subscribe to. | 🔵 **PUSH-CANDIDATE, confirmed plausible** — org/site settings (`updateOrgSettings`/`updateSiteSettings`) expose a `bgp_neighbor_updown_threshold` field described as "enable threshold-based bgp neighbor down delivery," which feeds the existing org-wide `alarms` webhook topic. This is exactly the up/down transition signal a flap detector needs, at zero incremental polling cost. Exact webhook payload shape (previous/current neighbor state, timestamp) wasn't inspected in this pass — confirm before building. | **Resolved handling**: build for Mist sites once the `alarms` webhook payload is confirmed. Meraki sites show "not available — vendor has no BGP monitoring signal of any kind," same as the prior design's conclusion, just now framed around events instead of a poll. |
| Last-flap detail — timestamp of most recent flap + previous/current neighbor state | 2, event-driven | ⚫ Same gap as above — no data at all. | 🔵 Same webhook, same caveat — this is the per-event payload the count widget above aggregates; if the payload includes previous/current state (typical for an up/down alarm), this comes for free alongside the count widget, not as a separate cost. | One data source serves both widgets on Mist; neither is buildable on Meraki. |
| Routing redundancy indicator ("2 of 2 paths available") | 2, 20min | 🟢 free — derived client-side from uplink + tunnel status already polled | 🟢 free — derived from uplink + tunnel status already polled (no longer factors in BGP state, since BGP is now event-driven rather than a polled status this indicator can read alongside the others) | Unchanged in spirit from the prior design — still a zero-cost derived signal, just no longer double-counts BGP into "redundancy depth" now that BGP moved to its own event-driven widget above. |

### 5.5 VLAN / DHCP Segmentation — zone 4 (detail)

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| VLAN inventory (name, ID, purpose per site) | ⚪ CONFIG-SYNC | 🟡 SITE-LEVEL — `networks/:networkId/appliance/vlans`; no org-wide VLAN listing exists anywhere in the API. | 🟡 SITE-LEVEL — `sites/:site_id/networks/derived` (resolved) or org `networks` catalog (template). | Both need one call per site regardless of cadence — the config-change trigger keeps frequency low, but it's still O(sites) per sync, not free. **Mist field shape unconfirmed** — both candidate endpoints had zero example responses in the collection; verify actual fields before building. |
| DHCP pool utilization per VLAN ("Guest: 88/100") | 2 (target), currently blocked | 🔴 **DEVICE-LEVEL (unfeasible)** — the live data (`usedCount`/`freeCount` keyed by `vlanId`) genuinely exists, but only via `devices/:serial/appliance/dhcp/subnets`, one call per gateway. Every other DHCP endpoint on Meraki (server policy, ARP inspection, cellular DHCP) is configuration, not utilization. | ⚫ **NO DATA SOURCE via REST** — no DHCP server stat field exists anywhere in the Mist API (`dhcpd_stat` has zero occurrences in the collection). 🔵 **PUSH-CANDIDATE** — the org's planned Mist websocket integration (device-event push, or the per-device `show_dhcp_leases` streamed channel) may be able to reconstruct utilization from raw lease events, but this wasn't confirmed from the Postman collection and needs sign-off from whoever owns that integration. | **Kept per direction, not cut.** Do not build the Meraki per-device polling path — it reproduces the exact problem the original pivot fixed. Revisit once the Mist websocket integration lands and its event shape is confirmed; Meraki side remains an open issue with no fix under the current constraint (see §9). |
| Per-VLAN client count | 3 (downgraded from original Tier 2) | 🟡 SITE-LEVEL — no dedicated per-VLAN rollup endpoint exists (`byVlan` returns zero hits); pull the full per-network client list (perPage max 5,000, so one page covers a typical site) and group by `vlan` client-side. | 🟡 SITE-LEVEL for site-scoped counts — an org-wide `clients/count?distinct=vlan` exists, but it has no per-site breakdown, so isolating one site's numbers still needs a site-level call. | The original research doc treated this as a free byproduct of the DHCP data above — since that's now blocked (row above), this metric needs its own justification and its own (slower) cadence rather than riding along for free. |
| Per-VLAN bandwidth breakdown | 3, 30–60min | 🟡 SITE-LEVEL — same per-network client list, `usage.sent`/`usage.recv` per client | 🟡 SITE-LEVEL — site `stats/clients`, `vlan_id` + `tx_bytes`/`rx_bytes` per client | No vendor gives an org-wide bulk answer; already the slowest cadence tier, which is what makes this tolerable. |

### 5.6 LAN / Switching — zone 2 (badge, free items) + zone 4 (detail)

Trimmed this session — CPU, memory, PoE, and port-error rollups moved to §6 (cost-rejected, not blocked-for-lack-of-data like §9's items — the data path exists, it was judged too expensive relative to its value). Shadow IT moved into the merged Security Intelligence widget (§5.7).

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| Switch health rollup ("4 online, 1 alerting, 1 offline") | 1, 5min, free | 🟢 same call as device status — status enum is `online`/`alerting`/`offline`/`dormant`, not binary; "alerting" means reachable but with an active issue | 🟢 same call as device status — confirmed example value `connected`; full enum (e.g. a `restarting` or similar transitional state) wasn't confirmed in this collection | Roll up by status value, not a simple up/down count — "alerting" is exactly the kind of thing this rollup should surface, not collapse into "up." |
| Hardware redundancy rollup (PSU only — fan dropped) | 1, 5min, free | 🟢 BULK-SAFE — org `devices/statuses` or `devices/powerModules/statuses/byDevice`, perPage max **1000**, same call as the health rollup above (zero incremental cost) | 🟢 BULK-SAFE — `module_stat[].psus[]` in the same `stats/devices` call | **Fan removed from scope on both vendors per direction** — Meraki never had it (confirmed, no fan endpoint anywhere in the API); Mist did have `module_stat[].fans[]` but it's dropped here too, for one consistent PSU-only widget instead of a vendor-conditional PSU+fan/PSU-only split. This call is genuinely justified: it's not a new poll, it rides the same org-wide, 1000-per-page call already needed for the free health rollup above. |

### 5.7 Security Intelligence (merged) — zone 3 (Attention panel) + zone 4 (detail)

Merged this session per direction: Rogue AP / wireless threat count (formerly its own Wireless-section row) and Shadow IT / unauthorized device count (formerly its own LAN-section row) become **one Security Intelligence widget**, presented together rather than as two catalog rows — most of what a NOC viewer wants from "is there a security problem at this site" is one answer, not two separately-designed tiles.

| Signal | Meraki | Mist | Notes |
|---|---|---|---|
| Rogue AP / wireless threat detection | 🟡 SITE-LEVEL poll only — `networks/:networkId/wireless/airMarshal` returns live detections; org-wide endpoints exist only for rule/policy *configuration*. **No confirmed webhook/alert-type for this in Meraki's collection** — searched exhaustively, found nothing (Air Marshal is a real Meraki feature, but this pass found no push-based path for it). | 🔵 **Confirmed webhook event** — `rogue-ap-detected` is a documented event type on Mist's alarm/webhook system, delivered org-wide without polling. | This is the one real signal behind the merged widget. Mist gets it essentially free (event-driven); Meraki needs a site-level poll — same cost as before the merge, just presented in one place now. |
| Shadow IT / unauthorized device count | ⚫ **NO DATA SOURCE** — no concept of "unauthorized device" exists anywhere in the API (confirmed, zero hits) | ⚫ **NO DATA SOURCE for this concept** — the only org-wide adjacent endpoint (`stats/discovered_assets`) covers unmatched BLE beacons only, a much narrower thing | Merging into one widget doesn't create data where none exists — this signal remains an honest "no current data" bucket inside the widget, not something the merge fixes. Kept per direction (§9), not cut. |

**Placement recommendation** (ties into §7): build the actual detection/polling logic once at the org level — an org-wide security event feed fed by Mist's `rogue-ap-detected` webhook plus, if needed, a slow site-level Meraki Air Marshal sweep — and have the Site page's Security Intelligence widget be a **site-filtered view of that feed**, the same zero-incremental-cost pattern already used for the Alerts zone (§5.10). This avoids building and maintaining two separate detection pipelines (one per page type) for the same underlying signal.

### 5.8 Wireless — zone 2 (badge, free items) + zone 4 (detail)

Trimmed this session — Channel interference rollup cut (§6), Rogue AP moved into Security Intelligence (§5.7).

| Widget | Tier / Cadence | Meraki | Mist | Notes |
|---|---|---|---|---|
| AP health rollup ("6/6 healthy") | 1, 5min, free | 🟢 same call as device status, same enum caveat as switch health (§5.6) | 🟢 same call as device status | Unchanged from prior research doc. |
| Active client count, aggregated across site | 2, 15min | 🟢 BULK-SAFE — org `wireless/clients/overview/byDevice`, perPage max 1000 (5 calls/5,000 APs), sum grouped by network | 🟢 BULK-SAFE, cheapest option found in this whole audit — org `stats/sites` returns `num_clients` **per site, for all sites, in a single call** | Mist's combined figure is wired+wireless together, not wireless-only; if a pure wireless-only count is required, the Mist fallback (`countSiteWirelessClients`) is SITE-LEVEL. |
| Time-to-Connect breakdown (Assoc/Auth/DHCP/DNS) at site | 2, 15min | 🟡 SITE-LEVEL — `networks/:networkId/wireless/connectionStats`, pre-aggregated per network, no org-wide variant found | 🟡 SITE-LEVEL for phase detail — `sites/:site_id/sle/.../metric/time-to-connect/summary`; an org-wide `insights/sites-sle` exists but only returns one composite score per site, not the phase breakdown | **Cost-model caveat worth calling out explicitly**: opening *one* site's page and fetching this for *that* site is cheap (1 call) regardless of tag — the O(sites) cost only shows up if this is background-polled for *every* site continuously to keep a fleet-wide view (like the existing Top-5 leaderboard) fresh. Several other SITE-LEVEL metrics in this catalog share that same distinction; see §7 for the general note. |

### 5.9 Site Identity & Device Inventory — zone 1 (header) + zone 5 (table)

Unchanged from the prior research doc — both items are 🟢 free, reusing data already polled or config-synced elsewhere on the page. No new API surface needed; carried forward as-is.

### 5.10 Alerts — zone 6

Unchanged — 🟢 zero extra cost, a filter over the existing fleet alert stream rather than a new poll. Arguably still the most valuable zone on the page for the least cost.

## 6. Rejected / Merged Items

Cut from the active catalog this session, per direction, on cost/priority grounds rather than lack of data — unlike §9's items, a viable path existed for most of these; they were judged not worth what they'd cost. Recorded here rather than deleted outright, same "don't lose the reasoning" principle as §9.

| Widget | Why it had a viable path | Why it was cut |
|---|---|---|
| CPU utilization rollup | Meraki: capped at 250 calls/cycle for 5,000 devices, and confirmed absent for switches/gateways regardless. Mist: fully free (rides the shared `stats/devices` call). | Judged too expensive on the Meraki side — note the Mist side was actually free; this was a whole-widget cut for consistency, not a Mist-specific cost problem. |
| Memory utilization rollup | Same shape as CPU: Meraki capped at ~250 calls/cycle; Mist free. | Same reasoning — cut as a whole widget despite Mist's side being cheap. |
| PoE budget/utilization rollup | Mist: free, full numeric. Meraki: free boolean flag only (numeric wattage was already 🔴 device-level, separately unfeasible). | Cut entirely rather than shipping a Mist-only numeric / Meraki-flag-only split. |
| Port error count rollup | Meraki capped at ~250 calls/cycle if polled directly (though the original design's preferred path was event-driven off the existing alert stream, which sidesteps this cost); Mist free. | Cut regardless of the event-driven mitigation already available. |
| Channel interference rollup | Meraki: actually the cheapest, best-case endpoint found in this entire audit (pre-rolled per network, org-wide). Mist: site-level. | Cut anyway — this was already the original research doc's lowest-urgency "forward-looking, not urgent" item; removing it costs little. |
| Fan status (within Hardware redundancy) | Mist: available (`module_stat[].fans[]`). Meraki: never available (confirmed absent from the API entirely). | Dropped for a single consistent PSU-only widget across both vendors instead of a vendor-conditional PSU+fan/PSU-only split (see §5.6). |

## 7. Site vs. Org-Level Placement

None of the remaining catalog widgets need to move off the Site page for being "more meaningful at the org level" — in every case, the site-scoped view is a different, complementary granularity of an existing or planned org-level view, not a duplicate of one:

- **WAN/VPN/uplink health, VLAN/DHCP detail** are inherently site-scoped — each site has its own circuits and VLANs; there's no meaningful org-level equivalent beyond the fleet matrix `index.html` already provides.
- **Switch/AP health and hardware (PSU) redundancy** are genuinely dual-purpose: an org-level rollup answers "which sites/devices need attention across the fleet" (the existing Fleet Status matrix), the site-level version answers "which of *this* site's devices" — same signal, two granularities, both already how this app is structured today.
- **Application Visibility (top apps) and Time-to-Connect / active client count** are more useful *in context* on a site page than as a fleet number — traffic and onboarding patterns differ store to store, and (for Time-to-Connect) the existing fleet-wide Top-5 leaderboard already shows "is this one of the worst sites," not "what's this specific site's own number," which is what the Site page adds.
- **Security Intelligence is the one exception worth restructuring**, not removing: the actual detection/polling logic (Mist's `rogue-ap-detected` webhook, any Meraki Air Marshal sweep) should live once at the org level feeding a fleet-wide security event stream, with the Site page showing a site-filtered slice of that same stream — identical in spirit to how the existing Alerts zone (§5.10) already works, and avoids building two separate detection pipelines for one signal. This is already captured as the placement recommendation in §5.7.
- **The BGP flap detector** is inherently site-scoped (each site has its own BGP sessions with its own flap history), though nothing prevents also rolling the same Mist webhook feed up into a fleet-wide "which sites have flapping BGP right now" view at the org level later — that would be an additional consumer of the same event stream, not a new cost.

**On the underlying cost model** (relevant to every 🟡 SITE-LEVEL tag in §5): fetching a SITE-LEVEL metric for the one site a user currently has open is always cheap — one call. The O(sites) cost this doc keeps flagging only materializes when a metric is *background-polled for every site continuously*, which is what's required to feed a fleet-wide view (an org-level Attention rollup, cross-site alerting, the existing Top-5 leaderboards) rather than just this one page. Evaluate §8's Stage C items against that continuous-fleet-polling cost, not the cost of one person looking at one site page.

## 8. Rollout Staging

Ordered by feasibility tag and cost, not by network domain — every stage is buildable end-to-end (a real page a user can look at), each just covers less of the catalog than the next. (See the TOC note on Tier vs. Stage naming — these are deliberately lettered, not numbered, so they're never confused with the Tier 1/2/3 cadence bands from §2.)

**Stage A — vital signs, all 🟢 BULK-SAFE.** Site identity header, health badge (uplink status/throughput/loss, VPN tunnel status, switch/AP health, PSU-only hardware redundancy), device inventory table, alert feed, and the Attention panel skeleton (populated purely from Stage-A data at this point). Every metric in this stage is cheap on both vendors with no caveats — this is the zero-risk slice and should ship first.

**Stage B — confirmed-viable context, including new event-driven infrastructure.** VPN per-tunnel detail, cellular signal (Meraki full, Mist status-only), active client count, and the BGP flap detector for Mist sites (once the `alarms` webhook payload shape is confirmed — §9). This stage is where webhook-receiving infrastructure gets built for the first time (the app has none today), so it's grouped separately from Stage A's pure-REST-polling scope even though the flap detector's ongoing cost is zero once built.

**Stage C — accepted 🟡 SITE-LEVEL costs.** Top Applications, per-VLAN client count/bandwidth, VLAN inventory, Time-to-Connect breakdown, and the Security Intelligence widget's Meraki-side Air Marshal polling (Mist's side is webhook-driven and could ship in Stage B, but the widget is grouped as one unit here for simplicity). Each of these costs one call per site with no bulk alternative on at least one vendor — acceptable per this session's policy, but only once Stage A/B have validated actual measured API usage against the org's real rate limits, since this stage is where that budget gets spent fastest at fleet scale.

**Not staged — blocked, tracked in §9.** DHCP pool utilization, the Shadow-IT half of Security Intelligence, and BGP for Meraki sites. None has a viable data path today; they stay in the catalog so the reasoning isn't lost, but none should be scheduled into an implementation plan until its blocker is resolved.

## 9. Open Issues

Carried forward for the implementation session and for whoever owns the vendor integrations:

1. **DHCP pool utilization has no viable path today.** Meraki's data exists but is device-level-only (🔴). Mist has no REST DHCP stat at all; the org's planned Mist websocket integration is a plausible path (🔵) but its event shape wasn't confirmed against this Postman collection — needs direct confirmation from whoever owns that integration before this can move to Stage B/C. Meraki side has no known fix under the current constraint regardless of the Mist outcome.
2. **Shadow IT / unauthorized device count (within Security Intelligence, §5.7) has no data source on either vendor** as originally specified. The closest adjacent capability (rogue-AP detection) is a different, narrower concept. Either accept that narrower framing, or leave this signal permanently showing "no current data."
3. **BGP cannot be shown for Meraki sites at any cost or design** — confirmed absent from the alert-profile system and the config-only status endpoint alike, not just uncached or unpolled. This is permanent unless Meraki adds the capability; reframing as event-driven (this session's change) doesn't help because there's no BGP event on Meraki to subscribe to either.
4. **Mist's BGP webhook payload shape is unconfirmed.** `bgp_neighbor_updown_threshold` (an org/site settings field) is confirmed to exist and feed the `alarms` webhook topic, but this pass didn't inspect the actual event payload — specifically whether it includes previous/current neighbor state (needed for the "last flap detail" widget in §5.4). Confirm before Stage B.
5. **Mist's `rogue-ap-detected` webhook payload is similarly unconfirmed** for the identity fields the Attention panel needs (which AP, which site) — confirmed to exist as an event type, not confirmed field-by-field.
6. **Two Mist endpoints have unconfirmed response shapes**: VLAN inventory (`networks/derived` and the org `networks` catalog both had zero example responses in the collection) and WAN-circuit jitter (`ports/search` has a `jitter` field but it wasn't populated in the example). Verify both against a live Mist org before building on them.
