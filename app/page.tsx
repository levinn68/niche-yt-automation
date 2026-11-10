"use client";

import { ChangeEvent, useEffect, useState } from "react";
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
  const [autoSync, setAutoSync] = useState(true);
  const [subtitles, setSubtitles] = useState(false);
  const [format, setFormat] = useState<Format>("auto");
  
  const [narration, setNarration] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [projectFiles, setProjectFiles] = useState<File[]>([]);
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
    if (!zipFile && !projectFiles.length && !code.trim()) { setError("Pilih file source, folder project, ZIP, atau paste kode."); return; }
    const width = format === "16:9" ? 1920 : 1080;
    const height = format === "16:9" ? 1080 : 1920;
    const selectedComposition = compositionId.trim();
    if (!selectedComposition) { setError("Isi Composition ID project Remotion."); return; }
    const form = new FormData();
    if (zipFile) form.append("file", zipFile); else if (projectFiles.length) projectFiles.forEach(file => form.append("projectFiles", file, file.webkitRelativePath || file.name)); else form.append("code", code);
    form.append("entryPoint", inspect?.entryFile || "src/index.tsx");
    form.append("compositionId", selectedComposition);
    form.append("width", String(width)); form.append("height", String(height));
    form.append("fps", "30"); form.append("durationInFrames", "900");
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
    if (!zipFile && !projectFiles.length && !code.trim()) {
      setError("Pilih file source, folder project, ZIP, atau paste kode terlebih dahulu.");
      return;
    }
    setInspectBusy(true);
    try {
      const form = new FormData();
      if (zipFile) form.append("file", zipFile);
      else if (projectFiles.length) projectFiles.forEach(file => form.append("projectFiles", file, file.webkitRelativePath || file.name));
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

  const ratioLabel = selectedFormat;

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
          {error && <div className="alert error-alert">{error}</div>}
          {message && <div className="alert success-alert">{message}</div>}

          {active === "Overview" && <>
            <section className="welcome-row"><div><div className="eyebrow">CODE TO VIDEO WORKSPACE</div><h2>Your production at a glance.</h2><p>Kelola project Remotion, voice-over, render MP4, dan distribusi Shorts dari satu workspace.</p></div><div className="phase-tag"><span/> CREATOR STUDIO · WORKSPACE</div></section>
            <div className="stats-grid">
              <div className="stat-card"><span>PROJECT SOURCE</span><b>{inspect ? "1" : "0"}</b><small>{inspect ? inspect.filename : "Belum ada project diperiksa"}</small></div>
              <div className="stat-card"><span>DETECTED FORMAT</span><b>{inspect?.ratio ?? "—"}</b><small>{inspect?.width && inspect?.height ? inspect.width + " × " + inspect.height : "Menunggu inspeksi"}</small></div>
              <div className="stat-card"><span>VOICE ASSET</span><b>{audioFile ? "1" : "0"}</b><small>{audioFile?.name ?? "Belum ada audio"}</small></div>
              <div className="stat-card"><span>OUTPUT MP4</span><b>{renderOutputKey ? "1" : "0"}</b><small>{renderOutputKey ? "MP4 siap diunduh" : renderState || "Belum ada render"}</small></div>
            </div>
            <div className="section-heading"><div><h3>Quick actions</h3><p>Lanjutkan proses produksi dari tahap yang dibutuhkan.</p></div></div>
            <div className="quick-grid">
              <button className="quick-card" onClick={() => setActive("Studio")}><FileCode2/><b>Open Render Studio</b><span>Inspect source dan render project</span></button>
              <button className="quick-card" onClick={() => setActive("Voice Engine")}><AudioLines/><b>Open Voice Engine</b><span>Generate atau upload narration</span></button>
              <button className="quick-card" onClick={() => setActive("Publishing")}><UploadCloud/><b>Open Publishing</b><span>Siapkan upload YouTube Shorts</span></button>
            </div>
          </>}

          {active === "Studio" && <>
            <section className="page-intro"><div className="eyebrow">PRODUCTION / RENDER</div><h2>Render workspace</h2><p>Masukkan source Remotion yang sudah jadi atau upload ZIP project. Analyze dulu, lalu render ke MP4.</p></section>
            <div className="workspace-grid single-render">
              <div className="panel project-panel">
                <div className="panel-title"><div className="icon-box purple"><FileVideo2 size={18}/></div><div><b>Remotion project</b><small>Paste source code atau upload project ZIP</small></div><span className="optional">SOURCE</span></div>
                <div className="upload-options"><div className="dropzone"><FolderUp size={27}/><b>{zipFile?.name || (projectFiles.length ? projectFiles.length + " project files selected" : "Choose Remotion project")}</b><span>Folder project, ZIP, atau source file · max 100 MB</span><div className="upload-buttons"><label className="secondary-btn file-button">Choose ZIP<input type="file" accept=".zip,application/zip" onChange={e => {setZipFile(e.target.files?.[0] ?? null);setProjectFiles([]);setInspect(null);}}/></label><label className="secondary-btn file-button">Choose folder<input type="file" multiple {...({ webkitdirectory: "" } as any)} onChange={e => {setProjectFiles(Array.from(e.target.files || []));setZipFile(null);setInspect(null);}}/></label><label className="secondary-btn file-button">Choose source<input type="file" accept=".tsx,.ts,.jsx,.js" onChange={e => {setProjectFiles(Array.from(e.target.files || []));setZipFile(null);setInspect(null);}}/></label></div></div><div className="format-help"><b>Supported formats</b><span><code>.tsx</code> · <code>.ts</code> · <code>.jsx</code> · <code>.js</code> · <code>.zip</code></span><small>Jika project memakai banyak komponen, import lokal, gambar, atau audio, pilih seluruh folder project. File tunggal hanya cocok untuk source mandiri.</small></div></div>
                <div className="or-divider"><span>OR PASTE CODE</span></div>
                <textarea className="code-input" value={code} onChange={e => {setCode(e.target.value); setZipFile(null); setProjectFiles([]);setInspect(null);}} placeholder={"// Paste Remotion TSX / JSX code here\nimport { Composition } from 'remotion';"} />
                <div className="inline-controls"><label>Composition ID</label><input value={compositionId} onChange={e => setCompositionId(e.target.value)} placeholder="Main"/></div>
                <div className="inline-controls"><label>Output format</label><select value={format} onChange={e => setFormat(e.target.value as Format)}><option value="auto">Auto detect from composition</option><option value="9:16">Force 9:16 Portrait</option><option value="16:9">Force 16:9 Landscape</option></select></div>
                <div className="detected"><CheckCircle2 size={15}/> Detected: <b>{ratioLabel}</b></div>
                {inspect && <div className="inspect-result"><b>Inspection result</b><span>{inspect.hasComposition ? "Composition reference found" : "Composition not confirmed"}</span><span>{inspect.hasRemotionImport ? "Remotion import found" : "Remotion import not detected"}</span>{inspect.entryFile && <span>Entry candidate: {inspect.entryFile}</span>}{inspect.filesFound && <span>{inspect.filesFound} files in ZIP</span>}<small>{inspect.note}</small></div>}
                <div className="action-row"><button className="secondary-btn" onClick={analyzeProject} disabled={inspectBusy}>{inspectBusy ? <LoaderCircle className="spin" size={16}/> : <FileCode2 size={16}/>} {inspectBusy ? "Inspecting..." : "Analyze project"}</button><button className="primary-btn" onClick={startRender} disabled={renderBusy}>{renderBusy ? "Queuing render..." : "Render MP4"}</button></div>
                {renderJobId && <div className="notice render-status"><b>{renderOutputKey ? "Render complete" : renderState === "failed" ? "Render failed" : "Rendering project"}</b><span>Job {renderJobId} · {renderProgress}%</span><div className="progress-track"><i style={{width: `${Math.max(0,Math.min(100,renderProgress))}%`}}/></div></div>}
                {renderOutputKey && <a className="primary-btn" href={`/api/render/download?key=${encodeURIComponent(renderOutputKey)}`}><Film size={16}/> Download MP4</a>}
              </div>
            </div>
          </>}

          {active === "Voice Engine" && <>
            <section className="page-intro"><div className="eyebrow">AUDIO PRODUCTION</div><h2>ElevenLabs Voice Engine</h2><p>Buat narration dari script atau upload audio yang sudah tersedia. Preview tetap tersedia sebelum dipakai.</p></section>
            <div className="voice-layout"><div className="panel voice-panel">
              <div className="panel-title"><div className="icon-box green"><AudioLines size={18}/></div><div><b>Voice generation</b><small>Generate narration atau upload existing audio</small></div><span className={autoVoice ? "toggle on" : "toggle"} onClick={() => setAutoVoice(!autoVoice)} role="switch" aria-checked={autoVoice}><i/></span></div>
              <div className="segmented"><button className={audioMode === "narration" ? "selected" : ""} onClick={() => setAudioMode("narration")}><WandSparkles size={15}/> From narration</button><button className={audioMode === "upload" ? "selected" : ""} onClick={() => setAudioMode("upload")}><UploadCloud size={15}/> Upload audio</button></div>
              {audioMode === "narration" ? <><label className="field-label">Narration script</label><textarea className="script-input" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Paste narration here. ElevenLabs will convert it into audio..."/><label className="field-label">ElevenLabs Voice ID</label><input className="wide-input" value={voiceId} onChange={e => setVoiceId(e.target.value)} placeholder="Paste Voice ID from your ElevenLabs account"/><button className="primary-btn full" onClick={generateVoice} disabled={voiceBusy || !autoVoice}>{voiceBusy ? <LoaderCircle className="spin" size={15}/> : <Mic2 size={15}/>} {voiceBusy ? "Generating audio..." : "Generate narration audio"}</button></> : <div className="audio-upload"><UploadCloud size={25}/><b>{audioFile?.name ?? "Upload generated audio"}</b><span>MP3, WAV, M4A, AAC · maximum 50 MB</span><label className="secondary-btn file-button">Choose audio file<input type="file" accept=".mp3,.wav,.m4a,.aac,audio/*" onChange={chooseAudio}/></label></div>}
              {audioUrl && <div className="audio-player"><div><Play size={15}/><span>{audioFile?.name ?? "Voice preview"}</span></div><audio controls src={audioUrl}/></div>}
              <div className="voice-options"><div><span>Auto audio sync</span><span className={autoSync ? "toggle on" : "toggle"} onClick={() => setAutoSync(!autoSync)} role="switch" aria-checked={autoSync}><i/></span></div><div><span>Auto subtitles</span><span className={subtitles ? "toggle on" : "toggle"} onClick={() => setSubtitles(!subtitles)} role="switch" aria-checked={subtitles}><i/></span></div></div>
              <div className="notice"><ShieldCheck size={13}/> ElevenLabs API key diproses di backend. Browser tidak menerima secret.</div>
            </div><aside className="panel voice-side"><div className="icon-box green"><Mic2/></div><h3>Voice asset</h3><b>{audioFile?.name ?? "No audio selected"}</b><p>Audio yang sudah dibuat atau diunggah akan tersedia sebagai asset untuk workflow produksi.</p></aside></div>
          </>}

          {active === "Schedule" && <>
            <section className="page-intro"><div className="eyebrow">PUBLISHING PLANNER</div><h2>Schedule publishing</h2><p>Atur waktu publikasi YouTube Shorts setelah MP4 selesai dirender.</p></section>
            <div className="panel schedule-panel"><div className="panel-title"><div className="icon-box orange"><Clock3 size={18}/></div><div><b>Publish schedule</b><small>Jadwal diterapkan saat upload dimasukkan ke antrean</small></div></div><label className="field-label">Publish date and time</label><input className="wide-input" type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)}/><p className="helper-text">Pilih waktu lokal perangkat. Jadwal akan dikirim bersama permintaan upload di halaman Publishing.</p><button className="secondary-btn" onClick={() => setActive("Publishing")}>Continue to Publishing <UploadCloud size={15}/></button></div>
          </>}

          {active === "Publishing" && <>
            <section className="page-intro"><div className="eyebrow">DISTRIBUTION</div><h2>YouTube Shorts publishing</h2><p>Atur metadata, channel tujuan, privasi, dan jadwal upload. Auto Upload hanya menerima video vertikal 9:16.</p></section>
            <YouTubeChannelPicker />
            <div className="panel metadata-panel"><div className="panel-title"><div className="icon-box blue"><UploadCloud size={18}/></div><div><b>Video details</b><small>Metadata untuk YouTube Shorts</small></div></div><div className="metadata-fields"><div><label className="field-label">Shorts title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter Shorts title"/></div><div><label className="field-label">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Write video description..."/></div></div><div className="field-row"><label>Target channel</label><select value={publishChannel} onChange={e => setPublishChannel(e.target.value)}><option value="">Select YouTube channel</option>{channelOptions.map(channel => <option key={channel.id} value={channel.id}>{channel.title}</option>)}</select></div><div className="field-row"><label>Privacy</label><select value={publishPrivacy} onChange={e => setPublishPrivacy(e.target.value)}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></div><div className="field-row"><label>Schedule publish time</label><input type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)}/></div><button className="primary-btn" onClick={startPublish} disabled={publishBusy || !renderOutputKey || !publishChannel}>{publishBusy ? "Queueing upload..." : publishAt ? "Schedule YouTube publish" : "Upload to YouTube"}</button>{renderOutputKey && <div className="notice render-actions"><a href={`/api/render/download?key=${encodeURIComponent(renderOutputKey)}`}>Download rendered MP4</a></div>}</div>
          </>}

          {active === "Settings" && <>
            <section className="page-intro"><div className="eyebrow">WORKSPACE PREFERENCES</div><h2>Studio settings</h2><p>Preferensi proses produksi dan koneksi akun.</p></section>
            <div className="settings-grid">
              <div className="panel"><div className="panel-title"><div className="icon-box green"><AudioLines size={18}/></div><div><b>Audio workflow</b><small>Default behavior for voice assets</small></div></div><div className="setting-line"><span>Enable voice generation</span><span className={autoVoice ? "toggle on" : "toggle"} onClick={() => setAutoVoice(!autoVoice)} role="switch" aria-checked={autoVoice}><i/></span></div><div className="setting-line"><span>Auto audio sync</span><span className={autoSync ? "toggle on" : "toggle"} onClick={() => setAutoSync(!autoSync)} role="switch" aria-checked={autoSync}><i/></span></div><div className="setting-line"><span>Auto subtitles</span><span className={subtitles ? "toggle on" : "toggle"} onClick={() => setSubtitles(!subtitles)} role="switch" aria-checked={subtitles}><i/></span></div></div>
              <div className="panel"><div className="panel-title"><div className="icon-box blue"><Youtube size={18}/></div><div><b>Connected services</b><small>Account connection</small></div></div><p className="helper-text">Hubungkan atau kelola channel YouTube dari tombol Connect YouTube di bagian atas.</p><button className="secondary-btn" onClick={() => { window.location.href = "/api/auth/youtube/start"; }}><Youtube size={15}/> Connect YouTube</button></div>
            </div>
          </>}

          <footer><span>CODE TO VIDEO STUDIO</span><span>{active} · Render MP4 · YouTube Shorts</span></footer>
        </div>
      </section>
    </main>
  );
}