# Site Page — Revision Considerations

> **Status: decision input, not an approved design.** Catalogues where `site.html` now conflicts with the architecture settled in `2026-08-19-org-summary-page-redesign-design.md`, and where it stands to gain from it. Nothing here is scheduled. No implementation should start from this document; it exists so the conflicts are visible before the org page is built, not after.

## 1. Recommendation on sequencing

**Build the org page first, then revise the site page.** Reasoning:

- The site page revision is mostly about **consuming the same new data layer** — `topology.json`, `incidents.json`, and the traversal accessors. Whichever page is built first pays the cost of getting that layer right.
- The org page is greenfield. It has no existing behaviour to preserve, so mistakes in the data model surface as design questions rather than regressions. The site page has three working stage tabs and a body of established interaction patterns; discovering the data model is wrong *there* means unpicking working code.
- Revising the site page now would mean revising it twice — once against this document, and again once the org page implementation shows what the shared accessors actually need to look like.

The honest counter-argument: the site page is smaller and already exists, so it would be a cheaper proving ground for the topology model, and its port-level detail (see §3.2) exercises the graph harder than the org page does. If the priority is validating the topology data model quickly rather than shipping org-level triage, that ordering is defensible. **The tradeoff is real and this is a scheduling call, not a technical one.**

## 2. Conflicts — where the site page now contradicts the architecture

These are not enhancements. Left alone, the two pages will describe the same fleet in incompatible terms.

### 2.1 Device state vocabulary — direct contradiction

The site page uses `online` / `warning` / `critical` / `offline`, and its build spec deliberately maps Meraki's `alerting` onto `warning`. The org page uses **three states only**, with `warning` derived from *"an open NR incident exists for this entity"* and `critical` not existing at all.

So the same device can read `critical` on the site page and `warning` on the org page. Options:

1. **Site page adopts the three-state model.** Consistent, and `warning` becomes source-independent. Cost: loses the visual distinction between "degraded" and "badly degraded" that `critical` currently provides, unless NR incident priority is surfaced separately to recover it.
2. **Keep four states on the site page only.** Cheaper now, but two pages then disagree about what a device's state *is*, which is the worst of the options.

Recommend (1), with NR incident priority shown as a separate attribute rather than folded into the state. **This is the single most important item in this document** — it is a correctness problem, not a polish problem.

### 2.2 "Alerts" on the site page are actually events

The site page has three *Alert* summary cards (Infrastructure / Security / AI) and a *Site Alert Feed*, all fed from `alerts.json`. Under the settled architecture that file is the **event** layer — raw vendor and collector output — while *alerts* means open NR incidents.

The site page is therefore counting events and calling them alerts, and its three cards partition events by `type`, which is vendor vocabulary. Implications:

- The cards should either be relabelled as event views, or re-based onto NR incidents.
- If re-based onto incidents, the Infrastructure/Security/AI split may not survive, since that categorisation comes from the event `type` field rather than from anything NR owns.
- The feed at the bottom is genuinely an event feed and only needs relabelling plus a source column.

### 2.3 Routing Redundancy is a guess that can now be computed

The Site Health strip shows *"2/2 paths available"*, described in the original spec as **"derived client-side from uplink+tunnel status — no data of its own."** Port-level topology makes real redundancy decidable: a device's uplink ports terminating on *distinct* upstream devices is redundant; two ports landing on the *same* upstream device is not.

This is a strict improvement — replace the derived indicator with the computed one. It also means the current indicator can be **wrong today** in the specific case that matters most (dual uplinks into a single upstream switch), which is worth knowing before anyone relies on it.

### 2.4 Fleet Status grouping diverges

The site page groups **type → vendor → model**. The org page groups **role → vendor → model**, with collection method as an attribute column rather than a grouping level, specifically because grouping by vendor above role scatters a mixed-vendor site's stack.

That argument applies *more* strongly on the site page, since a single site is exactly where the mixed stack lives — a Palo Alto gateway, Meraki switches and Mist APs. Aligning to role-first is recommended. The site page's seven "types" also include auxiliary devices (servers, cameras, HVAC, sensors), which map onto the `auxiliary` role.

### 2.5 No notion of collection method

