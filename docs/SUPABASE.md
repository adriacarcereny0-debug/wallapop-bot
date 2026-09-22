# Supabase: puesta en marcha

## 1. Crear el proyecto

1. Entra en [supabase.com](https://supabase.com) y crea un proyecto.
2. Elige una región cercana (`eu-west-1` para España).
3. Guarda la contraseña de la base de datos en un gestor de contraseñas.

El plan **Free** basta para empezar: 500 MB de base de datos, 1 GB de
almacenamiento y 50 000 usuarios activos al mes.

## 2. Aplicar el esquema

Copia el contenido de [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
en el **SQL Editor** del panel de Supabase y ejecútalo.

Crea trece tablas, sus índices, los disparadores y **activa RLS en todas**.

Con la CLI, alternativamente:

```bash
npx supabase link --project-ref <tu-ref>
npx supabase db push
```

## 3. Comprobar que RLS quedó activado

Este paso no es opcional: sin RLS, la clave pública daría acceso a todo.

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

**Las trece filas deben mostrar `rowsecurity = true`.** Si alguna no lo está, no
sigas: vuelve a ejecutar la migración.

Comprueba también las políticas:

```sql
select tablename, count(*) as politicas
from pg_policies
where schemaname = 'public'
group by tablename
order by tablename;
```

Debe haber 4 políticas por tabla (select, insert, update, delete), salvo `users`
que tiene 2.

## 4. Configurar la autenticación

En **Authentication → Providers**, deja activado *Email*. Si no quieres registro
abierto, desactiva *Enable email signups* y crea los usuarios a mano desde
**Authentication → Users**. Para una herramienta privada, es lo razonable.

En **Authentication → URL Configuration**, añade tu dominio a las *Redirect URLs*.

## 5. Almacenamiento de imágenes

En **Storage**, crea un bucket `product-images`.

Para que cada usuario sólo vea sus imágenes, guarda los ficheros bajo
`<user_id>/<product_id>/<fichero>` y aplica esta política:

```sql
create policy "imagenes_propias"
on storage.objects for all
using (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

## 6. Conectar la aplicación

En **Project Settings → API**, copia los valores a `.env.local`:

```bash
DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

Reinicia el servidor. La aplicación pasa a usar `SupabaseRepository`.

---

## Notas

**El plan Free pausa el proyecto tras una semana sin actividad.** Para una
herramienta de uso diario no es problema; si lo fuera, el plan Pro (25 $/mes) lo
evita.

**Copias de seguridad:** el plan Free no las hace automáticamente. Exporta
periódicamente con `npx supabase db dump -f copia.sql`.

**La clave de servicio ignora RLS.** En esta aplicación sólo la usa el receptor
de webhooks, donde no hay sesión de usuario. Si añades más usos, filtra siempre
por `user_id` a mano.
