/**
 * Diagnostics Manager
 * Handles rendering of diagnostic tools and execution of async jobs
 * based on the device type.
 */
const DiagnosticsManager = {
  // Configuration: Tools and their supported device types
  tools: {
    ping: {
      id: "ping",
      name: "Ping",
      icon: "fa-network-wired",
      color: "blue",
      supported: ["gateway", "switch", "ap"],
      description: "Send ICMP echo requests to verify reachability.",
      inputs: [
        {
          name: "destination",
          label: "Destination IP/Hostname",
          type: "text",
          placeholder: "8.8.8.8",
        },
      ],
    },
    traceroute: {
      id: "traceroute",
      name: "Traceroute",
      icon: "fa-route",
      color: "indigo",
      supported: ["gateway", "switch", "ap"],
      description: "Trace the path packets take to a destination.",
      inputs: [
        {
          name: "destination",
          label: "Destination IP/Hostname",
          type: "text",
          placeholder: "google.com",
        },
      ],
    },
    cableTest: {
      id: "cableTest",
      name: "Cable Test",
      icon: "fa-plug",
      color: "amber",
      supported: ["switch"],
      description: "Check physical cable health and approximate length.",
      inputs: [
        {
          name: "port",
          label: "Port Number",
          type: "select",
          options: ["Ge1", "Ge2", "Ge3", "Ge48"],
        },
      ],
    },
    cyclePort: {
      id: "cyclePort",
      name: "Cycle Port",
      icon: "fa-rotate-right",
      color: "orange",
      supported: ["switch"],
      description: "Power cycle a PoE port to reboot connected devices.",
      inputs: [
        {
          name: "port",
          label: "Port Number",
          type: "select",
          options: ["Ge1", "Ge2", "Ge3", "Ge48"],
        },
      ],
    },
    blinkLeds: {
      id: "blinkLeds",
      name: "Blink LEDs",
      icon: "fa-lightbulb",
      color: "yellow",
      supported: ["gateway", "switch", "ap"],
      description: "Flash device LEDs to identify physical location.",
      inputs: [
        {
          name: "duration",
          label: "Duration (sec)",
          type: "number",
          value: 30,
        },
      ],
    },
    throughput: {
      id: "throughput",
      name: "Throughput",
      icon: "fa-gauge-high",
      color: "green",
      supported: ["gateway", "ap"],
      description: "Measure actual throughput to a speedtest server.",
      inputs: [],
    },
  },

  currentDeviceType: null,
  containerId: null,

  /**
   * Initialize the diagnostics tab
   * @param {string} deviceType - 'gateway', 'switch', or 'ap'
   * @param {string} containerId - DOM ID to render into
   */
  init(deviceType, containerId) {
    this.currentDeviceType = deviceType;
    this.containerId = containerId;
    this.render();
  },

  /**
   * Render the tool grid
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
            <div class="grid grid-cols-12 gap-6 h-full">
                <div class="col-span-12 md:col-span-4 lg:col-span-3 space-y-3">
                    <h3 class="text-sm font-bold text-gray-700 dark:text-white uppercase tracking-wider mb-2">Available Tools</h3>
                    <div id="tool-list" class="space-y-2">
                        </div>
                </div>

                <div class="col-span-12 md:col-span-8 lg:col-span-9 flex flex-col h-[600px]">
                    <div id="tool-config-panel" class="card p-4 bg-white dark:bg-dark-card mb-4 hidden border-l-4">
                        </div>
                    
                    <div class="flex-1 bg-black text-green-500 font-mono text-xs p-4 overflow-auto rounded-lg shadow-inner border border-gray-800" id="console-output">
                        <div class="opacity-70">> Terminal Session Started...</div>
                        <div class="opacity-70">> System ready. Select a tool to begin diagnostics.</div>
                        <div class="mt-2"><span class="animate-pulse">_</span></div>
                    </div>
                </div>
            </div>
        `;

    this.renderToolList();
  },

  /**
   * Filter tools by device type and render buttons
   */
  renderToolList() {
    const listContainer = document.getElementById("tool-list");

    Object.values(this.tools).forEach((tool) => {
      if (tool.supported.includes(this.currentDeviceType)) {
        const btn = document.createElement("button");
        btn.className = `w-full text-left px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-card hover:border-${tool.color}-500 dark:hover:border-${tool.color}-500 hover:shadow-md transition-all group flex items-center gap-3`;
        btn.onclick = () => this.selectTool(tool.id);
        btn.innerHTML = `
                    <div class="w-8 h-8 rounded-full bg-${tool.color}-100 dark:bg-${tool.color}-900/30 text-${tool.color}-600 dark:text-${tool.color}-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <i class="fa-solid ${tool.icon}"></i>
                    </div>
                    <div>
                        <div class="font-bold text-gray-700 dark:text-white text-sm">${tool.name}</div>
                        <div class="text-[10px] text-gray-400">${tool.description}</div>
                    </div>
                `;
        listContainer.appendChild(btn);
      }
    });
  },

  /**
   * Show configuration inputs for selected tool
   */
  selectTool(toolId) {
    const tool = this.tools[toolId];
    const configPanel = document.getElementById("tool-config-panel");

    // Update border color to match tool
    configPanel.className = `card p-4 bg-white dark:bg-dark-card mb-3 hidden border-l-4 border-${tool.color}-500`;

    // Build Input HTML - Compact Header (mb-2) and text sizes
    let inputsHtml = `
            <div class="flex items-center justify-between mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                <div class="flex items-center gap-2 text-${tool.color}-600 dark:text-${tool.color}-400">
                    <i class="fa-solid ${tool.icon} text-lg"></i>
                    <h3 class="text-base font-bold text-gray-900 dark:text-white">${tool.name} Config</h3>
                </div>
                <button onclick="DiagnosticsManager.runJob('${toolId}')" class="bg-${tool.color}-600 hover:bg-${tool.color}-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow transition-colors flex items-center gap-2">
                    <i class="fa-solid fa-play"></i> Run
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">`;

    tool.inputs.forEach((input) => {
      if (input.type === "select") {
        const opts = input.options
          .map((o) => `<option value="${o}">${o}</option>`)
          .join("");
        inputsHtml += `
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">${input.label}</label>
                        <select id="input-${input.name}" class="w-full rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs py-1.5 px-2 focus:ring-${tool.color}-500 focus:border-${tool.color}-500 dark:text-white">
                            ${opts}
                        </select>
                    </div>`;
      } else {
        inputsHtml += `
                    <div>
                        <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">${
                          input.label
                        }</label>
                        <input type="${input.type}" id="input-${
          input.name
        }" placeholder="${input.placeholder || ""}" value="${
          input.value || ""
        }" class="w-full rounded border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-xs py-1.5 px-2 focus:ring-${
          tool.color
        }-500 focus:border-${tool.color}-500 dark:text-white">
                    </div>`;
      }
    });

    // Close grid div
    inputsHtml += `</div>`;

    configPanel.innerHTML = inputsHtml;
    configPanel.classList.remove("hidden");
  },

  /**
   * Simulate Async Job Execution
   */
  runJob(toolId) {
    const consoleOut = document.getElementById("console-output");
    const tool = this.tools[toolId];

    // Remove the blinking cursor line momentarily
    const cursor = consoleOut.lastElementChild;
    if (cursor) cursor.remove();

    // 1. Job Initiation
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    consoleOut.innerHTML += `<div class="mt-1 text-gray-400">[${timestamp}] root@npm-console:~# <span class="text-white">initiate ${
      tool.id
    } --job-id=${Math.floor(Math.random() * 10000)}</span></div>`;
    consoleOut.innerHTML += `<div class="text-gray-500">> Contacting device controller...</div>`;
    consoleOut.scrollTop = consoleOut.scrollHeight;

    const duration = 2000;

    // 2. Polling Simulation
    setTimeout(() => {
      consoleOut.innerHTML += `<div class="text-${tool.color}-400">> Job dispatched. Polling status...</div>`;
      consoleOut.scrollTop = consoleOut.scrollHeight;
    }, 600);

    // 3. Result Push
    setTimeout(() => {
      const result = this.getMockResult(toolId);
      consoleOut.innerHTML += `<div class="mt-2 mb-2">
                <div class="font-bold text-${
                  tool.color
                }-400 mb-0.5">--- OUTPUT START: ${tool.name.toUpperCase()} ---</div>
                <pre class="font-mono text-xs text-gray-300 whitespace-pre-wrap pl-2 border-l border-gray-700">${result}</pre>
                <div class="font-bold text-${
                  tool.color
                }-400 mt-0.5">--- OUTPUT END ---</div>
            </div>`;
      // Add blinking cursor back
      consoleOut.innerHTML += `<div class="mt-1"><span class="animate-pulse">_</span></div>`;
      consoleOut.scrollTop = consoleOut.scrollHeight;
    }, duration);
  },

  getMockResult(toolId) {
    const outputs = {
      ping: `PING 8.8.8.8 (8.8.8.8): 56 data bytes\n64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=14.2 ms\n64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=13.8 ms\n64 bytes from 8.8.8.8: icmp_seq=2 ttl=118 time=15.1 ms\n\n--- 8.8.8.8 ping statistics ---\n3 packets transmitted, 3 packets received, 0.0% packet loss\nround-trip min/avg/max/stddev = 13.8/14.4/15.1/0.6 ms`,
      traceroute: `traceroute to google.com (142.250.183.46), 30 hops max, 60 byte packets\n 1  10.128.1.1 (10.128.1.1)  0.421 ms  0.389 ms  0.355 ms\n 2  192.168.100.1 (192.168.100.1)  1.210 ms  1.185 ms  1.150 ms\n 3  10.50.0.1 (10.50.0.1)  4.320 ms  4.290 ms  4.250 ms\n 4  72.14.23.44 (72.14.23.44)  12.450 ms  12.400 ms  12.350 ms\n 5  142.250.183.46 (142.250.183.46)  13.100 ms  13.050 ms  13.000 ms`,
      cableTest: `Port Ge1 Cable Test Results:\n--------------------------------\nStatus:      OK\nPair A:      Normal, Length: 45m\nPair B:      Normal, Length: 44m\nPair C:      Normal, Length: 45m\nPair D:      Normal, Length: 45m\n\nCable Validation Passed.`,
      cyclePort: `Port Ge1 Power Cycle Initiated...\nPoE Power:   OFF\nWait:        5000ms\nPoE Power:   ON\n\nLink State:  UP (1000Mbps/Full)\nDevice:      Rebooting...`,
      blinkLeds: `Command Sent: Identify LED blinking for 30 seconds.\n\nVerify physical device location. Look for flashing blue/white LED pattern.`,
      throughput: `WAN Throughput Test (Speedtest.net)\n-----------------------------------\nServer:      New York, NY (Comcast)\nLatency:     12ms\nJitter:      2ms\n\nDownload:    845.2 Mbps\nUpload:      920.5 Mbps\n\nResult:      PASS (Meets SLA)`,
    };
    return outputs[toolId] || "Command executed successfully.";
  },
};
