# Shared Assets Documentation

This directory contains shared CSS and JavaScript modules used across all dashboard pages.

## Directory Structure

```
assets/
├── css/
│   └── shared-styles.css    # Common styles for all pages
└── js/
    ├── chart-config.js      # Chart.js configuration and utilities
    ├── navigation.js        # Navigation management
    └── theme-manager.js     # Dark/light mode management
```

## Modules Overview

### 1. shared-styles.css

Common CSS styles used across all dashboard pages.

**Includes**:
- Body styling and page animations
- Card component styles
- Custom scrollbar styling
- Timeline/event components
- Signal bars (for cellular widgets)
- Gauge overlays
- Status grid components
- Expandable widget overlays
- Chart interaction styles

**Usage**:
```html
<link rel="stylesheet" href="assets/css/shared-styles.css">
```

**CSS Classes Available**:
- `.card` - Standard card container with hover effects
- `.custom-scrollbar` - Styled scrollbar for overflow containers
- `.timeline-item` - Event timeline item
- `.timeline-dot` - Timeline dot indicator
- `.signal-bar` - Signal strength bar
- `.signal-active` - Active signal bar
- `.gauge-value` - Gauge chart value overlay
- `.gauge-label` - Gauge chart label overlay
- `.status-grid` - Status matrix grid container
- `.status-cell` - Status grid cell
- `.status-header` - Status grid header
- `.expanded-backdrop` - Modal backdrop for expanded widgets
- `.expanded` - Expanded widget state

---

### 2. theme-manager.js

Manages dark/light mode toggling and persistence.

**Global Instance**: `themeManager`

**Methods**:

#### `toggle()`
Toggle between light and dark mode.
```javascript
// Called automatically by theme toggle button
// Can also be called manually
themeManager.toggle();
```

#### `registerCharts(chartsObject)`
Register Chart.js instances for automatic theme updates.
```javascript
const charts = {
    health: Chart instance,
    latency: Chart instance,
    // ... more charts
};

themeManager.registerCharts(charts);
```

#### `updateChartColors()`
Update all registered charts with current theme colors.
```javascript
themeManager.updateChartColors();
```

#### `getTheme()`
Get current theme ('light' or 'dark').
```javascript
const currentTheme = themeManager.getTheme();
console.log(currentTheme); // 'dark' or 'light'
```

#### `isDarkMode()`
Check if dark mode is active.
```javascript
if (themeManager.isDarkMode()) {
    console.log('Dark mode is active');
}
```

**Example Usage**:
```javascript
// Initialize charts
const charts = {};
charts.myChart = new Chart(ctx, config);

// Register with theme manager
themeManager.registerCharts(charts);

// Update colors if dark mode is already active
if (themeManager.isDarkMode()) {
    themeManager.updateChartColors();
}
```

---

### 3. chart-config.js

Centralized Chart.js configuration and utilities.

**Global Object**: `ChartConfig`

**Properties**:

#### `colors`
Theme-specific color schemes.
```javascript
ChartConfig.colors.light  // { text, grid, background }
ChartConfig.colors.dark   // { text, grid, background }
```

#### `palette`
Chart color palette.
```javascript
ChartConfig.palette.blue      // '#3b82f6'
ChartConfig.palette.green     // '#10b981'
ChartConfig.palette.red       // '#ef4444'
// ... more colors
```

**Methods**:

#### `initDefaults()`
Initialize Chart.js defaults.
```javascript
function initCharts() {
    ChartConfig.initDefaults();
    // ... create charts
}
```

#### `applyTheme(isDark)`
Apply theme colors to Chart.js.
```javascript
ChartConfig.applyTheme(true);  // Apply dark theme
ChartConfig.applyTheme(false); // Apply light theme
```

#### `getTooltipConfig(options)`
Get common tooltip configuration.
```javascript
const tooltipConfig = ChartConfig.getTooltipConfig({
    borderColor: ChartConfig.palette.blue,
    displayColors: false
});
```

