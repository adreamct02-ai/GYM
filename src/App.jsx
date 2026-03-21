import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════
// SCORE CONFIG
// ═══════════════════════════════════════════════════
const SCORES = {
  5: { emoji: "🦁", label: "체단실 괴물",  color: "#FFD700", glow: "rgba(255,215,0,0.25)"   },
  4: { emoji: "💪", label: "헬스 고인물",  color: "#C084FC", glow: "rgba(192,132,252,0.2)"  },
  3: { emoji: "⚔️", label: "평균 전사",    color: "#60A5FA", glow: "rgba(96,165,250,0.2)"   },
  2: { emoji: "🐣", label: "헬린이",       color: "#4ADE80", glow: "rgba(74,222,128,0.2)"   },
  1: { emoji: "🥚", label: "짬지",         color: "#6B7280", glow: "rgba(107,114,128,0.12)" },
};

// ═══════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════
function calcRatio(b, d, o, w, h) {
  const total = (+b || 0) + (+d || 0) + (+o || 0);
  if (!total || !+w) return 0;
  return total / +w - (+h - 170) * 0.008;
}
function calcScore(b, d, o, w, h) {
  const r = calcRatio(b, d, o, w, h);
  if (r >= 4.5) return 5;
  if (r >= 3.2) return 4;
  if (r >= 2.2) return 3;
  if (r >= 1.3) return 2;
  return 1;
}

