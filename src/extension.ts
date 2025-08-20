import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// Output channel for logging
let outputChannel: vscode.OutputChannel;

// Default .filetreeignore content
const DEFAULT_FILETREEIGNORE_CONTENT = `# FileTree Exporter ignore patterns
# Add patterns for files and folders to ignore during export

# Dependencies
node_modules/
.npm/
.yarn/
.pnp/
.pnp.js

# Build outputs
dist/
build/
out/
*.tsbuildinfo

# Version control
.git/
.svn/
.hg/

# IDE and editor files
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# Logs
*.log
logs/

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
.nyc_output/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Temporary folders
tmp/
temp/
`;

async function ensureFileTreeIgnoreExists(rootPath: string): Promise<void> {
  const ignoreFilePath = path.join(rootPath, ".filetreeignore");

  try {
    await fs.promises.access(ignoreFilePath);
    outputChannel.appendLine(`.filetreeignore found at: ${ignoreFilePath}`);
  } catch {
    // File doesn't exist, create it
    try {
      await fs.promises.writeFile(ignoreFilePath, DEFAULT_FILETREEIGNORE_CONTENT, 'utf8');
      vscode.window.showInformationMessage('Created .filetreeignore with default patterns');
      outputChannel.appendLine(`Created .filetreeignore at: ${ignoreFilePath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      outputChannel.appendLine(`Failed to create .filetreeignore: ${errorMessage}`);
      throw new Error(`Failed to create .filetreeignore: ${errorMessage}`);
    }
  }
}

/**
 * Load ignore patterns from .filetreeignore using async operations
 */
async function loadIgnorePatterns(rootPath: string): Promise<string[]> {
  const ignoreFilePath = path.join(rootPath, ".filetreeignore");

  try {
    const content = await fs.promises.readFile(ignoreFilePath, 'utf8');
    const lines = content.split(/\r?\n/);
    const patterns = lines
      .map(line => line.trim())
      .filter(line => line !== "" && !line.startsWith("#"));

    outputChannel.appendLine(`Loaded ${patterns.length} ignore patterns from .filetreeignore`);
    return patterns;
  } catch (error) {
    outputChannel.appendLine(`Failed to read .filetreeignore: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
}

/**
 * Check if a path should be ignored based on patterns
 */
function shouldIgnorePath(relativePath: string, ignorePatterns: string[]): boolean {
  return ignorePatterns.some(pattern => {
    // Handle glob-like patterns
    if (pattern.endsWith('/')) {
      // Directory pattern
      return relativePath.startsWith(pattern) || relativePath.startsWith(pattern.slice(0, -1));
    } else if (pattern.includes('*')) {
      // Simple wildcard support
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(relativePath);
    } else {
      // Exact match or prefix match
      return relativePath === pattern || relativePath.startsWith(pattern + '/');
    }
  });
}

/**
 * Recursive function to get files and folders using async operations
 */
async function getAllFilesAndFolders(dirPath: string, indent: string, ignorePatterns: string[], rootPath: string): Promise<string[]> {
  let result: string[] = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/'); // Normalize path separators

      // Skip ignored paths
      if (shouldIgnorePath(relativePath, ignorePatterns)) {
        outputChannel.appendLine(`Ignoring: ${relativePath}`);
        continue;
      }

      const line = `${indent}${entry.name}`;
      result.push(line);

      if (entry.isDirectory()) {
        try {
          const subResults = await getAllFilesAndFolders(fullPath, indent + "  ", ignorePatterns, rootPath);
          result = result.concat(subResults);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          outputChannel.appendLine(`Error reading directory ${fullPath}: ${errorMessage}`);
          result.push(`${indent}  [Error reading directory: ${errorMessage}]`);
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    outputChannel.appendLine(`Error reading directory ${dirPath}: ${errorMessage}`);
    throw new Error(`Failed to read directory ${dirPath}: ${errorMessage}`);
  }

  return result;
}

/**
 * Main function to extract file structure
 */
async function extractFileStructure(): Promise<void> {
  // Check if workspace is open
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    vscode.window.showErrorMessage('No workspace is open. Please open a folder or workspace first.');
    outputChannel.appendLine('Error: No workspace is open');
    return;
  }

  vscode.window.showInformationMessage('Starting file structure extraction...');
  outputChannel.appendLine('Starting file structure extraction...');

  // Prompt for output file name
  const outputFileName = await vscode.window.showInputBox({
    prompt: 'Enter the output file name',
    value: 'file-structure.txt',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'File name cannot be empty';
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(value)) {
        return 'File name contains invalid characters. Use only letters, numbers, dots, hyphens, and underscores.';
      }
      return null;
    }
  });

  if (!outputFileName) {
    vscode.window.showInformationMessage('File structure extraction cancelled.');
    outputChannel.appendLine('Operation cancelled by user');
    return;
  }

  // Process each workspace folder (support for multi-root workspaces)
  const results: string[] = [];

  for (let i = 0; i < vscode.workspace.workspaceFolders.length; i++) {
    const workspaceFolder = vscode.workspace.workspaceFolders[i];
    vscode.window.showInformationMessage(`Processing workspace ${i + 1}/${vscode.workspace.workspaceFolders.length}: ${workspaceFolder.name}`);
    outputChannel.appendLine(`Processing workspace: ${workspaceFolder.name} (${workspaceFolder.uri.fsPath})`);

    try {
      // Ensure .filetreeignore exists
      await ensureFileTreeIgnoreExists(workspaceFolder.uri.fsPath);

      // Load ignore patterns
      const ignorePatterns = await loadIgnorePatterns(workspaceFolder.uri.fsPath);

      // Generate file structure
      vscode.window.showInformationMessage(`Scanning files in ${workspaceFolder.name}...`);
      const structure = await getAllFilesAndFolders(workspaceFolder.uri.fsPath, "", ignorePatterns, workspaceFolder.uri.fsPath);

      if (vscode.workspace.workspaceFolders.length > 1) {
        results.push(`\n=== Workspace: ${workspaceFolder.name} ===\n${structure.join('\n')}`);
      } else {
        results.push(structure.join('\n'));
      }

      outputChannel.appendLine(`Successfully processed workspace: ${workspaceFolder.name}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      vscode.window.showErrorMessage(`Error processing workspace ${workspaceFolder.name}: ${errorMessage}`);
      outputChannel.appendLine(`Error processing workspace ${workspaceFolder.name}: ${errorMessage}`);

      // Add error info to results
      if (vscode.workspace.workspaceFolders.length > 1) {
        results.push(`\n=== Workspace: ${workspaceFolder.name} ===\n[Error: ${errorMessage}]`);
      } else {
        results.push(`[Error: ${errorMessage}]`);
      }
    }
  }

  // Write output file to the first workspace folder
  const firstWorkspaceFolder = vscode.workspace.workspaceFolders[0];
  const outputPath = path.join(firstWorkspaceFolder.uri.fsPath, outputFileName);

  try {
    vscode.window.showInformationMessage('Writing output file...');
    await fs.promises.writeFile(outputPath, results.join('\n'), 'utf8');

    vscode.window.showInformationMessage(`✅ File structure exported successfully to: ${outputFileName}`);
    outputChannel.appendLine(`File structure exported to: ${outputPath}`);
    outputChannel.appendLine(`Total workspaces processed: ${vscode.workspace.workspaceFolders.length}`);

    // Update status bar temporarily
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = `$(check) FileTree exported to ${outputFileName}`;
    statusBarItem.show();
    setTimeout(() => statusBarItem.dispose(), 5000);

    // Copy to clipboard
    try {
      await vscode.env.clipboard.writeText(results.join('\n'));
      vscode.window.showInformationMessage('📋 File structure also copied to clipboard!');
      outputChannel.appendLine('File structure copied to clipboard');
    } catch (clipboardError) {
      outputChannel.appendLine(`Warning: Failed to copy to clipboard: ${clipboardError instanceof Error ? clipboardError.message : 'Unknown error'}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    vscode.window.showErrorMessage(`❌ Failed to write output file: ${errorMessage}`);
    outputChannel.appendLine(`Error writing output file: ${errorMessage}`);
    throw new Error(`Failed to write output file: ${errorMessage}`);
  }
}

// Activate the extension
export function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('FileTree Exporter');
  context.subscriptions.push(outputChannel);

  console.log('Congratulations, your extension "filetree-exporter" is now active!');
  outputChannel.appendLine('FileTree Exporter extension activated');

  // Register the command
  const disposable = vscode.commands.registerCommand('extension.extractFileStructure', async () => {
    try {
      await extractFileStructure();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      vscode.window.showErrorMessage(`FileTree Exporter Error: ${errorMessage}`);
      outputChannel.appendLine(`Error: ${errorMessage}`);
    }
  });

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {
  if (outputChannel) {
    outputChannel.appendLine('FileTree Exporter extension deactivated');
    outputChannel.dispose();
  }
}
