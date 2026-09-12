# Calendar app

The calendar is split across two halves that talk over `postMessage`:

- **`assets/apps/calendar/`** (this directory) — the UI, served from
  `calendar.<host>` and embedded as a cross-origin iframe. It renders the
  grid, owns every dialog, and parses/serialises `.ics`. It has no
  filesystem access.
- **`src/views/Calendar.vue`** — the privileged host. It owns all Peergos
  access: reading and writing event files, calendar directories, sharing
  and secret links, plus the page spinner.

Events cross the boundary as whole `.ics` documents (one `VEVENT` each),
which is what the app already reads and writes anyway.

## Deploying a change

`ant ui` builds both halves into `server/webroot` — this directory is copied
across as it is, the host is bundled. A release (`ant dist`) additionally
pins every file the pages reference with an SRI hash, so a later `ant ui`
leaves those hashes describing files that have since changed and the browser
blocks them: run `ant ui` last, or `ant dist` again.

## Colours and chrome

A calendar's colour is chosen in the app's own picker - saturation and
brightness over a hue slider, with a hex field beside the preview. Not
`input[type=color]`: that hands the choice to the browser's colour dialog,
which in the Android WebView is eight fixed colours with the actual picker
behind a "Custom" link. A new calendar starts on a random colour - random
hue, with saturation and brightness held in a band that stays readable, and
a re-roll when the hue lands next to a calendar that already exists - and
that colour is where the picker opens.

Whatever colour a calendar ends up on is painted exactly, and the ink on top
is whichever of the two the colour reads better with, by contrast ratio: the
two cross at 0.179 relative luminance, so a mid colour takes the dark ink
even though it looks "dark" itself. Some colours cannot reach 4.5:1 with
either ink - #3788d8 tops out at 3.9 - and the calendar's own colour wins
over that, since it is the user's choice and the label is short.

The sidebar's two lists scroll independently - calendars capped at 40% of the
column, tasks taking the rest - so a long calendar list can't push the tasks
out of reach. A row's menu is moved to the body while it is open (and put
back on close): a menu drawn inside a scroll container is clipped by it.
Dialogs are centred in both axes and scroll their body when the window is
short. Every `:hover` rule sits behind `@media (hover: hover)` and a press
flashes through `:active` instead - touch has no pointer to leave, so an
unguarded hover stays lit until something else is tapped.

The rest of the chrome is opaque. Breezy's neutral surfaces are alpha
overlays (2-20% black or white) and its faint foreground a pale grey, which
read as washed out over this app's backgrounds; both are restated as solid
colours in `:root` and the dark block, composed over the background they sit
on. The vendored theme files stay untouched.

## Refreshing

Nothing announces a write made elsewhere - another device, a CalDAV client,
the phone's own calendar through the sync adapter - so **Refresh** in the
overflow menu asks the host to read the store again from scratch: calendar
list, the months around the one on screen, tasks, and a fresh sweep index.
It is the same path a fresh open takes, which is why it needs no separate
merge logic: the app resets and refills from what is actually stored. On a
touch screen, pulling the grid down from its top does the same; a pull counts
only when nothing under the finger was scrolled, so dragging a time grid down
to earlier hours stays a scroll.

## Reminders

One reminder per entry, held as minutes before the start (or before a task's
due date) and written to the file as a `VALARM` with a relative `TRIGGER`, so
anything else reading the calendar - Thunderbird, a phone's own calendar over
CalDAV - shows the same alert. A trigger this app has no shape for (absolute,
measured from the end, or an offset that is not one of the choices) is read
back and kept as it is rather than snapped to the nearest offered value.

Delivery is the platform's, and nothing about it leaves the device:

- **Android** already mirrors calendars into the system provider (the sync
  adapter under `peergos.android.calendar`), so a `VALARM` becomes a row in
  `CalendarContract.Reminders` and the phone's own calendar rings it - no
  alarm scheduling, nothing cached, nothing to re-arm after a reboot.
