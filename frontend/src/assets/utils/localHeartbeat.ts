// multiHeartbeatManager.ts
type HeartbeatEntry = {
  interval: ReturnType<typeof setInterval>
}

const heartbeats = new Map<string, HeartbeatEntry>()

export function startHeartbeat(clientId: string, task: () => void) {
  if (heartbeats.has(clientId)) return

  console.log(`🟢 Запускаем heartbeat для ${clientId}`)

  const interval = setInterval(() => {
    try {
      task()
      console.log(`💓 heartbeat от ${clientId}`)
    } catch (e) {
      console.error(`❌ Ошибка в heartbeat для ${clientId}`, e)
    }
  }, 10000)

  heartbeats.set(clientId, { interval })
}

export function stopHeartbeat(clientId: string) {
  const entry = heartbeats.get(clientId)
  if (entry) {
    clearInterval(entry.interval)
    console.log(`🛑 Остановлен heartbeat для ${clientId}`)
    heartbeats.delete(clientId)
  }
}

export function stopAllHeartbeats() {
  for (const [clientId, entry] of heartbeats.entries()) {
    clearInterval(entry.interval)
    console.log(`🛑 Остановлен heartbeat для ${clientId}`)
  }
  heartbeats.clear()
}

export function getActiveHeartbeats(): string[] {
  return [...heartbeats.keys()]
}
