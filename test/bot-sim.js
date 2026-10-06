// Balance sim: node test/bot-sim.js  (idealised bots; upper bound on human skill)
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const noop=()=>{};const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>(t[k]=v,true)});
const els={};const el=()=>({style:{},classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,setAttribute:noop,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:360,height:640})});
const sb={document:{getElementById:id=>els[id]||(els[id]=el()),addEventListener:noop},window:{innerWidth:360,innerHeight:640,devicePixelRatio:2,addEventListener:noop},location:{hash:'#debug'},performance:{now:()=>0},requestAnimationFrame:noop,Math,Float32Array,Uint8Array,Int16Array,Array};
sb.window.window=sb.window;vm.createContext(sb);vm.runInContext(src,sb);const g=sb.window.__mob;

// Predict a bouncing gate's left edge t seconds ahead.
function predict(G,t){const span=G.max-G.min; if(span<=0)return G.x; let d=(G.x-G.min)+G.vx*t; const per=2*span; d=((d%per)+per)%per; if(d>span)d=per-d; return G.min+d;}
function smartAim(q){ // pick the lane that maximises predicted multiplier product through gates (neg gates hurt)
  let best=180,bs=-1;
  for(let x=20;x<=340;x+=6){let sc=1;
    for(let gi=0;gi<q.gateCount;gi++){const G=g.gates[gi];const t=(566-G.y)/250;const gx=predict(G,t);
      if(x>=gx-4&&x<=gx+G.w+4){ sc*= G.type==='x'?G.n : G.type==='+'?G.n+1 : G.type==='/'?0.5 : 0.6; } }
    sc-=Math.abs(x-180)*1e-4; if(sc>bs){bs=sc;best=x;} }
  return best; }
function play(lv,strategy){g.setLevel(lv);g.setFlags({fire:true,spawner:true});g.touch(true);let peakR=0,t=0;
 while(g.get().state===0&&t<60*900){
  if(t%6===0){const q=g.get();let x=180;
   if(strategy==='intercept'&&q.redX.length) x=q.redX.reduce((a,b)=>a+b,0)/q.redX.length;
   else if(strategy==='smart'){x=smartAim(q);}
   else if(strategy==='smart+wall'){ const near=q.redX.length>=10; x=near? q.redX.reduce((a,b)=>a+b,0)/q.redX.length : smartAim(q);}
   else if(strategy==='gate'){const G=g.gates[0];x=G.x+G.w/2+G.vx*0.25;}
   else if(strategy==='gate+intercept'){const G=g.gates[0];x=q.redX.length?q.redX.reduce((a,b)=>a+b,0)/q.redX.length:G.x+G.w/2;}
   g.aim(Math.max(16,Math.min(344,x)));}
  g.update(1/60);t++;peakR=Math.max(peakR,g.get().redCount);}
 return {state:g.get().state,t:t/60,peakR,cannon:g.get().cannonHP};}
for(const strat of ['gate','smart','smart+wall'])for(let lv=0;lv<3;lv++){let w=0,N=8,pr=0,tt=0;for(let i=0;i<N;i++){const r=play(lv,strat);if(r.state===1)w++;pr=Math.max(pr,r.peakR);tt+=r.t;}
 console.log(strat.padEnd(15),'L'+(lv+1),'win',w+'/'+N,'avg t',(tt/N).toFixed(0)+'s','peak red',pr);}

// Pure siege time: smart aim, no red spawner (isolates how long the base HP takes to chew through)
console.log('--- siege time with no reds (smart aim) ---');
for(let lv=0;lv<3;lv++){let tt=0,N=6,mn=1e9,mx=0;for(let i=0;i<N;i++){g.setLevel(lv);g.setFlags({fire:true,spawner:false});g.touch(true);let t=0;
  while(g.get().state===0&&t<60*1500){ if(t%6===0)g.aim(Math.max(16,Math.min(344,smartAim(g.get())))); g.update(1/60);t++;}
  const s=t/60;tt+=s;mn=Math.min(mn,s);mx=Math.max(mx,s);}
  console.log('L'+(lv+1),'clear time avg',(tt/N).toFixed(0)+'s','(min',mn.toFixed(0)+'s, max',mx.toFixed(0)+'s)');}
