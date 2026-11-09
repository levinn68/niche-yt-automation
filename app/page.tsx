"use client";

import { useMemo, useState } from "react";
import {
  AudioLines, Clapperboard, Film, FolderUp, LayoutDashboard, Mic2,
  MonitorPlay, Settings2, Sparkles, UploadCloud, Youtube, Clock3,
  ChevronDown, CheckCircle2, Circle, WandSparkles, FileVideo2
} from "lucide-react";

type AudioMode = "narration" | "upload";
type Format = "auto" | "9:16" | "16:9";

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [voice, setVoice] = useState("neutral-american-male");

  const nav = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Studio", icon: Clapperboard },
    { label: "Voice Engine", icon: Mic2 },
    { label: "Schedule", icon: Clock3 },
    { label: "Publishing", icon: UploadCloud },
    { label: "Settings", icon: Settings2 }
  ];

  const ratioLabel = useMemo(() => format === "auto" ? "Detect from Remotion composition" : format, [format]);

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={19}/></div><div><b>NICHE YT</b><span>STUDIO</span></div></div>
        <div className="workspace"><span className="avatar">N</span><div><b>Creator Workspace</b><small>Personal studio</small></div><ChevronDown size={15}/></div>
        <div className="nav-label">WORKSPACE</div>
        {nav.map(({label, icon: Icon}) => <button key={label} className={active === label ? "nav-item active" : "nav-item"} onClick={() => setActive(label)}><Icon size={17}/>{label}</button>)}
        <div className="sidebar-bottom"><div className="connection-dot"/> Local workspace <span>PHASE 1</span></div>
      </aside>

      <section className="main">
        <header className="topbar"><div><span className="eyebrow">VIDEO PRODUCTION WORKSPACE</span><h1>{active}</h1></div><div className="top-actions"><button className="account-btn"><Youtube size={17}/> Connect YouTube <span className="status-pill">Not connected</span></button><span className="user-avatar">YT</span></div></header>

        <div className="content">
          <section className="welcome-row"><div><div className="eyebrow">CREATOR CONTROL CENTER</div><h2>Turn your ideas into videos.</h2><p>Masukkan project Remotion, siapkan voice-over, lalu render dalam satu workflow.</p></div><div className="phase-tag"><span/> PHASE 1 · RENDER + VOICE</div></section>

          <div className="stats-grid">
            <div className="stat-card"><span>PROJECTS</span><b>—</b><small>Belum ada project</small></div>
            <div className="stat-card"><span>RENDER JOBS</span><b>0</b><small>Menunggu project pertama</small></div>
            <div className="stat-card"><span>VOICE ASSETS</span><b>0</b><small>ElevenLabs belum dihubungkan</small></div>
            <div className="stat-card"><span>OUTPUTS</span><b>0</b><small>Belum ada MP4</small></div>
          </div>

          <div className="section-heading"><div><h3>Production workspace</h3><p>Mulai dari kode Remotion atau project ZIP.</p></div><span className="step-indicator">01 / 03</span></div>
          <div className="workspace-grid">
            <div className="panel project-panel">
              <div className="panel-title"><div className="icon-box purple"><FileVideo2 size={18}/></div><div><b>Remotion project</b><small>Code input & project upload</small></div><span className="optional">REQUIRED</span></div>
              <div className="dropzone"><FolderUp size={27}/><b>Upload project ZIP</b><span>Drop file here or browse · .zip</span><button className="secondary-btn">Choose ZIP</button></div>
              <div className="or-divider"><span>OR PASTE CODE</span></div>
              <textarea className="code-input" placeholder={"// Paste your Remotion TSX / JSX code here\nexport const MyVideo = () => { ... }"} />
              <div className="inline-controls"><label>Composition format</label><select value={format} onChange={e => setFormat(e.target.value as Format)}><option value="auto">Auto detect (recommended)</option><option value="9:16">9:16 Portrait</option><option value="16:9">16:9 Landscape</option></select></div>
              <div className="detected"><CheckCircle2 size={15}/> Format mode: <b>{ratioLabel}</b></div>
              <button className="primary-btn"><Clapperboard size={16}/> Analyze project</button>
            </div>

            <div className="panel voice-panel">
              <div className="panel-title"><div className="icon-box green"><AudioLines size={18}/></div><div><b>ElevenLabs Voice Engine</b><small>Generate narration or upload audio</small></div><span className="toggle-wrap"><span className={autoVoice ? "toggle on" : "toggle"} onClick={() => setAutoVoice(!autoVoice)}><i/></span></span></div>
              <div className="segmented"><button className={audioMode === "narration" ? "selected" : ""} onClick={() => setAudioMode("narration")}><WandSparkles size={15}/> From narration</button><button className={audioMode === "upload" ? "selected" : ""} onClick={() => setAudioMode("upload")}><UploadCloud size={15}/> Upload audio</button></div>
              {audioMode === "narration" ? <><label className="field-label">Narration script</label><textarea className="script-input" value={narration} onChange={e => setNarration(e.target.value)} placeholder="Paste your narration here. ElevenLabs will turn it into an audio file..."/><label className="field-label">Voice profile</label><select value={voice} onChange={e => setVoice(e.target.value)}><option value="neutral-american-male">Neutral American Male</option><option value="british-male">British Male</option><option value="custom">Custom ElevenLabs Voice ID</option></select><button className="secondary-btn full"><Mic2 size={15}/> Generate voice preview</button></> : <div className="audio-upload"><UploadCloud size={25}/><b>Upload generated audio</b><span>MP3, WAV, M4A · audio from ElevenLabs or other source</span><button className="secondary-btn">Choose audio file</button></div>}
              <div className="voice-options"><div><span>Auto audio sync</span><span className={autoSync ? "toggle on" : "toggle"} onClick={() => setAutoSync(!autoSync)}><i/></span></div><div><span>Auto subtitles</span><span className={subtitles ? "toggle on" : "toggle"} onClick={() => setSubtitles(!subtitles)}><i/></span></div></div>
              <div className="notice"><span/> API key is configured securely on the backend. Browser never receives the secret.</div>
            </div>
          </div>

          <div className="section-heading"><div><h3>Automation & content settings</h3><p>Atur niche, frekuensi, dan jam publikasi dari web.</p></div></div>
          <div className="settings-grid">
            <div className="panel"><div className="panel-title"><div className="icon-box blue"><Clock3 size={18}/></div><div><b>Publishing schedule</b><small>Shorts daily · Long-Form every few days</small></div></div><div className="field-row"><label>Shorts per day</label><select value={shortsPerDay} onChange={e => setShortsPerDay(e.target.value)}><option value="1">1 video / day</option><option value="2">2 videos / day</option><option value="custom">Custom</option></select></div><div className="field-row"><label>Shorts publish time (WIB)</label><input type="time" value={shortTime} onChange={e => setShortTime(e.target.value)}/></div><div className="field-row"><label>Long-Form interval</label><select value={longInterval} onChange={e => setLongInterval(e.target.value)}><option value="2-3">Every 2–3 days</option><option value="3-5">Every 3–5 days</option><option value="weekly">Once a week</option><option value="custom">Custom</option></select></div><div className="field-row"><label>Long-Form publish time</label><input type="time" value={longTime} onChange={e => setLongTime(e.target.value)}/></div><div className="notice"><span/> Long-Form is only scheduled after render and quality checks pass.</div></div>
            <div className="panel"><div className="panel-title"><div className="icon-box orange"><Sparkles size={18}/></div><div><b>Niche configuration</b><small>Different niche for Shorts and Long-Form</small></div></div><label className="field-label">Shorts niche</label><input value={nicheShorts} onChange={e => setNicheShorts(e.target.value)} placeholder="e.g. Geography, Animals, History"/><label className="field-label">Long-Form niche</label><input value={nicheLong} onChange={e => setNicheLong(e.target.value)} placeholder="e.g. Documentary, Science, Mystery"/><div className="notice"><span/> Settings will be stored per connected YouTube account.</div></div>
          </div>

          <div className="section-heading"><div><h3>Before publishing</h3><p>Dedicated metadata and thumbnail workspace, ready for the next phase.</p></div><span className="coming">PUBLISHING WORKSPACE</span></div>
          <div className="panel metadata-panel"><div className="metadata-fields"><div><label className="field-label">Video title</label><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter or generate a YouTube title"/></div><div><label className="field-label">Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Write your video description..."/></div></div><div className="thumbnail-box"><div className="thumb-placeholder"><Film size={26}/><span>THUMBNAIL</span><small>16:9 recommended</small></div><button className="secondary-btn">Upload thumbnail</button></div></div>

          <footer><span>NICHE YT STUDIO · PHASE 1</span><span>Render & Voice workspace · Integrations pending</span></footer>
        </div>
      </section>
    </main>
  );
}