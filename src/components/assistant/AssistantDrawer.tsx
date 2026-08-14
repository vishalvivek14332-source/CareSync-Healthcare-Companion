import React, { useState, useEffect, useRef } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, X, Sparkles, Activity, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const AssistantDrawer: React.FC = () => {
  const {
    assistantOpen,
    setAssistantOpen,
    chatMessages,
    sendChatMessage,
    isAssistantThinking,
    patient,
  } = useCareSync();

  const [inputVal, setInputVal] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Web Speech Recognition setup
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputVal(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser version.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const speakText = (text: string) => {
    if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; // Slightly slower for elderly legibility
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputVal;
    if (!text.trim()) return;

    setInputVal('');
    await sendChatMessage(text);

    // Speak last assistant message if TTS enabled
    setTimeout(() => {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg && lastMsg.sender === 'assistant') {
        speakText(lastMsg.text);
      }
    }, 400);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAssistantThinking]);

  if (!assistantOpen) {
    return (
      <button
        onClick={() => setAssistantOpen(true)}
        className="fixed bottom-20 md:bottom-8 right-6 z-40 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white p-3.5 rounded-full shadow-2xl shadow-teal-600/40 flex items-center gap-2 font-bold text-sm border-2 border-white transition-all transform hover:scale-105"
        aria-label="Open CareSync Assistant"
      >
        <div className="relative">
          <Bot className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
        </div>
        <span className="hidden sm:inline">Ask CareSync</span>
      </button>
    );
  }

  const quickPills = [
    'What do I need to do now?',
    'Log medicine',
    'Log water (+250ml)',
    'Start a walk',
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setAssistantOpen(false)}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
        />

        {/* Panel */}
        <div className="fixed inset-y-0 right-0 max-w-lg w-full flex pl-6 sm:pl-10">
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="w-full bg-white shadow-2xl flex flex-col border-l border-slate-200"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-teal-700 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Bot className="w-6 h-6 text-teal-200" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg leading-tight">CareSync Assistant</h3>
                  <div className="flex items-center gap-1.5 text-xs text-teal-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Voice & Text Care Assistant</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTtsEnabled(!ttsEnabled)}
                  className="p-2 rounded-xl hover:bg-white/10 text-teal-100 transition-colors"
                  title={ttsEnabled ? 'Mute voice responses' : 'Enable voice responses'}
                >
                  {ttsEnabled ? <Volume2 className="w-5 h-5 text-emerald-300" /> : <VolumeX className="w-5 h-5 text-slate-300" />}
                </button>

                <button
                  onClick={() => setAssistantOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/10 text-teal-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] font-semibold text-slate-400 px-1">
                    <span>{msg.sender === 'user' ? patient.name : 'CareSync Assistant'}</span>
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div
                    className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-teal-600 text-white rounded-br-none font-medium'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {isAssistantThinking && (
                <div className="flex items-center gap-2 p-3 bg-white rounded-2xl border border-slate-200 text-xs text-slate-500 w-fit">
                  <Sparkles className="w-4 h-4 text-teal-600 animate-spin" />
                  <span>CareSync Assistant is thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Voice Listening Bar Indicator */}
            {isListening && (
              <div className="bg-teal-50 border-t border-teal-200 p-3 flex items-center justify-between px-4 text-xs font-semibold text-teal-800">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <span>Listening to your voice... Speak clearly.</span>
                </div>
                <div className="flex gap-1 items-center">
                  <span className="w-1 h-3 bg-teal-600 animate-pulse" />
                  <span className="w-1 h-5 bg-teal-600 animate-pulse delay-75" />
                  <span className="w-1 h-2 bg-teal-600 animate-pulse delay-150" />
                </div>
              </div>
            )}

            {/* Quick Action Suggestions */}
            <div className="p-3 border-t border-slate-100 bg-white">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Quick Actions</p>
              <div className="flex flex-wrap gap-1.5">
                {quickPills.map((pill, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend(pill)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 text-xs font-semibold transition-colors border border-slate-200/80"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>

            {/* Text & Mic Input Control */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
              <button
                onClick={toggleListening}
                className={`p-3 rounded-xl transition-all ${
                  isListening
                    ? 'bg-rose-600 text-white animate-pulse shadow-md'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title={isListening ? 'Stop recording' : 'Speak using microphone'}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-teal-700" />}
              </button>

              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type or speak a question..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />

              <button
                onClick={() => handleSend()}
                disabled={!inputVal.trim()}
                className="p-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white transition-colors shadow-sm"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
