import { PrismaClient } from "@prisma/client";

/**
 * Cliente unico. Em desenvolvimento o Next recarrega o modulo a cada alteracao,
 * e sem o global cada recarga abriria um pool novo ate estourar o limite de
 * conexoes do Postgres.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
