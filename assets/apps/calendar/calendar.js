let pad = n => String(n).padStart(2, '0');

function toDateInputValue(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

function toTimeInputValue(date) {
    return pad(date.getHours()) + ':' + pad(date.getMinutes());
}

function addDays(date, n) {
    let d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

// The form shows the all-day end date inclusively; FullCalendar stores
// it exclusively.
function toFormEnd(end, allDay) {
    return allDay ? addDays(end, -1) : end;
}

function fromFormEnd(allDay) {
    if (!allDay) return new Date(endDateInput.value + 'T' + endTimeInput.value);
    return toDateInputValue(addDays(new Date(endDateInput.value + 'T00:00'), 1));
}

function computeDurationMs(start, end, allDay) {
    let startMs = allDay ? new Date(start + 'T00:00').getTime() : start.getTime();
    let endMs = allDay ? new Date(end + 'T00:00').getTime() : end.getTime();
    return endMs - startMs;
}

// rrule.js reads Date fields via UTC getters regardless of local
// timezone - build/read dates via UTC fields to work around it.
function toFakeUtc(localDate) {
    return new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), localDate.getHours(), localDate.getMinutes(), localDate.getSeconds()));
}

function fromFakeUtc(fakeUtcDate) {
    return new Date(fakeUtcDate.getUTCFullYear(), fakeUtcDate.getUTCMonth(), fakeUtcDate.getUTCDate(), fakeUtcDate.getUTCHours(), fakeUtcDate.getUTCMinutes(), fakeUtcDate.getUTCSeconds());
}

let WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function weekdayCodeOf(date) {
    return WEEKDAY_CODES[date.getDay()];
}

// 1-5 for "the nth <weekday> of this month", or -1 if this date is in
// the final 7 days of the month ("the last <weekday>").
function nthWeekdayOfMonth(date) {
    let day = date.getDate();
    let daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return (day + 7 > daysInMonth) ? -1 : Math.ceil(day / 7);
}

let ORDINAL_LABELS = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', '-1': 'last' };
let WEEKDAY_LABELS = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };

// recur.byday holds RRULE-text-style day codes - plain ('MO') or
// ordinal-prefixed ('2TU', '-1FR') for "nth weekday of the month".
function rruleByweekdayFromByday(byday) {
    return byday.map(function (code) {
        let m = code.match(/^(-?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/);
        if (!m) return null;
        let day = rrule.RRule[m[2]];
        return m[1] ? day.nth(parseInt(m[1], 10)) : day;
    }).filter(Boolean);
}

function rruleOptionsFor(recur, allDay) {
    let dtstart = allDay ? new Date(recur.dtstart + 'T00:00') : new Date(recur.dtstart);
    let options = { freq: rrule.RRule[recur.freq.toUpperCase()], interval: recur.interval, dtstart: toFakeUtc(dtstart) };
    if (recur.byday && recur.byday.length) options.byweekday = rruleByweekdayFromByday(recur.byday);
    return options;
}

// Occurrence immediately before `date`, ignoring count/until/exdates -
// the truncation boundary for "this and following" splits. Null if
// `date` is the series' first occurrence.
function previousOccurrenceBoundary(recur, allDay, date) {
    let rr = new rrule.RRule(rruleOptionsFor(recur, allDay));
    let result = rr.before(toFakeUtc(date), false);
    return result ? fromFakeUtc(result) : null;
}

// How many occurrences fall before targetDate - used to shrink a
// remaining COUNT when splitting a series.
function countOccurrencesBefore(recur, allDay, targetDate) {
    let rr = new rrule.RRule(rruleOptionsFor(recur, allDay));
    let fakeTarget = toFakeUtc(targetDate).getTime();
    return rr.all(function (dt) { return dt.getTime() < fakeTarget; }).length;
}

function buildRRuleSet(recur, allDay) {
    let options = rruleOptionsFor(recur, allDay);
    if (recur.end === 'until' && recur.until) {
        // 'T00:00' on the date-only form: new Date('2026-01-05') parses as
        // UTC midnight, which in a negative-offset zone reads back as the
        // 4th and drops the until day's own occurrence. Every other
        // date-only parse in this file appends the same suffix.
        let untilStr = formatUntil(recur.until, recur.dtstart, allDay);
        options.until = toFakeUtc(new Date(allDay ? untilStr + 'T00:00' : untilStr));
    }
    if (recur.end === 'count' && recur.count) options.count = recur.count;
    let set = new rrule.RRuleSet();
    set.rrule(new rrule.RRule(options));
    (recur.exdates || []).forEach(function (exStr) {
        set.exdate(toFakeUtc(allDay ? new Date(exStr + 'T00:00') : new Date(exStr)));
    });
    return set;
}

// Nearest occurrence to referenceDate, clamped to count/until/exdates.
// Compares against the start of referenceDate's day, not its exact time,
// so today's occurrence doesn't look "already past" once its time has
// elapsed.
function nearestRecurOccurrenceDate(recur, allDay, referenceDate) {
    let dayStart = toFakeUtc(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()));
    let set = buildRRuleSet(recur, allDay);
    let result = set.after(dayStart, true) || set.before(dayStart, true);
    return result ? fromFakeUtc(result) : (allDay ? new Date(recur.dtstart + 'T00:00') : new Date(recur.dtstart));
}

// RFC5545 requires UNTIL's precision to match DTSTART's - a date-only
// UNTIL on a timed series would exclude that day's own occurrence.
function formatUntil(dateOnlyStr, dtstartStr, allDay) {
    if (allDay || !dateOnlyStr) return dateOnlyStr;
    let time = dtstartStr.includes('T') ? dtstartStr.split('T')[1] : '23:59';
    return dateOnlyStr + 'T' + time;
}

let isDarkMode = new URL(window.location.href).searchParams.get('theme') === 'dark-mode';
if (isDarkMode) document.documentElement.setAttribute('data-color-scheme', 'dark');

// Same signal as the .calendar-menu-button fix in calendar.css - turns
// off the double-click-to-edit shortcut on touch devices.
let isTouchDevice = window.matchMedia('(hover: none)').matches;

// Fixed palette, not free-form color picking.
let CALENDAR_COLORS = ['#3788d8', '#8e24aa', '#0b8043', '#e67c73', '#f4511e', '#e53935'];

// Index-matched to CALENDAR_COLORS, for legibility on a dark background -
// display only, `cal.color` itself always stays the light-mode value.
let CALENDAR_COLORS_DARK = ['#60a5fa', '#c084fc', '#4ade80', '#fca5a5', '#fb923c', '#f87171'];

function displayColor(hex) {
    if (!isDarkMode) return hex;
    let idx = CALENDAR_COLORS.indexOf(hex);
    return idx >= 0 ? CALENDAR_COLORS_DARK[idx] : hex;
}

// Calendars and events both come from the Peergos host (Calendar.vue)
// over postMessage - see "Peergos host bridge" near the end of this file.
// `primary: true` can't be deleted (it's the account's own first
// calendar). `readOnly: true` marks one shared *with* you, or the whole
// app opened as a guest - see isCalendarWritable().
let calendars = [];

// Host bridge state. Declared here rather than beside the bridge functions
// at the end of the file: calendar.render() fires datesSet, which reaches
// requestMonthIfMissing before a `let` further down would be initialised.
let hostWindow = null;
let hostOrigin = null;
let hostUsername = null;
let isGuestSession = false;

// Whether the account has the Peergos Email app, told to us in `ping`. With
// it, emailing an event attaches the real .ics; without it the best we can
// do is a mailto: carrying a plain-text summary.
let hostHasEmailApp = false;

// Where each event's file currently lives, keyed by event id. An edit that
// changes the date, the calendar, or recurring-ness moves the file, and the
// old path has to be deleted explicitly - the host's own save path only
// ever writes the new one.
let eventPlacements = Object.create(null);

// year*12+(month-1) values already loaded, so scrolling back to a month
// and forward again doesn't add every event in it a second time.
let loadedYearMonths = Object.create(null);

// Overrides read out of a series' own file (the previous calendar's
// layout), keyed by series id. Saving the series rewrites that file with
// only the series in it, so they have to be given files of their own at
// the same moment or they would be dropped.
let unmigratedOverrides = Object.create(null);

// Every task, dated or not, lives here - this array is the source of truth.
// Dated ones are mirrored onto the grid as all-day items (syncTaskEvent) so
// they sit beside the events competing for that day; an undated one has no
// place on a grid and exists only in the panel.
let tasks = [];
let showCompletedTasks = false;
let editingTaskId = null;

// Which calendar each task's file is currently stored under. Moving a task
// to another calendar moves its file, so the old one has to be deleted -
// the same rule events follow with eventPlacements.
let taskCalendars = Object.create(null);

let emailChoiceBackdrop = document.getElementById('email-choice-modal-backdrop');
let emailChoiceConfirmButton = document.getElementById('email-choice-confirm');
let emailChoiceCancelButton = document.getElementById('email-choice-cancel');

let taskModalBackdrop = document.getElementById('task-modal-backdrop');
let taskForm = document.getElementById('task-form');
let taskModalHeading = document.getElementById('task-modal-heading');
let taskTitleInput = document.getElementById('task-title');
let taskCalendarSelect = document.getElementById('task-calendar');
let taskHasDueInput = document.getElementById('task-has-due');
let taskDueFields = document.getElementById('task-due-fields');
let taskDueDateInput = document.getElementById('task-due-date');
let taskDueTimeInput = document.getElementById('task-due-time');
let taskDueAllDayInput = document.getElementById('task-due-all-day');
let taskPrioritySelect = document.getElementById('task-priority');
let taskDescriptionInput = document.getElementById('task-description');
let taskDeleteButton = document.getElementById('task-delete');
let taskCancelButton = document.getElementById('task-cancel');
let taskSaveButton = document.getElementById('task-save');
let taskList = document.getElementById('task-list');
let taskCountBadge = document.getElementById('task-count');
let showCompletedButton = document.getElementById('show-completed-tasks');

let modalBackdrop = document.getElementById('event-modal-backdrop');
let form = document.getElementById('event-form');
let titleInput = document.getElementById('event-title');
let calendarSelectInput = document.getElementById('event-calendar');
let allDayInput = document.getElementById('event-all-day');
let startDateInput = document.getElementById('event-start-date');
let startTimeInput = document.getElementById('event-start-time');
let endDateInput = document.getElementById('event-end-date');
let endTimeInput = document.getElementById('event-end-time');
let locationInput = document.getElementById('event-location');
let repeatSection = document.getElementById('event-repeat-section');
let repeatFreqInput = document.getElementById('event-repeat-freq');
let repeatDetails = document.getElementById('event-repeat-details');
let repeatIntervalInput = document.getElementById('event-repeat-interval');
let repeatIntervalUnit = document.getElementById('event-repeat-interval-unit');
let repeatEndInput = document.getElementById('event-repeat-end');
let repeatUntilInput = document.getElementById('event-repeat-until');
let repeatCountRow = document.getElementById('event-repeat-count-row');
let repeatCountInput = document.getElementById('event-repeat-count');
let repeatWeekdayRow = document.getElementById('event-repeat-weekday-row');
let weekdayToggleButtons = Array.prototype.slice.call(document.querySelectorAll('.weekday-toggle'));
let repeatMonthlyModeInput = document.getElementById('event-repeat-monthly-mode');
let statusInput = document.getElementById('event-status');
let descriptionInput = document.getElementById('event-description');
let deleteButton = document.getElementById('event-delete');
let saveButton = document.getElementById('event-save');
let cancelButton = document.getElementById('event-cancel');
let modalHeading = document.getElementById('event-modal-heading');
let editableFields = [
    titleInput, calendarSelectInput, allDayInput, startDateInput, startTimeInput, endDateInput, endTimeInput,
    locationInput, repeatFreqInput, repeatIntervalInput, repeatEndInput, repeatUntilInput,
    repeatCountInput, statusInput, descriptionInput, repeatMonthlyModeInput
].concat(weekdayToggleButtons);

let scopeModalBackdrop = document.getElementById('scope-modal-backdrop');
let scopeSubtitle = document.getElementById('scope-subtitle');
let scopeConfirmButton = document.getElementById('scope-confirm');
let scopeCancelButton = document.getElementById('scope-cancel');


let popover = document.getElementById('event-popover');
let popoverTitle = document.getElementById('popover-title');
let popoverTime = document.getElementById('popover-time');
let popoverRepeatRow = document.getElementById('popover-repeat-row');
let popoverRepeat = document.getElementById('popover-repeat');
let popoverLocationRow = document.getElementById('popover-location-row');
let popoverLocation = document.getElementById('popover-location');
let popoverDescriptionRow = document.getElementById('popover-description-row');
let popoverDescription = document.getElementById('popover-description');
let popoverActions = document.getElementById('popover-actions');
let popoverCloseButton = document.getElementById('popover-close');
let popoverEditButton = document.getElementById('popover-edit');
let popoverDuplicateButton = document.getElementById('popover-duplicate');
let popoverExportButton = document.getElementById('popover-export');
let popoverEmailButton = document.getElementById('popover-email');
let popoverShareButton = document.getElementById('popover-share');
let popoverDeleteButton = document.getElementById('popover-delete');
let icsFileInput = document.getElementById('ics-file-input');
let toolbarAddButton = document.getElementById('toolbar-add-button');
let addMenu = document.getElementById('add-menu');
let addMenuEventButton = document.getElementById('add-menu-event');
let addMenuTaskButton = document.getElementById('add-menu-task');
let gotoDateMenu = document.getElementById('goto-date-menu');
let gotoDateMonthInput = document.getElementById('goto-date-month');
let gotoDateYearInput = document.getElementById('goto-date-year');
let gotoDateYearDownButton = document.getElementById('goto-date-year-down');
let gotoDateYearUpButton = document.getElementById('goto-date-year-up');
let overflowMenuButton = document.getElementById('overflow-menu-button');
let overflowMenu = document.getElementById('overflow-menu');
let overflowImportButton = document.getElementById('overflow-import-button');
let overflowMenuVersion = document.getElementById('overflow-menu-version');
let searchBar = document.getElementById('search-bar');
let searchButton = document.getElementById('search-button');
let searchClearButton = document.getElementById('search-clear-button');
let searchInput = document.getElementById('search-input');
let searchResults = document.getElementById('search-results');

let sidebar = document.getElementById('sidebar');
let sidebarBackdrop = document.getElementById('sidebar-backdrop');
let sidebarToggleButton = document.getElementById('sidebar-toggle-button');
let calendarListEl = document.getElementById('calendar-list');
let addCalendarButton = document.getElementById('add-calendar-button');
let shareModalBackdrop = document.getElementById('share-modal-backdrop');
let shareModalHeading = document.getElementById('share-modal-heading');
let shareUserList = document.getElementById('share-user-list');
let shareUsernameInput = document.getElementById('share-username-input');
let shareAccessSelect = document.getElementById('share-access-select');
let shareLinkAccessSelect = document.getElementById('share-link-access-select');
let shareAddButton = document.getElementById('share-add-button');
let shareCreateLinkButton = document.getElementById('share-create-link-button');
let shareLinkRow = document.getElementById('share-link-row');
let shareLinkInput = document.getElementById('share-link-input');
let shareLinkCopyButton = document.getElementById('share-link-copy-button');
let shareLinkRevokeButton = document.getElementById('share-link-revoke-button');
let shareCloseButton = document.getElementById('share-close-button');
let calendarModalBackdrop = document.getElementById('calendar-modal-backdrop');
let calendarForm = document.getElementById('calendar-form');
let calendarModalHeading = document.getElementById('calendar-modal-heading');
let calendarNameInput = document.getElementById('calendar-name-input');
let calendarDeleteButton = document.getElementById('calendar-delete');
let calendarColorSwatches = document.getElementById('calendar-color-swatches');
let calendarCancelButton = document.getElementById('calendar-cancel');
let confirmModalBackdrop = document.getElementById('confirm-modal-backdrop');
let confirmModalMessage = document.getElementById('confirm-modal-message');
let confirmCancelButton = document.getElementById('confirm-cancel');
let confirmOkButton = document.getElementById('confirm-ok');
let importSummaryModalBackdrop = document.getElementById('import-summary-modal-backdrop');
let importSummaryMessage = document.getElementById('import-summary-message');
let importSummaryOkButton = document.getElementById('import-summary-ok');

let editingEvent = null;
let editScope = 'all';
let pendingScopeEvent = null;
let pendingScopeAction = 'edit';
let popoverEvent = null;

function setInputMode(allDay) {
    startTimeInput.style.display = allDay ? 'none' : '';
    endTimeInput.style.display = allDay ? 'none' : '';
    startTimeInput.required = !allDay;
    endTimeInput.required = !allDay;
}

let intervalUnitLabels = { daily: 'day(s)', weekly: 'week(s)', monthly: 'month(s)', yearly: 'year(s)' };

function selectedWeekdays() {
    return weekdayToggleButtons.filter(function (b) { return b.classList.contains('selected'); }).map(function (b) { return b.dataset.day; });
}

function setSelectedWeekdays(codes) {
    weekdayToggleButtons.forEach(function (b) { b.classList.toggle('selected', codes.indexOf(b.dataset.day) !== -1); });
}

function formStartDate() {
    return new Date(startDateInput.value + 'T00:00');
}

// "Monthly on day 15" / "Monthly on the 3rd Tuesday" - option text is
// computed from the form's own start date, not fixed strings.
function updateMonthlyModeLabels() {
    let start = formStartDate();
    let dayOfMonthOpt = repeatMonthlyModeInput.querySelector('option[value="dayOfMonth"]');
    let nthWeekdayOpt = repeatMonthlyModeInput.querySelector('option[value="nthWeekday"]');
    dayOfMonthOpt.textContent = 'Monthly on day ' + start.getDate();
    let n = nthWeekdayOfMonth(start);
    nthWeekdayOpt.textContent = 'Monthly on the ' + ORDINAL_LABELS[n] + ' ' + WEEKDAY_LABELS[weekdayCodeOf(start)];
}

function updateRepeatVisibility() {
    let freq = repeatFreqInput.value;
    let repeating = !!freq;
    repeatDetails.style.display = repeating ? '' : 'none';
    repeatIntervalUnit.textContent = intervalUnitLabels[freq] || 'day(s)';
    let endMode = repeatEndInput.value;
    repeatUntilInput.style.display = (repeating && endMode === 'until') ? '' : 'none';
    repeatCountRow.style.display = (repeating && endMode === 'count') ? '' : 'none';
    repeatWeekdayRow.style.display = (freq === 'weekly') ? '' : 'none';
    repeatMonthlyModeInput.style.display = (freq === 'monthly') ? '' : 'none';
    if (freq === 'weekly' && !selectedWeekdays().length) setSelectedWeekdays([weekdayCodeOf(formStartDate())]);
    if (freq === 'monthly') updateMonthlyModeLabels();
}

function populateRecurForm(recur) {
    repeatFreqInput.value = recur ? recur.freq : '';
    repeatIntervalInput.value = recur ? recur.interval : 1;
    repeatEndInput.value = recur ? recur.end : 'never';
    repeatUntilInput.value = (recur && recur.until) ? recur.until : '';
    repeatCountInput.value = (recur && recur.count) ? recur.count : 10;
    let byday = (recur && recur.byday) || [];
    setSelectedWeekdays(recur && recur.freq === 'weekly' ? byday : []);
    repeatMonthlyModeInput.value = (recur && recur.freq === 'monthly' && byday.length) ? 'nthWeekday' : 'dayOfMonth';
    updateRepeatVisibility();
}

function readRecurFromForm() {
    let freq = repeatFreqInput.value;
    if (!freq) return null;
    let end = repeatEndInput.value;
    let recur = {
        freq: freq,
        interval: parseInt(repeatIntervalInput.value, 10) || 1,
        end: end,
        until: end === 'until' ? repeatUntilInput.value : null,
        count: end === 'count' ? (parseInt(repeatCountInput.value, 10) || 1) : null,
        exdates: []
    };
    if (freq === 'weekly') {
        let days = selectedWeekdays();
        recur.byday = days.length ? days : [weekdayCodeOf(formStartDate())];
    } else if (freq === 'monthly' && repeatMonthlyModeInput.value === 'nthWeekday') {
        let start = formStartDate();
        recur.byday = [nthWeekdayOfMonth(start) + weekdayCodeOf(start)];
    }
    return recur;
}

