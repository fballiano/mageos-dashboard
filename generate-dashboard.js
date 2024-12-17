import { writeFile } from 'fs/promises';
import { mkdir } from 'fs/promises';

const GITHUB_ORG = 'mage-os';

async function fetchOrgData() {
  const query = `
    query ($org: String!) {
      organization(login: $org) {
        repositories(first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
          nodes {
            name
            url
            updatedAt
            issues(states: OPEN, first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
              totalCount
              nodes {
                title
                url
                createdAt
                updatedAt
                labels(first: 5) {
                  nodes {
                    name
                    color
                  }
                }
              }
            }
            pullRequests(states: OPEN, first: 100, orderBy: {field: UPDATED_AT, direction: DESC}) {
              totalCount
              nodes {
                title
                url
                createdAt
                updatedAt
                author {
                  login
                }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: { org: GITHUB_ORG } })
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.statusText}`);
  }

  return response.json();
}

function generateHTML(data) {
    const repos = data.data.organization.repositories.nodes;
    const lastUpdate = new Date().toISOString();

    // Filter repos with open issues or PRs
    const activeRepos = repos.filter(repo =>
        repo.issues.totalCount > 0 || repo.pullRequests.totalCount > 0
    );

    return `
    <!DOCTYPE html>
    <html lang="en" data-theme="light">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mage-OS Dashboard</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
        <style>
          :root {
            --spacing: 0.75rem;
            --typography-spacing-vertical: 1rem;
          }
          
          body { 
            max-width: 1400px; 
            margin: 0 auto; 
            padding: 1rem;
          }

          h1 { font-size: 1.75rem; }
          h3 { font-size: 1.25rem; margin: 0; }
          h4 { font-size: 1rem; margin: 0.75rem 0 0.5rem 0; }

          .grid-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }

          @media (max-width: 768px) {
            .grid-container {
              grid-template-columns: 1fr;
            }
          }

          .issues, .prs { 
            margin-top: 0.75rem;
          }

          ul {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          li { 
            padding: 0.5rem;
            margin: 0.35rem 0;
            background: var(--card-sectionning-background-color);
            border-radius: var(--border-radius);
          }

          .date { 
            color: var(--muted-color);
            font-size: 0.8em;
            margin-top: 0.25rem;
          }

          .label { 
            display: inline-block;
            padding: 0.15rem 0.5rem;
            border-radius: 1rem;
            font-size: 0.75em;
            margin: 0.15rem 0.15rem 0.15rem 0;
          }

          .last-update {
            text-align: right;
            color: var(--muted-color);
            font-size: 0.8em;
            margin: 0.5rem 0 1.5rem 0;
          }

          a {
            text-decoration: none;
          }

          a:hover {
            text-decoration: underline;
          }

          article[data-theme="light"] {
            margin-bottom: 0;
          }
        </style>
      </head>
      <body>
        <header class="container">
          <h1>Mage-OS Dashboard</h1>
          <p class="last-update">Last updated: ${new Date(lastUpdate).toLocaleString()}</p>
        </header>
        <main class="container">
          <div class="grid-container">
            ${activeRepos.map(repo => `
              <article data-theme="light">
                <header>
                  <h3><a href="${repo.url}" target="_blank">${repo.name}</a></h3>
                </header>
                ${repo.issues.totalCount > 0 ? `
                  <div class="issues">
                    <h4>Open Issues (${repo.issues.totalCount})</h4>
                    <ul>
                      ${repo.issues.nodes.map(issue => `
                        <li>
                          <a href="${issue.url}" target="_blank">${issue.title}</a>
                          ${issue.labels.nodes.length > 0 ? `
                            <div>
                              ${issue.labels.nodes.map(label => `
                                <span class="label" style="background: #${label.color}15; color: #${label.color};">${label.name}</span>
                              `).join('')}
                            </div>
                          ` : ''}
                          <div class="date">
                            Created: ${new Date(issue.createdAt).toLocaleDateString()}
                            | Updated: ${new Date(issue.updatedAt).toLocaleDateString()}
                          </div>
                        </li>
                      `).join('')}
                    </ul>
                  </div>
                ` : ''}
                ${repo.pullRequests.totalCount > 0 ? `
                  <div class="prs">
                    <h4>Open Pull Requests (${repo.pullRequests.totalCount})</h4>
                    <ul>
                      ${repo.pullRequests.nodes.map(pr => `
                        <li>
                          <a href="${pr.url}" target="_blank">${pr.title}</a>
                          <div class="date">
                            By: ${pr.author.login}
                            | Created: ${new Date(pr.createdAt).toLocaleDateString()}
                            | Updated: ${new Date(pr.updatedAt).toLocaleDateString()}
                          </div>
                        </li>
                      `).join('')}
                    </ul>
                  </div>
                ` : ''}
              </article>
            `).join('')}
          </div>
        </main>
      </body>
    </html>
  `;
}

async function main() {
  try {
    const data = await fetchOrgData();
    const html = generateHTML(data);
    
    await mkdir('dist', { recursive: true });
    await writeFile('dist/index.html', html);
    console.log('Dashboard generated successfully!');
  } catch (error) {
    console.error('Error generating dashboard:', error);
    process.exit(1);
  }
}

main();
