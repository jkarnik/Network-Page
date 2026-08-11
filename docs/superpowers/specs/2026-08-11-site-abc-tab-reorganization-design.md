# Site Page — Stage A+B+C Tab Reorganization

## 1. Purpose & Scope

The Stage A+B+C tab on `site.html` restates device/category status three times at increasing granularity — the site identity header (counts), the Site Health strip (status per category), and the Fleet Status matrix (per-device grid) — plus domain detail widgets that restate category status a third time. Several widgets also sit at fixed heights or half-width regardless of how little content they hold. This doc fixes both problems for the Stage A+B+C tab only. Stage A and Stage A+B are out of scope — they'll be rebuilt from this pattern in a later session.

## 2. Changes

**Site Identity header — removed entirely.** The `data-site-info` card above the tabs (name, region, gateway/switch/AP/circuit counts, total devices) is shared across all three tabs, so removing it affects all of them. `renderIdentityCard()` and its call site in `loadSiteData()` are deleted along with it.

**Site Health strip — trim to 4 metrics.** Drop Switches, Access Points, PSU Redundancy from the stageABC strip only (`healthSwitchStatus/healthApStatus/healthPsuStatus-stageABC` and their labels). Keep Uplinks, Uplink Loss, VPN Tunnels, Routing Redundancy + sparkline. Rationale: device-type status now lives solely in Fleet Status; the strip becomes purely about connectivity signals Fleet doesn't cover.

**Fleet Status matrix — collapse vendor under device type.** Currently every device type always renders one row per vendor (2 rows minimum), with model rows as an optional third level. Change to a true accordion: each type renders as a single collapsed row by default (aggregate counts across its vendors, click-through to the type's device list); a chevron expands it into per-vendor rows; each vendor row's existing chevron still expands into per-model rows. This is a shared render function (`renderOneFleetGrid`) used by all three tabs, so the accordion behavior applies everywhere — that's intentional, it's one component.

**Wireless widget — drop the duplicate AP Health stat.** `wirelessApHealth-stageABC` repeats the same number Fleet Status now owns. Keep only Active Wireless Clients + Time-to-Connect.

**Height — stop reserving empty space for widgets with small, bounded content.** WAN/Uplink Detail, VPN Tunnels Detail, VLAN/Segmentation, DHCP Pool Utilization, Top Applications, and Fleet Status move from fixed heights (`h-80`, `h-[36rem]`) to content-driven height — these hold per-site row counts that are always small (a handful of circuits/tunnels/VLANs). The Site Alert Feed and the three per-category alert expanded views keep a fixed max-height with internal scroll, since alert volume is unbounded and a scroll viewport there is intentional, not wasted space.

**Width — regroup half-width widgets into thirds.** Six widgets currently sit two-per-row at half width. Regroup into two three-across rows by domain affinity:
- VPN Tunnels · BGP Flap Detector · Wireless
- Top Applications · VLAN/Segmentation · DHCP Pool Utilization

WAN/Uplink Detail (9 columns) and Site Alert Feed stay full width.

**Order — Fleet Status moves up, Site Alert Feed moves to the end.** Final top-to-bottom order for the stageABC grid:

1. Site Health strip
2. Infrastructure / Security / AI Alerts (three across)
3. Fleet Status matrix
4. WAN/Uplink Detail
5. VPN Tunnels · BGP Flap Detector · Wireless (three across)
6. Top Applications · VLAN/Segmentation · DHCP Pool Utilization (three across)
7. Site Alert Feed

## 3. Out of Scope

Stage A and Stage A+B tabs keep their current layout for now. The header removal and Fleet Status accordion change are shared code/markup and apply everywhere as a side effect; everything else in this doc touches `content-stageABC` only.
