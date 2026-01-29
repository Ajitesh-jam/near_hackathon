import React, { useEffect, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-markdown';
import { cn } from '@/lib/utils';

interface EditorPanelProps {
  code: string;
  onChange: (code: string) => void;
  language: string;
  fileName: string;
  readOnly?: boolean;
}

const getLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    py: 'python',
    python: 'python',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    rs: 'rust',
    rust: 'rust',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    dockerfile: 'docker',
    toml: 'toml',
    env: 'bash',
    txt: 'markdown',
  };
  
  if (filename.toLowerCase() === 'dockerfile') {
    return 'docker';
  }
  
  return langMap[ext || ''] || 'markdown';
};

const highlight = (code: string, language: string): string => {
  const grammar = Prism.languages[language];
  if (grammar) {
    return Prism.highlight(code, grammar, language);
  }
  return code;
};

export const EditorPanel: React.FC<EditorPanelProps> = ({
  code,
  onChange,
  language,
  fileName,
  readOnly = false,
}) => {
  const detectedLanguage = language || getLanguage(fileName);
  const lineCount = code.split('\n').length;
  const editorRef = useRef<HTMLDivElement>(null);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* File tab */}
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-t-md border border-border border-b-0">
          <span className="text-xs font-mono text-foreground">{fileName}</span>
          <span className="text-[10px] px-1.5 py-0.5 bg-primary/20 text-primary rounded font-mono">
            {detectedLanguage}
          </span>
        </div>
      </div>
      
      {/* Editor */}
      <div ref={editorRef} className="flex-1 overflow-auto custom-scrollbar">
        <div className="flex min-h-full">
          {/* Line numbers */}
          <div className="flex-shrink-0 bg-card/50 border-r border-border select-none">
            {Array.from({ length: Math.max(lineCount, 20) }, (_, i) => (
              <div
                key={i}
                className="px-4 py-0 text-right text-xs font-mono text-muted-foreground/50 leading-6"
              >
                {i + 1}
              </div>
            ))}
          </div>
          
          {/* Code editor */}
          <div className="flex-1 min-w-0">
            <Editor
              value={code}
              onValueChange={onChange}
              highlight={(code) => highlight(code, detectedLanguage)}
              padding={16}
              disabled={readOnly}
              className={cn(
                "font-mono text-sm leading-6 min-h-full",
                readOnly && "opacity-70"
              )}
              style={{
                fontFamily: '"JetBrains Mono", monospace',
                minHeight: '100%',
              }}
              textareaClassName="focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
