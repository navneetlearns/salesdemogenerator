#!/usr/bin/env node
const p=require("path"),fs=require("fs-extra"),{chromium}=require("playwright");
const ROOT=p.resolve(__dirname,".."),GEN=p.join(ROOT,"generated"),BL=p.join(ROOT,".visual-baseline");
const VPS={desktop:{w:1440,h:900},tablet:{w:768,h:1024},mobile:{w:390,h:844}};
const BRANDS=["jk_cement","sunder_masala","sundaram_store","acme","haldirams"];
const JOURNEYS=["order_to_cash","field_ops_expense","automated_collections","dealer_engagement","retailer_onboarding","retailer_loyalty"];
function sb(b){return b.replace(/_/g,"");}
async function run(){
  console.log("=== Visual Baseline Generator ===");
  const browser=await chromium.launch({headless:true});
  let total=0,steps=0;
  for(const brand of BRANDS){
    for(const jid of JOURNEYS){
      const html=p.join(GEN,brand,jid+".html");
      if(!fs.existsSync(html)){console.log("SKIP: "+brand+"/"+jid);continue;}
      const navSel=jid==="automated_collections"?".sb-step":".step-item";
      for(const[vn,vp]of Object.entries(VPS)){
        const ctx=await browser.newContext({viewport:{width:vp.w,height:vp.h}});
        const pg=await ctx.newPage();
        await pg.goto("file://"+html,{waitUntil:"networkidle",timeout:30000});
        const d=p.join(BL,vn);await fs.ensureDir(d);
        await pg.screenshot({path:p.join(d,sb(brand)+"-"+jid+"-"+vn+".png")});
        total++;
        const cnt=await pg.evaluate(s=>document.querySelectorAll(s).length,navSel);
        steps+=cnt;
        for(let n=1;n<=cnt;n++){
          var stepSel = navSel + ":nth-child(" + n + ")";
                    await pg.evaluate(function(sn){var el=document.querySelector(sn);if(el){el.scrollIntoView({behavior:"instant",block:"center"});}},stepSel);await pg.waitForTimeout(200);
          await pg.screenshot({path:p.join(d,sb(brand)+"-"+jid+"-step"+n+"-"+vn+".png")});
          total++;
        }
        await pg.close();await ctx.close();
      }
    }
  }
  await browser.close();
  console.log("DONE: "+total+" screenshots, "+steps+" steps");
}
run().catch(e=>{console.error(e);process.exit(1);});