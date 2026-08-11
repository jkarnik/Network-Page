# Fleet Status Widget + Alert Summary Cards — Site Page Design

## Overview

Two Stage A additions to `site.html`:

1. A **Fleet Status** matrix widget, replacing the LAN/Switching table and Device Inventory table.
2. Three **alert summary cards** (Infrastructure / Security / AI), added alongside the existing Site Alert Feed.

Both are Stage A, so both are duplicated across all 3 stage tabs (`-stageA`/`-stageAB`/`-stageABC`), per the established pattern from the original Site page build.

## 1. Fleet Status widget

### Placement

- Removes: LAN/Switching card (`col-span-12 lg:col-span-6`) and Device Inventory card (`col-span-12`), in all 3 stage grids.
- WAN/Uplink card (currently `col-span-12 lg:col-span-6`, paired with LAN/Switching) becomes `col-span-12` full width, since its sibling is gone.
- Fleet Status card is inserted where Device Inventory was — full width (`col-span-12`), directly after WAN/Uplink, before Site Alert Feed.

### Grouping & data

- Fixed grouping: Type (group rows) → Vendor (sub-rows). No axis-flip toggle — the Summary page's `fleetViewSelect`/`changeFleetView` toggle is not carried over.
- 7 device types, 2 vendors each:
  - Gateways — Meraki / Mist (real data via `DataLoader.getDevicesBySite`)
  - Switches — Meraki / Mist (real data)
  - Access Points — Meraki / Mist (real data)
  - Servers — Dell / HPE (new mock data)
  - IP Cameras — Axis / Hikvision (new mock data)
  - HVAC Units — Honeywell / Trane (new mock data)
  - Environmental Sensors — SensorPush / Monnit (new mock data)
- Status columns: Healthy / Warning / Critical / Offline, using the existing `online`/`warning`/`critical`/`offline` vocabulary.
- Reuses `.status-grid`/`.status-cell`/`.status-header`/`.status-group-cell`/`.status-subgroup-cell`/`.status-model-cell` CSS as-is — no new CSS.

### Interactions

- Chevron on a vendor sub-row expands to per-model counts, mirroring the Summary page's `toggleFleetExpand`.
- Clicking a group cell, vendor sub-row, status cell, or model cell swaps the card's own view from matrix to device list — scoped to this one card (e.g. `statusSummaryView-{tab}` / `statusExpandedView-{tab}` ids), not a page-wide overlay. No `expandedBackdrop`, no `main` overflow toggling.
- Device list view: name/model/status/IP cards, filtered by whatever was clicked (type/status/vendor/model). A close (X) button returns to the matrix.
- Gateway/Switch/AP entries in the device list link to `sdwan.html?device=`, `switch.html?device=`, `access-point.html?device=` respectively (reusing the existing `DEVICE_TYPE_PAGES` map).
- Server/Camera/HVAC/Sensor entries are styled identically but are non-functional — no navigation (e.g. no `href`/click handler, or `href="#"` with `preventDefault()`).

## 2. Mock auxiliary device data

### Generator

- `scripts/generate-site-details.js` gains a per-site step adding 4 new device arrays: `servers`, `ipCameras`, `hvacUnits`, `environmentalSensors`.
- Scaling: servers scale off switch count, cameras and sensors scale off AP count, HVAC units scale off a small site-size-derived value — all proportionate to site size, not identical across every site. Exact multipliers are an implementation detail.
- Each device object: `{ id, name, vendor, model, status, ip }`. Status is drawn from the existing `online`/`warning`/`critical`/`offline` vocabulary, weighted mostly online with occasional warning/critical, consistent with how the rest of this generator seeds status.
- Output written into `data/site-details.json`, under each site's existing block, as a new `auxiliaryDevices` object: `{ servers: [...], ipCameras: [...], hvacUnits: [...], environmentalSensors: [...] }`.
- `data/devices.json` and `data/network-data.json` are untouched — the new device types exist only in `site-details.json`, so no other page's data changes.

### DataLoader accessor

- New `DataLoader.getAuxiliaryDevices(siteName, type)`, reading `getSiteDetails(siteName)?.auxiliaryDevices?.[type] || []` — parallel to the existing `getCircuits`/`getVpnTunnels`/`getBgpFlaps` accessors.
- The Fleet Status renderer in `site-main.js` computes vendor/status/model counts for these 4 types directly from this array. It does not need scope-flexible helpers like the Summary page's `getDeviceStatusCountsByVendor` (which operate over region/global scope) — the Site page is always scoped to one site.

## 3. Alert summary cards

### Placement

- 3 new cards — Infrastructure, Security, AI — inserted as a new row directly after the Needs Attention panel and before WAN/Uplink, in all 3 stage grids.
- Sizing: `col-span-12 sm:col-span-6 lg:col-span-4` each (3 across on wide screens), same card chrome as the Summary page's alert cards (crit/warn counts + icon, `p-4 bg-dark-card`).

### Data

- **Infrastructure**: alerts at this site where `type` is `network`, `hardware`, `performance`, or `system` — excludes `security`/`ai`, so the 3 cards are mutually exclusive (a deliberate change from the Summary page, where its "Infrastructure Alerts" card counts every alert regardless of type and therefore overlaps with Security/AI). New helper, e.g. `DataLoader.getInfrastructureCounts(siteName)`, filtering `getAlertsBySite(siteName)`.
- **Security**: `DataLoader.getSecurityCounts(siteName)` — already accepts a site name as scope; no change needed.
- **AI**: `DataLoader.getAICounts(siteName)` — same; no change needed.

### Interactions

- Clicking a crit/warn number expands the card in-place to a table (Severity / Time / Device / Message columns — no Site column, since the page is already scoped to one site) with severity filter buttons (All/Critical/Warning/Info) and a search box.
- No per-card site-filter dropdown — redundant given the page's own site selector.
- Expansion is self-contained to the card, same non-overlay approach as Fleet Status — no `expandedBackdrop`, no `main` overflow toggling.
- Close (X) returns to the compact crit/warn view.
- The existing "Site Alert Feed" widget (from the original Site page build) is unchanged and stays further down the page.

## Out of scope / constraints carried over

- No click-to-expand trend/chart overlays — unrelated to this work; sparklines remain inline, fixed-window.
- Device status vocabulary stays `online`/`warning`/`critical`/`offline` for the new device types — no new vocabulary introduced.
- No test framework in this project. Verify with `node --check` on changed JS files, plus manual/Playwright browser checks against a local server (`python3 -m http.server 8000`).
