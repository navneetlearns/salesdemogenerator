#!/usr/bin/env node
const p=require("path"),fs=require("fs-extra"),pm=require("pixelmatch").default,{PNG}=require("pngjs");
const ROOT=p.resolve(__dirname,".."),BL=p.join(ROOT,".visual-baseline"),REP=p.join(ROOT,".visual-report");
const TH=0.01,VPS=["desktop","tablet","mobile"];
const BRANDS=["jk_cement","haldirams","sundaram_store"];
const JOURNEYS=["order_to_cash","field_ops_expense","automated_collections","dealer_engagement","retailer_onboarding","retailer_loyalty"];
function sb(b){return b.replace(/_/g,"");}
async function cmp(bp,cp,dp){
  if(!fs.existsSync(bp))return{missing:"baseline"};
  if(!fs.existsSync(cp))return{missing:"current"};
  var i1=PNG.sync.read(fs.readFileSync(bp));
  var i2=PNG.sync.read(fs.readFileSync(cp));
  if(i1.width!==i2.width||i1.height!==i2.height)return{sizeMismatch:true,w1:i1.width,h1:i1.height,w2:i2.width,h2:i2.height};
  var d=new PNG({width:i1.width,height:i1.height});
  var px=pm(i1.data,i2.data,d.data,i1.width,i1.height,{threshold:0.1});
  var r=px/(i1.width*i1.height);
  if(r>TH){await fs.ensureDir(p.dirname(dp));fs.writeFileSync(dp,PNG.sync.write(d));}
  return{diffPixels:px,ratio:r,passed:r<=TH};
}
function genHTML(failed,passed,total){
  var rows="";
  failed.forEach(function(f){rows+="<tr style=\"background:#ffe0e0\"><td>"+f.label.replace(/</g,"&lt;")+"</td><td>"+f.reason+"</td><td>"+(f.ratio*100).toFixed(2)+"%</td><td><a href=\"diff/"+f.diff+"\">diff</a></td></tr>";});
  passed.forEach(function(p){rows+="<tr style=\"background:#e0ffe0\"><td>"+p.replace(/</g,"&lt;")+"</td><td>ok</td><td><1%</td><td>-</td></tr>";});
  return "<!DOCTYPE html><html><head><title>Visual Regression Report</title><style>body{font-family:sans-serif;margin:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body><h1>Visual Regression Report</h1><p>Total: "+total+" | Passed: "+passed.length+" | Failed: "+failed.length+"</p><table><tr><th>File</th><th>Status</th><th>Diff %</th><th>Diff Image</th></tr>"+rows+"</table></body></html>";
}
async function run(){
  console.log("=== Visual Regression Test ===");
  var failed=[],passed=[],total=0;
  for(var bi=0;bi<BRANDS.length;bi++){
    var brand=BRANDS[bi];
    for(var ji=0;ji<JOURNEYS.length;ji++){
      var jid=JOURNEYS[ji];
      if(!fs.existsSync(p.join(ROOT,"generated",brand,jid+".html")))continue;
      for(var vi=0;vi<VPS.length;vi++){
        var vp=VPS[vi];
        var prefix=sb(brand)+"-"+jid;
        var bd=p.join(BL,vp);
        if(!fs.existsSync(bd))continue;
        var files=fs.readdirSync(bd).filter(function(f){return f.startsWith(prefix)&&f.endsWith(".png");});
        for(var fi=0;fi<files.length;fi++){
          var fn=files[fi];total++;
          var bl=p.join(bd,fn);
          var cd=p.join(REP,"current",vp);
          var dd=p.join(REP,"diff",vp);
          var df=fn.replace(".png","-diff.png");
          var result=await cmp(bl,p.join(cd,fn),p.join(dd,df));
          var label=brand+"/"+jid+" ["+vp+"] "+fn;
          if(result.passed)passed.push(label);
          else if(result.missing==="baseline")console.log("MISSING BASELINE: "+label);
          else if(result.missing==="current")console.log("MISSING CURRENT: "+label);
          else if(result.sizeMismatch){console.log("SIZE MISMATCH: "+label);failed.push({label:label,reason:"size_mismatch",ratio:1,diff:df});}
          else{console.log("FAILED: "+label+" diff="+(result.ratio*100).toFixed(2)+"%");failed.push({label:label,reason:"visual_diff",ratio:result.ratio,diff:df});}
        }
      }
    }
  }
  fs.writeFileSync(p.join(REP,"index.html"),genHTML(failed,passed,total));
  console.log("Total: "+total+" | Passed: "+passed.length+" | Failed: "+failed.length);
  if(failed.length){console.log("FAILED:");failed.forEach(function(f){console.log("  - "+f.label+" ("+f.reason+")");});}
  console.log("Report: "+p.join(REP,"index.html"));
  process.exit(failed.length?1:0);
}
run().catch(function(e){console.error(e);process.exit(1);});