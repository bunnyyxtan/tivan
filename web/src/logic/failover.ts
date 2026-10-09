/**
 * Transactions pin to one endpoint, because a send and its receipt must go to the same node: poll endpoint B for a
 * transaction sent through endpoint A and B may not have seen it yet, and nonces disagree the same way. Reads can
 * spread over every endpoint (see limitedFetch); writes cannot.
 *
 * Pinning to rpcs[0] forever is what this fixes. When the pinned endpoint stops answering at the transport level —
 * throttled, timed out, connection refused — every later call moves to the next endpoint together, so they still
 * agree with each other. A contract revert is a real answer and comes back HTTP 200, so it never moves the pin.
 */
export function failoverFetch(urls: string[], impl: typeof fetch = fetch) {
  if (!urls.length) throw new Error('failoverFetch: no endpoints')
  let pinned = 0
  const send = async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    let last: unknown = new Error('no endpoint answered')
    for (let i = 0; i < urls.length; i++) {
      const at = (pinned + i) % urls.length
      try {
        const res = await impl(urls[at], init)
        // 429 and 5xx mean this node will not serve us; anything else (200, or a 4xx the node chose) is its answer.
        if (res.status === 429 || res.status >= 500) {
          last = new Error(`HTTP ${res.status} from ${urls[at]}`)
          continue
        }
        pinned = at // stay here until it fails, so the next call in this transaction sees the same node
        return res
      } catch (e) {
        last = e
      }
    }
    throw last
  }
  return Object.assign(send, { pinnedUrl: () => urls[pinned] })
}