- **Desktop and browser** get a timer per reminder for as long as the page is
  open; the host raises them through the Notification API. The desktop app
  closes to the tray rather than exiting, so that covers most of a day, but a
  reminder due while it is shut does not fire - the mirrored copy on a phone,
  or any CalDAV client, is what covers that.

The app sends the whole upcoming list (`reminders`) whenever its entries
change rather than one message per edit, and the host replaces what it had:
a deleted or moved entry cannot leave an alarm behind. Only the next two
weeks are sent, capped, and rebuilt as the grid changes.

## Message protocol

Every message names itself in `type`; everything else in it is payload. The
host dispatches on that one field, so a message it does not know is ignored
rather than half-handled. Calendars are addressed by **name** on the wire —
the name doubles as the app's local calendar id, so there is no second
identifier to keep in sync.

App to host:

| Message | Meaning |
|---|---|
| `pong` | reply to `ping`; marks the frame ready |
| `removeSpinner` | first paint done |
| `save` | write `Id`'s `.ics` (`item`) into `calendarName`/`year`/`month`, or into the calendar's `tasks/` when `isTask` |
| `delete` | remove `Id`'s `.ics` from that same placement |
| `loadAdditional` | fetch a month scrolled into view |
| `reminders` | the upcoming reminder list, replacing whatever was scheduled |
| `refresh` | read the whole store again - another client may have written |
| `sweep` | walk every stored month of one calendar (`calendarName`) or all of them, for `reason` `search` or `export`; carries a `requestId` |
| `saveAll` | write every item of one import in a single batched upload, with a progress bar |
| `downloadIcs` | save `item` as `filename` — the host owns this because a blob: URL never reaches the Android app's download listener |
| `emailEvent` | open the stored `.ics` in the Peergos Email app as an attachment |
| `deleteCalendar` | delete a calendar directory - the host asks the user first, every time |
| `requestAddCalendar` / `requestRenameCalendar` / `requestCalendarColorChange` | calendar CRUD, host owns validation and uniqueness |
| `openShare` | ask the host to open its own share dialog for this calendar or event |

Each calendar in `load` carries `writable`. Ownership alone cannot answer it:
a calendar shared with us is writable only if the share said so, so the host
resolves the stored directory and asks the filesystem. Writes then go to the
*owner's* root — `App.writeInternal` takes a username but resolves every write
under the calling user regardless, so the host writes through `getOrMkdirs` +
`uploadOrReplaceFile` instead. A write grant covers the entries in a calendar,
never the calendar itself: renaming, recolouring and sharing stay with the
owner, and deleting one shared with us only drops it from our own list.

A load is a shell plus buckets, not one message. `load` carries only what
the first paint needs — identity, calendars, the month on screen — and says
how many buckets are still to come in `pendingBuckets`. The host then reads
the three months around the one on screen, the recurring folder and the
tasks folder at the same time and posts each as it lands: months and
recurring entries as `loadAdditional` (flagged `loadBucket`, so a month the
grid asked for on its own is not miscounted), tasks as `loadTasks`. The grid
is interactive from the shell and fills in behind a progress line; a bucket
read for a load the app has already replaced is dropped by the host, which
tracks the same generation counter the sweep does.

Every task is sent whatever its date, unlike events, because an open task
matters whichever month is on screen and an undated one has no month to be
found under. An `.ics` opened from the user's files rides along on the shell
but is imported only once every bucket has landed: importing into an empty
grid would take a second copy of every event the calendar already holds.

`ping` carries `hasEmail`. With the Peergos Email app an event is emailed as
a real `.ics` attachment. Without it mail can only carry text, so the app
asks what to send: the details as text, or a secret link the user then
creates in the host's share dialog. A link is read access that outlives the
message, so it is never minted behind a single click.

Host to app: `ping`, `setTheme`, `load`, `loadAdditional`, `loadTasks`, `sweepBatch`,
`sweepDone`, `importICSFile`, `respondAddCalendar`, `respondRenameCalendar`,
`respondCalendarColorChange`, `respondDeleteCalendar`.

