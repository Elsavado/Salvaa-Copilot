import React, { useState, useEffect } from 'react';
import Branding from './Branding';

interface CVData {
  rawText: string;
  parsedSections: {
    skills: string[];
    experience: string[];
    education: string[];
    projects: string[];
  };
  fileName: string;
  uploadedAt: string;
}

const CVUpload: React.FC = () => {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewText, setPreviewText] = useState('');

  useEffect(() => {
    loadCVData();
  }, []);

  const loadCVData = async () => {
    try {
      const data = await window.electronAPI.getCVData();
      if (data) {
        setCvData(data);
        setPreviewText(data.rawText.substring(0, 500));
      }
    } catch (err) {
      console.error('Failed to load CV data:', err);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      let text = '';
      
      if (file.type === 'text/plain') {
        text = await file.text();
      } else if (file.type === 'application/pdf') {
        // For PDF, we'd need pdf.js or similar
        text = await file.text();
        // In production, use a proper PDF parser
      } else if (file.type.includes('wordprocessingml')) {
        // For DOCX, we'd need mammoth.js or similar
        text = await file.text();
        // In production, use a proper DOCX parser
      } else {
        text = await file.text();
      }

      const newCVData: CVData = {
        rawText: text,
        parsedSections: {
          skills: extractSkills(text),
          experience: extractExperience(text),
          education: extractEducation(text),
          projects: extractProjects(text)
        },
        fileName: file.name,
        uploadedAt: new Date().toISOString()
      };

      await window.electronAPI.saveCVData(newCVData);
      setCvData(newCVData);
      setPreviewText(text.substring(0, 500));
    } catch (err) {
      setError('Failed to upload CV. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Simple extraction functions - in production, use NLP/AI
  const extractSkills = (text: string): string[] => {
    const skillKeywords = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'React', 'Node.js',
      'AWS', 'Docker', 'Kubernetes', 'SQL', 'NoSQL', 'GraphQL', 'REST API',
      'Machine Learning', 'AI', 'Data Science', 'DevOps', 'Agile', 'Scrum'
    ];
    return skillKeywords.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );
  };

  const extractExperience = (text: string): string[] => {
    const lines = text.split('\n');
    const experienceLines: string[] = [];
    let inExperience = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('experience') || line.toLowerCase().includes('work history')) {
        inExperience = true;
        continue;
      }
      if (inExperience && (line.toLowerCase().includes('education') || line.toLowerCase().includes('skills'))) {
        break;
      }
      if (inExperience && line.trim()) {
        experienceLines.push(line.trim());
      }
    }

    return experienceLines.slice(0, 10);
  };

  const extractEducation = (text: string): string[] => {
    const lines = text.split('\n');
    const educationLines: string[] = [];
    let inEducation = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('education')) {
        inEducation = true;
        continue;
      }
      if (inEducation && (line.toLowerCase().includes('experience') || line.toLowerCase().includes('skills'))) {
        break;
      }
      if (inEducation && line.trim()) {
        educationLines.push(line.trim());
      }
    }

    return educationLines.slice(0, 5);
  };

  const extractProjects = (text: string): string[] => {
    const lines = text.split('\n');
    const projectLines: string[] = [];
    let inProjects = false;

    for (const line of lines) {
      if (line.toLowerCase().includes('project')) {
        inProjects = true;
        continue;
      }
      if (inProjects && (line.toLowerCase().includes('experience') || line.toLowerCase().includes('education'))) {
        break;
      }
      if (inProjects && line.trim()) {
        projectLines.push(line.trim());
      }
    }

    return projectLines.slice(0, 10);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">CV/Resume Upload</h2>
      <p className="text-gray-400">
        Upload your CV to get personalized answers during interviews
      </p>

      {/* Upload Section */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
            id="cv-file-upload"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <label htmlFor="cv-file-upload" className="cursor-pointer">
            <div className="text-4xl mb-4">
              {cvData ? '📄' : '📁'}
            </div>
            <p className="text-gray-300 mb-2">
              {cvData ? 'Click to replace your CV' : 'Click to upload your CV'}
            </p>
            <p className="text-sm text-gray-500">Supports PDF, DOCX, TXT</p>
          </label>
        </div>

        {isUploading && (
          <div className="mt-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto" />
            <p className="text-gray-400 mt-2">Uploading and parsing...</p>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/50 border border-red-500 rounded p-3">
            <p className="text-red-200 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Preview Section */}
      {cvData && (
        <div className="bg-gray-800 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-emerald-400">
            {cvData.fileName}
          </h3>
          <p className="text-sm text-gray-400">
            Uploaded: {new Date(cvData.uploadedAt).toLocaleDateString()}
          </p>

          {/* Parsed Sections */}
          <div className="space-y-4">
            {cvData.parsedSections.skills.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Detected Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {cvData.parsedSections.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="bg-emerald-900/50 text-emerald-300 px-2 py-1 rounded text-xs"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {cvData.parsedSections.experience.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Experience</h4>
                <ul className="space-y-1">
                  {cvData.parsedSections.experience.map((exp, index) => (
                    <li key={index} className="text-sm text-gray-400">
                      {exp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cvData.parsedSections.education.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-300 mb-2">Education</h4>
                <ul className="space-y-1">
                  {cvData.parsedSections.education.map((edu, index) => (
                    <li key={index} className="text-sm text-gray-400">
                      {edu}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Raw Text Preview */}
          <details className="mt-4">
            <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
              Raw Text Preview
            </summary>
            <pre className="mt-2 bg-gray-900 rounded p-3 text-xs text-gray-400 overflow-auto max-h-40">
              {previewText}
            </pre>
          </details>
        </div>
      )}

      <Branding />
    </div>
  );
};

export default CVUpload;
