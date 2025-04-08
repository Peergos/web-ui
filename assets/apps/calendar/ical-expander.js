    //https://searchfox.org/comm-central/source/calendar/timezones/zones.json
  let aliases = {
      "AUS Central Standard Time": {
        "aliasTo": "Australia/Darwin"
      },
      "AUS Eastern Standard Time": {
        "aliasTo": "Australia/Sydney"
      },
      "Afghanistan Standard Time": {
        "aliasTo": "Asia/Kabul"
      },
      "Africa/Asmera": {
        "aliasTo": "Africa/Asmara"
      },
      "Africa/Timbuktu": {
        "aliasTo": "Africa/Bamako"
      },
      "Alaskan Standard Time": {
        "aliasTo": "America/Anchorage"
      },
      "Aleutian Standard Time": {
        "aliasTo": "America/Adak"
      },
      "Altai Standard Time": {
        "aliasTo": "Asia/Barnaul"
      },
      "America/Argentina/ComodRivadavia": {
        "aliasTo": "America/Argentina/Catamarca"
      },
      "America/Buenos_Aires": {
        "aliasTo": "America/Argentina/Buenos_Aires"
      },
      "America/Godthab": {
        "aliasTo": "America/Nuuk"
      },
      "America/Louisville": {
        "aliasTo": "America/Kentucky/Louisville"
      },
      "America/Montreal": {
        "aliasTo": "America/Toronto"
      },
      "America/Santa_Isabel": {
        "aliasTo": "America/Tijuana"
      },
      "Arab Standard Time": {
        "aliasTo": "Asia/Riyadh"
      },
      "Arabian Standard Time": {
        "aliasTo": "Asia/Dubai"
      },
      "Arabic Standard Time": {
        "aliasTo": "Asia/Baghdad"
      },
      "Argentina Standard Time": {
        "aliasTo": "America/Argentina/Buenos_Aires"
      },
      "Armenian Standard Time": {
        "aliasTo": "Asia/Yerevan"
      },
      "Asia/Calcutta": {
        "aliasTo": "Asia/Kolkata"
      },
      "Asia/Katmandu": {
        "aliasTo": "Asia/Kathmandu"
      },
      "Asia/Rangoon": {
        "aliasTo": "Asia/Yangon"
      },
      "Asia/Saigon": {
        "aliasTo": "Asia/Ho_Chi_Minh"
      },
      "Astrakhan Standard Time": {
        "aliasTo": "Europe/Astrakhan"
      },
      "Atlantic Standard Time": {
        "aliasTo": "America/Halifax"
      },
      "Atlantic/Faeroe": {
        "aliasTo": "Atlantic/Faroe"
      },
      "Atlantic/Jan_Mayen": {
        "aliasTo": "Europe/Oslo"
      },
      "Aus Central W. Standard Time": {
        "aliasTo": "Australia/Eucla"
      },
      "Australia/Currie": {
        "aliasTo": "Australia/Hobart"
      },
      "Azerbaijan Standard Time": {
        "aliasTo": "Asia/Baku"
      },
      "Azores Standard Time": {
        "aliasTo": "Atlantic/Azores"
      },
      "Bahia Standard Time": {
        "aliasTo": "America/Bahia"
      },
      "Bangkok Standard Time": {
        "aliasTo": "Asia/Bangkok"
      },
      "Bangladesh Standard Time": {
        "aliasTo": "Asia/Dhaka"
      },
      "Belarus Standard Time": {
        "aliasTo": "Europe/Minsk"
      },
      "Bougainville Standard Time": {
        "aliasTo": "Pacific/Bougainville"
      },
      "Canada Central Standard Time": {
        "aliasTo": "America/Regina"
      },
      "Cape Verde Standard Time": {
        "aliasTo": "Atlantic/Cape_Verde"
      },
      "Caucasus Standard Time": {
        "aliasTo": "Asia/Yerevan"
      },
      "Cen. Australia Standard Time": {
        "aliasTo": "Australia/Adelaide"
      },
      "Central America Standard Time": {
        "aliasTo": "America/Guatemala"
      },
      "Central Asia Standard Time": {
        "aliasTo": "Asia/Almaty"
      },
      "Central Brazilian Standard Time": {
        "aliasTo": "America/Cuiaba"
      },
      "Central Europe Standard Time": {
        "aliasTo": "Europe/Budapest"
      },
      "Central European Standard Time": {
        "aliasTo": "Europe/Warsaw"
      },
      "Central Pacific Standard Time": {
        "aliasTo": "Pacific/Guadalcanal"
      },
      "Central Standard Time": {
        "aliasTo": "America/Chicago"
      },
      "Central Standard Time (Mexico)": {
        "aliasTo": "America/Mexico_City"
      },
      "Chatham Islands Standard Time": {
        "aliasTo": "Pacific/Chatham"
      },
      "China Standard Time": {
        "aliasTo": "Asia/Shanghai"
      },
      "Cuba Standard Time": {
        "aliasTo": "America/Havana"
      },
      "E. Africa Standard Time": {
        "aliasTo": "Africa/Nairobi"
      },
      "E. Australia Standard Time": {
        "aliasTo": "Australia/Brisbane"
      },
      "E. Europe Standard Time": {
        "aliasTo": "Europe/Chisinau"
      },
      "E. South America Standard Time": {
        "aliasTo": "America/Sao_Paulo"
      },
      "Easter Island Standard Time": {
        "aliasTo": "Pacific/Easter"
      },
      "Eastern Standard Time": {
        "aliasTo": "America/New_York"
      },
      "Eastern Standard Time (Mexico)": {
        "aliasTo": "America/Cancun"
      },
      "Egypt Standard Time": {
        "aliasTo": "Africa/Cairo"
      },
      "Ekaterinburg Standard Time": {
        "aliasTo": "Asia/Yekaterinburg"
      },
      "Etc/GMT": {
        "aliasTo": "UTC"
      },
      "Etc/GMT+0": {
        "aliasTo": "UTC"
      },
      "Etc/UCT": {
        "aliasTo": "UTC"
      },
      "Etc/UTC": {
        "aliasTo": "UTC"
      },
      "Etc/Unversal": {
        "aliasTo": "UTC"
      },
      "Etc/Zulu": {
        "aliasTo": "UTC"
      },
      "Europe/Belfast": {
        "aliasTo": "Europe/London"
      },
      "FLE Standard Time": {
        "aliasTo": "Europe/Kiev"
      },
      "Fiji Standard Time": {
        "aliasTo": "Pacific/Fiji"
      },
      "GFT Standard Time": {
        "aliasTo": "Europe/Athens"
      },
      "GMT": {
        "aliasTo": "UTC"
      },
      "GMT Standard Time": {
        "aliasTo": "Europe/London"
      },
      "GMT+0": {
        "aliasTo": "UTC"
      },
      "GMT0": {
        "aliasTo": "UTC"
      },
      "GTB Standard Time": {
        "aliasTo": "Europe/Bucharest"
      },
      "Georgian Standard Time": {
        "aliasTo": "Asia/Tbilisi"
      },
      "Greenland Standard Time": {
        "aliasTo": "America/Godthab"
      },
      "Greenwich": {
        "aliasTo": "UTC"
      },
      "Greenwich Standard Time": {
        "aliasTo": "Atlantic/Reykjavik"
      },
      "Haiti Standard Time": {
        "aliasTo": "America/Port-au-Prince"
      },
      "Hawaiian Standard Time": {
        "aliasTo": "Pacific/Honolulu"
      },
      "India Standard Time": {
        "aliasTo": "Asia/Calcutta"
      },
      "Iran Standard Time": {
        "aliasTo": "Asia/Tehran"
      },
      "Israel Standard Time": {
        "aliasTo": "Asia/Jerusalem"
      },
      "Jordan Standard Time": {
        "aliasTo": "Asia/Amman"
      },
      "Kaliningrad Standard Time": {
        "aliasTo": "Europe/Kaliningrad"
      },
      "Korea Standard Time": {
        "aliasTo": "Asia/Seoul"
      },
      "Libya Standard Time": {
        "aliasTo": "Africa/Tripoli"
      },
      "Line Islands Standard Time": {
        "aliasTo": "Pacific/Kiritimati"
      },
      "Lord Howe Standard Time": {
        "aliasTo": "Australia/Lord_Howe"
      },
      "Magadan Standard Time": {
        "aliasTo": "Asia/Magadan"
      },
      "Magallanes Standard Time": {
        "aliasTo": "America/Punta_Arenas"
      },
      "Marquesas Standard Time": {
        "aliasTo": "Pacific/Marquesas"
      },
      "Mauritius Standard Time": {
        "aliasTo": "Indian/Mauritius"
      },
      "Mexico Standard Time": {
        "aliasTo": "America/Mexico_City"
      },
      "Mid-Atlantic Standard Time": {
        "aliasTo": "Atlantic/South_Georgia"
      },
      "Middle East Standard Time": {
        "aliasTo": "Asia/Beirut"
      },
      "Montevideo Standard Time": {
        "aliasTo": "America/Montevideo"
      },
      "Morocco Standard Time": {
        "aliasTo": "Africa/Casablanca"
      },
      "Mountain Standard Time": {
        "aliasTo": "America/Denver"
      },
      "Mountain Standard Time (Mexico)": {
        "aliasTo": "America/Chihuahua"
      },
      "Myanmar Standard Time": {
        "aliasTo": "Asia/Rangoon"
      },
      "N. Central Asia Standard Time": {
        "aliasTo": "Asia/Novosibirsk"
      },
      "Namibia Standard Time": {
        "aliasTo": "Africa/Windhoek"
      },
      "Nepal Standard Time": {
        "aliasTo": "Asia/Katmandu"
      },
      "New Zealand Standard Time": {
        "aliasTo": "Pacific/Auckland"
      },
      "Newfoundland Standard Time": {
        "aliasTo": "America/St_Johns"
      },
      "Norfolk Standard Time": {
        "aliasTo": "Pacific/Norfolk"
      },
      "North Asia East Standard Time": {
        "aliasTo": "Asia/Irkutsk"
      },
      "North Asia Standard Time": {
        "aliasTo": "Asia/Krasnoyarsk"
      },
      "North Korea Standard Time": {
        "aliasTo": "Asia/Pyongyang"
      },
      "Omsk Standard Time": {
        "aliasTo": "Asia/Omsk"
      },
      "Pacific SA Standard Time": {
        "aliasTo": "America/Santiago"
      },
      "Pacific Standard Time": {
        "aliasTo": "America/Los_Angeles"
      },
      "Pacific Standard Time (Mexico)": {
        "aliasTo": "America/Santa_Isabel"
      },
      "Pacific/Enderbury": {
        "aliasTo": "Pacific/Kanton"
      },
      "Pacific/Johnston": {
        "aliasTo": "Pacific/Honolulu"
      },
      "Pakistan Standard Time": {
        "aliasTo": "Asia/Karachi"
      },
      "Paraguay Standard Time": {
        "aliasTo": "America/Asuncion"
      },
      "Romance Standard Time": {
        "aliasTo": "Europe/Paris"
      },
      "Russia Time Zone 10": {
        "aliasTo": "Asia/Srednekolymsk"
      },
      "Russia Time Zone 11": {
        "aliasTo": "Asia/Kamchatka"
      },
      "Russia Time Zone 3": {
        "aliasTo": "Europe/Samara"
      },
      "Russian Standard Time": {
        "aliasTo": "Europe/Moscow"
      },
      "SA Eastern Standard Time": {
        "aliasTo": "America/Cayenne"
      },
      "SA Pacific Standard Time": {
        "aliasTo": "America/Bogota"
      },
      "SA Western Standard Time": {
        "aliasTo": "America/La_Paz"
      },
      "SE Asia Standard Time": {
        "aliasTo": "Asia/Bangkok"
      },
      "Saint Pierre Standard Time": {
        "aliasTo": "America/Miquelon"
      },
      "Sakhalin Standard Time": {
        "aliasTo": "Asia/Sakhalin"
      },
      "Samoa Standard Time": {
        "aliasTo": "Pacific/Apia"
      },
      "Sao Tome Standard Time": {
        "aliasTo": "Africa/Sao_Tome"
      },
      "Saratov Standard Time": {
        "aliasTo": "Europe/Saratov"
      },
      "Saudi Arabia Standard Time": {
        "aliasTo": "Asia/Riyadh"
      },
      "Singapore Standard Time": {
        "aliasTo": "Asia/Singapore"
      },
      "South Africa Standard Time": {
        "aliasTo": "Africa/Johannesburg"
      },
      "Sri Lanka Standard Time": {
        "aliasTo": "Asia/Colombo"
      },
      "Sudan Standard Time": {
        "aliasTo": "Africa/Khartoum"
      },
      "Sydney Standard Time": {
        "aliasTo": "Australia/Sydney"
      },
      "Syria Standard Time": {
        "aliasTo": "Asia/Damascus"
      },
      "Taipei Standard Time": {
        "aliasTo": "Asia/Taipei"
      },
      "Tasmania Standard Time": {
        "aliasTo": "Australia/Hobart"
      },
      "Tocantins Standard Time": {
        "aliasTo": "America/Araguaina"
      },
      "Tokyo Standard Time": {
        "aliasTo": "Asia/Tokyo"
      },
      "Tomsk Standard Time": {
        "aliasTo": "Asia/Tomsk"
      },
      "Tonga Standard Time": {
        "aliasTo": "Pacific/Tongatapu"
      },
      "Transbaikal Standard Time": {
        "aliasTo": "Asia/Chita"
      },
      "Turkey Standard Time": {
        "aliasTo": "Europe/Istanbul"
      },
      "Turks And Caicos Standard Time": {
        "aliasTo": "America/Grand_Turk"
      },
      "UCT": {
        "aliasTo": "UTC"
      },
      "US Eastern Standard Time": {
        "aliasTo": "America/Indiana/Indianapolis"
      },
      "US Mountain Standard Time": {
        "aliasTo": "America/Phoenix"
      },
      "US/Central": {
        "aliasTo": "America/Chicago"
      },
      "US/Eastern": {
        "aliasTo": "America/New_York"
      },
      "US/Mountain": {
        "aliasTo": "America/Denver"
      },
      "US/Pacific": {
        "aliasTo": "America/Los_Angeles"
      },
      "US/Pacific-New": {
        "aliasTo": "America/Los_Angeles"
      },
      "Ulaanbaatar Standard Time": {
        "aliasTo": "Asia/Ulaanbaatar"
      },
      "Universal": {
        "aliasTo": "UTC"
      },
      "Venezuela Standard Time": {
        "aliasTo": "America/Caracas"
      },
      "Vladivostok Standard Time": {
        "aliasTo": "Asia/Vladivostok"
      },
      "W. Australia Standard Time": {
        "aliasTo": "Australia/Perth"
      },
      "W. Central Africa Standard Time": {
        "aliasTo": "Africa/Lagos"
      },
      "W. Europe Standard Time": {
        "aliasTo": "Europe/Berlin"
      },
      "W. Mongolia Standard Time": {
        "aliasTo": "Asia/Hovd"
      },
      "West Asia Standard Time": {
        "aliasTo": "Asia/Tashkent"
      },
      "West Bank Standard Time": {
        "aliasTo": "Asia/Hebron"
      },
      "West Pacific Standard Time": {
        "aliasTo": "Pacific/Port_Moresby"
      },
      "Western Brazilian Standard Time": {
        "aliasTo": "America/Rio_Branco"
      },
      "Yakutsk Standard Time": {
        "aliasTo": "Asia/Yakutsk"
      },
      "Z": {
        "aliasTo": "UTC"
      },
      "Zulu": {
        "aliasTo": "UTC"
      },
      "utc": {
        "aliasTo": "UTC"
      }
};

