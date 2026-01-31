import { FileNode } from '@/components/CodeEditor';

// Generate unique ID for file nodes
const generateId = () => Math.random().toString(36).substr(2, 9);

/**
 * Converts backend template_code dictionary to frontend FileNode[] format
 * Handles nested paths like "tools/base.py" → folder structure
 */
export function templateCodeToFileNodes(templateCode: Record<string, string>): FileNode[] {
  const fileMap = new Map<string, FileNode>();
  const folderMap = new Map<string, FileNode>();

  // Process all file paths
  for (const [filePath, content] of Object.entries(templateCode)) {
    const parts = filePath.split('/');
    
    // Build folder structure
    let currentPath = '';
    for (let i = 0; i < parts.length - 1; i++) {
      const folderName = parts[i];
      const folderPath = currentPath ? `${currentPath}/${folderName}` : folderName;
      
      if (!folderMap.has(folderPath)) {
        const folderNode: FileNode = {
          id: generateId(),
          name: folderName,
          type: 'folder',
          children: [],
        };
        folderMap.set(folderPath, folderNode);
        
        // Add to parent if exists
        if (currentPath && folderMap.has(currentPath)) {
          const parent = folderMap.get(currentPath)!;
          if (!parent.children) parent.children = [];
          parent.children.push(folderNode);
        }
      }
      
      currentPath = folderPath;
    }
    
    // Create file node
    const fileName = parts[parts.length - 1];
    const fileNode: FileNode = {
      id: generateId(),
      name: fileName,
      type: 'file',
      content: content,
      language: getLanguageFromFileName(fileName),
    };
    
    // Add file to appropriate parent
    if (parts.length === 1) {
      // Root level file
      fileMap.set(filePath, fileNode);
    } else {
      // File in folder
      const parentPath = parts.slice(0, -1).join('/');
      const parent = folderMap.get(parentPath);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(fileNode);
      } else {
        // Fallback: add to root
        fileMap.set(filePath, fileNode);
      }
    }
  }
  
  // Build result array: root folders first, then root files
  const result: FileNode[] = [];
  
  // Add root folders (folders with no parent)
  for (const [path, folder] of folderMap.entries()) {
    if (!path.includes('/')) {
      result.push(folder);
    }
  }
  
  // Add root files
  for (const file of fileMap.values()) {
    result.push(file);
  }
  
  return result;
}

/**
 * Maps backend waiting_stage to frontend step index
 */
export function getStepIndexForStage(waitingStage: string): number {
  const stageToStepMap: Record<string, number> = {
    'tools': 1,           // Step 1: Tools
    'custom_tools': 1,    // Step 1: Tools (show custom tool section)
    'prompt': 2,          // Step 2: Prompt (LLM step removed)
    'clarification': 2,   // Step 2: Prompt (show clarification)
    'tool_review': 1,     // Step 1: Tools (show review)
    'code_review': 4,     // Step 4: Code (LLM step removed)
  };
  
  return stageToStepMap[waitingStage] ?? 0;
}

/**
 * Formats backend code errors for display
 */
export interface ErrorDisplay {
  filePath: string;
  type: string;
  message: string;
  lineNumber?: number;
}

export function formatCodeErrors(errors: Array<{
  file_path: string;
  error_type: string;
  message: string;
  line_number?: number;
}>): ErrorDisplay[] {
  return errors.map(error => ({
    filePath: error.file_path,
    type: error.error_type,
    message: error.message,
    lineNumber: error.line_number,
  }));
}

/**
 * Gets language from file name
 */
function getLanguageFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    'py': 'python',
    'txt': 'plaintext',
    'json': 'json',
    'yaml': 'yaml',
    'yml': 'yaml',
    'toml': 'toml',
    'env': 'plaintext',
    'md': 'markdown',
    'dockerfile': 'dockerfile',
  };
  
  if (fileName.toLowerCase() === 'dockerfile') {
    return 'dockerfile';
  }
  
  return langMap[ext || ''] || 'plaintext';
}

/**
 * Converts FileNode[] back to template_code dictionary format
 */
export function fileNodesToTemplateCode(files: FileNode[]): Record<string, string> {
  const templateCode: Record<string, string> = {};
  
  function processNode(node: FileNode, path: string = '') {
    const currentPath = path ? `${path}/${node.name}` : node.name;
    
    if (node.type === 'file' && node.content !== undefined) {
      templateCode[currentPath] = node.content;
    } else if (node.type === 'folder' && node.children) {
      for (const child of node.children) {
        processNode(child, currentPath);
      }
    }
  }
  
  for (const file of files) {
    processNode(file);
  }
  
  return templateCode;
}
