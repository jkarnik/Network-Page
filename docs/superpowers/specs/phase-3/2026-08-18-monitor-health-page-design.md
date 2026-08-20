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

### Structured by integration — failure domains are vendor-scoped

The page is organised as **one panel per integration**, because failures are independent across integrations and shared within one. Meraki's API being rate-limited tells you nothing about Mist, and a dead Mist WebSocket tells you nothing about kTranslate. The blast radius of any collection failure is the set of devices that integration observes.

Collection mode is a **subsection within a panel**, not the page's spine. An integration using several modes shows several subsections.

This is the same principle the org page applies when it rejects source lanes: grouping by mode would fragment one vendor's health across two distant sections, forcing the reader to reassemble the unit they are actually troubleshooting. There, mode-style grouping fragmented a *site*; here it would fragment a *vendor*. In both cases the right spine is the unit that fails together.

| Panel | Modes it contains | Failure domain |
|---|---|---|
| **Cisco Meraki** | Pull (REST) | All Meraki-managed devices |
| **Juniper Mist** | Pull (REST) · Push (WebSocket) | All Mist-managed devices. The two modes fail independently *of each other* — REST can be healthy while a WebSocket subscription is silently dropped — so both subsections are always shown. |
| **kTranslate** | Pull (SNMP) · Push (syslog, flow) · Agent · Host | Devices behind each agent, per agent |
| **Coverage model** | Derived from all panels | Not a failure domain — the contract other pages consume |

A future integration adds a panel with whichever mode subsections apply, and touches nothing existing.

### 2.1 Consequence: there is no meaningful cross-integration aggregate

Because failure domains are independent, blending them produces a number that describes nothing real. There is no "overall polling health" — a figure averaging a healthy Meraki against a dead Mist stream is worse than either fact on its own.

So **Band 1 is a per-integration status strip, not a blended score.** The only legitimate rollup is a worst-of indicator answering "is anything impaired at all," and it exists purely to save a glance; the per-integration rows carry the actual content. Any widget tempted to average across integrations should instead show them side by side.

## 3. Why collection mode drives the metrics

Mode does not organise the page (§2), but it entirely determines *which metrics mean anything* inside a panel. The two modes share almost no vocabulary.

### 3.1 Pull: rate limits are the binding constraint

At org altitude the constraint is not whether a vendor endpoint exists — it is whether it can be called for every device without exhausting the request budget. A metric available per-device is effectively **unavailable fleet-wide** if collecting it costs one call per device.

**The budget is per-vendor and org-scoped.** Each vendor's rate limit applies at its own organisation level, so every call we make to that org shares one pool — and pools are not shared *between* vendors. This is why the budget belongs inside a vendor panel rather than in a page-level section.

**Push traffic does not consume it.** A WebSocket is a separate transport with no request accounting, so streaming activity and resyncs are independent of the pull budget. The two modes within the Mist panel therefore compete for nothing.

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
- **Per-integration status rows — the primary content.** One row per integration: its state, devices and sites covered, and which of its mode subsections are impaired. Independent failure domains are shown side by side, never blended (§2.1).
- A worst-of indicator: *healthy / degraded / blind* — **blind** when any source is `silent`, **degraded** when any is `stale`, using the per-source states of §5. Deliberately coarse; it answers "is anything impaired at all" and nothing more. ("Fragmented" is not used; it belonged to the retired cross-source parity vocabulary.)

### Band 1b — Monitoring-edge incident roots

The widget the org summary page hands off to. The org page classifies a cluster as a visibility incident and stops there; this is where it gets diagnosed.

- One row per monitoring-rooted incident cluster: the root collector, the host it runs on, counts of affected devices and sites, cluster onset, and the collector's current ingest state.
- Expands to the full picture the org page deliberately withholds — affected devices **grouped by site**, so the shape of the blindness is visible (one site dark vs. forty sites partially dark are very different problems); the collector's host health; ingest counters and drop/timeout rates; and last-successful-report time per affected device.
- **Site shape is the discriminator worth surfacing.** A network fault is site-shaped; a collector fault spans sites. When a collector's affected set happens to align with a single site, that ambiguity is real and should be called out rather than resolved automatically — it is exactly the case where an engineer must look at both pages.
- Cross-reference is bidirectional: the org page links here for diagnosis, and each row here links back to the affected sites on `site.html`.

### Band 2 — Integration panels

One panel per integration, ordered worst-state first so an impaired integration surfaces without scrolling. Each panel carries only the mode subsections that integration actually uses, plus a header stating its devices and sites covered.

