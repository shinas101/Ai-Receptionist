import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Trash2,
  Bot,
  User,
} from 'lucide-react';
import { AgentAudioVisualizerGrid } from './agents-ui/agent-audio-visualizer-grid';

export default function AgentSidePanel({ livekit }) {
  const [inputText, setInputText] = useState('');
  const logContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

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

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, isAgentSpeaking]);

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

  return (
    <div className="flex flex-col h-full bg-[#000000] border-l border-[#222222] select-none">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#222222] bg-[#000000] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#141414] border border-[#2a2a2a] flex items-center justify-center text-white font-bold text-sm">
            M
          </div>
          <div>
            <h3 className="font-bold text-base text-white tracking-tight">Mia</h3>
            <p className="text-xs text-zinc-400">AI Receptionist</p>
          </div>
        </div>

        <div>
          <span className="text-xs font-medium px-2.5 py-1 rounded bg-[#111111] border border-[#262626] text-zinc-300 flex items-center gap-2">
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
      <div className="p-6 border-b border-[#222222] bg-[#050505] flex flex-col items-center gap-4">
        {/* Purple Audio Visualizer Grid */}
        <div className="py-2">
          <AgentAudioVisualizerGrid
            size="xl"
            color="#C04CFA"
            rowCount={15}
            columnCount={15}
            radius={60}
            state={agentState}
            audioLevel={agentAudioLevel}
            className="mx-auto aspect-square size-auto h-full gap-0 p-2 *:size-2"
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

      {/* Live Conversation Transcript with Smooth Auto-Scroll */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#000000] relative">
        <div className="px-5 py-2.5 border-b border-[#1c1c1c] flex items-center justify-between text-xs text-zinc-400">
          <span className="font-semibold text-zinc-300">Live Dialogue</span>
          <button
            onClick={clearTranscripts}
            title="Clear Chat"
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scrollable conversation messages with bigger, readable text */}
        <div
          ref={logContainerRef}
          className="flex-1 p-5 overflow-y-auto space-y-3.5 text-sm leading-relaxed select-text"
        >
          {transcripts.map((item) => {
            const isMia =
              item.speaker?.toUpperCase() === 'MIA' ||
              item.speaker?.toLowerCase().includes('agent') ||
              item.speaker?.toLowerCase().includes('receptionist') ||
              item.type === 'agent';

            return (
              <div
                key={item.id}
                className={`p-3.5 rounded-lg border text-sm ${
                  isMia
                    ? 'bg-[#0a0a0a] border-[#222222] text-white'
                    : 'bg-[#121212] border-[#2a2a2a] text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className={`font-semibold flex items-center gap-1.5 ${isMia ? 'text-purple-400' : 'text-zinc-300'}`}>
                    {isMia ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    {isMia ? 'Mia' : 'You'}
                  </span>
                  <span className="text-zinc-500 text-xs font-mono">{item.time}</span>
                </div>
                <div className="text-zinc-100 break-words leading-relaxed">{item.text}</div>
              </div>
            );
          })}

          {isAgentSpeaking && (
            <div className="text-purple-400 text-sm flex items-center gap-2 font-medium py-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <span>Mia is speaking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
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
