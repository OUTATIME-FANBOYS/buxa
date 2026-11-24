import {
  AtSign,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowRight,
  Bell,
  Bookmark,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Clock,
  ClipboardCheck,
  Copy,
  Download,
  Ellipsis,
  Folder,
  Funnel,
  GanttChart,
  GripVertical,
  Info,
  Inbox,
  Kanban,
  LayoutDashboard,
  List,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  PanelLeft,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Sun,
  Tent,
  Trash2,
  Undo2,
  User,
  Users,
  X,
  ChartColumn,
  Ban,
  FileDown,
  FileUp,
  IdCard,
  Import,
  Mail,
  Pause,
  Phone,
  Play,
  Power,
  Printer,
  RefreshCw,
  RotateCcw,
  Send,
  Unlink,
  Upload,
  UserMinus,
  UserPlus,
  CalendarClock,
  CalendarDays,
  Hourglass,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

/**
 * The icon name set. Call sites use <Icon name="..."/> with one of these keys;
 * each maps to the closest lucide-react glyph. The four priority icons are the exception: no lucide glyph is a circle with an
 * arrow, a triangle or a dash, so PriorityIcon (below) draws them on the same 24-unit grid.
 * The brand mark (BrandMark) is not in this set.
 */
export const ICONS: Record<string, LucideIcon> = {
  plus: Plus,
  search: Search,
  dashboard: LayoutDashboard,
  tasks: ListChecks,
  folder: Folder,
  kanban: Kanban,
  camp: Tent,
  calendar: Calendar,
  users: Users,
  chart: ChartColumn,
  settings: SlidersHorizontal,
  bell: Bell,
  down: ChevronDown,
  left: ChevronLeft,
  right: ChevronRight,
  x: X,
  more: Ellipsis,
  filter: Funnel,
  list: List,
  timeline: GanttChart,
  trash: Trash2,
  copy: Copy,
  'clipboard-check': ClipboardCheck,
  archive: Archive,
  'archive-restore': ArchiveRestore,
  save: Save,
  edit: Pencil,
  sun: Sun,
  moon: Moon,
  clip: Paperclip,
  message: MessageSquare,
  clock: Clock,
  grip: GripVertical,
  logout: LogOut,
  panel: PanelLeft,
  menu: Menu,
  check: Check,
  help: CircleHelp,
  alert: CircleAlert,
  info: Info,
  download: Download,
  bookmark: Bookmark,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  user: User,
  at: AtSign,
  agent: Bot,
  undo: Undo2,
  inbox: Inbox,
  print: Printer,
  upload: Upload,
  ban: Ban,
  badge: IdCard,
  'user-plus': UserPlus,
  'user-minus': UserMinus,
  refresh: RefreshCw,
  rotate: RotateCcw,
  unlink: Unlink,
  mail: Mail,
  phone: Phone,
  send: Send,
  play: Play,
  pause: Pause,
  power: Power,
  import: Import,
  'file-up': FileUp,
  'file-down': FileDown,
  'calendar-clock': CalendarClock,
  'calendar-days': CalendarDays,
  hourglass: Hourglass,
  'map-pin': MapPin,
};

/** The status glyphs: lucide where one fits, and a dashed clock for "in progress", which lucide does not have. */
export type StatusGlyph = 'clock' | 'dashed-clock' | 'send' | 'search' | 'circle-check';

/**
 * A status as a line icon on the set's 24-unit grid, in currentColor. Backlog a clock, To Do a send arrow, In Progress a dashed
 * clock, In Review a magnifier, Done a check in a circle. Decorative: the status name is the text beside it.
 */
export function StatusIcon({
  glyph,
  size = 14,
  className = '',
}: {
  glyph: StatusGlyph;
  size?: number;
  className?: string;
}) {
  if (glyph === 'dashed-clock') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
        className={className}
      >
        <circle cx="12" cy="12" r="10" strokeDasharray="3.2 3.2" />
        <path d="M12 6.5V12l3.5 2" />
      </svg>
    );
  }
  const Glyph = { clock: Clock, send: Send, search: Search, 'circle-check': CircleCheck }[glyph];

  return <Glyph className={className} size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}

export type PriorityGlyph = 'critical' | 'high' | 'medium' | 'low';

// Each priority takes its existing --p-* token, the same colour as the priority field, so the icon stays linked to it.
const PRIORITY_GLYPH_COLOUR: Record<PriorityGlyph, string> = {
  critical: 'buxa:text-[var(--p-critical)]',
  high: 'buxa:text-[var(--p-high)]',
  medium: 'buxa:text-[var(--p-medium)]',
  low: 'buxa:text-[var(--p-low)]',
};

/**
 * A priority as an icon, on the same 24-unit grid as the set above. Critical is a red circle with an up arrow, high an orange
 * circle with an up triangle, medium a blue circle with a dash, and low a grey outline circle with a down arrow. The mark
 * inside a filled circle is drawn in the surface colour. Decorative: the caller's title or screen-reader text names the priority.
 */
export function PriorityIcon({
  priority,
  size = 14,
  className = '',
}: {
  priority: PriorityGlyph;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={[PRIORITY_GLYPH_COLOUR[priority], className].filter(Boolean).join(' ')}
    >
      {priority === 'low' ? (
        <>
          <circle cx="12" cy="12" r="10.25" fill="none" stroke="currentColor" strokeWidth="1.75" />
          <path
            d="M12 7.25v9.5M8.5 13.25 12 16.75l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="11" fill="currentColor" />
          {priority === 'critical' && (
            <path
              d="M12 16.5V7.75M8.5 11.25 12 7.75l3.5 3.5"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="buxa:stroke-[var(--surface)]"
            />
          )}
          {/* The triangle's visual weight sits at its centroid (a third of the way up from the base), so it is raised 1 unit
           * from the box position to put that centroid on the circle's centre (y 12). */}
          {priority === 'high' && <path d="M12 6.25 16.75 15.25H7.25Z" className="buxa:fill-[var(--surface)]" />}
          {priority === 'medium' && (
            <path
              d="M7.5 12h9"
              fill="none"
              strokeWidth="2.25"
              strokeLinecap="round"
              className="buxa:stroke-[var(--surface)]"
            />
          )}
        </>
      )}
    </svg>
  );
}
