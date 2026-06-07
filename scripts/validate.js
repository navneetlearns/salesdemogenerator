#!/usr/bin/env node
var {execSync}=require("child_process");
var path=require("path");
var ROOT=path.resolve(__dirname,"..");
function run(cmd,label){
  console.log("\n=== "+label+" ===");
  try{execSync(cmd,{stdio:"inherit",shell:true,cwd:ROOT});console.log(label+": PASS");return true;}
  catch(e){console.log(label+": FAIL");return false;}
}
var steps=[
  ["npm run build","Build Generation"],
  ["node build/layout-fingerprint.js","Layout Fingerprint"],
  ["node scripts/visual-test.js","Visual Regression"],
];
var allPass=true;
for(var i=0;i<steps.length;i++){if(!run(steps[i][0],steps[i][1]))allPass=false;}
console.log("\n=== VALIDATION "+(allPass?"ALL PASS":"SOME FAILED")+" ===");
process.exit(allPass?0:1);
