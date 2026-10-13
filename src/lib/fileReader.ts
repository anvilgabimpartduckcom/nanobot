// {Created universal code-driven file analyzer supporting arbitrary non-image file formats} [Commented by: Sonic on 10/12/2026 10:50 AM]

export interface ProcessedFile {
  id: number;
  name: string;
  type: string;
  size: number;
  isImage: boolean;
  contentSnippet: string;
  generatedReaderCode?: string;
  dataUrl?: string;
}

// Check if a file is an image
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name);
}

// Synthesize python-style file inspection script for any arbitrary file format
export function generatePythonReaderCode(fileName: string, mimeType: string, fileSize: number): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'csv':
      return `import pandas as pd
df = pd.read_csv("${fileName}")
print(f"Shape: {df.shape}")
print("Columns:", df.columns.tolist())
print(df.head(10).to_string())`;

    case 'json':
      return `import json
with open("${fileName}", "r", encoding="utf-8") as f:
    data = json.load(f)
print(f"Keys/Length: {len(data) if isinstance(data, (list, dict)) else 1}")
print(json.dumps(data, indent=2)[:4000])`;

    case 'pdf':
      return `import pypdf
reader = pypdf.PdfReader("${fileName}")
print(f"Total pages: {len(reader.pages)}")
for idx, page in enumerate(reader.pages[:5]):
    print(f"--- Page {idx+1} ---")
    print(page.extract_text()[:1500])`;

    case 'xlsx':
    case 'xls':
      return `import pandas as pd
excel_file = pd.ExcelFile("${fileName}")
print("Sheets:", excel_file.sheet_names)
for sheet in excel_file.sheet_names:
    df = excel_file.parse(sheet)
    print(f"[{sheet}] rows: {len(df)}")
    print(df.head(5))`;

    default:
      return `with open("${fileName}", "rb") as f:
    raw_bytes = f.read(16384)
try:
    text = raw_bytes.decode("utf-8")
    print("--- File Preview (First 16KB) ---")
    print(text)
except UnicodeDecodeError:
    print(f"Binary file ({fileSize} bytes). Analyzing byte header...")
    print(raw_bytes[:64].hex())`;
  }
}

// Universal extractor executing client-side extraction simulating the dynamic script reader
export async function analyzeFileWithScript(file: File): Promise<ProcessedFile> {
  const id = Date.now() + Math.random();
  const isImage = isImageFile(file);

  if (isImage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          id,
          name: file.name,
          type: file.type || 'image/jpeg',
          size: file.size,
          isImage: true,
          contentSnippet: `[Image File: ${file.name}]`,
          dataUrl: e.target?.result as string
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Non-image file: generate python reading code and extract contents
  const pythonScript = generatePythonReaderCode(file.name, file.type, file.size);
  let extractedContent = '';

  try {
    const text = await file.text();
    if (text && !text.includes('\0')) {
      extractedContent = text.slice(0, 32000);
    } else {
      // Binary fallback
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer.slice(0, 512));
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0') + ' ';
      }
      extractedContent = `[Binary Data Header (${file.size} bytes)]:\n${hex}`;
    }
  } catch {
    extractedContent = `[File uploaded: ${file.name} (${file.size} bytes)]`;
  }

  return {
    id,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    isImage: false,
    contentSnippet: extractedContent,
    generatedReaderCode: pythonScript
  };
}
