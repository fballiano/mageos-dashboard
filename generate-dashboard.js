const GITHUB_ORG = 'mage-os';

async function fetchOrgData() {
  const query = `
    query ($org: String!) {
      organization(login: $org) {
        repositories(first: 100) {
          nodes {
            name
            url
            issues(states: OPEN) {
              totalCount
              nodes {
                title
                url
                createdAt
                labels(first: 5) {
                  nodes {
                    name
                  }
                }
              }
            }
            pullRequests(states: OPEN) {
              totalCount
              nodes {
                title
                url
                createdAt
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

  return response.json();
}

function generateHTML(data) {
  const repos = data.data.organization.repositories.nodes;
  
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Mage-OS GitHub Dashboard</title>
        <style>
          body { font-family: -apple-system, system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
          .repo { margin-bottom: 30px; border: 1px solid #e1e4e8; border-radius: 6px; padding: 20px; }
          .repo h2 { margin-top: 0; }
          .issues, .prs { margin-top: 15px; }
          .item { padding: 10px; border-bottom: 1px solid #eee; }
          .date { color: #666; font-size: 0.9em; }
          .label { background: #e1e4e8; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
        </style>
      </head>
      <body>
        <h1>Mage-OS GitHub Dashboard</h1>
        ${repos.map(repo => `
          <div class="repo">
            <h2><a href="${repo.url}">${repo.name}</a></h2>
            <div class="issues">
              <h3>Open Issues (${repo.issues.totalCount})</h3>
              ${repo.issues.nodes.map(issue => `
                <div class="item">
                  <a href="${issue.url}">${issue.title}</a>
                  <div class="date">Created: ${new Date(issue.createdAt).toLocaleDateString()}</div>
                  ${issue.labels.nodes.map(label => `
                    <span class="label">${label.name}</span>
                  `).join(' ')}
                </div>
              `).join('')}
            </div>
            <div class="prs">
              <h3>Open Pull Requests (${repo.pullRequests.totalCount})</h3>
              ${repo.pullRequests.nodes.map(pr => `
                <div class="item">
                  <a href="${pr.url}">${pr.title}</a>
                  <div class="date">Created: ${new Date(pr.createdAt).toLocaleDateString()} by ${pr.author.login}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </body>
    </html>
  `;
}

async function main() {
  const data = await fetchOrgData();
  const html = generateHTML(data);
  
  // Write to file
  const fs = require('fs');
  fs.writeFileSync('index.html', html);
}

main().catch(console.error);
