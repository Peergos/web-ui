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
          load(e.data.previousMonth, e.data.currentMonth, e.data.nextMonth, e.data.recurringEvents, e.data.yearMonth, e.data.username);
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
let CachedYearMonths = [];
let LoadedEvents = [];
let RecurringSchedules = [];
var currentMoment = moment();
var loadCalendarAsGuest = false;
let CALENDAR_ID_MY_CALENDAR = "1";

let CALENDAR_EVENT_CANCELLED = "Cancelled";
let CALENDAR_EVENT_ACTIVE = "Active";

var colorpicker = null;
let colorPalette = ['#181818', '#282828', '#383838', '#585858', '#B8B8B8', '#D8D8D8', '#E8E8E8', '#F8F8F8', '#AB4642', '#DC9656', '#F7CA88', '#A1B56C', '#86C1B9', '#7CAFC2', '#BA8BAF', '#A16946'];
let colorPickerElement = document.getElementById('color-picker');

var calendarRequiresReload = false;

//--rrule
let recurringEventIdSeparatorToken = '_';
var rrule = "";
var rrule_handler = null;
var previousRepeatCondition = "";
var rruleEditable = true;

let suffix = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"];
let byDayLongLabelParts = "Sunday,Monday,Tuesday,Wednesday,Thursday,Friday,Saturday".split(',');
let byDayMediumLabelParts = "Sun,Mon,Tue,Wed,Thu,Fri,Sat".split(',');
let monthLongLabelParts = "January,February,March,April,May,June,July,August,September,October,November,December".split(',');
let monthShortLabelParts = "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(',');
let byDayLabelParts = "SU,MO,TU,WE,TH,FR,SA".split(',');
let byMonthDayLabelParts = "1SU,1MO,1TU,1WE,1TH,1FR,1SA,2SU,2MO,2TU,2WE,2TH,2FR,2SA,3SU,3MO,3TU,3WE,3TH,3FR,3SA,4SU,4MO,4TU,4WE,4TH,4FR,4SA,5SU,5MO,5TU,5WE,5TH,5FR,5SA,-1SU,-1MO,-1TU,-1WE,-1TH,-1FR,-1SA".split(',');
let weeks = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Last'];
let weeksLowercase = ['first', 'second', 'third', 'fourth', 'fifth', 'last'];

let monthLabels = "";
for(var i = 1; i < 13; i++) {
    monthLabels = monthLabels + i + " ";
}
let monthLabelParts = monthLabels.trim().split(" ");

let dateLabels = "";
for(var i = 1; i < 32; i++) {
    dateLabels = dateLabels + i + " ";
}
let byDateLabelParts = dateLabels.trim().split(" ");

