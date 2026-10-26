import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Trash2,
  Bot,
  User,
  History,
  ChevronUp,
  Loader2,
  CheckCircle2,
  Activity,
} from 'lucide-react';
import { AgentAudioVisualizerAura } from './agents-ui/agent-audio-visualizer-aura';

export default function AgentSidePanel({ livekit }) {
  const [inputText, setInputText] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const logContainerRef = useRef(null);

  const {
    connectionState,
    isMuted,
    isAgentSpeaking,
    agentAudioLevel,
    agentState,
    transcripts,
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

  // Automatically keep inner container scrolled to bottom ONLY when history is expanded, NEVER scroll the browser window
  useEffect(() => {
    if (showHistory && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [transcripts, isAgentSpeaking, showHistory, activeToolCall, startupStatus]);

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    sendInquiry(inputText.trim());
    setInputText('');
  };

  const quickPrompts = [
    { label: 'Book Dr. Rahul', text: 'I want to book an appointment with Dr. Rahul Nair tomorrow morning.' },
    { label: 'Dermatologist Slots', text: 'What slots does Dr. Priya Menon have available for dermatology?' },
    { label: 'Cardiology Visit', text: 'I need to see Dr. Anil Kumar for a cardiology consultation.' },
  ];

  // Auto-hide previous dialogue by default: show only the latest active exchange (Patient prompt + Mia reply)
  // This guarantees zero window scrolling and no container overflow
  const displayTranscripts = showHistory
    ? transcripts
    : transcripts.slice(-2);

  return (
    <div className="flex flex-col h-full bg-[#000000] select-none overflow-hidden">
      {/* Header */}
      <div className="h-13 shrink-0 px-4 sm:px-5 border-b border-[#222222] bg-[#000000] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#141414] border border-[#2a2a2a] flex items-center justify-center text-white font-bold text-xs shadow-inner">
            M
          </div>
          <div>
            <h3 className="font-bold text-sm text-white tracking-tight leading-none">Mia</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 font-medium">AI Clinical Receptionist</p>
          </div>
        </div>

        <div>
          <span
            className={`text-[11px] font-medium px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all duration-200 ${
              activeToolCall?.status === 'running'
                ? 'bg-purple-950/50 border-purple-600/50 text-purple-200 shadow-sm'
                : isConnecting || (startupStatus && startupStatus.status !== 'ready')
                ? 'bg-amber-950/40 border-amber-600/40 text-amber-300'
                : isConnected
                ? isAgentSpeaking
                  ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
                  : agentState === 'thinking'
                  ? 'bg-purple-950/40 border-purple-600/40 text-purple-300'
                  : 'bg-[#111111] border-[#262626] text-zinc-300'
                : 'bg-[#111111] border-[#262626] text-zinc-400'
            }`}
          >
            {activeToolCall?.status === 'running' ? (
              <>
                <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
                <span>Mia Working...</span>
              </>
            ) : isConnecting || (startupStatus && startupStatus.status !== 'ready') ? (
              <>
                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : isConnected ? (
              <>
                <span
                  className={`w-2 h-2 rounded-full ${
                    isAgentSpeaking
                      ? 'bg-emerald-400 animate-pulse'
                      : agentState === 'thinking'
                      ? 'bg-purple-400 animate-pulse'
                      : 'bg-emerald-500'
                  }`}
                />
                <span>
                  {isAgentSpeaking ? 'Speaking' : agentState === 'thinking' ? 'Thinking' : 'Listening'}
                </span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                <span>Ready</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Compact Visualizer & Call Button Card */}
      <div className="p-3.5 sm:p-4 border-b border-[#222222] bg-[#050505] flex flex-col items-center gap-3 shrink-0">
        {/* LiveKit Agent Audio Visualizer Aura (Unicorn Studio WebGL Shader) */}
        <div className="flex items-center justify-center relative w-full aspect-square max-w-[105px] max-h-[105px] sm:max-w-[140px] sm:max-h-[140px]">
          <AgentAudioVisualizerAura
            size="md"
            color="#C04CFA"
            colorShift={0.12}
            state={activeToolCall?.status === 'running' ? 'thinking' : agentState}
            volume={agentAudioLevel / 100}
            className="mx-auto"
          />
        </div>

        {/* Primary White Button (matches reference screenshot) */}
        <div className="w-full flex items-center gap-2">
          {!isConnected ? (
            <button
              onClick={() => connect()}
              disabled={isConnecting}
              className="btn-white w-full py-2.5 text-xs sm:text-sm font-semibold tracking-wide flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                  <span>Connecting Consultation...</span>
                </>
              ) : (
                'Start Consultation →'
              )}
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`btn-dark flex-1 py-2 text-xs font-semibold ${
                  isMuted ? 'border-red-500/40 text-red-400' : ''
                }`}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>

              <button
                onClick={disconnect}
                className="btn-dark flex-1 py-2 text-xs font-semibold border-red-900/40 hover:border-red-500 text-red-400"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                End Call
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="px-3.5 py-1.5 border-b border-[#222222] bg-[#000000] flex items-center gap-1.5 overflow-x-auto shrink-0">
        {quickPrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => {
              if (!isConnected) connect();
              setTimeout(() => sendInquiry(p.text), isConnected ? 100 : 1200);
            }}
            className="text-[11px] px-2.5 py-1 rounded-md bg-[#0e0e10] hover:bg-[#1a1a1f] text-zinc-300 hover:text-white border border-[#242428] hover:border-[#38383e] transition-colors shrink-0 font-medium shadow-sm"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Live Conversation Transcript with Zero-Scroll Latest View & History Toggle */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#000000] relative overflow-hidden">
        <div className="px-4 py-2 border-b border-[#1c1c1c] flex items-center justify-between text-xs text-zinc-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-300">Live Dialogue</span>
            {!showHistory ? (
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-950/40 border border-purple-800/40 text-purple-300 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Live Active
              </span>
            ) : (
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
                All Turns
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {transcripts.length > 2 && (
              <button
                onClick={() => setShowHistory((prev) => !prev)}
                className="text-xs px-2.5 py-1 rounded bg-[#111111] hover:bg-[#1c1c1c] text-zinc-300 hover:text-white border border-[#282828] transition-colors flex items-center gap-1.5"
                title={showHistory ? 'Switch to auto-hide zero scroll' : 'View full dialogue history'}
              >
                {showHistory ? (
                  <>
                    <ChevronUp className="w-3 h-3 text-purple-400" />
                    <span>Hide Past</span>
                  </>
                ) : (
                  <>
                    <History className="w-3 h-3 text-purple-400" />
                    <span>History ({transcripts.length})</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={clearTranscripts}
              title="Clear Chat"
              className="text-zinc-500 hover:text-white transition-colors p-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dialogue viewport: Zero-scroll fits latest exchange without window scrolling */}
        <div
          ref={logContainerRef}
          className={`flex-1 p-3 select-text ${
            showHistory
              ? 'overflow-y-auto space-y-2'
              : 'overflow-hidden flex flex-col justify-end space-y-2'
          }`}
        >
          {displayTranscripts.map((item) => {
            const isMia =
              item.speaker?.toUpperCase() === 'MIA' ||
              item.speaker?.toLowerCase().includes('agent') ||
              item.speaker?.toLowerCase().includes('receptionist') ||
              item.type === 'agent';
            const isStreaming = item.final === false || (isMia && isAgentSpeaking);

            return (
              <div
                key={item.id}
                className={`p-2.5 sm:p-3 rounded-lg border text-xs sm:text-sm transition-all duration-150 ${
                  isMia
                    ? 'bg-[#0a0a0a] border-[#262626] text-white shadow-sm'
                    : 'bg-[#121212] border-[#2e2e2e] text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold flex items-center gap-1.5 ${isMia ? 'text-purple-400' : 'text-zinc-300'}`}>
                      {isMia ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      {isMia ? 'Mia' : 'You'}
                    </span>
                    {isStreaming && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40 flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        Streaming
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-500 text-[10px] font-mono">{item.time}</span>
                </div>
                <div className="text-zinc-100 break-words leading-relaxed">
                  {item.text}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-3 ml-1 bg-purple-400 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            );
          })}

          {/* Startup Loading Status Card */}
          {Boolean(isConnecting || (startupStatus && startupStatus.status !== 'ready')) && (
            <div className="p-3 rounded-lg border border-purple-800/40 bg-gradient-to-r from-purple-950/40 via-[#0e0e16] to-[#08080c] text-xs text-white shadow-lg">
              <div className="flex items-center gap-2 mb-1.5">
                <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0" />
                <span className="font-semibold text-purple-200 text-xs tracking-tight">
                  Consultation Setup
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-purple-900/60 text-purple-300 border border-purple-700/50 ml-auto">
                  LiveKit Audio
                </span>
              </div>
              <p className="text-zinc-300 text-xs pl-5.5 leading-relaxed">
                {startupStatus?.message || 'Connecting to clinical WebRTC audio channel...'}
              </p>
              <div className="mt-2 pl-5.5 flex items-center gap-2">
                <div className="h-1 flex-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full animate-pulse w-3/4" />
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">Initializing</span>
              </div>
            </div>
          )}

          {/* Tool Calling Active / Completed Card */}
          {Boolean(activeToolCall) && (
            <div
              className={`p-3 rounded-lg border text-xs shadow-md transition-all duration-200 ${
                activeToolCall.status === 'running'
                  ? 'border-purple-600/50 bg-[#0e0c18] text-white shadow-purple-950/30'
                  : 'border-emerald-600/40 bg-[#0c140e] text-emerald-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {activeToolCall.status === 'running' ? (
                    <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span
                    className={`font-semibold text-xs ${
                      activeToolCall.status === 'running' ? 'text-purple-300' : 'text-emerald-300'
                    }`}
                  >
                    {activeToolCall.status === 'running'
                      ? 'Mia Querying Clinic Records'
                      : 'Clinic Action Complete'}
                  </span>
                </div>
                <span
                  className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                    activeToolCall.status === 'running'
                      ? 'bg-purple-950/60 text-purple-300 border-purple-800/40 animate-pulse'
                      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40'
                  }`}
                >
                  {activeToolCall.status === 'running' ? 'Active' : 'Done'}
                </span>
              </div>
              <p className="text-zinc-200 text-xs pl-5.5 leading-relaxed">
                {activeToolCall.message}
              </p>
            </div>
          )}

          {/* Thinking status fallback if no tool calling card is visible */}
          {agentState === 'thinking' && !activeToolCall && !isConnecting && (
            <div className="text-purple-300 text-xs flex items-center gap-2 font-medium py-1.5 px-3 rounded-lg bg-purple-950/30 border border-purple-900/40 animate-pulse">
              <Loader2 className="w-3 h-3 text-purple-400 animate-spin shrink-0" />
              <span>Mia is processing your clinical request...</span>
            </div>
          )}

          {isAgentSpeaking && !displayTranscripts.some((t) => (t.speaker?.toUpperCase() === 'MIA' || t.type === 'agent') && !t.final) && (
            <div className="text-purple-400 text-xs flex items-center gap-2 font-medium py-0.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>Mia is speaking...</span>
            </div>
          )}
        </div>

        {/* Input Message Form */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-[#222222] bg-[#050505] p-2.5 sm:p-3 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message or speak..."
            className="v-input flex-1 text-xs sm:text-sm py-2 px-3 bg-[#0a0a0a] border-[#262626] rounded-md outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="btn-white p-2 sm:p-2.5 rounded-md disabled:opacity-30 shrink-0"
          >
            <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