Two things about this protocol are load-bearing:

- **Sharing never happens on the frame's word.** Granting access and minting
  links are privileged, so they belong to the half with the filesystem: the
  frame can send `openShare` and nothing else - no recipient, no access level,
  no link - and the host opens its own share dialog (`DriveShare.vue`, the same
  one the drive uses) over the frame. Every grant, link and revocation is
  chosen there, in Peergos' own UI, by the person looking at it. `e.source`
  proves which frame a message came from; it says nothing about whether the
  user asked for it. Deleting a calendar is asked the same way: the host runs
  its own confirm rather than trusting a flag from the frame.
- **A sweep answers exactly once.** The grid holds only the months it has
  fetched, so search and export ask the host to walk the rest of the store;
  it streams `sweepBatch` per month and ends with exactly one `sweepDone`
  for that `requestId` — including when the request is refused (`busy`, an
  unknown calendar) or cancelled by a `load`. The app keys both on the
  `requestId` it issued and drops anything else, so a walk left over from a
  previous frame cannot feed a page that has moved on. The one request with
  no reply is one that never left: before the host's first message there is
  no window to post to, so the app forgets it rather than waiting out the
  session for an answer nobody was asked for. Batches are sent even
  when a month is empty: that is how entries another device deleted leave
  the index, since each batch *replaces* its month rather than merging into
  it. Swept entries are held in memory only — never written to the device —
  and never enter the grid, so the store stays the single source of truth
  and a swept hit navigates to its month to be rendered the usual way. An
  export refuses to write anything if the walk was capped or any month
  failed, because a partial `.ics` is indistinguishable from a whole one.
- **`loadAdditional` replies must not clear the spinner.** The host raises
  none for a month fetch, and a year view issues twelve at once, so clearing
  there would lift a spinner some other operation raised. The initial `load`
  reply *must* clear it — the host raises that one before the iframe exists,
  and it clears on the shell rather than on the last bucket, because that is
  when the grid is up.

## Storage layout

Under the host's app data directory, per calendar directory:

```
<calendar-dir>/<year>/<month>/<event-id>.ics   # non-recurring, by start month (UTC)
<calendar-dir>/recurring/<event-id>.ics        # recurring series
<calendar-dir>/tasks/<task-id>.ics             # one VTODO each, dated or not
<calendar-dir>/calendar.inf                    # name + colour
App.config                                     # the calendar list
```

Tasks are `VTODO`, the iCalendar sibling of `VEVENT`, so one written here
opens in any other client that reads `.ics`. They get a directory of their
own because a task's date is optional: with no `DUE` there is no year/month
bucket to file it under. `DUE`, `STATUS`, `COMPLETED`, `PERCENT-COMPLETE`,
`PRIORITY` and `RRULE` round-trip; a foreign task counts as done if any of
the three completion properties says so, since clients disagree on which
they write. Priority has no control of its own: a new task is written at
the normal 5, and a value another client set is kept.

A task repeats through the same `RRULE` an event does, but its dialog offers
only how often and how far apart - the weekday picker, the nth-weekday mode and
the end conditions belong to a series laid out on a grid. Both the repeat and the reminder count
from the due date, so they appear with it in the dialog and an undated task
carries neither - a control that cannot apply is not shown greyed out with
nothing to say why. Completing a
repeating task moves it to its next occurrence and leaves it open, which is
what task apps do and what a client reading the same `VTODO` expects; a
series that has run out completes for good.

An import sends one `saveAll` rather than a `save` per item: a file with
hundreds of events would otherwise be hundreds of round trips, each its own
write. The host groups them by directory and uploads once, so tasks and
events from the same file ride together.

The app tracks where each event's file currently lives. Changing an event's
date, calendar, or recurring-ness *moves* its file, so the app sends the move
as two messages — a `delete` of the old placement, then a `save` of the new
one. The host has no move of its own: a `save` only ever writes where it is
addressed.

