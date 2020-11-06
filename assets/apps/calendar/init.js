var mainWindow;
var origin;
var currentUsername;
var cal, resizeThrottled;
var useCreationPopup = true;
var useDetailPopup = true;
var datePicker, selectedCalendar;
var CalendarList = [];
var ScheduleList = [];
let ScheduleCache = [];
let LoadedEvents = [];
var currentMoment = moment();
var loadCalendarAsGuest = false;
let CALENDAR_ID_MY_CALENDAR = "1";

let CALENDAR_EVENT_CANCELLED = "Cancelled";
let CALENDAR_EVENT_ACTIVE = "Active";

function buildUI(isCalendarReadonly) {
    let uiDiv = document.getElementById("ui");
    uiDiv.removeAttribute("style");

    cal = new tui.Calendar('#calendar', {
        usageStatistics: false,
        defaultView: 'month',
        //week: {
        //	startDayOfWeek: 1
        //},
        //month: {
        //	startDayOfWeek: 1
        //},
        taskView: false,
        useCreationPopup: useCreationPopup,
        useDetailPopup: useDetailPopup,
        calendars: CalendarList,
        isReadOnly: isCalendarReadonly,
        template: {
            allday: function(schedule) {
                return getTimeTemplate(schedule, true);
            },
            time: function(schedule) {
                return getTimeTemplate(schedule, false);
            }
        }
    });

    cal.on({
        'clickMore': function(e) {
            //console.log('clickMore', e);
        },
        'clickSchedule': function(e) {
            //console.log('clickSchedule', e);
        },
        'clickDayname': function(date) {
            //console.log('clickDayname', date);
        },
        'beforeCreateSchedule': function(e) {
            //console.log('beforeCreateSchedule', e);
            let schedule = buildNewSchedule(e);
            ScheduleList.push(schedule);
            cal.createSchedules([schedule]);
            addToCache(schedule);
            refreshScheduleVisibility();
            save(schedule);
        },
        'beforeUpdateSchedule': function(e) {
            var schedule = e.schedule;
            var changes = e.changes;
            if(changes == null) {
                return;
            }
            //console.log('beforeUpdateSchedule', e);
            if (changes && !changes.isAllDay && schedule.category === 'allday') {
                changes.category = 'time';
            }
            cal.updateSchedule(schedule.id, schedule.calendarId, changes);
            let updatedCalendarId = (changes != null && changes.calendarId != null) ? changes.calendarId : schedule.calendarId;
            let updatedSchedule = cal.getSchedule(schedule.id, updatedCalendarId);

            ScheduleList.splice(ScheduleList.findIndex(v => v.id === schedule.id), 1);
            ScheduleList.push(updatedSchedule);
            updateCache(schedule, updatedSchedule);
            save(updatedSchedule);
            refreshScheduleVisibility();
        },
        'beforeDeleteSchedule': function(e) {
            //console.log('beforeDeleteSchedule', e);
            removeScheduleFromCalendar(e.schedule);
        },
        'afterRenderSchedule': function(e) {
            var schedule = e.schedule;
            // var element = cal.getElement(schedule.id, schedule.calendarId);
            // console.log('afterRenderSchedule', element);
        },
        'clickTimezonesCollapseBtn': function(timezonesCollapsed) {
            //console.log('timezonesCollapsed', timezonesCollapsed);
            if (timezonesCollapsed) {
                cal.setTheme({
                    'week.daygridLeft.width': '77px',
                    'week.timegridLeft.width': '77px'
                });
            } else {
                cal.setTheme({
                    'week.daygridLeft.width': '60px',
                    'week.timegridLeft.width': '60px'
                });
            }

            return true;
        }
    });
}
window.addEventListener('message', function (e) {
    // You must verify that the origin of the message's sender matches your
    // expectations. In this case, we're only planning on accepting messages
    // from our own origin, so we can simply compare the message event's
    // origin to the location of this document. If we get a message from an
    // unexpected host, ignore the message entirely.
    if (e.origin !== (window.location.protocol + "//" + window.location.host))
        return;
    
    mainWindow = e.source;
    origin = e.origin;
    if (e.data.type == "load") {
        initialiseCalendar(false, e.data.calendars);
        load(e.data.previousMonth, e.data.currentMonth, e.data.nextMonth, e.data.yearMonth, e.data.username);
    } else if (e.data.type == "loadAdditional") {
        loadAdditional(e.data.currentMonth, e.data.yearMonth);
    } else if (e.data.type == "respondRenameCalendar") {
        respondToCalendarRename(e.data.oldName, e.data.newName);
    } else if(e.data.type == "importICSFile") {
        loadCalendarAsGuest = e.data.loadCalendarAsGuest;
        if(loadCalendarAsGuest) {
            initialiseCalendar(true, []);
        } else {
            setCalendars(true, []);
        }
        importICSFile(e.data.contents, e.data.username, e.data.isSharedWithUs, loadCalendarAsGuest);
    }
});
function renameCalendar(currentName, event) {
    mainWindow.postMessage({action:'requestRenameCalendar', currentName: currentName}, origin);
    event.stopPropagation();
}
function safetext(text){
	var table = {
		'<': 'lt',
		'>': 'gt',
		'"': 'quot',
		'\'': 'apos',
		'&': 'amp',
		'\r': '#10',
		'\n': '#13'
	};

	return text.toString().replace(/[<>"'\r\n&]/g, function(chr){
		return '&' + table[chr] + ';';
	});
	return text;
};
function respondToCalendarRename(oldName, newName) {
    console.log("back in calendar")
    let newCalendarName = safetext(newName);
    for(var i=0; i < CalendarList.length;i++) {
        let item = CalendarList[i];
        if (item.name == oldName) {
            item.name = newCalendarName;
            break;
        }
    }
    replaceCalendarsInUI();
    cal.setCalendars(CalendarList);
}
function initialiseCalendar(loadCalendarAsGuest, calendars) {
    buildUI(loadCalendarAsGuest);
    setCalendars(false, calendars);
    cal.setCalendars(CalendarList);
    setDropdownCalendarType();
    setEventListener();
}
function ScheduleInfo() {
    this.id = null;
    this.calendarId = null;

    this.title = null;
    this.body = null;
    this.isAllDay = false;
    this.start = null;
    this.end = null;
    this.category = '';
    this.isPrivate = false;
    this.location = null;
    this.dueDateClass = '';

    this.color = null;
    this.bgColor = null;
    this.dragBgColor = null;
    this.borderColor = null;
    this.customStyle = '';

    this.isFocused = false;
    this.isPending = false;
    this.isVisible = true;
    this.isReadOnly = false;
    this.goingDuration = 0;
    this.comingDuration = 0;
    this.recurrenceRule = '';
    this.state = CALENDAR_EVENT_ACTIVE;

    this.raw = {
        memo: '',
        hasToOrCc: false,
        hasRecurrenceRule: false,
        location: null,
        class: 'public', // or 'private'
        creator: {
            name: currentUsername,
            avatar: '',
            company: '',
            email: '',
            phone: ''
        }
    };
}

