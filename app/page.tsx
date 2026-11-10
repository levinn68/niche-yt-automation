"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import YouTubeChannelPicker from "./components/youtube-channel-picker";
import {
  AudioLines, Clapperboard, Film, FolderUp, LayoutDashboard, Mic2,
  Settings2, Sparkles, UploadCloud, Youtube, Clock3, CheckCircle2,
  WandSparkles, FileVideo2, Play, FileCode2, LoaderCircle, ShieldCheck
} from "lucide-react";

type AudioMode = "narration" | "upload";
type Format = "auto" | "9:16" | "16:9";
type InspectResult = {
  source: string; filename: string; width: number | null; height: number | null;
  ratio: string; hasComposition: boolean; hasRemotionImport: boolean;
  hasAudioReference: boolean; entryFile?: string | null; filesFound?: number;
  sourceFiles?: string[]; note: string;
};

export default function StudioPage() {
  const [active, setActive] = useState("Studio");
  const [audioMode, setAudioMode] = useState<AudioMode>("narration");
  const [autoVoice, setAutoVoice] = useState(true);
  const [autoRender, setAutoRender] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [subtitles, setSubtitles] = useState(false);
  const [format, setFormat] = useState<Format>("auto");
  const [shortsPerDay, setShortsPerDay] = useState("1");
  
  const [narration, setNarration] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [compositionId, setCompositionId] = useState("Main");
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [inspectBusy, setInspectBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [studioAuthenticated, setStudioAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState("clean motion graphics");
  const [aiBusy, setAiBusy] = useState(false);
  const [generatedMeta, setGeneratedMeta] = useState<{compositionId:string;width:number;height:number;fps:number;durationInFrames:number;entryPoint:string} | null>(null);
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderJobId, setRenderJobId] = useState("");
  const [renderState, setRenderState] = useState("");
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderOutputKey, setRenderOutputKey] = useState("");
  const [channelOptions, setChannelOptions] = useState<Array<{id:string;title:string}>>([]);
  const [publishChannel, setPublishChannel] = useState("");
  const [publishPrivacy, setPublishPrivacy] = useState("private");
  const [publishAt, setPublishAt] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);

  useEffect(() => { fetch("/api/auth/studio").then(r => r.json()).then(d => setStudioAuthenticated(Boolean(d.authenticated))).catch(() => setStudioAuthenticated(false)).finally(() => setAuthLoading(false)); }, []);
  useEffect(() => { if (!studioAuthenticated) return; fetch("/api/youtube/channels").then(r => r.json()).then(d => { const list = d.channels || []; setChannelOptions(list); setPublishChannel(d.selectedChannelId || list.find((x: {selected?:boolean}) => x.selected)?.id || ""); }).catch(() => {}); }, [studioAuthenticated]);
  useEffect(() => { if (!renderJobId || !studioAuthenticated) return; let active = true; const poll = async () => { try { const response = await fetch("/api/render/" + encodeURIComponent(renderJobId), { cache: "no-store" }); const data = await response.json(); if (!active || !response.ok) return; setRenderState(data.state || "unknown"); setRenderProgress(typeof data.progress === "number" ? data.progress : Number(data.progress?.progress || 0)); if (data.state === "completed" && data.result?.objectKey) setRenderOutputKey(data.result.objectKey); if (data.state === "failed") setError(data.failedReason || "Render job failed."); } catch {} }; void poll(); const timer = window.setInterval(poll, 4000); return () => { active = false; window.clearInterval(timer); }; }, [renderJobId, studioAuthenticated]);

  async function loginStudio() {
    setLoginError("");
    try {
      const response = await fetch("/api/auth/studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: loginPassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login gagal.");
      setStudioAuthenticated(true); setLoginPassword("");
    } catch (err) { setLoginError(err instanceof Error ? err.message : "Login gagal."); }
  }

  async function generateRemotion() {
    setError(""); setMessage("");
    if (!aiPrompt.trim()) { setError("Tulis ide video dulu."); return; }
    setAiBusy(true);
    try {
      const response = await fetch("/api/ai/generate-remotion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: aiPrompt, format: format === "16:9" ? "16:9" : "9:16", style: aiStyle }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gemini gagal membuat source.");
      setCode(data.code); setZipFile(null);
      setGeneratedMeta({ compositionId: data.compositionId || "Main", width: Number(data.width) || (format === "16:9" ? 1920 : 1080), height: Number(data.height) || (format === "16:9" ? 1080 : 1920), fps: Number(data.fps) || 30, durationInFrames: Number(data.durationInFrames) || 900, entryPoint: data.entryPoint || "src/index.tsx" });
      setMessage("Source Remotion berhasil dibuat. Periksa dan Analyze project sebelum render.");
    } catch (err) { setError(err instanceof Error ? err.message : "AI generation gagal."); }
    finally { setAiBusy(false); }
  }

  async function startPublish() {
    setError(""); setMessage("");
    if (!renderOutputKey) { setError("Tunggu render MP4 selesai dulu."); return; }
    if (!publishChannel) { setError("Pilih channel YouTube tujuan."); return; }
    if (format === "16:9" || (inspect?.ratio && inspect.ratio !== "9:16" && format !== "9:16")) { setError("Auto Upload hanya untuk video vertikal 9:16. Render landscape tetap bisa di-download."); return; }
    if (!title.trim()) { setError("Isi judul Shorts sebelum upload."); return; }
    setPublishBusy(true);
    try {
      const response = await fetch("/api/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objectKey: renderOutputKey, channelId: publishChannel, title, description, privacyStatus: publishPrivacy, publishAt: publishAt ? new Date(publishAt).toISOString() : undefined }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memasukkan video ke antrean publishing.");
      setMessage("Publishing job masuk antrean: " + data.jobId);
    } catch (err) { setError(err instanceof Error ? err.message : "Publishing gagal."); }
    finally { setPublishBusy(false); }
  }

  async function startRender() {
    setError(""); setMessage("");
    if (!zipFile && !code.trim()) { setError("Masukkan source Remotion atau ZIP project."); return; }
    const width = format === "16:9" ? 1920 : 1080;
    const height = format === "16:9" ? 1080 : 1920;
    const selectedComposition = generatedMeta?.compositionId || compositionId.trim();
    if (!selectedComposition) { setError("Isi Composition ID project Remotion."); return; }
    const form = new FormData();
    if (zipFile) form.append("file", zipFile); else form.append("code", code);
    form.append("entryPoint", generatedMeta?.entryPoint || inspect?.entryFile || "src/index.tsx");
    form.append("compositionId", selectedComposition);
    form.append("width", String(width)); form.append("height", String(height));
    form.append("fps", String(generatedMeta?.fps || 30)); form.append("durationInFrames", String(generatedMeta?.durationInFrames || 900));
    setRenderBusy(true);
    try {
      const response = await fetch("/api/render", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Worker menolak render.");
      setRenderJobId(data.jobId); setRenderState("queued"); setRenderOutputKey(""); setRenderProgress(0);
      setMessage("Render masuk antrean. Job ID: " + data.jobId);
    } catch (err) { setError(err instanceof Error ? err.message : "Render gagal dimulai."); }
    finally { setRenderBusy(false); }
  }

  const nav = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Studio", icon: Clapperboard },
    { label: "Voice Engine", icon: Mic2 },
    { label: "Schedule", icon: Clock3 },
    { label: "Publishing", icon: UploadCloud },
    { label: "Settings", icon: Settings2 }
  ];
  const detectedRatio = inspect?.ratio && inspect.ratio !== "unknown" ? inspect.ratio : "Belum terdeteksi";
  const selectedFormat = format === "auto" ? detectedRatio : format;

  async function analyzeProject() {
    setError(""); setMessage(""); setInspect(null);
    if (!zipFile && !code.trim()) {
      setError("Upload ZIP project atau paste kode Remotion terlebih dahulu.");
      return;
    }
    setInspectBusy(true);
    try {
      const form = new FormData();
      if (zipFile) form.append("file", zipFile);
      else form.append("code", code);
      const response = await fetch("/api/projects/inspect", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Project gagal diperiksa.");
      setInspect(result);
      setMessage("Project berhasil diperiksa. Ini baru inspeksi source, belum proses render.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memeriksa project.");
    } finally {
      setInspectBusy(false);
    }
  }

  async function generateVoice() {
    setError(""); setMessage("");
    if (!narration.trim()) { setError("Isi narration terlebih dahulu."); return; }
    if (!voiceId.trim()) { setError("Masukkan Voice ID ElevenLabs."); return; }
    setVoiceBusy(true);
    try {
      const response = await fetch("/api/voice/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: narration, voiceId })
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "ElevenLabs gagal membuat audio.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(url);
      setAudioFile(new File([blob], "creator-studio-narration.mp3", { type: "audio/mpeg" }));
      setMessage("Audio berhasil dibuat. Dengarkan preview sebelum dipakai di video.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice generation gagal.");
    } finally {
      setVoiceBusy(false);
    }
  }

  function chooseAudio(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a", "audio/aac"].includes(file.type) &&
        !/\.(mp3|wav|m4a|aac)$/i.test(file.name)) {
      setError("Format audio yang didukung: MP3, WAV, M4A, AAC.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) { setError("Ukuran audio maksimum 50 MB."); return; }
    setError(""); setAudioFile(file);
    const url = URL.createObjectURL(file);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(url);
  }

  const ratioLabel = useMemo(() => selectedFormat, [selectedFormat]);

  if (authLoading) return <main className="shell"><div className="panel" style={{ margin: "auto", padding: 32 }}>Memeriksa sesi studio...</div></main>;
  if (!studioAuthenticated) return <main className="shell"><section className="panel" style={{ maxWidth: 420, margin: "12vh auto", padding: 28 }}><div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><div><b>CREATOR</b><span>STUDIO LOGIN</span></div></div><h2>Masuk ke Creator Studio</h2><p>Area studio dilindungi password.</p>{loginError && <div className="alert error-alert">{loginError}</div>}<input className="wide-input" type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Studio password" onKeyDown={e => e.key === "Enter" && void loginStudio()}/><button className="primary-btn" style={{ marginTop: 14, width: "100%" }} onClick={loginStudio}>Login</button></section></main>;

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><div><b>CODE TO VIDEO</b><span>STUDIO</span></div></div>
        <div className="workspace"><span className="avatar">N</span><div><b>Creator Workspace</b><small>Personal studio</small></div></div>
        <div className="nav-label">WORKSPACE</div>
        {nav.map(({label, icon: Icon}) => <button key={label} className={active === label ? "nav-item active" : "nav-item"} onClick={() => setActive(label)}><Icon size={17}/>{label}</button>)}
        <div className="sidebar-bottom"><div className="connection-dot"/> Creator workspace <span>BUILD</span></div>
      </aside>

      <section className="main">
        <header className="topbar"><div><span className="eyebrow">VIDEO PRODUCTION WORKSPACE</span><h1>{active}</h1></div><div className="top-actions"><button className="account-btn" onClick={() => { window.location.href = "/api/auth/youtube/start"; }}><Youtube size={17}/> Connect YouTube <span className="status-pill">OAuth</span></button><span className="user-avatar">YT</span></div></header>

        <div className="content">
          <section className="welcome-row"><div><div className="eyebrow">CODE TO VIDEO WORKSPACE</div><h2>Turn code into finished video.</h2><p>Paste source atau upload ZIP project. Render MP4, lalu download atau teruskan ke YouTube Shorts.</p></div><div className="phase-tag"><span/> CREATOR STUDIO · WORKSPACE</div></section>

          {error && <div className="alert error-alert">{error}</div>}
          {message && <div className="alert success-alert">{message}</div>}

          <YouTubeChannelPicker />

          <section className="panel" style={{ marginBottom: 24 }}><div className="panel-title"><div className="icon-box purple"><Sparkles size={18}/></div><div><b>AI Code Generator</b><small>Generate a Remotion starter from a video brief</small></div></div><textarea className="script-input" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Describe your video, scene sequence, motion, and narration cues..."/><div className="field-row"><label>Visual style</label><select value={aiStyle} onChange={e => setAiStyle(e.target.value)}><option>clean motion graphics</option><option>doodle animation</option><option>cinematic documentary</option><option>minimal infographic</option><option>3D typography</option></select></div><button className="secondary-btn" onClick={generateRemotion} disabled={aiBusy}>{aiBusy ? "Generating..." : "Generate Remotion source"}</button></section>

          <div className="stats-grid">
            <div className="stat-card"><span>PROJECT SOURCE</span><b>{inspect ? "1" : "0"}</b><small>{inspect ? inspect.filename : "Belum ada project diperiksa"}</small></div>
            <div className="stat-card"><span>DETECTED FORMAT</span><b>{inspect?.ratio ?? "—"}</b><small>{inspect?.width && inspect?.height ? inspect.width + " × " + inspect.height : "Menunggu inspeksi"}</small></div>
            <div className="stat-card"><span>VOICE ASSET</span><b>{audioFile ? "1" : "0"}</b><small>{audioFile?.name ?? "Belum ada audio"}</small></div>
            <div className="stat-card"><span>OUTPUT MP4</span><b>0</b><small>{renderState || "Belum ada render"}</small></div>
          </div>

          <div className="section-heading"><div><h3>Production workspace</h3><p>Upload ZIP project atau paste kode Remotion.</p></div><span className="step-indicator">CODE → MP4</span></div>
          <div className="workspace-grid">
            <div className="panel project-panel">
              <div className="panel-title"><div className="icon-box purple"><FileVideo2 size={18}/></div><div><b>Code input</b><small>Paste source code atau upload project ZIP</small></div><span className="optional">SOURCE</span></div>
              <div className="dropzone"><FolderUp size={27}/><b>{zipFile ? zipFile.name : "Upload project ZIP"}</b><span>ZIP project · maximum 100 MB</span><label className="secondary-btn file-button">Choose ZIP<input type="file" accept=".zip,application/zip" onChange={e => setZipFile(e.target.files?.[0] ?? null)}/></label></div>
              <div className="or-divider"><span>OR PASTE CODE</span></div>
              <textarea className="code-input" value={code} onChange={e => {setCode(e.target.value); setZipFile(null);}} placeholder={"// Paste Remotion TSX / JSX code here\nimport { Composition } from 'remotion';"} />
              <div className="inline-controls"><label>Composition ID</label><input value={compositionId} onChange={e => setCompositionId(e.target.value)} placeholder="Main"/></div><div className="inline-controls"><label>Output format</label><select value={format} onChange={e => setFormat(e.target.value as Format)}><option value="auto">Auto detect from composition</option><option value="9:16">Force 9:16 Portrait</option><option value="16:9">Force 16:9 Landscape</option></select></div>
              <div className="detected"><CheckCircle2 size={15}/> Detected: <b>{ratioLabel}</b></div>
              {inspect && <div className="inspect-result"><b>Inspection result</b><span>{inspect.hasComposition ? "Composition reference found" : "Composition not confirmed"}</span><span>{inspect.hasRemotionImport ? "Remotion import found" : "Remotion import not detected"}</span>{inspect.entryFile && <span>Entry candidate: {inspect.entryFile}</span>}{inspect.filesFound && <span>{inspect.filesFound} files in ZIP</span>}<small>{inspect.note}</small></div>}
              <button className="primary-btn" onClick={analyzeProject} disabled={inspectBusy}>{inspectBusy ? <LoaderCircle className="spin" size={16}/> : <FileCode2 size={16}/>} {inspectBusy ? "Inspecting project..." : "Analyze project"}</button><button className="secondary-btn full" onClick={startRender} disabled={renderBusy}>{renderBusy ? "Queuing render..." : "Render MP4"}</button>{renderJobId && <div className="notice">Render job: {renderJobId} · {renderState} · {renderProgress}% {renderOutputKey && "· MP4 ready"}</div>}
            </div>

            <div className="panel voice-panel">
              <div className="panel-title"><div className="icon-box green"><AudioLines size={18}/></div><div><b>ElevenLabs Voice Engine</b><small>Generate narration or upload existing audio</small></div><span className={autoVoice ? "toggle on" : "toggle"} onClick={() => setAutoVoice(!autoVoice)} role="switch" aria-checked={autoVoice}><i/></span></div>
              <div className="segmented"><button className={audioMode === "narration" ? "selected" : ""} onClick={() => setAudioMode("narration")}><WandSparkles size={15}/> From narration</button><button className={audioMode === "upload" ? "selected" : ""} onClick={() => setAudioMode("upload")}><UploadCloud size={15}/> Upload audio</button></div>
              {audioMode === "narration" ? <><label className="field-label">Narration script</label><textarea className="script-input" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Paste narration here. ElevenLabs will convert it into audio..."/><label className="field-label">ElevenLabs Voice ID</label><input className="wide-input" value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="Paste Voice ID from your ElevenLabs account"/><button className="secondary-btn full" onClick={generateVoice} disabled={voiceBusy || !autoVoice}>{voiceBusy ? <LoaderCircle className="spin" size={15}/> : <Mic2 size={15}/>} {voiceBusy ? "Generating audio..." : "Generate narration audio"}</button></> : <div className="audio-upload"><UploadCloud size={25}/><b>{audioFile?.name ?? "Upload generated audio"}</b><span>MP3, WAV, M4A, AAC · maximum 50 MB</span><label className="secondary-btn file-button">Choose audio file<input type="file" accept=".mp3,.wav,.m4a,.aac,audio/*" onChange={chooseAudio}/></label></div>}
              {audioUrl && <div className="audio-player"><div><Play size={15}/><span>{audioFile?.name ?? "Voice preview"}</span></div><audio controls src={audioUrl}/></div>}
              <div className="voice-options"><div><span>Auto audio sync</span><span className={autoSync ? "toggle on" : "toggle"} onClick={() => setAutoSync(!autoSync)} role="switch" aria-checked={autoSync}><i/></span></div><div><span>Auto subtitles</span><span className={subtitles ? "toggle on" : "toggle"} onClick={() => setSubtitles(!subtitles)} role="switch" aria-checked={subtitles}><i/></span></div></div>
              <div className="notice"><ShieldCheck size={13}/> ElevenLabs API key diproses di backend. Browser tidak menerima secret.</div>
            </div>
          </div>

          
          <div className="section-heading"><div><h3>YouTube Shorts details</h3><p>Metadata hanya dipakai jika kamu memilih lanjut upload.</p></div><span className="coming">OPTIONAL</span></div>
          <div className="panel metadata-panel"><div className="metadata-fields"><div><label className="field-label">Shorts title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter Shorts title"/></div><div><label className="field-label">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Write video description..."/></div></div></div>

          <section className="panel" style={{ marginTop: 24 }}><div className="panel-title"><div className="icon-box blue"><UploadCloud size={18}/></div><div><b>Continue to Auto Upload</b><small>YouTube Shorts only · action starts after MP4 is ready</small></div></div><div className="field-row"><label>Target channel</label><select value={publishChannel} onChange={e => setPublishChannel(e.target.value)}><option value="">Select YouTube channel</option>{channelOptions.map(channel => <option key={channel.id} value={channel.id}>{channel.title}</option>)}</select></div><div className="field-row"><label>Privacy</label><select value={publishPrivacy} onChange={e => setPublishPrivacy(e.target.value)}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></div><div className="field-row"><label>Schedule publish time (optional)</label><input type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)}/></div><button className="primary-btn" onClick={startPublish} disabled={publishBusy || !renderOutputKey || !publishChannel}>{publishBusy ? "Queueing upload..." : publishAt ? "Schedule YouTube publish" : "Upload to YouTube"}</button>{renderOutputKey && <small className="notice">Rendered MP4: {renderOutputKey}</small>}</section>

          <footer><span>CODE TO VIDEO STUDIO</span><span>Render MP4 · Download · YouTube Shorts upload</span></footer>
        </div>
      </section>
    </main>
  );
}