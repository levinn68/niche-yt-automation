"use client";

import { useEffect, useState } from "react";
import { Youtube, RefreshCw, CheckCircle2 } from "lucide-react";

type Channel = { id: string; title: string; thumbnail?: string | null; selected?: boolean };

export default function YouTubeChannelPicker() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/youtube/channels", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memuat channel.");
      setChannels(data.channels || []);
      setSelected(data.selectedChannelId || data.channels?.find((c: Channel) => c.selected)?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat channel.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/youtube/channels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selected })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan channel.");
      setChannels((current) => current.map((channel) => ({ ...channel, selected: channel.id === selected })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan channel.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="panel-title">
        <div className="icon-box" style={{ background: "rgba(255,0,0,.12)", color: "#ff6b6b" }}><Youtube size={18}/></div>
        <div><b>YouTube channel</b><small>Pilih channel tujuan untuk workflow studio</small></div>
        <button className="secondary-btn" style={{ marginLeft: "auto" }} onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button>
      </div>
      {loading ? <p className="notice">Memuat daftar channel...</p> : channels.length === 0 ? (
        <div className="notice">Belum ada channel terhubung. Gunakan tombol Connect YouTube di bagian atas.</div>
      ) : (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select className="wide-input" style={{ flex: "1 1 260px", minWidth: 0 }} value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="">Pilih channel YouTube</option>
            {channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.title}</option>)}
          </select>
          <button className="primary-btn" onClick={save} disabled={!selected || saving || channels.find((c) => c.id === selected)?.selected}>
            {saving ? "Saving..." : <><CheckCircle2 size={15}/> Use this channel</>}
          </button>
        </div>
      )}
      {error && <p className="alert error-alert">{error}</p>}
      {channels.length > 0 && <small style={{ display: "block", marginTop: 10, opacity: .65 }}>{channels.length} channel ditemukan · pilihan disimpan di database</small>}
    </section>
  );
}
