// Fish Audio S2.1 Pro voice registry, Random voice tag resolver, speech sanitizer, and OpenRouter TTS API client [Commented by: Google AI Studio on 28/11/2026 06:46]

export interface FishVoiceOption {
  id: string;
  name: string;
  description: string;
}

export const RANDOM_VOICE_ID = 'random';

export const FISH_VOICES: FishVoiceOption[] = [
  { id: '98655a12fa944e26b274c535e5e03842', name: 'Egirl', description: 'Expressive high-energy conversational voice' },
  { id: 'b347db033a6549378b48d00acb0d06cd', name: 'Selene', description: 'Balanced, clear modern female voice' },
  { id: 'bf322df2096a46f18c579d0baa36f41d', name: 'Adrian', description: 'Warm, articulate male narrator voice' },
  { id: '933563129e564b19a115bedd57b7406a', name: 'Sarah', description: 'Friendly, calm conversational voice' },
  { id: '536d3a5e000945adb7038665781a4aca', name: 'Ethan', description: 'Crisp, grounded male voice' },
  { id: 'e3cd384158934cc9a01029cd7d278634', name: 'Laura', description: 'Natural, steady storytelling voice' },
  { id: '79d0bd3e4e5444b18f7b6d89b5927bf1', name: 'Jordan', description: 'Versatile, engaging general-purpose voice' },
  { id: '9a9cf47702da476aa4629e2506d4a857', name: 'Hannah', description: 'Soft, expressive narration voice' },
];

export const ALL_VOICE_CHOICES: FishVoiceOption[] = [
  {
    id: RANDOM_VOICE_ID,
    name: 'Random',
    description: 'Model dynamically selects the best matching voice per response',
  },
  ...FISH_VOICES,
];

export function isValidVoiceId(voiceId: string): boolean {
  if (voiceId === RANDOM_VOICE_ID) return true;
  return FISH_VOICES.some((v) => v.id === voiceId);
}

export function getVoiceOptionById(voiceId: string): FishVoiceOption {
  if (voiceId === RANDOM_VOICE_ID) return ALL_VOICE_CHOICES[0];
  return FISH_VOICES.find((v) => v.id === voiceId) || ALL_VOICE_CHOICES[0];
}

// Build Fish Audio S2.1 Pro formatting and Random voice instructions for the Nemotron model [Commented by: Google AI Studio on 28/11/2026 06:46]
export function buildVoiceSystemInstructions(selectedVoiceId: string): string {
  const voiceNamesList = FISH_VOICES.map((v) => v.name).join(', ');
  const randomVoiceRule =
    selectedVoiceId === RANDOM_VOICE_ID
      ? `\n- Voice Selection (Random Mode ACTIVE): You have access to these voices: ${voiceNamesList}. At the very start of your response, output exactly one block in the format <voice>(voice name)</voice> selecting the single voice name from that list best suited for your response (for example: <voice>Adrian</voice>). Never invent a voice outside that list.`
      : '';

  return `\n8. Voice Chat Mode (ACTIVE — Fish Audio S2.1 Pro Synthesis):
- Your response will be converted into natural human speech via Fish Audio S2.1 Pro. Write conversationally in plain spoken prose (avoid heavy markdown tables, raw bullet clutter, and long ASCII blocks unless code was requested).
- Use square-bracket emotion, delivery, and pause instructions directly inline where helpful, such as [calm], [curious], [excited], [serious], [empathetic], [confident], [soft tone], [whispering], [speaking slowly], [short pause], [long pause], or natural combined phrases like [calm but authoritative].
- Place square-bracket instructions before the sentence or clause they apply to. Use at most one primary emotion (plus optional delivery cue) per sentence, avoid stacking conflicting emotions, and use tags naturally without overusing them.${randomVoiceRule}`;
}

// Extract <voice>(name)</voice> tag when Random voice is active and strip it cleanly from transcript/TTS [Commented by: Google AI Studio on 28/11/2026 06:46]
export function extractVoiceChoiceFromResponse(
  rawText: string,
  selectedVoiceId: string
): {
  cleanedText: string;
  resolvedVoiceId: string;
  resolvedVoiceName: string;
} {
  let cleanedText = rawText;
  let chosenNameFromTag: string | null = null;

  const voiceTagRegex = /<voice>\s*\(?\s*([a-zA-Z0-9 _-]+?)\s*\)?\s*<\/voice>/i;
  const match = rawText.match(voiceTagRegex);
  if (match && match[1]) {
    chosenNameFromTag = match[1].trim();
    cleanedText = rawText.replace(/<voice>[\s\S]*?<\/voice>/gi, '').trim();
  }

  if (selectedVoiceId !== RANDOM_VOICE_ID) {
    const fixed = getVoiceOptionById(selectedVoiceId);
    return {
      cleanedText,
      resolvedVoiceId: fixed.id,
      resolvedVoiceName: fixed.name,
    };
  }

  if (chosenNameFromTag) {
    const matchedVoice = FISH_VOICES.find(
      (v) => v.name.toLowerCase() === chosenNameFromTag!.toLowerCase()
    );
    if (matchedVoice) {
      return {
        cleanedText,
        resolvedVoiceId: matchedVoice.id,
        resolvedVoiceName: matchedVoice.name,
      };
    }
  }

  const fallback = FISH_VOICES[Math.floor(Math.random() * FISH_VOICES.length)];
  return {
    cleanedText,
    resolvedVoiceId: fallback.id,
    resolvedVoiceName: fallback.name,
  };
}

