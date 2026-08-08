"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { exigirAtor } from "@/lib/auth/sessao";
import { sucesso, tratarErro, type Resultado } from "@/lib/acoes";

export async function marcarTodasLidas(): Promise<Resultado<void>> {
  try {
    const ator = await exigirAtor();
    await prisma.notification.updateMany({
      where: { userId: ator.userId, lidaEm: null },
      data: { lidaEm: new Date() },
    });
    revalidatePath("/notificacoes");
    revalidatePath("/", "layout");
    return sucesso(undefined);
  } catch (e) {
    return tratarErro(e);
  }
}