#### `getLegendConfig(options)`
Get common legend configuration.
```javascript
const legendConfig = ChartConfig.getLegendConfig({
    position: 'bottom',
    fontSize: 10
});
```

#### `createLineDataset(label, data, color, options)`
Create a line chart dataset configuration.
```javascript
const dataset = ChartConfig.createLineDataset(
    'Latency',
    [10, 20, 15, 30, 25],
    ChartConfig.palette.blue,
    { fill: true, tension: 0.4 }
);
```

#### `createDoughnutDataset(data, colors, options)`
Create a doughnut chart dataset configuration.
```javascript
const dataset = ChartConfig.createDoughnutDataset(
    [45, 25, 30],
    [ChartConfig.palette.blue, ChartConfig.palette.green, ChartConfig.palette.red],
    { borderWidth: 0 }
);
```

#### `hexToRgba(hex, alpha)`
Convert hex color to rgba.
```javascript
const rgba = ChartConfig.hexToRgba('#3b82f6', 0.5);
// Returns: 'rgba(59, 130, 246, 0.5)'
```

#### `getTimeScaleConfig(options)`
Get common time-based scale configuration.
```javascript
const scales = ChartConfig.getTimeScaleConfig({
    displayX: true,
    displayY: true,
    beginAtZero: true,
    yCallback: (value) => value + 'ms'
});
```

#### `getGaugeOptions(cutout)`
Get gauge chart options.
```javascript
const options = ChartConfig.getGaugeOptions('70%');
```

**Example Usage**:
```javascript
// Initialize defaults
ChartConfig.initDefaults();

// Create a line chart with helper
const chart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [
            ChartConfig.createLineDataset(
                'Upload',
                [10, 20, 15],
                ChartConfig.palette.blue,
                { fill: true }
            ),
            ChartConfig.createLineDataset(
                'Download',
                [30, 40, 35],
                ChartConfig.palette.green,
                { fill: true }
            )
        ]
    },
    options: {
        plugins: {
            tooltip: ChartConfig.getTooltipConfig(),
            legend: ChartConfig.getLegendConfig()
        },
        scales: ChartConfig.getTimeScaleConfig({
            yCallback: (v) => v + ' Mbps'
        })
    }
});
```

---

### 4. navigation.js

Manages navigation state and active page highlighting.

**Global Object**: `NavigationManager`

**Methods**:

#### `init(activePage)`
Initialize navigation with the current active page.
```javascript
// For Summary page (index.html)
NavigationManager.init('summary');

// For SD-WAN page (sdwan.html)
NavigationManager.init('sdwan');

// For Switch page
NavigationManager.init('switch');

// For Access Point page
NavigationManager.init('ap');
```

#### `setActivePage(activePage)`
Set the active page in navigation (called by `init`).
```javascript
NavigationManager.setActivePage('sdwan');
```

#### `getCurrentScope()`
Get current selected scope from selector.
```javascript
const scope = NavigationManager.getCurrentScope();
console.log(scope); // 'Global', 'North America', 'site:NYC-HQ', etc.
```

**Example Usage**:
```javascript
// In your page's main script
NavigationManager.init('summary');

// Later, if you need to check the scope
const currentScope = NavigationManager.getCurrentScope();
updateDashboardData(currentScope);
```

---

## Complete Integration Example

Here's a complete example of how to use all modules together in a new page:

