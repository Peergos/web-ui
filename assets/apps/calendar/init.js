var mainWindow;
var origin;

let handler = function (e) {
      // You must verify that the origin of the message's sender matches your
      // expectations. In this case, we're only planning on accepting messages
      // from our own origin, so we can simply compare the message event's
      // origin to the location of this document. If we get a message from an
      // unexpected host, ignore the message entirely.
      if (e.origin !== (window.location.protocol + "//" + window.location.host))
          return;

      mainWindow = e.source;
      origin = e.origin;
      if (e.data.type == "ping") {
          console.log("ping");
      } else if (e.data.type == "load") {
          initialiseCalendar(false, e.data.calendars);
          load(e.data.previousMonth, e.data.currentMonth, e.data.nextMonth, e.data.yearMonth, e.data.username);
      } else if (e.data.type == "loadAdditional") {
          loadAdditional(e.data.currentMonth, e.data.yearMonth);
      } else if (e.data.type == "respondRenameCalendar") {
          respondToCalendarRename(e.data.calendar);
      } else if (e.data.type == "respondDeleteCalendar") {
          respondToCalendarDelete(e.data.calendar);
      } else if (e.data.type == "respondAddCalendar") {
          respondToCalendarAdd(e.data.newId, e.data.newName, e.data.newColor);
      } else if (e.data.type == "respondCalendarColorChange") {
          respondToCalendarColorChange(e.data.calendarName, e.data.newColor);
      } else if(e.data.type == "importICSFile") {
          loadCalendarAsGuest = e.data.loadCalendarAsGuest;
          if(loadCalendarAsGuest) {
              initialiseCalendar(true, []);
          } else {
              setCalendars(true, []);
          }
          importICSFile(e.data.contents, e.data.username, e.data.isSharedWithUs, loadCalendarAsGuest, "default", true);
      }
};
window.addEventListener('message', handler);

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

var colorpicker = null;
let colorPalette = ['#181818', '#282828', '#383838', '#585858', '#B8B8B8', '#D8D8D8', '#E8E8E8', '#F8F8F8', '#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'];
let colorPickerElement = document.getElementById('color-picker');

