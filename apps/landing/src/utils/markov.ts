/**
 * Markov Chain-based Related Articles Recommender
 * 
 * Builds a word transition probability matrix from article text content.
 * Uses random walks through the matrix to generate token sets, then
 * scores other articles by token overlap (cosine similarity).
 * 
 * Falls back to category+recency matching for small corpora (<5 articles).
 */

// ─── Common English stopwords to exclude from tokenization ───────
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'it', 'as', 'was', 'are', 'be',
  'has', 'had', 'have', 'will', 'would', 'could', 'should', 'may',
  'might', 'can', 'this', 'that', 'these', 'those', 'not', 'no',
  'its', 'our', 'we', 'you', 'your', 'their', 'them', 'they', 'he',
  'she', 'him', 'her', 'his', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'than', 'too', 'very',
  'just', 'also', 'about', 'up', 'out', 'so', 'if', 'when', 'what',
  'which', 'who', 'how', 'where', 'do', 'does', 'did', 'been', 'being',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'under', 'over', 'then', 'once', 'here', 'there', 'why',
  'any', 'only', 'own', 'same', 'while', 'because', 'until', 'again',
  'further', 'read', 'full', 'article', 'learn', 'more',
])

// ─── Types ───────────────────────────────────────────────────────
export interface ArticleInput {
  id: number | string
  title: string
  excerpt?: string | null
  tags?: Array<{ tag: string }> | null
  category?: { name: string; slug?: string } | null
  slug?: string | null
  publishedAt?: string | null
  coverImage?: any
}

/** Map of word → Map of next_word → count */
type TransitionMatrix = Map<string, Map<string, number>>

// ─── Tokenization ────────────────────────────────────────────────

/**
 * Tokenize text into an array of lowercase words, stripping punctuation
 * and removing stopwords.
 */
export function tokenize(text: string): string[] {
  if (!text) return []
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w))
}

/**
 * Extract all meaningful tokens from an article (title + excerpt + tags).
 */
function articleTokens(article: ArticleInput): string[] {
  const parts: string[] = []
  if (article.title) parts.push(...tokenize(article.title))
  if (article.excerpt) parts.push(...tokenize(article.excerpt))
  if (article.tags) {
    for (const t of article.tags) {
      parts.push(...tokenize(t.tag))
    }
  }
  if (article.category?.name) {
    parts.push(...tokenize(article.category.name))
  }
  return parts
}

// ─── Transition Matrix ───────────────────────────────────────────

/**
 * Build a word transition matrix from all articles.
 * For each consecutive pair (word_i, word_j) in an article's tokens,
 * increment the transition count from word_i → word_j.
 */
export function buildTransitionMatrix(articles: ArticleInput[]): TransitionMatrix {
  const matrix: TransitionMatrix = new Map()

  for (const article of articles) {
    const tokens = articleTokens(article)
    for (let i = 0; i < tokens.length - 1; i++) {
      const current = tokens[i]
      const next = tokens[i + 1]
      if (!matrix.has(current)) {
        matrix.set(current, new Map())
      }
      const transitions = matrix.get(current)!
      transitions.set(next, (transitions.get(next) || 0) + 1)
    }
  }

  return matrix
}

/**
 * Perform a random walk from a starting word through the transition matrix.
 * Returns the set of words visited during the walk.
 */
function randomWalk(
  startWord: string,
  matrix: TransitionMatrix,
  steps: number
): Set<string> {
  const visited = new Set<string>()
  let current = startWord
  visited.add(current)

  for (let i = 0; i < steps; i++) {
    const transitions = matrix.get(current)
    if (!transitions || transitions.size === 0) break

    // Weighted random selection based on transition counts
    const entries = Array.from(transitions.entries())
    const totalWeight = entries.reduce((sum, [, count]) => sum + count, 0)
    let random = Math.random() * totalWeight
    let nextWord = entries[0][0]

    for (const [word, count] of entries) {
      random -= count
      if (random <= 0) {
        nextWord = word
        break
      }
    }

    visited.add(nextWord)
    current = nextWord
  }

  return visited
}

// ─── Scoring ─────────────────────────────────────────────────────

/**
 * Score how related a candidate article is to the current article,
 * using Markov-walked token overlap + category bonus.
 */
