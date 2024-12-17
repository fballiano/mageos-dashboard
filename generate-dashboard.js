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

    const activeRepos = repos.filter(repo =>
        repo.issues.totalCount > 0 || repo.pullRequests.totalCount > 0
    );

    return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mage-OS Dashboard</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>
          body { 
            padding: 1rem;
          }
          
          .container {
            max-width: 1400px;
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
            color: #6c757d;
            font-size: 0.8em;
            margin: 0.5rem 0 1.5rem 0;
          }

          .card {
            height: 100%;
          }

          .table-responsive {
            margin-top: 1rem;
          }

          .table {
            font-size: 0.9rem;
          }

          .table td {
            vertical-align: middle;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <header class="mb-4">
            <h1 class="display-6">Mage-OS Dashboard</h1>
            <p class="last-update">Last updated: ${new Date(lastUpdate).toLocaleString()}</p>
          </header>
          
          <div class="row row-cols-1 row-cols-md-2 g-4">
            ${activeRepos.map(repo => `
              <div class="col">
                <div class="card h-100">
                  <div class="card-body">
                    <h3 class="card-title h5">
                      <a href="${repo.url}" class="text-decoration-none" target="_blank">${repo.name}</a>
                    </h3>
                    
                    ${repo.issues.totalCount > 0 ? `
                      <div class="table-responsive">
                        <h4 class="h6 mt-3">Open Issues (${repo.issues.totalCount})</h4>
                        <table class="table table-striped table-hover">
                          <thead>
                            <tr>
                              <th>Issue</th>
                              <th>Dates</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${repo.issues.nodes.map(issue => `
                              <tr>
                                <td>
                                  <a href="${issue.url}" class="text-decoration-none" target="_blank">${issue.title}</a>
                                  ${issue.labels.nodes.length > 0 ? `
                                    <div>
                                      ${issue.labels.nodes.map(label => `
                                        <span class="label" style="background: #${label.color}15; color: #${label.color};">${label.name}</span>
                                      `).join('')}
                                    </div>
                                  ` : ''}
                                </td>
                                <td>
                                  <small class="text-muted">
                                    Created: ${new Date(issue.createdAt).toLocaleDateString()}<br>
                                    Updated: ${new Date(issue.updatedAt).toLocaleDateString()}
                                  </small>
                                </td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    ` : ''}
                    
                    ${repo.pullRequests.totalCount > 0 ? `
                      <div class="table-responsive">
                        <h4 class="h6 mt-3">Open Pull Requests (${repo.pullRequests.totalCount})</h4>
                        <table class="table table-striped table-hover">
                          <thead>
                            <tr>
                              <th>Pull Request</th>
                              <th>Author</th>
                              <th>Dates</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${repo.pullRequests.nodes.map(pr => `
                              <tr>
                                <td>
                                  <a href="${pr.url}" class="text-decoration-none" target="_blank">${pr.title}</a>
                                </td>
                                <td>
                                  <small>${pr.author.login}</small>
                                </td>
                                <td>
                                  <small class="text-muted">
                                    Created: ${new Date(pr.createdAt).toLocaleDateString()}<br>
                                    Updated: ${new Date(pr.updatedAt).toLocaleDateString()}
                                  </small>
                                </td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
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
