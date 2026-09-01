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

The app's files are served from `server/webroot`, the host's from the built
bundle:

```
cp assets/apps/calendar/<file> server/webroot/apps/calendar/   # app half
ant ui                                                        # host half
```

## Message protocol

Calendars are addressed by **name** on the wire — the name doubles as the
app's local calendar id, so there is no second identifier to keep in sync.

App to host:

| Message | Meaning |
|---|---|
| `pong` | reply to `ping`; marks the frame ready |
| `removeSpinner` | first paint done, or a share mutation rendered |
| `save` | write `Id`'s `.ics` (`item`) into `calendarName`/`year`/`month`, or into the calendar's `tasks/` when `isTask` |
| `delete` | remove `Id`'s `.ics` from that same placement |
| `loadAdditional` | fetch a month scrolled into view |
| `saveAll` | write every item of one import in a single batched upload, with a progress bar |
| `downloadIcs` | save `item` as `filename` — the host owns this because a blob: URL never reaches the Android app's download listener |
| `emailEvent` | open the stored `.ics` in the Peergos Email app as an attachment |
| `deleteCalendar` | delete a calendar directory (`confirmed: true`) |
| `requestAddCalendar` / `requestRenameCalendar` / `requestCalendarColorChange` | calendar CRUD, host owns validation and uniqueness |
| `shareStateRequest` / `shareAddUser` / `shareRemoveUser` / `shareCreateLink` / `shareRevokeLink` | sharing, each carrying a `requestId` |

`load` carries `tasks` alongside the month buckets: unlike events, every
task is sent on load regardless of date, because an open task matters
whichever month is on screen and an undated one has no month to be found
under.

`ping` carries `hasEmail`. With the Peergos Email app an event is emailed as
a real `.ics` attachment. Without it mail can only carry text, so the app
asks what to send: the details as text, or a secret link the user then
creates in the share dialog. A link is read access that outlives the
message, so it is never minted behind a single click.

Host to app: `ping`, `setTheme`, `load`, `loadAdditional`, `importICSFile`,
`respondAddCalendar`, `respondRenameCalendar`, `respondCalendarColorChange`,
`respondDeleteCalendar`, `respondShareState`.

Two things about this protocol are load-bearing:

- **Share replies are correlated by `requestId`.** The share modal requests
  state on open and after every mutation, so replies can be in flight
  together and can land out of order. Anything that is not the reply to the
  newest request is discarded, and only a *mutation's* reply lifts the host
  spinner. Counting replies is not sufficient.
- **`loadAdditional` replies must not clear the spinner.** The host raises
  none for a month fetch, and a year view issues twelve at once, so clearing
  there would lift a spinner some other operation raised. The initial `load`
  reply *must* clear it — the host raises that one before the iframe exists.

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
bucket to file it under. `DUE`, `STATUS`, `COMPLETED`, `PERCENT-COMPLETE`
and `PRIORITY` round-trip; a foreign task counts as done if any of the
three completion properties says so, since clients disagree on which they
write.

An import sends one `saveAll` rather than a `save` per item: a file with
hundreds of events would otherwise be hundreds of round trips, each its own
write. The host groups them by directory and uploads once, so tasks and
events from the same file ride together.

The app tracks where each event's file currently lives. Changing an event's
date, calendar, or recurring-ness *moves* its file, so the app deletes the
old path explicitly — the host's save path only ever writes the new one.

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

`sw.js` is **network-first for navigations**. Cache-first served a previous
build's `index.html` alongside freshly fetched scripts, and one missing
element takes the whole app down. The cache remains the offline fallback.
