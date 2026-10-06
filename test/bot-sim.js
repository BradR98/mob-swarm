// Balance sim: node test/bot-sim.js  (idealised bots; upper bound on human skill)
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const noop=()=>{};const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:noop,set:(t,k,v)=>(t[k]=v,true)});
const els={};const el=()=>({style:{},classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,setAttribute:noop,getContext:()=>ctx,getBoundingClientRect:()=>({left:0,top:0,width:360,height:640})});
const sb={document:{getElementById:id=>els[id]||(els[id]=el()),addEventListener:noop},window:{innerWidth:360,innerHeight:640,devicePixelRatio:2,addEventListener:noop},location:{hash:'#debug'},performance:{now:()=>0},requestAnimationFrame:noop,Math,Float32Array,Uint8Array,Int16Array,Array};
sb.window.window=sb.window;vm.createContext(sb);vm.runInContext(src,sb);const g=sb.window.__mob;
function play(lv,strategy){g.setLevel(lv);g.setFlags({fire:true,spawner:true});g.touch(true);let peakR=0,t=0;
 while(g.get().state===0&&t<60*180){
  if(t%6===0){const q=g.get();let x=180;
   if(strategy==='intercept'&&q.redX.length) x=q.redX.reduce((a,b)=>a+b,0)/q.redX.length;
   else if(strategy==='gate'){const G=g.gates[0];x=G.x+G.w/2+G.vx*0.25;}
   else if(strategy==='gate+intercept'){const G=g.gates[0];x=q.redX.length?q.redX.reduce((a,b)=>a+b,0)/q.redX.length:G.x+G.w/2;}
   g.aim(Math.max(16,Math.min(344,x)));}
  g.update(1/60);t++;peakR=Math.max(peakR,g.get().redCount);}
 return {state:g.get().state,t:t/60,peakR,cannon:g.get().cannonHP};}
for(const strat of ['intercept','gate','gate+intercept'])for(let lv=0;lv<3;lv++){let w=0,N=20,pr=0,tt=0;for(let i=0;i<N;i++){const r=play(lv,strat);if(r.state===1)w++;pr=Math.max(pr,r.peakR);tt+=r.t;}
 console.log(strat.padEnd(15),'L'+(lv+1),'win',w+'/'+N,'avg t',(tt/N).toFixed(0)+'s','peak red',pr);}