## Repeat rules

The form covers frequency, interval, the weekdays of a weekly rule, a monthly or
yearly rule on a chosen day of the month or a chosen weekday of it (`BYMONTHDAY`,
or an ordinal `BYDAY` such as `-1FR` or `3MO`), the month a yearly rule falls in
(`BYMONTH`), and an end of never / on a date / after N. Every shape the previous
calendar's own editor could build has a control here.

"Every weekday (Mon to Fri)" sits in the frequency list as a shortcut rather than
a frequency of its own: choosing it selects Weekly with those five days ticked,
where they can be seen and changed, and writes the ordinary
`FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR` the rest of the world reads.

Two rules keep what is written stable:

- A day or month that matches the start date's own is not written down, because
  a rule with no `BY` part of its own already repeats there. That leaves every
  rule this app has written unchanged. A yearly date writes both halves or
  neither, so it cannot drift with the start date.
- A file written elsewhere may still say more than the form can show - a week
  number, a day of the year, several days of the month or several months, a week
  start, `BYSETPOS`, or plain weekday codes on a frequency whose control cannot
  offer them, as in the `FREQ=DAILY;BYDAY=` spelling of "every weekday". Those
  parts reach the occurrence engine even though no control sets them, so such an
  entry is drawn on the days its own rule names rather than on its start date.
  They are kept apart from the fields the form round-trips, and the rule as the
  file wrote it is kept beside the parsed model (`recur.source`, with the fields
  it produced). Writing the entry back emits that text verbatim unless a control
  was actually changed - what the controls read back when the dialog filled
  itself in is the baseline that decides, since a rule the form cannot show
  whole does not come back out of them unaltered. So renaming such an event,
  moving it, or excluding one occurrence leaves its rule alone. An import says
  how many entries it could only show simplified.

Every date the app computes for itself - a reminder's occurrences, the boundary
of a "this and following" split, a repeating task's next due date - goes through
the same `rrule` set the grid renders from, so a rule only has to be understood
in one place.

## Dragging events

Events can be moved (and their edges resized) by mouse only: `editable` is turned on when
the device has a fine pointer that hovers (`(hover: hover) and (pointer: fine)`) and is not
a touch screen, so on Android and other touch devices dragging keeps scrolling the grid.
The rules are those of the previous calendar:

- a plain event moves freely; its file is rewritten and, when the day crosses a month
  boundary, moved to the new month's directory;
- an occurrence of a repeating event may change time but not day (`eventAllow` refuses a
  drop on another day and the event snaps back); a drop on the same day, or a resize, asks
  whether to change this occurrence (EXDATE on the master plus a standalone copy at the new
  time), this and following (the master is cut off with UNTIL and a new series starts at the
  new time) or all of them (the series' own start shifts by the same amount and every
  occurrence takes the new length). The exclusion and the cut-off are computed from the
  occurrence as it was (`info.oldEvent`), not from the dragged handle;
- tasks, read-only calendars and guest sessions cannot drag.

## Entries written elsewhere

An entry can carry more than this app models - attendees, an organiser, categories, X-
properties, alarms it cannot show - and a save that rebuilt the block from what the dialog
holds would drop all of it. So the lines an entry was read with are kept, and writing it
back replaces only the properties this app owns (`UID`, the dates, `SUMMARY`, `LOCATION`,
`DESCRIPTION`, `STATUS`, `RRULE`, `EXDATE`, the completion properties, `DTSTAMP` and
`LAST-MODIFIED`) plus its own alarm - the one shape it can show. Everything else stays
where it was, including a nested component's own properties. The Android mirror's writer
keeps the same contract from the other side.

A single-occurrence override the previous calendar wrote is the one thing deliberately
rewritten: it becomes an entry of its own, so it takes an id of its own and drops the
`RECURRENCE-ID` that pointed at a series it is no longer part of, while the series it came
from gains the matching `EXDATE`.