function nextEventId() {
    return 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// Distinct prefix from an event's, so isNativeEventId() keeps telling the
// two apart and a task can never collide with an event of the same name.
function nextTaskId() {
    return 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// Whole-series editing shows the SERIES' true original start/end, not
// whichever occurrence was clicked - otherwise saving would shift the
// whole series. Real dtstart lives in extendedProps.recur.dtstart.
function seriesFormRange(ev, recur, allDay) {
    let occurrenceDurationMs = (ev.end || ev.start).getTime() - ev.start.getTime();
    let seriesStart = allDay ? new Date(recur.dtstart + 'T00:00') : new Date(recur.dtstart);
    let seriesEndExclusive = new Date(seriesStart.getTime() + occurrenceDurationMs);
    return { start: seriesStart, end: toFormEnd(seriesEndExclusive, allDay) };
}

// "This and following": remaining count reduced by occurrences already
// past, so the form doesn't show the original total.
function adjustRecurForFollowing(ev, masterRecur, allDay) {
    let recur = Object.assign({}, masterRecur);
    if (recur.end === 'count' && recur.count) {
        let consumed = countOccurrencesBefore(masterRecur, allDay, ev.start);
        recur.count = Math.max(1, masterRecur.count - consumed);
    }
    recur.exdates = [];
    return recur;
}

function extraPropsOf(ev) {
    return { location: ev.extendedProps.location, status: ev.extendedProps.status, description: ev.extendedProps.description, calendarId: ev.extendedProps.calendarId };
}

function colorForCalendarId(calendarId) {
    let cal = getCalendarById(calendarId);
    return displayColor(cal ? cal.color : CALENDAR_COLORS[0]);
}

function buildRecurringEventPayload(id, title, allDay, extra, recur, durationMs) {
    // Not named `rrule`: that would shadow the rrule.js global this file
    // uses everywhere else.
    let rruleSpec = { freq: recur.freq, interval: recur.interval, dtstart: recur.dtstart };
    if (recur.end === 'until' && recur.until) rruleSpec.until = formatUntil(recur.until, recur.dtstart, allDay);
    if (recur.end === 'count' && recur.count) rruleSpec.count = recur.count;
    if (recur.byday && recur.byday.length) rruleSpec.byweekday = rruleByweekdayFromByday(recur.byday);
    let color = colorForCalendarId(extra.calendarId);
    let data = {
        id: id,
        title: title,
        allDay: allDay,
        rrule: rruleSpec,
        // bare-number duration silently produces end == start on a
        // recurring event - object form works correctly (see README)
        duration: { milliseconds: durationMs },
        color: color,
        extendedProps: Object.assign({ recur: recur }, extra)
    };
    if (recur.exdates && recur.exdates.length) data.exdate = recur.exdates.slice();
    return data;
}

function buildPlainEventPayload(id, title, allDay, start, end, extra) {
    let color = colorForCalendarId(extra.calendarId);
    return {
        id: id,
        title: title,
        allDay: allDay,
        start: start,
        end: end,
        color: color,
        extendedProps: Object.assign({ recur: null }, extra)
    };
}

// --- Timezone conversion (IANA, via the browser's own Intl tz database -
// no hand-maintained offset/DST rule table) ---

let LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Object.create(null), not {} - `zone` is attacker-controlled (an
// imported TZID), and `in` walks the whole prototype chain: "__proto__"
// in {} is true (it's an Object.prototype accessor), so that zone name
// would read back the inherited prototype object instead of a real
// true/false. Confirmed: this made resolveTzidToIanaZone("__proto__")
// return "__proto__" as a "valid" zone, which then crashed downstream.
let ianaZoneValidityCache = Object.create(null);
function isRecognizedIanaZone(zone) {
    if (zone in ianaZoneValidityCache) return ianaZoneValidityCache[zone];
    let valid;
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: zone });
        valid = true;
    } catch (e) {
        valid = false;
    }
    ianaZoneValidityCache[zone] = valid;
    return valid;
}

// UTC offset (minutes, east-positive) a zone observes at a given instant -
// read off Intl's "GMT±HH:MM" longOffset format, so DST and half-hour
// offsets (India, Nepal, ...) are handled without listing them by hand.
function tzOffsetMinutesAt(zone, utcMs) {
    let parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset', hour: '2-digit' }).formatToParts(new Date(utcMs));
    let raw = parts.find(function (p) { return p.type === 'timeZoneName'; }).value;
    let m = raw.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!m) return 0;
    let sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

// Converts a local wall-clock time in `zone` to the UTC instant it
// represents - one correction pass after an initial UTC-literal guess.
// An ambiguous local time (fall-back's repeated hour, spring-forward's
// skipped one) resolves to one side rather than erroring, same as most
// timezone libraries.
function localWallClockToUtcMs(zone, y, mo, d, hh, mi, ss) {
    let guessMs = Date.UTC(y, mo, d, hh, mi, ss || 0);
    let offset = tzOffsetMinutesAt(zone, guessMs);
    let utcMs = guessMs - offset * 60000;
    offset = tzOffsetMinutesAt(zone, utcMs);
    return guessMs - offset * 60000;
}

// Some desktop calendar clients export TZID using a non-IANA name
// ("Eastern Standard Time" instead of "America/New_York") - Intl doesn't
// recognize those directly. Maps the common ones to their IANA
// equivalent (default zone per CLDR territory "001").
let LEGACY_TZID_TO_IANA = {
    'Dateline Standard Time': 'Etc/GMT+12', 'UTC-11': 'Etc/GMT+11',
    'Aleutian Standard Time': 'America/Adak', 'Hawaiian Standard Time': 'Pacific/Honolulu',
    'Marquesas Standard Time': 'Pacific/Marquesas', 'Alaskan Standard Time': 'America/Anchorage',
    'UTC-09': 'Etc/GMT+9', 'Pacific Standard Time (Mexico)': 'America/Tijuana',
    'UTC-08': 'Etc/GMT+8', 'Pacific Standard Time': 'America/Los_Angeles',
    'US Mountain Standard Time': 'America/Phoenix', 'Mountain Standard Time (Mexico)': 'America/Chihuahua',
    'Mountain Standard Time': 'America/Denver', 'Central America Standard Time': 'America/Guatemala',
    'Central Standard Time': 'America/Chicago', 'Easter Island Standard Time': 'Pacific/Easter',
    'Central Standard Time (Mexico)': 'America/Mexico_City', 'Canada Central Standard Time': 'America/Regina',
    'SA Pacific Standard Time': 'America/Bogota', 'Eastern Standard Time (Mexico)': 'America/Cancun',
    'Eastern Standard Time': 'America/New_York', 'Haiti Standard Time': 'America/Port-au-Prince',
    'Cuba Standard Time': 'America/Havana', 'US Eastern Standard Time': 'America/Indianapolis',
    'Turks And Caicos Standard Time': 'America/Grand_Turk', 'Paraguay Standard Time': 'America/Asuncion',
    'Atlantic Standard Time': 'America/Halifax', 'Venezuela Standard Time': 'America/Caracas',
    'Central Brazilian Standard Time': 'America/Cuiaba', 'SA Western Standard Time': 'America/La_Paz',
    'Pacific SA Standard Time': 'America/Santiago', 'Newfoundland Standard Time': 'America/St_Johns',
    'Tocantins Standard Time': 'America/Araguaina', 'E. South America Standard Time': 'America/Sao_Paulo',
    'SA Eastern Standard Time': 'America/Cayenne', 'Argentina Standard Time': 'America/Buenos_Aires',
    'Greenland Standard Time': 'America/Godthab', 'Montevideo Standard Time': 'America/Montevideo',
    'Magallanes Standard Time': 'America/Punta_Arenas', 'Saint Pierre Standard Time': 'America/Miquelon',
    'Bahia Standard Time': 'America/Bahia', 'UTC-02': 'Etc/GMT+2', 'Mid-Atlantic Standard Time': 'Etc/GMT+2',
    'Azores Standard Time': 'Atlantic/Azores', 'Cape Verde Standard Time': 'Atlantic/Cape_Verde',
    'UTC': 'Etc/UTC', 'GMT Standard Time': 'Europe/London', 'Greenwich Standard Time': 'Atlantic/Reykjavik',
    'Sao Tome Standard Time': 'Africa/Sao_Tome', 'Morocco Standard Time': 'Africa/Casablanca',
    'W. Europe Standard Time': 'Europe/Berlin', 'Central Europe Standard Time': 'Europe/Budapest',
    'Romance Standard Time': 'Europe/Paris', 'Central European Standard Time': 'Europe/Warsaw',
    'W. Central Africa Standard Time': 'Africa/Lagos', 'Jordan Standard Time': 'Asia/Amman',
    'GTB Standard Time': 'Europe/Bucharest', 'Middle East Standard Time': 'Asia/Beirut',
    'Egypt Standard Time': 'Africa/Cairo', 'E. Europe Standard Time': 'Europe/Chisinau',
    'Syria Standard Time': 'Asia/Damascus', 'West Bank Standard Time': 'Asia/Hebron',
    'South Africa Standard Time': 'Africa/Johannesburg', 'FLE Standard Time': 'Europe/Kiev',
    'Israel Standard Time': 'Asia/Jerusalem', 'Kaliningrad Standard Time': 'Europe/Kaliningrad',
    'Sudan Standard Time': 'Africa/Khartoum', 'Libya Standard Time': 'Africa/Tripoli',
    'Namibia Standard Time': 'Africa/Windhoek', 'Arabic Standard Time': 'Asia/Baghdad',
    'Turkey Standard Time': 'Europe/Istanbul', 'Arab Standard Time': 'Asia/Riyadh',
    'Belarus Standard Time': 'Europe/Minsk', 'Russian Standard Time': 'Europe/Moscow',
    'E. Africa Standard Time': 'Africa/Nairobi', 'Iran Standard Time': 'Asia/Tehran',
    'Arabian Standard Time': 'Asia/Dubai', 'Astrakhan Standard Time': 'Europe/Astrakhan',
    'Azerbaijan Standard Time': 'Asia/Baku', 'Russia Time Zone 3': 'Europe/Samara',
    'Mauritius Standard Time': 'Indian/Mauritius', 'Saratov Standard Time': 'Europe/Saratov',
    'Georgian Standard Time': 'Asia/Tbilisi', 'Volgograd Standard Time': 'Europe/Volgograd',
    'Caucasus Standard Time': 'Asia/Yerevan', 'Afghanistan Standard Time': 'Asia/Kabul',
    'West Asia Standard Time': 'Asia/Tashkent', 'Ekaterinburg Standard Time': 'Asia/Yekaterinburg',
    'Pakistan Standard Time': 'Asia/Karachi', 'Qyzylorda Standard Time': 'Asia/Qyzylorda',
    'India Standard Time': 'Asia/Calcutta', 'Sri Lanka Standard Time': 'Asia/Colombo',
    'Nepal Standard Time': 'Asia/Katmandu', 'Central Asia Standard Time': 'Asia/Almaty',
    'Bangladesh Standard Time': 'Asia/Dhaka', 'Omsk Standard Time': 'Asia/Omsk',
    'Myanmar Standard Time': 'Asia/Rangoon', 'SE Asia Standard Time': 'Asia/Bangkok',
    'Altai Standard Time': 'Asia/Barnaul', 'W. Mongolia Standard Time': 'Asia/Hovd',
    'Novosibirsk Standard Time': 'Asia/Novosibirsk', 'Tomsk Standard Time': 'Asia/Tomsk',
    'China Standard Time': 'Asia/Shanghai', 'North Asia Standard Time': 'Asia/Krasnoyarsk',
    'Singapore Standard Time': 'Asia/Singapore', 'W. Australia Standard Time': 'Australia/Perth',
    'Taipei Standard Time': 'Asia/Taipei', 'Ulaanbaatar Standard Time': 'Asia/Ulaanbaatar',
    'Aus Central W. Standard Time': 'Australia/Eucla', 'Transbaikal Standard Time': 'Asia/Chita',
    'Tokyo Standard Time': 'Asia/Tokyo', 'North Korea Standard Time': 'Asia/Pyongyang',
    'Korea Standard Time': 'Asia/Seoul', 'Yakutsk Standard Time': 'Asia/Yakutsk',
    'Cen. Australia Standard Time': 'Australia/Adelaide', 'AUS Central Standard Time': 'Australia/Darwin',
    'E. Australia Standard Time': 'Australia/Brisbane', 'AUS Eastern Standard Time': 'Australia/Sydney',
    'West Pacific Standard Time': 'Pacific/Port_Moresby', 'Tasmania Standard Time': 'Australia/Hobart',
    'Vladivostok Standard Time': 'Asia/Vladivostok', 'Lord Howe Standard Time': 'Australia/Lord_Howe',
    'Bougainville Standard Time': 'Pacific/Bougainville', 'Russia Time Zone 10': 'Asia/Srednekolymsk',
    'Magadan Standard Time': 'Asia/Magadan', 'Norfolk Standard Time': 'Pacific/Norfolk',
    'Sakhalin Standard Time': 'Asia/Sakhalin', 'Central Pacific Standard Time': 'Pacific/Guadalcanal',
    'Russia Time Zone 11': 'Asia/Kamchatka', 'New Zealand Standard Time': 'Pacific/Auckland',
    'UTC+12': 'Etc/GMT-12', 'Fiji Standard Time': 'Pacific/Fiji', 'Kamchatka Standard Time': 'Asia/Kamchatka',
    'Chatham Islands Standard Time': 'Pacific/Chatham', 'UTC+13': 'Etc/GMT-13',
    'Tonga Standard Time': 'Pacific/Tongatapu', 'Samoa Standard Time': 'Pacific/Apia',
    'Line Islands Standard Time': 'Pacific/Kiritimati'
};

// IANA name straight through if Intl already recognizes it, else the
// legacy-name mapping above, else null - let the caller fall back to
// this file's own embedded VTIMEZONE block (if any), and ultimately to
// floating-local as a last resort. hasOwnProperty, not a bare [tzid]
// lookup - a TZID of "__proto__"/"constructor"/etc. would otherwise
// resolve to that inherited value instead of undefined (confirmed:
// crashed Intl.DateTimeFormat downstream, aborting the whole import).
function resolveTzidToIanaZone(tzid) {
    if (isRecognizedIanaZone(tzid)) return tzid;
    if (Object.prototype.hasOwnProperty.call(LEGACY_TZID_TO_IANA, tzid)) return LEGACY_TZID_TO_IANA[tzid];
    return null;
}

// --- .ics (RFC 5545) export/import ---

function escapeIcsText(str) {
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\n/g, '\\n');
}

function unescapeIcsText(str) {
    return str.replace(/\\(\\|;|,|[nN])/g, function (m, c) {
        return (c === 'n' || c === 'N') ? '\n' : c;
    });
}

function foldIcsLine(line) {
    if (line.length <= 75) return line;
    let out = line.slice(0, 75);
    let rest = line.slice(75);
    while (rest.length > 0) {
        out += '\r\n ' + rest.slice(0, 74);
        rest = rest.slice(74);
    }
    return out;
}

function icsDateStamp(date) {
    return toDateInputValue(date).replace(/-/g, '');
}

// Local wall-clock stamp (no Z, no offset) - used for TZID-qualified
// values, where the offset lives in the TZID param instead.
function icsDateTimeStamp(date) {
    return icsDateStamp(date) + 'T' + toTimeInputValue(date).replace(':', '') + '00';
}

