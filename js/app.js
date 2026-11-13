const PAIRS=[["🐶","🐺"],["🍎","🍅"],["🐱","🦁"],["🍉","🍈"],["☕","🍵"],["🚗","🚕"],["🌙","🌕"],["🐰","🐭"],["🍔","🌭"],["⚽","🏀"],["🌹","🌷"],["🐧","🦆"],["🚲","🛵"],["🍩","🥯"],["🏠","🏢"],["🎸","🎻"],["🐢","🦎"],["⛵","🚤"],["🍇","🫐"],["🦊","🐱"]];

const VID="assets/banner.mp4",POSTER="assets/poster.jpg";
(function(){
  const g=document.getElementById('gl'),N=26;let s='<path d="M0 8 Q260 90 520 8" fill="none" stroke="#bfe6ff" stroke-width=".8" opacity=".6"/>';
  for(let i=0;i<=N;i++){const t=i/N,x=t*520,y=2*(1-t)*t*90+8+0*t;const c=i%3===0?'#ff4fd8':'#fff';s+=`<circle cx="${x}" cy="${y}" r="3" fill="${c}" style="filter:drop-shadow(0 0 3px ${c})"/>`;
    if(i%7===3)s+=`<line x1="${x}" y1="${y}" x2="${x}" y2="${y+10}" stroke="#bfe6ff" stroke-width=".6"/><ellipse cx="${x}" cy="${y+16}" rx="3" ry="5" fill="#ffd93d"/>`}
  g.innerHTML=s;
  const f=document.getElementById('fx'),sy=['✦','•','✧','○'];
  for(let i=0;i<16;i++){const e=document.createElement('i');e.textContent=sy[i%4];e.style.left=Math.random()*100+'%';e.style.fontSize=(10+Math.random()*16)+'px';e.style.animationDuration=(9+Math.random()*12)+'s';e.style.animationDelay=(-Math.random()*20)+'s';f.appendChild(e)}
})();
const VOTE_SECS=30,RES_SECS=7,GUESS_SECS=20;
const CATS={'Животные':[["🐘","🦏"],["🐻","🐼"],["🐴","🦓"],["🐸","🐊"],["🦅","🦉"],["🐬","🦈"],["🐝","🦋"],["🐮","🐷"]],'Еда':[["🍕","🥧"],["🍓","🍒"],["🥕","🌽"],["🧀","🧈"],["🍦","🍰"],["🥐","🍞"],["🍊","🍑"],["🍪","🍫"]],'Вещи':[["⌚","⏰"],["📱","💻"],["🔑","🔒"],["🎈","🎁"],["☂️","🌂"],["🕶️","👓"],["📷","🎥"],["🚲","🛵"]]};
const POOL=(k,cu=[])=>k==='custom'?(cu.length?cu:PAIRS):CATS[k]||[...PAIRS,...Object.values(CATS).flat(),...cu];
const app=document.getElementById('app');
let uid,code=null,room=null,secret=null,flash='',busy='',myName='',peer=null,isHost=false,hostConn=null,skew=0,canWrite=true;
try{myName=localStorage.getItem('spy_name')||''}catch(e){}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const act=r=>Object.entries(r.players||{}).filter(([,p])=>!p.left).sort((a,b)=>(a[1].joined||0)-(b[1].joined||0));
const aliveIds=r=>act(r).filter(([,p])=>p.alive).map(x=>x[0]);
const nm=i=>room&&room.players[i]?esc(room.players[i].name):'?';
const vkey=()=>room.game+'-'+room.round+(room.rv?'r'+room.rv:'');
const fmt=s=>s>=60?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):s+' сек';
const mySecret=()=>secret&&room&&secret.game===room.game?secret:null;
let prefill='',hold=false;
function home(){
  app.innerHTML=`<div class="ban"><video src="${VID}" poster="${POSTER}" autoplay muted loop playsinline></video><h1>Найди шпиона</h1></div><p class="mut">Все видят одну картинку, а шпион — похожую. Описывайте её по очереди и вычисляйте чужака.</p>
  ${flash?`<div class="err">${esc(flash)}</div>`:''}${canWrite?'':'<div class="err">У вас доступ только для просмотра — попросите владельца дать роль «Участник».</div>'}
  <div class="card"><h2>Ваше имя</h2><input type="text" id="nm" maxlength="14" value="${esc(myName)}" placeholder="Например, Алекс"></div>
  <div class="card"><button data-a="create" style="width:100%" ${canWrite?'':'disabled'}>Создать комнату</button>
  <p class="mut" style="text-align:center">или войти по коду</p>
  <div class="row"><input type="text" id="cd" maxlength="4" placeholder="КОД" value="${esc(prefill)}" style="text-transform:uppercase"><button data-a="join" class="ghost" style="flex:0 0 auto">Войти</button></div></div>`;
}
function readName(){const v=(document.getElementById('nm')||{}).value;if(v!==undefined)myName=v.trim();try{localStorage.setItem('spy_name',myName)}catch(e){}return myName}
const PFX='spyroom-',NOW=()=>Date.now()+skew;
const CFG=window.SPY_CONFIG||{},SERVERS=(CFG.peers&&CFG.peers.length?CFG.peers:[CFG.peer||{}]);
const NETERR=['network','server-error','socket-error','socket-closed','browser-incompatible'];
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'},...(CFG.turn||[{urls:['turn:openrelay.metered.ca:80','turn:openrelay.metered.ca:443','turn:openrelay.metered.ca:443?transport=tcp'],username:'openrelayproject',credential:'openrelayproject'}])]};
const conns={};let hsecret=null,joined=false,htries=0;
try{uid=localStorage.getItem('spy_uid')}catch(e){}
if(!uid){uid='u'+Math.random().toString(36).slice(2,10);try{localStorage.setItem('spy_uid',uid)}catch(e){}}
const merge=(t,p)=>{for(const k in p){const v=p[k];if(v&&typeof v==='object'&&!Array.isArray(v)){if(!t[k]||typeof t[k]!=='object'||Array.isArray(t[k]))t[k]={};merge(t[k],v)}else t[k]=v}return t};
const send=m=>{try{hostConn&&hostConn.open&&hostConn.send(m)}catch(e){}};
function save(){try{if(isHost)localStorage.setItem('spy_host',JSON.stringify({code,room,hsecret,t:Date.now()}))}catch(e){}}
function viewFor(u){
  if(!hsecret||!room.game||hsecret.game!==room.game)return null;
  if(room.winner)return hsecret;
  const r=hsecret.roles[u];
  return {game:hsecret.game,roles:r?{[u]:r}:{},[r||'x']:r?hsecret[r]:'',blind:hsecret.blind===u?u:''};
}
function broadcast(){const now=Date.now();for(const u in conns){const c=conns[u];if(c&&c.open)try{c.send({t:'s',room,secret:viewFor(u),now})}catch(e){}}}
function upd(p){merge(room,p);if(isHost){secret=hsecret;broadcast();save()}render()}