var calendarRequiresReload = false;

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
            save(schedule, schedule.calendarId);
        },
        'beforeUpdateSchedule': function(e) {
            var schedule = e.schedule;
            var changes = e.changes;
            //do not simply return if no changes. Memo text is not recorded as a change!
            //if(changes == null) {
            //    return;
            //}
            let previousCalendarId = schedule.calendarId;
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
            save(updatedSchedule, previousCalendarId);
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

function disableToolbarButtons(newValue){
    let calendarSettings = document.getElementById("calendar-settings");
    calendarSettings.disabled = newValue;
    let calendarType = document.getElementById("dropdownMenu-calendarType");
    calendarType.disabled = newValue;
    var moveToTodayButton = document.getElementsByClassName("move-today")[0];
    moveToTodayButton.disabled = newValue;
    var navigateButtons = document.getElementsByClassName("move-day");
    for(var j=0; j < navigateButtons.length; j++) {
        navigateButtons[j].disabled = newValue;
    }
}
function renameCalendar(calendar) {
    mainWindow.postMessage({action:'requestRenameCalendar', calendar: calendar}, origin);
}
function addCalendar(){
    let idAsInt = new Number(CALENDAR_ID_MY_CALENDAR) + CalendarList.length;
    let color = colorPalette[(idAsInt % 8) + 8];
    mainWindow.postMessage({action:'requestAddCalendar', newColor:color}, origin);
}
function respondToCalendarRename(calendar) {
    let calendarItem = document.getElementById("cal-item-name-" + calendar.id);
    calendarItem.innerText = calendar.name;
    for(var i=0; i < CalendarList.length;i++) {
        let item = CalendarList[i];
        if (item.id == calendar.id) {
            item.name = calendar.name;
            break;
        }
    }
    replaceCalendarsInUI();
    cal.setCalendars(CalendarList);
}
function respondToCalendarColorChange(calendarName, newColor) {
    let calendarId = findCalendarByName(calendarName).id
    let calendarEl = document.getElementById("cal-item-" + calendarId);
    calendarEl.style = "border-color: " + newColor + "; background-color: " + newColor;
    for(var i=0; i < CalendarList.length;i++) {
        let item = CalendarList[i];
        if (item.id == calendarId) {
            item.bgColor = newColor;
            item.dragBgColor = newColor;
            item.borderColor = newColor;
            break;
        }
    }
    replaceCalendarsInUI();
    cal.setCalendars(CalendarList);
}
function respondToCalendarDelete(calendar) {
    let calendarItem = document.getElementById("cal-id-" + calendar.id);
    calendarItem.remove();
    CalendarList.splice(CalendarList.findIndex(v => v.id === calendar.id), 1);
    replaceCalendarsInUI();
    cal.setCalendars(CalendarList);
}

function respondToCalendarAdd(newId, newName, newColor) {

    let newCalendar = new CalendarInfo();
    newCalendar.id = newId;
    newCalendar.name = newName;
    newCalendar.color = '#ffffff';
    newCalendar.bgColor = newColor;
    newCalendar.dragBgColor = newColor;
    newCalendar.borderColor = newColor;
    CalendarList.push(newCalendar);

    replaceCalendarsInUI();
    cal.setCalendars(CalendarList);
    appendCalendar(newCalendar);
}
function initialiseCalendar(loadCalendarAsGuest, calendars) {
    buildUI(loadCalendarAsGuest);
    setCalendars(false, calendars);
    cal.setCalendars(CalendarList);
    setDropdownCalendarType();
    setEventListener();
    disableToolbarButtons(true);
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

function unpackIcal(IcalFile, calendarId) {
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
        return unpackEvent(vvent, false, false, calendarId);
    }
}
function unpackEvent(iCalEvent, fromImport, isSharedWithUs, calendarId) {
    let event = new Object();
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
        event.owner = xOwner != null ? xOwner : '';
    }
    event['calendarId'] = calendarId;
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
    let event = unpackIcal(eventInfo.data, findCalendarByName(eventInfo.calendarName).id);
    if(event == null) {
        return;
    }
    return buildScheduleFromEvent(event);
}
function buildScheduleFromEvent(event) {
    var schedule = new ScheduleInfo();
    schedule.id = event.Id;
    schedule.calendarId = event.calendarId;
    schedule.title = event.title == null ? "No Title" : event.title;
    schedule.body = '';
    schedule.isReadOnly = currentUsername != event.owner ? true : false;
    schedule.isAllDay = event.isAllDay;
    schedule.category = event.isAllDay ? 'allday' : 'time';
    schedule.start = moment(event.start).toDate();
    schedule.end = moment(event.end).toDate();
    //schedule.isPrivate = event.isPrivate;
    schedule.location = event.location == null ? "" : event.location;
    schedule.attendees = event.attendees;
    schedule.recurrenceRule = '';
    schedule.state = event.state;
    var calendar = findCalendar(event.calendarId);
    schedule.color = calendar.color;
    schedule.bgColor = calendar.bgColor;
    schedule.dragBgColor = calendar.dragBgColor;
    schedule.borderColor = calendar.borderColor;
    schedule.raw.memo = event.description == null ? "" : event.description;
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
function importICSFile(contents, username, isSharedWithUs, loadCalendarAsGuest, calendarName, showConfirmation) {
    currentUsername = username;
    let icalComponent = new ICAL.Component(ICAL.parse(contents));
    let vevents = icalComponent.getAllSubcomponents('vevent');
    let allEvents = [];
    let allEventSummaries = [];
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
            let schedule = buildScheduleFromEvent(unpackEvent(vvent, true, isSharedWithUs, CALENDAR_ID_MY_CALENDAR));
            if (loadCalendarAsGuest) {
                loadArbitrarySchedule(schedule);
                if(idx == vevents.length -1) {
                    removeSpinner();
                    disableToolbarButtons(false);
                }
            } else {
                let dt = moment.utc(schedule.start.toUTCString());
                let year = dt.year();
                let month = dt.month() + 1;
                let output = serialiseICal(schedule, false);
                let eventSummary = {datetime: moment(schedule.start.toUTCString()).format('YYYY MMMM Do, h:mm:ss a'), title: schedule.title};

                allEvents.push({calendarName: calendarName, year: year, month: month, Id: schedule.id, item:output,
                        summary: eventSummary});
                if(idx == vevents.length -1) {
                    mainWindow.postMessage({items:allEvents, showConfirmation: showConfirmation, type:"saveAll"}, origin);
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
    disableToolbarButtons(false);
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
    disableToolbarButtons(false);
}

function deleteSchedule(schedule) {
    let Id = schedule.id;
    let dt = moment.utc(schedule.start.toUTCString());
    let year = dt.year();
    let month = dt.month() + 1;
    let calendarName = findCalendar(schedule.calendarId).name;
    mainWindow.postMessage({ calendarName: calendarName, year: year, month: month, Id: Id, type:"delete"}, origin);
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
function save(schedule, previousCalendarId) {
    //let isPrivate = schedule.isPrivate;
    //let state = schedule.state;
    let dt = moment.utc(schedule.start.toUTCString());
    let year = dt.year();
    let month = dt.month() + 1;
    let output = serialiseICal(schedule, true);
    let calendarName = findCalendar(schedule.calendarId).name;
    let previousCalendarName = findCalendar(previousCalendarId).name;
    mainWindow.postMessage({ calendarName: calendarName, year: year, month: month, Id: schedule.id,
        item:output, previousCalendarName: previousCalendarName, type:"save"}, origin);
}
function serialiseICal(schedule, updateTimestamp) {
    var comp = LoadedEvents[schedule.id];
    if (comp != null) {
        let vevents = comp.getAllSubcomponents('vevent');
        let vvent = vevents[0];
        vvent.updatePropertyWithValue('summary', schedule.title);
        vvent.updatePropertyWithValue('description', schedule.raw.memo);
        vvent.updatePropertyWithValue('location', schedule.location);
        if (updateTimestamp) {
            vvent.updatePropertyWithValue('dtstamp', toICalTime(moment().toDate(), false));
        }
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
        comp.updatePropertyWithValue('version', '2.0');
        let vevent = new ICAL.Component('vevent'),
        event = new ICAL.Event(vevent);
        event.uid = schedule.id;
        event.summary = schedule.title;
        event.description = schedule.raw.memo;
        event.location = schedule.location;
        event.startDate = toICalTime(schedule.start, schedule.isAllDay);
        event.endDate = toICalTime(schedule.end, schedule.isAllDay);
        vevent.addPropertyWithValue('x-owner', schedule.raw.creator.name);
        vevent.addPropertyWithValue('dtstamp', toICalTime(moment().toDate(), false));
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

function findCalendarByName(name) {
    var found;
    CalendarList.forEach(function(calendar) {
        if (calendar.name === name) {
            found = calendar;
        }
    });
    return found || CalendarList[0];
}

function setCalendars(headless, calendars) {
    var id = CALENDAR_ID_MY_CALENDAR;

    if (calendars.length == 0) {
        var calendar = new CalendarInfo();
        calendar.id = String(id);
        calendar.name = "My Calendar";
        calendar.color = '#ffffff';
        calendar.bgColor = '#00a9ff';
        calendar.dragBgColor = '#00a9ff';
        calendar.borderColor = '#00a9ff';
        CalendarList.push(calendar);
    } else {
        for(var i = 0; i < calendars.length; i++) {
            var calendar = new CalendarInfo();
            calendar.name = calendars[i].name;
            calendar.id = String(id++);
            calendar.color = '#ffffff';
            let color = calendars[i].color == null ? '#00a9ff' : calendars[i].color;
            calendar.bgColor = color;
            calendar.dragBgColor = color;
            calendar.borderColor = color;
            CalendarList.push(calendar);
        }
    }
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
                    '</label><label><span id="cal-' + calendar.id + '" style="cursor:text;"></span>' +
                    '</label></div>'
                );
        });
        calendarList.innerHTML = html.join('\n');
        CalendarList.forEach(function(calendar) {
            let calendarEl = document.getElementById('cal-' + calendar.id);
            let calName = calendar.name;
            calendarEl.innerText = calName;
            calendarEl.onclick=function(e) {
                let checkbox = target = e.target.parentElement.parentElement.firstElementChild.firstElementChild; //from calendar name to calendar checkbox
                checkbox.checked = !checkbox.checked;
                onChangeCalendars(e);
            };

        });
        $('#lnb-calendars').on('change', onChangeCalendars);
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
        let target = e.target;
        if(e.target.value == null) {
            target = e.target.parentElement.parentElement.firstElementChild.firstElementChild; //from calendar name to calendar checkbox
        }
        var calendarId = target.value;
        var checked = target.checked;
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
            disableToolbarButtons(true);
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
    html.push(moment(cal.getDate().getTime()).format('MMM YYYY'));
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
    let event = serialiseICal(schedule, false);
    mainWindow.postMessage({event: event, title: schedule.title, type: 'downloadEvent'}, origin);
}
function shareCalendarEvent(schedule) {
   let dt = moment.utc(schedule.start.toUTCString());
   let year = dt.year();
   let month = dt.month() +1;
   let calendarName = findCalendar(schedule.calendarId).name;
   mainWindow.postMessage({calendarName: calendarName, id: schedule.id, year: year, month: month, type: 'shareCalendarEvent'}, origin);
}
resizeThrottled = tui.util.throttle(function() {
  cal.render();
}, 50);

function setEventListener() {
  $('.dropdown-menu a[role="menuitem"]').on('click', onClickMenu);
  $('#menu-navi').on('click', onClickNavi);
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
            shareCalendarEvent(eventData.schedule);
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

function showConfigurationPopup() {
    var calendarModal = document.getElementById("calendarModal");
    calendarModal.style.display = "block";
     destroyColorPicker();

    let colorChange = {targetId: null, newColor: null, oldColor: null};
    let configurationPopupCloseFunc = function() {
         calendarModal.style.display = "none";
         if(calendarRequiresReload) {
             mainWindow.postMessage({action: "requestCalendarReload"}, origin);
         }
     };
    calendarModal.onclick = (ev) => calendarModalHandler(ev, colorChange, configurationPopupCloseFunc);

    var calendarModalClose = document.getElementsByClassName("calendar-modal-close")[0];
    calendarModalClose.onclick = configurationPopupCloseFunc;

	let calendarListElement = document.getElementById('calendar-list');
	while(calendarListElement.hasChildNodes()) {
        calendarListElement.removeChild(calendarListElement.firstChild);
	}
    CalendarList.forEach(function(calendar) {
        appendCalendar(calendar);
    });
}

function calendarModalHandler(event, colorChange, configurationPopupCloseFunc) {
    let colorChangeCallback = function(targetId, newColor, oldColor) {
        colorChange.targetId = targetId;
        colorChange.newColor = newColor;
        colorChange.oldColor = oldColor;
    }
    if (event.target.id == "calendarModal") {
        configurationPopupCloseFunc();
    } else if (event.target.id == "color-picker-container" || event.target.id == "color-picker-cancel-btn") {
        resetColorChange(colorChange);
    } else if (event.target.id == "color-picker-confirm-btn") {
        calendarColorChange(colorChange);
    } else if (event.srcElement.className == "line-item") {
        calendarColorChooser(event.target.id, colorChangeCallback);
    }
}
function resetColorChange(colorChange) {
    if (colorChange.targetId != null) {
        let calendarItem = document.getElementById(colorChange.targetId);
        let originalColor = colorChange.oldColor;
        calendarItem.style = "border-color:" + originalColor + "; background-color: " + originalColor;
    }
    destroyColorPicker();
}
function calendarColorChange(colorChange) {
    if (colorChange.targetId == null) {
        return;
    }
    let id = colorChange.targetId.substring(colorChange.targetId.lastIndexOf('-') + 1);
    let calendarName = findCalendar(id).name;
    let newColor = colorChange.newColor;
    let oldColor = colorChange.oldColor;
    if (newColor != oldColor) {
        mainWindow.postMessage({action:'requestCalendarColorChange', calendarName: calendarName, newColor: newColor}, origin);
        colorChange.targetId = colorChange.newColor = colorChange.oldColor = null;
    }
    colorPickerElement.style="display:none";
}
function appendCalendar(item) {

    let calendarListElement = document.getElementById('calendar-list');
    var li = document.createElement("li");
    li.id = "cal-id-" + item.id;
    calendarListElement.appendChild(li);

    var div = document.createElement("DIV");
    li.appendChild(div);

    var inputItem = document.createElement("INPUT");
    div.appendChild(inputItem);
    inputItem.type = "checkbox";
    inputItem.className = "tui-full-calendar-checkbox-round";
    inputItem.value = "";
    inputItem.checked = true;

    var itemSpan = document.createElement("SPAN");
    div.appendChild(itemSpan);
    itemSpan.style = "border-color: " + item.borderColor + "; background-color: " + item.borderColor;
    itemSpan.id = "cal-item-" + item.id;
    itemSpan.className = "line-item";

    var innerDiv = document.createElement("DIV");
    innerDiv.id = "cal-item-name-" + item.id;
    innerDiv.style = "display: contents;";
    div.appendChild(innerDiv);
    var itemName = document.createTextNode(item.name);
    innerDiv.appendChild(itemName);
    innerDiv.style.cursor = "text";
	innerDiv.addEventListener('click', function(){renameCalendar(item);});
    var span = document.createElement("SPAN");
    span.className = "line-items-calendar-buttons";
    li.appendChild(span);
    /*
    var renameButton = document.createElement("button");
    renameButton.innerText = 'Rename';
    renameButton.style = "margin-right: 5px;";
    renameButton.addEventListener('click', function(){renameCalendar(item);});
    span.appendChild(renameButton);
    li.appendChild(span);
    */
    var importICalButton = document.createElement("button");
	importICalButton.innerText = 'Import';
	//<button class="btn btn-success" onclick="document.getElementById('uploadImageInput').click()">Upload Image</button>
	importICalButton.addEventListener('click', function(){
	    document.getElementById('uploadImageInput-cal-' + item.id).click();
    });
    span.appendChild(importICalButton);

    var uploadICal = document.createElement("INPUT");
    uploadICal.type = "file";
    uploadICal.id = 'uploadImageInput-cal-' + item.id;
    uploadICal.addEventListener('change', function(evt){
        importICal(item, evt);
    });
    uploadICal.style="display:none;";
    uploadICal.accept="text/calendar";
    span.appendChild(uploadICal);

    var deleteCalendarButton = document.createElement("img");
    //deleteCalendarButton.innerText = 'Delete';
    deleteCalendarButton.src = "./images/trash.png";
    deleteCalendarButton.style.marginLeft = "10px";
    if (item.id == "1") {
        deleteCalendarButton.style.visibility= 'hidden';
    } else {
    	deleteCalendarButton.addEventListener('click', function(){
    	    deleteCalendar(item);
        });
    }
    span.appendChild(deleteCalendarButton);
}

function importICal(item, evt){
    let files = evt.target.files || evt.dataTransfer.files;
    let file = files[0];
    let filereader = new FileReader();
    filereader.onload = function(){
        importICSFile(this.result, currentUsername, false, false, item.name, false);
        calendarRequiresReload = true;
    };
    filereader.readAsText(file);
}
function deleteCalendar(item){
    console.log("deleteCalendar=" + item.name);
    mainWindow.postMessage({ calendarName: item.name, id: item.id, type:"deleteCalendar"}, origin);
}
function calendarColorChooser(id, changeCallback){
    let calendarItem = document.getElementById(id);

    let currentColor = calendarItem.style.borderColor;
    destroyColorPicker();
    let currentColorRGB = toHexString(currentColor);
    colorPalette[0] = currentColorRGB;

    colorPickerElement.style='';
    colorpicker = tui.colorPicker.create({
        container: colorPickerElement,
        usageStatistics: false,
        preset: colorPalette,
        color: colorPalette[0],
        detailTxt: 'Confirm'
    });
    colorpicker._onToggleSlider();
    colorpicker.on('selectColor', function(ev) {
        let updatedColor = ev.color;
        calendarItem.style = "border-color:" + updatedColor + "; background-color: " + updatedColor;
        changeCallback(id, updatedColor, currentColorRGB);
    });
    //let colorPickerEl = document.getElementById('color-picker');
    var colorPickerContainer = document.getElementsByClassName("tui-colorpicker-container")[0];
//, '<input id="color-picker-confirm-btn" type="button" class="{{cssPrefix}}palette-toggle-slider" value="{{detailTxt}}" />'
    var buttonDiv = document.createElement("div");
    buttonDiv.classList.add("tui-colorpicker-button-container");
    colorPickerContainer.appendChild(buttonDiv);

    var cancelItem = document.createElement("INPUT");
    buttonDiv.appendChild(cancelItem);
    cancelItem.id="color-picker-cancel-btn";
    cancelItem.type = "button";
    cancelItem.classList.add("button-cancel");
    cancelItem.value = "Cancel";
    
    var confirmItem = document.createElement("INPUT");
    buttonDiv.appendChild(confirmItem);
    confirmItem.id="color-picker-confirm-btn";
    confirmItem.type = "button";
    confirmItem.classList.add("button-confirm");
    confirmItem.value = "OK";
}
function destroyColorPicker() {
    if(colorpicker != null) {
        colorpicker.destroy();
        colorpicker = null;
        colorPickerElement.style.display = "none";
    };
}
function toHexString(rdgColourStr) {
    let colorRGB = rdgColourStr.substring(4);
    colorRGB = colorRGB.substring(0, colorRGB.length - 1);
    colorRGB = colorRGB.split(',');
    let red = toHex(new Number(colorRGB[0]));
    let green = toHex(new Number(colorRGB[1]));
    let blue = toHex(new Number(colorRGB[2]));
    return "#" +  red + green + blue;
}

function toHex(n) {
  var hex = n.toString(16);
  while (hex.length < 2) {hex = "0" + hex; }
  return hex;
}

/**
 * Toggle calendar list, when user clicks calendars button
 */
Window.toggleCalendarsView = function(event) {
    var cals = document.getElementById("lnb")
    var visible = cals.style.display != "none";
    if (visible) {
	cals.style.display = "none";
	document.getElementById("right").style.left = "0px"
    } else {
	cals.style.display = "block";
	document.getElementById("right").style.left = "200px"
    }
    event.stopPropagation();
};
