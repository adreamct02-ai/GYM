import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const SCORES={5:{emoji:"🦁",label:"체단실 괴물",color:"#FFD700",glow:"rgba(255,215,0,0.25)"},4:{emoji:"💪",label:"헬스 고인물",color:"#C084FC",glow:"rgba(192,132,252,0.2)"},3:{emoji:"⚔️",label:"평균 전사",color:"#60A5FA",glow:"rgba(96,165,250,0.2)"},2:{emoji:"🐣",label:"헬린이",color:"#4ADE80",glow:"rgba(74,222,128,0.2)"},1:{emoji:"🥚",label:"짬지",color:"#6B7280",glow:"rgba(107,114,128,0.12)"}};
const C={bg:"#07090C",bg2:"#0D1117",bg3:"#141A22",bg4:"#1A2230",border:"#1A2030",border2:"#222C3A",accent:"#C8A942",text:"#E4E0D2",text2:"#7A7E8A",text3:"#323845"};
const LIFT_LABELS=[{key:"bench",icon:"🏋️",label:"벤치프레스"},{key:"dead",icon:"⚡",label:"데드리프트"},{key:"ohp",icon:"🔥",label:"오버헤드프레스"}];
const RANKS=["이병","일병","상병","병장"];
const RANK_COLORS={"이병":"#6B7280","일병":"#60A5FA","상병":"#4ADE80","병장":"#FFD700"};
const MOS_LIST=["보병","포병","기갑","공병","통신","화학","의무","군사경찰","정보","항공","기타"];
const MOS_COLORS={"보병":"#EF4444","포병":"#F97316","기갑":"#EAB308","공병":"#84CC16","통신":"#06B6D4","화학":"#8B5CF6","의무":"#EC4899","군사경찰":"#F59E0B","정보":"#3B82F6","항공":"#10B981","기타":"#6B7280"};
const CHALLENGE_MSGS=[(a,b,l)=>`⚔️ ${a}이(가) ${b}에게 ${l} 도전장!`,(a,b,l)=>`💀 ${a} vs ${b} — ${l} 결투! 진 쪽이 청소당번`,(a,b,l)=>`🎯 오늘 ${a}의 타겟은 ${b}! ${l}로 찍어눌러라`,(a,b,l)=>`🔥 ${b}, ${a}한테 ${l} 딸림 판정 받기 전에 기록 올려라`];
const TAUNT_TPLS=["곧 잡는다, 각오해라 👊","그 기록이 최선이야? 😂","나 한 달만 기다려봐","헬스 얼마나 했다고 ㅋㅋ","기록 올려봤자 내가 씹어먹음","다음 주에 네 순위 뺏는다"];
const ACH={first_record:{emoji:"🎖️",title:"신병의 첫 발걸음",desc:"첫 기록 등록"},club_100:{emoji:"💯",title:"100클럽",desc:"합계 100kg 달성"},club_200:{emoji:"🔥",title:"200클럽",desc:"합계 200kg 달성"},club_300:{emoji:"💀",title:"300클럽",desc:"합계 300kg 달성"},club_400:{emoji:"🦁",title:"400클럽",desc:"합계 400kg 달성"},top1:{emoji:"👑",title:"정상의 맛",desc:"전체 1위 달성"},streak7:{emoji:"🗓️",title:"출석귀신",desc:"7일 연속 출석"},score5:{emoji:"🏅",title:"괴물 인증",desc:"점수 5점 달성"},pb5:{emoji:"📈",title:"기록제조기",desc:"신기록 5회 달성"},taunt3:{emoji:"😈",title:"도발의 달인",desc:"도발 3회 발송"}};

function calcRatio(b,d,o,w,h){const t=(+b||0)+(+d||0)+(+o||0);if(!t||!+w)return 0;return t/+w-(+h-170)*0.008;}
function calcScore(b,d,o,w,h){const r=calcRatio(b,d,o,w,h);if(r>=4.5)return 5;if(r>=3.2)return 4;if(r>=2.2)return 3;if(r>=1.3)return 2;return 1;}
function getToday(){return new Date().toLocaleDateString("ko-KR");}
function getWeekStart(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-d.getDay());return d.toISOString();}
function genCode(){return Math.random().toString(36).substr(2,6).toUpperCase();}
function compressPhoto(file){return new Promise(res=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const S=160,c=document.createElement("canvas");c.width=c.height=S;const ctx=c.getContext("2d"),sc=Math.max(S/img.width,S/img.height);ctx.drawImage(img,(S-img.width*sc)/2,(S-img.height*sc)/2,img.width*sc,img.height*sc);URL.revokeObjectURL(url);res(c.toDataURL("image/jpeg",0.75));};img.src=url;});}

function GlowInput({placeholder,value,onChange,type="text",style:s={}}){
  return <input type={type} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}
    style={{width:"100%",padding:"12px 16px",background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:6,fontSize:15,outline:"none",transition:"border-color .2s",...s}}
    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border2}/>;
}

function GrowthChart({data}){
  if(!data||data.length<2)return <p style={{color:C.text3,fontSize:12,textAlign:"center",padding:"16px 0"}}>기록 2개 이상부터 그래프가 표시됩니다</p>;
  const sorted=[...data].sort((a,b)=>new Date(a.recorded_at)-new Date(b.recorded_at)).slice(-15);
  const vals=sorted.map(d=>d.total),mn=Math.min(...vals)*0.92,mx=Math.max(...vals)*1.06;
  const W=300,H=100,PX=8,PY=12;
  const px=i=>PX+(i/(sorted.length-1))*(W-PX*2);
  const py=v=>H-PY-((v-mn)/(mx-mn||1))*(H-PY*2);
  const pts=sorted.map((d,i)=>`${px(i)},${py(d.total)}`).join(" ");
  const area=`${px(0)},${H} ${pts} ${px(sorted.length-1)},${H}`;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",display:"block"}}>
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.accent} stopOpacity=".35"/><stop offset="100%" stopColor={C.accent} stopOpacity="0"/></linearGradient></defs>
      <polygon points={area} fill="url(#cg)"/>
      <polyline points={pts} fill="none" stroke={C.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {sorted.map((d,i)=>(<circle key={i} cx={px(i)} cy={py(d.total)} r={d.is_personal_best?5:2.5} fill={d.is_personal_best?"#FFD700":C.accent} stroke={C.bg} strokeWidth={d.is_personal_best?1.5:0}/>))}
      <text x={px(sorted.length-1)} y={py(vals[vals.length-1])-6} fill={C.accent} fontSize={10} textAnchor="middle" fontFamily="'Oswald',sans-serif" fontWeight="700">{vals[vals.length-1]}kg</text>
    </svg>
  );
}

