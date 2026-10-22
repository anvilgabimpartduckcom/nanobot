// {Engineered robust client-side multi-format file extraction and AI reader code synthesizer for real-world document, tabular, and code processing} [Commented by: Google AI Studio on 19/10/2026 11:02 AM]

export interface ProcessedFile {
  id: number;
  fileId: string; // Stable UUID for local IndexedDB and cloud output linkage
  name: string;
  type: string;
  size: number;
  isImage: boolean;
  contentSnippet: string;
  outputType: 'text_extraction' | 'reader_script' | 'image_metadata';
  generatedReaderCode?: string;
  dataUrl?: string;
  originalFile?: File;
}

// Check if a file is an image
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name);
}

// Generate stable unique file ID
export function generateStableFileId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `file_${crypto.randomUUID()}`;
  }
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Synthesize python-style file inspection script for any arbitrary file format
export function generatePythonReaderCode(fileName: string, mimeType: string, fileSize: number): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'csv':
      return `import pandas as pd

# Load and inspect CSV dataset
df = pd.read_csv("${fileName}")
print(f"Dataset Shape: {df.shape[0]} rows, {df.shape[1]} columns")
print("Columns:", df.columns.tolist())
print("\n--- Summary Statistics ---")
print(df.describe(include='all'))
print("\n--- First 10 Rows ---")
print(df.head(10).to_string())`;

    case 'tsv':
      return `import pandas as pd

# Load Tab-Separated Values (TSV) dataset
df = pd.read_csv("${fileName}", sep='\\t')
print(f"Shape: {df.shape}")
print("Columns:", df.columns.tolist())
print(df.head(10).to_string())`;

    case 'json':
      return `import json

# Parse JSON document structure
with open("${fileName}", "r", encoding="utf-8") as f:
    data = json.load(f)

if isinstance(data, list):
    print(f"Root: Array with {len(data)} items")
    if len(data) > 0 and isinstance(data[0], dict):
        print("Sample Item Keys:", list(data[0].keys()))
elif isinstance(data, dict):
    print(f"Root: Object with {len(data)} keys:", list(data.keys())[:15])

print("\n--- Formatted JSON Preview ---")
print(json.dumps(data, indent=2)[:4000])`;

    case 'pdf':
      return `import pypdf

# Extract text and layout from PDF
reader = pypdf.PdfReader("${fileName}")
total_pages = len(reader.pages)
print(f"Total Pages: {total_pages}")

extracted_text = []
for idx, page in enumerate(reader.pages[:10]):
    text = page.extract_text() or ""
    print(f"--- Page {idx + 1} ({len(text)} chars) ---")
    print(text[:1500])
    extracted_text.append(text)`;

    case 'xlsx':
    case 'xls':
      return `import pandas as pd

# Inspect multi-sheet Excel workbook
excel_file = pd.ExcelFile("${fileName}")
print("Worksheet Names:", excel_file.sheet_names)

for sheet in excel_file.sheet_names:
    df = excel_file.parse(sheet)
    print(f"\n[Sheet: {sheet}] - {df.shape[0]} rows x {df.shape[1]} cols")
    print(df.head(5).to_string())`;

    case 'docx':
      return `from docx import Document

# Read Word Document paragraphs and tables
doc = Document("${fileName}")
print(f"Total Paragraphs: {len(doc.paragraphs)}")

for i, p in enumerate(doc.paragraphs[:25]):
    if p.text.strip():
        print(f"[{i+1}] {p.text.strip()}")

if doc.tables:
    print(f"\nFound {len(doc.tables)} Tables")`;

    case 'txt':
    case 'md':
    case 'markdown':
    case 'log':
      return `with open("${fileName}", "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

lines = content.splitlines()
print(f"Total Lines: {len(lines)} | Total Size: {len(content)} characters")
print("--- File Content Preview ---")
print("\\n".join(lines[:60]))`;

    case 'py':
    case 'js':
    case 'ts':
    case 'tsx':
    case 'jsx':
    case 'html':
    case 'css':
    case 'sql':
    case 'sh':
      return `# Source code inspection for ${fileName}
with open("${fileName}", "r", encoding="utf-8", errors="replace") as f:
    source_code = f.read()

print(f"Source file: {len(source_code.splitlines())} lines")
print(source_code[:5000])`;

    case 'sqlite':
    case 'db':
    case 'sqlite3':
      return `import sqlite3

# Inspect SQLite Database schema and tables
conn = sqlite3.connect("${fileName}")
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tables:", [t[0] for t in tables])

for (tbl,) in tables:
    cursor.execute(f"PRAGMA table_info({tbl})")
    cols = cursor.fetchall()
    print(f"Table [{tbl}] Columns:", [c[1] for c in cols])
    cursor.execute(f"SELECT * FROM {tbl} LIMIT 3")
    print("Sample Rows:", cursor.fetchall())`;

    default:
      return `# General file inspection (${fileSize} bytes)
with open("${fileName}", "rb") as f:
    raw_bytes = f.read(32768)

try:
    text = raw_bytes.decode("utf-8")
    print("--- Text Content Preview ---")
    print(text[:3000])
except UnicodeDecodeError:
    # Binary inspection
    import string
    printable = "".join(chr(b) if chr(b) in string.printable and chr(b) not in "\\r\\x0b\\x0c" else " " for b in raw_bytes)
    words = [w for w in printable.split() if len(w) >= 4]
    print(f"Binary format. Extracted strings ({len(words)} found):")
    print(" ".join(words[:150]))`;
  }
}

