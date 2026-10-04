'use client';

import { FileText, Image as ImageIcon, LoaderCircle, Lock, Paperclip, PhoneIncoming, PhoneOff, Send, ShieldCheck, Video } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { decryptBytes, decryptText, deriveThreadKey, encryptBytes, encryptText, getOrCreateThreadKeyPair, isEnvelope } from '@/lib/chat/crypto';
import { createPeer, isSignalKind, type CallState, type PeerHandle, type SignalMessage } from '@/lib/chat/webrtc';
import { cn } from '@/lib/utils/cn';

interface AttachmentInfo {
  id: string;
  filename: string;
  mime: string;
  size?: number | undefined;
  kind: 'prescription' | 'photo' | 'document';
  enc?: boolean | undefined;
}

interface MessageItem {
  id: string;
  threadId: string;
  senderId: string;
  sentAt: string;
  text?: string | undefined;
  attachmentId?: string | undefined;
  readBy: string[];
  senderName: string;
  senderRole: string;
  attachment: AttachmentInfo | null;
}

type TextState =
  | { status: 'none' }
  | { status: 'ok'; value: string }
  | { status: 'pending' }
  | { status: 'failed' }
  | { status: 'signal'; signal: SignalMessage };

type AttachState =
  | { status: 'none' }
  | { status: 'direct' }
  | { status: 'pending' }
  | { status: 'failed' }
  | { status: 'ready'; url: string };

interface Proc {
  gen: number;
  text: TextState;
  attach: AttachState;
}

type CallPhase = 'idle' | 'outgoing' | 'active';

const mutationHeaders: Record<string, string> = { 'Content-Type': 'application/json', 'X-Afya-Client': 'web' };
const SIGNAL_PREFIX = '@@SIGNAL@@';
const IMAGE_MAX = 2_000_000;
const VIDEO_MAX = 25 * 1024 * 1024;
const PDF_MAX = 5 * 1024 * 1024;
const LOCK_TEXT = 'Encrypted message — key unavailable';

const keyCache = new Map<string, CryptoKey>();
const textCache = new Map<string, string>();
const attachmentCache = new Map<string, AttachState>();

function attachmentIcon(info: AttachmentInfo) {
  if (info.mime.startsWith('video/')) return Video;
  if (info.mime.startsWith('image/')) return ImageIcon;
  return FileText;
}

function timeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function durationLabel(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function classifyText(body: string): TextState {
  if (body.startsWith('{')) {
    try {
      const parsed = JSON.parse(body) as { k?: unknown; s?: unknown };
      if (parsed && parsed.k === 'signal' && parsed.s && typeof parsed.s === 'object') {
        const raw = parsed.s as { t?: unknown; sdp?: unknown; candidate?: unknown };
        if (isSignalKind(raw.t)) {
          const signal: SignalMessage = {
            t: raw.t,
            sdp: typeof raw.sdp === 'string' ? raw.sdp : undefined,
            candidate: (raw.candidate ?? null) as RTCIceCandidateInit | null
          };
          return { status: 'signal', signal };
        }
      }
    } catch {
      return { status: 'ok', value: body };
    }
  }
  return { status: 'ok', value: body };
}

async function resolveText(message: MessageItem, key: CryptoKey | undefined): Promise<TextState> {
  if (!message.text) return { status: 'none' };
  const cached = textCache.get(message.id);
  if (cached !== undefined) return classifyText(cached);
  let body = message.text;
  if (isEnvelope(body)) {
    if (!key) return { status: 'pending' };
    try {
      body = await decryptText(key, body);
    } catch {
      return { status: 'failed' };
    }
  } else if (body.startsWith(SIGNAL_PREFIX)) {
    body = body.slice(SIGNAL_PREFIX.length);
  }
  textCache.set(message.id, body);
  return classifyText(body);
}

async function resolveAttachment(message: MessageItem, key: CryptoKey | undefined): Promise<AttachState> {
  const info = message.attachment;
  if (!info) return { status: 'none' };
  if (!info.enc) return { status: 'direct' };
  const cached = attachmentCache.get(info.id);
  if (cached) return cached;
  if (!key) return { status: 'pending' };
  try {
    const response = await fetch(`/api/files/${info.id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Attachment unavailable.');
    const plain = await decryptBytes(key, await response.arrayBuffer());
    const blob = new Blob([plain], { type: info.mime || 'application/octet-stream' });
    const state: AttachState = { status: 'ready', url: URL.createObjectURL(blob) };
    attachmentCache.set(info.id, state);
    return state;
  } catch {
    return { status: 'failed' };
  }
}

function fallbackText(message: MessageItem): TextState {
  if (!message.text) return { status: 'none' };
  if (isEnvelope(message.text)) return { status: 'pending' };
  if (message.text.startsWith(SIGNAL_PREFIX)) return { status: 'none' };
  return { status: 'ok', value: message.text };
}

function fallbackAttach(message: MessageItem): AttachState {
  if (!message.attachment) return { status: 'none' };
  return message.attachment.enc ? { status: 'pending' } : { status: 'direct' };
}

function filePolicy(file: File): { max: number; label: string; kind: 'image' | 'video' | 'pdf' } {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('video/')) return { max: VIDEO_MAX, label: '25 MB', kind: 'video' };
  if (type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return { max: PDF_MAX, label: '5 MB', kind: 'pdf' };
  return { max: IMAGE_MAX, label: '2 MB', kind: 'image' };
}

function validateFile(file: File): string | null {
  const type = (file.type || '').toLowerCase();
  const isPdf = type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isVideo = type.startsWith('video/');
  const isImage = type.startsWith('image/');
  if (!isImage && !isVideo && !isPdf) return 'Unsupported file type. Use an image, a video or a PDF.';
  const policy = filePolicy(file);
  if (file.size > policy.max) {
    const label = policy.kind === 'video' ? 'Video' : policy.kind === 'pdf' ? 'PDF' : 'Image';
    return `${label} files are limited to ${policy.label}.`;
  }
  return null;
}

function kindForFile(file: File): AttachmentInfo['kind'] {
  const type = (file.type || '').toLowerCase();
  return type.startsWith('image/') || type.startsWith('video/') ? 'photo' : 'document';
}

function uploadForm(form: FormData, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files');
    xhr.setRequestHeader('X-Afya-Client', 'web');
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });
    xhr.addEventListener('load', () => {
      let payload: { id?: string; error?: string } = {};
      try {
        payload = JSON.parse(xhr.responseText) as { id?: string; error?: string };
      } catch {
        payload = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && payload.id) resolve(payload.id);
      else reject(new Error(payload.error ?? 'Upload failed.'));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed. Check your connection.')));
    xhr.addEventListener('abort', () => reject(new Error('Upload was cancelled.')));
    xhr.send(form);
  });
}

function MediaTile({ stream, label, mirror, muted }: { stream: MediaStream | null; label: string; mirror?: boolean; muted?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    node.srcObject = stream;
    if (muted !== undefined) node.muted = muted;
    if (stream) void node.play().catch(() => undefined);
    return () => {
      node.srcObject = null;
    };
  }, [stream, muted]);
  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
      <video
        ref={ref}
        autoPlay
        playsInline
        className={cn('h-full w-full object-cover', mirror && 'scale-x-[-1]')}
        onClick={() => {
          const node = ref.current;
          if (node) void node.play().catch(() => undefined);
        }}
      />
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{label}</span>
    </div>
  );
}

function AttachmentView({ info, state, mine }: { info: AttachmentInfo; state: AttachState; mine: boolean }) {
  const name = info.enc ? info.filename.replace(/^enc_/, '') : info.filename;
  const shell = mine ? 'border-white/40 bg-white/10 text-white' : 'border-[var(--color-gray-200)] bg-white text-[var(--color-gray-700)]';
  const Icon = attachmentIcon(info);
  const link = cn('mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold', shell);

  if (state.status === 'pending' || state.status === 'failed') {
    return (
      <div className={link}>
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{LOCK_TEXT}</span>
      </div>
    );
  }
  if (state.status === 'ready') {
    if (info.mime.startsWith('image/')) return <img src={state.url} alt={name} className="mt-2 max-h-64 w-auto max-w-full rounded-lg" />;
    if (info.mime.startsWith('video/')) return <video src={state.url} controls playsInline muted className="mt-2 max-h-64 w-full rounded-lg bg-black" />;
    return (
      <a href={state.url} download={name} className={link}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{name}</span>
      </a>
    );
  }
  if (state.status === 'direct') {
    const href = `/api/files/${info.id}`;
    if (info.mime.startsWith('image/')) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="mt-2 block">
          <img src={href} alt={name} className="max-h-64 w-auto max-w-full rounded-lg" />
        </a>
      );
    }
    if (info.mime.startsWith('video/')) return <video src={href} controls playsInline muted className="mt-2 max-h-64 w-full rounded-lg bg-black" />;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={link}>
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{name}</span>
      </a>
    );
  }
  return null;
}

export function ChatPanel(props: { otherUserId: string; otherName: string; contextId?: string | undefined; topic?: string | undefined; heightClass?: string }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; percent: number | null } | null>(null);
  const [processed, setProcessed] = useState<Record<string, Proc>>({});
  const [channelReady, setChannelReady] = useState(false);
  const [keyVersion, setKeyVersion] = useState(0);
  const [callPhase, setCallPhase] = useState<CallPhase>('idle');
  const [incomingSdp, setIncomingSdp] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connState, setConnState] = useState<'connecting' | 'connected' | 'degraded'>('connecting');
  const [elapsed, setElapsed] = useState(0);
  const [callError, setCallError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lastMarkedRef = useRef<string | null>(null);
  const peerRef = useRef<PeerHandle | null>(null);
  const queuedSignalsRef = useRef<SignalMessage[]>([]);
  const routedSignalsRef = useRef<Set<string>>(new Set());
  const phaseRef = useRef<CallPhase>('idle');
  const connectedAtRef = useRef<number | null>(null);
  const otherUserId = props.otherUserId;

  const markRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/threads/${id}/read`, { method: 'POST', headers: { 'X-Afya-Client': 'web' }, body: '{}' });
    } catch {
      return;
    }
  }, []);

  const loadMessages = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/threads/${id}/messages`, { cache: 'no-store' });
        if (!response.ok) throw new Error('failed');
        const payload = (await response.json()) as { messages: MessageItem[] };
        const list = Array.isArray(payload.messages) ? payload.messages : [];
        setMessages(list);
        setError(null);
        const last = list[list.length - 1];
        if (last && last.senderId === otherUserId && last.id !== lastMarkedRef.current) {
          lastMarkedRef.current = last.id;
          void markRead(id);
        }
      } catch {
        setError((current) => current ?? 'Connection lost — retrying…');
      } finally {
        setLoading(false);
      }
    },
    [markRead, otherUserId]
  );

  const postToThread = useCallback(
    async (body: Record<string, unknown>) => {
      if (!threadId) throw new Error('The conversation is not ready.');
      const response = await fetch(`/api/threads/${threadId}/messages`, { method: 'POST', headers: mutationHeaders, body: JSON.stringify(body) });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Message could not be sent.');
      }
    },
    [threadId]
  );

  const setPhase = useCallback((next: CallPhase) => {
    phaseRef.current = next;
    setCallPhase(next);
  }, []);

  const teardownCall = useCallback(() => {
    const peer = peerRef.current;
    peerRef.current = null;
    queuedSignalsRef.current = [];
    if (peer) peer.close();
    setLocalStream(null);
    setRemoteStream(null);
    connectedAtRef.current = null;
    setConnState('connecting');
    setElapsed(0);
    setPhase('idle');
  }, [setPhase]);

  const sendSignal = useCallback(
    async (signal: SignalMessage) => {
      if (!threadId) return;
      const payload = JSON.stringify({ k: 'signal', s: signal });
      const key = keyCache.get(threadId);
      let body = `${SIGNAL_PREFIX}${payload}`;
      if (key) {
        try {
          body = await encryptText(key, payload);
        } catch {
          body = `${SIGNAL_PREFIX}${payload}`;
        }
      }
      try {
        await postToThread({ text: body });
        await loadMessages(threadId);
      } catch {
        setSendError('Call signal could not be delivered.');
      }
    },
    [threadId, postToThread, loadMessages]
  );

  const makePeer = useCallback((): PeerHandle => {
    return createPeer({
      onLocalStream: (stream) => setLocalStream(stream),
      onRemoteStream: (stream) => setRemoteStream(stream),
      onSignal: (signal) => {
        void sendSignal(signal);
      },
      onState: (state: CallState) => {
        if (state === 'closed') {
          teardownCall();
          return;
        }
        setConnState(state);
        if (state === 'connected' && connectedAtRef.current === null) connectedAtRef.current = Date.now();
      }
    });
  }, [sendSignal, teardownCall]);

  const routeSignal = useCallback(
    (signal: SignalMessage) => {
      if (signal.t === 'offer') {
        if (peerRef.current || phaseRef.current !== 'idle') return;
        setIncomingSdp(typeof signal.sdp === 'string' && signal.sdp ? signal.sdp : '');
        return;
      }
      const peer = peerRef.current;
      if (peer) {
        void peer.handleSignal(signal).catch(() => undefined);
        return;
      }
      if (signal.t === 'hangup') {
        teardownCall();
        return;
      }
      queuedSignalsRef.current.push(signal);
    },
    [teardownCall]
  );

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const response = await fetch('/api/threads', {
          method: 'POST',
          headers: mutationHeaders,
          body: JSON.stringify({ participantId: otherUserId, contextId: props.contextId, topic: props.topic })
        });
        const payload = (await response.json()) as { thread?: { id: string }; error?: string };
        if (!response.ok || !payload.thread) throw new Error(payload.error ?? 'Unable to start the conversation.');
        if (cancelled) return;
        setThreadId(payload.thread.id);
        await loadMessages(payload.thread.id);
      } catch (err) {
        if (cancelled) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : 'Unable to start the conversation.');
      }
    }
    void start();
    return () => {
      cancelled = true;
    };
  }, [otherUserId, props.contextId, props.topic, loadMessages]);

  useEffect(() => {
    if (!threadId) return undefined;
    const id = threadId;
    let cancelled = false;
    let timer: number | undefined;

    if (keyCache.has(id)) {
      setChannelReady(true);
      return undefined;
    }
    setChannelReady(false);

    async function step(): Promise<boolean> {
      const pair = await getOrCreateThreadKeyPair(id);
      let list: { userId: string; publicKey: string }[] = [];
      let me = '';
      const response = await fetch(`/api/threads/${id}/keys`, { cache: 'no-store' });
      if (response.ok) {
        const payload = (await response.json()) as { publicKeys?: { userId: string; publicKey: string }[]; me?: string };
        list = Array.isArray(payload.publicKeys) ? payload.publicKeys : [];
        me = typeof payload.me === 'string' ? payload.me : '';
      }
      const published = me ? list.find((entry) => entry.userId === me) : undefined;
      if (!published || published.publicKey !== pair.pubB64) {
        const publish = await fetch(`/api/threads/${id}/keys`, {
          method: 'POST',
          headers: mutationHeaders,
          body: JSON.stringify({ publicKey: pair.pubB64 })
        });
        if (!publish.ok) throw new Error('Key publication failed.');
        const saved = (await publish.json()) as { publicKeys?: { userId: string; publicKey: string }[]; me?: string };
        list = Array.isArray(saved.publicKeys) ? saved.publicKeys : list;
        me = typeof saved.me === 'string' ? saved.me : me;
      }
      if (!me) return false;
      const theirs = list.find((entry) => entry.userId !== me);
      if (!theirs) return false;
      const key = await deriveThreadKey(pair.privJwk, theirs.publicKey, id);
      keyCache.set(id, key);
      return true;
    }

    async function run(): Promise<void> {
      try {
        const ready = await step();
        if (cancelled) return;
        if (ready) {
          setChannelReady(true);
          setKeyVersion((current) => current + 1);
          return;
        }
      } catch {
        if (cancelled) return;
      }
      timer = window.setTimeout(() => {
        void run();
      }, 5000);
    }

    void run();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [threadId]);

  useEffect(() => {
    if (!threadId) return undefined;
    void loadMessages(threadId);
    const interval = callPhase === 'idle' ? 5000 : 4000;
    const timer = window.setInterval(() => {
      void loadMessages(threadId);
    }, interval);
    return () => window.clearInterval(timer);
  }, [threadId, loadMessages, callPhase]);

  useEffect(() => {
    if (!threadId) return undefined;
    const id = threadId;
    const gen = keyVersion;
    let cancelled = false;

    void (async () => {
      const key = keyCache.get(id);
      const updates: Record<string, Proc> = {};
      for (const message of messages) {
        const existing = processed[message.id];
        if (existing && existing.gen >= gen) continue;
        const resolvedText = await resolveText(message, key);
        const resolvedAttach = await resolveAttachment(message, key);
        if (cancelled) return;
        updates[message.id] = { gen, text: resolvedText, attach: resolvedAttach };
      }
      if (cancelled) return;
      if (Object.keys(updates).length === 0) return;
      for (const message of messages) {
        const proc = updates[message.id];
        if (!proc || proc.text.status !== 'signal') continue;
        if (message.senderId !== otherUserId) continue;
        if (routedSignalsRef.current.has(message.id)) continue;
        routedSignalsRef.current.add(message.id);
        routeSignal(proc.text.signal);
      }
      setProcessed((current) => {
        let changed = false;
        const next = { ...current };
        for (const [messageId, proc] of Object.entries(updates)) {
          const existing = next[messageId];
          if (existing && existing.gen >= proc.gen) continue;
          next[messageId] = proc;
          changed = true;
        }
        return changed ? next : current;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, processed, threadId, keyVersion, otherUserId, routeSignal]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length, processed]);

  useEffect(() => {
    if (callPhase === 'idle') return undefined;
    const tick = () => {
      const at = connectedAtRef.current;
      setElapsed(at ? Math.floor((Date.now() - at) / 1000) : 0);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [callPhase]);

  useEffect(() => {
    return () => {
      const peer = peerRef.current;
      peerRef.current = null;
      if (peer) peer.close();
    };
  }, []);

  async function startCall() {
    if (peerRef.current || phaseRef.current !== 'idle' || incomingSdp) return;
    setCallError(null);
    setSendError(null);
    try {
      const peer = makePeer();
      peerRef.current = peer;
      await peer.startLocal();
      setPhase('outgoing');
      setConnState('connecting');
      await peer.createOffer();
      if (threadId) await loadMessages(threadId);
    } catch (err) {
      if (peerRef.current) teardownCall();
      setCallError(err instanceof Error ? err.message : 'Could not start the video call.');
    }
  }

  async function acceptCall() {
    const sdp = incomingSdp;
    if (!sdp) return;
    setCallError(null);
    try {
      const peer = makePeer();
      peerRef.current = peer;
      await peer.acceptOffer(sdp);
      setIncomingSdp(null);
      setPhase('active');
      setConnState('connecting');
      const queued = queuedSignalsRef.current.splice(0, queuedSignalsRef.current.length);
      for (const signal of queued) {
        await peer.handleSignal(signal).catch(() => undefined);
      }
    } catch (err) {
      setIncomingSdp(null);
      if (peerRef.current) teardownCall();
      setCallError(err instanceof Error ? err.message : 'Could not answer the video call.');
    }
  }

  async function declineCall() {
    setIncomingSdp(null);
    if (threadId) await sendSignal({ t: 'hangup' });
  }

  function hangUp() {
    const peer = peerRef.current;
    if (peer) {
      peer.hangup();
      return;
    }
    teardownCall();
  }

  async function upload(file: File): Promise<string | null> {
    setUploading({ name: file.name, percent: null });
    try {
      const form = new FormData();
      const key = threadId ? keyCache.get(threadId) : undefined;
      let payload: Blob = file;
      let uploadName = file.name;
      if (key) {
        const encrypted = await encryptBytes(key, await file.arrayBuffer());
        payload = new Blob([encrypted], { type: file.type || 'application/octet-stream' });
        uploadName = `enc_${file.name}`;
      }
      form.append('file', payload, uploadName);
      form.append('kind', kindForFile(file));
      if (key) {
        form.append('origMime', file.type || 'application/octet-stream');
        form.append('enc', '1');
      }
      return await uploadForm(form, (percent) => setUploading({ name: file.name, percent }));
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Upload failed.');
      return null;
    } finally {
      setUploading(null);
    }
  }

  async function send() {
    const draft = text.trim();
    if (!threadId || !draft || sending) return;
    setSending(true);
    setSendError(null);
    try {
      const key = keyCache.get(threadId);
      let body = draft;
      if (key) {
        try {
          body = await encryptText(key, draft);
        } catch {
          body = draft;
        }
      }
      await postToThread({ text: body });
      setText('');
      await loadMessages(threadId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  async function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !threadId) return;
    const problem = validateFile(file);
    if (problem) {
      setSendError(problem);
      return;
    }
    setSendError(null);
    const attachmentId = await upload(file);
    if (!attachmentId) return;
    setSending(true);
    try {
      await postToThread({ attachmentId });
      await loadMessages(threadId);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Attachment could not be sent.');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  const visibleMessages = useMemo(
    () =>
      messages.filter((message) => {
        if (message.text && message.text.startsWith(SIGNAL_PREFIX)) return false;
        const proc = processed[message.id];
        if (proc) return proc.text.status !== 'signal';
        return true;
      }),
    [messages, processed]
  );

  const height = props.heightClass ?? 'h-[420px]';

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--color-gray-200)] bg-white">
      <div className="flex items-center gap-2 border-b border-[var(--color-gray-100)] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-primary-light)] text-xs font-bold text-[var(--color-primary-dark)]">
          {props.otherName.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold">{props.otherName}</p>
          <p className="text-[11px] text-[var(--color-gray-500)]">Secure messaging</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Start video call"
          title="Start video call"
          disabled={!threadId || callPhase !== 'idle' || Boolean(incomingSdp)}
          onClick={() => void startCall()}
        >
          <Video className="h-4 w-4" />
        </Button>
      </div>

      {callPhase !== 'idle' && (
        <div className="border-b border-[var(--color-gray-100)] bg-black/95 p-3">
          <div className="grid grid-cols-2 gap-3">
            <MediaTile stream={localStream} label="You" mirror muted />
            <MediaTile stream={remoteStream} label={props.otherName} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <Badge tone={connState === 'connected' ? 'success' : connState === 'degraded' ? 'warning' : 'neutral'}>{connState}</Badge>
            <span className="text-xs font-bold tabular-nums text-white">{durationLabel(elapsed)}</span>
            <Button type="button" variant="destructive" size="sm" onClick={hangUp} aria-label="Hang up">
              <PhoneOff className="h-4 w-4" />
              Hang up
            </Button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className={`${height} space-y-3 overflow-y-auto p-4`} aria-live="polite">
        {loading && <p className="text-sm text-[var(--color-gray-500)]">Loading conversation…</p>}
        {!loading && visibleMessages.length === 0 && !error && <p className="text-sm text-[var(--color-gray-500)]">No messages yet. Say hello to {props.otherName}.</p>}
        {visibleMessages.map((message) => {
          const isMine = message.senderId !== otherUserId;
          const proc = processed[message.id];
          const textState: TextState = proc?.text ?? fallbackText(message);
          const attachState: AttachState = proc?.attach ?? fallbackAttach(message);
          const locked = textState.status === 'pending' || textState.status === 'failed';
          return (
            <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${isMine ? 'rounded-br-md bg-[var(--color-primary)] text-white' : 'rounded-bl-md bg-[var(--color-gray-100)] text-[var(--color-gray-700)]'}`}>
                {!isMine && (
                  <p className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-[var(--color-gray-700)]">
                    {message.senderName}
                    <Badge tone="neutral" className="capitalize">
                      {message.senderRole}
                    </Badge>
                  </p>
                )}
                {locked && (
                  <p className="flex items-center gap-2 text-xs font-semibold">
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{LOCK_TEXT}</span>
                  </p>
                )}
                {textState.status === 'ok' && <p className="whitespace-pre-wrap break-words">{textState.value}</p>}
                {message.attachment && <AttachmentView info={message.attachment} state={attachState} mine={isMine} />}
                <p className={`mt-1 text-[10px] ${isMine ? 'text-green-100' : 'text-[var(--color-gray-500)]'}`}>{timeLabel(message.sentAt)}</p>
              </div>
            </div>
          );
        })}
        {error && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{error}</p>}
      </div>

      {incomingSdp && callPhase === 'idle' && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-gray-100)] bg-blue-50 px-4 py-2">
          <p className="flex items-center gap-2 text-xs font-bold text-blue-900">
            <PhoneIncoming className="h-4 w-4" aria-hidden="true" />
            Incoming video call
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => void acceptCall()}>
              Accept
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => void declineCall()}>
              Decline
            </Button>
          </div>
        </div>
      )}

      {callError && <p className="mx-3 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{callError}</p>}
      {sendError && <p className="mx-3 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{sendError}</p>}
      {uploading && (
        <p className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] px-3 py-2 text-xs font-semibold text-[var(--color-gray-700)]">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span className="truncate">{uploading.name}</span>
          <span>{uploading.percent !== null ? `${uploading.percent}%` : 'Uploading…'}</span>
        </p>
      )}

      <div className="flex items-center gap-1.5 border-t border-[var(--color-gray-100)] px-4 py-1.5">
        {channelReady ? (
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-green-600">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            End-to-end encrypted
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
            <ShieldCheck className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
            Establishing secure channel…
          </p>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-[var(--color-gray-100)] p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,.pdf"
          className="sr-only"
          onChange={(event) => void onPickFile(event)}
          aria-label="Attach a file"
        />
        <Button type="button" variant="ghost" size="icon" aria-label="Attach a file" disabled={uploading !== null || !threadId} onClick={() => fileRef.current?.click()}>
          {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
        <label className="flex-1">
          <span className="sr-only">Message</span>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 2000))}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Message ${props.otherName}…`}
            className="max-h-32 min-h-11 w-full resize-none rounded-lg border border-[var(--color-gray-200)] bg-[var(--color-gray-50)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
        </label>
        <Button
          type="button"
          size="icon"
          aria-label="Send message"
          disabled={!threadId || sending || uploading !== null || text.trim().length === 0}
          onClick={() => void send()}
        >
          {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--color-gray-100)] px-4 py-2">
        <p className="text-[11px] text-[var(--color-gray-500)]">Enter to send · Shift+Enter for a new line</p>
        <p className="text-[11px] text-[var(--color-gray-500)]">{text.length}/2000</p>
      </div>
    </div>
  );
}
