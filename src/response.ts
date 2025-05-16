/* eslint-disable @typescript-eslint/no-explicit-any */
// Define lightweight pseudo Response class and replace global.Response with it.

import type { OutgoingHttpHeaders } from 'node:http'
import { getResponseState } from './utils/internal'
import type { InternalBody } from './utils/internal'

const responseCache = Symbol('responseCache')
const getResponseCache = Symbol('getResponseCache')
export const cacheKey = Symbol('cache')

export type InternalCache = [
  number,
  string | ReadableStream,
  Record<string, string> | Headers | OutgoingHttpHeaders,
]
interface LiteResponse {
  [responseCache]?: globalThis.Response
  [cacheKey]?: InternalCache
}

export const GlobalResponse = global.Response
export class Response {
  #body?: BodyInit | null
  #init?: ResponseInit;

  [getResponseCache](): globalThis.Response {
    delete (this as LiteResponse)[cacheKey]
    return ((this as LiteResponse)[responseCache] ||= new GlobalResponse(this.#body, this.#init))
  }

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this.#body = body
    if (init instanceof Response) {
      const cachedGlobalResponse = (init as any)[responseCache]
      if (cachedGlobalResponse) {
        this.#init = cachedGlobalResponse
        // instantiate GlobalResponse cache and this object always returns value from global.Response
        this[getResponseCache]()
        return
      } else {
        this.#init = init.#init
      }
    } else {
      this.#init = init
    }

    if (typeof body === 'string' || typeof (body as ReadableStream)?.getReader !== 'undefined') {
      const headers = (init?.headers || { 'content-type': 'text/plain; charset=UTF-8' }) as
        | Record<string, string>
        | Headers
        | OutgoingHttpHeaders
      ;(this as any)[cacheKey] = [init?.status || 200, body, headers]
    }
  }

  get headers(): Headers {
    const cache = (this as LiteResponse)[cacheKey] as InternalCache
    if (cache) {
      if (!(cache[2] instanceof Headers)) {
        cache[2] = new Headers(cache[2] as HeadersInit)
      }
      return cache[2]
    }
    return this[getResponseCache]().headers
  }
}
;[
  'body',
  'bodyUsed',
  'ok',
  'redirected',
  'status',
  'statusText',
  'trailers',
  'type',
  'url',
].forEach((k) => {
  Object.defineProperty(Response.prototype, k, {
    get() {
      return this[getResponseCache]()[k]
    },
  })
})
;['arrayBuffer', 'blob', 'clone', 'formData', 'json', 'text'].forEach((k) => {
  Object.defineProperty(Response.prototype, k, {
    value: function () {
      return this[getResponseCache]()[k]()
    },
  })
})
Object.setPrototypeOf(Response, GlobalResponse)
Object.setPrototypeOf(Response.prototype, GlobalResponse.prototype)

export function getInternalBody(
  response: Response | globalThis.Response
): InternalBody | undefined {
  if (response instanceof Response) {
    response = (response as any)[getResponseCache]()
  }

  return getResponseState(response as globalThis.Response)?.body
}
