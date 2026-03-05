// Interface describing a single arXiv paper
// In Python this would be a @dataclass
export interface ArxivPaper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  published: string;
  updated: string;
  categories: string[];
  url: string;
  pdfUrl: string;
}

// Search papers on arXiv by query string
// All parameters are explicitly typed — the main difference from Python
export async function searchArxiv(
  query: string,
  maxResults: number = 10,
  sortBy: "relevance" | "lastUpdatedDate" | "submittedDate" = "relevance"
): Promise<ArxivPaper[]> {

  const params = new URLSearchParams({
    search_query: query,
    max_results: maxResults.toString(),
    sortBy: sortBy,
    sortOrder: "descending",
  });

  const url = `https://export.arxiv.org/api/query?${params}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status}`);
  }

  const xml = await response.text();
  return parseArxivXml(xml);
}

// Fetch full details of a single paper by its arXiv ID
export async function getArxivPaper(arxivId: string): Promise<ArxivPaper> {
  const url = `https://export.arxiv.org/api/query?id_list=${arxivId}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status}`);
  }

  const xml = await response.text();
  const papers = parseArxivXml(xml);

  if (papers.length === 0) {
    throw new Error(`Paper not found: ${arxivId}`);
  }

  return papers[0];
}

// Parse the Atom/XML feed returned by arXiv API
// Each paper is wrapped in an <entry> tag
function parseArxivXml(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];

  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) || [];

  for (const entry of entries) {
    const id = extractTag(entry, "id")
      ?.replace("http://arxiv.org/abs/", "")
      ?.trim() || "";

    const title = extractTag(entry, "title")
      ?.replace(/\s+/g, " ")
      ?.trim() || "";

    const abstract = extractTag(entry, "summary")
      ?.replace(/\s+/g, " ")
      ?.trim() || "";

    const published = extractTag(entry, "published") || "";
    const updated = extractTag(entry, "updated") || "";

    // Authors appear as multiple <author><name>...</name></author> blocks
    const authorMatches = entry.match(/<name>(.*?)<\/name>/g) || [];
    const authors = authorMatches.map(a =>
      a.replace(/<\/?name>/g, "").trim()
    );

    // Categories appear as <category term="cs.AI" .../>
    const categoryMatches = entry.match(/category term="([^"]+)"/g) || [];
    const categories = categoryMatches.map(c =>
      c.replace(/category term="|"/g, "")
    );

    papers.push({
      id,
      title,
      authors,
      abstract,
      published: published.split("T")[0], // date only, strip time
      updated: updated.split("T")[0],
      categories,
      url: `https://arxiv.org/abs/${id}`,
      pdfUrl: `https://arxiv.org/pdf/${id}`,
    });
  }

  return papers;
}

// Helper: extract text content from an XML tag
function extractTag(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  return match?.[1];
}