function icsUtcStamp(date) {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

// RFC 5545 UTC-OFFSET ("-0500", "+0530"), not Intl's "GMT-05:00" form.
function formatIcsUtcOffset(minutes) {
    let sign = minutes < 0 ? '-' : '+';
    let abs = Math.abs(minutes);
    return sign + pad(Math.floor(abs / 60)) + pad(abs % 60);
}

function parseIcsUtcOffset(value) {
    let m = String(value).match(/^([+-])(\d{2})(\d{2})(\d{2})?$/);
    if (!m) return null;
    let sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

// No tzid: a fixed UTC instant (single events - simplest, universally
// interoperable). With tzid: local wall-clock value + TZID param
// (recurring series - keeps occurrences pinned to local time across DST;
// see buildVTimeZoneBlock()).
function icsDtLine(name, date, allDay, tzid) {
    if (allDay) return name + ';VALUE=DATE:' + icsDateStamp(date);
    if (tzid) return name + ';TZID=' + tzid + ':' + icsDateTimeStamp(date);
    return name + ':' + icsUtcStamp(date);
}

// Y/M/D/H/M/S wall-clock reading of a UTC instant in an arbitrary IANA
// zone (not the browser's own) - used to compute VTIMEZONE observance
// DTSTARTs, which must be expressed in that zone's own local time.
function wallClockPartsInZone(zone, utcMs) {
    let parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(new Date(utcMs));
    let get = function (type) { return parts.find(function (p) { return p.type === type; }).value; };
    return { y: +get('year'), mo: +get('month') - 1, d: +get('day'), hh: +get('hour'), mi: +get('minute'), ss: +get('second') };
}

// Generates a VTIMEZONE for `zone` covering roughly the last year
// through the next 5 - a coarse monthly scan finds which months have a
// transition, then each is bisected down to the minute. Pure
// compatibility aid for parsers that don't resolve a bare IANA TZID by
// name (most do); this app's own DTSTART/EXDATE/UNTIL values are already
// correct via the TZID string alone.
function buildVTimeZoneBlock(zone) {
    let startYear = new Date().getFullYear() - 1;
    let endYear = startYear + 6;
    let rangeStartMs = Date.UTC(startYear, 0, 1);
    let rangeEndMs = Date.UTC(endYear, 0, 1);

    let samples = [];
    for (let ms = rangeStartMs; ms < rangeEndMs; ms += 30 * 24 * 3600000) {
        samples.push({ ms: ms, offset: tzOffsetMinutesAt(zone, ms) });
    }
    samples.push({ ms: rangeEndMs, offset: tzOffsetMinutesAt(zone, rangeEndMs) });

    let transitions = [];
    for (let i = 1; i < samples.length; i++) {
        if (samples[i].offset === samples[i - 1].offset) continue;
        let lo = samples[i - 1].ms, hi = samples[i].ms;
        let loOffset = samples[i - 1].offset;
        while (hi - lo > 60000) {
            let mid = lo + Math.floor((hi - lo) / 2 / 60000) * 60000;
            if (tzOffsetMinutesAt(zone, mid) === loOffset) lo = mid; else hi = mid;
        }
        transitions.push({ atUtcMs: hi, fromOffset: loOffset, toOffset: tzOffsetMinutesAt(zone, hi) });
    }

    let lines = ['BEGIN:VTIMEZONE', 'TZID:' + zone];
    if (!transitions.length) {
        // No DST in this window - one flat observance covers it all.
        let offset = tzOffsetMinutesAt(zone, rangeStartMs);
        lines.push(
            'BEGIN:STANDARD',
            'DTSTART:' + icsDateTimeStamp(new Date(startYear, 0, 1)),
            'TZOFFSETFROM:' + formatIcsUtcOffset(offset),
            'TZOFFSETTO:' + formatIcsUtcOffset(offset),
            'END:STANDARD'
        );
    } else {
        transitions.forEach(function (t) {
            let wc = wallClockPartsInZone(zone, t.atUtcMs);
            let kind = t.toOffset > t.fromOffset ? 'DAYLIGHT' : 'STANDARD';
            lines.push(
                'BEGIN:' + kind,
                'DTSTART:' + icsDateTimeStamp(new Date(wc.y, wc.mo, wc.d, wc.hh, wc.mi, wc.ss)),
                'TZOFFSETFROM:' + formatIcsUtcOffset(t.fromOffset),
                'TZOFFSETTO:' + formatIcsUtcOffset(t.toOffset),
                'END:' + kind
            );
        });
    }
    lines.push('END:VTIMEZONE');
    return lines;
}

// "2026-08-15"/"2026-08-15T07:00" to RFC 5545's compact form.
function toIcsCompact(dashColonStr, allDay) {
    if (allDay) return dashColonStr.replace(/-/g, '');
    let parts = dashColonStr.split('T');
    return parts[0].replace(/-/g, '') + 'T' + parts[1].replace(':', '') + '00';
}

function recurToIcsRRuleLine(recur, allDay, tzid) {
    let freqMap = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };
    let parts = ['FREQ=' + freqMap[recur.freq]];
    if (recur.interval > 1) parts.push('INTERVAL=' + recur.interval);
    if (recur.byday && recur.byday.length) parts.push('BYDAY=' + recur.byday.join(','));
    if (recur.end === 'count' && recur.count) {
        parts.push('COUNT=' + recur.count);
    } else if (recur.end === 'until' && recur.until) {
        let untilStr = formatUntil(recur.until, recur.dtstart, allDay);
        if (allDay) {
            parts.push('UNTIL=' + toIcsCompact(untilStr, true));
        } else {
            // UNTIL can't carry a TZID param, and DTSTART has one here -
            // RFC 5545 (and universal real-world practice) says UNTIL
            // must then be UTC.
            let u = new Date(untilStr);
            let utcMs = localWallClockToUtcMs(tzid, u.getFullYear(), u.getMonth(), u.getDate(), u.getHours(), u.getMinutes(), u.getSeconds());
            parts.push('UNTIL=' + icsUtcStamp(new Date(utcMs)));
        }
    }
    return 'RRULE:' + parts.join(';');
}

function recurToIcsExdateLine(recur, allDay, tzid) {
    if (!recur.exdates || !recur.exdates.length) return null;
    let values = recur.exdates.map(function (s) { return toIcsCompact(s, allDay); });
    if (allDay) return 'EXDATE;VALUE=DATE:' + values.join(',');
    return 'EXDATE;TZID=' + tzid + ':' + values.join(',');
}

// Lets a re-imported file we exported ourselves resolve to the same
// event id, for duplicate detection on import.
let PEERGOS_UID_SUFFIX = '@peergos.org';

// Separates a series' UID from the occurrence an override replaces, so a
// legacy RECURRENCE-ID VEVENT gets a filename of its own once saved.
let OVERRIDE_ID_SEPARATOR = '--occurrence-';

// A UID read out of an imported file is untrusted, and the id derived from
// it becomes a filename on the host (<calendar>/<year>/<month>/<id>.ics)
// and the path a secret link is minted for - a UID of "../../.." would
// otherwise be concatenated straight into both. Only path-structural
// characters are neutralised: an ordinary foreign UID has to keep mapping
// to the same id, or events already stored under one would reload as
// duplicates under a new name.
function sanitizeEventId(id) {
    let safe = id.replace(/[\\\/\u0000-\u001f]/g, '_');
    return (safe === '' || safe === '.' || safe === '..') ? nextEventId() : safe;
}

function idFromIcsUid(uid) {
    let id = uid.endsWith(PEERGOS_UID_SUFFIX) ? uid.slice(0, -PEERGOS_UID_SUFFIX.length) : uid;
    return sanitizeEventId(id);
}

// Only ids we minted ourselves get a Peergos UID - a foreign UID stays
// untouched on re-export.
function isNativeEventId(id) {
    return /^evt-\d+-[a-z0-9]+$/.test(id);
}

// A recurring event with no occurrence in the current range has
// ev.start === null, so duration can't be derived from start/end -
// read it off the event-store def instead.
function recurringDurationMs(eventId) {
    let defs = calendar.getCurrentData().eventStore.defs;
    let key = Object.keys(defs).find(function (k) { return defs[k].publicId === eventId; });
    let dur = key && defs[key].recurringDef && defs[key].recurringDef.duration;
    return dur ? dur.milliseconds : 0;
}

function eventToIcsLines(ev) {
    let uid = isNativeEventId(ev.id) ? ev.id + PEERGOS_UID_SUFFIX : ev.id;
    let lines = ['BEGIN:VEVENT', 'UID:' + uid, 'DTSTAMP:' + icsUtcStamp(new Date())];
    let recur = ev.extendedProps.recur;

    if (recur) {
        // TZID, not UTC - see icsDtLine().
        let tzid = ev.allDay ? null : LOCAL_TZ;
        let dtstart = ev.allDay ? new Date(recur.dtstart + 'T00:00') : new Date(recur.dtstart);
        let durationMs = ev.start ? (ev.end || ev.start).getTime() - ev.start.getTime() : recurringDurationMs(ev.id);
        lines.push(icsDtLine('DTSTART', dtstart, ev.allDay, tzid));
        lines.push(icsDtLine('DTEND', new Date(dtstart.getTime() + durationMs), ev.allDay, tzid));
        lines.push(recurToIcsRRuleLine(recur, ev.allDay, tzid));
        let exdateLine = recurToIcsExdateLine(recur, ev.allDay, tzid);
        if (exdateLine) lines.push(exdateLine);
    } else {
        lines.push(icsDtLine('DTSTART', ev.start, ev.allDay));
        lines.push(icsDtLine('DTEND', ev.end || ev.start, ev.allDay));
    }

    lines.push('SUMMARY:' + escapeIcsText(ev.title));
    if (ev.extendedProps.location) lines.push('LOCATION:' + escapeIcsText(ev.extendedProps.location));
    if (ev.extendedProps.description) lines.push('DESCRIPTION:' + escapeIcsText(ev.extendedProps.description));
    lines.push('STATUS:' + (ev.extendedProps.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'));
    lines.push('END:VEVENT');
    return lines;
}

// --- Tasks ---
// A task is an iCalendar VTODO - the same file format events already use,
// so one written here opens in Thunderbird, Nextcloud Tasks or anything
// else that reads .ics. What separates it from an event is that DUE is
// optional: a task with no date has no year/month bucket to live in, which
// is why tasks get a directory of their own (see the README).
function taskToIcsLines(task) {
    let uid = isNativeTaskId(task.id) ? task.id + PEERGOS_UID_SUFFIX : task.id;
    let lines = ['BEGIN:VTODO', 'UID:' + uid, 'DTSTAMP:' + icsUtcStamp(new Date())];
    if (task.due) lines.push(icsDtLine('DUE', task.due, task.dueAllDay));
    lines.push('SUMMARY:' + escapeIcsText(task.title));
    if (task.description) lines.push('DESCRIPTION:' + escapeIcsText(task.description));
    if (task.priority) lines.push('PRIORITY:' + task.priority);
    if (task.completed) {
        lines.push('STATUS:COMPLETED');
        lines.push('PERCENT-COMPLETE:100');
        lines.push('COMPLETED:' + icsUtcStamp(task.completedAt || new Date()));
    } else {
        lines.push('STATUS:NEEDS-ACTION');
    }
    lines.push('END:VTODO');
    return lines;
}

function isNativeTaskId(id) {
    return /^task-\d+-[a-z0-9]+$/.test(id);
}

// Same UID handling as an event: the value becomes a filename, so it goes
// through the same sanitiser rather than being trusted.
function parseIcsVtodo(rawLines, tzResolver) {
    let props = rawLines.map(parseIcsPropertyLine).filter(Boolean);
    let find = function (name) { return props.find(function (p) { return p.name === name; }); };
    let uidLine = find('UID');
    let summaryLine = find('SUMMARY');
    let dueLine = find('DUE');
    let due = null;
    let dueAllDay = true;
    if (dueLine) {
        let parsed = parseIcsDateValue(dueLine.value, dueLine.params, tzResolver);
        if (parsed) {
            due = parsed.date;
            dueAllDay = parsed.allDay;
        }
    }
    let statusLine = find('STATUS');
    let completedLine = find('COMPLETED');
    let percentLine = find('PERCENT-COMPLETE');
    // Any of the three marks it done - clients disagree on which they write,
    // and Outlook writes PERCENT-COMPLETE without STATUS.
    let completed = (statusLine && statusLine.value.toUpperCase() === 'COMPLETED')
        || !!completedLine
        || (!!percentLine && parseInt(percentLine.value, 10) === 100);
    let completedAt = null;
    if (completedLine) {
        let parsedDone = parseIcsDateValue(completedLine.value, completedLine.params, tzResolver);
        if (parsedDone) completedAt = parsedDone.date;
    }
    let descLine = find('DESCRIPTION');
    let priorityLine = find('PRIORITY');
    let priority = priorityLine ? parseInt(priorityLine.value, 10) : 0;
    return {
        id: uidLine && uidLine.value ? idFromIcsUid(uidLine.value) : nextTaskId(),
        title: summaryLine ? unescapeIcsText(summaryLine.value) : '(untitled)',
        calendarId: defaultCalendarId(),
        due: due,
        dueAllDay: dueAllDay,
        description: descLine ? unescapeIcsText(descLine.value) : '',
        priority: (priority >= 1 && priority <= 9) ? priority : 0,
        completed: completed,
        completedAt: completed ? (completedAt || new Date()) : null
    };
}

function exportEventAsIcs(ev) {
    downloadIcsFile(icsFileNameFor(ev.title), eventToIcsLines(ev));
}

// mailto: can't carry an attachment - sends a plain-text summary instead
// of the .ics file.
function emailEventBody(ev) {
    let lines = [formatPopoverTime(ev)];
    if (ev.extendedProps.recur) lines.push(describeRecur(ev.extendedProps.recur));
    if (ev.extendedProps.location) lines.push(ev.extendedProps.location);
    if (ev.extendedProps.description) lines.push('', ev.extendedProps.description);
    return lines.join('\n');
}

// With the Peergos Email app the stored .ics goes as a real attachment, so
// the recipient can import the event rather than retype it.
//
// Without it, mail can only carry text - so the choice is put to the user
// rather than decided for them. A link is read access to the event that
// outlives the message, so it is never minted behind a single click: the
// link option leads to the share dialog, where the link is created
// deliberately and can be revoked from the same place afterwards.
function emailEvent(ev) {
    if (hostHasEmailApp && !isGuestSession) {
        hostSend(Object.assign({ type: 'emailEvent' }, hostEventRef(ev)));
        return;
    }
    if (isGuestSession) {
        emailEventAsMailto(ev);
        return;
    }
    openEmailChoice(ev);
}

let emailChoiceEvent = null;

function openEmailChoice(ev) {
    emailChoiceEvent = ev;
    let text = document.querySelector('input[name="email-mode"][value="text"]');
    if (text) text.checked = true;
    openDialog(emailChoiceBackdrop);
}

function closeEmailChoice() {
    closeDialog(emailChoiceBackdrop);
    emailChoiceEvent = null;
}

emailChoiceConfirmButton.addEventListener('click', function () {
    let ev = emailChoiceEvent;
    if (!ev) return;
    let chosen = document.querySelector('input[name="email-mode"]:checked');
    closeEmailChoice();
    if (chosen && chosen.value === 'link') {
        openShareModal(Object.assign({ target: 'event' }, hostEventRef(ev)), ev.title, 'event');
    } else {
        emailEventAsMailto(ev);
    }
});

emailChoiceCancelButton.addEventListener('click', closeEmailChoice);
emailChoiceBackdrop.addEventListener('click', function (e) {
    if (e.target === emailChoiceBackdrop) closeEmailChoice();
});

// The clipboard is what this reliably delivers: a mailto: only goes
// anywhere on a machine with a mail client registered for it, and on one
// without, opening it produces nothing at all. So the details are copied
// first and the user is told, then the mail app is offered the same text
// for the machines where that does work.
function emailEventAsMailto(ev) {
    let body = emailEventBody(ev);
    copyText(ev.title + '\n' + body);
    showToast('Event details copied');
    let url = 'mailto:?subject=' + encodeURIComponent(ev.title) + '&body=' + encodeURIComponent(body);
    window.open(url, '_blank');
}

function icsFileNameFor(name) {
    return (name || 'calendar').replace(/[^a-z0-9-_]+/gi, '_') + '.ics';
}

// Shared by download/email and by the per-event files written back to
// Peergos (see persistEvent) - one VEVENT there, many here.
function buildIcsDocument(veventLines) {
    // Every TZID this app emits is LOCAL_TZ (see eventToIcsLines) - one
    // shared VTIMEZONE block, included only if something needs it.
    let usesLocalTz = veventLines.some(function (l) { return l.indexOf(';TZID=' + LOCAL_TZ + ':') !== -1; });
    let lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Peergos//Calendar 0.0.1//EN', 'CALSCALE:GREGORIAN']
        .concat(usesLocalTz ? buildVTimeZoneBlock(LOCAL_TZ) : [])
        .concat(veventLines)
        .concat(['END:VCALENDAR']);
    return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

// The host writes the file, not this frame: inside the Android app a blob:
// URL never reaches the download listener, and the native bridge that takes
// the text instead only exists in the host's frame.
function downloadIcsFile(filename, veventLines) {
    hostSend({ type: 'downloadIcs', filename: filename, item: buildIcsDocument(veventLines) });
}

// Walks event-store defs, not calendar.getEvents() - a recurring series
// with no occurrence in the current view still has a def. Defs are
// per-occurrence, hence the dedupe by publicId. An id can come from an
// imported UID, so the seen-set is Object.create(null) (see
// isRecognizedIanaZone for the same reasoning).
function allStoredEvents() {
    let defs = calendar.getCurrentData().eventStore.defs;
    let seen = Object.create(null);
    let events = [];
    Object.keys(defs).forEach(function (key) {
        let publicId = defs[key].publicId;
        if (!publicId || seen[publicId]) return;
        seen[publicId] = true;
        let ev = calendar.getEventById(publicId);
        if (ev) events.push(ev);
    });
    return events;
}

function exportCalendarAsIcs(calendarId) {
    let cal = getCalendarById(calendarId);
    if (!cal) return;
    let lines = [];
    allStoredEvents().forEach(function (ev) {
        // The grid copy of a task is not an event - it would export as a
        // VEVENT and come back from any other client as one.
        if (ev.extendedProps.isTask) return;
        if (ev.extendedProps.calendarId === calendarId) lines = lines.concat(eventToIcsLines(ev));
    });
    tasks.forEach(function (task) {
        if (task.calendarId === calendarId) lines = lines.concat(taskToIcsLines(task));
    });
    downloadIcsFile(icsFileNameFor(cal.name), lines);
}

function unfoldIcsLines(text) {
    let raw = text.split(/\r\n|\n|\r/);
    let lines = [];
    for (let i = 0; i < raw.length; i++) {
        if (lines.length && (raw[i][0] === ' ' || raw[i][0] === '\t')) {
            lines[lines.length - 1] += raw[i].slice(1);
        } else if (raw[i].length) {
            lines.push(raw[i]);
        }
    }
    return lines;
}

function parseIcsPropertyLine(line) {
    let colonIdx = line.indexOf(':');
    if (colonIdx === -1) return null;
    let head = line.slice(0, colonIdx);
    let value = line.slice(colonIdx + 1);
    let headParts = head.split(';');
    let params = {};
    for (let i = 1; i < headParts.length; i++) {
        let eq = headParts[i].indexOf('=');
        if (eq !== -1) params[headParts[i].slice(0, eq).toUpperCase()] = headParts[i].slice(eq + 1);
    }
    return { name: headParts[0].toUpperCase(), params: params, value: value };
}

// tzResolver(tzid, y, mo, d, hh, mi, ss) -> UTC ms, or null to fall back
// to floating-local (see makeTzResolver() for the resolution chain).
function parseIcsDateValue(value, params, tzResolver) {
    let m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
    if (!m) return null;
    let y = +m[1], mo = +m[2] - 1, d = +m[3];
    if (params.VALUE === 'DATE' || !m[4]) {
        return { date: new Date(y, mo, d), allDay: true };
    }
    let hh = +m[4], mi = +m[5], ss = +m[6];
    if (m[7]) return { date: new Date(Date.UTC(y, mo, d, hh, mi, ss)), allDay: false };
    if (params.TZID && tzResolver) {
        let utcMs = tzResolver(params.TZID, y, mo, d, hh, mi, ss);
        if (utcMs !== null) return { date: new Date(utcMs), allDay: false };
    }
    return { date: new Date(y, mo, d, hh, mi, ss), allDay: false };
}

// Parses a file's own VTIMEZONE block into a sorted list of offset
// transitions - the fallback path when a TZID is neither a recognized
// IANA zone nor a known legacy name. STANDARD/DAYLIGHT observances
// defined with a recurring RRULE (the common shape, e.g. "last Sunday of
// March") are expanded with the already-vendored rrule.js rather than a
// hand-written RRULE evaluator.

// Same frequency restriction the regular event-RRULE importer already
// applies (parseIcsRRuleValue) - without it, a ~200-byte "FREQ=SECONDLY"
// VTIMEZONE observance expanded across the 20-year window below attempts
// hundreds of millions of iterations synchronously. Confirmed, not
// theoretical: this froze a real browser tab for 10+ seconds with no way
// to interrupt it (JS is single-threaded).
let ALLOWED_VTIMEZONE_RRULE_FREQS = [rrule.RRule.YEARLY, rrule.RRule.MONTHLY, rrule.RRule.WEEKLY, rrule.RRule.DAILY];

// Extra bound alongside the frequency check above - even a legitimate
// frequency can't exceed this within the 20-year window (DAILY is the
// worst case at ~7300), so this only ever matters if a file crams in an
// implausible number of separate observances.
let MAX_VTIMEZONE_TRANSITIONS = 2000;

function parseVTimeZoneOffsets(blockLines) {
    let observances = [];
    let current = null;
    blockLines.forEach(function (line) {
        if (line === 'BEGIN:STANDARD' || line === 'BEGIN:DAYLIGHT') {
            current = [];
        } else if (line === 'END:STANDARD' || line === 'END:DAYLIGHT') {
            if (current) observances.push(current);
            current = null;
        } else if (current) {
            current.push(line);
        }
    });

    let transitions = [];
    observances.forEach(function (obsLines) {
        if (transitions.length >= MAX_VTIMEZONE_TRANSITIONS) return;
        let props = obsLines.map(parseIcsPropertyLine).filter(Boolean);
        let find = function (name) { return props.find(function (p) { return p.name === name; }); };
        let dtstartLine = find('DTSTART');
        let offsetLine = find('TZOFFSETTO');
        if (!dtstartLine || !offsetLine) return;
        let offsetMinutes = parseIcsUtcOffset(offsetLine.value);
        if (offsetMinutes === null) return;
        let startParsed = parseIcsDateValue(dtstartLine.value, {});
        if (!startParsed) return;

        let rruleLine = find('RRULE');
        if (rruleLine) {
            try {
                let options = rrule.RRule.parseString(rruleLine.value);
                if (ALLOWED_VTIMEZONE_RRULE_FREQS.indexOf(options.freq) === -1) {
                    throw new Error('unsupported VTIMEZONE RRULE frequency');
                }
                options.dtstart = toFakeUtc(startParsed.date);
                let rr = new rrule.RRule(options);
                // Relative to *now*, not the observance's own DTSTART -
                // real files often anchor these to a placeholder year
                // like 1601, which would otherwise leave a present-day
                // target with no transition nearby.
                let nowYear = new Date().getFullYear();
                let windowStart = toFakeUtc(startParsed.date);
                let tenYearsAgo = toFakeUtc(new Date(nowYear - 10, 0, 1));
                if (tenYearsAgo > windowStart) windowStart = tenYearsAgo;
                let windowEnd = toFakeUtc(new Date(nowYear + 10, 0, 1));
                rr.between(windowStart, windowEnd, true).forEach(function (occ) {
                    if (transitions.length >= MAX_VTIMEZONE_TRANSITIONS) return;
                    transitions.push({ ms: fromFakeUtc(occ).getTime(), offsetMinutes: offsetMinutes });
                });
            } catch (e) {
                transitions.push({ ms: startParsed.date.getTime(), offsetMinutes: offsetMinutes });
            }
        } else {
            transitions.push({ ms: startParsed.date.getTime(), offsetMinutes: offsetMinutes });
            let rdateLine = find('RDATE');
            if (rdateLine) {
                rdateLine.value.split(',').forEach(function (v) {
                    let parsed = parseIcsDateValue(v.trim(), {});
                    if (parsed) transitions.push({ ms: parsed.date.getTime(), offsetMinutes: offsetMinutes });
                });
            }
        }
    });
    transitions.sort(function (a, b) { return a.ms - b.ms; });
    return transitions;
}

// Latest transition at or before naiveMs - both sides use the same
// floating/local interpretation, so their relative order is valid even
// though neither is a real UTC instant on its own.
function offsetAtFromTransitions(transitions, naiveMs) {
    let result = null;
    for (let i = 0; i < transitions.length; i++) {
        if (transitions[i].ms > naiveMs) break;
        result = transitions[i].offsetMinutes;
    }
    return result;
}

// Builds the tzResolver passed to parseIcsDateValue for one file: a
// recognized IANA zone name first, then a mapped legacy zone name, then
// that file's own embedded VTIMEZONE block for this exact TZID, then
// null (caller falls back to floating-local).
function makeTzResolver(fileVTimeZones) {
    return function (tzid, y, mo, d, hh, mi, ss) {
        let zone = resolveTzidToIanaZone(tzid);
        if (zone) return localWallClockToUtcMs(zone, y, mo, d, hh, mi, ss);
        let transitions = Object.prototype.hasOwnProperty.call(fileVTimeZones, tzid) ? fileVTimeZones[tzid] : null;
        if (transitions && transitions.length) {
            let naiveMs = new Date(y, mo, d, hh, mi, ss).getTime();
            let offsetMinutes = offsetAtFromTransitions(transitions, naiveMs);
            if (offsetMinutes !== null) return Date.UTC(y, mo, d, hh, mi, ss) - offsetMinutes * 60000;
        }
        return null;
    };
}

function parseIcsRRuleValue(value, dtstartTzid, tzResolver) {
    let freqMap = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
    let props = {};
    value.split(';').forEach(function (p) {
        let eq = p.indexOf('=');
        if (eq !== -1) props[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
    });
    // hasOwnProperty: FREQ comes straight out of the file, and a bare map
    // answers "constructor"/"toString" with an inherited function rather than
    // undefined, which sails past the check below as a valid frequency.
    let freq = Object.prototype.hasOwnProperty.call(freqMap, props.FREQ) ? freqMap[props.FREQ] : null;
    if (!freq) return null; // HOURLY/MINUTELY/SECONDLY - not in our UI's scope

    let recur = { freq: freq, interval: props.INTERVAL ? parseInt(props.INTERVAL, 10) : 1, end: 'never', until: null, count: null, exdates: [] };

    // Only two BYDAY shapes are representable by the UI: plain weekday
    // codes on WEEKLY, or one ordinal code on MONTHLY. Anything else
    // (BYMONTHDAY/BYMONTH/etc, mixed ordinals) is dropped.
    let codes = props.BYDAY ? props.BYDAY.split(',') : [];
    let isPlainCode = function (c) { return /^(SU|MO|TU|WE|TH|FR|SA)$/.test(c); };
    let isOrdinalCode = function (c) { return /^-?\d+(SU|MO|TU|WE|TH|FR|SA)$/.test(c); };
    let bydaySupported =
        (freq === 'weekly' && codes.length && codes.every(isPlainCode)) ||
        (freq === 'monthly' && codes.length === 1 && isOrdinalCode(codes[0]));
    let hasOtherByParts = props.BYMONTHDAY || props.BYMONTH || props.BYYEARDAY || props.BYWEEKNO || props.BYSETPOS;

    if ((props.BYDAY && !bydaySupported) || hasOtherByParts) {
        // Temporary marker, not part of the recurrence data model -
        // parseIcsVevent strips it and re-stamps it on the event payload,
        // on its way to the import summary (formatImportSummary).
        recur.simplified = true;
    } else if (bydaySupported) {
        recur.byday = codes;
    }

    if (props.COUNT) {
        recur.end = 'count';
        recur.count = parseInt(props.COUNT, 10);
    } else if (props.UNTIL) {
        // UNTIL can't carry its own TZID param but is meant to match
        // DTSTART's zone, so that's applied here as if it were one.
        let parsed = parseIcsDateValue(props.UNTIL, dtstartTzid ? { TZID: dtstartTzid } : {}, tzResolver);
        if (parsed) {
            recur.end = 'until';
            recur.until = toDateInputValue(parsed.date);
        }
    }
    return recur;
}

function parseIcsVevent(rawLines, tzResolver) {
    let props = rawLines.map(parseIcsPropertyLine).filter(Boolean);
    let find = function (name) { return props.find(function (p) { return p.name === name; }); };
    let findAll = function (name) { return props.filter(function (p) { return p.name === name; }); };

    let dtstartLine = find('DTSTART');
    if (!dtstartLine) return null;
    let startParsed = parseIcsDateValue(dtstartLine.value, dtstartLine.params, tzResolver);
    if (!startParsed) return null;
    let allDay = startParsed.allDay;
    let start = startParsed.date;

    let dtendLine = find('DTEND');
    let end;
    if (dtendLine) {
        let endParsed = parseIcsDateValue(dtendLine.value, dtendLine.params, tzResolver);
        end = endParsed ? endParsed.date : start;
    } else {
        end = allDay ? addDays(start, 1) : new Date(start.getTime() + 3600000);
    }

    let rruleLine = find('RRULE');
    let recur = rruleLine ? parseIcsRRuleValue(rruleLine.value, dtstartLine.params.TZID, tzResolver) : null;
    if (recur) {
        recur.dtstart = allDay ? toDateInputValue(start) : (toDateInputValue(start) + 'T' + toTimeInputValue(start));
        findAll('EXDATE').forEach(function (l) {
            l.value.split(',').forEach(function (v) {
                let parsed = parseIcsDateValue(v.trim(), l.params, tzResolver);
                if (parsed) recur.exdates.push(allDay ? toDateInputValue(parsed.date) : (toDateInputValue(parsed.date) + 'T' + toTimeInputValue(parsed.date)));
            });
        });
    }

    let summaryLine = find('SUMMARY');
    let locationLine = find('LOCATION');
    let descLine = find('DESCRIPTION');
    let statusLine = find('STATUS');
    let title = summaryLine ? unescapeIcsText(summaryLine.value) : '(untitled)';
    let extra = {
        location: locationLine ? unescapeIcsText(locationLine.value) : '',
        status: (statusLine && statusLine.value.toUpperCase() === 'CANCELLED') ? 'cancelled' : 'active',
        description: descLine ? unescapeIcsText(descLine.value) : '',
        // Imported files don't know about our calendars - land in the
        // first one, same as any other calendar-unaware external source.
        calendarId: defaultCalendarId()
    };

    let uidLine = find('UID');
    let id = uidLine ? idFromIcsUid(uidLine.value) : nextEventId();

    // A single-occurrence override written by the previous calendar: same
    // UID as its series, singled out only by RECURRENCE-ID. This app models
    // that as an ordinary standalone event plus an EXDATE on the series
    // (see excludeOccurrenceFromMaster), so it needs an id of its own -
    // sharing the series' id would collide, and leaving the series
    // unexcluded would draw the replaced occurrence underneath it.
    let recurrenceIdLine = find('RECURRENCE-ID');
    if (recurrenceIdLine) {
        let overrideParsed = parseIcsDateValue(recurrenceIdLine.value, recurrenceIdLine.params, tzResolver);
        if (!overrideParsed) return null;
        let occurrence = overrideParsed.allDay
            ? toDateInputValue(overrideParsed.date)
            : (toDateInputValue(overrideParsed.date) + 'T' + toTimeInputValue(overrideParsed.date));
        // Digits only: this id becomes a filename, and the readable form
        // ("2026-01-12T11:00") carries a colon.
        let override = buildPlainEventPayload(id + OVERRIDE_ID_SEPARATOR + occurrence.replace(/[^0-9]/g, ''), title, allDay, start, end, extra);
        override.__overrideOf = id;
        override.__overrideOccurrence = occurrence;
        return override;
    }

    if (recur) {
        // Moved off `recur` onto the payload: `recur` is persisted as
        // extendedProps.recur, so the marker must not travel with it.
        let simplified = !!recur.simplified;
        delete recur.simplified;
        let data = buildRecurringEventPayload(id, title, allDay, extra, recur, end.getTime() - start.getTime());
        data.__recurSimplified = simplified;
        return data;
    }
    return buildPlainEventPayload(id, title, allDay, start, end, extra);
}

// `failed` counts VEVENT and VTODO blocks that didn't produce a usable
// item. VTIMEZONE blocks are siblings of VEVENT (not nested inside one), so
// they're collected in a first pass and turned into a per-TZID offset
// resolver before any VEVENT is actually parsed.
function parseIcsFile(text) {
    let lines = unfoldIcsLines(text);
    let blocks = { VTIMEZONE: [], VEVENT: [], VTODO: [] };
    let current = null;
    let currentKind = null;
    lines.forEach(function (line) {
        if (line.indexOf('BEGIN:') === 0 && blocks[line.slice('BEGIN:'.length)]) {
            current = [];
            currentKind = line.slice('BEGIN:'.length);
        } else if (currentKind && line === 'END:' + currentKind) {
            if (current) blocks[currentKind].push(current);
            current = null;
            currentKind = null;
        } else if (current) {
            current.push(line);
        }
    });
    let vtimezoneBlocks = blocks.VTIMEZONE;
    let veventBlocks = blocks.VEVENT;

    // Object.create(null), not {} - a VTIMEZONE's TZID is attacker-
    // controlled, and a plain {} treats a TZID of "__proto__" as its
    // prototype-setter rather than a key (confirmed: silently repoints
    // this object's own [[Prototype]], no own property added).
    let fileVTimeZones = Object.create(null);
    vtimezoneBlocks.forEach(function (blockLines) {
        let tzidLine = blockLines.map(parseIcsPropertyLine).filter(Boolean).find(function (p) { return p.name === 'TZID'; });
        if (tzidLine) fileVTimeZones[tzidLine.value] = parseVTimeZoneOffsets(blockLines);
    });
    let tzResolver = makeTzResolver(fileVTimeZones);

    // One malformed/hostile VEVENT throwing (unexpected data shape,
    // anything not already handled by returning null) shouldn't cost
    // every other, otherwise-valid event in the same file.
    // __recurSimplified is deliberately left on the returned events: only
    // the caller knows which are actually added vs. skipped as duplicates,
    // and a skipped one must not count as imported (see icsFileInput).
    let events = [];
    let failed = 0;
    veventBlocks.forEach(function (blockLines) {
        let ev;
        try {
            ev = parseIcsVevent(blockLines, tzResolver);
        } catch (e) {
            ev = null;
        }
        if (ev) events.push(ev); else failed++;
    });

    // Fold each override into its series before handing anything back, so
    // the replaced occurrence stops being drawn. Overrides whose series
    // isn't in this file stay as plain standalone events - better a
    // detached event than a silently dropped one.
    events.forEach(function (ev) {
        if (!ev.__overrideOf) return;
        let master = events.find(function (m) { return m.id === ev.__overrideOf && m.extendedProps && m.extendedProps.recur; });
        if (master) {
            let recur = master.extendedProps.recur;
            if (!recur.exdates) recur.exdates = [];
            if (recur.exdates.indexOf(ev.__overrideOccurrence) === -1) recur.exdates.push(ev.__overrideOccurrence);
            master.exdate = recur.exdates.slice();
        }
        delete ev.__overrideOf;
        delete ev.__overrideOccurrence;
    });
    let tasks = [];
    blocks.VTODO.forEach(function (blockLines) {
        let task;
        try {
            task = parseIcsVtodo(blockLines, tzResolver);
        } catch (e) {
            task = null;
        }
        if (task) tasks.push(task); else failed++;
    });

    return { events: events, tasks: tasks, failed: failed };
}

// Shared by "delete this occurrence" and "edit this occurrence" (the
// latter also adds a standalone replacement event for the edited data).
function excludeOccurrenceFromMaster(master) {
    let masterRecur = Object.assign({}, master.extendedProps.recur);
    let occurrenceStr = master.allDay ? toDateInputValue(master.start) : (toDateInputValue(master.start) + 'T' + toTimeInputValue(master.start));
    masterRecur.exdates = (masterRecur.exdates || []).concat([occurrenceStr]);
    let durationMs = (master.end || master.start).getTime() - master.start.getTime();
    let payload = buildRecurringEventPayload(master.id, master.title, master.allDay, extraPropsOf(master), masterRecur, durationMs);
    master.remove();
    addAndPersist(payload);
}

// Shared by "delete this and following" and "edit this and following".
// Ends the series at the occurrence before the split point, or removes
// it outright if the split point is the first occurrence.
function truncateMasterSeries(master) {
    let masterRecur = Object.assign({}, master.extendedProps.recur);
    let untilBoundary = previousOccurrenceBoundary(masterRecur, master.allDay, master.start);
    if (!untilBoundary) {
        removeAndPersist(master);
        return;
    }
    masterRecur.end = 'until';
    masterRecur.until = toDateInputValue(untilBoundary);
    masterRecur.count = null;
    let durationMs = (master.end || master.start).getTime() - master.start.getTime();
    let payload = buildRecurringEventPayload(master.id, master.title, master.allDay, extraPropsOf(master), masterRecur, durationMs);
    master.remove();
    addAndPersist(payload);
}

let recurFreqLabels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
let recurIntervalUnits = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' };

function describeRecur(recur) {
    let text = recur.interval > 1
        ? 'Every ' + recur.interval + ' ' + recurIntervalUnits[recur.freq]
        : recurFreqLabels[recur.freq];
    if (recur.end === 'until' && recur.until) text += ', until ' + recur.until;
    else if (recur.end === 'count' && recur.count) text += ', ' + recur.count + ' times';
    return text;
}

// Built once, not per call - an Intl.DateTimeFormat is expensive to
// construct, and search rebuilds every result's meta line on every
// keystroke.
let DATE_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
let TIME_FORMAT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

function formatPopoverTime(ev) {
    if (ev.allDay) {
        let lastDay = toFormEnd(ev.end || ev.start, true);
        if (toDateInputValue(lastDay) === toDateInputValue(ev.start)) {
            return DATE_FORMAT.format(ev.start) + ' · All day';
        }
        return DATE_FORMAT.format(ev.start) + ' – ' + DATE_FORMAT.format(lastDay) + ' · All day';
    }
    return DATE_FORMAT.format(ev.start) + ' · ' + TIME_FORMAT.format(ev.start) + ' – ' + TIME_FORMAT.format(ev.end || ev.start);
}

// Finds an event's current DOM element by id (data-search-event-id, set
// in eventDidMount below).
function findEventAnchorEl(id) {
    return document.querySelector('[data-search-event-id="' + CSS.escape(id) + '"]');
}

function positionPopover(anchorEl) {
    let anchorRect = anchorEl.getBoundingClientRect();
    let popRect = popover.getBoundingClientRect();
    let left = Math.min(anchorRect.left, window.innerWidth - popRect.width - 8);
    left = Math.max(8, left);
    // Prefer below; flip above only if below doesn't fit and above does.
    let below = anchorRect.bottom + 8;
    let fitsBelow = below + popRect.height <= window.innerHeight - 8;
    let above = anchorRect.top - popRect.height - 8;
    let fitsAbove = above >= 8;
    let top = fitsBelow ? below : (fitsAbove ? above : below);
    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
}

function showEventPopover(ev, anchorEl) {
    popoverEvent = ev;
    popoverTitle.textContent = ev.title;
    popoverTime.textContent = formatPopoverTime(ev);

    let recur = ev.extendedProps.recur;
    popoverRepeatRow.style.display = recur ? '' : 'none';
    if (recur) popoverRepeat.textContent = describeRecur(recur);

    let location = ev.extendedProps.location;
    popoverLocationRow.style.display = location ? '' : 'none';
    if (location) popoverLocation.textContent = location;

    let description = ev.extendedProps.description;
    popoverDescriptionRow.style.display = description ? '' : 'none';
    if (description) popoverDescription.textContent = description;

    let writable = isCalendarWritable(ev.extendedProps.calendarId);
    popoverActions.style.display = writable ? '' : 'none';
    // See .event-popover.has-actions in calendar.css
    popover.classList.toggle('has-actions', writable);

    anchorEl.classList.add('fc-event-selected');
    popover.classList.add('open');
    positionPopover(anchorEl);
    // Re-position shortly after - FullCalendar's own row-height pass can
    // still settle the anchor after this synchronous call.
    setTimeout(function () {
        if (!popover.classList.contains('open')) return;
        positionPopover(anchorEl.isConnected ? anchorEl : (findEventAnchorEl(ev.id) || anchorEl));
    }, 0);
}

function hideEventPopover() {
    popoverEvent = null;
    let selected = document.querySelector('.fc-event-selected');
    if (selected) selected.classList.remove('fc-event-selected');
    popover.classList.remove('open');
}

let MIN_SEARCH_QUERY_LENGTH = 2;

// allStoredEvents(), not calendar.getEvents(), so a recurring series stays
// searchable from months its occurrences aren't rendered in.
// Events and tasks together: an undated task is never on the grid, so
// search is the only way to reach it by name.
// Deliberately the same row shape as an event hit, with the task's own
// state instead of a date: a result list that mixed two layouts would read
// as two lists.
function taskSearchResult(task) {
    let item = document.createElement('button');
    item.type = 'button';
    item.className = 'search-result-item';

    let titleRow = document.createElement('div');
    titleRow.className = 'search-result-title-row';
    let dot = document.createElement('span');
    dot.className = 'search-result-dot';
    dot.style.backgroundColor = displayColor(calendarColorFor(task.calendarId));
    titleRow.appendChild(dot);
    let titleSpan = document.createElement('span');
    titleSpan.className = 'search-result-title';
    if (task.completed) titleSpan.classList.add('search-result-cancelled');
    titleSpan.textContent = task.title;
    titleRow.appendChild(titleSpan);
    let badge = document.createElement('span');
    badge.className = 'search-result-badge';
    badge.title = 'Task';
    badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l9 -9"/></svg>';
    titleRow.appendChild(badge);

    let metaRow = document.createElement('div');
    metaRow.className = 'search-result-meta';
    metaRow.textContent = task.completed ? 'Task · Done' : (formatTaskDue(task) || 'Task · No date');

    item.appendChild(titleRow);
    item.appendChild(metaRow);
    item.addEventListener('click', function (e) {
        e.stopPropagation();
        closeSearchResults();
        if (task.due) calendar.gotoDate(task.due);
        openTaskModal('edit', task);
    });
    return item;
}

function getSearchableEvents(query) {
    let q = query.trim().toLowerCase();
    if (q.length < MIN_SEARCH_QUERY_LENGTH) return [];
    let results = [];
    allStoredEvents().forEach(function (ev) {
        if (ev.extendedProps.isTask) return;
        let title = (ev.title || '').toLowerCase();
        let location = (ev.extendedProps.location || '').toLowerCase();
        let description = (ev.extendedProps.description || '').toLowerCase();
        if (title.indexOf(q) === -1 && location.indexOf(q) === -1 && description.indexOf(q) === -1) return;
        let jumpDate = ev.start || nearestRecurOccurrenceDate(ev.extendedProps.recur, ev.allDay, new Date());
        results.push({ event: ev, jumpDate: jumpDate });
    });
    tasks.forEach(function (task) {
        if (!isCalendarVisible(task.calendarId)) return;
        if ((task.title || '').toLowerCase().indexOf(q) === -1
            && (task.description || '').toLowerCase().indexOf(q) === -1) return;
        results.push({ task: task, jumpDate: task.due });
    });
    // Undated tasks have nothing to sort by, so they sit at the end rather
    // than being treated as the year 1970.
    results.sort(function (a, b) {
        if (!a.jumpDate) return b.jumpDate ? 1 : 0;
        if (!b.jumpDate) return -1;
        return a.jumpDate - b.jumpDate;
    });
    return results;
}

function formatSearchResultMeta(ev, jumpDate, cal) {
    let text = DATE_FORMAT.format(jumpDate);
    if (!ev.allDay) text += ' · ' + TIME_FORMAT.format(jumpDate);
    if (ev.extendedProps.location) text += ' · ' + ev.extendedProps.location;
    if (cal) text += ' · ' + cal.name;
    return text;
}

function renderSearchResults(query) {
    searchResults.innerHTML = '';
    let trimmed = query.trim();
    if (!trimmed) {
        closeSearchResults();
        return;
    }
    searchResults.classList.add('open');
    if (trimmed.length < MIN_SEARCH_QUERY_LENGTH) {
        let hint = document.createElement('div');
        hint.className = 'search-empty';
        hint.textContent = 'Keep typing (' + MIN_SEARCH_QUERY_LENGTH + '+ characters)…';
        searchResults.appendChild(hint);
        return;
    }
    let matches = getSearchableEvents(query);
    if (!matches.length) {
        let empty = document.createElement('div');
        empty.className = 'search-empty';
        empty.textContent = 'No matching events';
        searchResults.appendChild(empty);
        return;
    }
    matches.slice(0, 20).forEach(function (match) {
        if (match.task) {
            searchResults.appendChild(taskSearchResult(match.task));
            return;
        }
        let ev = match.event;
        let item = document.createElement('button');
        item.type = 'button';
        item.className = 'search-result-item';

        let titleRow = document.createElement('div');
        titleRow.className = 'search-result-title-row';
        let cal = getCalendarById(ev.extendedProps.calendarId);
        if (cal) {
            let dot = document.createElement('span');
            dot.className = 'search-result-dot';
            dot.style.backgroundColor = displayColor(cal.color);
            titleRow.appendChild(dot);
        }
        let titleSpan = document.createElement('span');
        titleSpan.className = 'search-result-title';
        if (ev.extendedProps.status === 'cancelled') titleSpan.classList.add('search-result-cancelled');
        titleSpan.textContent = ev.title;
        titleRow.appendChild(titleSpan);
        if (ev.extendedProps.recur) {
            let badge = document.createElement('span');
            badge.className = 'search-result-badge';
            badge.title = 'Recurring';
            badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3"/><path d="M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3"/></svg>';
            titleRow.appendChild(badge);
        }

        let metaRow = document.createElement('div');
        metaRow.className = 'search-result-meta';
        metaRow.textContent = formatSearchResultMeta(ev, match.jumpDate, cal);

        item.appendChild(titleRow);
        item.appendChild(metaRow);
        // Otherwise the "click outside closes popover" listener closes
        // the popover jumpToSearchResult() just opened, same event.
        item.addEventListener('click', function (e) {
            e.stopPropagation();
            jumpToSearchResult(ev, match.jumpDate);
        });
        searchResults.appendChild(item);
    });
}

// Navigates then opens the event's popover, then re-resolves to the
// nearest real instance (ev may be a recurring master with .start ===
// null before gotoDate() makes an occurrence exist).
function jumpToSearchResult(ev, jumpDate) {
    closeSearchResults();
    // A hidden calendar's events aren't in the DOM at all - re-enable so
    // findEventAnchorEl() below has something to find.
    if (!isCalendarVisible(ev.extendedProps.calendarId)) {
        getCalendarById(ev.extendedProps.calendarId).visible = true;
        applyCalendarVisibility();
        renderCalendarList();
    }
    gotoDateWithTransition(jumpDate);
    let instance = calendar.getEvents().filter(function (e) { return e.id === ev.id; })
        .reduce(function (best, e) {
            return !best || Math.abs(e.start - jumpDate) < Math.abs(best.start - jumpDate) ? e : best;
        }, null) || ev;
    let anchorEl = findEventAnchorEl(ev.id);
    if (anchorEl) showEventPopover(instance, anchorEl);
}

function closeSearchResults() {
    searchResults.classList.remove('open');
}

function clearSearch() {
    searchInput.value = '';
    searchResults.innerHTML = '';
    closeSearchResults();
    searchClearButton.classList.remove('visible');
}

// --- Multi-calendar: create/rename/recolor/delete, show/hide filtering ---

function getCalendarById(id) {
    return calendars.find(function (c) { return c.id === id; });
}

// Where a new or imported event lands: the first calendar we may write to.
// Null until the host's first `load` has populated the list.
function defaultCalendarId() {
    let writable = calendars.find(function (c) { return !c.readOnly; });
    return writable ? writable.id : null;
}

function isCalendarWritable(calendarId) {
    let cal = getCalendarById(calendarId);
    return !cal || !cal.readOnly;
}

function isCalendarVisible(calendarId) {
    let cal = getCalendarById(calendarId);
    return !cal || cal.visible;
}

// Uses FullCalendar's own per-event `display` property, not CSS, so
// hidden events are excluded from layout (e.g. "+N more" counts).
function applyCalendarVisibility() {
    calendar.getEvents().forEach(function (ev) {
        ev.setProp('display', isCalendarVisible(ev.extendedProps.calendarId) ? 'auto' : 'none');
    });
}

function applyCalendarColor(calendarId) {
    let cal = getCalendarById(calendarId);
    if (!cal) return;
    calendar.getEvents().forEach(function (ev) {
        if (ev.extendedProps.calendarId === calendarId) ev.setProp('color', displayColor(cal.color));
    });
}

function renderCalendarSelectOptions(selectedId, target) {
    let select = target || calendarSelectInput;
    select.innerHTML = '';
    calendars.forEach(function (cal) {
        // Read-only calendars aren't a valid save target, except the
        // item's own current one (so its name still shows while editing).
        if (cal.readOnly && cal.id !== selectedId) return;
        let option = document.createElement('option');
        option.value = cal.id;
        option.textContent = cal.name;
        select.appendChild(option);
    });
    select.value = selectedId || defaultCalendarId() || '';
}

// Every trigger of a .calendar-menu, so closing can reset their state in
// one place instead of each opener remembering to.
let MENU_TRIGGER_SELECTOR = '#toolbar-add-button, #overflow-menu-button, .calendar-menu-button, .goto-date-trigger';

function closeAllCalendarMenus() {
    document.querySelectorAll('.calendar-menu.open').forEach(function (menu) { menu.classList.remove('open'); });
    document.querySelectorAll(MENU_TRIGGER_SELECTOR).forEach(function (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
    });
}

// Defensive backstop - Delete isn't even rendered for these (see
// renderCalendarList()).
// The host owns the confirm dialog and the directory removal; the local
// list is only updated once it confirms via respondDeleteCalendar.
function deleteCalendar(id) {
    let cal = getCalendarById(id);
    if (!cal || cal.primary || cal.readOnly) return;
    openConfirmModal('Delete "' + cal.name + '"? All its events will be permanently deleted.', function () {
        hostSend({ type: 'deleteCalendar', calendarName: cal.name, id: cal.id, confirmed: true });
    });
}

function renderCalendarList() {
    calendarListEl.innerHTML = '';
    calendars.forEach(function (cal) {
        let item = document.createElement('div');
        item.className = 'calendar-list-item';

        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = cal.visible;
        checkbox.style.accentColor = displayColor(cal.color);
        checkbox.setAttribute('aria-label', 'Show ' + cal.name);
        checkbox.addEventListener('change', function () {
            cal.visible = checkbox.checked;
            applyCalendarVisibility();
            renderTaskList();
        });

        let name = document.createElement('span');
        name.className = 'calendar-list-name';
        name.textContent = cal.name;
        name.title = cal.name;

        item.appendChild(checkbox);
        item.appendChild(name);

        if (cal.readOnly) {
            let badge = document.createElement('span');
            badge.className = 'calendar-readonly-badge';
            badge.title = 'Shared with you (read-only)';
            badge.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6"/><path d="M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0"/><path d="M8 11v-4a4 4 0 1 1 8 0v4"/></svg>';
            item.appendChild(badge);
        }

        // Menu is always shown (Export is read-only); Edit/Share/Delete
        // are added below only when this specific calendar is writable.
        let menuButton = document.createElement('button');
        menuButton.type = 'button';
        menuButton.className = 'calendar-menu-button';
        menuButton.setAttribute('aria-label', cal.name + ' calendar options');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.title = 'Options';
        menuButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M11 19a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/><path d="M11 5a1 1 0 1 0 2 0a1 1 0 1 0 -2 0"/></svg>';

        let menu = document.createElement('div');
        menu.className = 'calendar-menu';

        if (isCalendarWritable(cal.id)) {
            let editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4"/><path d="M13.5 6.5l4 4"/></svg> Edit';
            editBtn.addEventListener('click', function () {
                closeAllCalendarMenus();
                closeSidebar();
                openCalendarModal('edit', cal);
            });
            menu.appendChild(editBtn);

        }

        // No Share for the primary calendar (not shared) or a read-only
        // one (can't re-share access you don't own).
        if (isCalendarWritable(cal.id) && !cal.primary) {
            let shareBtn = document.createElement('button');
            shareBtn.type = 'button';
            shareBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M15 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M8.7 10.7l6.6 -3.4"/><path d="M8.7 13.3l6.6 3.4"/></svg> Share';
            shareBtn.addEventListener('click', function () {
                closeAllCalendarMenus();
                closeSidebar();
                openShareModal({ target: 'calendar', calendarName: cal.name }, cal.name, 'calendar');
            });
            menu.appendChild(shareBtn);
        }

        let exportBtn = document.createElement('button');
        exportBtn.type = 'button';
        exportBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2"/><path d="M7 11l5 5l5 -5"/><path d="M12 4l0 12"/></svg> Export';
        exportBtn.addEventListener('click', function () {
            closeAllCalendarMenus();
            exportCalendarAsIcs(cal.id);
        });
        menu.appendChild(exportBtn);

        if (isCalendarWritable(cal.id) && !cal.primary) {
            let deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'danger';
            deleteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l16 0"/><path d="M10 11l0 6"/><path d="M14 11l0 6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/></svg> Delete';
            deleteBtn.addEventListener('click', function () {
                closeAllCalendarMenus();
                deleteCalendar(cal.id);
            });
            menu.appendChild(deleteBtn);
        }

        menuButton.addEventListener('click', function (e) {
            e.stopPropagation();
            let wasOpen = menu.classList.contains('open');
            closeAllCalendarMenus();
            if (wasOpen) return;
            menu.classList.add('open');
            menuButton.setAttribute('aria-expanded', 'true');
        });

        item.appendChild(menuButton);
        item.appendChild(menu);

        // Clicking anywhere in the row toggles visibility, not just the
        // checkbox - a bigger target for something done often.
        // menuButton's own handler already stops its clicks reaching
        // here; .calendar-menu's buttons don't, hence the explicit guard.
        item.addEventListener('click', function (e) {
            if (e.target === checkbox) return;
            if (e.target.closest('.calendar-menu')) return;
            checkbox.checked = !checkbox.checked;
            cal.visible = checkbox.checked;
            applyCalendarVisibility();
        });

        calendarListEl.appendChild(item);
    });
}

let editingCalendarId = null;

function renderColorSwatches(selectedColor) {
    calendarColorSwatches.innerHTML = '';
    CALENDAR_COLORS.forEach(function (color) {
        let swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'color-swatch' + (color === selectedColor ? ' selected' : '');
        swatch.style.backgroundColor = displayColor(color);
        swatch.dataset.color = color;
        swatch.setAttribute('aria-label', color);
        swatch.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5l10 -10"/></svg>';
        swatch.addEventListener('click', function () {
            calendarColorSwatches.querySelectorAll('.color-swatch').forEach(function (s) { s.classList.remove('selected'); });
            swatch.classList.add('selected');
        });
        calendarColorSwatches.appendChild(swatch);
    });
}

// --- Dialogs ---
// Every modal opens and closes through this pair, which gives them the
// same keyboard behaviour as the dialogs in the rest of Peergos (web-ui's
// DialogClose component): Tab stays inside the dialog on top, and closing
// hands the keyboard back to whatever opened it. Escape is not here - it
// belongs to closeTopmostOverlay() below, which also knows about the
// popover, the menus and the mobile drawer.
let openDialogs = [];

const DIALOG_FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]),'
    + ' select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function onDialogTab(e) {
    if (e.key !== 'Tab' || openDialogs.length === 0) return;
    let dialog = openDialogs[openDialogs.length - 1].dialog;
    // getClientRects() drops the fields the form hides for the current
    // shape of the event (the repeat details, the all-day times).
    let items = Array.prototype.filter.call(dialog.querySelectorAll(DIALOG_FOCUSABLE),
        function (el) { return el.getClientRects().length > 0; });
    if (items.length === 0) return;
    let edge = e.shiftKey ? items[0] : items[items.length - 1];
    if (document.activeElement === edge || !dialog.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
    }
}

function openDialog(backdrop, initialFocus) {
    // Opening one that is already up - a second import summary arriving from
    // the host, say - must not stack a second entry, or the one close would
    // leave it on the list and the trap armed over a hidden dialog.
    if (backdrop.classList.contains('open')) return;
    let dialog = backdrop.querySelector('.event-modal');
    if (openDialogs.length === 0) document.addEventListener('keydown', onDialogTab, true);
    openDialogs.push({ backdrop: backdrop, dialog: dialog, opener: document.activeElement });
    backdrop.classList.add('open');
    // Focus lands on the first field where there is one to fill in, and on
    // the dialog itself otherwise - either way inside it, so the keyboard
    // is useful straight away and screen readers announce the dialog.
    (initialFocus || dialog).focus();
}

function closeDialog(backdrop) {
    backdrop.classList.remove('open');
    let at = openDialogs.findIndex(function (d) { return d.backdrop === backdrop; });
    if (at === -1) return;
    let opener = openDialogs[at].opener;
    openDialogs.splice(at, 1);
    if (openDialogs.length === 0) document.removeEventListener('keydown', onDialogTab, true);
    if (opener != null && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    // A dialog is hidden on close, not removed, so focus can still be sitting
    // inside it - when there was nothing focusable to go back to (opened from
    // a menu that has since closed, say), hand it to the document instead of
    // leaving it on markup nobody can see.
    if (document.activeElement != null && backdrop.contains(document.activeElement))
        document.activeElement.blur();
}

function openCalendarModal(mode, cal) {
    editingCalendarId = mode === 'edit' ? cal.id : null;
    calendarModalHeading.textContent = mode === 'edit' ? 'Edit calendar' : 'New calendar';
    calendarNameInput.value = mode === 'edit' ? cal.name : '';
    renderColorSwatches(mode === 'edit' ? cal.color : nextUnusedCalendarColor());
    calendarDeleteButton.style.display = (mode === 'edit' && !cal.primary) ? '' : 'none';
    // Opened from inside the sidebar, which on mobile is a drawer with a
    // higher z-index than the modal - it would otherwise stay open on top
    // of it. No-op on desktop (never .open).
    closeSidebar();
    openDialog(calendarModalBackdrop, calendarNameInput);
}

function closeCalendarModal() {
    closeDialog(calendarModalBackdrop);
    editingCalendarId = null;
}

// Generic confirm dialog, not scoped to calendar deletion specifically.
let pendingConfirmAction = null;

function openConfirmModal(message, onConfirm) {
    confirmModalMessage.textContent = message;
    pendingConfirmAction = onConfirm;
    openDialog(confirmModalBackdrop);
}

function closeConfirmModal() {
    closeDialog(confirmModalBackdrop);
    pendingConfirmAction = null;
}

// Purely informational (no onConfirm/Cancel) - openConfirmModal()'s OK
// button is styled for a destructive action, doesn't fit here.
function openImportSummaryModal(message) {
    importSummaryMessage.textContent = message;
    openDialog(importSummaryModalBackdrop);
}

function closeImportSummaryModal() {
    closeDialog(importSummaryModalBackdrop);
}


// --- Sharing ---
// The host owns every privileged step (resolving the stored file, calling
// Peergos' share primitives, minting a secret link); this only renders
// whatever state it reports back, never an optimistic local guess.
// `writeUsers` is the subset of `users` holding write access, so an
// existing share renders at the level it was actually granted.
let shareTarget = null;
let shareState = { users: [], writeUsers: [], secretLink: null };

// The modal asks for share state when it opens and again after every
// mutation, so replies can be in flight at once and can land out of order.
// Each request carries an id the host echoes back; anything that isn't the
// reply to the newest request is stale and ignored outright. Counting
// replies is not enough - a slow modal-open reply arriving after a click
// would otherwise lift the spinner and paint a modal with no link in it.
let shareRequestSeq = 0;
let latestShareRequest = null;

function sendShareRequest(message, isMutation) {
    shareRequestSeq++;
    latestShareRequest = { id: shareRequestSeq, isMutation: !!isMutation };
    hostSend(Object.assign({ requestId: shareRequestSeq }, message, shareTarget));
}

function sendShareMutation(message) {
    sendShareRequest(message, true);
}

// A mutation's reply is the only thing that lifts the spinner the host raised
// for it, so any path that stops waiting for that reply has to lift it here
// instead. Closing the modal mid-flight is reachable: the host's spinner
// covers the page but not this frame's keyboard focus, so Escape still lands
// here - and the reply would then be dropped, leaving the host under a
// spinner nothing ever clears.
function releasePendingShareRequest() {
    if (latestShareRequest && latestShareRequest.isMutation) hostSend({ type: 'removeSpinner' });
    latestShareRequest = null;
}

// Shared by each user row and the secret link row - a <select> instead
// of a static badge so an existing share's access can be changed in
// place, not just set once when it's created.
function createAccessSelect(label, canEdit, onChange) {
    let select = document.createElement('select');
    select.setAttribute('aria-label', label);
    [['view', 'Can view'], ['edit', 'Can edit']].forEach(function (pair) {
        let option = document.createElement('option');
        option.value = pair[0];
        option.textContent = pair[1];
        select.appendChild(option);
    });
    select.value = canEdit ? 'edit' : 'view';
    select.addEventListener('change', function () { onChange(select.value === 'edit'); });
    return select;
}

function renderShareUserList() {
    shareUserList.innerHTML = '';
    if (!shareState.users.length) {
        let empty = document.createElement('div');
        empty.className = 'share-empty';
        empty.textContent = 'Not shared with anyone yet.';
        shareUserList.appendChild(empty);
        return;
    }
    shareState.users.forEach(function (username) {
        let row = document.createElement('div');
        row.className = 'share-user-row';
        let name = document.createElement('span');
        name.className = 'share-username';
        name.textContent = username;
        name.title = username;
        row.appendChild(name);
        let hasWriteAccess = shareState.writeUsers.indexOf(username) !== -1;
        row.appendChild(createAccessSelect('Access for ' + username, hasWriteAccess, function (canEdit) {
            sendShareMutation({ action: 'shareAddUser', username: username, access: canEdit ? 'edit' : 'view' });
        }));
        let removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.setAttribute('aria-label', 'Remove ' + username);
        removeBtn.title = 'Remove access';
        removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg>';
        removeBtn.addEventListener('click', function () {
            sendShareMutation({ action: 'shareRemoveUser', username: username });
        });
        row.appendChild(removeBtn);
        shareUserList.appendChild(row);
    });
}

function renderShareLinkUI() {
    shareLinkRow.classList.toggle('open', !!shareState.secretLink);
    shareCreateLinkButton.style.display = shareState.secretLink ? 'none' : '';
    if (shareState.secretLink) shareLinkInput.value = shareState.secretLink;
}

function openShareModal(target, displayName, kind) {
    shareTarget = target;
    shareState = { users: [], writeUsers: [], secretLink: null };
    releasePendingShareRequest();
    // Real elements, not innerHTML (displayName is user-entered text) -
    // only the name itself truncates, "Share"/kind stay fully visible.
    shareModalHeading.innerHTML = '';
    let prefix = document.createElement('span');
    prefix.className = 'share-modal-fixed';
    prefix.textContent = 'Share "';
    let nameSpan = document.createElement('span');
    nameSpan.className = 'share-modal-name';
    nameSpan.textContent = displayName;
    let suffix = document.createElement('span');
    suffix.className = 'share-modal-fixed';
    suffix.textContent = '" ' + kind;
    shareModalHeading.appendChild(prefix);
    shareModalHeading.appendChild(nameSpan);
    shareModalHeading.appendChild(suffix);
    shareUsernameInput.value = '';
    shareAccessSelect.value = 'view';
    renderShareUserList();
    renderShareLinkUI();
    closeSidebar();
    openDialog(shareModalBackdrop);
    sendShareRequest({ action: 'shareStateRequest' }, false);
}

function closeShareModal() {
    closeDialog(shareModalBackdrop);
    shareTarget = null;
    releasePendingShareRequest();
}

// Sole entry point for share state - the host is authoritative, so the
// list is never updated optimistically from a click.
function respondToShareState(data) {
    if (!shareTarget) return;
    // Stale reply from an earlier request - a newer one is still coming.
    if (!latestShareRequest || data.requestId !== latestShareRequest.id) return;
    let wasMutation = latestShareRequest.isMutation;
    latestShareRequest = null;
    shareState = { users: data.users || [], writeUsers: data.writeUsers || [], secretLink: data.secretLink || null };
    renderShareUserList();
    renderShareLinkUI();
    // Painted - lift the spinner this very mutation raised, not another's.
    if (wasMutation) hostSend({ type: 'removeSpinner' });
}

shareAddButton.addEventListener('click', function () {
    let username = shareUsernameInput.value.trim();
    if (!username || !shareTarget) return;
    shareUsernameInput.value = '';
    sendShareMutation({ action: 'shareAddUser', username: username, access: shareAccessSelect.value });
});

shareUsernameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        shareAddButton.click();
    }
});

