// PROTOTYPE — throwaway. Wayfinder ticket "How does the Notification feed look
// and behave?" (#5).
//
// Three variants of the bell + unread count + feed, mounted in the real app
// layout (every page), switchable via `?variant=A|B|C` and the floating bar.
// Feed data is stubbed (app/lib/prototype-notification-feed.server.ts) and read
// state lives in memory, so switching users in DevUI resets it.
//
//   A  Sidebar bell + popover      click a row = read + go; per-row read toggle
//   B  Sidebar nav item + drawer   Unread/All tabs, date groups, drawer stays open
//   C  Top bar bell + dropdown     badge counts UNREAD; opening changes nothing,
//                                  only clicking a row (or Mark all read) reads it
//   D  Skimmable feed              coloured kind headline, the thing it's about
//                                  as the big line, who/where muted, kind filters
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  CircleCheck,
  CircleX,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MessageSquareReply,
  Receipt,
  UserPlus,
  X,
} from "lucide-react";
import { cn, formatRelativeTime } from "~/lib/utils";
import type {
  ProtoNotification,
  ProtoNotificationKind,
} from "~/lib/prototype-notification-feed.server";

export const PROTO_VARIANTS = ["A", "B", "C", "D"] as const;
export type ProtoVariant = (typeof PROTO_VARIANTS)[number];
const VARIANT_NAMES: Record<ProtoVariant, string> = {
  A: "Sidebar bell + popover",
  B: "Nav item + drawer",
  C: "Top bar + unread",
  D: "Skimmable: headline + title + filters",
};

export function useProtoVariant(): ProtoVariant {
  const [params] = useSearchParams();
  const v = params.get("variant");
  return (PROTO_VARIANTS as readonly string[]).includes(v ?? "")
    ? (v as ProtoVariant)
    : "A";
}

// ---------------------------------------------------------------------------
// In-memory feed state (stands in for Cadence's feed source)
// ---------------------------------------------------------------------------

export interface ProtoFeed {
  items: ProtoNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  toggleRead: (id: string) => void;
  markAllRead: () => void;
  push: (count?: number) => void;
  empty: () => void;
  reset: () => void;
}

