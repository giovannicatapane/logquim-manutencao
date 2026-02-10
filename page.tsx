"use client";
import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { getMyProfile } from "../../../lib/auth";

type OS = any;
type Material = { id: string; codigo: string; descricao: string; estoque_atual: number; custo_unitario: number; };
type OSMat = any;
type Foto = { id: string; tipo: string; url: string; criado_em: string; };

function fmtMins(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins/60);
  const m = mins%60;
  return `${h}h ${m}m`;
}

export default function OSPage({ params }: { params: { id: string }}) {
  const osId = params.id;
  const [me, setMe] = useState<any>(null);
  const [os, setOs] = useState<OS|null>(null);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [osMats, setOsMats] = useState<OSMat[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [matId, setMatId] = useState<string>("");
  const [qtd, setQtd] = useState<string>("1");
  const [filesDepois, setFilesDepois] = useState<FileList|null>(null);
  const [descReparo, setDescReparo] = useState("");
  const [trocou, setTrocou] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const prof = await getMyProfile();
    setMe(prof);

    const { data: osData } = await supabase
      .from("os")
      .select("*, frotas(codigo,tipo), criado:nome_users!os_criado_por_fkey(nome), mecanico:users!os_mecanico_id_fkey(nome)")
      .eq("id", osId).single();

    setOs(osData as any);
    setDescReparo(osData?.descricao_reparo ?? "");
    setTrocou(osData?.o_que_trocou ?? "");

    const { data: mats } = await supabase.from("materiais").select("id,codigo,descricao,estoque_atual,custo_unitario").eq("ativo", true).order("descricao");
    setMateriais((mats ?? []) as any);

    const { data: om } = await supabase.from("os_materiais").select("*, materiais(codigo,descricao)").eq("os_id", osId).order("criado_em", { ascending: false });
    setOsMats((om ?? []) as any);

    const { data: ft } = await supabase.from("os_fotos").select("id,tipo,url,criado_em").eq("os_id", osId).order("criado_em", { ascending: false });
    setFotos((ft ?? []) as any);
  }

  useEffect(() => { load(); }, [osId]);

  const kpis = useMemo(() => {
    if (!os) return null;
    const now = new Date().toISOString();
    const fila = os.aceito_em ? Math.floor((new Date(os.aceito_em).getTime()-new Date(os.criado_em).getTime())/60000) : Math.floor((new Date(now).getTime()-new Date(os.criado_em).getTime())/60000);
    const exec = (os.start_em && os.finalizado_em) ? Math.floor((new Date(os.finalizado_em).getTime()-new Date(os.start_em).getTime())/60000) : 0;

    return { fila, exec };
  }, [os]);

  async function pegar() {
    setMsg("");
    if (!me) return;
    const { error } = await supabase.from("os").update({ mecanico_id: me.id, status:"ATRIBUIDA", aceito_em: new Date().toISOString() }).eq("id", osId);
    if (error) setMsg(error.message);
    await load();
  }

  async function start() {
    setMsg("");
    const { error } = await supabase.from("os").update({ status:"EM_ANDAMENTO", start_em: new Date().toISOString() }).eq("id", osId);
    if (error) setMsg(error.message);
    await load();
  }

  async function addMaterial() {
    setMsg("");
    if (!me) return;
    if (!matId) { setMsg("Selecione um material."); return; }
    const n = Number(qtd);
    if (!Number.isFinite(n) || n <= 0) { setMsg("Quantidade inválida."); return; }

    const { error } = await supabase.from("os_materiais").insert({
      os_id: osId,
      material_id: matId,
      quantidade_lancada: n,
      quantidade_pendente: n,
      status_material: "PENDENTE",
      lancado_por: me.id
    });
    if (error) setMsg(error.message);
    setMatId(""); setQtd("1");
    await load();
  }

  async function uploadDepois() {
    if (!filesDepois || filesDepois.length === 0) return;
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;

    for (const file of Array.from(filesDepois)) {
      const path = `${osId}/DEPOIS_${Date.now()}_${file.name}`.replace(/\s+/g, "_");
      const up = await supabase.storage.from("os-fotos").upload(path, file, { upsert: true });
      if (up.error) continue;
      const { data: pub } = supabase.storage.from("os-fotos").getPublicUrl(path);
      await supabase.from("os_fotos").insert({ os_id: osId, tipo: "DEPOIS", url: pub.publicUrl, criado_por: uid });
    }
  }

  async function finalizar() {
    setMsg("");
    // upload after photos first
    await uploadDepois();

    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) { setMsg("Sem sessão."); return; }

    const { data, error } = await supabase.rpc("finalizar_os", {
      p_os_id: osId,
      p_user_id: uid,
      p_descricao_reparo: descReparo,
      p_o_que_trocou: trocou
    });

    if (error) { setMsg(error.message); return; }

    const res = (data?.[0] ?? null) as any;
    if (res?.status_final === "AGUARDANDO_PECA") {
      setMsg("OS ficou AGUARDANDO PEÇA (faltou material). Assim que repor estoque, o sistema baixa e finaliza automaticamente.");
    } else {
      setMsg("OS finalizada com sucesso.");
    }
    await load();
  }

  if (!os) return <div className="card" style={{marginTop:12}}>Carregando…</div>;

  const canPeg = me && (me.perfil === "MECANICO" || me.perfil === "ADMIN") && os.status === "ABERTA";
  const canStart = me && (me.perfil === "MECANICO" || me.perfil === "ADMIN") && (os.status === "ATRIBUIDA") && (os.mecanico_id === me.id || me.perfil==="ADMIN");
  const canEdit = me && (os.mecanico_id === me.id || me.perfil==="ADMIN" || me.perfil==="INSPETOR");

  return (
    <>
      <div className="nav">
        <div className="row">
          <a className="btn" href="/os">←</a>
          <div style={{fontWeight:800}}>OS</div>
          <span className="badge">{os.status}</span>
          <span className="badge">{os.frotas?.codigo}</span>
        </div>
        <div className="row">
          {canPeg && <button className="btn primary" onClick={pegar}>Pegar tarefa</button>}
          {canStart && <button className="btn primary" onClick={start}>Start</button>}
          {canEdit && <button className="btn danger" onClick={finalizar}>Finalizar</button>}
        </div>
      </div>

      <div className="grid two" style={{marginTop:12}}>
        <div className="card">
          <div className="h1">{os.titulo}</div>
          <div className="row">
            <span className="badge">Prioridade: {os.prioridade}</span>
            <span className="badge">Mecânico: {os.mecanico?.nome ?? "-"}</span>
          </div>
          <p className="small"><b>Problema:</b> {os.descricao_problema}</p>

          <div className="kpi">
            <div className="item"><div className="small">Fila</div><div style={{fontSize:18,fontWeight:800}}>{kpis ? fmtMins(kpis.fila) : "-"}</div></div>
            <div className="item"><div className="small">Execução</div><div style={{fontSize:18,fontWeight:800}}>{kpis ? fmtMins(kpis.exec) : "-"}</div></div>
          </div>

          <hr/>
          <div className="h2">Reparo (mecânico)</div>
          <textarea className="textarea" value={descReparo} onChange={(e)=>setDescReparo(e.target.value)} placeholder="O que foi feito…"/>
          <div style={{height:8}} />
          <div className="h2">Peças trocadas</div>
          <textarea className="textarea" value={trocou} onChange={(e)=>setTrocou(e.target.value)} placeholder="O que trocou / peças…"/>

          <div style={{height:8}} />
          <div className="h2">Fotos DEPOIS (enviar antes de finalizar)</div>
          <input className="input" type="file" multiple accept="image/*" onChange={(e)=>setFilesDepois(e.target.files)} />

          {msg && <p className="small" style={{color: msg.includes("sucesso") ? "#86efac" : "#fca5a5"}}>{msg}</p>}
        </div>

        <div className="card">
          <div className="h1">Materiais</div>
          <div className="row">
            <select className="select" value={matId} onChange={(e)=>setMatId(e.target.value)} style={{flex:1, minWidth: 260}}>
              <option value="">Selecione material…</option>
              {materiais.map(m => (
                <option key={m.id} value={m.id}>{m.descricao} ({m.codigo}) — saldo {m.estoque_atual}</option>
              ))}
            </select>
            <input className="input" value={qtd} onChange={(e)=>setQtd(e.target.value)} style={{width:120}} />
            <button className="btn" onClick={addMaterial}>Adicionar</button>
          </div>

          <div style={{height:10}} />
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {osMats.map((x:any) => (
                <tr key={x.id}>
                  <td className="small">{x.materiais?.descricao} <span className="badge">{x.materiais?.codigo}</span></td>
                  <td>{x.quantidade_lancada}</td>
                  <td><span className="badge">{x.status_material}{x.quantidade_pendente>0 ? ` (pendente ${x.quantidade_pendente})` : ""}</span></td>
                </tr>
              ))}
              {!osMats.length && <tr><td colSpan={3} className="small">Nenhum material lançado.</td></tr>}
            </tbody>
          </table>

          <hr/>
          <div className="h1">Evidências</div>
          <div className="small">Fotos cadastradas (ANTES/DEPOIS):</div>
          <div className="grid" style={{gridTemplateColumns:"repeat(2, minmax(0,1fr))", marginTop:10}}>
            {fotos.slice(0,8).map(f => (
              <a key={f.id} href={f.url} target="_blank" className="card" style={{padding:10, borderRadius:14}}>
                <div className="row" style={{justifyContent:"space-between"}}>
                  <span className="badge">{f.tipo}</span>
                  <span className="small">{new Date(f.criado_em).toLocaleString()}</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt="foto" style={{width:"100%", borderRadius:12, marginTop:8}} />
              </a>
            ))}
            {!fotos.length && <div className="small">Sem fotos.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
