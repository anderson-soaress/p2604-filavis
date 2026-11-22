function exigirAutenticacao(req, res, next) {
  if (!req.session?.usuario) return res.status(401).json({ erro: "Autenticação necessária." });
  const agora = Date.now();
  if (agora - req.session.ultimaAtividade > 30 * 60 * 1000) {
    return req.session.destroy(() => res.status(401).json({ erro: "Sessão expirada." }));
  }
  req.session.ultimaAtividade = agora;
  next();
}

function exigirPerfil(...perfis) {
  return (req, res, next) => {
    if (!req.session?.usuario) return res.status(401).json({ erro: "Autenticação necessária." });
    if (!perfis.includes(req.session.usuario.perfil)) return res.status(403).json({ erro: "Perfil sem permissão." });
    next();
  };
}

module.exports = { exigirAutenticacao, exigirPerfil };
