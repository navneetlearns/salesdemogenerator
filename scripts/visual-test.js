#!/usr/bin/env node
var p=require("path"),fs=require("fs-extra"),{chromium}=require("playwright"),{spawnSync}=require("child_process");
var ROOT=p.resolve(__dirname,".."),GEN=p.join(ROOT,"generated"),REP=p.join(ROOT,".visual-report");
var VPS={desktop:{w:1440,h:900},tablet:{w:768,h:1024},mobile:{w:390,h:844}};
var BRANDS=["jk_cement","haldirams","sundaram_store"];
var JOURNEYS=["order_to_cash","field_ops_expense","automated_collections","dealer_engagement","retailer_onboarding","retailer_loyalty"];
function sb(b){return b.replace(/_/g,"");}
async function run(){
  console.log("=== Visual Test: Capturing Current Screenshots ===");
  var browser=await chromium.launch({headless:true});
  var total=0;
  for(var bi=0;bi<BRANDS.length;bi++){
    var brand=BRANDS[bi];
    for(var ji=0;ji<JOURNEYS.length;ji++){
      var jid=JOURNEYS[ji];
      var html=p.join(GEN,brand,jid+".html");
      if(!fs.existsSync(html))continue;
      var navSel=jid==="automated_collections"?".sb-step":".step-item";
      var entries=Object.entries(VPS);
      for(var ei=0;ei<entries.length;ei++){
        var vn=entries[ei][0],vp=entries[ei][1];
        var ctx=await browser.newContext({viewport:{width:vp.w,height:vp.h}});
        var pg=await ctx.newPage();
        await pg.goto("file://"+html,{waitUntil:"networkidle",timeout:30000});
        var d=p.join(REP,"current",vn);await fs.ensureDir(d);
        await pg.screenshot({path:p.join(d,sb(brand)+"-"+jid+"-"+vn+".png")});
        total++;
        var cnt=await pg.evaluate(function(s){return document.querySelectorAll(s).length;},navSel);
        for(var n=1;n<=cnt;n++){
          var stepSel=navSel+":nth-child("+n+")";
                    await pg.evaluate(function(sn){var el=document.querySelector(sn);if(el){el.scrollIntoView({behavior:"instant",block:"center"});}},stepSel);await pg.waitForTimeout(200);
          await pg.screenshot({path:p.join(d,sb(brand)+"-"+jid+"-step"+n+"-"+vn+".png")});
          total++;
        }
        await pg.close();await ctx.close();
      }
    }
  }
  await browser.close();
  console.log("Captured "+total+" current screenshots");
  console.log("");
  console.log("Running comparison...");
  var r=spawnSync("node",[p.join(ROOT,"build","visual-regression.js")],{cwd:ROOT,stdio:"inherit"});
  process.exit(r.status||0);
}
run().catch(function(e){console.error(e);process.exit(1);});