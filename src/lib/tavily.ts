// {Created Tavily Search and Deep Research engine supporting mini and pro research models} [Commented by: Google AI Studio on 10/12/2026 10:51 AM]

export interface TavilySource {
  title: string;
  url: string;
  content?: string;
}

export interface ResearchResult {
  content: string;
  sources: TavilySource[];
  modelUsed: 'mini' | 'pro' | 'standard';
}

// Standard dynamic web search
export async function performDynamicSearch(query: string, apiKey: string, signal?: AbortSignal) {
  if (!apiKey) return { text: '', sources: [], rawResults: [] };

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'basic',
        time_range: 'week',
        include_images: true,
        include_image_descriptions: true,
        include_raw_content: 'markdown',
        chunks_per_source: 5
      }),
      signal
    });

    if (!response.ok) return { text: '', sources: [], rawResults: [] };
    const data = await response.json();
    const rawResults = data.results || [];
    const sources = rawResults.map((r: { title?: string; url: string; content?: string }) => ({
      title: r.title || r.url,
      url: r.url,
      content: r.content
    }));
    const text = rawResults.map((r: { title?: string; content?: string; raw_content?: string }) =>
      `Title: ${r.title}\nContent: ${r.content || r.raw_content}`
    ).join('\n\n') || 'No results found.';

    return { text, sources, rawResults };
  } catch (error) {
    console.error('Tavily search error:', error);
    return { text: '', sources: [], rawResults: [] };
  }
}

// Deep Research execution for # (mini) and ## (pro)
export async function runDeepResearch(
  query: string,
  modelType: 'mini' | 'pro',
  apiKey: string,
  onProgress?: (status: string) => void,
  signal?: AbortSignal
): Promise<ResearchResult> {
  if (!apiKey) {
    throw new Error('Tavily Error: Please configure your Tavily API Key in Account Settings or Sign Up.');
  }

  onProgress?.(`Initiating Deep Research (${modelType === 'pro' ? 'Pro Comprehensive' : 'Mini Fast'})...`);

  try {
    // Attempt Tavily research endpoint
    const startRes = await fetch('https://api.tavily.com/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        model: modelType
      }),
      signal
    });

    if (startRes.ok) {
      const startData = await startRes.json();
      const requestId = startData.request_id || startData.id;

      if (requestId) {
        onProgress?.('Researching multi-angle sources and analyzing findings...');
        let attempts = 0;
        while (attempts < 60) {
          if (signal?.aborted) throw new Error('Research aborted.');
          await new Promise((r) => setTimeout(r, 2000));
          attempts++;

          const pollRes = await fetch(`https://api.tavily.com/research/${requestId}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`
            },
            signal
          });

          if (pollRes.ok) {
            const data = await pollRes.json();
            if (data.status === 'completed') {
              const sources = (data.sources || []).map((s: { title?: string; url: string }) => ({
                title: s.title || s.url,
                url: s.url
              }));
              return {
                content: data.content || data.report || 'Research report completed.',
                sources,
                modelUsed: modelType
              };
            } else if (data.status === 'failed') {
              throw new Error('Deep Research task reported failure.');
            }
          }
        }
      }
    }

    // High-depth fallback if research task queue is unsupported on key tier
    onProgress?.(`Performing in-depth comprehensive search synthesis (${modelType})...`);
    const deepSearch = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'advanced',
        max_results: modelType === 'pro' ? 12 : 6,
        include_answer: true,
        include_raw_content: 'markdown'
      }),
      signal
    });

    if (!deepSearch.ok) {
      const errText = await deepSearch.text();
      throw new Error(`Tavily Error (${deepSearch.status}): ${errText}`);
    }

    const deepData = await deepSearch.json();
    const sources = (deepData.results || []).map((r: { title?: string; url: string }) => ({
      title: r.title || r.url,
      url: r.url
    }));

    const content = deepData.answer
      ? `### Deep Research Report (${modelType.toUpperCase()})\n\n${deepData.answer}\n\n#### Key Evidence & Detailed Synthesis:\n` +
        (deepData.results || []).map((r: { title?: string; content?: string }) => `**${r.title}**\n${r.content}`).join('\n\n')
      : (deepData.results || []).map((r: { title?: string; content?: string }) => `**${r.title}**\n${r.content}`).join('\n\n');

    return {
      content,
      sources,
      modelUsed: modelType
    };
  } catch (error: unknown) {
    const err = error as Error;
    if (err.name === 'AbortError') throw err;
    console.error('Deep research failure:', err);
    throw new Error(`Tavily Deep Research Error: ${err.message || 'Failed to complete research task'}`);
  }
}

// {Created extractUrlsWithTavily to retrieve raw webpage markdown via Tavily Extract API} [Commented by: Google AI Studio on 10/14/2026 10:35 AM]
export interface ExtractedUrlResult {
  url: string;
  rawContent: string;
  error?: string;
}

export async function extractUrlsWithTavily(
  urls: string[],
  apiKey: string,
  signal?: AbortSignal
): Promise<ExtractedUrlResult[]> {
  if (!apiKey || urls.length === 0) return [];

  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: apiKey,
        urls: urls
      }),
      signal
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Tavily Extract API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const successful: ExtractedUrlResult[] = (data.results || []).map((r: { url: string; raw_content?: string }) => ({
      url: r.url,
      rawContent: r.raw_content || 'No content extracted.'
    }));

    const failed: ExtractedUrlResult[] = (data.failed_results || []).map((f: { url: string; error?: string }) => ({
      url: f.url,
      rawContent: '',
      error: f.error || 'Failed to extract content'
    }));

    return [...successful, ...failed];
  } catch (err: unknown) {
    const e = err as Error;
    if (e.name === 'AbortError') throw e;
    console.error('Tavily URL extract failure:', err);
    return urls.map((u) => ({
      url: u,
      rawContent: '',
      error: e.message || 'Extraction failed'
    }));
  }
}