shareCreateLinkButton.addEventListener('click', function () {
    if (shareTarget) sendShareMutation({ action: 'shareCreateLink', access: shareLinkAccessSelect.value });
});

shareLinkCopyButton.addEventListener('click', function () {
    copyText(shareLinkInput.value);
    showToast('Link copied');
});

shareLinkRevokeButton.addEventListener('click', function () {
    if (shareTarget) sendShareMutation({ action: 'shareRevokeLink' });
});

// Re-mints the existing link at the newly chosen access level. Goes through
// sendShareMutation like every other mutation: a bare hostSend carries no
// requestId, so the host's reply would be discarded as stale and the spinner
// the host raised for it would never be lifted.
shareLinkAccessSelect.addEventListener('change', function () {
    if (shareTarget && shareState.secretLink) {
        sendShareMutation({ action: 'shareCreateLink', access: shareLinkAccessSelect.value });
    }
});

shareCloseButton.addEventListener('click', closeShareModal);

shareModalBackdrop.addEventListener('click', function (e) {
    if (e.target === shareModalBackdrop) closeShareModal();
});

// Deleting an event is irreversible and one tap away, so it always asks
// first - same in-app dialog the calendar delete uses.
function confirmDeleteEvent(ev, onConfirm) {
    let title = ev.title ? '"' + ev.title + '"' : 'this event';
    openConfirmModal('Delete ' + title + '? This cannot be undone.', onConfirm);
}

