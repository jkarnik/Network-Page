# Network Performance Monitoring Dashboard

A comprehensive, real-time network performance monitoring dashboard built with modern web technologies. This dashboard provides detailed insights into network devices including SD-WAN gateways, switches, and wireless access points.

## Overview

This project is a **single-page application (SPA)** collection that provides network monitoring capabilities across different device types. It features a modern, responsive UI with dark mode support, interactive charts, and real-time performance metrics.

### Key Features

- Real-time performance monitoring for multiple device types
- Dark/Light theme toggle with persistent preferences
- Interactive Chart.js visualizations
- Responsive design that works on desktop and mobile
- Device-specific diagnostics tools
- Network anomaly detection (Shadow IT, Rogue APs)
- Client journey funnel analysis
- VPN tunnel monitoring
- Port-level switch analytics

## Project Structure

```
Network Page/
├── index.html              # Summary/Overview page
├── sdwan.html              # SD-WAN Gateway monitoring
├── switch.html             # Network Switch monitoring
├── access-point.html       # Wireless Access Point monitoring
├── assets/
│   ├── css/
│   │   └── shared-styles.css      # Shared CSS styles
│   └── js/
│       ├── theme-manager.js        # Dark/Light mode management
│       ├── navigation.js           # Navigation state handling
│       ├── chart-config.js         # Chart.js configuration
│       ├── diagnostics-manager.js  # Diagnostic tools system
│       └── ui-utilities.js         # Common UI utilities
├── fontawesome/            # Font Awesome icon library
└── README.md               # This file
```

## Pages Description

### 1. Summary Page (index.html)
The main dashboard providing a high-level overview of the entire network infrastructure.

**Features:**
- Global network health status
- Multi-site performance metrics
- Regional aggregated statistics
- Quick navigation to device-specific pages

### 2. SD-WAN Gateway Page (sdwan.html)
Monitors SD-WAN edge devices and WAN connectivity.

**Features:**
- Uplink health monitoring (latency, jitter, packet loss)
- WAN throughput visualization
- VPN tunnel status and performance
- BGP neighbor status
- Active routing table (RIB)
- Firewall log viewer with search/filter
- Wireless threat detection
- Cellular backup signal monitoring
- Application-level (L7) traffic analysis
- Sequential event timeline

**Diagnostics:**
- Ping tests
- Traceroute
- Throughput tests
- LED blinking for physical identification

### 3. Switch Page (switch.html)
Monitors network switches with port-level granularity.

**Features:**
- Visual faceplate representation (48 ports)
- PoE power budget tracking
- Port status and statistics table
- Shadow IT detection (unauthorized switches/hubs)
- CPU, Memory, and PoE utilization gauges
- Hardware redundancy status (PSU, fans)
- Per-port traffic analysis with sortable columns
- Detailed port performance graphs (upload, download, latency, jitter, errors)

**Diagnostics:**
- Cable testing
- Port power cycling
- Physical device identification (LED blink)
- Network connectivity tests

### 4. Access Point Page (access-point.html)
Monitors wireless access points and client connectivity.

**Features:**
- Client journey funnel analysis (Association → Authentication → DHCP → DNS → Success)
- DHCP capacity monitoring
- SSID distribution
- Channel utilization (2.4 GHz, 5 GHz, 6 GHz)
- Signal quality distribution (SNR)
- Interfering neighbor detection (Rogue APs)
- Active client list with performance metrics
- Per-client bandwidth and performance tracking

**Diagnostics:**
- Wireless connectivity tests
- Signal strength measurements
- Client troubleshooting tools

## Technology Stack

### Frontend Framework
- **HTML5** - Semantic markup
- **TailwindCSS** - Utility-first CSS framework (via CDN)
- **JavaScript (ES6+)** - Modern JavaScript features

### Libraries & Dependencies
- **Chart.js** - Interactive chart library
- **Chart.js DataLabels Plugin** - Chart label enhancements
- **Font Awesome** - Icon library
- **Google Fonts (Inter)** - Typography
- **Inconsolata** - Monospace font for code/data

### Architecture Patterns
- **Module Pattern** - JavaScript modules for separation of concerns
- **Singleton Pattern** - Single instances for managers (ThemeManager, NavigationManager)
- **Observer Pattern** - Theme change notifications to charts

## JavaScript Modules

### 1. ThemeManager (theme-manager.js)
Manages dark/light mode toggling and persistence.

**Key Methods:**
- `toggle()` - Switch between themes
- `registerCharts(chartsObject)` - Register charts for theme updates
- `updateChartColors()` - Update all chart colors based on theme
- `isDarkMode()` - Check current theme state

**Storage:** Uses `sessionStorage` to persist theme preferences within the browsing session.

### 2. NavigationManager (navigation.js)
Handles navigation state and active page highlighting.

**Key Methods:**
- `init(activePage)` - Initialize with current page
- `setActivePage(activePage)` - Update active navigation link
- `getCurrentScope()` - Get selected scope from dropdown

