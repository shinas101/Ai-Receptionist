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

  const roomRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const audioElementRef = useRef(null);
  const localMicStreamRef = useRef(null);
  const speechRecognitionRef = useRef(null);

  // Append or update a clean transcript entry with in-place streaming and de-duplication
  const appendTranscript = useCallback((rawSpeaker, text, type = 'chat', isFinal = true, id = null) => {
    if (!text || !text.trim()) return;
    const cleanText = text.trim();
    const lower = (rawSpeaker || '').toLowerCase();
    const isAgent = lower.includes('mia') || lower.includes('agent') || lower.includes('receptionist') || lower.includes('assistant');
    const speaker = isAgent ? 'MIA' : 'Patient';
    const msgType = isAgent ? 'agent' : 'user';

    setTranscripts((prev) => {
      // If updating an existing streaming/partial message
      if (id) {
        const existingIdx = prev.findIndex((m) => m.id === id);
        if (existingIdx !== -1) {
          const updated = [...prev];
          updated[existingIdx] = {
            ...updated[existingIdx],
            text: cleanText,
            final: isFinal,
          };
          return updated;
        }
      }

      // Avoid consecutive duplicate messages from the same speaker
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && last.text.toLowerCase() === cleanText.toLowerCase()) {
        return prev;
      }

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

      setRoomInfo({
        room: tokenRes.room,
        identity: tokenRes.identity,
        url: tokenRes.url,
      });

      // Initialize LiveKit Room instance
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
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
            }
          }
          if (accumulated.trim()) {
            appendTranscript(speaker, accumulated.trim(), isAgent ? 'agent' : 'user', true, segmentId);
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
        }
      });

      // 4. Reliable Data Channel Packets (from agent.py broadcast)
      room.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const decoder = new TextDecoder();
          const str = decoder.decode(payload);
          const data = JSON.parse(str);
          if (data && (data.text || data.transcript)) {
            const text = (data.text || data.transcript).trim();
            const rawSpeaker = data.speaker || participant?.identity || 'MIA';
            appendTranscript(rawSpeaker, text, 'chat', data.final !== false, data.id);
          }
        } catch {
          try {
            const text = new TextDecoder().decode(payload).trim();
            if (text) {
              appendTranscript(participant?.identity || 'MIA', text, 'chat');
            }
          } catch (e) {
            console.warn('Data decode note:', e);
          }
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        setConnectionState('disconnected');
        setAgentState('idle');
      });

      // Connect to LiveKit WebRTC
      await room.connect(tokenRes.url, tokenRes.token);

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

      // 5. Browser-side Real-time Speech Recognition (instant client-side transcription fallback)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'en-US';

          recognition.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; ++i) {
              const res = e.results[i];
              const transcript = res[0]?.transcript?.trim();
              if (transcript) {
                appendTranscript('Patient', transcript, 'user', res.isFinal, `user-stt-${i}`);
                if (res.isFinal && roomRef.current && roomRef.current.state === 'connected') {
                  try {
                    const dataPayload = new TextEncoder().encode(
                      JSON.stringify({
                        type: 'transcript',
                        speaker: 'Patient',
                        text: transcript,
                        final: true,
                      })
                    );
                    roomRef.current.localParticipant.publishData(dataPayload, { reliable: true });
                  } catch (pubErr) {
                    console.warn('User transcript publish note:', pubErr);
                  }
                }
              }
            }
          };

          recognition.onerror = (err) => {
            if (err.error !== 'no-speech') {
              console.warn('Web Speech API note:', err.error);
            }
          };

          recognition.onend = () => {
            if (roomRef.current && roomRef.current.state === 'connected' && !isMuted) {
              try {
                recognition.start();
              } catch {}
            }
          };

          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (sttErr) {
          console.warn('SpeechRecognition initialization note:', sttErr);
        }
      }

      // Local mic level monitoring
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
  }, [connectionState, appendTranscript, setupAudioAnalysis, isMuted]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {}
      speechRecognitionRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    if (audioElementRef.current) {
      audioElementRef.current.remove();
      audioElementRef.current = null;
    }
    if (localMicStreamRef.current) {
      localMicStreamRef.current.getTracks().forEach((t) => t.stop());
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
  }, []);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    const nextMute = !isMuted;
    if (speechRecognitionRef.current) {
      try {
        if (nextMute) {
          speechRecognitionRef.current.stop();
        } else {
          speechRecognitionRef.current.start();
        }
      } catch {}
    }
    if (roomRef.current && roomRef.current.localParticipant) {
      roomRef.current.localParticipant.setMicrophoneEnabled(!nextMute);
      setIsMuted(nextMute);
    } else {
      setIsMuted((prev) => !prev);
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
    connect,
    disconnect,
    toggleMute,
    sendInquiry,
    clearTranscripts: () => setTranscripts([]),
  };
}
