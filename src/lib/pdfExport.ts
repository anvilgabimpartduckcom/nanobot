// Implemented formatted PDF export for active noodle chats using jsPDF [Commented by: Google AI Studio on 30/10/2026 10:48 AM]

import { jsPDF } from 'jspdf';

export interface ExportChatMessage {
  role: 'user' | 'ai';
  content: string | Array<{ type: string; text?: string }>;
  sources?: Array<{ title: string; url: string }>;
  reasoning?: string;
}

export interface ExportChatSession {
  id: string;
  title: string;
  messages: ExportChatMessage[];
  updated?: number;
}

function cleanMarkdownForPdf(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/```[a-z]*\n([\s\S]*?)```/gi, '$1') // preserve code content
    .replace(/^#{1,6}\s+(.*)$/gm, '$1') // remove markdown headers #
    .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold asterisks
    .replace(/\*(.*?)\*/g, '$1') // remove italic asterisks
    .replace(/`([^`]+)`/g, '$1') // remove inline backticks
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)') // format links
    .replace(/<Search\d*>.*?<\/Search\d*>/gi, '') // strip search tool tags
    .replace(/<Scrap\d*>.*?<\/Scrap\d*>/gi, '') // strip scrap tool tags
    .trim();
}

export function exportNoodleAsPdf(chat: ExportChatSession): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 16;
  const printableWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 12) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(5, 150, 105); // emerald-600
  doc.text('nanobot', margin, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('A privacy first, source available AI chat bot', margin, y);
  y += 7;

  // Title Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  const titleText = doc.splitTextToSize(`Noodle: ${chat.title || 'Untitled Noodle'}`, printableWidth);
  ensureSpace(titleText.length * 6 + 10);
  doc.text(titleText, margin, y);
  y += titleText.length * 6 + 2;

  // Timestamp
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(120, 120, 120);
  const dateStr = new Date(chat.updated || Date.now()).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata'
  });
  doc.text(`Exported on: ${dateStr}`, margin, y);
  y += 6;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Messages Loop
  chat.messages.forEach((msg, idx) => {
    const isUser = msg.role === 'user';
    const senderLabel = isUser ? 'User' : 'nanobot AI';
    const textRaw = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
      ? msg.content.map((c) => c.text || '').join(' ')
      : '';
    const cleanContent = cleanMarkdownForPdf(textRaw);

    // Sender Tag
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    if (isUser) {
      doc.setTextColor(30, 64, 175); // blue-800
      doc.text(`[Message ${idx + 1}] ${senderLabel}`, margin, y);
    } else {
      doc.setTextColor(4, 120, 87); // emerald-700
      doc.text(`[Message ${idx + 1}] ${senderLabel}`, margin, y);
    }
    y += 5;

    // Reasoning Block (if present for AI message)
    if (!isUser && msg.reasoning) {
      const cleanReasoning = cleanMarkdownForPdf(msg.reasoning);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 110);
      const reasoningLines = doc.splitTextToSize(`Thinking Process: ${cleanReasoning}`, printableWidth - 6);
      
      ensureSpace(reasoningLines.length * 4 + 6);
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(248, 248, 248);
      doc.roundedRect(margin, y - 2, printableWidth, reasoningLines.length * 4 + 4, 1.5, 1.5, 'FD');
      doc.text(reasoningLines, margin + 3, y + 2);
      y += reasoningLines.length * 4 + 7;
    }

    // Message Body
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(35, 35, 35);
    const bodyLines = doc.splitTextToSize(cleanContent || '(Empty message)', printableWidth);

    for (const line of bodyLines) {
      ensureSpace(5);
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 3;

    // Citations / Sources
    if (msg.sources && msg.sources.length > 0) {
      ensureSpace(msg.sources.length * 4.5 + 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 80, 80);
      doc.text('Sources Cited:', margin, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(37, 99, 235); // blue-600
      msg.sources.forEach((s, sIdx) => {
        const sourceLine = doc.splitTextToSize(`[${sIdx + 1}] ${s.title || s.url} - ${s.url}`, printableWidth);
        for (const sL of sourceLine) {
          ensureSpace(4);
          doc.text(sL, margin + 2, y);
          y += 3.8;
        }
      });
      y += 2;
    }

    // Inter-message spacing
    y += 5;
    ensureSpace(8);
    doc.setDrawColor(235, 235, 235);
    doc.line(margin, y - 2, pageWidth - margin, y - 2);
    y += 4;
  });

  // Page Numbers Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    const footerText = `Page ${i} of ${totalPages}  •  Exported from nanobot (https://nanobot-chatbot.netlify.app)`;
    doc.text(footerText, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  // Safe file name and download
  const safeTitle = (chat.title || 'noodle')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 40);
  const fileDate = new Date().toISOString().split('T')[0];
  doc.save(`nanobot-${safeTitle}-${fileDate}.pdf`);
}
