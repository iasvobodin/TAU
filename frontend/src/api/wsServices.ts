const reconnectInterval = 5000 // интервал переподключения в миллисекундах

export function connect() {
  const ws = new WebSocket('ws://localhost:3000/ws')

  ws.onmessage = (event) => {
    console.log('Сообщение от сервера:', event.data)
  }

  ws.onopen = () => {
    console.log('WebSocket соединение установлено')
    ws.send('Привет, сервер!')
  }

  ws.onerror = (error) => {
    console.error('Ошибка WebSocket:', error)
  }

  ws.onclose = () => {
    console.log('WebSocket соединение закрыто. Попытка переподключения...')
    setTimeout(connect, reconnectInterval)
  }
}
