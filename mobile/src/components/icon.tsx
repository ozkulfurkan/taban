import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';

// Uygulamada kullanılan simgeler: iOS'ta SF Symbols, Android ve web'de Material Symbols
const ICONS = {
  home: ['house', 'home'],
  people: ['person.2', 'group'],
  doc: ['doc.text', 'description'],
  cheque: ['banknote', 'payments'],
  box: ['shippingbox', 'inventory_2'],
  settings: ['gearshape', 'settings'],
  search: ['magnifyingglass', 'search'],
  chevron: ['chevron.right', 'chevron_right'],
  share: ['square.and.arrow.up', 'share'],
  link: ['link', 'link'],
  pdf: ['doc.richtext', 'picture_as_pdf'],
  plus: ['plus', 'add'],
  phone: ['phone', 'call'],
  mail: ['envelope', 'mail'],
  wallet: ['creditcard', 'account_balance_wallet'],
  arrowDown: ['arrow.down.circle', 'arrow_circle_down'],
  arrowUp: ['arrow.up.circle', 'arrow_circle_up'],
  alert: ['exclamationmark.triangle', 'warning'],
  lock: ['faceid', 'fingerprint'],
  logout: ['rectangle.portrait.and.arrow.right', 'logout'],
  info: ['info.circle', 'info'],
  barcode: ['barcode.viewfinder', 'barcode_scanner'],
  cart: ['cart', 'shopping_cart'],
  calendar: ['calendar', 'calendar_month'],
  truck: ['truck.box', 'local_shipping'],
  bank: ['building.columns', 'account_balance'],
  undo: ['arrow.uturn.backward', 'undo'],
  newDoc: ['plus.circle', 'add_circle'],
  transfer: ['arrow.left.arrow.right', 'swap_horiz'],
  edit: ['pencil', 'edit'],
  trash: ['trash', 'delete'],
  orders: ['list.clipboard', 'assignment'],
  chart: ['chart.bar', 'bar_chart'],
  send: ['paperplane', 'send'],
  userAdd: ['person.badge.plus', 'person_add'],
  person: ['person', 'person'],
  check: ['checkmark.circle', 'check_circle'],
  tag: ['tag', 'sell'],
  back: ['chevron.left', 'chevron_left'],
} as const satisfies Record<string, readonly [SFSymbol, AndroidSymbol]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const c = useTheme();
  const [ios, android] = ICONS[name];
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={size}
      tintColor={color ?? c.textSecondary}
    />
  );
}

export const tabIcon = (name: IconName) => ({ sf: ICONS[name][0], md: ICONS[name][1] });