// Convert markdown answer into clean spoken input while preserving Fish Audio [emotion/delivery] square brackets [Commented by: Google AI Studio on 28/11/2026 06:46]
export function prepareFishAudioInput(transcriptText: string): string {
  return transcriptText
    .replace(/<voice>[\s\S]*?<\/voice>/gi, '')
    .replace(/```[\s\S]*?```/g, ' [short pause] ')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1') // Keep link text, drop URL
    .replace(/\[\d+\]/g, '') // Strip inline numeric citations [1], [2] while preserving emotion brackets like [calm]
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`>#]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export interface FishSpeechResult {
  audioBlob: Blob;
  audioUrl: string;
  generationId: string | null;
}

function interpretSpeechError(status: number, rawBody: string): string {
  let msg = '';
  try {
    const parsed = JSON.parse(rawBody) as { error?: { message?: string }; message?: string };
    msg = parsed?.error?.message || parsed?.message || '';
  } catch {}

  if (status === 400) {
    return msg ? `Speech Error (400): ${msg}` : 'Speech Error (400): Unsupported Fish Audio TTS request parameter.';
  }
  if (status === 401 || status === 403) {
    return 'Speech Authentication Error: Invalid or expired OpenRouter API key.';
  }
  if (status === 429) {
    return 'Speech Rate Limit (429): Fish Audio free tier is temporarily busy. Please try again in a moment.';
  }
  if (status >= 500) {
    return `Speech Service Error (${status}): Fish Audio TTS service is temporarily unavailable.`;
  }
  return msg || `Speech Generation Error (HTTP ${status}).`;
}

// Synthesize speech via OpenRouter POST /api/v1/audio/speech for fish-audio/s2.1-pro-free:free [Commented by: Google AI Studio on 28/11/2026 06:46]
export async function synthesizeFishSpeech(params: {
  openrouterKey: string;
  text: string;
  voiceId: string;
  modelTrainingEnabled: boolean;
  signal?: AbortSignal;
}): Promise<FishSpeechResult> {
  const { openrouterKey, text, voiceId, modelTrainingEnabled, signal } = params;
  const preparedInput = prepareFishAudioInput(text);
  if (!preparedInput) {
    throw new Error('Nothing to synthesize into speech.');
  }

  const sendSpeechRequest = async (includeProviderOptOut: boolean, includeVoiceId: boolean): Promise<Response> => {
    const payload: Record<string, unknown> = {
      model: 'fish-audio/s2.1-pro-free:free',
      input: preparedInput,
      response_format: 'mp3',
      speed: 1.0,
    };
    if (includeVoiceId && voiceId && voiceId !== RANDOM_VOICE_ID) {
      payload.voice = voiceId;
    }
    if (includeProviderOptOut) {
      payload.provider = { data_collection: 'deny' };
    }

    return fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openrouterKey}`,
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://nanobot.app',
        'X-Title': 'nanobot',
      },
      body: JSON.stringify(payload),
      signal,
    });
  };

  const optOutTraining = !modelTrainingEnabled;
  let attempt = 0;
  let includeProvider = optOutTraining;
  let includeVoice = true;
  let res: Response | null = null;

  while (attempt < 3) {
    attempt += 1;
    res = await sendSpeechRequest(includeProvider, includeVoice);

    if (res.ok) break;

    if (res.status === 400 && includeProvider) {
      includeProvider = false;
      continue;
    }

    if (res.status === 400 && includeVoice) {
      includeVoice = false;
      continue;
    }

    if ((res.status === 429 || res.status >= 500) && attempt < 3 && !signal?.aborted) {
      const backoffMs = 650 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      continue;
    }

    break;
  }

  if (!res || !res.ok) {
    const errText = res ? await res.text().catch(() => '') : 'Network error';
    throw new Error(interpretSpeechError(res?.status || 500, errText));
  }

  const generationId = res.headers.get('X-Generation-Id') || res.headers.get('x-generation-id');
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const errPayload = await res.text().catch(() => '');
    throw new Error(interpretSpeechError(500, errPayload || 'Unexpected JSON response instead of audio bytes.'));
  }

  const audioBuffer = await res.arrayBuffer();
  if (!audioBuffer || audioBuffer.byteLength === 0) {
    throw new Error('Fish Audio returned empty audio data.');
  }

  const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
  const audioUrl = URL.createObjectURL(audioBlob);

  return {
    audioBlob,
    audioUrl,
    generationId,
  };
}