```html
<!DOCTYPE html>
<html lang="en" class="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Dashboard Page</title>

    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                extend: {
                    colors: {
                        dark: {
                            bg: '#111827',
                            card: '#1f2937',
                            text: '#f3f4f6',
                            border: '#374151'
                        }
                    }
                }
            }
        }
    </script>

    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <!-- FontAwesome -->
    <link rel="stylesheet" href="fontawesome/css/all.min.css">

    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">

    <!-- Shared Styles -->
    <link rel="stylesheet" href="assets/css/shared-styles.css">
</head>
<body class="bg-gray-100 text-gray-800 h-screen flex flex-col overflow-hidden dark:bg-dark-bg dark:text-dark-text">

    <!-- Navigation (same as other pages) -->
    <nav>
        <!-- ... navigation markup ... -->
    </nav>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-dark-bg">
        <div class="card p-4 bg-white dark:bg-dark-card">
            <h3 class="text-sm font-bold text-gray-700 dark:text-white mb-4">My Chart</h3>
            <canvas id="myChart"></canvas>
        </div>
    </main>

    <!-- Import shared modules -->
    <script src="assets/js/theme-manager.js"></script>
    <script src="assets/js/chart-config.js"></script>
    <script src="assets/js/navigation.js"></script>

    <script>
        // Initialize navigation for this page
        NavigationManager.init('switch'); // or 'ap', 'summary', 'sdwan'

        // Chart storage
        const charts = {};

        // Initialize charts
        function initCharts() {
            // Initialize Chart.js defaults
            ChartConfig.initDefaults();

            // Create a chart using helpers
            charts.myChart = new Chart(document.getElementById('myChart'), {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                    datasets: [
                        ChartConfig.createLineDataset(
                            'Throughput',
                            [65, 59, 80, 81, 56],
                            ChartConfig.palette.blue,
                            { fill: true, tension: 0.4 }
                        )
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: ChartConfig.getTooltipConfig(),
                        legend: ChartConfig.getLegendConfig({ position: 'bottom' })
                    },
                    scales: ChartConfig.getTimeScaleConfig({
                        yCallback: (value) => value + ' Mbps'
                    })
                }
            });
        }

        // Initialize
        initCharts();

        // Register charts with theme manager
        themeManager.registerCharts(charts);

        // Update chart colors if dark mode is already active
        if (themeManager.isDarkMode()) {
            themeManager.updateChartColors();
        }

        // Your page-specific logic here
        function updateDashboardScope(scope) {
            console.log('Scope changed to:', scope);
            // Update your page data based on scope
        }
    </script>
</body>
</html>
```

---

## Best Practices

1. **Always import modules in this order**:
   ```html
   <script src="assets/js/theme-manager.js"></script>
   <script src="assets/js/chart-config.js"></script>
   <script src="assets/js/navigation.js"></script>
   ```

2. **Initialize navigation immediately**:
   ```javascript
   NavigationManager.init('pagename');
   ```

3. **Use ChartConfig for all Chart.js defaults**:
   ```javascript
   ChartConfig.initDefaults(); // Instead of setting Chart.defaults manually
   ```

4. **Register charts with theme manager**:
   ```javascript
   themeManager.registerCharts(charts); // After creating all charts
   ```

5. **Check theme on page load**:
   ```javascript
   if (themeManager.isDarkMode()) {
       themeManager.updateChartColors();
   }
   ```

6. **Use ChartConfig helpers for consistent styling**:
   ```javascript
   // Good
   ChartConfig.createLineDataset('Label', data, ChartConfig.palette.blue);

   // Avoid
   { label: 'Label', data: data, borderColor: '#3b82f6', ... }
   ```

---

## Troubleshooting

### Theme not persisting
- Check that sessionStorage is enabled
- Verify theme-manager.js is loaded before your script

### Charts not updating on theme change
- Ensure `themeManager.registerCharts(charts)` is called
- Verify all charts are in the charts object

### Navigation not highlighting
- Check that `NavigationManager.init()` is called with correct page name
- Verify navigation links have correct href attributes

### Styles not applying
- Confirm shared-styles.css is loaded
- Check browser console for 404 errors
- Verify file path is correct relative to HTML file

---

---

## Project Overview

This Network Performance Monitoring dashboard consists of 4 fully integrated pages:

### Pages