class IcalExpander {
  constructor(opts) {
    this.maxIterations = opts.maxIterations != null ? opts.maxIterations : 1000;
    this.skipInvalidDates = opts.skipInvalidDates != null ? opts.skipInvalidDates : false;

    //this.jCalData = ICAL.parse(opts.ics);
    this.component = opts.ics;//new ICAL.Component(this.jCalData);
    this.events = this.component.getAllSubcomponents('vevent').map(vevent => new ICAL.Event(vevent));

    if (this.skipInvalidDates) {
      this.events = this.events.filter((evt) => {
        try {
          evt.startDate.toJSDate();
          evt.endDate.toJSDate();
          return true;
        } catch (err) {
          // skipping events with invalid time
          return false;
        }
      });
    }
  }

  between(after, before) {
    function isEventWithinRange(startTime, endTime) {
      return (!after || endTime >= after.getTime()) &&
      (!before || startTime <= before.getTime());
    }

    const exceptions = [];

    this.events.forEach((event) => {
      if (event.isRecurrenceException()) exceptions.push(event);
    });

    const ret = {
      events: [],
      occurrences: [],
    };

    this.events.filter(e => !e.isRecurrenceException()).forEach((event) => {
      const exdates = [];

      event.component.getAllProperties('exdate').forEach((exdateProp) => {
        const exdate = exdateProp.getFirstValue();
        exdates.push(exdate.toJSDate().getTime());
      });

      // Recurring event is handled differently
      if (event.isRecurring()) {
        const iterator = event.iterator();

        let next;
        let i = 0;

        do {
          i += 1;
          next = iterator.next();
          if (next) {
            const occurrence = event.getOccurrenceDetails(next);

            //const { startTime, endTime } = getTimes(occurrence);
            const startTime = occurrence.startDate.toJSDate().getTime();
            let endTime = occurrence.endDate.toJSDate().getTime();

            // If it is an all day event, the end date is set to 00:00 of the next day
            // So we need to make it be 23:59:59 to compare correctly with the given range
            if (occurrence.endDate.isDate && (endTime > startTime)) {
                endTime -= 1;
            }
            const isOccurrenceExcluded = exdates.indexOf(startTime) !== -1;

            // TODO check that within same day?
            const exception = exceptions.find(ex => {
                if (ex.uid !== event.uid) {
                    return false;
                }
                let exDate = ex.recurrenceId.toJSDate();
                let occDate = occurrence.startDate.toJSDate();
                if (exDate.getYear() !== occDate.getYear()){
                    return false;
                }
                if (exDate.getMonth() !== occDate.getMonth()){
                    return false;
                }
                if (exDate.getDate() !== occDate.getDate()){
                    return false;
                }
                return true;
            });

            // We have passed the max date, stop
            if (before && startTime > before.getTime()) break;

            // Check that we are within our range
            if (isEventWithinRange(startTime, endTime)) {
              if (exception) {
                ret.events.push(exception);
              } else if (!isOccurrenceExcluded) {
                ret.occurrences.push(occurrence);
              }
            }
          }
        }
        while (next && (!this.maxIterations || i < this.maxIterations));

        return;
      }

      // Non-recurring event:
      //const { startTime, endTime } = getTimes(event);
      const startTime = event.startDate.toJSDate().getTime();
      let endTime = event.endDate.toJSDate().getTime();

      // If it is an all day event, the end date is set to 00:00 of the next day
      // So we need to make it be 23:59:59 to compare correctly with the given range
      if (event.endDate.isDate && (endTime > startTime)) {
        endTime -= 1;
      }
      if (isEventWithinRange(startTime, endTime)) ret.events.push(event);
    });

    return ret;
  }

