/**
 * Applies "do not sync" rules to an array of events, using the script's local timezone for recurring day rules.
 * Non-recurring events that match a rule are removed from the array.
 * Recurring events have EXDATE properties added for occurrences that match a rule.
 *
 * @param {Array<ICAL.Component>} events The array of events to process.
 * @return {Array<ICAL.Component>} The processed array of events.
 */
function applyDoNotSyncRules(events) {
  const config = getDoNotSyncConfig();
  const processedEvents = [];
  const scriptTz = Session.getScriptTimeZone();
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  for (const event of events) {
    const icalEvent = new ICAL.Event(event);

    if (!icalEvent.startDate || !icalEvent.endDate) {
      processedEvents.push(event);
      continue;
    }

    if (!icalEvent.isRecurring()) {
      // Handle non-recurring events
      const eventStart = icalEvent.startDate.toJSDate();
      const eventEnd = icalEvent.endDate.toJSDate();
      let shouldSkip = false;

      // Check against specific dates (UTC)
      for (const rule of config.specificDates) {
        const ruleStart = new Date(rule.start);
        const ruleEnd = new Date(rule.end);
        if (eventStart.getTime() === ruleStart.getTime() && eventEnd.getTime() === ruleEnd.getTime()) {
          shouldSkip = true;
          Logger.log(`Skipping non-recurring event due to specific date rule: ${rule.start}`);
          break;
        }
      }

      if (shouldSkip) continue;

      // Check against recurring days (local time)
      const localDayOfWeek = days[new Date(Utilities.formatDate(eventStart, scriptTz, "yyyy-MM-dd'T'HH:mm:ss")).getDay()];
      for (const rule of config.recurringDays) {
        if (rule.dayOfWeek === localDayOfWeek) {
          const eventStartTime = Utilities.formatDate(eventStart, scriptTz, "HH:mm:ss");
          const eventEndTime = Utilities.formatDate(eventEnd, scriptTz, "HH:mm:ss");

          if (eventStartTime === rule.startTime && eventEndTime === rule.endTime) {
            shouldSkip = true;
            Logger.log(`Skipping non-recurring event due to recurring day rule: ${rule.dayOfWeek} ${rule.startTime}`);
            break;
          }
        }
      }

      if (!shouldSkip) {
        processedEvents.push(event);
      }
    } else {
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

        // Check against specific dates (UTC)
        for (const rule of config.specificDates) {
          const ruleStart = new Date(rule.start);
          const ruleEnd = new Date(rule.end);
          if (occurrenceStart.getTime() === ruleStart.getTime() && occurrenceEnd.getTime() === ruleEnd.getTime()) {
            Logger.log(`Excluding recurring instance at ${occurrenceStart} due to specific date rule.`);
            event.addPropertyWithValue('exdate', next.toString());
          }
        }

        // Check against recurring days (local time)
        const localDayOfWeek = days[new Date(Utilities.formatDate(occurrenceStart, scriptTz, "yyyy-MM-dd'T'HH:mm:ss")).getDay()];
        for (const rule of config.recurringDays) {
          if (rule.dayOfWeek === localDayOfWeek) {
            const occurrenceStartTime = Utilities.formatDate(occurrenceStart, scriptTz, "HH:mm:ss");
            const occurrenceEndTime = Utilities.formatDate(occurrenceEnd, scriptTz, "HH:mm:ss");

            if (occurrenceStartTime === rule.startTime && occurrenceEndTime === rule.endTime) {
              Logger.log(`Excluding recurring instance at ${occurrenceStart} due to recurring day rule.`);
              event.addPropertyWithValue('exdate', next.toString());
            }
          }
        }
      }
      processedEvents.push(event);
    }
  }

  return processedEvents;
}
