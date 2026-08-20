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

### Structured by collection mode, not by vendor

The page is organised around **how** data is collected, with each integration appearing under whichever mode or modes it uses. This is deliberate and matters more than it first appears:

- **An integration can use several modes at once.** Mist uses REST polling for inventory *and* a WebSocket for real-time streaming. A vendor-per-section layout would either split Mist across two sections or force one section to describe two structurally different health models.
- **New integrations are additive.** A future integration slots into existing modes rather than requiring a new page section — the same vendor-additive principle the org page follows.
- **The failure modes are properties of the mode, not the vendor.** Rate-limit exhaustion is a pull problem. Silent subscription loss is a push problem. Grouping by mode puts each failure mode where its metrics live.

| Mode | Integrations today | Why it's here |
|---|---|---|
| **Pull** — request/response on a cadence | Meraki REST, Mist REST, kTranslate SNMP polling | Rate limits are the binding constraint on what the org page can show at all. This is where that budget is visible. |
| **Push** — server-initiated stream | Mist WebSocket, kTranslate syslog + flow ingestion | Absence of data is ambiguous rather than an error. See §3.2. |
| **Agent** — a process we operate | kTranslate agent fleet and its host hardware | The agent is a single point of failure for every device behind it. Its host running out of disk is a network-visibility incident. |
| **Coverage model** | Derived from all of the above | The machine-readable output other pages consume to label their panels honestly. |

## 3. Why collection mode drives the design

### 3.1 Pull: rate limits are the binding constraint

At org altitude the constraint is not whether a vendor endpoint exists — it is whether it can be called for every device without exhausting the request budget. A metric available per-device is effectively **unavailable fleet-wide** if collecting it costs one call per device.

This is why CPU and memory are agent-strong but API-impractical at org scope: SNMP polls them cheaply in bulk, while the API path needs a per-device call. The page therefore tracks **bulk vs per-device call ratio** as a headline figure, because that ratio is what decides which org-page widgets are viable.

### 3.2 Push: absence of data is ambiguous

Almost none of the §3.1 pull-mode metrics have a push-mode equivalent. There is no request rate, no rate-limit headroom, no poll cycle to complete. Adding a WebSocket as a row in the polling table would leave every meaningful column blank and every real failure mode unmeasured.

**The defining difference: with polling, absence of data is an error. With push, absence of data is ambiguous** — either nothing is happening, or the stream is dead. A failed request announces itself; a silent subscription does not.

That produces a characteristic failure the pull model simply does not have:

> **Stale state looks like current state.** A polled value carries implicit freshness — you know when it was fetched. A streamed value's freshness is unbounded: it is as old as the last event, which may legitimately be hours ago, or may be hours ago because the connection dropped and never re-synced. Everything reads connected and green while the view has silently diverged from reality.

So for push sources the page must track:

| Signal | Why it matters |
|---|---|
| **Connection state and uptime** | Continuous, not discrete — connected / reconnecting / disconnected, rather than "did the last cycle finish". |
| **Reconnect count and backoff state** | A flapping connection is *worse* than a cleanly-down one, because it yields partial data while appearing to work. Reconnect storms are a real failure mode. |
| **Per-subscription state** | A stream carries subscriptions to channels. You can be connected while subscribed to nothing. **This is the sneakiest failure — connection green, subscription silently dropped, no data, no error** — and it is the push analogue of "did the poll cycle complete". Track: subscribed, server-confirmed, and dropped. |
| **Message arrival rate against baseline** | The only way to make silence meaningful. Needs a per-channel expected-rate baseline. |
| **Heartbeat / keepalive and last-message age** | The only reliable way to distinguish *quiet* from *dead*. Last-message-at is required per channel, not just per connection. |
| **Sequence gaps** | Polling re-reads state and is therefore self-healing; a stream that drops a message has lost it permanently unless it re-syncs. Where the protocol exposes sequence numbers or drop signals, gaps mean silent data loss. |
| **Consumer lag / backpressure** | If events arrive faster than we process them, queue depth grows and we lag or drop. No pull-mode analogue. |
| **Snapshot recency** | Streams deliver deltas, so after any disconnect a snapshot is needed to re-establish state. **Time since last full reconciliation is the direct measure of drift risk** and is the most important single number for a push source. |

### 3.3 This gap already existed

The WebSocket question exposes something the original version of this spec under-specified: **kTranslate's syslog and flow ingestion are already push.** A device that stops sending syslog looks quiet in exactly the same ambiguous way, and flow volume dropping to zero is indistinguishable from a genuinely idle site. So push-mode health is not a Mist-specific addition — it applies retroactively to a collection path already in use, and the signals above should be applied to syslog and flow ingestion as well as to WebSockets.

### 3.4 Silence must raise an incident

Per the org page design, device state derives from open NR incidents, which means a source going silent must produce one — otherwise the devices behind it read `online` and the fleet renders green at the moment visibility is lost.

For pull sources this is a failed-request condition. **For push sources the condition must be heartbeat- or baseline-based**, since no request fails: *"no message on this subscription for longer than its expected interval."* Without that, a dropped subscription is invisible to every network page. This is a requirement on the alerting configuration, not something the dashboard can compensate for.

## 4. Widgets

### Band 1 — Trust summary

A compact posture row, the page's own headline:

- Devices by source tier — API-managed / agent-monitored / unmonitored, as counts and share.
- Collectors down or degraded, with the count of devices behind them.
- Worst-case API rate-limit headroom across vendors.
- Number of metrics currently at reduced coverage.
- Overall verdict: *healthy / degraded / blind* — **blind** when any source is `silent`, **degraded** when any source is `stale`, using the per-source states of §5. ("Fragmented" is deliberately not used; it belonged to the retired cross-source parity vocabulary.)

