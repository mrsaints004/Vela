'use client';
import {useEffect} from 'react';
import {useAgenticWalletStore} from '@/lib/stores/agentic-wallet';
import {NumberDisplay} from '@/components/shared/NumberDisplay';
import {ExternalLink,Wallet} from 'lucide-react';
export function AgenticWalletPanel(){
  const {status,pairing,busy,error,refresh,signIn,pollPairing,signOut}=useAgenticWalletStore();
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{if(pairing?.status!=='waiting')return;const timer=setInterval(()=>void pollPairing(),3000);return()=>clearInterval(timer);},[pairing?.status,pollPairing]);
  return <section className="border border-border bg-surface-1 rounded-xl p-4 space-y-3">
    <div className="flex items-center gap-2"><Wallet aria-hidden className="w-4 h-4 text-accent"/><h2 className="text-sm font-medium">Binance Agentic Wallet</h2></div>
    <p className="text-xs text-text-secondary">Connect your Binance MPC wallet once. Vela requests signing under your Binance App permissions; your browser wallet is a separate account.</p>
    <p className="text-xs text-text-secondary" role="status">{busy?'Reading Binance wallet…':status?.connected?'Connected on BSC mainnet':status?.status==='CREATING'?'Binance is creating your wallet. Refresh when ready.':'Not connected'}</p>
    {status?.address&&<div className="space-y-1"><p className="text-xs text-text-secondary">Agentic Wallet BSC address</p><code className="block text-xs break-all text-text-primary">{status.address}</code></div>}
    {status?.settings&&<dl className="text-xs space-y-2">
      <div className="flex justify-between gap-2"><dt>Wallet daily quota left</dt><dd><NumberDisplay value={status.settings.quotaLeft} format="currency"/></dd></div>
      <div className="flex justify-between gap-2"><dt>Developer Mode quota left</dt><dd><NumberDisplay value={status.settings.devMode.dailyLimit-status.settings.developerModeQuotaUsed} format="currency"/></dd></div>
      <div className="flex justify-between gap-2"><dt>Developer Mode</dt><dd>{status.settings.devMode.enabled?'Enabled':'Disabled — enable in Binance App'}</dd></div>
      <div className="flex justify-between gap-2"><dt>Wallet lock</dt><dd>{status.lock||'Unavailable'}</dd></div>
      <div><dt className="text-text-secondary">Session expires</dt><dd>{status.settings.sessionExpireTime?new Date(status.settings.sessionExpireTime).toLocaleString():'Unavailable'}</dd></div>
    </dl>}
    {pairing?.status==='waiting'&&<div className="border border-accent/30 rounded-lg p-3 space-y-2">
      <p className="text-xs text-text-secondary">Check this exact pairing code in Binance App before confirming sign-in:</p>
      <p className="font-mono tabular-nums text-lg tracking-widest">{pairing.pairingCode}</p>
      <a href={pairing.urlForWeb} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 min-h-11 text-accent text-sm">Open Binance sign-in / QR code <ExternalLink aria-hidden className="w-3 h-3"/></a>
      <p className="text-xs text-text-secondary">Waiting for confirmation. Keep Vela running. Code expires {new Date(pairing.expiresAt).toLocaleTimeString()}.</p>
    </div>}
    {error&&<p role="alert" className="text-xs text-loss break-words">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button onClick={()=>void refresh()} disabled={busy} className="border border-border rounded-lg px-3 min-h-11 text-xs disabled:opacity-40">Refresh wallet status</button>
      {!status?.connected?<button onClick={()=>void signIn()} disabled={busy||pairing?.status==='waiting'} className="border border-accent/30 text-accent rounded-lg px-3 min-h-11 text-xs disabled:opacity-40">Sign in with Binance</button>:<button onClick={()=>void signOut()} disabled={busy} className="border border-border rounded-lg px-3 min-h-11 text-xs disabled:opacity-40">Sign out</button>}
    </div>
    <details className="text-xs text-text-secondary"><summary className="cursor-pointer min-h-11 flex items-center">First-time setup & permissions</summary><div className="space-y-2 pt-2">
      <p>Run <code>npm run agentic:install</code> in this project, then refresh. Sign in with your Binance App and fund the displayed Agentic Wallet address with BSC USDT and BNB.</p>
      <p>In Binance App, enable Developer Mode with a small daily limit. Vela reads your settings and cannot change them. Signing may require an additional App confirmation. Each Vela signing preview needs your explicit confirmation.</p>
      <p>This local bridge serves one wallet session on your computer. It is disabled on public hosts. It does not run an unattended strategy or an Agent Studio runtime.</p>
      <a href="https://developers.binance.com/en/docs/products/agentic-wallet/quickstart/install-agentic-wallet" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-accent">Official Binance onboarding instructions</a>
    </div></details>
  </section>;
}
