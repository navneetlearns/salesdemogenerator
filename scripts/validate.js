#!/usr/bin/env node
var {execSync}=require("child_process");
function run(cmd,label){
  console.log("
=== "+label+" ===");
  try{execSync(cmd,{stdio:"inherit",shell:true,cwd:__dirname});console.log(label+": PASS");return true;}
  catch(e){console.log(label+": FAIL");return false;}
}
var steps=[
  ["npm run build","Build Generation"],
  ["node build/layout-fingerprint.js","Layout Fingerprint"],
  ["node scripts/visual-test.js","Visual Regression"],
];
var allPass=true;
for(var i=0;i<steps.length;i++){if(!run(steps[i][0],steps[i][1]))allPass=false;}
console.log("
=== VALIDATION "+(allPass?"ALL PASS":"SOME FAILED")+" ===");
process.exit(allPass?0:1);