The subsections below are **templates**, defined once and reused wherever the mode appears — this is what keeps a new integration additive.

#### Subsection template — Pull mode

- **Request rate vs published limit**, with headroom % and a short trend. The single most important number in a pull panel. Per-vendor and org-scoped (§3.1), so it is never compared across panels.
- **Throttle events** (HTTP 429 / backoff) over time, with which endpoint class triggered them.
- **Poll cycle completion** — did the last full inventory sweep finish, and how long did it take? A sweep that no longer completes within its cadence is the leading indicator of coverage decay.
- **Per-endpoint-class table**: endpoint, cadence, last success, last failure, average latency, error rate.
- **Budget allocation** — which endpoint classes consume this vendor's request budget, and therefore which org-page widgets compete for it. Makes the trade-off explicit when someone asks for a new metric.
- **Bulk vs per-device call ratio**, per §3.1.

#### Subsection template — Push mode

- **Connection**: state, uptime, reconnect count over a window, current backoff. A flapping connection is worse than a cleanly-down one and must be distinguishable from it.
- **Subscriptions table**: channel, subscribed/confirmed/dropped, message rate against baseline, **last message age**, sequence gaps where the protocol exposes them. Per-channel granularity is the point — a healthy connection with one dead channel is the failure this table exists to catch.
- **Snapshot recency**: time since last full reconciliation, and whether a resync is needed or in progress. Flag prominently when drift risk is elevated. Resyncs do not consume the pull budget (§3.1).
- **Consumer lag**: queue depth and drop counters.

#### Panel composition

**Cisco Meraki** — Pull subsection only.

**Juniper Mist** — Pull and Push subsections. Both always shown, because REST health and WebSocket subscription health fail independently of each other: REST can be green while a subscription has silently dropped, and that combination is invisible if either subsection is hidden when the other is healthy.

**kTranslate** — Pull (SNMP), Push (syslog and flow), plus two subsections unique to an integration we operate ourselves:

- *Agent fleet* — inventory table (agent id, version, host, sites and devices covered, status, last heartbeat); ingest health per agent (flows/sec, SNMP polls/sec, syslog messages/sec, and their failure counterparts: dropped flows, SNMP timeouts, syslog queue depth); **orphaned devices**, whose assigned agent is dead or unassigned, and which are therefore at risk of being silently counted healthy; and **blast radius per agent** — a precomputed count of sites and devices that go dark if that agent fails. Precomputed deliberately: it is the number you want *during* an incident, not one you want to derive under pressure.
- *Host hardware* — the agent process is only as healthy as the box under it. Per host: CPU, memory, disk, load average; throughput on the collection interface; process uptime and restart count; and **capacity headroom**, answering "can I add sites to this collector?" Host metrics may themselves arrive via SNMP or a host agent; see §7.

Note that the agent's Pull and Push subsections describe the agent's *own* collection from devices — SNMP polling is pull, syslog and flow ingestion is push — and carry the same ambiguity risk as any stream (§3.3).

### Band 3 — Coverage model

Not a failure domain, so it sits outside the integration panels. The live version of the source-capability analysis, and the contract other pages read:

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

- `integrations` — one entry per integration: `{ integrationId, label, modes[], devicesCovered, sitesCovered, state }`. `modes` lists which subsections the panel renders, so a new integration is a data addition rather than a layout change.
- `pullHealth` — keyed by integration: limit, current rate, headroom, throttle events, endpoint classes with cadence/last-success/latency/error-rate, bulk vs per-device counts. Limits are per-vendor org-scoped and must not be summed across integrations.
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
- **Do we get per-subscription acknowledgement from the Mist WebSocket?** The Push subsection's subscription table depends on distinguishing *subscribed* from *server-confirmed*. If the protocol gives no confirmation, a dropped subscription can only be inferred from message-rate decay against baseline, which is slower and noisier.
- **Does the stream expose sequence numbers or explicit drop signals?** Without them, silent message loss is undetectable and snapshot recency becomes the only defence — which raises the required reconciliation frequency.
- **What is the resync mechanism and its cost?** Snapshot recency is only actionable if a resync can be triggered. Confirmed not to compete with the pull request budget, so the remaining question is latency and whether a resync can be initiated on demand or only on reconnect.
- **Baseline message rates per channel** — needed before "arrival rate against baseline" means anything. These may have to be learned rather than configured, and a learned baseline is wrong during the learning window.