/* ---------- host ---------- */
function hostStart(c,saved,si,nt){
  si=si||0;nt=nt||0;let ok=false;
  code=c;try{peer&&peer.destroy()}catch(e){}
  const hp=peer=new Peer(PFX+c,{...SERVERS[si%SERVERS.length],config:ICE});
  peer.on('disconnected',()=>{if(ok&&peer===hp)try{hp.reconnect()}catch(e){}});
  peer.on('open',()=>{
    ok=true;isHost=true;
    if(saved){room=saved.room;hsecret=saved.hsecret}
    else room={host:uid,created:Date.now(),phase:'lobby',round:0,game:'',winner:'',settings:{max:8,spies:1,time:90,cat:'all',white:false,text:false},scores:{},players:{[uid]:{name:myName,alive:true,spec:false,joined:Date.now()}}};
    secret=hsecret;flash='';
    try{localStorage.setItem('spy_role','host');localStorage.setItem('spy_room',c)}catch(e){}
    render();save();broadcast();
  });
  peer.on('connection',c=>{
    c.on('data',m=>onMsg(c,m));
    c.on('close',()=>{for(const u in conns)if(conns[u]===c){delete conns[u];if(room&&room.phase==='lobby'&&room.players[u]&&!room.players[u].left)upd({players:{[u]:{left:true}}})}});
  });
  peer.on('error',e=>{
    if(e.type==='unavailable-id'){
      try{peer.destroy()}catch(x){}
      if(saved){if(htries++<8)setTimeout(()=>hostStart(c,saved,si),2500);else leaveLocal('Не удалось восстановить комнату')}
      else create();
    }else if(!ok&&NETERR.includes(e.type)&&peer===hp){
      try{hp.destroy()}catch(x){}
      if(nt+1<SERVERS.length*3)setTimeout(()=>{if(peer===hp)hostStart(c,saved,si+1,nt+1)},1500);
      else leaveLocal('Не удалось связаться с сигнальным сервером PeerJS ('+e.type+'). Он может быть недоступен или заблокирован провайдером — попробуйте VPN или укажите свой сервер в js/config.js.');
    }else if(!room)leaveLocal('Нет связи с сервером ('+e.type+'). Проверьте интернет и попробуйте ещё раз.');
    else{flash='Ошибка сети: '+e.type;render()}
  });
}
function onMsg(c,m){
  if(!m||!room)return;
  if(m.t==='join'){
    const u=String(m.uid||'').slice(0,20),n=String(m.name||'').trim().slice(0,14)||'Игрок',p=room.players[u];
    if(!u)return;
    if(p&&p.kicked){c.send({t:'kick'});return}
    if(!p||p.left){
      if(p&&room.phase!=='lobby')upd({players:{[u]:{left:false}}});
      else if(room.phase!=='lobby')upd({players:{[u]:{name:n,alive:false,spec:true,joined:Date.now(),left:false}}});
      else{
        if(act(room).length>=room.settings.max){c.send({t:'err',m:'Комната заполнена'});return}
        upd({players:{[u]:{name:n,alive:true,spec:false,joined:Date.now(),left:false}}});
      }
    }
    c.__u=u;conns[u]=c;broadcast();render();
  }else if(m.t==='vote')applyVote(c.__u,m.v);
  else if(m.t==='done')applyDone(c.__u);
  else if(m.t==='guess'){if(room.guess&&room.guess.uid===c.__u)endGuess(m.v)}
  else if(m.t==='pair')addPair(m.a,m.b,c.__u);
  else if(m.t==='desc')applyDesc(c.__u,m.text);
  else if(m.t==='kvs')kvStart(c.__u,m.target);
  else if(m.t==='kvv')kvVote(c.__u,m.v);
  else if(m.t==='leave'&&c.__u){const u=c.__u;delete conns[u];upd({players:{[u]:{left:true}}});setTimeout(()=>{try{c.close()}catch(e){}},200)}
}
function applyVote(u,v){
  if(room.phase!=='vote'||!u||u===v)return;const al=aliveIds(room);
  if(al.includes(u)&&al.includes(v)&&(!room.rv||(room.cands||[]).includes(v)))upd({votes:{[vkey()]:{[u]:v}}});
}
function applyDesc(u,t){
  if(room.phase!=='talk'||!u||!room.players[u]||!room.players[u].alive)return;
  t=String(t||'').trim().slice(0,60);if(t)upd({desc:{[vkey()]:{[u]:t}}});
}
function scoreFor(w){const s=hsecret,old=room.scores||{},sc={};for(const i of Object.keys(s.roles)){if(w==='civ'&&s.roles[i]==='civ')sc[i]=(old[i]||0)+1;if(w==='spy'&&s.roles[i]==='spy')sc[i]=(old[i]||0)+2}return sc}
function endGuess(v){if(room.phase!=='guess'||!room.guess)return;const w=v&&v===hsecret.civ?'spy':'civ',n=Date.now();upd({phase:'result',phaseStart:n,phaseEnd:n+RES_SECS*1000,winner:w,guessPick:v||'',scores:scoreFor(w)})}
function applyDone(u){if(room.phase!=='talk')return;const o=room.order||[],t=room.turn||0;if(t>=o.length||(u!==o[t]&&u!==room.host))return;upd({turn:t+1});if(t+1>=o.length)toVote()}
function addPair(a,b,u){if(!room||room.phase!=='lobby'||!room.players[u]||room.players[u].left)return;a=String(a||'').trim().slice(0,14);b=String(b||'').trim().slice(0,14);const L=room.settings.custom||[];if(!a||!b||a===b||L.length>=30)return;upd({settings:{custom:[...L,[a,b]]}})}
function rmPair(i){upd({settings:{custom:(room.settings.custom||[]).filter((_,k)=>k!==+i)}})}
function kick(v){
  const c=conns[v];upd({players:{[v]:{left:true,kicked:true,alive:false}}});
  if(c){try{c.send({t:'kick'})}catch(e){}setTimeout(()=>{try{c.close()}catch(e){}},200);delete conns[v]}
}
/* ---------- голосование за исключение из комнаты ---------- */
const KV_SECS=20,KV_COOL=30000;
let kvPick=false;
const kvEligible=r=>act(r).map(x=>x[0]).filter(i=>i!==r.kv.target);
function kvStart(u,t){
  if(!room||room.kv||!u||!t||u===t||t===room.host)return;
  const ids=act(room).map(x=>x[0]);
  if(ids.length<3||!ids.includes(u)||!ids.includes(t)||Date.now()<(room.kvCool||0))return;
  upd({kv:{target:t,by:u,end:Date.now()+KV_SECS*1000,votes:{[u]:true}}});
}
function kvVote(u,v){
  if(!room||!room.kv||!kvEligible(room).includes(u))return;
  upd({kv:{votes:{[u]:!!v}}});
}
function kvTick(){
  const k=room.kv;if(!k)return;
  if(!act(room).some(x=>x[0]===k.target)){upd({kv:null});return}
  const el=kvEligible(room),vt=k.votes||{},yes=el.filter(i=>vt[i]===true).length,no=el.filter(i=>vt[i]===false).length;
  if(yes*2>el.length){upd({kv:null,kvCool:0});kick(k.target)}
  else if(no*2>=el.length||yes+no===el.length||Date.now()>=k.end)upd({kv:null,kvCool:Date.now()+KV_COOL});
}
function kvBlock(){
  const k=room.kv;
  if(k){
    kvPick=false;
    const el=kvEligible(room),vt=k.votes||{},yes=el.filter(i=>vt[i]===true).length,no=el.filter(i=>vt[i]===false).length;
    const need=Math.floor(el.length/2)+1,my=vt[uid],left=Math.max(0,Math.ceil((k.end-NOW())/1000));
    return `<div class="card kv"><h2>Исключить ${nm(k.target)}?</h2>
    <p class="mut" style="margin:0 0 10px">Предложил: ${nm(k.by)} · осталось <b id="kvt">${left}</b> с<br>За: ${yes} · против: ${no} · нужно «за»: ${need}</p>
    ${el.includes(uid)?`<div class="row"><button class="ghost ${my===true?'sel':''}" data-a="kvv" data-v="1">${my===true?'✔ ':''}Да</button><button class="ghost ${my===false?'sel':''}" data-a="kvv" data-v="0">${my===false?'✔ ':''}Нет</button></div>`:'<p class="mut" style="margin:0">Вас хотят исключить из комнаты.</p>'}</div>`;
  }
  if(!kvPick)return '';
  const c=act(room).filter(([i])=>i!==uid&&i!==room.host);
  return `<div class="card"><h2>Кого исключить?</h2>${c.length?c.map(([i,p])=>`<button class="vb" data-a="kvs" data-v="${i}">${esc(p.name)}</button>`).join(''):'<p class="mut">Некого исключать.</p>'}
  <button class="ghost" data-a="kvpick" style="width:100%;margin-top:8px">Отмена</button></div>`;
}
function roundPatch(r,n){const now=Date.now();return {phase:'talk',round:n,phaseStart:now,phaseEnd:now+r.settings.time*1000,order:shuffle(aliveIds(r)),turn:0,rv:0,cands:[],guess:null}}
function start(){
  const ids=act(room).map(x=>x[0]),n=ids.length;if(n<4)return;
  const ns=Math.min(room.settings.spies,Math.floor((n-1)/2));
  const spies=shuffle(ids).slice(0,ns),roles={};ids.forEach(i=>roles[i]=spies.includes(i)?'spy':'civ');
  const pool=POOL(room.settings.cat,room.settings.custom||[]);let [a,b]=pool[Math.random()*pool.length|0];if(Math.random()<.5)[a,b]=[b,a];
  const g=String(Date.now()),pl={};ids.forEach(i=>pl[i]={alive:true,spec:false});
  hsecret={game:g,roles,civ:a,spy:b,blind:room.settings.white&&n>=5?spies[0]:''};
  upd({...roundPatch({...room,players:Object.fromEntries(ids.map(i=>[i,{alive:true}]))},1),game:g,spyCount:ns,winner:'',players:pl,lastElim:{uid:'',role:''},tally:[]});
}
function toVote(){const now=Date.now();upd({phase:'vote',phaseStart:now,phaseEnd:now+VOTE_SECS*1000})}
function tally(){
  const s=hsecret;if(!s)throw 0;
  const votes=(room.votes||{})[vkey()]||{},alive=aliveIds(room),cnt={};
  for(const [v,t] of Object.entries(votes))if(alive.includes(v)&&alive.includes(t))cnt[t]=(cnt[t]||0)+1;
  const mx=Math.max(0,...Object.values(cnt));let elim='';
  if(mx>0){const top=Object.keys(cnt).filter(k=>cnt[k]===mx);if(top.length>1&&!room.rv){const n=Date.now();upd({phase:'vote',phaseStart:n,phaseEnd:n+VOTE_SECS*1000,rv:1,cands:top});return}elim=top[Math.random()*top.length|0]}
  let c=0,sp=0;alive.forEach(i=>{if(i!==elim)s.roles[i]==='spy'?sp++:c++});
  const winner=sp===0?'civ':(sp>c||(sp===1&&c===1))?'spy':'';
  const now=Date.now(),gs=winner==='civ'&&elim&&s.roles[elim]==='spy';
  const p={phase:gs?'guess':'result',phaseStart:now,phaseEnd:now+(gs?GUESS_SECS:RES_SECS)*1000,winner:gs?'':winner,lastElim:{uid:elim,role:elim?s.roles[elim]:''},tally:Object.entries(cnt)};
  if(elim)p.players={[elim]:{alive:false}};
  if(gs){const o=shuffle([...new Set(POOL(room.settings.cat,room.settings.custom||[]).flat().filter(x=>x!==s.civ&&x!==s.spy))]).slice(0,3);p.guess={uid:elim,opts:shuffle([s.civ,...o])}}
  else if(winner)p.scores=scoreFor(winner);
  upd(p);
}
function again(){
  const pl={};act(room).forEach(([i])=>pl[i]={alive:true,spec:false});hsecret=null;
  upd({phase:'lobby',winner:'',game:'',round:0,players:pl,lastElim:{uid:'',role:''},tally:[]});
}
function hostTick(){
  if(!room||!isHost)return;
  kvTick();if(room.phase==='lobby')return;
  const key=room.phase+room.game+room.round+(room.rv||0),late=Date.now()>=room.phaseEnd;let fn=null;
  if(room.phase==='talk'&&late)fn=toVote;
  else if(room.phase==='vote'){const v=(room.votes||{})[vkey()]||{};if(late||aliveIds(room).every(i=>v[i]))fn=tally}
  else if(room.phase==='guess'&&late)fn=()=>endGuess('');
  else if(room.phase==='result'&&!room.winner&&late)fn=()=>upd(roundPatch(room,room.round+1));
  if(fn&&busy!==key){busy=key;Promise.resolve().then(fn).catch(()=>{busy=''})}
}

