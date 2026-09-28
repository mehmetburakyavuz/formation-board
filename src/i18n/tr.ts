import type { Role } from '../data/formations';

/** Short Turkish position abbreviations shown on labels when a player has no name. */
const roles: Record<Role, string> = {
  GK: 'KL',
  LB: 'SLB',
  LCB: 'SLST',
  CB: 'STP',
  RCB: 'SĞST',
  RB: 'SĞB',
  LWB: 'SLKB',
  RWB: 'SĞKB',
  CDM: 'DOS',
  LDM: 'SLDO',
  RDM: 'SĞDO',
  LCM: 'SLO',
  CM: 'MO',
  RCM: 'SĞO',
  LM: 'SLA',
  RM: 'SĞA',
  LAM: 'SLOO',
  CAM: 'OOS',
  RAM: 'SĞOO',
  LW: 'SLK',
  RW: 'SĞK',
  LS: 'SLF',
  ST: 'SNT',
  RS: 'SĞF',
};

/** All user-facing strings (Turkish). */
export const tr = {
  appTitle: '3D Taktik Tahtası',
  webglError: 'WebGL başlatılamadı. Lütfen güncel bir tarayıcı kullanın.',
  teams: {
    home: 'Ev Sahibi',
    away: 'Deplasman',
  },
  roles,
  metres: (m: number): string => `${m.toFixed(1)} m`,
  camera: {
    groupLabel: 'Kamera açıları',
    presets: {
      tactical: 'Taktik (tepeden)',
      broadcast: 'Yayın açısı',
      behindHome: 'Kale arkası (ev sahibi)',
      behindAway: 'Kale arkası (deplasman)',
      threeQuarter: '3/4 perspektif',
    },
    presetsShort: {
      tactical: 'Taktik',
      broadcast: 'Yayın',
      behindHome: 'Ev kale',
      behindAway: 'Dep. kale',
      threeQuarter: '3/4',
    },
    autoRotate: '360° dönüş',
    fullscreen: 'Tam ekran',
  },
} as const;
