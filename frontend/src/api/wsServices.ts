import { io } from 'socket.io-client'

export const connect = async () => {
  const socket = io('ws://10.69.19.59:3000', {
    extraHeaders: {
      'x-api-key': 'your-secret-api-key-12345'
    }
  })

  socket.on('connect', () => {
    console.log('WebSocket соединение установлено')
    socket.send('Привет, сервер!')
  })

  socket.on('message', (data) => {
    // localServerPID.value = data.split(':')[1];
    console.log('Сообщение от сервера:', data)
  })

  socket.on('disconnect', async () => {
    // await startServerProcess();
    console.log('WebSocket соединение закрыто. Попытка переподключения...')
    setTimeout(connect, 5000)
  })

  socket.on('connect_error', (error) => {
    console.error('Ошибка WebSocket:', error)
  })
}
