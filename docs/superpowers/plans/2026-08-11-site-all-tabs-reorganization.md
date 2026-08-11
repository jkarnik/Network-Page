# Site Page All-Tab Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant header/health-strip/fleet-matrix status chain on the Site page, collapse the Fleet Status matrix's vendor rows under device type by default, and regroup sparse widgets into space-efficient rows — applied to all three stage tabs (Stage A, Stage A+B, Stage A+B+C).

**Architecture:** No build tooling — this is a vanilla multi-page app. All changes are direct edits to `site.html` (markup, per stage tab, each duplicated 3x with a `-stageA`/`-stageAB`/`-stageABC` id suffix) and `assets/js/site-main.js` (rendering logic, mostly shared across all three tabs via a `STAGE_TABS` loop). No new files, no new dependencies.

**Tech Stack:** Plain HTML, Tailwind utility classes (via CDN, no build step), vanilla JS, Chart.js (already loaded). No test framework exists in this repo — verification is manual: serve the page locally, open it in a browser, and check the specific behavior each task describes, plus grep-based checks that no dangling ID/function references were left behind.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-11-site-abc-tab-reorganization-design.md` — every task below implements one paragraph of that spec.
- Branch: work happens on `sites-v2` (already checked out). Commit after every task.
- Site data comes from `DataLoader` (`assets/js/data-loader.js`), already loaded by the time any renderer in `site-main.js` runs. `DataLoader.getSite(siteName)` returns `{ id, name, region, deviceCount, clientCount, health }` — confirmed against `data/network-data.json`.
- `setText(id, text)` (site-main.js:99) is null-safe — it no-ops if the element doesn't exist. Any `document.querySelector('[data-site-...]')` call is NOT null-safe (throws on missing element) — these must be deleted, not left in place, wherever their target markup is removed.
- Height fix convention used throughout: drop the fixed `h-80` / `h-[36rem]` class from the outer card, and give the inner scrollable region a `max-h-*` + `overflow-auto`/`overflow-y-auto` class instead of `flex-1` (which needs a fixed-height ancestor to mean anything). Use `max-h-96` for Fleet Status, `max-h-72` for WAN/Uplink, VPN Tunnels, and VLAN/Segmentation (all small, bounded per-site lists — a scroll cap guards against an unusually large mock dataset, but none of these are expected to scroll in normal use). DHCP Pool Utilization and Top Applications have fixed-cardinality content (5 bars; one chart + legend) and don't need a cap, just natural sizing.
- Verify each task by serving the repo root (`python3 -m http.server 8000` or the `run` skill if available) and opening `http://localhost:8000/site.html` in a browser, then opening the browser console — zero errors is required before moving to the next task.

---

## Task 1: Remove the Site Identity header

**Files:**
- Modify: `site.html` (the `data-site-info` card, currently between `<div class="max-w-[1920px] mx-auto">` and the tabs nav)
- Modify: `assets/js/site-main.js` (`renderIdentityCard` function and its call site)

**Interfaces:**
- Produces: nothing new. This task only deletes.
- Consumes: nothing.

- [ ] **Step 1: Remove the header markup from `site.html`**

Delete this entire block (it sits right after `<div class="max-w-[1920px] mx-auto">` and right before `<!-- Tabs Navigation -->`):

```html
            <!-- Site Identity Card (persistent, unaffected by tab selection) -->
            <div class="card p-4 bg-dark-card border-l-4 border-green-500 mb-0" data-site-info>
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-building text-gray-400 text-lg"></i>
                        <div>
                            <h2 class="text-lg font-bold text-dark-text" data-site-name>—</h2>
                            <p class="text-xs text-gray-500" data-site-region>—</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-8 text-sm">
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400">Gateways:</span>
                            <span class="font-mono text-gray-700 dark:text-gray-300" data-site-gateway-count>—</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400">Switches:</span>
                            <span class="font-mono text-gray-700 dark:text-gray-300" data-site-switch-count>—</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400">APs:</span>
                            <span class="font-mono text-gray-700 dark:text-gray-300" data-site-ap-count>—</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs text-gray-400">WAN Circuits:</span>
                            <span class="font-mono text-gray-700 dark:text-gray-300" data-site-circuit-count>—</span>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="text-right">
                            <p class="text-xs text-gray-400 mb-0.5">Total Devices</p>
                            <p class="font-mono text-lg font-bold text-dark-text" data-site-device-count>—</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tabs Navigation -->
```

Replace it with just:

```html
            <!-- Tabs Navigation -->
```

(i.e. delete everything from `<!-- Site Identity Card... -->` through the closing `</div>` of that card, keeping the `<!-- Tabs Navigation -->` comment that follows it.)

- [ ] **Step 2: Remove `renderIdentityCard` from `site-main.js`**

Delete this function (site-main.js:29-46):

```js
// --- SITE IDENTITY CARD (persistent, stage-independent) ---
function renderIdentityCard(siteName) {
    const site = DataLoader.getSite(siteName);
    if (!site) return;

    document.querySelector('[data-site-name]').textContent = siteName;
    document.querySelector('[data-site-region]').textContent = site.region || '—';

    const gateways = DataLoader.getDevicesBySite(siteName, 'gateways');
    const switches = DataLoader.getDevicesBySite(siteName, 'switches');
    const aps = DataLoader.getDevicesBySite(siteName, 'accessPoints');

    document.querySelector('[data-site-gateway-count]').textContent = gateways.length;
    document.querySelector('[data-site-switch-count]').textContent = switches.length;
    document.querySelector('[data-site-ap-count]').textContent = aps.length;
    document.querySelector('[data-site-circuit-count]').textContent = DataLoader.getCircuits(siteName).length;
    document.querySelector('[data-site-device-count]').textContent = gateways.length + switches.length + aps.length;
}
```

- [ ] **Step 3: Remove its call site**

In `loadSiteData` (site-main.js:67-75), delete the `renderIdentityCard(siteName);` line:

```js
async function loadSiteData(siteName) {
    await DataLoader.load();
    await DataLoader.loadSiteDetails();

    renderAllTabs(siteName);

    themeManager.registerCharts(charts);
}
```

