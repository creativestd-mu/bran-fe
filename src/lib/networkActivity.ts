type Listener = (activeRequests: number) => void

let activeRequests = 0
const listeners = new Set<Listener>()

function notify() {
  for (const listener of listeners) {
    listener(activeRequests)
  }
}

export function trackRequestStart() {
  activeRequests += 1
  notify()
}

export function trackRequestEnd() {
  activeRequests = Math.max(0, activeRequests - 1)
  notify()
}

export function getActiveRequestsCount() {
  return activeRequests
}

export function subscribeToNetworkActivity(listener: Listener) {
  listeners.add(listener)
  listener(activeRequests)
  return () => {
    listeners.delete(listener)
  }
}
