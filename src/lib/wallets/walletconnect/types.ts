export interface WcSession {
  topic: string
  peerName: string
  peerIcon: string
  accounts: string[]
  chainId: number
}

export interface WcAdapter {
  name: string
  icon: string
  supportedChains: string[]
  connect(): Promise<WcSession>
  disconnect(topic: string): Promise<void>
  sendRequest(topic: string, method: string, params: unknown[]): Promise<unknown>
}
