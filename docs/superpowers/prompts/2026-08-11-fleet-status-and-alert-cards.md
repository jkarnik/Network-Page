# Fresh-session prompt: Fleet Status widget + Alert cards on the Site page

> Paste everything below this line as your first message in a new Claude Code session, in this repo (`Network Page`).

---

I want to extend the Site entity page (`site.html`) that was already built in a prior session. Read this whole prompt first — it has all the context and decisions already made; you shouldn't need to re-derive them.

## Where things stand

`site.html` + `assets/js/site-main.js` already exist, merged into the current branch. It's a Site entity page: a site-selector dropdown in the header, plus 3 cumulative tabs (Stage A / Stage A+B / Stage A+B+C) that each contain a full, self-contained set of widgets — Health Badge, Needs Attention panel, WAN/Uplink table, **LAN/Switching table**, **Device Inventory table**, Site Alert Feed, VPN Tunnels, BGP Flap Detector, Wireless section, Top Applications chart, VLAN/Segmentation + DHCP, Time-to-Connect breakdown, Security Intelligence. Every widget's markup is deliberately duplicated across the 3 tabs with `-stageA`/`-stageAB`/`-stageABC` id suffixes (approved-by-design, not a DRY violation to flag) so each tab stands alone as a demo of that build stage.

Design/plan docs from that build, useful for the established conventions (patterns, not requirements for this new work):
- `docs/superpowers/specs/2026-08-10-site-entity-page-widgets-design.md` — original widget catalog
- `docs/superpowers/specs/2026-08-10-site-page-implementation-design.md` — implementation design
- `docs/superpowers/plans/2026-08-10-site-page-implementation.md` — the 18-task plan that built it (each task shows the exact markup-duplication-across-3-tabs pattern in practice — follow the same pattern for new widgets)

That build was executed with `superpowers:subagent-driven-development` in an isolated worktree (created via the native `EnterWorktree` tool). `.claude/settings.local.json` already has `"worktree": {"baseRef": "head"}` set, so a fresh worktree created now will branch from current local HEAD (including all merged work) rather than a stale `origin/main`. Reuse that setup.

## What to build now

Two additions to the Site page, both **Stage A** (so they belong in all 3 tabs, like the widgets they touch):

### 1. Replace "LAN / Switching" + "Device Inventory" with a "Fleet Status" widget

Delete both existing widgets (LAN/Switching table and Device Inventory table — search `site-main.js` for `renderLanSection`/`renderDeviceInventory` and `site.html` for their card markup, in all 3 stage grids) and replace with a single **"Fleet Status"** widget matching the Summary page's existing matrix widget (`index.html` — search for `Fleet Status`, `renderFleetStatusGrid`, `showStatusDevices`, `renderStatusDeviceList` in `assets/js/index-main.js`), reusing the existing `.status-grid`/`.status-cell`/`.status-header`/`.status-group-cell`/`.status-subgroup-cell`/`.status-model-cell` CSS classes already in `assets/css/shared-styles.css` — don't write new CSS for the matrix.

