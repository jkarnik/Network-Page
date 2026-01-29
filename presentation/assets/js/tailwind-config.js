tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // New Relic Design System Colors
                dark: {
                    bg: '#0B1620',      // Deep navy background
                    card: '#1A1F2E',    // Card background
                    border: '#2A3036',  // Subtle borders
                    text: '#F7F8F9',    // Primary text
                    muted: '#8E9494'    // Secondary text
                },
                newrelic: {
                    cyan: '#00CED1',     // Primary brand cyan
                    teal: '#008C99',     // Deep teal
                    success: '#11A768',  // Green
                    warning: '#F5A623',  // Amber/Orange
                    error: '#DF2D24',    // Red
                    info: '#0B7EBF'      // Blue
                }
            }
        }
    }
}
