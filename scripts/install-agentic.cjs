const {spawnSync}=require('node:child_process');
const {join}=require('node:path');
const project=process.cwd();
const result=spawnSync('npm',['install','--prefix',join(project,'.tools','agentic-wallet'),'--cache',join(project,'.tools','npm-cache'),'--ignore-scripts','--no-audit','--no-fund','@binance/agentic-wallet@1.10.0'],{stdio:'inherit',cwd:project,shell:false});
if(result.error){console.error('Could not run npm:',result.error.message);process.exit(1);}
process.exit(result.status??1);
