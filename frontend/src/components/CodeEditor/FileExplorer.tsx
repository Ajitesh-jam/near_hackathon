import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  FolderOpen, 
  File, 
  Plus, 
  ChevronRight, 
  ChevronDown,
  FileCode,
  Trash2,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// File type icons
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const iconMap: Record<string, { icon: string; color: string }> = {
    py: { icon: '🐍', color: 'text-yellow-400' },
    python: { icon: '🐍', color: 'text-yellow-400' },
    rs: { icon: '🦀', color: 'text-orange-500' },
    rust: { icon: '🦀', color: 'text-orange-500' },
    ts: { icon: 'TS', color: 'text-blue-400' },
    tsx: { icon: 'TSX', color: 'text-blue-400' },
    js: { icon: 'JS', color: 'text-yellow-300' },
    jsx: { icon: 'JSX', color: 'text-yellow-300' },
    json: { icon: '{ }', color: 'text-amber-400' },
    md: { icon: 'MD', color: 'text-gray-400' },
    txt: { icon: 'TXT', color: 'text-gray-400' },
    env: { icon: 'ENV', color: 'text-green-400' },
    dockerfile: { icon: '🐳', color: 'text-blue-500' },
    yaml: { icon: 'YML', color: 'text-pink-400' },
    yml: { icon: 'YML', color: 'text-pink-400' },
    toml: { icon: 'TOML', color: 'text-orange-400' },
  };
  
  if (filename.toLowerCase() === 'dockerfile') {
    return iconMap.dockerfile;
  }
  
  return iconMap[ext || ''] || { icon: '📄', color: 'text-gray-400' };
};

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  content?: string;
  children?: FileNode[];
  language?: string;
}

interface FileExplorerProps {
  files: FileNode[];
  selectedFile: string | null;
  onSelectFile: (id: string) => void;
  onCreateFile: (parentId: string | null, name: string, type: 'file' | 'folder') => void;
  onDeleteFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
}

const FileTreeItem: React.FC<{
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (id: string) => void;
  onCreateFile: (parentId: string | null, name: string, type: 'file' | 'folder') => void;
  onDeleteFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
}> = ({ 
  node, 
  depth, 
  selectedFile, 
  onSelectFile, 
  onCreateFile, 
  onDeleteFile,
  onRenameFile,
  expandedFolders, 
  toggleFolder 
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const [showActions, setShowActions] = useState(false);
  
  const isExpanded = expandedFolders.has(node.id);
  const isSelected = selectedFile === node.id;
  const fileIcon = getFileIcon(node.name);

  const handleRename = () => {
    if (newName.trim() && newName !== node.name) {
      onRenameFile(node.id, newName.trim());
    }
    setIsRenaming(false);
  };

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group transition-all duration-200",
          isSelected ? "bg-primary/20 border-l-2 border-primary" : "hover:bg-secondary/50",
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={() => {
          if (node.type === 'folder') {
            toggleFolder(node.id);
          } else {
            onSelectFile(node.id);
          }
        }}
      >
        {node.type === 'folder' ? (
          <>
            <span className="text-muted-foreground">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            {isExpanded ? (
              <FolderOpen size={16} className="text-primary" />
            ) : (
              <Folder size={16} className="text-primary/70" />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <span className={cn("text-xs font-mono font-bold", fileIcon.color)}>
              {fileIcon.icon}
            </span>
          </>
        )}
        
        {isRenaming ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-6 text-xs px-1 py-0"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setIsRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); handleRename(); }}>
              <Check size={12} />
            </Button>
            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); setIsRenaming(false); }}>
              <X size={12} />
            </Button>
          </div>
        ) : (
          <>
            <span className={cn(
              "text-sm flex-1 truncate",
              isSelected ? "text-primary font-medium" : "text-foreground/80"
            )}>
              {node.name}
            </span>
            
            <AnimatePresence>
              {showActions && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-0.5"
                >
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-5 w-5 opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}
                  >
                    <Edit2 size={10} />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-5 w-5 opacity-60 hover:opacity-100 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); onDeleteFile(node.id); }}
                  >
                    <Trash2 size={10} />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
      
      <AnimatePresence>
        {node.type === 'folder' && isExpanded && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {node.children.map((child) => (
              <FileTreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                onCreateFile={onCreateFile}
                onDeleteFile={onDeleteFile}
                onRenameFile={onRenameFile}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  selectedFile,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
  onRenameFile,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCreate = () => {
    if (newItemName.trim() && isCreating) {
      onCreateFile(null, newItemName.trim(), isCreating);
      setNewItemName('');
      setIsCreating(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-sidebar border-r border-border">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6"
            onClick={() => setIsCreating('file')}
          >
            <File size={14} />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6"
            onClick={() => setIsCreating('folder')}
          >
            <FolderOpen size={14} />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto custom-scrollbar py-2">
        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-2 py-1"
            >
              <div className="flex items-center gap-1">
                {isCreating === 'folder' ? (
                  <Folder size={14} className="text-primary" />
                ) : (
                  <FileCode size={14} className="text-muted-foreground" />
                )}
                <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder={`New ${isCreating}...`}
                  className="h-6 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreate();
                    if (e.key === 'Escape') setIsCreating(null);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={handleCreate}>
                  <Check size={12} />
                </Button>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setIsCreating(null)}>
                  <X size={12} />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {files.map((node) => (
          <FileTreeItem
            key={node.id}
            node={node}
            depth={0}
            selectedFile={selectedFile}
            onSelectFile={onSelectFile}
            onCreateFile={onCreateFile}
            onDeleteFile={onDeleteFile}
            onRenameFile={onRenameFile}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
          />
        ))}
      </div>
    </div>
  );
};
