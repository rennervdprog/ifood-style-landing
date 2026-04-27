-- Sanitiza chaves PIX existentes para o formato exigido pelo Asaas
-- phone: +55XXXXXXXXXXX (E.164), cpf/cnpj: só dígitos, email: lowercase
UPDATE public.profiles
SET pix_key = CASE
  WHEN lower(pix_type::text) = 'phone' THEN
    CASE
      WHEN length(regexp_replace(pix_key, '\D', '', 'g')) = 11
        THEN '+55' || regexp_replace(pix_key, '\D', '', 'g')
      WHEN length(regexp_replace(pix_key, '\D', '', 'g')) = 13
           AND left(regexp_replace(pix_key, '\D', '', 'g'), 2) = '55'
        THEN '+' || regexp_replace(pix_key, '\D', '', 'g')
      ELSE '+' || regexp_replace(pix_key, '\D', '', 'g')
    END
  WHEN lower(pix_type::text) IN ('cpf','cnpj') THEN regexp_replace(pix_key, '\D', '', 'g')
  WHEN lower(pix_type::text) = 'email' THEN lower(trim(pix_key))
  ELSE trim(pix_key)
END
WHERE pix_key IS NOT NULL
  AND pix_type IS NOT NULL
  AND (
    (lower(pix_type::text) = 'phone' AND pix_key !~ '^\+\d{12,13}$')
    OR (lower(pix_type::text) IN ('cpf','cnpj') AND pix_key ~ '\D')
    OR (lower(pix_type::text) = 'email' AND pix_key <> lower(trim(pix_key)))
  );