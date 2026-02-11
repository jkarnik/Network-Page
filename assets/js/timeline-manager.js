/**
 * TimelineManager — Singleton for managing the global time range selector.
 * Renders a dropdown button in #timelineSelector with preset ranges + custom date/time picker.
 * Persists selection in localStorage and notifies listeners on change.
 */
const TimelineManager = {
    _currentRange: '24h',
    _customStart: null,
    _customEnd: null,
    _listeners: [],
    _isOpen: false,
    _container: null,

    PRESETS: [
        { key: '5m',  label: '5 mins',   minutes: 5,     dataPoints: 1  },
        { key: '30m', label: '30 mins',  minutes: 30,    dataPoints: 1  },
        { key: '1h',  label: '1 hour',   minutes: 60,    dataPoints: 1  },
        { key: '2h',  label: '2 hours',  minutes: 120,   dataPoints: 2  },
        { key: '6h',  label: '6 hours',  minutes: 360,   dataPoints: 6  },
        { key: '12h', label: '12 hours', minutes: 720,   dataPoints: 12 },
        { key: '24h', label: '24 hours', minutes: 1440,  dataPoints: 24 },
        { key: '3d',  label: '3 days',   minutes: 4320,  dataPoints: 24 },
        { key: '7d',  label: '7 days',   minutes: 10080, dataPoints: 24 },
    ],

    /**
     * Initialize: load from localStorage, render UI, bind events.
     */
    init() {
        this._loadFromStorage();
        this._container = document.getElementById('timelineSelector');
        if (!this._container) return;
        this._render();
        this._bindEvents();
        this._updateTimelineLabels();
    },

    // --- Public API ---

    /**
     * Set the active range by preset key.
     */
    setRange(key) {
        const preset = this.PRESETS.find(p => p.key === key);
        if (!preset) return;
        this._currentRange = key;
        this._customStart = null;
        this._customEnd = null;
        this._saveToStorage();
        this._updateButtonLabel();
        this._updateActivePreset();
        this._updateTimelineLabels();
        this._close();
        this._fireListeners();
    },

    /**
     * Set a custom date/time range.
     */
    setCustomRange(start, end) {
        if (!start || !end || start >= end) return;
        this._currentRange = 'custom';
        this._customStart = new Date(start);
        this._customEnd = new Date(end);
        this._saveToStorage();
        this._updateButtonLabel();
        this._updateActivePreset();
        this._updateTimelineLabels();
        this._close();
        this._fireListeners();
    },

    /**
     * Get the current range configuration.
     */
    getRange() {
        if (this._currentRange === 'custom') {
            const diffMs = this._customEnd - this._customStart;
            const minutes = Math.round(diffMs / 60000);
            return {
                key: 'custom',
                label: this.getDisplayLabel(),
                minutes: minutes,
                customStart: this._customStart,
                customEnd: this._customEnd
            };
        }
        const preset = this.PRESETS.find(p => p.key === this._currentRange);
        return { key: preset.key, label: preset.label, minutes: preset.minutes };
    },

    /**
     * Human-readable label for the current range.
     */
    getDisplayLabel() {
        if (this._currentRange === 'custom' && this._customStart && this._customEnd) {
            const fmt = (d) => {
                const mo = (d.getMonth() + 1).toString().padStart(2, '0');
                const da = d.getDate().toString().padStart(2, '0');
                const hr = d.getHours().toString().padStart(2, '0');
                const mi = d.getMinutes().toString().padStart(2, '0');
                return `${mo}/${da} ${hr}:${mi}`;
            };
            return `${fmt(this._customStart)} – ${fmt(this._customEnd)}`;
        }
        const preset = this.PRESETS.find(p => p.key === this._currentRange);
        return preset ? `Last ${preset.label}` : 'Last 24 hours';
    },

    /**
     * Register a callback to be notified when the range changes.
     */
    onChange(callback) {
        if (typeof callback === 'function') {
            this._listeners.push(callback);
        }
    },

    /**
     * Slice a 24-point dataset to match the current range.
     * Accepts labels array and any number of data arrays.
     * Returns { labels, datasets: [...slicedArrays] }
     */
    sliceData(labels, ...dataArrays) {
        const range = this.getRange();
        const totalPoints = labels.length;
        let pointsToShow;

        if (this._currentRange === 'custom') {
            // Map custom duration to closest point count
            pointsToShow = this._minutesToPoints(range.minutes, totalPoints);
        } else {
            const preset = this.PRESETS.find(p => p.key === this._currentRange);
            pointsToShow = Math.min(preset.dataPoints, totalPoints);
        }

        if (pointsToShow >= totalPoints) {
            // Only relabel for multi-day ranges with full-size datasets (24+ points).
            // Small datasets (e.g. 10-point ISP failure events) keep their original
            // labels since relabeling would spread a short event across days.
            if (range.minutes > 1440 && totalPoints >= 24) {
                const newLabels = this._generateLabelsForRange(totalPoints);
                return {
                    labels: newLabels,
                    datasets: dataArrays.map(arr => [...arr])
                };
            }
            return {
                labels: [...labels],
                datasets: dataArrays.map(arr => [...arr])
            };
        }

        // Slice from the end
        const slicedLabels = labels.slice(totalPoints - pointsToShow);
        const slicedDatasets = dataArrays.map(arr => arr.slice(totalPoints - pointsToShow));

        return {
            labels: slicedLabels,
            datasets: slicedDatasets
        };
    },

    /**
     * Generate time labels for the current range.
     * @param {number} count - Number of data points to generate labels for
     * @returns {string[]} Array of time label strings
     */
    generateLabels(count) {
        return this._generateLabelsForRange(count);
    },

    // --- Private Methods ---

    _minutesToPoints(minutes, totalPoints) {
        if (minutes <= 60) return 1;
        if (minutes <= 120) return Math.min(2, totalPoints);
        if (minutes <= 360) return Math.min(6, totalPoints);
        if (minutes <= 720) return Math.min(12, totalPoints);
        return totalPoints;
    },

    _generateLabelsForRange(count) {
        const range = this.getRange();
        const minutes = range.minutes;
        const now = new Date();
        const labels = [];

        if (minutes <= 60) {
            // Minute-level labels
            const interval = Math.max(1, Math.floor(minutes / count));
            for (let i = count - 1; i >= 0; i--) {
                const t = new Date(now.getTime() - i * interval * 60000);
                labels.push(t.getHours().toString().padStart(2, '0') + ':' + t.getMinutes().toString().padStart(2, '0'));
            }
        } else if (minutes <= 1440) {
            // Hourly labels
            const interval = Math.max(1, Math.floor(24 / count));
            for (let i = count - 1; i >= 0; i--) {
                const t = new Date(now.getTime() - i * interval * 3600000);
                labels.push(t.getHours().toString().padStart(2, '0') + ':00');
            }
        } else if (minutes <= 4320) {
            // 3 days — 4-hourly labels with date prefix
            const interval = (minutes / count) * 60000;
            for (let i = count - 1; i >= 0; i--) {
                const t = new Date(now.getTime() - i * interval);
                const mo = (t.getMonth() + 1).toString().padStart(2, '0');
                const da = t.getDate().toString().padStart(2, '0');
                const hr = t.getHours().toString().padStart(2, '0');
                labels.push(`${mo}/${da} ${hr}:00`);
            }
        } else {
            // 7 days — daily labels
            const interval = (minutes / count) * 60000;
            for (let i = count - 1; i >= 0; i--) {
                const t = new Date(now.getTime() - i * interval);
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                const mo = (t.getMonth() + 1).toString().padStart(2, '0');
                const da = t.getDate().toString().padStart(2, '0');
                labels.push(`${days[t.getDay()]} ${mo}/${da}`);
            }
        }
        return labels;
    },

    _loadFromStorage() {
        try {
            const saved = localStorage.getItem('timelineRange');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.key === 'custom' && parsed.start && parsed.end) {
                    this._currentRange = 'custom';
                    this._customStart = new Date(parsed.start);
                    this._customEnd = new Date(parsed.end);
                } else if (this.PRESETS.find(p => p.key === parsed.key)) {
                    this._currentRange = parsed.key;
                }
            }
        } catch (e) {
            this._currentRange = '24h';
        }
    },

    _saveToStorage() {
        try {
            const data = { key: this._currentRange };
            if (this._currentRange === 'custom') {
                data.start = this._customStart.toISOString();
                data.end = this._customEnd.toISOString();
            }
            localStorage.setItem('timelineRange', JSON.stringify(data));
        } catch (e) { /* silently fail */ }
    },

    _render() {
        const preset = this.PRESETS.find(p => p.key === this._currentRange);
        const label = this.getDisplayLabel();

        this._container.innerHTML = `
            <button id="timelineBtn" class="timeline-btn" title="Select time range">
                <i class="fa-regular fa-clock"></i>
                <span id="timelineBtnLabel">${label}</span>
                <i class="fa-solid fa-chevron-down timeline-chevron"></i>
            </button>
            <div id="timelineDropdown" class="timeline-dropdown hidden">
                <div class="timeline-presets">
                    ${this.PRESETS.map(p => `
                        <button class="timeline-preset${p.key === this._currentRange ? ' active' : ''}" data-range="${p.key}">
                            ${p.label}
                        </button>
                    `).join('')}
                </div>
                <div class="timeline-divider"></div>
                <div class="timeline-custom">
                    <div class="timeline-custom-title">Custom Range</div>
                    <div class="timeline-custom-fields">
                        <div class="timeline-custom-field">
                            <label>Start</label>
                            <input type="datetime-local" id="timelineCustomStart">
                        </div>
                        <div class="timeline-custom-field">
                            <label>End</label>
                            <input type="datetime-local" id="timelineCustomEnd">
                        </div>
                    </div>
                    <button id="timelineApplyCustom" class="timeline-apply-btn">
                        <i class="fa-solid fa-check"></i> Apply
                    </button>
                </div>
            </div>
        `;

        // Pre-fill custom inputs if custom range is active
        if (this._currentRange === 'custom' && this._customStart && this._customEnd) {
            const startInput = document.getElementById('timelineCustomStart');
            const endInput = document.getElementById('timelineCustomEnd');
            if (startInput) startInput.value = this._toLocalDatetimeString(this._customStart);
            if (endInput) endInput.value = this._toLocalDatetimeString(this._customEnd);
        }
    },

    _toLocalDatetimeString(date) {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        const h = date.getHours().toString().padStart(2, '0');
        const mi = date.getMinutes().toString().padStart(2, '0');
        return `${y}-${m}-${d}T${h}:${mi}`;
    },

    _bindEvents() {
        // Toggle dropdown
        const btn = document.getElementById('timelineBtn');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._toggle();
            });
        }

        // Preset buttons
        const presetBtns = this._container.querySelectorAll('.timeline-preset');
        presetBtns.forEach(b => {
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setRange(b.dataset.range);
            });
        });

        // Apply custom range
        const applyBtn = document.getElementById('timelineApplyCustom');
        if (applyBtn) {
            applyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const startInput = document.getElementById('timelineCustomStart');
                const endInput = document.getElementById('timelineCustomEnd');
                if (startInput.value && endInput.value) {
                    this.setCustomRange(new Date(startInput.value), new Date(endInput.value));
                }
            });
        }

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (this._isOpen && !this._container.contains(e.target)) {
                this._close();
            }
        });

        // Prevent dropdown clicks from closing
        const dropdown = document.getElementById('timelineDropdown');
        if (dropdown) {
            dropdown.addEventListener('click', (e) => e.stopPropagation());
        }
    },

    _toggle() {
        this._isOpen ? this._close() : this._open();
    },

    _open() {
        const dropdown = document.getElementById('timelineDropdown');
        if (dropdown) {
            dropdown.classList.remove('hidden');
            this._isOpen = true;
            const btn = document.getElementById('timelineBtn');
            if (btn) btn.classList.add('active');
        }
    },

    _close() {
        const dropdown = document.getElementById('timelineDropdown');
        if (dropdown) {
            dropdown.classList.add('hidden');
            this._isOpen = false;
            const btn = document.getElementById('timelineBtn');
            if (btn) btn.classList.remove('active');
        }
    },

    _updateButtonLabel() {
        const labelEl = document.getElementById('timelineBtnLabel');
        if (labelEl) labelEl.textContent = this.getDisplayLabel();
    },

    _updateActivePreset() {
        const presets = this._container.querySelectorAll('.timeline-preset');
        presets.forEach(b => {
            b.classList.toggle('active', b.dataset.range === this._currentRange);
        });
    },

    /**
     * Update all [data-timeline-label] spans on the page.
     */
    _updateTimelineLabels() {
        const label = this.getDisplayLabel();
        document.querySelectorAll('[data-timeline-label]').forEach(el => {
            el.textContent = label;
        });
    },

    _fireListeners() {
        const range = this.getRange();
        this._listeners.forEach(fn => {
            try { fn(range); } catch (e) { console.error('TimelineManager listener error:', e); }
        });
    }
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => TimelineManager.init());

// Expose globally
window.TimelineManager = TimelineManager;