The site page shows no indication of how each device is observed. With mixed-vendor sites as the normal case, **collection method determines which metrics exist for which device at that site** — SLE for the Mist APs, interface error detail for the SNMP-polled gateway, and no CPU/memory for the API-managed devices at org-scale polling budgets.

Without it, the page shows blanks with no explanation for why one device has a metric its neighbour lacks.

### 2.6 The DHCP caveat is now out of date

The original spec included DHCP Pool Utilization with an explicit note that it is *"marked 'Not staged — blocked' with no viable bulk data path on either vendor"* and is mock data only. That assessment predates the kTranslate lens: **SNMP gives DHCP scope utilisation** where the DHCP server is agent-monitored. The widget is viable for part of the fleet, and the caveat should be corrected rather than carried forward — it currently understates what is achievable and would mislead the engineering conversation it was written to inform.

The same correction applies to PoE budget.

## 3. Opportunities — what the site page gains

### 3.1 Incident-root nesting belongs here more than on the org page

The dependency chain is a **site-scoped** structure. `gateway → distribution port → 12 APs` is entirely a within-site story, and the org page only shows the collapsed one-line version of it.

So the site page is the natural home for the *expanded* view: the site's dependency tree with incidents attached, root highlighted, affected subtree visible, unaffected siblings dimmed. The org page answers *which sites have a problem and roughly why*; the site page should answer *exactly what is broken and what sits behind it*.

This is the highest-value addition in this document, and it needs no new data beyond what the org page already requires.

### 3.2 Port-level state has an existing home — the switch faceplate

`switch.html` already has a **Front Panel View (Port Faceplate)** widget. With ports as first-class graph nodes carrying their own state and incidents, that faceplate can show, per port: link state, error/discard rate, the incident if one is open, and **what is downstream of it**.

That turns an inventory diagram into a diagnostic one — click the amber port, see the three APs behind it. It is the single best expression of port-level topology anywhere in the app, and it already has the UI.

Note this lands on `switch.html`, now under the Devices header, rather than on `site.html` — but it is the same data model change, so the two should be planned together.

### 3.3 SPOF risk, scoped to one site

The org page ranks SPOF risk fleet-wide. Per-site, the same computation answers a question a site owner actually acts on: *"if this one device or port fails, what goes dark here?"* Pure topology, no telemetry, so it works regardless of collection method.

### 3.4 Monitoring coverage for this site

Which devices at this site have no telemetry source at all. These are the devices most likely to be silently assumed healthy, and the site page is where someone can actually do something about it. Sources from the same coverage model the Monitor Health page owns.

### 3.5 Redundancy detail

Beyond the corrected strip indicator (§2.3), the site page has room for the *why*: which uplink pairs are genuinely independent, which share an upstream device, and which single ports carry disproportionate load.

## 4. Open questions

1. **Does the site page keep a client count?** It was removed from the org page as not adding value. At site scope the argument is different — "240 clients here" is useful context, and a single site-level figure avoids the cross-tier summation problem that made the fleet-wide number indefensible. But the derivation question stands: wireless-associated, wired, or all, and from which source. **Needs a decision; I have no strong view.**
2. **Do the three stage tabs survive the revision?** They exist to drive a data-availability sequencing conversation. If that conversation has served its purpose, collapsing to a single page would remove a large amount of triplicated markup. If it has not, they stay. This is a product call.
3. **Does `critical` survive anywhere in the app?** Two device pages and the site page use it today. Retiring it on the site page while `switch.html` and `sdwan.html` keep it trades one inconsistency for another. The scope of the vocabulary change may be wider than the site page.
4. **Where does Monitor Health sit in the nav?** The nav is now Summary / Sites / Devices. Monitor Health is a fourth top-level concern and does not belong under any of the three. Unresolved.
5. **Does the site page's "User Experience Score" need source scoping?** SLE is API-side only. A site whose APs are agent-monitored has no SLE at all, so the widget needs a stated scope or an explicit empty state rather than rendering a blank score.

## 5. What this document deliberately does not do

- **No layout proposals.** Band structure, widget placement and sizing are out of scope until the conflicts in §2 are resolved — several of them change what the widgets contain, which must be settled before deciding where they sit.
- **No staging assignments.** Those depend on decisions in §4.
- **No recommendation to start work.** §1 recommends the opposite.
