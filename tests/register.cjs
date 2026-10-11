const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const original=Module._resolveFilename;
Module._resolveFilename=function(id,...rest){return original.call(this,id.startsWith('@/')?path.join(process.cwd(),'src',id.slice(2)):id,...rest);};
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(module,file)=>{const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});module._compile(output.outputText,file);};