function removeScheduleFromCalendar(schedule) {
    cal.deleteSchedule(schedule.id, schedule.calendarId);
    ScheduleList.splice(ScheduleList.findIndex(v => v.id === schedule.id), 1);
    removeFromCache(schedule);
    deleteSchedule(schedule);
}

function displayMessage(msg) {
    mainWindow.postMessage({type:"displayMessage", message: msg}, origin);
}

function unpackIcal(IcalFile) {
    let icalComponent = new ICAL.Component(ICAL.parse(IcalFile));
    let vevents = icalComponent.getAllSubcomponents('vevent');
    if(vevents.length != 1) {
        let msg = "multiple events in ical not supported!";
        console.log(msg);
        displayMessage(msg);
        return null;
    }
    let vvent = vevents[0];
    if( vvent.hasProperty('rrule') ){
        let msg = "recurring events currently not supported!";
        console.log(msg);
        displayMessage(msg);
        return null;
    } else {
        LoadedEvents[vvent.getFirstPropertyValue('uid')] = icalComponent;
        return unpackEvent(vvent, false, false);
    }
}
function unpackEvent(iCalEvent, fromImport, isSharedWithUs) {
    event['isAllDay'] = true;
    event['Id'] = iCalEvent.getFirstPropertyValue('uid');
    event['title'] = iCalEvent.getFirstPropertyValue('summary');
    event['description'] = iCalEvent.getFirstPropertyValue('description');
    event['location'] = iCalEvent.getFirstPropertyValue('location');
    let dtStart = iCalEvent.getFirstPropertyValue('dtstart');
    event['start'] = dtStart.toJSDate();
    if (dtStart.toICALString().indexOf('T')>-1){
        event['isAllDay'] = false;
    }
    try {
        let duration = iCalEvent.getFirstPropertyValue('duration').toSeconds();
        event['end']= new Date(event['start'].getTime() + (duration * 1000));
    } catch (ex) {
	    try {
        	event['end'] = iCalEvent.getFirstPropertyValue('dtend').toJSDate();
    	} catch (ex2) {
    		event['end'] = event['start'];
	    }
    }
    let xOwner = iCalEvent.getFirstPropertyValue('x-owner');
    if (fromImport && ! isSharedWithUs) {
        event.owner = currentUsername;
    } else {
        event.owner = xOwner;
    }
    event['calendarId'] = CALENDAR_ID_MY_CALENDAR;
    if (iCalEvent.getFirstPropertyValue('status') === "CANCELLED") {
        event['state'] = CALENDAR_EVENT_CANCELLED;
    } else {
        event['state'] = CALENDAR_EVENT_ACTIVE;
    }
    let allAttendees = [];
    let attendees = iCalEvent.getAllProperties('attendee');
    attendees.forEach(function(attendee) {
        allAttendees.push(attendee.getFirstValue());
    });
    event.attendees = allAttendees;
    return event;
}
function addCalendarEvent(eventInfo) {
    let event = unpackIcal(eventInfo);
    if(event == null) {
        return;
    }
    return buildScheduleFromEvent(event);
}
function buildScheduleFromEvent(event) {
    var schedule = new ScheduleInfo();
    schedule.id = event.Id;
    schedule.calendarId = event.calendarId;
    schedule.title = event.title;
    schedule.body = '';
    schedule.isReadOnly = currentUsername != event.owner ? true : false;
    schedule.isAllDay = event.isAllDay;
    schedule.category = event.isAllDay ? 'allday' : 'time';
    schedule.start = moment(event.start).toDate();
    schedule.end = moment(event.end).toDate();
    //schedule.isPrivate = event.isPrivate;
    schedule.location = event.location;
    schedule.attendees = event.attendees;
    schedule.recurrenceRule = '';
    schedule.state = event.state;
    var calendar = findCalendar(event.calendarId);
    schedule.color = calendar.color;
    schedule.bgColor = calendar.bgColor;
    schedule.dragBgColor = calendar.dragBgColor;
    schedule.borderColor = calendar.borderColor;
    schedule.raw.memo = event.description;
    schedule.raw.creator.name = event.owner;
    return schedule;

}
function removeFromCache(schedule) {
    let dt = moment.utc(schedule.start.toUTCString());
    let yearMonth = dt.year() * 12 + dt.month();
    let monthCache = ScheduleCache[yearMonth];
    if (monthCache != null) {
        monthCache.splice(monthCache.findIndex(v => v.id === schedule.id), 1);
    }
}
function addToCache(newSchedule) {
    let dt = moment.utc(newSchedule.start.toUTCString());
    let newYearMonth = dt.year() * 12 + dt.month();
    let monthCache = ScheduleCache[newYearMonth];
    if (monthCache != null) {
        monthCache.push(newSchedule);
    }
}
function updateCache(oldSchedule, newSchedule) {
    if (oldSchedule != null) {
        let dt = moment.utc(oldSchedule.start.toUTCString());
        let oldYearMonth = dt.year() * 12 + dt.month();
        let monthCache = ScheduleCache[oldYearMonth];
        if (monthCache != null) {
            monthCache.splice(monthCache.findIndex(v => v.id === oldSchedule.id), 1);
        }
    }
    if (newSchedule != null) {
        let newDt = moment.utc(newSchedule.start.toUTCString());
        let newYearMonth = newDt.year() * 12 + newDt.month();
        let monthCache = ScheduleCache[newYearMonth];
        if (monthCache != null) {
            monthCache.push(newSchedule);
        }
    }
}
function importICSFile(contents, username, isSharedWithUs, loadCalendarAsGuest) {
    currentUsername = username;
    let icalComponent = new ICAL.Component(ICAL.parse(contents));
    let vevents = icalComponent.getAllSubcomponents('vevent');
    let allEvents = [];
    if (loadCalendarAsGuest) {
        var yearMonth = currentMoment.year() * 12 + currentMoment.month();
        load([], [], [], yearMonth, "unknown");
    }
    vevents.forEach(function(vvent, idx) {
        if( vvent.hasProperty('rrule') ){
            let msg = "recurring events currently not supported!";
            console.log(msg);
            displayMessage(msg);
            return null;
        } else {
            let schedule = buildScheduleFromEvent(unpackEvent(vvent, true, isSharedWithUs));
            if (loadCalendarAsGuest) {
                loadArbitrarySchedule(schedule);
                if(idx == vevents.length -1) {
                    removeSpinner();
                }
            } else {
                let dt = moment.utc(schedule.start.toUTCString());
                let year = dt.year();
                let month = dt.month() + 1;
                let output = serialiseICal(schedule);
                allEvents.push({year: year, month: month, Id: schedule.id, item:output});
                if(idx == vevents.length -1) {
                    mainWindow.postMessage({items:allEvents, type:"saveAll"}, origin);
                }
            }
        }
    });
}
function loadAdditional(currentMonthEvents, yearMonth) {
    let monthCache = [];
    ScheduleCache[yearMonth] = monthCache;
    let currentYearMonth = currentMoment.year() * 12 + currentMoment.month();
    if (currentYearMonth < yearMonth) {
        ScheduleList = ScheduleCache[currentYearMonth-1].concat(ScheduleCache[currentYearMonth]);
    } else {
        ScheduleList = ScheduleCache[currentYearMonth+1].concat(ScheduleCache[currentYearMonth]);
    }
    for (var i = 0; i < currentMonthEvents.length; i++) {
        let schedule = addCalendarEvent(currentMonthEvents[i]);
        ScheduleList.push(schedule);
        monthCache.push(schedule);
    }
    cal.createSchedules(ScheduleList);
    refreshScheduleVisibility();
    setRenderRangeText();
    removeSpinner();
}
function loadArbitrarySchedule(schedule) {
    let dt = moment.utc(schedule.start.toUTCString());
    let yearMonth = dt.year() * 12 + dt.month();
    ScheduleList = ScheduleCache[yearMonth];
    if (ScheduleList == null) {
        let monthCache = [];
        ScheduleCache[yearMonth] = monthCache;
        ScheduleList = ScheduleCache[yearMonth];
    }
    ScheduleList.push(schedule);
    cal.createSchedules(ScheduleList);
    refreshScheduleVisibility();
    setRenderRangeText();
    removeSpinner();
}
function load(previousMonthEvents, currentMonthEvents, nextMonthEvents, yearMonth, username) {
    currentUsername = username;
    let previousYearMonth = yearMonth - 1;
    let year = Math.floor(previousYearMonth / 12);
    let month = previousYearMonth % 12;
    let previousMonthCache = [];
    ScheduleCache[year * 12 + month] = previousMonthCache;
    for (var i = 0; i < previousMonthEvents.length; i++) {
        let schedule = addCalendarEvent(previousMonthEvents[i]);
        ScheduleList.push(schedule);
        previousMonthCache.push(schedule);
    }
    year = Math.floor(yearMonth / 12);
    month = yearMonth % 12;
    let currentMonthCache = [];
    ScheduleCache[year * 12 + month] = currentMonthCache;
    for (var i = 0; i < currentMonthEvents.length; i++) {
        let schedule = addCalendarEvent(currentMonthEvents[i]);
        ScheduleList.push(schedule);
        currentMonthCache.push(schedule);
    }
    let nextYearMonth = yearMonth + 1;
    year = Math.floor(nextYearMonth / 12);
    month = nextYearMonth % 12;
    let nextMonthCache = [];
    ScheduleCache[year * 12 + month] = nextMonthCache;
    for (var i = 0; i < nextMonthEvents.length; i++) {
        let schedule = addCalendarEvent(nextMonthEvents[i]);
        ScheduleList.push(schedule);
        nextMonthCache.push(schedule);
    }
    cal.createSchedules(ScheduleList);
    refreshScheduleVisibility();
    setRenderRangeText();
    removeSpinner();
}

