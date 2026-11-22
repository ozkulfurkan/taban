// Uygulamanın ikon seti: Phosphor (eski Lucide adlarıyla). İkonlar tek yerden yönetilir; kalınlık ve stil tutarlı kalır.
// Yeni ikon gerektiğinde buraya ekleyin; sayfalarda doğrudan '@phosphor-icons/react' kullanmayın.
import type { ComponentType, SVGProps } from 'react';
import {
  Archive as PhArchive,
  ArrowCircleDown as PhArrowCircleDown,
  ArrowCircleUp as PhArrowCircleUp,
  ArrowCounterClockwise as PhArrowCounterClockwise,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowSquareOut as PhArrowSquareOut,
  ArrowsClockwise as PhArrowsClockwise,
  ArrowsDownUp as PhArrowsDownUp,
  ArrowsLeftRight as PhArrowsLeftRight,
  Bank as PhBank,
  Bell as PhBell,
  BookOpen as PhBookOpen,
  Bug as PhBug,
  Buildings as PhBuildings,
  Calculator as PhCalculator,
  Calendar as PhCalendar,
  CalendarBlank as PhCalendarBlank,
  Camera as PhCamera,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  CaretUp as PhCaretUp,
  ChartBar as PhChartBar,
  ChatCircle as PhChatCircle,
  ChatText as PhChatText,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  Checks as PhChecks,
  Circle as PhCircle,
  CircleNotch as PhCircleNotch,
  ClipboardText as PhClipboardText,
  Clock as PhClock,
  ClockCounterClockwise as PhClockCounterClockwise,
  Copy as PhCopy,
  CreditCard as PhCreditCard,
  Crown as PhCrown,
  Cube as PhCube,
  CurrencyDollar as PhCurrencyDollar,
  DeviceMobile as PhDeviceMobile,
  DotOutline as PhDotOutline,
  DotsSix as PhDotsSix,
  DotsSixVertical as PhDotsSixVertical,
  DotsThree as PhDotsThree,
  DownloadSimple as PhDownloadSimple,
  EnvelopeSimple as PhEnvelopeSimple,
  EnvelopeSimpleOpen as PhEnvelopeSimpleOpen,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  Factory as PhFactory,
  FileArrowDown as PhFileArrowDown,
  FileText as PhFileText,
  FileXls as PhFileXls,
  Flame as PhFlame,
  FloppyDisk as PhFloppyDisk,
  Funnel as PhFunnel,
  GearSix as PhGearSix,
  Globe as PhGlobe,
  Hash as PhHash,
  Image as PhImage,
  Info as PhInfo,
  Key as PhKey,
  Lifebuoy as PhLifebuoy,
  Lightbulb as PhLightbulb,
  Link as PhLink,
  LinkSimple as PhLinkSimple,
  List as PhList,
  ListBullets as PhListBullets,
  MagnifyingGlass as PhMagnifyingGlass,
  MapPin as PhMapPin,
  Minus as PhMinus,
  Money as PhMoney,
  Note as PhNote,
  Package as PhPackage,
  PaintBrush as PhPaintBrush,
  PaperPlaneTilt as PhPaperPlaneTilt,
  Paperclip as PhPaperclip,
  Pencil as PhPencil,
  PencilSimple as PhPencilSimple,
  Phone as PhPhone,
  Plus as PhPlus,
  PlusCircle as PhPlusCircle,
  Printer as PhPrinter,
  Prohibit as PhProhibit,
  QrCode as PhQrCode,
  Receipt as PhReceipt,
  Scissors as PhScissors,
  Scroll as PhScroll,
  ShareNetwork as PhShareNetwork,
  Shield as PhShield,
  ShieldWarning as PhShieldWarning,
  ShoppingBag as PhShoppingBag,
  ShoppingCart as PhShoppingCart,
  SignIn as PhSignIn,
  SignOut as PhSignOut,
  SlidersHorizontal as PhSlidersHorizontal,
  Sparkle as PhSparkle,
  SquaresFour as PhSquaresFour,
  Stack as PhStack,
  Star as PhStar,
  Tag as PhTag,
  Trash as PhTrash,
  TreeStructure as PhTreeStructure,
  TrendDown as PhTrendDown,
  TrendUp as PhTrendUp,
  Truck as PhTruck,
  UploadSimple as PhUploadSimple,
  User as PhUser,
  UserCheck as PhUserCheck,
  UserGear as PhUserGear,
  UserPlus as PhUserPlus,
  Users as PhUsers,
  Wallet as PhWallet,
  Warehouse as PhWarehouse,
  Warning as PhWarning,
  WarningCircle as PhWarningCircle,
  Wrench as PhWrench,
  X as PhX,
  XCircle as PhXCircle,
} from '@phosphor-icons/react/ssr';
import type { IconProps as PhIconProps } from '@phosphor-icons/react';

