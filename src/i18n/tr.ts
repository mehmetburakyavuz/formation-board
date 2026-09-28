/** All user-facing strings (Turkish). */
export const tr = {
  appTitle: '3D Taktik Tahtası',
  webglError: 'WebGL başlatılamadı. Lütfen güncel bir tarayıcı kullanın.',
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
