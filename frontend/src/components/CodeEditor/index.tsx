import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileExplorer, FileNode } from './FileExplorer';
import { EditorPanel } from './EditorPanel';
import { cn } from '@/lib/utils';
import { GripVertical, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CodeEditorProps {
  initialFiles?: FileNode[];
  onFilesChange?: (files: FileNode[]) => void;
  className?: string;
  height?: string;
}

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to find a file by ID
const findFileById = (files: FileNode[], id: string): FileNode | null => {
  for (const file of files) {
    if (file.id === id) return file;
    if (file.children) {
      const found = findFileById(file.children, id);
      if (found) return found;
    }
  }
  return null;
};

// Helper to update a file in the tree
const updateFileInTree = (files: FileNode[], id: string, updates: Partial<FileNode>): FileNode[] => {
  return files.map(file => {
    if (file.id === id) {
      return { ...file, ...updates };
    }
    if (file.children) {
      return { ...file, children: updateFileInTree(file.children, id, updates) };
    }
    return file;
  });
};

// Helper to delete a file from the tree
const deleteFileFromTree = (files: FileNode[], id: string): FileNode[] => {
  return files.filter(file => {
    if (file.id === id) return false;
    if (file.children) {
      file.children = deleteFileFromTree(file.children, id);
    }
    return true;
  });
};

// Helper to add a file to the tree
const addFileToTree = (
  files: FileNode[], 
  parentId: string | null, 
  newFile: FileNode
): FileNode[] => {
  if (parentId === null) {
    return [...files, newFile];
  }
  
  return files.map(file => {
    if (file.id === parentId && file.type === 'folder') {
      return {
        ...file,
        children: [...(file.children || []), newFile],
      };
    }
    if (file.children) {
      return { ...file, children: addFileToTree(file.children, parentId, newFile) };
    }
    return file;
  });
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  initialFiles = [],
  onFilesChange,
  className,
  height = "600px",
}) => {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [explorerWidth, setExplorerWidth] = useState(250);
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedFile = selectedFileId ? findFileById(files, selectedFileId) : null;

  const updateFiles = useCallback((newFiles: FileNode[]) => {
    setFiles(newFiles);
    onFilesChange?.(newFiles);
  }, [onFilesChange]);

  const handleSelectFile = useCallback((id: string) => {
    const file = findFileById(files, id);
    if (file && file.type === 'file') {
      setSelectedFileId(id);
    }
  }, [files]);

  const handleCreateFile = useCallback((parentId: string | null, name: string, type: 'file' | 'folder') => {
    const newFile: FileNode = {
      id: generateId(),
      name,
      type,
      content: type === 'file' ? '' : undefined,
      children: type === 'folder' ? [] : undefined,
    };
    
    updateFiles(addFileToTree(files, parentId, newFile));
  }, [files, updateFiles]);

  const handleDeleteFile = useCallback((id: string) => {
    if (selectedFileId === id) {
      setSelectedFileId(null);
    }
    updateFiles(deleteFileFromTree(files, id));
  }, [files, selectedFileId, updateFiles]);

  const handleRenameFile = useCallback((id: string, newName: string) => {
    updateFiles(updateFileInTree(files, id, { name: newName }));
  }, [files, updateFiles]);

  const handleCodeChange = useCallback((newCode: string) => {
    if (selectedFileId) {
      updateFiles(updateFileInTree(files, selectedFileId, { content: newCode }));
    }
  }, [selectedFileId, files, updateFiles]);

  return (
    <motion.div
      layout
      className={cn(
        "glass-card overflow-hidden flex",
        isExpanded && "fixed inset-4 z-50",
        className
      )}
      style={{ height: isExpanded ? 'auto' : height }}
    >
      {/* File Explorer */}
      <div style={{ width: explorerWidth }} className="flex-shrink-0">
        <FileExplorer
          files={files}
          selectedFile={selectedFileId}
          onSelectFile={handleSelectFile}
          onCreateFile={handleCreateFile}
          onDeleteFile={handleDeleteFile}
          onRenameFile={handleRenameFile}
        />
      </div>
      
      {/* Resize Handle */}
      <div 
        className="w-1 bg-border hover:bg-primary/50 cursor-col-resize flex items-center justify-center group transition-colors"
        onMouseDown={(e) => {
          const startX = e.clientX;
          const startWidth = explorerWidth;
          
          const handleMouseMove = (e: MouseEvent) => {
            const newWidth = Math.max(150, Math.min(400, startWidth + e.clientX - startX));
            setExplorerWidth(newWidth);
          };
          
          const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }}
      >
        <GripVertical size={12} className="text-muted-foreground group-hover:text-primary" />
      </div>
      
      {/* Editor Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-end p-2 bg-card border-b border-border">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
        </div>
        
        {selectedFile ? (
          <EditorPanel
            code={selectedFile.content || ''}
            onChange={handleCodeChange}
            language={selectedFile.language || ''}
            fileName={selectedFile.name}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-lg font-medium">No file selected</p>
              <p className="text-sm">Select a file from the explorer to start editing</p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export type { FileNode };
