import { useState, useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { api } from '../services/api';

export function useLiveKit() {
  const [connectionState, setConnectionState] = useState('disconnected'); // disconnected, connecting, connected, error
  const [isMuted, setIsMuted] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [agentAudioLevel, setAgentAudioLevel] = useState(0);
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [agentState, setAgentState] = useState('idle'); // idle, connecting, listening, speaking, thinking
  const [transcripts, setTranscripts] = useState([
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
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioElementRef = useRef(null);
  const localMicStreamRef = useRef(null);

  // Helper to normalize strings for robust deduplication (removes punctuation, casing, extra whitespace)
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
      // 1. If explicit ID matches an existing card, update it in place (live streaming!)
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

        // 3a. Exact duplicate match from multiple broadcast channels
        if (normLast === normClean) {
          if (isFinal && !last.final) {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...last,
              final: true,
            };
            return updated;
          }
          return prev; // Ignore exact duplicate
        }

        // 3b. In-place streaming continuation (partial speech chunks or progressive response)
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

      // 4. Check recent messages for duplicate broadcast echoes (within last 4 items)
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

  // Web Audio analyzer for remote agent audio
  const setupAudioAnalysis = useCallback((mediaStream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(mediaStream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 255) * 100));

        setAgentAudioLevel(normalized);
        const speaking = normalized > 6;
        setIsAgentSpeaking(speaking);
        if (speaking) {
          setAgentState('speaking');
        } else if (connectionState === 'connected') {
          setAgentState('listening');
        }

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (e) {
      console.warn('Audio analyzer note:', e);
    }
  }, [connectionState]);

  // Connect to LiveKit Room & Dispatch Agent
  const connect = useCallback(async (userName = 'Patient') => {
    if (connectionState === 'connecting' || connectionState === 'connected') return;

    setConnectionState('connecting');
    setAgentState('connecting');
    setError(null);
    setStartupStatus({
      status: 'token',
      message: 'Authorizing consultation credentials...',
    });

    // Resume or unlock Web Audio on direct user click
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (e) {
      console.warn('AudioContext unlock note:', e);
    }

    try {
      const uniqueRoom = `consultation-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
      const tokenRes = await api.getToken(uniqueRoom, userName);

      if (!tokenRes || !tokenRes.token) {
        throw new Error(tokenRes?.error || 'Failed to obtain LiveKit token');
      }

      setStartupStatus({
        status: 'connecting',
        message: 'Establishing WebRTC clinical audio connection...',
      });

      setRoomInfo({
        room: tokenRes.room,
        identity: tokenRes.identity,
        url: tokenRes.url,
      });

      // Initialize LiveKit Room instance with persistent audio options
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: false,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      roomRef.current = room;

      // Handle remote audio tracks (Mia / AI Agent)
      const attachAudioTrack = (track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.id = 'livekit-agent-audio';
          el.autoplay = true;
          el.volume = 1.0;
          el.style.display = 'none';
          document.body.appendChild(el);
          audioElementRef.current = el;

          // Explicitly play to prevent autoplay blocks
          el.play().catch((playErr) => {
            console.warn('Remote audio playback note:', playErr);
          });

          // Connect to analyser
          if (track.mediaStream) {
            setupAudioAnalysis(track.mediaStream);
          }

          setStartupStatus({
            status: 'agent_connected',
            message: 'Mia connected. Preparing initial greeting...',
          });
          setTimeout(() => {
            setStartupStatus((prev) => (prev?.status === 'agent_connected' ? null : prev));
          }, 2000);
        }
      };

      room.on(RoomEvent.TrackSubscribed, (track) => {
        attachAudioTrack(track);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach();
      });

      // 1. LiveKit Native Transcription Segments (emitted by STT and agent audio)
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

      // 2. Modern LiveKit TextStream transcription (lk.transcription topic)
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

      // 3. Native LiveKit Chat Messages
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

      // 4. Reliable Data Channel Packets (from agent.py & tools broadcast)
      room.on(RoomEvent.DataReceived, (payload, participant) => {
        if (participant?.isLocal) return; // Prevent local loopback echo
        try {
          const decoder = new TextDecoder();
          const str = decoder.decode(payload);
          const data = JSON.parse(str);

          // Tool call execution tracking
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
              }, 2500);
            }
            return;
          }

          // Agent startup status tracking
          if (data && data.type === 'agent_status') {
            setStartupStatus({
              status: data.status,
              message: data.message,
            });
            if (data.status === 'ready') {
              setTimeout(() => {
                setStartupStatus(null);
              }, 1800);
            }
            return;
          }

          // Agent state tracking
          if (data && data.type === 'agent_state') {
            if (data.state) {
              setAgentState(data.state);
              if (data.state === 'speaking') {
                setStartupStatus(null);
              }
            }
            return;
          }

          // Transcripts
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

      // Connect to LiveKit WebRTC
      await room.connect(tokenRes.url, tokenRes.token);

      setStartupStatus({
        status: 'waiting_agent',
        message: 'Connected to clinic room. Waiting for Mia to join...',
      });

      // Check existing participants/tracks
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.track) attachAudioTrack(pub.track);
        });
      });

      // Enable microphone
      try {
        await room.localParticipant.enableCameraAndMicrophone(false, true);
      } catch (micErr) {
        console.warn('Microphone permission note:', micErr);
      }

      setConnectionState('connected');
      setAgentState('listening');

      // 5. Persistent Local Mic Level Monitoring (uses existing LiveKit mic track, NO duplicate getUserMedia)
      try {
        const localTrackPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        const micMediaTrack = localTrackPub?.track?.mediaStreamTrack;
        if (micMediaTrack) {
          const stream = new MediaStream([micMediaTrack]);
          localMicStreamRef.current = stream;
          const micCtx = new (window.AudioContext || window.webkitAudioContext)();
          const micAnalyser = micCtx.createAnalyser();
          micAnalyser.fftSize = 32;
          const micSource = micCtx.createMediaStreamSource(stream);
          micSource.connect(micAnalyser);
          const data = new Uint8Array(micAnalyser.frequencyBinCount);

          const pollMic = () => {
            if (roomRef.current && roomRef.current.state === 'connected') {
              micAnalyser.getByteFrequencyData(data);
              let s = 0;
              for (let i = 0; i < data.length; i++) s += data[i];
              const avg = (s / data.length) / 255;
              setUserAudioLevel(Math.round(avg * 100));
              requestAnimationFrame(pollMic);
            }
          };
          pollMic();
        }
      } catch (err) {
        console.warn('Local mic analysis note:', err);
      }

    } catch (err) {
      console.warn('LiveKit live connection error (falling back to interactive mode):', err.message);
      setError(err.message);

      // Fallback: Enable interactive demo mode so user can test the UI immediately!
      setConnectionState('connected');
      setAgentState('listening');
      setRoomInfo({
        room: 'receptionist-room',
        identity: 'patient-local',
        url: 'http://localhost:8080 [API DIRECT]',
      });
      appendTranscript('MIA', 'Hello! Thank you for calling ABC Health Care. My name is Mia. How can I assist you with your appointment today?', 'agent');
    }
  }, [connectionState, appendTranscript, setupAudioAnalysis]);

  // Disconnect cleanly
  const disconnect = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
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
  }, []);

  // Persistent Mute / Unmute: Keeps the WebRTC audio connection active without hardware restarts or browser beeps
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

    // If connected to room with data channel, publish
    if (roomRef.current && roomRef.current.state === 'connected') {
      try {
        const payload = new TextEncoder().encode(JSON.stringify({ text, speaker: 'Patient', type: 'transcript', final: true }));
        await roomRef.current.localParticipant.publishData(payload, { reliable: true });
      } catch (e) {
        console.warn('Data publish note:', e);
      }
    }

    // Offline fallback response ONLY if NOT connected to live LiveKit agent room
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

        // Speech synthesis fallback so the user actually HEARS audio in offline demo
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
      }, 800);
    }
  }, [appendTranscript]);

  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {}
      }
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
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
