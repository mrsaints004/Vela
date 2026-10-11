import { JsonRpcProvider, FetchRequest, Contract, Interface, formatUnits, isAddress } from 'ethers';
import { USDT_BSC } from '../api/trading';
export function chainProvider() { const request=new FetchRequest(process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org');request.timeout=15000; return new JsonRpcProvider(request, 56, { staticNetwork: true }); }
async function requireBsc(p:JsonRpcProvider) {if(BigInt(await p.send('eth_chainId',[]))!==56n) throw new Error('RPC endpoint is not BSC mainnet.');}
export async function verifyBroadcast(hash:string,wallet:string,tx:{to:string;data:string;value:string}) {
  if(!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Invalid transaction hash.');
  const p=chainProvider();await requireBsc(p);const actual=await p.getTransaction(hash);
  if(!actual || actual.chainId!==56n || actual.from.toLowerCase()!==wallet.toLowerCase() || actual.to?.toLowerCase()!==tx.to.toLowerCase() || actual.data.toLowerCase()!==tx.data.toLowerCase() || actual.value!==BigInt(tx.value)) throw new Error('Broadcast transaction does not match the reviewed wallet, chain and swap calldata.');
}
export async function walletFunds(wallet: string, stockToken?:string) {
  if (!isAddress(wallet)) throw new Error('Connect a valid BSC wallet.');
  const p = chainProvider();await requireBsc(p);
  const token = new Contract(USDT_BSC, ['function balanceOf(address) view returns(uint256)'], p);
  const [usdt, native] = await Promise.all([token.balanceOf(wallet) as Promise<bigint>, p.getBalance(wallet)]);
  let stock:string|undefined,stockDecimals:number|undefined;
  if(stockToken){if(!isAddress(stockToken))throw new Error('Invalid stock token.');const asset=new Contract(stockToken,['function balanceOf(address) view returns(uint256)','function decimals() view returns(uint8)'],p);const [balance,decimals]=await Promise.all([asset.balanceOf(wallet),asset.decimals()]);stock=balance.toString();stockDecimals=Number(decimals);}
  return { usdt: usdt.toString(), native: native.toString(),stock,stockDecimals };
}
const erc20 = new Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);
export async function verifySettlement(hash: string, wallet: string, token: string, inputLimit: string, minOutput: string, decimals: number, since=0, expectedTx?:{to:string;data:string;value:string}, action:'buy'|'sell'='buy',inputDecimals=18) {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new Error('Valid settlement transaction hash required.');
  if(expectedTx) await verifyBroadcast(hash,wallet,expectedTx);
  const p = chainProvider();await requireBsc(p);const receipt = await p.getTransactionReceipt(hash);
  if (!receipt) throw new Error('Settlement is not yet confirmed successfully on BSC.');
  if(receipt.status!==1) throw new Error('Settlement reverted on BSC.');
  let output = 0n, input = 0n;
  for (const log of receipt.logs) {
    if (![token.toLowerCase(), USDT_BSC.toLowerCase()].includes(log.address.toLowerCase())) continue;
    try {
      const parsed = erc20.parseLog({ data: log.data, topics: [...log.topics] }); if (!parsed) continue;
      const from = String(parsed.args[0]).toLowerCase(), to = String(parsed.args[1]).toLowerCase(), amount = BigInt(parsed.args[2]);
      if (log.address.toLowerCase() === token.toLowerCase()) { if (to === wallet.toLowerCase()) output += amount; if (from === wallet.toLowerCase()) output -= amount; }
      else { if (from === wallet.toLowerCase()) input += amount; if (to === wallet.toLowerCase()) input -= amount; }
    } catch { /* Other events are irrelevant. */ }
  }
  if(action==='sell'){const stockIn=output;output=-input;input=-stockIn;}
  if (input <= 0n || input > BigInt(inputLimit) || output < BigInt(minOutput) || output <= 0n) throw new Error('Settlement transfers do not match your reviewed token, recipient, spend or minimum output.');
  const block = await p.getBlock(receipt.blockNumber); if (!block) throw new Error('Settlement block unavailable.');
  if(block.timestamp*1000 < since-1000) throw new Error('Settlement predates this execution preview.');
  return { txHash: hash, status: 'confirmed' as const, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed.toString(), timestamp: block.timestamp * 1000, actualOutput: formatUnits(output, decimals), actualInput: formatUnits(input, inputDecimals), actualOutputRaw: output.toString(), chainId: 56 as const };
}