function deleteSchedule(schedule) {
    let Id = schedule.id;
    let dt = moment.utc(schedule.start.toUTCString());
    let year = dt.year();
    let month = dt.month() + 1;
    mainWindow.postMessage({year: year, month: month, Id: Id, type:"delete"}, origin);
}

function displaySpinner(schedule) {
    mainWindow.postMessage({type:"displaySpinner"}, origin);
}

function removeSpinner(schedule) {
    mainWindow.postMessage({type:"removeSpinner"}, origin);
}

function toICalTime(tzDate, isAllDay) {
    let dt = moment.utc(tzDate.toUTCString());
    if (isAllDay && tzDate.getDate() != dt.date()) {
        dt.add(1, 'days');
    }
    var dateTime = new ICAL.Time({
      year: dt.year(),
      month:  dt.month() +1,
      day: dt.date(),
      hour: dt.hour(),
      minute: dt.minute(),
      second: dt.second(),
      isDate: isAllDay
    }, ICAL.Timezone.utcTimezone);
    return dateTime;
}
function save(schedule) {
    //let isPrivate = schedule.isPrivate;
    //let state = schedule.state;
    let dt = moment.utc(schedule.start.toUTCString());
    let year = dt.year();
    let month = dt.month() + 1;
    let output = serialiseICal(schedule);
    mainWindow.postMessage({year: year, month: month, Id: schedule.id, item:output, type:"save"}, origin);
}
function serialiseICal(schedule) {
    var comp = LoadedEvents[schedule.id];
    if (comp != null) {
        let vevents = comp.getAllSubcomponents('vevent');
        let vvent = vevents[0];
        vvent.updatePropertyWithValue('summary', schedule.title);
        vvent.updatePropertyWithValue('description', schedule.raw.memo);
        vvent.updatePropertyWithValue('location', schedule.location);
        vvent.updatePropertyWithValue('dtstart', toICalTime(schedule.start, schedule.isAllDay));
        vvent.updatePropertyWithValue('dtend', toICalTime(schedule.end, schedule.isAllDay));
        vvent.updatePropertyWithValue('x-owner', schedule.raw.creator.name);
        if(schedule.state == CALENDAR_EVENT_CANCELLED) { //CANCELLED
            vvent.updatePropertyWithValue('status', "CANCELLED");
        } else {
            vvent.removeProperty('status');
        }
    } else {
        comp = new ICAL.Component(['vcalendar', [], []]);
        comp.updatePropertyWithValue('prodid', '-//iCal.js');
        let vevent = new ICAL.Component('vevent'),
        event = new ICAL.Event(vevent);
        event.uid = schedule.id;
        event.summary = schedule.title;
        event.description = schedule.raw.memo;
        event.location = schedule.location;
        event.startDate = toICalTime(schedule.start, schedule.isAllDay);
        event.endDate = toICalTime(schedule.end, schedule.isAllDay);
        vevent.addPropertyWithValue('x-owner', schedule.raw.creator.name);
        if(schedule.state == CALENDAR_EVENT_CANCELLED) { //CANCELLED
            vevent.addPropertyWithValue('status', "CANCELLED");
        }
        comp.addSubcomponent(vevent);
        LoadedEvents[schedule.id] = comp;
    }
    return comp.toString();
}


