# Fiesta 15 de Septiembre — versión multiusuario

Sistema web para controlar más de 200 invitados desde varios celulares.

## Funciones incluidas

- Inicio de sesión de organizadores con Supabase Auth.
- Alta y baja de invitados.
- Estado PAGADO / NO PAGADO.
- Código único y QR por invitado.
- Escáner desde celular.
- Resultado:
  - PAGADO → PUEDE PASAR.
  - NO PAGADO → NO PUEDE PASAR.
  - YA UTILIZADO → NO PUEDE PASAR.
- La entrada se registra automáticamente al validar un QR pagado.
- Validación atómica para evitar que el mismo boleto entre por dos celulares a la vez.
- Historial de intentos y entradas.
- Estadísticas.
- Búsqueda.
- Importación masiva por CSV.
- Actualización en tiempo real entre dispositivos.

## 1. Crear el proyecto en Supabase

1. Entra a Supabase y crea un proyecto.
2. Abre **SQL Editor**.
3. Copia y ejecuta todo el archivo `supabase_schema.sql`.
4. Ve a **Authentication > Users** y crea los usuarios que utilizarán el panel.
   Sugerencia: un usuario para ti y uno por cada celular/organizador que estará en la entrada.

## 2. Configurar la aplicación

En Supabase copia:
- Project URL.
- Publishable key o anon key.

Abre `config.js` y reemplaza:

```js
export const SUPABASE_URL = "PEGA_AQUI_TU_SUPABASE_URL";
export const SUPABASE_PUBLISHABLE_KEY = "PEGA_AQUI_TU_PUBLISHABLE_O_ANON_KEY";
```

Nunca pongas una `service_role` key en el navegador.

## 3. Probar en la computadora

No abras `index.html` directamente con doble clic porque el proyecto usa módulos ES.

Con Python:

```bash
cd Fiesta15_Septiembre_REAL
python -m http.server 8000
```

Después abre:

```text
http://localhost:8000
```

## 4. Publicarlo para los celulares

Publica esta carpeta como sitio estático mediante un servicio HTTPS (por ejemplo GitHub Pages, Netlify, Vercel u otro hosting estático).

La cámara del teléfono debe abrir el sistema desde HTTPS.

## 5. Carga masiva

Se incluye `Plantilla_Invitados_Fiesta15.xlsx`.

Llénala y en Excel usa:

**Archivo > Guardar como > CSV UTF-8 (delimitado por comas)**

Después entra a la pestaña **Importar** del sistema.

Columnas:
- nombre
- apellido
- invitado_por
- cuenta_pago
- pagado

En `pagado` usa `SI` o `NO`.

## Flujo recomendado el 15 de septiembre

1. Dos o más celulares abren el mismo sitio.
2. Cada encargado inicia sesión.
3. Abren **Escáner**.
4. Se escanea el QR.
5. Si está pagado y no usado, la entrada queda registrada de inmediato.
6. Si alguien intenta reutilizarlo, aparecerá **BOLETO YA UTILIZADO**.

## Seguridad

El frontend utiliza únicamente una clave publicable. La base está protegida mediante Row Level Security y exige sesión autenticada. La función de acceso comprueba también que exista un usuario autenticado.

## Antes del evento

Haz una prueba real con al menos 2 celulares:
- Escanear el mismo boleto casi simultáneamente.
- Comprobar un boleto no pagado.
- Marcarlo pagado desde otro dispositivo y volver a escanear.
- Probar un QR usado.
- Revisar que las estadísticas coincidan.