function performScopedDelete(ev, scope) {
    if (scope === 'this' && ev.extendedProps.recur) {
        excludeOccurrenceFromMaster(ev);
    } else if (scope === 'following' && ev.extendedProps.recur) {
        truncateMasterSeries(ev);
    } else {
        removeAndPersist(ev);
    }
}

// A tap isn't over when the handler that opens the modal runs: for touch,
// dateClick fires on touchend and the browser still has that gesture's
// trailing mousedown/mouseup/click to deliver. Those hit-test against
// whatever now sits under the point that was tapped - on a phone the
// modal covers the screen, so it's usually one of its <select>s, which
// pops its native dropdown with the user never having touched it.
//
// The trailing events are recognised by point and time and cancelled
// here. Deliberately nothing more: the triggering gesture's own events
// are left alone (FullCalendar is still mid-gesture on them), and so is
// the modal's hit-testing - taking the modal out of hit-testing instead
// only sends the trailing click through to the backdrop, whose
// click-outside listener then closes the modal that just opened.
let TAP_TAIL_MS = 400;
let TAP_TAIL_RADIUS = 32;
let lastPointerPoint = { x: 0, y: 0, time: 0 };
let modalTapGuard = { x: 0, y: 0, time: 0 };

function recordPointerPoint(e) {
    let p = e.changedTouches ? e.changedTouches[0] : e;
    if (p) lastPointerPoint = { x: p.clientX, y: p.clientY, time: Date.now() };
}

// Passive: these only read the gesture, they can't cancel any part of it.
['pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(function (type) {
    document.addEventListener(type, recordPointerPoint, { capture: true, passive: true });
});

// Arms only when the modal is opening out of a gesture still in flight -
// a modal opened from the keyboard has no trailing events to guard against.
function armModalTapGuard() {
    let now = Date.now();
    modalTapGuard = (now - lastPointerPoint.time <= TAP_TAIL_MS)
        ? { x: lastPointerPoint.x, y: lastPointerPoint.y, time: now }
        : { x: 0, y: 0, time: 0 };
}

function isModalTapTail(e) {
    if (!modalTapGuard.time || Date.now() - modalTapGuard.time > TAP_TAIL_MS) return false;
    // A keyboard-triggered click reports no click count and (0, 0).
    if (e.type === 'click' && !e.detail) return false;
    if (!modalBackdrop.classList.contains('open') || !modalBackdrop.contains(e.target)) return false;
    let dx = e.clientX - modalTapGuard.x;
    let dy = e.clientY - modalTapGuard.y;
    return dx * dx + dy * dy <= TAP_TAIL_RADIUS * TAP_TAIL_RADIUS;
}

['pointerdown', 'mousedown', 'mouseup', 'click'].forEach(function (type) {
    document.addEventListener(type, function (e) {
        if (!isModalTapTail(e)) return;
        e.preventDefault();
        e.stopPropagation();
    }, true);
});

