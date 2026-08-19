-- ============================================================
-- FIESTA 15 - MIGRACIÓN V4: RECUPERAR RESERVACIÓN
-- Consulta por folio + teléfono.
-- Ejecutar una sola vez en Supabase SQL Editor.
-- ============================================================

create or replace function public.recuperar_reservacion_publica(
  p_folio text,
  p_telefono text
)
returns table(public_token uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token uuid;
begin
  select r.public_token
  into v_token
  from public.reservaciones r
  where upper(r.folio)=upper(trim(p_folio))
    and regexp_replace(r.contacto_telefono,'\D','','g') =
        regexp_replace(p_telefono,'\D','','g')
  limit 1;

  if v_token is null then
    return;
  end if;

  return query select v_token;
end $$;

revoke all on function public.recuperar_reservacion_publica(text,text) from public;
grant execute on function public.recuperar_reservacion_publica(text,text) to anon, authenticated;
