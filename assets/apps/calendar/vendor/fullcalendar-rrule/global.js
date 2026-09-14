/*!
FullCalendar RRule Plugin v7.0.2
Docs & License: https://fullcalendar.io/docs/rrule-plugin
(c) 2026 Adam Shaw
*/
(function (rruleLib) {
    'use strict';

    function _interopNamespace(e) {
        if (e && e.__esModule) return e;
        var n = Object.create(null);
        if (e) {
            Object.keys(e).forEach(function (k) {
                if (k !== 'default') {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        }
        n["default"] = e;
        return Object.freeze(n);
    }

    var rruleLib__namespace = /*#__PURE__*/_interopNamespace(rruleLib);

    function addDays(m, n) {
        let a = dateToUtcArray(m);
        a[2] += n;
        return arrayToUtcDate(a);
    }
    function dateToUtcArray(date) {
        return [
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds(),
            date.getUTCMilliseconds(),
        ];
    }
    function arrayToUtcDate(a) {
        // according to web standards (and Safari), a month index is required.
        // massage if only given a year.
        if (a.length === 1) {
            a = a.concat([0]);
        }
        return new Date(Date.UTC(...a));
    }
    // Other Utils
    function isValidDate(m) {
        return !isNaN(m.valueOf());
    }
    const PARSE_RE = /^(-?)(?:(\d+)\.)?(\d+):(\d\d)(?::(\d\d)(?:\.(\d\d\d))?)?/;
    // Parsing and Creation
    function createDuration(input, unit) {
        if (typeof input === 'string') {
            return parseString(input);
        }
        if (typeof input === 'object' && input) { // non-null object
            return parseObject(input);
        }
        if (typeof input === 'number') {
            return parseObject({ [unit || 'milliseconds']: input });
        }
        return null;
    }
    function parseString(s) {
        let m = PARSE_RE.exec(s);
        if (m) {
            let sign = m[1] ? -1 : 1;
            return {
                years: 0,
                months: 0,
                days: sign * (m[2] ? parseInt(m[2], 10) : 0),
                milliseconds: sign * ((m[3] ? parseInt(m[3], 10) : 0) * 60 * 60 * 1000 + // hours
                    (m[4] ? parseInt(m[4], 10) : 0) * 60 * 1000 + // minutes
                    (m[5] ? parseInt(m[5], 10) : 0) * 1000 + // seconds
                    (m[6] ? parseInt(m[6], 10) : 0) // ms
                ),
            };
        }
        return null;
    }
    function parseObject(obj) {
        let duration = {
            years: obj.years || obj.year || 0,
            months: obj.months || obj.month || 0,
            days: obj.days || obj.day || 0,
            milliseconds: (obj.hours || obj.hour || 0) * 60 * 60 * 1000 + // hours
                (obj.minutes || obj.minute || 0) * 60 * 1000 + // minutes
                (obj.seconds || obj.second || 0) * 1000 + // seconds
                (obj.milliseconds || obj.millisecond || obj.ms || 0), // ms
        };
        let weeks = obj.weeks || obj.week;
        if (weeks) {
            duration.days += weeks * 7;
            duration.specifiedWeeks = true;
        }
        return duration;
    }

    const ISO_RE = /^\s*(\d{4})(-?(\d{2})(-?(\d{2})([T ](\d{2}):?(\d{2})(:?(\d{2})(\.(\d+))?)?(Z|(([-+])(\d{2})(:?(\d{2}))?))?)?)?)?$/;
    function parse(str) {
        let m = ISO_RE.exec(str);
        if (m) {
            let marker = new Date(Date.UTC(Number(m[1]), m[3] ? Number(m[3]) - 1 : 0, Number(m[5] || 1), Number(m[7] || 0), Number(m[8] || 0), Number(m[10] || 0), m[12] ? Number(`0.${m[12]}`) * 1000 : 0));
            if (isValidDate(marker)) {
                let timeZoneOffset = null;
                if (m[13]) {
                    timeZoneOffset = (m[15] === '-' ? -1 : 1) * (Number(m[16] || 0) * 60 +
                        Number(m[18] || 0));
                }
                return {
                    marker,
                    isTimeUnspecified: !m[6],
                    timeZoneOffset,
                };
            }
        }
        return null;
    }


    const recurringType = {
        parse(eventProps, dateEnv) {
            if (eventProps.rrule != null) {
                let eventRRuleData = parseEventRRule(eventProps, dateEnv);
                if (eventRRuleData) {
                    return {
                        typeData: {
                            rruleSet: eventRRuleData.rruleSet,
                            dateEnv: eventRRuleData.isTimeZoneSpecified ? undefined : dateEnv,
                        },
                        allDayGuess: !eventRRuleData.isTimeSpecified,
                        duration: eventProps.duration,
                    };
                }
            }
            return null;
        },
        expand(eventRRuleData, framingRange, calendarDateEnv) {
            return eventRRuleData.rruleSet.between(
            // Add one-day leeway since rrule lib only operates in UTC,
            // but the zoned variant of framingRange is not.
            // Also overcomes this rrule bug:
            // https://github.com/jakubroztocil/rrule/issues/84)
            addDays(framingRange.start, -1), addDays(framingRange.end, 1)).map((date) => {
                // convert to plain-datetime
                return calendarDateEnv.createMarker(
                // convert to epoch-milliseconds in original timezone
                eventRRuleData.dateEnv
                    ? eventRRuleData.dateEnv.toDate(date)
                    : date);
            });
        },
    };
    function parseEventRRule(eventProps, dateEnv) {
        let rruleSet;
        let isTimeSpecified = false;
        let isTimeZoneSpecified = false;
        if (typeof eventProps.rrule === 'string') {
            let res = parseRRuleString(eventProps.rrule);
            rruleSet = res.rruleSet;
            isTimeSpecified = res.isTimeSpecified;
            isTimeZoneSpecified = res.isTimeZoneSpecified;
        }
        if (typeof eventProps.rrule === 'object' && eventProps.rrule) { // non-null object
            let res = parseRRuleObject(eventProps.rrule, dateEnv);
            rruleSet = new rruleLib__namespace.RRuleSet();
            rruleSet.rrule(res.rrule);
            isTimeSpecified = res.isTimeSpecified;
            isTimeZoneSpecified = res.isTimeZoneSpecified;
        }
        // convery to arrays. TODO: general util?
        let exdateInputs = [].concat(eventProps.exdate || []);
        let exruleInputs = [].concat(eventProps.exrule || []);
        for (let exdateInput of exdateInputs) {
            let res = parse(exdateInput);
            isTimeSpecified = isTimeSpecified || !res.isTimeUnspecified;
            isTimeZoneSpecified = isTimeZoneSpecified || res.timeZoneOffset !== null;
            rruleSet.exdate(new Date(res.marker.valueOf() - (res.timeZoneOffset || 0) * 60 * 1000));
        }
        // TODO: exrule is deprecated. what to do? (https://icalendar.org/iCalendar-RFC-5545/a-3-deprecated-features.html)
        for (let exruleInput of exruleInputs) {
            let res = parseRRuleObject(exruleInput, dateEnv);
            isTimeSpecified = isTimeSpecified || res.isTimeSpecified;
            isTimeZoneSpecified = isTimeZoneSpecified || res.isTimeZoneSpecified;
            rruleSet.exrule(res.rrule);
        }
        return { rruleSet, isTimeSpecified, isTimeZoneSpecified };
    }
    function parseRRuleObject(rruleInput, dateEnv) {
        let isTimeSpecified = false;
        let isTimeZoneSpecified = false;
        function processDateInput(dateInput) {
            if (typeof dateInput === 'string') {
                let markerData = parse(dateInput);
                if (markerData) {
                    isTimeSpecified = isTimeSpecified || !markerData.isTimeUnspecified;
                    isTimeZoneSpecified = isTimeZoneSpecified || markerData.timeZoneOffset !== null;
                    return new Date(markerData.marker.valueOf() - (markerData.timeZoneOffset || 0) * 60 * 1000); // NOT DRY
                }
                return null;
            }
            return dateInput; // TODO: what about number timestamps?
        }
        let rruleOptions = {
            ...rruleInput,
            dtstart: processDateInput(rruleInput.dtstart),
            until: processDateInput(rruleInput.until),
            freq: convertConstant(rruleInput.freq),
            wkst: rruleInput.wkst == null
                ? (dateEnv.weekDow - 1 + 7) % 7 // convert Sunday-first to Monday-first
                : convertConstant(rruleInput.wkst),
            byweekday: convertConstants(rruleInput.byweekday),
        };
        return { rrule: new rruleLib__namespace.RRule(rruleOptions), isTimeSpecified, isTimeZoneSpecified };
    }
    function parseRRuleString(str) {
        let rruleSet = rruleLib__namespace.rrulestr(str, { forceset: true });
        let analysis = analyzeRRuleString(str);
        return { rruleSet, ...analysis };
    }
    function analyzeRRuleString(str) {
        let isTimeSpecified = false;
        let isTimeZoneSpecified = false;
        function processMatch(whole, introPart, datePart) {
            let result = parse(datePart);
            isTimeSpecified = isTimeSpecified || !result.isTimeUnspecified;
            isTimeZoneSpecified = isTimeZoneSpecified || result.timeZoneOffset !== null;
        }
        str.replace(/\b(DTSTART:)([^\n]*)/, processMatch);
        str.replace(/\b(EXDATE:)([^\n]*)/, processMatch);
        str.replace(/\b(UNTIL=)([^;\n]*)/, processMatch);
        return { isTimeSpecified, isTimeZoneSpecified };
    }
    function convertConstants(input) {
        if (Array.isArray(input)) {
            return input.map(convertConstant);
        }
        return convertConstant(input);
    }
    function convertConstant(input) {
        if (typeof input === 'string') {
            return rruleLib__namespace.RRule[input.toUpperCase()];
        }
        return input;
    }

    function identity(raw) {
        return raw;
    }

    const RRULE_EVENT_REFINERS = {
        rrule: identity,
        exrule: identity,
        exdate: identity,
        duration: createDuration,
    };

    var plugin = {
        name: 'rrule',
        recurringTypes: [recurringType],
        eventRefiners: RRULE_EVENT_REFINERS,
    };

    FullCalendar.globalPlugins.push(plugin);

})(rrule);