// Backstop for browsers that open a dropdown off the tap itself rather
// than off a cancellable mouse event: nothing else focuses a select this
// soon after the modal opens, so this focus is always the stray tap.
document.addEventListener('focusin', function (e) {
    if (!modalTapGuard.time || Date.now() - modalTapGuard.time > TAP_TAIL_MS) return;
    if (e.target.tagName !== 'SELECT' || !modalBackdrop.contains(e.target)) return;
    e.target.blur();
    titleInput.focus();
}, true);

function openModal(mode, opts) {
    editingEvent = mode === 'edit' ? opts.event : null;
    editScope = opts.scope || 'all';
    modalHeading.textContent = mode === 'edit' ? 'Edit event' : (opts.prefill ? 'Duplicate event' : 'New event');

    let targetCalendarId = mode === 'edit' ? opts.event.extendedProps.calendarId
        : ((opts.prefill && opts.prefill.calendarId) || defaultCalendarId());
    let writable = isCalendarWritable(targetCalendarId);
    editableFields.forEach(el => el.disabled = !writable);
    saveButton.style.display = writable ? '' : 'none';
    saveButton.disabled = !writable;
    deleteButton.style.display = (writable && mode === 'edit') ? '' : 'none';
    deleteButton.disabled = !writable;
    cancelButton.textContent = writable ? 'Cancel' : 'Close';

    let start, end, allDay, recur;
    if (mode === 'edit') {
        let ev = opts.event;
        titleInput.value = ev.title;
        allDay = ev.allDay;
        let masterRecur = ev.extendedProps.recur || null;

        if (masterRecur && editScope === 'all') {
            let range = seriesFormRange(ev, masterRecur, allDay);
            start = range.start;
            end = range.end;
            recur = masterRecur;
        } else if (masterRecur && editScope === 'following') {
            start = ev.start;
            end = toFormEnd(ev.end || ev.start, allDay);
            recur = adjustRecurForFollowing(ev, masterRecur, allDay);
        } else {
            // editScope === 'this', or a plain non-recurring event
            start = ev.start;
            end = toFormEnd(ev.end || ev.start, allDay);
            recur = null;
        }

        locationInput.value = ev.extendedProps.location || '';
        statusInput.value = ev.extendedProps.status || 'active';
        descriptionInput.value = ev.extendedProps.description || '';
        renderCalendarSelectOptions(ev.extendedProps.calendarId);
    } else {
        let prefill = opts.prefill || {};
        titleInput.value = prefill.title || '';
        allDay = opts.allDay || false;
        start = opts.date;
        // opts.endDate is exclusive, same as ev.end - needs the same
        // toFormEnd() conversion.
        end = toFormEnd(opts.endDate, allDay);
        locationInput.value = prefill.location || '';
        statusInput.value = prefill.status || 'active';
        descriptionInput.value = prefill.description || '';
        recur = null;
        renderCalendarSelectOptions(prefill.calendarId);
    }

    allDayInput.checked = allDay;
    setInputMode(allDay);
    startDateInput.value = toDateInputValue(start);
    startTimeInput.value = allDay ? '09:00' : toTimeInputValue(start);
    endDateInput.value = toDateInputValue(end);
    endTimeInput.value = allDay ? '10:00' : toTimeInputValue(end);
    populateRecurForm(recur);
    // editing a single split-off occurrence can't independently repeat
    repeatSection.style.display = (editScope === 'this') ? 'none' : '';

    armModalTapGuard();
    openDialog(modalBackdrop, titleInput);
}

function closeModal() {
    closeDialog(modalBackdrop);
    editingEvent = null;
    editScope = 'all';
    calendar.unselect();
}

function openScopeModal(ev, action) {
    pendingScopeEvent = ev;
    pendingScopeAction = action;
    scopeSubtitle.textContent = 'Which events would you like to ' + (action === 'delete' ? 'delete' : 'change') + '?';
    document.querySelector('input[name="scope"][value="this"]').checked = true;
    openDialog(scopeModalBackdrop);
}

function closeScopeModal() {
    pendingScopeEvent = null;
    closeDialog(scopeModalBackdrop);
}

allDayInput.addEventListener('change', function () {
    setInputMode(allDayInput.checked);
});

repeatFreqInput.addEventListener('change', updateRepeatVisibility);
repeatEndInput.addEventListener('change', updateRepeatVisibility);

weekdayToggleButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
        btn.classList.toggle('selected');
    });
});

// Keeps "Monthly on the 3rd Tuesday" (computed from the start date, not
// a fixed string) in sync if the date changes while the modal is open.
startDateInput.addEventListener('change', function () {
    if (repeatFreqInput.value === 'monthly') updateMonthlyModeLabels();
});

cancelButton.addEventListener('click', closeModal);

modalBackdrop.addEventListener('click', function (e) {
    if (e.target === modalBackdrop) closeModal();
});

scopeConfirmButton.addEventListener('click', function () {
    let ev = pendingScopeEvent;
    let action = pendingScopeAction;
    let chosen = document.querySelector('input[name="scope"]:checked');
    let scope = chosen ? chosen.value : 'this';
    closeScopeModal();
    if (action === 'delete') {
        performScopedDelete(ev, scope);
    } else {
        openModal('edit', { event: ev, scope: scope });
    }
});
scopeCancelButton.addEventListener('click', closeScopeModal);
scopeModalBackdrop.addEventListener('click', function (e) {
    if (e.target === scopeModalBackdrop) closeScopeModal();
});

popoverCloseButton.addEventListener('click', hideEventPopover);

// Shared by the popover's Edit button and double-clicking an event
// directly - both should go through the same recurring-scope prompt.
function openEditFor(ev) {
    if (isCalendarWritable(ev.extendedProps.calendarId) && ev.extendedProps.recur) {
        openScopeModal(ev, 'edit');
    } else {
        openModal('edit', { event: ev, scope: 'all' });
    }
}

popoverEditButton.addEventListener('click', function () {
    let ev = popoverEvent;
    hideEventPopover();
    openEditFor(ev);
});

popoverDeleteButton.addEventListener('click', function () {
    let ev = popoverEvent;
    // Defensive backstop - button is already absent when not writable.
    if (!isCalendarWritable(ev.extendedProps.calendarId)) return;
    hideEventPopover();
    if (ev.extendedProps.recur) {
        openScopeModal(ev, 'delete');
    } else {
        confirmDeleteEvent(ev, function () { removeAndPersist(ev); });
    }
});

// Duplicates just the clicked occurrence as a standalone non-recurring
// event, even for a recurring series.
popoverDuplicateButton.addEventListener('click', function () {
    let ev = popoverEvent;
    hideEventPopover();
    openModal('create', {
        date: ev.start,
        endDate: ev.end || ev.start,
        allDay: ev.allDay,
        prefill: {
            title: ev.title,
            location: ev.extendedProps.location,
            status: ev.extendedProps.status,
            description: ev.extendedProps.description,
            calendarId: ev.extendedProps.calendarId
        }
    });
});

// Export and email both cross to the host: it owns the stored file, the
// Android download bridge and the Peergos Email app. Share crosses for the
// same reason - Peergos' share primitives live there.
popoverExportButton.addEventListener('click', function () {
    exportEventAsIcs(popoverEvent);
    hideEventPopover();
});

popoverEmailButton.addEventListener('click', function () {
    emailEvent(popoverEvent);
    hideEventPopover();
});

popoverShareButton.addEventListener('click', function () {
    let ev = popoverEvent;
    hideEventPopover();
    openShareModal(Object.assign({ target: 'event' }, hostEventRef(ev)), ev.title, 'event');
});

// Defaults to real "now", not whatever date happens to be in view -
// matches other calendar apps' always-visible create button.
// The one "new" control in the app has to offer both kinds of thing now -
// creating a task from the sidebar only is a dead end for anyone who
// reaches for the + first.
toolbarAddButton.addEventListener('click', function () {
    let wasOpen = addMenu.classList.contains('open');
    closeAllCalendarMenus();
    if (wasOpen) return;
    addMenu.classList.add('open');
    toolbarAddButton.setAttribute('aria-expanded', 'true');
});

addMenuEventButton.addEventListener('click', function () {
    closeAllCalendarMenus();
    let now = new Date();
    openModal('create', { date: now, endDate: new Date(now.getTime() + 3600000), allDay: false });
});

addMenuTaskButton.addEventListener('click', function () {
    closeAllCalendarMenus();
    openTaskModal('create', null);
});

// Month <select> (hardcoded English names) + a plain year number input,
// not a year <select> (would need an arbitrary min/max cap) or a native
// date input (renders/positions inconsistently across browsers).
let MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
MONTH_NAMES.forEach(function (name, i) {
    let option = document.createElement('option');
    option.value = i;
    option.textContent = name;
    gotoDateMonthInput.appendChild(option);
});

function openGotoDatePicker(anchorEl) {
    let current = calendar.getDate();
    gotoDateMonthInput.value = current.getMonth();
    gotoDateYearInput.value = current.getFullYear();
    gotoDateMenu.classList.add('open');
    anchorEl.setAttribute('aria-expanded', 'true');
    // Below MOBILE_BREAKPOINT it's a full-width bottom sheet (CSS media
    // query) instead of anchored under the title - clear any inline
    // position left over from a wider-window open so the CSS rules
    // apply cleanly.
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
        gotoDateMenu.style.left = '';
        gotoDateMenu.style.top = '';
        return;
    }
    // Width isn't known until rendered with real content, hence
    // measuring only after .open above.
    let rect = anchorEl.getBoundingClientRect();
    let menuWidth = gotoDateMenu.getBoundingClientRect().width;
    let margin = 8;
    let desiredLeft = rect.left + rect.width / 2 - menuWidth / 2;
    gotoDateMenu.style.left = Math.max(margin, Math.min(desiredLeft, window.innerWidth - margin - menuWidth)) + 'px';
    gotoDateMenu.style.top = rect.bottom + 'px';
}

// Preserves the currently-viewed day-of-month where possible, clamped to
// however many days the target month actually has (Jan 31 -> Feb 28/29,
// not an overflow into March).
function navigateToSelectedMonthYear() {
    let year = parseInt(gotoDateYearInput.value, 10);
    if (!year) return; // empty/cleared year field - not a real value yet
    let month = parseInt(gotoDateMonthInput.value, 10);
    let day = Math.min(calendar.getDate().getDate(), new Date(year, month + 1, 0).getDate());
    gotoDateWithTransition(new Date(year, month, day));
}

gotoDateMonthInput.addEventListener('change', navigateToSelectedMonthYear);
gotoDateYearInput.addEventListener('change', navigateToSelectedMonthYear);

// 'change' alone (fires on blur) isn't enough on mobile - a numeric
// keyboard often has no Enter/Done key to trigger it. Debounced 'input'
// navigates automatically instead, but only once 4 digits are in -
// otherwise "1" or "20" would jump to year 1 or 20 mid-type.
let gotoDateYearInputTimer = null;
gotoDateYearInput.addEventListener('input', function () {
    clearTimeout(gotoDateYearInputTimer);
    if (gotoDateYearInput.value.length !== 4) return;
    gotoDateYearInputTimer = setTimeout(navigateToSelectedMonthYear, 600);
});

function stepGotoDateYear(delta) {
    let year = (parseInt(gotoDateYearInput.value, 10) || calendar.getDate().getFullYear()) + delta;
    gotoDateYearInput.value = Math.max(1, Math.min(9999, year));
    navigateToSelectedMonthYear();
}

// Explicit +/- buttons instead of relying on the year field's own
// native spinner arrows - those are notoriously tiny/unreliable to tap
// on a touch screen.
gotoDateYearDownButton.addEventListener('click', function () { stepGotoDateYear(-1); });
gotoDateYearUpButton.addEventListener('click', function () { stepGotoDateYear(1); });

overflowMenuButton.addEventListener('click', function () {
    let wasOpen = overflowMenu.classList.contains('open');
    closeAllCalendarMenus();
    if (wasOpen) return;
    overflowMenu.classList.add('open');
    overflowMenuButton.setAttribute('aria-expanded', 'true');
});

overflowImportButton.addEventListener('click', function () {
    overflowMenu.classList.remove('open');
    icsFileInput.click();
});

overflowMenuVersion.textContent = 'FullCalendar v' + FullCalendar.version;

function formatImportSummary(imported, importedTasks, duplicates, failed, simplified) {
    if (imported === 0 && importedTasks === 0 && duplicates === 0 && failed === 0)
        return 'No events or tasks found in this file.';
    let parts = [];
    if (imported > 0 || importedTasks === 0)
        parts.push(imported === 1 ? 'Imported 1 event.' : 'Imported ' + imported + ' events.');
    if (importedTasks > 0)
        parts.push(importedTasks === 1 ? 'Imported 1 task.' : 'Imported ' + importedTasks + ' tasks.');
    if (duplicates > 0) parts.push(duplicates === 1 ? '1 already existed and was skipped.' : duplicates + ' already existed and were skipped.');
    if (failed > 0) parts.push(failed === 1 ? '1 could not be read and was skipped.' : failed + ' could not be read and were skipped.');
    // Recurrence with BY* parts this app's UI can't represent (see
    // parseIcsRRuleValue) still imports, but on a plain repeat - worth
    // saying so, since the occurrence dates can then differ from the
    // source file.
    if (simplified > 0) parts.push(simplified === 1 ? '1 event had its recurrence simplified - some repeat options aren\'t supported.' : simplified + ' events had their recurrence simplified - some repeat options aren\'t supported.');
    return parts.join(' ');
}

// Shared by the in-app file picker and by the host handing over an .ics
// the user opened from their Peergos files.
function importIcsText(text) {
    // Otherwise a wrong-file-type pick reads as a misleading "0 events".
    if (!text || text.indexOf('BEGIN:VCALENDAR') === -1) {
        openImportSummaryModal("This doesn't look like a valid .ics calendar file.");
        return;
    }
    let parsed = parseIcsFile(text);
    let imported = 0;
    let duplicates = 0;
    let simplified = 0;
    // Collected and written in one message rather than one per item: a file
    // with hundreds of events would otherwise be hundreds of round trips to
    // the host, each its own write, with nothing on screen but a spinner.
    let batch = [];
    parsed.events.forEach(function (data) {
        let wasSimplified = !!data.__recurSimplified;
        delete data.__recurSimplified;
        if (calendar.getEventById(data.id)) {
            duplicates++;
            return;
        }
        let ev = calendar.addEvent(data);
        if (!ev) return;
        let placement = placementOf(ev);
        eventPlacements[ev.id] = placement;
        batch.push(eventSavePayload(ev, placement));
        imported++;
        if (wasSimplified) simplified++;
    });
    let importedTasks = 0;
    parsed.tasks.forEach(function (task) {
        if (getTaskById(task.id)) {
            duplicates++;
            return;
        }
        let calendarId = defaultCalendarId();
        if (!calendarId) return;
        task.calendarId = calendarId;
        tasks.push(task);
        taskCalendars[task.id] = calendarId;
        batch.push(taskSavePayload(task));
        syncTaskEvent(task);
        importedTasks++;
    });
    if (importedTasks > 0) renderTaskList();
    if (batch.length > 0 && !isGuestSession) hostSend({ type: 'saveAll', items: batch });
    if (imported > 0 || importedTasks > 0) applyCalendarVisibility();
    openImportSummaryModal(formatImportSummary(imported, importedTasks, duplicates, parsed.failed, simplified));
}

icsFileInput.addEventListener('change', function () {
    let file = icsFileInput.files[0];
    if (!file) return;
    let reader = new FileReader();
    reader.onload = function () {
        icsFileInput.value = '';
        importIcsText(reader.result);
    };
    reader.onerror = function () {
        icsFileInput.value = '';
        openImportSummaryModal('Could not read that file.');
    };
    reader.readAsText(file);
});

// Always visible, not a click-to-open trigger. Clicking the search
// button just focuses the input - results already render live.
searchButton.addEventListener('click', function () {
    searchInput.focus();
});

searchInput.addEventListener('input', function () {
    searchClearButton.classList.toggle('visible', searchInput.value.length > 0);
    renderSearchResults(searchInput.value);
});

// Re-opens the dropdown when refocusing an already-typed query.
searchInput.addEventListener('focus', function () {
    if (searchInput.value.trim()) renderSearchResults(searchInput.value);
});

searchClearButton.addEventListener('click', function () {
    clearSearch();
    searchInput.focus();
});

// Below MOBILE_BREAKPOINT (matches calendar.css's `@media (max-width:
// 700px)`), sidebar is an off-canvas drawer; above it, a collapsing column.
let MOBILE_BREAKPOINT = 700;

sidebarToggleButton.addEventListener('click', function () {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
        sidebar.classList.toggle('open');
        sidebarBackdrop.classList.toggle('open');
    } else {
        sidebar.classList.toggle('collapsed');
    }
});

sidebarBackdrop.addEventListener('click', closeSidebar);

addCalendarButton.addEventListener('click', function () {
    openCalendarModal('create', null);
});

calendarForm.addEventListener('submit', function (e) {
    e.preventDefault();
    let name = calendarNameInput.value.trim();
    if (!name) return;
    let selectedSwatch = calendarColorSwatches.querySelector('.color-swatch.selected');
    let color = selectedSwatch ? selectedSwatch.dataset.color : CALENDAR_COLORS[0];
    if (editingCalendarId) {
        let cal = getCalendarById(editingCalendarId);
        if (cal && cal.color !== color) requestCalendarColorChange(cal, color);
        if (cal && cal.name !== name) requestRenameCalendar(cal, name);
    } else {
        requestAddCalendar(name, color);
    }
    closeCalendarModal();
});

calendarDeleteButton.addEventListener('click', function () {
    if (!editingCalendarId) return;
    let id = editingCalendarId;
    closeCalendarModal();
    deleteCalendar(id);
});

calendarCancelButton.addEventListener('click', closeCalendarModal);

calendarModalBackdrop.addEventListener('click', function (e) {
    if (e.target === calendarModalBackdrop) closeCalendarModal();
});

confirmOkButton.addEventListener('click', function () {
    let action = pendingConfirmAction;
    closeConfirmModal();
    if (action) action();
});

confirmCancelButton.addEventListener('click', closeConfirmModal);

confirmModalBackdrop.addEventListener('click', function (e) {
    if (e.target === confirmModalBackdrop) closeConfirmModal();
});

importSummaryOkButton.addEventListener('click', closeImportSummaryModal);

importSummaryModalBackdrop.addEventListener('click', function (e) {
    if (e.target === importSummaryModalBackdrop) closeImportSummaryModal();
});

// Closes an open calendar "..." menu on any click outside it. Capture
// phase, not bubble: eventClick's stopPropagation() would otherwise hide
// clicks on events from a bubble-phase listener here.
let MENU_INTERNAL_SELECTOR = '.calendar-menu button, .calendar-menu-button, #overflow-menu-button, #toolbar-add-button, #overflow-menu-version, #goto-date-menu, .goto-date-trigger';
document.addEventListener('click', function (e) {
    if (!e.target.closest(MENU_INTERNAL_SELECTOR)) closeAllCalendarMenus();
}, true);

// Closes the search results dropdown on any click outside #search-bar.
// Capture phase, same stopPropagation() reasoning as above.
document.addEventListener('click', function (e) {
    if (!searchBar.contains(e.target)) closeSearchResults();
}, true);

// Clicking outside the popover closes it without swallowing the click -
// whatever's underneath (another event, a day cell, a toolbar button)
// still fires in the same click, same as menus/search/the date picker.
document.addEventListener('click', function (e) {
    if (popover.classList.contains('open') && !popover.contains(e.target)) {
        hideEventPopover();
    }
}, true);

// The mobile drawer is two elements moving together (#sidebar itself
// slides in via its own .open, #sidebar-backdrop dims behind it) -
// closing only one leaves the drawer visually stuck open.
function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarBackdrop.classList.remove('open');
}

// Shared by Escape and the Android back button below - closes whichever
// overlay is currently on top, most-specific first.
function closeTopmostOverlay() {
    if (confirmModalBackdrop.classList.contains('open')) closeConfirmModal();
    else if (importSummaryModalBackdrop.classList.contains('open')) closeImportSummaryModal();
    else if (modalBackdrop.classList.contains('open')) closeModal();
    else if (taskModalBackdrop.classList.contains('open')) closeTaskModal();
    else if (emailChoiceBackdrop.classList.contains('open')) closeEmailChoice();
    else if (scopeModalBackdrop.classList.contains('open')) closeScopeModal();
    else if (calendarModalBackdrop.classList.contains('open')) closeCalendarModal();
    else if (popover.classList.contains('open')) hideEventPopover();
    else if (shareModalBackdrop.classList.contains('open')) closeShareModal();
    else if (searchResults.classList.contains('open')) closeSearchResults();
    else if (document.querySelector('.calendar-menu.open')) closeAllCalendarMenus();
    else if (sidebarBackdrop.classList.contains('open')) closeSidebar();
}

document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeTopmostOverlay();
});

// Each dialog's close control. They dismiss the same thing Escape does -
// a dialog only shows its own control while it is the one on top.
document.querySelectorAll('[data-close-dialog]').forEach(function (button) {
    button.addEventListener('click', closeTopmostOverlay);
});