//--end-rrule

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
            let serialisedSchedule = serialiseICal(schedule);
            if (schedule.raw.hasRecurrenceRule) {
                RecurringSchedules.push(schedule);
                CachedYearMonths.forEach(function(yearMonth) {
                    loadSchedule(schedule, yearMonth);
                });
                cal.createSchedules(ScheduleList);
            } else {
                ScheduleList.push(schedule);
                cal.createSchedules([schedule]);
                addToCache(schedule);
            }
            refreshScheduleVisibility();
            save(schedule, serialisedSchedule, schedule.calendarId);
        },
        'beforeUpdateSchedule': function(e) {
            var schedule = e.schedule;
            var changes = e.changes;
            //do not simply return if no changes. Memo, rrule text is not recorded as a change!
            //if(changes == null) {
            //    return;
            //}
            let previousCalendarId = schedule.calendarId;
            //console.log('beforeUpdateSchedule', e);

            if (changes && !changes.isAllDay && schedule.category === 'allday') {
                changes.category = 'time';
            }
            let originalSchedule = cal.getSchedule(schedule.id, previousCalendarId);
            if (originalSchedule.previousRecurrenceRule.length > 0) {
                //apply changes
                cal.updateSchedule(schedule.id, schedule.calendarId, changes);
                let updatedCalendarId = (changes != null && changes.calendarId != null) ? changes.calendarId : schedule.calendarId;
                let updatedSchedule = cal.getSchedule(schedule.id, updatedCalendarId);

                //remove all instances
                let parentId = schedule.id.substring(0, schedule.id.indexOf(recurringEventIdSeparatorToken));
                removeRecurringScheduleInstances(parentId);
                RecurringSchedules.splice(RecurringSchedules.findIndex(v => v.id === parentId), 1);
                updatedSchedule.id = parentId;
                let serialisedSchedule = serialiseICal(updatedSchedule);
                if(schedule.raw.hasRecurrenceRule) {
                    RecurringSchedules.push(updatedSchedule);
                    CachedYearMonths.forEach(function(yearMonth) {
                        loadSchedule(updatedSchedule, yearMonth);
                    });
                    save(updatedSchedule, serialisedSchedule, previousCalendarId);
                    cal.createSchedules(ScheduleList);
                } else {
                    save(updatedSchedule, serialisedSchedule, previousCalendarId, "deleteRecurring");
                }
            } else {
                if(schedule.raw.hasRecurrenceRule) {
                    //normal update schedule handling
                    cal.updateSchedule(schedule.id, schedule.calendarId, changes);
                    let updatedCalendarId = (changes != null && changes.calendarId != null) ? changes.calendarId : schedule.calendarId;
                    let updatedSchedule = cal.getSchedule(schedule.id, updatedCalendarId);
                    ScheduleList.splice(ScheduleList.findIndex(v => v.id === schedule.id), 1);
                    ScheduleList.push(updatedSchedule);
                    updateCache(schedule, updatedSchedule);

                    //remove schedule
                    cal.deleteSchedule(updatedSchedule.id, updatedSchedule.calendarId);
                    ScheduleList.splice(ScheduleList.findIndex(v => v.id === updatedSchedule.id), 1);
                    removeFromCache(updatedSchedule);
                    // add recurring
                    let serialisedSchedule = serialiseICal(updatedSchedule);
                    RecurringSchedules.push(updatedSchedule);
                    CachedYearMonths.forEach(function(yearMonth) {
                        loadSchedule(updatedSchedule, yearMonth);
                    });
                    save(updatedSchedule, serialisedSchedule, previousCalendarId, "createRecurring");
                    cal.createSchedules(ScheduleList);
                } else {
                    cal.updateSchedule(schedule.id, schedule.calendarId, changes);
                    let updatedCalendarId = (changes != null && changes.calendarId != null) ? changes.calendarId : schedule.calendarId;
                    let updatedSchedule = cal.getSchedule(schedule.id, updatedCalendarId);

                    ScheduleList.splice(ScheduleList.findIndex(v => v.id === schedule.id), 1);
                    ScheduleList.push(updatedSchedule);
                    updateCache(schedule, updatedSchedule);
                    let serialisedSchedule = serialiseICal(updatedSchedule);
                    save(updatedSchedule, serialisedSchedule, previousCalendarId);
                }
            }

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
function removeRecurringScheduleInstances(parentId) {
    let repeats = [];
    ScheduleList.forEach(function(item) {
        if (item.id.startsWith(parentId + recurringEventIdSeparatorToken)) {
            repeats.push(item);
        }
    });
    repeats.forEach(function(item) {
        cal.deleteSchedule(item.id, item.calendarId);
        ScheduleList.splice(ScheduleList.findIndex(v => v.id === item.id), 1);
        removeFromCache(item);
    });
    RecurringSchedules.splice(RecurringSchedules.findIndex(v => v.id === parentId), 1);
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
    if (schedule.raw.hasRecurrenceRule) {
        let index = schedule.id.indexOf(recurringEventIdSeparatorToken);
        let parentId = schedule.id.substring(0, index);
        if (true) { //delete everything
            removeRecurringScheduleInstances(parentId);
            let idx = RecurringSchedules.findIndex(v => v.id === parentId);
            let recurringSchedule = RecurringSchedules[idx];
            deleteSchedule(recurringSchedule);
            RecurringSchedules.splice(RecurringSchedules.findIndex(v => v.id === parentId), 1);
        } else { //delete just this instance
        }
    } else {
        cal.deleteSchedule(schedule.id, schedule.calendarId);
        ScheduleList.splice(ScheduleList.findIndex(v => v.id === schedule.id), 1);
        removeFromCache(schedule);
        deleteSchedule(schedule);
    }
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
    LoadedEvents[vvent.getFirstPropertyValue('uid')] = icalComponent;
    return unpackEvent(vvent, false, false, calendarId);
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
    event.recurrenceRule = iCalEvent.getFirstPropertyValue('rrule');
    return event;
}
function buildCalendarEvent(eventInfo) {
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
    schedule.recurrenceRule = event.recurrenceRule != null ? event.recurrenceRule.toString() : '';
    schedule.previousRecurrenceRule = schedule.recurrenceRule;
    schedule.state = event.state;
    var calendar = findCalendar(event.calendarId);
    schedule.color = calendar.color;
    schedule.bgColor = calendar.bgColor;
    schedule.dragBgColor = calendar.dragBgColor;
    schedule.borderColor = calendar.borderColor;
    schedule.raw.memo = event.description == null ? "" : event.description;
    schedule.raw.creator.name = event.owner;
    schedule.raw.hasRecurrenceRule =  schedule.recurrenceRule.length > 0;
    return schedule;
}
function cloneSchedule(scheduleOrig, newId, start, end) {
    var schedule = new ScheduleInfo();
    schedule.id = newId;
    schedule.calendarId = scheduleOrig.calendarId;
    schedule.title = scheduleOrig.title;
    schedule.body = scheduleOrig.body;
    schedule.isReadOnly = scheduleOrig.isReadOnly;
    schedule.isAllDay = scheduleOrig.isAllDay;
    schedule.category = scheduleOrig.category;
    schedule.start = start;
    schedule.end = end;
    //schedule.isPrivate = scheduleOrig.isPrivate;
    schedule.location = scheduleOrig.location;
    schedule.attendees = scheduleOrig.attendees.slice();
    schedule.recurrenceRule = scheduleOrig.recurrenceRule;
    schedule.previousRecurrenceRule = scheduleOrig.previousRecurrenceRule;
    schedule.state = scheduleOrig.state;
    schedule.color = scheduleOrig.color;
    schedule.bgColor = scheduleOrig.bgColor;
    schedule.dragBgColor = scheduleOrig.dragBgColor;
    schedule.borderColor = scheduleOrig.borderColor;
    schedule.raw.memo = scheduleOrig.raw.memo;
    schedule.raw.creator.name = scheduleOrig.raw.creator.name;
    schedule.raw.hasRecurrenceRule =  scheduleOrig.raw.hasRecurrenceRule;
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
        load([], [], [], [], yearMonth, "unknown");
    }
    vevents.forEach(function(vvent, idx) {
        let schedule = buildScheduleFromEvent(unpackEvent(vvent, true, isSharedWithUs, CALENDAR_ID_MY_CALENDAR));
        let output = serialiseICal(schedule);
        let dt = moment.utc(schedule.start.toUTCString());
        if (loadCalendarAsGuest) {
            loadArbitrarySchedule(schedule, dt.year() * 12 + dt.month());
            if(idx == vevents.length -1) {
                removeSpinner();
                disableToolbarButtons(false);
            }
        } else {
            let year = dt.year();
            let month = dt.month() + 1;
            let recurringText = schedule.raw.hasRecurrenceRule ? ' (' + schedule.recurrenceRule + ')' : '';
            let eventSummary = {datetime: moment(schedule.start.toUTCString()).format('YYYY MMMM Do, h:mm:ss a'), title: schedule.title + recurringText };
            allEvents.push({calendarName: calendarName, year: year, month: month, Id: schedule.id, item:output,
                    summary: eventSummary, isRecurring: schedule.raw.hasRecurrenceRule});
            if(idx == vevents.length -1) {
                mainWindow.postMessage({items:allEvents, showConfirmation: showConfirmation, type:"saveAll"}, origin);
            }
        }
    });
}
function buildMonthScheduleCache(yearMonth) {
    let monthCache = ScheduleCache[yearMonth];
    if (monthCache == null) {
        CachedYearMonths.push(yearMonth);
        ScheduleCache[yearMonth] = monthCache = [];
    }
    return monthCache;
}
function loadAdditional(currentMonthEvents, yearMonth) {
    let monthCache = buildMonthScheduleCache(yearMonth);
    let currentYearMonth = currentMoment.year() * 12 + currentMoment.month();
    if (currentYearMonth < yearMonth) {
        ScheduleList = ScheduleCache[currentYearMonth-1].concat(ScheduleCache[currentYearMonth]);
    } else {
        ScheduleList = ScheduleCache[currentYearMonth+1].concat(ScheduleCache[currentYearMonth]);
    }
    for (var i = 0; i < currentMonthEvents.length; i++) {
        let schedule = buildCalendarEvent(currentMonthEvents[i]);
        if (schedule != null) {
            ScheduleList.push(schedule);
            monthCache.push(schedule);
        }
    }
    for (var i = 0; i < RecurringSchedules.length; i++) {
        loadSchedule(RecurringSchedules[i], yearMonth);
    }
    cal.createSchedules(ScheduleList);
    refreshScheduleVisibility();
    setRenderRangeText();
    removeSpinner();
    disableToolbarButtons(false);
}
function loadArbitrarySchedule(schedule, yearMonth) {
    loadSchedule(schedule, yearMonth);
    cal.createSchedules(ScheduleList);
    refreshScheduleVisibility();
    setRenderRangeText();
    removeSpinner();
}
function loadSchedule(schedule, yearMonth) {
    let monthCache = buildMonthScheduleCache(yearMonth);
    let year = Math.floor(yearMonth / 12);
    let month = yearMonth % 12;
    var icalComponent = LoadedEvents[schedule.id];
    let vevents = icalComponent.getAllSubcomponents('vevent');
    let vvent = vevents[0];
    if( vvent.hasProperty('rrule') ){
        //TODO FIXME This MUST be revisited
        var recur = vvent.getFirstPropertyValue('rrule');
        let endOfMonthExclusive = moment.utc(year + '-01-01');
        endOfMonthExclusive.add(month + 1, 'months');
        let rangeEnd = toICalTime(endOfMonthExclusive.toDate(), schedule.isAllDay);
        let dtStart = vvent.getFirstPropertyValue('dtstart');
        if (dtStart.compare(rangeEnd) > 0) {
            return;
        }
        let dt = moment.utc(schedule.start.toUTCString());
        let start = moment.utc(year + '-01-01');
        start.add(month, 'months');
        if (month == dt.month()) {
            start.add(dt.date() -1, 'd');
        }
        start.add(dt.hour(), 'h');
        start.add(dt.minute(), 'm');
        start.add(dt.second(), 's');
        start.add(dt.millisecond(), 'ms');
        let rangeStart = toICalTime(start.toDate(), schedule.isAllDay);
        try {
            var iter = recur.iterator(rangeStart);
            var limit = 0;
            for (var next = iter.next(); next != null && limit < 100; next = iter.next()) {
                if (next.compare(rangeEnd) >= 0) {
                    break;
                }
                //console.log(next.toString());
                let newSchedule = recalculateSchedule(schedule, vvent, next);
                monthCache.push(newSchedule);
                ScheduleList.push(newSchedule);
                limit++;
            }
        } catch (ex) {
            let msg = "Unable to parse recurring event: "
                + dt .format('YYYY MMMM Do, h:mm:ss a') + ' - ' + schedule.title
                + " (" + schedule.recurrenceRule + "). See console for details";
            console.log(msg);
            console.log(ex);
            displayMessage(msg);
        }
    } else {
        monthCache.push(schedule);
        ScheduleList.push(schedule);
    }
}
function recalculateSchedule(schedule, iCalEvent, nextDtStart) {
    let dtStart = iCalEvent.getFirstPropertyValue('dtstart');
    var start = nextDtStart.toJSDate();
    var end;
    try {
        let duration = iCalEvent.getFirstPropertyValue('duration').toSeconds();
        end = new Date(start.getTime() + (duration * 1000));
    } catch (ex) {
	    try {
        	var firstEnd = iCalEvent.getFirstPropertyValue('dtend').toJSDate();
        	var diff = firstEnd.getTime() - dtStart.toJSDate().getTime();
            end = new Date(start.getTime() + diff);
    	} catch (ex2) {
    		end = start;
	    }
    }
    let icalTime =  toICalTime(start, false);
    let newId = schedule.id + recurringEventIdSeparatorToken + icalTime.toICALString();
    console.log(newId +" " + start);
    return cloneSchedule(schedule, newId, moment(start).toDate(), moment(end).toDate());
}

