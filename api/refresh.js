// On-demand data refresh relay.
// Triggers the daily_refresh GitHub Action server-side so dashboard viewers
// never see or touch GitHub. Requires GH_TOKEN (fine-grained PAT with
// Actions read+write on this repo) set as a Vercel environment variable.
const REPO = 'dipensharma11/MM-Meta-Performance-Analysis-Dashboard';
const WORKFLOW = 'daily_refresh.yml';
const COOLDOWN_MS = 8 * 60 * 1000;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const token = process.env.GH_TOKEN;
  if (!token) return res.status(503).json({ status: 'unconfigured' });
  const gh = (path, opt = {}) => fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opt,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'mm-dashboard-refresh',
      ...(opt.headers || {}),
    },
  });
  try {
    const runsResp = await gh('/actions/runs?per_page=1');
    const runs = await runsResp.json();
    const last = (runs.workflow_runs || [])[0];
    if (last && last.status !== 'completed') return res.status(200).json({ status: 'running' });
    if (last && Date.now() - new Date(last.created_at).getTime() < COOLDOWN_MS)
      return res.status(200).json({ status: 'recent' });
    const d = await gh(`/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main' }),
    });
    if (d.status === 204) return res.status(200).json({ status: 'started' });
    return res.status(502).json({ status: 'error', code: d.status });
  } catch (e) {
    return res.status(502).json({ status: 'error' });
  }
};
