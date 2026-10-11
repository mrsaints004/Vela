import type {PolicyEvaluation,SimulationSnapshot} from '../types';
export function allowanceOnlyBlocked(evaluation:PolicyEvaluation|null,simulation:SimulationSnapshot|null){
 const failed=evaluation?.checks.filter(c=>c.status==='fail')||[];
 return simulation?.status==='FAILED'&&simulation.scope==='transaction'&&/transfer amount exceeds allowance|insufficient allowance/i.test(simulation.failReason||'')&&failed.length===1&&failed[0].name==='Preflight';
}
