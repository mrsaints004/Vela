function object(value: unknown): Record<string,unknown> { if(!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Malformed order object.'); return value as Record<string,unknown>; }
import { parseUnits, isAddress, Interface, TypedDataEncoder, type TypedDataDomain, type TypedDataField } from 'ethers';
export const USDT_BSC = '0x55d398326f99059fF775485246999027B3197955';
export function amountUnits(amount: string): string {
  if (!/^\d+(\.\d{1,18})?$/.test(amount)) throw new Error('Enter a positive dollar amount with at most 18 decimals.');
  const units = parseUnits(amount, 18); if (units <= 0n) throw new Error('Amount must be greater than zero.'); return units.toString();
}

export interface EvmTx { from?: string; to: string; value: string; data: string }
export interface TypedOrder { domain: TypedDataDomain; types: Record<string, TypedDataField[]>; message: Record<string, unknown> }
export interface SwapTx extends EvmTx { executionMode: 'SWAP' | 'RFQ'; hasRFQ: boolean; rfq: { vendor: string; orderId: string; signingScheme: string; typedData: TypedOrder } | null }
const approveAbi = new Interface(['function approve(address spender,uint256 amount)']);
export function validateApproval(tx: EvmTx, amount: string, spender: string, inputToken=USDT_BSC) {
  if (tx.to.toLowerCase() !== inputToken.toLowerCase() || BigInt(tx.value || '0') !== 0n) throw new Error('Invalid approval target or native value.');
  const decoded = approveAbi.parseTransaction({ data: tx.data });
  if (!decoded || decoded.name !== 'approve' || String(decoded.args[0]).toLowerCase() !== spender.toLowerCase() || decoded.args[1] !== BigInt(amount)) throw new Error('Approval does not match the exact quoted spender and amount.');
}

export function parseTypedOrder(raw: unknown): TypedOrder {
  const data = object(typeof raw === 'string' ? JSON.parse(raw) : raw);
  const domain = object(data.domain), message = object(data.message), types = object(data.types);
  if (Number(domain.chainId) !== 56 || !isAddress(String(domain.verifyingContract))) throw new Error('RFQ signing domain must be a verified BSC contract.');
  const cleanTypes: Record<string, TypedDataField[]> = {};
  for (const [key, fields] of Object.entries(types)) {
    if (key === 'EIP712Domain') continue;
    if (!Array.isArray(fields)) throw new Error('Malformed typed-data fields.');
    cleanTypes[key] = fields.map(f => { const field = object(f); if (typeof field.name !== 'string' || typeof field.type !== 'string') throw new Error('Malformed typed-data field.'); return { name: field.name, type: field.type }; });
  }
  const result = { domain: domain as TypedDataDomain, types: cleanTypes, message };
  TypedDataEncoder.hash(result.domain, result.types, result.message);
  return result;
}
export function validateTypedOrder(order: TypedOrder, wallet: string, token: string, amount: string, expectedOutput: string, maxSlippage: number, pair?: {inputToken:string;outputToken:string;rawInput:string}): void {
  // Accept known field aliases only; unknown vendor structures fail closed.
  if(Number(order.domain.chainId)!==56 || !isAddress(String(order.domain.verifyingContract))) throw new Error('RFQ signing domain is not BSC.');
  if(!Number.isFinite(maxSlippage)||maxSlippage<=0||maxSlippage>20) throw new Error('Invalid slippage limit.');
  const m = order.message;
  const field = (keys: string[]) => keys.map(k => m[k]).find(v => v !== undefined);
  const sell = field(['sellToken', 'makerAsset', 'fromToken', 'tokenIn']);
  const buy = field(['buyToken', 'takerAsset', 'toToken', 'tokenOut']);
  const owner = field(['maker', 'sender', 'owner', 'from']);
  const receiver = field(['receiver', 'recipient', 'to']);
  const input = field(['sellAmount', 'makingAmount', 'amountIn', 'fromAmount']);
  const output = field(['buyAmount', 'takingAmount', 'amountOut', 'toAmount', 'minAmountOut']);
  const deadline = field(['validTo', 'deadline', 'expiry', 'expiration']);
  if (String(sell).toLowerCase() !== (pair?.inputToken||USDT_BSC).toLowerCase() || String(buy).toLowerCase() !== (pair?.outputToken||token).toLowerCase() || String(owner ?? receiver).toLowerCase() !== wallet.toLowerCase()) throw new Error('Cannot verify RFQ token pair and wallet. This vendor order format is unsupported.');
  if (receiver !== undefined && String(receiver).toLowerCase() !== wallet.toLowerCase() && !/^0x0{40}$/i.test(String(receiver))) throw new Error('RFQ recipient differs from your wallet.');
  if (!/^\d+$/.test(String(input)) || BigInt(String(input)) !== BigInt(pair?.rawInput||amountUnits(amount))) throw new Error('RFQ input differs from the reviewed amount.');
  const min = BigInt(expectedOutput) * BigInt(Math.floor((100 - maxSlippage) * 10000)) / 1000000n;
  if (!/^\d+$/.test(String(output)) || BigInt(String(output)) < min) throw new Error('RFQ output is below your slippage limit.');
  if (deadline === undefined || !Number.isFinite(Number(deadline)) || Number(deadline) * 1000 <= Date.now()) throw new Error('RFQ deadline is missing or expired.');
}
