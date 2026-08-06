import { NextResponse } from "next/server";
import { listarClientes } from "@/lib/clientes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Apenas id e nome — os tokens nunca saem do servidor. */
export async function GET() {
  const clientes = listarClientes();
  return NextResponse.json(
    {
      clientes,
      vazio: clientes.length === 0,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
