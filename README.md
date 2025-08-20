# FileTree Exporter

Export the file and folder structure of your project to a readable text file.

## Features

- Export the file and folder structure of your project to a readable text file.
- Ignore files and folders using a `.filetreeignore` file.
- Supports glob-like patterns for ignoring files and folders.
- Supports multi-root workspaces.
- Copy the file structure to the clipboard.
- Logging to an output channel for debugging.

## Usage

1. Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac).
2. Type `Extract File Structure` and select the command.
3. Enter the output file name.
4. The file structure will be exported to the specified file.

## Example Output

```txt
=== Workspace: my-project ===
src
  main.ts
  utils
    math.ts
    string.ts
test
  main.test.ts
  utils
    math.test.ts
    string.test.ts
```

## .filetreeignore

You can create a `.filetreeignore` file in the root of your project to ignore files and folders. The file uses the same syntax as a `.gitignore` file.
