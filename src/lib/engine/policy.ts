import type { PolicyResult, PolicyCheckWithThreshold, PolicyEvaluation, ExecutionPolicy, MarketStatus, EffectiveCost, TokenRepresentation, SimulationSnapshot, QuoteSnapshot } from '../types';
import { createPolicyFromPreset, validatePolicy } from './policy-compiler';
import { MIN_PURCHASE_USD } from './intent';
export function evaluatePolicyV2(opts: { policy: ExecutionPolicy; marketStatus: MarketStatus; costs: EffectiveCost[]; representations: TokenRepresentation[]; selectedProvider: string; amount: number; simulation?: SimulationSnapshot | null; quote?: QuoteSnapshot | null; referencePrice?: number | null; currentPortfolioValue?: number; currentAssetExposure?: number; dailyExecutedTotal?: number; discoveryOnly?: boolean }): PolicyEvaluation {
  const { policy, marketStatus, representations, selectedProvider, amount, simulation, quote, referencePrice } = opts;
  const checks: PolicyCheckWithThreshold[] = [];
  const add = (name: string, pass: boolean, message: string, threshold: string, actual: string) => checks.push({ name, status: pass ? 'pass' : 'fail', message, threshold, actual });
  const errors = validatePolicy(policy);
  add('Policy validity', errors.length === 0 && (!policy.expiresAt || Date.parse(policy.expiresAt) > Date.now()), errors.length ? errors.join('; ') : 'Policy must be valid and unexpired.', 'Valid policy', errors.length ? 'Invalid' : 'Valid');
  const selected = representations.find(r => r.provider === selectedProvider);
  add('Selected asset', !!selected, selected ? 'Known BSC stock representation.' : 'Selected representation is missing.', 'Known representation', selectedProvider);
  add('Allowed asset', !!selected && (!policy.allowedAssets.length || policy.allowedAssets.includes(selected.token.ticker.toUpperCase())), 'Ticker must be permitted by your policy.', policy.allowedAssets.join(', ') || 'Any supported stock', selected?.token.ticker || 'Missing');
  add('Market hours', !policy.blockAfterHours || marketStatus.isOpen, policy.blockAfterHours && !marketStatus.isOpen ? 'Your policy blocks all trading while the reference market is closed.' : 'Market-hours preference satisfied.', policy.blockAfterHours ? 'Market open' : 'Any hours', marketStatus.status);
  add('Trade size', Number.isFinite(amount) && amount >= MIN_PURCHASE_USD && amount <= Math.min(policy.maxTradeSize,25000), 'Requested amount must be at least $5 and within your limit. Vendor minimums may be higher.', `$5–$${Math.min(policy.maxTradeSize,25000)}`, `$${amount}`);
  if (!opts.discoveryOnly) {
    const fresh = !!quote && Date.now() - quote.timestamp < 25000 && quote.timestamp <= Date.now();
    add('Executable quote', fresh && quote!.toAmount > 0, fresh ? 'Fresh wallet-specific quote.' : 'Quote missing or expired. Refresh the preview.', 'Less than 25 seconds old', quote ? `${Math.max(0,(Date.now()-quote.timestamp)/1000).toFixed(0)}s` : 'Missing');
    add('Reference price', Number.isFinite(referencePrice) && Number(referencePrice) > 0, 'A supported underlying reference is required; a closed-market reference is not current fair value.', 'Available reference', referencePrice ? `$${referencePrice}` : 'Unavailable');
    const deviation = quote && referencePrice ? Math.abs((quote.expectedPrice/referencePrice-1)*100) : Infinity;
    add('Reference deviation', deviation <= policy.maxDeviation, `${Number.isFinite(deviation) ? deviation.toFixed(2) : 'Unknown'}% deviation from ${marketStatus.referenceStale ? 'last available' : 'underlying'} reference.`, `≤ ${policy.maxDeviation}%`, Number.isFinite(deviation) ? `${deviation.toFixed(2)}%` : 'Unavailable');
    const impact = quote ? Math.abs(quote.priceImpact) : Infinity;
    add('Quoted price impact', Number.isFinite(impact) && impact <= policy.maxSlippage, Number.isFinite(impact) ? `${impact.toFixed(2)}% impact against your ${policy.maxSlippage}% maximum. Execution slippage is capped separately at the same configured limit.` : 'No executable impact data; candle-volume estimates cannot authorize a trade.', `≤ ${policy.maxSlippage}%`, Number.isFinite(impact) ? `${impact.toFixed(2)}%` : 'Unavailable');
    add('Preflight', !!simulation && simulation.status === 'SUCCESS', simulation?.failReason || (simulation?.scope === 'rfq-order' ? 'RFQ order fields and wallet funds checked. Relayer settlement cannot be simulated as unsigned EVM calldata.' : 'Exact swap transaction must pass simulation.'), 'Successful preflight', simulation?.status || 'Missing');
    add('Token safety', !!quote && !quote.isHoneyPot, 'Upstream token safety flag must not indicate a honeypot.', 'Not flagged', quote ? (quote.isHoneyPot ? 'Flagged' : 'Not flagged') : 'Unknown');
  }
  const blocked = checks.some(c => c.status === 'fail');
  return { action: blocked ? 'block' : 'allow', canExecuteAutonomously: false, policySnapshot: policy, checks, reasoning: blocked ? `Blocked: ${checks.filter(c => c.status==='fail').map(c=>c.name).join(', ')}. Refresh or review the constraints; no trade was sent.` : opts.discoveryOnly ? 'Discovery only. Connect your wallet and get an executable preview before trading.' : 'Preflight passed. Review and approve in your wallet. Vela does not enforce browser-wallet daily or concentration limits. Agentic Wallet additionally checks Binance quotas when selected.' };
}
export function evaluatePolicy(opts: Parameters<typeof evaluatePolicyV2>[0]): PolicyResult { return evaluatePolicyV2({ ...opts, policy: opts.policy || createPolicyFromPreset('moderate') }); }
