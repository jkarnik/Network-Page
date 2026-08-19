# Monitor Health Page — Design

> A separate page answering **"can I trust the network pages right now?"** — deliberately split out of the org summary page, because monitoring health is not network health. Sibling spec to the org summary redesign; this one is to be worked on independently.

## 1. Purpose & Boundary

The org summary page answers *is the network broken?* This page answers *is my visibility into the network broken?* Those are different questions with different owners, different runbooks, and different urgency profiles, and interleaving them makes both harder to read.

The split is load-bearing for one specific reason: **a dead collector is indistinguishable from a site-wide outage.** If a kTranslate agent dies, every device behind it goes unreachable simultaneously — the exact signature of catastrophic site failure. Somebody gets paged at 02:00 for a monitoring problem. This page is where that distinction gets made explicit, and it is the source of truth the org page's Shared-Fault Explorer uses to suppress collector-loss events from genuine network faults.

### Non-goals

- **Not a network health page.** No device status rollups, no alert triage, no per-site network metrics. Those live on the org and site pages.
- **Not an alert console.** It shows monitoring-pipeline state, not network events.
- **Not a settings or configuration page.** Read-only observability of the collection layer.

### What stays behind on the network pages

Moving the trust strip here must not make fragmentation invisible where it matters. The org page retains, and this page supplies:

1. **Per-widget coverage labels** — every widget fed by a partial source states its scope in its own header (e.g. *"Mist-only · 41% of sites"*).
2. **Visibility-root classification** — the org page's band 2 computes which incident clusters are collector-rooted and renders each as a single handoff row linking here. It carries the classification only, never the diagnosis (see Band 1b).
3. **A single degraded-coverage indicator** — one compact line, shown *only* when coverage is impaired, linking here. Not a persistent strip; an exception marker.
4. **Source, population and freshness** in every panel header (see §5).

## 2. Scope of Content

Three subjects, in descending order of how often an engineer needs them:

| Subject | Why it's here |
|---|---|
| Per-vendor API polling health (Meraki, Mist) | Rate limits are the binding constraint on what the org page can show at all. This is where that budget is visible. |
| kTranslate agent fleet + the host hardware each agent runs on | The agent is a single point of failure for every device behind it. Its host being out of disk is a network-visibility incident. |
| Derived coverage model | The machine-readable output other pages consume to label their widgets honestly. |

## 3. Why rate limits get first-class treatment

At org altitude the constraint is not whether a vendor endpoint exists — it is whether it can be called for every device without exhausting the request budget. A metric available per-device is effectively **unavailable fleet-wide** if collecting it costs one call per device.

This is why CPU and memory are agent-strong but API-impractical at org scope: SNMP polls them cheaply in bulk, while the API path needs a per-device call. The page therefore tracks **bulk vs per-device call ratio** as a headline figure, because that ratio is what decides which org-page widgets are viable.

## 4. Widgets

### Band 1 — Trust summary

A compact posture row, the page's own headline:

- Devices by source tier — API-managed / agent-monitored / unmonitored, as counts and share.
- Collectors down or degraded, with the count of devices behind them.
- Worst-case API rate-limit headroom across vendors.
- Number of metrics currently at reduced coverage.
- Overall verdict: *healthy / degraded / fragmented*, defined in §5.

### Band 1b — Monitoring-edge incident roots

The widget the org summary page hands off to. The org page classifies a cluster as a visibility incident and stops there; this is where it gets diagnosed.

- One row per monitoring-rooted incident cluster: the root collector, the host it runs on, counts of affected devices and sites, cluster onset, and the collector's current ingest state.
- Expands to the full picture the org page deliberately withholds — affected devices **grouped by site**, so the shape of the blindness is visible (one site dark vs. forty sites partially dark are very different problems); the collector's host health; ingest counters and drop/timeout rates; and last-successful-report time per affected device.
- **Site shape is the discriminator worth surfacing.** A network fault is site-shaped; a collector fault spans sites. When a collector's affected set happens to align with a single site, that ambiguity is real and should be called out rather than resolved automatically — it is exactly the case where an engineer must look at both pages.
- Cross-reference is bidirectional: the org page links here for diagnosis, and each row here links back to the affected sites on `site.html`.

### Band 2 — Per-vendor API polling

One panel per vendor (Meraki, Mist), each showing:

- **Request rate vs published limit**, with headroom % and a short trend. The single most important number on the page.
- **Throttle events** (HTTP 429 / backoff) over time, with which endpoint class triggered them.
- **Poll cycle completion** — did the last full inventory sweep finish, and how long did it take? A sweep that no longer completes within its cadence is the leading indicator of coverage decay.
- **Per-endpoint-class table**: endpoint, cadence, last success, last failure, average latency, error rate.
- **Budget allocation** — which endpoint classes consume the request budget, and therefore which org-page widgets are competing for it. Makes the trade-off explicit when someone asks for a new metric.
- **Bulk vs per-device call ratio**, per §3.