1. **[index.html](../index.html)** - Summary Dashboard
   - Organization-wide network health
   - Active clients by device type
   - Device status distribution matrix
   - Network issues & security alerts
   - Organization/Region/Site scope selector

2. **[sdwan.html](../sdwan.html)** - SD-WAN Device View
   - CPU & Memory gauges with sparklines
   - Cellular backup signal strength
   - Uplink health (latency/jitter/loss)
   - WAN throughput graphs
   - VPN tunnel status table
   - BGP neighbors & routing table
   - Tab navigation (Overview/Advanced/Diagnostics)

3. **[switch.html](../switch.html)** - Switch Device View
   - Digital faceplate with LED indicators
   - Port-level status visualization
   - PoE budget monitoring
   - Hardware redundancy (PSU/Fans)
   - Shadow IT detection
   - 48-port interface status table
   - Error monitoring by port

4. **[access-point.html](../access-point.html)** - Access Point Device View
   - Real-time client connections
   - Channel utilization
   - RF performance metrics
   - Connected clients details
   - Band steering statistics
   - Tab navigation (Overview/Clients/RF)

### Navigation Flow

All pages are interconnected with seamless navigation:

```
Summary (Index) ↔ SD-WAN ↔ Switch ↔ Access Point
       ↓              ↓         ↓           ↓
    [Global View] [Device]  [Device]    [Device]
```

### Consistent Design Elements

All pages share:
- ✅ Identical navigation bar structure
- ✅ Dark/light mode toggle with persistence
- ✅ Scope/device selectors with onchange handlers
- ✅ Three-column device info cards (Name | IP/MAC | Uptime/Status)
- ✅ Inter font family from Google Fonts
- ✅ Tailwind CSS utility classes
- ✅ Chart.js visualizations
- ✅ Font Awesome icons (optimized to 1MB)
- ✅ Shared CSS and JavaScript modules
- ✅ Mobile responsive design

### Color Palette

Consistent across all pages:
- **Primary (Blue)**: `#3b82f6`
- **Success (Green)**: `#10b981`
- **Warning (Amber)**: `#f59e0b`
- **Danger (Red)**: `#ef4444`
- **Purple**: `#8b5cf6`
- **Gray backgrounds**: `#f9fafb`, `#f3f4f6`
- **Dark backgrounds**: `#111827`, `#1f2937`

### Device Info Card Pattern

All device pages use the same card layout:

```html
<div class="card p-4 bg-white dark:bg-dark-card border-l-4 border-green-500">
    <div class="flex items-center justify-between">
        <!-- Left: Device Name -->
        <div class="flex items-center gap-2">
            <i class="fa-solid fa-[icon] text-gray-400 text-lg"></i>
            <div>
                <h2 class="text-lg font-bold text-gray-900 dark:text-white">[Device Name]</h2>
                <p class="text-xs text-gray-500">[Model]</p>
            </div>
        </div>

        <!-- Center: IP and MAC -->
        <div class="flex items-center gap-8 text-sm">
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">IP:</span>
                <span class="font-mono text-gray-700 dark:text-gray-300">[IP]</span>
            </div>
            <div class="flex items-center gap-2">
                <span class="text-xs text-gray-400">MAC:</span>
                <span class="font-mono text-gray-700 dark:text-gray-300">[MAC]</span>
            </div>
        </div>

        <!-- Right: Uptime and Status -->
        <div class="flex items-center gap-4">
            <div class="text-right">
                <p class="text-xs text-gray-400 mb-0.5">Uptime</p>
                <p class="font-mono text-lg font-bold text-gray-900 dark:text-white">[Uptime]</p>
            </div>
            <span class="px-2 py-1 text-xs font-bold text-green-700 bg-green-100 rounded dark:bg-green-900 dark:text-green-300">ONLINE</span>
        </div>
    </div>
</div>
```

---

## Support

For issues or questions about these modules, please refer to:
- Code comments in each module file
- Example pages: `index.html`, `sdwan.html`, `switch.html`, `access-point.html`
