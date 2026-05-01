import { describe, it, expect } from 'vitest'
import { phantomDeeplink, phantomMobileConnect, phantomMobileSignTransaction } from '../deeplink'

describe('phantomDeeplink', () => {
  it('generates correct browse deeplink', () => {
    const url = phantomDeeplink('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
    expect(url).toContain('phantom.app/ul/browse/')
    expect(url).toContain('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM')
  })

  it('generates mobile connect deeplink', () => {
    const url = phantomMobileConnect('https://interligens.com', 'https://interligens.com/callback')
    expect(url).toContain('phantom.app/ul/v1/connect')
    expect(url).toContain('app_url')
    expect(url).toContain('redirect_link')
  })

  it('generates sign transaction deeplink', () => {
    const url = phantomMobileSignTransaction('base64tx==', 'https://interligens.com/callback')
    expect(url).toContain('phantom.app/ul/v1/signTransaction')
  })

  it('encodes special characters in address', () => {
    const url = phantomDeeplink('addr with spaces')
    expect(url).not.toContain(' ')
  })

  it('connect deeplink includes both params', () => {
    const appUrl = 'https://interligens.com'
    const redirect = 'https://interligens.com/done'
    const url = phantomMobileConnect(appUrl, redirect)
    const params = new URL(url).searchParams
    expect(params.get('app_url')).toBe(appUrl)
    expect(params.get('redirect_link')).toBe(redirect)
  })
})
