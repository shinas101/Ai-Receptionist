import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, Track, createLocalAudioTrack } from 'livekit-client';
import { api } from '../services/api';

const ROOM_OPTIONS = {
  adaptiveStream: true,
  dynacast: true,
  stopLocalTrackOnUnpublish: false,
  audioCaptureDefaults: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
  },
};

export function useLiveKit() {
  const [connectionState, setConnectionState] = useState('disconnected'); // disconnected, connecting, connected, error
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [agentAudioLevel, setAgentAudioLevel] = useState(0);
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [agentState, setAgentState] = useState('idle'); // idle, connecting, listening, speaking, thinking
  const [transcripts, setTranscripts] = useState(() => [
    {
      id: 'welcome',
      speaker: 'MIA',
      text: 'Hello! I am Mia, your virtual receptionist at ABC Health Care. Click Start Consultation to speak with me.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'agent',
    },
  ]);
  const [roomInfo, setRoomInfo] = useState(null);
  const [error, setError] = useState(null);
  const [startupStatus, setStartupStatus] = useState(null); // { status: string, message: string }
  const [activeToolCall, setActiveToolCall] = useState(null); // { tool: string, message: string, status: 'running'|'completed', timestamp: number }

  const roomRef = useRef(null);
  const preparedRoomRef = useRef(null);
  const livekitUrlRef = useRef(null);
  const connectionStateRef = useRef(connectionState);
  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const micAnimFrameRef = useRef(null);
  const audioElementRef = useRef(null);
  const localMicStreamRef = useRef(null);

  // Pre-warm DNS, TLS, and WebRTC ICE signaling on mount so clicking Call Mia is instant
  useEffect(() => {
    let active = true;
    const prewarmConnection = async () => {
      try {
        const cfg = await api.getConfig();
        if (!active || !cfg?.livekit_url) return;
        livekitUrlRef.current = cfg.livekit_url;
        const warmRoom = new Room(ROOM_OPTIONS);
        preparedRoomRef.current = warmRoom;
        await warmRoom.prepareConnection(cfg.livekit_url);
      } catch {
        // Non-fatal: connect() still creates a fresh Room if backend isn't reachable yet
      }
    };
    void prewarmConnection();
    return () => {
      active = false;
    };
  }, []);

  // Helper to normalize strings for robust deduplication
  const normalizeText = (str) =>
    (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

  // Append or update a clean transcript entry with in-place streaming and de-duplication
  const appendTranscript = useCallback((rawSpeaker, text, type = 'chat', isFinal = true, id = null) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    const lower = (rawSpeaker || '').toLowerCase();
    const isAgent =
      lower.includes('mia') ||
      lower.includes('agent') ||
      lower.includes('receptionist') ||
      lower.includes('assistant');
    const speaker = isAgent ? 'MIA' : 'Patient';
    const msgType = isAgent ? 'agent' : 'user';
    const normClean = normalizeText(cleanText);
    if (!normClean) return;

    setTranscripts((prev) => {
      // 1. If explicit ID matches an existing card, update it in place (live streaming)
      if (id) {
        const existingIdx = prev.findIndex((m) => m.id === id);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            text: cleanText,
            final: isFinal,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          return updated;
        }
      }

      // 2. Replace static initial welcome card with the first live greeting from Mia
      if (prev.length === 1 && prev[0].id === 'welcome' && isAgent) {
        return [
          {
            id: id || `msg-${Date.now()}`,
            speaker: 'MIA',
            text: cleanText,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'agent',
            final: isFinal,
          },
        ];
      }

      // 3. Check the very last message for in-place streaming continuation or duplicate
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker) {
        const normLast = normalizeText(last.text);

        if (normLast === normClean) {
          if (isFinal && !last.final) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              final: true,
            };
            return updated;
          }
          return prev;
        }

        if (
          !last.final ||
          normClean.startsWith(normLast) ||
          normLast.startsWith(normClean)
        ) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            id: id || last.id,
            text: cleanText.length >= last.text.length ? cleanText : last.text,
            final: isFinal,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };
          return updated;
        }
      }

      // 4. Check recent messages for duplicate broadcast echoes
      const isRecentDuplicate = prev.slice(-4).some(
        (m) => m.speaker === speaker && normalizeText(m.text) === normClean
      );
      if (isRecentDuplicate) {
        return prev;
      }

      // 5. Append new message turn
      return [
        ...prev,
        {
          id: id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          speaker,
          text: cleanText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: msgType,
          final: isFinal,
        },
      ];
    });
  }, []);

  // Throttled Web Audio analyzer for remote agent audio (~15fps to avoid React 60fps render storms)
  const setupAudioAnalysis = useCallback((mediaStream) => {
    try {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.75;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(mediaStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let lastTick = 0;
      let lastLevel = -1;
      let lastSpeaking = null;

      const updateMeter = (now) => {
        if (now - lastTick >= 65) {
          lastTick = now;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          const normalized = Math.min(100, Math.round((avg / 255) * 100));
          const speaking = normalized > 6;

          if (Math.abs(normalized - lastLevel) >= 3 || (normalized === 0 && lastLevel !== 0)) {
            lastLevel = normalized;
            setAgentAudioLevel(normalized);
          }

          if (speaking !== lastSpeaking) {
            lastSpeaking = speaking;
            setIsAgentSpeaking(speaking);
            if (speaking) {
              setAgentState('speaking');
            } else if (connectionStateRef.current === 'connected' || roomRef.current?.state === 'connected') {
              setAgentState('listening');
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      animFrameRef.current = requestAnimationFrame(updateMeter);
    } catch (e) {
      console.warn('Audio analyzer note:', e);
    }
  }, []);

  const startLocalMicMonitor = useCallback((micMediaTrack) => {
    if (!micMediaTrack) return;
    try {
      if (micAnimFrameRef.current) {
        cancelAnimationFrame(micAnimFrameRef.current);
      }
      const stream = new MediaStream([micMediaTrack]);
      localMicStreamRef.current = stream;
      const micCtx = audioContextRef.current || new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = micCtx;
      const micAnalyser = micCtx.createAnalyser();
      micAnalyser.fftSize = 32;
      const micSource = micCtx.createMediaStreamSource(stream);
      micSource.connect(micAnalyser);
      const data = new Uint8Array(micAnalyser.frequencyBinCount);

      let lastTick = 0;
      let lastMicLevel = -1;

      const pollMic = (now) => {
        if (!roomRef.current || roomRef.current.state !== 'connected') return;
        if (now - lastTick >= 80) {
          lastTick = now;
          micAnalyser.getByteFrequencyData(data);
          let s = 0;
          for (let i = 0; i < data.length; i++) s += data[i];
          const next = Math.round(((s / data.length) / 255) * 100);
          if (Math.abs(next - lastMicLevel) >= 4 || (next === 0 && lastMicLevel !== 0)) {
            lastMicLevel = next;
            setUserAudioLevel(next);
          }
        }
        micAnimFrameRef.current = requestAnimationFrame(pollMic);
      };
      micAnimFrameRef.current = requestAnimationFrame(pollMic);
    } catch (err) {
      console.warn('Local mic analysis note:', err);
    }
  }, []);

  // Connect to LiveKit Room with parallel token + mic capture and pre-warmed signaling
  const connect = useCallback(async (userName = 'Patient') => {
    if (connectionState === 'connecting' || connectionState === 'connected') return;

    setConnectionState('connecting');
    setAgentState('connecting');
    setError(null);
    setStartupStatus({
      status: 'connecting',
      message: 'Connecting voice consultation...',
    });

    // Unlock Web Audio immediately on user gesture
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        void audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn('AudioContext unlock note:', e);
    }

    let preCapturedTrack = null;

    try {
      const uniqueRoom = `consultation-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;

      // Run token fetch and local mic capture in parallel to cut connect time
      const [tokenOutcome, micOutcome] = await Promise.allSettled([
        api.getToken(uniqueRoom, userName),
        createLocalAudioTrack(ROOM_OPTIONS.audioCaptureDefaults),
      ]);

      if (micOutcome.status === 'fulfilled') {
        preCapturedTrack = micOutcome.value;
      }

      if (tokenOutcome.status !== 'fulfilled' || !tokenOutcome.value?.token) {
        throw new Error(tokenOutcome.reason?.message || tokenOutcome.value?.error || 'Failed to obtain LiveKit token');
      }

      const tokenRes = tokenOutcome.value;
      livekitUrlRef.current = tokenRes.url;

      setRoomInfo({
        room: tokenRes.room,
        identity: tokenRes.identity,
        url: tokenRes.url,
      });

      // Reuse pre-warmed Room when available so TLS/ICE is already established
      const room = preparedRoomRef.current || new Room(ROOM_OPTIONS);
      preparedRoomRef.current = null;
      roomRef.current = room;

      const attachAudioTrack = (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.id = 'livekit-agent-audio';
          el.autoplay = true;
          el.volume = 1.0;
          el.style.display = 'none';
          document.body.appendChild(el);
          audioElementRef.current = el;

          el.play().catch((playErr) => {
            console.warn('Remote audio playback note:', playErr);
          });

          if (track.mediaStream) {
            setupAudioAnalysis(track.mediaStream);
          }

          setStartupStatus(null);
        }
      };

      room.on(RoomEvent.TrackSubscribed, (track) => {
        attachAudioTrack(track);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });

      room.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        if (!segments || !Array.isArray(segments)) return;
        for (const seg of segments) {
          if (seg.text && seg.text.trim()) {
            const isAgent =
              participant?.isAgent ||
              participant?.identity?.toLowerCase().includes('agent') ||
              participant?.identity?.toLowerCase().includes('mia');
            const speaker = isAgent ? 'MIA' : 'Patient';
            appendTranscript(speaker, seg.text.trim(), isAgent ? 'agent' : 'user', seg.final, seg.id);
            setStartupStatus(null);
          }
        }
      });

      try {
        room.registerTextStreamHandler('lk.transcription', async (reader, { identity }) => {
          const isAgent =
            identity?.toLowerCase().includes('agent') ||
            identity?.toLowerCase().includes('mia') ||
            identity?.toLowerCase().includes('receptionist');
          const speaker = isAgent ? 'MIA' : 'Patient';
          const segmentId = reader.info?.attributes?.['lk.transcription_segment_id'] || `stream-${Date.now()}`;

          let accumulated = '';
          for await (const chunk of reader) {
            accumulated += chunk;
            if (accumulated.trim()) {
              appendTranscript(speaker, accumulated.trim(), isAgent ? 'agent' : 'user', false, segmentId);
              setStartupStatus(null);
            }
          }
          if (accumulated.trim()) {
            appendTranscript(speaker, accumulated.trim(), isAgent ? 'agent' : 'user', true, segmentId);
            setStartupStatus(null);
          }
        });
      } catch (err) {
        console.warn('TextStreamHandler registration note:', err);
      }

      room.on(RoomEvent.ChatMessage, (msg, participant) => {
        if (msg && msg.message) {
          const isAgent =
            participant?.isAgent ||
            participant?.identity?.toLowerCase().includes('agent') ||
            participant?.identity?.toLowerCase().includes('mia');
          const speaker = isAgent ? 'MIA' : 'Patient';
          appendTranscript(speaker, msg.message, isAgent ? 'agent' : 'user', true, msg.id);
          setStartupStatus(null);
        }
      });

      room.on(RoomEvent.DataReceived, (payload, participant) => {
        if (participant?.isLocal) return;
        try {
          const str = new TextDecoder().decode(payload);
          const data = JSON.parse(str);

          if (data && data.type === 'tool_call') {
            if (data.status === 'running') {
              setActiveToolCall({
                tool: data.tool,
                message: data.message,
                status: 'running',
                timestamp: Date.now(),
              });
              setAgentState('thinking');
            } else if (data.status === 'completed' || data.status === 'done') {
              setActiveToolCall((prev) => ({
                tool: prev?.tool || data.tool,
                message: data.message || 'Action completed',
                status: 'completed',
                timestamp: Date.now(),
              }));
              setTimeout(() => {
                setActiveToolCall((prev) => (prev?.status === 'completed' ? null : prev));
              }, 2000);
            }
            return;
          }

          if (data && data.type === 'agent_status') {
            if (data.status === 'ready') {
              setStartupStatus(null);
            } else {
              setStartupStatus({
                status: data.status,
                message: data.message,
              });
            }
            return;
          }

          if (data && data.type === 'agent_state') {
            if (data.state) {
              setAgentState(data.state);
              if (data.state === 'speaking') {
                setStartupStatus(null);
              }
            }
            return;
          }

          if (data && (data.text || data.transcript)) {
            const text = (data.text || data.transcript).trim();
            const rawSpeaker = data.speaker || participant?.identity || 'MIA';
            appendTranscript(rawSpeaker, text, 'chat', data.final !== false, data.id);
            setStartupStatus(null);
          }
        } catch {
          try {
            const text = new TextDecoder().decode(payload).trim();
            if (text) {
              appendTranscript(participant?.identity || 'MIA', text, 'chat');
              setStartupStatus(null);
            }
          } catch (e) {
            console.warn('Data decode note:', e);
          }
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setConnectionState('disconnected');
        setAgentState('idle');
        setStartupStatus(null);
        setActiveToolCall(null);
      });

      await room.connect(tokenRes.url, tokenRes.token, { autoSubscribe: true });

      // Mark connected immediately once WebRTC joins instead of blocking on mic publish
      setConnectionState('connected');
      setAgentState('listening');
      setStartupStatus({
        status: 'waiting_agent',
        message: 'Connected. Mia is joining...',
      });

      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.track) attachAudioTrack(pub.track);
        });
      });

      // Publish pre-captured mic track without blocking UI transition
      if (preCapturedTrack) {
        room.localParticipant
          .publishTrack(preCapturedTrack, { source: Track.Source.Microphone })
          .then(() => {
            startLocalMicMonitor(preCapturedTrack.mediaStreamTrack);
          })
          .catch((pubErr) => {
            console.warn('Pre-captured mic publish note:', pubErr);
          });
      } else {
        room.localParticipant
          .enableCameraAndMicrophone(false, true)
          .then(() => {
            const localTrackPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
            startLocalMicMonitor(localTrackPub?.track?.mediaStreamTrack);
          })
          .catch((micErr) => {
            console.warn('Microphone permission note:', micErr);
          });
      }
    } catch (err) {
      if (preCapturedTrack) {
        preCapturedTrack.stop();
      }
      console.warn('LiveKit live connection error (falling back to interactive mode):', err.message);
      setError(err.message);
      setStartupStatus(null);

      // Instant interactive demo mode fallback when backend/LiveKit is unavailable
      setConnectionState('connected');
      setAgentState('listening');
      setRoomInfo({
        room: 'receptionist-room',
        identity: 'patient-local',
        url: 'http://localhost:8080 [API DIRECT]',
      });
      appendTranscript('MIA', 'Hello! Thank you for calling ABC Health Care. My name is Mia. How can I assist you with your appointment today?', 'agent');
    }
  }, [connectionState, appendTranscript, setupAudioAnalysis, startLocalMicMonitor]);

  // Disconnect cleanly and pre-warm next Room if livekitUrl is known
  const disconnect = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (micAnimFrameRef.current) {
      cancelAnimationFrame(micAnimFrameRef.current);
      micAnimFrameRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }
    if (localMicStreamRef.current) {
      localMicStreamRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    setConnectionState('disconnected');
    setAgentState('idle');
    setIsAgentSpeaking(false);
    setAgentAudioLevel(0);
    setUserAudioLevel(0);
    setStartupStatus(null);
    setActiveToolCall(null);

    if (livekitUrlRef.current) {
      const nextWarm = new Room(ROOM_OPTIONS);
      preparedRoomRef.current = nextWarm;
      void nextWarm.prepareConnection(livekitUrlRef.current).catch(() => {});
    }
  }, []);

  // Persistent Mute / Unmute
  const toggleMute = useCallback(async () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);

    if (roomRef.current?.localParticipant) {
      try {
        const micPub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (micPub?.track) {
          if (nextMute) {
            await micPub.track.mute();
          } else {
            await micPub.track.unmute();
          }
        } else {
          await roomRef.current.localParticipant.setMicrophoneEnabled(!nextMute);
        }
      } catch (e) {
        console.warn('Mute toggle note:', e);
      }
    }
  }, [isMuted]);

  // Send inquiry
  const sendInquiry = useCallback(async (text) => {
    appendTranscript('Patient', text, 'user', true);
    setAgentState('thinking');

    if (roomRef.current && roomRef.current.state === 'connected') {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ text, speaker: 'Patient', type: 'transcript', final: true }));
        await roomRef.current.localParticipant.publishData(payload, { reliable: true });
      } catch (e) {
        console.warn('Data publish note:', e);
      }
    }

    if (!roomRef.current || roomRef.current.state !== 'connected') {
      setTimeout(() => {
        setIsAgentSpeaking(true);
        setAgentState('speaking');
        setAgentAudioLevel(65);

        let reply = "I would be happy to help with that. Could you please provide your phone number so I can pull up your records?";
        const lower = text.toLowerCase();

        if (lower.includes('dr. rahul') || lower.includes('general')) {
          reply = "Dr. Rahul Nair has slots open tomorrow at 10:00 AM and 11:30 AM in Room 102. Would you like me to book the 10:00 AM slot for you?";
        } else if (lower.includes('dr. priya') || lower.includes('skin') || lower.includes('dermatol')) {
          reply = "Dr. Priya Menon is available on Thursday at 2:00 PM in Room 205. Shall I reserve that consultation?";
        } else if (lower.includes('dr. anil') || lower.includes('heart') || lower.includes('cardiol')) {
          reply = "Dr. Anil Kumar has openings this Friday starting at 9:30 AM. What time works best for your schedule?";
        } else if (lower.includes('emergency') || lower.includes('chest pain') || lower.includes('bleeding')) {
          reply = "If you are experiencing a medical emergency, please hang up and call 112, 108, or 911 immediately, or go to the nearest emergency room.";
        }

        appendTranscript('MIA', reply, 'agent', true);

        if ('speechSynthesis' in window && !audioElementRef.current?.srcObject) {
          try {
            const utter = new SpeechSynthesisUtterance(reply);
            utter.rate = 1.0;
            utter.pitch = 1.05;
            utter.onend = () => {
              setIsAgentSpeaking(false);
              setAgentState('listening');
              setAgentAudioLevel(0);
            };
            window.speechSynthesis.speak(utter);
          } catch {
            setTimeout(() => {
              setIsAgentSpeaking(false);
              setAgentState('listening');
              setAgentAudioLevel(0);
            }, 3500);
          }
        } else {
          setTimeout(() => {
            setIsAgentSpeaking(false);
            setAgentState('listening');
            setAgentAudioLevel(0);
          }, 3500);
        }
      }, 220);
    }
  }, [appendTranscript]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (micAnimFrameRef.current) cancelAnimationFrame(micAnimFrameRef.current);
      if (roomRef.current) roomRef.current.disconnect();
    };
  }, []);

  return {
    connectionState,
    isMuted,
    isAgentSpeaking,
    agentAudioLevel,
    userAudioLevel,
    agentState,
    transcripts,
    roomInfo,
    error,
    startupStatus,
    activeToolCall,
    connect,
    disconnect,
    toggleMute,
    sendInquiry,
    clearTranscripts: () => setTranscripts([]),
  };
}