function scoreArticle(
  currentTokens: string[],
  candidateTokens: string[],
  walkedTokens: Set<string>,
  currentCategory: string | null,
  candidateCategory: string | null
): number {
  if (candidateTokens.length === 0) return 0

  const candidateSet = new Set(candidateTokens)

  // 1. Markov walk overlap: how many of the walked tokens appear in the candidate
  let walkOverlap = 0
  for (const token of walkedTokens) {
    if (candidateSet.has(token)) walkOverlap++
  }

  // 2. Direct token overlap (Jaccard-like): shared tokens between current and candidate
  const currentSet = new Set(currentTokens)
  let directOverlap = 0
  for (const token of candidateSet) {
    if (currentSet.has(token)) directOverlap++
  }
  const union = new Set([...currentSet, ...candidateSet]).size
  const jaccard = union > 0 ? directOverlap / union : 0

  // 3. Category bonus: same category gets a boost
  const categoryBonus = (currentCategory && candidateCategory && currentCategory === candidateCategory) ? 0.3 : 0

  // Combined score: weighted Markov walk + Jaccard + category
  const normalizedWalk = walkedTokens.size > 0 ? walkOverlap / walkedTokens.size : 0
  return (normalizedWalk * 0.5) + (jaccard * 0.3) + categoryBonus
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Get related articles using Markov chain-based recommendation.
 * 
 * @param current - The current article being viewed
 * @param allArticles - All published articles
 * @param matrix - Pre-built transition matrix from buildTransitionMatrix()
 * @param count - Number of related articles to return (default: 3)
 * @returns Array of related articles, sorted by relevance
 */
export function getRelatedArticles(
  current: ArticleInput,
  allArticles: ArticleInput[],
  matrix: TransitionMatrix,
  count: number = 3
): ArticleInput[] {
  // Filter out the current article (exclude if ID matches OR slug matches)
  const candidates = allArticles.filter(a => 
    a.id !== current.id && (a.slug == null || current.slug == null || a.slug !== current.slug)
  )

  if (candidates.length === 0) return []

  // For very small corpora, fall back to category + recency
  if (candidates.length < 4 || matrix.size < 10) {
    return fallbackRecommendation(current, candidates, count)
  }

  const currentToks = articleTokens(current)
  if (currentToks.length === 0) {
    return fallbackRecommendation(current, candidates, count)
  }

  // Perform multiple random walks from each of the current article's tokens
  const walkedTokens = new Set<string>()
  const walkSteps = 8
  const walksPerToken = 2

  for (const token of currentToks) {
    if (matrix.has(token)) {
      for (let w = 0; w < walksPerToken; w++) {
        const walked = randomWalk(token, matrix, walkSteps)
        for (const t of walked) walkedTokens.add(t)
      }
    }
  }

  // Score all candidates
  const currentCat = current.category?.slug || current.category?.name?.toLowerCase() || null
  const scored = candidates.map(candidate => {
    const candidateToks = articleTokens(candidate)
    const candidateCat = candidate.category?.slug || candidate.category?.name?.toLowerCase() || null
    const score = scoreArticle(currentToks, candidateToks, walkedTokens, currentCat, candidateCat)
    return { article: candidate, score }
  })

  // Sort by score descending, then by publishedAt descending (recency tiebreaker)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const dateA = a.article.publishedAt ? new Date(a.article.publishedAt).getTime() : 0
    const dateB = b.article.publishedAt ? new Date(b.article.publishedAt).getTime() : 0
    return dateB - dateA
  })

  return scored.slice(0, count).map(s => s.article)
}

/**
 * Fallback recommendation: same category first, then most recent.
 */
function fallbackRecommendation(
  current: ArticleInput,
  candidates: ArticleInput[],
  count: number
): ArticleInput[] {
  const currentCat = current.category?.slug || current.category?.name?.toLowerCase() || null

  // Prioritize same category, then sort by date
  const sorted = [...candidates].sort((a, b) => {
    const aCat = a.category?.slug || a.category?.name?.toLowerCase() || null
    const bCat = b.category?.slug || b.category?.name?.toLowerCase() || null
    const aMatch = (aCat === currentCat) ? 1 : 0
    const bMatch = (bCat === currentCat) ? 1 : 0
    if (bMatch !== aMatch) return bMatch - aMatch
    const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0
    const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0
    return dateB - dateA
  })

  return sorted.slice(0, count)
}
