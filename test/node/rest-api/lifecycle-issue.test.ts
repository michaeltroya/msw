/**
 * @vitest-environment node
 */
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer()

export const waitForRequest = <T>(method: string, url: string): Promise<T> => {
  let reqId = ''

  return new Promise<T>((resolve, reject) => {
    server.events.on('request:start', async ({ request, requestId }) => {
      const matchesMethod =
        request.method.toLowerCase() === method.toLowerCase()
      const matchesUrl = request.url === url

      if (matchesMethod && matchesUrl) {
        reqId = requestId
      }
    })
    server.events.on('request:match', async ({ request, requestId }) => {
      const actualBody = await request.clone().json()
      if (requestId === reqId) resolve(actualBody)
    })
    server.events.on('request:unhandled', ({ request, requestId }) => {
      if (requestId === reqId) {
        reject(
          new Error(
            `The ${request.method} ${request.url} request was unhandled.`,
          ),
        )
      }
    })
  })
}

beforeAll(() => {
  server.listen()
})

afterAll(() => {
  server.close()
})

test('works without parsing body', async () => {
  server.use(
    http.post('http://localhost/json', async ({ request }) => {
      return HttpResponse.json({ foo: 'bar' })
    }),
  )

  const req = waitForRequest('POST', 'http://localhost/json')

  const res = await fetch('http://localhost/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'John' }),
  })

  expect(res.status).toBe(200)

  expect(req).resolves.toEqual({ firstName: 'John' })
})

test('works parsing body and cloning', async () => {
  server.use(
    http.post('http://localhost/json', async ({ request }) => {
      const body = await request.clone().json()

      return HttpResponse.json({ foo: 'bar' })
    }),
  )

  const req = waitForRequest('POST', 'http://localhost/json')

  const res = await fetch('http://localhost/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'John' }),
  })

  expect(res.status).toBe(200)

  expect(req).resolves.toEqual({ firstName: 'John' })
})

test('does not work without cloning', async () => {
  server.use(
    http.post('http://localhost/json', async ({ request }) => {
      const body = await request.json()

      return HttpResponse.json({ foo: 'bar' })
    }),
  )

  const req = waitForRequest('POST', 'http://localhost/json')

  const res = await fetch('http://localhost/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firstName: 'John' }),
  })

  expect(res.status).toBe(200)

  expect(req).resolves.toEqual({ firstName: 'John' })
})