// The Android host app's MainActivity handles the hardware/gesture back
// button as webView.canGoBack() ? webView.goBack() : super.onBackPressed()
// - goBack() unwinds same-document history.pushState() entries as a
// popstate here without leaving the page, only falling through to
// actually exiting once there are none left. So: push one entry the
// moment any overlay opens, and have popstate close that overlay instead
// of letting the "navigation" happen. There's no single choke point
// where every overlay opens (each sets its own .open class from its own
// call site), so a MutationObserver arms this reactively rather than
// hooking every open*() function individually.
function anyOverlayOpen() {
    return !!document.querySelector('.event-modal-backdrop.open, .calendar-menu.open, #event-popover.open, #search-results.open, #sidebar-backdrop.open');
}

// history.state itself is the "armed" flag, not a hand-tracked variable -
// overlays also close via Escape/buttons/backdrop clicks, none of which
// touch history, so a separate boolean would go stale the moment one of
// those paths ran and desync from where we actually are in history.
function armOverlayBackHandling() {
    if (history.state && history.state.calendarOverlay) return;
    history.pushState({ calendarOverlay: true }, '');
}

new MutationObserver(function () {
    if (anyOverlayOpen()) armOverlayBackHandling();
}).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });

// Same idea as the overlay guard above, for the root/idle state. A page
// can't force its own hosting Activity to exit (no web API for that), so
// this can only react to a back press that has already navigated - which
// makes "confirm, then exit" a 3-press sequence (1st: toast + re-arm,
// 2nd: don't re-arm, so canGoBack() is finally false, 3rd: falls through
// to super.onBackPressed() natively). Approximate, but stays entirely
// inside this app; an exact 2-press version needs a native-side change.
let EXIT_CONFIRM_MS = 2000;
let toastEl = document.getElementById('toast');
let toastTimer = null;

// Everything the app does that has no visible result of its own says so
// here - a copy that leaves no trace on screen reads as a dead control.
function showToast(message, ms) {
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
        toastEl.classList.remove('visible');
        toastTimer = null;
    }, ms || 2500);
}

// execCommand on a throwaway textarea, with the async API as the fallback:
// the async one needs the embedding page to grant clipboard-write to this
// cross-origin frame and is rejected outright where it hasn't been.
function copyText(text) {
    let area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
    document.body.removeChild(area);
    if (!copied && navigator.clipboard) navigator.clipboard.writeText(text);
}
let lastIdleBackPressTime = 0;

function armExitGuard() {
    if (!(history.state && history.state.calendarRoot)) history.pushState({ calendarRoot: true }, '');
}

armExitGuard();

function handleIdleBackPress() {
    let now = Date.now();
    if (now - lastIdleBackPressTime < EXIT_CONFIRM_MS) return;
    lastIdleBackPressTime = now;
    showToast('Press back again to exit', EXIT_CONFIRM_MS);
    armExitGuard();
}

window.addEventListener('popstate', function () {
    if (!anyOverlayOpen()) {
        handleIdleBackPress();
        return;
    }
    closeTopmostOverlay();
    // Something can still be open underneath (e.g. the sidebar drawer,
    // which isn't part of the modal-priority chain above) - re-arm so
    // the next back press closes that too, instead of leaving the app
    // with it still open.
    if (anyOverlayOpen()) armOverlayBackHandling();
});

form.addEventListener('submit', function (e) {
    e.preventDefault();
    let allDay = allDayInput.checked;
    let start = allDay ? startDateInput.value : new Date(startDateInput.value + 'T' + startTimeInput.value);
    let end = fromFormEnd(allDay);
    let extra = { location: locationInput.value, status: statusInput.value, description: descriptionInput.value, calendarId: calendarSelectInput.value };
    let recur = readRecurFromForm();

    if (editingEvent && editScope === 'this' && editingEvent.extendedProps.recur) {
        excludeOccurrenceFromMaster(editingEvent);
        addAndPersist(buildPlainEventPayload(nextEventId(), titleInput.value, allDay, start, end, extra));

    } else if (editingEvent && editScope === 'following' && editingEvent.extendedProps.recur) {
        truncateMasterSeries(editingEvent);
        if (recur) {
            recur.dtstart = allDay ? startDateInput.value : (startDateInput.value + 'T' + startTimeInput.value);
            addAndPersist(buildRecurringEventPayload(nextEventId(), titleInput.value, allDay, extra, recur, computeDurationMs(start, end, allDay)));
        } else {
            addAndPersist(buildPlainEventPayload(nextEventId(), titleInput.value, allDay, start, end, extra));
        }

    } else {
        // scope 'all', a plain (non-recurring) event, or a brand-new event
        let id = editingEvent ? editingEvent.id : nextEventId();
        let data;
        if (recur) {
            recur.dtstart = allDay ? startDateInput.value : (startDateInput.value + 'T' + startTimeInput.value);
            if (editingEvent && editingEvent.extendedProps.recur) {
                recur.exdates = editingEvent.extendedProps.recur.exdates || [];
            }
            data = buildRecurringEventPayload(id, titleInput.value, allDay, extra, recur, computeDurationMs(start, end, allDay));
        } else {
            data = buildPlainEventPayload(id, titleInput.value, allDay, start, end, extra);
        }
        if (editingEvent) editingEvent.remove();
        addAndPersist(data);
    }

    applyCalendarVisibility();
    closeModal();
});

deleteButton.addEventListener('click', function () {
    if (!editingEvent) {
        closeModal();
        return;
    }
    let ev = editingEvent;
    let scope = editScope;
    closeModal();
    // A recurring series asks which occurrences instead - that choice is
    // itself the confirmation, so it isn't asked twice.
    if (ev.extendedProps.recur) {
        performScopedDelete(ev, scope);
    } else {
        confirmDeleteEvent(ev, function () { performScopedDelete(ev, scope); });
    }
});

renderCalendarList();

// eventClick fires on both clicks of a double-click - the first click's
// popover is deferred behind a short timer, a second click cancels it
// and opens edit instead. Desktop-only (see isTouchDevice).
let eventClickTimer = null;

// Day-grid time text is always e.g. "7a"/"9:30a"/"2p" - no space,
// optional minutes, single am/pm letter.
let DAY_GRID_TIME_PATTERN = /^\d{1,2}(:\d{2})?[ap]$/i;

// Fixes Breezy's day-grid (Month/Year) event rows: the time label is
// right-aligned by default instead of flush-left. Idempotent - Breezy
// re-renders this content without re-firing eventDidMount, so
// watchDayGridEventLayout() below re-applies it.
function fixDayGridEventLayout(el) {
    if (el.dataset.eventAllDay === '1') return;
    let wrapper = el.firstElementChild;
    if (!wrapper) return;
    wrapper.style.justifyContent = 'flex-start';
    let divs = Array.prototype.filter.call(wrapper.children, function (c) { return c.tagName === 'DIV'; });
    if (!divs.length) return;
    // Identified by content, not position (divs[0]/divs[1]) - Breezy can
    // render the time div alone before the title div exists, so position
    // is not a reliable way to tell the two apart.
    let timeEl = divs.length > 1 ? divs.find(function (d) { return DAY_GRID_TIME_PATTERN.test(d.textContent.trim()); }) : null;
    let titleEl = divs.find(function (d) { return d !== timeEl; });
    if (titleEl) titleEl.style.order = '2';
    if (timeEl) {
        timeEl.style.order = '1';
        // Space-based, not a fixed breakpoint - only drop the time label
        // if time+title would actually overflow the cell.
        timeEl.style.display = wrapper.scrollWidth > wrapper.clientWidth ? 'none' : '';
    }
}

// Breezy re-renders an event's inner content sometime after mount, on
// both Month and Year views and independent of any window resize (a
// synthetic resize event doesn't reliably catch it), silently undoing
// the ordering fixDayGridEventLayout() just applied - so watch for the
// re-render itself rather than guess when it happens. childList/
// characterData only, never attributes: observing our own style.order
// writes here would infinite-loop.
function watchDayGridEventLayout(el) {
    // Observes el, not el.firstElementChild - the re-render can swap the
    // wrapper div out entirely, and el is the part that stays stable
    // across it (eventDidMount doesn't re-fire).
    new MutationObserver(function () {
        fixDayGridEventLayout(el);
    }).observe(el, { childList: true, subtree: true, characterData: true });
}

let calendarEl = document.getElementById('calendar');
let calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'en',
    headerToolbar: {
        left: 'prev,today,next',
        center: 'title',
        right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay,listWeek'
    },
    // "Agenda" is the more familiar name other calendar apps use for
    // this exact view, vs. FullCalendar's generic default "list".
    // Flat listText, not a nested buttonText: { list: ... } - this
    // vendored v7 build has no such nested option (see README).
    listText: 'Agenda',
    height: '100%',
    firstDay: 1,
    weekNumbers: true,
    // Rows keep one height and a busy day gets a "+N more" that opens the
    // day - the same fallback Year already uses. Without this a single
    // four-event day stretches its whole week to twice the others.
    dayMaxEvents: true,
    navLinks: true,
    nowIndicator: true,
    // Events are added by the host bridge once Calendar.vue sends `load`.
    eventClass: function (info) {
        if (info.event.extendedProps.isTask)
            return info.event.extendedProps.completed ? 'fc-task fc-task-done' : 'fc-task';
        return info.event.extendedProps.status === 'cancelled' ? 'fc-event-cancelled' : '';
    },
    eventDidMount: function (info) {
        info.el.dataset.searchEventId = info.event.id;
        info.el.dataset.eventAllDay = info.event.allDay ? '1' : '0';
        if (info.view.type === 'dayGridMonth' || info.view.type === 'multiMonthYear') {
            fixDayGridEventLayout(info.el);
            watchDayGridEventLayout(info.el);
        }
    },
    // Marks just the Month/Year day-number link (calendar.css font-size
    // rule) - dayCellDidMount only fires for day-grid cells, unlike
    // [role="link"] alone, which also matches Week's column headers,
    // Day's week-number link, and Year/Agenda's own heading links, none
    // of which should be affected.
    dayCellDidMount: function (info) {
        let link = info.el.querySelector('[role="link"]');
        if (link) link.dataset.dayNumber = '1';
    },
    // dateClick, not selectable/select - plain click/tap only, no drag.
    // New events get a default duration (1 hour timed, 1 day all-day).
    dateClick: function (info) {
        if (isGuestSession) return;
        let endDate = info.allDay ? addDays(info.date, 1) : new Date(info.date.getTime() + 60 * 60 * 1000);
        openModal('create', { date: info.date, endDate: endDate, allDay: info.allDay });
    },
    eventClick: function (info) {
        info.jsEvent.stopPropagation();
        // A task on the grid is a view of the task, so it opens the task
        // dialog directly - the event popover's actions do not apply to it.
        if (info.event.extendedProps.isTask) {
            let task = getTaskById(info.event.id);
            if (task) openTaskModal('edit', task);
            return;
        }
        if (isTouchDevice) {
            showEventPopover(info.event, info.el);
            return;
        }
        if (eventClickTimer) {
            clearTimeout(eventClickTimer);
            eventClickTimer = null;
            hideEventPopover();
            openEditFor(info.event);
            return;
        }
        eventClickTimer = setTimeout(function () {
            eventClickTimer = null;
            showEventPopover(info.event, info.el);
        }, 300);
    },
    // Replaces the title's (FullCalendar's own role="heading") text with
    // one keyboard-reachable .goto-date-trigger span, on every render.
    // Reads arg.view.title, not heading.textContent - once this handler
    // has replaced the heading's children once, FullCalendar's vdom no
    // longer finds the plain text node it expects there and silently
    // stops updating it (datesSet itself still fires correctly either way).
    datesSet: function (arg) {
        // Which view is on screen, for the rules that only apply to one of
        // them - the week-number gutter is Month's alone, since Year draws
        // twelve grids side by side and has no width to spare.
        calendarEl.dataset.view = arg.view.type;
        // Non-recurring events are stored per month, so any month scrolled
        // into view has to be fetched before its events can appear.
        let cursor = new Date(Date.UTC(arg.start.getUTCFullYear(), arg.start.getUTCMonth(), 1));
        while (cursor < arg.end) {
            requestMonthIfMissing(cursor);
            cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
        }
        let heading = calendarEl.querySelector('[role="heading"]');
        if (!heading) return;
        let text = arg.view.title;
        heading.innerHTML = '';
        let trigger = document.createElement('span');
        trigger.className = 'goto-date-trigger';
        trigger.textContent = text;
        trigger.setAttribute('role', 'button');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.tabIndex = 0;
        trigger.setAttribute('aria-label', text + ', go to date');
        heading.appendChild(trigger);
    }
});
calendar.render();
applyCalendarVisibility();

// Approximates a slide transition: jump #calendar to an offset position
// with the transition disabled, swap in the new view while still offset,
// then re-enable the transition and animate back to rest.
function freezeForViewTransition(direction) {
    calendarEl.style.transition = 'none';
    calendarEl.style.opacity = '.4';
    calendarEl.style.transform = 'translateX(' + (direction === 'next' ? 20 : -20) + 'px)';
    calendarEl.offsetHeight; // force reflow so the jump above isn't itself animated
}

function settleViewTransition() {
    calendarEl.style.transition = 'transform .2s ease-out, opacity .2s ease-out';
    calendarEl.style.opacity = '1';
    calendarEl.style.transform = 'translateX(0)';
}

// Shared by search-result jumps and the go-to-date picker: same slide
// transition as swipe/Previous/Next, but only when the target actually
// falls outside the view currently on screen.
function gotoDateWithTransition(jumpDate) {
    let direction = jumpDate < calendar.view.activeStart ? 'prev'
        : (jumpDate >= calendar.view.activeEnd ? 'next' : null);
    if (direction) freezeForViewTransition(direction);
    calendar.gotoDate(jumpDate);
    if (direction) settleViewTransition();
}

// Swipe left/right to go to the next/previous view. touchend only, never
// preventDefault, so it doesn't interfere with vertical scrolling.
let touchStartX = null;
let touchStartY = null;
let SWIPE_MIN_DISTANCE = 50;

calendarEl.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

calendarEl.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    let touch = e.changedTouches[0];
    let deltaX = touch.clientX - touchStartX;
    let deltaY = touch.clientY - touchStartY;
    touchStartX = null;
    if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE || Math.abs(deltaX) < Math.abs(deltaY)) return;
    freezeForViewTransition(deltaX < 0 ? 'next' : 'prev');
    if (deltaX < 0) calendar.next(); else calendar.prev();
    settleViewTransition();
}, { passive: true });

// Same slide transition as swipe, for Today/Previous/Next. Breezy hashes
// FullCalendar's own class names, so Today is matched by button text and
// Previous/Next by their aria-label prefix ("Previous <Unit>"/"Next
// <Unit>"). Capture phase: needs to freeze #calendar before FullCalendar's
// own bubble-phase click handler re-renders the view.
calendarEl.addEventListener('click', function (e) {
    let btn = e.target.closest('button');
    if (!btn) return;
    let ariaLabel = btn.getAttribute('aria-label') || '';
    let direction = null;
    if (btn.textContent.trim() === 'Today') {
        let now = new Date();
        if (now < calendar.view.activeStart) direction = 'prev';
        else if (now >= calendar.view.activeEnd) direction = 'next';
    } else if (ariaLabel.indexOf('Previous') === 0) {
        direction = 'prev';
    } else if (ariaLabel.indexOf('Next') === 0) {
        direction = 'next';
    }
    if (!direction) return;
    freezeForViewTransition(direction);
    setTimeout(settleViewTransition, 0);
}, true);

// Delegated (title re-renders on every navigation, see datesSet above) -
// mouse/touch via click, keyboard via Enter/Space since it's a real
// tabbable role="button" now, not a native <button>. Re-activating the
// trigger while the picker is open closes it, rather than re-opening it
// in place (which read as broken).
function toggleGotoDatePicker(trigger) {
    let wasOpen = gotoDateMenu.classList.contains('open');
    closeAllCalendarMenus();
    if (!wasOpen) openGotoDatePicker(trigger);
}

calendarEl.addEventListener('click', function (e) {
    let trigger = e.target.closest('.goto-date-trigger');
    if (trigger) toggleGotoDatePicker(trigger);
});
calendarEl.addEventListener('keydown', function (e) {
    let trigger = e.target.closest('.goto-date-trigger');
    if ((e.key === 'Enter' || e.key === ' ') && trigger) {
        e.preventDefault();
        toggleGotoDatePicker(trigger);
    }
});

// ===== Tasks =====

function getTaskById(id) {
    return tasks.find(function (t) { return t.id === id; }) || null;
}

// A dated task is drawn on the grid as an all-day item; an undated one has
// no place there. A completed one is only drawn while completed tasks are
// being shown, so ticking one off clears it from the grid too.
function syncTaskEvent(task) {
    let existing = calendar.getEventById(task.id);
    if (existing) existing.remove();
    if (!task.due || (task.completed && !showCompletedTasks)) return;
    calendar.addEvent({
        id: task.id,
        title: task.title,
        start: task.due,
        allDay: task.dueAllDay,
        // Tasks are completed or edited, never dragged to a new date - the
        // grid is a view of them, not the place they are managed.
        editable: false,
        color: colorForCalendarId(task.calendarId),
        extendedProps: {
            isTask: true,
            calendarId: task.calendarId,
            completed: task.completed
        }
    });
}

function syncAllTaskEvents() {
    tasks.forEach(syncTaskEvent);
    applyCalendarVisibility();
}

function persistTask(task) {
    if (isGuestSession || !isCalendarWritable(task.calendarId)) return;
    let previous = taskCalendars[task.id];
    // Moved to another calendar: its file moved directory, so drop the old
    // copy or it reloads later as a duplicate.
    if (previous && previous !== task.calendarId)
        hostSend({ type: 'delete', isTask: true, calendarName: previous, Id: task.id });
    hostSend(Object.assign({ type: 'save' }, taskSavePayload(task)));
    taskCalendars[task.id] = task.calendarId;
}

function deleteTask(task) {
    if (isGuestSession || !isCalendarWritable(task.calendarId)) return;
    hostSend({ type: 'delete', isTask: true, calendarName: taskCalendars[task.id] || task.calendarId, Id: task.id });
    delete taskCalendars[task.id];
    tasks = tasks.filter(function (t) { return t.id !== task.id; });
    let onGrid = calendar.getEventById(task.id);
    if (onGrid) onGrid.remove();
    renderTaskList();
}

function toggleTaskCompleted(task) {
    if (isGuestSession || !isCalendarWritable(task.calendarId)) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date() : null;
    persistTask(task);
    syncTaskEvent(task);
    renderTaskList();
}

// Midnight today, the boundary every "overdue" and "due today" test uses.
function startOfToday() {
    let now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

// Overdue first, then today, then the rest by date, then the undated ones.
// That is the order of urgency, and the order every task list uses.
function groupedTasks() {
    let today = startOfToday();
    let tomorrow = addDays(today, 1);
    let groups = [
        { key: 'overdue', label: 'Overdue', items: [] },
        { key: 'today', label: 'Today', items: [] },
        { key: 'upcoming', label: 'Upcoming', items: [] },
        { key: 'undated', label: 'No date', items: [] }
    ];
    let visible = tasks.filter(function (t) {
        if (t.completed && !showCompletedTasks) return false;
        return isCalendarVisible(t.calendarId);
    });
    visible.forEach(function (task) {
        if (!task.due) groups[3].items.push(task);
        else if (task.due < today) groups[0].items.push(task);
        else if (task.due < tomorrow) groups[1].items.push(task);
        else groups[2].items.push(task);
    });
    let byDueThenTitle = function (a, b) {
        if (a.due && b.due && a.due.getTime() !== b.due.getTime()) return a.due - b.due;
        return a.title.localeCompare(b.title);
    };
    groups.forEach(function (g) { g.items.sort(byDueThenTitle); });
    return groups.filter(function (g) { return g.items.length > 0; });
}

function formatTaskDue(task) {
    if (!task.due) return '';
    let today = startOfToday();
    let dayDiff = Math.round((new Date(task.due.getFullYear(), task.due.getMonth(), task.due.getDate()) - today) / 86400000);
    let day = dayDiff === 0 ? 'Today' : (dayDiff === 1 ? 'Tomorrow' : (dayDiff === -1 ? 'Yesterday' :
        task.due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })));
    return task.dueAllDay ? day : day + ' ' + task.due.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function renderTaskList() {
    taskList.innerHTML = '';
    let groups = groupedTasks();
    let openCount = tasks.filter(function (t) { return !t.completed && isCalendarVisible(t.calendarId); }).length;
    taskCountBadge.textContent = openCount > 0 ? String(openCount) : '';
    if (!groups.length) {
        let empty = document.createElement('p');
        empty.className = 'task-empty';
        empty.textContent = showCompletedTasks ? 'No tasks' : 'No open tasks';
        taskList.appendChild(empty);
        return;
    }
    groups.forEach(function (group) {
        let heading = document.createElement('h3');
        heading.className = 'task-group-heading';
        if (group.key === 'overdue') heading.classList.add('task-group-heading--overdue');
        heading.textContent = group.label;
        taskList.appendChild(heading);
        group.items.forEach(function (task) {
            taskList.appendChild(taskRow(task));
        });
    });
}

