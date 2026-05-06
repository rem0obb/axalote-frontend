import { createLucideIcon } from 'lucide-react';

// Inspired by the VT geometric mark: bracket-like shape plus vertical stem.
export const VirusTotalIcon = createLucideIcon('VirusTotalIcon', [
  ['path', { d: 'M3 4h11L7 12l7 8H3', key: 'vt-shape' }],
  ['path', { d: 'M13 4v16', key: 'vt-stem' }],
]);

export default VirusTotalIcon;
