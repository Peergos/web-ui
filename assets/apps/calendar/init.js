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
//    isReadOnly: true,
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
        console.log('clickMore', e);
    },
    'clickSchedule': function(e) {
        console.log('clickSchedule', e);
    },
    'clickDayname': function(date) {
        console.log('clickDayname', date);
    },
    'beforeCreateSchedule': function(e) {
        console.log('beforeCreateSchedule', e);
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
        console.log('beforeUpdateSchedule', e);
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
        console.log('beforeDeleteSchedule', e);
        cal.deleteSchedule(e.schedule.id, e.schedule.calendarId);
        ScheduleList.splice(ScheduleList.findIndex(v => v.id === e.schedule.id), 1);
        removeFromCache(e.schedule);
        deleteSchedule(e.schedule);
    },
    'afterRenderSchedule': function(e) {
        var schedule = e.schedule;
        // var element = cal.getElement(schedule.id, schedule.calendarId);
        // console.log('afterRenderSchedule', element);
    },
    'clickTimezonesCollapseBtn': function(timezonesCollapsed) {
        console.log('timezonesCollapsed', timezonesCollapsed);

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
        setCalendars();
        cal.setCalendars(CalendarList);
        setDropdownCalendarType();
        setEventListener();
        load(e.data.previousMonth, e.data.currentMonth, e.data.nextMonth, e.data.yearMonth, e.data.username);
    } else if (e.data.type == "loadAdditional") {
        loadAdditional(e.data.currentMonth, e.data.yearMonth);
    } else if(e.data.type == "importICSFile") {
        setCalendars();
        importICSFile(e.data.contents);
    }
});

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
    this.state = '';

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
function displayMessage(msg) {
    mainWindow.postMessage({type:"displayMessage", message: msg}, origin);
}

