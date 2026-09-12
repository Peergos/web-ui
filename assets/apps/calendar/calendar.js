let pad = n => String(n).padStart(2, '0');

// RFC 5545 numbers priority 1 (highest) to 9 (lowest); 5 is the middle, which
// is what a task carries when nothing has said otherwise.
let ICS_PRIORITY_NORMAL = 5;

// A stored local stamp: the date alone for an all-day entry, date and time otherwise.
function toLocalInputValue(date, allDay) {
    return allDay ? toDateInputValue(date) : (toDateInputValue(date) + 'T' + toTimeInputValue(date));
}

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

// --- The end of an event is a span from its start -----------------------
// Every mainstream calendar treats it that way: moving the start moves the
// end with it, and only editing the end itself changes how long the event
// is. Without that, duplicating a 10:00-11:00 event and moving it to next
// week leaves the end where it was, writing a DTEND earlier than its
// DTSTART - which RFC 5545 forbids and other clients read as broken.
//
// The span is held as whole days plus minutes-of-day and applied with local
// calendar arithmetic rather than by adding milliseconds: a 09:00-10:00
// event dragged across a daylight-saving change stays 09:00-10:00 instead
// of silently becoming an hour longer or shorter.
let formSpan = { days: 0, minutes: 60 };

function dateFromInputValue(value) {
    return new Date(value + 'T00:00');
}

