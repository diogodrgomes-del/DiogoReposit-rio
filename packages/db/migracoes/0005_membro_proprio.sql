-- 0005 — Um usuário sempre enxerga a própria filiação.
--
-- Faltava uma peça no login: depois de conferir a senha sabemos quem é o
-- usuário, mas ainda não a que organização ele pertence — e é justamente
-- `membros` que responde isso. Com a política antiga, que exigia
-- `organizacao_id = app_org()`, a consulta voltava vazia e ninguém entrava.
--
-- A alternativa seria abrir `membros` para `app_autenticando()`, o que
-- exporia a filiação de todo mundo durante qualquer login. Esta cláusula é
-- mais estreita e mais correta em si: ver a que empresas você pertence é
-- informação sua.
--
-- Também é o que vai sustentar o seletor de organização quando o sistema
-- atender mais de uma empresa.

DROP POLICY membros_isolamento ON membros;

CREATE POLICY membros_isolamento ON membros
  USING (
    organizacao_id = app_org()
    OR usuario_id = app_usuario()
    OR app_admin()
  )
  -- Escrita continua restrita à organização do contexto: ver a própria
  -- filiação é uma coisa, criar filiação para si mesmo é outra.
  WITH CHECK (organizacao_id = app_org() OR app_admin());
