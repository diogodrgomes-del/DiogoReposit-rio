-- Lançamento de escopo PESSOAL sem dono não pode existir: sem isso, um bug
-- deixaria um lançamento pessoal órfão, visível por quem consulta o escopo.
ALTER TABLE "fin_entries"
  ADD CONSTRAINT "fin_entries_pessoal_tem_dono"
  CHECK ("escopo" <> 'PESSOAL' OR "owner_user_id" IS NOT NULL);

-- Valor não negativo: sinal é dado por `tipo`, não pelo número.
ALTER TABLE "fin_entries"
  ADD CONSTRAINT "fin_entries_valor_nao_negativo" CHECK ("valor_cents" >= 0);

ALTER TABLE "fin_payments"
  ADD CONSTRAINT "fin_payments_valor_positivo" CHECK ("valor_cents" > 0);
