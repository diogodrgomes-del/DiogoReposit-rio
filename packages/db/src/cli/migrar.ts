import { fechar } from "../cliente.js";
import { migrar } from "../migrar.js";

migrar()
  .then(fechar)
  .catch(async (e: unknown) => {
    console.error("falha na migração:", e instanceof Error ? e.message : e);
    await fechar().catch(() => {});
    process.exitCode = 1;
  });