function CalendarInfo() {
    this.id = null;
    this.name = null;
    this.checked = true;
    this.color = null;
    this.bgColor = null;
    this.borderColor = null;
    this.dragBgColor = null;
}

function findCalendar(id) {
    var found;
    CalendarList.forEach(function(calendar) {
        if (calendar.id === id) {
            found = calendar;
        }
    });
    return found || CalendarList[0];
}

function setCalendars(headless, calendars) {
    var calendar;
    var id = 0;

    calendar = new CalendarInfo();
    id = CALENDAR_ID_MY_CALENDAR;
    calendar.id = String(id);
    calendar.name = calendars.length == 0 ? "My Calendar" : calendars[0].name;
    calendar.color = '#ffffff';
    calendar.bgColor = '#00a9ff';
    calendar.dragBgColor = '#00a9ff';
    calendar.borderColor = '#00a9ff';
    CalendarList.push(calendar);

/* future extensibility
    calendar = new CalendarInfo();
    id = 1; //purple
    calendar.id = String(id);
    calendar.name = 'Work';
    calendar.color = '#ffffff';
    calendar.bgColor = '#9e5fff';
    calendar.dragBgColor = '#9e5fff';
    calendar.borderColor = '#9e5fff';
    CalendarList.push(calendar);

    calendar = new CalendarInfo();
    id = 3; //red
    calendar.id = String(id);
    calendar.name = 'Family';
    calendar.color = '#ffffff';
    calendar.bgColor = '#ff5583';
    calendar.dragBgColor = '#ff5583';
    calendar.borderColor = '#ff5583';
    CalendarList.push(calendar);

    calendar = new CalendarInfo();
    id = 4; //dark green
    calendar.id = String(id);
    calendar.name = 'Friends';
    calendar.color = '#ffffff';
    calendar.bgColor = '#03bd9e';
    calendar.dragBgColor = '#03bd9e';
    calendar.borderColor = '#03bd9e';
    CalendarList.push(calendar);

    calendar = new CalendarInfo();
    id = 5;
    calendar.id = String(id);
    calendar.name = 'Cancelled';
    calendar.color = '#ffffff';
    calendar.bgColor = '#9d9d9d';
    calendar.dragBgColor = '#9d9d9d';
    calendar.borderColor = '#9d9d9d';
    CalendarList.push(calendar);

    calendar = new CalendarInfo();
    id = 6;
    calendar.id = String(id);
    calendar.name = 'Shared With Me';
    calendar.color = '#ffffff';
    calendar.bgColor = '#bbdc00';
    calendar.dragBgColor = '#bbdc00';
    calendar.borderColor = '#bbdc00';
    CalendarList.push(calendar);
*/
    if (!headless) {
        replaceCalendarsInUI();
    }
}
    function replaceCalendarsInUI() {
        var calendarList = document.getElementById('calendarList');
        var html = [];
        CalendarList.forEach(function(calendar) {
                html.push('<div class="lnb-calendars-item"><label>' +
                    '<input type="checkbox" class="tui-full-calendar-checkbox-round" value="' + calendar.id + '" checked>' +
                    '<span style="border-color: ' + calendar.borderColor + '; background-color: ' + calendar.borderColor + ';"></span>' +
                    '</label><label><span style="cursor:text;" onclick="renameCalendar(\'' + calendar.name + '\', event)">' + calendar.name + '</span>' +
                    '</label></div>'
                );
        });
        calendarList.innerHTML = html.join('\n');
    }
    /**
     * Get time template for time and all-day
     * @param {Schedule} schedule - schedule
     * @param {boolean} isAllDay - isAllDay or hasMultiDates
     * @returns {string}
     */
    function getTimeTemplate(schedule, isAllDay) {
        var html = [];
        var start = moment(schedule.start.toUTCString());
        if (!isAllDay) {
            html.push('<strong>' + start.format('HH:mm') + '</strong> ');
        }
        if (schedule.isPrivate) {
            html.push('<span class="calendar-font-icon ic-lock-b"></span>');
            html.push(' Private');
        } else {
            if (schedule.isReadOnly) {
                html.push('<span class="calendar-font-icon ic-readonly-b"></span>');
            } else if (schedule.recurrenceRule) {
                html.push('<span class="calendar-font-icon ic-repeat-b"></span>');
            } else if (schedule.attendees.length) {
                html.push('<span class="calendar-font-icon ic-user-b"></span>');
            } else if (schedule.location) {
                html.push('<span class="calendar-font-icon ic-location-b"></span>');
            }
            html.push(' ' + schedule.title);
        }

        return html.join('');
    }

    //https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
    function uuidv4() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }

    function buildNewSchedule(scheduleData) {
        var calendar = scheduleData.calendar || findCalendar(scheduleData.calendarId);
        var schedule = {
            id: uuidv4(),
            title: scheduleData.title,
            isAllDay: scheduleData.isAllDay,
            start: scheduleData.start,
            end: scheduleData.end,
            category: scheduleData.isAllDay ? 'allday' : 'time',
            dueDateClass: '',
            color: calendar.color,
            bgColor: calendar.bgColor,
            dragBgColor: calendar.bgColor,
            borderColor: calendar.borderColor,
            location: scheduleData.location,
            isPrivate: false,//scheduleData.raw['class'] == 'private' ? true : false,
            raw: {
                class: scheduleData.raw['class'],
                memo: scheduleData.raw['memo'],
                creator: {
                    name: currentUsername
                }
            },
            state: scheduleData.state
        };
        if (calendar) {
            schedule.calendarId = calendar.id;
            schedule.color = calendar.color;
            schedule.bgColor = calendar.bgColor;
            schedule.borderColor = calendar.borderColor;
        }
        return schedule;
    }

    function onChangeCalendars(e) {
        var calendarId = e.target.value;
        var checked = e.target.checked;
        var viewAll = document.querySelector('.lnb-calendars-item input');
        var calendarElements = Array.prototype.slice.call(document.querySelectorAll('#calendarList input'));
        var allCheckedCalendars = true;

        if (calendarId === 'all') {
            allCheckedCalendars = checked;

            calendarElements.forEach(function(input) {
                var span = input.parentNode;
                input.checked = checked;
                span.style.backgroundColor = checked ? span.style.borderColor : 'transparent';
            });

            CalendarList.forEach(function(calendar) {
                calendar.checked = checked;
            });
        } else {
            findCalendar(calendarId).checked = checked;

            allCheckedCalendars = calendarElements.every(function(input) {
                return input.checked;
            });

            if (allCheckedCalendars) {
                viewAll.checked = true;
            } else {
                viewAll.checked = false;
            }
        }

        refreshScheduleVisibility();
    }