function compressPhoto(file) {
  return new Promise((res) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const SIZE = 160;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(SIZE / img.width, SIZE / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
      URL.revokeObjectURL(url);
      res(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.src = url;
  });
}

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
export default function App() {
  const [page, setPage]         = useState("init");
  const [soldiers, setSoldiers] = useState([]);
  const [comments, setComments] = useState({});
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const [step, setStep]   = useState(1);
  const [reg, setReg]     = useState({ name: "", height: "", weight: "", photo: null });
  const [lifts, setLifts] = useState({ bench: "", dead: "", ohp: "" });
  const [editId, setEditId] = useState(null);

  const [openComment, setOpenComment] = useState(null);
  const [cForm, setCForm] = useState({ name: "", content: "" });
  const [cLoading, setCLoading] = useState(false);
  const fileRef = useRef();
  const commentEndRef = useRef();

  // ── Inject global styles ───────────────────────────
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Oswald:wght@500;600;700&family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      body{background:#07090C;overflow-x:hidden}
      ::-webkit-scrollbar{width:3px}
      ::-webkit-scrollbar-track{background:#07090C}
      ::-webkit-scrollbar-thumb{background:#1E2530;border-radius:2px}
      input,textarea,button{font-family:'Noto Sans KR',sans-serif}
      input::placeholder,textarea::placeholder{color:#2A3040}
      @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
      @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
      .fu{animation:fadeUp .45s ease both}
      .fi{animation:fadeIn .25s ease both}
      .ri{animation:fadeUp .4s ease both}
      .ri:nth-child(1){animation-delay:.04s}.ri:nth-child(2){animation-delay:.08s}
      .ri:nth-child(3){animation-delay:.12s}.ri:nth-child(4){animation-delay:.16s}
      .ri:nth-child(5){animation-delay:.20s}.ri:nth-child(6){animation-delay:.24s}
      .ri:nth-child(7){animation-delay:.28s}.ri:nth-child(8){animation-delay:.32s}
    `;
    document.head.appendChild(el);
  }, []);

  // ── Load soldiers ──────────────────────────────────
  async function loadSoldiers() {
    const { data, error } = await supabase
      .from("soldiers")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) { setError("데이터 로드 실패: " + error.message); return; }
    setSoldiers(data || []);
  }

  // ── Load comments for a soldier ────────────────────
  async function loadComments(soldierId) {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("soldier_id", soldierId)
      .order("created_at", { ascending: true });
    if (error) return;
    setComments((prev) => ({ ...prev, [soldierId]: data || [] }));
  }

  useEffect(() => {
    (async () => {
      await loadSoldiers();
      setPage("landing");
    })();
  }, []);

  // ── Realtime subscription ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("gym-rank-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "soldiers" }, () => {
        loadSoldiers();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, (payload) => {
        const c = payload.new;
        setComments((prev) => ({
          ...prev,
          [c.soldier_id]: [...(prev[c.soldier_id] || []), c],
        }));
        setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // ── Computed rankings ──────────────────────────────
  const ranked = [...soldiers]
    .filter((u) => u.bench || u.dead || u.ohp)
    .sort(
      (a, b) =>
        calcRatio(b.bench, b.dead, b.ohp, b.weight, b.height) -
        calcRatio(a.bench, a.dead, a.ohp, a.weight, a.height)
    );
  const noLifts = soldiers.filter((u) => !u.bench && !u.dead && !u.ohp);

  // ── Register ───────────────────────────────────────
  async function doRegister() {
    setLoading(true);
    setError(null);
    const today = new Date().toLocaleDateString("ko-KR");
    const { error } = await supabase.from("soldiers").insert({
      name: reg.name,
      height: +reg.height,
      weight: +reg.weight,
      bench: +lifts.bench,
      dead: +lifts.dead,
      ohp: +lifts.ohp,
      photo: reg.photo || null,
      updated_at: today,
    });
    if (error) { setError("등록 실패: " + error.message); setLoading(false); return; }
    await loadSoldiers();
    setReg({ name: "", height: "", weight: "", photo: null });
    setLifts({ bench: "", dead: "", ohp: "" });
    setStep(1);
    setLoading(false);
    setPage("rankings");
  }

  // ── Update lifts ───────────────────────────────────
  async function doUpdateLifts() {
    setLoading(true);
    setError(null);
    const today = new Date().toLocaleDateString("ko-KR");
    const { error } = await supabase
      .from("soldiers")
      .update({
        bench: +lifts.bench,
        dead: +lifts.dead,
        ohp: +lifts.ohp,
        updated_at: today,
      })
      .eq("id", editId);
    if (error) { setError("갱신 실패: " + error.message); setLoading(false); return; }
    await loadSoldiers();
    setLifts({ bench: "", dead: "", ohp: "" });
    setEditId(null);
    setLoading(false);
    setPage("rankings");
  }

  // ── Add comment ────────────────────────────────────
  async function addComment() {
    if (!cForm.name.trim() || !cForm.content.trim()) return;
    setCLoading(true);
    const { error } = await supabase.from("comments").insert({
      soldier_id: openComment,
      name: cForm.name.trim(),
      content: cForm.content.trim(),
    });
    if (!error) setCForm({ name: "", content: "" });
    setCLoading(false);
  }

  // ── Open comment section ───────────────────────────
  async function toggleComment(soldierId) {
    if (openComment === soldierId) { setOpenComment(null); return; }
    setOpenComment(soldierId);
    if (!comments[soldierId]) await loadComments(soldierId);
  }

  // ─── COLOR TOKENS ──────────────────────────────────
  const C = {
    bg: "#07090C", bg2: "#0D1117", bg3: "#141A22", bg4: "#1A2230",
    border: "#1A2030", border2: "#222C3A",
    accent: "#C8A942", accentDim: "#5A4A1A",
    text: "#E4E0D2", text2: "#7A7E8A", text3: "#323845",
  };

  // ─── SHARED COMPONENTS ─────────────────────────────
  const GlowInput = ({ placeholder, value, onChange, type = "text", style: s = {} }) => (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%", padding: "12px 16px",
        background: C.bg3, color: C.text,
        border: `1px solid ${C.border2}`, borderRadius: 6,
        fontSize: 15, outline: "none",
        transition: "border-color .2s", ...s,
      }}
      onFocus={(e) => (e.target.style.borderColor = C.accent)}
      onBlur={(e) => (e.target.style.borderColor = C.border2)}
    />
  );

  const PrimaryBtn = ({ children, onClick, disabled, style: s = {} }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: (disabled || loading) ? C.bg3 : C.accent,
        color: (disabled || loading) ? C.text3 : "#000",
        border: "none", borderRadius: 7, padding: "13px 20px",
        fontSize: 15, fontWeight: 900, cursor: (disabled || loading) ? "default" : "pointer",
        transition: "all .15s", letterSpacing: "-.01em", ...s,
      }}
    >
      {loading ? "처리 중..." : children}
    </button>
  );

  const GhostBtn = ({ children, onClick, style: s = {} }) => (
    <button
      onClick={onClick}
      style={{
        background: "transparent", border: `1px solid ${C.border2}`,
        color: C.text2, borderRadius: 7, padding: "13px 20px",
        fontSize: 14, fontWeight: 700, cursor: "pointer",
        transition: "all .15s", ...s,
      }}
    >
      {children}
    </button>
  );

  const ScorePreview = ({ bench, dead, ohp, weight, height }) => {
    if (!bench || !dead || !ohp) return null;
    const s = calcScore(bench, dead, ohp, weight, height);
    const info = SCORES[s];
    return (
      <div className="fi" style={{
        background: info.color + "10", border: `1px solid ${info.color}40`,
        borderRadius: 10, padding: "16px", textAlign: "center", marginBottom: 20,
      }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>{info.emoji}</div>
        <div style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 22, color: info.color }}>{s}점</div>
        <div style={{ color: info.color + "CC", fontSize: 13, marginTop: 2 }}>{info.label}</div>
      </div>
    );
  };

  const ErrorBanner = () => error ? (
    <div style={{
      background: "#3B1A1A", border: "1px solid #7F2A2A",
      borderRadius: 8, padding: "10px 14px", marginBottom: 16,
      color: "#FF7A7A", fontSize: 13,
    }}>
      ⚠️ {error}
      <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", color: "#FF7A7A", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
    </div>
  ) : null;

  // ═══════════════════════════════════════════════════
  // PAGE: INIT
  // ═══════════════════════════════════════════════════
  if (page === "init")
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, animation: "pulse 1.4s infinite" }}>🏋️</div>
          <p style={{ color: C.text3, fontFamily: "monospace", fontSize: 12, marginTop: 12 }}>체단실 접속 중...</p>
        </div>
      </div>
    );

  // ═══════════════════════════════════════════════════
  // PAGE: LANDING
  // ═══════════════════════════════════════════════════
  if (page === "landing")
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "fixed", inset: 0,
          backgroundImage: `linear-gradient(${C.border} 1px,transparent 1px),linear-gradient(90deg,${C.border} 1px,transparent 1px)`,
          backgroundSize: "48px 48px", opacity: 0.35, pointerEvents: "none",
        }} />
        <div style={{
          position: "fixed", left: 0, right: 0, height: "2px",
          background: "linear-gradient(transparent, rgba(200,169,66,.15), transparent)",
          animation: "scanline 6s linear infinite", pointerEvents: "none",
        }} />

        <div className="fu" style={{ position: "relative", textAlign: "center", maxWidth: 380, width: "100%" }}>
          <div style={{ fontSize: 72, marginBottom: 6, filter: "drop-shadow(0 0 20px rgba(200,169,66,.5))" }}>🏋️</div>
          <h1 style={{
            fontFamily: "'Black Han Sans', sans-serif",
            fontSize: 46, color: C.accent, letterSpacing: "0.06em", marginBottom: 4,
            textShadow: "0 0 30px rgba(200,169,66,.4)",
          }}>체단실 랭킹</h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 48 }}>
            <div style={{ height: 1, width: 40, background: C.border2 }} />
            <p style={{ color: C.text2, fontSize: 12, letterSpacing: "0.14em" }}>소대 파워리프팅 순위</p>
            <div style={{ height: 1, width: 40, background: C.border2 }} />
          </div>

          <ErrorBanner />

          <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
            <PrimaryBtn onClick={() => setPage("register")} style={{ width: "100%", padding: "16px", fontSize: 17 }}>
              ⚔️ 신병 등록하기
            </PrimaryBtn>
            {soldiers.length > 0 && (
              <GhostBtn onClick={() => setPage("select")} style={{ width: "100%", padding: "15px", fontSize: 16, color: C.text }}>
                🔥 기록 갱신하기
              </GhostBtn>
            )}
            {ranked.length > 0 && (
              <button onClick={() => setPage("rankings")} style={{
                background: "none", border: "none", color: C.text2,
                fontSize: 14, cursor: "pointer", padding: "10px",
                fontFamily: "'Noto Sans KR', sans-serif",
              }}>
                📊 랭킹 보기 →
              </button>
            )}
          </div>

          {soldiers.length > 0 && (
            <p style={{ color: C.text3, fontSize: 11, marginTop: 28, letterSpacing: "0.08em" }}>
              등록 병사 {soldiers.length}명 · 순위 {ranked.length}명
            </p>
          )}
        </div>
      </div>
    );

  // ═══════════════════════════════════════════════════
  // PAGE: SELECT USER
  // ═══════════════════════════════════════════════════
  if (page === "select")
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 20px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, paddingTop: 8 }}>
            <button onClick={() => setPage("landing")} style={{ background: "none", border: "none", color: C.text2, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>←</button>
            <h2 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 24, color: C.text }}>병사 선택</h2>
          </div>
          <p style={{ color: C.text2, fontSize: 14, marginBottom: 16 }}>기록을 갱신할 병사를 선택하세요</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="fu">
            {soldiers.map((u) => {
              const hasLifts = u.bench || u.dead || u.ohp;
              const s = hasLifts ? calcScore(u.bench, u.dead, u.ohp, u.weight, u.height) : null;
              const info = s ? SCORES[s] : null;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setEditId(u.id);
                    setLifts({ bench: u.bench || "", dead: u.dead || "", ohp: u.ohp || "" });
                    setPage("lifts");
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    background: C.bg3, border: `1px solid ${C.border2}`,
                    borderRadius: 10, padding: "12px 16px", cursor: "pointer",
                    textAlign: "left", transition: "border-color .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.accent + "60")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border2)}
                >
                  {u.photo
                    ? <img src={u.photo} style={{ width: 46, height: 46, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 46, height: 46, borderRadius: "50%", background: C.bg4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>👤</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, color: C.text, fontSize: 15 }}>{u.name}</div>
                    <div style={{ color: C.text2, fontSize: 12, marginTop: 2 }}>
                      {hasLifts ? `벤치 ${u.bench} · 데드 ${u.dead} · OHP ${u.ohp}` : "기록 없음"}
                    </div>
                  </div>
                  {info && <span style={{ fontSize: 20 }}>{info.emoji}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );

  // ═══════════════════════════════════════════════════
  // PAGE: REGISTER
  // ═══════════════════════════════════════════════════
  if (page === "register")
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 400, width: "100%" }} className="fu">
          <div style={{ display: "flex", gap: 6, marginBottom: 36 }}>
            {[1, 2].map((i) => (
              <div key={i} style={{ flex: 1, height: 3, borderRadius: 3, background: i <= step ? C.accent : C.bg3, transition: "background .3s" }} />
            ))}
          </div>

          <ErrorBanner />

          {step === 1 && (
            <>
              <h2 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 30, color: C.text, marginBottom: 4 }}>신병 정보 입력</h2>
              <p style={{ color: C.text2, fontSize: 14, marginBottom: 30 }}>프로필을 설정하고 랭킹에 올라라</p>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28 }}>
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: 110, height: 110, borderRadius: "50%",
                    background: reg.photo ? "none" : C.bg3,
                    border: `2px dashed ${reg.photo ? "transparent" : C.border2}`,
                    cursor: "pointer", overflow: "hidden",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "border-color .2s",
                  }}
                  onMouseEnter={(e) => { if (!reg.photo) e.currentTarget.style.borderColor = C.accent; }}
                  onMouseLeave={(e) => { if (!reg.photo) e.currentTarget.style.borderColor = C.border2; }}
                >
                  {reg.photo
                    ? <img src={reg.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 34 }}>📷</span>
                  }
                </button>
                <input
                  ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files[0];
                    if (f) { const c = await compressPhoto(f); setReg((r) => ({ ...r, photo: c })); }
                  }}
                />
                <p style={{ color: C.text3, fontSize: 12, marginTop: 8 }}>프로필 사진 (선택)</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
                <GlowInput placeholder="이름 (예: 김상병)" value={reg.name} onChange={(v) => setReg((r) => ({ ...r, name: v }))} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <GlowInput placeholder="키 (cm)" value={reg.height} onChange={(v) => setReg((r) => ({ ...r, height: v }))} type="number" />
                  <GlowInput placeholder="몸무게 (kg)" value={reg.weight} onChange={(v) => setReg((r) => ({ ...r, weight: v }))} type="number" />
                </div>
              </div>

              <PrimaryBtn
                onClick={() => { if (reg.name && reg.height && reg.weight) setStep(2); }}
                disabled={!reg.name || !reg.height || !reg.weight}
                style={{ width: "100%", padding: 14 }}
              >
                다음 단계 →
              </PrimaryBtn>
              <button onClick={() => setPage("landing")} style={{ display: "block", width: "100%", marginTop: 10, background: "none", border: "none", color: C.text3, fontSize: 13, cursor: "pointer", padding: "8px" }}>
                취소
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 30, color: C.text, marginBottom: 4 }}>1RM 입력</h2>
              <p style={{ color: C.text2, fontSize: 14, marginBottom: 28 }}>
                <span style={{ color: C.accent }}>{reg.name}</span>, 최대 중량을 입력하세요
              </p>

              {[
                { key: "bench", icon: "🏋️", label: "벤치프레스" },
                { key: "dead",  icon: "⚡", label: "데드리프트" },
                { key: "ohp",   icon: "🔥", label: "오버헤드프레스" },
              ].map(({ key, icon, label }) => (
                <div key={key} style={{ marginBottom: 14 }}>
                  <label style={{ color: C.text2, fontSize: 13, display: "block", marginBottom: 6 }}>{icon} {label}</label>
                  <GlowInput
                    placeholder={`${label} 1RM (kg)`}
                    value={lifts[key]}
                    onChange={(v) => setLifts((l) => ({ ...l, [key]: v }))}
                    type="number"
                  />
                </div>
              ))}

              <div style={{ marginTop: 8, marginBottom: 4 }}>
                <ScorePreview bench={lifts.bench} dead={lifts.dead} ohp={lifts.ohp} weight={reg.weight} height={reg.height} />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <GhostBtn onClick={() => setStep(1)} style={{ flex: 1, padding: 13 }}>← 이전</GhostBtn>
                <PrimaryBtn
                  onClick={() => { if (lifts.bench && lifts.dead && lifts.ohp) doRegister(); }}
                  disabled={!lifts.bench || !lifts.dead || !lifts.ohp}
                  style={{ flex: 2, padding: 13 }}
                >
                  🎖️ 등록 완료
                </PrimaryBtn>
              </div>
            </>
          )}
        </div>
      </div>
    );

  // ═══════════════════════════════════════════════════
  // PAGE: UPDATE LIFTS
  // ═══════════════════════════════════════════════════
  if (page === "lifts") {
    const user = soldiers.find((u) => u.id === editId);
    return (
      <div style={{ minHeight: "100vh", background: C.bg, padding: "40px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ maxWidth: 400, width: "100%" }} className="fu">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
            <button onClick={() => setPage("select")} style={{ background: "none", border: "none", color: C.text2, fontSize: 22, cursor: "pointer" }}>←</button>
            <div>
              <h2 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 26, color: C.text }}>기록 갱신</h2>
              <p style={{ color: C.text2, fontSize: 13 }}>{user?.name} · 오늘의 1RM</p>
            </div>
          </div>

          <ErrorBanner />

          {[
            { key: "bench", icon: "🏋️", label: "벤치프레스" },
            { key: "dead",  icon: "⚡", label: "데드리프트" },
            { key: "ohp",   icon: "🔥", label: "오버헤드프레스" },
          ].map(({ key, icon, label }) => (
            <div key={key} style={{ marginBottom: 14 }}>
              <label style={{ color: C.text2, fontSize: 13, display: "block", marginBottom: 6 }}>{icon} {label}</label>
              <GlowInput
                placeholder={`${label} 1RM (kg)`}
                value={lifts[key]}
                onChange={(v) => setLifts((l) => ({ ...l, [key]: v }))}
                type="number"
              />
            </div>
          ))}

          <div style={{ marginTop: 8, marginBottom: 4 }}>
            <ScorePreview bench={lifts.bench} dead={lifts.dead} ohp={lifts.ohp} weight={user?.weight} height={user?.height} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <GhostBtn onClick={() => setPage("rankings")} style={{ flex: 1, padding: 13 }}>취소</GhostBtn>
            <PrimaryBtn
              onClick={() => { if (lifts.bench && lifts.dead && lifts.ohp) doUpdateLifts(); }}
              disabled={!lifts.bench || !lifts.dead || !lifts.ohp}
              style={{ flex: 2, padding: 13 }}
            >
              🔥 갱신하기
            </PrimaryBtn>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // PAGE: RANKINGS
  // ═══════════════════════════════════════════════════
  if (page === "rankings")
    return (
      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans KR', sans-serif" }}>
        {/* Sticky Header */}
        <div style={{
          background: C.bg2, borderBottom: `1px solid ${C.border}`,
          padding: "14px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20,
        }}>
          <div>
            <h1 style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 21, color: C.accent, letterSpacing: "0.05em" }}>
              🏋️ 체단실 랭킹
            </h1>
            <p style={{ color: C.text3, fontSize: 10, marginTop: 1 }}>총 {ranked.length}명 등록</p>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            {soldiers.length > 0 && (
              <button onClick={() => setPage("select")} style={{
                background: C.bg4, border: `1px solid ${C.border2}`,
                color: C.text, padding: "7px 12px", borderRadius: 6,
                cursor: "pointer", fontSize: 12, fontWeight: 700,
              }}>🔥 기록 갱신</button>
            )}
            <button onClick={() => setPage("register")} style={{
              background: C.accent, border: "none", color: "#000",
              padding: "7px 12px", borderRadius: 6, cursor: "pointer",
              fontSize: 12, fontWeight: 900,
            }}>+ 등록</button>
            <button onClick={() => setPage("landing")} style={{
              background: "none", border: `1px solid ${C.border}`,
              color: C.text3, padding: "7px 10px", borderRadius: 6,
              cursor: "pointer", fontSize: 12,
            }}>🏠</button>
          </div>
        </div>

        <div style={{ padding: "14px 14px 80px", maxWidth: 520, margin: "0 auto" }}>
          {ranked.length === 0 ? (
            <div style={{ textAlign: "center", paddingTop: 80, color: C.text3 }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🥚</div>
              <p style={{ fontSize: 16, marginBottom: 6 }}>아직 아무도 등록하지 않았습니다</p>
              <p style={{ fontSize: 13 }}>신병 등록하고 짬지 탈출하세요</p>
            </div>
          ) : (
            ranked.map((user, idx) => {
              const score = calcScore(user.bench, user.dead, user.ohp, user.weight, user.height);
              const info  = SCORES[score];
              const ratio = calcRatio(user.bench, user.dead, user.ohp, user.weight, user.height);
              const total = (user.bench || 0) + (user.dead || 0) + (user.ohp || 0);
              const userComments = comments[user.id] || [];
              const isTop3 = idx < 3;
              const medals = ["🥇", "🥈", "🥉"];
              const isOpen = openComment === user.id;

              return (
                <div key={user.id} className="ri" style={{
                  background: isTop3 ? `linear-gradient(140deg, ${C.bg2} 60%, ${info.color}08)` : C.bg2,
                  border: `1px solid ${isTop3 ? info.color + "35" : C.border}`,
                  borderRadius: 12, marginBottom: 10, overflow: "hidden",
                  boxShadow: isTop3 ? `0 4px 24px ${info.glow}` : "none",
                  animationDelay: `${idx * 0.055}s`,
                }}>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {/* Rank */}
                      <div style={{ width: 38, textAlign: "center", flexShrink: 0 }}>
                        {isTop3 ? (
                          <span style={{ fontSize: 24 }}>{medals[idx]}</span>
                        ) : (
                          <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 19, fontWeight: 700, color: C.text3 }}>#{idx + 1}</span>
                        )}
                      </div>

                      {/* Photo */}
                      <div style={{ flexShrink: 0 }}>
                        {user.photo ? (
                          <img src={user.photo} style={{
                            width: 54, height: 54, borderRadius: "50%", objectFit: "cover",
                            border: `2px solid ${info.color}50`,
                            boxShadow: isTop3 ? `0 0 10px ${info.glow}` : "none",
                          }} />
                        ) : (
                          <div style={{
                            width: 54, height: 54, borderRadius: "50%",
                            background: C.bg4, border: `2px solid ${C.border2}`,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                          }}>👤</div>
                        )}
                      </div>

                      {/* Name + lifts */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontWeight: 900, fontSize: 16, color: C.text }}>{user.name}</span>
                          <span style={{ fontSize: 16 }}>{info.emoji}</span>
                        </div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {[["벤치", user.bench], ["데드", user.dead], ["OHP", user.ohp]].map(([lbl, val]) => (
                            <span key={lbl} style={{ fontSize: 12 }}>
                              <span style={{ color: C.text3 }}>{lbl} </span>
                              <span style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 600, color: C.text, fontSize: 13 }}>{val}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Score badge */}
                      <div style={{
                        flexShrink: 0, background: info.color + "14",
                        border: `1px solid ${info.color}45`,
                        borderRadius: 9, padding: "5px 12px", textAlign: "center",
                      }}>
                        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 28, fontWeight: 700, color: info.color, lineHeight: 1 }}>{score}</div>
                        <div style={{ fontSize: 9, color: info.color + "88", marginTop: 1 }}>/ 5</div>
                      </div>
                    </div>

                    {/* Bottom bar */}
                    <div style={{
                      marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`,
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex", gap: 3 }}>
                          {[1,2,3,4,5].map((i) => (
                            <div key={i} style={{
                              width: 7, height: 7, borderRadius: 2,
                              background: i <= score ? info.color : C.border2,
                            }} />
                          ))}
                        </div>
                        <span style={{ fontFamily: "'Black Han Sans', sans-serif", fontSize: 13, color: info.color }}>
                          {info.label}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: C.text3 }}>
                          합계 <span style={{ fontFamily: "'Oswald', sans-serif", color: C.text2, fontWeight: 600 }}>{total}kg</span>
                          {"  "}체중비 <span style={{ fontFamily: "'Oswald', sans-serif", color: C.text2, fontWeight: 600 }}>{ratio.toFixed(2)}</span>
                        </span>
                        <button
                          onClick={() => toggleComment(user.id)}
                          style={{
                            background: isOpen ? C.accent + "18" : "none",
                            border: `1px solid ${isOpen ? C.accent + "60" : C.border2}`,
                            borderRadius: 5, padding: "3px 9px",
                            cursor: "pointer", color: isOpen ? C.accent : C.text2,
                            fontSize: 11, fontFamily: "'Noto Sans KR', sans-serif",
                            display: "flex", alignItems: "center", gap: 4, transition: "all .15s",
                          }}
                        >
                          💬 {userComments.length}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Comment section */}
                  {isOpen && (
                    <div className="fi" style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: "12px 16px" }}>
                      {userComments.length > 0 ? (
                        <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                          {userComments.map((c) => (
                            <div key={c.id} style={{ background: C.bg2, borderRadius: 7, padding: "7px 10px", fontSize: 13 }}>
                              <span style={{ color: C.accent, fontWeight: 700, fontSize: 12 }}>{c.name}</span>
                              <span style={{ color: C.text3, fontSize: 10, marginLeft: 6 }}>
                                {new Date(c.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              <p style={{ color: C.text, marginTop: 2, fontSize: 13, lineHeight: 1.5 }}>{c.content}</p>
                            </div>
                          ))}
                          <div ref={commentEndRef} />
                        </div>
                      ) : (
                        <p style={{ color: C.text3, fontSize: 12, marginBottom: 10 }}>아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
                      )}
                      <div style={{ display: "flex", gap: 7 }}>
                        <input
                          placeholder="이름"
                          value={cForm.name}
                          onChange={(e) => setCForm((f) => ({ ...f, name: e.target.value }))}
                          style={{
                            width: 80, padding: "8px 10px", flexShrink: 0,
                            background: C.bg3, border: `1px solid ${C.border2}`,
                            borderRadius: 5, color: C.text, fontSize: 13, outline: "none",
                          }}
                        />
                        <input
                          placeholder="댓글 내용"
                          value={cForm.content}
                          onChange={(e) => setCForm((f) => ({ ...f, content: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) addComment(); }}
                          style={{
                            flex: 1, padding: "8px 10px",
                            background: C.bg3, border: `1px solid ${C.border2}`,
                            borderRadius: 5, color: C.text, fontSize: 13, outline: "none",
                          }}
                        />
                        <button
                          onClick={addComment}
                          disabled={cLoading}
                          style={{
                            background: C.accent, border: "none", borderRadius: 5,
                            padding: "8px 14px", cursor: "pointer",
                            fontWeight: 900, color: "#000", fontSize: 14, flexShrink: 0,
                          }}
                        >
                          {cLoading ? "..." : "↑"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Unranked */}
          {noLifts.length > 0 && (
            <div style={{ marginTop: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 1, background: C.border }} />
                <span style={{ color: C.text3, fontSize: 12, whiteSpace: "nowrap" }}>기록 미입력 — 짬지 예약석</span>
                <div style={{ flex: 1, height: 1, background: C.border }} />
              </div>
              {noLifts.map((u) => (
                <div key={u.id} style={{
                  background: C.bg2, border: `1px solid ${C.border}`,
                  borderRadius: 9, padding: "10px 14px", marginBottom: 6,
                  display: "flex", alignItems: "center", gap: 10, opacity: 0.45,
                }}>
                  {u.photo
                    ? <img src={u.photo} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                    : <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.bg3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>
                  }
                  <span style={{ color: C.text2, fontWeight: 700, fontSize: 14 }}>{u.name}</span>
                  <span style={{ color: C.text3, fontSize: 12 }}>🥚 짬지 의심 중...</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );

  return null;
}