### 3. ChartConfig (chart-config.js)
Centralized Chart.js configuration and utilities.

**Key Features:**
- Color palette definitions
- Common tooltip configurations
- Dataset creation helpers
- Hex to RGBA conversion
- Theme-aware color schemes

**Key Methods:**
- `initDefaults()` - Set global Chart.js defaults
- `createLineDataset()` - Create line chart dataset
- `createDoughnutDataset()` - Create doughnut chart dataset
- `getTooltipConfig()` - Get common tooltip config
- `hexToRgba()` - Convert hex colors to RGBA

### 4. DiagnosticsManager (diagnostics-manager.js)
Unified diagnostic tools system across all device types.

**Supported Tools:**
- **Ping** - ICMP echo requests (Gateway, Switch, AP)
- **Traceroute** - Path tracing (Gateway, Switch, AP)
- **Cable Test** - Physical cable diagnostics (Switch only)
- **Port Cycle** - PoE port power cycling (Switch only)
- **LED Blink** - Physical device identification (All)
- **Throughput** - Speed testing (Gateway, AP)

**Key Methods:**
- `init(deviceType, containerId)` - Initialize for device type
- `render()` - Render tool selection UI
- `selectTool(toolId)` - Show tool configuration
- `runJob(toolId)` - Execute diagnostic job
- `getMockResult(toolId)` - Get simulated results

**Architecture:**
- Device-type aware tool filtering
- Async job simulation
- Terminal-style output display
- Configurable input forms per tool

### 5. UIUtilities (ui-utilities.js)
Common UI helper functions to reduce code duplication.

**Key Methods:**
- `switchTab(tabName, activeColor)` - Generic tab switching
- `createGaugeChart()` - Create gauge/doughnut charts
- `createSparklineChart()` - Create small line charts
- `showOverlay()` / `hideOverlay()` - Modal management
- `formatBytes()` - Human-readable byte formatting
- `formatUptime()` - Human-readable uptime formatting
- `debounce()` - Debounce function for search inputs
- `generateNormalRandom()` - Normal distribution random numbers
- `generateTimeLabels()` - Create time label arrays for charts

## Installation & Setup

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (optional, but recommended)

### Option 1: Direct File Opening
Simply open any HTML file in your web browser:
```bash
open index.html
```

**Note:** Some features may not work due to CORS restrictions when opening files directly.

### Option 2: Local Web Server (Recommended)

#### Using Python 3:
```bash
cd "/Users/jkarnik/Code/Network Page"
python3 -m http.server 8000
```
Then navigate to: `http://localhost:8000`

#### Using Node.js (http-server):
```bash
npm install -g http-server
cd "/Users/jkarnik/Code/Network Page"
http-server -p 8000
```
Then navigate to: `http://localhost:8000`

#### Using PHP:
```bash
cd "/Users/jkarnik/Code/Network Page"
php -S localhost:8000
```
Then navigate to: `http://localhost:8000`

## Usage Guide

### Navigation
- Use the top navigation bar to switch between device pages
- Click on the logo/title to return to the summary page
- Use the scope selector to filter by region or site

### Theme Toggle
- Click the moon/sun icon in the top-right to toggle dark/light mode
- Theme preference is saved for your session

### Diagnostics
1. Navigate to any device page (SD-WAN, Switch, or Access Point)
2. Click on the "Diagnostics" tab
3. Select a diagnostic tool from the left panel
4. Configure the tool parameters
5. Click "Run" to execute the diagnostic
6. View results in the terminal-style output panel

### Device Details
- Click on any row in tables to view detailed metrics
- Overlays provide time-series graphs and performance history
- Close overlays by clicking the X button or clicking outside

## Data & Mock Implementation

**Important:** This is a **frontend-only demonstration** with simulated data. All metrics, performance data, and diagnostic results are generated using mock data and random number generators.

### Mock Data Characteristics
- Performance metrics use normal distribution (mean ~95%, std dev ~2%)
- Traffic patterns simulate realistic daily usage curves
- Diagnostic results are pre-scripted responses
- Time-series data is randomly generated with realistic patterns

### Backend Integration
To connect to real network devices, you would need to:

1. **Create a backend API** (Node.js/Express, Python/Flask, Go, etc.)
2. **Integrate with network device APIs** (SNMP, REST APIs, SSH, NETCONF)
3. **Replace mock data calls** with actual API requests
4. **Implement WebSockets** for real-time updates
5. **Add authentication/authorization** for security

Example integration points:
```javascript
// Current (Mock):
const cpuUsage = 42; // Hardcoded

// Future (Real):
const cpuUsage = await fetch('/api/devices/switch-01/cpu').then(r => r.json());
```

## Browser Support

Tested and supported on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance Considerations

