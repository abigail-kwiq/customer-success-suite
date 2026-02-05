### Opción A (La más fácil): Conexión de un Solo Clic
1. En el Dashboard, ve a la sección de **Conexiones**.
2. Haz clic en el botón gigante azul que dice **"Conectar con Facebook"**.
3. Acepta los permisos de "Marketing API".
4. Una vez conectado, aparecerá una lista con tus **Cuentas Publicitarias**. Selecciona la que quieres analizar.
5. ¡Listo! El sistema traerá los datos automáticamente.

> [!NOTE]
> Para que esta opción funcione, asegúrate de que el dominio donde usas el dashboard (ej. `localhost` o tu dominio web) esté registrado en la configuración de Facebook Login de tu App.

### Opción B: Token de Usuario del Sistema (Perpetuo)
Si prefieres una conexión que nunca venza, sigue estos pasos:
1. Ve a [developers.facebook.com](https://developers.facebook.com).
2. Haz clic en **Mis Apps** > **Crear App**.
3. Selecciona **Otro** > **Siguiente**.
4. Selecciona el tipo de app **Negocios** (Business).
5. Dale un nombre (ej. "Execution Compass Dash") y conéctala a tu Business Portfolio.

### 2. Configurar la API de Marketing
1. Dentro del panel de tu app, busca **Añadir un producto**.
2. Haz clic en **Configurar** en **Marketing API**.

### 3. Generar el Token (System User)
1. Ve a la **Configuración del Negocio** (business.facebook.com/settings).
2. Ve a **Usuarios** > **Usuarios del sistema**.
3. Haz clic en **Añadir**. Ponle un nombre y rol de "Administrador".
4. Selecciona el usuario creado y haz clic en **Generar nuevo token**.
5. **IMPORTANTE**: Selecciona la app que creaste.
6. En los permisos, activa obligatoriamente:
   - `ads_read`
   - `read_insights`
7. Haz clic en **Generar**. Copia ese token (empieza por `EAA...`).

### 4. Vincular en el Dashboard
1. Pega el token en el campo **System User Token** en la sección de Conexiones.
2. Haz clic en **Guardar Configuración**.

### SOLUCIÓN DE ERRORES (Importante)

Si al hacer clic en "Conectar" te salen los errores que me mostraste, aquí tienes cómo arreglarlos en **1 minuto** dentro de Meta Developers:

#### 1. Error: "La aplicación no está activa"
Esto es porque tu App está en modo "Desarrollo".
1. En el panel superior de Meta Developers, busca donde dice **Modo de la app**. 
2. Cambia el interruptor de **Desarrollo** a **Activo** (O "En directo").
3. *Nota*: Meta te pedirá una "URL de política de privacidad". Puedes poner cualquier link de tu web (ej. `https://tuweb.com/privacidad`) para que te deje activarla.

#### 2. Error: "No se puede cargar la URL / El dominio no está incluido"
Facebook necesita saber que tu dashboard es un sitio seguro.
1. En el menú de la izquierda, busca **Facebook Login** > **Configuración**.
2. Busca el campo que dice **URIs de redireccionamiento de OAuth válidos**.
3. Pega la dirección que usas para ver el dashboard. 
   - Si estás en tu PC local: Pon `http://localhost/` y `http://127.0.0.1/`.
   - Si tienes el dashboard subido a una web: Pon el link de esa web.
4. Haz clic en **Guardar cambios** al final de esa página.

---

### Opción B: Copiado Manual (Rápido)
Si no quieres configurar la API, puedes ir a tu **Ads Manager**, seleccionar las campañas del mes, copiar la fila completa y pegarla en el cuadro de **Copiado Rápido** en el dashboard. El sistema detectará automáticamente el gasto y los resultados.