function taskRow(task) {
    let row = document.createElement('div');
    row.className = 'task-row' + (task.completed ? ' task-row--done' : '');

    let box = document.createElement('input');
    box.type = 'checkbox';
    box.className = 'task-check';
    box.checked = task.completed;
    box.disabled = !isCalendarWritable(task.calendarId);
    box.setAttribute('aria-label', (task.completed ? 'Mark not done: ' : 'Mark done: ') + task.title);
    box.addEventListener('change', function () { toggleTaskCompleted(task); });
    row.appendChild(box);

    // A button, not a click handler on the row: the row holds a checkbox of
    // its own, and nesting one control inside another is neither reachable
    // by keyboard nor announced correctly.
    let open = document.createElement('button');
    open.type = 'button';
    open.className = 'task-open';
    let title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;
    open.appendChild(title);
    let due = formatTaskDue(task);
    if (due) {
        let meta = document.createElement('span');
        meta.className = 'task-due';
        if (!task.completed && task.due < startOfToday()) meta.classList.add('task-due--overdue');
        meta.textContent = due;
        open.appendChild(meta);
    }
    open.addEventListener('click', function () { openTaskModal('edit', task); });
    row.appendChild(open);

    let dot = document.createElement('span');
    dot.className = 'task-dot';
    dot.style.backgroundColor = displayColor(calendarColorFor(task.calendarId));
    dot.title = task.calendarId;
    row.appendChild(dot);
    return row;
}

function calendarColorFor(calendarId) {
    let cal = getCalendarById(calendarId);
    return cal ? cal.color : CALENDAR_COLORS[0];
}

// --- Task dialog ---

function applyTaskDueVisibility() {
    taskDueFields.style.display = taskHasDueInput.checked ? '' : 'none';
    taskDueTimeInput.style.display = taskDueAllDayInput.checked ? 'none' : '';
}

function openTaskModal(mode, task) {
    editingTaskId = mode === 'edit' ? task.id : null;
    taskModalHeading.textContent = mode === 'edit' ? 'Edit task' : 'New task';
    taskTitleInput.value = mode === 'edit' ? task.title : '';
    taskDescriptionInput.value = mode === 'edit' ? task.description : '';
    taskPrioritySelect.value = String(mode === 'edit' ? task.priority : 0);
    renderCalendarSelectOptions(mode === 'edit' ? task.calendarId : null, taskCalendarSelect);

    let due = mode === 'edit' ? task.due : null;
    let base = due || new Date();
    taskHasDueInput.checked = !!due;
    taskDueAllDayInput.checked = mode === 'edit' ? task.dueAllDay : true;
    taskDueDateInput.value = toDateInputValue(base);
    taskDueTimeInput.value = toTimeInputValue(base);
    applyTaskDueVisibility();

    let writable = mode === 'edit' ? isCalendarWritable(task.calendarId) : defaultCalendarId() != null;
    [taskTitleInput, taskCalendarSelect, taskHasDueInput, taskDueDateInput, taskDueTimeInput,
        taskDueAllDayInput, taskPrioritySelect, taskDescriptionInput].forEach(function (el) {
        el.disabled = !writable;
    });
    taskSaveButton.style.display = writable ? '' : 'none';
    taskDeleteButton.style.display = (writable && mode === 'edit') ? '' : 'none';
    taskCancelButton.textContent = writable ? 'Cancel' : 'Close';

    // Same reason the calendar dialog does it: on mobile the sidebar is a
    // drawer above the modal, and this dialog is opened from inside it.
    closeSidebar();
    openDialog(taskModalBackdrop, writable ? taskTitleInput : null);
}

function closeTaskModal() {
    closeDialog(taskModalBackdrop);
    editingTaskId = null;
}

// The due date is read from the two inputs only when the checkbox says
// there is one - a task without a date is the normal case, not an error.
function readTaskDueFromForm() {
    if (!taskHasDueInput.checked || !taskDueDateInput.value) return { due: null, dueAllDay: true };
    let allDay = taskDueAllDayInput.checked;
    let value = taskDueDateInput.value + 'T' + (allDay ? '00:00' : (taskDueTimeInput.value || '00:00'));
    let due = new Date(value);
    return isNaN(due.getTime()) ? { due: null, dueAllDay: true } : { due: due, dueAllDay: allDay };
}

taskForm.addEventListener('submit', function (e) {
    e.preventDefault();
    let title = taskTitleInput.value.trim();
    if (!title) return;
    let calendarId = taskCalendarSelect.value || defaultCalendarId();
    if (!calendarId) return;
    let dueParts = readTaskDueFromForm();
    let existing = editingTaskId ? getTaskById(editingTaskId) : null;
    let task = existing || { id: nextTaskId(), completed: false, completedAt: null };
    task.title = title;
    task.calendarId = calendarId;
    task.due = dueParts.due;
    task.dueAllDay = dueParts.dueAllDay;
    task.priority = parseInt(taskPrioritySelect.value, 10) || 0;
    task.description = taskDescriptionInput.value;
    if (!existing) tasks.push(task);
    persistTask(task);
    syncTaskEvent(task);
    renderTaskList();
    closeTaskModal();
});

taskDeleteButton.addEventListener('click', function () {
    let task = editingTaskId ? getTaskById(editingTaskId) : null;
    if (!task) return;
    closeTaskModal();
    openConfirmModal('Delete task "' + task.title + '"?', function () { deleteTask(task); });
});

taskCancelButton.addEventListener('click', closeTaskModal);
taskHasDueInput.addEventListener('change', applyTaskDueVisibility);
taskDueAllDayInput.addEventListener('change', applyTaskDueVisibility);
taskModalBackdrop.addEventListener('click', function (e) {
    if (e.target === taskModalBackdrop) closeTaskModal();
});

// The panel is on screen before the host's load arrives; without this it
// sits as a bare heading with nothing under it.
renderTaskList();

showCompletedButton.addEventListener('click', function () {
    showCompletedTasks = !showCompletedTasks;
    showCompletedButton.setAttribute('aria-pressed', showCompletedTasks ? 'true' : 'false');
    showCompletedButton.textContent = showCompletedTasks ? 'Hide completed' : 'Show completed';
    syncAllTaskEvents();
    renderTaskList();
});

// ===== Peergos host bridge =====
// This app runs in a sandboxed iframe on a `calendar.` subdomain;
// Calendar.vue on the parent page owns filesystem access, sharing and the
// spinner/toast UI. Events cross the boundary as whole `.ics` documents
// (one VEVENT each), which is exactly what this app already reads and
// writes - see parseIcsFile()/eventToIcsLines().
//
// Calendars are addressed by *name* on the wire, so name doubles as the
// local calendar id rather than carrying a second identifier that would
// have to be kept in sync.

function hostSend(message) {
    if (hostWindow) hostWindow.postMessage(message, hostOrigin);
}

// UTC, matching how the host lays out <calendar>/<year>/<month>/<id>.ics -
// local-time months would put an event in a different folder than the one
// the host later looks in.
function placementOf(ev) {
    let recur = ev.extendedProps.recur;
    let start = ev.start;
    if (recur && recur.dtstart) {
        start = new Date(recur.dtstart.indexOf('T') === -1 ? recur.dtstart + 'T00:00' : recur.dtstart);
    }
    return {
        calendarName: ev.extendedProps.calendarId,
        year: start.getUTCFullYear(),
        month: start.getUTCMonth() + 1,
        isRecurring: !!recur
    };
}

function samePlacement(a, b) {
    return !!a && !!b && a.calendarName === b.calendarName && a.year === b.year
        && a.month === b.month && a.isRecurring === b.isRecurring;
}

// Identifies a stored event to the host: which file, in which calendar
// folder. Matches the fields its download/email/share handlers read.
function hostEventRef(ev) {
    let placement = eventPlacements[ev.id] || placementOf(ev);
    return {
        calendarName: placement.calendarName,
        id: ev.id,
        year: placement.year,
        month: placement.month,
        isRecurring: placement.isRecurring
    };
}

function persistDelete(eventId, placement) {
    if (!placement) return;
    hostSend({
        type: 'delete',
        calendarName: placement.calendarName,
        year: placement.year,
        month: placement.month,
        Id: eventId,
        isRecurring: placement.isRecurring
    });
    delete eventPlacements[eventId];
}

// The `save` payload for one event. Import batches these into a single
// message instead of sending one write per event - see importIcsText.
function eventSavePayload(ev, placement) {
    placement = placement || placementOf(ev);
    return {
        calendarName: placement.calendarName,
        previousCalendarName: placement.calendarName,
        year: placement.year,
        month: placement.month,
        Id: ev.id,
        item: buildIcsDocument(eventToIcsLines(ev)),
        isRecurring: placement.isRecurring,
        action: ''
    };
}

function taskSavePayload(task) {
    return {
        isTask: true,
        calendarName: task.calendarId,
        Id: task.id,
        item: buildIcsDocument(taskToIcsLines(task))
    };
}

function persistEvent(ev) {
    if (!ev || isGuestSession || !isCalendarWritable(ev.extendedProps.calendarId)) return;
    // Deleted first, so an override re-entering here can't recurse.
    let pending = unmigratedOverrides[ev.id];
    if (pending) {
        delete unmigratedOverrides[ev.id];
        pending.forEach(function (overrideId) {
            let override = calendar.getEventById(overrideId);
            if (override) persistEvent(override);
        });
    }
    let placement = placementOf(ev);
    let previous = eventPlacements[ev.id];
    // Moved file: drop the stale copy first, otherwise it reloads later as
    // a duplicate. Paths always differ here (that's what "moved" means), so
    // this can't race with the write below.
    if (previous && !samePlacement(previous, placement)) persistDelete(ev.id, previous);
    hostSend(Object.assign({ type: 'save' }, eventSavePayload(ev, placement)));
    eventPlacements[ev.id] = placement;
}

// Adds an event locally and writes it back in one step - every create path
// in this app goes through here so none can silently skip persistence.
function addAndPersist(payload) {
    let ev = calendar.addEvent(payload);
    if (ev) persistEvent(ev);
    return ev;
}

function removeAndPersist(ev) {
    let placement = eventPlacements[ev.id] || placementOf(ev);
    ev.remove();
    persistDelete(ev.id, placement);
}

function calendarFromHost(entry, index) {
    let color = entry.color || CALENDAR_COLORS[index % CALENDAR_COLORS.length];
    // A calendar owned by someone else is one shared with us. Those are
    // read-only here whatever the share grants: the host addresses events by
    // the *current* user's own app directory, so a write would land in the
    // wrong place.
    let sharedWithUs = entry.owner != null && entry.owner !== hostUsername;
    return {
        id: entry.name,
        name: entry.name,
        color: color,
        visible: true,
        primary: index === 0 && !sharedWithUs,
        readOnly: isGuestSession || sharedWithUs,
        owner: entry.owner
    };
}

// A guest or read-only session can't write anything, so the create paths
// are removed outright instead of failing silently inside persistEvent.
function applyReadOnlyMode() {
    toolbarAddButton.style.display = isGuestSession ? 'none' : '';
    addCalendarButton.style.display = isGuestSession ? 'none' : '';
}

function applyHostCalendars(hostCalendars) {
    calendars = (hostCalendars || []).map(calendarFromHost);
    renderCalendarList();
    renderCalendarSelectOptions();
}

// Both host buckets arrive as one .ics document per entry, and a file that
// won't parse is skipped rather than failing the whole load with it.
function forEachParsedEntry(entries, handle) {
    (entries || []).forEach(function (entry) {
        let parsed;
        try {
            parsed = parseIcsFile(entry.data);
        } catch (e) {
            return;
        }
        handle(parsed, entry);
    });
}

// One .ics per task, exactly as events are stored - the file's own UID is
// the id, so a task written by another client keeps its identity here.
function addHostTasksFrom(entries) {
    forEachParsedEntry(entries, function (parsed, entry) {
        parsed.tasks.forEach(function (task) {
            if (getTaskById(task.id)) return;
            task.calendarId = entry.calendarName;
            tasks.push(task);
            taskCalendars[task.id] = entry.calendarName;
        });
    });
}

// A legacy event file can hold a master plus its RECURRENCE-ID overrides,
// so a single entry can yield more than one event.
function addHostEventsFrom(entries) {
    forEachParsedEntry(entries, function (parsed, entry) {
        parsed.events.forEach(function (payload) {
            if (calendar.getEventById(payload.id)) return;
            payload.extendedProps.calendarId = entry.calendarName;
            payload.color = colorForCalendarId(entry.calendarName);
            let ev = calendar.addEvent(payload);
            if (!ev) return;
            eventPlacements[ev.id] = placementOf(ev);
            let separator = ev.id.indexOf(OVERRIDE_ID_SEPARATOR);
            if (separator === -1) return;
            let seriesId = ev.id.slice(0, separator);
            if (!unmigratedOverrides[seriesId]) unmigratedOverrides[seriesId] = [];
            unmigratedOverrides[seriesId].push(ev.id);
        });
    });
}

function handleHostLoad(data) {
    hostUsername = data.username;
    isGuestSession = data.isReadOnly != null ? data.isReadOnly : (data.username == null);
    applyReadOnlyMode();
    applyHostCalendars(data.calendars);
    calendar.getEvents().forEach(function (ev) { ev.remove(); });
    eventPlacements = Object.create(null);
    loadedYearMonths = Object.create(null);
    unmigratedOverrides = Object.create(null);
    tasks = [];
    taskCalendars = Object.create(null);
    addHostTasksFrom(data.tasks);
    addHostEventsFrom(data.recurringEvents);
    addHostEventsFrom(data.previousMonth);
    addHostEventsFrom(data.currentMonth);
    addHostEventsFrom(data.nextMonth);
    if (typeof data.yearMonth === 'number') {
        loadedYearMonths[data.yearMonth - 1] = true;
        loadedYearMonths[data.yearMonth] = true;
        loadedYearMonths[data.yearMonth + 1] = true;
    }
    syncAllTaskEvents();
    renderTaskList();
    applyCalendarVisibility();
    // The host raises a spinner before the iframe exists and leaves it to
    // us to say when the first paint is done - it never clears it itself.
    hostSend({ type: 'removeSpinner' });
    // An .ics the user opened from their Peergos files rides along with this
    // load rather than arriving as its own importICSFile message - the host
    // only sends that one for a guest session. Without this the file opens
    // to an ordinary calendar and its events are silently dropped.
    let importParams = data.importCalendarEventParams;
    if (importParams && importParams.contents) importIcsText(importParams.contents);
}

function handleHostLoadAdditional(data) {
    addHostEventsFrom(data.currentMonth);
    if (typeof data.yearMonth === 'number') loadedYearMonths[data.yearMonth] = true;
    applyCalendarVisibility();
    // No removeSpinner: the host raises none for a month fetch, and these
    // replies arrive in any order (a year view asks for twelve at once), so
    // clearing here would lift a spinner raised by a save or a share.
}

// Non-recurring events are stored per month, so a month that has never been
// fetched has to be asked for before its events can show up.
function requestMonthIfMissing(date) {
    let yearMonth = date.getUTCFullYear() * 12 + date.getUTCMonth();
    if (loadedYearMonths[yearMonth]) return;
    loadedYearMonths[yearMonth] = true;
    hostSend({ type: 'loadAdditional', year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
}

window.addEventListener('message', function (e) {
    // The parent page is this iframe's host minus the leading `calendar.`
    // label; anything else is not the host and is ignored outright.
    let parentDomain = window.location.host.substring(window.location.host.indexOf('.') + 1);
    if (e.origin !== window.location.protocol + '//' + parentDomain) return;
    if (e.source !== window.parent) return;
    hostWindow = e.source;
    hostOrigin = e.origin;
    let data = e.data;
    if (data.type === 'ping') {
        applyHostTheme(data.currentTheme);
        hostHasEmailApp = data.hasEmail === true;
        hostSend({ type: 'pong' });
    } else if (data.type === 'setTheme') {
        applyHostTheme(data.currentTheme);
    } else if (data.type === 'load') {
        handleHostLoad(data);
    } else if (data.type === 'loadAdditional') {
        handleHostLoadAdditional(data);
    } else if (data.type === 'importICSFile') {
        importIcsText(data.contents);
    } else if (data.type === 'respondAddCalendar') {
        respondToCalendarAdd(data.newName, data.newColor);
    } else if (data.type === 'respondRenameCalendar') {
        respondToCalendarRename(data.calendar);
    } else if (data.type === 'respondCalendarColorChange') {
        respondToCalendarColorChange(data.calendarName, data.newColor);
    } else if (data.type === 'respondDeleteCalendar') {
        respondToCalendarDelete(data.calendar);
    } else if (data.type === 'respondShareState') {
        respondToShareState(data);
    }
});

function applyHostTheme(theme) {
    if (theme == null) return;
    isDarkMode = theme === 'dark-mode';
    if (isDarkMode) document.documentElement.setAttribute('data-color-scheme', 'dark');
    else document.documentElement.removeAttribute('data-color-scheme');
    calendars.forEach(function (cal) { applyCalendarColor(cal.id); });
    renderCalendarList();
}

// --- Calendar CRUD, delegated to the host ---
// The host owns the name prompt (its validation and uniqueness rules) and
// the directory it creates on disk, so the local list is only updated once
// it answers back.

function nextUnusedCalendarColor() {
    let used = calendars.map(function (c) { return c.color; });
    return CALENDAR_COLORS.find(function (c) { return used.indexOf(c) === -1; }) || CALENDAR_COLORS[0];
}

function requestAddCalendar(name, color) {
    hostSend({ action: 'requestAddCalendar', newName: name, newColor: color || nextUnusedCalendarColor() });
}

// The host renames in place and echoes the *same* object back with only
// `name` updated, so `id` rides along untouched as the only record of
// which calendar this was.
function requestRenameCalendar(cal, newName) {
    hostSend({ action: 'requestRenameCalendar', newName: newName, calendar: { id: cal.id, name: cal.name, color: cal.color, owner: cal.owner } });
}

function requestCalendarColorChange(cal, color) {
    hostSend({ action: 'requestCalendarColorChange', calendarName: cal.name, newColor: color });
}

function respondToCalendarAdd(newName, newColor) {
    if (!newName || getCalendarById(newName)) return;
    calendars.push({ id: newName, name: newName, color: newColor || nextUnusedCalendarColor(), visible: true });
    renderCalendarList();
    renderCalendarSelectOptions();
}

// Renaming changes the calendar's identity on the wire, so every event
// pointing at the old name has to be repointed - and their stored
// placements with them, or the next save would write to the old folder.
function respondToCalendarRename(renamed) {
    if (!renamed || !renamed.id || !renamed.name || renamed.id === renamed.name) return;
    let cal = getCalendarById(renamed.id);
    if (!cal) return;
    let previousName = cal.id;
    cal.id = renamed.name;
    cal.name = renamed.name;
    calendar.getEvents().forEach(function (ev) {
        if (ev.extendedProps.calendarId !== previousName) return;
        ev.setExtendedProp('calendarId', renamed.name);
        let placement = eventPlacements[ev.id];
        if (placement) placement.calendarName = renamed.name;
    });
    // Tasks address their calendar by name too. Left behind they would point
    // at a calendar that no longer exists, and the next save would resolve to
    // nothing and be refused.
    tasks.forEach(function (task) {
        if (task.calendarId !== previousName) return;
        task.calendarId = renamed.name;
        if (taskCalendars[task.id] === previousName) taskCalendars[task.id] = renamed.name;
    });
    renderCalendarList();
    renderCalendarSelectOptions();
    renderTaskList();
}

function respondToCalendarColorChange(calendarName, newColor) {
    let cal = getCalendarById(calendarName);
    if (!cal) return;
    cal.color = newColor;
    applyCalendarColor(cal.id);
    renderCalendarList();
    // The panel's dots take their colour from the calendar as well, and the
    // grid copies of tasks are events so applyCalendarColor already has them.
    renderTaskList();
}

function respondToCalendarDelete(deleted) {
    let name = deleted && (deleted.calendarName || deleted.name);
    if (!name) return;
    tasks.filter(function (t) { return t.calendarId === name; })
        .forEach(function (t) { delete taskCalendars[t.id]; });
    tasks = tasks.filter(function (t) { return t.calendarId !== name; });
    renderTaskList();
    calendar.getEvents().forEach(function (ev) {
        if (ev.extendedProps.calendarId === name) {
            delete eventPlacements[ev.id];
            ev.remove();
        }
    });
    calendars = calendars.filter(function (c) { return c.id !== name; });
    renderCalendarList();
    renderCalendarSelectOptions();
}

// Registered here rather than in index.html so a failure can be reported
// to the host, which shows the "allow third-party cookies" hint - without
// it this subdomain iframe has no offline cache.
navigator.serviceWorker.getRegistration('./').then(function (registration) {
    return registration || navigator.serviceWorker.register('sw.js', { scope: './' });
}).catch(function () {
    let parentDomain = window.location.host.substring(window.location.host.indexOf('.') + 1);
    window.parent.postMessage('sw-registration-failure', window.location.protocol + '//' + parentDomain);
});
