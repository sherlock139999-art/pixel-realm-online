import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import crypto from 'node:crypto';
const app=express();app.use(express.static('public'));
const server=createServer(app), wss=new WebSocketServer({server});
const players=new Map(), mobs=new Map(), WORLD=1800;
const rand=(a,b)=>Math.random()*(b-a)+a;
function spawn(){let id=crypto.randomUUID();mobs.set(id,{id,x:rand(70,WORLD-70),y:rand(70,WORLD-70),hp:45,maxHp:45});}
for(let i=0;i<42;i++)spawn();
function send(ws,obj){if(ws.readyState===1)ws.send(JSON.stringify(obj));}
function broadcast(obj){let data=JSON.stringify(obj);for(const c of wss.clients)if(c.readyState===1)c.send(data);}
function hit(p,m,damage){m.hp-=damage;if(m.hp<=0){mobs.delete(m.id);p.xp+=10;p.kills++;if(p.xp>=p.level*30){p.xp-=p.level*30;p.level++;p.maxHp+=10;p.hp=p.maxHp;send(p.ws,{type:'level',level:p.level});}spawn();}}
wss.on('connection',ws=>{let id=crypto.randomUUID(),p={id,ws,name:'冒險者',x:rand(800,1000),y:rand(800,1000),hp:100,maxHp:100,xp:0,level:1,kills:0,lastAttack:0,lastSkill:0};players.set(id,p);send(ws,{type:'welcome',id,world:WORLD});ws.on('message',raw=>{if(raw.length>1024)return;let msg;try{msg=JSON.parse(raw)}catch{return}if(msg.type==='join'){p.name=String(msg.name||'冒險者').slice(0,14).replace(/[<>]/g,'');}if(msg.type==='move'){let dx=Number(msg.dx)||0,dy=Number(msg.dy)||0;if(!Number.isFinite(dx)||!Number.isFinite(dy))return;let len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}p.dx=dx;p.dy=dy;}if(msg.type==='skill'&&Date.now()-p.lastSkill>4500){p.lastSkill=Date.now();for(const m of mobs.values())if(Math.hypot(m.x-p.x,m.y-p.y)<125)hit(p,m,30);broadcast({type:'effect',x:p.x,y:p.y});}});ws.on('close',()=>players.delete(id));});
let last=Date.now();setInterval(()=>{let now=Date.now(),dt=Math.min((now-last)/1000,.1);last=now;for(const p of players.values()){p.x=Math.max(20,Math.min(WORLD-20,p.x+(p.dx||0)*175*dt));p.y=Math.max(20,Math.min(WORLD-20,p.y+(p.dy||0)*175*dt));if(now-p.lastAttack>850){let target=null,dist=155;for(const m of mobs.values()){let d=Math.hypot(m.x-p.x,m.y-p.y);if(d<dist){dist=d;target=m;}}if(target){p.lastAttack=now;hit(p,target,12+p.level*2);broadcast({type:'strike',x:target.x,y:target.y});}}}broadcast({type:'state',players:[...players.values()].map(({ws,dx,dy,lastAttack,lastSkill,...p})=>p),mobs:[...mobs.values()]});},50);
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Game at http://localhost:'+(process.env.PORT||3000)));
