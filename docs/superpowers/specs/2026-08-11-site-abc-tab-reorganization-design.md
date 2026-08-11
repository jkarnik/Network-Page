# Site Page — All-Tab Reorganization

## 1. Purpose & Scope

Each of the three stage tabs on `site.html` (Stage A, Stage A+B, Stage A+B+C) restates device/category status three times at increasing granularity — the site identity header (counts), the Site Health strip (status per category), and the Fleet Status matrix (per-device grid) — plus, in A+B and A+B+C, domain detail widgets that restate category status a third time. Several widgets also sit at fixed heights or half-width regardless of how little content they hold. This doc fixes both problems across all three tabs — each tab gets the reorganization applied to whichever widgets it actually has.

## 2. Changes

**Site Identity header — removed entirely.** The `data-site-info` card above the tabs (name, region, gateway/switch/AP/circuit counts, total devices) is shared across all three tabs, so removing it affects all of them. `renderIdentityCard()` and its call site in `loadSiteData()` are deleted along with it. Site name and region move into the Site Health strip (below) so that identity isn't lost.

**Site Health strip — trim to 4 category metrics, add identity + clients.** For all three tabs (`-stageA`, `-stageAB`, `-stageABC`): drop Switches, Access Points, PSU Redundancy stat tiles (`healthSwitchStatus/healthApStatus/healthPsuStatus-<tab>` and their labels). Keep Uplinks, Uplink Loss, VPN Tunnels, Routing Redundancy. Add two things:
- A small identity line at the top of the card — site name + region (reusing `DataLoader.getSite(siteName)`, the same source `renderIdentityCard` used).
- A new "Clients" stat tile showing the site's total client count, from the already-loaded `site.clientCount` field (the same field powering the existing "Top Sites by Clients" leaderboard elsewhere in the app) — a site-wide total, distinct from the Wireless card's wireless-only "Active Wireless Clients" figure, so no new redundancy is introduced where both cards exist.

Rationale: device-type status now lives solely in Fleet Status; the strip becomes connectivity signals + identity + a headline client count — the "is this site okay, at a glance" layer.

**Fleet Status matrix — collapse vendor under device type.** Currently every device type always renders one row per vendor (2 rows minimum), with model rows as an optional third level. Change to a true accordion: each type renders as a single collapsed row by default (aggregate counts across its vendors, click-through to the type's device list); a chevron expands it into per-vendor rows; each vendor row's existing chevron still expands into per-model rows. This is a shared render function (`renderOneFleetGrid`) used by all three tabs, so the accordion behavior applies everywhere automatically.

**Wireless widget — drop the duplicate AP Health stat.** `wirelessApHealth-<tab>` (present in Stage A+B and A+B+C; Stage A has no Wireless card) repeats the same number Fleet Status now owns. Keep only Active Wireless Clients + Time-to-Connect.

**Height — stop reserving empty space for widgets with small, bounded content.** WAN/Uplink Detail, VPN Tunnels Detail, VLAN/Segmentation, DHCP Pool Utilization, Top Applications, and Fleet Status move from fixed heights (`h-80`, `h-[36rem]`) to content-driven height, in every tab that has them — these hold per-site row counts that are always small (a handful of circuits/tunnels/VLANs). The Site Alert Feed and the three per-category alert expanded views keep a fixed max-height with internal scroll, since alert volume is unbounded and a scroll viewport there is intentional, not wasted space.

**Width — regroup half-width widgets into thirds.** In Stage A+B and A+B+C, VPN Tunnels/BGP Flap Detector/Wireless currently sit two-per-row (plus one full-width) at half width; in A+B+C, Top Applications/VLAN/DHCP repeat the same pattern. Regroup each set into a three-across row:
- VPN Tunnels · BGP Flap Detector · Wireless (Stage A+B and A+B+C)
- Top Applications · VLAN/Segmentation · DHCP Pool Utilization (Stage A+B+C only — these widgets don't exist before Stage C)

WAN/Uplink Detail (9 columns) and Site Alert Feed stay full width in every tab.

**Order — Fleet Status moves up, Site Alert Feed moves to the end, in every tab.**

## 3. Per-Tab Layout

**Stage A** (no VPN/BGP/Wireless/Top-Apps/VLAN/DHCP widgets exist yet):
1. Site Health strip
2. Infrastructure / Security / AI Alerts (three across)
3. Fleet Status matrix
4. WAN/Uplink Detail
5. Site Alert Feed

**Stage A+B** (adds VPN Tunnels, BGP Flap Detector, Wireless):
1. Site Health strip
2. Infrastructure / Security / AI Alerts (three across)
3. Fleet Status matrix
4. WAN/Uplink Detail
5. VPN Tunnels · BGP Flap Detector · Wireless (three across)
6. Site Alert Feed

**Stage A+B+C** (adds Top Applications, VLAN/Segmentation, DHCP Pool Utilization):
1. Site Health strip
2. Infrastructure / Security / AI Alerts (three across)
3. Fleet Status matrix
4. WAN/Uplink Detail
5. VPN Tunnels · BGP Flap Detector · Wireless (three across)
6. Top Applications · VLAN/Segmentation · DHCP Pool Utilization (three across)
7. Site Alert Feed

All other changes (header removal, Site Health trim + identity/clients addition, Fleet Status accordion, height fixes) apply identically to all three tabs' existing widgets.
