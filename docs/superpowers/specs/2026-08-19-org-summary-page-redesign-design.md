# Org Summary Page — Redesign Design

> Ground-up redesign of `index.html`, the org (fleet-wide) summary page. Reference implementation for patterns is `site.html`. Sibling spec: `2026-08-18-monitor-health-page-design.md`, which owns collector and API-polling health and is a prerequisite for this page's panel scope labels.

## Table of Contents

- [1. Purpose & Scope](#1-purpose--scope)
- [2. Architecture](#2-architecture)
- [3. Page & Navigation](#3-page--navigation)
- [4. Bands & Widgets](#4-bands--widgets)
- [5. Stage Assignment](#5-stage-assignment)
- [6. Data Plan](#6-data-plan)
- [7. Explicit Scope Cuts](#7-explicit-scope-cuts)
- [8. Open Questions](#8-open-questions)

## 1. Purpose & Scope

### The job of the page

Two altitudes, strictly layered. The top of the page answers **"is anything on fire, and where do I go"** in a few seconds. Everything below answers **"how is the fleet trending, what needs planned work."** The rule is hard: the triage band never accumulates trend or capacity content, and posture widgets never claim triage urgency.

### What only this page can answer

`site.html` answers *how is this site?* Device pages answer *how is this device?* The org page exists for the two questions neither can reach:

1. **Is this one problem or forty?** — whether the open incidents across the fleet share a cause.
2. **Is the network broken, or is my visibility broken?** — whether a mass event is a real outage or a collection failure.

Every design decision below serves those two questions first. A widget that merely restates something a site page already shows, summed, earns no place here.

### What the current page gets wrong

The existing `index.html` predates `site.html` and the conventions established there. Concretely:

- **Counts alert volume, not impact.** Four crit/warn cards measure the monitoring pipeline. Forty warnings may mean nothing is wrong.
- **No blast radius.** "Correlated Alerts" is a bare count. The one insight only org altitude can give is absent.
- **No causal structure.** Every fault is presented as independent, so a gateway failure and the twelve APs behind it read as thirteen problems.
- **Cannot distinguish outage from blindness.** A dead collector is indistinguishable from a site-wide failure.
- **Device-centric.** No notion of dependency, redundancy, or single points of failure.
- **Client counts are derived by summing per-device counts** across gateways, switches and APs — which triple-counts any wireless client, and does so by a different factor per site depending on device mix. This affects the existing *No. of Clients Connected* widget and is not carried forward.

### Fleet assumptions

The fleet is **permanently mixed** — multiple vendors across multiple collection methods, and gaining vendors over time. A single site routinely spans several: a Palo Alto SD-WAN gateway via kTranslate, Meraki switches via API, Mist APs via API. Design must be **scale-agnostic** (no widget that breaks between 11 and 1,100 sites) and **vendor-additive** (a new vendor adds data, never a layout change or a mapping-table edit).

## 2. Architecture

### 2.1 Two data layers

The single most important structural decision. Aggregation happens on the upper layer only.

| Layer | Content | Vocabulary | Used for |
|---|---|---|---|
| **Alerts** | Open incidents in New Relic | Standardised by NR — incident state and priority | All aggregate numbers, all grouping, the dependency traversal |
| **Events** | Raw output from vendors and kTranslate — Meraki alerts, Mist alarms, syslog, SNMP traps | **Each source's own, verbatim** | Evidence beneath an incident, and the event feed |

Incidents are already deduplicated, condition-evaluated and cross-source, because NR's alert conditions did that work. **No vendor taxonomy is ever mapped.** The brittle normalisation layer that a multi-vendor rollup would otherwise need does not exist in this design, and the cost of adding a vendor stays flat.

Events are never aggregated across sources and never translated. Where they appear, they appear in the words their source used.

### 2.2 Device state vocabulary

Exactly three states, and the only standardisation on the page:

| State | Derived from |
|---|---|
| `online` | Reporting, with no open incident |
| `warning` | An open NR incident exists for the entity |
| `offline` | Not reachable / not reporting |

`warning` is **source-independent by construction**: the decision rule is identical for a Meraki switch and a kTranslate-polled router. The evidence differs; the rule does not. Severity within `warning` comes from NR incident priority — never from a vendor severity field.

This departs from the four-value enum used elsewhere in the app (`online/warning/critical/offline`). `critical` and `dormant` do not appear on this page. Where a vendor reports a state outside these three, it surfaces as an **event**, in the vendor's own words, not as a device state.

**Collector loss is covered at the alert layer, not by the page.** A collector going down raises its own incident, and the devices behind it raise no-heartbeat incidents. Both are therefore `warning`, not silently `online`. The page deliberately does no staleness inference of its own.

### 2.3 The dependency graph

One graph, supplied by the cross-vendor topology engine. **Ports are first-class nodes, not device attributes** — the engine's chain is port-level:

```
AP → AP port → Distribution Switch port → Distribution Switch
   → Distribution Switch port → Core Switch port → Core Switch
   → Core Switch port → Gateway port → Gateway
```

So the graph has two node kinds and three edge kinds:

| Node kind | Notes |
|---|---|
| **Device** | Gateway, core switch, distribution switch, AP, and non-network auxiliary devices. Collectors are also device nodes, so monitoring edges have both endpoints. |
| **Port** | Belongs to exactly one device. Carries its own state and its own incidents. |

| Edge kind | Connects | Meaning |
|---|---|---|
| **contains** | device → its ports | Structural ownership |
| **link** | port → peer port | A physical adjacency between two devices |
| **monitoring** | device → its collector | Observation dependency, not a network path |

There is **no access-switch layer** — APs attach directly to distribution switches. The role vocabulary is therefore `gateway` / `core` / `distribution` / `ap` / `auxiliary` / `collector`, and an "access" role must not be introduced.

Upstream traversal from an AP walks: AP → *contains* → AP port → *link* → distribution port → *contains* → distribution switch → *contains* → its uplink port → *link* → core port → … → gateway.

### 2.3.1 Why port-level granularity changes the design materially

This is not a modelling detail. It is the difference between a usable blast radius and a misleading one.

- **A port fault and a device fault have completely different blast radii.** `dist-01 port Gi1/0/12 erroring` affects the one AP behind that port. `dist-01 down` affects all 24. Device-level modelling would report both as "distribution switch affected" and force the engineer to go find out which.
- **Incidents attach at the level the fault actually occurs.** Link-down, interface errors, discards, CRC and saturation are *port* facts. Reachability, CPU and memory are *device* facts. Attaching everything to devices would lose the localisation that makes the root list precise.
- **This is where the interface-error widget and the root traversal converge.** Interface errors *are* port-node incidents, so error hotspots stop being a separate ranked list and become roots in their own right, with an exact count of what sits behind them.
- **Redundancy becomes decidable.** A device with two uplink ports whose peer ports sit on *different* upstream devices is genuinely redundant. Two uplink ports landing on the *same* upstream device is not — a distinction invisible without port nodes, and the reason the site page's current "2/2 paths available" indicator cannot be trusted.
- **Roots may be ports.** A root is the upstream-most affected *node*, port or device. Rendering must therefore identify a root as `device` or `device + port`.

NR incidents attach to nodes. Both edge kinds are traversed by the same algorithm; they are **distinguished visually, never computationally**. A network-edge root means the network is broken; a monitoring-edge root means visibility is broken. The graph makes the distinction fall out rather than requiring a rule.

### 2.4 Incident roots — the one algorithm

For each connected cluster of incidents in the graph, surface the **upstream-most node as the probable root** and nest the remainder beneath it as descendants.

This single traversal handles gateway failures, switch failures, collector failures and isolated single-device faults with no special cases. Consequences that matter:

- **Nothing is suppressed or filtered.** Every incident stays visible and countable; clusters collapse to one line rather than forty. This is what makes the page usable before upstream alert deduplication lands — and when that dedup arrives, the page needs no change, because clusters simply get smaller.
- **Roots are labelled probable.** Adjacency makes nesting exact, but a root is still an inference about causality, and is presented as one.
- **Blast radius is a precise count** — "47 devices downstream of this node" — not an estimate.
- **Graceful degradation.** Where port-level adjacency is incomplete for a site, fall back to device-level role ordering (gateway → core → distribution → AP), which needs only site membership and device role. Blast-radius counts from the fallback path must be marked as approximate, since role ordering cannot distinguish which port a device hangs off and therefore over-counts.

### 2.5 Statistical grouping, demoted

Structure beats correlation wherever structure exists, so the topology traversal owns within-site and within-collector grouping. **Lift scoring survives only across sites**, where there is no structure to exploit: partition open incidents by an attribute (vendor, model, device role, collector), and score each partition by its share of incidents divided by its share of the fleet. Lift near 1 is coincidence; well above 1 means the attribute explains the incidents.

This answers findings no topology can produce — *"nine sites all have gateway incidents"*. Partitions must clear a minimum member count and a tight onset window to be promoted; everything else stays visible as unrelated singletons.

## 3. Page & Navigation

- **Scope model: global only.** The existing `scopeSelector` dropdown is removed. There is no region mode and no single-site mode — the page is always the whole fleet.
- **Site drill-down navigates away**, to `site.html?site=<name>`, rather than re-rendering in place. Each page owns exactly one altitude, and the org page spends its vertical space on cross-site comparison instead of duplicating a site view.
- **Region is not a structural axis.** Region is customer-maintained metadata (Meraki network tags, Mist site groups), so region rollups are only as good as tagging hygiene and fail *silently* at partial coverage. Region appears only as an optional grouping attribute in cross-site grouping, and always carries its tag-coverage percentage. Site — supplied by the topology engine — is the reliable unit and is used instead throughout.
- **Three cumulative stage tabs** — Stage A, Stage A+B, Stage A+B+C — reusing the `data-tab` / `SharedUI.switchTab` mechanism already used by `site.html` and the device pages. Each tab is additive. Staging reflects data-availability sequencing for the engineering conversation, not phased delivery.
- **Vendor and collection method are attributes, not structure.** They appear as filters, as grouping options, and as columns — never as page-level lanes or tabs. Lanes were considered and rejected: on a mixed-vendor site they scatter one site's incident across several panels, forcing the reader to reassemble the unit they are troubleshooting.

## 4. Bands & Widgets

Five bands, in fixed order. Band membership encodes urgency; a widget may not move band to get more attention.

### Band 1 — Triage

One row. Every figure here runs on NR incidents and is legitimately fleet-wide, because no aggregation is invented — the standardisation already happened at the alert layer.

- **Sites by worst state** — count of sites whose worst device state is `warning` or `offline`, against total sites. The headline.
- **Devices by state** — `online` / `warning` / `offline` counts fleet-wide.
- **Open incidents by NR priority** — the actionable set, not event volume.
- **Incident roots** — how many *distinct clusters* the open incidents reduce to. This is the band-1 expression of "one problem or forty": forty incidents resolving to three roots is a materially different morning than forty resolving to forty.

No client widget. No trend content. No capacity content.

### Band 2 — Blast radius

The centrepiece, and the reason the page exists. One widget: the **incident root list**.

- One row per incident cluster, ordered by downstream device count × root priority.
- Each row shows: root node — identified as a device or as **device + port**, since a root may be either — its site, vendor and collection method, root state, **exact count of affected descendants**, cluster onset time, and an explicit `network` or `visibility` classification derived from the root's edge kind.
- **Visibility-rooted clusters are a handoff row, not a workable item.** They must still be *computed* here: the no-heartbeat incidents behind a dead collector have no network-edge root, so without the monitoring-edge traversal they would surface as dozens of separate unexplained roots — defeating the one thing this widget exists to do. Suppressing them instead is not an option either, since the alerts are deliberately kept until upstream deduplication lands.
- So the org page renders the collapsed row only: root collector, affected device and site counts, onset, and a link to Monitor Health. It is **visually distinct** from a network-rooted row and **does not expand** into collector diagnostics, host health or ingest state. What the org page owes the reader is the single fact *"this is not a network fault"*; the diagnosis of why the collector failed belongs to Monitor Health, which owns that question per its §1.
- Rows expand **in place** to the nested dependency tree: root, its affected children, their affected children. Unaffected siblings are not shown. Expansion follows `site.html`'s in-card pattern — no page overlay, no backdrop, no `main` overflow toggling.
- Each node in the expanded tree links out: gateways/switches/APs to their existing device pages via the `DEVICE_TYPE_PAGES` map, sites to `site.html?site=`. Devices with no detail page (Palo Alto, auxiliary types) are styled identically but inert, matching how `site.html` already treats auxiliary devices.
- Drilling into a node shows its **events** — raw, verbatim, in the source's own vocabulary — as the evidence beneath the incident.
- **Cross-site grouping** sits beneath the root list as a secondary view: lift-scored partitions by vendor, model, device role, collector, and optionally region with its coverage percentage. Ranked, capped, with an explicit "+N more" row. Never silently truncated.
- Empty state collapses to a single line. No reserved height.

### Band 3 — Fleet posture

- **Fleet Status accordion** — grouped **role → vendor → model**, with collection method as an attribute column rather than a grouping level. Role-first is deliberate: grouping by vendor first would scatter a mixed-vendor site's stack across the widget. Columns are the three device states. Reuses the existing `.status-grid` CSS family and the accordion interaction from `site.html` (single collapsed row per group, chevron expands).
- **Redundancy verification** — per site, whether dual gateways or dual uplinks are genuinely independent paths, **computed from adjacency** rather than asserted from device count. Replaces the site page's guessed "2/2 paths available" indicator with a real answer.
- **Topology coverage** — sites where the engine knows devices that have no telemetry source at all. These are the devices most at risk of being read as healthy, and this is the only place they are visible on this page.
- **Worst sites** — ranked by downstream-affected device count, linking to `site.html`. Ranking by real blast radius replaces the site-tier weighting considered earlier, which depended on customer-maintained tier metadata with the same silent-failure mode as region tags.

### Band 4 — Forward-look

Each panel states its own source scope in its header (e.g. *"SNMP-monitored switches · 69 devices"*). Panels here are **honestly partial** and say so; none pretends to be fleet-wide.

- **SPOF risk** — nodes whose failure would orphan devices with no redundant path, ranked by devices at risk. Pure topology, **no telemetry at all**, so it covers every site regardless of collection method. The one widget on the page with complete coverage by construction.
- **Capacity exhaustion** — link saturation from both source families; **DHCP scope utilisation and PoE budget from SNMP**. Both of the latter were previously assessed as blocked with no viable data path; agent-based collection unblocks them for the devices it covers.
- **Interface error hotspots** — errors, discards and CRC, ranked by the number of devices behind the offending port. Agent-strongest signal and the best hardware-fault indicator available; API sources summarise these away. Note that a port error severe enough to open an incident surfaces in band 2 as a root in its own right; this panel is the sub-incident-threshold view, for ports degrading but not yet alerting.
- **Change timeline** — configuration and change events over time, from vendor audit logs and syslog. The "what changed" axis, since most incidents follow a change.

### Band 5 — Events

The evidence layer, and **the only place silos remain** — correctly, since this is raw vendor output.

- One table, with a **Source** column, filterable and sortable by source.
- Severity and event type displayed **in each source's own words, verbatim**. A shared table is acceptable; a shared vocabulary is not.
- Fixed max-height with internal scroll — event volume is unbounded, so a scroll viewport here is intentional rather than wasted space. This is the one exception to content-driven height.
- Device names link to device pages where one exists.

### 4.1 Layout rules carried over from `site.html`

- **Content-driven height** for every widget with small bounded content. Fixed heights only for the event feed, per above.
- **In-card expansion** everywhere. No page-wide overlays, no `expandedBackdrop`, no `main` overflow toggling.
- **One owner per fact.** No fact is restated at three granularities across bands. Device-state counts live in band 1 and band 3 only — band 1 as fleet totals, band 3 as the role/vendor/model breakdown.
- **No silent truncation.** Any ranked or capped list states what was omitted.

## 5. Stage Assignment

### 5.1 The sequencing rule

**A widget appears at the earliest stage it can render honestly** — with its source scope stated — *not* at the stage it achieves full fleet coverage. The alternative rule holds back capabilities that are ready now on one source purely because another source will never catch up, which discards the strongest signals available.

### 5.2 Assignment

| Widget | Stage | Rationale |
|---|---|---|
| Sites by worst state · devices by state · incidents by priority | **A** | NR incidents exist today |
| Incident root count | **A** | One traversal over the existing graph |
| Incident root list + nested tree + event drill-down | **A** | The graph and the incidents both already exist |
| Fleet Status accordion (role → vendor → model) | **A** | Inventory and state are available for all sources |
| Redundancy verification | **A** | Pure adjacency |
| Topology coverage | **A** | Pure topology |
| Worst sites by blast radius | **A** | Falls out of the traversal |
| SPOF risk | **A** | Pure topology, no telemetry |
| Interface error hotspots | **A** | Agent-native today; scoped to SNMP-monitored devices |
| Event feed with source column | **A** | Raw passthrough, no processing |
| Cross-site lift grouping | **A+B** | Refinement, not a prerequisite — the traversal covers the common cases |
| Capacity: link saturation | **A+B** | Needs consistent interface-capacity data across sources |
| Capacity: DHCP scope · PoE budget | **A+B** | SNMP-available; scoped to agent-monitored devices |
| Change timeline | **A+B** | Needs audit-log and syslog ingestion wired up |
| Region as a grouping attribute | **A+B** | Optional, and needs the tag-coverage figure to display honestly |
| Adjacency-exact nesting on partially-mapped sites | **A+B+C** | Role-order fallback covers Stage A; this closes the gap |
| Inter-site overlay blast radius | **A+B+C** | Depends on the topology engine exposing inter-site links — see §8 |

### 5.3 What staging now communicates

Stage B is small and Stage C is nearly empty, because the expensive prerequisites — a normalised fault taxonomy, an ASN enrichment pipeline, flow-baseline learning — were all designed out rather than deferred. What remains in later stages is genuinely optional refinement.

The message for engineering is therefore **not** "when do we get the rest?" but: **several panels are permanently scoped to one source family, by the physics of what that source can observe.** DHCP scope, PoE budget and interface error detail are SNMP-side indefinitely; wireless SLE is API-side indefinitely. No roadmap closes those, because the other source cannot produce the signal. Stage A+B+C is not "everything, fleet-wide," and the page says so in each panel header rather than implying completeness.

## 6. Data Plan

### 6.1 Reused as-is

| Need | Source |
|---|---|
| Device inventory, per-device state | `devices.json` + `network-data.json` `deviceStatus`, via existing `DataLoader` accessors |
| Site list and membership | `network-data.json` `sites` |
| Event feed content | `alerts.json` — **reinterpreted as events**, not alerts, per §2.1 |
| Device page routing | Existing `DEVICE_TYPE_PAGES` map |
| Accordion / status-grid CSS | Existing `.status-grid` family in `shared-styles.css` |

### 6.2 New: `data/topology.json`

Generated by a new `scripts/generate-topology.js`, following the `generate-site-details.js` pattern. The dependency graph:

- `nodes` — `{ id, name, kind, siteId, role, vendor, model, collectionMethod, collectorId, hasTelemetry }` where `kind` is `device` or `port`. For `port` nodes, `role` is omitted and `parentDeviceId` is required. For `device` nodes, `role` is one of `gateway` / `core` / `distribution` / `ap` / `auxiliary` / `collector` — **no `access` role**, per §2.3.
- `edges` — `{ from, to, kind }` where `kind` is `contains`, `link`, or `monitoring`. `link` and `monitoring` edges are directed downstream-to-upstream so reaching a root is a walk up; `contains` edges are device→port.
- `redundancy` — per site, computed independent-path findings, derived from whether a device's uplink ports terminate on distinct upstream devices.

Must include mixed-vendor sites, since that is the normal case: at least one site combining a non-API gateway with API-managed switches and APs.

### 6.3 New: `data/incidents.json`

The NR alert layer, distinct from `alerts.json`:

- `{ incidentId, entityId, priority, state, openedAt, title, sourceEventIds[] }`
- `entityId` joins to `topology.json` `nodes`.
- `sourceEventIds` joins to `alerts.json`, providing the event drill-down beneath each incident.
- Must include a **collector-down incident plus its no-heartbeat device incidents**, so the visibility-rooted cluster case is exercised in mock data.

### 6.4 New `DataLoader` accessors

Parallel to the existing `getSiteDetails` family:

- `getTopology()`, `getNode(id)`, `getNodesBySite(siteId)`
- `getIncidents()`, `getIncidentsByEntity(entityId)`
- `getIncidentRoots()` — the traversal of §2.4, returning clusters with root, descendants, affected counts and edge-kind classification. **The single most important new function**, and the one that must be unit-verifiable independently of rendering.
- `getDeviceState(deviceId)` — the three-state derivation of §2.2
- `getSpofRisk()`, `getRedundancy(siteId)`, `getTopologyCoverage()`
- `getCrossSiteGroups(attribute)` — lift scoring of §2.5
- `getCoverage(sourceId)` — **from the Monitor Health spec**, for panel scope labels. This page depends on it.

### 6.5 Migration note

`index-main.js` is 2,129 lines and currently owns all of the widgets being replaced. This redesign removes most of them — the four alert cards, the axis-flip Fleet Status, WAN Resilience donut, Top Impacted Sites, Clients Connected, Top SSIDs, and the three trend overlays. The traversal and state-derivation logic belongs in `data-loader.js` (testable, reusable by `site.html`), not in the page script. The page script should end up smaller than it starts.

## 7. Explicit Scope Cuts

- **No client widget.** Removed entirely, not fixed. The existing per-device summation triple-counts wireless clients by a per-site-variable factor, and no defensible fleet-wide client number is available across a mixed fleet.
- **No cross-source semantic mapping, ever.** The three device states are the only standardisation. Vendor severities, alarm classes and status enums are displayed verbatim or not at all.
- **No derived or inferred metrics** beyond the incident-root traversal and its documented role-order fallback. Specifically rejected: flow-baseline primary-interface learning, ISP identification via ASN enrichment, `ifSpeed`-based capacity classification, MAC-table client approximation. Each was considered and cut as too fragile across vendor additions.
- **No scope selector**, no region mode, no single-site mode.
- **No site-tier or criticality weighting.** Depends on customer-maintained metadata with a silent failure mode; real blast-radius counts serve the ranking purpose better.
- **No monitoring-health diagnostics.** API polling counts, rate-limit headroom, agent fleet health and agent host health all live on the Monitor Health page. The single deliberate exception is visibility-root *classification* in band 2 — computed here because omitting it would flood the root list, but carrying no diagnostic detail and linking out for it. Per-panel source scope labels are the only other monitoring-derived content.
- **No staleness inference.** Collector loss and heartbeat loss arrive as incidents; the page does not second-guess them.
- **No trend overlays.** The existing modal trend charts are not carried forward. Sparklines inline where a metric is gauge-like, consistent with `site.html`.
- **No ML or probabilistic correlation.** The traversal is deterministic and every cluster is explainable in one sentence. If a grouping cannot be explained, it does not ship.

## 8. Open Questions

1. **Does adjacency extend to inter-site overlay links?** This spec designs intra-site adjacency. If the topology engine also knows site-to-site tunnels, blast radius can cross sites — a hub gateway failure would nest the spoke sites depending on it, which would be the strongest capability on the page and a genuinely org-only insight. Structurally it is the same graph with more edges, so it is additive rather than disruptive. Flagged as Stage C above.
2. **Duplicate alerting during collector loss** is known and being fixed upstream. This design deliberately nests rather than suppresses, so it needs no change when dedup lands — but confirm nobody expects the page to filter in the interim.
3. **Role vocabulary and port identity** — the `role` values in §6.2 now match the confirmed chain (no `access` layer), but must still match the engine's emitted strings exactly, or a mapping is reintroduced at precisely the point this design exists to avoid one. Separately: what is a port's stable identifier across polls, and is it consistent between an API-managed device and an SNMP-polled one (`ifIndex` is not stable across reboots on all platforms)?
4. **Incident-to-entity granularity** — whether NR incidents attach to individual devices or can attach to higher-level entities. The traversal assumes device-level attachment; group-level incidents would need a defined position in the graph.
5. **Redundancy semantics** — what counts as an independent path is a judgement call (dual uplinks to the same ISP? dual gateways sharing a switch?). Needs a definition before the redundancy widget can be built.
