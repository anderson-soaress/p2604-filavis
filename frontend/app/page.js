"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export default function Home() {
  const [usuario, setUsuario] = useState(null);
  const [email, setEmail] = useState("regulacao@filavis.local");
  const [senha, setSenha] = useState("Regula123!");
  const [mensagem, setMensagem] = useState("");
  const [indicadores, setIndicadores] = useState([]);
  const [arquivo, setArquivo] = useState(null);

  async function requisicao(path, options = {}) {
    const resposta = await fetch(`${API}${path}`, { credentials: "include", ...options });
    const dados = resposta.status === 204 ? null : await resposta.json();
    if (!resposta.ok) throw new Error(dados?.erro || dados?.mensagem || "Não foi possível concluir a operação.");
    return dados;
  }

  async function carregarDashboard() {
    try {
      const dados = await requisicao("/api/dashboard");
      setIndicadores(dados.indicadores || []);
    } catch (erro) {
      setMensagem(erro.message);
    }
  }

  useEffect(() => {
    requisicao("/api/auth/me").then(dados => {
      setUsuario(dados.usuario);
      carregarDashboard();
    }).catch(() => {});
  }, []);

  async function entrar(evento) {
    evento.preventDefault();
    try {
      const dados = await requisicao("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha })
      });
      setUsuario(dados.usuario);
      setMensagem("Login realizado.");
      await carregarDashboard();
    } catch (erro) { setMensagem(erro.message); }
  }

  async function importar(evento) {
    evento.preventDefault();
    if (!arquivo) return setMensagem("Selecione um CSV.");
    const form = new FormData();
    form.append("arquivo", arquivo);
    try {
      const dados = await requisicao("/api/importacoes", { method: "POST", body: form });
      setMensagem(`${dados.mensagem} ${dados.quantidade} registros importados.`);
      await carregarDashboard();
    } catch (erro) { setMensagem(erro.message); }
  }

  async function sair() {
    await requisicao("/api/auth/logout", { method: "POST" });
    setUsuario(null);
    setIndicadores([]);
  }

  if (!usuario) return (
    <main>
      <section className="card">
        <h1>FilaVis</h1>
        <p className="muted">Acesso ao painel de regulação e indicadores</p>
        <form onSubmit={entrar}>
          <input aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input aria-label="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} />
          <button type="submit">Entrar</button>
        </form>
        <p className="muted">Contas sintéticas de demonstração estão descritas no README.</p>
        {mensagem && <p className="error">{mensagem}</p>}
      </section>
    </main>
  );

  return (
    <main>
      <header style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div><h1>FilaVis</h1><p className="muted">{usuario.nome} · {usuario.perfil}</p></div>
        <button className="secondary" onClick={sair}>Sair</button>
      </header>
      {usuario.perfil === "REGULACAO" && <section className="card">
        <h2>Importar dados</h2>
        <form onSubmit={importar}>
          <input type="file" accept=".csv,text/csv" onChange={e => setArquivo(e.target.files?.[0] || null)} />
          <button type="submit">Validar e importar CSV</button>
        </form>
      </section>}
      <section className="card">
        <h2>Indicadores</h2>
        <button className="secondary" onClick={carregarDashboard}>Atualizar</button>
        {indicadores.length === 0 ? <p className="muted">Nenhum indicador disponível. Importe um CSV válido.</p> :
          <table><thead><tr><th>Especialidade</th><th>Unidade</th><th>Fila</th><th>Espera ref. (dias)</th><th>Espera estimada</th><th>Absenteísmo</th><th>Capacidade</th></tr></thead>
            <tbody>{indicadores.map(item => <tr key={`${item.especialidade}-${item.unidade}-${item.competencia}`}>
              <td>{item.especialidade}</td><td>{item.unidade}</td><td>{item.filaAtiva}</td>
              <td>{item.esperaReferencia}</td><td>{item.esperaEstimada}</td><td>{item.absenteismo}%</td><td>{item.capacidade}</td>
            </tr>)}</tbody></table>}
      </section>
      {mensagem && <p className="success">{mensagem}</p>}
    </main>
  );
}