function getDataAction(target) {
  return target.dataset ? target.dataset.action : target.getAttribute('data-action');
}

function setDropdownCalendarType() {
  var calendarTypeName = document.getElementById('calendarTypeName');
  var calendarTypeIcon = document.getElementById('calendarTypeIcon');
  var options = cal.getOptions();
  var type = cal.getViewName();
  var iconClassName;

  if (type === 'day') {
    type = 'Daily';
    iconClassName = 'calendar-icon ic_view_day';
  } else if (type === 'week') {
    type = 'Weekly';
    iconClassName = 'calendar-icon ic_view_week';
  } else if (options.month.visibleWeeksCount === 2) {
    type = '2 weeks';
    iconClassName = 'calendar-icon ic_view_week';
  } else if (options.month.visibleWeeksCount === 3) {
    type = '3 weeks';
    iconClassName = 'calendar-icon ic_view_week';
  } else {
    type = 'Monthly';
    iconClassName = 'calendar-icon ic_view_month';
  }

  calendarTypeName.innerHTML = type;
  calendarTypeIcon.className = iconClassName;
}

function onClickMenu(e) {
  var target = $(e.target).closest('a[role="menuitem"]')[0];
  var action = getDataAction(target);
  var options = cal.getOptions();
  var viewName = '';

  switch (action) {
    case 'toggle-daily':
      viewName = 'day';
      break;
    case 'toggle-weekly':
      viewName = 'week';
      break;
    case 'toggle-monthly':
      options.month.visibleWeeksCount = 0;
      viewName = 'month';
      break;
    default:
      break;
  }

  cal.setOptions(options, true);
  cal.changeView(viewName, true);

  setDropdownCalendarType();
  setRenderRangeText();
}