/* ---------- client ---------- */
function connectHost(mode,si,nt){
  si=si||0;nt=nt||0;
  try{peer&&peer.destroy()}catch(e){}
  joined=false;const p=peer=new Peer({...SERVERS[si%SERVERS.length],config:ICE});
  const fail=(m,retry)=>{if(joined||peer!==p)return;clearTimeout(to);
    if(retry&&nt+1<SERVERS.length*2){try{p.destroy()}catch(e){}return connectHost(mode,si+1,nt+1)}
    if(mode==='re')reconnect();else leaveLocal(mode==='silent'?'':m)};
  const to=setTimeout(()=>fail('Комната не найдена или нет связи',true),10000);
  p.on('error',e=>fail(e.type==='peer-unavailable'?'Комната не найдена':'Нет связи с сервером PeerJS ('+e.type+')',true));
  p.on('open',()=>{
    const c=hostConn=p.connect(PFX+code,{reliable:true});
    c.on('open',()=>c.send({t:'join',uid,name:myName}));
    c.on('data',m=>{
      if(m.t==='s'){joined=true;htries=0;clearTimeout(to);skew=m.now-Date.now();room=m.room;secret=m.secret;flash='';
        try{localStorage.setItem('spy_room',code);localStorage.setItem('spy_role','client')}catch(e){}render()}
      else if(m.t==='err')fail(m.m);
      else if(m.t==='kick')leaveLocal('Вас исключили');
      else if(m.t==='closed')leaveLocal('Хост закрыл комнату');
    });
    c.on('close',()=>{if(joined&&code&&!isHost)reconnect()});
  });
}
function reconnect(){
  if(!code)return;
  const cn=act(room).filter(([i])=>i!==room.host).map(x=>x[0]),k=cn.indexOf(uid);
  ++htries;
  if(k>=0&&htries>2+2*k)return takeover();
  if(htries>6+2*cn.length)return leaveLocal('Связь с хостом потеряна');
  flash='Переподключение…';render();setTimeout(()=>{if(code&&!isHost)connectHost('re')},3000);
}

