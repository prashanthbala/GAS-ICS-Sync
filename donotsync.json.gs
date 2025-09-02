function getDoNotSyncConfig() {
  return {
    "specificDates": [
      {
        "start": "2024-12-25T00:00:00Z",
        "end": "2024-12-26T00:00:00Z"
      }
    ],
    "recurringDays": [
      {
        "dayOfWeek": "Monday",
        "startTime": "09:00:00",
        "endTime": "11:00:00"
      },
      {
        "dayOfWeek": "Friday",
        "startTime": "16:00:00",
        "endTime": "17:00:00"
      }
    ]
  };
}
