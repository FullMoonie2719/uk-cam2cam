import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode, RefObject } from "react";
import { AlertTriangle, ArrowRight, Camera, CameraOff, Flag, LockKeyhole, Mic, MicOff, Radio, ShieldCheck, SkipForward, Square, Users, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRegionStatusText } from "@shared/geoStatus";

type Stage = "checking" | "blocked" | "landing" | "consent" | "ready" | "queue" | "chat" | "stopped";
type ChatMessage = { from: "you" | "stranger"; text: string };
const wsUrl = () => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

export default function Home() {
  const [stage, setStage] = useState<Stage>("checking");
  const [country, setCountry] = useState<string | null>(null);
  const [geoSource, setGeoSource] = useState<string | undefined>();
  const [consent, setConsent] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("Checking your region…");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [reported, setReported] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetch("/api/geo")
      .then(res => res.json())
      .then(data => {
        setCountry(data.country);
        setGeoSource(data.source);
        setStage(data.allowed ? "landing" : "blocked");
        setStatus(data.allowed ? "United Kingdom access confirmed" : "This service is currently available in the UK only");
      })
      .catch(() => {
        setStage("blocked");
        setStatus("We could not confirm your region");
      });
  }, []);

  useEffect(() => () => {
    socket.current?.close();
    pc.current?.close();
    localStream.current?.getTracks().forEach(track => track.stop());
  }, []);

  const send = (payload: Record<string, unknown>) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(payload));
  };

  const prepareMedia = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    return stream;
  };

  const createPeer = (stream: MediaStream) => {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    stream.getTracks().forEach(track => connection.addTrack(track, stream));
    connection.ontrack = event => {
      if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0];
    };
    connection.onicecandidate = event => {
      if (event.candidate) send({ type: "signal", signal: { candidate: event.candidate } });
    };
    pc.current = connection;
    return connection;
  };

  const begin = async () => {
    try {
      setStage("queue");
      setStatus("Opening a private connection…");
      const stream = await prepareMedia();
      const connection = createPeer(stream);
      const ws = new WebSocket(wsUrl());
      socket.current = ws;
      ws.onopen = () => {
        setStatus("Looking for someone in the UK…");
        send({ type: "find" });
      };
      ws.onmessage = async event => {
        const message = JSON.parse(event.data) as { type: string; role?: string; signal?: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }; text?: string; reason?: string };
        if (message.type === "queueing") setStatus("Waiting for a UK stranger to join…");
        if (message.type === "matched") {
          setStage("chat");
          setStatus("Connected anonymously");
          if (message.role === "caller") {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            send({ type: "signal", signal: { sdp: offer } });
          }
        }
        if (message.type === "signal" && message.signal) {
          if (message.signal.sdp) {
            await connection.setRemoteDescription(message.signal.sdp);
            if (message.signal.sdp.type === "offer") {
              const answer = await connection.createAnswer();
              await connection.setLocalDescription(answer);
              send({ type: "signal", signal: { sdp: answer } });
            }
          }
          if (message.signal.candidate) await connection.addIceCandidate(message.signal.candidate);
        }
        if (message.type === "chat" && typeof message.text === "string") setMessages(previous => [...previous, { from: "stranger", text: message.text! }]);
        if (message.type === "peer-left") {
          setStage("ready");
          setStatus("The stranger left the chat");
          resetMedia();
        }
      };
      ws.onerror = () => {
        setStage("ready");
        setStatus("Connection unavailable. Please try again.");
      };
    } catch {
      setStage("ready");
      setStatus("Camera and microphone access are needed to start");
    }
  };

  const resetMedia = () => {
    pc.current?.close();
    pc.current = null;
    localStream.current?.getTracks().forEach(track => track.stop());
    localStream.current = null;
    if (localVideo.current) localVideo.current.srcObject = null;
    if (remoteVideo.current) remoteVideo.current.srcObject = null;
  };

  const stop = () => {
    send({ type: "stop" });
    socket.current?.close();
    resetMedia();
    setStage("stopped");
    setStatus("Session ended");
  };

  const skip = () => {
    send({ type: "skip" });
    socket.current?.close();
    resetMedia();
    setMessages([]);
    setStage("queue");
    setStatus("Finding your next UK stranger…");
    window.setTimeout(() => { void begin(); }, 0);
  };

  const toggleMic = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  };

  const toggleCamera = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCameraOff(!track.enabled);
    }
  };

  const sendChat = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    send({ type: "chat", text });
    setMessages(previous => [...previous, { from: "you", text }]);
    setDraft("");
  };

  const report = () => {
    send({ type: "report" });
    setReported(true);
    setShowSafety(false);
    stop();
  };

  if (stage === "checking") return <Shell><GateCard icon={<Radio className="animate-pulse" />} eyebrow="REGION CHECK" title="Tuning into the right frequency" body={status}><div className="scanline" /></GateCard></Shell>;
  if (stage === "blocked") return <Shell><GateCard icon={<Users />} eyebrow="UK ONLY" title="This channel is UK-only" body="Thanks for stopping by. UK Cam2Cam is currently available to people connecting from the United Kingdom. If you are travelling, please try again when you are back in the UK." /><p className="mt-4 text-center text-xs uppercase tracking-[0.18em] text-cyan-200/50">{getRegionStatusText(country, geoSource)}</p><p className="mt-2 text-center text-xs text-slate-500">If this looks wrong, your network may be masking its region. Try again from a normal UK connection or configure a trusted proxy geolocation header.</p></Shell>;
  if (stage === "landing") return <Landing onEnter={() => setStage("consent")} />;
  if (stage === "consent") return <Shell><section className="hud-card max-w-2xl p-6 sm:p-10"><div className="mb-8 flex items-start justify-between"><div><div className="eyebrow">ACCESS PROTOCOL 01</div><h1 className="mt-3 text-4xl font-black uppercase leading-none text-white sm:text-6xl">Meet the<br /><span className="neon-pink">unknown.</span></h1></div><ShieldCheck className="h-10 w-10 text-cyan-300" /></div><div className="consent-panel"><div className="eyebrow text-pink-300">ADULTS ONLY / 18+</div><p className="mt-3 text-lg font-semibold text-white">UK Cam2Cam is an anonymous live video chat for adults aged 18 and over.</p><p className="mt-2 text-sm leading-6 text-slate-300">You may encounter unpredictable user-generated content. Do not share personal details. Be respectful, leave immediately if you feel uncomfortable, and use Report / Stop when needed.</p></div><label className="mt-7 flex cursor-pointer items-start gap-3 text-sm text-slate-200"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 h-4 w-4 accent-pink-500" /> <span>I confirm that I am <strong className="text-white">18 or older</strong>, I agree to the adult-only terms, and I consent to anonymous video and text chat.</span></label><Button disabled={!consent} onClick={() => setStage("ready")} className="neon-button mt-8 w-full">Enter the UK channel <span>→</span></Button></section></Shell>;

  return <Shell><header className="mb-6 flex items-center justify-between"><div><div className="eyebrow">UK CAM2CAM / LIVE</div><h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white sm:text-5xl">Signal <span className="neon-cyan">found.</span></h1></div><div className="status-chip"><span className="live-dot" /> {status}</div></header><main className="grid gap-4 lg:grid-cols-[1fr_340px]"><section className="hud-card relative overflow-hidden p-3 sm:p-4"><div className="video-grid"><VideoPanel title="YOU" videoRef={localVideo} muted label={cameraOff ? "CAMERA OFF" : "YOUR FEED"} /><VideoPanel title="STRANGER" videoRef={remoteVideo} label={stage === "chat" ? "LIVE FEED" : "WAITING FOR MATCH"} /></div><div className="mt-4 flex flex-wrap gap-2"><Button onClick={toggleMic} variant="outline" className="control-button">{muted ? <MicOff /> : <Mic />} {muted ? "Unmute" : "Mute"}</Button><Button onClick={toggleCamera} variant="outline" className="control-button">{cameraOff ? <CameraOff /> : <Camera />} {cameraOff ? "Camera on" : "Camera off"}</Button><Button onClick={skip} className="control-button pink-control"><SkipForward /> Skip / Next</Button><Button onClick={() => setShowSafety(true)} variant="outline" className="control-button danger-control"><Flag /> Report / Stop</Button></div></section><aside className="hud-card flex min-h-[420px] flex-col p-4"><div className="flex items-center justify-between border-b border-cyan-300/15 pb-4"><div><div className="eyebrow">PRIVATE TEXT CHANNEL</div><h2 className="mt-1 text-lg font-bold text-white">Live messages</h2></div><span className="text-xs text-cyan-300/70">NO LOGS</span></div><div className="flex-1 space-y-3 overflow-y-auto py-4">{messages.length === 0 ? <p className="text-sm leading-6 text-slate-400">{stage === "chat" ? "Say hello. Keep it respectful." : "Your messages will appear here after a match."}</p> : messages.map((message, index) => <div key={`${message.from}-${index}`} className={message.from === "you" ? "message-bubble you" : "message-bubble"}><span>{message.from === "you" ? "YOU" : "STRANGER"}</span>{message.text}</div>)}</div><form onSubmit={sendChat} className="flex gap-2 border-t border-cyan-300/15 pt-4"><input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Type a message…" className="hud-input" disabled={stage !== "chat"} /><Button type="submit" className="send-button" disabled={stage !== "chat"}>→</Button></form></aside></main>{(stage === "ready" || stage === "stopped") && <section className="mt-5 flex flex-col items-center gap-3 text-center"><Button onClick={begin} className="find-button"><Radio /> Find a Stranger</Button><p className="text-xs uppercase tracking-[0.18em] text-slate-400">Anonymous • adults only • UK connections only</p></section>}{showSafety && <div className="overlay"><div className="hud-card max-w-md p-6"><div className="flex items-start justify-between"><div><div className="eyebrow text-pink-300">SAFETY OVERRIDE</div><h2 className="mt-2 text-2xl font-black uppercase text-white">You are in control.</h2></div><button onClick={() => setShowSafety(false)} className="text-slate-400"><X /></button></div><p className="mt-4 text-sm leading-6 text-slate-300">Stop the session immediately if anything feels wrong. Reporting ends this connection and flags the event for review by the host.</p><div className="mt-6 grid gap-2"><Button onClick={stop} className="danger-button"><Square /> Stop session</Button><Button onClick={report} variant="outline" className="control-button"><AlertTriangle /> Report and stop</Button></div></div></div>}{reported && <p className="mt-4 text-center text-sm text-cyan-200">Report received. Thank you for helping keep the channel safer.</p>}</Shell>;
}