function takeover(){
  const r=JSON.parse(JSON.stringify(room)),pl=r.players;
  if(pl[r.host])pl[r.host].left=true;
  for(const i in pl)if(!pl[i].left)Object.assign(pl[i],{alive:true,spec:false});
  Object.assign(r,{host:uid,phase:'lobby',round:0,game:'',winner:'',kv:null,kvCool:0,lastElim:{uid:'',role:''},tally:[],guess:null,rv:0,cands:[]});
  hostConn=null;joined=false;htries=0;hostStart(code,{room:r,hsecret:null});
}
/* ---------- screens ---------- */
function create(){
  if(!readName()){flash='Введите имя';return home()}
  const A='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c='';for(let i=0;i<4;i++)c+=A[Math.random()*A.length|0];
  flash='';app.innerHTML='<p class="mut" style="text-align:center;margin-top:40vh">Создаём комнату…</p>';hostStart(c,null);
  setTimeout(()=>{if(!isHost&&!room&&code===c)leaveLocal('Не удалось подключиться к серверу комнат (PeerJS). Проверьте интернет, попробуйте VPN или свой сервер (см. README).')},30000);
}
function join(c){
  c=(c||'').trim().toUpperCase();
  if(!readName()){flash='Введите имя';return home()}
  if(c.length!==4){flash='Введите код из 4 символов';return home()}
  flash='';code=c;htries=0;app.innerHTML='<p class="mut" style="text-align:center;margin-top:40vh">Подключаемся…</p>';connectHost('new');
}
function leaveLocal(m){
  const p=peer;peer=null;code=room=secret=null;isHost=false;hostConn=null;hsecret=null;joined=false;skew=0;
  for(const u in conns)delete conns[u];flash=m||'';
  try{['spy_room','spy_role','spy_host'].forEach(k=>localStorage.removeItem(k))}catch(e){}
  try{p&&p.destroy()}catch(e){}home();
}
function leave(){
  if(!isHost)send({t:'leave'});
  setTimeout(()=>leaveLocal(),200);
}
function tickUI(){
  const t=document.getElementById('tm'),b=document.getElementById('bar'),kt=document.getElementById('kvt');
  if(kt&&room&&room.kv)kt.textContent=Math.max(0,Math.ceil((room.kv.end-NOW())/1000));
  if(!t||!room)return;
  const left=Math.max(0,Math.ceil((room.phaseEnd-NOW())/1000)),tot=Math.max(1,(room.phaseEnd-room.phaseStart)/1000);
  t.textContent=String(Math.floor(left/60))+':'+String(left%60).padStart(2,'0');
  if(b)b.style.width=Math.min(100,left/tot*100)+'%';
  if(left>0&&left<=3&&(room.phase==='talk'||room.phase==='vote')&&lastBeep!==left+room.phase){lastBeep=left+room.phase;beep(900,.08)}
}
setInterval(()=>{tickUI();hostTick()},300);
function head(){
  return `<div class="row" style="align-items:center;margin-top:4px"><div style="flex:1"><b>Комната ${esc(code)}</b> ${room.round?`<span class="tag">раунд ${room.round}</span>`:''}</div>${!room.kv&&act(room).length>=3&&NOW()>=(room.kvCool||0)?`<button class="ghost" data-a="kvpick" title="Голосование за исключение" style="flex:0 0 auto;padding:8px 12px">🗳</button>`:''}<button class="ghost" data-a="leave" style="flex:0 0 auto;padding:8px 12px">Выйти</button></div>${flash?`<div class="err">${esc(flash)}</div>`:''}`;
}
let lastPk='',actx=null,lastBeep='';
document.addEventListener('click',()=>{try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();actx.resume()}catch(e){}});
function beep(f,d=.15,t=0){try{if(!actx)return;const o=actx.createOscillator(),g=actx.createGain();o.frequency.value=f;g.gain.value=.08;o.connect(g);g.connect(actx.destination);o.start(actx.currentTime+t);o.stop(actx.currentTime+t+d)}catch(e){}}
function sfx(p){({talk:[[660,0]],vote:[[520,0],[780,.18]],result:[[440,0],[330,.2]]}[p]||[]).forEach(([f,t])=>beep(f,.15,t));try{navigator.vibrate&&navigator.vibrate(p==='result'?[80,60,80]:60)}catch(e){}}
function render(){
  if(!code||!room)return;
  const ae=document.activeElement;if(ae&&ae.matches&&ae.matches('#rt,#ds,#pa,#pb'))return;
  const p=room.phase,pk=p+room.game+room.round+(room.rv||0);if(pk!==lastPk){if(lastPk)sfx(p);lastPk=pk}
  app.innerHTML=head()+kvBlock()+(p==='lobby'?lobby():p==='talk'?talk():p==='guess'?guess():p==='vote'?vote():result());
  tickUI();
}
function lobby(){
  const pl=act(room),n=pl.length,H=room.host===uid,s=room.settings,sc=room.scores||{};
  const seg=(vals,cur,a,lab=x=>x,dis=()=>false)=>`<div class="row seg">${vals.map(v=>`<button data-a="${a}" data-v="${v}" class="${v===cur?'on':''}" ${H&&!dis(v)?'':'disabled'}>${lab(v)}</button>`).join('')}</div>`;
  return `<div class="card"><h2>Код комнаты</h2><div class="code">${esc(code)}</div><button class="ghost" data-a="copy" style="width:100%;margin:8px 0">Скопировать ссылку</button><p class="mut" style="text-align:center;margin-bottom:0">Друзья вводят его на главной странице</p></div>
  <div class="card"><h2>Игроки ${n}/${s.max}</h2>${pl.map(([i,p])=>`<div class="pl"><span>${esc(p.name)}${i===uid?' (вы)':''}${sc[i]?` <span class="tag">${sc[i]} оч.</span>`:''}</span>${i===room.host?'<span class="tag">хост</span>':(H?`<button class="ghost" data-a="kick" data-v="${i}" style="flex:0 0 auto;padding:4px 10px">✕</button>`:'')}</div>`).join('')}</div>
  <div class="card"><h2>Настройки ${H?'':'(задаёт хост)'}</h2>
  <p class="mut" style="margin:0 0 6px">Максимум игроков</p>${seg([4,5,6,7,8],s.max,'max',x=>x,v=>v<n)}
  <p class="mut" style="margin:14px 0 6px">Шпионов</p>${seg([1,2],s.spies,'spies')}
  <p class="mut" style="margin:14px 0 6px">Тема картинок</p>${seg(['all',...Object.keys(CATS),'custom'],s.cat||'all','cat',x=>x==='all'?'Все':x==='custom'?'Свои':x,v=>v==='custom'&&!(s.custom||[]).length)}
  <p class="mut" style="margin:14px 0 6px">Слепой шпион (без картинки, от 5 игроков)</p>${seg([0,1],s.white?1:0,'white',x=>x?'Вкл':'Выкл')}
  <p class="mut" style="margin:14px 0 6px">Текстовые описания (если общаетесь голосом — выключите)</p>${seg([0,1],s.text?1:0,'text',x=>x?'Вкл':'Выкл')}
  <p class="mut" style="margin:14px 0 6px">Время раунда: <b id="tl">${fmt(s.time)}</b></p><input type="range" id="rt" min="30" max="180" step="15" value="${s.time}" ${H?'':'disabled'}>
  ${s.spies===2&&n<5?'<p class="mut">Два шпиона возможны от 5 игроков — иначе будет один.</p>':''}</div>
  ${customCard(s,H)}
  ${H?`<button data-a="start" style="width:100%" ${n>=4?'':'disabled'}>${n>=4?'Начать игру':'Нужно минимум 4 игрока'}</button>`:'<p class="mut" style="text-align:center">Ждём, пока хост начнёт игру…</p>'}`;
}
function customCard(s,H){return `<div class="card"><h2>Свои пары</h2>${(s.custom||[]).map(([a,b],k)=>`<div class="pl"><span>${esc(a)} ↔ ${esc(b)}</span>${H?`<button class="ghost" data-a="rmpair" data-v="${k}" style="flex:0 0 auto;padding:4px 10px">✕</button>`:''}</div>`).join('')}<div class="row"><input type="text" id="pa" maxlength="14" placeholder="Мирным"><input type="text" id="pb" maxlength="14" placeholder="Шпиону"><button data-a="addpair" style="flex:0 0 auto">+</button></div><p class="mut" style="margin-bottom:0">Слова или эмодзи — добавлять может любой игрок. Выберите тему «Свои» или оставьте «Все».</p></div>`}
function turnBtn(){const o=room.order||[],t=room.turn||0;if(t>=o.length)return '';return o[t]===uid?'<button data-a="done" style="width:100%;margin-bottom:8px">Я закончил</button>':(room.host===uid?`<button data-a="done" class="ghost" style="width:100%;margin-bottom:8px">Пропустить: ${nm(o[t])}</button>`:'')}
function guess(){const g=room.guess||{},m=g.uid===uid;return `${timer()}<div class="big">${nm(g.uid)} — шпион!</div><div class="card"><h2>${m?'Угадайте картинку мирных':'Шпион пытается угадать вашу картинку'}</h2>${m?(g.opts||[]).map(o=>`<button class="vb" data-a="guess" data-v="${esc(o)}">${esc(o)}</button>`).join('')+'<p class="mut" style="margin-bottom:0">Угадаете — шпионы всё равно победят.</p>':'<p class="mut" style="margin:0">Не подсказывайте!</p>'}</div>`}
const glLine=()=>room.guess&&room.guess.uid?`<p class="mut" style="text-align:center">Шпион ${room.guessPick?'выбрал '+esc(room.guessPick)+(room.winner==='spy'?' — угадал!':' — мимо'):'не успел угадать'}</p>`:'';
function pic(){
  const s=mySecret(),r=s&&s.roles[uid],bl=s&&s.blind===uid;
  if(s&&!r)return '<div class="card"><h2>Вы наблюдатель</h2><p class="mut" style="margin:0">Смотрите за игрой — в следующей партии вы будете играть.</p></div>';
  return `<div class="card"><h2>Ваша картинка</h2><div class="pic pop" id="pic" ${s&&r&&!bl?`data-hold="1" data-p="${esc(s[r])}" style="user-select:none;-webkit-user-select:none;touch-action:none;cursor:pointer${[...s[r]].length>3?';font-size:34px;word-break:break-word':''}"`:''}>${s&&r?(bl?'❓':hold?esc(s[r]):'👆'):'…'}</div><p class="mut" style="text-align:center;margin:0">${bl?'Ваша картинка скрыта. Слушайте других и притворяйтесь!':'Удерживайте картинку, чтобы её увидеть. Опишите её, не называя прямо. Ваша картинка может отличаться от остальных.'}</p></div>`;
}
function timer(){return `<div class="card"><div class="tm" id="tm">0:00</div><div class="bar"><i id="bar"></i></div></div>`}
function me(){return room.players[uid]&&room.players[uid].alive}
function talk(){
  const d=(room.desc||{})[vkey()]||{};
  return `${timer()}${pic()}<div class="card"><h2>Очередь описаний</h2>${(room.order||[]).map((i,k)=>`<div class="pl ${room.players[i]&&room.players[i].alive?'':'dead'} ${k===(room.turn||0)?'cur':k<(room.turn||0)?'dn':''}"><span>${k===(room.turn||0)?'🎤 ':''}${k+1}. ${nm(i)}${i===uid?' (вы)':''}${d[i]?`<br><span class="mut">${esc(d[i])}</span>`:''}</span></div>`).join('')}
  ${turnBtn()}<p class="mut">${me()?(room.settings.text?'Говорите по очереди или напишите описание ниже. Потом — голосование.':'Описывайте картинку голосом по очереди. Потом — голосование.'):'Вы выбыли — наблюдайте.'}</p>${me()&&room.settings.text?'<div class="row"><input type="text" id="ds" maxlength="60" placeholder="Ваше описание…"><button data-a="desc" style="flex:0 0 auto">OK</button></div>':''}</div>
  ${room.host===uid?'<button data-a="tovote" class="ghost" style="width:100%">Перейти к голосованию</button>':''}`;
}
function vote(){
  const v=(room.votes||{})[vkey()]||{},al=aliveIds(room);
  return `<div class="big">${room.rv?'Ничья! Переголосование':'Кто шпион?'}</div>${timer()}<div class="card">
  ${me()?al.filter(i=>i!==uid&&(!room.rv||(room.cands||[]).includes(i))).map(i=>`<button class="vb ${v[uid]===i?'sel':''}" data-a="vote" data-v="${i}">${v[uid]===i?'✔ ':''}${nm(i)}</button>`).join(''):'<p class="mut">Вы выбыли — наблюдайте.</p>'}
  <p class="mut" style="margin-bottom:0">Проголосовали: ${al.filter(i=>v[i]).length}/${al.length}</p></div>`;
}
function result(){
  const L=room.lastElim||{},s=mySecret(),w=room.winner;
  let h=`<div class="card"><div class="big">${L.uid?`${nm(L.uid)} выбывает`:'Никто не выбыл'}</div>`;
  if(L.uid)h+=`<p style="text-align:center;margin:0">Он был <b>${L.role==='spy'?'шпионом 🕵️':'мирным'}</b></p>`;
  if((room.tally||[]).length)h+=`<p class="mut" style="text-align:center">Голоса: ${room.tally.map(([i,c])=>`${nm(i)} — ${c}`).join(', ')}</p>`;
  h+='</div>';
  if(!w)return h+timer()+'<p class="mut" style="text-align:center">Следующий раунд скоро начнётся…</p>';
  h+=`<div class="card"><div class="big">${w==='spy'?'🕵️ Победили шпионы!':'🎉 Победили мирные!'}</div>${glLine()}`;
  if(s)h+=`<p class="mut" style="text-align:center">Мирные видели ${s.civ}, шпионы видели ${s.spy}</p>`+act(room).map(([i])=>`<div class="pl ${room.players[i].alive?'':'dead'}"><span>${nm(i)}</span><span class="tag">${s.roles[i]==='spy'?'шпион':'мирный'}</span></div>`).join('');
  h+='</div>';
  const sb=Object.entries(room.scores||{}).sort((a,b)=>b[1]-a[1]);
  if(sb.length)h+=`<div class="card"><h2>Счёт</h2>${sb.map(([i,v])=>`<div class="pl"><span>${nm(i)}</span><b>${v}</b></div>`).join('')}</div>`;
  return h+(room.host===uid?'<button data-a="again" style="width:100%">Реванш</button>':'<p class="mut" style="text-align:center">Ждём новую игру от хоста…</p>');
}