export default function App(){
  const [page,setPage]=useState("init");
  const [rankTab,setRankTab]=useState("all");
  const [recTab,setRecTab]=useState("fame");
  const [soldiers,setSoldiers]=useState([]);
  const [units,setUnits]=useState([]);
  const [liftHistory,setLiftHistory]=useState([]);
  const [votes,setVotes]=useState([]);
  const [taunts,setTaunts]=useState([]);
  const [achData,setAchData]=useState([]);
  const [weeklyKing,setWeeklyKing]=useState(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [toast,setToast]=useState(null);

  const [myId,setMyId]=useState(null);
  const [myUnitCode,setMyUnitCode]=useState(null);

  const [codeInput,setCodeInput]=useState("");
  const [foundUnit,setFoundUnit]=useState(null);
  const [newUnit,setNewUnit]=useState({division:"",brigade:"",company:"",post:""});
  const [createdCode,setCreatedCode]=useState(null);

  const [regStep,setRegStep]=useState(1);
  const [reg,setReg]=useState({name:"",height:"",weight:"",photo:null,rankName:"",mos:"",unitCode:"",division:"",brigade:"",company:"",post:""});
  const [lifts,setLifts]=useState({bench:"",dead:"",ohp:""});
  const [editId,setEditId]=useState(null);

  const [battleA,setBattleA]=useState("");
  const [battleB,setBattleB]=useState("");
  const [teamA,setTeamA]=useState("");
  const [teamB,setTeamB]=useState("");

  const [comments,setComments]=useState({});
  const [openComment,setOpenComment]=useState(null);
  const [cForm,setCForm]=useState({name:"",content:""});
  const [cLoading,setCLoading]=useState(false);

  const [voteName,setVoteName]=useState("");
  const [voteTarget,setVoteTarget]=useState("");
  const [challenge,setChallenge]=useState(null);
  const [showChallenge,setShowChallenge]=useState(false);

  const [openTaunt,setOpenTaunt]=useState(null);
  const [tauntMsg,setTauntMsg]=useState("");
  const [tauntCustom,setTauntCustom]=useState("");
  const [isBet,setIsBet]=useState(false);
  const [betDeadline,setBetDeadline]=useState("");

  const fileRef=useRef();
  const commentEndRef=useRef();

  useEffect(()=>{
    const el=document.createElement("style");
    el.textContent=`@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Oswald:wght@500;600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap');*{box-sizing:border-box;margin:0;padding:0}body{background:#07090C;overflow-x:hidden}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#07090C}::-webkit-scrollbar-thumb{background:#1E2530;border-radius:2px}input,textarea,button,select{font-family:'Noto Sans KR',sans-serif}input::placeholder,textarea::placeholder{color:#8A9BB0}@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}@keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}@keyframes toastIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}@keyframes modalIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}.fu{animation:fadeUp .45s ease both}.fi{animation:fadeIn .25s ease both}.ri{animation:fadeUp .4s ease both}.ri:nth-child(1){animation-delay:.04s}.ri:nth-child(2){animation-delay:.08s}.ri:nth-child(3){animation-delay:.12s}.ri:nth-child(4){animation-delay:.16s}.ri:nth-child(5){animation-delay:.20s}.ri:nth-child(6){animation-delay:.24s}.ri:nth-child(7){animation-delay:.28s}.ri:nth-child(8){animation-delay:.32s}`;
    document.head.appendChild(el);
  },[]);

  useEffect(()=>{
    try{const s=localStorage.getItem("gym_id");if(s){const{id,uc}=JSON.parse(s);setMyId(id);setMyUnitCode(uc);}}catch(e){}
  },[]);

  async function loadSoldiers(){const{data}=await supabase.from("soldiers").select("*").order("created_at",{ascending:true});setSoldiers(data||[]);return data||[];}
  async function loadUnits(){const{data}=await supabase.from("unit_codes").select("*");setUnits(data||[]);return data||[];}
  async function loadHistory(){const{data}=await supabase.from("lift_history").select("*").order("recorded_at",{ascending:false}).limit(400);setLiftHistory(data||[]);return data||[];}
  async function loadVotes(){const{data}=await supabase.from("votes").select("*");setVotes(data||[]);}
  async function loadTaunts(){const{data}=await supabase.from("taunts").select("*").order("created_at",{ascending:false}).limit(100);setTaunts(data||[]);}
  async function loadAchievements(){const{data}=await supabase.from("achievements").select("*");setAchData(data||[]);}
  async function loadComments(id){const{data}=await supabase.from("comments").select("*").eq("soldier_id",id).order("created_at",{ascending:true});setComments(p=>({...p,[id]:data||[]}));}

  function computeKing(history,sols){
    const ws=getWeekStart(),tw=history.filter(h=>h.recorded_at>=ws),cnt={};
    tw.forEach(h=>{cnt[h.soldier_id]=(cnt[h.soldier_id]||0)+1;});
    const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(top){const s=sols.find(s=>s.id===top);setWeeklyKing(s?{...s,wc:cnt[top]}:null);}else setWeeklyKing(null);
  }

  useEffect(()=>{(async()=>{const[s,h]=await Promise.all([loadSoldiers(),loadHistory()]);await Promise.all([loadUnits(),loadVotes(),loadTaunts(),loadAchievements()]);computeKing(h,s);setPage("landing");})();},[]);

  useEffect(()=>{
    const ch=supabase.channel("gym-v4")
      .on("postgres_changes",{event:"*",schema:"public",table:"soldiers"},loadSoldiers)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comments"},payload=>{
        const c=payload.new;setComments(p=>({...p,[c.soldier_id]:[...(p[c.soldier_id]||[]),c]}));
        setTimeout(()=>commentEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"lift_history"},async payload=>{
        const[h,s]=await Promise.all([loadHistory(),loadSoldiers()]);computeKing(h,s);
        if(payload.new?.is_personal_best){
          const sol=s.find(x=>x.id===payload.new.soldier_id);
          if(sol&&sol.unit_code===myUnitCode&&sol.id!==myId)showToast(`🏆 ${sol.name} 신기록! ${payload.new.total}kg`,"best");
        }
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"votes"},loadVotes)
      .on("postgres_changes",{event:"*",schema:"public",table:"unit_codes"},loadUnits)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"taunts"},payload=>{
        loadTaunts();
        const t=payload.new;
        if(t.to_id===myId){const fr=soldiers.find(s=>s.id===t.from_id);showToast(`😈 ${fr?.name||"누군가"}이(가) 도발했다!`,"taunt");}
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"achievements"},payload=>{
        if(payload.new?.soldier_id===myId){const a=ACH[payload.new.key];if(a)showToast(`🏅 업적 달성: ${a.title}`,"best");}
        loadAchievements();
      })
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[myId,myUnitCode,soldiers]);

  async function checkAchievements(soldier,allSoldiers,history){
    if(!soldier?.id)return;
    const sh=history.filter(h=>h.soldier_id===soldier.id);
    const total=(soldier.bench||0)+(soldier.dead||0)+(soldier.ohp||0);
    const sc=calcScore(soldier.bench,soldier.dead,soldier.ohp,soldier.weight,soldier.height);
    const isTop1=[...allSoldiers].filter(s=>s.bench||s.dead||s.ohp).sort((a,b)=>calcRatio(b.bench,b.dead,b.ohp,b.weight,b.height)-calcRatio(a.bench,a.dead,a.ohp,a.weight,a.height))[0]?.id===soldier.id;
    const pbCnt=sh.filter(h=>h.is_personal_best).length;
    const myTaunts=taunts.filter(t=>t.from_id===soldier.id).length;
    const toAward=[];
    if(sh.length>=1)toAward.push("first_record");
    if(total>=100)toAward.push("club_100");
    if(total>=200)toAward.push("club_200");
    if(total>=300)toAward.push("club_300");
    if(total>=400)toAward.push("club_400");
    if(isTop1)toAward.push("top1");
    if((soldier.streak||0)>=7)toAward.push("streak7");
    if(sc>=5)toAward.push("score5");
    if(pbCnt>=5)toAward.push("pb5");
    if(myTaunts>=3)toAward.push("taunt3");
    for(const key of toAward){await supabase.from("achievements").upsert({soldier_id:soldier.id,key},{onConflict:"soldier_id,key"});}
  }

  const today=getToday();
  const mySoldier=soldiers.find(s=>s.id===myId);
  const myUnit=units.find(u=>u.code===myUnitCode);
  const ranked=[...soldiers].filter(u=>u.bench||u.dead||u.ohp).sort((a,b)=>calcRatio(b.bench,b.dead,b.ohp,b.weight,b.height)-calcRatio(a.bench,a.dead,a.ohp,a.weight,a.height));
  const myUnitRanked=ranked.filter(s=>s.unit_code===myUnitCode);
  const totalPower=soldiers.reduce((s,u)=>s+(u.bench||0)+(u.dead||0)+(u.ohp||0),0);
  const jjamji=ranked.length>1?ranked[ranked.length-1]:null;
  const voteCounts={};votes.forEach(v=>{voteCounts[v.target_id]=(voteCounts[v.target_id]||0)+1;});
  const voteRanked=Object.entries(voteCounts).sort((a,b)=>b[1]-a[1]);
  const improveRanked=[...soldiers].filter(u=>(u.bench||u.dead||u.ohp)&&(u.prev_bench||u.prev_dead||u.prev_ohp)).map(u=>{const cur=(u.bench||0)+(u.dead||0)+(u.ohp||0),prev=(u.prev_bench||0)+(u.prev_dead||0)+(u.prev_ohp||0);return{...u,improveRate:prev>0?(cur-prev)/prev*100:0,curTotal:cur,prevTotal:prev};}).sort((a,b)=>b.improveRate-a.improveRate);
  const teamRankings=Object.entries(ranked.reduce((acc,s)=>{if(!s.unit_code)return acc;if(!acc[s.unit_code])acc[s.unit_code]={sols:[],unit:units.find(u=>u.code===s.unit_code)};acc[s.unit_code].sols.push(s);return acc;},{})).map(([code,{sols,unit}])=>({code,unit,sols,count:sols.length,avgScore:sols.reduce((sum,s)=>sum+calcScore(s.bench,s.dead,s.ohp,s.weight,s.height),0)/sols.length,totalPow:sols.reduce((sum,s)=>sum+(s.bench||0)+(s.dead||0)+(s.ohp||0),0)})).sort((a,b)=>b.avgScore-a.avgScore);

  const myAch=achData.filter(a=>a.soldier_id===myId).map(a=>a.key);

  function showToast(msg,type="info"){setToast({msg,type});setTimeout(()=>setToast(null),3500);}

  async function lookupCode(){setError(null);const{data}=await supabase.from("unit_codes").select("*").eq("code",codeInput.toUpperCase().trim()).single();if(data)setFoundUnit(data);else setError("존재하지 않는 코드입니다");}

  async function createUnit(){if(!newUnit.division||!newUnit.brigade||!newUnit.company)return;setLoading(true);const code=genCode();const{error:e}=await supabase.from("unit_codes").insert({code,division:newUnit.division,brigade:newUnit.brigade,company:newUnit.company,post:newUnit.post||null});if(e){setError("생성 실패: "+e.message);setLoading(false);return;}await loadUnits();setCreatedCode(code);setReg(r=>({...r,unitCode:code,...newUnit}));setLoading(false);}

  async function doRegister(){
    setLoading(true);setError(null);
    const{data:ins,error:e}=await supabase.from("soldiers").insert({name:reg.name,height:+reg.height,weight:+reg.weight,bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,photo:reg.photo||null,rank_name:reg.rankName,mos:reg.mos,unit_code:reg.unitCode,division:reg.division,brigade:reg.brigade,company:reg.company,post:reg.post||null,updated_at:today,last_record_date:today,streak:1}).select();
    if(e){setError("등록 실패: "+e.message);setLoading(false);return;}
    if(ins?.[0]){
      const id=ins[0].id;
      await supabase.from("lift_history").insert({soldier_id:id,bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,total:+lifts.bench+(+lifts.dead)+(+lifts.ohp),is_personal_best:true});
      try{localStorage.setItem("gym_id",JSON.stringify({id,uc:reg.unitCode}));}catch(e){}
      setMyId(id);setMyUnitCode(reg.unitCode);
      const[s,h]=await Promise.all([loadSoldiers(),loadHistory()]);computeKing(h,s);
      await checkAchievements(ins[0],s,h);
    }
    setReg({name:"",height:"",weight:"",photo:null,rankName:"",mos:"",unitCode:"",division:"",brigade:"",company:"",post:""});
    setLifts({bench:"",dead:"",ohp:""});setRegStep(1);setLoading(false);showToast("등록 완료! 🎖️","info");setPage("rankings");
  }

  async function doUpdateLifts(){
    setLoading(true);setError(null);
    const user=soldiers.find(u=>u.id===editId);
    const oldTotal=(user?.bench||0)+(user?.dead||0)+(user?.ohp||0),newTotal=+lifts.bench+(+lifts.dead)+(+lifts.ohp);
    const isPB=newTotal>oldTotal&&oldTotal>0;
    const yest=new Date(Date.now()-86400000).toLocaleDateString("ko-KR");
    let streak=1;
    if(user?.last_record_date===today)streak=user.streak||1;
    else if(user?.last_record_date===yest)streak=(user?.streak||0)+1;
    const oldRank=ranked.findIndex(u=>u.id===editId)+1;
    await supabase.from("soldiers").update({bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,prev_bench:user?.bench,prev_dead:user?.dead,prev_ohp:user?.ohp,streak,last_record_date:today,updated_at:today}).eq("id",editId);
    await supabase.from("lift_history").insert({soldier_id:editId,bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,total:newTotal,is_personal_best:isPB});
    const newSols=await loadSoldiers();const h=await loadHistory();computeKing(h,newSols);
    const nr=[...newSols].filter(u=>u.bench||u.dead||u.ohp).sort((a,b)=>calcRatio(b.bench,b.dead,b.ohp,b.weight,b.height)-calcRatio(a.bench,a.dead,a.ohp,a.weight,a.height));
    const newRank=nr.findIndex(u=>u.id===editId)+1;
    const updatedUser=newSols.find(u=>u.id===editId);
    await checkAchievements(updatedUser,newSols,h);
    setLifts({bench:"",dead:"",ohp:""});setEditId(null);setLoading(false);
    if(isPB)showToast(`🏆 신기록! 합계 ${newTotal}kg!`,"best");
    else if(oldRank>0&&newRank>0&&newRank<oldRank)showToast(`↑${oldRank-newRank}위 상승! ${newRank}위 🔥`,"up");
    else if(oldRank>0&&newRank>0&&newRank>oldRank)showToast(`↓${newRank-oldRank}위 하락 ${newRank}위`,"down");
    else showToast(`기록 갱신! ${newRank}위 🔥`,"info");
    setPage("rankings");
  }

  async function sendTaunt(toId){
    if(!myId)return;
    const msg=tauntCustom.trim()||tauntMsg;
    if(!msg)return;
    await supabase.from("taunts").insert({from_id:myId,to_id:toId,message:msg,is_bet:isBet,deadline:isBet?betDeadline:null});
    await checkAchievements(mySoldier,soldiers,liftHistory);
    setOpenTaunt(null);setTauntMsg("");setTauntCustom("");setIsBet(false);setBetDeadline("");
    showToast("도발 발송 완료 😈","taunt");
  }

  async function addComment(){if(!cForm.name.trim()||!cForm.content.trim())return;setCLoading(true);await supabase.from("comments").insert({soldier_id:openComment,name:cForm.name.trim(),content:cForm.content.trim()});setCForm({name:"",content:""});setCLoading(false);}
  async function toggleComment(id){if(openComment===id){setOpenComment(null);return;}setOpenComment(id);if(!comments[id])await loadComments(id);}
  async function doVote(){if(!voteName.trim()||!voteTarget)return;const{error:e}=await supabase.from("votes").upsert({target_id:voteTarget,voter_name:voteName.trim()},{onConflict:"voter_name"});if(e){showToast("투표 실패","down");return;}await loadVotes();setVoteName("");setVoteTarget("");showToast("투표 완료! 🗳️","info");}
  function doChallenge(){if(soldiers.length<2)return;const sh=[...soldiers].sort(()=>Math.random()-.5);const[a,b]=[sh[0],sh[1]];const lift=LIFT_LABELS[Math.floor(Math.random()*3)].label;const tmpl=CHALLENGE_MSGS[Math.floor(Math.random()*CHALLENGE_MSGS.length)];setChallenge(tmpl(a.name,b.name,lift));setShowChallenge(true);}

  const Btn=({children,onClick,disabled,color,style:s={}})=>(<button onClick={onClick} disabled={disabled||loading} style={{background:disabled||loading?C.bg3:color||C.accent,color:disabled||loading?C.text3:color?"#fff":"#000",border:"none",borderRadius:7,padding:"13px 20px",fontSize:15,fontWeight:900,cursor:disabled||loading?"default":"pointer",transition:"all .15s",...s}}>{loading?"처리 중...":children}</button>);
  const Ghost=({children,onClick,style:s={}})=>(<button onClick={onClick} style={{background:"transparent",border:`1px solid ${C.border2}`,color:C.text2,borderRadius:7,padding:"13px 20px",fontSize:14,fontWeight:700,cursor:"pointer",...s}}>{children}</button>);
  const ErrBanner=()=>error?(<div style={{background:"#3B1A1A",border:"1px solid #7F2A2A",borderRadius:8,padding:"10px 14px",marginBottom:16,color:"#FF7A7A",fontSize:13}}>⚠️ {error}<button onClick={()=>setError(null)} style={{float:"right",background:"none",border:"none",color:"#FF7A7A",cursor:"pointer",fontSize:16}}>×</button></div>):null;
  const RankBadge=({r})=>r?(<span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:4,background:(RANK_COLORS[r]||"#6B7280")+"20",color:RANK_COLORS[r]||"#6B7280",border:`1px solid ${(RANK_COLORS[r]||"#6B7280")}40`}}>{r}</span>):null;
  const MosBadge=({m})=>m?(<span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:4,background:(MOS_COLORS[m]||"#6B7280")+"20",color:MOS_COLORS[m]||"#6B7280"}}>{m}</span>):null;
  const UnitTag=({s})=>s?.company?(<span style={{fontSize:10,color:C.text3}}>{s.company}{s.post?` ${s.post}`:""}</span>):null;
  const ScorePreview=({bench,dead,ohp,weight,height})=>{if(!bench||!dead||!ohp)return null;const sc=calcScore(bench,dead,ohp,weight,height),info=SCORES[sc];return(<div className="fi" style={{background:info.color+"10",border:`1px solid ${info.color}40`,borderRadius:10,padding:16,textAlign:"center",marginBottom:20}}><div style={{fontSize:36,marginBottom:4}}>{info.emoji}</div><div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:22,color:info.color}}>{sc}점</div><div style={{color:info.color+"CC",fontSize:13,marginTop:2}}>{info.label}</div></div>);};
  const TB={up:"#166534",down:"#7F1D1D",best:"#78350F",info:"#1A1500",taunt:"#1A0F2E"};
  const TBB={up:"#22C55E",down:"#EF4444",best:"#FFD700",info:C.accent,taunt:"#C084FC"};
  const NavBtn=({p,icon,label})=>(<button onClick={()=>setPage(p)} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:page===p?C.accent:C.text3,transition:"color .15s",padding:"8px 0"}}><span style={{fontSize:20}}>{icon}</span><span style={{fontSize:9,fontFamily:"'Noto Sans KR',sans-serif",fontWeight:700}}>{label}</span></button>);
  const BottomNav=()=>(<div style={{position:"fixed",bottom:0,left:0,right:0,background:C.bg2,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:30,paddingBottom:"env(safe-area-inset-bottom)"}}><NavBtn p="rankings" icon="🏆" label="랭킹"/><NavBtn p="team_battle" icon="🏴" label="부대전"/><NavBtn p="taunt_feed" icon="🔥" label="도발"/><NavBtn p="my_profile" icon="👤" label="내기록"/><NavBtn p="records" icon="💀" label="기록"/></div>);

  const SoldierCard=({user,idx})=>{
    const sc=calcScore(user.bench,user.dead,user.ohp,user.weight,user.height),info=SCORES[sc];
    const total=(user.bench||0)+(user.dead||0)+(user.ohp||0),isTop3=idx<3,isMe=user.id===myId;
    const medals=["🥇","🥈","🥉"],isOpen=openComment===user.id,isJjamji=jjamji?.id===user.id&&ranked.length>1;
    const uc=comments[user.id]||[];
    const userAch=achData.filter(a=>a.soldier_id===user.id);
    const tauntCount=taunts.filter(t=>t.to_id===user.id).length;
    return(
      <div className="ri" style={{background:isMe?`linear-gradient(140deg,${C.bg2} 60%,rgba(200,169,66,.05))`:isTop3?`linear-gradient(140deg,${C.bg2} 60%,${info.color}08)`:C.bg2,border:`1px solid ${isMe?C.accent+"50":isTop3?info.color+"35":isJjamji?"#EF444440":C.border}`,borderRadius:12,marginBottom:8,overflow:"hidden",boxShadow:isTop3?`0 4px 24px ${info.glow}`:isMe?`0 0 16px rgba(200,169,66,.1)`:"none",animationDelay:`${idx*.055}s`}}>
        <div style={{padding:"12px 14px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,textAlign:"center",flexShrink:0}}>{isTop3?<span style={{fontSize:22}}>{medals[idx]}</span>:<span style={{fontFamily:"'Oswald',sans-serif",fontSize:17,fontWeight:700,color:C.text3}}>#{idx+1}</span>}</div>
            <div style={{flexShrink:0,position:"relative"}}>
              {user.photo?<img src={user.photo} style={{width:50,height:50,borderRadius:"50%",objectFit:"cover",border:`2px solid ${info.color}50`}}/>:<div style={{width:50,height:50,borderRadius:"50%",background:C.bg4,border:`2px solid ${C.border2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>👤</div>}
              {isJjamji&&<div style={{position:"absolute",bottom:-3,right:-3,background:"#EF4444",borderRadius:"50%",width:18,height:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,border:`2px solid ${C.bg}`}}>🎯</div>}
              {isMe&&<div style={{position:"absolute",top:-3,right:-3,background:C.accent,borderRadius:"50%",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,border:`2px solid ${C.bg}`,fontWeight:900,color:"#000",fontFamily:"'Noto Sans KR',sans-serif"}}>나</div>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,flexWrap:"wrap"}}>
                <span style={{fontWeight:900,fontSize:15,color:C.text}}>{user.name}</span>
                <span style={{fontSize:14}}>{info.emoji}</span>
                <RankBadge r={user.rank_name}/><MosBadge m={user.mos}/>
                {user.streak>1&&<span style={{fontSize:11,color:"#FB923C",fontWeight:700}}>🔥{user.streak}</span>}
              </div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
                {[["벤치",user.bench],["데드",user.dead],["OHP",user.ohp]].map(([l,v])=>(<span key={l} style={{fontSize:11}}><span style={{color:C.text3}}>{l} </span><span style={{fontFamily:"'Oswald',sans-serif",fontWeight:600,color:C.text,fontSize:12}}>{v}</span></span>))}
                <UnitTag s={user}/>
              </div>
              {userAch.length>0&&<div style={{display:"flex",gap:3,marginTop:4,flexWrap:"wrap"}}>{userAch.slice(0,5).map(a=>{const ad=ACH[a.key];return ad?<span key={a.key} title={ad.title} style={{fontSize:13}}>{ad.emoji}</span>:null;})}{userAch.length>5&&<span style={{fontSize:10,color:C.text3}}>+{userAch.length-5}</span>}</div>}
            </div>
            <div style={{flexShrink:0,background:info.color+"14",border:`1px solid ${info.color}45`,borderRadius:8,padding:"4px 10px",textAlign:"center"}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:24,fontWeight:700,color:info.color,lineHeight:1}}>{sc}</div><div style={{fontSize:9,color:info.color+"88"}}>/ 5</div></div>
          </div>
          <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{display:"flex",gap:3}}>{[1,2,3,4,5].map(i=><div key={i} style={{width:6,height:6,borderRadius:2,background:i<=sc?info.color:C.border2}}/>)}</div>
              <span style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:11,color:info.color}}>{info.label}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:10,color:C.text3}}>합계 <span style={{fontFamily:"'Oswald',sans-serif",color:C.text2,fontWeight:600}}>{total}kg</span></span>
              {myId&&user.id!==myId&&<button onClick={()=>{setOpenTaunt(user.id);setTauntMsg("");setTauntCustom("");setIsBet(false);}} style={{background:"#2A1A4A",border:"1px solid #C084FC40",borderRadius:5,padding:"3px 8px",cursor:"pointer",color:"#C084FC",fontSize:11,fontFamily:"'Noto Sans KR',sans-serif",transition:"all .15s"}}>😈{tauntCount>0?` ${tauntCount}`:""}</button>}
              <button onClick={()=>toggleComment(user.id)} style={{background:isOpen?C.accent+"18":"none",border:`1px solid ${isOpen?C.accent+"60":C.border2}`,borderRadius:5,padding:"3px 9px",cursor:"pointer",color:isOpen?C.accent:C.text2,fontSize:11,fontFamily:"'Noto Sans KR',sans-serif",transition:"all .15s"}}>💬 {uc.length}</button>
            </div>
          </div>
        </div>
        {isOpen&&(<div className="fi" style={{background:C.bg,borderTop:`1px solid ${C.border}`,padding:"10px 14px"}}>
          {uc.length>0?(<div style={{maxHeight:150,overflowY:"auto",display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>{uc.map(c=>(<div key={c.id} style={{background:C.bg2,borderRadius:6,padding:"6px 10px"}}><span style={{color:C.accent,fontWeight:700,fontSize:11}}>{c.name}</span><span style={{color:C.text3,fontSize:9,marginLeft:5}}>{new Date(c.created_at).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}</span><p style={{color:C.text,marginTop:2,fontSize:12,lineHeight:1.5}}>{c.content}</p></div>))}<div ref={commentEndRef}/></div>):<p style={{color:C.text3,fontSize:12,marginBottom:8}}>첫 댓글을 남겨보세요!</p>}
          <div style={{display:"flex",gap:6}}><input placeholder="이름" value={cForm.name} onChange={e=>setCForm(f=>({...f,name:e.target.value}))} style={{width:76,padding:"7px 10px",flexShrink:0,background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:5,color:C.text,fontSize:12,outline:"none"}}/><input placeholder="댓글" value={cForm.content} onChange={e=>setCForm(f=>({...f,content:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey)addComment();}} style={{flex:1,padding:"7px 10px",background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:5,color:C.text,fontSize:12,outline:"none"}}/><button onClick={addComment} disabled={cLoading} style={{background:C.accent,border:"none",borderRadius:5,padding:"7px 12px",cursor:"pointer",fontWeight:900,color:"#000",fontSize:13,flexShrink:0}}>↑</button></div>
        </div>)}
      </div>
    );
  };

  return(
    <>
    {page==="init"&&(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:40,animation:"pulse 1.4s infinite"}}>🏋️</div><p style={{color:C.text3,fontFamily:"monospace",fontSize:12,marginTop:12}}>체단실 접속 중...</p></div></div>)}

    {page==="landing"&&(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
        <div style={{position:"fixed",inset:0,backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`,backgroundSize:"48px 48px",opacity:.35,pointerEvents:"none"}}/>
        <div style={{position:"fixed",left:0,right:0,height:"2px",background:"linear-gradient(transparent,rgba(200,169,66,.15),transparent)",animation:"scanline 6s linear infinite",pointerEvents:"none"}}/>
        <div className="fu" style={{position:"relative",textAlign:"center",maxWidth:380,width:"100%"}}>
          <div style={{fontSize:68,marginBottom:6,filter:"drop-shadow(0 0 20px rgba(200,169,66,.5))"}}>🏋️</div>
          <h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:34,color:C.accent,letterSpacing:"0.04em",marginBottom:4,textShadow:"0 0 30px rgba(200,169,66,.4)"}}>체단실 랭킹</h1>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:20}}><div style={{height:1,width:40,background:C.border2}}/><p style={{color:C.text2,fontSize:12,letterSpacing:"0.14em"}}>전군 파워리프팅 순위</p><div style={{height:1,width:40,background:C.border2}}/></div>
          {mySoldier&&myUnit&&(<div className="fi" style={{background:C.bg3,border:`1px solid ${C.accent}40`,borderRadius:10,padding:"10px 14px",marginBottom:16,textAlign:"left"}}><div style={{display:"flex",alignItems:"center",gap:10}}>{mySoldier.photo?<img src={mySoldier.photo} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:40,height:40,borderRadius:"50%",background:C.bg4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{fontWeight:900,color:C.text,fontSize:14}}>{mySoldier.name}</span><RankBadge r={mySoldier.rank_name}/><MosBadge m={mySoldier.mos}/></div><div style={{color:C.text3,fontSize:11,marginTop:1}}>{myUnit.division} {myUnit.brigade} {myUnit.company}</div></div><div style={{textAlign:"right"}}><div style={{fontSize:11,color:C.accent,fontWeight:700}}>{myAch.length}개 업적</div></div></div></div>)}
          <ErrBanner/>
          <div style={{display:"flex",flexDirection:"column",gap:9,width:"100%",marginBottom:12}}>
            {mySoldier?(<><Btn onClick={()=>{setEditId(myId);setLifts({bench:mySoldier.bench||"",dead:mySoldier.dead||"",ohp:mySoldier.ohp||""});setPage("lifts");}} style={{width:"100%",padding:14,fontSize:16}}>🔥 내 기록 갱신하기</Btn><Ghost onClick={()=>setPage("rankings")} style={{width:"100%",padding:13,fontSize:15,color:C.text}}>🏆 랭킹 보기</Ghost></>):(<><Btn onClick={()=>{setFoundUnit(null);setCodeInput("");setPage("join");}} style={{width:"100%",padding:15,fontSize:16}}>⚔️ 부대코드로 입장하기</Btn><Ghost onClick={()=>{setCreatedCode(null);setNewUnit({division:"",brigade:"",company:"",post:""});setPage("create_unit");}} style={{width:"100%",padding:13,fontSize:15,color:C.text}}>🏴 새 부대 등록하기</Ghost>{ranked.length>0&&<button onClick={()=>setPage("rankings")} style={{background:"none",border:"none",color:C.text3,fontSize:13,cursor:"pointer",padding:8,fontFamily:"'Noto Sans KR',sans-serif"}}>📊 랭킹 구경하기 →</button>}</>)}
          </div>
          {soldiers.length>0&&<p style={{color:C.text3,fontSize:11}}>전체 {soldiers.length}명 · {units.length}개 부대</p>}
        </div>
      </div>
    )}

    {page==="join"&&(<div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:400,width:"100%"}} className="fu"><button onClick={()=>setPage("landing")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer",marginBottom:24}}>←</button><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>부대코드 입력</h2><p style={{color:C.text2,fontSize:14,marginBottom:24}}>중대 관리자에게 받은 6자리 코드를 입력하세요</p><ErrBanner/><div style={{display:"flex",gap:8,marginBottom:14}}><GlowInput placeholder="예: AB1C2D" value={codeInput} onChange={v=>setCodeInput(v.toUpperCase())} style={{letterSpacing:"0.2em",fontSize:20,textAlign:"center"}}/><Btn onClick={lookupCode} disabled={!codeInput.trim()} style={{flexShrink:0,padding:"0 16px"}}>확인</Btn></div>{foundUnit&&(<div className="fi" style={{background:"#0A1A0A",border:"1px solid #22C55E40",borderRadius:10,padding:16,marginBottom:14}}><div style={{color:"#22C55E",fontSize:12,fontWeight:700,marginBottom:6}}>✓ 부대 확인</div><div style={{color:C.text,fontWeight:900,fontSize:16}}>{foundUnit.division} {foundUnit.brigade}</div><div style={{color:C.text2,fontSize:14,marginTop:2}}>{foundUnit.company}{foundUnit.post?` · ${foundUnit.post}`:""}</div><Btn onClick={()=>{setReg(r=>({...r,unitCode:foundUnit.code,division:foundUnit.division,brigade:foundUnit.brigade,company:foundUnit.company,post:foundUnit.post||""}));setRegStep(1);setPage("register");}} style={{width:"100%",padding:13,marginTop:14}}>이 부대로 가입하기 →</Btn></div>)}<div style={{textAlign:"center",marginTop:16}}><button onClick={()=>{setCreatedCode(null);setNewUnit({division:"",brigade:"",company:"",post:""});setPage("create_unit");}} style={{background:"none",border:"none",color:C.text3,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>코드가 없으신가요? 새 부대 등록 →</button></div></div></div>)}

    {page==="create_unit"&&(<div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:400,width:"100%"}} className="fu"><button onClick={()=>setPage("landing")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer",marginBottom:24}}>←</button><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>새 부대 등록</h2><p style={{color:C.text2,fontSize:14,marginBottom:24}}>부대코드를 생성하고 소대원들과 공유하세요</p><ErrBanner/>{!createdCode?(<><div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}><GlowInput placeholder="사단 (예: 제5보병사단)" value={newUnit.division} onChange={v=>setNewUnit(u=>({...u,division:v}))}/><GlowInput placeholder="여단/연대 (예: 제11보병여단)" value={newUnit.brigade} onChange={v=>setNewUnit(u=>({...u,brigade:v}))}/><GlowInput placeholder="중대 (예: 3중대)" value={newUnit.company} onChange={v=>setNewUnit(u=>({...u,company:v}))}/><GlowInput placeholder="소초/소대 (선택)" value={newUnit.post} onChange={v=>setNewUnit(u=>({...u,post:v}))}/></div><Btn onClick={createUnit} disabled={!newUnit.division||!newUnit.brigade||!newUnit.company} style={{width:"100%",padding:14}}>🏴 부대코드 생성하기</Btn></>):(<div className="fi"><div style={{background:"linear-gradient(135deg,#0A2A0A,#051505)",border:"1px solid #22C55E40",borderRadius:12,padding:24,textAlign:"center",marginBottom:16}}><div style={{color:C.text2,fontSize:13,marginBottom:8}}>생성된 부대코드</div><div style={{fontFamily:"'Oswald',sans-serif",fontSize:48,fontWeight:700,color:"#22C55E",letterSpacing:"0.2em",marginBottom:8}}>{createdCode}</div><div style={{color:C.text,fontWeight:700,fontSize:14}}>{newUnit.division} {newUnit.brigade}</div><div style={{color:C.text2,fontSize:13}}>{newUnit.company}{newUnit.post?` · ${newUnit.post}`:""}</div><div style={{marginTop:16}}><img src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${createdCode}&bgcolor=0A2A0A&color=4ADE80`} style={{borderRadius:8}} alt="QR코드"/></div><p style={{color:"#4ADE80",fontSize:12,marginTop:8}}>QR코드를 게시판에 붙여도 됩니다</p></div><Btn onClick={()=>{setRegStep(1);setPage("register");}} style={{width:"100%",padding:14}}>내 프로필 등록하기 →</Btn></div>)}</div></div>)}

    {page==="register"&&(<div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:400,width:"100%"}} className="fu"><div style={{display:"flex",gap:5,marginBottom:32}}>{[1,2,3].map(i=><div key={i} style={{flex:1,height:3,borderRadius:3,background:i<=regStep?C.accent:C.bg3,transition:"background .3s"}}/>)}</div><ErrBanner/>{regStep===1&&(<><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>계급 · 병과 선택</h2><p style={{color:C.text2,fontSize:14,marginBottom:24}}>부대: <span style={{color:C.accent}}>{reg.company||reg.unitCode}</span></p><div style={{marginBottom:20}}><div style={{color:C.text2,fontSize:13,marginBottom:10}}>⭐ 계급</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{RANKS.map(r=>(<button key={r} onClick={()=>setReg(x=>({...x,rankName:r}))} style={{padding:"12px",borderRadius:8,border:`1px solid ${reg.rankName===r?(RANK_COLORS[r]||C.accent):C.border2}`,background:reg.rankName===r?(RANK_COLORS[r]||C.accent)+"18":C.bg3,color:reg.rankName===r?(RANK_COLORS[r]||C.accent):C.text2,fontWeight:700,fontSize:15,cursor:"pointer",transition:"all .15s",fontFamily:"'Noto Sans KR',sans-serif"}}>{r}</button>))}</div></div><div style={{marginBottom:24}}><div style={{color:C.text2,fontSize:13,marginBottom:10}}>🔫 병과</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{MOS_LIST.map(m=>(<button key={m} onClick={()=>setReg(x=>({...x,mos:m}))} style={{padding:"9px 4px",borderRadius:7,border:`1px solid ${reg.mos===m?(MOS_COLORS[m]||C.accent):C.border2}`,background:reg.mos===m?(MOS_COLORS[m]||C.accent)+"18":C.bg3,color:reg.mos===m?(MOS_COLORS[m]||C.accent):C.text2,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all .15s",fontFamily:"'Noto Sans KR',sans-serif"}}>{m}</button>))}</div></div><Btn onClick={()=>{if(reg.rankName&&reg.mos)setRegStep(2);}} disabled={!reg.rankName||!reg.mos} style={{width:"100%",padding:14}}>다음 →</Btn></>)}{regStep===2&&(<><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>신병 정보 입력</h2><p style={{color:C.text2,fontSize:14,marginBottom:24}}><RankBadge r={reg.rankName}/>{" "}<MosBadge m={reg.mos}/></p><div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:24}}><button onClick={()=>fileRef.current?.click()} style={{width:100,height:100,borderRadius:"50%",background:reg.photo?"none":C.bg3,border:`2px dashed ${reg.photo?"transparent":C.border2}`,cursor:"pointer",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>{reg.photo?<img src={reg.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:30}}>📷</span>}</button><input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){const c=await compressPhoto(f);setReg(r=>({...r,photo:c}));}}}/><p style={{color:C.text3,fontSize:11,marginTop:6}}>프로필 사진 (선택)</p></div><div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}><GlowInput placeholder="이름 (예: 김상병)" value={reg.name} onChange={v=>setReg(r=>({...r,name:v}))}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><GlowInput placeholder="키 (cm)" value={reg.height} onChange={v=>setReg(r=>({...r,height:v}))} type="number"/><GlowInput placeholder="몸무게 (kg)" value={reg.weight} onChange={v=>setReg(r=>({...r,weight:v}))} type="number"/></div></div><div style={{display:"flex",gap:10}}><Ghost onClick={()=>setRegStep(1)} style={{flex:1,padding:13}}>← 이전</Ghost><Btn onClick={()=>{if(reg.name&&reg.height&&reg.weight)setRegStep(3);}} disabled={!reg.name||!reg.height||!reg.weight} style={{flex:2,padding:13}}>다음 →</Btn></div></>)}{regStep===3&&(<><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>1RM 입력</h2><p style={{color:C.text2,fontSize:14,marginBottom:24}}><span style={{color:C.accent}}>{reg.name}</span>, 최대 중량을 입력하세요</p>{LIFT_LABELS.map(({key,icon,label})=>(<div key={key} style={{marginBottom:12}}><label style={{color:C.text2,fontSize:13,display:"block",marginBottom:6}}>{icon} {label}</label><GlowInput placeholder={`${label} 1RM (kg)`} value={lifts[key]} onChange={v=>setLifts(l=>({...l,[key]:v}))} type="number"/></div>))}<div style={{marginTop:8,marginBottom:4}}><ScorePreview bench={lifts.bench} dead={lifts.dead} ohp={lifts.ohp} weight={reg.weight} height={reg.height}/></div><div style={{display:"flex",gap:10,marginTop:8}}><Ghost onClick={()=>setRegStep(2)} style={{flex:1,padding:13}}>← 이전</Ghost><Btn onClick={()=>{if(lifts.bench&&lifts.dead&&lifts.ohp)doRegister();}} disabled={!lifts.bench||!lifts.dead||!lifts.ohp} style={{flex:2,padding:13}}>🎖️ 등록 완료</Btn></div></>)}</div></div>)}

    {page==="lifts"&&(()=>{const user=soldiers.find(u=>u.id===editId);return(<div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{maxWidth:400,width:"100%"}} className="fu"><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}><button onClick={()=>setPage(myId===editId?"landing":"select")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer"}}>←</button><div><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:26,color:C.text}}>기록 갱신</h2><p style={{color:C.text2,fontSize:13}}>{user?.name}{user?.streak>0&&<span style={{marginLeft:8,color:"#FB923C"}}>🔥{user.streak}일 연속</span>}</p></div></div><ErrBanner/>{LIFT_LABELS.map(({key,icon,label})=>(<div key={key} style={{marginBottom:12}}><label style={{color:C.text2,fontSize:13,display:"block",marginBottom:6}}>{icon} {label}{user?.[key]&&<span style={{color:C.text3,marginLeft:8,fontSize:11}}>현재 {user[key]}kg</span>}</label><GlowInput placeholder={`${label} 1RM (kg)`} value={lifts[key]} onChange={v=>setLifts(l=>({...l,[key]:v}))} type="number"/></div>))}<div style={{marginTop:8,marginBottom:4}}><ScorePreview bench={lifts.bench} dead={lifts.dead} ohp={lifts.ohp} weight={user?.weight} height={user?.height}/></div><div style={{display:"flex",gap:10,marginTop:8}}><Ghost onClick={()=>setPage(myId===editId?"landing":"rankings")} style={{flex:1,padding:13}}>취소</Ghost><Btn onClick={()=>{if(lifts.bench&&lifts.dead&&lifts.ohp)doUpdateLifts();}} disabled={!lifts.bench||!lifts.dead||!lifts.ohp} style={{flex:2,padding:13}}>🔥 갱신하기</Btn></div></div></div>);})()} 

    {page==="select"&&(<div style={{minHeight:"100vh",background:C.bg,padding:"24px 16px"}}><div style={{maxWidth:480,margin:"0 auto"}}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,paddingTop:8}}><button onClick={()=>setPage("rankings")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer"}}>←</button><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:22,color:C.text}}>병사 선택</h2></div><div className="fu" style={{display:"flex",flexDirection:"column",gap:6}}>{soldiers.map(u=>{const has=u.bench||u.dead||u.ohp,info=has?SCORES[calcScore(u.bench,u.dead,u.ohp,u.weight,u.height)]:null;return(<button key={u.id} onClick={()=>{setEditId(u.id);setLifts({bench:u.bench||"",dead:u.dead||"",ohp:u.ohp||""});setPage("lifts");}} style={{display:"flex",alignItems:"center",gap:10,background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:10,padding:"10px 13px",cursor:"pointer",textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent+"60"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border2}>{u.photo?<img src={u.photo} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>:<div style={{width:40,height:40,borderRadius:"50%",background:C.bg4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{fontWeight:900,color:C.text,fontSize:14}}>{u.name}</span><RankBadge r={u.rank_name}/><MosBadge m={u.mos}/></div><div style={{color:C.text2,fontSize:11,marginTop:1}}>{has?`벤치 ${u.bench} · 데드 ${u.dead} · OHP ${u.ohp}`:"기록 없음"}</div></div>{info&&<span style={{fontSize:17}}>{info.emoji}</span>}</button>);})}</div></div></div>)}

    {page==="rankings"&&(
      <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Sans KR',sans-serif",paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20}}>
          <div><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:17,color:C.accent}}>🏋️ 체단실 랭킹</h1><p style={{color:C.text3,fontSize:10,marginTop:1}}>{ranked.length}명 · {units.length}부대</p></div>
          <div style={{display:"flex",gap:5}}><button onClick={()=>setPage("select")} style={{background:C.bg4,border:`1px solid ${C.border2}`,color:C.text,padding:"6px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700}}>🔥 갱신</button><button onClick={()=>{setFoundUnit(null);setCodeInput("");setPage("join");}} style={{background:C.accent,border:"none",color:"#000",padding:"6px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:900}}>+ 등록</button><button onClick={()=>setPage("landing")} style={{background:"none",border:`1px solid ${C.border}`,color:C.text3,padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:11}}>🏠</button></div>
        </div>
        <div style={{padding:"10px 12px",maxWidth:520,margin:"0 auto"}}>
          <div style={{background:`linear-gradient(135deg,${C.bg2},${C.bg3})`,border:`1px solid ${C.border2}`,borderRadius:12,padding:"11px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{color:C.text3,fontSize:10,letterSpacing:"0.1em",marginBottom:2}}>⚡ 전군 총 전투력</div><div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,color:C.accent}}>{totalPower.toLocaleString()}<span style={{fontSize:12,marginLeft:3,color:C.text2}}>kg</span></div></div>
            <div style={{textAlign:"right"}}><div style={{color:C.text3,fontSize:10}}>사단 최강자</div>{ranked.length>0&&<div style={{color:"#FFD700",fontWeight:900,fontSize:13}}>{ranked[0]?.name} 👑</div>}</div>
          </div>
          {weeklyKing&&(<div className="fi" style={{background:"linear-gradient(135deg,#3A2800,#1A1500)",border:"1px solid #C8A94250",borderRadius:10,padding:"9px 13px",marginBottom:7,display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:22}}>👑</span><div style={{flex:1}}><div style={{color:C.accent,fontSize:10,fontWeight:700}}>이주의 갱신왕</div><div style={{color:C.text,fontWeight:900,fontSize:14}}>{weeklyKing.name}</div></div><div style={{textAlign:"right"}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:19,color:C.accent,fontWeight:700}}>{weeklyKing.wc}</div><div style={{color:C.text3,fontSize:9}}>회 갱신</div></div></div>)}
          <button onClick={doChallenge} style={{width:"100%",background:"linear-gradient(135deg,#1A1A2E,#16213E)",border:"1px solid #4A4A8A40",borderRadius:9,padding:9,cursor:"pointer",fontSize:11,color:"#8080CC",fontWeight:700,marginBottom:9,fontFamily:"'Noto Sans KR',sans-serif"}}>🎰 오늘의 도전 뽑기</button>
          <div style={{display:"flex",gap:4,marginBottom:9,overflowX:"auto",paddingBottom:2}}>
            {[["all","🌐 전체"],["myunit","🏠 내부대"],["rank","⭐ 계급"],["mos","🔫 병과"],["improve","📈 상승률"],["attend","📅 출석"]].map(([t,l])=>(<button key={t} onClick={()=>setRankTab(t)} style={{flexShrink:0,padding:"6px 10px",borderRadius:7,border:"none",cursor:"pointer",background:rankTab===t?C.accent:C.bg3,color:rankTab===t?"#000":C.text2,fontSize:10,fontWeight:900,fontFamily:"'Noto Sans KR',sans-serif",transition:"all .15s"}}>{l}</button>))}
          </div>
          {rankTab==="all"&&(ranked.length===0?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:48,marginBottom:12}}>🥚</div><p>아직 기록이 없습니다</p></div>:ranked.map((u,i)=><SoldierCard key={u.id} user={u} idx={i}/>))}
          {rankTab==="myunit"&&(!myUnitCode?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><p style={{marginBottom:12}}>로그인 후 이용 가능합니다</p><Btn onClick={()=>setPage("join")} style={{fontSize:13,padding:"10px 20px"}}>부대코드 입장</Btn></div>:myUnitRanked.length===0?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><p>내 부대 기록이 없습니다</p></div>:myUnitRanked.map((u,i)=><SoldierCard key={u.id} user={u} idx={i}/>))}
          {rankTab==="rank"&&(<div>{RANKS.slice().reverse().map(rn=>{const rs=ranked.filter(s=>s.rank_name===rn);if(!rs.length)return null;return(<div key={rn} style={{marginBottom:18}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{width:7,height:7,borderRadius:"50%",background:RANK_COLORS[rn]||"#6B7280"}}/><span style={{color:RANK_COLORS[rn]||"#6B7280",fontWeight:900,fontSize:13,fontFamily:"'Black Han Sans',sans-serif"}}>{rn}</span><span style={{color:C.text3,fontSize:11}}>{rs.length}명</span></div>{rs.slice(0,5).map((u,i)=><SoldierCard key={u.id} user={u} idx={i}/>)}</div>);})}</div>)}
          {rankTab==="mos"&&(<div>{MOS_LIST.map(m=>{const ms=ranked.filter(s=>s.mos===m);if(!ms.length)return null;return(<div key={m} style={{marginBottom:18}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{width:7,height:7,borderRadius:"50%",background:MOS_COLORS[m]||"#6B7280"}}/><span style={{color:MOS_COLORS[m]||"#6B7280",fontWeight:900,fontSize:13,fontFamily:"'Black Han Sans',sans-serif"}}>{m}</span><span style={{color:C.text3,fontSize:11}}>{ms.length}명</span></div>{ms.slice(0,5).map((u,i)=><SoldierCard key={u.id} user={u} idx={i}/>)}</div>);})}</div>)}
          {rankTab==="improve"&&(improveRanked.length===0?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:40,marginBottom:12}}>📈</div><p>기록을 한 번 갱신하면 표시됩니다</p></div>:improveRanked.map((u,i)=>{const up=u.improveRate>0;return(<div key={u.id} className="ri" style={{background:C.bg2,border:`1px solid ${up?"#22C55E30":C.border}`,borderRadius:12,marginBottom:7,padding:"12px 13px",animationDelay:`${i*.055}s`}}><div style={{display:"flex",alignItems:"center",gap:9}}><div style={{width:26,textAlign:"center",fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:700,color:C.text3,flexShrink:0}}>#{i+1}</div>{u.photo?<img src={u.photo} style={{width:42,height:42,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>:<div style={{width:42,height:42,borderRadius:"50%",background:C.bg4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{fontWeight:900,color:C.text,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/><MosBadge m={u.mos}/></div><div style={{fontSize:11,color:C.text3,marginTop:2}}>{u.prevTotal}kg → <span style={{color:C.text}}>{u.curTotal}kg</span></div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:up?"#22C55E":"#EF4444"}}>{up?"+":""}{u.improveRate.toFixed(1)}%</div></div></div></div>);})}
          {rankTab==="attend"&&(()=>{const att=soldiers.filter(u=>u.last_record_date===today),abs=soldiers.filter(u=>u.last_record_date!==today);return(<div><div style={{marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}><div style={{width:6,height:6,borderRadius:"50%",background:"#22C55E"}}/><span style={{color:"#22C55E",fontSize:12,fontWeight:700}}>오늘 출석 ({att.length}명)</span></div>{att.length===0?<p style={{color:C.text3,fontSize:12,padding:"8px 0"}}>오늘 아직 아무도 안 갔습니다 💀</p>:att.map(u=>(<div key={u.id} style={{display:"flex",alignItems:"center",gap:9,background:"#052010",border:"1px solid #22C55E25",borderRadius:9,padding:"9px 13px",marginBottom:5}}>{u.photo?<img src={u.photo} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:34,height:34,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{color:C.text,fontWeight:700,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/></div></div>{u.streak>1&&<span style={{fontSize:11,color:"#FB923C"}}>🔥{u.streak}일</span>}<span style={{color:"#22C55E",fontSize:12}}>✓</span></div>))}</div><div><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}><div style={{width:6,height:6,borderRadius:"50%",background:"#EF4444"}}/><span style={{color:"#EF4444",fontSize:12,fontWeight:700}}>결석 ({abs.length}명)</span></div>{abs.map(u=>(<div key={u.id} style={{display:"flex",alignItems:"center",gap:9,background:C.bg2,border:"1px solid #EF444425",borderRadius:9,padding:"9px 13px",marginBottom:5,opacity:.65}}>{u.photo?<img src={u.photo} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:34,height:34,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{color:C.text2,fontWeight:700,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/></div></div><span style={{color:"#EF4444",fontSize:11}}>🥚</span></div>))}</div></div>);})()} 
          {rankTab==="all"&&soldiers.filter(u=>!u.bench&&!u.dead&&!u.ohp).length>0&&(<div style={{marginTop:16}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{flex:1,height:1,background:C.border}}/><span style={{color:C.text3,fontSize:10,whiteSpace:"nowrap"}}>짬지 예약석</span><div style={{flex:1,height:1,background:C.border}}/></div>{soldiers.filter(u=>!u.bench&&!u.dead&&!u.ohp).map(u=>(<div key={u.id} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 12px",marginBottom:4,display:"flex",alignItems:"center",gap:8,opacity:.4}}>{u.photo?<img src={u.photo} style={{width:30,height:30,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:30,height:30,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>👤</div>}<span style={{color:C.text2,fontWeight:700,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/><span style={{color:C.text3,fontSize:11,marginLeft:"auto"}}>🥚</span></div>))}</div>)}
        </div>
        <BottomNav/>
      </div>
    )}

    {page==="team_battle"&&(
      <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",position:"sticky",top:0,zIndex:20}}><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:"#4ADE80"}}>🏴 부대 대항전</h1><p style={{color:C.text3,fontSize:10,marginTop:1}}>중대별 팀 랭킹</p></div>
        <div style={{padding:"12px 12px",maxWidth:520,margin:"0 auto"}}>
          {teamRankings.length===0?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:40,marginBottom:12}}>🏴</div><p>부대 데이터가 없습니다</p></div>
            :teamRankings.map(({code,unit,sols,avgScore,totalPow,count},idx)=>{
              const sc=avgScore>=4?"#FFD700":avgScore>=3?"#C084FC":avgScore>=2?"#60A5FA":"#4ADE80",isMyUnit=code===myUnitCode;
              return(<div key={code} className="ri" style={{background:isMyUnit?"linear-gradient(140deg,#0A1500,#051000)":C.bg2,border:`1px solid ${isMyUnit?"#4ADE8050":idx===0?"#FFD70030":C.border}`,borderRadius:12,marginBottom:7,padding:"13px 14px",animationDelay:`${idx*.05}s`}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:30,textAlign:"center",fontFamily:"'Oswald',sans-serif",fontSize:17,fontWeight:700,color:idx===0?"#FFD700":C.text3,flexShrink:0}}>{idx===0?"🥇":idx===1?"🥈":idx===2?"🥉":`#${idx+1}`}</div><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:2}}><span style={{fontWeight:900,color:C.text,fontSize:14}}>{unit?.company||code}</span>{isMyUnit&&<span style={{fontSize:9,color:"#4ADE80",fontWeight:700,background:"#4ADE8020",padding:"1px 5px",borderRadius:4}}>내 부대</span>}</div><div style={{color:C.text3,fontSize:11}}>{unit?.division||""} {unit?.brigade||""}</div><div style={{marginTop:5,display:"flex",gap:10}}><span style={{fontSize:11,color:C.text3}}>인원 <span style={{color:C.text,fontWeight:700}}>{count}명</span></span><span style={{fontSize:11,color:C.text3}}>합산 <span style={{fontFamily:"'Oswald',sans-serif",color:C.text,fontWeight:600}}>{totalPow}kg</span></span></div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,color:sc,lineHeight:1}}>{avgScore.toFixed(1)}</div><div style={{fontSize:9,color:C.text3}}>평균점수</div></div></div>
                <div style={{marginTop:9,paddingTop:9,borderTop:`1px solid ${C.border}`,display:"flex",gap:5,overflowX:"auto"}}>{sols.slice(0,5).map(s=>(<div key={s.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>{s.photo?<img src={s.photo} style={{width:30,height:30,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:30,height:30,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>👤</div>}<span style={{fontSize:9,color:C.text2,maxWidth:34,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span></div>))}{sols.length>5&&<div style={{display:"flex",alignItems:"center",color:C.text3,fontSize:10,flexShrink:0}}>+{sols.length-5}</div>}</div>
              </div>);
            })}
          {teamRankings.length>=2&&(<><div style={{display:"flex",alignItems:"center",gap:8,margin:"16px 0 10px"}}><div style={{flex:1,height:1,background:C.border}}/><span style={{color:C.text3,fontSize:11}}>⚔️ 소초 대 소초</span><div style={{flex:1,height:1,background:C.border}}/></div><div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:7,alignItems:"center",marginBottom:10}}><select value={teamA} onChange={e=>setTeamA(e.target.value)} style={{background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:8,padding:"9px 7px",fontSize:12,outline:"none"}}><option value="">-- 도전 --</option>{teamRankings.map(t=><option key={t.code} value={t.code}>{t.unit?.company||t.code}</option>)}</select><div style={{textAlign:"center",color:C.text3,fontFamily:"'Black Han Sans',sans-serif",fontSize:14}}>VS</div><select value={teamB} onChange={e=>setTeamB(e.target.value)} style={{background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:8,padding:"9px 7px",fontSize:12,outline:"none"}}><option value="">-- 상대 --</option>{teamRankings.filter(t=>t.code!==teamA).map(t=><option key={t.code} value={t.code}>{t.unit?.company||t.code}</option>)}</select></div>{teamA&&teamB&&(()=>{const ta=teamRankings.find(t=>t.code===teamA),tb=teamRankings.find(t=>t.code===teamB);if(!ta||!tb)return null;const win=ta.avgScore>tb.avgScore?ta:tb.avgScore>ta.avgScore?tb:null;return(<div className="fi" style={{background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:12,padding:14}}>{[["평균 점수",ta.avgScore.toFixed(1),tb.avgScore.toFixed(1)],["합산 중량",`${ta.totalPow}kg`,`${tb.totalPow}kg`],["인원",`${ta.count}명`,`${tb.count}명`]].map(([lbl,av,bv])=>(<div key={lbl} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:7,alignItems:"center",marginBottom:9}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:18,fontWeight:700,color:C.text,textAlign:"right"}}>{av}</div><div style={{color:C.text3,fontSize:10,textAlign:"center",minWidth:54}}>{lbl}</div><div style={{fontFamily:"'Oswald',sans-serif",fontSize:18,fontWeight:700,color:C.text}}>{bv}</div></div>))}<div style={{textAlign:"center",marginTop:10,padding:"11px",background:win?"linear-gradient(135deg,#2A2000,#1A1500)":C.bg2,borderRadius:8,border:`1px solid ${win?C.accent+"50":C.border}`}}>{win?<div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:18,color:C.accent}}>🏆 {win.unit?.company||win.code} 승리!</div>:<div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:16,color:C.text2}}>🤝 동점</div>}</div></div>);})()}</>)}
        </div>
        <BottomNav/>
      </div>
    )}

    {page==="taunt_feed"&&(
      <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",position:"sticky",top:0,zIndex:20}}><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:"#C084FC"}}>🔥 도발 피드</h1><p style={{color:C.text3,fontSize:10,marginTop:1}}>전군 도발 실시간 현황</p></div>
        <div style={{padding:"12px 12px",maxWidth:520,margin:"0 auto"}}>
          {taunts.length===0?(<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:44,marginBottom:12}}>😴</div><p style={{marginBottom:6}}>아직 도발이 없습니다</p><p style={{fontSize:12}}>랭킹 탭에서 병사 카드의 😈 버튼을 눌러보세요</p></div>)
            :taunts.map(t=>{const fr=soldiers.find(s=>s.id===t.from_id),to=soldiers.find(s=>s.id===t.to_id),isMine=t.from_id===myId||t.to_id===myId;return(
              <div key={t.id} className="ri" style={{background:isMine?"linear-gradient(135deg,#2A1A4A,#1A0F2E)":C.bg2,border:`1px solid ${isMine?"#C084FC40":C.border}`,borderRadius:12,marginBottom:8,padding:"12px 14px"}}>
                <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {fr?.photo?<img src={fr.photo} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",border:"2px solid #C084FC50"}}/>:<div style={{width:34,height:34,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>👤</div>}
                    <div><div style={{fontWeight:900,color:"#C084FC",fontSize:12}}>{fr?.name||"익명"}</div><RankBadge r={fr?.rank_name}/></div>
                  </div>
                  <div style={{color:C.text3,fontSize:12,fontFamily:"'Black Han Sans',sans-serif"}}>→</div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {to?.photo?<img src={to.photo} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover",border:"2px solid #EF444450"}}/>:<div style={{width:34,height:34,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>👤</div>}
                    <div><div style={{fontWeight:900,color:"#EF4444",fontSize:12}}>{to?.name||"??"}</div><RankBadge r={to?.rank_name}/></div>
                  </div>
                  <div style={{marginLeft:"auto",color:C.text3,fontSize:10}}>{new Date(t.created_at).toLocaleDateString("ko-KR")}</div>
                </div>
                <div style={{background:C.bg,borderRadius:8,padding:"9px 12px",borderLeft:`3px solid ${t.is_bet?"#FFD700":"#C084FC"}`}}>
                  {t.is_bet&&<div style={{color:"#FFD700",fontSize:10,fontWeight:700,marginBottom:3}}>📋 내기 선언{t.deadline?` · 기한: ${t.deadline}`:""}</div>}
                  <p style={{color:C.text,fontSize:13,lineHeight:1.6}}>{t.message}</p>
                </div>
              </div>
            );})}
        </div>
        <BottomNav/>
      </div>
    )}

    {page==="my_profile"&&(
      <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",position:"sticky",top:0,zIndex:20}}><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:C.text}}>👤 내 기록</h1></div>
        <div style={{padding:"12px 12px",maxWidth:520,margin:"0 auto"}}>
          {!mySoldier?(<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:44,marginBottom:12}}>👤</div><p style={{marginBottom:12}}>로그인 후 이용 가능합니다</p><Btn onClick={()=>setPage("join")} style={{fontSize:13,padding:"10px 20px"}}>부대코드로 입장</Btn></div>):(
            <>
              <div style={{background:`linear-gradient(135deg,${C.bg2},${C.bg3})`,border:`1px solid ${C.accent}40`,borderRadius:14,padding:18,marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
                  {mySoldier.photo?<img src={mySoldier.photo} style={{width:72,height:72,borderRadius:"50%",objectFit:"cover",border:`3px solid ${C.accent}60`}}/>:<div style={{width:72,height:72,borderRadius:"50%",background:C.bg4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>👤</div>}
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:4}}><span style={{fontWeight:900,color:C.text,fontSize:18}}>{mySoldier.name}</span><RankBadge r={mySoldier.rank_name}/><MosBadge m={mySoldier.mos}/></div>
                    {myUnit&&<div style={{color:C.text2,fontSize:12}}>{myUnit.division} {myUnit.brigade} {myUnit.company}</div>}
                    <div style={{display:"flex",gap:7,marginTop:4,flexWrap:"wrap"}}>
                      {mySoldier.streak>1&&<span style={{fontSize:11,color:"#FB923C",fontWeight:700}}>🔥{mySoldier.streak}일 연속</span>}
                      <span style={{fontSize:11,color:C.text3}}>#{(ranked.findIndex(u=>u.id===myId)+1)||"?"}위</span>
                    </div>
                  </div>
                  <div style={{textAlign:"center"}}>{(()=>{const sc=calcScore(mySoldier.bench,mySoldier.dead,mySoldier.ohp,mySoldier.weight,mySoldier.height),info=SCORES[sc];return(<><div style={{fontSize:28}}>{info.emoji}</div><div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:info.color}}>{sc}</div><div style={{fontSize:9,color:info.color+"80"}}>/ 5</div></>);})()}</div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:14}}>
                  {[["벤치","🏋️",mySoldier.bench],["데드","⚡",mySoldier.dead],["OHP","🔥",mySoldier.ohp]].map(([l,ic,v])=>(<div key={l} style={{background:C.bg,borderRadius:8,padding:"9px",textAlign:"center"}}><div style={{fontSize:14}}>{ic}</div><div style={{fontFamily:"'Oswald',sans-serif",fontSize:21,fontWeight:700,color:C.text}}>{v||0}</div><div style={{color:C.text3,fontSize:10}}>{l}</div></div>))}
                </div>
                <div style={{color:C.text3,fontSize:11,marginBottom:6}}>📈 성장 그래프 (최근 15회)</div>
                <GrowthChart data={liftHistory.filter(h=>h.soldier_id===myId)}/>
                {myUnit&&<div style={{marginTop:14,padding:"10px",background:C.bg4,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}><span style={{color:C.text2,fontSize:12}}>내 부대 공유 코드</span><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontFamily:"'Oswald',sans-serif",fontSize:16,fontWeight:700,color:C.accent,letterSpacing:"0.15em"}}>{myUnitCode}</span><img src={`https://api.qrserver.com/v1/create-qr-code/?size=50x50&data=${myUnitCode}`} style={{borderRadius:4}} alt="QR"/></div></div>}
              </div>
              <div style={{marginBottom:12}}>
                <div style={{color:C.text2,fontSize:13,fontWeight:700,marginBottom:8}}>🏅 업적 ({myAch.length}/{Object.keys(ACH).length})</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {Object.entries(ACH).map(([k,a])=>{const earned=myAch.includes(k);return(<div key={k} style={{background:earned?"linear-gradient(135deg,#2A2000,#1A1500)":C.bg3,border:`1px solid ${earned?C.accent+"50":C.border}`,borderRadius:9,padding:"10px 11px",opacity:earned?1:0.4}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}><span style={{fontSize:20}}>{a.emoji}</span><span style={{fontWeight:700,color:earned?C.accent:C.text2,fontSize:12}}>{a.title}</span></div><div style={{color:C.text3,fontSize:10}}>{a.desc}</div>{earned&&<div style={{color:C.accent,fontSize:9,marginTop:3}}>✓ 달성</div>}</div>);})}
                </div>
              </div>
              <div>
                <div style={{color:C.text2,fontSize:13,fontWeight:700,marginBottom:8}}>🔥 내가 받은 도발 ({taunts.filter(t=>t.to_id===myId).length})</div>
                {taunts.filter(t=>t.to_id===myId).length===0?<p style={{color:C.text3,fontSize:12}}>받은 도발이 없습니다. 아직 무섭지 않나봐요 😴</p>:taunts.filter(t=>t.to_id===myId).slice(0,5).map(t=>{const fr=soldiers.find(s=>s.id===t.from_id);return(<div key={t.id} style={{background:C.bg3,border:"1px solid #C084FC25",borderRadius:8,padding:"9px 12px",marginBottom:5}}><span style={{color:"#C084FC",fontWeight:700,fontSize:11}}>{fr?.name||"익명"} 😈 </span><span style={{color:C.text,fontSize:12}}>{t.message}</span></div>);})}
              </div>
            </>
          )}
        </div>
        <BottomNav/>
      </div>
    )}

    {page==="records"&&(
      <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",position:"sticky",top:0,zIndex:20}}>
          <div style={{display:"flex",gap:8,alignItems:"center"}}><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:recTab==="fame"?"#FFD700":"#C084FC"}}>{recTab==="fame"?"💀 명예의 전당":"🗳️ 민심 투표"}</h1><div style={{marginLeft:"auto",display:"flex",gap:5}}><button onClick={()=>setRecTab("fame")} style={{background:recTab==="fame"?"#FFD70020":"none",border:`1px solid ${recTab==="fame"?"#FFD70050":C.border2}`,color:recTab==="fame"?"#FFD700":C.text3,borderRadius:6,padding:"4px 9px",cursor:"pointer",fontSize:11,fontWeight:700}}>전당</button><button onClick={()=>setRecTab("vote")} style={{background:recTab==="vote"?"#C084FC20":"none",border:`1px solid ${recTab==="vote"?"#C084FC50":C.border2}`,color:recTab==="vote"?"#C084FC":C.text3,borderRadius:6,padding:"4px 9px",cursor:"pointer",fontSize:11,fontWeight:700}}>투표</button><button onClick={()=>{setBattleA("");setBattleB("");setPage("battle");}} style={{background:"none",border:`1px solid ${C.border}`,color:C.text3,borderRadius:6,padding:"4px 9px",cursor:"pointer",fontSize:11}}>⚔️ 1v1</button></div></div>
        </div>
        <div style={{padding:"12px 12px",maxWidth:520,margin:"0 auto"}}>
          {recTab==="fame"&&(<>
            <p style={{color:C.text3,fontSize:11,marginBottom:9}}>현재 개인 최고기록 TOP</p>
            {[...ranked].sort((a,b)=>{const at=(a.bench||0)+(a.dead||0)+(a.ohp||0),bt=(b.bench||0)+(b.dead||0)+(b.ohp||0);return bt-at;}).map((u,i)=>{const t=(u.bench||0)+(u.dead||0)+(u.ohp||0),isF=i===0;return(<div key={u.id} style={{background:isF?"linear-gradient(135deg,#2A2000,#1A1500)":C.bg2,border:`1px solid ${isF?"#FFD70050":C.border}`,borderRadius:10,padding:"11px 13px",marginBottom:6,display:"flex",alignItems:"center",gap:9}}><div style={{width:24,textAlign:"center",fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:700,color:isF?"#FFD700":C.text3}}>{isF?"🥇":`#${i+1}`}</div>{u.photo?<img src={u.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:38,height:38,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{fontWeight:900,color:C.text,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/></div><div style={{fontSize:11,color:C.text2,marginTop:1}}>벤치 {u.bench} · 데드 {u.dead} · OHP {u.ohp}</div></div><div style={{textAlign:"right"}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:19,fontWeight:700,color:"#FFD700"}}>{t}</div><div style={{fontSize:9,color:C.text3}}>kg</div></div></div>);})}
            {liftHistory.filter(h=>h.is_personal_best).length>0&&(<><div style={{display:"flex",alignItems:"center",gap:7,margin:"16px 0 9px"}}><div style={{flex:1,height:1,background:C.border}}/><span style={{color:C.text3,fontSize:10}}>🏆 신기록 달성 히스토리</span><div style={{flex:1,height:1,background:C.border}}/></div>{liftHistory.filter(h=>h.is_personal_best).slice(0,20).map(h=>{const sol=soldiers.find(s=>s.id===h.soldier_id);return(<div key={h.id} style={{background:C.bg3,border:"1px solid #FFD70020",borderRadius:8,padding:"8px 12px",marginBottom:5,display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:14}}>🏆</span><div style={{flex:1}}><span style={{color:"#FFD700",fontWeight:700,fontSize:11}}>{sol?.name||"??"}</span><span style={{color:C.text2,fontSize:11,marginLeft:4}}>합계 {h.total}kg 신기록</span></div><span style={{color:C.text3,fontSize:10}}>{new Date(h.recorded_at).toLocaleDateString("ko-KR")}</span></div>);})}</>)}
          </>)}
          {recTab==="vote"&&(<>
            <div style={{background:C.bg2,border:`1px solid ${C.border2}`,borderRadius:12,padding:13,marginBottom:14}}><GlowInput placeholder="내 이름" value={voteName} onChange={setVoteName} style={{marginBottom:7}}/><select value={voteTarget} onChange={e=>setVoteTarget(e.target.value)} style={{width:"100%",background:C.bg3,color:voteTarget?C.text:C.text3,border:`1px solid ${C.border2}`,borderRadius:6,padding:"11px 13px",fontSize:14,outline:"none",marginBottom:11}}><option value="">-- 투표할 병사 선택 --</option>{soldiers.map(s=><option key={s.id} value={s.id}>{s.name} ({s.rank_name||""})</option>)}</select><Btn onClick={doVote} disabled={!voteName.trim()||!voteTarget} color="#7C3AED" style={{width:"100%",padding:11}}>🗳️ 투표하기</Btn></div>
            <p style={{color:C.text3,fontSize:11,marginBottom:9}}>현재 투표 현황 — 총 {votes.length}표</p>
            {voteRanked.length===0?<div style={{textAlign:"center",paddingTop:40,color:C.text3}}><p>아직 투표가 없습니다</p></div>:voteRanked.map(([id,cnt],i)=>{const sol=soldiers.find(s=>s.id===id),mx=voteRanked[0][1],isF=i===0;return(<div key={id} style={{background:isF?"linear-gradient(135deg,#2A1A4A,#1A0F2E)":C.bg2,border:`1px solid ${isF?"#C084FC50":C.border}`,borderRadius:10,padding:"11px 13px",marginBottom:6,display:"flex",alignItems:"center",gap:9}}><div style={{width:24,textAlign:"center",fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:700,color:isF?"#C084FC":C.text3}}>{isF?"👑":`#${i+1}`}</div>{sol?.photo?<img src={sol.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:38,height:38,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:4}}><span style={{fontWeight:900,color:C.text,fontSize:13}}>{sol?.name||"??"}</span><RankBadge r={sol?.rank_name}/></div><div style={{height:3,borderRadius:2,background:C.bg4}}><div style={{height:"100%",borderRadius:2,background:isF?"#C084FC":"#4A3A6A",width:`${(cnt/mx)*100}%`,transition:"width .5s"}}/></div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:19,fontWeight:700,color:isF?"#C084FC":C.text}}>{cnt}</div><div style={{fontSize:9,color:C.text3}}>표</div></div></div>);})}
          </>)}
        </div>
        <BottomNav/>
      </div>
    )}

    {page==="battle"&&(()=>{
      const a=soldiers.find(s=>s.id===battleA),b=soldiers.find(s=>s.id===battleB);
      const aT=a?(a.bench||0)+(a.dead||0)+(a.ohp||0):0,bT=b?(b.bench||0)+(b.dead||0)+(b.ohp||0):0;
      const win=a&&b&&aT!==bT?(aT>bT?a:b):null;
      return(<div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",position:"sticky",top:0,zIndex:20}}><div style={{display:"flex",alignItems:"center",gap:8}}><button onClick={()=>setPage("records")} style={{background:"none",border:"none",color:C.text2,fontSize:20,cursor:"pointer"}}>←</button><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:"#60A5FA"}}>⚔️ 1대1 대결</h1></div></div>
        <div style={{padding:"12px 12px",maxWidth:520,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:7,alignItems:"center",marginBottom:14}}><select value={battleA} onChange={e=>setBattleA(e.target.value)} style={{background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:8,padding:"9px 7px",fontSize:12,outline:"none"}}><option value="">-- 도전자 --</option>{soldiers.map(s=><option key={s.id} value={s.id}>{s.name}({s.rank_name||"?"})</option>)}</select><div style={{textAlign:"center",fontFamily:"'Black Han Sans',sans-serif",fontSize:14,color:C.text3}}>VS</div><select value={battleB} onChange={e=>setBattleB(e.target.value)} style={{background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:8,padding:"9px 7px",fontSize:12,outline:"none"}}><option value="">-- 상대 --</option>{soldiers.filter(s=>s.id!==battleA).map(s=><option key={s.id} value={s.id}>{s.name}({s.rank_name||"?"})</option>)}</select></div>
          {a&&b&&(<div className="fi"><div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",marginBottom:14,textAlign:"center"}}><div>{a.photo?<img src={a.photo} style={{width:60,height:60,borderRadius:"50%",objectFit:"cover",border:"3px solid #C8A94250",margin:"0 auto",display:"block"}}/>:<div style={{width:60,height:60,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto"}}>👤</div>}<div style={{fontWeight:900,color:C.text,marginTop:4,fontSize:13}}>{a.name}</div><RankBadge r={a.rank_name}/></div><div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:18,color:C.text3}}>⚔️</div><div>{b.photo?<img src={b.photo} style={{width:60,height:60,borderRadius:"50%",objectFit:"cover",border:"3px solid #EF444450",margin:"0 auto",display:"block"}}/>:<div style={{width:60,height:60,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto"}}>👤</div>}<div style={{fontWeight:900,color:C.text,marginTop:4,fontSize:13}}>{b.name}</div><RankBadge r={b.rank_name}/></div></div>
          {LIFT_LABELS.map(({key,icon,label})=>{const av=a[key]||0,bv=b[key]||0,mx=Math.max(av,bv)||1,aW=av>bv,bW=bv>av;return(<div key={key} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",marginBottom:6}}><div style={{color:C.text2,fontSize:11,marginBottom:7,fontWeight:700}}>{icon} {label}</div><div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:7,alignItems:"center"}}><div style={{textAlign:"right"}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:aW?"#FFD700":C.text}}>{av}<span style={{fontSize:11}}>kg</span></div><div style={{height:3,borderRadius:2,marginTop:4,background:aW?"#FFD700":C.bg4,width:`${(av/mx)*100}%`,minWidth:av>0?2:0,marginLeft:"auto"}}/></div><div style={{textAlign:"center",fontSize:10,color:C.text3,fontWeight:700,minWidth:28}}>{av===bv?"🤝":aW?"◀":"▶"}</div><div><div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:bW?"#FFD700":C.text}}>{bv}<span style={{fontSize:11}}>kg</span></div><div style={{height:3,borderRadius:2,marginTop:4,background:bW?"#FFD700":C.bg4,width:`${(bv/mx)*100}%`,minWidth:bv>0?2:0}}/></div></div></div>);})}
          <div style={{background:win?"linear-gradient(135deg,#2A2000,#1A1500)":C.bg2,border:`1px solid ${win?C.accent+"50":C.border}`,borderRadius:10,padding:"14px",textAlign:"center",marginTop:4}}>{win?<><div style={{fontSize:30,marginBottom:3}}>🏆</div><div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:20,color:C.accent}}>{win.name} 승리!</div><div style={{color:C.text2,fontSize:12,marginTop:3}}>{Math.max(aT,bT)}kg vs {Math.min(aT,bT)}kg</div></>:<><div style={{fontSize:28,marginBottom:3}}>🤝</div><div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:16,color:C.text2}}>무승부</div></>}</div></div>)}
          {!a&&!b&&<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:40,marginBottom:10}}>⚔️</div><p>두 병사를 선택하세요</p></div>}
        </div>
        <BottomNav/>
      </div>);})()} 

    {toast&&(<div style={{position:"fixed",top:20,right:16,zIndex:999,background:TB[toast.type]||"#1A1500",border:`1px solid ${TBB[toast.type]||C.accent}`,borderRadius:10,padding:"10px 14px",maxWidth:270,animation:"toastIn .3s ease",boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}><p style={{color:C.text,fontSize:13,fontWeight:700}}>{toast.msg}</p></div>)}

    {showChallenge&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:998,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setShowChallenge(false)}><div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(135deg,#1A1A2E,#0F0F1E)",border:"1px solid #4A4A8A",borderRadius:16,padding:"26px 22px",maxWidth:330,width:"100%",textAlign:"center",animation:"modalIn .3s ease"}}><div style={{fontSize:44,marginBottom:10}}>🎰</div><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:18,color:"#8080CC",marginBottom:14}}>오늘의 도전</h2><p style={{color:C.text,fontSize:15,lineHeight:1.7,fontWeight:700,marginBottom:22}}>{challenge}</p><div style={{display:"flex",gap:7}}><button onClick={doChallenge} style={{flex:1,background:"#2A2A5A",border:"1px solid #4A4A8A",borderRadius:8,padding:"10px",color:"#8080CC",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>🔄 다시</button><button onClick={()=>setShowChallenge(false)} style={{flex:1,background:C.accent,border:"none",borderRadius:8,padding:"10px",color:"#000",fontSize:12,fontWeight:900,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>확인 ✓</button></div></div></div>)}

    {openTaunt&&(()=>{const target=soldiers.find(s=>s.id===openTaunt);return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:998,display:"flex",alignItems:"end",justifyContent:"center"}} onClick={()=>{setOpenTaunt(null);setTauntMsg("");setTauntCustom("");setIsBet(false);}}><div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(180deg,#1A0F2E,#120A22)",border:"1px solid #C084FC40",borderRadius:"16px 16px 0 0",padding:"20px 18px",width:"100%",maxWidth:480,animation:"fadeUp .25s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><span style={{fontSize:24}}>😈</span><div><div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:17,color:"#C084FC"}}>도발 발송</div><div style={{color:C.text3,fontSize:12}}>{target?.name}에게 보내는 메시지</div></div></div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>{TAUNT_TPLS.map((t,i)=>(<button key={i} onClick={()=>{setTauntMsg(t);setTauntCustom("");}} style={{background:tauntMsg===t?"#4A1A7A":"#2A1A4A",border:`1px solid ${tauntMsg===t?"#C084FC":"#C084FC30"}`,borderRadius:7,padding:"6px 9px",color:tauntMsg===t?"#C084FC":"#8060AA",fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>{t}</button>))}</div>
      <GlowInput placeholder="직접 입력..." value={tauntCustom} onChange={v=>{setTauntCustom(v);setTauntMsg("");}} style={{marginBottom:8}}/>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
        <button onClick={()=>setIsBet(!isBet)} style={{background:isBet?"#3A2A00":"#1A1A1A",border:`1px solid ${isBet?"#FFD70050":"#333"}`,borderRadius:7,padding:"6px 11px",color:isBet?"#FFD700":C.text3,fontSize:11,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>📋 내기 선언</button>
        {isBet&&<GlowInput placeholder="기한 (예: 2주)" value={betDeadline} onChange={setBetDeadline} style={{flex:1,padding:"8px 12px",fontSize:12}}/>}
      </div>
      <div style={{display:"flex",gap:8}}><Ghost onClick={()=>{setOpenTaunt(null);setTauntMsg("");setTauntCustom("");setIsBet(false);}} style={{flex:1,padding:"11px"}}>취소</Ghost><button onClick={()=>sendTaunt(openTaunt)} disabled={!tauntMsg&&!tauntCustom.trim()} style={{flex:2,background:(tauntMsg||tauntCustom.trim())?"#7C3AED":"#2A1A4A",border:"none",borderRadius:7,padding:"11px",color:"#fff",fontSize:14,fontWeight:900,cursor:(tauntMsg||tauntCustom.trim())?"pointer":"default",fontFamily:"'Noto Sans KR',sans-serif"}}>😈 도발 발송</button></div>
    </div></div>);})()}
    </>
  );
}