### Band 3 — kTranslate agent fleet

- **Agent inventory table**: agent id, version, host, sites and devices covered, status, last heartbeat.
- **Ingest health per agent**: flows/sec, SNMP polls/sec, syslog messages/sec, plus the failure counterparts — dropped flows, SNMP timeouts, syslog queue depth.
- **Orphaned devices** — devices whose assigned agent is dead or unassigned. These are the devices at risk of being silently counted as healthy.
- **Blast radius per agent** — precomputed count of sites and devices that go dark if this agent fails. Precomputed deliberately: it is the number you want during an incident, not one you want to derive under pressure.

### Band 4 — Agent host hardware health

The agent process is only as healthy as the box under it. Per host running kTranslate:

- CPU, memory, disk utilisation, load average.
- Throughput on the collection interface.
- Process uptime and restart count.
- **Capacity headroom** — is this host near its limit for the device count assigned to it? Answers "can I add sites to this collector?"

Host metrics may themselves arrive via SNMP or a host agent; see §7.

### Band 5 — Coverage model

The live version of the source-capability analysis, and the contract other pages read:

- **Metric × source availability matrix** — live rather than a static document, so it reflects actual current collection rather than theoretical capability.
- **Per-metric coverage** — what fraction of sites and devices can report each metric.
- **Unmonitored inventory** — devices and sites present in inventory with no telemetry path.
- **Per-source scope, population and freshness** — the figures panels render in their headers. See §5.

## 5. Source Scope — the shared vocabulary

The org page is **siloed by source**: each panel reports one source's data in that source's own vocabulary, and no cross-source aggregate is computed. That decision removes most of what this section originally had to solve — a number belonging to exactly one source is unambiguous by construction, so it needs no confidence marker.

What remains is simpler. Every panel on a network page declares, in its own header, the scope it covers:

| Element | Content | Example |
|---|---|---|
| **Source** | Which collector or vendor API fed this panel | `Cisco Meraki` |
| **Population** | How many devices or sites that source covers | `68 devices · 6 networks` |
| **Freshness** | When that source last reported successfully | `last poll 40s ago` |

Two cross-source elements exist, and both correlate only on keys every source agrees on without mapping — **time** and **site identity**:

- **Shared onset rail** — a timeline across lanes, so simultaneous onsets are visible without any semantic comparison.
- **Multi-lane site count** — set intersection on site IDs: how many sites currently have faults in two or more lanes. No thresholds, no taxonomy.

This page supplies the source, population and freshness figures, plus the per-collector state that lets a lane render as *quiet* rather than *healthy* when its collector has stopped reporting. **A silent lane must never read as a clean lane** — that distinction is this page's main contribution to the org page's honesty.

## 6. Data Plan

New mock file `data/monitor-health.json`, generated by a new `scripts/generate-monitor-health.js` following the existing `generate-alerts.js` / `generate-site-details.js` pattern:

- `apiPolling` — per vendor: limit, current rate, headroom, throttle events, endpoint classes with cadence/last-success/latency/error-rate, bulk vs per-device counts.
- `agents` — per agent: id, version, host, status, heartbeat, covered site and device ids, ingest rates, drop counters.
- `agentHosts` — per host: CPU, memory, disk, load, interface throughput, uptime, restarts, capacity headroom.
- `coverage` — per source: `{ sourceId, kind, devicesCovered, sitesCovered, lastSuccessfulReport, state }` where `state` is one of `reporting` / `stale` / `silent`. Keyed by source rather than by metric, since panels are source-scoped.
- `unmonitored` — device and site ids with no telemetry path.

Device-to-source assignment must be added to the existing device model so every device carries its source tier; the org page needs this for the Fleet Status source-tier level and for Explorer grouping by collector.

New `DataLoader` accessors, parallel to the existing `getSiteDetails` family: `getMonitorHealth()`, `getApiPolling(vendor)`, `getAgents()`, `getAgentHosts()`, `getCoverage(sourceId)`, `getUnmonitored()`.

`getCoverage(sourceId)` is the one the network pages call, and is the reason this spec must land before the org page's panel headers can be real rather than hardcoded.

## 7. Open Questions for Engineering

- **Published rate limits per vendor and licence tier** — the headroom figures are meaningless without the real ceilings, and they differ by tier.
- **Are agent host metrics obtainable?** Requires the collector host itself to be in the monitored inventory, which may not be true today. If not, band 4 degrades to process-level health only.
- **Agent-to-device assignment source of truth** — needed for blast radius and orphan detection. Whether this is configuration we hold or must be inferred from which agent last reported a device is unresolved.
- **Poll-cycle completion visibility** — whether the collection layer currently emits sweep start/end events, or whether this must be inferred.