// Helper: Extract text streams from raw PDF buffer client-side
function extractTextFromPdfBuffer(buffer: ArrayBuffer): string {
  try {
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('latin1');
    const raw = decoder.decode(uint8);

    const extracted: string[] = [];

    // Extract text from standard PDF Tj and TJ operators
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;
    while ((match = tjRegex.exec(raw)) !== null) {
      if (match[1] && match[1].trim()) {
        extracted.push(match[1].trim());
      }
    }

    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = tjArrayRegex.exec(raw)) !== null) {
      const inner = match[1];
      const parts = inner.match(/\(([^)]+)\)/g);
      if (parts) {
        const line = parts.map((p) => p.slice(1, -1)).join('').trim();
        if (line) extracted.push(line);
      }
    }

    if (extracted.length > 0) {
      return extracted.join(' ').replace(/\s+/g, ' ').slice(0, 24000);
    }

    // Fallback: search for readable ASCII / UTF-8 text strings of length >= 4
    const textMatches = raw.match(/[A-Za-z0-9 ,.;:!?'"()/\-_]{5,}/g);
    if (textMatches && textMatches.length > 5) {
      const filtered = textMatches
        .filter((s) => !/obj|endobj|stream|endstream|xref|trailer|startxref/i.test(s.trim()))
        .slice(0, 150)
        .join(' ');
      if (filtered.length > 50) return filtered.slice(0, 20000);
    }
  } catch (e) {
    console.warn('PDF client extraction note:', e);
  }
  return '';
}

// {Iterative tag sanitization loop and angle bracket removal resolving CodeQL js/incomplete-multi-character-sanitization} [Commented by: Google AI Studio on 22/10/2026 04:47 AM]
function sanitizeXmlTagContent(input: string): string {
  let previous: string;
  let text = input;
  do {
    previous = text;
    text = text.replace(/<[^>]*>/g, '');
  } while (text !== previous);
  return text.replace(/[<>]/g, '');
}

// Helper: Extract text from Office XML documents (DOCX, XLSX)
function extractTextFromOfficeBuffer(buffer: ArrayBuffer, ext: string): string {
  try {
    const uint8 = new Uint8Array(buffer);
    const decoder = new TextDecoder('utf-8');
    const raw = decoder.decode(uint8);

    if (ext === 'docx') {
      // Word documents contain <w:t>...</w:t> tags
      const wtMatches = raw.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (wtMatches && wtMatches.length > 0) {
        const text = wtMatches
          .map((m) => sanitizeXmlTagContent(m))
          .join(' ')
          .replace(/\s+/g, ' ');
        if (text.length > 20) return text.slice(0, 24000);
      }
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Excel workbooks contain <t>...</t> tags in sharedStrings.xml
      const tMatches = raw.match(/<t[^>]*>([^<]+)<\/t>/g);
      if (tMatches && tMatches.length > 0) {
        const text = tMatches
          .map((m) => sanitizeXmlTagContent(m))
          .filter((t) => t.trim().length > 0)
          .slice(0, 300)
          .join(', ');
        if (text.length > 20) return `[Extracted Spreadsheet Cell Values]:\n${text.slice(0, 24000)}`;
      }
    }
  } catch (e) {
    console.warn('Office extraction note:', e);
  }
  return '';
}

