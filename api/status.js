// Server-side GitHub status relay so the dashboard's "Data updated" stamp and
// refresh watcher keep working after the repo goes private (unauthenticated
// GitHub API 404s on private repos). Uses GH_TOKEN held server-side.
const REPO = 'dipensharma11/MM-Meta-Performance-Analysis-Dashboard';
module.exports = async (req, res) => {
  const token = process.env.GH_TOKEN;
  res.setHeader('Cache-Control', 'no-store');
  if (!token) return res.status(200).json({ configured: false });
  const gh = (p) => fetch(`https://api.github.com/repos/${REPO}${p}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'mm-dashboard' },
  });
  try {
    const [cRes, rRes] = await Promise.all([
      gh('/commits?path=index.html&per_page=1'),
      gh('/actions/runs?per_page=1'),
    ]);
    const c = await cRes.json();
    const r = await rRes.json();
    const commitTime = Array.isArray(c) && c[0] ? c[0].commit.committer.date : null;
    const run = (r.workflow_runs || [])[0] || null;
    return res.status(200).json({
      configured: true,
      commitTime,
      run: run ? { status: run.status, conclusion: run.conclusion, created_at: run.created_at } : null,
    });
  } catch (e) {
    return res.status(200).json({ configured: true, error: true });
  }
};