- [ ] **Step 4: Verify**

Run `grep -n "renderIdentityCard\|data-site-name\|data-site-region\|data-site-gateway-count\|data-site-switch-count\|data-site-ap-count\|data-site-circuit-count\|data-site-device-count" site.html assets/js/site-main.js` — expect zero matches. Serve the page, load any site, confirm the header card is gone above the tabs and the browser console shows no errors.

- [ ] **Step 5: Commit**

```bash
git add site.html assets/js/site-main.js
git commit -m "Remove Site Identity header from site page"
```

---

## Task 2: Site Health strip — trim to 4 category metrics, add identity + clients

**Files:**
- Modify: `site.html` (Site Health card, once per tab: `stageA`, `stageAB`, `stageABC`)
- Modify: `assets/js/site-main.js` (`renderHealthBadge`)

**Interfaces:**
- Produces: three new element ids per tab — `healthSiteName-<tab>`, `healthSiteRegion-<tab>`, `healthClients-<tab>` — set by `renderHealthBadge`.
- Consumes: `DataLoader.getSite(siteName)` → `{ name, region, clientCount, ... }` (Task 1's removed `renderIdentityCard` used the same call).

- [ ] **Step 1: Update the Site Health card markup for Stage A**

Find (site.html, inside `#stageA-grid`):

```html
                    <!-- Health Badge (Stage A) -->
                    <div class="col-span-12 card p-4 bg-dark-card">
                        <h3 class="text-sm font-bold text-dark-text mb-3">Site Health</h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                            <div>
                                <p class="text-xs text-gray-400">Uplinks</p>
                                <p class="text-sm font-bold text-dark-text" id="healthUplinkStatus-stageA">—</p>
                                <p class="text-xs text-gray-500" id="healthUplinkThroughput-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Uplink Loss</p>
                                <p class="text-sm font-bold text-dark-text" id="healthUplinkLoss-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">VPN Tunnels</p>
                                <p class="text-sm font-bold text-dark-text" id="healthVpnStatus-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Switches</p>
                                <p class="text-sm font-bold text-dark-text" id="healthSwitchStatus-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Access Points</p>
                                <p class="text-sm font-bold text-dark-text" id="healthApStatus-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">PSU Redundancy</p>
                                <p class="text-sm font-bold text-dark-text" id="healthPsuStatus-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Routing Redundancy</p>
                                <p class="text-sm font-bold text-dark-text" id="healthRoutingRedundancy-stageA">—</p>
                            </div>
                        </div>
                        <div class="mt-3" style="height: 50px;">
                            <canvas id="healthUplinkSparkline-stageA"></canvas>
                        </div>
                    </div>
```

Replace with:

```html
                    <!-- Health Badge (Stage A) -->
                    <div class="col-span-12 card p-4 bg-dark-card">
                        <div class="flex items-center justify-between mb-3">
                            <h3 class="text-sm font-bold text-dark-text">Site Health</h3>
                            <div class="text-right">
                                <span class="text-sm font-bold text-dark-text" id="healthSiteName-stageA">—</span>
                                <span class="text-xs text-gray-500 ml-1" id="healthSiteRegion-stageA">—</span>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            <div>
                                <p class="text-xs text-gray-400">Uplinks</p>
                                <p class="text-sm font-bold text-dark-text" id="healthUplinkStatus-stageA">—</p>
                                <p class="text-xs text-gray-500" id="healthUplinkThroughput-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Uplink Loss</p>
                                <p class="text-sm font-bold text-dark-text" id="healthUplinkLoss-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">VPN Tunnels</p>
                                <p class="text-sm font-bold text-dark-text" id="healthVpnStatus-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Routing Redundancy</p>
                                <p class="text-sm font-bold text-dark-text" id="healthRoutingRedundancy-stageA">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Clients</p>
                                <p class="text-sm font-bold text-dark-text" id="healthClients-stageA">—</p>
                            </div>
                        </div>
                        <div class="mt-3" style="height: 50px;">
                            <canvas id="healthUplinkSparkline-stageA"></canvas>
                        </div>
                    </div>
```

- [ ] **Step 2: Repeat Step 1 for Stage A+B**

Same find/replace as Step 1, with every `-stageA` suffix changed to `-stageAB` (both in the find text and the replacement — the block is otherwise identical, including the comment `<!-- Health Badge (Stage A) -->`, which stays as-is since it's a copy-paste artifact already present in the file for this tab).

- [ ] **Step 3: Repeat Step 1 for Stage A+B+C**

Same find/replace again, with every `-stageA` suffix changed to `-stageABC`.

- [ ] **Step 4: Update `renderHealthBadge` in `site-main.js`**

Find (site-main.js:173-198):

```js
function renderHealthBadge(siteName) {
    const circuitSummary = computeCircuitSummary(siteName);
    const vpnSummary = computeVpnSummary(siteName);
    const switches = statusCounts(DataLoader.getDevicesBySite(siteName, 'switches'));
    const aps = statusCounts(DataLoader.getDevicesBySite(siteName, 'accessPoints'));
    const hardware = DataLoader.getHardwareRollup(siteName);
    // Each flagged device counts as exactly one failed PSU (of its 2) — a
    // simplification for the mock rollup, not a claim about real PSU counts.
    const psuOk = hardware.psuTotal - hardware.psuFailedDeviceIds.length;
    const routingPaths = circuitSummary.up + vpnSummary.up;
    const routingTotal = circuitSummary.total + vpnSummary.total;

    STAGE_TABS.forEach(tab => {
        setText(`healthUplinkStatus-${tab}`, `${circuitSummary.up}/${circuitSummary.total} up`);
        setText(`healthUplinkThroughput-${tab}`, `${circuitSummary.totalUp}/${circuitSummary.totalDown} Mbps`);
        setText(`healthUplinkLoss-${tab}`, `${circuitSummary.maxLoss.toFixed(2)}% loss`);
        setText(`healthVpnStatus-${tab}`, `${vpnSummary.up}/${vpnSummary.total} up`);
        setText(`healthSwitchStatus-${tab}`, formatStatusCounts(switches));
        setText(`healthApStatus-${tab}`, formatStatusCounts(aps));
        setText(`healthPsuStatus-${tab}`, `${psuOk}/${hardware.psuTotal} OK`);
        setText(`healthRoutingRedundancy-${tab}`, `${routingPaths}/${routingTotal} paths available`);
        if (circuitSummary.primary) {
            renderSparkline(`healthUplinkSparkline-${tab}`, circuitSummary.primary.latencyTrend, '#3b82f6');
        }
    });
}
```

Replace with:

```js
function renderHealthBadge(siteName) {
    const site = DataLoader.getSite(siteName);
    const circuitSummary = computeCircuitSummary(siteName);
    const vpnSummary = computeVpnSummary(siteName);
    const routingPaths = circuitSummary.up + vpnSummary.up;
    const routingTotal = circuitSummary.total + vpnSummary.total;

    STAGE_TABS.forEach(tab => {
        setText(`healthSiteName-${tab}`, siteName);
        setText(`healthSiteRegion-${tab}`, site?.region || '—');
        setText(`healthClients-${tab}`, `${(site?.clientCount || 0).toLocaleString()} clients`);
        setText(`healthUplinkStatus-${tab}`, `${circuitSummary.up}/${circuitSummary.total} up`);
        setText(`healthUplinkThroughput-${tab}`, `${circuitSummary.totalUp}/${circuitSummary.totalDown} Mbps`);
        setText(`healthUplinkLoss-${tab}`, `${circuitSummary.maxLoss.toFixed(2)}% loss`);
        setText(`healthVpnStatus-${tab}`, `${vpnSummary.up}/${vpnSummary.total} up`);
        setText(`healthRoutingRedundancy-${tab}`, `${routingPaths}/${routingTotal} paths available`);
        if (circuitSummary.primary) {
            renderSparkline(`healthUplinkSparkline-${tab}`, circuitSummary.primary.latencyTrend, '#3b82f6');
        }
    });
}
```

This drops the `switches`/`aps`/`hardware`/`psuOk` computations entirely — nothing else in this function used them. `renderWirelessSection` (Task 3) computes its own AP status separately today; that computation is deleted in Task 3, not here.

- [ ] **Step 5: Verify**

Run `grep -n "healthSwitchStatus\|healthApStatus\|healthPsuStatus" site.html assets/js/site-main.js` — expect zero matches. Serve the page, load a site, confirm the Site Health card on every tab shows the site name + region top-right, five stat tiles (Uplinks, Uplink Loss, VPN Tunnels, Routing Redundancy, Clients), and the console has no errors. Switch between all three tabs to confirm each one renders correctly.

- [ ] **Step 6: Commit**

```bash
git add site.html assets/js/site-main.js
git commit -m "Trim Site Health strip to connectivity metrics, add identity and client count"
```

---

## Task 3: Wireless widget — drop the duplicate AP Health stat

**Files:**
- Modify: `site.html` (Wireless card, once per tab: `stageAB`, `stageABC` — Stage A has no Wireless card)
- Modify: `assets/js/site-main.js` (`renderWirelessSection`)

**Interfaces:**
- Produces: nothing new.
- Consumes: nothing new — `wirelessActiveClients-<tab>` already exists and is untouched.

- [ ] **Step 1: Update the Wireless card markup for Stage A+B**

Find (site.html, inside `#stageAB-grid`):

```html
                    <!-- Wireless (Stage A+B; Time-to-Connect added in Stage C) -->
                    <div class="col-span-12 lg:col-span-6 card p-4 bg-dark-card">
                        <h3 class="text-sm font-bold text-dark-text mb-3">Wireless</h3>
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <p class="text-xs text-gray-400">AP Health</p>
                                <p class="text-sm font-bold text-dark-text" id="wirelessApHealth-stageAB">—</p>
                            </div>
                            <div>
                                <p class="text-xs text-gray-400">Active Wireless Clients</p>
                                <p class="text-sm font-bold text-dark-text" id="wirelessActiveClients-stageAB">—</p>
                            </div>
                        </div>
                    </div>
```

Replace with:

```html
                    <!-- Wireless (Stage A+B; Time-to-Connect added in Stage C) -->
                    <div class="col-span-12 lg:col-span-6 card p-4 bg-dark-card">
                        <h3 class="text-sm font-bold text-dark-text mb-3">Wireless</h3>
                        <div>
                            <p class="text-xs text-gray-400">Active Wireless Clients</p>
                            <p class="text-sm font-bold text-dark-text" id="wirelessActiveClients-stageAB">—</p>
                        </div>
                    </div>
```

(Task 6 will change this card's column span from `lg:col-span-6` to `lg:col-span-4` — leave the span as-is for now, that's out of scope for this task.)

- [ ] **Step 2: Repeat Step 1 for Stage A+B+C**

Same find/replace, with every `-stageAB` suffix changed to `-stageABC`. Note the Stage A+B+C version of this card also has a `<div id="timeToConnectContainer-stageABC" class="mt-4"></div>` line immediately after the stat block — leave that line untouched, it's not part of this find/replace.

- [ ] **Step 3: Update `renderWirelessSection` in `site-main.js`**

Find (site-main.js:426-434):

```js
function renderWirelessSection(siteName) {
    const aps = statusCounts(DataLoader.getDevicesBySite(siteName, 'accessPoints'));
    const activeClients = DataLoader.getClientCountByType('accessPoints', siteName);

    ['stageAB', 'stageABC'].forEach(tab => {
        setText(`wirelessApHealth-${tab}`, formatStatusCounts(aps));
        setText(`wirelessActiveClients-${tab}`, `${activeClients} clients`);
    });
}
```

Replace with:

```js
function renderWirelessSection(siteName) {
    const activeClients = DataLoader.getClientCountByType('accessPoints', siteName);

    ['stageAB', 'stageABC'].forEach(tab => {
        setText(`wirelessActiveClients-${tab}`, `${activeClients} clients`);
    });
}
```

- [ ] **Step 4: Verify**

Run `grep -n "wirelessApHealth" site.html assets/js/site-main.js` — expect zero matches. Serve the page, switch to Stage A+B and Stage A+B+C, confirm the Wireless card shows only "Active Wireless Clients" and the console has no errors.

- [ ] **Step 5: Commit**

```bash
git add site.html assets/js/site-main.js
git commit -m "Drop duplicate AP Health stat from Wireless card"
```

---

## Task 4: Fleet Status matrix — collapse vendor rows under device type

**Files:**
- Modify: `assets/js/site-main.js` (`renderOneFleetGrid`, plus a new `toggleFleetTypeExpand` and a new `fleetTypeExpandedKeys` state map)

No `site.html` changes in this task — the grid container markup (`fleetStatusGrid-<tab>`, class `status-grid`) is unchanged; only what JS renders inside it changes. No CSS changes either — the existing `.status-group-cell` / `.status-subgroup-cell` / `.status-model-cell` classes are reused as-is.

**Interfaces:**
- Produces: `toggleFleetTypeExpand(siteName, tab, typeKey)` — toggles whether a device type's vendor rows are shown, then re-renders.
- Consumes: existing `FLEET_TYPES`, `FLEET_STATUS_COLS`, `FLEET_STATUS_FILTER_MAP`, `getFleetDevices(siteName, type)`, `fleetStatusCounts(devices)`, `getFleetModels(siteName, type, vendor)`, `stripVendorPrefix(model, vendorLabel)`, `showFleetDeviceList(tab, typeKey, statusKey, vendorKey, model)`, `fleetExpandedKeys` (all already defined in site-main.js, unchanged by this task).

**Behavior change:** today, every device type always renders one row per vendor (2 rows minimum) with model rows as an optional third level, toggled via a chevron on the vendor row. After this task, each type renders as a single collapsed row by default — showing aggregate counts across all its vendors — with its own chevron that reveals the per-vendor rows underneath. The existing per-vendor chevron (revealing per-model rows) is unchanged.

- [ ] **Step 1: Replace `renderOneFleetGrid` and add the type-level toggle**

Find (site-main.js — this spans from the `fleetExpandedKeys` declaration through the end of the existing `toggleFleetExpand` function):

```js
const fleetExpandedKeys = { stageA: new Set(), stageAB: new Set(), stageABC: new Set() };
const fleetListState = { stageA: null, stageAB: null, stageABC: null };
```

Replace with (adds one new state map, `fleetExpandedKeys` line itself unchanged):

```js
const fleetExpandedKeys = { stageA: new Set(), stageAB: new Set(), stageABC: new Set() };
const fleetTypeExpandedKeys = { stageA: new Set(), stageAB: new Set(), stageABC: new Set() };
const fleetListState = { stageA: null, stageAB: null, stageABC: null };
```

Then find the full body of `renderOneFleetGrid` together with `toggleFleetExpand` immediately after it:

```js
function renderOneFleetGrid(siteName, tab) {
    const grid = document.getElementById(`fleetStatusGrid-${tab}`);
    if (!grid) return;
    grid.innerHTML = '';

    const addCell = (text, classes) => {
        const div = document.createElement('div');
        div.className = classes;
        div.innerHTML = text;
        grid.appendChild(div);
        return div;
    };

    addCell('Type', 'status-cell status-header');
    addCell('Vendor', 'status-cell status-header');
    FLEET_STATUS_COLS.forEach(s => addCell(s.label, 'status-cell status-header ' + s.headerClass));

    FLEET_TYPES.forEach(type => {
        let totalSubRows = type.vendors.length;
        type.vendors.forEach(vendor => {
            const expandKey = `${type.key}-${vendor.key}`;
            if (fleetExpandedKeys[tab].has(expandKey)) {
                totalSubRows += getFleetModels(siteName, type, vendor).length;
            }
        });

        const groupCell = addCell(type.label, 'status-cell status-group-cell clickable text-dark-muted');
        groupCell.style.gridRow = `span ${totalSubRows}`;
        groupCell.onclick = () => showFleetDeviceList(tab, type.key, 'all', null);

        type.vendors.forEach(vendor => {
            const expandKey = `${type.key}-${vendor.key}`;
            const isExpanded = fleetExpandedKeys[tab].has(expandKey);
            const devices = getFleetDevices(siteName, type).filter(d => d.vendor === vendor.key);
            const counts = fleetStatusCounts(devices);

            const chevron = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
            const subCell = addCell(
                `<span class="flex items-center gap-1.5"><i class="fa-solid ${chevron} text-[9px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 -m-1 z-10 relative" data-expand-key="${expandKey}"></i><span class="hover:underline">${vendor.label}</span></span>`,
                'status-cell status-subgroup-cell clickable text-dark-muted'
            );
            subCell.onclick = (e) => {
                if (e.target.closest('i[data-expand-key]')) {
                    toggleFleetExpand(siteName, tab, expandKey);
                } else {
                    showFleetDeviceList(tab, type.key, 'all', vendor.key);
                }
            };

            FLEET_STATUS_COLS.forEach(s => {
                const val = counts[s.key] || 0;
                const cell = addCell(val, 'status-cell clickable ' + s.cellClass);
                cell.onclick = () => showFleetDeviceList(tab, type.key, FLEET_STATUS_FILTER_MAP[s.key], vendor.key);
            });

            if (isExpanded) {
                const models = getFleetModels(siteName, type, vendor);
                models.forEach(model => {
                    const modelDevices = devices.filter(d => d.model === model);
                    const modelCounts = fleetStatusCounts(modelDevices);
                    const shortModel = stripVendorPrefix(model, vendor.label);
                    const modelCell = addCell(`<span class="hover:underline">${SharedUI.escapeHtml(shortModel)}</span>`, 'status-cell status-model-cell clickable text-left');
                    modelCell.onclick = () => showFleetDeviceList(tab, type.key, 'all', vendor.key, model);
                    FLEET_STATUS_COLS.forEach(s => {
                        const val = modelCounts[s.key] || 0;
                        const cell = addCell(val || '', 'status-cell status-model-cell clickable ' + (val > 0 ? s.cellClass : ''));
                        cell.onclick = () => showFleetDeviceList(tab, type.key, FLEET_STATUS_FILTER_MAP[s.key], vendor.key, model);
                    });
                });
            }
        });
    });
}

function toggleFleetExpand(siteName, tab, expandKey) {
    if (fleetExpandedKeys[tab].has(expandKey)) {
        fleetExpandedKeys[tab].delete(expandKey);
    } else {
        fleetExpandedKeys[tab].add(expandKey);
    }
    renderOneFleetGrid(siteName, tab);
}
```

Replace with:

```js
function renderOneFleetGrid(siteName, tab) {
    const grid = document.getElementById(`fleetStatusGrid-${tab}`);
    if (!grid) return;
    grid.innerHTML = '';

    const addCell = (text, classes) => {
        const div = document.createElement('div');
        div.className = classes;
        div.innerHTML = text;
        grid.appendChild(div);
        return div;
    };
    const addBlankCell = () => addCell('', 'status-cell');

    addCell('Type', 'status-cell status-header');
    addCell('Vendor', 'status-cell status-header');
    FLEET_STATUS_COLS.forEach(s => addCell(s.label, 'status-cell status-header ' + s.headerClass));

    FLEET_TYPES.forEach(type => {
        const typeExpanded = fleetTypeExpandedKeys[tab].has(type.key);
        const allDevices = getFleetDevices(siteName, type);
        const aggCounts = fleetStatusCounts(allDevices);

        const typeChevron = typeExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
        const typeCell = addCell(
            `<span class="flex items-center gap-1.5"><i class="fa-solid ${typeChevron} text-[9px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 -m-1 z-10 relative" data-type-expand-key="${type.key}"></i><span class="hover:underline">${type.label}</span></span>`,
            'status-cell status-group-cell clickable text-dark-muted'
        );
        typeCell.style.gridColumn = 'span 2';
        typeCell.onclick = (e) => {
            if (e.target.closest('i[data-type-expand-key]')) {
                toggleFleetTypeExpand(siteName, tab, type.key);
            } else {
                showFleetDeviceList(tab, type.key, 'all', null);
            }
        };

        FLEET_STATUS_COLS.forEach(s => {
            const val = aggCounts[s.key] || 0;
            const cell = addCell(val, 'status-cell clickable ' + s.cellClass);
            cell.onclick = () => showFleetDeviceList(tab, type.key, FLEET_STATUS_FILTER_MAP[s.key], null);
        });

        if (!typeExpanded) return;

        type.vendors.forEach(vendor => {
            const expandKey = `${type.key}-${vendor.key}`;
            const isExpanded = fleetExpandedKeys[tab].has(expandKey);
            const devices = allDevices.filter(d => d.vendor === vendor.key);
            const counts = fleetStatusCounts(devices);

            addBlankCell();
            const chevron = isExpanded ? 'fa-chevron-down' : 'fa-chevron-right';
            const subCell = addCell(
                `<span class="flex items-center gap-1.5"><i class="fa-solid ${chevron} text-[9px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 -m-1 z-10 relative" data-expand-key="${expandKey}"></i><span class="hover:underline">${vendor.label}</span></span>`,
                'status-cell status-subgroup-cell clickable text-dark-muted'
            );
            subCell.onclick = (e) => {
                if (e.target.closest('i[data-expand-key]')) {
                    toggleFleetExpand(siteName, tab, expandKey);
                } else {
                    showFleetDeviceList(tab, type.key, 'all', vendor.key);
                }
            };

            FLEET_STATUS_COLS.forEach(s => {
                const val = counts[s.key] || 0;
                const cell = addCell(val, 'status-cell clickable ' + s.cellClass);
                cell.onclick = () => showFleetDeviceList(tab, type.key, FLEET_STATUS_FILTER_MAP[s.key], vendor.key);
            });

            if (isExpanded) {
                const models = getFleetModels(siteName, type, vendor);
                models.forEach(model => {
                    const modelDevices = devices.filter(d => d.model === model);
                    const modelCounts = fleetStatusCounts(modelDevices);
                    const shortModel = stripVendorPrefix(model, vendor.label);

                    addBlankCell();
                    const modelCell = addCell(`<span class="hover:underline">${SharedUI.escapeHtml(shortModel)}</span>`, 'status-cell status-model-cell clickable text-left');
                    modelCell.onclick = () => showFleetDeviceList(tab, type.key, 'all', vendor.key, model);
                    FLEET_STATUS_COLS.forEach(s => {
                        const val = modelCounts[s.key] || 0;
                        const cell = addCell(val || '', 'status-cell status-model-cell clickable ' + (val > 0 ? s.cellClass : ''));
                        cell.onclick = () => showFleetDeviceList(tab, type.key, FLEET_STATUS_FILTER_MAP[s.key], vendor.key, model);
                    });
                });
            }
        });
    });
}

function toggleFleetTypeExpand(siteName, tab, typeKey) {
    if (fleetTypeExpandedKeys[tab].has(typeKey)) {
        fleetTypeExpandedKeys[tab].delete(typeKey);
    } else {
        fleetTypeExpandedKeys[tab].add(typeKey);
    }
    renderOneFleetGrid(siteName, tab);
}

function toggleFleetExpand(siteName, tab, expandKey) {
    if (fleetExpandedKeys[tab].has(expandKey)) {
        fleetExpandedKeys[tab].delete(expandKey);
    } else {
        fleetExpandedKeys[tab].add(expandKey);
    }
    renderOneFleetGrid(siteName, tab);
}
```

Note on the `typeCell.style.gridColumn = 'span 2'` line: the grid's column template is `auto auto repeat(4, 1fr)` (6 tracks — Type, Vendor, then 4 status columns; see `assets/css/shared-styles.css:120`). A collapsed type row now emits exactly 6 column-widths (the spanning label cell = 2, plus 4 status cells = 4), and every vendor/model row emits exactly 6 as well (one blank filler cell + one label cell + 4 status cells) — so CSS grid's normal row auto-flow lines everything up correctly with no explicit `gridRow` assignments anywhere, unlike the old code.

- [ ] **Step 2: Verify**

Serve the page, open the Fleet Status widget on any tab. Confirm: every device type shows as a single collapsed row with aggregate counts; clicking a type's chevron reveals its per-vendor rows (each still with its own chevron); clicking a vendor's chevron reveals per-model rows as before; clicking any row's label or any status-count cell opens the correct filtered device list (compare against the vendor/model filters implied by which row you clicked). No console errors. Check this on all three tabs, since `renderOneFleetGrid` is shared.

- [ ] **Step 3: Commit**

```bash
git add assets/js/site-main.js
git commit -m "Collapse Fleet Status vendor rows under device type by default"
```

---

## Task 5: Move Fleet Status above WAN/Uplink, fix both widgets' height (all 3 tabs)

**Files:**
- Modify: `site.html` (WAN/Uplink Detail and Fleet Status blocks, once per tab: `stageA`, `stageAB`, `stageABC`)

Pure markup change — no JS. In every tab, WAN/Uplink Detail and Fleet Status currently appear back-to-back (WAN/Uplink first, then Fleet Status), immediately followed by Site Alert Feed. This task swaps the first two so Fleet Status comes first, and applies the height-fix convention (see Global Constraints) to both. Site Alert Feed is untouched by this task — for Stage A it's already in its final position after this swap; for Stage A+B and A+B+C, Tasks 6 and 7 relocate it further down once the widgets that will precede it exist in their final form.

**Interfaces:** none — no ids change, only classes and document order.

- [ ] **Step 1: Swap and fix height for Stage A**

Find (site.html, inside `#stageA-grid` — WAN/Uplink Detail immediately followed by Fleet Status):

```html
                    <!-- WAN/Uplink Detail (Stage A) -->
                    <div class="col-span-12 card p-0 bg-dark-card flex flex-col h-80">
                        <div class="p-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 class="text-sm font-bold text-dark-text">WAN / Uplink</h3>
                        </div>
                        <div class="flex-1 overflow-auto custom-scrollbar">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Device</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">ISP</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Tier</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Type</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Status</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Throughput ↑/↓</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Latency</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Loss</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Cellular</th>
                                    </tr>
                                </thead>
                                <tbody id="circuitsTableBody-stageA"></tbody>
                            </table>
                        </div>
                    </div>
                    <!-- Fleet Status (Stage A) -->
                    <div class="col-span-12 card p-4 bg-dark-card flex flex-col h-[36rem] overflow-hidden">
                        <div id="fleetMatrixView-stageA" class="h-full flex flex-col">
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="text-sm font-bold text-dark-text">Fleet Status</h3>
                                <span class="text-[10px] text-newrelic-cyan font-medium bg-newrelic-cyan/20 px-2 py-0.5 rounded flex items-center gap-1">
                                    <i class="fa-solid fa-hand-pointer text-[8px]"></i> Click cells
                                </span>
                            </div>
                            <div class="flex-1 overflow-y-auto custom-scrollbar">
                                <div id="fleetStatusGrid-stageA" class="status-grid border border-gray-200 dark:border-gray-700 w-full">
                                    <!-- Dynamically rendered by renderOneFleetGrid() -->
                                </div>
                            </div>
                        </div>
                        <div id="fleetListView-stageA" class="hidden h-full flex flex-col">
                            <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                                <div class="flex items-center gap-3">
                                    <h4 class="text-sm font-bold text-dark-text">Devices</h4>
                                    <span class="text-xs text-gray-400 dark:text-gray-500" id="fleetListCount-stageA"></span>
                                </div>
                                <button onclick="hideFleetDeviceList('stageA')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                    <i class="fa-solid fa-times text-lg"></i>
                                </button>
                            </div>
                            <div class="flex-1 overflow-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" id="fleetListGrid-stageA">
                                <!-- Populated by JS -->
                            </div>
                        </div>
                    </div>
```

Replace with (Fleet Status now first, both height-fixed):

```html
                    <!-- Fleet Status (Stage A) -->
                    <div class="col-span-12 card p-4 bg-dark-card flex flex-col">
                        <div id="fleetMatrixView-stageA" class="flex flex-col">
                            <div class="flex justify-between items-center mb-2">
                                <h3 class="text-sm font-bold text-dark-text">Fleet Status</h3>
                                <span class="text-[10px] text-newrelic-cyan font-medium bg-newrelic-cyan/20 px-2 py-0.5 rounded flex items-center gap-1">
                                    <i class="fa-solid fa-hand-pointer text-[8px]"></i> Click cells
                                </span>
                            </div>
                            <div class="max-h-96 overflow-y-auto custom-scrollbar">
                                <div id="fleetStatusGrid-stageA" class="status-grid border border-gray-200 dark:border-gray-700 w-full">
                                    <!-- Dynamically rendered by renderOneFleetGrid() -->
                                </div>
                            </div>
                        </div>
                        <div id="fleetListView-stageA" class="hidden flex flex-col">
                            <div class="flex items-center justify-between mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                                <div class="flex items-center gap-3">
                                    <h4 class="text-sm font-bold text-dark-text">Devices</h4>
                                    <span class="text-xs text-gray-400 dark:text-gray-500" id="fleetListCount-stageA"></span>
                                </div>
                                <button onclick="hideFleetDeviceList('stageA')" class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                                    <i class="fa-solid fa-times text-lg"></i>
                                </button>
                            </div>
                            <div class="max-h-96 overflow-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" id="fleetListGrid-stageA">
                                <!-- Populated by JS -->
                            </div>
                        </div>
                    </div>
                    <!-- WAN/Uplink Detail (Stage A) -->
                    <div class="col-span-12 card p-0 bg-dark-card flex flex-col">
                        <div class="p-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 class="text-sm font-bold text-dark-text">WAN / Uplink</h3>
                        </div>
                        <div class="max-h-72 overflow-auto custom-scrollbar">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Device</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">ISP</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Tier</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Type</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Status</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Throughput ↑/↓</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Latency</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Loss</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Cellular</th>
                                    </tr>
                                </thead>
                                <tbody id="circuitsTableBody-stageA"></tbody>
                            </table>
                        </div>
                    </div>
```

- [ ] **Step 2: Repeat Step 1 for Stage A+B**

Same find/replace, every `-stageA` suffix changed to `-stageAB` (including in the `onclick="hideFleetDeviceList('stageA')"` call, which becomes `onclick="hideFleetDeviceList('stageAB')"`).

- [ ] **Step 3: Repeat Step 1 for Stage A+B+C**

Same find/replace, every `-stageA` suffix changed to `-stageABC`.

- [ ] **Step 4: Verify**

Serve the page. On every tab, confirm Fleet Status now renders above WAN/Uplink, both widgets size to their content instead of leaving empty space below a short table, and Site Alert Feed is unaffected (still directly below WAN/Uplink, for now). No console errors.

- [ ] **Step 5: Commit**

```bash
git add site.html
git commit -m "Move Fleet Status above WAN/Uplink and fix both widgets' height"
```

---

## Task 6: Regroup VPN Tunnels / BGP Flap Detector / Wireless into a three-across row (Stage A+B and A+B+C)

**Files:**
- Modify: `site.html` (VPN Tunnels, BGP Flap Detector, Wireless cards in `#stageAB-grid` and `#stageABC-grid`; Site Alert Feed block in `#stageAB-grid` only)

Pure markup change — no JS. Stage A has none of these widgets, so this task doesn't touch it.

**Interfaces:** none — no ids change, only classes and, for Stage A+B, document order.

- [ ] **Step 1: Resize BGP Flap Detector and Wireless to one-third width, in both tabs at once**

BGP Flap Detector and Wireless share the exact class string `col-span-12 lg:col-span-6 card p-4 bg-dark-card` with no other classes appended, and each appears exactly once in `#stageAB-grid` and once in `#stageABC-grid` (4 occurrences total — this string appears nowhere else in the file). Find:

```html
col-span-12 lg:col-span-6 card p-4 bg-dark-card
```

Replace **all 4 occurrences** with:

```html
col-span-12 lg:col-span-4 card p-4 bg-dark-card
```

(Use a find-and-replace-all across the whole file for this exact string — every match is one of these four cards, confirmed by the file read during planning.)

- [ ] **Step 2: Resize and height-fix VPN Tunnels for Stage A+B**

Find (site.html, inside `#stageAB-grid`):

```html
                    <!-- VPN Tunnels Detail (Stage A+B) -->
                    <div class="col-span-12 lg:col-span-6 card p-0 bg-dark-card flex flex-col h-80">
                        <div class="p-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 class="text-sm font-bold text-dark-text">VPN Tunnels</h3>
                        </div>
                        <div class="flex-1 overflow-auto custom-scrollbar">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Peer</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Vendor</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Status</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Latency</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Jitter</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Loss</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Bandwidth ↑/↓</th>
                                    </tr>
                                </thead>
                                <tbody id="vpnTunnelsTableBody-stageAB"></tbody>
```

Replace with:

```html
                    <!-- VPN Tunnels Detail (Stage A+B) -->
                    <div class="col-span-12 lg:col-span-4 card p-0 bg-dark-card flex flex-col">
                        <div class="p-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 class="text-sm font-bold text-dark-text">VPN Tunnels</h3>
                        </div>
                        <div class="max-h-72 overflow-auto custom-scrollbar">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                                <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                    <tr>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Peer</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Vendor</th>
                                        <th class="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase">Status</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Latency</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Jitter</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Loss</th>
                                        <th class="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase">Bandwidth ↑/↓</th>
                                    </tr>
                                </thead>
                                <tbody id="vpnTunnelsTableBody-stageAB"></tbody>
```

- [ ] **Step 3: Repeat Step 2 for Stage A+B+C**

Same find/replace, every `-stageAB` suffix changed to `-stageABC`.

- [ ] **Step 4: Move Site Alert Feed to the end of the Stage A+B grid**

Cut this block from its current position (right after the WAN/Uplink Detail card, right before the `<!-- VPN Tunnels Detail (Stage A+B) -->` comment) inside `#stageAB-grid`:

```html
                    <!-- Site Alert Feed (Stage A) -->
                    <div class="col-span-12 card h-80 flex flex-col bg-dark-card">
                        <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 class="text-sm font-bold text-dark-text flex items-center gap-2">
                                <i class="fa-regular fa-bell"></i> Site Alert Feed
                                <span id="siteAlertCount-stageAB" class="ml-2 px-2 py-0.5 rounded text-xs font-normal bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">0 alerts</span>
                            </h3>
                        </div>
                        <div class="flex-1 overflow-auto custom-scrollbar p-0">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Severity</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Time</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Device</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Type</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Message</th>
                                    </tr>
                                </thead>
                                <tbody id="siteAlertTableBody-stageAB"></tbody>
                            </table>
                        </div>
                    </div>
```

Paste it back in immediately before the closing comment of `#stageAB-grid`:

```html
                    <!-- Widget markup appended by Tasks 7-14 -->
```

i.e. the new order at the end of `#stageAB-grid` should read: `...` → VPN Tunnels → BGP Flap Detector → Wireless → Site Alert Feed → `<!-- Widget markup appended by Tasks 7-14 -->` → closing `</div>`.

(Nothing moves in Stage A+B+C in this step — Task 7 relocates Site Alert Feed there, once Top Applications/VLAN/DHCP are in their final position.)

- [ ] **Step 5: Verify**

Serve the page. On Stage A+B: confirm VPN Tunnels, BGP Flap Detector, and Wireless render three-across on a wide viewport, VPN Tunnels no longer reserves fixed empty space, and Site Alert Feed is now the last widget on the tab. On Stage A+B+C: confirm the same three-across row, but Site Alert Feed is still in its Task-5 position (this is expected, not a bug — Task 7 fixes it). No console errors on either tab.

- [ ] **Step 6: Commit**

```bash
git add site.html
git commit -m "Regroup VPN Tunnels, BGP Flap Detector, and Wireless into a three-across row"
```

---

## Task 7: Regroup Top Applications / VLAN / DHCP into a three-across row and finalize Stage A+B+C order

**Files:**
- Modify: `site.html` (Top Applications, VLAN/Segmentation, DHCP Pool Utilization, and Site Alert Feed blocks in `#stageABC-grid` only)

Pure markup change — no JS. These three widgets only exist in Stage A+B+C, so this task doesn't touch Stage A or Stage A+B. After this task, Stage A+B+C's widget order matches the spec's final order exactly (see Per-Tab Layout in the spec).

**Interfaces:** none — no ids change, only classes and document order.

- [ ] **Step 1: Resize and height-fix Top Applications**

Find (site.html, inside `#stageABC-grid`):

```html
                    <!-- Application Visibility (Stage A+B+C) -->
                    <div class="col-span-12 lg:col-span-6 card p-4 bg-dark-card h-80">
                        <h3 class="text-sm font-bold text-dark-text mb-3">Top Applications</h3>
                        <div class="flex gap-4" style="height: calc(100% - 32px);">
                            <div class="relative flex-shrink-0" style="width: 160px; height: 160px;">
                                <canvas id="topAppsChart-stageABC"></canvas>
                            </div>
                            <div class="flex-1 overflow-auto custom-scrollbar" id="topAppsLegend-stageABC"></div>
                        </div>
                    </div>
```

Replace with:

```html
                    <!-- Application Visibility (Stage A+B+C) -->
                    <div class="col-span-12 lg:col-span-4 card p-4 bg-dark-card">
                        <h3 class="text-sm font-bold text-dark-text mb-3">Top Applications</h3>
                        <div class="flex gap-4">
                            <div class="relative flex-shrink-0" style="width: 160px; height: 160px;">
                                <canvas id="topAppsChart-stageABC"></canvas>
                            </div>
                            <div class="max-h-40 overflow-auto custom-scrollbar" id="topAppsLegend-stageABC"></div>
                        </div>
                    </div>
```

- [ ] **Step 2: Resize and height-fix VLAN/Segmentation**

Find:

```html
                    <!-- VLAN/Segmentation (Stage A+B+C) -->
                    <div class="col-span-12 lg:col-span-6 card p-0 bg-dark-card flex flex-col h-80">
                        <div class="p-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 class="text-sm font-bold text-dark-text">VLAN / Segmentation</h3>
                        </div>
                        <div class="flex-1 overflow-auto custom-scrollbar">
```

Replace with:

```html
                    <!-- VLAN/Segmentation (Stage A+B+C) -->
                    <div class="col-span-12 lg:col-span-4 card p-0 bg-dark-card flex flex-col">
                        <div class="p-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 class="text-sm font-bold text-dark-text">VLAN / Segmentation</h3>
                        </div>
                        <div class="max-h-72 overflow-auto custom-scrollbar">
```

- [ ] **Step 3: Resize DHCP Pool Utilization**

Find:

```html
                    <!-- DHCP Pool Utilization (Stage A+B+C) -->
                    <div class="col-span-12 lg:col-span-6 card p-4 bg-dark-card h-80 overflow-auto custom-scrollbar">
                        <h3 class="text-sm font-bold text-dark-text mb-3">DHCP Pool Utilization</h3>
```

Replace with:

```html
                    <!-- DHCP Pool Utilization (Stage A+B+C) -->
                    <div class="col-span-12 lg:col-span-4 card p-4 bg-dark-card overflow-auto custom-scrollbar">
                        <h3 class="text-sm font-bold text-dark-text mb-3">DHCP Pool Utilization</h3>
```

- [ ] **Step 4: Move Site Alert Feed to the end of the Stage A+B+C grid**

Cut this block from its current position (right after the WAN/Uplink Detail card, right before the `<!-- VPN Tunnels Detail (Stage A+B) -->` comment) inside `#stageABC-grid`:

```html
                    <!-- Site Alert Feed (Stage A) -->
                    <div class="col-span-12 card h-80 flex flex-col bg-dark-card">
                        <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                            <h3 class="text-sm font-bold text-dark-text flex items-center gap-2">
                                <i class="fa-regular fa-bell"></i> Site Alert Feed
                                <span id="siteAlertCount-stageABC" class="ml-2 px-2 py-0.5 rounded text-xs font-normal bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">0 alerts</span>
                            </h3>
                        </div>
                        <div class="flex-1 overflow-auto custom-scrollbar p-0">
                            <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                                    <tr>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Severity</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Time</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Device</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Type</th>
                                        <th class="px-6 py-3 text-left text-xs font-medium text-dark-muted uppercase tracking-wider">Message</th>
                                    </tr>
                                </thead>
                                <tbody id="siteAlertTableBody-stageABC"></tbody>
                            </table>
                        </div>
                    </div>
```

Paste it back in immediately before the closing comment of `#stageABC-grid`:

```html
                    <!-- Widget markup appended by Tasks 7-18 -->
```

i.e. the new order at the end of `#stageABC-grid` should read: `...` → Top Applications → VLAN/Segmentation → DHCP Pool Utilization → Site Alert Feed → `<!-- Widget markup appended by Tasks 7-18 -->` → closing `</div>`.

- [ ] **Step 5: Verify**

Serve the page, switch to Stage A+B+C. Confirm: Top Applications, VLAN/Segmentation, and DHCP Pool Utilization render three-across on a wide viewport; none of the three reserves fixed empty space below its content; Site Alert Feed is now the very last widget on the tab. Re-check the full top-to-bottom order on all three tabs against the spec's Per-Tab Layout section (`docs/superpowers/specs/2026-08-11-site-abc-tab-reorganization-design.md`, §3). No console errors on any tab.

- [ ] **Step 6: Commit**

```bash
git add site.html
git commit -m "Regroup Top Applications, VLAN/Segmentation, and DHCP Pool Utilization into a three-across row; finalize Stage A+B+C order"
```
