-- Mantém apenas a versão protegida de register_as_lojista.
-- A sobrecarga curta competia com a versão de 10 parâmetros (com defaults), o que
-- tornava chamadas de 7 argumentos ambíguas no PostgreSQL/PostgREST.
-- A versão remanescente conserva todos os parâmetros de segurança e aceita as
-- chamadas atuais por meio de valores padrão.

BEGIN;

DROP FUNCTION IF EXISTS public.register_as_lojista(
  text,
  text,
  text,
  public.store_category,
  text,
  text,
  text
);

COMMIT;
