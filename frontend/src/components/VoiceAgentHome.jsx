import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Trash2,
  Bot,
  User,
  Calendar,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { AgentAudioVisualizerAura } from './agents-ui/agent-audio-visualizer-aura';

const QUICK_PROMPTS = [
  { label: 'Book Dr. Rahul', text: 'I want to book an appointment with Dr. Rahul Nair tomorrow morning.' },
  { label: 'Dermatology slots', text: 'What slots does Dr. Priya Menon have available for dermatology?' },
  { label: 'Cardiology visit', text: 'I need to see Dr. Anil Kumar for a cardiology consultation.' },
];

export default function VoiceAgentHome({ livekit, stats, onOpenCalendar, externalPrompt, onConsumeExternalPrompt }) {
  const [inputText, setInputText] = useState('');
  const pendingPromptRef = useRef(null);
  const feedRef = useRef(null);

  const {
    connectionState,
    isMuted,
    isAgentSpeaking,
    agentAudioLevel,
    userAudioLevel,
    agentState,
    transcripts,
    roomInfo,
    startupStatus,
    activeToolCall,
    connect,
    disconnect,
    toggleMute,
    sendInquiry,
    clearTranscripts,
  } = livekit;

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  // Handle external prompts triggered from other views (e.g. Specialists -> Ask Mia)
  useEffect(() => {
    if (!externalPrompt) return;
    onConsumeExternalPrompt?.();
    if (isConnected) {
      sendInquiry(externalPrompt);
    } else {
      pendingPromptRef.current = externalPrompt;
      if (!isConnecting) connect();
    }
  }, [externalPrompt, isConnected, isConnecting, connect, sendInquiry, onConsumeExternalPrompt]);

  // Send queued quick prompt cleanly once connected
  useEffect(() => {
    if (isConnected && pendingPromptRef.current) {
      const promptToSend = pendingPromptRef.current;
      pendingPromptRef.current = null;
      sendInquiry(promptToSend);
    }
  }, [isConnected, sendInquiry]);

  // Smooth auto-scroll within transcript feed
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [transcripts, activeToolCall, startupStatus, isAgentSpeaking]);

  const handleSendMessage = (e) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setInputText('');
    if (!isConnected) {
      pendingPromptRef.current = trimmed;
      if (!isConnecting) connect();
      return;
    }
    sendInquiry(trimmed);
  };

  const handleQuickPrompt = (promptText) => {
    if (isConnected) {
      sendInquiry(promptText);
    } else {
      pendingPromptRef.current = promptText;
      if (!isConnecting) connect();
    }
  };

  // Vercel-aligned state colors for the Aura visualizer
  const visualState = activeToolCall?.status === 'running' ? 'thinking' : agentState;
  const auraColor =
    visualState === 'speaking'
      ? '#60A5FA'
      : visualState === 'listening'
      ? '#34D399'
      : visualState === 'thinking' || visualState === 'connecting'
      ? '#A1A1AA'
      : '#E4E4E7';

  const statusMeta = (() => {
    if (activeToolCall?.status === 'running') {
      return { label: 'Checking clinic schedule', tone: 'text-zinc-200 border-[#333333] bg-[#141414]', spin: true };
    }
    if (isConnecting || (startupStatus && startupStatus.status !== 'ready')) {
      return { label: 'Connecting audio', tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10', spin: true };
    }
    if (isConnected) {
      if (isAgentSpeaking) {
        return { label: 'Mia speaking', tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10', dot: 'bg-sky-400 animate-pulse' };
      }
      if (agentState === 'thinking') {
        return { label: 'Thinking', tone: 'text-zinc-200 border-[#333333] bg-[#141414]', spin: true };
      }
      return { label: 'Listening', tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10', dot: 'bg-emerald-400 animate-pulse' };
    }
    return { label: 'Ready', tone: 'text-zinc-400 border-[#262626] bg-[#111111]', dot: 'bg-zinc-500' };
  })();

  const isDirectFallback = roomInfo?.url?.includes('API DIRECT');

  return (
    <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col gap-3 sm:gap-4 min-h-0">
      {/* Top Voice Agent Stage */}
      <section className="v-card vercel-grid-bg relative overflow-hidden p-4 sm:p-5 shrink-0">
        {/* Top Row: Status & Quick Calendar Link */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] border text-[11px] font-medium whitespace-nowrap transition-colors ${statusMeta.tone}`}
            >
              {statusMeta.spin ? (
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusMeta.dot}`} />
              )}
              <span>{statusMeta.label}</span>
            </span>

            {isConnected && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] bg-[#111111] border border-[#222222] text-[11px] font-mono text-zinc-400 whitespace-nowrap">
                <Radio className="w-3 h-3 text-emerald-400" />
                <span>{isDirectFallback ? 'Interactive Mode' : 'WebRTC Audio'}</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenCalendar}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#111111] hover:bg-[#171717] border border-[#262626] hover:border-[#383838] text-[11px] font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span>Today: {stats?.today ?? 0}</span>
            <ArrowRight className="w-3 h-3 text-zinc-500 shrink-0" />
          </button>
        </div>

        {/* Center Voice Stage */}
        <div className="mt-2.5 sm:mt-3 flex flex-col items-center text-center gap-2.5 sm:gap-3.5">
          <motion.div
            animate={{ scale: isAgentSpeaking ? 1.04 : 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center w-[104px] h-[104px] sm:w-[128px] sm:h-[128px] rounded-full bg-black/50 border border-[#1f1f1f]"
          >
            <AgentAudioVisualizerAura
              size="md"
              color={auraColor}
              colorShift={0.08}
              state={visualState}
              volume={agentAudioLevel / 100}
              className="mx-auto"
            />
          </motion.div>

          <div className="space-y-1 max-w-md px-2">
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
              Mia, AI Clinical Receptionist
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Speak naturally or type below to book appointments, check doctor availability, or manage your visit.
            </p>
          </div>

          {/* Primary Voice Controls */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {!isConnected ? (
              <button
                type="button"
                onClick={() => connect()}
                disabled={isConnecting}
                className="btn-white h-9 sm:h-10 px-4 sm:px-5 text-xs sm:text-sm font-medium"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black shrink-0" />
                    <span>Starting Consultation...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 shrink-0" />
                    <span>Start Voice Consultation</span>
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`btn-dark h-9 px-3.5 text-xs font-medium ${
                    isMuted ? 'border-red-500/40 bg-red-500/10 text-red-300' : ''
                  }`}
                >
                  {isMuted ? (
                    <MicOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  ) : (
                    <Mic className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span>{isMuted ? 'Unmute' : 'Mute Mic'}</span>
                  {!isMuted && userAudioLevel > 5 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={disconnect}
                  className="btn-dark h-9 px-3.5 text-xs font-medium border-red-500/35 bg-red-500/10 text-red-300 hover:bg-red-500/20 hover:border-red-500/50"
                >
                  <PhoneOff className="w-3.5 h-3.5 shrink-0" />
                  <span>End Call</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Transcript & Input Card */}
      <section className="v-card flex-1 flex flex-col min-h-[240px] lg:min-h-[200px] overflow-hidden">
        {/* Card Header */}
        <div className="px-3.5 sm:px-4 py-2.5 border-b border-[#1c1c1c] bg-[#0a0a0a] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-200">Conversation</span>
            <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-[4px] bg-[#141414] border border-[#262626] text-zinc-400 tabular-nums">
              {transcripts.length}
            </span>
          </div>

          {transcripts.length > 0 && (
            <button
              type="button"
              onClick={clearTranscripts}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-[11px] text-zinc-400 hover:text-white hover:bg-[#141414] transition-colors cursor-pointer whitespace-nowrap"
              title="Clear conversation"
            >
              <Trash2 className="w-3 h-3 shrink-0" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Quick Prompts Row */}
        <div className="px-3.5 sm:px-4 py-2 border-b border-[#181818] bg-[#050505] flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="hidden sm:inline text-[11px] text-zinc-500 mr-1 whitespace-nowrap shrink-0">
            Try asking:
          </span>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleQuickPrompt(p.text)}
              className="px-2.5 py-1 rounded-[6px] bg-[#111111] hover:bg-[#1a1a1a] border border-[#242424] hover:border-[#383838] text-[11px] text-zinc-300 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Scrollable Dialogue Feed */}
        <div
          ref={feedRef}
          className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-2.5 select-text"
        >
          <AnimatePresence initial={false}>
            {transcripts.length === 0 && !isConnecting && !activeToolCall && (
              <motion.div
                key="empty-chat"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[120px] flex flex-col items-center justify-center text-center text-zinc-500 text-xs px-4"
              >
                <p>No messages yet. Click Start Voice Consultation or pick a prompt above.</p>
              </motion.div>
            )}

            {transcripts.map((item) => {
              const isMia =
                item.speaker?.toUpperCase() === 'MIA' ||
                item.speaker?.toLowerCase().includes('agent') ||
                item.speaker?.toLowerCase().includes('receptionist') ||
                item.type === 'agent';
              const isStreaming = item.final === false;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex ${isMia ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[82%] p-3 rounded-[8px] border text-xs sm:text-[13px] leading-relaxed ${
                      isMia
                        ? 'bg-[#111111] border-[#242424] text-zinc-100'
                        : 'bg-[#18181b] border-[#303036] text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                        {isMia ? (
                          <Bot className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-zinc-300 shrink-0" />
                        )}
                        <span className="text-zinc-200">{isMia ? 'Mia' : 'You'}</span>
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                        {item.time}
                      </span>
                    </div>
                    <p className="break-words text-zinc-200">
                      {item.text}
                      {isStreaming && (
                        <span className="inline-block w-1.5 h-3.5 ml-1 bg-zinc-300 animate-pulse align-middle rounded-[1px]" />
                      )}
                    </p>
                  </div>
                </motion.div>
              );
            })}

            {Boolean(isConnecting || (startupStatus && startupStatus.status !== 'ready')) && (
              <motion.div
                key="startup-card"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-[8px] border border-[#262626] bg-[#111111] text-xs"
              >
                <div className="flex items-center gap-2 text-zinc-200 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                  <span>{startupStatus?.message || 'Establishing clinical audio channel...'}</span>
                </div>
              </motion.div>
            )}

            {Boolean(activeToolCall) && (
              <motion.div
                key="tool-card"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`p-3 rounded-[8px] border text-xs ${
                  activeToolCall.status === 'running'
                    ? 'border-[#333333] bg-[#111111] text-zinc-200'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {activeToolCall.status === 'running' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-300 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span>{activeToolCall.message}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSendMessage}
          className="p-2.5 sm:p-3 border-t border-[#1c1c1c] bg-[#050505] flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message Mia (e.g. Check tomorrow's slots)..."
            aria-label="Message Mia"
            className="v-input flex-1 text-xs sm:text-sm"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="btn-white h-9 px-3.5 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </section>
    </div>
  );
}
