'use client'

import { useState, useCallback } from 'react'
import { scanAddress, ScanResult } from './scan'

export interface PreflightState {
  status: 'idle' | 'scanning' | 'done' | 'error'
  result: ScanResult | null
  error: string | null
}

export function usePhantomPreflight() {
  const [state, setState] = useState<PreflightState>({ status: 'idle', result: null, error: null })

  const runPreflight = useCallback(async (address: string) => {
    setState({ status: 'scanning', result: null, error: null })
    try {
      const result = await scanAddress(address)
      setState({ status: 'done', result, error: null })
      return result
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Scan failed'
      setState({ status: 'error', result: null, error })
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, error: null })
  }, [])

  return { ...state, runPreflight, reset }
}