function load(previousMonthEvents, currentMonthEvents, nextMonthEvents, recurringEvents, yearMonth, username) {
    currentUsername = username;
    let previousYearMonth = yearMonth - 1;
    let pYear = Math.floor(previousYearMonth / 12);
    let pMonth = previousYearMonth % 12;
    let previousMonthCache = buildMonthScheduleCache(pYear * 12 + pMonth);
    for (var i = 0; i < previousMonthEvents.length; i++) {
        let schedule = buildCalendarEvent(previousMonthEvents[i]);
        if (schedule != null) {
            ScheduleList.push(schedule);
            previousMonthCache.push(schedule);
        }
    }
    cYear = Math.floor(yearMonth / 12);
    cMonth = yearMonth % 12;
    let currentMonthCache = buildMonthScheduleCache(cYear * 12 + cMonth);
    for (var i = 0; i < currentMonthEvents.length; i++) {
        let schedule = buildCalendarEvent(currentMonthEvents[i]);
        if (schedule != null) {
            ScheduleList.push(schedule);
            currentMonthCache.push(schedule);
        }
    }
    let nextYearMonth = yearMonth + 1;
    nYear = Math.floor(nextYearMonth / 12);
    nMonth = nextYearMonth % 12;
    let nextMonthCache = buildMonthScheduleCache(nYear * 12 + nMonth);
    for (var i = 0; i < nextMonthEvents.length; i++) {
        let schedule = buildCalendarEvent(nextMonthEvents[i]);
        if (schedule != null) {
            ScheduleList.push(schedule);
            nextMonthCache.push(schedule);
        }
    }
    for (var i = 0; i < recurringEvents.length; i++) {
        let schedule = buildCalendarEvent(recurringEvents[i]);
        if (schedule != null) {
            RecurringSchedules.push(schedule);
            loadSchedule(schedule, previousYearMonth);
            loadSchedule(schedule, yearMonth);
            loadSchedule(schedule, nextYearMonth);
        }
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
    mainWindow.postMessage({ calendarName: calendarName, year: year, month: month, Id: Id, isRecurring: schedule.raw.hasRecurrenceRule, type:"delete"}, origin);
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
function save(schedule, serialisedSchedule, previousCalendarId, action) {
    //let isPrivate = schedule.isPrivate;
    //let state = schedule.state;
    let dt = moment.utc(schedule.start.toUTCString());
    let year = dt.year();
    let month = dt.month() + 1;
    let calendarName = findCalendar(schedule.calendarId).name;
    let previousCalendarName = findCalendar(previousCalendarId).name;
    let saveAction = action == null ? "" : action;
    mainWindow.postMessage({ calendarName: calendarName, year: year, month: month, Id: schedule.id,
        item:serialisedSchedule, previousCalendarName: previousCalendarName, isRecurring: schedule.raw.hasRecurrenceRule, action: saveAction, type:"save"}, origin);
}
function serialiseICal(schedule, updateTimestamp) {
    var comp = LoadedEvents[schedule.id];
    if (comp != null) {
        comp.updatePropertyWithValue('prodid', '-//iCal.js');
        comp.updatePropertyWithValue('version', '2.0');
        let vevents = comp.getAllSubcomponents('vevent');
        let vvent = vevents[0];
        vvent.updatePropertyWithValue('summary', schedule.title);
        vvent.updatePropertyWithValue('description', schedule.raw.memo);
        vvent.updatePropertyWithValue('location', schedule.location);
        if (updateTimestamp || vvent.getFirstPropertyValue("dtstamp") == null) {
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
        if (schedule.raw.hasRecurrenceRule) {
            vvent.updatePropertyWithValue('rrule', ICAL.Recur.fromString(schedule.recurrenceRule));
        } else {
            vvent.removeProperty('rrule');
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
        if (schedule.state == CALENDAR_EVENT_CANCELLED) { //CANCELLED
            vevent.addPropertyWithValue('status', "CANCELLED");
        }
        if (schedule.raw.hasRecurrenceRule) {
            vevent.addPropertyWithValue('rrule', ICAL.Recur.fromString(schedule.recurrenceRule));
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
            recurrenceRule: rrule,
            previousRecurrenceRule: rrule,
            attendees: [],
            raw: {
                class: scheduleData.raw['class'],
                memo: scheduleData.raw['memo'],
                hasRecurrenceRule: rrule.length > 0 ? true : false,
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
function updateRRULESummary() {
    if (rruleEditable) {
        let element = document.getElementById("rrule-summary");
        if (element != null) {
            element.innerText = generateRRuleText();
        }
    }
}
function buildExtraFieldsToSummary(eventData, that) {

    if (eventData == null) {
        rruleEditable = true;
        rrule = "";
    } else {
        rrule = eventData.schedule.recurrenceRule;
        if (parseRRULE()) {
            rruleEditable = true;
            updateRRULESummary();
        } else {
            rruleEditable = false;
        }
    }

    let calendarSpan = document.getElementById("calendar-name");
    var showDeleteBtn = false;
    if(eventData.schedule.raw.creator.name != currentUsername) {
        calendarSpan.innerText = calendarSpan.innerText + " (Shared by " + eventData.schedule.raw.creator.name + ")";
        if (!loadCalendarAsGuest) {
            showDeleteBtn = true;
        }
    }
    if (showDeleteBtn) {
        var deleteButton = document.createElement("button");
        calendarSpan.appendChild(deleteButton);
        deleteButton.appendChild(document.createTextNode("Delete"));
        deleteButton.style.marginLeft="20px";
        deleteButton.onclick=function() {
            that.hide();
            removeScheduleFromCalendar(eventData.schedule);
        };
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
function addExtraFieldsToDetail(eventData) {

    previousRepeatCondition = "";
    if (eventData.schedule == null) {
        rrule = "";
    }
    let startDate = eventData.schedule == null ? moment(eventData.start.toDate()) : moment(eventData.schedule.start.toDate());
    createFrequencyDropdown(startDate);
    createDailyIntervalDropdown();
    createWeeklyIntervalDropdown();
    byDayChoices();
    createMonthlyIntervalDropdown();
    createYearlyIntervalDropdown();
    yearlyMonthChoice();
    freqMonthlyBy(startDate);
    monthlyByDayChoices();
    monthlyByDateChoices();
    repeatCondition();
    createRepeatDropdown(startDate);


    let lock = document.getElementById("tui-full-calendar-schedule-private");
    lock.style.display = 'none';

    let loc = document.getElementById("tui-full-calendar-schedule-location");
    let parent = loc.parentNode.parentNode.parentNode;
    var locTextArea = document.createElement("textarea");
    locTextArea.id = "popup-memo";
    locTextArea.value = eventData.schedule == null ? "" : eventData.schedule.raw.memo;
    locTextArea.rows = 5;
    locTextArea.classList.add("memo-field-edit");

    var div1 = document.createElement("div");
    parent.appendChild(div1);
    var div2 = document.createElement("div");
    div1.appendChild(div2);
    div2.appendChild(locTextArea);
    if (eventData.schedule != null) {
        let saveBtn = document.getElementById("popup-save");
        var handler = function() {
            eventData.schedule.previousRecurrenceRule = eventData.schedule.recurrenceRule;
            eventData.schedule.recurrenceRule = rrule;
            eventData.schedule.raw.memo = locTextArea.value;
            eventData.schedule.raw.hasRecurrenceRule = rrule.length > 0 ? true : false;
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

//--RRULE
function changeRepeatOption(startDate) {
    let selectedValue = document.getElementById('repeat-dropdown').value;

    if (selectedValue == "no-repeat") {
        rrule = "";
        return;
    } else if (selectedValue == "DAILY") {
        rrule = "FREQ=DAILY;INTERVAL=1";
    } else if (selectedValue == "WEEKDAY") {
        rrule = "FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR";
    } else if (selectedValue == "WEEKLY") {
        let dayOfWeek = startDate.day();
        rrule = "FREQ=WEEKLY;INTERVAL=1;BYDAY=" + byDayLabelParts[dayOfWeek];
    } else if (selectedValue == "YEARLY") {
        let dayOfMonth = startDate.date();
        let month = startDate.month() + 1;
        rrule = "FREQ=YEARLY;INTERVAL=1;BYMONTH=" + month + ";BYMONTHDAY=" + dayOfMonth;
    } else if (selectedValue == "CUSTOM") {
        console.log("custom");
        if (!rruleEditable) {
            displayMessage("Editing this Event's current repeating rule not supported.");
            return;
        }
        document.getElementById("rrule-modal").style.display = "block";
    }
    processRRULE(startDate);
}
function repeatCondition() {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='repeat-condition';
    parent.appendChild(div);

    let onChange = function() {
        applyRRULE();
    }
    let element = addInput(div, 'radio', 'repeat-condition-forever', 'repeat-condition', 'forever', 'Forever', onChange);
    element.checked = true;
    addInput(div, 'radio', 'repeat-condition-until', 'repeat-condition', 'until', 'Until', onChange);
    addInput(div, 'radio', 'repeat-condition-occurrences', 'repeat-condition', 'occurrences', 'Occurrence(s)', onChange);

    var div = document.createElement("div");
    div.id='repeat-occurrences-counter';
    div.style.display = "none";
    parent.appendChild(div);

    var span1 = document.createElement("span");
    div.appendChild(span1);

    var number = document.createElement("input");
    number.type= 'number';
    number.id= 'repeat-counter';
    number.min = '1';
    number.max = '99999';
    number.value = '1';
    number.addEventListener('change', onChange);
    span1.appendChild(number);

    var div = document.createElement("div");
    div.id='repeat-until';
    div.style.display = "none";
    parent.appendChild(div);

    var span2 = document.createElement("span");
    div.appendChild(span2);

    var date = document.createElement("input");
    date.type= 'date';
    date.id= 'until-date';
    date.min = '1900-01-01';
    date.max = '3000-01-01';
    date.maxlength = '12';
    date.value = '';
    date.addEventListener('change', onChange);
    span2.appendChild(date);
}
function generateSuffix(num) {
    return num == 11 || num == 12 || num == 13 ? "th" : suffix[num % 10];
}
function monthlyByDateChoices() {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='monthly-by-date-choices';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='monthly-date';
    dropdown.addEventListener('change', function(){applyRRULE();});
    for(var i = 1; i < 32; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'monthly-date-' + i, i, i + ending + " day");
    }
    div.appendChild(dropdown);
}
function monthlyByDayChoices() {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='monthly-by-day-choices';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='monthly-day';
    dropdown.addEventListener('change', function(){applyRRULE();});
    var j = -1;
    var k = 0;
    for(var i = 0 ; i < byMonthDayLabelParts.length; i++) {
        if (i % 7 == 0) {
            j++;
            k = 0;
        }
        let innerText = weeks[j] + ' ' + byDayLongLabelParts[k];
        addOptionToSelect(dropdown, 'monthly-day-' + byMonthDayLabelParts[i], byMonthDayLabelParts[i], innerText);
        k++;
    }
    div.appendChild(dropdown);
}
//todo make this efficient
function getMonthlyByDayNameFromIndex(monthDay) {
    var j = -1;
    var k = 0;
    for(var i = 0 ; i < byMonthDayLabelParts.length; i++) {
        if (i % 7 == 0) {
            j++;
            k = 0;
        }
        if(monthDay == byMonthDayLabelParts[i]) {
            return weeksLowercase[j] + ' ' + byDayMediumLabelParts[k];
        }
        k++;
    }
}
function freqMonthlyBy(startDate) {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='freq-monthly-by';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='frequency-dropdown-monthly';
    dropdown.addEventListener('change', function(){changeMonthlyBy(startDate);});
    addOptionToSelect(dropdown, 'freq-by-date', "BYMONTHDAY", "by Date");
    addOptionToSelect(dropdown, 'freq-by-day', "BYDAY", "by Day");
    div.appendChild(dropdown);
}
function yearlyMonthChoice() {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='yearly-month-choice';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='yearly-month';
    dropdown.addEventListener('change', function(){applyRRULE();});
    for(var i = 1; i < 13; i++) {
        addOptionToSelect(dropdown, 'yearly-month-' + i, i, monthLongLabelParts[i-1]);
    }
    div.appendChild(dropdown);
}
function createYearlyIntervalDropdown() {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='yearly-interval';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='yearly-frequency';
    dropdown.addEventListener('change', function(){applyRRULE();});
    addOptionToSelect(dropdown, 'yearly-frequency-1', '1', "Every year");
    addOptionToSelect(dropdown, 'yearly-frequency-2', '2', "Every other year");
    for(var i = 3; i < 11; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'yearly-frequency-' + i, i, "Every " + i + ending + " year");
    }
    div.appendChild(dropdown);
}
function createMonthlyIntervalDropdown() {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='monthly-interval';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='monthly-frequency';
    dropdown.addEventListener('change', function(){applyRRULE();});
    addOptionToSelect(dropdown, 'monthly-frequency-1', '1', "Every month");
    addOptionToSelect(dropdown, 'monthly-frequency-2', '2', "Every other month");
    for(var i = 3; i < 13; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'monthly-frequency-' + i, i, "Every " + i + ending + " month");
    }
    div.appendChild(dropdown);
}
function byDayChoices() {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id = "by-day-choices";
    div.style.display = "none";
    parent.appendChild(div);
    let onChange = function() {
        applyRRULE();
    }
    for(var i = 0; i < 7 ; i++) {
        addInput(div, 'checkbox', 'by-day-' + byDayLabelParts[i], byDayLongLabelParts[i], byDayMediumLabelParts[i], byDayMediumLabelParts[i] , onChange);
    }
}
function createWeeklyIntervalDropdown() {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='weekly-interval';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='weekly-frequency';
    dropdown.addEventListener('change', function(){applyRRULE();});
    let option = addOptionToSelect(dropdown, 'weekly-frequency-1', '1', "Every week");
    option.checked = true;
    addOptionToSelect(dropdown, 'weekly-frequency-2', '2', "Every other week");
    for(var i = 3; i < 27; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'weekly-frequency-' + i, i, "Every " + i + ending + " week");
    }
    div.appendChild(dropdown);
}
function addInput(parentElement, type, id, name, value, text, onChangeHandler) {
    var input = document.createElement("input");
    input.type= type;
    input.id= id;
    input.name = name;
    input.value = value;
    input.addEventListener('change', onChangeHandler);

    parentElement.appendChild(input);
    var label = document.createElement("label");
    label.innerText = text;
    parentElement.appendChild(label);
    return input;
}
function createDailyIntervalDropdown() {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    div.id='daily-interval';
    div.style.display = "none";
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='daily-frequency';
    dropdown.addEventListener('change', function(){applyRRULE();});
    let select = addOptionToSelect(dropdown, 'daily-frequency-1', '1', "Every day");
    select.checked = true;
    addOptionToSelect(dropdown, 'daily-frequency-2', '2', "Every other day");
    for(var i = 3; i < 31; i++) {
        let ending = generateSuffix(i);
        addOptionToSelect(dropdown, 'daily-frequency-' + i, i, "Every " + i + ending + " day");
    }
    div.appendChild(dropdown);
}
function createFrequencyDropdown(startDate) {
    var parent = document.getElementById("rrule-modal");
    var div = document.createElement("div");
    parent.appendChild(div);

    var dropdown = document.createElement("select");
    dropdown.id='frequency-dropdown';
    dropdown.addEventListener('change', function(){changeFrequency(startDate);});

    addOptionToSelect(dropdown, 'no-repeat', 'no-repeat', "Does not repeat");
    addOptionToSelect(dropdown, 'freq-daily', 'DAILY', "Daily");
    addOptionToSelect(dropdown, 'freq-weekly', 'WEEKLY', "Weekly");
    addOptionToSelect(dropdown, 'freq-monthly', 'MONTHLY', "Monthly");
    addOptionToSelect(dropdown, 'freq-yearly', 'YEARLY', "Yearly");

    div.appendChild(dropdown);
}

function addOptionToSelect(selectElement, id, value, innerText) {
    var option = document.createElement("option");
    option.id = id;
    option.value = value;
    option.innerText = innerText;
    selectElement.appendChild(option);
    return option;
}

function createRepeatDropdown(startDate) {

    let dayOfWeek = startDate.day();
    let dayOfMonth = startDate.date();
    let month = startDate.month();
    let ending = generateSuffix(dayOfMonth);
    let asStr = dayOfMonth + ending;

    var parent = document.getElementById("repeat-div");

    var existingDropdown = document.getElementById("repeat-dropdown");
    if (existingDropdown != null) {
        parent.removeChild(existingDropdown);
    }

    var dropdown = document.createElement("select");
    dropdown.id='repeat-dropdown';
    dropdown.name='repeat-dropdown';
    dropdown.addEventListener('change', function(){changeRepeatOption(startDate);});

    if (rrule != null && rrule.length > 0) {
        var custom = document.createElement("option");
        custom.id='repeat-rrule';
        custom.value=rrule;
        custom.innerText = rruleEditable ? generateRRuleText() : rrule;
        dropdown.appendChild(custom);
    }

    var noRepeat = document.createElement("option");
    noRepeat.id='no-repeat';
    noRepeat.value='no-repeat';
    noRepeat.innerText = "Does not repeat";
    dropdown.appendChild(noRepeat);

    var daily = document.createElement("option");
    daily.id='repeat-daily';
    daily.value='DAILY';
    daily.innerText = "Daily";
    dropdown.appendChild(daily);

    var weekday = document.createElement("option");
    weekday.id='repeat-weekday';
    weekday.value='WEEKDAY';
    weekday.innerText = "Every weekday (Monday to Friday)";
    dropdown.appendChild(weekday);

    var weekly = document.createElement("option");
    weekly.id='repeat-weekly';
    weekly.value='WEEKLY';
    weekly.innerText = "Weekly on " + byDayLongLabelParts[dayOfWeek]
    dropdown.appendChild(weekly);

    var yearly = document.createElement("option");
    yearly.id='repeat-yearly';
    yearly.value='YEARLY';
    yearly.innerText = "Annually on " + asStr + " of " + monthLongLabelParts[month];
    dropdown.appendChild(yearly);

    var custom = document.createElement("option");
    custom.id='repeat-custom';
    custom.value='CUSTOM';
    custom.innerText = "Custom...";
    dropdown.appendChild(custom);

    parent.appendChild(dropdown);
}
function resetRRULEUI() {
    document.getElementById('freq-daily').selected = true;
    document.getElementById('freq-monthly-by').style.display = 'none';
    document.getElementById('daily-interval').style.display = 'none';
    document.getElementById('repeat-occurrences-counter').style.display = 'none';
    document.getElementById('repeat-until').style.display = 'none';

    document.getElementById('weekly-interval').style.display = 'none';
    document.getElementById('by-day-choices').style.display = 'none';

    document.getElementById('monthly-interval').style.display = 'none';
    document.getElementById('monthly-by-day-choices').style.display = 'none';
    document.getElementById('monthly-by-date-choices').style.display = 'none';

    document.getElementById('yearly-interval').style.display = 'none';
    document.getElementById('yearly-month-choice').style.display = 'none';

    document.getElementById('daily-frequency').value = '';
    document.getElementById('weekly-frequency').value = '';
    for(var i = 0 ; i < byDayLabelParts.length; i++) {
        document.getElementById('by-day-' + byDayLabelParts[i]).checked = false;
    }
    document.getElementById('monthly-frequency').value = '';
    document.getElementById('yearly-frequency').value = '';
    document.getElementById('yearly-month').value = '';
    document.getElementById('monthly-day').value = "";
    document.getElementById('monthly-date').value = "";
}
function changeFrequency(startDate) {
    let freq = document.getElementById('frequency-dropdown').value;
    console.log("frequency-dropdown=" + freq);
    rrule = "FREQ=" + freq + ";" + removePart("FREQ");
    processRRULE(startDate);
}
function changeMonthlyBy(startDate) {
    let freq = document.getElementById('frequency-dropdown').value;
    let by = document.getElementById('frequency-dropdown-monthly').value;
    console.log("frequency-dropdown-monthly=" + by);

    let val = "";
    var updatedRRule = rrule;
    if (by == "BYDAY") {
        val = "1MO";
        updatedRRule = removePart("BYMONTHDAY");
    } else if(by == "BYMONTHDAY") {
        val = startDate.date();
        updatedRRule = removePart("BYDAY");
    }
    rrule = updatedRRule + by + "=" + val;
    processRRULE(startDate);
}
function removePart(paramName) {
    let remainingPartsBuffer = "";
    let parts = rrule.split(';');
    for(var i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (part != null && part.length > 0) {
            let paramKV = part.split('=');
            if(paramName != paramKV[0].toUpperCase()){
                remainingPartsBuffer = remainingPartsBuffer + part + " ";
            }
        }
    }
    return remainingPartsBuffer.split(" ").join(";");
}

function setHandler(initFunc, handlerFunc) {
    initFunc();
    rrule_handler = handlerFunc;
    applyRRULE();
}
function applyRRULE() {
    let result = rrule_handler();
    console.log("output=" + result);
    rrule = result;
}

function showRecurrenceError(err) {
    displayMessage("Event recurrence error: " + err);
    console.log("recurrence error=" + err);
}
function extractPart(paramName, validator) {
    let parts = rrule.split(';');
    for(var i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (part != null && part.length > 0) {
            let paramKV = part.split('=');
            if(paramName == paramKV[0].toUpperCase()){
                return validator(paramKV[1].trim());
            }
        }
    }
    return validator("");
}
function hasPart(paramName) {
    let parts = rrule.split(';');
    for(var i = 0; i < parts.length; i++) {
        let part = parts[i];
        if (part != null && part.length > 0) {
            let paramKV = part.split('=');
            if(paramName == paramKV[0].toUpperCase()){
                return true;
            }
        }
    }
    return false;
}
function getIntervalText(number, unit) {
    if (number == '1') {
        return 'Every ' + unit;
    } else if (number == '2') {
        return 'Every other ' + unit;
    } else {
        let ending = generateSuffix(number);
        return "Every " + number + ending + ' ' + unit;
    }
}
function generateRRuleText() {
    let buffer = "";
    let frequency = extractPart("FREQ", function(val){return val;});
    let interval = extractPart("INTERVAL", function(val){return val;});
    if (interval == 1 || interval == "") {
        if(frequency == "DAILY") {
            buffer = "Daily";
        } else if(frequency == "WEEKLY") {
            buffer = "Weekly";
        } else if(frequency == "MONTHLY") {
            buffer = "Monthly";
        } else if(frequency == "YEARLY") {
            buffer = "Yearly";
        }
    } else {
        if(frequency == "DAILY") {
            buffer = getIntervalText(interval, 'day');
        } else if(frequency == "WEEKLY") {
            buffer = getIntervalText(interval, 'week');
        } else if(frequency == "MONTHLY") {
            buffer = getIntervalText(interval, 'month');
        } else if(frequency == "YEARLY") {
            buffer = getIntervalText(interval, 'year');
        }
    }

    let byDay = extractPart("BYDAY", function(val){return val;});
    if (byDay.length > 0) {
        let values = byDay.trim().split(",");
        if(frequency == "WEEKLY") {
            var days = "";
            var weekdays = true;
            for(var j = 1 ; j <= 5; j++) {
                var foundDay = false;
                for(var i = 0 ; i < values.length; i++) {
                    if(values[i] == byDayLabelParts[j]) {
                        foundDay = true;
                        break;
                    }
                }
                if (!foundDay) {
                    weekdays = false;
                    break;
                }
            }
            for(var j = 0 ; j <= 6; j+=6) {
                var foundDay = false;
                for(var i = 0 ; i < values.length; i++) {
                    if(values[i] == byDayLabelParts[j]) {
                        foundDay = true;
                        break;
                    }
                }
                if (foundDay) {
                    weekdays = false;
                    break;
                }
            }
            if (weekdays) {
                buffer = buffer + " (Monday to Friday)";
            } else {
                for(var i = 0 ; i < values.length; i++) {
                    let index = byDayLabelParts.findIndex(v => v === values[i])
                    days = days + byDayMediumLabelParts[index] + " ";
                }
                buffer = buffer + " on " + days.trim().split(" ").join(", ");
            }
        } else if(frequency == "MONTHLY" || frequency == "YEARLY") {
            var monthlyDays = "";
            for(var i = 0 ; i < values.length; i++) {
                monthlyDays = monthlyDays + getMonthlyByDayNameFromIndex(values[i]) + "|";
            }
            buffer = buffer + " on the " + monthlyDays.trim().split("|").join(", ").trim();
            buffer = buffer.substring(0, buffer.length -1);
        }
    }
    byMonth = extractPart("BYMONTH", function(val){return val.trim().split(",")[0];});
    if (byMonth.length > 0) {
        let values = byMonth.trim().split(",");
        buffer = buffer + " in " + monthShortLabelParts[byMonth-1] ;
    }
    byMonthDay = extractPart("BYMONTHDAY", function(val){return val;});
    if (byMonthDay.length > 0) {
        let values = byMonthDay.trim().split(",");
        if(frequency == "MONTHLY") {
            buffer = buffer + " on the " + values[0] + generateSuffix(values[0]);
        }else if(frequency == "YEARLY") {
            buffer = "Annually on " + monthShortLabelParts[byMonth-1] + " " + values[0] + generateSuffix(values[0]);
        }
    }
    let until = extractPart("UNTIL", function(val){return val;});
    if (until.length > 0) {
        buffer = buffer + " until " + formatDateString(until);
    }
    let occurrences = extractPart("COUNT", function(val){return val;});
    if (occurrences.length > 0 && occurrences != "1") {
        buffer = buffer + " repeated for " + occurrences + " occurrences";
    }

    return buffer;
}
function formatDateString(yyyymmdd) {
    return yyyymmdd.substring(0,4) + '-' + yyyymmdd.substring(4,6) + '-' + yyyymmdd.substring(6,8);
}
function parseRRULE() {
    if (rrule == null || rrule.length == 0) {
        return true;
    }
    let frequency = extractPart("FREQ",
        function(val){
            return frequencyValidator(val) ? val : null;
        }
    );
    if (frequency == null) {
        showRecurrenceError("Frequency specified not supported");
        return false;
    }
    let intervalOK = extractPart("INTERVAL",
        function(val){
            if (val == "") {
                return true;
            }
            if (frequency == "DAILY") {
                return numericValidator(val, 1, 30);
            } else if(frequency == "WEEKLY") {
                return numericValidator(val, 1, 26)
            } else if(frequency == "MONTHLY") {
                return monthStepsValidator(val);
            } else if(frequency == "YEARLY") {
                return numericValidator(val, 1, 10);
            }
        }
    );
    if (!intervalOK) {
        showRecurrenceError("Interval specified not supported");
        return false;
    }
    var untilProvided = false;
    let untilOK = extractPart("UNTIL",
        function(val){
            if (val.length == 0) {
                return true;
            } else {
                untilProvided = true;
                return dateValidator(val);
            }
        }
    );
    if (!intervalOK) {
        showRecurrenceError("Until specified not supported");
        return false;
    }
    var countProvided = false;
    let countOK = extractPart("COUNT",
        function(val){
            if (val.length == 0) {
                return true;
            } else {
                countProvided = true;
                return numericValidator(val, 1, 999);
            }
        }
    );
    if (!countOK) {
        showRecurrenceError("Count specified not supported");
        return false;
    }
    if (untilProvided && countProvided) {
        showRecurrenceError("Combined Until and Count not supported");
        return false;
    }
    var byDaySet = false;
    let byDayOK = extractPart("BYDAY",
        function(val){
            if (val.length == 0) {
                return true;
            }
            let values = val.trim().split(",");
            byDaySet = true;
            var parts = [];
            if(frequency == "DAILY") {
                return false;
            } else if(frequency == "WEEKLY") {
                parts = byDayLabelParts;
            } else if(frequency == "MONTHLY" || frequency == "YEARLY") {
                if (values.length > 1) {
                    return false;
                }
                parts = byMonthDayLabelParts;
            }
            return confirmValues(values, parts);
        }
    );
    if (!byDayOK) {
        showRecurrenceError("ByDay specified not supported");
        return;
    }
    var byMonthDaySet = false;
    let byMonthDayOK = extractPart("BYMONTHDAY",
        function(val){
            if (val.length == 0) {
                return true;
            }
            let values = val.trim().split(",");
            byMonthDaySet = true;
            var parts = [];
            if(frequency == "DAILY" || frequency == "WEEKLY") {
                return false;
            } else if(frequency == "MONTHLY" || frequency == "YEARLY") {
                if (values.length > 1) {
                    return false;
                }
                parts = byDateLabelParts;
            }
            return confirmValues(values, parts);
        }
    );
    if (!byMonthDayOK) {
        showRecurrenceError("ByMonthDay specified not supported");
        return false;
    }
    var byMonthSet = false;
    let byMonthOK = extractPart("BYMONTH",
        function(val){
            if (val.length == 0) {
                return true;
            }
            let values = val.trim().split(",");
            byMonthSet = true;
            var parts = [];
            if(frequency == "DAILY" || frequency == "WEEKLY" || frequency == "MONTHLY") {
                return false;
            } else if(frequency == "YEARLY") {
                if (values.length > 1) {
                    return false;
                }
                parts = monthLabelParts;
            }
            return confirmValues(values, parts);
        }
    );
    if (!byMonthOK) {
        showRecurrenceError("ByMonth specified not supported");
        return false;
    }
    if (frequency == "YEARLY") {
        if (!( (byDaySet || byMonthDaySet) && byMonthSet)) {
            showRecurrenceError("Specified Yearly repeating rule not supported");
            return false;
        }
    }
    if (byDaySet && byMonthDaySet) {
        showRecurrenceError("Combined BYDAY and BYMONTH rules not supported");
        return false;
    }
    return true;
}
function confirmValues(values, parts) {
    for(var j = 0; j < values.length; j++) {
        let currentVal = values[j];
        var found = false;
        for(var i = 0; i < parts.length; i++) {
            if (parts[i] == currentVal) {
                found = true;
                break;
            }
        }
        if (!found) {
            return false;
        }
    }
    return true;
}
function frequencyValidator(val) {
    let freq = val.toUpperCase();
    return (freq == 'DAILY' || freq == 'WEEKLY' || freq == 'MONTHLY' || freq == 'YEARLY');
}
function numericValidator(val, min, max) {
    try {
        let num = new Number(val);
        if (num < min) {
            return false;
        } else if(num > max) {
            return false;
        }
        return true;
    } catch (ex) {
        return false;
    }
}
function monthStepsValidator(val) {
    let monthLabels = "18 24 36 48 ";
    for(var i = 1; i < 13; i++) {
        monthLabels = monthLabels + i + " ";
    }
    let monthLabelParts = monthLabels.trim().split(" ");
    for(var i = 0; i < monthLabelParts.length; i++) {
        if (monthLabelParts[i] == val) {
            return true;
        }
    }
    return false;
}
function isDigit(c) {
    return c >= '0' && c <= '9'
}
//ie 20201218T000000Z
function dateValidator(val) {
    if (val.charAt(8) != 'T') {
        return false;
    }
    if (!val.endsWith('Z')){
        return false;
    }
    for(var i = 0; i < 8; i++) {
        if (!isDigit(val.charAt(i))){
            return false;
        }
    }
    for(var i = 9; i < 9+6; i++) {
        if (!(isDigit(val.charAt(i)) && val[i] == "0")){
            return false;
        }
    }
    return true;
}
function initRepeatCondition() {
    var untilProvided = false;
    let until = extractPart("UNTIL",
        function(val){
            if (dateValidator(val)) {
                untilProvided = true;
                return val;
             }else {
                return new Date().toISOString().split("-").join("");
            }
        }
    );
    document.getElementById('until-date').value = formatDateString(until.split('T')[0]);

    var countProvided = false;
    let count = extractPart("COUNT",
        function(val){
            if (numericValidator(val, 1, 999)) {
                countProvided = true;
                return val;
            } else {
                return 1;
            }
        }
    );
    document.getElementById('repeat-counter').value = count;
    let untilElement = document.getElementById('repeat-until');
    let occurrencesElement = document.getElementById('repeat-occurrences-counter');
    if (untilProvided) {
        occurrencesElement.style.display = 'none';
        untilElement.style.display = '';
        document.getElementById('repeat-condition-until').checked = true;
    }else if(countProvided) {
        occurrencesElement.style.display = '';
        untilElement.style.display = 'none';
        document.getElementById('repeat-condition-occurrences').checked = true;
    } else { //forever
        occurrencesElement.style.display = 'none';
        untilElement.style.display = 'none';
        document.getElementById('repeat-condition-forever').checked = true;
    }
}
function handleRepeatCondition() {
    let untilElement = document.getElementById('repeat-until');
    let occurrencesElement = document.getElementById('repeat-occurrences-counter');
    let repeatCondition = document.querySelector('input[name="repeat-condition"]:checked').value;
    var initialiseRepeatCondition = false;
    if (previousRepeatCondition != repeatCondition) {
        previousRepeatCondition = repeatCondition;
        initialiseRepeatCondition = true;
    }
    if (initialiseRepeatCondition) {
        occurrencesElement.style.display = 'none';
        untilElement.style.display = 'none';
    }

    if (repeatCondition == "forever") {
        return "";
    } else if (repeatCondition == "occurrences") {
        let counterElement = document.getElementById('repeat-counter');
        if (initialiseRepeatCondition) {
            occurrencesElement.style.display = '';
        }
        let occurrencesCounter = counterElement.value;
        if (numericValidator(occurrencesCounter, 1, 999)) {
            return ";COUNT=" + occurrencesCounter;
        } else {
            showRecurrenceError("Occurrence value is invalid");
        }
    } else if (repeatCondition == "until") {
        let dateElement = document.getElementById('until-date');
        if (initialiseRepeatCondition) {
            untilElement.style.display = '';
        }
        let untilDate = dateElement.value;
        if (untilDate == "") {
            showRecurrenceError("Please select Date");
        } else {
            let dateParts = untilDate.split('-');
            let formattedDate = dateParts[0] + dateParts[1] + dateParts[2] + "T000000Z";
            return ";UNTIL=" + formattedDate;
        }
    }
}
function processRRULE(startDate) {
    resetRRULEUI();
    if (rrule== "" || rrule.includes("FREQ=DAILY")) {
        setHandler(function() {
            document.getElementById('freq-daily').selected = true;
            document.getElementById('daily-interval').style.display = '';
            let interval = extractPart("INTERVAL",
                function(val){
                    return numericValidator(val, 1, 30) ? val : 1;
                }
            );
            document.getElementById('daily-frequency-' + interval).selected = true;
            initRepeatCondition();
        }, function() {
            let rruleBuffer = "FREQ=DAILY"
            let dailyFrequency = document.getElementById('daily-frequency').value;
            rruleBuffer = rruleBuffer + ";INTERVAL=" + dailyFrequency;
            rruleBuffer = rruleBuffer + handleRepeatCondition();
	        return rruleBuffer;
        });
    } else if(rrule.includes("FREQ=WEEKLY")) {
        setHandler(function() {
            document.getElementById('freq-weekly').selected = true;
            document.getElementById('weekly-interval').style.display = '';
            document.getElementById('by-day-choices').style.display = '';
            let interval = extractPart("INTERVAL",
                function(val){
                    return numericValidator(val, 1, 26) ? val : 1;
                }
            );
            document.getElementById('weekly-frequency-' + interval).selected = true;
            initCheckBoxes('by-day', "BYDAY");
            initRepeatCondition();
        }, function() {
            let rruleBuffer = "FREQ=WEEKLY"
            let weeklyFrequency = document.getElementById('weekly-frequency').value;
            rruleBuffer = rruleBuffer + ";INTERVAL=" + weeklyFrequency;

            rruleBuffer = rruleBuffer + handleCheckBoxes(byDayLabelParts, 'by-day', 'BYDAY');
            rruleBuffer = rruleBuffer + handleRepeatCondition();
	        return rruleBuffer;
        });
    } else if(rrule.includes("FREQ=MONTHLY")) {
        var hasByDay = false;
        var hasByDate = false;
        document.getElementById('freq-monthly-by').style.display = '';
        document.getElementById('freq-monthly').selected = true;
        setHandler(function() {
            document.getElementById('monthly-interval').style.display = '';
            if (hasPart("BYMONTHDAY")) {
                hasByDate = true;
                document.getElementById('freq-by-date').selected = true;
                document.getElementById('monthly-by-date-choices').style.display = '';
            } else {
                hasByDay = true;
                document.getElementById('freq-by-day').selected = true;
                document.getElementById('monthly-by-day-choices').style.display = '';
            }
            let interval = extractPart("INTERVAL",
                function(val){
                    return monthStepsValidator(val) ? val : 1;
                }
            );
            document.getElementById('monthly-frequency-' + interval).selected = true;
            if (hasByDay) {
                initSelect('monthly-day', "BYDAY", function() {
                    return "1MO";
                });
            } else if (hasByDate) {
                initSelect('monthly-date', "BYMONTHDAY", function() {
                    return startDate.date();
                });
            }
            initRepeatCondition();
        }, function() {
            let rruleBuffer = "FREQ=MONTHLY"
            let monthlyFrequency = document.getElementById('monthly-frequency').value;
            rruleBuffer = rruleBuffer + ";INTERVAL=" + monthlyFrequency;
            if (hasByDay) {
                rruleBuffer = rruleBuffer + handleSelect(byMonthDayLabelParts, 'monthly-day', 'BYDAY');
            } else if (hasByDate) {
                rruleBuffer = rruleBuffer + handleSelect(byDateLabelParts, 'monthly-date', 'BYMONTHDAY');
            }
            rruleBuffer = rruleBuffer + handleRepeatCondition();
	        return rruleBuffer;
        });
    } else if(rrule.includes("FREQ=YEARLY")) {
        var hasByDay = false;
        var hasByDate = false;
        document.getElementById('freq-monthly-by').style.display = '';
        document.getElementById('freq-yearly').selected = true;
        setHandler(function() {
            document.getElementById('yearly-interval').style.display = '';
            if (hasPart("BYMONTHDAY")) {
                hasByDate = true;
                document.getElementById('freq-by-date').selected = true;
                document.getElementById('yearly-month-choice').style.display = '';
                document.getElementById('monthly-by-date-choices').style.display = '';
            } else {
                hasByDay = true;
                document.getElementById('freq-by-day').selected = true;
                document.getElementById('yearly-month-choice').style.display = '';
                document.getElementById('monthly-by-day-choices').style.display = '';
            }
            let interval = extractPart("INTERVAL",
                function(val){
                    return numericValidator(val, 1, 10) ? val : 1;
                }
            );
            document.getElementById('yearly-frequency-' + interval).selected = true;
            initSelect('yearly-month', "BYMONTH", function() {
                    return startDate.month() + 1;
            });
            if (hasByDay) {
                initSelect('monthly-day', "BYDAY", function() {
                    return "1MO";
                });
            } else if (hasByDate) {
                initSelect('monthly-date', "BYMONTHDAY", function() {
                    return startDate.date();
                });
            }
            initRepeatCondition();
        }, function() {
            let rruleBuffer = "FREQ=YEARLY"
            let yearlyFrequency = document.getElementById('yearly-frequency').value;
            rruleBuffer = rruleBuffer + ";INTERVAL=" + yearlyFrequency;
            let monthLabels = "";
            rruleBuffer = rruleBuffer + handleSelect(monthLabelParts, 'yearly-month', 'BYMONTH');
            if (hasByDay) {
                rruleBuffer = rruleBuffer + handleSelect(byMonthDayLabelParts, 'monthly-day', 'BYDAY');
            } else if (hasByDate) {
                rruleBuffer = rruleBuffer + handleSelect(byDateLabelParts, 'monthly-date', 'BYMONTHDAY');
            }
            rruleBuffer = rruleBuffer + handleRepeatCondition();
	        return rruleBuffer;
        });
    }
}
function initCheckBoxes(prefix, partName, defaultFunc) {
    initChoices(true, prefix, partName, defaultFunc);
}
function initSelect(prefix, partName, defaultFunc) {
    initChoices(false, prefix, partName, defaultFunc);
}
function initChoices(isCheckBoxes, prefix, partName, defaultFunc) {
    let byDay = extractPart(partName,
        function(val){
            return val;
        }
    );
    if (byDay.length > 0) {
        let byDayParts = byDay.split(',');
        for(var i = 0 ; i < byDayParts.length; i++) {
            let element = document.getElementById(prefix + '-' + byDayParts[i]);
            if (element != null) {
                if (isCheckBoxes) {
                    element.checked = true;
                } else {
                    element.selected = true;
                }
            }
        }
    } else {
        if (defaultFunc != null) {
            let val = defaultFunc();
            let element = document.getElementById(prefix + '-' + val);
            if (isCheckBoxes) {
                element.checked = true;
            } else {
                element.selected = true;
            }
        }
    }
}
function handleCheckBoxes(labelParts, prefix, partName) {
    return handleChoices(labelParts, prefix, partName)
}
function handleSelect(labelParts, prefix, partName) {
    return handleChoices(labelParts, prefix, partName)
}
function handleChoices(labelParts, prefix, partName) {
    var byDayBuffer = "";
    for(var i = 0 ; i < labelParts.length; i++) {
        let element = document.getElementById(prefix + '-' + labelParts[i]);
        if(element.checked || element.selected) {
            byDayBuffer = byDayBuffer + labelParts[i] + " ";
        }
    }
    byDayBuffer = byDayBuffer.trim().split(" ").join(",");
    if (byDayBuffer.length > 0) {
        return ";" + partName + "=" + byDayBuffer;
    }
    return "";
}

