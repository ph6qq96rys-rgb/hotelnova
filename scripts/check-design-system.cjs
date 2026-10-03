const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=path.join(root,'src');
const baselinePath=path.join(root,'design-system-baseline.json');
function scan(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?scan(path.join(dir,x.name)):[path.join(dir,x.name)]);}
function violations(file){
 const relative=path.relative(root,file).replaceAll('\\','/');
 // Canonical implementation owns raw colors and native controls.
 if(relative.startsWith('src/components/ui/')||['src/styles/global.css','src/styles/design-system.css'].includes(relative))return {};
 const s=fs.readFileSync(file,'utf8'),rules={};
 for(const match of s.matchAll(/#[\da-fA-F]{3,8}\b/g)){const key='color:'+match[0].toLowerCase();rules[key]=(rules[key]??0)+1;}
 for(const [name,pattern] of [['native-confirm',/window\.confirm\(/g],['native-control',/<(?:button|input|select|textarea)(?:\s|>)/g],['root-theme',/:root\s*\{/g],['font-family',/font-family\s*:\s*[^;}]+/g]])for(const m of s.matchAll(pattern)){if(name==='font-family'&&m[0].includes('var('))continue;const key=name==='font-family'?m[0]:name;rules[key]=(rules[key]??0)+1;}
 return rules;
}
const current={};for(const file of scan(source).filter(f=>/\.(css|tsx)$/.test(f))){const v=violations(file);if(Object.keys(v).length)current[path.relative(root,file).replaceAll('\\','/')]=v;}
if(process.argv.includes('--snapshot')){fs.writeFileSync(baselinePath,JSON.stringify(current,null,2)+'\n');console.log('Design-system legacy inventory written. Baseline changes require design review.');process.exit(0);}
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));const errors=[];
for(const [file,rules] of Object.entries(current))for(const [rule,count] of Object.entries(rules))if(count>(baseline[file]?.[rule]??0))errors.push(`${file}: ${rule} increased by ${count-(baseline[file]?.[rule]??0)}. Use shared tokens/components or obtain a documented design-system exception.`);
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log('Design-system check passed: no new independent colors, font families, root themes, native confirmations or native controls outside the shared library.');
