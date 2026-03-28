import { jest } from '@jest/globals';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const { getEvent, CalendarError } = await import('../../src/calendar/calendarClient.js');

function makeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CALENDAR_API_KEY = 'test-api-key';
  process.env.CALENDAR_PROVIDER = 'https://calendar.example.com';
});

afterEach(() => {
  delete process.env.CALENDAR_API_KEY;
  delete process.env.CALENDAR_PROVIDER;
});

describe('getEvent', () => {
  test('returns mapped event fields on success', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {
      id: 'evt-1',
      title: 'Team Standup',
      start: '2024-06-01T09:00:00Z',
    }));

    const result = await getEvent('evt-1');
    expect(result).toEqual({
      event_id: 'evt-1',
      event_title: 'Team Standup',
      event_start: '2024-06-01T09:00:00Z',
    });
  });

  test('fetches correct URL with Authorization header', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: 'x', title: 'y', start: 'z' }));

    await getEvent('abc-123');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://calendar.example.com/events/abc-123',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      })
    );
  });

  test('throws CalendarError if CALENDAR_API_KEY is not set', async () => {
    delete process.env.CALENDAR_API_KEY;
    await expect(getEvent('evt-1')).rejects.toThrow(CalendarError);
    await expect(getEvent('evt-1')).rejects.toThrow('CALENDAR_API_KEY is not set');
  });

  test('throws CalendarError if CALENDAR_PROVIDER is not set', async () => {
    delete process.env.CALENDAR_PROVIDER;
    await expect(getEvent('evt-1')).rejects.toThrow(CalendarError);
    await expect(getEvent('evt-1')).rejects.toThrow('CALENDAR_PROVIDER is not set');
  });

  test('throws CalendarError with status on non-OK response', async () => {
    mockFetch.mockResolvedValue(makeResponse(404, {}));
    let err;
    try { await getEvent('evt-1'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(CalendarError);
    expect(err.message).toBe('Calendar provider returned 404');
  });

  test('wraps network errors in CalendarError', async () => {
    mockFetch.mockRejectedValue(new Error('Network failure'));
    let err;
    try { await getEvent('evt-1'); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(CalendarError);
    expect(err.message).toBe('Network failure');
  });
});