function unpackIcal(IcalFile, username) {
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
        return unpackEvent(vvent, username);
    }
}
function unpackEvent(iCalEvent, username) {
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
    let xCategory = iCalEvent.getFirstPropertyValue('x-category-id');
    if (iCalEvent.getFirstPropertyValue('status') === "CANCELLED") {
        event['categoryId'] = "6";
    } else if (currentUsername != username) {
        event['categoryId'] = "5";
    } else {
        event['categoryId'] = xCategory == null ? "1" : xCategory;
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
    let event = unpackIcal(eventInfo.item, eventInfo.username);
    if(event == null) {
        return;
    }
    return buildScheduleFromEvent(event, eventInfo.username);
}
function buildScheduleFromEvent(event, username) {
    var schedule = new ScheduleInfo();
    schedule.id = event.Id;
    schedule.calendarId = event.categoryId;
    schedule.title = event.title;
    schedule.body = '';
    schedule.isReadOnly = currentUsername != username ? true : false;
    schedule.isAllday = event.isAllDay;
    schedule.category = event.isAllDay ? 'allday' : 'time';
    schedule.start = moment(event.start).toDate();
    schedule.end = moment(event.end).toDate();
    //schedule.isPrivate = event.isPrivate;
    schedule.location = event.location;
    schedule.attendees = event.attendees;
    schedule.recurrenceRule = '';
    //schedule.state = event.state;
    var calendarCategory = findCalendar(event.categoryId);
    schedule.color = calendarCategory.color;
    schedule.bgColor = calendarCategory.bgColor;
    schedule.dragBgColor = calendarCategory.dragBgColor;
    schedule.borderColor = calendarCategory.borderColor;
    schedule.raw.memo = event.description;
    schedule.raw.creator.name = username;
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
function importICSFile(contents) {
    let icalComponent = new ICAL.Component(ICAL.parse(contents));
    let vevents = icalComponent.getAllSubcomponents('vevent');
    let allEvents = [];
    vevents.forEach(function(vvent, idx) {
        if( vvent.hasProperty('rrule') ){
            let msg = "recurring events currently not supported!";
            console.log(msg);
            displayMessage(msg);
            return null;
        } else {
            let schedule = buildScheduleFromEvent(unpackEvent(vvent, currentUsername), currentUsername);
            let dt = moment.utc(schedule.start.toUTCString());
            let year = dt.year();
            let month = dt.month() + 1;
            let output = serialiseICal(schedule);
            allEvents.push({year: year, month: month, Id: schedule.id, item:output});
            if(idx == vevents.length -1) {
                mainWindow.postMessage({items:allEvents, type:"saveAll"}, origin);
            }
        }
    });
}
function loadAdditional(currentMonthEvents, yearMonth) {
    let year = Math.floor(yearMonth / 12);
    let month = yearMonth % 12;
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
        vvent.updatePropertyWithValue('x-category-id', schedule.calendarId); //not to be exported
        if(schedule.calendarId == "6") { //CANCELLED
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
        vevent.addPropertyWithValue('x-category-id', schedule.calendarId); //not to be exported
        if(schedule.calendarId == "6") { //CANCELLED
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

function setCalendars() {
    var calendar;
    var id = 0;
    calendar = new CalendarInfo();
    id = 1; //Numbers are important!
    calendar.id = String(id);
    calendar.name = 'My Calendar';
    calendar.color = '#ffffff';
    calendar.bgColor = '#9e5fff';
    calendar.dragBgColor = '#9e5fff';
    calendar.borderColor = '#9e5fff';
    CalendarList.push(calendar);

    calendar = new CalendarInfo();
    id = 2;
    calendar.id = String(id);
    calendar.name = 'Work';
    calendar.color = '#ffffff';
    calendar.bgColor = '#00a9ff';
    calendar.dragBgColor = '#00a9ff';
    calendar.borderColor = '#00a9ff';
    CalendarList.push(calendar);

    calendar = new CalendarInfo();
    id = 3;
    calendar.id = String(id);
    calendar.name = 'Family';
    calendar.color = '#ffffff';
    calendar.bgColor = '#ff5583';
    calendar.dragBgColor = '#ff5583';
    calendar.borderColor = '#ff5583';
    CalendarList.push(calendar);

    calendar = new CalendarInfo();
    id = 4;
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
    calendar.name = 'Shared With Me';
    calendar.color = '#ffffff';
    calendar.bgColor = '#bbdc00';
    calendar.dragBgColor = '#bbdc00';
    calendar.borderColor = '#bbdc00';
    CalendarList.push(calendar);

    calendar = new CalendarInfo();
    id = 6;
    calendar.id = String(id);
    calendar.name = 'Cancelled';
    calendar.color = '#ffffff';
    calendar.bgColor = '#9d9d9d';
    calendar.dragBgColor = '#9d9d9d';
    calendar.borderColor = '#9d9d9d';
    CalendarList.push(calendar);


    var calendarList = document.getElementById('calendarList');
    var html = [];
    CalendarList.forEach(function(calendar) {
        html.push('<div class="lnb-calendars-item"><label>' +
            '<input type="checkbox" class="tui-full-calendar-checkbox-round" value="' + calendar.id + '" checked>' +
            '<span style="border-color: ' + calendar.borderColor + '; background-color: ' + calendar.borderColor + ';"></span>' +
            '<span>' + calendar.name + '</span>' +
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
            state: ''//scheduleData.state
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
        mainWindow.postMessage({type:"loadAdditional", year: toLoadMonth.year(), month: (toLoadMonth.month() + 1)},
            origin);
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
    html.push(moment(cal.getDate().getTime()).format('YYYY.MM'));
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
function downloadEvent(id, startDate, isAllDay, username) {
    sendEvent(id, startDate, isAllDay, username, 'downloadEvent');
}
function shareCalendarEvent(id, startDate, isAllDay, username) {
    sendEvent(id, startDate, isAllDay, username, 'shareCalendarEvent');
}
function addEventToClipboard(id, startDate, isAllDay, username) {
    sendEvent(id, startDate, isAllDay, username, 'addToClipboardEvent');
}
function sendEvent(id, startDate, isAllDay, username, eventType) {
   let dt = moment.utc(startDate.toUTCString());
   let year = dt.year();
   let month = dt.month() +1;
   mainWindow.postMessage({id: id, year: year, month: month, username: username, type: eventType}, origin);
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
    let state = document.getElementById("detail-busy-free-state");
    if(state != null) {
        state.style.display = 'none';
    }

    let cal = document.getElementsByClassName("tui-full-calendar-content");
    for(var j=0;j<cal.length;j++){
        let el = cal[j];
        if(el.localName == "span" && el.innerText == "Shared With Me") {
            el.innerText = el.innerText + " (" + eventData.schedule.raw.creator.name + ")";
            break;
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
        shareLink.innerText = "Share With";
        span1.appendChild(shareLink);
        shareLink.onclick=function() {
            shareCalendarEvent(eventData.schedule.id, eventData.schedule.start
                , eventData.schedule.isAllDay, eventData.schedule.raw.creator.name)
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
        downloadEvent(eventData.schedule.id, eventData.schedule.start
            , eventData.schedule.isAllDay, eventData.schedule.raw.creator.name);
    };
    span1.appendChild(document.createTextNode('\u00A0\u00A0'));

    var clipboardButton = document.createElement("button");
    span1.appendChild(clipboardButton);

    var img3 = document.createElement("img");
    img3.src = "./images/external-link-square.png";
    clipboardButton.appendChild(img3);
    clipboardButton.appendChild(document.createTextNode("\u00A0\u00A0Clipboard"));
    clipboardButton.onclick=function() {
       addEventToClipboard(eventData.schedule.id, eventData.schedule.start
        , eventData.schedule.isAllDay, eventData.schedule.raw.creator.name);
    };

    var locTextArea = document.createElement("textarea");
    locTextArea.id = "popup-memo-readonly";
    locTextArea.value = eventData == null ? "" : eventData.schedule.raw.memo;
    locTextArea.rows = 5;
    locTextArea.cols = 40;
    locTextArea.style.width="100%";
    locTextArea.readOnly = true;
    var div2 = document.createElement("div");
    eventDetails.appendChild(div2);
    var div3 = document.createElement("div");
    div2.appendChild(div3);
    div3.appendChild(locTextArea);
}
function removeSharedWithUsCalendar() {
    let dropdownMenuItems = document.getElementById("dropdown-menu-items").childNodes;
    for(var i=0;i<dropdownMenuItems.length;i++){
        let item = dropdownMenuItems[i];
        if(item.nodeName != "#text" && item.getAttribute("data-calendar-id") == "5") {
            item.remove();
        }
    }
}
function addMemoField(eventData) {

    let lock = document.getElementById("tui-full-calendar-schedule-private");
    lock.style.display = 'none';
    let state = document.getElementById("busy-free-state");
    state.style.display = 'none';


    let loc = document.getElementById("tui-full-calendar-schedule-location");
    let parent = loc.parentNode.parentNode.parentNode;
    var locTextArea = document.createElement("textarea");
    locTextArea.id = "popup-memo";
    locTextArea.value = eventData == null ? "" : eventData.schedule.raw.memo;
    locTextArea.rows = 5;
    locTextArea.cols = 85;

    var div1 = document.createElement("div");
    parent.appendChild(div1);
    var div2 = document.createElement("div");
    div1.appendChild(div2);
    div2.appendChild(locTextArea);
    if (eventData != null) {
        let saveBtn = document.getElementById("popup-save");
        var handler = function() {
            eventData.schedule.raw.memo = locTextArea.value;
            console.log("handler after");
        }
        saveBtn.onclick=handler;
    }
}


