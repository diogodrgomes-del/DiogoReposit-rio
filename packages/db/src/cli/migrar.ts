import { fechar } from "../cliente";
import { migrar } from "../migrar";

migrar()
  .then(fechar)
  .catch(async (e: unknown) => {
    console.error("falha na migração:", e instanceof Error ? e.message : e);
    await fechar().catch(() => {});
    process.exitCode = 1;
  });