### Band 1b — Monitoring-edge incident roots

The widget the org summary page hands off to. The org page classifies a cluster as a visibility incident and stops there; this is where it gets diagnosed.

- One row per monitoring-rooted incident cluster: the root collector, the host it runs on, counts of affected devices and sites, cluster onset, and the collector's current ingest state.
- Expands to the full picture the org page deliberately withholds — affected devices **grouped by site**, so the shape of the blindness is visible (one site dark vs. forty sites partially dark are very different problems); the collector's host health; ingest counters and drop/timeout rates; and last-successful-report time per affected device.
- **Site shape is the discriminator worth surfacing.** A network fault is site-shaped; a collector fault spans sites. When a collector's affected set happens to align with a single site, that ambiguity is real and should be called out rather than resolved automatically — it is exactly the case where an engineer must look at both pages.
- Cross-reference is bidirectional: the org page links here for diagnosis, and each row here links back to the affected sites on `site.html`.

### Band 2 — Pull-mode health (per integration)

One panel per vendor (Meraki, Mist), each showing:

- **Request rate vs published limit**, with headroom % and a short trend. The single most important number on the page.
- **Throttle events** (HTTP 429 / backoff) over time, with which endpoint class triggered them.
- **Poll cycle completion** — did the last full inventory sweep finish, and how long did it take? A sweep that no longer completes within its cadence is the leading indicator of coverage decay.
- **Per-endpoint-class table**: endpoint, cadence, last success, last failure, average latency, error rate.
- **Budget allocation** — which endpoint classes consume the request budget, and therefore which org-page widgets are competing for it. Makes the trade-off explicit when someone asks for a new metric.
- **Bulk vs per-device call ratio**, per §3.

### Band 2b — Push-mode health (per stream)

One panel per streaming source — Mist WebSocket today, syslog and flow ingestion likewise, future integrations additively. Each shows:

- **Connection**: state, uptime, reconnect count over a window, current backoff.
- **Subscriptions table**: channel, subscribed/confirmed/dropped, message rate against baseline, **last message age**, sequence gaps if the protocol exposes them. The per-channel granularity is the point — a healthy connection with one dead channel is the failure this table exists to catch.
- **Snapshot recency**: time since last full reconciliation, and whether a resync is currently needed or in progress. Flag prominently when drift risk is elevated.
- **Consumer lag**: queue depth and drop counters.

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

- `apiPolling` — per pull integration: limit, current rate, headroom, throttle events, endpoint classes with cadence/last-success/latency/error-rate, bulk vs per-device counts.
- `agents` — per agent: id, version, host, status, heartbeat, covered site and device ids, ingest rates, drop counters.
- `agentHosts` — per host: CPU, memory, disk, load, interface throughput, uptime, restarts, capacity headroom.
- `coverage` — per source: `{ sourceId, integration, mode, devicesCovered, sitesCovered, state, freshness }` where `mode` is `pull` / `push` / `agent` and `state` is one of `reporting` / `stale` / `silent`. Keyed by source rather than by metric, since panels are source-scoped.
  - For `pull` sources, `freshness` is `{ lastSuccessfulReport }`.
  - For `push` sources, `freshness` is `{ lastMessageAt, lastSnapshotAt, expectedIntervalMs }` — **`lastSuccessfulReport` has no meaning for a stream**, and a push source with a recent `lastMessageAt` but a stale `lastSnapshotAt` is `stale`, not `reporting`, because its state may have drifted.
- `streams` — per streaming source: `{ sourceId, connectionState, uptimeMs, reconnectCount, backoffMs, queueDepth, dropCount, subscriptions[] }` where each subscription is `{ channel, state, messageRate, baselineRate, lastMessageAt, sequenceGaps }` and `state` is `subscribed` / `confirmed` / `dropped`.
- `unmonitored` — device and site ids with no telemetry path.

Device-to-source assignment must be added to the existing device model so every device carries its source tier; the org page needs this for the Fleet Status source-tier level and for Explorer grouping by collector.

New `DataLoader` accessors, parallel to the existing `getSiteDetails` family: `getMonitorHealth()`, `getApiPolling(vendor)`, `getAgents()`, `getAgentHosts()`, `getCoverage(sourceId)`, `getUnmonitored()`.

`getCoverage(sourceId)` is the one the network pages call, and is the reason this spec must land before the org page's panel headers can be real rather than hardcoded.

## 7. Open Questions for Engineering

- **Published rate limits per vendor and licence tier** — the headroom figures are meaningless without the real ceilings, and they differ by tier.
- **Are agent host metrics obtainable?** Requires the collector host itself to be in the monitored inventory, which may not be true today. If not, band 4 degrades to process-level health only.
- **Agent-to-device assignment source of truth** — needed for blast radius and orphan detection. Whether this is configuration we hold or must be inferred from which agent last reported a device is unresolved.
- **Poll-cycle completion visibility** — whether the collection layer currently emits sweep start/end events, or whether this must be inferred.
- **Do we get per-subscription acknowledgement from the Mist WebSocket?** Band 2b's subscription table depends on distinguishing *subscribed* from *server-confirmed*. If the protocol gives no confirmation, a dropped subscription can only be inferred from message-rate decay against baseline, which is slower and noisier.
- **Does the stream expose sequence numbers or explicit drop signals?** Without them, silent message loss is undetectable and snapshot recency becomes the only defence — which raises the required reconciliation frequency.
- **What is the resync mechanism and its cost?** Snapshot recency is only actionable if a resync can be triggered. If a full snapshot is expensive or rate-limited, it competes with the pull-mode request budget in §3.1, and the two modes stop being independent.
- **Baseline message rates per channel** — needed before "arrival rate against baseline" means anything. These may have to be learned rather than configured, and a learned baseline is wrong during the learning window.
