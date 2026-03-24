import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

const SCORES = {
  5:{emoji:"🦁",label:"체단실 괴물",color:"#FFD700",glow:"rgba(255,215,0,0.25)"},
  4:{emoji:"💪",label:"헬스 고인물",color:"#C084FC",glow:"rgba(192,132,252,0.2)"},
  3:{emoji:"⚔️",label:"평균 전사",color:"#60A5FA",glow:"rgba(96,165,250,0.2)"},
  2:{emoji:"🐣",label:"헬린이",color:"#4ADE80",glow:"rgba(74,222,128,0.2)"},
  1:{emoji:"🥚",label:"짬지",color:"#6B7280",glow:"rgba(107,114,128,0.12)"},
};
const C={bg:"#07090C",bg2:"#0D1117",bg3:"#141A22",bg4:"#1A2230",border:"#1A2030",border2:"#222C3A",accent:"#C8A942",text:"#E4E0D2",text2:"#7A7E8A",text3:"#323845"};
const LIFT_LABELS=[{key:"bench",icon:"🏋️",label:"벤치프레스"},{key:"dead",icon:"⚡",label:"데드리프트"},{key:"ohp",icon:"🔥",label:"오버헤드프레스"}];
const RANKS=["이병","일병","상병","병장"];
const RANK_COLORS={"이병":"#6B7280","일병":"#60A5FA","상병":"#4ADE80","병장":"#FFD700"};
const MOS_LIST=["보병","포병","기갑","공병","통신","화학","의무","군사경찰","정보","항공","기타"];
const MOS_COLORS={"보병":"#EF4444","포병":"#F97316","기갑":"#EAB308","공병":"#84CC16","통신":"#06B6D4","화학":"#8B5CF6","의무":"#EC4899","군사경찰":"#F59E0B","정보":"#3B82F6","항공":"#10B981","기타":"#6B7280"};
const CHALLENGE_MSGS=[
  (a,b,l)=>`⚔️ ${a}이(가) ${b}에게 ${l} 도전장을 내밀었다!`,
  (a,b,l)=>`💀 ${a} vs ${b} — ${l} 결투! 진 쪽이 청소당번`,
  (a,b,l)=>`🎯 오늘 ${a}의 타겟은 ${b}! ${l}로 찍어눌러라`,
  (a,b,l)=>`🔥 ${b}, ${a}한테 ${l} 딸림 판정 받기 전에 기록 올려라`,
];

function calcRatio(b,d,o,w,h){const t=(+b||0)+(+d||0)+(+o||0);if(!t||!+w)return 0;return t/+w-(+h-170)*0.008;}
function calcScore(b,d,o,w,h){const r=calcRatio(b,d,o,w,h);if(r>=4.5)return 5;if(r>=3.2)return 4;if(r>=2.2)return 3;if(r>=1.3)return 2;return 1;}
function getToday(){return new Date().toLocaleDateString("ko-KR");}
function getWeekStart(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-d.getDay());return d.toISOString();}
function genCode(){return Math.random().toString(36).substr(2,6).toUpperCase();}
function compressPhoto(file){return new Promise(res=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const S=160,c=document.createElement("canvas");c.width=c.height=S;const ctx=c.getContext("2d"),sc=Math.max(S/img.width,S/img.height);ctx.drawImage(img,(S-img.width*sc)/2,(S-img.height*sc)/2,img.width*sc,img.height*sc);URL.revokeObjectURL(url);res(c.toDataURL("image/jpeg",0.75));};img.src=url;});}

// GlowInput MUST be outside App to prevent mobile keyboard collapse
function GlowInput({placeholder,value,onChange,type="text",style:s={}}){
  return <input type={type} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}
    style={{width:"100%",padding:"12px 16px",background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:6,fontSize:15,outline:"none",transition:"border-color .2s",...s}}
    onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border2}/>;
}