- **Chart Count:** Each page renders multiple Chart.js instances; limit concurrent pages
- **Memory Management:** Charts are properly destroyed when overlays close
- **Responsive Design:** Charts use `maintainAspectRatio: false` for flexibility
- **Dark Mode:** Chart colors update efficiently on theme toggle

## Customization Guide

### Adding a New Device Type
1. Create a new HTML file (e.g., `firewall.html`)
2. Copy structure from an existing page
3. Include shared JS modules
4. Initialize with `NavigationManager.init('firewall')`
5. Add navigation link to all pages
6. Define device-specific metrics and charts

### Adding New Diagnostic Tools
Edit `diagnostics-manager.js`:
```javascript
tools: {
    newTool: {
        id: "newTool",
        name: "New Tool",
        icon: "fa-icon-name",
        color: "blue",
        supported: ["gateway", "switch", "ap"],
        description: "Tool description",
        inputs: [
            {
                name: "inputName",
                label: "Input Label",
                type: "text",
                placeholder: "Placeholder"
            }
        ]
    }
}
```

### Modifying Color Schemes
Edit `chart-config.js` and `shared-styles.css`:
```javascript
// chart-config.js
colors: {
    light: {
        text: '#6b7280',
        grid: '#e5e7eb'
    },
    dark: {
        text: '#9ca3af',
        grid: '#374151'
    }
}
```

## Code Quality & Best Practices

### JavaScript
- ES6+ features (const/let, arrow functions, template literals)
- Modular design with separation of concerns
- Singleton pattern for global managers
- Proper event listener cleanup
- Chart destruction to prevent memory leaks

### HTML
- Semantic HTML5 elements
- Accessibility attributes (aria-label)
- Responsive meta viewport tags
- Organized class naming (Tailwind conventions)

### CSS
- Utility-first approach with Tailwind
- Custom properties for theme colors
- Minimal custom CSS (shared-styles.css)
- Dark mode support via class-based toggling

## Known Limitations

1. **No Backend:** All data is mock/simulated
2. **No Real-Time Updates:** Data is static after page load
3. **No Data Persistence:** Settings reset on page refresh (except theme in sessionStorage)
4. **No Authentication:** Open access to all features
5. **Client-Side Only:** All processing happens in browser
6. **Limited Scalability:** Not designed for thousands of devices

## Future Enhancements

### Potential Features
- [ ] Real backend API integration
- [ ] WebSocket support for real-time data
- [ ] User authentication and role-based access
- [ ] Alert/notification system
- [ ] Historical data storage and querying
- [ ] Device configuration management
- [ ] Automated network topology discovery
- [ ] Scheduled diagnostic jobs
- [ ] Export reports to PDF/CSV
- [ ] Multi-tenancy support
- [ ] Advanced filtering and search
- [ ] Custom dashboard widgets
- [ ] Mobile app (React Native/Flutter)

### Architecture Improvements
- [ ] Migrate to React/Vue/Angular for better state management
- [ ] Add TypeScript for type safety
- [ ] Implement proper build pipeline (Webpack/Vite)
- [ ] Add unit tests (Jest/Mocha)
- [ ] Implement E2E tests (Cypress/Playwright)
- [ ] Add CI/CD pipeline
- [ ] Optimize bundle size with code splitting
- [ ] Implement service workers for offline support

## Troubleshooting

### Charts Not Rendering
- Ensure Chart.js is loaded before chart initialization
- Check browser console for errors
- Verify canvas elements exist in DOM

### Theme Toggle Not Working
- Check sessionStorage is enabled in browser
- Verify ThemeManager is initialized
- Inspect console for JavaScript errors

### Diagnostics Not Running
- Ensure DiagnosticsManager is initialized with correct device type
- Verify diagnostic tool is supported for device type
- Check console for errors

### Performance Issues
- Reduce number of data points in charts
- Close unused overlays/modals
- Clear browser cache
- Use a modern browser

## Contributing

This is a demonstration project. For production use, consider:
1. Adding proper version control (Git)
2. Implementing code review process
3. Writing comprehensive tests
4. Documenting API interfaces
5. Following semantic versioning

## License

This project is for educational and demonstration purposes.

## Credits

### Libraries
- **Chart.js** - Simple yet flexible JavaScript charting
- **Tailwind CSS** - Utility-first CSS framework
- **Font Awesome** - Icon library
- **Google Fonts** - Web fonts

### Author
Network Operations Team

### Project Stats
- **Total Lines of Code:** ~6,500+
- **HTML Files:** 4
- **JavaScript Modules:** 5
- **Pages:** 4 unique monitoring views
- **Chart Types:** Line, Doughnut, Bar, Stacked Bar
- **Diagnostic Tools:** 6 types across device categories

## Support

For questions or issues:
1. Check browser console for errors
2. Review this README for guidance
3. Inspect network tab for failed requests
4. Verify all files are in correct locations

---

**Last Updated:** December 2024
**Version:** 1.0.0
**Status:** Active Development
