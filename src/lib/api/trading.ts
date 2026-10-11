import { isAddress } from 'ethers';
import { USDT_BSC, amountUnits, validateApproval, parseTypedOrder, type EvmTx, type SwapTx } from '../engine/order';
export { USDT_BSC, amountUnits, validateApproval, parseTypedOrder, validateTypedOrder } from '../engine/order';
export type { EvmTx, SwapTx, TypedOrder } from '../engine/order';
import { signedCall, object, textField, numberField } from './client';
export interface TradePair {inputToken:string;outputToken:string;rawInput:string}
const prefix = '/api/v1/dex/aggregator';
export interface Quote {
  quoteId: string; vendorName: string; executionMode: 'SWAP' | 'RFQ';
  fromTokenAmount: string; toTokenAmount: string; toDecimals: number;
  tradeFee: string; estimateGasFee: string; priceImpactPercent: string;
  isHoneyPot: boolean; routes: { dexName: string; percent: string }[]; approveTarget: string; isBest: boolean;
}
export async function getQuote(token: string, amount: string, wallet: string, pair?:TradePair) {
  const route=pair||{inputToken:USDT_BSC,outputToken:token,rawInput:amountUnits(amount)};
  if(!isAddress(route.inputToken)||!isAddress(route.outputToken)||!/^\d+$/.test(route.rawInput)||BigInt(route.rawInput)<=0n)throw new Error("Invalid trade token pair or input amount.");
  if (!isAddress(token) || !isAddress(wallet)) throw new Error('A valid token and connected wallet are required.');
  const { data, latency } = await signedCall('GET', `${prefix}/quote`, { binanceChainId: '56', fromTokenAddress: route.inputToken, toTokenAddress: route.outputToken, amount: route.rawInput, userWalletAddress: wallet });
  if (!Array.isArray(data)) throw new Error('Quote response must be an array.');
  const quotes: Quote[] = data.map((value) => {
    const q = object(value), output = object(q.toToken), input=object(q.fromToken);
    if(textField(output.tokenContractAddress).toLowerCase()!==route.outputToken.toLowerCase() || textField(input.tokenContractAddress).toLowerCase()!==route.inputToken.toLowerCase() || textField(q.fromTokenAmount)!==route.rawInput) throw new Error('Quote token pair or input differs from the requested purchase.');
    const safety=route.inputToken.toLowerCase()===USDT_BSC.toLowerCase()?output:input;
    if(typeof safety.isHoneyPot!=='boolean') throw new Error('Quote token safety data is missing.');
    const decimals = numberField(output.decimal); if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid output decimals.');
    if (q.executionMode !== 'SWAP' && q.executionMode !== 'RFQ') throw new Error('Unsupported quote execution mode.');
    return { quoteId: textField(q.quoteId), vendorName: textField(q.vendorName), executionMode: q.executionMode, fromTokenAmount: textField(q.fromTokenAmount), toTokenAmount: textField(q.toTokenAmount), toDecimals: decimals, tradeFee: textField(q.tradeFee, '0'), estimateGasFee: textField(q.estimateGasFee, '0'), priceImpactPercent: textField(q.priceImpactPercent), isHoneyPot: safety.isHoneyPot === true, routes: (Array.isArray(q.dexRouterList) ? q.dexRouterList : []).map(r => { const p = object(object(r).dexProtocol); return { dexName: textField(p.dexName), percent: textField(p.percent) }; }), approveTarget: textField(q.approveTarget), isBest: q.isBest === true };
  });
  return { quotes, latency };
}
export async function getApproval(amount: string, vendor: string, spender: string, pair?:TradePair): Promise<EvmTx[]> {
  const inputToken=pair?.inputToken||USDT_BSC, rawInput=pair?.rawInput||amountUnits(amount);
  const { data } = await signedCall('GET', `${prefix}/approve-transaction`, { binanceChainId: '56', tokenContractAddress: inputToken, approveAmount: rawInput, vendor });
  if (!Array.isArray(data) || !data.length) throw new Error('Approval data unavailable.');
  return data.map(value => { const d = object(value); const tx = { to: textField(d.to, inputToken), data: textField(d.data), value: textField(d.value, '0') }; validateApproval(tx, rawInput, spender,inputToken); return tx; });
}
export async function buildSwap(token: string, amount: string, wallet: string, quoteId: string, slippage = '0.5', pair?:TradePair) {
  const route=pair||{inputToken:USDT_BSC,outputToken:token,rawInput:amountUnits(amount)};
  const { data, latency } = await signedCall('GET', `${prefix}/swap`, { binanceChainId: '56', fromTokenAddress: route.inputToken, toTokenAddress: route.outputToken, amount: route.rawInput, quoteId, userWalletAddress: wallet, slippagePercent: slippage, approveTransaction: 'true' });
  const d = object(data), tx = d.tx ? object(d.tx) : {};
  if (d.executionMode !== 'RFQ' && d.executionMode !== 'SWAP') throw new Error('Unsupported execution mode.');
  const rfq = d.executionMode === 'RFQ' ? object(d.rfq) : null;
  const swap: SwapTx = { from: textField(tx.from, wallet), to: textField(tx.to), value: textField(tx.value, '0'), data: textField(tx.data), executionMode: d.executionMode, hasRFQ: !!rfq, rfq: rfq ? { vendor: textField(rfq.vendor), orderId: textField(rfq.orderId, quoteId), signingScheme: textField(rfq.signingScheme, 'EIP712'), typedData: parseTypedOrder(rfq.typedDataToSign) } : null };
  if (swap.executionMode === 'SWAP' && (!isAddress(swap.to) || !/^0x[0-9a-f]+$/i.test(swap.data))) throw new Error('Missing executable swap calldata.');
  return { swap, latency };
}
export async function simulateTransaction(from: string, to: string, value: string, calldata: string) {
  const { data, latency } = await signedCall('POST', '/api/v1/dex/pre-transaction/simulate', undefined, { binanceChainId: '56', evmTx: { from, to, value, data: calldata } });
  const d = object(data);
  return { simulation: { status: d.status === 'SUCCESS' && !d.failReason ? 'SUCCESS' as const : 'FAILED' as const, failReason: textField(d.failReason) || null, balanceChanges: (Array.isArray(d.balanceChanges) ? d.balanceChanges : []).map(v => { const b = object(v); return { address: textField(b.contractAddress), symbol: textField(b.tokenSymbol, textField(b.contractAddress)), amount: textField(b.change, '0'), direction: String(b.change).startsWith('-') ? 'out' : 'in' }; }) }, latency };
}
export async function submitOrder(requestId: string, signature: string, swap: SwapTx) {
  if (!swap.rfq) throw new Error('RFQ order required.');
  const { data } = await signedCall('POST', `${prefix}/order/submit`, undefined, { requestId, userSignature: signature, vendor: swap.rfq.vendor, quoteId: swap.rfq.orderId, signingScheme: swap.rfq.signingScheme });
  const d = object(data); if (!textField(d.orderId)) throw new Error('Missing submitted order ID.'); return { orderId: textField(d.orderId), status: textField(d.status) };
}
export async function getOrder(orderId: string) { const { data } = await signedCall('GET', `${prefix}/order/${encodeURIComponent(orderId)}`); const d = object(data); return { orderId, status: textField(d.status), txHash: textField(d.txHash) || null }; }
