export function phantomDeeplink(address: string): string {
  return `https://phantom.app/ul/browse/${encodeURIComponent(address)}`
}

export function phantomMobileConnect(appUrl: string, redirectLink: string): string {
  const params = new URLSearchParams({
    app_url: appUrl,
    redirect_link: redirectLink,
  })
  return `https://phantom.app/ul/v1/connect?${params.toString()}`
}

export function phantomMobileSignTransaction(transaction: string, redirectLink: string): string {
  const params = new URLSearchParams({
    transaction,
    redirect_link: redirectLink,
  })
  return `https://phantom.app/ul/v1/signTransaction?${params.toString()}`
}
