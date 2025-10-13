import { WebSocketServer as WSServer, WebSocket } from 'ws'
import { logger } from '../utils/logger'

export class WebSocketServer {
  private wss: WSServer
  private clients: Set<WebSocket> = new Set()

  constructor(port: number) {
    this.wss = new WSServer({ port })

    this.wss.on('connection', (ws: WebSocket) => {
      logger.info('MT4/MT5 EA connected via WebSocket')
      this.clients.add(ws)

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString())
          this.handleMessage(ws, data)
        } catch (error) {
          logger.error('WebSocket message parse error:', error)
        }
      })

      ws.on('close', () => {
        logger.info('MT4/MT5 EA disconnected')
        this.clients.delete(ws)
      })

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error)
        this.clients.delete(ws)
      })

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: 'connected',
          message: 'Connected to Telegram Signal Copier',
          timestamp: new Date().toISOString(),
        })
      )
    })

    logger.info(`WebSocket server started on port ${port}`)
  }

  private handleMessage(ws: WebSocket, data: any) {
    logger.debug('Received message from EA:', data)

    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }))
        break

      case 'tradeExecuted':
        logger.info(`Trade executed: ${data.symbol} ${data.direction} ${data.lots} lots`)
        // Here you could update the database with trade execution details
        break

      case 'tradeClosed':
        logger.info(`Trade closed: ${data.symbol} Profit: ${data.profit}`)
        // Update database with trade closure
        break

      case 'error':
        logger.error(`EA error: ${data.message}`)
        break

      default:
        logger.warn('Unknown message type from EA:', data.type)
    }
  }

  broadcast(signal: any) {
    const message = JSON.stringify({
      type: 'newSignal',
      signal,
      timestamp: new Date().toISOString(),
    })

    let sentCount = 0
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
        sentCount++
      }
    })

    if (sentCount > 0) {
      logger.info(`Signal broadcasted to ${sentCount} MT4/MT5 EA(s)`)
    } else {
      logger.warn('No MT4/MT5 EAs connected to receive signal')
    }
  }

  close() {
    this.clients.forEach((client) => {
      client.close()
    })
    this.wss.close()
    logger.info('WebSocket server closed')
  }

  getConnectedClients(): number {
    return this.clients.size
  }
}
