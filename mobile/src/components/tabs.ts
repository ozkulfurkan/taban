import type { IconName } from './icon';

// Firma uygulamasının alt sekmeleri (native ve web aynı listeyi kullanır)
export const STAFF_TABS: Array<{ name: string; href: string; label: string; icon: IconName }> = [
  { name: 'panel', href: '/panel', label: 'Panel', icon: 'home' },
  { name: 'cariler', href: '/cariler', label: 'Cariler', icon: 'people' },
  { name: 'ayarlar', href: '/ayarlar', label: 'Ayarlar', icon: 'settings' },
];
