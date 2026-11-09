"use client";

import { ChangeEvent, useMemo, useState } from "react";
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
  const [longInterval, setLongInterval] = useState("2-3");
  const [shortTime, setShortTime] = useState("19:00");
  const [longTime, setLongTime] = useState("19:00");
  const [nicheShorts, setNicheShorts] = useState("");
  const [nicheLong, setNicheLong] = useState("");
  const [narration, setNarration] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [thumbUrl, setThumbUrl] = useState("");
  const [inspect, setInspect] = useState<InspectResult | null>(null);
  const [inspectBusy, setInspectBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
      setAudioFile(new File([blob], "niche-yt-narration.mp3", { type: "audio/mpeg" }));
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

  function chooseThumbnail(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Thumbnail harus berupa file gambar."); return; }
    setThumbUrl(URL.createObjectURL(file));
  }

  const ratioLabel = useMemo(() => selectedFormat, [selectedFormat]);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><div><b>NICHE YT</b><span>STUDIO</span></div></div>
        <div className="workspace"><span className="avatar">N</span><div><b>Creator Workspace</b><small>Personal studio</small></div></div>
        <div className="nav-label">WORKSPACE</div>
        {nav.map(({label, icon: Icon}) => <button key={label} className={active === label ? "nav-item active" : "nav-item"} onClick={() => setActive(label)}><Icon size={17}/>{label}</button>)}
        <div className="sidebar-bottom"><div className="connection-dot"/> Phase 1 workspace <span>BUILD</span></div>
      </aside>

      <section className="main">
        <header className="topbar"><div><span className="eyebrow">VIDEO PRODUCTION WORKSPACE</span><h1>{active}</h1></div><div className="top-actions"><button className="account-btn" onClick={() => { window.location.href = "/api/auth/youtube/start"; }}><Youtube size={17}/> Connect YouTube <span className="status-pill">OAuth</span></button><span className="user-avatar">YT</span></div></header>

        <div className="content">
          <section className="welcome-row"><div><div className="eyebrow">CREATOR CONTROL CENTER</div><h2>Turn your ideas into videos.</h2><p>Masukkan project Remotion, siapkan voice-over, lalu lanjutkan ke proses render.</p></div><div className="phase-tag"><span/> PHASE 1 · RENDER + VOICE</div></section>

          {error && <div className="alert error-alert">{error}</div>}
          {message && <div className="alert success-alert">{message}</div>}

          <YouTubeChannelPicker />

          <div className="stats-grid">
            <div className="stat-card"><span>PROJECT SOURCE</span><b>{inspect ? "1" : "0"}</b><small>{inspect ? inspect.filename : "Belum ada project diperiksa"}</small></div>
            <div className="stat-card"><span>DETECTED FORMAT</span><b>{inspect?.ratio ?? "—"}</b><small>{inspect?.width && inspect?.height ? inspect.width + " × " + inspect.height : "Menunggu inspeksi"}</small></div>
            <div className="stat-card"><span>VOICE ASSET</span><b>{audioFile ? "1" : "0"}</b><small>{audioFile?.name ?? "Belum ada audio"}</small></div>
            <div className="stat-card"><span>OUTPUT MP4</span><b>0</b><small>Render worker belum terhubung</small></div>
          </div>

          <div className="section-heading"><div><h3>Production workspace</h3><p>Upload ZIP project atau paste kode Remotion.</p></div><span className="step-indicator">01 / 03</span></div>
          <div className="workspace-grid">
            <div className="panel project-panel">
              <div className="panel-title"><div className="icon-box purple"><FileVideo2 size={18}/></div><div><b>Remotion project</b><small>Project import & composition detection</small></div><span className="optional">SOURCE</span></div>
              <div className="dropzone"><FolderUp size={27}/><b>{zipFile ? zipFile.name : "Upload project ZIP"}</b><span>ZIP · maximum 50 MB for inspection</span><label className="secondary-btn file-button">Choose ZIP<input type="file" accept=".zip,application/zip" onChange={e => setZipFile(e.target.files?.[0] ?? null)}/></label></div>
              <div className="or-divider"><span>OR PASTE CODE</span></div>
              <textarea className="code-input" value={code} onChange={e => {setCode(e.target.value); setZipFile(null);}} placeholder={"// Paste Remotion TSX / JSX code here\nimport { Composition } from 'remotion';"} />
              <div className="inline-controls"><label>Output format</label><select value={format} onChange={e => setFormat(e.target.value as Format)}><option value="auto">Auto detect from composition</option><option value="9:16">Force 9:16 Portrait</option><option value="16:9">Force 16:9 Landscape</option></select></div>
              <div className="detected"><CheckCircle2 size={15}/> Detected: <b>{ratioLabel}</b></div>
              {inspect && <div className="inspect-result"><b>Inspection result</b><span>{inspect.hasComposition ? "Composition reference found" : "Composition not confirmed"}</span><span>{inspect.hasRemotionImport ? "Remotion import found" : "Remotion import not detected"}</span>{inspect.entryFile && <span>Entry candidate: {inspect.entryFile}</span>}{inspect.filesFound && <span>{inspect.filesFound} files in ZIP</span>}<small>{inspect.note}</small></div>}
              <button className="primary-btn" onClick={analyzeProject} disabled={inspectBusy}>{inspectBusy ? <LoaderCircle className="spin" size={16}/> : <FileCode2 size={16}/>} {inspectBusy ? "Inspecting project..." : "Analyze project"}</button>
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

          <div className="section-heading"><div><h3>Automation & content settings</h3><p>Pengaturan niche dan jadwal publikasi terpisah.</p></div></div>
          <div className="settings-grid">
            <div className="panel"><div className="panel-title"><div className="icon-box blue"><Clock3 size={18}/></div><div><b>Publishing schedule</b><small>Shorts daily · Long-Form every 2–3 days</small></div></div><div className="field-row"><label>Shorts per day</label><select value={shortsPerDay} onChange={e => setShortsPerDay(e.target.value)}><option value="1">1 video / day</option><option value="2">2 videos / day</option><option value="custom">Custom</option></select></div><div className="field-row"><label>Shorts publish time (WIB)</label><input type="time" value={shortTime} onChange={e => setShortTime(e.target.value)}/></div><div className="field-row"><label>Long-Form interval</label><select value={longInterval} onChange={e => setLongInterval(e.target.value)}><option value="2-3">Every 2–3 days</option><option value="3-5">Every 3–5 days</option><option value="weekly">Once a week</option><option value="custom">Custom</option></select></div><div className="field-row"><label>Long-Form publish time</label><input type="time" value={longTime} onChange={e => setLongTime(e.target.value)}/></div><div className="notice">Long-Form hanya masuk jadwal jika render dan QC sudah selesai.</div></div>
            <div className="panel"><div className="panel-title"><div className="icon-box orange"><Sparkles size={18}/></div><div><b>Niche configuration</b><small>Different niche for Shorts and Long-Form</small></div></div><label className="field-label">Shorts niche</label><input className="wide-input" value={nicheShorts} onChange={e => setNicheShorts(e.target.value)} placeholder="e.g. Geography, Animals, History"/><label className="field-label">Long-Form niche</label><input className="wide-input" value={nicheLong} onChange={e => setNicheLong(e.target.value)} placeholder="e.g. Documentary, Science, Mystery"/><div className="notice">Timezone default: Asia/Jakarta (WIB).</div></div>
          </div>

          <div className="section-heading"><div><h3>Video metadata & thumbnail</h3><p>Siapkan detail video sebelum masuk ke publishing.</p></div><span className="coming">PRE-PUBLISH</span></div>
          <div className="panel metadata-panel"><div className="metadata-fields"><div><label className="field-label">Video title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter video title"/></div><div><label className="field-label">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Write video description..."/></div></div><div className="thumbnail-box">{thumbUrl ? <img className="thumb-preview" src={thumbUrl} alt="Thumbnail preview"/> : <div className="thumb-placeholder"><Film size={26}/><span>THUMBNAIL</span><small>16:9 recommended</small></div>}<label className="secondary-btn file-button">Upload thumbnail<input type="file" accept="image/*" onChange={chooseThumbnail}/></label></div></div>

          <footer><span>NICHE YT STUDIO · PHASE 1</span><span>Import inspection + ElevenLabs endpoint · Render worker pending</span></footer>
        </div>
      </section>
    </main>
  );
}