  before(before) {
    return this.between(undefined, before);
  }

  after(after) {
    return this.between(after);
  }

  all() {
    return this.between();
  }
}
function normaliseTimeZoneName(txId) {
    return aliases[txId] != null ? aliases[txId].aliasTo : txId;
}
function getTimeZoneText(txId) {
    return timeZoneMap[txId];
}
let timeZoneMap = [];

function register(tzdata) {
    let endKeyIndex = tzdata.indexOf('\r\n');
    let key = tzdata.substring("TZID:".length, endKeyIndex);
    let icsData = tzdata.substring(tzdata.indexOf("BEGIN:"));
    timeZoneMap[key] = icsData;
    const icsTimezone = 'BEGIN:VTIMEZONE\r\nTZID:' + key + '\r\n' + icsData + '\r\nEND:VTIMEZONE';
    const text = 'BEGIN:VCALENDAR\nPRODID:-//tzurl.org//NONSGML Olson 2012h//EN\nVERSION:2.0\n' + icsTimezone + '\nEND:VCALENDAR';
    const parsed = ICAL.parse(text);
    const comp = new ICAL.Component(parsed);
    const vtimezone = comp.getFirstSubcomponent('vtimezone');

    ICAL.TimezoneService.register(key, new ICAL.Timezone(vtimezone));
}
registerTimeZones();

//module.exports = IcalExpander;
