import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
const SCORES = {
  5: { emoji: "🦁", label: "체단실 괴물", color: "#FFD700", glow: "rgba(255,215,0,0.25)" },
  4: { emoji: "💪", label: "헬스 고인물", color: "#C084FC", glow: "rgba(192,132,252,0.2)" },
  3: { emoji: "⚔️", label: "평균 전사",   color: "#60A5FA", glow: "rgba(96,165,250,0.2)" },
  2: { emoji: "🐣", label: "헬린이",      color: "#4ADE80", glow: "rgba(74,222,128,0.2)" },
  1: { emoji: "🥚", label: "짬지",        color: "#6B7280", glow: "rgba(107,114,128,0.12)" },
};
const C = {
  bg:"#07090C", bg2:"#0D1117", bg3:"#141A22", bg4:"#1A2230",
  border:"#1A2030", border2:"#222C3A",
  accent:"#C8A942",
  text:"#E4E0D2", text2:"#7A7E8A", text3:"#323845",
};
const LIFT_LABELS = [
  { key:"bench", icon:"🏋️", label:"벤치프레스" },
  { key:"dead",  icon:"⚡", label:"데드리프트" },
  { key:"ohp",   icon:"🔥", label:"오버헤드프레스" },
];
const CHALLENGE_MSGS = [
  (a,b,l) => `⚔️ ${a.name}이(가) ${b.name}에게 ${l} 도전장을 내밀었다!`,
  (a,b,l) => `💀 ${a.name} vs ${b.name} — ${l} 결투! 진 쪽이 청소당번`,
  (a,b,l) => `🎯 오늘 ${a.name}의 타겟은 ${b.name}! ${l}로 찍어눌러라`,
  (a,b,l) => `🔥 ${b.name}, ${a.name}한테 ${l} 딸림 판정 받기 전에 기록 올려라`,
  (a,b,l) => `💪 ${a.name}과 ${b.name}, 오늘 ${l} 안 하면 짬지 확정`,
  (a,b,l) => `👊 ${a.name}이 ${b.name}보고 "너 ${l} 나보다 못 들지?" 라고 했다`,
];

// ═══════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════
function calcRatio(b,d,o,w,h) {
  const t=(+b||0)+(+d||0)+(+o||0);
  if(!t||!+w) return 0;
  return t/+w-(+h-170)*0.008;
}
function calcScore(b,d,o,w,h) {
  const r=calcRatio(b,d,o,w,h);
  if(r>=4.5) return 5; if(r>=3.2) return 4;
  if(r>=2.2) return 3; if(r>=1.3) return 2; return 1;
}
function getToday() { return new Date().toLocaleDateString("ko-KR"); }
function getWeekStart() {
  const d=new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate()-d.getDay()); return d.toISOString();
}
function compressPhoto(file) {
  return new Promise(res=>{
    const img=new Image(), url=URL.createObjectURL(file);
    img.onload=()=>{
      const S=160,c=document.createElement("canvas");
      c.width=c.height=S;
      const ctx=c.getContext("2d"),sc=Math.max(S/img.width,S/img.height);
      ctx.drawImage(img,(S-img.width*sc)/2,(S-img.height*sc)/2,img.width*sc,img.height*sc);
      URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg",0.75));
    }; img.src=url;
  });
}

// ═══════════════════════════════════════════════════════════
// GlowInput — MUST be outside App (prevents mobile keyboard collapse)
// ═══════════════════════════════════════════════════════════
function GlowInput({placeholder,value,onChange,type="text",style:s={}}) {
  return (
    <input type={type} placeholder={placeholder} value={value}
      onChange={e=>onChange(e.target.value)}
      style={{width:"100%",padding:"12px 16px",background:C.bg3,color:C.text,
        border:`1px solid ${C.border2}`,borderRadius:6,fontSize:15,outline:"none",
        transition:"border-color .2s",...s}}
      onFocus={e=>e.target.style.borderColor=C.accent}
      onBlur={e=>e.target.style.borderColor=C.border2}/>
  );
}