export type IconProps = Omit<PhIconProps, 'ref'> & { strokeWidth?: number | string } & Omit<SVGProps<SVGSVGElement>, 'ref' | 'color'>;
export type LucideIcon = ComponentType<IconProps>;

function make(Ph: ComponentType<PhIconProps>, name: string): LucideIcon {
  // strokeWidth Lucide'den kalma; Phosphor kalınlığı weight ile verir (varsayılan regular)
  // eslint-disable-next-line
  const Icon = ({ strokeWidth: _sw, weight = 'regular', ...props }: IconProps) => <Ph weight={weight} {...(props as PhIconProps)} />;
  Icon.displayName = name;
  return Icon;
}

export const AlertCircle = make(PhWarningCircle, 'AlertCircle');
export const AlertTriangle = make(PhWarning, 'AlertTriangle');
export const ArrowDownCircle = make(PhArrowCircleDown, 'ArrowDownCircle');
export const ArrowLeft = make(PhArrowLeft, 'ArrowLeft');
export const ArrowLeftRight = make(PhArrowsLeftRight, 'ArrowLeftRight');
export const ArrowRight = make(PhArrowRight, 'ArrowRight');
export const ArrowUpCircle = make(PhArrowCircleUp, 'ArrowUpCircle');
export const ArrowUpDown = make(PhArrowsDownUp, 'ArrowUpDown');
export const Ban = make(PhProhibit, 'Ban');
export const Banknote = make(PhMoney, 'Banknote');
export const BarChart2 = make(PhChartBar, 'BarChart2');
export const BarChart3 = make(PhChartBar, 'BarChart3');
export const Bell = make(PhBell, 'Bell');
export const BookOpen = make(PhBookOpen, 'BookOpen');
export const BoxIcon = make(PhCube, 'BoxIcon');
export const Bug = make(PhBug, 'Bug');
export const Building2 = make(PhBuildings, 'Building2');
export const Calculator = make(PhCalculator, 'Calculator');
export const Calendar = make(PhCalendarBlank, 'Calendar');
export const CalendarDays = make(PhCalendar, 'CalendarDays');
export const Camera = make(PhCamera, 'Camera');
export const Check = make(PhCheck, 'Check');
export const CheckCheck = make(PhChecks, 'CheckCheck');
export const CheckCircle = make(PhCheckCircle, 'CheckCircle');
export const CheckCircle2 = make(PhCheckCircle, 'CheckCircle2');
export const ChevronDown = make(PhCaretDown, 'ChevronDown');
export const ChevronLeft = make(PhCaretLeft, 'ChevronLeft');
export const ChevronRight = make(PhCaretRight, 'ChevronRight');
export const ChevronUp = make(PhCaretUp, 'ChevronUp');
export const Circle = make(PhCircle, 'Circle');
export const ClipboardList = make(PhClipboardText, 'ClipboardList');
export const Clock = make(PhClock, 'Clock');
export const Copy = make(PhCopy, 'Copy');
export const CreditCard = make(PhCreditCard, 'CreditCard');
export const Crown = make(PhCrown, 'Crown');
export const DollarSign = make(PhCurrencyDollar, 'DollarSign');
export const Dot = make(PhDotOutline, 'Dot');
export const Download = make(PhDownloadSimple, 'Download');
export const Edit2 = make(PhPencilSimple, 'Edit2');
export const ExternalLink = make(PhArrowSquareOut, 'ExternalLink');
export const Eye = make(PhEye, 'Eye');
export const EyeOff = make(PhEyeSlash, 'EyeOff');
export const Factory = make(PhFactory, 'Factory');
export const FileDown = make(PhFileArrowDown, 'FileDown');
export const FileSpreadsheet = make(PhFileXls, 'FileSpreadsheet');
export const FileText = make(PhFileText, 'FileText');
export const Filter = make(PhFunnel, 'Filter');
export const Flame = make(PhFlame, 'Flame');
export const Globe = make(PhGlobe, 'Globe');
export const GripHorizontal = make(PhDotsSix, 'GripHorizontal');
export const GripVertical = make(PhDotsSixVertical, 'GripVertical');
export const Hash = make(PhHash, 'Hash');
export const History = make(PhClockCounterClockwise, 'History');
export const Image = make(PhImage, 'Image');
export const ImageIcon = make(PhImage, 'ImageIcon');
export const Info = make(PhInfo, 'Info');
export const Key = make(PhKey, 'Key');
export const KeyRound = make(PhKey, 'KeyRound');
export const Landmark = make(PhBank, 'Landmark');
export const Layers = make(PhStack, 'Layers');
export const LayoutDashboard = make(PhSquaresFour, 'LayoutDashboard');
export const LifeBuoy = make(PhLifebuoy, 'LifeBuoy');
export const Lightbulb = make(PhLightbulb, 'Lightbulb');
export const Link2 = make(PhLinkSimple, 'Link2');
export const LinkIcon = make(PhLink, 'LinkIcon');
export const List = make(PhListBullets, 'List');
export const Loader2 = make(PhCircleNotch, 'Loader2');
export const LogIn = make(PhSignIn, 'LogIn');
export const LogOut = make(PhSignOut, 'LogOut');
export const Mail = make(PhEnvelopeSimple, 'Mail');
export const MailWarning = make(PhEnvelopeSimpleOpen, 'MailWarning');
export const MapPin = make(PhMapPin, 'MapPin');
export const Menu = make(PhList, 'Menu');
export const MessageCircle = make(PhChatCircle, 'MessageCircle');
export const MessageSquare = make(PhChatText, 'MessageSquare');
export const Minus = make(PhMinus, 'Minus');
export const MoreHorizontal = make(PhDotsThree, 'MoreHorizontal');
export const Network = make(PhTreeStructure, 'Network');
export const Package = make(PhPackage, 'Package');
export const PackageOpen = make(PhArchive, 'PackageOpen');
export const Paintbrush = make(PhPaintBrush, 'Paintbrush');
export const Paperclip = make(PhPaperclip, 'Paperclip');
export const Pencil = make(PhPencil, 'Pencil');
export const Phone = make(PhPhone, 'Phone');
export const Plus = make(PhPlus, 'Plus');
export const PlusCircle = make(PhPlusCircle, 'PlusCircle');
export const Printer = make(PhPrinter, 'Printer');
export const QrCode = make(PhQrCode, 'QrCode');
export const Receipt = make(PhReceipt, 'Receipt');
export const RefreshCw = make(PhArrowsClockwise, 'RefreshCw');
export const RotateCcw = make(PhArrowCounterClockwise, 'RotateCcw');
export const Save = make(PhFloppyDisk, 'Save');
export const Scissors = make(PhScissors, 'Scissors');
export const ScrollText = make(PhScroll, 'ScrollText');
export const Search = make(PhMagnifyingGlass, 'Search');
export const Send = make(PhPaperPlaneTilt, 'Send');
export const Settings = make(PhGearSix, 'Settings');
export const Share2 = make(PhShareNetwork, 'Share2');
export const Shield = make(PhShield, 'Shield');
export const ShieldAlert = make(PhShieldWarning, 'ShieldAlert');
export const ShoppingBag = make(PhShoppingBag, 'ShoppingBag');
export const ShoppingCart = make(PhShoppingCart, 'ShoppingCart');
export const SlidersHorizontal = make(PhSlidersHorizontal, 'SlidersHorizontal');
export const Smartphone = make(PhDeviceMobile, 'Smartphone');
export const Sparkles = make(PhSparkle, 'Sparkles');
export const Star = make(PhStar, 'Star');
export const StickyNote = make(PhNote, 'StickyNote');
export const Tag = make(PhTag, 'Tag');
export const Trash2 = make(PhTrash, 'Trash2');
export const TrendingDown = make(PhTrendDown, 'TrendingDown');
export const TrendingUp = make(PhTrendUp, 'TrendingUp');
export const Truck = make(PhTruck, 'Truck');
export const Upload = make(PhUploadSimple, 'Upload');
export const User = make(PhUser, 'User');
export const UserCheck = make(PhUserCheck, 'UserCheck');
export const UserCog = make(PhUserGear, 'UserCog');
export const UserPlus = make(PhUserPlus, 'UserPlus');
export const Users = make(PhUsers, 'Users');
export const Wallet = make(PhWallet, 'Wallet');
export const Warehouse = make(PhWarehouse, 'Warehouse');
export const Wrench = make(PhWrench, 'Wrench');
export const X = make(PhX, 'X');
export const XCircle = make(PhXCircle, 'XCircle');
