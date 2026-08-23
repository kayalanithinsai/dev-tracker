const GITHUB_API = 'https://api.github.com';

export interface GitHubSettings {
  owner: string;
  repo: string;
  branch: string;
  token: string;
}

interface GitHubContentResponse {
  sha?: string;
  html_url?: string;
}

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2026-03-10',
    'Content-Type': 'application/json'
  };
}

export async function testGitHubConnection(settings: GitHubSettings): Promise<string> {
  validateSettings(settings);
  const response = await fetch(`${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`, {
    headers: headers(settings.token)
  });
  if (!response.ok) throw await githubError(response, 'Unable to access repository');
  const data = await response.json();
  return data.full_name || `${settings.owner}/${settings.repo}`;
}

export async function getGitHubFile(settings: GitHubSettings, path: string): Promise<GitHubContentResponse | null> {
  validateSettings(settings);
  const response = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}?ref=${encodeURIComponent(settings.branch)}`,
    { headers: headers(settings.token) }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw await githubError(response, 'Unable to read existing GitHub file');
  return response.json();
}

export async function createOrUpdateGitHubFile(
  settings: GitHubSettings,
  path: string,
  content: string,
  message: string,
  existingSha?: string
): Promise<{ sha: string; htmlUrl: string }> {
  validateSettings(settings);

  const response = await fetch(
    `${GITHUB_API}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`,
    {
      method: 'PUT',
      headers: headers(settings.token),
      body: JSON.stringify({
        message,
        content: btoa(unescape(encodeURIComponent(content))),
        branch: settings.branch,
        ...(existingSha ? { sha: existingSha } : {})
      })
    }
  );

  if (!response.ok) throw await githubError(response, 'GitHub push failed');
  const data = await response.json();
  return {
    sha: data.content?.sha || '',
    htmlUrl: data.content?.html_url || `https://github.com/${settings.owner}/${settings.repo}/blob/${settings.branch}/${path}`
  };
}

function validateSettings(settings: GitHubSettings) {
  if (!settings.owner || !settings.repo || !settings.branch || !settings.token) {
    throw new Error('Complete GitHub settings before continuing.');
  }
}

async function githubError(response: Response, fallback: string): Promise<Error> {
  try {
    const data = await response.json();
    const message = data?.message ? `${fallback}: ${data.message}` : `${fallback} (${response.status})`;
    return new Error(message);
  } catch {
    return new Error(`${fallback} (${response.status})`);
  }
}

export function makeGitHubPath(topic?: string, subtopic?: string, difficulty?: string, title?: string): string {
  const topicPart = slug(topic || 'uncategorized');
  const subtopicPart = slug(subtopic || 'general');
  const difficultyPart = slug(difficulty || 'unspecified');
  const titlePart = slug(title || 'solution');
  return `${topicPart}/${subtopicPart}/${difficultyPart}/${titlePart}.cpp`;
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'item';
}
