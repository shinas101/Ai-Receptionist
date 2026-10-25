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
  }, [transcripts, isAgentSpeaking, showHistory]);

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
    <div className="flex flex-col h-full bg-[#000000] border-l border-[#222222] select-none">
      {/* Header */}
      <div className="px-6 py-4.5 border-b border-[#222222] bg-[#000000] flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-9 h-9 rounded-lg bg-[#141414] border border-[#2a2a2a] flex items-center justify-center text-white font-bold text-sm shadow-inner">
            M
          </div>
          <div>
            <h3 className="font-bold text-base text-white tracking-tight leading-none">Mia</h3>
            <p className="text-xs text-zinc-400 mt-1 font-medium">AI Clinical Receptionist</p>
          </div>
        </div>

        <div>
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-[#111111] border border-[#262626] text-zinc-300 flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected
                  ? 'bg-emerald-500 animate-pulse'
                  : isConnecting
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-zinc-600'
              }`}
            />
            {isConnected ? (isAgentSpeaking ? 'Speaking' : 'Listening') : isConnecting ? 'Connecting' : 'Ready'}
          </span>
        </div>
      </div>

      {/* Visualizer & Call Button Card */}
      <div className="p-6 sm:p-7 border-b border-[#222222] bg-[#050505] flex flex-col items-center gap-5">
        {/* LiveKit Agent Audio Visualizer Aura (Unicorn Studio WebGL Shader) */}
        <div className="py-1 flex items-center justify-center relative w-full aspect-square max-w-[240px] max-h-[240px]">
          <AgentAudioVisualizerAura
            size="lg"
            color="#C04CFA"
            colorShift={0.12}
            state={agentState}
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
              className="btn-white w-full py-3 text-sm font-semibold tracking-wide"
            >
              {isConnecting ? 'Connecting...' : 'Start Consultation →'}
            </button>
          ) : (
            <>
              <button
                onClick={toggleMute}
                className={`btn-dark flex-1 py-2.5 text-xs font-semibold ${
                  isMuted ? 'border-red-500/40 text-red-400' : ''
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>

              <button
                onClick={disconnect}
                className="btn-dark flex-1 py-2.5 text-xs font-semibold border-red-900/40 hover:border-red-500 text-red-400"
              >
                <PhoneOff className="w-4 h-4" />
                End Call
              </button>
            </>
          )}
        </div>
      </div>

      {/* Quick Prompts */}
      <div className="px-5 py-2.5 border-b border-[#222222] bg-[#000000] flex items-center gap-2 overflow-x-auto">
        <span className="text-xs text-zinc-500 shrink-0 font-medium">Quick:</span>
        {quickPrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => {
              if (!isConnected) connect();
              setTimeout(() => sendInquiry(p.text), isConnected ? 100 : 1200);
            }}
            className="text-xs px-3 py-1 rounded bg-[#0e0e0e] hover:bg-[#1a1a1a] text-zinc-300 hover:text-white border border-[#222222] transition-colors shrink-0 font-medium"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Live Conversation Transcript with Zero-Scroll Latest View & History Toggle */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#000000] relative">
        <div className="px-5 py-2.5 border-b border-[#1c1c1c] flex items-center justify-between text-xs text-zinc-400">
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
          className={`flex-1 p-4 select-text ${
            showHistory
              ? 'overflow-y-auto space-y-3'
              : 'overflow-hidden flex flex-col justify-end space-y-3'
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
                className={`p-3.5 rounded-lg border text-sm transition-all duration-150 ${
                  isMia
                    ? 'bg-[#0a0a0a] border-[#262626] text-white shadow-sm'
                    : 'bg-[#121212] border-[#2e2e2e] text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold flex items-center gap-1.5 ${isMia ? 'text-purple-400' : 'text-zinc-300'}`}>
                      {isMia ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                      {isMia ? 'Mia' : 'You'}
                    </span>
                    {isStreaming && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40 flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        Streaming
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-500 text-xs font-mono">{item.time}</span>
                </div>
                <div className="text-zinc-100 break-words leading-relaxed text-sm">
                  {item.text}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-3.5 ml-1 bg-purple-400 animate-pulse align-middle" />
                  )}
                </div>
              </div>
            );
          })}

          {isAgentSpeaking && !displayTranscripts.some((t) => (t.speaker?.toUpperCase() === 'MIA' || t.type === 'agent') && !t.final) && (
            <div className="text-purple-400 text-xs flex items-center gap-2 font-medium py-1 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>Mia is speaking...</span>
            </div>
          )}
        </div>

        {/* Input Message Form */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-[#222222] bg-[#050505] p-4 flex items-center gap-2"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message or speak..."
            className="v-input flex-1 text-sm bg-[#0a0a0a] border-[#262626] rounded-md"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="btn-white p-2.5 rounded-md disabled:opacity-30"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
