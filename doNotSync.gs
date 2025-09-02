/**
 * Applies "do not sync" rules to an event.
 * For non-recurring events, it returns null if the event should be skipped.
 * For recurring events, it adds EXDATE properties for occurrences that should be skipped.
 *
 * @param {ICAL.Component} event The event to process.
 * @return {ICAL.Component|null} The processed event, or null if it should be skipped.
 */
function applyDoNotSyncRules(event) {
  const config = getDoNotSyncConfig();
  const icalEvent = new ICAL.Event(event);

  if (!icalEvent.startDate || !icalEvent.endDate) {
    return event;
  }

  // Handle non-recurring events
  if (!icalEvent.isRecurring()) {
    const eventStart = icalEvent.startDate.toJSDate();
    const eventEnd = icalEvent.endDate.toJSDate();

    // Check against specific dates
    for (const rule of config.specificDates) {
      const ruleStart = new Date(rule.start);
      const ruleEnd = new Date(rule.end);
      if (eventStart.getTime() === ruleStart.getTime() && eventEnd.getTime() === ruleEnd.getTime()) {
        Logger.log(`Skipping non-recurring event because it matches a specific date rule: ${rule.start} - ${rule.end}`);
        return null;
      }
    }

    // Check against recurring days
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][eventStart.getUTCDay()];
    for (const rule of config.recurringDays) {
      if (rule.dayOfWeek === dayOfWeek) {
        const eventStartTime = eventStart.getUTCHours().toString().padStart(2, '0') + ':' + eventStart.getUTCMinutes().toString().padStart(2, '0') + ':' + eventStart.getUTCSeconds().toString().padStart(2, '0');
        const eventEndTime = eventEnd.getUTCHours().toString().padStart(2, '0') + ':' + eventEnd.getUTCMinutes().toString().padStart(2, '0') + ':' + eventEnd.getUTCSeconds().toString().padStart(2, '0');

        if (eventStartTime === rule.startTime && eventEndTime === rule.endTime) {
          Logger.log(`Skipping non-recurring event because it matches a recurring day rule: ${rule.dayOfWeek} ${rule.startTime} - ${rule.endTime}`);
          return null;
        }
      }
    }
    return event;
  }

  // Handle recurring events
  const expansion = new ICAL.RecurExpansion({
    component: event,
    dtstart: icalEvent.startDate
  });

  const yearFromNow = new Date();
  yearFromNow.setFullYear(yearFromNow.getFullYear() + 1);

  let next;
  while ((next = expansion.next()) && next.toJSDate() < yearFromNow) {
    const occurrenceStart = next.toJSDate();
    const occurrenceEnd = new Date(occurrenceStart.getTime() + (icalEvent.endDate.toJSDate() - icalEvent.startDate.toJSDate()));

    // Check against specific dates
    for (const rule of config.specificDates) {
      const ruleStart = new Date(rule.start);
      const ruleEnd = new Date(rule.end);
      if (occurrenceStart.getTime() === ruleStart.getTime() && occurrenceEnd.getTime() === ruleEnd.getTime()) {
        Logger.log(`Excluding recurring event instance at ${occurrenceStart} due to specific date rule.`);
        event.addPropertyWithValue('exdate', next.toString());
      }
    }

    // Check against recurring days
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][occurrenceStart.getUTCDay()];
    for (const rule of config.recurringDays) {
      if (rule.dayOfWeek === dayOfWeek) {
        const occurrenceStartTime = occurrenceStart.getUTCHours().toString().padStart(2, '0') + ':' + occurrenceStart.getUTCMinutes().toString().padStart(2, '0') + ':' + occurrenceStart.getUTCSeconds().toString().padStart(2, '0');
        const occurrenceEndTime = occurrenceEnd.getUTCHours().toString().padStart(2, '0') + ':' + occurrenceEnd.getUTCMinutes().toString().padStart(2, '0') + ':' + occurrenceEnd.getUTCSeconds().toString().padStart(2, '0');

        if (occurrenceStartTime === rule.startTime && occurrenceEndTime === rule.endTime) {
          Logger.log(`Excluding recurring event instance at ${occurrenceStart} due to recurring day rule.`);
          event.addPropertyWithValue('exdate', next.toString());
        }
      }
    }
  }

  return event;
}
