import {
  CLIENT_ERRORS_URL,
  clientErrorReport,
  MAX_REPORTS_PER_PAGE,
  resetReportedErrors,
  scrub,
  sendClientError,
  setSessionStatusSource,
} from 'utils/reportError'

const fetchMock = vi.fn(() => Promise.resolve(new Response(null)))

beforeEach(() => {
  resetReportedErrors()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const sentBodies = () =>
  fetchMock.mock.calls.map(
    call =>
      JSON.parse(
        (call as unknown as [string, RequestInit])[1].body as string
      ) as Record<string, unknown>
  )

describe('the report (backend specs/0020 RF-9)', () => {
  test('carries the error, the context and the app state, never the uid', () => {
    setSessionStatusSource(() => 'ready')
    const error = Object.assign(new Error('deadline'), {
      code: 'deadline-exceeded',
    })

    const report = clientErrorReport(error, {
      operation: 'readAccount',
      tankId: 't1',
      attempts: 2,
    })

    expect(report).toMatchObject({
      operation: 'readAccount',
      name: 'Error',
      code: 'deadline-exceeded',
      message: 'deadline',
      context: { tankId: 't1', attempts: 2 },
      path: '/',
      online: true,
      sessionStatus: 'ready',
      standalone: false,
    })
    expect(JSON.stringify(report)).not.toContain('uid')
  })

  test('removes emails and phone numbers', () => {
    expect(scrub('ana@example.com no entró con +505 8888-1234')).toBe(
      '[correo] no entró con [teléfono]'
    )
    const report = clientErrorReport(new Error('user ana@example.com'), {
      operation: 'signIn',
      phone: '+50588881234',
    })
    expect(report.message).toBe('user [correo]')
    expect(report.context).toEqual({ phone: '[teléfono]' })
  })

  test('keeps 10 lines of the stack and only plain context values', () => {
    const error = new Error('boom')
    error.stack = Array.from(
      { length: 30 },
      (_, line) => `at f${String(line)}`
    ).join('\n')

    const report = clientErrorReport(error, {
      operation: 'saveTank',
      tank: { id: 't1' },
      list: [1, 2],
      shape: 'cylinder',
    })

    expect(report.stack?.split('\n')).toHaveLength(10)
    expect(report.context).toEqual({ shape: 'cylinder' })
  })
})

describe('sending (RF-8, RF-10, RF-11)', () => {
  test('posts to the function with keepalive', () => {
    sendClientError(new Error('x'), { operation: 'readFleet' })

    expect(fetchMock).toHaveBeenCalledWith(
      CLIENT_ERRORS_URL,
      expect.objectContaining({ method: 'POST', keepalive: true })
    )
    expect(sentBodies()[0]).toMatchObject({
      operation: 'readFleet',
      message: 'x',
    })
  })

  test('the same error goes once, and at most 20 per page', () => {
    sendClientError(new Error('same'), { operation: 'readFleet' })
    sendClientError(new Error('same'), { operation: 'readFleet' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    for (let index = 0; index < 30; index += 1) {
      sendClientError(new Error(`error ${String(index)}`), {
        operation: 'readFleet',
      })
    }
    expect(fetchMock).toHaveBeenCalledTimes(MAX_REPORTS_PER_PAGE)
  })

  test('a failed send is ignored in silence', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'))
    vi.stubGlobal('fetch', () => {
      throw new Error('no fetch')
    })

    expect(() => {
      sendClientError(new Error('x'), { operation: 'readFleet' })
    }).not.toThrow()
    vi.stubGlobal('fetch', fetchMock)
    sendClientError(new Error('y'), { operation: 'readFleet' })
    await new Promise(resolve => setTimeout(resolve, 0))
  })
})
