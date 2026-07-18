import React, { useState, useEffect, useRef } from 'react';
import { useInterviewStore } from '../stores/interviewStore';
import { useSettingsStore } from '../stores/settingsStore';

const AnswerDisplay: React.FC = () => {
  const { currentAnswer, currentQuestion, transcriptionHistory } = useInterviewStore();
  const { settings } = useSettingsStore();
  const [displayedText, setDisplayedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [answerHistory, setAnswerHistory] = useState<Array<{question: string; answer: string}>>([]);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<number | null>(null);

  useEffect(() => {
    // Auto-scroll when new content appears
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayedText, currentAnswer]);

  useEffect(() => {
    // Simulate streaming effect for new answers
    if (currentAnswer && currentAnswer !== displayedText) {
      setIsStreaming(true);
      let index = 0;
      
      const streamText = () => {
        if (index < currentAnswer.length) {
          setDisplayedText(currentAnswer.substring(0, index + 1));
          index += settings.autoScrollSpeed;
          streamRef.current = requestAnimationFrame(streamText);
        } else {
          setIsStreaming(false);
          // Add to history
          setAnswerHistory(prev => [...prev, {
            question: currentQuestion,
            answer: currentAnswer
          }]);
        }
      };

      streamText();
    } else if (!currentAnswer) {
      setDisplayedText('');
    }

    return () => {
      if (streamRef.current) {
        cancelAnimationFrame(streamRef.current);
      }
    };
  }, [currentAnswer]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAnswer = (text: string) => {
    // Format code blocks
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts = text.split(codeBlockRegex);
    
    return parts.map((part, index) => {
      if (index % 3 === 1) {
        // Language identifier
        return null;
      } else if (index % 3 === 2) {
        // Code content
        return (
          <div key={index} className="relative group">
            <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto text-sm">
              <code>{part}</code>
            </pre>
            <button
              onClick={() => handleCopy(part)}
              className="absolute top-2 right-2 bg-gray-800 hover:bg-gray-700 text-gray-400 px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        );
      } else {
        // Regular text - format paragraphs and lists
        return (
          <div key={index} className="space-y-2">
            {part.split('\n').map((line, lineIndex) => {
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <li key={lineIndex} className="text-gray-300 ml-4">
                    {line.substring(2)}
                  </li>
                );
              } else if (/^\d+\./.test(line)) {
                return (
                  <li key={lineIndex} className="text-gray-300 ml-4 list-decimal">
                    {line.replace(/^\d+\.\s*/, '')}
                  </li>
                );
              } else if (line.trim()) {
                return (
                  <p key={lineIndex} className="text-gray-300">
                    {line}
                  </p>
                );
              }
              return null;
            })}
          </div>
        );
      }
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-750 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-medium text-emerald-400">Answer</h3>
        <div className="flex items-center space-x-2">
          {isStreaming && (
            <span className="text-xs text-yellow-400 animate-pulse">Streaming...</span>
          )}
          <button
            onClick={() => handleCopy(displayedText)}
            className="text-gray-400 hover:text-white text-xs"
            title="Copy answer"
          >
            📋
          </button>
        </div>
      </div>

      {/* Current Answer */}
      <div
        ref={scrollRef}
        className="p-4 max-h-96 overflow-y-auto"
        style={{ fontSize: `${settings.fontSize}px` }}
      >
        {displayedText ? (
          <div className="space-y-3">
            {formatAnswer(displayedText)}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            Waiting for interview question...
          </p>
        )}
      </div>

      {/* Answer History */}
      {answerHistory.length > 0 && (
        <details className="border-t border-gray-700">
          <summary className="px-4 py-2 text-sm text-gray-400 cursor-pointer hover:text-gray-300">
            Answer History ({answerHistory.length})
          </summary>
          <div className="max-h-60 overflow-y-auto space-y-2 p-2">
            {answerHistory.map((item, index) => (
              <div key={index} className="bg-gray-700 rounded p-2">
                <p className="text-xs text-gray-400 mb-1">Q: {item.question}</p>
                <p className="text-xs text-gray-300 line-clamp-3">{item.answer}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default AnswerDisplay;