function Landing({ onEnter }: { onEnter: () => void }) {
  return <div className="landing-shell"><div className="noise" /><div className="landing-orbit orbit-one" /><div className="landing-orbit orbit-two" /><div className="landing-inner"><header className="landing-nav"><div className="brand-mark"><span className="brand-dot" /> UK CAM2CAM</div><div className="nav-meta"><span>GB / ONLINE</span><span className="live-dot" /></div></header><main className="landing-main"><section className="landing-hero"><div className="eyebrow">PRIVATE FREQUENCY / UK ONLY</div><h1>Meet someone<br /><span className="neon-pink">unexpected.</span></h1><p className="landing-lede">A spontaneous, anonymous video chat for adults in the United Kingdom. No profiles. No endless scrolling. Just one live connection at a time.</p><div className="landing-actions"><Button onClick={onEnter} className="landing-cta">Enter the channel <ArrowRight /></Button><span className="landing-note"><LockKeyhole /> 18+ and consent required</span></div></section><section className="landing-signal"><div className="signal-frame"><div className="signal-top"><span>LIVE SIGNAL</span><span>04:20:26</span></div><div className="signal-visual"><div className="signal-ring ring-a" /><div className="signal-ring ring-b" /><div className="signal-core"><Zap /></div><div className="signal-wave wave-a" /><div className="signal-wave wave-b" /></div><div className="signal-bottom"><span>READY TO CONNECT</span><span className="signal-bars"><i /><i /><i /><i /></span></div></div></section></main><section className="landing-features"><Feature icon={<Users />} title="Random by design" copy="Every hello starts fresh. Meet a new UK stranger without a profile or personal details." /><Feature icon={<ShieldCheck />} title="Safety stays visible" copy="Adults-only access, consent first, and a Report / Stop control always within reach." /><Feature icon={<Radio />} title="Live, not curated" copy="Peer-to-peer video and text chat built for a quick, human connection." /></section><footer className="landing-footer"><span>NO IDENTITY REQUIRED</span><span>18+ / UK CONNECTIONS ONLY</span><span>SCROLL TO ENTER</span></footer></div></div>;
}
function Feature({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) { return <article className="landing-feature"><div className="feature-icon">{icon}</div><div><h2>{title}</h2><p>{copy}</p></div></article>; }

function Shell({ children }: { children: ReactNode }) { return <div className="app-shell"><div className="noise" /><div className="shell-inner">{children}<footer className="mt-10 flex justify-between border-t border-cyan-300/10 pt-4 text-[10px] uppercase tracking-[0.25em] text-slate-500"><span>NO IDENTITY REQUIRED</span><span>18+ / UK ONLY</span></footer></div></div>; }
function GateCard({ icon, eyebrow, title, body, children }: { icon: ReactNode; eyebrow: string; title: string; body: string; children?: ReactNode }) { return <section className="hud-card max-w-2xl p-8 text-center sm:p-12"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/40 text-cyan-300 shadow-[0_0_30px_rgba(54,224,255,.2)]">{icon}</div><div className="eyebrow">{eyebrow}</div><h1 className="mt-3 text-4xl font-black uppercase leading-none text-white sm:text-6xl">{title}</h1><p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-slate-300">{body}</p>{children}</section>; }
function VideoPanel({ title, videoRef, muted: isMuted, label }: { title: string; videoRef: RefObject<HTMLVideoElement | null>; muted?: boolean; label: string }) { return <div className="video-panel"><div className="video-label"><span>{title}</span><span className="text-cyan-200/60">{label}</span></div><video ref={videoRef} autoPlay playsInline muted={isMuted} /><div className="corner tl" /><div className="corner br" /></div>; }