**Decisions already made (don't re-ask these):**
- **No axis-flip toggle.** Fixed grouping: Type (primary/group rows) → Vendor (sub-rows), unlike the Summary page which lets you toggle Type↔Vendor. Drop the `fleetViewSelect`/`changeFleetView` toggle for this widget.
- **Chevron-expand to per-model breakdown** stays, same as Summary (clicking the chevron on a vendor sub-row expands to show counts per model).
- **Clicking a cell/row swaps the card from matrix view to a device-list view** (name/model/status/IP cards), with a close (X) button back to the matrix — same idea as Summary's `statusSummaryView`/`statusExpandedView` toggle, but **do not** replicate the Summary page's page-wide overlay mechanics (`expandedBackdrop`, hiding other widgets, `main` overflow toggling) — the Site page has no other widget competing for expansion, so keep this self-contained within the one card.
- **7 device types total**, each with its own 2-vendor set:
  - Gateways — Meraki / Mist (existing real data, via `DataLoader.getDevicesBySite`)
  - Switches — Meraki / Mist (existing real data)
  - Access Points — Meraki / Mist (existing real data)
  - **Servers** — Dell / HPE (new mock data)
  - **IP Cameras** — Axis / Hikvision (new mock data)
  - **HVAC Units** — Honeywell / Trane (new mock data)
  - **Environmental Sensors** — SensorPush / Monnit (new mock data)
- **Device links in the expanded list view:**
  - Gateway/Switch/AP cards **link to their real device pages** (`sdwan.html?device=...`, `switch.html?device=...`, `access-point.html?device=...`) — same mechanism the old Device Inventory table already used (`DEVICE_TYPE_PAGES` map in `site-main.js`, still fine to reuse).
  - Server/Camera/HVAC/Sensor cards look identical (same styling, look like clickable links) but are **non-functional** — no navigation, no dedicated pages exist for them. (E.g. `href="#"` with `event.preventDefault()`, or no click handler at all while keeping the same visual classes.)
- **New mock data lives ONLY in `data/site-details.json`** (extend `scripts/generate-site-details.js`, which already generates that file) — **do not** touch `data/devices.json` or `data/network-data.json`. Those files back the Summary page's own Fleet Status widget, the Unified Alert Feed, and other pages; adding the 4 new types there would silently change those pages too, which is explicitly NOT wanted. Keep the new device types Site-page-only.
  - Reuses the app's existing `online`/`warning`/`critical`/`offline` status vocabulary — don't invent a new one.
  - Scale counts to site size the same way existing generated data does (e.g. servers scaling with switch count, cameras/sensors scaling with AP count) — exact formulas are your call, just keep them proportionate and not identical across every site.
  - You'll need a new `DataLoader` accessor (e.g. `getAuxiliaryDevices(siteName, type)`) reading from `site-details.json`, parallel to the existing `getCircuits`/`getVpnTunnels`/etc. accessors added for the original Site page build (see Task 2 in the implementation plan for the established pattern).

### 2. Add alert summary cards, like the Summary page's Infrastructure/Security/AI Alerts cards

Reference: `index.html` lines ~100-290 (search `Infrastructure Alerts`, `Security Alerts`, `AI Alerts`) and their JS in `assets/js/index-main.js` (`showIssuesAlerts`, `showSecurityAlerts`, `showAIAlerts`, `filterIssuesAlerts`, etc.). Each is a compact card (crit/warn count, click either number to expand) that swaps in-place to a filtered, sortable, searchable alert table (Severity/Time/Site/Device/Message columns, severity filter buttons, search input) with a close (X) back to the compact view.

**Working assumption to confirm during brainstorming, not yet locked in:** add these 3 cards *alongside* the existing "Site Alert Feed" widget (Task 11 of the original plan) rather than replacing it — Summary page has both the 3 small cards AND a full "Unified Alert Feed" table, so the Site page should end up with the same shape: 3 crit/warn summary cards + the existing full alert table below. Confirm this with the user before locking the design.

**Likely-needed adaptations for site scope (confirm during brainstorming):**
- Drop the per-card "site" filter dropdown inside each expanded view (`issuesSiteFilter` etc. on Summary) — redundant since the whole page is already scoped to one site via the header's site selector.
- Map alert categories using the existing `alerts.json` `type` field (`network`, `hardware`, `performance`, `system`, `security`, `ai`) — decide with the user whether "Infrastructure" on this page means just `type === 'network'` or a broader grouping (Summary's `showIssuesAlerts` groups differently — check `index-main.js`'s exact filter logic before assuming parity).
- Reuse `DataLoader.getAlertsBySite`/`getSecurityCounts`/`getAICounts` (already used elsewhere) rather than re-deriving alert filtering logic from scratch.

## Process to follow

1. **Brainstorm first** (`superpowers:brainstorming`) — the two items above have a few open questions flagged inline ("confirm during brainstorming"); resolve those with the user before writing a spec. Everything else marked "decisions already made" is settled — don't re-ask it.
2. Write the design to a new spec doc under `docs/superpowers/specs/`, get it reviewed/approved, following the same doc-review-before-asking discipline as the rest of this repo's CLAUDE.md.
3. **Write an implementation plan** (`superpowers:writing-plans`) — task-size it the same way the original 18-task plan did (each task = one widget-sized, mechanically-transcribable unit with the exact markup/code given verbatim in the task, not left to the implementer to invent).
4. **Execute with `superpowers:subagent-driven-development`** in an isolated worktree (`superpowers:using-git-worktrees` — native `EnterWorktree` tool, `baseRef: head` already configured). Dispatch one implementer + one task reviewer per task, fix loop on findings, final whole-branch review at the end, then `superpowers:finishing-a-development-branch` to merge.
5. When merging, this branch's likely base is whatever branch is checked out when you start (check `git branch --show-current` and confirm with the user rather than assuming).

## Constraints carried over from the original Site page build (still apply)

- No click-to-expand **trend/chart** overlays (sparklines are inline, fixed-window) — this doesn't block the Fleet Status matrix's click-to-expand-to-device-list interaction, which is a different, already-approved pattern (mirrors Summary page), not a trend overlay.
- Device status vocabulary is always the app's existing `online`/`warning`/`critical`/`offline` enum — never introduce a different one for the new device types.
- This project has no test framework (no `package.json`, no build step) — verify with `node --check` on changed JS files and manual/Playwright browser checks against a local server (`python3 -m http.server 8000`), same as the original build's verification approach.
