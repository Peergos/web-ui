// One calendar entry drawn inside the newsfeed. The host (FeedTile.vue) hands
// over the file's text and nothing else: this page cannot read, write or name
// a file, and anything beyond looking at the entry goes through `open`, which
// the host answers by opening the full app.

let TILE_DEFAULT_COLOR = '#3788d8';

// ics.js asks the page where a parsed entry lands. A tile has no calendars.
function defaultCalendarId() { return null; }
function colorForCalendarId() { return TILE_DEFAULT_COLOR; }

let tileEl = document.getElementById('tile');
let tileBody = document.getElementById('tile-body');

let parentOrigin = (function () {
    let parentDomain = window.location.host.substring(window.location.host.indexOf('.') + 1);
    return window.location.protocol + '//' + parentDomain;
})();

function hostSend(message) {
    window.parent.postMessage(message, parentOrigin);
}

function applyTheme(theme) {
    if (theme == null) return;
    if (theme === 'dark-mode') document.documentElement.setAttribute('data-color-scheme', 'dark');
    else document.documentElement.removeAttribute('data-color-scheme');
}
applyTheme(new URL(window.location.href).searchParams.get('theme'));

let DAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
let DAY_YEAR_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
let TIME_FORMAT = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

function formatDay(date) {
    return (date.getFullYear() === new Date().getFullYear() ? DAY_FORMAT : DAY_YEAR_FORMAT).format(date);
}

function sameDay(a, b) {
    return toDateInputValue(a) === toDateInputValue(b);
}

function formatRange(start, end, allDay) {
    if (allDay) {
        let lastDay = addDays(end, -1);
        if (lastDay <= start) return formatDay(start) + ' · All day';
        return formatDay(start) + ' – ' + formatDay(lastDay) + ' · All day';
    }
    if (sameDay(start, end)) return formatDay(start) + ' · ' + TIME_FORMAT.format(start) + ' – ' + TIME_FORMAT.format(end);
    return formatDay(start) + ', ' + TIME_FORMAT.format(start) + ' – ' + formatDay(end) + ', ' + TIME_FORMAT.format(end);
}

function sourceProperty(lines, name) {
    let props = (lines || []).map(parseIcsPropertyLine).filter(Boolean);
    return props.find(function (p) { return p.name === name; }) || null;
}

// The start in the entry's own zone, when that differs from the reader's.
function zoneNote(lines, start, allDay) {
    if (allDay) return null;
    let dtstart = sourceProperty(lines, 'DTSTART');
    let zone = dtstart && dtstart.params.TZID ? resolveTzidToIanaZone(dtstart.params.TZID) : null;
    if (!zone || zone === LOCAL_TZ) return null;
    if (tzOffsetMinutesAt(zone, start.getTime()) === tzOffsetMinutesAt(LOCAL_TZ, start.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone, timeZoneName: 'short' }).format(start);
}

