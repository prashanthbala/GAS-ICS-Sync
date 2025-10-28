/**
 * Applies all filtering rules from the configuration to a list of events.
 *
 * @param {Array<ICAL.Component>} events The array of events to process.
 * @return {Array<ICAL.Component>} The new array of events after all filters have been applied.
 */
function applyFilters(events) {
  const config = getFilterConfig();
  if (!config || !config.rules || config.rules.length === 0) {
    return events;
  }

  const scriptTz = Session.getScriptTimeZone();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // First, process rules that modify recurring events by adding EXDATEs
  for (const event of events) {
    const icalEvent = new ICAL.Event(event);
    if (icalEvent.isRecurring()) {
      handleRecurringEvent(event, icalEvent, config.rules, scriptTz, days);
    }
  }

  // Then, filter the list of events (both non-recurring and now-modified recurring)
  const filteredEvents = events.filter(event => {
    const icalEvent = new ICAL.Event(event);
    // Non-recurring events are checked for immediate exclusion
    if (!icalEvent.isRecurring()) {
      for (const rule of config.rules) {
        if (shouldExcludeEvent(event, icalEvent, rule, scriptTz, days)) {
          return false; // Exclude this event
        }
      }
    }
    return true; // Keep this event
  });

  return filteredEvents;
}

/**
 * Checks if a single non-recurring event should be excluded based on a given rule.
 */
function shouldExcludeEvent(event, icalEvent, rule, scriptTz, days) {
  try {
    const eventStart = icalEvent.startDate.toJSDate();
    const eventEnd = icalEvent.endDate.toJSDate();

    switch (rule.property) {
      case "summary":
      case "categories":
        const propValue = icalEvent.getPropertyValue(rule.property)?.toString() || "";
        if (rule.operator === "contains" && propValue.toLowerCase().includes(rule.value.toLowerCase())) return true;
        if (rule.operator === "regex" && new RegExp(rule.value).test(propValue)) return true;
        break;

      case "dtstart":
      case "dtend":
        const durationRegex = /(\d+)([dhm])/;
        const match = durationRegex.exec(rule.value);
        if (!match) return false;

        const amount = parseInt(match[1], 10);
        const unit = match[2];
        let offset = 0;
        if (unit === 'd') offset = amount;
        if (unit === 'h') offset = amount / 24;
        if (unit === 'm') offset = amount / (24 * 60);

        let referenceDate = new ICAL.Time.fromJSDate(new Date(), true).adjust(offset, 0, 0, 0);
        let eventTime = (rule.property === 'dtstart') ? icalEvent.startDate : icalEvent.endDate;

        if (rule.operator === '>' && eventTime.compare(referenceDate) > 0) return true;
        if (rule.operator === '<' && eventTime.compare(referenceDate) < 0) return true;
        break;

      case "datetime":
        if (rule.operator === "exactMatch") {
          const ruleStart = new Date(rule.value.start);
          const ruleEnd = new Date(rule.value.end);
          if (eventStart.getTime() === ruleStart.getTime() && eventEnd.getTime() === ruleEnd.getTime()) return true;
        }
        break;

      case "schedule":
        if (rule.operator === "matches") {
          const localDayOfWeek = days[new Date(Utilities.formatDate(eventStart, scriptTz, "yyyy-MM-dd'T'HH:mm:ss")).getDay()];
          if (rule.value.dayOfWeek === localDayOfWeek) {
            const eventStartTime = Utilities.formatDate(eventStart, scriptTz, "HH:mm:ss");
            const eventEndTime = Utilities.formatDate(eventEnd, scriptTz, "HH:mm:ss");
            if (eventStartTime === rule.value.startTime && eventEndTime === rule.value.endTime) return true;
          }
        }
        break;
    }
  } catch (e) {
    // Ignore errors in a single rule and continue
  }
  return false;
}

/**
 * Modifies a recurring event by adding EXDATE properties for any occurrences that match exclusion rules.
 */
function handleRecurringEvent(event, icalEvent, rules, scriptTz, days) {
  const expansion = new ICAL.RecurExpansion({
    component: event,
    dtstart: icalEvent.startDate
  });

  const yearFromNow = new Date();
  yearFromNow.setFullYear(yearFromNow.getFullYear() + 1);

  let next;
  while ((next = expansion.next()) && next.toJSDate() < yearFromNow) {
    const tempOccurrenceEvent = new ICAL.Event(event);
    tempOccurrenceEvent.startDate = next;

    // We need a temporary VEVENT to check rules against, since the rule checker expects a VEVENT
    const tempVEvent = new ICAL.Component(['vevent', [], []]);
    tempVEvent.addProperty(tempOccurrenceEvent.startDate.toICAL());
    tempVEvent.addProperty(tempOccurrenceEvent.endDate.toICAL());


    for (const rule of rules) {
      if (shouldExcludeEvent(tempVEvent, new ICAL.Event(tempVEvent), rule, scriptTz, days)) {
        Logger.log(`Excluding recurring instance at ${next.toJSDate()} for rule: ${JSON.stringify(rule)}`);
        event.addPropertyWithValue('exdate', next.toString());
        // Important: break after first match for this instance to avoid adding duplicate EXDATEs
        break;
      }
    }
  }
}