// Universal extractor executing client-side extraction simulating dynamic script reader
export async function analyzeFileWithScript(file: File): Promise<ProcessedFile> {
  const id = Date.now() + Math.random();
  const fileId = generateStableFileId();
  const isImage = isImageFile(file);

  if (isImage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          id,
          fileId,
          name: file.name,
          type: file.type || 'image/jpeg',
          size: file.size,
          isImage: true,
          contentSnippet: `[Image File: ${file.name} (${file.size} bytes)]`,
          outputType: 'image_metadata',
          dataUrl: e.target?.result as string,
          originalFile: file
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Non-image file: generate python reading code and extract contents
  const pythonScript = generatePythonReaderCode(file.name, file.type, file.size);
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  let extractedContent = '';

  try {
    if (ext === 'pdf') {
      const buffer = await file.arrayBuffer();
      const pdfText = extractTextFromPdfBuffer(buffer);
      if (pdfText) {
        extractedContent = `[Extracted PDF Document Content (${file.name}, ${file.size} bytes)]:\n${pdfText}`;
      } else {
        extractedContent = `[PDF Document: ${file.name} (${file.size} bytes). The AI model will execute Python reader code to inspect document pages.]`;
      }
    } else if (ext === 'docx' || ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      const officeText = extractTextFromOfficeBuffer(buffer, ext);
      if (officeText) {
        extractedContent = `[Extracted Office Document Content (${file.name})]:\n${officeText}`;
      } else {
        extractedContent = `[Office Document: ${file.name} (${file.size} bytes). Ready for python reader execution.]`;
      }
    } else {
      // Standard text / code / tabular data decoding
      const text = await file.text();
      if (text && !text.includes('\0')) {
        if (ext === 'csv' || ext === 'tsv') {
          const lines = text.split('\n').filter((l) => l.trim().length > 0);
          const header = lines[0] || '';
          const sampleRows = lines.slice(1, 11).join('\n');
          extractedContent = `[Tabular File: ${file.name} | Total Rows: ~${lines.length}]\nHeader: ${header}\n\nSample Data (First 10 rows):\n${sampleRows}\n\nFull Content:\n${text.slice(0, 24000)}`;
        } else {
          extractedContent = text.slice(0, 32000);
        }
      } else {
        // Binary or archive fallback: extract printable ASCII strings
        const buffer = await file.arrayBuffer();
        const uint8 = new Uint8Array(buffer.slice(0, 65536));
        let printable = '';
        for (let i = 0; i < uint8.length; i++) {
          const byte = uint8[i];
          if (byte >= 32 && byte <= 126) {
            printable += String.fromCharCode(byte);
          } else if (byte === 10 || byte === 13) {
            printable += ' ';
          }
        }
        const words = printable.split(/\s+/).filter((w) => w.length >= 4);
        if (words.length > 0) {
          extractedContent = `[Binary Document (${file.name}, ${file.size} bytes). Extracted text strings]:\n${words.slice(0, 200).join(' ')}`;
        } else {
          extractedContent = `[Binary File uploaded: ${file.name} (${file.size} bytes)]`;
        }
      }
    }
  } catch (err) {
    console.warn('File reading error:', err);
    extractedContent = `[File uploaded: ${file.name} (${file.size} bytes)]`;
  }

  return {
    id,
    fileId,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    isImage: false,
    contentSnippet: extractedContent,
    outputType: pythonScript ? 'reader_script' : 'text_extraction',
    generatedReaderCode: pythonScript,
    originalFile: file
  };
}
