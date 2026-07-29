module.exports = (req, res) => {
  res.setHeader('Set-Cookie', 'mm_sess=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  res.writeHead(302, { Location: '/login.html?logout=1' });
  res.end();
};