const hupd=p=>{if(isHost)upd(p)};
app.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b||b.disabled)return;const a=b.dataset.a,v=b.dataset.v;
  if(a==='create')return create();if(a==='join')return join(document.getElementById('cd').value);
  if(a==='leave')return leave();if(!room)return;
  if(a==='desc')return sendDesc();
  if(a==='copy'){const u=location.href.split('#')[0].split('?')[0]+'?room='+code;try{navigator.clipboard.writeText(u).then(()=>{b.textContent='Скопировано ✔'},()=>prompt('Ссылка:',u))}catch(x){prompt('Ссылка:',u)}return}
  if(a==='done'){isHost?applyDone(uid):send({t:'done'});return}
  if(a==='guess'){if(room.guess&&room.guess.uid===uid)isHost?endGuess(v):send({t:'guess',v});return}
  if(a==='addpair'){const A=document.getElementById('pa'),B=document.getElementById('pb');if(A&&B)isHost?addPair(A.value,B.value,uid):send({t:'pair',a:A.value,b:B.value});return}
  if(a==='kvpick'){kvPick=!kvPick;return render()}
  if(a==='kvs'){kvPick=false;isHost?kvStart(uid,v):send({t:'kvs',target:v});return}
  if(a==='kvv'){isHost?kvVote(uid,v==='1'):send({t:'kvv',v:v==='1'});return}
  if(a==='vote'){if(me()&&room.phase==='vote'){isHost?applyVote(uid,v):send({t:'vote',v})}return}
  if(!isHost)return;
  if(a==='start')start();else if(a==='max')hupd({settings:{max:+v}});else if(a==='spies')hupd({settings:{spies:+v}});
  else if(a==='cat')hupd({settings:{cat:v}});else if(a==='white')hupd({settings:{white:v==='1'}});else if(a==='text')hupd({settings:{text:v==='1'}});
  else if(a==='kick')kick(v);else if(a==='rmpair')rmPair(v);else if(a==='tovote')toVote();else if(a==='again')again();
});
app.addEventListener('input',e=>{if(e.target.id==='rt')document.getElementById('tl').textContent=fmt(+e.target.value)});
app.addEventListener('change',e=>{if(e.target.id==='rt')hupd({settings:{time:+e.target.value}})});
function sendDesc(){const el=document.getElementById('ds'),t=el&&el.value.trim();if(!t||!me())return;isHost?applyDesc(uid,t):send({t:'desc',text:t});el.value='';el.blur()}
app.addEventListener('focusout',()=>setTimeout(render,80));
app.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='ds')sendDesc()});
app.addEventListener('pointerdown',e=>{const t=e.target.closest('[data-hold]');if(t){hold=true;t.textContent=t.dataset.p}});
const unhold=()=>{if(!hold)return;hold=false;const t=document.getElementById('pic');if(t)t.textContent='👆'};
['pointerup','pointercancel'].forEach(n=>document.addEventListener(n,unhold));window.addEventListener('blur',unhold);
app.addEventListener('contextmenu',e=>{if(e.target.closest('[data-hold]'))e.preventDefault()});
(function(){
  const q=(new URLSearchParams(location.search).get('room')||'').toUpperCase().slice(0,4);
  try{
    const r=localStorage.getItem('spy_role'),c=localStorage.getItem('spy_room');
    if(q&&q!==c){}
    else if(r==='host'){const s=JSON.parse(localStorage.getItem('spy_host')||'null');
      if(s&&s.code===c&&Date.now()-s.t<216e5){myName=(s.room.players[uid]||{}).name||myName;hostStart(c,s);return}}
    else if(r==='client'&&c&&myName){code=c;connectHost('silent');return}
  }catch(e){}
  if(q){prefill=q;if(myName&&q.length===4){join(q);return}}
  home();
})();
