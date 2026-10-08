// Reading .ics (RFC 5545): the parser, the timezone resolver and the rrule.js glue
// it needs. Loaded after rrule.js and before whichever page uses it - the full app
// (calendar.js) and the feed tile (tile.js). The page supplies defaultCalendarId()
// and colorForCalendarId(id), which decide where a parsed entry lands.

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

// rrule.js reads Date fields via UTC getters regardless of local
// timezone - build/read dates via UTC fields to work around it.
function toFakeUtc(localDate) {
    return new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), localDate.getHours(), localDate.getMinutes(), localDate.getSeconds()));
}

function fromFakeUtc(fakeUtcDate) {
    return new Date(fakeUtcDate.getUTCFullYear(), fakeUtcDate.getUTCMonth(), fakeUtcDate.getUTCDate(), fakeUtcDate.getUTCHours(), fakeUtcDate.getUTCMinutes(), fakeUtcDate.getUTCSeconds());
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

function nextEventId() {
    return 'evt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// Distinct prefix from an event's, so a task can never collide with an
// event of the same name.
function nextTaskId() {
    return 'task-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
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

function unescapeIcsText(str) {
    return str.replace(/\\(\\|;|,|[nN])/g, function (m, c) {
        return (c === 'n' || c === 'N') ? '\n' : c;
    });
}

function parseIcsUtcOffset(value) {
    let m = String(value).match(/^([+-])(\d{2})(\d{2})(\d{2})?$/);
    if (!m) return null;
    let sign = m[1] === '-' ? -1 : 1;
    return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
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
    // Kept as written. This app has no notion of a task being part done, and erasing what
    // another client tracked would lose it on the way through.
    let percentComplete = percentLine ? percentLine.value : null;
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
        completedAt: completed ? (completedAt || new Date()) : null,
        percentComplete: percentComplete
    };
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
        end = endParsed ? endParsed.date : null;
    }
    if (!end || end.getTime() <= start.getTime()) {
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
