const {spawn}=require('node:child_process');
const command=process.argv[2];
if(!['dev','start'].includes(command)){console.error('Use dev or start.');process.exit(1);}
// The wallet bridge is privileged: never bind its server to a public interface.
if(process.argv.slice(3).some(arg=>arg==='-H'||arg.startsWith('--hostname'))){console.error('Agentic Wallet server must stay on 127.0.0.1.');process.exit(1);}
const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),command,'--hostname','127.0.0.1',...process.argv.slice(3)],{stdio:'inherit',shell:false,env:{...process.env,VELA_AGENTIC_WALLET_ENABLED:'true'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('error',error=>{console.error(error.message);process.exit(1);});
child.on('exit',code=>process.exit(code??1));