function onClickNavi(e) {
    var action = getDataAction(e.target);
    let viewName = cal.getViewName();
    let wasMoment = currentMoment.clone();
    if (action == 'move-today') {
        let today = moment();
        cal.today();
        if (wasMoment.month() == currentMoment.month()) {
          setRenderRangeText();
        } else {
          reload(today, today);
        }
    } else {
        if (viewName === 'day') {
              switch (action) {
                case 'move-prev':
                    currentMoment.subtract(1, 'days');
                    cal.prev();
                    break;
                case 'move-next':
                    currentMoment.add(1, 'days');
                    cal.next();
                    break;
              }
        }else if (viewName === 'week') {
              switch (action) {
                case 'move-prev':
                    currentMoment.subtract(1, 'weeks');
                    cal.prev();
                    break;
                case 'move-next':
                    currentMoment.add(1, 'weeks');
                    cal.next();
                    break;
              }
        }else if(viewName === 'month') {
                switch (action) {
                  case 'move-prev':
                      currentMoment.subtract(1, 'months');
                      cal.prev();
                      break;
                  case 'move-next':
                      currentMoment.add(1, 'months');
                      cal.next();
                      break;
                }
        }
        if (wasMoment.month() == currentMoment.month()) {
            setRenderRangeText();
        } else {
            let toLoadMonth = currentMoment.clone();
            if (wasMoment.isSameOrAfter(currentMoment)) {
                toLoadMonth.subtract(1, 'months');
                reload(currentMoment, toLoadMonth);
            } else {
                toLoadMonth.add(1, 'months');
                reload(currentMoment, toLoadMonth);
            }
        }
    }
}

