import React, { useState, useEffect } from 'react';
import Branding from './Branding';

interface PreFlightData {
  jobDescription: string;
  companyName: string;
  roleTitle: string;
  expectedQuestions: string[];
  practiceNotes: string;
  createdAt: string;
}

const PreFlightSetup: React.FC = () => {
  const [preFlightData, setPreFlightData] = useState<PreFlightData>({
    jobDescription: '',
    companyName: '',
    roleTitle: '',
    expectedQuestions: [],
    practiceNotes: '',
    createdAt: new Date().toISOString()
  });
  const [newQuestion, setNewQuestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceQuestion, setPracticeQuestion] = useState('');
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreFlightData();
  }, []);

  const loadPreFlightData = async () => {
    try {
      const data = await window.electronAPI.getPreFlightData();
      if (data) {
        setPreFlightData(data);
      }
    } catch (err) {
      console.error('Failed to load preflight data:', err);
    }
  };

  const savePreFlightData = async () => {
    try {
      await window.electronAPI.savePreFlightData(preFlightData);
    } catch (err) {
      setError('Failed to save preflight data');
      console.error('Save error:', err);
    }
  };

  const generateExpectedQuestions = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: `Based on this job description, generate 10 likely interview questions for a ${preFlightData.roleTitle} role at ${preFlightData.companyName}:

Job Description:
${preFlightData.jobDescription}

Generate questions covering: technical skills, behavioral questions, system design, and role-specific scenarios. Format as a numbered list.`
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate questions');
      }

      const data = await response.json();
      const questions = data.content[0].text
        .split('\n')
        .filter((line: string) => line.trim() && /^\d+/.test(line))
        .map((line: string) => line.replace(/^\d+[\.\)]\s*/, '').trim());

      setPreFlightData(prev => ({
        ...prev,
        expectedQuestions: [...prev.expectedQuestions, ...questions]
      }));
    } catch (err) {
      setError('Failed to generate questions. Please check your API key.');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const addExpectedQuestion = () => {
    if (newQuestion.trim()) {
      setPreFlightData(prev => ({
        ...prev,
        expectedQuestions: [...prev.expectedQuestions, newQuestion.trim()]
      }));
      setNewQuestion('');
    }
  };

  const removeQuestion = (index: number) => {
    setPreFlightData(prev => ({
      ...prev,
      expectedQuestions: prev.expectedQuestions.filter((_, i) => i !== index)
    }));
  };

  const handlePracticeSubmit = async () => {
    setIsGenerating(true);
    setFeedback('');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 500,
          messages: [{
            role: 'user',
            content: `As an interview coach, provide feedback on this answer to the question: "${practiceQuestion}"

Candidate's Answer:
${practiceAnswer}

Provide constructive feedback on:
1. Structure and clarity
2. Content relevance
3. Areas for improvement
4. Suggested improvements

Be specific and actionable.`
          }]
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get feedback');
      }

      const data = await response.json();
      setFeedback(data.content[0].text);
    } catch (err) {
      setError('Failed to get feedback. Please try again.');
      console.error('Feedback error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Pre-Flight Interview Preparation</h2>

      {/* Job Details */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-emerald-400">Job Details</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Company Name
            </label>
            <input
              type="text"
              value={preFlightData.companyName}
              onChange={(e) => setPreFlightData(prev => ({
                ...prev,
                companyName: e.target.value
              }))}
              placeholder="e.g., Google, Meta, Stripe"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Role Title
            </label>
            <input
              type="text"
              value={preFlightData.roleTitle}
              onChange={(e) => setPreFlightData(prev => ({
                ...prev,
                roleTitle: e.target.value
              }))}
              placeholder="e.g., Senior Software Engineer"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Job Description
          </label>
          <textarea
            value={preFlightData.jobDescription}
            onChange={(e) => setPreFlightData(prev => ({
              ...prev,
              jobDescription: e.target.value
            }))}
            placeholder="Paste the full job description here..."
            className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-32"
          />
        </div>
      </section>

      {/* Expected Questions */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-emerald-400">Expected Questions</h3>
        
        <div className="flex space-x-2">
          <input
            type="text"
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            placeholder="Add an expected question..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
            onKeyPress={(e) => e.key === 'Enter' && addExpectedQuestion()}
          />
          <button
            onClick={addExpectedQuestion}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
          >
            Add
          </button>
        </div>

        <button
          onClick={generateExpectedQuestions}
          disabled={isGenerating || !preFlightData.jobDescription}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded"
        >
          {isGenerating ? 'Generating...' : 'Generate Questions from Job Description'}
        </button>

        {preFlightData.expectedQuestions.length > 0 && (
          <div className="space-y-2">
            {preFlightData.expectedQuestions.map((question, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-700 rounded p-3">
                <span className="text-sm text-gray-300">{question}</span>
                <button
                  onClick={() => removeQuestion(index)}
                  className="text-red-400 hover:text-red-300 ml-2"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Practice Mode */}
      <section className="bg-gray-800 rounded-lg p-6 space-y-4">
        <h3 className="text-lg font-semibold text-emerald-400">Practice Mode</h3>
        
        <button
          onClick={() => setIsPracticeMode(!isPracticeMode)}
          className={`w-full px-4 py-2 rounded ${
            isPracticeMode ? 'bg-yellow-600' : 'bg-gray-600'
          } text-white`}
        >
          {isPracticeMode ? 'Exit Practice Mode' : 'Enter Practice Mode'}
        </button>

        {isPracticeMode && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Practice Question
              </label>
              <select
                value={practiceQuestion}
                onChange={(e) => setPracticeQuestion(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="">Select a question...</option>
                {preFlightData.expectedQuestions.map((q, index) => (
                  <option key={index} value={q}>{q}</option>
                ))}
                <option value="custom">Custom question...</option>
              </select>
              {practiceQuestion === 'custom' && (
                <input
                  type="text"
                  value={practiceQuestion}
                  onChange={(e) => setPracticeQuestion(e.target.value)}
                  placeholder="Enter your custom question"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white mt-2"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Answer
              </label>
              <textarea
                value={practiceAnswer}
                onChange={(e) => setPracticeAnswer(e.target.value)}
                placeholder="Type your practice answer here..."
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-32"
              />
            </div>

            <button
              onClick={handlePracticeSubmit}
              disabled={isGenerating || !practiceQuestion || !practiceAnswer}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white px-4 py-2 rounded"
            >
              {isGenerating ? 'Analyzing...' : 'Get Feedback'}
            </button>

            {feedback && (
              <div className="bg-gray-900 rounded p-4">
                <h4 className="text-sm font-medium text-emerald-400 mb-2">Feedback</h4>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{feedback}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={savePreFlightData}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded"
        >
          Save Pre-Flight Data
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded p-3">
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}

      <Branding />
    </div>
  );
};

export default PreFlightSetup;
