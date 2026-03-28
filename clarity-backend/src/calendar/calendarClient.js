export class CalendarError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CalendarError';
  }
}

export async function getEvent(eventId) {
  const apiKey = process.env.CALENDAR_API_KEY;
  if (!apiKey) {
    throw new CalendarError('CALENDAR_API_KEY is not set');
  }

  const provider = process.env.CALENDAR_PROVIDER;
  if (!provider) {
    throw new CalendarError('CALENDAR_PROVIDER is not set');
  }

  let response;
  try {
    response = await fetch(`${provider}/events/${eventId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
  } catch (err) {
    throw new CalendarError(err.message);
  }

  if (!response.ok) {
    throw new CalendarError(`Calendar provider returned ${response.status}`);
  }

  const data = await response.json();
  return {
    event_id: data.id,
    event_title: data.title,
    event_start: data.start,
  };
}