function minutesOfDay(value) {
    let parts = String(value).split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function minutesToTimeValue(total) {
    return pad(Math.floor(total / 60)) + ':' + pad(total % 60);
}

// Local midnight to local midnight, rounded: the two are 23 or 25 hours
// apart across a daylight-saving change, and that is still one day.
function daysBetweenInputDates(from, to) {
    return Math.round((dateFromInputValue(to) - dateFromInputValue(from)) / 86400000);
}

// Called when the form is filled and whenever the user edits the end: those
// are the moments the length is being chosen rather than moved.
function readFormSpan() {
    formSpan = {
        days: daysBetweenInputDates(startDateInput.value, endDateInput.value),
        minutes: allDayInput.checked ? 0 : minutesOfDay(endTimeInput.value) - minutesOfDay(startTimeInput.value)
    };
    refreshRangeValidity();
}

function applyFormSpan() {
    let allDay = allDayInput.checked;
    let days = formSpan.days;
    let minutes = allDay ? 0 : minutesOfDay(startTimeInput.value) + formSpan.minutes;
    // A span that runs past midnight - or back over it - carries into the
    // date rather than wrapping the clock.
    while (minutes < 0) { minutes += 1440; days -= 1; }
    while (minutes >= 1440) { minutes -= 1440; days += 1; }
    endDateInput.value = toDateInputValue(addDays(dateFromInputValue(startDateInput.value), days));
    if (!allDay) endTimeInput.value = minutesToTimeValue(minutes);
    refreshRangeValidity();
}

// The guard the span alone cannot give: the user is free to set an end
// before the start by hand. Reported through the browser's own validation
// so the form simply will not submit, and always on the end *date* - the
// time input is hidden for an all-day event, and a message on a hidden
// field blocks the form with nothing on screen to explain why.
function refreshRangeValidity() {
    let allDay = allDayInput.checked;
    let start = allDay ? dateFromInputValue(startDateInput.value)
        : new Date(startDateInput.value + 'T' + startTimeInput.value);
    let end = allDay ? dateFromInputValue(endDateInput.value)
        : new Date(endDateInput.value + 'T' + endTimeInput.value);
    if (isNaN(start) || isNaN(end)) {
        endDateInput.setCustomValidity('');
        return true;
    }
    // An all-day end is stored exclusively, so the same day is a valid
    // one-day event; a timed one must actually end after it starts.
    let valid = allDay ? end >= start : end > start;
    endDateInput.setCustomValidity(valid ? ''
        : (allDay ? 'The end date cannot be before the start date'
                  : 'The event has to end after it starts'));
    return valid;
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

let ORDINAL_LABELS = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', '-1': 'last' };
let WEEKDAY_LABELS = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
let MONTH_LABELS = { 1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June', 7: 'July',
    8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December' };

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

// Which days a rule picks out, as rrule.js takes them. Both the spec the grid
// renders from and the set this file computes its own dates with go through
// here, so a rule cannot mean one thing on the grid and another in a reminder.
function applyRRuleByParts(spec, recur) {
    let byday = (recur.byday && recur.byday.length) ? recur.byday : recur.bydayFilter;
    if (byday && byday.length) spec.byweekday = rruleByweekdayFromByday(byday);
    // The list or the single day, never both: a rule naming several is kept out
    // of the field the form's one box fills.
    let monthday = recur.bymonthdayList || recur.bymonthday;
    if (monthday) spec.bymonthday = monthday;
    let month = recur.bymonthList || recur.bymonth;
    if (month) spec.bymonth = month;
    if (recur.bysetpos && recur.bysetpos.length) spec.bysetpos = recur.bysetpos;
    if (recur.byweekno && recur.byweekno.length) spec.byweekno = recur.byweekno;
    if (recur.byyearday && recur.byyearday.length) spec.byyearday = recur.byyearday;
    if (recur.wkst) spec.wkst = rrule.RRule[recur.wkst];
    return spec;
}

function rruleOptionsFor(recur, allDay) {
    let dtstart = allDay ? new Date(recur.dtstart + 'T00:00') : new Date(recur.dtstart);
    return applyRRuleByParts({ freq: rrule.RRule[recur.freq.toUpperCase()],
        interval: recur.interval, dtstart: toFakeUtc(dtstart) }, recur);
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
// Drag to move is for a mouse: the previous calendar had it on the desktop and
// not the phone, where a drag fights the grid's own scrolling.
let canDragEvents = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// The colour anything falls back to when none was stored or supplied.
let DEFAULT_CALENDAR_COLOR = '#3788d8';

// A calendar's colour is shown exactly as it was chosen - the same value in
// the picker, the sidebar dot and every entry, in either theme. What does
// change with it is the ink on top: white on a dark colour, near-black on a
// light one, so a chip stays readable whatever colour someone picks.
function hexToRgb(hex) {
    let value = String(hex || '').trim().replace('#', '');
    if (value.length === 3) {
        value = value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    }
    if (!/^[0-9a-f]{6}$/i.test(value)) return null;
    return { r: parseInt(value.slice(0, 2), 16),
             g: parseInt(value.slice(2, 4), 16),
             b: parseInt(value.slice(4, 6), 16) };
}

// FullCalendar publishes a fixed white as its own contrast colour, so each
// chip carries the ink that actually reads on the colour it is painted in.
// Applied on mount and again whenever a calendar is recoloured: changing an
// event's colour re-renders the chip in place without re-running eventDidMount.
function paintEventInk(el, color) {
    el.style.setProperty('--pg-event-ink', contrastInkFor(color));
}

// Relative luminance, sRGB coefficients (WCAG 2.1).
function relativeLuminance(rgb) {
    let channel = function (c) {
        let v = c / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

let DARK_INK = '#1d2b36';

// Whichever of the two inks actually reads better on the colour, by contrast
// ratio rather than by a guessed lightness cut-off: the two cross at 0.179,
// so a mid colour like the app's own green took white ink at 2.5:1 where the
// dark one gives 5.9:1.
function contrastInkFor(hex) {
    let rgb = hexToRgb(hex);
    if (!rgb) return '#ffffff';
    let luminance = relativeLuminance(rgb);
    let onWhite = 1.05 / (luminance + 0.05);
    let onDark = (luminance + 0.05) / (relativeLuminance(hexToRgb(DARK_INK)) + 0.05);
    return onDark > onWhite ? DARK_INK : '#ffffff';
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
// layout), keyed by series id. Saving or deleting anything in that series
// rewrites or removes the file, taking the other entries in it along, so
// they are given files of their own at that moment - see migrateOverridesOf.
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
let taskReminderSelect = document.getElementById('task-reminder');
let taskWhenFields = document.getElementById('task-when-fields');
let taskRepeatFreqInput = document.getElementById('task-repeat-freq');
let taskRepeatDetails = document.getElementById('task-repeat-details');
let taskRepeatIntervalInput = document.getElementById('task-repeat-interval');
let taskRepeatIntervalUnit = document.getElementById('task-repeat-interval-unit');
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
let repeatMonthdayRow = document.getElementById('event-repeat-monthday-row');
let repeatMonthdayInput = document.getElementById('event-repeat-monthday');
let repeatNthRow = document.getElementById('event-repeat-nth-row');
let repeatOrdinalInput = document.getElementById('event-repeat-ordinal');
let repeatNthWeekdayInput = document.getElementById('event-repeat-nth-weekday');
let repeatMonthRow = document.getElementById('event-repeat-month-row');
let repeatMonthInput = document.getElementById('event-repeat-month');
let weekdayToggleButtons = Array.prototype.slice.call(document.querySelectorAll('.weekday-toggle'));
let repeatMonthlyModeInput = document.getElementById('event-repeat-monthly-mode');
let statusInput = document.getElementById('event-status');
let descriptionInput = document.getElementById('event-description');
let eventReminderSelect = document.getElementById('event-reminder');
let deleteButton = document.getElementById('event-delete');
let saveButton = document.getElementById('event-save');
let cancelButton = document.getElementById('event-cancel');
let modalHeading = document.getElementById('event-modal-heading');
// Set while a dialog for a calendar we cannot write is open, so the repeat
// section's own enabling does not undo it.
let isReadOnlyForm = false;
let editableFields = [
    titleInput, calendarSelectInput, allDayInput, startDateInput, startTimeInput, endDateInput, endTimeInput,
    locationInput, repeatFreqInput, repeatIntervalInput, repeatEndInput, repeatUntilInput,
    repeatCountInput, statusInput, descriptionInput, repeatMonthlyModeInput,
    repeatMonthdayInput, repeatOrdinalInput, repeatNthWeekdayInput, repeatMonthInput
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
let gotoDateBackdrop = document.getElementById('goto-date-backdrop');
let pullHint = document.getElementById('pull-hint');
let gotoDateMonthInput = document.getElementById('goto-date-month');
let gotoDateYearInput = document.getElementById('goto-date-year');
let gotoDateYearDownButton = document.getElementById('goto-date-year-down');
let gotoDateYearUpButton = document.getElementById('goto-date-year-up');
let overflowMenuButton = document.getElementById('overflow-menu-button');
let overflowMenu = document.getElementById('overflow-menu');
let overflowImportButton = document.getElementById('overflow-import-button');
let overflowRefreshButton = document.getElementById('overflow-refresh-button');
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
let calendarModalBackdrop = document.getElementById('calendar-modal-backdrop');
let calendarForm = document.getElementById('calendar-form');
let calendarModalHeading = document.getElementById('calendar-modal-heading');
let calendarNameInput = document.getElementById('calendar-name-input');
let calendarDeleteButton = document.getElementById('calendar-delete');
let calendarColorValue = document.getElementById('calendar-color-value');
let colorModalBackdrop = document.getElementById('color-modal-backdrop');
let colorField = document.getElementById('color-field');
let colorFieldThumb = document.getElementById('color-field-thumb');
let colorHue = document.getElementById('color-hue');
let colorPreview = document.getElementById('color-preview');
let colorHexInput = document.getElementById('color-hex');
let colorApplyButton = document.getElementById('color-apply');
let colorCancelButton = document.getElementById('color-cancel');
let loadProgressEl = document.getElementById('load-progress');
let calendarColorCustom = document.getElementById('calendar-color-custom');
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

function updateRepeatVisibility() {
    let freq = repeatFreqInput.value;
    let repeating = !!freq;
    repeatDetails.style.display = repeating ? '' : 'none';
    repeatIntervalUnit.textContent = intervalUnitLabels[freq] || 'day(s)';
    let endMode = repeatEndInput.value;
    repeatUntilInput.style.display = (repeating && endMode === 'until') ? '' : 'none';
    repeatCountRow.style.display = (repeating && endMode === 'count') ? '' : 'none';
    repeatWeekdayRow.style.display = (freq === 'weekly') ? '' : 'none';
    let byMonth = freq === 'monthly' || freq === 'yearly';
    repeatMonthlyModeInput.style.display = byMonth ? '' : 'none';
    let byWeekdayOfMonth = byMonth && repeatMonthlyModeInput.value === 'nthWeekday';
    // The day of the month is the same control for monthly and yearly; the
    // month beside it is what makes it a yearly date.
    repeatMonthdayRow.style.display = (repeating && !byWeekdayOfMonth
        && (freq === 'monthly' || freq === 'yearly')) ? '' : 'none';
    repeatNthRow.style.display = byWeekdayOfMonth ? '' : 'none';
    repeatMonthRow.style.display = (freq === 'yearly') ? '' : 'none';
    if (freq === 'weekly' && !selectedWeekdays().length) setSelectedWeekdays([weekdayCodeOf(formStartDate())]);
    // A control the form is not showing takes no part in it. Left enabled, a
    // number typed out of range in one mode blocks the save in another, with
    // nothing on screen for the browser to point the message at.
    [[repeatIntervalInput, repeating], [repeatUntilInput, repeating && endMode === 'until'],
     [repeatCountInput, repeating && endMode === 'count'],
     [repeatMonthdayInput, repeatMonthdayRow.style.display !== 'none'],
     [repeatOrdinalInput, byWeekdayOfMonth], [repeatNthWeekdayInput, byWeekdayOfMonth],
     [repeatMonthInput, freq === 'yearly'], [repeatMonthlyModeInput, byMonth]
    ].forEach(function (pair) {
        if (!pair[1]) pair[0].disabled = true;
        else if (!isReadOnlyForm) pair[0].disabled = false;
    });
}

// What the repeat controls read back the moment they are filled in, before
// anyone has touched them. A rule the dialog cannot show whole - several months,
// a week number - does not come back out of these controls as the same thing
// that went in, and measuring "did the user change the repeat?" against the rule
// itself would call that difference a change nobody made, and rewrite a rule
// that should have been left exactly as another client wrote it.
let recurFormBaseline = null;

function populateRecurForm(recur) {
    repeatFreqInput.value = recur ? recur.freq : '';
    repeatIntervalInput.value = recur ? recur.interval : 1;
    repeatEndInput.value = recur ? recur.end : 'never';
    repeatUntilInput.value = (recur && recur.until) ? recur.until : '';
    repeatCountInput.value = (recur && recur.count) ? recur.count : 10;
    let byday = (recur && recur.byday) || [];
    setSelectedWeekdays(recur && recur.freq === 'weekly' ? byday : []);
    let ordinal = (recur && (recur.freq === 'monthly' || recur.freq === 'yearly') && byday.length)
        ? String(byday[0]).match(/^(-?\d+)(SU|MO|TU|WE|TH|FR|SA)$/) : null;
    repeatMonthlyModeInput.value = ordinal ? 'nthWeekday' : 'dayOfMonth';
    // Whatever the rule does not say is filled in from the start date, which
    // is where an event with no BY part of its own repeats anyway.
    let start = formStartDate();
    repeatOrdinalInput.value = ordinal ? ordinal[1] : String(nthWeekdayOfMonth(start));
    repeatNthWeekdayInput.value = ordinal ? ordinal[2] : weekdayCodeOf(start);
    repeatMonthdayInput.value = (recur && recur.bymonthday) || start.getDate();
    repeatMonthInput.value = (recur && recur.bymonth) || (start.getMonth() + 1);
    updateRepeatVisibility();
    recurFormBaseline = (recur && recur.source) ? recurFormFields(readRecurFromForm()) : null;
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
    let start = formStartDate();
    if (freq === 'weekly') {
        let days = selectedWeekdays();
        recur.byday = days.length ? days : [weekdayCodeOf(start)];
    } else if ((freq === 'monthly' || freq === 'yearly') && repeatMonthlyModeInput.value === 'nthWeekday') {
        recur.byday = [repeatOrdinalInput.value + repeatNthWeekdayInput.value];
        // A yearly rule needs its month named: without one, "the third Monday"
        // is the third Monday of the year rather than of a month.
        if (freq === 'yearly') {
            let month = parseInt(repeatMonthInput.value, 10);
            recur.bymonth = (month >= 1 && month <= 12) ? month : start.getMonth() + 1;
        }
    } else if (freq === 'monthly' || freq === 'yearly') {
        // A rule with no BY part of its own repeats on the start date's own day,
        // so only a day that differs from it is worth writing down - that keeps
        // every rule this app has already written byte for byte the same.
        // Anything the number field cannot give us falls back to the start
        // date, which is where a rule with no BY part repeats anyway - never
        // to NaN, which would reach the file as a rule nothing can read.
        let day = parseInt(repeatMonthdayInput.value, 10);
        let month = parseInt(repeatMonthInput.value, 10);
        if (!(day >= 1 && day <= 31)) day = start.getDate();
        if (!(month >= 1 && month <= 12)) month = start.getMonth() + 1;
        let ownDay = day === start.getDate();
        let ownMonth = month === start.getMonth() + 1;
        if (freq === 'yearly' && !(ownDay && ownMonth)) {
            // Both halves or neither: a rule that names only the month would
            // still take its day from the start date, and move with it.
            recur.bymonthday = day;
            recur.bymonth = month;
        } else if (freq === 'monthly' && !ownDay) {
            recur.bymonthday = day;
        }
    }
    return recur;
}

// --- Repeating tasks ---------------------------------------------------
// A task repeats through the same RRULE an event does - VTODO takes one, and
// every client that reads tasks over CalDAV honours it. The control is the
// short form task apps offer (how often, and how many of those): the weekday
// picker, the nth-weekday mode and the end conditions belong to an event's
// series, where occurrences are laid out on a grid. A rule from another
// client that says more than this is kept exactly as it came unless the user
// changes the repeat here.
let TASK_INTERVAL_UNITS = { daily: 'day(s)', weekly: 'week(s)', monthly: 'month(s)', yearly: 'year(s)' };

function updateTaskRepeatVisibility() {
    let freq = taskRepeatFreqInput.value;
    taskRepeatDetails.style.display = freq ? '' : 'none';
    taskRepeatIntervalUnit.textContent = TASK_INTERVAL_UNITS[freq] || 'day(s)';
}

function populateTaskRepeatForm(recur) {
    taskRepeatFreqInput.value = recur ? recur.freq : '';
    taskRepeatIntervalInput.value = recur ? recur.interval : 1;
    updateTaskRepeatVisibility();
}

// `existing` is what the task carried in: an unchanged rule is handed back
// untouched, so a COUNT, an UNTIL or a BYDAY this form cannot show survives
// an edit of the task's name.
function readTaskRepeatForm(existing) {
    let freq = taskRepeatFreqInput.value;
    if (!freq) return null;
    let interval = parseInt(taskRepeatIntervalInput.value, 10) || 1;
    if (existing && existing.freq === freq && existing.interval === interval) return existing;
    return { freq: freq, interval: interval, end: 'never', until: null, count: null, exdates: [], dtstart: null };
}

// Completing a repeating task moves it to its next occurrence rather than
// closing it - what every task app does with a repeat, and what a client
// reading the same VTODO expects to find. A series that has run out has no
// next occurrence, so that one completes for good.
function taskDueAsIcsLocal(task) {
    return toLocalInputValue(task.due, task.dueAllDay);
}

// The rule counts from where the series started, which is not where the task
// is now: advancing re-anchors nothing, or a rule limited to N occurrences
// would hand out N more every time one was ticked off.
function nextTaskOccurrence(task) {
    if (!task.recur || !task.due) return null;
    let recur = task.recur.dtstart ? task.recur
        : Object.assign({}, task.recur, { dtstart: taskDueAsIcsLocal(task) });
    let after = buildRRuleSet(recur, task.dueAllDay).after(toFakeUtc(task.due), false);
    return after ? fromFakeUtc(after) : null;
}

function nextEventId() {
    return 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// Distinct prefix from an event's, so a task can never collide with an
// event of the same name.
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
    return { location: ev.extendedProps.location, status: ev.extendedProps.status,
        description: ev.extendedProps.description, calendarId: ev.extendedProps.calendarId,
        reminder: ev.extendedProps.reminder, sourceLines: ev.extendedProps.sourceLines };
}

function colorForCalendarId(calendarId) {
    let cal = getCalendarById(calendarId);
    return cal ? cal.color : DEFAULT_CALENDAR_COLOR;
}

function buildRecurringEventPayload(id, title, allDay, extra, recur, durationMs) {
    // Not named `rrule`: that would shadow the rrule.js global this file
    // uses everywhere else.
    let rruleSpec = { freq: recur.freq, interval: recur.interval, dtstart: recur.dtstart };
    if (recur.end === 'until' && recur.until) rruleSpec.until = formatUntil(recur.until, recur.dtstart, allDay);
    if (recur.end === 'count' && recur.count) rruleSpec.count = recur.count;
    applyRRuleByParts(rruleSpec, recur);
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
        .replace(/\r\n|[\r\n]/g, '\\n');
}

function unescapeIcsText(str) {
    return str.replace(/\\(\\|;|,|[nN])/g, function (m, c) {
        return (c === 'n' || c === 'N') ? '\n' : c;
    });
}

// RFC 5545 folds at 75 octets, not characters: measured as UTF-8 and broken
// only between characters, so a multi-byte one is never cut in half.
let ICS_LINE_OCTETS = 75;
let utf8Encoder = new TextEncoder();
function foldIcsLine(line) {
    if (utf8Encoder.encode(line).length <= ICS_LINE_OCTETS) return line;
    let folded = '';
    let current = '';
    let used = 0;
    let budget = ICS_LINE_OCTETS;
    for (let ch of line) {
        let size = utf8Encoder.encode(ch).length;
        if (used + size > budget) {
            folded += (folded ? '\r\n ' : '') + current;
            current = '';
            used = 0;
            budget = ICS_LINE_OCTETS - 1;   // the continuation line's leading space
        }
        current += ch;
        used += size;
    }
    return folded + (folded ? '\r\n ' : '') + current;
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

// The fields the repeat form can set. A rule from another client may say more
// than these (BYMONTHDAY, BYSETPOS, several BYDAY ordinals); as long as none of
// them has been changed here, the file's own rule is written back untouched
// rather than narrowed to what this dialog happens to show.
function recurFormFields(recur) {
    return {
        freq: recur.freq,
        interval: recur.interval || 1,
        byday: (recur.byday || []).slice().sort().join(','),
        bymonthday: recur.bymonthday || null,
        bymonth: recur.bymonth || null,
        end: recur.end || 'never',
        until: recur.until || null,
        count: recur.count || null
    };
}

function sameRecurFields(a, b) {
    if (!a || !b) return false;
    let one = recurFormFields(a);
    return Object.keys(one).every(function (key) { return one[key] === b[key]; });
}

// Carries the original rule onto a recurrence the form just rebuilt, when the
// form did not actually change any of it - saving an event after renaming it
// must not rewrite its repeat.
function carryRecurSource(from, to) {
    if (!from || !to || !from.source) return;
    // The baseline when the dialog filled itself in from this rule, the rule's
    // own fields when it did not - an occurrence detached or excluded without
    // the dialog ever opening still has to keep the series' text.
    if (!sameRecurFields(to, recurFormBaseline || from.sourceFields)) return;
    to.source = from.source;
    // The fields this rule now reads as, not the ones the file parsed to: for a
    // rule the dialog cannot show whole the two differ, and writing it out asks
    // this same question again.
    to.sourceFields = recurFormFields(to);
}

function recurToIcsRRuleLine(recur, allDay, tzid) {
    // Exclusions are their own line, so a detached occurrence still leaves the
    // rule itself untouched.
    if (recur.source && sameRecurFields(recur, recur.sourceFields))
        return 'RRULE:' + recur.source;
    let freqMap = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', yearly: 'YEARLY' };
    let parts = ['FREQ=' + freqMap[recur.freq]];
    if (recur.interval > 1) parts.push('INTERVAL=' + recur.interval);
    if (recur.byday && recur.byday.length) parts.push('BYDAY=' + recur.byday.join(','));
    if (recur.bymonthday) parts.push('BYMONTHDAY=' + recur.bymonthday);
    if (recur.bymonth) parts.push('BYMONTH=' + recur.bymonth);
    // Read out of the file and carried back, though nothing here can set one.
    if (recur.bysetpos && recur.bysetpos.length) parts.push('BYSETPOS=' + recur.bysetpos.join(','));
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

// An entry's UID is its id, so the name it is filed under and the identity
// inside it are the same string - which is how the previous app and the
// Android mirror both find an entry again. This is the suffix earlier builds
// of this app appended, still stripped so those entries keep their id.
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
// The id also has to fit a filename, so an absurdly long UID is cut and given
// a hash of the whole of itself: still the same id every time that UID is read,
// and still distinct from another UID sharing its first 100 characters.
let MAX_EVENT_ID_LENGTH = 120;

function sanitizeEventId(id) {
    let safe = id.replace(/[\\\/\u0000-\u001f]/g, '_');
    if (safe === '' || safe === '.' || safe === '..') return nextEventId();
    if (safe.length <= MAX_EVENT_ID_LENGTH) return safe;
    let hash = 0;
    for (let i = 0; i < safe.length; i++) hash = (hash * 31 + safe.charCodeAt(i)) | 0;
    return safe.slice(0, MAX_EVENT_ID_LENGTH - 8) + '-' + (hash >>> 0).toString(36);
}

function idFromIcsUid(uid) {
    let id = uid.endsWith(PEERGOS_UID_SUFFIX) ? uid.slice(0, -PEERGOS_UID_SUFFIX.length) : uid;
    return sanitizeEventId(id);
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

// --- Keeping what this app does not model ---------------------------------
// An entry written elsewhere carries more than this app understands: attendees,
// an organiser, categories, X- properties, alarms it cannot show. Saving by
// rebuilding the block from the model would drop all of it, so the lines the
// file came with are kept and only the properties this app owns are replaced.
// Everything else stays exactly where it was, including a nested component's
// own properties (an alarm has a DESCRIPTION and a DURATION that are not the
// entry's). This is the same contract the Android mirror's writer keeps.
// UID and RECURRENCE-ID are owned too, and for the same reason as the rest: a
// single-occurrence override the previous app wrote is stored here as an event
// of its own, so it takes this app's id and stops claiming to replace an
// occurrence of another entry.
let OWNED_PROPERTIES = ['UID', 'RECURRENCE-ID', 'DTSTART', 'DTEND', 'DUE', 'DURATION', 'SUMMARY',
    'LOCATION', 'DESCRIPTION', 'STATUS', 'RRULE', 'EXDATE', 'DTSTAMP', 'LAST-MODIFIED',
    'PERCENT-COMPLETE', 'COMPLETED', 'PRIORITY'];

function icsPropertyName(line) {
    let end = line.length;
    for (let i = 0; i < line.length; i++) {
        let c = line.charAt(i);
        if (c === ':' || c === ';') {
            end = i;
            break;
        }
    }
    return line.slice(0, end).trim().toUpperCase();
}

function hasIcsProperty(lines, name) {
    return !!lines && lines.some(function (line) { return icsPropertyName(line) === name; });
}

// True for an alarm this app would itself have written: one it can show, and so
// one it is entitled to replace. Anything else is left where it is.
function isOwnAlarmBlock(lines) {
    let display = false;
    let ours = false;
    lines.forEach(function (line) {
        let name = icsPropertyName(line);
        if (name === 'ACTION') display = /:\s*DISPLAY\s*$/i.test(line);
        if (name !== 'TRIGGER') return;
        let parsed = parseIcsPropertyLine(line);
        if (!parsed) return;
        ours = parseIcsTriggerMinutes(parsed.value) !== null
            && (!parsed.params.VALUE || parsed.params.VALUE === 'DURATION')
            && parsed.params.RELATED !== 'END';
    });
    return display && ours;
}

// Replaces this app's own properties inside a stored VEVENT/VTODO block, adds
// the ones that were missing, and drops nothing else.
// The block as the file had it: the reader lifts alarms out of an entry's own
// lines, and the writer needs them back to know what it is replacing.
function storedBlockLines(kind, blockLines) {
    let out = ['BEGIN:' + kind].concat(blockLines.slice());
    (blockLines.alarms || []).forEach(function (alarm) {
        out = out.concat(['BEGIN:VALARM'], alarm, ['END:VALARM']);
    });
    out.push('END:' + kind);
    return out;
}

function patchIcsBlock(sourceLines, ownLines) {
    let replacements = Object.create(null);
    let alarm = [];
    let order = [];
    let inOwnAlarm = false;
    ownLines.forEach(function (line) {
        let name = icsPropertyName(line);
        if (name === 'BEGIN' && /VALARM\s*$/i.test(line)) {
            inOwnAlarm = true;
            alarm.push(line);
            return;
        }
        if (inOwnAlarm) {
            alarm.push(line);
            if (name === 'END') inOwnAlarm = false;
            return;
        }
        // The block's own BEGIN/END belong to the file being patched, not to this.
        if (name === 'BEGIN' || name === 'END') return;
        if (!replacements[name]) order.push(name);
        // Repeated properties (EXDATE can be one per date) collect in order.
        replacements[name] = (replacements[name] || []).concat([line]);
    });

    let out = [];
    let pending = null;
    let nested = 0;
    sourceLines.forEach(function (line, index) {
        let name = icsPropertyName(line);
        // The block's own first and last lines: everything between them is what is patched.
        if (index === 0 || index === sourceLines.length - 1) {
            out.push(line);
            return;
        }
        if (pending !== null) {
            pending.push(line);
            if (name === 'BEGIN') nested++;
            if (name === 'END' && --nested === 0) {
                if (!isOwnAlarmBlock(pending)) out = out.concat(pending);
                pending = null;
            }
            return;
        }
        if (nested === 0 && name === 'BEGIN' && /VALARM\s*$/i.test(line)) {
            pending = [line];
            nested = 1;
            return;
        }
        if (name === 'BEGIN') {
            nested++;
            out.push(line);
            return;
        }
        if (nested > 0) {
            if (name === 'END') nested--;
            out.push(line);
            return;
        }
        if (OWNED_PROPERTIES.indexOf(name) === -1) {
            out.push(line);
            return;
        }
        if (replacements[name]) {
            out = out.concat(replacements[name]);
            delete replacements[name];
        }
        // An owned property the entry no longer has is dropped with its line.
    });
    let closing = out.pop();
    order.forEach(function (name) {
        if (replacements[name]) out = out.concat(replacements[name]);
    });
    out = out.concat(alarm);
    out.push(closing);
    return out;
}

function eventToIcsLines(ev) {
    let uid = ev.id;
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
    lines.push('LAST-MODIFIED:' + icsUtcStamp(new Date()));
    // Who made it. The previous app writes this and treats an entry that names
    // nobody as read-only, so one created here would be stuck that way there
    // without it. An entry that already names an owner keeps the one it has.
    if (hostUsername && !hasIcsProperty(ev.extendedProps.sourceLines, 'X-OWNER'))
        lines.push('X-OWNER:' + escapeIcsText(hostUsername));
    reminderToIcsLines(ev.extendedProps.reminder, ev.title).forEach(function (line) { lines.push(line); });
    lines.push('END:VEVENT');
    let source = ev.extendedProps.sourceLines;
    return source ? patchIcsBlock(source, lines) : lines;
}

// --- Tasks ---
// A task is an iCalendar VTODO - the same file format events already use,
// so one written here opens in Thunderbird, Nextcloud Tasks or anything
// else that reads .ics. What separates it from an event is that DUE is
// optional: a task with no date has no year/month bucket to live in, which
// is why tasks get a directory of their own (see the README).
function taskToIcsLines(task) {
    let uid = task.id;
    let lines = ['BEGIN:VTODO', 'UID:' + uid, 'DTSTAMP:' + icsUtcStamp(new Date())];
    if (task.due) lines.push(icsDtLine('DUE', task.due, task.dueAllDay));
    lines.push('SUMMARY:' + escapeIcsText(task.title));
    if (task.description) lines.push('DESCRIPTION:' + escapeIcsText(task.description));
    if (task.priority && task.priority !== ICS_PRIORITY_NORMAL) lines.push('PRIORITY:' + task.priority);
    if (task.completed) {
        lines.push('STATUS:COMPLETED');
        lines.push('PERCENT-COMPLETE:100');
        lines.push('COMPLETED:' + icsUtcStamp(task.completedAt || new Date()));
    } else {
        lines.push('STATUS:NEEDS-ACTION');
    }
    lines.push('LAST-MODIFIED:' + icsUtcStamp(new Date()));
    // Both of these count from the due date, so an undated task carries
    // neither. The rule is written the same way an event's is.
    if (task.due && task.recur) {
        lines.push(recurToIcsRRuleLine(Object.assign({}, task.recur, {
            dtstart: toLocalInputValue(task.due, task.dueAllDay)
        }), task.dueAllDay, null));
    }
    if (task.due) reminderToIcsLines(task.reminder, task.title).forEach(function (line) { lines.push(line); });
    lines.push('END:VTODO');
    return task.sourceLines ? patchIcsBlock(task.sourceLines, lines) : lines;
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
    // A repeating task: the rule counts from the due date, so a task without
    // one cannot carry it however the file was written.
    let rruleLine = find('RRULE');
    let recur = (dueLine && rruleLine)
        ? parseIcsRRuleValue(rruleLine.value, dueLine.params.TZID, tzResolver) : null;
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
        priority: (priority >= 1 && priority <= 9) ? priority : ICS_PRIORITY_NORMAL,
        reminder: parseIcsAlarms(rawLines.alarms),
        recur: recur,
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
        requestShare(Object.assign({ target: 'event' }, hostEventRef(ev)), ev.title);
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
// The zone a property is written in, from its parameters only - a TZID that
// appears in a value is text, not a reference.
function tzidOfIcsLine(line) {
    let colon = line.indexOf(':');
    let match = /;TZID=("?)([^;"]+)\1/i.exec(colon === -1 ? line : line.slice(0, colon));
    return match ? match[2] : null;
}

function buildIcsDocument(veventLines) {
    // Every TZID named in the document gets its zone defined in the same
    // document. This app writes LOCAL_TZ, but a property it preserved rather
    // than wrote can name another zone, and dropping that zone's definition
    // would leave the file saying less than the one it came from.
    let zones = [];
    veventLines.forEach(function (line) {
        let zone = tzidOfIcsLine(line);
        if (zone && zones.indexOf(zone) === -1) zones.push(zone);
    });
    let definitions = [];
    zones.forEach(function (zone) {
        try {
            definitions = definitions.concat(buildVTimeZoneBlock(zone));
        } catch (e) {
            // A zone name no browser knows (a Windows one, say). The TZID stays
            // on its property either way; only the definition can't be written.
        }
    });
    let lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Peergos//Calendar 0.0.1//EN', 'CALSCALE:GREGORIAN']
        .concat(definitions)
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

// Exporting the grid alone would write out only the months that happen to
// have been fetched - a silently partial file, which is the worst thing to
// hand someone who is keeping a copy. So the whole calendar is swept first
// and the file is built from that.
function exportCalendarAsIcs(calendarId) {
    let cal = getCalendarById(calendarId);
    if (!cal) return;
    // The host's spinner covers the page, but the keyboard still reaches
    // this frame - one export at a time.
    if (exportInFlight) {
        showToast('An export is already running');
        return;
    }
    exportInFlight = cal.id;
    let stored = Object.create(null);
    let asked = requestSweep({
        reason: 'export',
        calendarName: cal.id,
        onBatch: function (batch) {
            forEachParsedEntry(batch.items, function (parsed, entry) {
                parsed.events.forEach(function (payload) {
                    stored[payload.id] = eventShapeFromPayload(payload, entry.calendarName);
                });
            });
        },
        onDone: function (done) {
            exportInFlight = null;
            finishCalendarExport(cal, stored, done);
        }
    });
    if (!asked) {
        exportInFlight = null;
        showToast('Not ready yet - try again in a moment');
    }
}

function finishCalendarExport(cal, stored, done) {
    if (done.error === 'busy') {
        showToast('Still finishing the last export - try again in a moment', 4000);
        return;
    }
    // Anything short of a complete read is reported rather than written: a
    // file missing a year looks exactly like a file that is fine.
    if (done.error || done.failed > 0 || done.capped) {
        showToast('Could not read all of ' + cal.name + ', so nothing was exported', 5000);
        return;
    }
    // The live copy wins: an event edited in this session may still be on
    // its way to the store, and the swept copy would be the older one.
    allStoredEvents().forEach(function (ev) {
        // The grid copy of a task is not an event - it would export as a
        // VEVENT and come back from any other client as one.
        if (ev.extendedProps.isTask) return;
        if (ev.extendedProps.calendarId === cal.id) stored[ev.id] = ev;
    });
    let lines = [];
    Object.keys(stored).forEach(function (id) { lines = lines.concat(eventToIcsLines(stored[id])); });
    tasks.forEach(function (task) {
        if (task.calendarId === cal.id) lines = lines.concat(taskToIcsLines(task));
    });
    if (!lines.length) {
        showToast('There is nothing in ' + cal.name + ' to export');
        return;
    }
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

    // What the repeat form can show: plain weekday codes on WEEKLY, one ordinal
    // code on MONTHLY, a single day of the month, and a single month on YEARLY.
    // Anything else - several days, a week number, a day of the year - still
    // loads, and the import says it could only be shown simplified; the rule
    // itself is written back as it came unless the form changes it.
    let codes = props.BYDAY ? props.BYDAY.split(',') : [];
    let isPlainCode = function (c) { return /^(SU|MO|TU|WE|TH|FR|SA)$/.test(c); };
    let isOrdinalCode = function (c) { return /^-?\d+(SU|MO|TU|WE|TH|FR|SA)$/.test(c); };
    let bydaySupported =
        (freq === 'weekly' && codes.length && codes.every(isPlainCode)) ||
        ((freq === 'monthly' || freq === 'yearly') && codes.length === 1 && isOrdinalCode(codes[0]));
    let single = function (raw, low, high) {
        if (raw == null || raw.indexOf(',') !== -1) return null;
        let n = parseInt(raw, 10);
        return n >= low && n <= high ? n : null;
    };
    // Numbers, not the raw text: these are handed to the occurrence engine too,
    // which rejects the whole rule if a value arrives as a string.
    let numbers = function (raw) {
        return (raw || '').split(',')
            .map(function (p) { return parseInt(p, 10); })
            .filter(function (n) { return isFinite(n) && n !== 0; });
    };
    let several = function (raw, low, high) {
        let all = numbers(raw);
        return all.length > 1 && all.every(function (n) { return n >= low && n <= high; }) ? all : null;
    };
    let monthday = single(props.BYMONTHDAY, 1, 31);
    let month = single(props.BYMONTH, 1, 12);
    if (monthday != null && (freq === 'monthly' || freq === 'yearly')) recur.bymonthday = monthday;
    if (month != null && freq === 'yearly') recur.bymonth = month;
    // The parts below have no control of their own. They are read out of the
    // file so the entry is drawn on the days its rule actually names rather
    // than on its start date, and kept apart from the fields the form
    // round-trips so the rule is still written back from the file's own text.
    // "The 1st and the 15th", "March, June and September": one number is all
    // the form has a box for, so a rule naming several is kept beside it.
    let monthdays = several(props.BYMONTHDAY, 1, 31);
    if (monthdays) recur.bymonthdayList = monthdays;
    let months = several(props.BYMONTH, 1, 12);
    if (months) recur.bymonthList = months;
    let positions = numbers(props.BYSETPOS);
    if (positions.length) recur.bysetpos = positions;
    let weekNumbers = numbers(props.BYWEEKNO);
    if (weekNumbers.length) recur.byweekno = weekNumbers;
    let yearDays = numbers(props.BYYEARDAY);
    if (yearDays.length) recur.byyearday = yearDays;
    // Which day a week starts on, for a weekly rule that skips weeks: without
    // it such a rule can land a week away from where the file meant.
    if (/^(SU|MO|TU|WE|TH|FR|SA)$/.test(props.WKST || '')) recur.wkst = props.WKST;
    let hasOtherByParts = props.BYYEARDAY || props.BYWEEKNO || props.BYSETPOS
        || (props.BYMONTHDAY && recur.bymonthday == null)
        || (props.BYMONTH && recur.bymonth == null);

    recur.source = value;
    if ((props.BYDAY && !bydaySupported) || hasOtherByParts) {
        // Temporary marker, not part of the recurrence data model -
        // parseIcsVevent strips it and re-stamps it on the event payload,
        // on its way to the import summary (formatImportSummary).
        recur.simplified = true;
        // Plain weekday codes the dialog cannot offer for this frequency still
        // limit which days the rule lands on: "every weekday" as some clients
        // write it (daily, filtered), the weekday a week-number rule picks out,
        // the days a BYSETPOS counts among. They have to reach the occurrence
        // engine, or the entry is drawn on days its own rule excludes.
        // Deliberately not one of the fields the form round-trips: a rule the
        // dialog cannot show is written back exactly as it came, and that has
        // to stay true.
        if (codes.length && codes.every(isPlainCode)) recur.bydayFilter = codes;
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
    recur.sourceFields = recurFormFields(recur);
    return recur;
}

// --- Reminders ---------------------------------------------------------
// One reminder per entry, held as minutes before the start (or before the
// due date, for a task). That is the shape the dialogs offer and the shape a
// notification needs; the file keeps it as a VALARM, which is what every
// other calendar reads.
let REMINDER_CHOICES = [
    { minutes: null, label: 'None' },
    { minutes: 0, label: 'At the time' },
    { minutes: 5, label: '5 minutes before' },
    { minutes: 10, label: '10 minutes before' },
    { minutes: 15, label: '15 minutes before' },
    { minutes: 30, label: '30 minutes before' },
    { minutes: 60, label: '1 hour before' },
    { minutes: 120, label: '2 hours before' },
    { minutes: 1440, label: '1 day before' },
    { minutes: 2880, label: '2 days before' },
    { minutes: 10080, label: '1 week before' }
];

function fillReminderChoices(select) {
    REMINDER_CHOICES.forEach(function (choice) {
        let option = document.createElement('option');
        option.value = choice.minutes == null ? '' : String(choice.minutes);
        option.textContent = choice.label;
        select.appendChild(option);
    });
}

function readReminderSelect(select) {
    return select.value === '' ? null : parseInt(select.value, 10);
}

// A reminder the app has no choice for - another client's 3 hours, say - is
// kept rather than snapped to the nearest offered one, so editing an entry
// does not quietly reschedule its alarm.
function showReminderIn(select, minutes) {
    if (minutes != null && !REMINDER_CHOICES.some(function (c) { return c.minutes === minutes; })) {
        let option = document.createElement('option');
        option.value = String(minutes);
        option.textContent = describeReminder(minutes);
        option.dataset.foreign = '1';
        select.appendChild(option);
    }
    select.querySelectorAll('option[data-foreign]').forEach(function (option) {
        if (minutes == null || option.value !== String(minutes)) option.remove();
    });
    select.value = minutes == null ? '' : String(minutes);
}

// The occurrences of one entry inside a window: a single event is its own,
// a series is expanded through the same RRuleSet the grid and search use, so
// an excluded date stays excluded here too.
function recurOccurrencesBetween(ev, from, to) {
    let recur = ev.extendedProps.recur;
    if (!recur) return ev.start && ev.start >= from && ev.start <= to ? [ev.start] : [];
    let set = buildRRuleSet(recur, ev.allDay);
    // A reminder fires before its occurrence, so the window has to open
    // early enough to catch one that has already started counting down.
    return set.between(toFakeUtc(new Date(from.getTime() - 8 * 86400000)), toFakeUtc(to), true)
        .map(fromFakeUtc);
}

// What the platform is asked to ring, and when. Only the near future is
// sent - a phone will not hold thousands of alarms, and the list is rebuilt
// whenever the grid changes, so anything further out is picked up later.
let REMINDER_HORIZON_DAYS = 14;
let MAX_SCHEDULED_REMINDERS = 40;

function collectReminders() {
    let now = Date.now();
    let until = now + REMINDER_HORIZON_DAYS * 86400000;
    let out = [];
    let add = function (id, at, title, calendarId) {
        if (at <= now || at > until) return;
        out.push({ id: id, at: at, title: title, calendar: calendarId || '' });
    };
    allStoredEvents().forEach(function (ev) {
        let minutes = ev.extendedProps.reminder;
        // A task on the grid is a view of the task itself, which is counted
        // below; a hidden calendar is one the user has just put away, and an
        // alert from it would be exactly the noise hiding it removed.
        if (ev.extendedProps.isTask || minutes == null) return;
        if (ev.extendedProps.status === 'cancelled' || !isCalendarVisible(ev.extendedProps.calendarId)) return;
        // A series rings for each occurrence in the window, not once.
        recurOccurrencesBetween(ev, new Date(now), new Date(until)).forEach(function (occurrence) {
            add(ev.id + '@' + occurrence.getTime(), occurrence.getTime() - minutes * 60000,
                ev.title, ev.extendedProps.calendarId);
        });
    });
    tasks.forEach(function (task) {
        if (task.reminder == null || !task.due || task.completed) return;
        if (!isCalendarVisible(task.calendarId)) return;
        add(task.id, task.due.getTime() - task.reminder * 60000, task.title, task.calendarId);
    });
    return out.sort(function (a, b) { return a.at - b.at; }).slice(0, MAX_SCHEDULED_REMINDERS);
}

// Rebuilt and resent as a whole list rather than one message per change: the
// host cancels what it had and schedules this, so a deleted or moved entry
// cannot leave a stray alarm behind.
let reminderSyncPending = false;

function scheduleReminders() {
    if (reminderSyncPending || isGuestSession) return;
    reminderSyncPending = true;
    setTimeout(function () {
        reminderSyncPending = false;
        hostSend({ type: 'reminders', items: collectReminders() });
    }, 500);
}

function describeReminder(minutes) {
    if (minutes === 0) return 'At the time';
    let unit = function (n, name) { return n + ' ' + name + (n === 1 ? '' : 's') + ' before'; };
    if (minutes % 10080 === 0) return unit(minutes / 10080, 'week');
    if (minutes % 1440 === 0) return unit(minutes / 1440, 'day');
    if (minutes % 60 === 0) return unit(minutes / 60, 'hour');
    return unit(minutes, 'minute');
}

// RFC 5545 durations, as far as a reminder needs: -P1DT2H30M and the like.
// Anything else - an absolute trigger, a repeat, a duration in weeks that
// isn't a whole number of minutes - is left alone rather than guessed at.
function parseIcsTriggerMinutes(value) {
    let m = String(value).match(/^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
    if (!m) return null;
    let minutes = (+m[2] || 0) * 10080 + (+m[3] || 0) * 1440 + (+m[4] || 0) * 60 + (+m[5] || 0) + Math.round((+m[6] || 0) / 60);
    return m[1] === '-' ? minutes : -minutes;
}

// The first alarm that triggers relative to the start. A file can hold
// several, and other clients write ones we have no UI for (email, repeats);
// those are read as "no reminder" rather than silently rewritten.
function parseIcsAlarms(alarmBlocks) {
    let found = null;
    (alarmBlocks || []).forEach(function (blockLines) {
        if (found !== null) return;
        let props = blockLines.map(parseIcsPropertyLine).filter(Boolean);
        let trigger = props.find(function (p) { return p.name === 'TRIGGER'; });
        if (!trigger || (trigger.params.VALUE && trigger.params.VALUE !== 'DURATION')) return;
        if (trigger.params.RELATED === 'END') return;
        let minutes = parseIcsTriggerMinutes(trigger.value);
        if (minutes !== null && minutes >= 0) found = minutes;
    });
    return found;
}

// Zero parts are left out, the way other clients write them: P1D, PT1H30M.
function icsDurationFor(minutes) {
    let days = Math.floor(minutes / 1440);
    let hours = Math.floor((minutes % 1440) / 60);
    let mins = minutes % 60;
    let time = (hours ? hours + 'H' : '') + (mins ? mins + 'M' : '');
    if (!days && !time) return 'PT0M';
    return 'P' + (days ? days + 'D' : '') + (time ? 'T' + time : '');
}

function reminderToIcsLines(minutes, summary) {
    if (minutes == null) return [];
    return ['BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-' + icsDurationFor(minutes),
        'DESCRIPTION:' + escapeIcsText(summary || 'Reminder'), 'END:VALARM'];
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
        recur.dtstart = toLocalInputValue(start, allDay);
        findAll('EXDATE').forEach(function (l) {
            l.value.split(',').forEach(function (v) {
                let parsed = parseIcsDateValue(v.trim(), l.params, tzResolver);
                if (parsed) recur.exdates.push(toLocalInputValue(parsed.date, allDay));
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
        reminder: parseIcsAlarms(rawLines.alarms),
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
        let occurrence = toLocalInputValue(overrideParsed.date, overrideParsed.allDay);
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
    let alarm = null;
    lines.forEach(function (line) {
        // A VALARM sits inside its event or task. Its lines are collected
        // separately rather than left in the parent's: they carry their own
        // DESCRIPTION and DTSTAMP, which would otherwise be read as the
        // event's own by whichever comes first in the file.
        if (current && line === 'BEGIN:VALARM') {
            alarm = [];
        } else if (alarm && line === 'END:VALARM') {
            current.alarms.push(alarm);
            alarm = null;
        } else if (alarm) {
            alarm.push(line);
        } else if (line.indexOf('BEGIN:') === 0 && blocks[line.slice('BEGIN:'.length)]) {
            current = [];
            current.alarms = [];
            currentKind = line.slice('BEGIN:'.length);
        } else if (currentKind && line === 'END:' + currentKind) {
            if (current) blocks[currentKind].push(current);
            current = null;
            currentKind = null;
            alarm = null;
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
        if (ev) {
            ev.extendedProps.sourceLines = storedBlockLines('VEVENT', blockLines);
            events.push(ev);
        } else {
            failed++;
        }
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
        if (task) {
            task.sourceLines = storedBlockLines('VTODO', blockLines);
            tasks.push(task);
        } else {
            failed++;
        }
    });

    return { events: events, tasks: tasks, failed: failed };
}

// The series back on the grid and in the store under its own id, carrying a
// rule that has just been changed: the length it was drawn with is the length
// it keeps, since the occurrences move but the events do not get longer.
function replaceMasterSeries(master, masterRecur) {
    let durationMs = (master.end || master.start).getTime() - master.start.getTime();
    let payload = buildRecurringEventPayload(master.id, master.title, master.allDay,
        extraPropsOf(master), masterRecur, durationMs);
    master.remove();
    addAndPersist(payload);
}

// Shared by "delete this occurrence" and "edit this occurrence" (the
// latter also adds a standalone replacement event for the edited data).
function excludeOccurrenceFromMaster(master) {
    let masterRecur = Object.assign({}, master.extendedProps.recur);
    let occurrenceStr = toLocalInputValue(master.start, master.allDay);
    masterRecur.exdates = (masterRecur.exdates || []).concat([occurrenceStr]);
    replaceMasterSeries(master, masterRecur);
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
    replaceMasterSeries(master, masterRecur);
}

// --- Drag to move ---------------------------------------------------------
function dragAllowed(ev, newStart) {
    if (!ev || ev.extendedProps.isTask) return false;
    if (isGuestSession || !isCalendarWritable(ev.extendedProps.calendarId)) return false;
    if (ev.extendedProps.recur && ev.start && toDateInputValue(ev.start) !== toDateInputValue(newStart)) return false;
    return true;
}

// FullCalendar has already moved the event on the grid when this runs. A plain
// event's file simply follows. A repeating occurrence is put back and the change
// applied through the scope dialog, to a copy the series no longer draws.
let pendingMove = null;
function handleDragChange(info) {
    hideEventPopover();
    let ev = info.event;
    if (!ev.extendedProps.recur) {
        persistEvent(ev);
        return;
    }
    let durationMs = ev.end ? ev.end.getTime() - ev.start.getTime() : recurringDurationMs(ev.id);
    pendingMove = { start: ev.start, end: ev.end, allDay: ev.allDay, durationMs: durationMs };
    info.revert();
    // The occurrence as it was, not the handle that still reads as moved: the
    // exclusion or the cut-off is computed from where it stood.
    openScopeModal(info.oldEvent, 'move');
}

function moveOccurrence(ev, scope, moved) {
    let extra = extraPropsOf(ev);
    if (scope === 'all') {
        // Every occurrence: the series' own start shifts by as much as this one
        // did within its day, and all of them take the new length.
        let recur = Object.assign({}, ev.extendedProps.recur);
        let shiftMs = moved.start.getTime() - ev.start.getTime();
        let first = new Date((recur.dtstart ? toStoredDate(recur.dtstart) : ev.start).getTime() + shiftMs);
        recur.dtstart = toLocalInputValue(first, moved.allDay);
        let payload = buildRecurringEventPayload(ev.id, ev.title, moved.allDay, extra, recur, moved.durationMs);
        ev.remove();
        addAndPersist(payload);
        return;
    }
    if (scope === 'following') {
        let recur = adjustRecurForFollowing(ev, ev.extendedProps.recur, moved.allDay);
        recur.dtstart = toLocalInputValue(moved.start, moved.allDay);
        truncateMasterSeries(ev);
        addAndPersist(buildRecurringEventPayload(nextEventId(), ev.title, moved.allDay, extra, recur, moved.durationMs));
        return;
    }
    excludeOccurrenceFromMaster(ev);
    addAndPersist(buildPlainEventPayload(nextEventId(), ev.title, moved.allDay, moved.start, moved.end, extra));
}

let recurFreqLabels = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
let recurIntervalUnits = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' };

function describeRecur(recur) {
    let text = recur.interval > 1
        ? 'Every ' + recur.interval + ' ' + recurIntervalUnits[recur.freq]
        : recurFreqLabels[recur.freq];
    let ordinal = (recur.freq === 'monthly' && (recur.byday || []).length)
        ? String(recur.byday[0]).match(/^(-?\d+)(SU|MO|TU|WE|TH|FR|SA)$/) : null;
    if (ordinal) text += ' on the ' + ORDINAL_LABELS[ordinal[1]] + ' ' + WEEKDAY_LABELS[ordinal[2]];
    else if (recur.bymonth && recur.bymonthday) text += ' on ' + MONTH_LABELS[recur.bymonth] + ' ' + recur.bymonthday;
    else if (recur.bymonthday) text += ' on day ' + recur.bymonthday;
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

// Places a floating box (a popover, a row's menu, the date picker) against the
// control it belongs to: below when it fits, above when it doesn't, and always
// inside the window. Every one of them is position:fixed, so these are
// viewport coordinates.
function placeFloatingBox(box, anchorRect, gap, align) {
    let margin = 8;
    let below = anchorRect.bottom + gap;
    let above = anchorRect.top - box.offsetHeight - gap;
    let top = below + box.offsetHeight <= window.innerHeight - margin ? below
        : (above >= margin ? above : below);
    let left = align === 'right' ? anchorRect.right - box.offsetWidth
        : (align === 'center' ? anchorRect.left + anchorRect.width / 2 - box.offsetWidth / 2
           : anchorRect.left);
    box.style.top = Math.max(margin, Math.min(top, window.innerHeight - box.offsetHeight - margin)) + 'px';
    box.style.left = Math.max(margin, Math.min(left, window.innerWidth - box.offsetWidth - margin)) + 'px';
}

function positionPopover(anchorEl) {
    placeFloatingBox(popover, anchorEl.getBoundingClientRect(), 8, 'left');
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

// --- Whole-calendar sweep ----------------------------------------------
// The grid holds only the months it has fetched, so search and export ask the
// host to walk the rest of the store. What comes back stays in memory for the
// session and never enters the grid: the store stays authoritative, and a
// swept hit navigates to its month to be rendered the usual way.

// How long a completed sweep is treated as current before another is worth
// running. Another device may have written in the meantime; re-sweeping
// replaces each month it re-reads, so entries deleted elsewhere disappear.
let SWEEP_FRESH_MS = 5 * 60 * 1000;

let searchIndex = [];
let sweepRequests = Object.create(null);
let nextSweepRequestId = 1;
let searchSweep = { running: false, finishedAt: 0, capped: false, failed: 0 };
let searchRerenderTimer = null;
let exportInFlight = null;
let pendingSearchJump = null;
let SEARCH_JUMP_TIMEOUT_MS = 15000;

function requestSweep(options) {
    let requestId = nextSweepRequestId++;
    sweepRequests[requestId] = { onBatch: options.onBatch || null, onDone: options.onDone || null };
    let sent = hostSend({ type: 'sweep', requestId: requestId, reason: options.reason,
        calendarName: options.calendarName == null ? null : options.calendarName });
    // Asked for before the host said hello - focusing the search box during a
    // slow start will do it. Forget the request rather than wait out the
    // session for a reply that was never asked for.
    if (!sent) delete sweepRequests[requestId];
    return sent;
}

// The host answers every request it accepts, so anything that arrives
// without a matching request is a reply this frame no longer has a use for -
// a walk left over from before a reload - and is dropped.
function handleSweepBatch(data) {
    let request = sweepRequests[data.requestId];
    if (!request || !request.onBatch) return;
    request.onBatch(data);
}

function handleSweepDone(data) {
    let request = sweepRequests[data.requestId];
    if (!request) return;
    delete sweepRequests[data.requestId];
    if (request.onDone) request.onDone(data);
}

// Dropped on every `load`: the host cancels its walks at the same moment,
// and stale entries would otherwise outlive the calendars they belong to.
// The request counter deliberately keeps climbing - restarting it would let a
// reply still in flight match a request made after the reset.
function resetSweepState() {
    searchIndex = [];
    sweepRequests = Object.create(null);
    searchSweep = { running: false, finishedAt: 0, capped: false, failed: 0 };
    exportInFlight = null;
    pendingSearchJump = null;
}

// A stored payload in the shape the grid's own events have, which is all
// both search rows and eventToIcsLines() need.
function eventShapeFromPayload(payload, calendarName) {
    let extra = payload.extendedProps || {};
    return {
        id: payload.id,
        title: payload.title || '',
        allDay: !!payload.allDay,
        start: toStoredDate(payload.start),
        end: toStoredDate(payload.end),
        extendedProps: {
            calendarId: calendarName,
            location: extra.location || '',
            description: extra.description || '',
            status: extra.status || '',
            recur: extra.recur || null
        }
    };
}

function toStoredDate(value) {
    if (value == null) return null;
    if (value instanceof Date) return value;
    let text = String(value);
    // A bare date is local midnight, not UTC - the rule the recurring path
    // already uses, or an all-day entry lands a day early west of Greenwich.
    return new Date(text.length === 10 ? text + 'T00:00' : text);
}

// Replaces the month wholesale rather than merging into it: a re-read after
// another device edited that month has to lose what that device deleted.
function indexSweptMonth(batch) {
    let records = [];
    forEachParsedEntry(batch.items, function (parsed, entry) {
        parsed.events.forEach(function (payload) {
            let shape = eventShapeFromPayload(payload, entry.calendarName);
            shape.yearMonth = batch.yearMonth;
            shape.haystack = (shape.title + ' ' + shape.extendedProps.location
                + ' ' + shape.extendedProps.description).toLowerCase();
            records.push(shape);
        });
    });
    searchIndex = searchIndex.filter(function (rec) {
        return rec.yearMonth !== batch.yearMonth || rec.extendedProps.calendarId !== batch.calendarName;
    }).concat(records);
}

// Runs at most one search sweep, and only when the last one is stale enough
// to be worth repeating - focusing the search box twenty times in a row must
// not send twenty walks.
function ensureSearchIndex() {
    if (searchSweep.running) return;
    if (searchSweep.finishedAt && Date.now() - searchSweep.finishedAt < SWEEP_FRESH_MS) return;
    searchSweep.capped = false;
    searchSweep.failed = 0;
    searchSweep.running = requestSweep({
        reason: 'search',
        onBatch: function (batch) {
            indexSweptMonth(batch);
            scheduleSearchRerender();
        },
        onDone: function (done) {
            searchSweep.running = false;
            // A refused or cancelled walk indexed nothing, so it must not
            // count as a fresh one - the next focus should try again.
            searchSweep.finishedAt = done.error ? 0 : Date.now();
            searchSweep.capped = !!done.capped;
            searchSweep.failed = done.failed || 0;
            scheduleSearchRerender();
        }
    });
}

// Batches land in quick succession; repainting the list on each one would
// fight the typing that opened it.
function scheduleSearchRerender() {
    if (searchRerenderTimer) return;
    searchRerenderTimer = setTimeout(function () {
        searchRerenderTimer = null;
        if (searchResults.classList.contains('open') && searchInput.value.trim()) {
            renderSearchResults(searchInput.value);
        }
    }, 250);
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
    return searchResultRow({
        color: calendarColorFor(task.calendarId),
        title: task.title,
        struck: task.completed,
        badge: { title: 'Task', svg: '<path d="M5 12l5 5l9 -9"/>' },
        meta: task.completed ? 'Task · Done' : (formatTaskDue(task) || 'Task · No date'),
        onClick: function () {
            if (task.due) calendar.gotoDate(task.due);
            openTaskModal('edit', task);
        }
    });
}

// One row shape for an event hit and a task hit: a colour dot, the title, a
// badge for what kind of thing it is, and a line of context underneath.
function searchResultRow(row) {
    let item = document.createElement('button');
    item.type = 'button';
    item.className = 'search-result-item';
    let titleRow = document.createElement('div');
    titleRow.className = 'search-result-title-row';
    if (row.color) {
        let dot = document.createElement('span');
        dot.className = 'search-result-dot';
        dot.style.backgroundColor = row.color;
        titleRow.appendChild(dot);
    }
    let titleSpan = document.createElement('span');
    titleSpan.className = 'search-result-title';
    if (row.struck) titleSpan.classList.add('search-result-cancelled');
    titleSpan.textContent = row.title;
    titleRow.appendChild(titleSpan);
    if (row.badge) {
        let badge = document.createElement('span');
        badge.className = 'search-result-badge';
        badge.title = row.badge.title;
        badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + row.badge.svg + '</svg>';
        titleRow.appendChild(badge);
    }
    let metaRow = document.createElement('div');
    metaRow.className = 'search-result-meta';
    metaRow.textContent = row.meta;
    item.appendChild(titleRow);
    item.appendChild(metaRow);
    // Otherwise the "click outside closes popover" listener closes the
    // popover the jump just opened, on the same event.
    item.addEventListener('click', function (e) {
        e.stopPropagation();
        closeSearchResults();
        row.onClick();
    });
    return item;
}

function getSearchableEvents(query) {
    let q = query.trim().toLowerCase();
    if (q.length < MIN_SEARCH_QUERY_LENGTH) return [];
    let results = [];
    let matches = function (ev) {
        return (ev.title || '').toLowerCase().indexOf(q) !== -1
            || (ev.extendedProps.location || '').toLowerCase().indexOf(q) !== -1
            || (ev.extendedProps.description || '').toLowerCase().indexOf(q) !== -1;
    };
    let onGrid = Object.create(null);
    allStoredEvents().forEach(function (ev) {
        if (ev.extendedProps.isTask) return;
        onGrid[ev.id] = true;
        if (!matches(ev)) return;
        let jumpDate = ev.start || nearestRecurOccurrenceDate(ev.extendedProps.recur, ev.allDay, new Date());
        results.push({ event: ev, jumpDate: jumpDate });
    });
    // Swept months the grid does not hold. The grid answers for the months it
    // has, because only those copies carry edits and deletions made here.
    searchIndex.forEach(function (rec) {
        if (onGrid[rec.id] || loadedYearMonths[rec.yearMonth]) return;
        // Matched against the folded copy made when the month was indexed:
        // the index runs to tens of thousands of entries, and re-lowercasing
        // three fields of each on every keystroke is work with no result.
        if (rec.haystack.indexOf(q) === -1) return;
        results.push({ event: rec, indexed: true, jumpDate: rec.start });
    });
    // Hidden calendars are searched too, exactly as their events are: someone
    // searching by name is looking for the thing, not for whichever calendars
    // happen to be ticked. Opening a hit reveals its calendar again.
    tasks.forEach(function (task) {
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
        // "Nothing found" would be a lie while the earlier months are still
        // being read - they are exactly where an old event would be.
        empty.textContent = searchSweep.running ? 'Looking through earlier months…' : 'No matching events';
        searchResults.appendChild(empty);
        return;
    }
    matches.slice(0, 20).forEach(function (match) {
        if (match.task) {
            searchResults.appendChild(taskSearchResult(match.task));
            return;
        }
        let ev = match.event;
        let cal = getCalendarById(ev.extendedProps.calendarId);
        searchResults.appendChild(searchResultRow({
            color: cal ? cal.color : null,
            title: ev.title,
            struck: ev.extendedProps.status === 'cancelled',
            badge: ev.extendedProps.recur ? { title: 'Recurring',
                svg: '<path d="M4 12v-3a3 3 0 0 1 3 -3h13m-3 -3l3 3l-3 3"/><path d="M20 12v3a3 3 0 0 1 -3 3h-13m3 3l-3 -3l3 -3"/>' } : null,
            meta: formatSearchResultMeta(ev, match.jumpDate, cal),
            onClick: function () {
                if (match.indexed) jumpToIndexedResult(ev, match.jumpDate);
                else jumpToSearchResult(ev, match.jumpDate);
            }
        }));
    });
    appendSearchSweepNote();
}

// Says what the list does not cover, rather than letting a partial list read
// as the whole answer.
function appendSearchSweepNote() {
    let text = null;
    if (searchSweep.running) text = 'Still looking through earlier months…';
    else if (searchSweep.capped) text = 'Only the most recent months were searched.';
    else if (searchSweep.failed > 0) text = 'Some months could not be read.';
    if (!text) return;
    let note = document.createElement('div');
    note.className = 'search-empty';
    note.textContent = text;
    searchResults.appendChild(note);
}

// A swept hit is not on the grid, so there is nothing to open a popover on
// yet: navigate, and let the month arrive through the normal load path.
function jumpToIndexedResult(record, jumpDate) {
    let cal = getCalendarById(record.extendedProps.calendarId);
    if (cal && !cal.visible) {
        cal.visible = true;
        applyCalendarVisibility();
        renderCalendarList();
    }
    if (!jumpDate) return;
    pendingSearchJump = { id: record.id, at: Date.now() };
    setTimeout(resolvePendingSearchJump, SEARCH_JUMP_TIMEOUT_MS + 100);
    gotoDateWithTransition(jumpDate);
}

// Opens the popover once the month a swept hit lives in has arrived. If it
// never does - another device deleted it after the sweep read it - the list
// was showing something that is no longer there, and saying so beats leaving
// the click looking ignored.
function resolvePendingSearchJump() {
    if (!pendingSearchJump) return;
    let ev = calendar.getEventById(pendingSearchJump.id);
    if (ev) {
        let anchorEl = findEventAnchorEl(ev.id);
        pendingSearchJump = null;
        if (anchorEl) showEventPopover(ev, anchorEl);
        return;
    }
    if (Date.now() - pendingSearchJump.at < SEARCH_JUMP_TIMEOUT_MS) return;
    pendingSearchJump = null;
    showToast('That event is no longer in the calendar');
}

// Navigates then opens the event's popover, then re-resolves to the
// nearest real instance (ev may be a recurring master with .start ===
// null before gotoDate() makes an occurrence exist).
function jumpToSearchResult(ev, jumpDate) {
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

// Where a new or imported event lands. Our own calendars come first: a
// calendar a friend let us write to is somewhere to put an event on purpose,
// never somewhere for one to end up by default.
// Null until the host's first `load` has populated the list.
function defaultCalendarId() {
    let own = calendars.find(function (c) { return !c.readOnly && isOwnCalendar(c); });
    if (own) return own.id;
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
// FullCalendar re-renders on every single change, so a loop over hundreds of
// events costs hundreds of renders. batchRendering collapses each of these
// passes into one - the difference between a month's load being instant and
// a year's worth of events locking the view up.
function applyCalendarVisibility() {
    calendar.batchRendering(function () {
        calendar.getEvents().forEach(function (ev) {
            ev.setProp('display', isCalendarVisible(ev.extendedProps.calendarId) ? 'auto' : 'none');
        });
    });
    // Putting a calendar away silences it as well as hiding it, so the
    // schedule follows the ticks. Coalesced, so a load's several calls cost
    // one message.
    scheduleReminders();
}

function applyCalendarColor(calendarId) {
    let cal = getCalendarById(calendarId);
    if (!cal) return;
    calendar.batchRendering(function () {
        calendar.getEvents().forEach(function (ev) {
            if (ev.extendedProps.calendarId !== calendarId) return;
            ev.setProp('color', cal.color);
        });
    });
    document.querySelectorAll('[data-search-event-id]').forEach(function (el) {
        let ev = calendar.getEventById(el.dataset.searchEventId);
        if (ev && ev.extendedProps.calendarId === calendarId) paintEventInk(el, cal.color);
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
let MENU_TRIGGER_SELECTOR = '#toolbar-add-button, #overflow-menu-button, .calendar-menu-button';

// The calendar list scrolls on its own, which would clip a menu drawn inside
// it, so a row's menu spends the time it is open on the body, anchored to the
// button it belongs to. Everything else (the toolbar menus) stays where it is.
function openCalendarRowMenu(menu, button) {
    menu.homeRow = menu.parentElement;
    document.body.appendChild(menu);
    menu.classList.add('open');
    menu.style.position = 'fixed';
    // clear of the mobile drawer (1100), which it is no longer a child of
    menu.style.zIndex = '1120';
    menu.style.right = 'auto';
    placeFloatingBox(menu, button.getBoundingClientRect(), 4, 'right');
}

function closeAllCalendarMenus() {
    document.querySelectorAll('.calendar-menu.open').forEach(function (menu) {
        menu.classList.remove('open');
        if (!menu.homeRow) return;
        menu.homeRow.appendChild(menu);
        menu.homeRow = null;
        menu.style.position = menu.style.top = menu.style.left = menu.style.right =
            menu.style.zIndex = '';
    });
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
    // The host asks before it acts - its own dialog, outside the frame - so
    // there is no question here as well.
    hostSend({ type: 'deleteCalendar', calendarName: cal.name, id: cal.id });
}

function renderCalendarList() {
    // a menu parked on the body (see openCalendarRowMenu) belongs to a row
    // that is about to be replaced
    closeAllCalendarMenus();
    calendarListEl.innerHTML = '';
    calendars.forEach(function (cal) {
        let item = document.createElement('div');
        item.className = 'calendar-list-item';

        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = cal.visible;
        checkbox.style.accentColor = cal.color;
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

        // Editing and sharing are the owner's, even when they have let us
        // write entries into the calendar.
        if (isCalendarWritable(cal.id) && isOwnCalendar(cal)) {
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
        if (isCalendarWritable(cal.id) && isOwnCalendar(cal) && !cal.primary) {
            let shareBtn = document.createElement('button');
            shareBtn.type = 'button';
            shareBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M15 6a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M8.7 10.7l6.6 -3.4"/><path d="M8.7 13.3l6.6 3.4"/></svg> Share';
            shareBtn.addEventListener('click', function () {
                closeAllCalendarMenus();
                closeSidebar();
                requestShare({ target: 'calendar', calendarName: cal.name }, cal.name);
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
            openCalendarRowMenu(menu, menuButton);
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

// The trigger holds the colour - any colour, including one a calendar arrived
// with from another client, which a fixed palette could not represent. The
// swatches beside it are shortcuts that write into it, never a second answer
// to read at save time. Nothing downstream cares which was used: the ink on
// an entry is computed from the colour itself.
function selectedCalendarColor() {
    return calendarColorCustom.dataset.color || DEFAULT_CALENDAR_COLOR;
}

function showCalendarColor(color) {
    let hex = normalisedHexColor(color) || DEFAULT_CALENDAR_COLOR;
    calendarColorCustom.dataset.color = hex;
    calendarColorCustom.style.backgroundColor = hex;
    calendarColorCustom.setAttribute('aria-label', 'Colour ' + hex + ', choose another');
    calendarColorValue.textContent = hex;
}


// --- Colour picker ------------------------------------------------------
// The app's own, rather than input[type=color]: that hands the choice to the
// browser's colour dialog, which on Android is eight fixed colours with the
// actual picker behind a "Custom" link. Held as HSV while it is open because
// that is what the two controls set; committed as hex like everything else.
let colorDraft = { h: 0, s: 0, v: 0 };

function clamp01(value) {
    return value < 0 ? 0 : (value > 1 ? 1 : value);
}

function openColorPicker() {
    // Focused first so closing hands the keyboard back to the trigger,
    // whether the picker was opened by pointer or from the keyboard.
    calendarColorCustom.focus();
    colorDraft = rgbToHsv(hexToRgb(selectedCalendarColor()) || hexToRgb(DEFAULT_CALENDAR_COLOR));
    renderColorPicker(true);
    openDialog(colorModalBackdrop, colorField);
}

function closeColorPicker() {
    closeDialog(colorModalBackdrop);
}

// `withHexText` is false while the hex field itself is being typed in -
// rewriting the text under the caret would fight the typing.
function renderColorPicker(withHexText) {
    let hex = hexFromRgb(hsvToRgb(colorDraft));
    colorField.style.setProperty('--color-field-hue', hexFromRgb(hsvToRgb({ h: colorDraft.h, s: 1, v: 1 })));
    colorFieldThumb.style.left = (colorDraft.s * 100) + '%';
    colorFieldThumb.style.top = ((1 - colorDraft.v) * 100) + '%';
    colorFieldThumb.style.backgroundColor = hex;
    colorHue.value = String(Math.round(colorDraft.h));
    colorPreview.style.backgroundColor = hex;
    if (withHexText) colorHexInput.value = hex;
}

function pickFromColorField(e) {
    let box = colorField.getBoundingClientRect();
    colorDraft.s = clamp01((e.clientX - box.left) / box.width);
    colorDraft.v = 1 - clamp01((e.clientY - box.top) / box.height);
    renderColorPicker(true);
}

colorField.addEventListener('pointerdown', function (e) {
    colorField.setPointerCapture(e.pointerId);
    pickFromColorField(e);
});

colorField.addEventListener('pointermove', function (e) {
    if (colorField.hasPointerCapture(e.pointerId)) pickFromColorField(e);
});

// The field is a two-dimensional control, so it answers the arrow keys the
// way the hue slider beside it already does.
colorField.addEventListener('keydown', function (e) {
    let step = e.shiftKey ? 0.1 : 0.02;
    if (e.key === 'ArrowLeft') colorDraft.s = clamp01(colorDraft.s - step);
    else if (e.key === 'ArrowRight') colorDraft.s = clamp01(colorDraft.s + step);
    else if (e.key === 'ArrowUp') colorDraft.v = clamp01(colorDraft.v + step);
    else if (e.key === 'ArrowDown') colorDraft.v = clamp01(colorDraft.v - step);
    else return;
    e.preventDefault();
    renderColorPicker(true);
});

colorHue.addEventListener('input', function () {
    colorDraft.h = parseInt(colorHue.value, 10) || 0;
    renderColorPicker(true);
});

colorHexInput.addEventListener('input', function () {
    let rgb = hexToRgb(colorHexInput.value);
    if (rgb == null) return;
    colorDraft = rgbToHsv(rgb);
    renderColorPicker(false);
});

// Typed shorthand ("#abc") or nonsense is settled when the field is left,
// rather than being rejected keystroke by keystroke.
colorHexInput.addEventListener('blur', function () {
    renderColorPicker(true);
});

calendarColorCustom.addEventListener('click', openColorPicker);
colorCancelButton.addEventListener('click', closeColorPicker);

// Clicking away from the picker leaves the calendar dialog that opened it
// exactly as it was, like every other backdrop here.
colorModalBackdrop.addEventListener('click', function (e) {
    if (e.target === colorModalBackdrop) closeColorPicker();
});

colorApplyButton.addEventListener('click', function () {
    showCalendarColor(hexFromRgb(hsvToRgb(colorDraft)));
    closeColorPicker();
});



function hexFromRgb(rgb) {
    let part = function (n) { return (n < 16 ? '0' : '') + n.toString(16); };
    return '#' + part(rgb.r) + part(rgb.g) + part(rgb.b);
}

// Anything stored or typed elsewhere reaches this before it is shown or sent:
// the colour ends up in a stylesheet and in a file other clients read.
function normalisedHexColor(value) {
    let rgb = hexToRgb(value);
    return rgb == null ? null : hexFromRgb(rgb);
}

// The picker works in hue/saturation/brightness because that is what its two
// controls are; everything outside it speaks hex.
function rgbToHsv(rgb) {
    let r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let span = max - min;
    let h = 0;
    if (span !== 0) {
        if (max === r) h = ((g - b) / span) % 6;
        else if (max === g) h = (b - r) / span + 2;
        else h = (r - g) / span + 4;
        h *= 60;
        if (h < 0) h += 360;
    }
    return { h: h, s: max === 0 ? 0 : span / max, v: max };
}

function hsvToRgb(hsv) {
    let c = hsv.v * hsv.s;
    let x = c * (1 - Math.abs(((hsv.h / 60) % 2) - 1));
    let m = hsv.v - c;
    let sector = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
    let rgb = sector[Math.min(5, Math.floor(hsv.h / 60) % 6)];
    return { r: Math.round((rgb[0] + m) * 255),
             g: Math.round((rgb[1] + m) * 255),
             b: Math.round((rgb[2] + m) * 255) };
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
    let editing = mode === 'edit';
    editingCalendarId = editing ? cal.id : null;
    calendarModalHeading.textContent = editing ? 'Edit calendar' : 'New calendar';
    calendarNameInput.value = editing ? cal.name : '';
    // A new calendar arrives on a random colour and an existing one on its
    // own; either way that is where the picker opens.
    showCalendarColor(editing ? cal.color : randomCalendarColor());
    calendarDeleteButton.style.display = (editing && !cal.primary) ? '' : 'none';
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
// Privileged: the frame asks for the host's own share dialog and takes no part
// in what happens there. Naming a recipient or an access level from in here
// would let sandboxed code grant access without the user ever seeing it.
function requestShare(target, displayName) {
    closeSidebar();
    hostSend(Object.assign({ type: 'openShare', displayName: displayName }, target));
}

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
    let writable = targetCalendarId != null && isCalendarWritable(targetCalendarId);
    isReadOnlyForm = !writable;
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
        showReminderIn(eventReminderSelect, ev.extendedProps.reminder);
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
        showReminderIn(eventReminderSelect, prefill.reminder == null ? null : prefill.reminder);
        recur = null;
        renderCalendarSelectOptions(prefill.calendarId);
    }

    allDayInput.checked = allDay;
    setInputMode(allDay);
    startDateInput.value = toDateInputValue(start);
    startTimeInput.value = allDay ? '09:00' : toTimeInputValue(start);
    endDateInput.value = toDateInputValue(end);
    endTimeInput.value = allDay ? '10:00' : toTimeInputValue(end);
    // The length this event already has is the one to keep as the start moves.
    readFormSpan();
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
    let verb = action === 'delete' ? 'delete' : (action === 'move' ? 'move' : 'change');
    scopeSubtitle.textContent = 'Which events would you like to ' + verb + '?';
    document.querySelector('input[name="scope"][value="this"]').checked = true;
    openDialog(scopeModalBackdrop);
}

function closeScopeModal() {
    pendingScopeEvent = null;
    pendingMove = null;
    closeDialog(scopeModalBackdrop);
}

allDayInput.addEventListener('change', function () {
    setInputMode(allDayInput.checked);
    // Switching mode changes which halves of the span are meaningful, so the
    // length is re-read from what is on screen rather than carried over.
    readFormSpan();
});

startTimeInput.addEventListener('change', applyFormSpan);
endDateInput.addEventListener('change', readFormSpan);
endTimeInput.addEventListener('change', readFormSpan);

repeatFreqInput.addEventListener('change', function () {
    // A shortcut, not a frequency of its own: it resolves at once into the
    // weekly rule it stands for, with the five days ticked where they can be
    // seen and changed, so nothing past this point knows it was ever offered.
    if (repeatFreqInput.value === 'weekday') {
        repeatFreqInput.value = 'weekly';
        setSelectedWeekdays(['MO', 'TU', 'WE', 'TH', 'FR']);
    }
    updateRepeatVisibility();
});
repeatMonthlyModeInput.addEventListener('change', updateRepeatVisibility);
repeatEndInput.addEventListener('change', updateRepeatVisibility);

weekdayToggleButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
        btn.classList.toggle('selected');
    });
});

// Keeps "Monthly on the 3rd Tuesday" (computed from the start date, not
// a fixed string) in sync if the date changes while the modal is open.
startDateInput.addEventListener('change', function () {
    applyFormSpan();
    if (repeatFreqInput.value === 'monthly') updateMonthlyModeLabels();
});

cancelButton.addEventListener('click', closeModal);

modalBackdrop.addEventListener('click', function (e) {
    if (e.target === modalBackdrop) closeModal();
});

scopeConfirmButton.addEventListener('click', function () {
    let ev = pendingScopeEvent;
    let action = pendingScopeAction;
    let moved = pendingMove;
    let chosen = document.querySelector('input[name="scope"]:checked');
    let scope = chosen ? chosen.value : 'this';
    closeScopeModal();
    if (action === 'delete') {
        performScopedDelete(ev, scope);
    } else if (action === 'move') {
        if (moved) moveOccurrence(ev, scope, moved);
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
    requestShare(Object.assign({ target: 'event' }, hostEventRef(ev)), ev.title);
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

// A dialog like the rest, centred on the same backdrop, rather than a box
// hung under the title: it holds two fields and is dismissed the way the
// other dialogs are. The grid moves behind it as the fields change.
function openGotoDatePicker(anchorEl) {
    let current = calendar.getDate();
    gotoDateMonthInput.value = current.getMonth();
    gotoDateYearInput.value = current.getFullYear();
    anchorEl.setAttribute('aria-expanded', 'true');
    openDialog(gotoDateBackdrop, gotoDateMonthInput);
}

function closeGotoDatePicker() {
    closeDialog(gotoDateBackdrop);
    let trigger = calendarEl.querySelector('.goto-date-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

gotoDateBackdrop.addEventListener('click', function (e) {
    if (e.target === gotoDateBackdrop) closeGotoDatePicker();
});

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

overflowRefreshButton.addEventListener('click', function () {
    closeAllCalendarMenus();
    requestRefresh();
});

overflowImportButton.addEventListener('click', function () {
    closeAllCalendarMenus();
    icsFileInput.click();
});


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
    // A guest is reading a link, not importing: nothing was written, and there is no
    // account here for it to have been written to. The entries are simply on the grid,
    // so a summary counting what was "imported" would be telling them about a thing
    // that did not happen.
    if (!isGuestSession)
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
    ensureSearchIndex();
    renderSearchResults(searchInput.value);
});

// Re-opens the dropdown when refocusing an already-typed query. Also where
// the sweep starts: searching is the first moment the months outside the
// grid are worth the reads, and most sessions never search at all.
searchInput.addEventListener('focus', function () {
    ensureSearchIndex();
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
    let color = selectedCalendarColor();
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
let MENU_INTERNAL_SELECTOR = '.calendar-menu button, .calendar-menu-button, #overflow-menu-button, #toolbar-add-button';
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

// A click on the page around this app - the host's own chrome - never reaches
// this document, so menus, search results and the popover would sit open
// behind it. Losing the window is that click, as far as they are concerned.
// Dialogs are left alone: they hold work in progress.
window.addEventListener('blur', function () {
    closeAllCalendarMenus();
    closeSearchResults();
    if (popover.classList.contains('open')) hideEventPopover();
});

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
    if (colorModalBackdrop.classList.contains('open')) closeColorPicker();
    else if (confirmModalBackdrop.classList.contains('open')) closeConfirmModal();
    else if (importSummaryModalBackdrop.classList.contains('open')) closeImportSummaryModal();
    else if (modalBackdrop.classList.contains('open')) closeModal();
    else if (taskModalBackdrop.classList.contains('open')) closeTaskModal();
    else if (emailChoiceBackdrop.classList.contains('open')) closeEmailChoice();
    else if (scopeModalBackdrop.classList.contains('open')) closeScopeModal();
    else if (gotoDateBackdrop.classList.contains('open')) closeGotoDatePicker();
    else if (calendarModalBackdrop.classList.contains('open')) closeCalendarModal();
    else if (popover.classList.contains('open')) hideEventPopover();
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
    // The browser blocks submission on its own while the message is set;
    // this catches a form submitted before any field fired a change.
    if (!refreshRangeValidity()) {
        form.reportValidity();
        return;
    }
    let allDay = allDayInput.checked;
    let start = allDay ? startDateInput.value : new Date(startDateInput.value + 'T' + startTimeInput.value);
    let end = fromFormEnd(allDay);
    let extra = { location: locationInput.value, status: statusInput.value, description: descriptionInput.value,
        reminder: readReminderSelect(eventReminderSelect), calendarId: calendarSelectInput.value };
    // Whatever the stored file says beyond these fields travels with the entry,
    // so saving an event another client wrote does not strip it (patchIcsBlock).
    if (editingEvent && editingEvent.extendedProps.sourceLines)
        extra.sourceLines = editingEvent.extendedProps.sourceLines;
    let recur = readRecurFromForm();
    if (recur && editingEvent) carryRecurSource(editingEvent.extendedProps.recur, recur);

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

calendarListEl.addEventListener('scroll', function () {
    if (document.querySelector('.calendar-menu.open')) closeAllCalendarMenus();
});

renderCalendarList();

// eventClick fires on both clicks of a double-click - the first click's
// popover is deferred behind a short timer, a second click cancels it
// and opens edit instead. Desktop-only (see isTouchDevice).
let eventClickTimer = null;

// Day-grid time text is always e.g. "7a"/"9:30a"/"2p" - no space,
// optional minutes, single am/pm letter.
let DAY_GRID_TIME_PATTERN = /^\d{1,2}(:\d{2})?[ap]$/i;

// Breezy right-aligns the time label on a day-grid (Month/Year) chip; these
// two put it flush left, ahead of the title. Split in half deliberately:
// this one only measures, the writes happen in a second pass, so a hundred
// chips cost one layout between them instead of one each.
function planDayGridEventLayout(el) {
    if (el.dataset.eventAllDay === '1') return null;
    let wrapper = el.firstElementChild;
    if (!wrapper) return null;
    let divs = Array.prototype.filter.call(wrapper.children, function (c) { return c.tagName === 'DIV'; });
    if (!divs.length) return null;
    // Identified by content, not position (divs[0]/divs[1]) - Breezy can
    // render the time div alone before the title div exists, so position
    // is not a reliable way to tell the two apart.
    let timeEl = divs.length > 1 ? divs.find(function (d) { return DAY_GRID_TIME_PATTERN.test(d.textContent.trim()); }) : null;
    let titleEl = divs.find(function (d) { return d !== timeEl; });
    return {
        wrapper: wrapper,
        timeEl: timeEl,
        titleEl: titleEl,
        // Space-based, not a fixed breakpoint - only drop the time label if
        // time and title would actually overflow the cell.
        overflows: wrapper.scrollWidth > wrapper.clientWidth
    };
}

function applyPlannedEventLayout(plan) {
    plan.wrapper.style.justifyContent = 'flex-start';
    if (plan.titleEl) plan.titleEl.style.order = '2';
    if (plan.timeEl) {
        plan.timeEl.style.order = '1';
        plan.timeEl.style.display = plan.overflows ? 'none' : '';
    }
}

// Breezy re-renders a chip's contents after mount without re-firing
// eventDidMount, undoing the ordering, and no resize event marks the moment -
// so one observer on the grid (see calendar.render()) watches for the
// re-render itself and re-applies it for every chip. One observer per chip
// meant hundreds in Year, each forcing a reflow, which locked the view up for
// seconds on a phone. Passes are coalesced into one animation frame.
let dayGridLayoutPending = false;

function scheduleDayGridLayout() {
    if (dayGridLayoutPending) return;
    dayGridLayoutPending = true;
    requestAnimationFrame(function () {
        dayGridLayoutPending = false;
        applyDayGridLayout();
    });
}

function applyDayGridLayout() {
    let view = calendar.view.type;
    if (view !== 'dayGridMonth' && view !== 'multiMonthYear') return;
    let planned = [];
    document.querySelectorAll('[data-search-event-id][data-event-all-day="0"]').forEach(function (el) {
        let plan = planDayGridEventLayout(el);
        if (plan) planned.push(plan);
    });
    planned.forEach(applyPlannedEventLayout);
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
        paintEventInk(info.el, info.event.backgroundColor
            || colorForCalendarId(info.event.extendedProps.calendarId));
        if (info.view.type === 'dayGridMonth' || info.view.type === 'multiMonthYear') {
            scheduleDayGridLayout();
        }
    },
    // Marks just the Month/Year day-number link (calendar.css font-size
    // rule) - dayCellDidMount only fires for day-grid cells, unlike
    // [role="link"] alone, which also matches Week's column headers,
    // Day's week-number link, and Year/Agenda's own heading links, none
    // of which should be affected.
    dayCellDidMount: function (info) {
        let link = info.el.querySelector('[role="link"]');
        // today keeps the theme's own pill, which brings its own ink with it
        if (link) link.dataset.dayNumber = info.isToday ? 'today' : (info.isOther ? 'other' : 'own');
    },
    // dateClick, not selectable/select - plain click/tap only, no drag.
    // New events get a default duration (1 hour timed, 1 day all-day).
    // Dragging an event, with a mouse. A repeating occurrence follows the
    // rule the previous calendar had: it may change time, not day (a drop on
    // another day snaps back), and then it asks which occurrences move.
    editable: canDragEvents,
    eventAllow: function (span, ev) { return dragAllowed(ev, span.start); },
    eventDrop: function (info) { handleDragChange(info); },
    eventResize: function (info) { handleDragChange(info); },
    dateClick: function (info) {
        // Same condition that shows the New button: nothing to create into otherwise.
        if (isGuestSession || defaultCalendarId() == null) return;
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
        trigger.setAttribute('aria-haspopup', 'dialog');
        // The title re-renders as the dialog's own fields move the grid.
        trigger.setAttribute('aria-expanded', String(gotoDateBackdrop.classList.contains('open')));
        trigger.tabIndex = 0;
        trigger.setAttribute('aria-label', text + ', go to date');
        heading.appendChild(trigger);
    }
});
fillReminderChoices(eventReminderSelect);
fillReminderChoices(taskReminderSelect);

calendar.render();
// childList/characterData only, never attributes: the pass writes styles of
// its own, and observing those would loop.
new MutationObserver(scheduleDayGridLayout)
    .observe(calendarEl, { childList: true, subtree: true, characterData: true });
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

// Swipe left/right to go to the next/previous view, and pull down from the
// top to refresh. touchend only, never preventDefault, so neither interferes
// with vertical scrolling: a pull counts only when every scroller under the
// finger was already at its top, so dragging a time grid down to see earlier
// hours is still a scroll and not a refresh.
let touchStartX = null;
let touchStartY = null;
let touchFromTop = false;
let SWIPE_MIN_DISTANCE = 50;
let PULL_MIN_DISTANCE = 80;

function scrolledToTop(target) {
    for (let el = target; el && el !== calendarEl; el = el.parentElement) {
        if (el.scrollTop > 0) return false;
    }
    return true;
}

function isPull(touch) {
    let deltaX = touch.clientX - touchStartX;
    let deltaY = touch.clientY - touchStartY;
    return touchFromTop && deltaY >= PULL_MIN_DISTANCE && Math.abs(deltaX) < deltaY;
}

calendarEl.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchFromTop = scrolledToTop(e.target);
}, { passive: true });

calendarEl.addEventListener('touchmove', function (e) {
    if (touchStartX === null || e.touches.length !== 1) return;
    pullHint.hidden = !isPull(e.touches[0]);
}, { passive: true });

calendarEl.addEventListener('touchend', function (e) {
    if (touchStartX === null) return;
    let touch = e.changedTouches[0];
    let deltaX = touch.clientX - touchStartX;
    let deltaY = touch.clientY - touchStartY;
    let pulled = isPull(touch);
    touchStartX = null;
    pullHint.hidden = true;
    if (pulled) {
        requestRefresh();
        return;
    }
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
    closeAllCalendarMenus();
    openGotoDatePicker(trigger);
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
    scheduleReminders();
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
    deletedSinceLoad[task.id] = true;
    scheduleReminders();
    hostSend({ type: 'delete', isTask: true, calendarName: taskCalendars[task.id] || task.calendarId, Id: task.id });
    delete taskCalendars[task.id];
    tasks = tasks.filter(function (t) { return t.id !== task.id; });
    let onGrid = calendar.getEventById(task.id);
    if (onGrid) onGrid.remove();
    renderTaskList();
}

function toggleTaskCompleted(task) {
    if (isGuestSession || !isCalendarWritable(task.calendarId)) return;
    let nextDue = task.completed ? null : nextTaskOccurrence(task);
    if (nextDue) {
        // Ticking off one round of a repeating task starts the next, rather
        // than closing the task for good.
        task.due = nextDue;
        // A rule limited to N occurrences has one fewer left. The file
        // anchors the rule at DUE, which has just moved, so the count has to
        // move with it or the series would start over on the next read.
        if (task.recur.end === 'count' && task.recur.count > 1) {
            task.recur = Object.assign({}, task.recur, { count: task.recur.count - 1, dtstart: null });
        }
        showToast('Next: ' + formatTaskDue(task));
        persistTask(task);
        syncTaskEvent(task);
        renderTaskList();
        return;
    }
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
    dot.style.backgroundColor = calendarColorFor(task.calendarId);
    dot.title = task.calendarId;
    row.appendChild(dot);
    return row;
}

function calendarColorFor(calendarId) {
    let cal = getCalendarById(calendarId);
    return cal ? cal.color : DEFAULT_CALENDAR_COLOR;
}

// --- Task dialog ---

function applyTaskDueVisibility() {
    let dated = taskHasDueInput.checked;
    taskDueFields.style.display = dated ? '' : 'none';
    taskDueTimeInput.style.display = taskDueAllDayInput.checked ? 'none' : '';
    // A repeat and a reminder both count from the due date, so they arrive
    // with it rather than sitting there greyed out with nothing to say why.
    taskWhenFields.style.display = dated ? '' : 'none';
    if (!dated) {
        taskRepeatFreqInput.value = '';
        showReminderIn(taskReminderSelect, null);
    }
    updateTaskRepeatVisibility();
}

function openTaskModal(mode, task) {
    editingTaskId = mode === 'edit' ? task.id : null;
    taskModalHeading.textContent = mode === 'edit' ? 'Edit task' : 'New task';
    taskTitleInput.value = mode === 'edit' ? task.title : '';
    taskDescriptionInput.value = mode === 'edit' ? task.description : '';
    showReminderIn(taskReminderSelect, mode === 'edit' ? task.reminder : null);
    populateTaskRepeatForm(mode === 'edit' ? task.recur : null);
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
        taskDueAllDayInput, taskDescriptionInput].forEach(function (el) {
        el.disabled = !writable;
    });
    [taskReminderSelect, taskRepeatFreqInput, taskRepeatIntervalInput].forEach(function (el) {
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
    // Nothing on screen shows a task's priority, so nothing here changes it:
    // one written elsewhere is kept, and a new task is left at normal.
    if (task.priority == null) task.priority = ICS_PRIORITY_NORMAL;
    task.reminder = task.due ? readReminderSelect(taskReminderSelect) : null;
    // A repeat needs a date to count from, so a task without one carries none.
    task.recur = task.due ? readTaskRepeatForm(existing ? existing.recur : null) : null;
    if (task.recur && !task.recur.dtstart) task.recur.dtstart = taskDueAsIcsLocal(task);
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
taskRepeatFreqInput.addEventListener('change', updateTaskRepeatVisibility);
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
// The privileged half is Calendar.vue on the parent page; this is the
// sandboxed frame. README.md carries the protocol and what is load-bearing
// about it.

// Reports whether the message went anywhere: until the host's first message
// arrives there is no window to send to, and a caller that is keeping track of
// a reply needs to know it will never come.
function hostSend(message) {
    if (!hostWindow) return false;
    hostWindow.postMessage(message, hostOrigin);
    return true;
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
    deletedSinceLoad[eventId] = true;
    scheduleReminders();
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
        year: placement.year,
        month: placement.month,
        Id: ev.id,
        item: buildIcsDocument(eventToIcsLines(ev)),
        isRecurring: placement.isRecurring
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

// The previous app kept a changed occurrence inside its series' file. Here it
// is an entry of its own, but nothing is written until something is saved or
// deleted - and either one rewrites or removes that file, taking every other
// occurrence in it along. So they are all written out first, and the series
// with them. Returns true if `id` was one of those occurrences: it has no file
// of its own yet, so there is nothing to delete.
function migrateOverridesOf(id) {
    let separator = id.indexOf(OVERRIDE_ID_SEPARATOR);
    let seriesId = separator === -1 ? id : id.slice(0, separator);
    let pending = unmigratedOverrides[seriesId];
    // Dropped first, so anything re-entering here can't recurse.
    if (!pending) return false;
    delete unmigratedOverrides[seriesId];
    pending.forEach(function (overrideId) {
        if (overrideId === id) return;
        let override = calendar.getEventById(overrideId);
        if (override) persistEvent(override);
    });
    if (seriesId === id) return false;
    let series = calendar.getEventById(seriesId);
    if (series) persistEvent(series);
    return pending.indexOf(id) !== -1;
}

function persistEvent(ev) {
    if (!ev || isGuestSession || !isCalendarWritable(ev.extendedProps.calendarId)) return;
    scheduleReminders();
    migrateOverridesOf(ev.id);
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
    if (!migrateOverridesOf(ev.id)) persistDelete(ev.id, placement);
}

function calendarFromHost(entry, index) {
    let color = entry.color || DEFAULT_CALENDAR_COLOR;
    let sharedWithUs = entry.owner != null && entry.owner !== hostUsername;
    // The host resolves this against the stored directory itself, because only
    // the filesystem knows what a share actually granted. An older host that
    // says nothing means what the app used to assume: ours is writable, a
    // shared one is not.
    let writable = entry.writable != null ? entry.writable : !sharedWithUs;
    return {
        id: entry.name,
        name: entry.name,
        color: color,
        visible: true,
        primary: index === 0 && !sharedWithUs,
        readOnly: isGuestSession || !writable,
        owner: entry.owner
    };
}

// Renaming, sharing and colour are the owner's to decide; a write grant only
// covers the entries inside the calendar.
function isOwnCalendar(cal) {
    return !cal || cal.owner == null || cal.owner === hostUsername;
}

// A guest or read-only session can't write anything, so the create paths
// are removed outright instead of failing silently inside persistEvent.
function applyReadOnlyMode() {
    // Opening a single shared .ics gives a session with no calendar of its
    // own, where "New" would open a form that could not save anything.
    let canCreate = !isGuestSession && defaultCalendarId() != null;
    toolbarAddButton.style.display = canCreate ? '' : 'none';
    // Importing is creating. Without this the entries land on the grid, the
    // write is skipped, and the summary still claims they were imported.
    overflowImportButton.style.display = canCreate ? '' : 'none';
    addCalendarButton.style.display = isGuestSession ? 'none' : '';
}

function applyHostCalendars(hostCalendars) {
    calendars = (hostCalendars || []).map(calendarFromHost);
    applyReadOnlyMode();
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
            if (getTaskById(task.id) || deletedSinceLoad[task.id]) return;
            task.calendarId = entry.calendarName;
            tasks.push(task);
            taskCalendars[task.id] = entry.calendarName;
        });
    });
}

// A legacy event file can hold a master plus its RECURRENCE-ID overrides,
// so a single entry can yield more than one event.
function addHostEventsFrom(entries) {
    // One render for the whole batch: a month can carry hundreds of events and
    // adding them one at a time re-renders the grid for each.
    calendar.batchRendering(function () {
        forEachParsedEntry(entries, function (parsed, entry) {
            parsed.events.forEach(function (payload) {
                if (calendar.getEventById(payload.id) || deletedSinceLoad[payload.id]) return;
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
    });
}

// A load arrives as a shell - who we are, which calendars there are, which
// month is on screen - followed by one message per bucket of stored entries
// (each month around the one on screen, the recurring folder, the tasks) as
// the host finishes reading it. The grid is up and usable from the shell;
// `pendingLoadBuckets` is only what is still outstanding.
let pendingLoadBuckets = 0;
let pendingLoadImport = null;
// Deleted while this load's buckets were still arriving. A bucket read
// before the delete reached the store still carries the entry, and without
// this it would come back as a ghost the store no longer has.
let deletedSinceLoad = Object.create(null);

function setPendingLoadBuckets(count) {
    pendingLoadBuckets = count > 0 ? count : 0;
    loadProgressEl.hidden = pendingLoadBuckets === 0;
    if (pendingLoadBuckets > 0) return;
    let contents = pendingLoadImport;
    pendingLoadImport = null;
    if (contents) importIcsText(contents);
}

// Only the messages this load asked for count down; a month the grid asked
// for on its own carries no flag.
function noteLoadBucket(data) {
    if (data.loadBucket === true && pendingLoadBuckets > 0)
        setPendingLoadBuckets(pendingLoadBuckets - 1);
}

function handleHostLoad(data) {
    deletedSinceLoad = Object.create(null);
    hostUsername = data.username;
    isGuestSession = data.isReadOnly != null ? data.isReadOnly : (data.username == null);
    applyReadOnlyMode();
    applyHostCalendars(data.calendars);
    calendar.getEvents().forEach(function (ev) { ev.remove(); });
    eventPlacements = Object.create(null);
    loadedYearMonths = Object.create(null);
    unmigratedOverrides = Object.create(null);
    // The host cancels its walks as it sends this, so nothing swept for the
    // calendars being replaced can still be on its way. The buckets still in
    // flight for a previous load are dropped by the host for the same reason.
    resetSweepState();
    tasks = [];
    taskCalendars = Object.create(null);
    // The three months the host reads for this load: marked here so the grid
    // does not ask for them again while they are on their way.
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
    // only sends that one for a guest session. It waits for the buckets:
    // importing first would take a second copy of every event this calendar
    // already holds, since none of them are here to be recognised yet.
    let importParams = data.importCalendarEventParams;
    pendingLoadImport = (importParams && importParams.contents) || null;
    setPendingLoadBuckets(data.pendingBuckets || 0);
}

function handleHostLoadAdditional(data) {
    addHostEventsFrom(data.currentMonth);
    scheduleReminders();
    // Recurring entries belong to no month and arrive without one.
    if (typeof data.yearMonth === 'number') loadedYearMonths[data.yearMonth] = true;
    applyCalendarVisibility();
    resolvePendingSearchJump();
    noteLoadBucket(data);
    // No removeSpinner: the host raises none for a month fetch, and these
    // replies arrive in any order (a year view asks for twelve at once), so
    // clearing here would lift a spinner raised by a save or a share.
}

function handleHostLoadTasks(data) {
    addHostTasksFrom(data.tasks);
    syncAllTaskEvents();
    renderTaskList();
    scheduleReminders();
    noteLoadBucket(data);
}

// Non-recurring events are stored per month, so a month that has never been
// fetched has to be asked for before its events can show up.
// Another device, a CalDAV client or the phone's own calendar can write into
// the same store while this is open; nothing tells us when. This asks the host
// to read it all again - the same path as a fresh open, so the grid, the task
// list and the sweep index all start from what is actually stored now.
function requestRefresh() {
    // The grid's date is local: read as UTC, the first of a month east of
    // Greenwich is still the previous month, and the host would load around that.
    let date = calendar.getDate();
    hostSend({ type: 'refresh', year: date.getFullYear(), month: date.getMonth() + 1 });
}

function requestMonthIfMissing(date) {
    let yearMonth = date.getUTCFullYear() * 12 + date.getUTCMonth();
    if (loadedYearMonths[yearMonth]) return;
    loadedYearMonths[yearMonth] = true;
    hostSend({ type: 'loadAdditional', year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
}

// One shape in both directions: `type` names the message and the rest is its
// payload. Built without a prototype, so a message naming "constructor" finds
// nothing to call.
let hostHandlers = Object.assign(Object.create(null), {
    ping: function (data) {
        applyHostTheme(data.currentTheme);
        hostHasEmailApp = data.hasEmail === true;
        hostSend({ type: 'pong' });
    },
    setTheme: function (data) { applyHostTheme(data.currentTheme); },
    load: handleHostLoad,
    loadAdditional: handleHostLoadAdditional,
    loadTasks: handleHostLoadTasks,
    sweepBatch: handleSweepBatch,
    sweepDone: handleSweepDone,
    // A secret link to a single .ics arrives this way and never sends a
    // `load`: there are no calendars behind it, so nothing here can be saved
    // and the session is read-only whatever else it looks like.
    importICSFile: function (data) {
        if (data.loadCalendarAsGuest) {
            isGuestSession = true;
            applyReadOnlyMode();
        }
        importIcsText(data.contents);
        // The host raises the spinner and only the frame takes it down, which a
        // normal load does from its load shell. A link with no account behind it
        // never gets one, so it says so here.
        hostSend({ type: 'removeSpinner' });
    },
    respondAddCalendar: function (data) { respondToCalendarAdd(data.newName, data.newColor); },
    respondRenameCalendar: function (data) { respondToCalendarRename(data.calendar); },
    respondCalendarColorChange: function (data) {
        respondToCalendarColorChange(data.calendarName, data.newColor);
    },
    respondDeleteCalendar: function (data) { respondToCalendarDelete(data.calendar); }
});

window.addEventListener('message', function (e) {
    // The parent page is this iframe's host minus the leading `calendar.`
    // label; anything else is not the host and is ignored outright.
    let parentDomain = window.location.host.substring(window.location.host.indexOf('.') + 1);
    if (e.origin !== window.location.protocol + '//' + parentDomain) return;
    if (e.source !== window.parent) return;
    if (e.data == null || typeof e.data !== 'object') return;
    hostWindow = e.source;
    hostOrigin = e.origin;
    let handler = hostHandlers[e.data.type];
    if (handler != null) handler(e.data);
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

// A new calendar starts on a random colour, which the picker then opens at.
// Random hue only: saturation and brightness stay in a band that reads on
// both themes, where a flat random RGB would hand out near-white and mud.
// A hue close to a calendar that already exists is re-rolled a few times, so
// "random" does not mean "another blue next to the blue one".
function randomCalendarColor() {
    let taken = calendars.map(function (c) { return rgbToHsv(hexToRgb(c.color) || hexToRgb(DEFAULT_CALENDAR_COLOR)).h; });
    let hue = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
        hue = Math.random() * 360;
        let clash = taken.some(function (h) {
            let gap = Math.abs(h - hue);
            return Math.min(gap, 360 - gap) < 25;
        });
        if (!clash) break;
    }
    return hexFromRgb(hsvToRgb({ h: hue, s: 0.55 + Math.random() * 0.2, v: 0.65 + Math.random() * 0.2 }));
}

function requestAddCalendar(name, color) {
    hostSend({ type: 'requestAddCalendar', newName: name, newColor: color || randomCalendarColor() });
}

// The host renames in place and echoes the *same* object back with only
// `name` updated, so `id` rides along untouched as the only record of
// which calendar this was.
function requestRenameCalendar(cal, newName) {
    hostSend({ type: 'requestRenameCalendar', newName: newName, calendar: { id: cal.id, name: cal.name, color: cal.color, owner: cal.owner } });
}

function requestCalendarColorChange(cal, color) {
    hostSend({ type: 'requestCalendarColorChange', calendarName: cal.name, newColor: color });
}

function respondToCalendarAdd(newName, newColor) {
    if (!newName || getCalendarById(newName)) return;
    calendars.push({ id: newName, name: newName, color: newColor || randomCalendarColor(), visible: true });
    applyReadOnlyMode();
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
    searchIndex.forEach(function (rec) {
        if (rec.extendedProps.calendarId === previousName) rec.extendedProps.calendarId = renamed.name;
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
    searchIndex = searchIndex.filter(function (rec) { return rec.extendedProps.calendarId !== name; });
    calendars = calendars.filter(function (c) { return c.id !== name; });
    // Losing the last calendar we could write to takes "New" with it.
    applyReadOnlyMode();
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