export default function App(){
  const [page,setPage]=useState("init");
  const [rankTab,setRankTab]=useState("all");
  const [soldiers,setSoldiers]=useState([]);
  const [units,setUnits]=useState([]);
  const [liftHistory,setLiftHistory]=useState([]);
  const [votes,setVotes]=useState([]);
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

  const fileRef=useRef();
  const commentEndRef=useRef();

  useEffect(()=>{
    const el=document.createElement("style");
    el.textContent=`
      @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Oswald:wght@500;600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}body{background:#07090C;overflow-x:hidden}
      ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#07090C}::-webkit-scrollbar-thumb{background:#1E2530;border-radius:2px}
      input,textarea,button,select{font-family:'Noto Sans KR',sans-serif}
      input::placeholder,textarea::placeholder{color:#8A9BB0}
      @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
      @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
      @keyframes toastIn{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
      @keyframes modalIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
      .fu{animation:fadeUp .45s ease both}.fi{animation:fadeIn .25s ease both}
      .ri{animation:fadeUp .4s ease both}
      .ri:nth-child(1){animation-delay:.04s}.ri:nth-child(2){animation-delay:.08s}
      .ri:nth-child(3){animation-delay:.12s}.ri:nth-child(4){animation-delay:.16s}
      .ri:nth-child(5){animation-delay:.20s}.ri:nth-child(6){animation-delay:.24s}
      .ri:nth-child(7){animation-delay:.28s}.ri:nth-child(8){animation-delay:.32s}
    `;
    document.head.appendChild(el);
  },[]);

  useEffect(()=>{
    try{const s=localStorage.getItem("gym_id");if(s){const{id,uc}=JSON.parse(s);setMyId(id);setMyUnitCode(uc);}}catch(e){}
  },[]);

  async function loadSoldiers(){const{data}=await supabase.from("soldiers").select("*").order("created_at",{ascending:true});setSoldiers(data||[]);return data||[];}
  async function loadUnits(){const{data}=await supabase.from("unit_codes").select("*");setUnits(data||[]);return data||[];}
  async function loadHistory(){const{data}=await supabase.from("lift_history").select("*").order("recorded_at",{ascending:false}).limit(300);setLiftHistory(data||[]);return data||[];}
  async function loadVotes(){const{data}=await supabase.from("votes").select("*");setVotes(data||[]);}
  async function loadComments(id){const{data}=await supabase.from("comments").select("*").eq("soldier_id",id).order("created_at",{ascending:true});setComments(p=>({...p,[id]:data||[]}));}

  function computeKing(history,sols){
    const ws=getWeekStart(),tw=history.filter(h=>h.recorded_at>=ws),cnt={};
    tw.forEach(h=>{cnt[h.soldier_id]=(cnt[h.soldier_id]||0)+1;});
    const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(top){const s=sols.find(s=>s.id===top);setWeeklyKing(s?{...s,wc:cnt[top]}:null);}else setWeeklyKing(null);
  }

  useEffect(()=>{(async()=>{const[s,h]=await Promise.all([loadSoldiers(),loadHistory()]);await Promise.all([loadUnits(),loadVotes()]);computeKing(h,s);setPage("landing");})();},[]);

  useEffect(()=>{
    const ch=supabase.channel("gym-v3")
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
      .subscribe();
    return()=>supabase.removeChannel(ch);
  },[myId,myUnitCode]);

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

  const teamRankings=Object.entries(ranked.reduce((acc,s)=>{
    if(!s.unit_code)return acc;
    if(!acc[s.unit_code])acc[s.unit_code]={sols:[],unit:units.find(u=>u.code===s.unit_code)};
    acc[s.unit_code].sols.push(s);return acc;
  },{})).map(([code,{sols,unit}])=>({
    code,unit,sols,count:sols.length,
    avgScore:sols.reduce((sum,s)=>sum+calcScore(s.bench,s.dead,s.ohp,s.weight,s.height),0)/sols.length,
    totalPow:sols.reduce((sum,s)=>sum+(s.bench||0)+(s.dead||0)+(s.ohp||0),0),
  })).sort((a,b)=>b.avgScore-a.avgScore);

  function showToast(msg,type="info"){setToast({msg,type});setTimeout(()=>setToast(null),3500);}

  async function lookupCode(){
    setError(null);
    const{data}=await supabase.from("unit_codes").select("*").eq("code",codeInput.toUpperCase().trim()).single();
    if(data)setFoundUnit(data);else setError("존재하지 않는 코드입니다");
  }

  async function createUnit(){
    if(!newUnit.division||!newUnit.brigade||!newUnit.company)return;
    setLoading(true);const code=genCode();
    const{error:e}=await supabase.from("unit_codes").insert({code,division:newUnit.division,brigade:newUnit.brigade,company:newUnit.company,post:newUnit.post||null});
    if(e){setError("생성 실패: "+e.message);setLoading(false);return;}
    await loadUnits();setCreatedCode(code);setReg(r=>({...r,unitCode:code,...newUnit}));setLoading(false);
  }

  async function doRegister(){
    setLoading(true);setError(null);
    const{data:ins,error:e}=await supabase.from("soldiers").insert({
      name:reg.name,height:+reg.height,weight:+reg.weight,
      bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,
      photo:reg.photo||null,rank_name:reg.rankName,mos:reg.mos,
      unit_code:reg.unitCode,division:reg.division,brigade:reg.brigade,company:reg.company,post:reg.post||null,
      updated_at:today,last_record_date:today,streak:1,
    }).select();
    if(e){setError("등록 실패: "+e.message);setLoading(false);return;}
    if(ins?.[0]){
      const id=ins[0].id;
      await supabase.from("lift_history").insert({soldier_id:id,bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,total:+lifts.bench+(+lifts.dead)+(+lifts.ohp),is_personal_best:true});
      try{localStorage.setItem("gym_id",JSON.stringify({id,uc:reg.unitCode}));}catch(e){}
      setMyId(id);setMyUnitCode(reg.unitCode);
    }
    const[s,h]=await Promise.all([loadSoldiers(),loadHistory()]);computeKing(h,s);
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
    setLifts({bench:"",dead:"",ohp:""});setEditId(null);setLoading(false);
    if(isPB)showToast(`🏆 신기록! 합계 ${newTotal}kg!`,"best");
    else if(oldRank>0&&newRank>0&&newRank<oldRank)showToast(`↑${oldRank-newRank}위 상승! ${newRank}위 🔥`,"up");
    else if(oldRank>0&&newRank>0&&newRank>oldRank)showToast(`↓${newRank-oldRank}위 하락 ${newRank}위`,"down");
    else showToast(`기록 갱신! ${newRank}위 🔥`,"info");
    setPage("rankings");
  }

  async function addComment(){if(!cForm.name.trim()||!cForm.content.trim())return;setCLoading(true);await supabase.from("comments").insert({soldier_id:openComment,name:cForm.name.trim(),content:cForm.content.trim()});setCForm({name:"",content:""});setCLoading(false);}
  async function toggleComment(id){if(openComment===id){setOpenComment(null);return;}setOpenComment(id);if(!comments[id])await loadComments(id);}
  async function doVote(){if(!voteName.trim()||!voteTarget)return;const{error:e}=await supabase.from("votes").upsert({target_id:voteTarget,voter_name:voteName.trim()},{onConflict:"voter_name"});if(e){showToast("투표 실패","down");return;}await loadVotes();setVoteName("");setVoteTarget("");showToast("투표 완료! 🗳️","info");}
  function doChallenge(){if(soldiers.length<2)return;const sh=[...soldiers].sort(()=>Math.random()-.5);const[a,b]=[sh[0],sh[1]];const lift=LIFT_LABELS[Math.floor(Math.random()*3)].label;const tmpl=CHALLENGE_MSGS[Math.floor(Math.random()*CHALLENGE_MSGS.length)];setChallenge(tmpl(a.name,b.name,lift));setShowChallenge(true);}

  // Shared UI components
  const Btn=({children,onClick,disabled,color,style:s={}})=>(
    <button onClick={onClick} disabled={disabled||loading} style={{background:disabled||loading?C.bg3:color||C.accent,color:disabled||loading?C.text3:color?"#fff":"#000",border:"none",borderRadius:7,padding:"13px 20px",fontSize:15,fontWeight:900,cursor:disabled||loading?"default":"pointer",transition:"all .15s",...s}}>
      {loading?"처리 중...":children}
    </button>
  );
  const Ghost=({children,onClick,style:s={}})=>(
    <button onClick={onClick} style={{background:"transparent",border:`1px solid ${C.border2}`,color:C.text2,borderRadius:7,padding:"13px 20px",fontSize:14,fontWeight:700,cursor:"pointer",...s}}>{children}</button>
  );
  const ErrBanner=()=>error?(<div style={{background:"#3B1A1A",border:"1px solid #7F2A2A",borderRadius:8,padding:"10px 14px",marginBottom:16,color:"#FF7A7A",fontSize:13}}>⚠️ {error}<button onClick={()=>setError(null)} style={{float:"right",background:"none",border:"none",color:"#FF7A7A",cursor:"pointer",fontSize:16}}>×</button></div>):null;
  const RankBadge=({r})=>r?(<span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:4,background:(RANK_COLORS[r]||"#6B7280")+"20",color:RANK_COLORS[r]||"#6B7280",border:`1px solid ${(RANK_COLORS[r]||"#6B7280")}40`}}>{r}</span>):null;
  const MosBadge=({m})=>m?(<span style={{fontSize:10,fontWeight:700,padding:"1px 6px",borderRadius:4,background:(MOS_COLORS[m]||"#6B7280")+"20",color:MOS_COLORS[m]||"#6B7280"}}>{m}</span>):null;
  const UnitTag=({s})=>s?.company?(<span style={{fontSize:10,color:C.text3}}>{s.company}{s.post?` ${s.post}`:""}</span>):null;
  const ScorePreview=({bench,dead,ohp,weight,height})=>{if(!bench||!dead||!ohp)return null;const sc=calcScore(bench,dead,ohp,weight,height),info=SCORES[sc];return(<div className="fi" style={{background:info.color+"10",border:`1px solid ${info.color}40`,borderRadius:10,padding:16,textAlign:"center",marginBottom:20}}><div style={{fontSize:36,marginBottom:4}}>{info.emoji}</div><div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:22,color:info.color}}>{sc}점</div><div style={{color:info.color+"CC",fontSize:13,marginTop:2}}>{info.label}</div></div>);};

  const TB={up:"#166534",down:"#7F1D1D",best:"#78350F",info:"#1A1500"};
  const TBB={up:"#22C55E",down:"#EF4444",best:"#FFD700",info:C.accent};

  const NavBtn=({p,icon,label})=>(<button onClick={()=>setPage(p)} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,color:page===p?C.accent:C.text3,transition:"color .15s",padding:"8px 0"}}><span style={{fontSize:20}}>{icon}</span><span style={{fontSize:10,fontFamily:"'Noto Sans KR',sans-serif",fontWeight:700}}>{label}</span></button>);
  const BottomNav=()=>(<div style={{position:"fixed",bottom:0,left:0,right:0,background:C.bg2,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:30,paddingBottom:"env(safe-area-inset-bottom)"}}><NavBtn p="rankings" icon="🏆" label="랭킹"/><NavBtn p="team_battle" icon="🏴" label="부대전"/><NavBtn p="battle" icon="⚔️" label="1v1"/><NavBtn p="halloffame" icon="💀" label="전당"/><NavBtn p="vote" icon="🗳️" label="투표"/></div>);

  const SoldierCard=({user,idx})=>{
    const sc=calcScore(user.bench,user.dead,user.ohp,user.weight,user.height),info=SCORES[sc];
    const total=(user.bench||0)+(user.dead||0)+(user.ohp||0),isTop3=idx<3,isMe=user.id===myId;
    const medals=["🥇","🥈","🥉"],isOpen=openComment===user.id,isJjamji=jjamji?.id===user.id&&ranked.length>1;
    const uc=comments[user.id]||[];
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
                {isJjamji&&<span style={{fontSize:9,color:"#EF4444",fontWeight:700,background:"#EF444420",padding:"1px 5px",borderRadius:4}}>🎯타겟</span>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                {[["벤치",user.bench],["데드",user.dead],["OHP",user.ohp]].map(([l,v])=>(<span key={l} style={{fontSize:11}}><span style={{color:C.text3}}>{l} </span><span style={{fontFamily:"'Oswald',sans-serif",fontWeight:600,color:C.text,fontSize:12}}>{v}</span></span>))}
                <UnitTag s={user}/>
              </div>
            </div>
            <div style={{flexShrink:0,background:info.color+"14",border:`1px solid ${info.color}45`,borderRadius:8,padding:"4px 10px",textAlign:"center"}}>
              <div style={{fontFamily:"'Oswald',sans-serif",fontSize:24,fontWeight:700,color:info.color,lineHeight:1}}>{sc}</div>
              <div style={{fontSize:9,color:info.color+"88"}}>/ 5</div>
            </div>
          </div>
          <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{display:"flex",gap:3}}>{[1,2,3,4,5].map(i=><div key={i} style={{width:6,height:6,borderRadius:2,background:i<=sc?info.color:C.border2}}/>)}</div>
              <span style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:11,color:info.color}}>{info.label}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,color:C.text3}}>합계 <span style={{fontFamily:"'Oswald',sans-serif",color:C.text2,fontWeight:600}}>{total}kg</span></span>
              <button onClick={()=>toggleComment(user.id)} style={{background:isOpen?C.accent+"18":"none",border:`1px solid ${isOpen?C.accent+"60":C.border2}`,borderRadius:5,padding:"3px 9px",cursor:"pointer",color:isOpen?C.accent:C.text2,fontSize:11,fontFamily:"'Noto Sans KR',sans-serif",transition:"all .15s"}}>💬 {uc.length}</button>
            </div>
          </div>
        </div>
        {isOpen&&(
          <div className="fi" style={{background:C.bg,borderTop:`1px solid ${C.border}`,padding:"10px 14px"}}>
            {uc.length>0?(<div style={{maxHeight:150,overflowY:"auto",display:"flex",flexDirection:"column",gap:5,marginBottom:8}}>{uc.map(c=>(<div key={c.id} style={{background:C.bg2,borderRadius:6,padding:"6px 10px"}}><span style={{color:C.accent,fontWeight:700,fontSize:11}}>{c.name}</span><span style={{color:C.text3,fontSize:9,marginLeft:5}}>{new Date(c.created_at).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}</span><p style={{color:C.text,marginTop:2,fontSize:12,lineHeight:1.5}}>{c.content}</p></div>))}<div ref={commentEndRef}/></div>):<p style={{color:C.text3,fontSize:12,marginBottom:8}}>첫 댓글을 남겨보세요!</p>}
            <div style={{display:"flex",gap:6}}>
              <input placeholder="이름" value={cForm.name} onChange={e=>setCForm(f=>({...f,name:e.target.value}))} style={{width:76,padding:"7px 10px",flexShrink:0,background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:5,color:C.text,fontSize:12,outline:"none"}}/>
              <input placeholder="댓글" value={cForm.content} onChange={e=>setCForm(f=>({...f,content:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey)addComment();}} style={{flex:1,padding:"7px 10px",background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:5,color:C.text,fontSize:12,outline:"none"}}/>
              <button onClick={addComment} disabled={cLoading} style={{background:C.accent,border:"none",borderRadius:5,padding:"7px 12px",cursor:"pointer",fontWeight:900,color:"#000",fontSize:13,flexShrink:0}}>↑</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return(
    <>
    {/* INIT */}
    {page==="init"&&(<div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:40,animation:"pulse 1.4s infinite"}}>🏋️</div><p style={{color:C.text3,fontFamily:"monospace",fontSize:12,marginTop:12}}>체단실 접속 중...</p></div></div>)}

    {/* LANDING */}
    {page==="landing"&&(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
        <div style={{position:"fixed",inset:0,backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`,backgroundSize:"48px 48px",opacity:.35,pointerEvents:"none"}}/>
        <div style={{position:"fixed",left:0,right:0,height:"2px",background:"linear-gradient(transparent,rgba(200,169,66,.15),transparent)",animation:"scanline 6s linear infinite",pointerEvents:"none"}}/>
        <div className="fu" style={{position:"relative",textAlign:"center",maxWidth:380,width:"100%"}}>
          <div style={{fontSize:68,marginBottom:6,filter:"drop-shadow(0 0 20px rgba(200,169,66,.5))"}}>🏋️</div>
          <h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:34,color:C.accent,letterSpacing:"0.04em",marginBottom:4,textShadow:"0 0 30px rgba(200,169,66,.4)"}}>체단실 랭킹</h1>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:20}}>
            <div style={{height:1,width:40,background:C.border2}}/>
            <p style={{color:C.text2,fontSize:12,letterSpacing:"0.14em"}}>전군 파워리프팅 순위</p>
            <div style={{height:1,width:40,background:C.border2}}/>
          </div>
          {mySoldier&&myUnit&&(
            <div className="fi" style={{background:C.bg3,border:`1px solid ${C.accent}40`,borderRadius:10,padding:"10px 14px",marginBottom:16,textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                {mySoldier.photo?<img src={mySoldier.photo} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:40,height:40,borderRadius:"50%",background:C.bg4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👤</div>}
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{fontWeight:900,color:C.text,fontSize:14}}>{mySoldier.name}</span><RankBadge r={mySoldier.rank_name}/><MosBadge m={mySoldier.mos}/></div>
                  <div style={{color:C.text3,fontSize:11,marginTop:1}}>{myUnit.division} {myUnit.brigade} {myUnit.company}{myUnit.post?` ${myUnit.post}`:""}</div>
                </div>
                <div style={{textAlign:"right"}}><div style={{color:C.text3,fontSize:10}}>코드 {myUnitCode}</div></div>
              </div>
            </div>
          )}
          <ErrBanner/>
          <div style={{display:"flex",flexDirection:"column",gap:9,width:"100%",marginBottom:12}}>
            {mySoldier?(
              <>
                <Btn onClick={()=>{setEditId(myId);setLifts({bench:mySoldier.bench||"",dead:mySoldier.dead||"",ohp:mySoldier.ohp||""});setPage("lifts");}} style={{width:"100%",padding:14,fontSize:16}}>🔥 내 기록 갱신하기</Btn>
                <Ghost onClick={()=>setPage("rankings")} style={{width:"100%",padding:13,fontSize:15,color:C.text}}>🏆 랭킹 보기</Ghost>
              </>
            ):(
              <>
                <Btn onClick={()=>{setFoundUnit(null);setCodeInput("");setPage("join");}} style={{width:"100%",padding:15,fontSize:16}}>⚔️ 부대코드로 입장하기</Btn>
                <Ghost onClick={()=>{setCreatedCode(null);setNewUnit({division:"",brigade:"",company:"",post:""});setPage("create_unit");}} style={{width:"100%",padding:13,fontSize:15,color:C.text}}>🏴 새 부대 등록하기</Ghost>
                {ranked.length>0&&<button onClick={()=>setPage("rankings")} style={{background:"none",border:"none",color:C.text3,fontSize:13,cursor:"pointer",padding:8,fontFamily:"'Noto Sans KR',sans-serif"}}>📊 랭킹 구경하기 →</button>}
              </>
            )}
          </div>
          {soldiers.length>0&&<p style={{color:C.text3,fontSize:11}}>전체 {soldiers.length}명 · {units.length}개 부대</p>}
        </div>
      </div>
    )}

    {/* JOIN */}
    {page==="join"&&(
      <div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{maxWidth:400,width:"100%"}} className="fu">
          <button onClick={()=>setPage("landing")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer",marginBottom:24}}>←</button>
          <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>부대코드 입력</h2>
          <p style={{color:C.text2,fontSize:14,marginBottom:24}}>중대 관리자에게 받은 6자리 코드를 입력하세요</p>
          <ErrBanner/>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <GlowInput placeholder="예: AB1C2D" value={codeInput} onChange={v=>setCodeInput(v.toUpperCase())} style={{letterSpacing:"0.2em",fontSize:20,textAlign:"center"}}/>
            <Btn onClick={lookupCode} disabled={!codeInput.trim()} style={{flexShrink:0,padding:"0 16px"}}>확인</Btn>
          </div>
          {foundUnit&&(
            <div className="fi" style={{background:"#0A1A0A",border:"1px solid #22C55E40",borderRadius:10,padding:16,marginBottom:14}}>
              <div style={{color:"#22C55E",fontSize:12,fontWeight:700,marginBottom:6}}>✓ 부대 확인</div>
              <div style={{color:C.text,fontWeight:900,fontSize:16}}>{foundUnit.division} {foundUnit.brigade}</div>
              <div style={{color:C.text2,fontSize:14,marginTop:2}}>{foundUnit.company}{foundUnit.post?` · ${foundUnit.post}`:""}</div>
              <Btn onClick={()=>{setReg(r=>({...r,unitCode:foundUnit.code,division:foundUnit.division,brigade:foundUnit.brigade,company:foundUnit.company,post:foundUnit.post||""}));setRegStep(1);setPage("register");}} style={{width:"100%",padding:13,marginTop:14}}>이 부대로 가입하기 →</Btn>
            </div>
          )}
          <div style={{textAlign:"center",marginTop:16}}>
            <button onClick={()=>{setCreatedCode(null);setNewUnit({division:"",brigade:"",company:"",post:""});setPage("create_unit");}} style={{background:"none",border:"none",color:C.text3,fontSize:13,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>코드가 없으신가요? 새 부대 등록 →</button>
          </div>
        </div>
      </div>
    )}

    {/* CREATE UNIT */}
    {page==="create_unit"&&(
      <div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{maxWidth:400,width:"100%"}} className="fu">
          <button onClick={()=>setPage("landing")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer",marginBottom:24}}>←</button>
          <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>새 부대 등록</h2>
          <p style={{color:C.text2,fontSize:14,marginBottom:24}}>부대코드를 생성하고 소대원들과 공유하세요</p>
          <ErrBanner/>
          {!createdCode?(
            <>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                <GlowInput placeholder="사단 (예: 제5보병사단)" value={newUnit.division} onChange={v=>setNewUnit(u=>({...u,division:v}))}/>
                <GlowInput placeholder="여단/연대 (예: 제11보병여단)" value={newUnit.brigade} onChange={v=>setNewUnit(u=>({...u,brigade:v}))}/>
                <GlowInput placeholder="중대 (예: 3중대)" value={newUnit.company} onChange={v=>setNewUnit(u=>({...u,company:v}))}/>
                <GlowInput placeholder="소초/소대 (선택)" value={newUnit.post} onChange={v=>setNewUnit(u=>({...u,post:v}))}/>
              </div>
              <Btn onClick={createUnit} disabled={!newUnit.division||!newUnit.brigade||!newUnit.company} style={{width:"100%",padding:14}}>🏴 부대코드 생성하기</Btn>
            </>
          ):(
            <div className="fi">
              <div style={{background:"linear-gradient(135deg,#0A2A0A,#051505)",border:"1px solid #22C55E40",borderRadius:12,padding:24,textAlign:"center",marginBottom:16}}>
                <div style={{color:C.text2,fontSize:13,marginBottom:8}}>생성된 부대코드</div>
                <div style={{fontFamily:"'Oswald',sans-serif",fontSize:48,fontWeight:700,color:"#22C55E",letterSpacing:"0.2em",marginBottom:8}}>{createdCode}</div>
                <div style={{color:C.text,fontWeight:700,fontSize:14}}>{newUnit.division} {newUnit.brigade}</div>
                <div style={{color:C.text2,fontSize:13}}>{newUnit.company}{newUnit.post?` · ${newUnit.post}`:""}</div>
                <p style={{color:"#4ADE80",fontSize:12,marginTop:12,lineHeight:1.6}}>이 코드를 소대원들에게 공유하세요</p>
              </div>
              <Btn onClick={()=>{setRegStep(1);setPage("register");}} style={{width:"100%",padding:14}}>내 프로필 등록하기 →</Btn>
            </div>
          )}
        </div>
      </div>
    )}

    {/* REGISTER */}
    {page==="register"&&(
      <div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{maxWidth:400,width:"100%"}} className="fu">
          <div style={{display:"flex",gap:5,marginBottom:32}}>{[1,2,3].map(i=><div key={i} style={{flex:1,height:3,borderRadius:3,background:i<=regStep?C.accent:C.bg3,transition:"background .3s"}}/>)}</div>
          <ErrBanner/>
          {regStep===1&&(
            <>
              <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>계급 · 병과 선택</h2>
              <p style={{color:C.text2,fontSize:14,marginBottom:24}}>부대: <span style={{color:C.accent}}>{reg.company||reg.unitCode}</span></p>
              <div style={{marginBottom:20}}>
                <div style={{color:C.text2,fontSize:13,marginBottom:10}}>⭐ 계급</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {RANKS.map(r=>(<button key={r} onClick={()=>setReg(x=>({...x,rankName:r}))} style={{padding:"12px",borderRadius:8,border:`1px solid ${reg.rankName===r?(RANK_COLORS[r]||C.accent):C.border2}`,background:reg.rankName===r?(RANK_COLORS[r]||C.accent)+"18":C.bg3,color:reg.rankName===r?(RANK_COLORS[r]||C.accent):C.text2,fontWeight:700,fontSize:15,cursor:"pointer",transition:"all .15s",fontFamily:"'Noto Sans KR',sans-serif"}}>{r}</button>))}
                </div>
              </div>
              <div style={{marginBottom:24}}>
                <div style={{color:C.text2,fontSize:13,marginBottom:10}}>🔫 병과</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                  {MOS_LIST.map(m=>(<button key={m} onClick={()=>setReg(x=>({...x,mos:m}))} style={{padding:"9px 4px",borderRadius:7,border:`1px solid ${reg.mos===m?(MOS_COLORS[m]||C.accent):C.border2}`,background:reg.mos===m?(MOS_COLORS[m]||C.accent)+"18":C.bg3,color:reg.mos===m?(MOS_COLORS[m]||C.accent):C.text2,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all .15s",fontFamily:"'Noto Sans KR',sans-serif"}}>{m}</button>))}
                </div>
              </div>
              <Btn onClick={()=>{if(reg.rankName&&reg.mos)setRegStep(2);}} disabled={!reg.rankName||!reg.mos} style={{width:"100%",padding:14}}>다음 →</Btn>
            </>
          )}
          {regStep===2&&(
            <>
              <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>신병 정보 입력</h2>
              <p style={{color:C.text2,fontSize:14,marginBottom:24}}><RankBadge r={reg.rankName}/>{" "}<MosBadge m={reg.mos}/></p>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:24}}>
                <button onClick={()=>fileRef.current?.click()} style={{width:100,height:100,borderRadius:"50%",background:reg.photo?"none":C.bg3,border:`2px dashed ${reg.photo?"transparent":C.border2}`,cursor:"pointer",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}} onMouseEnter={e=>{if(!reg.photo)e.currentTarget.style.borderColor=C.accent}} onMouseLeave={e=>{if(!reg.photo)e.currentTarget.style.borderColor=C.border2}}>
                  {reg.photo?<img src={reg.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:30}}>📷</span>}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];if(f){const c=await compressPhoto(f);setReg(r=>({...r,photo:c}));}}}/>
                <p style={{color:C.text3,fontSize:11,marginTop:6}}>프로필 사진 (선택)</p>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                <GlowInput placeholder="이름 (예: 김상병)" value={reg.name} onChange={v=>setReg(r=>({...r,name:v}))}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <GlowInput placeholder="키 (cm)" value={reg.height} onChange={v=>setReg(r=>({...r,height:v}))} type="number"/>
                  <GlowInput placeholder="몸무게 (kg)" value={reg.weight} onChange={v=>setReg(r=>({...r,weight:v}))} type="number"/>
                </div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <Ghost onClick={()=>setRegStep(1)} style={{flex:1,padding:13}}>← 이전</Ghost>
                <Btn onClick={()=>{if(reg.name&&reg.height&&reg.weight)setRegStep(3);}} disabled={!reg.name||!reg.height||!reg.weight} style={{flex:2,padding:13}}>다음 →</Btn>
              </div>
            </>
          )}
          {regStep===3&&(
            <>
              <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:28,color:C.text,marginBottom:4}}>1RM 입력</h2>
              <p style={{color:C.text2,fontSize:14,marginBottom:24}}><span style={{color:C.accent}}>{reg.name}</span>, 최대 중량을 입력하세요</p>
              {LIFT_LABELS.map(({key,icon,label})=>(<div key={key} style={{marginBottom:12}}><label style={{color:C.text2,fontSize:13,display:"block",marginBottom:6}}>{icon} {label}</label><GlowInput placeholder={`${label} 1RM (kg)`} value={lifts[key]} onChange={v=>setLifts(l=>({...l,[key]:v}))} type="number"/></div>))}
              <div style={{marginTop:8,marginBottom:4}}><ScorePreview bench={lifts.bench} dead={lifts.dead} ohp={lifts.ohp} weight={reg.weight} height={reg.height}/></div>
              <div style={{display:"flex",gap:10,marginTop:8}}>
                <Ghost onClick={()=>setRegStep(2)} style={{flex:1,padding:13}}>← 이전</Ghost>
                <Btn onClick={()=>{if(lifts.bench&&lifts.dead&&lifts.ohp)doRegister();}} disabled={!lifts.bench||!lifts.dead||!lifts.ohp} style={{flex:2,padding:13}}>🎖️ 등록 완료</Btn>
              </div>
            </>
          )}
        </div>
      </div>
    )}

    {/* LIFTS UPDATE */}
    {page==="lifts"&&(()=>{const user=soldiers.find(u=>u.id===editId);return(
      <div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{maxWidth:400,width:"100%"}} className="fu">
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
            <button onClick={()=>setPage(myId===editId?"landing":"select")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer"}}>←</button>
            <div><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:26,color:C.text}}>기록 갱신</h2><p style={{color:C.text2,fontSize:13}}>{user?.name}{user?.streak>0&&<span style={{marginLeft:8,color:"#FB923C"}}>🔥{user.streak}일 연속</span>}</p></div>
          </div>
          <ErrBanner/>
          {LIFT_LABELS.map(({key,icon,label})=>(<div key={key} style={{marginBottom:12}}><label style={{color:C.text2,fontSize:13,display:"block",marginBottom:6}}>{icon} {label}{user?.[key]&&<span style={{color:C.text3,marginLeft:8,fontSize:11}}>현재 {user[key]}kg</span>}</label><GlowInput placeholder={`${label} 1RM (kg)`} value={lifts[key]} onChange={v=>setLifts(l=>({...l,[key]:v}))} type="number"/></div>))}
          <div style={{marginTop:8,marginBottom:4}}><ScorePreview bench={lifts.bench} dead={lifts.dead} ohp={lifts.ohp} weight={user?.weight} height={user?.height}/></div>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <Ghost onClick={()=>setPage(myId===editId?"landing":"rankings")} style={{flex:1,padding:13}}>취소</Ghost>
            <Btn onClick={()=>{if(lifts.bench&&lifts.dead&&lifts.ohp)doUpdateLifts();}} disabled={!lifts.bench||!lifts.dead||!lifts.ohp} style={{flex:2,padding:13}}>🔥 갱신하기</Btn>
          </div>
        </div>
      </div>
    );})()}

    {/* SELECT */}
    {page==="select"&&(
      <div style={{minHeight:"100vh",background:C.bg,padding:"24px 16px"}}>
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,paddingTop:8}}>
            <button onClick={()=>setPage("rankings")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer"}}>←</button>
            <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:22,color:C.text}}>병사 선택</h2>
          </div>
          <div className="fu" style={{display:"flex",flexDirection:"column",gap:6}}>
            {soldiers.map(u=>{const has=u.bench||u.dead||u.ohp,info=has?SCORES[calcScore(u.bench,u.dead,u.ohp,u.weight,u.height)]:null;return(
              <button key={u.id} onClick={()=>{setEditId(u.id);setLifts({bench:u.bench||"",dead:u.dead||"",ohp:u.ohp||""});setPage("lifts");}} style={{display:"flex",alignItems:"center",gap:10,background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:10,padding:"10px 13px",cursor:"pointer",textAlign:"left"}} onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent+"60"} onMouseLeave={e=>e.currentTarget.style.borderColor=C.border2}>
                {u.photo?<img src={u.photo} style={{width:40,height:40,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>:<div style={{width:40,height:40,borderRadius:"50%",background:C.bg4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>👤</div>}
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{fontWeight:900,color:C.text,fontSize:14}}>{u.name}</span><RankBadge r={u.rank_name}/><MosBadge m={u.mos}/></div>
                  <div style={{color:C.text2,fontSize:11,marginTop:1}}>{has?`벤치 ${u.bench} · 데드 ${u.dead} · OHP ${u.ohp}`:"기록 없음"}{u.streak>1&&<span style={{marginLeft:5,color:"#FB923C"}}>🔥{u.streak}</span>}</div>
                  <UnitTag s={u}/>
                </div>
                {info&&<span style={{fontSize:17}}>{info.emoji}</span>}
              </button>
            );})}
          </div>
        </div>
      </div>
    )}

    {/* RANKINGS */}
    {page==="rankings"&&(
      <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Sans KR',sans-serif",paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20}}>
          <div><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:17,color:C.accent}}>🏋️ 체단실 랭킹</h1><p style={{color:C.text3,fontSize:10,marginTop:1}}>{ranked.length}명 등록</p></div>
          <div style={{display:"flex",gap:5}}>
            <button onClick={()=>setPage("select")} style={{background:C.bg4,border:`1px solid ${C.border2}`,color:C.text,padding:"6px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:700}}>🔥 갱신</button>
            <button onClick={()=>{setFoundUnit(null);setCodeInput("");setPage("join");}} style={{background:C.accent,border:"none",color:"#000",padding:"6px 9px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:900}}>+ 등록</button>
            <button onClick={()=>setPage("landing")} style={{background:"none",border:`1px solid ${C.border}`,color:C.text3,padding:"6px 8px",borderRadius:6,cursor:"pointer",fontSize:11}}>🏠</button>
          </div>
        </div>
        <div style={{padding:"10px 12px",maxWidth:520,margin:"0 auto"}}>
          <div style={{background:`linear-gradient(135deg,${C.bg2},${C.bg3})`,border:`1px solid ${C.border2}`,borderRadius:12,padding:"11px 14px",marginBottom:7,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{color:C.text3,fontSize:10,letterSpacing:"0.1em",marginBottom:2}}>⚡ 전군 총 전투력</div><div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,color:C.accent}}>{totalPower.toLocaleString()}<span style={{fontSize:12,marginLeft:3,color:C.text2}}>kg</span></div></div>
            <div style={{textAlign:"right"}}><div style={{color:C.text3,fontSize:10}}>사단 최강자</div>{ranked.length>0&&<div style={{color:"#FFD700",fontWeight:900,fontSize:13}}>{ranked[0]?.name} 👑</div>}</div>
          </div>
          {weeklyKing&&(<div className="fi" style={{background:"linear-gradient(135deg,#3A2800,#1A1500)",border:"1px solid #C8A94250",borderRadius:10,padding:"9px 13px",marginBottom:7,display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:22}}>👑</span><div style={{flex:1}}><div style={{color:C.accent,fontSize:10,fontWeight:700,letterSpacing:"0.1em"}}>이주의 갱신왕</div><div style={{color:C.text,fontWeight:900,fontSize:14}}>{weeklyKing.name}</div></div><div style={{textAlign:"right"}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:19,color:C.accent,fontWeight:700}}>{weeklyKing.wc}</div><div style={{color:C.text3,fontSize:9}}>회 갱신</div></div></div>)}
          <button onClick={doChallenge} style={{width:"100%",background:"linear-gradient(135deg,#1A1A2E,#16213E)",border:"1px solid #4A4A8A40",borderRadius:9,padding:9,cursor:"pointer",fontSize:11,color:"#8080CC",fontWeight:700,marginBottom:9,fontFamily:"'Noto Sans KR',sans-serif"}}>🎰 오늘의 도전 뽑기</button>
          <div style={{display:"flex",gap:4,marginBottom:9,overflowX:"auto",paddingBottom:2}}>
            {[["all","🌐 전체"],["myunit","🏠 내부대"],["rank","⭐ 계급"],["mos","🔫 병과"],["improve","📈 상승률"],["attend","📅 출석"]].map(([t,l])=>(<button key={t} onClick={()=>setRankTab(t)} style={{flexShrink:0,padding:"6px 10px",borderRadius:7,border:"none",cursor:"pointer",background:rankTab===t?C.accent:C.bg3,color:rankTab===t?"#000":C.text2,fontSize:10,fontWeight:900,fontFamily:"'Noto Sans KR',sans-serif",transition:"all .15s"}}>{l}</button>))}
          </div>

          {rankTab==="all"&&(ranked.length===0?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:48,marginBottom:12}}>🥚</div><p>아직 기록이 없습니다</p></div>:ranked.map((u,i)=><SoldierCard key={u.id} user={u} idx={i}/>))}

          {rankTab==="myunit"&&(!myUnitCode?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:40,marginBottom:12}}>🏠</div><p style={{marginBottom:12}}>로그인 후 이용 가능합니다</p><Btn onClick={()=>setPage("join")} style={{fontSize:13,padding:"10px 20px"}}>부대코드 입장</Btn></div>:myUnitRanked.length===0?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><p>내 부대 기록이 없습니다</p></div>:myUnitRanked.map((u,i)=><SoldierCard key={u.id} user={u} idx={i}/>))}

          {rankTab==="rank"&&(<div>{RANKS.slice().reverse().map(rn=>{const rs=ranked.filter(s=>s.rank_name===rn);if(!rs.length)return null;return(<div key={rn} style={{marginBottom:18}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{width:7,height:7,borderRadius:"50%",background:RANK_COLORS[rn]||"#6B7280"}}/><span style={{color:RANK_COLORS[rn]||"#6B7280",fontWeight:900,fontSize:13,fontFamily:"'Black Han Sans',sans-serif"}}>{rn}</span><span style={{color:C.text3,fontSize:11}}>{rs.length}명</span></div>{rs.slice(0,5).map((u,i)=><SoldierCard key={u.id} user={u} idx={i}/>)}{rs.length>5&&<p style={{color:C.text3,fontSize:11,textAlign:"center",marginTop:3}}>+{rs.length-5}명</p>}</div>);})}</div>)}

          {rankTab==="mos"&&(<div>{MOS_LIST.map(m=>{const ms=ranked.filter(s=>s.mos===m);if(!ms.length)return null;return(<div key={m} style={{marginBottom:18}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{width:7,height:7,borderRadius:"50%",background:MOS_COLORS[m]||"#6B7280"}}/><span style={{color:MOS_COLORS[m]||"#6B7280",fontWeight:900,fontSize:13,fontFamily:"'Black Han Sans',sans-serif"}}>{m}</span><span style={{color:C.text3,fontSize:11}}>{ms.length}명</span></div>{ms.slice(0,5).map((u,i)=><SoldierCard key={u.id} user={u} idx={i}/>)}{ms.length>5&&<p style={{color:C.text3,fontSize:11,textAlign:"center",marginTop:3}}>+{ms.length-5}명</p>}</div>);}){MOS_LIST.every(m=>!ranked.filter(s=>s.mos===m).length)&&<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><p>병과 정보가 없습니다</p></div>}</div>)}

          {rankTab==="improve"&&(improveRanked.length===0?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:40,marginBottom:12}}>📈</div><p>기록을 한 번 갱신하면 표시됩니다</p></div>:improveRanked.map((u,i)=>{const up=u.improveRate>0;return(<div key={u.id} className="ri" style={{background:C.bg2,border:`1px solid ${up?"#22C55E30":C.border}`,borderRadius:12,marginBottom:7,padding:"12px 13px",animationDelay:`${i*.055}s`}}><div style={{display:"flex",alignItems:"center",gap:9}}><div style={{width:26,textAlign:"center",fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:700,color:C.text3,flexShrink:0}}>#{i+1}</div>{u.photo?<img src={u.photo} style={{width:42,height:42,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>:<div style={{width:42,height:42,borderRadius:"50%",background:C.bg4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{fontWeight:900,color:C.text,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/><MosBadge m={u.mos}/></div><div style={{fontSize:11,color:C.text3,marginTop:2}}>{u.prevTotal}kg → <span style={{color:C.text}}>{u.curTotal}kg</span></div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:up?"#22C55E":"#EF4444"}}>{up?"+":""}{u.improveRate.toFixed(1)}%</div><div style={{fontSize:9,color:C.text3}}>상승률</div></div></div></div>);}))}

          {rankTab==="attend"&&(()=>{const att=soldiers.filter(u=>u.last_record_date===today),abs=soldiers.filter(u=>u.last_record_date!==today);return(<div><div style={{marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}><div style={{width:6,height:6,borderRadius:"50%",background:"#22C55E"}}/><span style={{color:"#22C55E",fontSize:12,fontWeight:700}}>오늘 출석 ({att.length}명)</span></div>{att.length===0?<p style={{color:C.text3,fontSize:12,padding:"8px 0"}}>오늘 아직 아무도 안 갔습니다 💀</p>:att.map(u=>(<div key={u.id} style={{display:"flex",alignItems:"center",gap:9,background:"#052010",border:"1px solid #22C55E25",borderRadius:9,padding:"9px 13px",marginBottom:5}}>{u.photo?<img src={u.photo} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:34,height:34,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{color:C.text,fontWeight:700,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/></div><UnitTag s={u}/></div>{u.streak>1&&<span style={{fontSize:11,color:"#FB923C"}}>🔥{u.streak}일</span>}<span style={{color:"#22C55E",fontSize:12}}>✓</span></div>))}</div><div><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}><div style={{width:6,height:6,borderRadius:"50%",background:"#EF4444"}}/><span style={{color:"#EF4444",fontSize:12,fontWeight:700}}>오늘 결석 ({abs.length}명)</span></div>{abs.map(u=>(<div key={u.id} style={{display:"flex",alignItems:"center",gap:9,background:C.bg2,border:"1px solid #EF444425",borderRadius:9,padding:"9px 13px",marginBottom:5,opacity:.65}}>{u.photo?<img src={u.photo} style={{width:34,height:34,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:34,height:34,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{color:C.text2,fontWeight:700,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/></div><UnitTag s={u}/></div><span style={{color:"#EF4444",fontSize:11}}>🥚</span></div>))}</div></div>);})()}

          {rankTab==="all"&&soldiers.filter(u=>!u.bench&&!u.dead&&!u.ohp).length>0&&(<div style={{marginTop:16}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:7}}><div style={{flex:1,height:1,background:C.border}}/><span style={{color:C.text3,fontSize:10,whiteSpace:"nowrap"}}>짬지 예약석</span><div style={{flex:1,height:1,background:C.border}}/></div>{soldiers.filter(u=>!u.bench&&!u.dead&&!u.ohp).map(u=>(<div key={u.id} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 12px",marginBottom:4,display:"flex",alignItems:"center",gap:8,opacity:.4}}>{u.photo?<img src={u.photo} style={{width:30,height:30,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:30,height:30,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>👤</div>}<span style={{color:C.text2,fontWeight:700,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/><span style={{color:C.text3,fontSize:11,marginLeft:"auto"}}>🥚</span></div>))}</div>)}
        </div>
        <BottomNav/>
      </div>
    )}

    {/* TEAM BATTLE */}
    {page==="team_battle"&&(
      <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",position:"sticky",top:0,zIndex:20}}><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:"#4ADE80"}}>🏴 부대 대항전</h1><p style={{color:C.text3,fontSize:10,marginTop:1}}>중대별 팀 랭킹</p></div>
        <div style={{padding:"12px 12px",maxWidth:520,margin:"0 auto"}}>
          <p style={{color:C.text3,fontSize:11,marginBottom:9,letterSpacing:"0.08em"}}>중대별 평균 점수 순위</p>
          {teamRankings.length===0?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:40,marginBottom:12}}>🏴</div><p>부대 데이터가 없습니다</p></div>
            :teamRankings.map(({code,unit,sols,avgScore,totalPow,count},idx)=>{
              const sc=avgScore>=4?"#FFD700":avgScore>=3?"#C084FC":avgScore>=2?"#60A5FA":"#4ADE80",isMyUnit=code===myUnitCode;
              return(<div key={code} className="ri" style={{background:isMyUnit?"linear-gradient(140deg,#0A1500,#051000)":C.bg2,border:`1px solid ${isMyUnit?"#4ADE8050":idx===0?"#FFD70030":C.border}`,borderRadius:12,marginBottom:7,padding:"13px 14px",boxShadow:idx===0?"0 4px 20px rgba(255,215,0,.1)":"none",animationDelay:`${idx*.05}s`}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:30,textAlign:"center",fontFamily:"'Oswald',sans-serif",fontSize:17,fontWeight:700,color:idx===0?"#FFD700":C.text3,flexShrink:0}}>{idx===0?"🥇":idx===1?"🥈":idx===2?"🥉":`#${idx+1}`}</div>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:2}}><span style={{fontWeight:900,color:C.text,fontSize:14}}>{unit?.company||code}</span>{isMyUnit&&<span style={{fontSize:9,color:"#4ADE80",fontWeight:700,background:"#4ADE8020",padding:"1px 5px",borderRadius:4}}>내 부대</span>}</div>
                    <div style={{color:C.text3,fontSize:11}}>{unit?.division||""} {unit?.brigade||""}</div>
                    <div style={{marginTop:5,display:"flex",gap:10}}><span style={{fontSize:11,color:C.text3}}>인원 <span style={{color:C.text,fontWeight:700}}>{count}명</span></span><span style={{fontSize:11,color:C.text3}}>합산 <span style={{fontFamily:"'Oswald',sans-serif",color:C.text,fontWeight:600}}>{totalPow}kg</span></span></div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,color:sc,lineHeight:1}}>{avgScore.toFixed(1)}</div><div style={{fontSize:9,color:C.text3}}>평균점수</div></div>
                </div>
                <div style={{marginTop:9,paddingTop:9,borderTop:`1px solid ${C.border}`,display:"flex",gap:5,overflowX:"auto"}}>
                  {sols.slice(0,5).map(s=>(<div key={s.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}}>{s.photo?<img src={s.photo} style={{width:30,height:30,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:30,height:30,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>👤</div>}<span style={{fontSize:9,color:C.text2,maxWidth:34,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span></div>))}
                  {sols.length>5&&<div style={{display:"flex",alignItems:"center",color:C.text3,fontSize:10,flexShrink:0}}>+{sols.length-5}</div>}
                </div>
              </div>);
            })}

          {teamRankings.length>=2&&(<>
            <div style={{display:"flex",alignItems:"center",gap:8,margin:"16px 0 10px"}}><div style={{flex:1,height:1,background:C.border}}/><span style={{color:C.text3,fontSize:11}}>⚔️ 소초 대 소초</span><div style={{flex:1,height:1,background:C.border}}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:7,alignItems:"center",marginBottom:10}}>
              <select value={teamA} onChange={e=>setTeamA(e.target.value)} style={{background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:8,padding:"9px 7px",fontSize:12,outline:"none"}}><option value="">-- 도전 --</option>{teamRankings.map(t=><option key={t.code} value={t.code}>{t.unit?.company||t.code}</option>)}</select>
              <div style={{textAlign:"center",color:C.text3,fontFamily:"'Black Han Sans',sans-serif",fontSize:14}}>VS</div>
              <select value={teamB} onChange={e=>setTeamB(e.target.value)} style={{background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:8,padding:"9px 7px",fontSize:12,outline:"none"}}><option value="">-- 상대 --</option>{teamRankings.filter(t=>t.code!==teamA).map(t=><option key={t.code} value={t.code}>{t.unit?.company||t.code}</option>)}</select>
            </div>
            {teamA&&teamB&&(()=>{const ta=teamRankings.find(t=>t.code===teamA),tb=teamRankings.find(t=>t.code===teamB);if(!ta||!tb)return null;const win=ta.avgScore>tb.avgScore?ta:tb.avgScore>ta.avgScore?tb:null;return(<div className="fi" style={{background:C.bg3,border:`1px solid ${C.border2}`,borderRadius:12,padding:14}}>
              {[["평균 점수",ta.avgScore.toFixed(1),tb.avgScore.toFixed(1)],["합산 중량",`${ta.totalPow}kg`,`${tb.totalPow}kg`],["인원",`${ta.count}명`,`${tb.count}명`]].map(([lbl,av,bv])=>(<div key={lbl} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:7,alignItems:"center",marginBottom:9}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:18,fontWeight:700,color:C.text,textAlign:"right"}}>{av}</div><div style={{color:C.text3,fontSize:10,textAlign:"center",minWidth:54}}>{lbl}</div><div style={{fontFamily:"'Oswald',sans-serif",fontSize:18,fontWeight:700,color:C.text}}>{bv}</div></div>))}
              <div style={{textAlign:"center",marginTop:10,padding:"11px",background:win?"linear-gradient(135deg,#2A2000,#1A1500)":C.bg2,borderRadius:8,border:`1px solid ${win?C.accent+"50":C.border}`}}>{win?<div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:18,color:C.accent}}>🏆 {win.unit?.company||win.code} 승리!</div>:<div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:16,color:C.text2}}>🤝 동점</div>}</div>
            </div>);})()}
          </>)}
        </div>
        <BottomNav/>
      </div>
    )}

    {/* BATTLE 1v1 */}
    {page==="battle"&&(()=>{
      const a=soldiers.find(s=>s.id===battleA),b=soldiers.find(s=>s.id===battleB);
      const aT=a?(a.bench||0)+(a.dead||0)+(a.ohp||0):0,bT=b?(b.bench||0)+(b.dead||0)+(b.ohp||0):0;
      const win=a&&b&&aT!==bT?(aT>bT?a:b):null;
      return(<div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",position:"sticky",top:0,zIndex:20}}><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:"#60A5FA"}}>⚔️ 1대1 대결</h1><p style={{color:C.text3,fontSize:10,marginTop:1}}>종목별 맞대결</p></div>
        <div style={{padding:"12px 12px",maxWidth:520,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:7,alignItems:"center",marginBottom:14}}>
            <select value={battleA} onChange={e=>setBattleA(e.target.value)} style={{background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:8,padding:"9px 7px",fontSize:12,outline:"none"}}><option value="">-- 도전자 --</option>{soldiers.map(s=><option key={s.id} value={s.id}>{s.name}({s.rank_name||"?"})</option>)}</select>
            <div style={{textAlign:"center",fontFamily:"'Black Han Sans',sans-serif",fontSize:14,color:C.text3}}>VS</div>
            <select value={battleB} onChange={e=>setBattleB(e.target.value)} style={{background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,borderRadius:8,padding:"9px 7px",fontSize:12,outline:"none"}}><option value="">-- 상대 --</option>{soldiers.filter(s=>s.id!==battleA).map(s=><option key={s.id} value={s.id}>{s.name}({s.rank_name||"?"})</option>)}</select>
          </div>
          {a&&b&&(<div className="fi">
            <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",marginBottom:14,textAlign:"center"}}>
              <div>{a.photo?<img src={a.photo} style={{width:60,height:60,borderRadius:"50%",objectFit:"cover",border:"3px solid #C8A94250",margin:"0 auto",display:"block"}}/>:<div style={{width:60,height:60,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto"}}>👤</div>}<div style={{fontWeight:900,color:C.text,marginTop:4,fontSize:13}}>{a.name}</div><RankBadge r={a.rank_name}/></div>
              <div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:18,color:C.text3}}>⚔️</div>
              <div>{b.photo?<img src={b.photo} style={{width:60,height:60,borderRadius:"50%",objectFit:"cover",border:"3px solid #EF444450",margin:"0 auto",display:"block"}}/>:<div style={{width:60,height:60,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto"}}>👤</div>}<div style={{fontWeight:900,color:C.text,marginTop:4,fontSize:13}}>{b.name}</div><RankBadge r={b.rank_name}/></div>
            </div>
            {LIFT_LABELS.map(({key,icon,label})=>{const av=a[key]||0,bv=b[key]||0,mx=Math.max(av,bv)||1,aW=av>bv,bW=bv>av;return(<div key={key} style={{background:C.bg2,border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",marginBottom:6}}><div style={{color:C.text2,fontSize:11,marginBottom:7,fontWeight:700}}>{icon} {label}</div><div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:7,alignItems:"center"}}><div style={{textAlign:"right"}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:aW?"#FFD700":C.text}}>{av}<span style={{fontSize:11}}>kg</span></div><div style={{height:3,borderRadius:2,marginTop:4,background:aW?"#FFD700":C.bg4,width:`${(av/mx)*100}%`,minWidth:av>0?2:0,marginLeft:"auto"}}/></div><div style={{textAlign:"center",fontSize:10,color:C.text3,fontWeight:700,minWidth:28}}>{av===bv?"🤝":aW?"◀":"▶"}</div><div><div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:bW?"#FFD700":C.text}}>{bv}<span style={{fontSize:11}}>kg</span></div><div style={{height:3,borderRadius:2,marginTop:4,background:bW?"#FFD700":C.bg4,width:`${(bv/mx)*100}%`,minWidth:bv>0?2:0}}/></div></div></div>);})}
            <div style={{background:win?"linear-gradient(135deg,#2A2000,#1A1500)":C.bg2,border:`1px solid ${win?C.accent+"50":C.border}`,borderRadius:10,padding:"14px",textAlign:"center",marginTop:4}}>{win?<><div style={{fontSize:30,marginBottom:3}}>🏆</div><div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:20,color:C.accent}}>{win.name} 승리!</div><div style={{color:C.text2,fontSize:12,marginTop:3}}>{Math.max(aT,bT)}kg vs {Math.min(aT,bT)}kg</div></>:<><div style={{fontSize:28,marginBottom:3}}>🤝</div><div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:16,color:C.text2}}>무승부</div></>}</div>
          </div>)}
          {!a&&!b&&<div style={{textAlign:"center",paddingTop:60,color:C.text3}}><div style={{fontSize:40,marginBottom:10}}>⚔️</div><p>두 병사를 선택하세요</p></div>}
        </div>
        <BottomNav/>
      </div>);
    })()}

    {/* HALL OF FAME */}
    {page==="halloffame"&&(
      <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",position:"sticky",top:0,zIndex:20}}><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:"#FFD700"}}>💀 명예의 전당</h1><p style={{color:C.text3,fontSize:10,marginTop:1}}>역대 신기록 달성 기록</p></div>
        <div style={{padding:"12px 12px",maxWidth:520,margin:"0 auto"}}>
          <p style={{color:C.text3,fontSize:11,marginBottom:9}}>현재 개인 최고기록 TOP</p>
          {[...ranked].sort((a,b)=>{const at=(a.bench||0)+(a.dead||0)+(a.ohp||0),bt=(b.bench||0)+(b.dead||0)+(b.ohp||0);return bt-at;}).map((u,i)=>{const t=(u.bench||0)+(u.dead||0)+(u.ohp||0),isF=i===0;return(<div key={u.id} style={{background:isF?"linear-gradient(135deg,#2A2000,#1A1500)":C.bg2,border:`1px solid ${isF?"#FFD70050":C.border}`,borderRadius:10,padding:"11px 13px",marginBottom:6,display:"flex",alignItems:"center",gap:9}}><div style={{width:24,textAlign:"center",fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:700,color:isF?"#FFD700":C.text3}}>{isF?"🥇":`#${i+1}`}</div>{u.photo?<img src={u.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:38,height:38,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}><span style={{fontWeight:900,color:C.text,fontSize:13}}>{u.name}</span><RankBadge r={u.rank_name}/><MosBadge m={u.mos}/></div><div style={{fontSize:11,color:C.text2,marginTop:1}}>벤치 {u.bench} · 데드 {u.dead} · OHP {u.ohp}</div><UnitTag s={u}/></div><div style={{textAlign:"right"}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:19,fontWeight:700,color:"#FFD700"}}>{t}</div><div style={{fontSize:9,color:C.text3}}>kg</div></div></div>);})}
          {liftHistory.filter(h=>h.is_personal_best).length>0&&(<><div style={{display:"flex",alignItems:"center",gap:7,margin:"16px 0 9px"}}><div style={{flex:1,height:1,background:C.border}}/><span style={{color:C.text3,fontSize:10}}>🏆 신기록 달성 히스토리</span><div style={{flex:1,height:1,background:C.border}}/></div>{liftHistory.filter(h=>h.is_personal_best).slice(0,20).map(h=>{const sol=soldiers.find(s=>s.id===h.soldier_id);return(<div key={h.id} style={{background:C.bg3,border:"1px solid #FFD70020",borderRadius:8,padding:"8px 12px",marginBottom:5,display:"flex",alignItems:"center",gap:7}}><span style={{fontSize:14}}>🏆</span><div style={{flex:1}}><span style={{color:"#FFD700",fontWeight:700,fontSize:11}}>{sol?.name||"??"}</span><span style={{color:C.text2,fontSize:11,marginLeft:4}}>합계 {h.total}kg 신기록</span></div><span style={{color:C.text3,fontSize:10}}>{new Date(h.recorded_at).toLocaleDateString("ko-KR")}</span></div>);})}</>)}
        </div>
        <BottomNav/>
      </div>
    )}

    {/* VOTE */}
    {page==="vote"&&(
      <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"11px 14px",position:"sticky",top:0,zIndex:20}}><h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:"#C084FC"}}>🗳️ 진짜 제일 센 놈</h1><p style={{color:C.text3,fontSize:10,marginTop:1}}>기록 말고 진짜 최강자 익명 투표</p></div>
        <div style={{padding:"12px 12px",maxWidth:520,margin:"0 auto"}}>
          <div style={{background:C.bg2,border:`1px solid ${C.border2}`,borderRadius:12,padding:13,marginBottom:14}}>
            <GlowInput placeholder="내 이름" value={voteName} onChange={setVoteName} style={{marginBottom:7}}/>
            <select value={voteTarget} onChange={e=>setVoteTarget(e.target.value)} style={{width:"100%",background:C.bg3,color:voteTarget?C.text:C.text3,border:`1px solid ${C.border2}`,borderRadius:6,padding:"11px 13px",fontSize:14,outline:"none",marginBottom:11}}><option value="">-- 투표할 병사 선택 --</option>{soldiers.map(s=><option key={s.id} value={s.id}>{s.name} ({s.rank_name||""})</option>)}</select>
            <Btn onClick={doVote} disabled={!voteName.trim()||!voteTarget} color="#7C3AED" style={{width:"100%",padding:11}}>🗳️ 투표하기</Btn>
          </div>
          <p style={{color:C.text3,fontSize:11,marginBottom:9}}>현재 투표 현황 — 총 {votes.length}표</p>
          {voteRanked.length===0?<div style={{textAlign:"center",paddingTop:40,color:C.text3}}><div style={{fontSize:34,marginBottom:7}}>🗳️</div><p>아직 투표가 없습니다</p></div>:voteRanked.map(([id,cnt],i)=>{const sol=soldiers.find(s=>s.id===id),mx=voteRanked[0][1],isF=i===0;return(<div key={id} style={{background:isF?"linear-gradient(135deg,#2A1A4A,#1A0F2E)":C.bg2,border:`1px solid ${isF?"#C084FC50":C.border}`,borderRadius:10,padding:"11px 13px",marginBottom:6,display:"flex",alignItems:"center",gap:9}}><div style={{width:24,textAlign:"center",fontFamily:"'Oswald',sans-serif",fontSize:15,fontWeight:700,color:isF?"#C084FC":C.text3}}>{isF?"👑":`#${i+1}`}</div>{sol?.photo?<img src={sol.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover"}}/>:<div style={{width:38,height:38,borderRadius:"50%",background:C.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>}<div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:4}}><span style={{fontWeight:900,color:C.text,fontSize:13}}>{sol?.name||"??"}</span><RankBadge r={sol?.rank_name}/><MosBadge m={sol?.mos}/></div><div style={{height:3,borderRadius:2,background:C.bg4}}><div style={{height:"100%",borderRadius:2,background:isF?"#C084FC":"#4A3A6A",width:`${(cnt/mx)*100}%`,transition:"width .5s"}}/></div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontFamily:"'Oswald',sans-serif",fontSize:19,fontWeight:700,color:isF?"#C084FC":C.text}}>{cnt}</div><div style={{fontSize:9,color:C.text3}}>표</div></div></div>);})}
        </div>
        <BottomNav/>
      </div>
    )}

    {/* TOAST */}
    {toast&&(<div style={{position:"fixed",top:20,right:16,zIndex:999,background:TB[toast.type]||"#1A1500",border:`1px solid ${TBB[toast.type]||C.accent}`,borderRadius:10,padding:"10px 14px",maxWidth:270,animation:"toastIn .3s ease",boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}><p style={{color:C.text,fontSize:13,fontWeight:700}}>{toast.msg}</p></div>)}

    {/* CHALLENGE MODAL */}
    {showChallenge&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:998,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setShowChallenge(false)}><div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(135deg,#1A1A2E,#0F0F1E)",border:"1px solid #4A4A8A",borderRadius:16,padding:"26px 22px",maxWidth:330,width:"100%",textAlign:"center",animation:"modalIn .3s ease"}}><div style={{fontSize:44,marginBottom:10}}>🎰</div><h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:18,color:"#8080CC",marginBottom:14}}>오늘의 도전</h2><p style={{color:C.text,fontSize:15,lineHeight:1.7,fontWeight:700,marginBottom:22}}>{challenge}</p><div style={{display:"flex",gap:7}}><button onClick={doChallenge} style={{flex:1,background:"#2A2A5A",border:"1px solid #4A4A8A",borderRadius:8,padding:"10px",color:"#8080CC",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>🔄 다시</button><button onClick={()=>setShowChallenge(false)} style={{flex:1,background:C.accent,border:"none",borderRadius:8,padding:"10px",color:"#000",fontSize:12,fontWeight:900,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>확인 ✓</button></div></div></div>)}
    </>
  );
}