// RFC 7986 COLOR. The value is untrusted and goes into a style, so only a hex or named colour.
function entryColor(lines) {
    let prop = sourceProperty(lines, 'COLOR');
    let value = prop ? prop.value.trim() : '';
    if (!/^(#[0-9a-f]{3,8}|[a-z]+)$/i.test(value)) return null;
    return CSS.supports('color', value) ? value : null;
}

function row(text, className) {
    let el = document.createElement('div');
    el.className = 'tile-row' + (className ? ' ' + className : '');
    el.textContent = text;
    return el;
}

function titleEl(text, className) {
    let el = document.createElement('div');
    el.className = 'tile-title' + (className ? ' ' + className : '');
    el.textContent = text;
    return el;
}

function eventRows(ev) {
    let extra = ev.extendedProps || {};
    let lines = extra.sourceLines;
    let recur = extra.recur;
    let start, end;
    if (recur) {
        start = nearestRecurOccurrenceDate(recur, ev.allDay, new Date());
        end = new Date(start.getTime() + ev.duration.milliseconds);
    } else {
        start = ev.start;
        end = ev.end || ev.start;
    }
    let cancelled = extra.status === 'cancelled';
    let out = [titleEl(ev.title, cancelled ? 'cancelled' : null)];
    let time = row(formatRange(start, end, ev.allDay), 'time');
    if (cancelled) {
        let status = document.createElement('span');
        status.className = 'tile-status';
        status.textContent = 'Cancelled · ';
        time.insertBefore(status, time.firstChild);
    }
    out.push(time);
    let zone = zoneNote(lines, start, ev.allDay);
    if (zone) out.push(row(zone + ' in the event\'s time zone'));
    if (recur) out.push(row(describeRecur(recur)));
    if (extra.location) out.push(row(extra.location));
    let attendees = (lines || []).filter(function (line) {
        let p = parseIcsPropertyLine(line);
        return p && p.name === 'ATTENDEE';
    }).length;
    if (attendees) out.push(row(attendees + (attendees === 1 ? ' attendee' : ' attendees')));
    return { rows: out, color: entryColor(lines) };
}

function taskRows(task) {
    let out = [titleEl((task.completed ? '☑ ' : '☐ ') + task.title, task.completed ? 'done' : null)];
    if (task.due) {
        out.push(row('Due ' + (task.dueAllDay ? formatDay(task.due)
            : formatDay(task.due) + ', ' + TIME_FORMAT.format(task.due)), 'time'));
    } else {
        out.push(row('No due date', 'time'));
    }
    if (task.recur) out.push(row(describeRecur(task.recur)));
    return { rows: out, color: entryColor(task.sourceLines) };
}

function render(contents) {
    let drawn = null;
    let total = 0;
    try {
        let parsed = parseIcsFile(String(contents || ''));
        total = parsed.events.length + parsed.tasks.length;
        if (parsed.events.length) drawn = eventRows(parsed.events[0]);
        else if (parsed.tasks.length) drawn = taskRows(parsed.tasks[0]);
    } catch (e) {
        drawn = null;
    }
    tileBody.textContent = '';
    if (drawn == null) {
        tileBody.appendChild(titleEl('Can\'t display this event'));
        tileBody.appendChild(row('Open it in Calendar to see what it holds.'));
        document.documentElement.style.removeProperty('--tile-color');
    } else {
        drawn.rows.forEach(function (el) { tileBody.appendChild(el); });
        if (total > 1) {
            let more = document.createElement('div');
            more.className = 'tile-more';
            more.textContent = '+' + (total - 1) + ' more';
            tileBody.appendChild(more);
        }
        if (drawn.color) document.documentElement.style.setProperty('--tile-color', drawn.color);
        else document.documentElement.style.removeProperty('--tile-color');
    }
}

let lastHeight = 0;
function reportHeight() {
    let height = Math.ceil(tileEl.getBoundingClientRect().height);
    if (height === lastHeight) return;
    lastHeight = height;
    hostSend({ type: 'resize', height: height });
}
new ResizeObserver(reportHeight).observe(tileEl);

let shown = false;
let handlers = Object.assign(Object.create(null), {
    ping: function (data) {
        applyTheme(data.currentTheme);
        hostSend({ type: 'pong' });
    },
    setTheme: function (data) { applyTheme(data.currentTheme); },
    show: function (data) {
        render(data.contents);
        reportHeight();
        if (!shown) {
            shown = true;
            hostSend({ type: 'ready' });
        }
    }
});

window.addEventListener('message', function (e) {
    if (e.origin !== parentOrigin) return;
    if (e.source !== window.parent) return;
    if (e.data == null || typeof e.data !== 'object') return;
    let handler = handlers[e.data.type];
    if (handler != null) handler(e.data);
});

tileEl.addEventListener('click', function () {
    hostSend({ type: 'open' });
});

hostSend({ type: 'hello' });
