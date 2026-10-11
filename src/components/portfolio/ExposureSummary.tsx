"use client";
interface Position {ticker:string;provider:string;balance:number;balanceUsd:number|null;}
export function ExposureSummary({positions}:{positions:Position[]}) {
  if(!positions.length)return null;
  if(positions.some(p=>p.balanceUsd===null))return <p className="text-warning text-sm">USD exposure is unavailable for some holdings. Raw token quantities cannot be compared across stock representations.</p>;
  const byTicker:Record<string,number>={};for(const pos of positions)byTicker[pos.ticker]=(byTicker[pos.ticker]||0)+(pos.balanceUsd||0);
  const total=Object.values(byTicker).reduce((a,b)=>a+b,0);
  return <section className="bg-surface-1 border border-border rounded-xl p-4 space-y-3"><h3>Stock exposure by USD value</h3><p className="text-xs text-text-muted">Weights cover the displayed stock positions, not your entire wallet. Concentration limits are not enforced.</p>
    {Object.entries(byTicker).sort((a,b)=>b[1]-a[1]).map(([ticker,value])=><div key={ticker}><div className="flex justify-between text-sm"><span>{ticker}</span><span>${value.toFixed(2)} · {total>0?(value/total*100).toFixed(1):'0'}%</span></div><div className="h-1 bg-surface-3 rounded-full"><div className="h-1 bg-accent rounded-full" style={{width:`${total>0?value/total*100:0}%`}}/></div></div>)}
  </section>;
}
