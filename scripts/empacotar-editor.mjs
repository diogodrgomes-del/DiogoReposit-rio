// empacota um editor e SO grava se o script passar na checagem de sintaxe.
// erro de sintaxe nao aparece em teste de interface: o script simplesmente
// nao roda e todo seletor devolve vazio, como se a pagina estivesse vazia.
import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
const [base, modeloHome, modeloObras, saida] = process.argv.slice(2);
let b = readFileSync(base,'utf8');
const carimbo = new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})
  .replace(',','').replace(/\//g,'/');
b = b.replace('__CARIMBO__', carimbo);
b = b.replace('__MODELO_HOME__', readFileSync(modeloHome).toString('base64'));
if (modeloObras !== '-') b = b.replace('__MODELO_OBRAS__', readFileSync(modeloObras).toString('base64'));

const i = b.lastIndexOf('<script>')+8, j = b.lastIndexOf('</script>');
writeFileSync('/tmp/checar.js', b.slice(i,j));
try { execFileSync('node',['--check','/tmp/checar.js'],{stdio:'pipe'}); }
catch(e){ console.error('SINTAXE INVALIDA — nada foi gravado\n'+e.stderr.toString().split('\n').slice(0,4).join('\n')); process.exit(1); }
writeFileSync(saida, b);
console.log(`${saida}: ${(Buffer.byteLength(b)/1024).toFixed(0)} KB | carimbo ${carimbo} | sintaxe ok`);
