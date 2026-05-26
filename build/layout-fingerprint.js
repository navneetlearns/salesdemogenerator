#!/usr/bin/env node
var p=require("path"),fs=require("fs-extra"),{chromium}=require("playwright");
var ROOT=p.resolve(__dirname,".."),GEN=p.join(ROOT,"generated");
var BRANDS=["jk_cement","sunder_masala","sundaram_store","acme","haldirams"];
var JOURNEYS=["order_to_cash","field_ops_expense","automated_collections","dealer_engagement","retailer_onboarding","retailer_loyalty"];
async function run(){
  console.log("=== Layout Fingerprint Generator ===");
  var browser=await chromium.launch({headless:true});
  var fps={};
  for(var bi=0;bi<BRANDS.length;bi++){
    var brand=BRANDS[bi];fps[brand]={};
    for(var ji=0;ji<JOURNEYS.length;ji++){
      var jid=JOURNEYS[ji];
      var html=p.join(GEN,brand,jid+".html");
      if(!fs.existsSync(html))continue;
      var ctx=await browser.newContext({viewport:{width:390,height:844}});
      var pg=await ctx.newPage();
      await pg.goto("file://"+html,{waitUntil:"networkidle",timeout:30000});
      var fp=await pg.evaluate(function(){
        var all=document.querySelectorAll("*");
        var ovf=0,clip=0,hScr=false,fixed=0,sticky=0;
        all.forEach(function(el){
          var s=getComputedStyle(el);
          if(s.overflow==="hidden"||s.overflowX==="hidden"){
            var r=el.getBoundingClientRect();
            var has=Array.from(el.children).some(function(c){var cr=c.getBoundingClientRect();return cr.right>r.right+2||cr.bottom>r.bottom+2;});
            if(has)clip++;
          }
          if(s.position==="fixed")fixed++;
          if(s.position==="sticky")sticky++;
          if(el.scrollWidth>el.clientWidth+5){ovf++;hScr=true;}
        });
        return{
          pageHeight:document.body.scrollHeight,
          totalElements:all.length,
          overflowElements:ovf,
          hasHorizontalScroll:hScr,
          clippedByOverflow:clip,
          fixedPosition:fixed,
          stickyPosition:sticky,
          navItems:document.querySelectorAll(".step-item,.sb-step").length,
          sidebarPresent:document.querySelectorAll(".sidebar").length>0,
          visibleSteps:document.querySelectorAll(".step-section,.step-panel").length
        };
      });
      fps[brand][jid]=fp;
      console.log(brand+"/"+jid+" pageH="+fp.pageHeight+" ovf="+fp.overflowElements+" clip="+fp.clippedByOverflow);
      await pg.close();await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(p.join(ROOT,"build","layout-fingerprints.json"),JSON.stringify(fps,null,2));
  console.log("Written: build/layout-fingerprints.json");
}
run().catch(function(e){console.error(e);process.exit(1);});