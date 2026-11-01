import React, { useState } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  isSpeechRecognitionSupported,
  startSpeechListening,
  ParsedVoiceQuery,
} from '../utils/speechRecognition';

interface VoiceSearchButtonProps {
  onParsed: (query: ParsedVoiceQuery) => void;
  className?: string;
}

export const VoiceSearchButton: React.FC<VoiceSearchButtonProps> = ({ onParsed, className = '' }) => {
  const { language, t } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{ stop: () => void } | null>(null);

  const isSupported = isSpeechRecognitionSupported();

  const handleToggle = () => {
    if (!isSupported) {
      setStatusMessage(t.voiceError);
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    if (isListening) {
      if (activeSession) {
        activeSession.stop();
      }
      setIsListening(false);
      setActiveSession(null);
      setStatusMessage(null);
      return;
    }

    setIsListening(true);
    setStatusMessage(t.voiceListening);

    const session = startSpeechListening(
      language,
      (parsed) => {
        setIsListening(false);
        setActiveSession(null);
        setStatusMessage(t.voiceSuccess);
        onParsed(parsed);
        setTimeout(() => setStatusMessage(null), 3000);
      },
      (error) => {
        setIsListening(false);
        setActiveSession(null);
        setStatusMessage(`${t.voiceError} (${error})`);
        setTimeout(() => setStatusMessage(null), 4000);
      },
      () => {
        setIsListening(false);
        setActiveSession(null);
      }
    );

    setActiveSession(session);
  };

  return (
    <div className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center justify-center p-2.5 sm:px-3.5 sm:py-2 rounded-lg text-sm font-semibold transition-subtle shadow-soft border ${
          isListening
            ? 'bg-brickRed text-white border-brickRed'
            : 'bg-white text-forest hover:bg-cream-light border-cream-border'
        } ${className}`}
        title={t.voiceSearchPrompt}
        aria-label={t.voiceSearchPrompt}
      >
        {isListening ? (
          <div className="flex items-center gap-1.5">
            <MicOff className="w-4 h-4 text-white" />
            <span className="text-xs font-semibold">Listening...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Mic className="w-4 h-4 text-agri" />
            <span className="text-xs font-semibold hidden sm:inline">Voice Search</span>
          </div>
        )}
      </button>

      {statusMessage && (
        <div className="absolute top-full mt-2 z-30 bg-forest text-white text-xs font-medium px-3 py-1.5 rounded shadow-card whitespace-nowrap border border-forest-light">
          {statusMessage}
        </div>
      )}
    </div>
  );
};
