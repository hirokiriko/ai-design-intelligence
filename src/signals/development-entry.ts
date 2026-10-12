export function isSignalsDevelopmentView(development: boolean, hostname: string, search: string): boolean {
  return development
    && ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
    && new URLSearchParams(search).get('signalsDemo') === 'fictional';
}

export function isSignalsApprovedPreview(development: boolean, hostname: string, search: string): boolean {
  return development
    && ['localhost', '127.0.0.1', '[::1]'].includes(hostname)
    && new URLSearchParams(search).get('signalsDemo') === 'approved';
}
