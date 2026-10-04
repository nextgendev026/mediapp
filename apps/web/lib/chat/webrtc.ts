export type SignalKind = 'offer' | 'answer' | 'ice' | 'hangup';

export interface SignalMessage {
  t: SignalKind;
  sdp?: string | undefined;
  candidate?: RTCIceCandidateInit | null | undefined;
}

export type CallState = 'connecting' | 'connected' | 'degraded' | 'closed';

export interface PeerOptions {
  onRemoteStream: (stream: MediaStream) => void;
  onLocalStream: (stream: MediaStream) => void;
  onSignal: (signal: SignalMessage) => void;
  onState: (state: CallState) => void;
}

export interface PeerHandle {
  startLocal(): Promise<void>;
  createOffer(): Promise<void>;
  acceptOffer(sdp: string): Promise<void>;
  handleSignal(signal: SignalMessage): Promise<void>;
  addIce(candidate: RTCIceCandidateInit): Promise<void>;
  hangup(): void;
  close(): void;
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];

export function isSignalKind(value: unknown): value is SignalKind {
  return value === 'offer' || value === 'answer' || value === 'ice' || value === 'hangup';
}

function mapState(state: RTCPeerConnectionState): CallState {
  if (state === 'connected') return 'connected';
  if (state === 'disconnected' || state === 'failed') return 'degraded';
  if (state === 'closed') return 'closed';
  return 'connecting';
}

export function createPeer(options: PeerOptions): PeerHandle {
  if (typeof RTCPeerConnection === 'undefined') {
    throw new Error('Video calls are not supported in this browser.');
  }
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  let local: MediaStream | null = null;
  let closed = false;
  const queued: SignalMessage[] = [];

  function teardown(): void {
    if (closed) return;
    closed = true;
    if (local) {
      for (const track of local.getTracks()) track.stop();
      local = null;
    }
    try {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    } catch {
      return;
    }
  }

  pc.onicecandidate = (event) => {
    if (closed) return;
    if (event.candidate) options.onSignal({ t: 'ice', candidate: event.candidate.toJSON() });
  };

  pc.ontrack = (event) => {
    const stream = event.streams[0] ?? new MediaStream([event.track]);
    options.onRemoteStream(stream);
  };

  pc.onconnectionstatechange = () => {
    if (closed) return;
    const state = mapState(pc.connectionState);
    if (state === 'closed') {
      teardown();
      options.onState('closed');
      return;
    }
    options.onState(state);
  };

  async function flushQueue(): Promise<void> {
    const pending = queued.splice(0, queued.length);
    for (const item of pending) {
      if (item.candidate) await pc.addIceCandidate(item.candidate).catch(() => undefined);
    }
  }

  async function applyRemote(type: 'offer' | 'answer', sdp: string): Promise<void> {
    await pc.setRemoteDescription({ type, sdp });
    await flushQueue();
  }

  const handle: PeerHandle = {
    async startLocal() {
      if (closed) throw new Error('The call has already ended.');
      if (local) {
        options.onLocalStream(local);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      local = stream;
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
      options.onLocalStream(stream);
    },
    async createOffer() {
      if (closed) throw new Error('The call has already ended.');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      options.onSignal({ t: 'offer', sdp: pc.localDescription?.sdp ?? offer.sdp ?? '' });
    },
    async acceptOffer(sdp: string) {
      if (closed) throw new Error('The call has already ended.');
      if (!local) await handle.startLocal();
      await applyRemote('offer', sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      options.onSignal({ t: 'answer', sdp: pc.localDescription?.sdp ?? answer.sdp ?? '' });
    },
    async handleSignal(signal: SignalMessage) {
      if (closed) return;
      if (signal.t === 'offer') {
        if (signal.sdp) await handle.acceptOffer(signal.sdp);
        return;
      }
      if (signal.t === 'answer') {
        if (signal.sdp && !pc.remoteDescription) await applyRemote('answer', signal.sdp);
        return;
      }
      if (signal.t === 'ice') {
        const candidate = signal.candidate;
        if (!candidate) return;
        if (!pc.remoteDescription) {
          queued.push({ t: 'ice', candidate });
          return;
        }
        await pc.addIceCandidate(candidate).catch(() => undefined);
        return;
      }
      if (signal.t === 'hangup') {
        teardown();
        options.onState('closed');
      }
    },
    async addIce(candidate: RTCIceCandidateInit) {
      if (closed) return;
      if (!pc.remoteDescription) {
        queued.push({ t: 'ice', candidate });
        return;
      }
      await pc.addIceCandidate(candidate).catch(() => undefined);
    },
    hangup() {
      if (closed) return;
      options.onSignal({ t: 'hangup' });
      teardown();
      options.onState('closed');
    },
    close() {
      teardown();
    }
  };

  return handle;
}
