/**
 * Unified configuration for all event filtering.
 * Each rule in the 'rules' array is an object that defines a condition for excluding an event.
 * If an event matches any rule, it will be excluded from the sync.
 */
function getFilterConfig() {
  return {
    "rules": [
      // Example 1: Replicates old `filters.gs` functionality.
      // Excludes events where the summary contains the word "cancelled" (case-insensitive).
      {
        "property": "summary",
        "operator": "contains",
        "value": "cancelled"
      },

      // Example 2: Replicates old `filters.gs` regex functionality.
      // Excludes events where the summary starts with "Pending:".
      {
        "property": "summary",
        "operator": "regex",
        "value": "^Pending:"
      },

      // Example 3: Replicates old `filters.gs` category functionality.
      // Excludes events with the category "Personal".
      {
        "property": "categories",
        "operator": "contains",
        "value": "Personal"
      },

      // Example 4: Replicates and enhances old `filters.gs` date functionality.
      // Excludes events that start more than 30 days from now.
      {
          "property": "dtstart",
          "operator": ">",
          "value": "30d" // Using a simple duration format (d=days, h=hours, m=minutes)
      },

      // Example 5: Replicates the new "do not sync" for a specific date.
      // Excludes an all-day event on Christmas Day 2024.
      {
        "property": "datetime",
        "operator": "exactMatch",
        "value": {
          "start": "2024-12-25T00:00:00Z",
          "end": "2024-12-26T00:00:00Z"
        }
      },

      // Example 6: Replicates the new "do not sync" for a recurring day/time.
      // Excludes a recurring focus block every Monday from 9am to 11am in the script's local timezone.
      {
        "property": "schedule",
        "operator": "matches",
        "value": {
          "dayOfWeek": "Monday",
          "startTime": "09:00:00",
          "endTime": "11:00:00"
        }
      }
    ]
  };
}