function reload(currentMoment, toLoadMonth) {
    ScheduleList = [];
    cal.clear();
    let cachedList = ScheduleCache[toLoadMonth.year() * 12 + toLoadMonth.month()];
    if (cachedList == null) {
        displaySpinner();
        if (loadCalendarAsGuest) {
            let yearMonth = toLoadMonth.year() * 12 + toLoadMonth.month();
            loadAdditional([], yearMonth);
        } else {
            mainWindow.postMessage({type:"loadAdditional", year: toLoadMonth.year(), month: (toLoadMonth.month() + 1)},
                origin);
        }
    } else {
        let currentYearMonth = currentMoment.year() * 12 + currentMoment.month();
        ScheduleList = ScheduleCache[currentYearMonth-1].concat(ScheduleCache[currentYearMonth]).concat(ScheduleCache[currentYearMonth+1]);
        cal.createSchedules(ScheduleList);
        refreshScheduleVisibility();
        setRenderRangeText();
    }
}

function setRenderRangeText() {
  var renderRange = document.getElementById('renderRange');
  var options = cal.getOptions();
  var viewName = cal.getViewName();
  var html = [];
  if (viewName === 'day') {
    html.push(moment(cal.getDate().getTime()).format('YYYY.MM.DD'));
  } else if (viewName === 'month' &&
    (!options.month.visibleWeeksCount || options.month.visibleWeeksCount > 4)) {
    html.push(moment(cal.getDate().getTime()).format('MMMM YYYY'));
  } else {
    html.push(moment(cal.getDateRangeStart().getTime()).format('YYYY.MM.DD'));
    html.push(' ~ ');
    html.push(moment(cal.getDateRangeEnd().getTime()).format(' MM.DD'));
  }
  renderRange.innerHTML = html.join('');
}

function refreshScheduleVisibility() {
  var calendarElements = Array.prototype.slice.call(document.querySelectorAll('#calendarList input'));

  CalendarList.forEach(function(calendar) {
    cal.toggleSchedules(calendar.id, !calendar.checked, false);
  });

  cal.render(true);

  calendarElements.forEach(function(input) {
    var span = input.nextElementSibling;
    span.style.backgroundColor = input.checked ? span.style.borderColor : 'transparent';
  });
}
function downloadEvent(schedule) {
    let event = serialiseICal(schedule);
    mainWindow.postMessage({event: event, title: schedule.title, type: 'downloadEvent'}, origin);
}
function shareCalendarEvent(id, startDate) {
    sendEvent(id, startDate, 'shareCalendarEvent');
}
function sendEvent(id, startDate, eventType) {
   let dt = moment.utc(startDate.toUTCString());
   let year = dt.year();
   let month = dt.month() +1;
   mainWindow.postMessage({id: id, year: year, month: month, type: eventType}, origin);
}
resizeThrottled = tui.util.throttle(function() {
  cal.render();
}, 50);

