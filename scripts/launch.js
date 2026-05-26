#!/usr/bin/env node
var fs=require("fs-extra"),path=require("path"),{spawn,execSync}=require("child_process"),http=require("http");
var ROOT=path.resolve(__dirname,".."),GEN=path.join(ROOT,"generated"),BD=path.join(ROOT,"data","brands"),JD=path.join(ROOT,"data","journeys");
var MAP={order_to_cash:"Order to Cash",field_ops_expense:"Field Ops & Expense",automated_collections:"Automated Collections",dealer_engagement:"Dealer Engagement",retailer_onboarding:"Retailer Onboarding",retailer_loyalty:"Retailer Loyalty"};
var JIDS=["order_to_cash","field_ops_expense","automated_collections","dealer_engagement","retailer_onboarding","retailer_loyalty"];

function header(t){var W=54,p=Math.max(0,W-t.length);console.log("");console.log("  +"+ "-".repeat(W)+"+");console.log("  |"+ " ".repeat(Math.floor(p/2))+t+" ".repeat(Math.ceil(p/2))+"|");console.log("  +"+ "-".repeat(W)+"+");console.log("");}

function pick(items,label,cb){
  header(label);
  var keys=Object.keys(items);
  for(var i=0;i<keys.length;i++){console.log("    "+(i+1)+".  "+items[keys[i]]);}
  console.log("    0.  Cancel
");
  process.stdout.write("  Enter choice (0-"+keys.length+"): ");
  var stdin=process.stdin;
  if(stdin.setRawMode)stdin.setRawMode(false);
  stdin.once("data",function(b){
    var n=parseInt(b.toString().trim(),10);
    if(n===0){console.log("
  Cancelled.
");process.exit(0);}
    if(n>=1&&n<=keys.length){cb(keys[n-1]);}
    else{console.log("  Invalid choice.");pick(items,label,cb);}
  });
}

function brands(){
  var b={};
  if(!fs.existsSync(BD))return b;
  fs.readdirSync(BD).forEach(function(f){
    if(f.endsWith(".json")){var id=f.replace(".json","");try{var d=fs.readJsonSync(path.join(BD,f));b[id]=d.name||id;}catch(e){b[id]=id;}}
  });
  return b;
}

function journ(bid){
  var r=[];
  JIDS.forEach(function(j){if(fs.existsSync(path.join(JD,bid+"_"+j+".json")))r.push(j);});
  return r;
}

function buildB(bid){
  return new Promise(function(res,rej){
    console.log("
  Building "+bid+"...");
    var p=spawn(process.execPath,["build.js","--brand="+bid],{cwd:ROOT,stdio:"inherit",shell:true});
    p.on("close",function(c){if(c===0)res();else rej(new Error("Build failed (exit "+c+")"));});
  });
}

function serve(port){
  return new Promise(function(res){
    var s=http.createServer(function(req,rsp){
      var fp=path.join(GEN,req.url.split("?")[0].split("#")[0]);
      if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){rsp.writeHead(404);rsp.end("Not found");return;}
      var ext=path.extname(fp);
      var mime={".html":"text/html",".png":"image/png",".jpg":"image/jpeg",".css":"text/css",".js":"application/javascript",".svg":"image/svg+xml"};
      rsp.writeHead(200,{"Content-Type":mime[ext]||"application/octet-stream"});
      fs.createReadStream(fp).pipe(rsp);
    });
    s.listen(port,function(){res(s);});
  });
}

function browser(url){
  try{
    if(process.platform==="win32"){execSync("cmd.exe /c start \"\" \""+url+"\"",{stdio:"ignore"});}
    else if(process.platform==="darwin"){execSync("open \""+url+"\"",{stdio:"ignore"});}
    else{execSync("xdg-open \""+url+"\"",{stdio:"ignore"});}
  }catch(e){}
}

function run(){
  header("ZoTok Demo Launcher");
  var b=brands();
  if(Object.keys(b).length===0){console.log("  No brands found.");process.exit(1);}
  pick(b,"Select Brand",function(bid){
    var j=journ(bid);
    if(j.length===0){console.log("  No journeys for "+bid);process.exit(1);}
    var jm={};j.forEach(function(x){jm[x]=MAP[x]||x;});
    pick(jm,"Select Journey",function(jid){
      buildB(bid).then(function(){
        serve(8765).then(function(){
          var url="http://localhost:8765/"+bid+"/"+jid+".html";
          console.log("
  >>  "+b[bid]+" - "+MAP[jid]);
          console.log("  "+url+"
");
          console.log("  Press Ctrl+C to stop the server
");
          browser(url);
        });
      }).catch(function(e){console.error("  Error: "+e.message);process.exit(1);});
    });
  });
}

run();