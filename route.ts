import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export async function GET() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Produtividade");

  ws.columns = [
    { header: "Mecânico", key: "mecanico", width: 28 },
    { header: "OS finalizadas", key: "os", width: 14 },
    { header: "Minutos execução", key: "mins", width: 16 },
    { header: "Horas", key: "horas", width: 10 }
  ];

  const { data } = await supabaseAdmin
    .from("os")
    .select("mecanico_id, finalizado_em, start_em, mecanico:users!os_mecanico_id_fkey(nome)")
    .eq("status", "FINALIZADA");

  const map = new Map<string, { nome: string; os: number; mins: number }>();
  for (const r of (data ?? []) as any[]) {
    const id = r.mecanico_id ?? "SEM";
    const nome = r.mecanico?.nome ?? "Sem mecânico";
    const mins = (r.start_em && r.finalizado_em) ? Math.floor((new Date(r.finalizado_em).getTime()-new Date(r.start_em).getTime())/60000) : 0;
    const cur = map.get(id) ?? { nome, os: 0, mins: 0 };
    cur.os += 1;
    cur.mins += mins;
    map.set(id, cur);
  }

  for (const v of map.values()) {
    ws.addRow({ mecanico: v.nome, os: v.os, mins: v.mins, horas: (v.mins/60).toFixed(2) });
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": "attachment; filename=produtividade.xlsx"
    }
  });
}