function setEventListener() {
  $('.dropdown-menu a[role="menuitem"]').on('click', onClickMenu);
  $('#menu-navi').on('click', onClickNavi);
$('#lnb-calendars').on('change', onChangeCalendars);
  window.addEventListener('resize', resizeThrottled);
}

function buildExtraFields(eventData, that) {
    let calendarSpan = document.getElementById("calendar-name");
    if(eventData.schedule.raw.creator.name != currentUsername) {
        calendarSpan.innerText = calendarSpan.innerText + " (Shared by " + eventData.schedule.raw.creator.name + ")";
        if (!loadCalendarAsGuest) {
            var deleteButton = document.createElement("button");
            calendarSpan.appendChild(deleteButton);
            deleteButton.appendChild(document.createTextNode("Delete"));
            deleteButton.style.marginLeft="20px";
            deleteButton.onclick=function() {
                that.hide();
                removeScheduleFromCalendar(eventData.schedule);
            };
        }
    }

    let closeBtnDiv = document.getElementById("close-button");
    if(closeBtnDiv != null) {
        var closeBtn = document.createElement("button");
        closeBtn.classList.add("tui-full-calendar-button");
        closeBtn.classList.add("tui-full-calendar-popup-close");
        closeBtnDiv.appendChild(closeBtn);

        var btnSpan = document.createElement("span");
        btnSpan.classList.add("tui-full-calendar-icon");
        btnSpan.classList.add("tui-full-calendar-ic-close");
        closeBtn.appendChild(btnSpan);
        closeBtn.onclick=function() {
           that.hide();
            return true;
        };
    }

    let eventDetails = document.getElementById("event-details");
    var div1 = document.createElement("div");
    eventDetails.appendChild(div1);

    var span1 = document.createElement("span");
    div1.appendChild(span1);
    if(!eventData.schedule.isReadOnly) {
        var img = document.createElement("img");
        img.src = "./images/user-plus.svg";
        img.style.width="16px";
        img.style.height="16px";
        span1.appendChild(img);

        var shareLink = document.createElement("a");
        shareLink.style.cursor="pointer";
        shareLink.style.marginLeft="3px";
        shareLink.innerText = "Share";
        span1.appendChild(shareLink);
        shareLink.onclick=function() {
            shareCalendarEvent(eventData.schedule.id, eventData.schedule.start);
        };
        span1.appendChild(document.createTextNode('\u00A0\u00A0'));
    }

    var img5 = document.createElement("img");
    img5.src = "./images/download.png";
    span1.appendChild(img5);

    var downloadLink = document.createElement("a");
    downloadLink.style.cursor="pointer";
    downloadLink.style.marginLeft="3px";
    downloadLink.innerText = "Download";
    span1.appendChild(downloadLink);
    downloadLink.onclick=function() {
        downloadEvent(eventData.schedule);
    };
    span1.appendChild(document.createTextNode('\u00A0\u00A0'));


    var div2 = document.createElement("div");
    eventDetails.appendChild(div2);
    var div3 = document.createElement("div");
    div3.classList.add("memo-field-alternate");
    div3.id = "popup-memo-readonly";
    div3.innerText = eventData == null ? "" : eventData.schedule.raw.memo;
    div2.appendChild(div3);
}
function addMemoField(eventData) {

    let lock = document.getElementById("tui-full-calendar-schedule-private");
    lock.style.display = 'none';

    let loc = document.getElementById("tui-full-calendar-schedule-location");
    let parent = loc.parentNode.parentNode.parentNode;
    var locTextArea = document.createElement("textarea");
    locTextArea.id = "popup-memo";
    locTextArea.value = eventData == null ? "" : eventData.schedule.raw.memo;
    locTextArea.rows = 5;
    locTextArea.classList.add("memo-field-edit");

    var div1 = document.createElement("div");
    parent.appendChild(div1);
    var div2 = document.createElement("div");
    div1.appendChild(div2);
    div2.appendChild(locTextArea);
    if (eventData != null) {
        let saveBtn = document.getElementById("popup-save");
        var handler = function() {
            eventData.schedule.raw.memo = locTextArea.value;
        }
        saveBtn.onclick=handler;
    }
}
