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
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mage-OS GitHub Dashboard</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css">
        <style>
          :root {
            --primary: #1095c1;
            --primary-hover: #086f93;
          }
          body { max-width: 1200px; margin: 0 auto; padding: 20px; }
          .repo { margin-bottom: 2rem; padding: 1.5rem; border-radius: 8px; background: var(--card-background-color); }
          .repo h3 { margin-top: 0; }
          .issues, .prs { margin-top: 1rem; }
          .item { padding: 0.8rem; margin: 0.5rem 0; border-radius: 4px; background: var(--card-sectionning-background-color); }
          .date { color: var(--muted-color); font-size: 0.9em; }
          .label { 
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            margin: 2px;
          }
          .stats {
            display: flex;
            gap: 1rem;
            margin-bottom: 1rem;
          }
          .stat-box {
            background: var(--card-sectionning-background-color);
            padding: 1rem;
            border-radius: 8px;
            text-align: center;
          }
          .last-update {
            text-align: right;
            color: var(--muted-color);
            font-size: 0.9em;
            margin-bottom: 1rem;
          }
        </style>
      </head>
      <body>
        <header class="container">
          <h1>Mage-OS GitHub Dashboard</h1>
          <p class="last-update">Last updated: ${new Date(lastUpdate).toLocaleString()}</p>
        </header>
        <main class="container">
          <div class="stats">
            <div class="stat-box">
              <h4>Active Repositories</h4>
              <strong>${activeRepos.length}</strong>
            </div>
            <div class="stat-box">
              <h4>Total Open Issues</h4>
              <strong>${activeRepos.reduce((acc, repo) => acc + repo.issues.totalCount, 0)}</strong>
            </div>
            <div class="stat-box">
              <h4>Total Open PRs</h4>
              <strong>${activeRepos.reduce((acc, repo) => acc + repo.pullRequests.totalCount, 0)}</strong>
            </div>
          </div>
          ${activeRepos.map(repo => `
            <article class="repo">
              <h3><a href="${repo.url}" target="_blank">${repo.name}</a></h3>
              ${repo.issues.totalCount > 0 ? `
                <div class="issues">
                  <h4>Open Issues (${repo.issues.totalCount})</h4>
                  ${repo.issues.nodes.map(issue => `
                    <div class="item">
                      <a href="${issue.url}" target="_blank">${issue.title}</a>
                      <div class="date">
                        Created: ${new Date(issue.createdAt).toLocaleDateString()}
                        | Updated: ${new Date(issue.updatedAt).toLocaleDateString()}
                      </div>
                      ${issue.labels.nodes.map(label => `
                        <span class="label" style="background: #${label.color}30; color: #${label.color};">${label.name}</span>
                      `).join('')}
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              ${repo.pullRequests.totalCount > 0 ? `
                <div class="prs">
                  <h4>Open Pull Requests (${repo.pullRequests.totalCount})</h4>
                  ${repo.pullRequests.nodes.map(pr => `
                    <div class="item">
                      <a href="${pr.url}" target="_blank">${pr.title}</a>
                      <div class="date">
                        Created: ${new Date(pr.createdAt).toLocaleDateString()}
                        | Updated: ${new Date(pr.updatedAt).toLocaleDateString()}
                        | By: ${pr.author.login}
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </article>
          `).join('')}
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