// ═══════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════
export default function App() {
  // ── State ──────────────────────────────────────────────
  const [page, setPage]               = useState("init");
  const [rankTab, setRankTab]         = useState("score");
  const [soldiers, setSoldiers]       = useState([]);
  const [comments, setComments]       = useState({});
  const [liftHistory, setLiftHistory] = useState([]);
  const [votes, setVotes]             = useState([]);
  const [weeklyKing, setWeeklyKing]   = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  const [step, setStep]       = useState(1);
  const [reg, setReg]         = useState({name:"",height:"",weight:"",photo:null});
  const [lifts, setLifts]     = useState({bench:"",dead:"",ohp:""});
  const [editId, setEditId]   = useState(null);

  const [openComment, setOpenComment] = useState(null);
  const [cForm, setCForm]             = useState({name:"",content:""});
  const [cLoading, setCLoading]       = useState(false);
  const [toast, setToast]             = useState(null);
  const [challenge, setChallenge]     = useState(null);
  const [showChallenge, setShowChallenge] = useState(false);
  const [battleA, setBattleA]         = useState("");
  const [battleB, setBattleB]         = useState("");
  const [voteName, setVoteName]       = useState("");
  const [voteTarget, setVoteTarget]   = useState("");

  const fileRef = useRef();
  const commentEndRef = useRef();

  // ── Global styles ───────────────────────────────────────
  useEffect(()=>{
    const el=document.createElement("style");
    el.textContent=`
      @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Oswald:wght@500;600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#07090C;overflow-x:hidden}
      ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#07090C}
      ::-webkit-scrollbar-thumb{background:#1E2530;border-radius:2px}
      input,textarea,button,select{font-family:'Noto Sans KR',sans-serif}
      input::placeholder,textarea::placeholder{color:#8A9BB0}
      @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
      @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
      @keyframes toastSlide{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:translateX(0)}}
      @keyframes modalIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
      @keyframes confettiFall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(80px) rotate(360deg);opacity:0}}
      .fu{animation:fadeUp .45s ease both}
      .fi{animation:fadeIn .25s ease both}
      .ri{animation:fadeUp .4s ease both}
      .ri:nth-child(1){animation-delay:.04s}.ri:nth-child(2){animation-delay:.08s}
      .ri:nth-child(3){animation-delay:.12s}.ri:nth-child(4){animation-delay:.16s}
      .ri:nth-child(5){animation-delay:.20s}.ri:nth-child(6){animation-delay:.24s}
      .ri:nth-child(7){animation-delay:.28s}.ri:nth-child(8){animation-delay:.32s}
    `;
    document.head.appendChild(el);
  },[]);

  // ── Data loaders ────────────────────────────────────────
  async function loadSoldiers() {
    const {data}=await supabase.from("soldiers").select("*").order("created_at",{ascending:true});
    setSoldiers(data||[]); return data||[];
  }
  async function loadHistory() {
    const {data}=await supabase.from("lift_history").select("*")
      .order("recorded_at",{ascending:false}).limit(300);
    setLiftHistory(data||[]); return data||[];
  }
  async function loadVotes() {
    const {data}=await supabase.from("votes").select("*");
    setVotes(data||[]);
  }
  async function loadComments(id) {
    const {data}=await supabase.from("comments").select("*")
      .eq("soldier_id",id).order("created_at",{ascending:true});
    setComments(prev=>({...prev,[id]:data||[]}));
  }
  function computeKing(history,sols) {
    const ws=getWeekStart();
    const thisWeek=history.filter(h=>h.recorded_at>=ws);
    const counts={};
    thisWeek.forEach(h=>{counts[h.soldier_id]=(counts[h.soldier_id]||0)+1;});
    const topId=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0];
    if(topId) {
      const s=sols.find(s=>s.id===topId);
      setWeeklyKing(s?{...s,weekCount:counts[topId]}:null);
    } else setWeeklyKing(null);
  }

  useEffect(()=>{
    (async()=>{
      const [s,h]=await Promise.all([loadSoldiers(),loadHistory()]);
      await loadVotes();
      computeKing(h,s);
      setPage("landing");
    })();
  },[]);

  // ── Realtime ─────────────────────────────────────────────
  useEffect(()=>{
    const ch=supabase.channel("gym-rt")
      .on("postgres_changes",{event:"*",schema:"public",table:"soldiers"},loadSoldiers)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"comments"},payload=>{
        const c=payload.new;
        setComments(prev=>({...prev,[c.soldier_id]:[...(prev[c.soldier_id]||[]),c]}));
        setTimeout(()=>commentEndRef.current?.scrollIntoView({behavior:"smooth"}),50);
      })
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"lift_history"},async()=>{
        const [h,s]=await Promise.all([loadHistory(),loadSoldiers()]);
        computeKing(h,s);
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"votes"},loadVotes)
      .subscribe();
    return ()=>supabase.removeChannel(ch);
  },[]);

  // ── Computed ─────────────────────────────────────────────
  const ranked=[...soldiers]
    .filter(u=>u.bench||u.dead||u.ohp)
    .sort((a,b)=>calcRatio(b.bench,b.dead,b.ohp,b.weight,b.height)
                -calcRatio(a.bench,a.dead,a.ohp,a.weight,a.height));

  const improveRanked=[...soldiers]
    .filter(u=>(u.bench||u.dead||u.ohp)&&(u.prev_bench||u.prev_dead||u.prev_ohp))
    .map(u=>{
      const cur=(u.bench||0)+(u.dead||0)+(u.ohp||0);
      const prev=(u.prev_bench||0)+(u.prev_dead||0)+(u.prev_ohp||0);
      return {...u,improveRate:prev>0?((cur-prev)/prev*100):0,curTotal:cur,prevTotal:prev};
    }).sort((a,b)=>b.improveRate-a.improveRate);

  const today=getToday();
  const attendToday=soldiers.filter(u=>u.last_record_date===today);
  const absentToday=soldiers.filter(u=>u.last_record_date!==today);
  const totalPower=soldiers.reduce((s,u)=>s+(u.bench||0)+(u.dead||0)+(u.ohp||0),0);
  const jjamjiTarget=ranked.length>1?ranked[ranked.length-1]:null;

  const voteCounts={};
  votes.forEach(v=>{voteCounts[v.target_id]=(voteCounts[v.target_id]||0)+1;});
  const voteRanked=Object.entries(voteCounts).sort((a,b)=>b[1]-a[1]);

  // ── Toast ────────────────────────────────────────────────
  function showToast(msg,type="info") {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500);
  }

  // ── Actions ──────────────────────────────────────────────
  async function doRegister() {
    setLoading(true); setError(null);
    const {data:ins,error:err}=await supabase.from("soldiers").insert({
      name:reg.name,height:+reg.height,weight:+reg.weight,
      bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,
      photo:reg.photo||null,updated_at:today,last_record_date:today,streak:1,
    }).select();
    if(err){setError("등록 실패: "+err.message);setLoading(false);return;}
    if(ins?.[0]) {
      await supabase.from("lift_history").insert({
        soldier_id:ins[0].id,bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,
        total:+lifts.bench+(+lifts.dead)+(+lifts.ohp),is_personal_best:true,
      });
    }
    const s=await loadSoldiers();
    const h=await loadHistory();
    computeKing(h,s);
    setReg({name:"",height:"",weight:"",photo:null});
    setLifts({bench:"",dead:"",ohp:""});
    setStep(1);setLoading(false);
    showToast(`${reg.name} 등록 완료! 🎖️`,"info");
    setPage("rankings");
  }

  async function doUpdateLifts() {
    setLoading(true);setError(null);
    const user=soldiers.find(u=>u.id===editId);
    const oldTotal=(user?.bench||0)+(user?.dead||0)+(user?.ohp||0);
    const newTotal=+lifts.bench+(+lifts.dead)+(+lifts.ohp);
    const isPersonalBest=newTotal>oldTotal&&oldTotal>0;
    const yesterday=new Date(Date.now()-86400000).toLocaleDateString("ko-KR");
    let newStreak=1;
    if(user?.last_record_date===today) newStreak=user.streak||1;
    else if(user?.last_record_date===yesterday) newStreak=(user?.streak||0)+1;
    const oldRank=ranked.findIndex(u=>u.id===editId)+1;

    const {error:err}=await supabase.from("soldiers").update({
      bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,
      prev_bench:user?.bench,prev_dead:user?.dead,prev_ohp:user?.ohp,
      streak:newStreak,last_record_date:today,updated_at:today,
    }).eq("id",editId);
    if(err){setError("갱신 실패: "+err.message);setLoading(false);return;}

    await supabase.from("lift_history").insert({
      soldier_id:editId,bench:+lifts.bench,dead:+lifts.dead,ohp:+lifts.ohp,
      total:newTotal,is_personal_best:isPersonalBest,
    });

    const newSols=await loadSoldiers();
    const h=await loadHistory();
    computeKing(h,newSols);

    const newRanked=[...newSols].filter(u=>u.bench||u.dead||u.ohp)
      .sort((a,b)=>calcRatio(b.bench,b.dead,b.ohp,b.weight,b.height)
                  -calcRatio(a.bench,a.dead,a.ohp,a.weight,a.height));
    const newRank=newRanked.findIndex(u=>u.id===editId)+1;

    setLifts({bench:"",dead:"",ohp:""});setEditId(null);setLoading(false);

    if(isPersonalBest) showToast(`🏆 신기록! ${user?.name} 합계 ${newTotal}kg!`,"best");
    else if(oldRank>0&&newRank>0&&newRank<oldRank) showToast(`↑${oldRank-newRank}위 상승! 현재 ${newRank}위 🔥`,"up");
    else if(oldRank>0&&newRank>0&&newRank>oldRank) showToast(`↓${newRank-oldRank}위 하락... ${newRank}위`,"down");
    else showToast(`기록 갱신 완료! ${newRank}위 🔥`,"info");
    setPage("rankings");
  }

  async function addComment() {
    if(!cForm.name.trim()||!cForm.content.trim()) return;
    setCLoading(true);
    await supabase.from("comments").insert({
      soldier_id:openComment,name:cForm.name.trim(),content:cForm.content.trim()
    });
    setCForm({name:"",content:""});setCLoading(false);
  }
  async function toggleComment(id) {
    if(openComment===id){setOpenComment(null);return;}
    setOpenComment(id);
    if(!comments[id]) await loadComments(id);
  }
  async function doVote() {
    if(!voteName.trim()||!voteTarget) return;
    const {error:err}=await supabase.from("votes")
      .upsert({target_id:voteTarget,voter_name:voteName.trim()},{onConflict:"voter_name"});
    if(err){showToast("이미 투표했거나 오류 발생","down");return;}
    await loadVotes();
    setVoteName("");setVoteTarget("");
    showToast("투표 완료! 🗳️","info");
  }
  function doChallenge() {
    if(soldiers.length<2) return;
    const sh=[...soldiers].sort(()=>Math.random()-.5);
    const [a,b]=[sh[0],sh[1]];
    const lift=LIFT_LABELS[Math.floor(Math.random()*3)].label;
    const tmpl=CHALLENGE_MSGS[Math.floor(Math.random()*CHALLENGE_MSGS.length)];
    setChallenge(tmpl(a,b,lift));
    setShowChallenge(true);
  }

  // ── Shared UI ────────────────────────────────────────────
  const Btn=({children,onClick,disabled,color,style:s={}})=>(
    <button onClick={onClick} disabled={disabled||loading} style={{
      background:disabled||loading?C.bg3:color||C.accent,
      color:disabled||loading?C.text3:color?"#fff":"#000",
      border:"none",borderRadius:7,padding:"13px 20px",fontSize:15,
      fontWeight:900,cursor:disabled||loading?"default":"pointer",transition:"all .15s",...s,
    }}>{loading?"처리 중...":children}</button>
  );
  const Ghost=({children,onClick,style:s={}})=>(
    <button onClick={onClick} style={{background:"transparent",border:`1px solid ${C.border2}`,
      color:C.text2,borderRadius:7,padding:"13px 20px",fontSize:14,fontWeight:700,cursor:"pointer",...s}}>
      {children}
    </button>
  );
  const ScorePreview=({bench,dead,ohp,weight,height})=>{
    if(!bench||!dead||!ohp) return null;
    const s=calcScore(bench,dead,ohp,weight,height),info=SCORES[s];
    return(
      <div className="fi" style={{background:info.color+"10",border:`1px solid ${info.color}40`,
        borderRadius:10,padding:16,textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:36,marginBottom:4}}>{info.emoji}</div>
        <div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:22,color:info.color}}>{s}점</div>
        <div style={{color:info.color+"CC",fontSize:13,marginTop:2}}>{info.label}</div>
      </div>
    );
  };
  const ErrBanner=()=>error?(
    <div style={{background:"#3B1A1A",border:"1px solid #7F2A2A",borderRadius:8,
      padding:"10px 14px",marginBottom:16,color:"#FF7A7A",fontSize:13}}>
      ⚠️ {error}
      <button onClick={()=>setError(null)} style={{float:"right",background:"none",border:"none",
        color:"#FF7A7A",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>
    </div>
  ):null;

  const toastBg={up:"#166534",down:"#7F1D1D",best:"#78350F",info:"#1A1500"};
  const toastBorder={up:"#22C55E",down:"#EF4444",best:"#FFD700",info:C.accent};

  const NavBtn=({p,icon,label})=>(
    <button onClick={()=>setPage(p)} style={{flex:1,background:"none",border:"none",cursor:"pointer",
      display:"flex",flexDirection:"column",alignItems:"center",gap:3,
      color:page===p?C.accent:C.text3,transition:"color .15s",padding:"8px 0",
    }}>
      <span style={{fontSize:20}}>{icon}</span>
      <span style={{fontSize:10,fontFamily:"'Noto Sans KR',sans-serif",fontWeight:700}}>{label}</span>
    </button>
  );
  const BottomNav=()=>(
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.bg2,
      borderTop:`1px solid ${C.border}`,display:"flex",zIndex:30,
      paddingBottom:"env(safe-area-inset-bottom)"}}>
      <NavBtn p="rankings" icon="🏆" label="랭킹"/>
      <NavBtn p="battle"   icon="⚔️" label="1v1대결"/>
      <NavBtn p="halloffame" icon="💀" label="명예의전당"/>
      <NavBtn p="vote"     icon="🗳️" label="투표"/>
    </div>
  );

  // ── Overlays (toast + challenge modal) ───────────────────
  const Overlays=()=>(
    <>
      {toast&&(
        <div style={{position:"fixed",top:20,right:16,zIndex:999,
          background:toastBg[toast.type]||C.bg2,
          border:`1px solid ${toastBorder[toast.type]||C.accent}`,
          borderRadius:10,padding:"12px 18px",maxWidth:280,
          animation:"toastSlide .3s ease",boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
          <p style={{color:C.text,fontSize:14,fontWeight:700}}>{toast.msg}</p>
        </div>
      )}
      {showChallenge&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:998,
          display:"flex",alignItems:"center",justifyContent:"center",padding:24}}
          onClick={()=>setShowChallenge(false)}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:`linear-gradient(135deg,#1A1A2E,#0F0F1E)`,
            border:"1px solid #4A4A8A",borderRadius:16,padding:"32px 28px",maxWidth:360,width:"100%",
            textAlign:"center",animation:"modalIn .3s ease",position:"relative",overflow:"hidden"}}>
            {/* confetti dots */}
            {["#FFD700","#C084FC","#60A5FA","#4ADE80","#FB923C"].map((col,i)=>(
              <div key={i} style={{position:"absolute",width:8,height:8,borderRadius:"50%",
                background:col,top:20+i*10,left:20+i*40,
                animation:`confettiFall ${1.2+i*.3}s ease ${i*.15}s infinite`}}/>
            ))}
            <div style={{fontSize:52,marginBottom:16}}>🎰</div>
            <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:22,color:"#8080CC",marginBottom:20}}>
              오늘의 도전
            </h2>
            <p style={{color:C.text,fontSize:17,lineHeight:1.7,fontWeight:700,marginBottom:28}}>
              {challenge}
            </p>
            <div style={{display:"flex",gap:10}}>
              <button onClick={doChallenge} style={{flex:1,background:"#2A2A5A",border:"1px solid #4A4A8A",
                borderRadius:8,padding:"12px",color:"#8080CC",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                🔄 다시 뽑기
              </button>
              <button onClick={()=>setShowChallenge(false)} style={{flex:1,background:C.accent,
                border:"none",borderRadius:8,padding:"12px",color:"#000",fontSize:14,fontWeight:900,cursor:"pointer"}}>
                확인 ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ── Soldier card (used in rankings) ─────────────────────
  const SoldierCard=({user,idx})=>{
    const score=calcScore(user.bench,user.dead,user.ohp,user.weight,user.height);
    const info=SCORES[score];
    const ratio=calcRatio(user.bench,user.dead,user.ohp,user.weight,user.height);
    const total=(user.bench||0)+(user.dead||0)+(user.ohp||0);
    const isTop3=idx<3;
    const medals=["🥇","🥈","🥉"];
    const isOpen=openComment===user.id;
    const isJjamji=jjamjiTarget?.id===user.id&&ranked.length>1;
    const userComments=comments[user.id]||[];
    return(
      <div className="ri" style={{
        background:isTop3?`linear-gradient(140deg,${C.bg2} 60%,${info.color}08)`:C.bg2,
        border:`1px solid ${isTop3?info.color+"35":isJjamji?"#EF444440":C.border}`,
        borderRadius:12,marginBottom:10,overflow:"hidden",
        boxShadow:isTop3?`0 4px 24px ${info.glow}`:"none",
        animationDelay:`${idx*.055}s`,
      }}>
        <div style={{padding:"14px 16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {/* Rank */}
            <div style={{width:36,textAlign:"center",flexShrink:0}}>
              {isTop3
                ?<span style={{fontSize:24}}>{medals[idx]}</span>
                :<span style={{fontFamily:"'Oswald',sans-serif",fontSize:18,fontWeight:700,color:C.text3}}>#{idx+1}</span>}
            </div>
            {/* Photo */}
            <div style={{flexShrink:0,position:"relative"}}>
              {user.photo
                ?<img src={user.photo} style={{width:54,height:54,borderRadius:"50%",objectFit:"cover",
                    border:`2px solid ${info.color}50`,
                    boxShadow:isTop3?`0 0 10px ${info.glow}`:"none"}}/>
                :<div style={{width:54,height:54,borderRadius:"50%",background:C.bg4,
                    border:`2px solid ${C.border2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>👤</div>}
              {isJjamji&&(
                <div style={{position:"absolute",bottom:-4,right:-4,background:"#EF4444",borderRadius:"50%",
                  width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:11,border:`2px solid ${C.bg}`}}>🎯</div>
              )}
            </div>
            {/* Name + lifts */}
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                <span style={{fontWeight:900,fontSize:16,color:C.text}}>{user.name}</span>
                <span style={{fontSize:15}}>{info.emoji}</span>
                {user.streak>1&&<span style={{fontSize:11,color:"#FB923C",fontWeight:700}}>🔥{user.streak}</span>}
                {isJjamji&&<span style={{fontSize:10,color:"#EF4444",fontWeight:700,
                  background:"#EF444420",padding:"1px 6px",borderRadius:4}}>🎯오늘의 타겟</span>}
              </div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {[["벤치",user.bench],["데드",user.dead],["OHP",user.ohp]].map(([l,v])=>(
                  <span key={l} style={{fontSize:12}}>
                    <span style={{color:C.text3}}>{l} </span>
                    <span style={{fontFamily:"'Oswald',sans-serif",fontWeight:600,color:C.text,fontSize:13}}>{v}</span>
                  </span>
                ))}
              </div>
            </div>
            {/* Score badge */}
            <div style={{flexShrink:0,background:info.color+"14",border:`1px solid ${info.color}45`,
              borderRadius:9,padding:"5px 10px",textAlign:"center"}}>
              <div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,color:info.color,lineHeight:1}}>{score}</div>
              <div style={{fontSize:9,color:info.color+"88",marginTop:1}}>/ 5</div>
            </div>
          </div>
          {/* Bottom bar */}
          <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.border}`,
            display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{display:"flex",gap:3}}>
                {[1,2,3,4,5].map(i=>(
                  <div key={i} style={{width:7,height:7,borderRadius:2,
                    background:i<=score?info.color:C.border2}}/>
                ))}
              </div>
              <span style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:12,color:info.color}}>
                {info.label}
              </span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:C.text3}}>
                합계 <span style={{fontFamily:"'Oswald',sans-serif",color:C.text2,fontWeight:600}}>{total}kg</span>
              </span>
              <button onClick={()=>toggleComment(user.id)} style={{
                background:isOpen?C.accent+"18":"none",
                border:`1px solid ${isOpen?C.accent+"60":C.border2}`,
                borderRadius:5,padding:"3px 9px",cursor:"pointer",
                color:isOpen?C.accent:C.text2,fontSize:11,
                fontFamily:"'Noto Sans KR',sans-serif",transition:"all .15s",
              }}>💬 {userComments.length}</button>
            </div>
          </div>
        </div>
        {/* Comments */}
        {isOpen&&(
          <div className="fi" style={{background:C.bg,borderTop:`1px solid ${C.border}`,padding:"12px 16px"}}>
            {userComments.length>0?(
              <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                {userComments.map(c=>(
                  <div key={c.id} style={{background:C.bg2,borderRadius:7,padding:"7px 10px"}}>
                    <span style={{color:C.accent,fontWeight:700,fontSize:12}}>{c.name}</span>
                    <span style={{color:C.text3,fontSize:10,marginLeft:6}}>
                      {new Date(c.created_at).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"})}
                    </span>
                    <p style={{color:C.text,marginTop:2,fontSize:13,lineHeight:1.5}}>{c.content}</p>
                  </div>
                ))}
                <div ref={commentEndRef}/>
              </div>
            ):(
              <p style={{color:C.text3,fontSize:12,marginBottom:10}}>첫 댓글을 남겨보세요!</p>
            )}
            <div style={{display:"flex",gap:7}}>
              <input placeholder="이름" value={cForm.name} onChange={e=>setCForm(f=>({...f,name:e.target.value}))}
                style={{width:80,padding:"8px 10px",flexShrink:0,background:C.bg3,
                  border:`1px solid ${C.border2}`,borderRadius:5,color:C.text,fontSize:13,outline:"none"}}/>
              <input placeholder="댓글 내용" value={cForm.content}
                onChange={e=>setCForm(f=>({...f,content:e.target.value}))}
                onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey)addComment();}}
                style={{flex:1,padding:"8px 10px",background:C.bg3,
                  border:`1px solid ${C.border2}`,borderRadius:5,color:C.text,fontSize:13,outline:"none"}}/>
              <button onClick={addComment} disabled={cLoading} style={{
                background:C.accent,border:"none",borderRadius:5,padding:"8px 14px",
                cursor:"pointer",fontWeight:900,color:"#000",fontSize:14,flexShrink:0}}>
                {cLoading?"...":"↑"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ════════════════════════════════════════════════════════
  // RENDERS
  // ════════════════════════════════════════════════════════
  return(
    <>
    {/* ── INIT ── */}
    {page==="init"&&(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:40,animation:"pulse 1.4s infinite"}}>🏋️</div>
          <p style={{color:C.text3,fontFamily:"monospace",fontSize:12,marginTop:12}}>체단실 접속 중...</p>
        </div>
      </div>
    )}

    {/* ── LANDING ── */}
    {page==="landing"&&(
      <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",padding:24,position:"relative",overflow:"hidden"}}>
        <div style={{position:"fixed",inset:0,
          backgroundImage:`linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`,
          backgroundSize:"48px 48px",opacity:.35,pointerEvents:"none"}}/>
        <div style={{position:"fixed",left:0,right:0,height:"2px",
          background:"linear-gradient(transparent,rgba(200,169,66,.15),transparent)",
          animation:"scanline 6s linear infinite",pointerEvents:"none"}}/>
        <div className="fu" style={{position:"relative",textAlign:"center",maxWidth:380,width:"100%"}}>
          <div style={{fontSize:72,marginBottom:6,filter:"drop-shadow(0 0 20px rgba(200,169,66,.5))"}}>🏋️</div>
          <h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:36,color:C.accent,
            letterSpacing:"0.04em",marginBottom:4,textShadow:"0 0 30px rgba(200,169,66,.4)"}}>
            39통문 체단실 랭킹
          </h1>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:36}}>
            <div style={{height:1,width:40,background:C.border2}}/>
            <p style={{color:C.text2,fontSize:12,letterSpacing:"0.14em"}}>소대 파워리프팅 순위</p>
            <div style={{height:1,width:40,background:C.border2}}/>
          </div>
          <ErrBanner/>
          <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%"}}>
            <Btn onClick={()=>setPage("register")} style={{width:"100%",padding:16,fontSize:17}}>
              ⚔️ 신병 등록하기
            </Btn>
            {soldiers.length>0&&<>
              <Ghost onClick={()=>setPage("select")} style={{width:"100%",padding:15,fontSize:16,color:C.text}}>
                🔥 기록 갱신하기
              </Ghost>
              <button onClick={()=>setPage("rankings")} style={{background:"none",border:"none",
                color:C.text2,fontSize:14,cursor:"pointer",padding:10,fontFamily:"'Noto Sans KR',sans-serif"}}>
                📊 랭킹 보기 →
              </button>
            </>}
          </div>
          {soldiers.length>0&&(
            <p style={{color:C.text3,fontSize:11,marginTop:24}}>
              등록 {soldiers.length}명 · 순위 {ranked.length}명
            </p>
          )}
        </div>
      </div>
    )}

    {/* ── SELECT ── */}
    {page==="select"&&(
      <div style={{minHeight:"100vh",background:C.bg,padding:"24px 20px"}}>
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24,paddingTop:8}}>
            <button onClick={()=>setPage("landing")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer"}}>←</button>
            <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:24,color:C.text}}>병사 선택</h2>
          </div>
          <div className="fu" style={{display:"flex",flexDirection:"column",gap:8}}>
            {soldiers.map(u=>{
              const has=u.bench||u.dead||u.ohp;
              const info=has?SCORES[calcScore(u.bench,u.dead,u.ohp,u.weight,u.height)]:null;
              return(
                <button key={u.id} onClick={()=>{setEditId(u.id);setLifts({bench:u.bench||"",dead:u.dead||"",ohp:u.ohp||""});setPage("lifts");}}
                  style={{display:"flex",alignItems:"center",gap:14,background:C.bg3,
                    border:`1px solid ${C.border2}`,borderRadius:10,padding:"12px 16px",
                    cursor:"pointer",textAlign:"left"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent+"60"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=C.border2}>
                  {u.photo
                    ?<img src={u.photo} style={{width:46,height:46,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>
                    :<div style={{width:46,height:46,borderRadius:"50%",background:C.bg4,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>👤</div>}
                  <div style={{flex:1}}>
                    <div style={{fontWeight:900,color:C.text,fontSize:15}}>{u.name}</div>
                    <div style={{color:C.text2,fontSize:12,marginTop:2}}>
                      {has?`벤치 ${u.bench} · 데드 ${u.dead} · OHP ${u.ohp}`:"기록 없음"}
                      {u.streak>1&&<span style={{marginLeft:8,color:"#FB923C"}}>🔥{u.streak}일 연속</span>}
                    </div>
                  </div>
                  {info&&<span style={{fontSize:20}}>{info.emoji}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    )}

    {/* ── REGISTER ── */}
    {page==="register"&&(
      <div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",display:"flex",
        flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{maxWidth:400,width:"100%"}} className="fu">
          <div style={{display:"flex",gap:6,marginBottom:36}}>
            {[1,2].map(i=><div key={i} style={{flex:1,height:3,borderRadius:3,
              background:i<=step?C.accent:C.bg3,transition:"background .3s"}}/>)}
          </div>
          <ErrBanner/>
          {step===1&&<>
            <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:30,color:C.text,marginBottom:4}}>신병 정보 입력</h2>
            <p style={{color:C.text2,fontSize:14,marginBottom:30}}>프로필을 설정하고 랭킹에 올라라</p>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:28}}>
              <button onClick={()=>fileRef.current?.click()} style={{
                width:110,height:110,borderRadius:"50%",
                background:reg.photo?"none":C.bg3,
                border:`2px dashed ${reg.photo?"transparent":C.border2}`,
                cursor:"pointer",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}
                onMouseEnter={e=>{if(!reg.photo)e.currentTarget.style.borderColor=C.accent}}
                onMouseLeave={e=>{if(!reg.photo)e.currentTarget.style.borderColor=C.border2}}>
                {reg.photo?<img src={reg.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :<span style={{fontSize:34}}>📷</span>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}}
                onChange={async e=>{const f=e.target.files[0];if(f){const c=await compressPhoto(f);setReg(r=>({...r,photo:c}));}}}/>
              <p style={{color:C.text3,fontSize:12,marginTop:8}}>프로필 사진 (선택)</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:24}}>
              <GlowInput placeholder="이름 (예: 김상병)" value={reg.name} onChange={v=>setReg(r=>({...r,name:v}))}/>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <GlowInput placeholder="키 (cm)" value={reg.height} onChange={v=>setReg(r=>({...r,height:v}))} type="number"/>
                <GlowInput placeholder="몸무게 (kg)" value={reg.weight} onChange={v=>setReg(r=>({...r,weight:v}))} type="number"/>
              </div>
            </div>
            <Btn onClick={()=>{if(reg.name&&reg.height&&reg.weight)setStep(2);}}
              disabled={!reg.name||!reg.height||!reg.weight} style={{width:"100%",padding:14}}>
              다음 단계 →
            </Btn>
            <button onClick={()=>setPage("landing")} style={{display:"block",width:"100%",marginTop:10,
              background:"none",border:"none",color:C.text3,fontSize:13,cursor:"pointer",padding:8}}>취소</button>
          </>}
          {step===2&&<>
            <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:30,color:C.text,marginBottom:4}}>1RM 입력</h2>
            <p style={{color:C.text2,fontSize:14,marginBottom:28}}>
              <span style={{color:C.accent}}>{reg.name}</span>, 최대 중량을 입력하세요
            </p>
            {LIFT_LABELS.map(({key,icon,label})=>(
              <div key={key} style={{marginBottom:14}}>
                <label style={{color:C.text2,fontSize:13,display:"block",marginBottom:6}}>{icon} {label}</label>
                <GlowInput placeholder={`${label} 1RM (kg)`} value={lifts[key]}
                  onChange={v=>setLifts(l=>({...l,[key]:v}))} type="number"/>
              </div>
            ))}
            <div style={{marginTop:8,marginBottom:4}}>
              <ScorePreview bench={lifts.bench} dead={lifts.dead} ohp={lifts.ohp} weight={reg.weight} height={reg.height}/>
            </div>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <Ghost onClick={()=>setStep(1)} style={{flex:1,padding:13}}>← 이전</Ghost>
              <Btn onClick={()=>{if(lifts.bench&&lifts.dead&&lifts.ohp)doRegister();}}
                disabled={!lifts.bench||!lifts.dead||!lifts.ohp} style={{flex:2,padding:13}}>
                🎖️ 등록 완료
              </Btn>
            </div>
          </>}
        </div>
      </div>
    )}

    {/* ── LIFTS (update) ── */}
    {page==="lifts"&&(()=>{
      const user=soldiers.find(u=>u.id===editId);
      return(
        <div style={{minHeight:"100vh",background:C.bg,padding:"40px 24px",
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{maxWidth:400,width:"100%"}} className="fu">
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
              <button onClick={()=>setPage("select")} style={{background:"none",border:"none",color:C.text2,fontSize:22,cursor:"pointer"}}>←</button>
              <div>
                <h2 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:26,color:C.text}}>기록 갱신</h2>
                <p style={{color:C.text2,fontSize:13}}>
                  {user?.name}
                  {user?.streak>0&&<span style={{marginLeft:8,color:"#FB923C"}}>{"🔥".repeat(Math.min(user.streak,5))} {user.streak}일 연속</span>}
                </p>
              </div>
            </div>
            <ErrBanner/>
            {LIFT_LABELS.map(({key,icon,label})=>(
              <div key={key} style={{marginBottom:14}}>
                <label style={{color:C.text2,fontSize:13,display:"block",marginBottom:6}}>
                  {icon} {label}
                  {user?.[key]&&<span style={{color:C.text3,marginLeft:8,fontSize:11}}>현재 {user[key]}kg</span>}
                </label>
                <GlowInput placeholder={`${label} 1RM (kg)`} value={lifts[key]}
                  onChange={v=>setLifts(l=>({...l,[key]:v}))} type="number"/>
              </div>
            ))}
            <div style={{marginTop:8,marginBottom:4}}>
              <ScorePreview bench={lifts.bench} dead={lifts.dead} ohp={lifts.ohp} weight={user?.weight} height={user?.height}/>
            </div>
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <Ghost onClick={()=>setPage("rankings")} style={{flex:1,padding:13}}>취소</Ghost>
              <Btn onClick={()=>{if(lifts.bench&&lifts.dead&&lifts.ohp)doUpdateLifts();}}
                disabled={!lifts.bench||!lifts.dead||!lifts.ohp} style={{flex:2,padding:13}}>
                🔥 갱신하기
              </Btn>
            </div>
          </div>
        </div>
      );
    })()}

    {/* ── RANKINGS ── */}
    {page==="rankings"&&(
      <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Sans KR',sans-serif",paddingBottom:80}}>
        {/* Header */}
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"13px 18px",
          display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20}}>
          <div>
            <h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:19,color:C.accent}}>
              🏋️ 39통문 체단실 랭킹
            </h1>
            <p style={{color:C.text3,fontSize:10,marginTop:1}}>{ranked.length}명 등록</p>
          </div>
          <div style={{display:"flex",gap:7}}>
            {soldiers.length>0&&(
              <button onClick={()=>setPage("select")} style={{background:C.bg4,border:`1px solid ${C.border2}`,
                color:C.text,padding:"7px 11px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700}}>
                🔥 갱신
              </button>
            )}
            <button onClick={()=>setPage("register")} style={{background:C.accent,border:"none",
              color:"#000",padding:"7px 11px",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:900}}>
              + 등록
            </button>
          </div>
        </div>

        <div style={{padding:"12px 14px",maxWidth:520,margin:"0 auto"}}>

          {/* 소대 총 전투력 */}
          <div style={{background:`linear-gradient(135deg,${C.bg2},${C.bg3})`,
            border:`1px solid ${C.border2}`,borderRadius:12,padding:"14px 18px",
            marginBottom:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{color:C.text3,fontSize:11,letterSpacing:"0.1em",marginBottom:2}}>⚡ 소대 총 전투력</div>
              <div style={{fontFamily:"'Oswald',sans-serif",fontSize:30,fontWeight:700,color:C.accent}}>
                {totalPower.toLocaleString()}<span style={{fontSize:15,marginLeft:4,color:C.text2}}>kg</span>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{color:C.text3,fontSize:11}}>1인 평균</div>
              <div style={{fontFamily:"'Oswald',sans-serif",fontSize:20,color:C.text}}>
                {ranked.length>0?(totalPower/ranked.length).toFixed(0):0}kg
              </div>
            </div>
          </div>

          {/* 이주의 갱신왕 */}
          {weeklyKing&&(
            <div className="fi" style={{background:"linear-gradient(135deg,#3A2800,#1A1500)",
              border:"1px solid #C8A94250",borderRadius:12,padding:"12px 16px",
              marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:28}}>👑</span>
              <div style={{flex:1}}>
                <div style={{color:C.accent,fontSize:10,fontWeight:700,letterSpacing:"0.1em"}}>이주의 갱신왕</div>
                <div style={{color:C.text,fontWeight:900,fontSize:15,marginTop:1}}>{weeklyKing.name}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,color:C.accent,fontWeight:700}}>
                  {weeklyKing.weekCount}
                </div>
                <div style={{color:C.text3,fontSize:10}}>회 갱신</div>
              </div>
            </div>
          )}

          {/* 오늘의 도전 뽑기 */}
          <button onClick={doChallenge} style={{
            width:"100%",background:"linear-gradient(135deg,#1A1A2E,#16213E)",
            border:"1px solid #4A4A8A40",borderRadius:10,padding:11,
            cursor:"pointer",fontSize:13,color:"#8080CC",fontWeight:700,
            marginBottom:10,letterSpacing:"0.05em",fontFamily:"'Noto Sans KR',sans-serif"}}>
            🎰 오늘의 도전 뽑기
          </button>

          {/* Tabs */}
          <div style={{display:"flex",gap:6,marginBottom:12}}>
            {[["score","🏆 체중비"],["improve","📈 상승률"],["attend","📅 출석"]].map(([t,l])=>(
              <button key={t} onClick={()=>setRankTab(t)} style={{
                flex:1,padding:"8px 4px",borderRadius:7,border:"none",cursor:"pointer",
                background:rankTab===t?C.accent:C.bg3,color:rankTab===t?"#000":C.text2,
                fontSize:11,fontWeight:900,fontFamily:"'Noto Sans KR',sans-serif",transition:"all .15s",
              }}>{l}</button>
            ))}
          </div>

          {/* Tab: 체중비 */}
          {rankTab==="score"&&<>
            {ranked.length===0
              ?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}>
                <div style={{fontSize:52,marginBottom:16}}>🥚</div>
                <p>아직 기록이 없습니다</p>
              </div>
              :ranked.map((user,idx)=><SoldierCard key={user.id} user={user} idx={idx}/>)}
            {soldiers.filter(u=>!u.bench&&!u.dead&&!u.ohp).length>0&&(
              <div style={{marginTop:24}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{flex:1,height:1,background:C.border}}/>
                  <span style={{color:C.text3,fontSize:12,whiteSpace:"nowrap"}}>짬지 예약석</span>
                  <div style={{flex:1,height:1,background:C.border}}/>
                </div>
                {soldiers.filter(u=>!u.bench&&!u.dead&&!u.ohp).map(u=>(
                  <div key={u.id} style={{background:C.bg2,border:`1px solid ${C.border}`,
                    borderRadius:9,padding:"10px 14px",marginBottom:6,
                    display:"flex",alignItems:"center",gap:10,opacity:.45}}>
                    {u.photo?<img src={u.photo} style={{width:36,height:36,borderRadius:"50%",objectFit:"cover"}}/>
                      :<div style={{width:36,height:36,borderRadius:"50%",background:C.bg3,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>}
                    <span style={{color:C.text2,fontWeight:700,fontSize:14}}>{u.name}</span>
                    <span style={{color:C.text3,fontSize:12}}>🥚 짬지 의심 중...</span>
                  </div>
                ))}
              </div>
            )}
          </>}

          {/* Tab: 상승률 */}
          {rankTab==="improve"&&(
            improveRanked.length===0
              ?<div style={{textAlign:"center",paddingTop:60,color:C.text3}}>
                <div style={{fontSize:40,marginBottom:12}}>📈</div>
                <p style={{fontSize:14}}>기록을 한 번 갱신하면 상승률이 표시됩니다</p>
              </div>
              :improveRanked.map((user,idx)=>{
                const isUp=user.improveRate>0;
                return(
                  <div key={user.id} className="ri" style={{
                    background:C.bg2,border:`1px solid ${isUp?"#22C55E30":C.border}`,
                    borderRadius:12,marginBottom:8,padding:"14px 16px",animationDelay:`${idx*.055}s`}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{width:30,textAlign:"center",fontFamily:"'Oswald',sans-serif",
                        fontSize:17,fontWeight:700,color:C.text3,flexShrink:0}}>#{idx+1}</div>
                      {user.photo?<img src={user.photo} style={{width:46,height:46,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>
                        :<div style={{width:46,height:46,borderRadius:"50%",background:C.bg4,
                            display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>👤</div>}
                      <div style={{flex:1}}>
                        <div style={{fontWeight:900,color:C.text,fontSize:15,marginBottom:4}}>{user.name}</div>
                        <div style={{fontSize:12,color:C.text3}}>
                          {user.prevTotal}kg → <span style={{color:C.text}}>{user.curTotal}kg</span>
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,
                          color:isUp?"#22C55E":"#EF4444"}}>
                          {isUp?"+":""}{user.improveRate.toFixed(1)}%
                        </div>
                        <div style={{fontSize:10,color:C.text3}}>상승률</div>
                      </div>
                    </div>
                  </div>
                );
              })
          )}

          {/* Tab: 출석 */}
          {rankTab==="attend"&&(
            <div>
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#22C55E"}}/>
                  <span style={{color:"#22C55E",fontSize:13,fontWeight:700}}>
                    오늘 체단실 감 ({attendToday.length}명)
                  </span>
                </div>
                {attendToday.length===0
                  ?<p style={{color:C.text3,fontSize:13,padding:"12px 0"}}>오늘 아직 아무도 안 갔습니다 💀</p>
                  :attendToday.map(u=>(
                  <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,
                    background:"#052010",border:"1px solid #22C55E25",
                    borderRadius:9,padding:"10px 14px",marginBottom:6}}>
                    {u.photo?<img src={u.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover"}}/>
                      :<div style={{width:38,height:38,borderRadius:"50%",background:C.bg3,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>}
                    <span style={{color:C.text,fontWeight:700}}>{u.name}</span>
                    {u.streak>1&&<span style={{fontSize:12,color:"#FB923C"}}>🔥{u.streak}일 연속</span>}
                    <span style={{marginLeft:"auto",color:"#22C55E",fontSize:13}}>✓ 출석</span>
                  </div>
                ))}
              </div>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:"#EF4444"}}/>
                  <span style={{color:"#EF4444",fontSize:13,fontWeight:700}}>
                    오늘 안 간 놈 ({absentToday.length}명)
                  </span>
                </div>
                {absentToday.map(u=>(
                  <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,
                    background:C.bg2,border:"1px solid #EF444425",
                    borderRadius:9,padding:"10px 14px",marginBottom:6,opacity:.7}}>
                    {u.photo?<img src={u.photo} style={{width:38,height:38,borderRadius:"50%",objectFit:"cover"}}/>
                      :<div style={{width:38,height:38,borderRadius:"50%",background:C.bg3,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>👤</div>}
                    <span style={{color:C.text2,fontWeight:700}}>{u.name}</span>
                    <span style={{marginLeft:"auto",color:"#EF4444",fontSize:12}}>🥚 짬지</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <BottomNav/>
      </div>
    )}

    {/* ── BATTLE ── */}
    {page==="battle"&&(()=>{
      const a=soldiers.find(s=>s.id===battleA),b=soldiers.find(s=>s.id===battleB);
      return(
        <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
          <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"13px 18px",
            position:"sticky",top:0,zIndex:20}}>
            <h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:22,color:C.accent}}>⚔️ 1대1 대결</h1>
            <p style={{color:C.text3,fontSize:10,marginTop:1}}>종목별 맞대결</p>
          </div>
          <div style={{padding:"16px 14px",maxWidth:520,margin:"0 auto"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,alignItems:"center",marginBottom:20}}>
              <select value={battleA} onChange={e=>setBattleA(e.target.value)} style={{
                background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,
                borderRadius:8,padding:"10px 12px",fontSize:14,outline:"none"}}>
                <option value="">-- 도전자 --</option>
                {soldiers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <div style={{textAlign:"center",fontFamily:"'Black Han Sans',sans-serif",fontSize:18,color:C.text3}}>VS</div>
              <select value={battleB} onChange={e=>setBattleB(e.target.value)} style={{
                background:C.bg3,color:C.text,border:`1px solid ${C.border2}`,
                borderRadius:8,padding:"10px 12px",fontSize:14,outline:"none"}}>
                <option value="">-- 상대 --</option>
                {soldiers.filter(s=>s.id!==battleA).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {a&&b&&(()=>{
              const aTotal=(a.bench||0)+(a.dead||0)+(a.ohp||0);
              const bTotal=(b.bench||0)+(b.dead||0)+(b.ohp||0);
              const winner=aTotal>bTotal?a:bTotal>aTotal?b:null;
              return(
                <div className="fu">
                  {/* Photos */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,
                    alignItems:"center",marginBottom:20,textAlign:"center"}}>
                    <div>
                      {a.photo?<img src={a.photo} style={{width:70,height:70,borderRadius:"50%",objectFit:"cover",
                          border:"3px solid #C8A94250",margin:"0 auto",display:"block"}}/>
                        :<div style={{width:70,height:70,borderRadius:"50%",background:C.bg3,
                            display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto"}}>👤</div>}
                      <div style={{fontWeight:900,color:C.text,marginTop:6,fontSize:15}}>{a.name}</div>
                      <div style={{fontSize:11,color:C.text3}}>{a.weight}kg</div>
                    </div>
                    <div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:22,color:C.text3}}>⚔️</div>
                    <div>
                      {b.photo?<img src={b.photo} style={{width:70,height:70,borderRadius:"50%",objectFit:"cover",
                          border:"3px solid #EF444450",margin:"0 auto",display:"block"}}/>
                        :<div style={{width:70,height:70,borderRadius:"50%",background:C.bg3,
                            display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto"}}>👤</div>}
                      <div style={{fontWeight:900,color:C.text,marginTop:6,fontSize:15}}>{b.name}</div>
                      <div style={{fontSize:11,color:C.text3}}>{b.weight}kg</div>
                    </div>
                  </div>
                  {/* Lift bars */}
                  {LIFT_LABELS.map(({key,icon,label})=>{
                    const av=a[key]||0,bv=b[key]||0,maxV=Math.max(av,bv)||1;
                    const aWin=av>bv,bWin=bv>av;
                    return(
                      <div key={key} style={{background:C.bg2,border:`1px solid ${C.border}`,
                        borderRadius:10,padding:"14px 16px",marginBottom:8}}>
                        <div style={{color:C.text2,fontSize:12,marginBottom:10,fontWeight:700}}>{icon} {label}</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:10,alignItems:"center"}}>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,
                              color:aWin?"#FFD700":C.text}}>{av}<span style={{fontSize:13}}>kg</span></div>
                            <div style={{height:5,borderRadius:3,marginTop:6,background:aWin?"#FFD700":C.bg4,
                              width:`${(av/maxV)*100}%`,marginLeft:"auto",minWidth:av>0?4:0}}/>
                          </div>
                          <div style={{textAlign:"center",fontSize:11,color:C.text3,fontWeight:700,minWidth:36}}>
                            {av===bv?"🤝":aWin?"◀ 승":"패 ▶"}
                          </div>
                          <div>
                            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:26,fontWeight:700,
                              color:bWin?"#FFD700":C.text}}>{bv}<span style={{fontSize:13}}>kg</span></div>
                            <div style={{height:5,borderRadius:3,marginTop:6,background:bWin?"#FFD700":C.bg4,
                              width:`${(bv/maxV)*100}%`,minWidth:bv>0?4:0}}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Winner */}
                  <div style={{background:winner?"linear-gradient(135deg,#2A2000,#1A1500)":C.bg2,
                    border:`1px solid ${winner?C.accent+"50":C.border}`,
                    borderRadius:10,padding:20,textAlign:"center",marginTop:4}}>
                    {winner?<>
                      <div style={{fontSize:36,marginBottom:6}}>🏆</div>
                      <div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:24,color:C.accent}}>
                        {winner.name} 승리!
                      </div>
                      <div style={{color:C.text2,fontSize:13,marginTop:6}}>
                        {Math.max(aTotal,bTotal)}kg vs {Math.min(aTotal,bTotal)}kg
                      </div>
                    </>:<>
                      <div style={{fontSize:36,marginBottom:6}}>🤝</div>
                      <div style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:20,color:C.text2}}>무승부</div>
                    </>}
                  </div>
                </div>
              );
            })()}

            {!a&&!b&&(
              <div style={{textAlign:"center",paddingTop:60,color:C.text3}}>
                <div style={{fontSize:48,marginBottom:12}}>⚔️</div>
                <p>두 병사를 선택하면 결과가 나타납니다</p>
              </div>
            )}
          </div>
          <BottomNav/>
        </div>
      );
    })()}

    {/* ── HALL OF FAME ── */}
    {page==="halloffame"&&(
      <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"13px 18px",
          position:"sticky",top:0,zIndex:20}}>
          <h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:21,color:"#FFD700"}}>💀 명예의 전당</h1>
          <p style={{color:C.text3,fontSize:10,marginTop:1}}>역대 신기록 달성 기록</p>
        </div>
        <div style={{padding:"16px 14px",maxWidth:520,margin:"0 auto"}}>
          {/* 현재 개인 최고 */}
          <p style={{color:C.text3,fontSize:12,marginBottom:12,letterSpacing:"0.08em"}}>현재 개인 최고기록 TOP</p>
          {[...ranked].sort((a,b)=>{
            const at=(a.bench||0)+(a.dead||0)+(a.ohp||0);
            const bt=(b.bench||0)+(b.dead||0)+(b.ohp||0);
            return bt-at;
          }).map((user,idx)=>{
            const total=(user.bench||0)+(user.dead||0)+(user.ohp||0);
            const isFirst=idx===0;
            return(
              <div key={user.id} style={{background:isFirst?"linear-gradient(135deg,#2A2000,#1A1500)":C.bg2,
                border:`1px solid ${isFirst?"#FFD70050":C.border}`,
                borderRadius:10,padding:"12px 16px",marginBottom:8,
                display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:28,textAlign:"center",fontFamily:"'Oswald',sans-serif",
                  fontSize:18,fontWeight:700,color:isFirst?"#FFD700":C.text3}}>
                  {isFirst?"🥇":`#${idx+1}`}
                </div>
                {user.photo?<img src={user.photo} style={{width:42,height:42,borderRadius:"50%",objectFit:"cover"}}/>
                  :<div style={{width:42,height:42,borderRadius:"50%",background:C.bg3,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👤</div>}
                <div style={{flex:1}}>
                  <div style={{fontWeight:900,color:C.text,fontSize:14}}>{user.name}</div>
                  <div style={{fontSize:12,color:C.text2,marginTop:2}}>
                    벤치 {user.bench} · 데드 {user.dead} · OHP {user.ohp}
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,color:"#FFD700"}}>
                    {total}
                  </div>
                  <div style={{fontSize:10,color:C.text3}}>합계 kg</div>
                </div>
              </div>
            );
          })}

          {/* 신기록 히스토리 */}
          {liftHistory.filter(h=>h.is_personal_best).length>0&&(
            <>
              <div style={{display:"flex",alignItems:"center",gap:8,margin:"20px 0 12px"}}>
                <div style={{flex:1,height:1,background:C.border}}/>
                <span style={{color:C.text3,fontSize:12}}>🏆 신기록 달성 히스토리</span>
                <div style={{flex:1,height:1,background:C.border}}/>
              </div>
              {liftHistory.filter(h=>h.is_personal_best).slice(0,30).map(h=>{
                const sol=soldiers.find(s=>s.id===h.soldier_id);
                return(
                  <div key={h.id} style={{background:C.bg3,border:"1px solid #FFD70020",
                    borderRadius:8,padding:"10px 14px",marginBottom:6,
                    display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:18}}>🏆</span>
                    <div style={{flex:1}}>
                      <span style={{color:"#FFD700",fontWeight:700,fontSize:13}}>{sol?.name||"??"}</span>
                      <span style={{color:C.text2,fontSize:12,marginLeft:6}}>합계 {h.total}kg 신기록!</span>
                    </div>
                    <span style={{color:C.text3,fontSize:11}}>
                      {new Date(h.recorded_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
        <BottomNav/>
      </div>
    )}

    {/* ── VOTE ── */}
    {page==="vote"&&(
      <div style={{minHeight:"100vh",background:C.bg,paddingBottom:80}}>
        <div style={{background:C.bg2,borderBottom:`1px solid ${C.border}`,padding:"13px 18px",
          position:"sticky",top:0,zIndex:20}}>
          <h1 style={{fontFamily:"'Black Han Sans',sans-serif",fontSize:21,color:"#C084FC"}}>🗳️ 진짜 제일 센 놈</h1>
          <p style={{color:C.text3,fontSize:10,marginTop:1}}>기록 말고 진짜 최강자 익명 투표</p>
        </div>
        <div style={{padding:"16px 14px",maxWidth:520,margin:"0 auto"}}>
          <div style={{background:C.bg2,border:`1px solid ${C.border2}`,borderRadius:12,padding:16,marginBottom:20}}>
            <p style={{color:C.text2,fontSize:13,marginBottom:14}}>이름당 1표. 바꾸면 덮어씀.</p>
            <GlowInput placeholder="내 이름" value={voteName} onChange={setVoteName} style={{marginBottom:10}}/>
            <select value={voteTarget} onChange={e=>setVoteTarget(e.target.value)} style={{
              width:"100%",background:C.bg3,color:voteTarget?C.text:C.text3,
              border:`1px solid ${C.border2}`,borderRadius:6,padding:"12px 16px",
              fontSize:15,outline:"none",marginBottom:14}}>
              <option value="">-- 투표할 병사 선택 --</option>
              {soldiers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Btn onClick={doVote} disabled={!voteName.trim()||!voteTarget}
              color="#7C3AED" style={{width:"100%",padding:13}}>
              🗳️ 투표하기
            </Btn>
          </div>

          <p style={{color:C.text3,fontSize:12,marginBottom:12}}>현재 투표 현황 — 총 {votes.length}표</p>
          {voteRanked.length===0
            ?<div style={{textAlign:"center",paddingTop:40,color:C.text3}}>
              <div style={{fontSize:40,marginBottom:10}}>🗳️</div>
              <p>아직 투표가 없습니다</p>
            </div>
            :voteRanked.map(([id,count],idx)=>{
              const sol=soldiers.find(s=>s.id===id);
              const maxCount=voteRanked[0][1];
              const isFirst=idx===0;
              return(
                <div key={id} style={{
                  background:isFirst?"linear-gradient(135deg,#2A1A4A,#1A0F2E)":C.bg2,
                  border:`1px solid ${isFirst?"#C084FC50":C.border}`,
                  borderRadius:10,padding:"12px 16px",marginBottom:8,
                  display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:28,textAlign:"center",fontFamily:"'Oswald',sans-serif",
                    fontSize:17,fontWeight:700,color:isFirst?"#C084FC":C.text3}}>
                    {isFirst?"👑":`#${idx+1}`}
                  </div>
                  {sol?.photo?<img src={sol.photo} style={{width:44,height:44,borderRadius:"50%",objectFit:"cover"}}/>
                    :<div style={{width:44,height:44,borderRadius:"50%",background:C.bg3,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>👤</div>}
                  <div style={{flex:1}}>
                    <div style={{fontWeight:900,color:C.text,fontSize:15,marginBottom:6}}>
                      {sol?.name||"??"}
                    </div>
                    <div style={{height:4,borderRadius:2,background:C.bg4}}>
                      <div style={{height:"100%",borderRadius:2,
                        background:isFirst?"#C084FC":"#4A3A6A",
                        width:`${(count/maxCount)*100}%`,transition:"width .5s"}}/>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:"'Oswald',sans-serif",fontSize:22,fontWeight:700,
                      color:isFirst?"#C084FC":C.text}}>{count}</div>
                    <div style={{fontSize:10,color:C.text3}}>표</div>
                  </div>
                </div>
              );
            })}
        </div>
        <BottomNav/>
      </div>
    )}

    <Overlays/>
    </>
  );
}
