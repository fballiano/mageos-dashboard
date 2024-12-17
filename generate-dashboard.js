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
        
          .table {
            font-size: 0.9rem;
            margin-bottom: 0;
            table-layout: fixed;
            width: 100%;
          }
        
          .table td {
            vertical-align: middle;
            width: 100%;
            max-width: 0; /* This is crucial for text-overflow to work */
          }
        
          .card-body {
            padding: 1rem 0;
          }
        
          .card-title {
            padding: 0 1rem;
          }
        
          .table-title {
            padding: 0.5rem 1rem;
            margin-bottom: 0;
            border-top: 1px solid #dee2e6;
          }
        
          .truncate-text {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: block;
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
                    <h3 class="card-title h5 mb-3">
                      <a href="${repo.url}" class="text-decoration-none" target="_blank">${repo.name}</a>
                    </h3>
                    
                    ${repo.issues.totalCount > 0 ? `
                      <h4 class="h6 table-title">Issues</h4>
                      <table class="table table-striped table-hover">
                        <tbody>
                          ${repo.issues.nodes.map(issue => `
                            <tr>
                              <td>
                                <a href="${issue.url}" class="text-decoration-none truncate-text" target="_blank" title="${issue.title}">${issue.title}</a>
                                ${issue.labels.nodes.length > 0 ? `
                                  <div>
                                    ${issue.labels.nodes.map(label => `
                                      <span class="label" style="background: #${label.color}15; color: #${label.color};">${label.name}</span>
                                    `).join('')}
                                  </div>
                                ` : ''}
                              </td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    ` : ''}
                    
                    ${repo.pullRequests.totalCount > 0 ? `
                      <h4 class="h6 table-title">Pull Requests</h4>
                      <table class="table table-striped table-hover">
                        <tbody>
                          ${repo.pullRequests.nodes.map(pr => `
                            <tr>
                              <td>
                                <a href="${pr.url}" class="text-decoration-none truncate-text" target="_blank" title="${pr.title}">${pr.title}</a>
                                <small class="text-muted d-block">by ${pr.author.login}</small>
                              </td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
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