export function useProtoFeed(
  initial: ProtoNotification[],
  incoming: Omit<ProtoNotification, "id" | "createdAt" | "read">[]
): ProtoFeed {
  const [items, setItems] = useState(initial);
  const counter = useRef(0);

  const markRead = useCallback(
    (id: string) =>
      setItems((xs) => xs.map((n) => (n.id === id ? { ...n, read: true } : n))),
    []
  );
  return {
    items,
    unreadCount: items.filter((n) => !n.read).length,
    markRead,
    toggleRead: (id) =>
      setItems((xs) =>
        xs.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
      ),
    markAllRead: () => setItems((xs) => xs.map((n) => ({ ...n, read: true }))),
    push: (count = 1) => {
      if (incoming.length === 0) return;
      const fresh: ProtoNotification[] = [];
      for (let i = 0; i < count; i++) {
        const template = incoming[counter.current % incoming.length];
        counter.current += 1;
        fresh.unshift({
          ...template,
          id: `live-${counter.current}-${Date.now()}`,
          // spread a batch over the last few minutes so times differ
          createdAt: new Date(Date.now() - (count - 1 - i) * 90_000).toISOString(),
          read: false,
        });
      }
      setItems((xs) =>
        [...fresh, ...xs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    },
    empty: () => setItems([]),
    reset: () => setItems(initial),
  };
}

// ---------------------------------------------------------------------------
// Shared bits (icons + navigation that keeps ?variant=)
// ---------------------------------------------------------------------------

const KIND_ICON: Record<ProtoNotificationKind, React.ReactNode> = {
  "refund-approved": <Receipt className="size-4 text-green-600" />,
  "refund-declined": <Receipt className="size-4 text-amber-600" />,
  "lesson-question": <MessageSquare className="size-4 text-blue-600" />,
  reply: <MessageSquareReply className="size-4 text-violet-600" />,
  "seat-claimed": <UserPlus className="size-4 text-teal-600" />,
};

const KIND_LABEL: Record<ProtoNotificationKind, string> = {
  "refund-approved": "Refund Request",
  "refund-declined": "Refund Request",
  "lesson-question": "Lesson Question",
  reply: "Reply",
  "seat-claimed": "Seat",
};

function useGo(variant: ProtoVariant) {
  const navigate = useNavigate();
  return (href: string) => {
    const [path, hash] = href.split("#");
    navigate(`${path}?variant=${variant}${hash ? `#${hash}` : ""}`);
  };
}

/** Renders the catalogue sentence with actor and subject emphasised. */
function Sentence({ n }: { n: ProtoNotification }) {
  const parts: React.ReactNode[] = [];
  let rest = n.text;
  for (const bold of [n.actor, n.subject]) {
    if (!bold) continue;
    const i = rest.indexOf(bold);
    if (i < 0) continue;
    parts.push(rest.slice(0, i), <strong key={bold}>{bold}</strong>);
    rest = rest.slice(i + bold.length);
  }
  parts.push(rest);
  return <>{parts}</>;
}

function Time({ iso }: { iso: string }) {
  return <span suppressHydrationWarning>{formatRelativeTime(iso)}</span>;
}

function Badge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null;
  return (
    <span
      className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function useClickOutside(
  open: boolean,
  close: () => void,
  refs: React.RefObject<HTMLElement | null>[]
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (refs.some((r) => r.current?.contains(e.target as Node))) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, refs]);
}

// ---------------------------------------------------------------------------
// Variant A — bell in the sidebar header, popover beside the sidebar
// ---------------------------------------------------------------------------

export function VariantABell({ feed }: { feed: ProtoFeed }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(open, close, [btn, panel]);
  const go = useGo("A");

  return (
    <>
      <button
        ref={btn}
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative ml-auto rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
        <Badge count={feed.unreadCount} className="absolute -right-1 -top-1" />
      </button>
      {open && (
        <div
          ref={panel}
          className="fixed left-[14.5rem] top-2 z-40 flex max-h-[80vh] w-96 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Notifications</span>
            <button
              onClick={feed.markAllRead}
              disabled={feed.unreadCount === 0}
              className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          {feed.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
              <BellOff className="size-8" />
              <div className="font-medium text-foreground">
                No notifications yet
              </div>
              <div>
                We'll let you know when something needs your attention.
              </div>
            </div>
          ) : (
            <ul className="divide-y overflow-y-auto">
              {feed.items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "group relative flex cursor-pointer gap-3 px-4 py-3 hover:bg-muted/60",
                    !n.read && "bg-primary/5"
                  )}
                  onClick={() => {
                    feed.markRead(n.id);
                    setOpen(false);
                    go(n.href);
                  }}
                >
                  <div className="mt-0.5">{KIND_ICON[n.kind]}</div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "text-sm",
                        n.read ? "text-muted-foreground" : "text-foreground"
                      )}
                    >
                      <Sentence n={n} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <Time iso={n.createdAt} />
                    </div>
                  </div>
                  <button
                    title={n.read ? "Mark unread" : "Mark read"}
                    onClick={(e) => {
                      e.stopPropagation();
                      feed.toggleRead(n.id);
                    }}
                    className="flex size-5 shrink-0 items-center justify-center self-center rounded-full"
                  >
                    {n.read ? (
                      <span className="size-2 rounded-full border border-muted-foreground/40 opacity-0 group-hover:opacity-100" />
                    ) : (
                      <span className="size-2 rounded-full bg-primary" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Variant B — "Notifications" nav item, full-height drawer next to the sidebar
// ---------------------------------------------------------------------------

function groupOf(iso: string) {
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1) return "Today";
  if (days < 7) return "This week";
  return "Earlier";
}

export function VariantBNavItem({ feed }: { feed: ProtoFeed }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(open, close, [btn, panel]);
  const go = useGo("B");

  const shown =
    tab === "unread" ? feed.items.filter((n) => !n.read) : feed.items;
  const groups = ["Today", "This week", "Earlier"]
    .map((g) => ({ g, xs: shown.filter((n) => groupOf(n.createdAt) === g) }))
    .filter((x) => x.xs.length > 0);

  return (
    <>
      <button
        ref={btn}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          open
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )}
      >
        <Bell className="size-4" />
        Notifications
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-xs font-semibold",
            feed.unreadCount
              ? "bg-primary text-primary-foreground"
              : "hidden"
          )}
        >
          {feed.unreadCount}
        </span>
      </button>
      {open && (
        <div
          ref={panel}
          className="fixed bottom-0 left-56 top-0 z-40 flex w-[26rem] flex-col border-r bg-background shadow-2xl"
        >
          <div className="flex h-14 items-center gap-2 border-b px-5">
            <span className="text-lg font-semibold">Notifications</span>
            <button
              onClick={close}
              className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex items-center gap-1 border-b px-5 py-2">
            {(["unread", "all"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm capitalize",
                  tab === t
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t}
                {t === "unread" && feed.unreadCount > 0
                  ? ` (${feed.unreadCount})`
                  : ""}
              </button>
            ))}
            <button
              onClick={feed.markAllRead}
              disabled={feed.unreadCount === 0}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <CheckCheck className="size-3.5" /> Mark all read
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {groups.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-sm text-muted-foreground">
                <CheckCheck className="size-10" />
                <div className="font-medium text-foreground">
                  {tab === "unread" && feed.items.length > 0
                    ? "You're all caught up"
                    : "No notifications yet"}
                </div>
                {tab === "unread" && feed.items.length > 0 && (
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setTab("all")}
                  >
                    Show all
                  </button>
                )}
              </div>
            ) : (
              groups.map(({ g, xs }) => (
                <section key={g}>
                  <h3 className="sticky top-0 bg-background/95 px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {g}
                  </h3>
                  {xs.map((n) => (
                    <div
                      key={n.id}
                      className="group mx-3 mb-1 flex cursor-pointer gap-3 rounded-lg p-3 hover:bg-muted"
                      onClick={() => {
                        feed.markRead(n.id);
                        go(n.href); // drawer stays open
                      }}
                    >
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        {KIND_ICON[n.kind]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {KIND_LABEL[n.kind]} · <Time iso={n.createdAt} />
                        </div>
                        <div
                          className={cn(
                            "mt-0.5 text-sm",
                            !n.read && "font-medium"
                          )}
                        >
                          <Sentence n={n} />
                        </div>
                      </div>
                      {!n.read && (
                        <button
                          title="Mark read"
                          onClick={(e) => {
                            e.stopPropagation();
                            feed.markRead(n.id);
                          }}
                          className="self-start rounded-md p-1 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                        >
                          <Check className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Variant C — slim top bar over the page; badge = unread count, highlight = unread
// ---------------------------------------------------------------------------

export function VariantCTopBar({ feed }: { feed: ProtoFeed }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(open, close, [btn, panel]);
  const go = useGo("C");

  return (
    <div className="sticky top-0 z-30 flex h-12 items-center justify-end border-b bg-background/90 px-6 backdrop-blur">
      <div className="relative">
        <button
          ref={btn}
          onClick={() => setOpen((o) => !o)} // opening reads nothing
          className="relative flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <Bell className="size-4" />
          {feed.unreadCount > 0 ? (
            <span className="font-semibold">{feed.unreadCount} unread</span>
          ) : (
            <span className="text-muted-foreground">Notifications</span>
          )}
          {feed.unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red-600 ring-2 ring-background" />
          )}
        </button>
        {open && (
          <div
            ref={panel}
            className="absolute right-0 top-11 flex max-h-[min(32rem,calc(100vh-5rem))] w-[30rem] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
          >
            {feed.items.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                Nothing here. Refund decisions, Lesson Questions, Replies and
                Seat claims will show up here.
              </div>
            ) : (
              <>
                {/* the list scrolls; the footer below stays pinned */}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <table className="w-full text-sm">
                  <tbody>
                    {feed.items.map((n) => (
                      <tr
                        key={n.id}
                        onClick={() => {
                          feed.markRead(n.id);
                          setOpen(false);
                          go(n.href);
                        }}
                        className={cn(
                          "cursor-pointer border-b last:border-0 hover:bg-muted",
                          !n.read &&
                            "border-l-4 border-l-primary bg-primary/5"
                        )}
                      >
                        <td className="w-8 py-2 pl-3">{KIND_ICON[n.kind]}</td>
                        <td
                          className={cn(
                            "py-2 pr-2 leading-snug",
                            n.read && "text-muted-foreground"
                          )}
                        >
                          <Sentence n={n} />
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-right text-xs text-muted-foreground">
                          <Time iso={n.createdAt} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                <div className="flex shrink-0 justify-between border-t bg-muted/40 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">
                    {feed.unreadCount} unread
                  </span>
                  <button
                    onClick={feed.markAllRead}
                    className="font-medium text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant D — built for skimming. Every row reads top-down as:
//   [kind tile]  WHAT HAPPENED (coloured)                 time
//                The thing it's about (lesson / course)   ← the big line
//                Who · where (muted)
// plus filter chips by kind, so an Instructor can jump to just Lesson Questions.
// ---------------------------------------------------------------------------

const D_KIND: Record<
  ProtoNotificationKind,
  { headline: string; tile: string; text: string; icon: React.ReactNode; filter: string }
> = {
  "refund-approved": {
    headline: "Refund approved",
    tile: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    text: "text-green-700 dark:text-green-400",
    icon: <CircleCheck className="size-5" />,
    filter: "Refunds",
  },
  "refund-declined": {
    headline: "Refund declined",
    tile: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-400",
    icon: <CircleX className="size-5" />,
    filter: "Refunds",
  },
  "lesson-question": {
    headline: "New Lesson Question",
    tile: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    text: "text-blue-700 dark:text-blue-400",
    icon: <MessageSquare className="size-5" />,
    filter: "Questions",
  },
  reply: {
    headline: "Reply to your question",
    tile: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-400",
    icon: <MessageSquareReply className="size-5" />,
    filter: "Replies",
  },
  "seat-claimed": {
    headline: "Seat claimed",
    tile: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    text: "text-teal-700 dark:text-teal-400",
    icon: <UserPlus className="size-5" />,
    filter: "Seats",
  },
};

function dMeta(n: ProtoNotification) {
  switch (n.kind) {
    case "refund-approved":
      return "Cadence approved your Refund Request";
    case "refund-declined":
      return "See the note from Cadence";
    case "seat-claimed":
      return `${n.actor} joined your team`;
    default:
      return [n.actor, n.context].filter(Boolean).join(" · ");
  }
}

export function VariantDSkim({ feed }: { feed: ProtoFeed }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<string>("All");
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(open, close, [btn, panel]);
  const go = useGo("D");

  const filters = [
    "All",
    ...Array.from(new Set(feed.items.map((n) => D_KIND[n.kind].filter))),
  ];
  const unreadIn = (f: string) =>
    feed.items.filter(
      (n) => !n.read && (f === "All" || D_KIND[n.kind].filter === f)
    ).length;
  const shown =
    filter === "All"
      ? feed.items
      : feed.items.filter((n) => D_KIND[n.kind].filter === filter);

  return (
    <>
      <button
        ref={btn}
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative ml-auto rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
        <Badge count={feed.unreadCount} className="absolute -right-1 -top-1" />
      </button>
      {open && (
        <div
          ref={panel}
          className="fixed left-[14.5rem] top-2 z-40 flex max-h-[85vh] w-[28rem] flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="font-semibold">Notifications</span>
            <button
              onClick={feed.markAllRead}
              disabled={feed.unreadCount === 0}
              className="text-xs font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          {filters.length > 2 && (
            <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs",
                    filter === f
                      ? "border-foreground bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {f}
                  {unreadIn(f) > 0 && (
                    <span className="font-bold">{unreadIn(f)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {filters.length <= 2 && <div className="border-b pt-2.5" />}
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-muted-foreground">
              <BellOff className="size-8" />
              <div className="font-medium text-foreground">
                No notifications yet
              </div>
            </div>
          ) : (
            <ul className="overflow-y-auto">
              {shown.map((n) => {
                const k = D_KIND[n.kind];
                return (
                  <li
                    key={n.id}
                    onClick={() => {
                      feed.markRead(n.id);
                      setOpen(false);
                      go(n.href);
                    }}
                    className={cn(
                      "group relative flex cursor-pointer gap-3 border-b px-4 py-3 last:border-0 hover:bg-muted/60",
                      n.read && "opacity-60 hover:opacity-100"
                    )}
                  >
                    {!n.read && (
                      <span className="absolute left-0 top-0 h-full w-1 bg-primary" />
                    )}
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg",
                        k.tile
                      )}
                    >
                      {k.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "text-xs font-semibold uppercase tracking-wide",
                            k.text
                          )}
                        >
                          {k.headline}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          <Time iso={n.createdAt} />
                        </span>
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 line-clamp-2 text-[15px] leading-snug",
                          n.read ? "font-normal" : "font-semibold"
                        )}
                        title={n.text}
                      >
                        {n.subject}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {dMeta(n)}
                      </div>
                    </div>
                    <button
                      title={n.read ? "Mark unread" : "Mark read"}
                      onClick={(e) => {
                        e.stopPropagation();
                        feed.toggleRead(n.id);
                      }}
                      className="self-center rounded-md p-1 text-muted-foreground opacity-0 hover:bg-background hover:text-foreground group-hover:opacity-100"
                    >
                      <Check className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Floating switcher (+ feed controls so empty/real-time can be judged)
// ---------------------------------------------------------------------------

export function PrototypeSwitcher({ feed }: { feed: ProtoFeed }) {
  const current = useProtoVariant();
  const [params, setParams] = useSearchParams();

  const cycle = useCallback(
    (dir: 1 | -1) => {
      const i = PROTO_VARIANTS.indexOf(current);
      const next =
        PROTO_VARIANTS[(i + dir + PROTO_VARIANTS.length) % PROTO_VARIANTS.length];
      const p = new URLSearchParams(params);
      p.set("variant", next);
      setParams(p, { replace: true, preventScrollReset: true });
    },
    [current, params, setParams]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable ||
          t.closest("[contenteditable]"))
      )
        return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycle]);

  if (process.env.NODE_ENV === "production") return null;

  const btn =
    "rounded-full px-2 py-1 text-xs hover:bg-white/15 transition-colors";
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-900 px-2 py-1.5 text-white shadow-2xl ring-2 ring-fuchsia-500">
      <button className={btn} onClick={() => cycle(-1)} title="Previous (←)">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-48 text-center text-sm font-medium">
        {current} ({VARIANT_NAMES[current]})
      </span>
      <button className={btn} onClick={() => cycle(1)} title="Next (→)">
        <ChevronRight className="size-4" />
      </button>
      <span className="mx-1 h-4 w-px bg-white/30" />
      <button className={btn} onClick={() => feed.push()} title="Simulate a real-time arrival">
        + event
      </button>
      <button className={btn} onClick={() => feed.push(10)} title="Flood the feed with 10 arrivals">
        +10
      </button>
      <button className={btn} onClick={feed.empty}>
        empty
      </button>
      <button className={btn} onClick={feed.reset}>
        reset
      </button>
    </div>
  );
}
