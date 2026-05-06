// IDA Pro inspired color scheme and theme utilities

export const IDA_COLORS = {
  // Background layers
  bg: {
    primary: 'hsl(0 0% 7%)',      // Main background
    secondary: 'hsl(0 0% 9%)',    // Panel background
    elevated: 'hsl(0 0% 11%)',    // Elevated elements
    header: 'hsl(0 0% 8%)',       // Panel headers
  },
  
  // Borders and dividers
  border: {
    default: 'hsl(0 0% 15%)',
    subtle: 'hsl(0 0% 12%)',
    active: 'hsl(0 0% 25%)',
  },
  
  // Text colors
  text: {
    primary: 'hsl(0 0% 95%)',
    secondary: 'hsl(0 0% 70%)',
    muted: 'hsl(0 0% 50%)',
    disabled: 'hsl(0 0% 35%)',
  },
  
  // Syntax highlighting (IDA Pro style)
  syntax: {
    instruction: 'hsl(210 100% 70%)',  // Blue for instructions
    register: 'hsl(330 100% 70%)',     // Pink for registers
    immediate: 'hsl(120 100% 60%)',    // Green for immediates
    address: 'hsl(280 100% 70%)',      // Purple for addresses
    comment: 'hsl(0 0% 50%)',          // Gray for comments
    string: 'hsl(40 100% 60%)',        // Yellow for strings
    function: 'hsl(180 100% 60%)',     // Cyan for functions
    label: 'hsl(30 100% 65%)',         // Orange for labels
  },
  
  // Status colors
  status: {
    success: 'hsl(120 60% 50%)',
    warning: 'hsl(40 100% 55%)',
    error: 'hsl(0 80% 55%)',
    info: 'hsl(210 100% 60%)',
  },
  
  // Accent colors
  accent: {
    primary: 'hsl(210 100% 60%)',     // Blue accent
    secondary: 'hsl(180 100% 50%)',   // Cyan accent
    highlight: 'hsl(50 100% 50%)',    // Yellow highlight
  },
};

export const IDA_SPACING = {
  panel: {
    padding: '4px',
    gap: '2px',
  },
  header: {
    height: '24px',
    padding: '0 8px',
  },
  content: {
    padding: '8px',
  },
};

export const IDA_TYPOGRAPHY = {
  mono: "'JetBrains Mono', 'Consolas', 'Courier New', monospace",
  ui: "'Inter', system-ui, sans-serif",
  sizes: {
    xs: '10px',
    sm: '11px',
    base: '12px',
    md: '13px',
    lg: '14px',
  },
};