Two conventions exist so the previous app can still work on what this one writes, if a
user goes back to it:

- **An entry's `UID` is the name it is stored under**, with nothing appended. That is how
  the previous app and the Android mirror both find an entry again; a `UID` that did not
  match the filename would make an edit there write a second copy and a delete there miss.
- **`X-OWNER` names who created the entry.** The previous app treats an entry naming
  nobody as read-only. It is written only when the stored block has no owner of its own,
  so an entry made by someone else keeps theirs.

## Untrusted input

An imported `.ics` is fully untrusted, and two of its fields reach code that
treats them structurally:

- **`UID` becomes the event id, which becomes a filename** on the host and
  the path a secret link is minted for. `sanitizeEventId()` neutralises path
  separators and control characters; the host independently refuses to build
  a path from an unsafe id (`isSafeEventId`/`eventDirPath`). Ordinary foreign
  UIDs must keep mapping to the same id, or already-stored events reload as
  duplicates under a new name.
- **`TZID` becomes an object key.** Those lookups use `Object.create(null)`
  and `hasOwnProperty`, never a bare `{}` — a TZID of `__proto__` otherwise
  reads back `Object.prototype` instead of `undefined` and crashes the
  import. The `VTIMEZONE` fallback parser also only allows
  `YEARLY`/`MONTHLY`/`WEEKLY`/`DAILY`; an unbounded `FREQ=SECONDLY`
  observance froze a real browser tab.

Everything the frame names that becomes a path or a schedule is read as what
it claims to be before it is used: a month through `requestedMonth` (the same
1-9999 / 1-12 range `eventDirPath` enforces on the way in), a colour through
`isHexColor`, a reminder through `isValidReminder`. The frame is the app we
ship, but the host is the half with filesystem access, so it checks anyway.

`RECURRENCE-ID` handling exists for files written by the previous calendar,
which stored single-occurrence overrides as extra `VEVENT`s sharing the
series UID. Each becomes a standalone event plus an `EXDATE` on the series;
without it, legacy events render twice.

## Vendored dependencies

No build step — `vendor/<package>/` mirrors each package's own upstream
layout.

| Package | Version |
|---|---|
| FullCalendar (Standard bundle + all locales, `breezy` theme) | 7.0.2 |
| `@fullcalendar/rrule` | 7.0.2 |
| `rrule` | 2.8.1 |

`fonts/inter/` is not a package: it is a copy of two weights of web-ui's own
`assets/fonts/inter`, so the app's chrome renders in the same typeface as the
rest of Peergos. The app is served from its own origin, and a font fetched
cross-origin needs CORS headers the server does not send, so it cannot link
to the host UI's copy.

Gotchas in this version, each of which the code comments point back here for:

- Week numbers ignore `weekNumbersWithinDays` and get no `weekNumberDidMount`
  hook, so Month's are moved out of the last column with CSS instead: the row
  opens a gutter and the number, absolutely positioned with an inline offset
  recomputed per row, is pinned into it.

- A bare-number `duration` on a recurring event silently produces
  `end === start`. Use the object form (`{ milliseconds: n }`).
- v7 renamed documented options without an alias: `customButtons` →
  `buttons`, and `buttonText: { list: … }` → a flat `listText`. Don't trust
  option names from older docs.
- Clicking a custom `headerToolbar` button throws an uncaught internal
  `refineProps` error in the breezy theme, independent of this app's code.
  Use a plain button outside FullCalendar's own toolbar.
- Once you replace the children of `datesSet`'s title heading yourself,
  FullCalendar's vdom stops updating it. Read `arg.view.title`, never the
  heading's own `textContent`.

## Service worker

`sw.js` is **network-first for navigations** and revalidates the scripts and
stylesheets they pull. Cache-first served a previous build's `index.html`
alongside freshly fetched scripts, and one missing element takes the whole app
down; a fresh document with a previous build's `calendar.js` breaks the same
way, so neither is taken from a cache without asking the server first. The
cache remains the offline fallback.
