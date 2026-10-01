# My Agenda

App personal (HTML/CSS/JS, sin instalación) para organizar mis tres trabajos y mi vida personal.

## Cómo abrirla

Doble clic en `index.html` (se abre en el navegador). No necesita internet, salvo para cargar la tipografía.

> Los datos se guardan **en el navegador** donde la abras. Usa siempre el mismo navegador y
> haz respaldos con **Settings & backup → Export backup** (archivo `.json`). Para pasar a otra
> computadora: *Import backup*.

## Secciones

| Sección | Qué hace |
|---|---|
| **Today** | Saludo, % de progreso del día (gráfico por trabajo), recordatorios del día, tareas vencidas y mañana |
| **Calendar** | Vistas Día / Semana / Mes con todo lo que tiene fecha, coloreado por trabajo |
| **Don Bosco** | Tareas con prioridad (y tareas fijas que se repiten los días que elijas), estudiantes por grado/sección, incidencias (tipo, gravedad, notificado, resuelto), reuniones con representantes |
| **4 Eleven Media** | Tareas (únicas o fijas) por restaurante: Movita Juice Bar, Alas Kitchen, La Casita Mexicana, o "All 3 restaurants" para tareas de los tres |
| **Online Classes** | Estudiantes y horario semanal: días y horas (puede ser una hora distinta por día), notas por clase |
| **Things I need** | Lista de cosas que necesito con prioridad y costo estimado, y tareas personales |
| **Finances** | Tasa oficial BCV automática (+ convertidor), billeteras separadas en Bs y USD, total del mes en dólares (cada movimiento en Bs se convierte a la tasa de su día), ingresos por trabajo, gastos por categoría, metas de ahorro |

### Colores

- Don Bosco: teal
- Movita Juice Bar: morado
- Alas Kitchen: azul cielo
- La Casita Mexicana: naranja
- Clases online: magenta
- Personal: verde salvia

## Estructura

```
index.html          estructura y navegación
css/styles.css      estilos (tokens de color al inicio)
js/helpers.js       constantes, fechas, formato, iconos
js/store.js         datos (localStorage) y lógica (agenda, clases, finanzas)
js/ui.js            modales, constructor de formularios, componentes
js/forms.js         formularios de cada tipo de registro
js/view-*.js        cada pantalla
js/app.js           rutas y acciones
```

## Tasa BCV

La app consulta la tasa oficial del BCV en `ve.dolarapi.com` al abrirse y cada pocas horas mientras
está abierta (necesita internet). Cada movimiento en Bs guarda la tasa de su día, así los totales en
dólares no cambian cuando la tasa sube. Si no hay conexión, se usa la última tasa guardada o se puede
poner a mano con *Set manually*.

Monedas por defecto: Don Bosco y clases online en **Bs**, 4 Eleven Media en **USD**.

## Publicación (iPhone)

La app está publicada con GitHub Pages en **https://sofigonzalezurbano-ctrl.github.io/mi-agenda/**.
En el iPhone: abrir en Safari → Compartir → *Agregar a pantalla de inicio*, y usarla siempre desde ese ícono.

Para publicar cambios: `./bump-version.sh` (evita que el navegador use archivos viejos), commit y `git push`. GitHub actualiza la página en 1–2 minutos.

## Sincronización entre dispositivos

Con Firebase (proyecto `mi-agenda-e3913`): en *Settings & backup → Sync between devices* se inicia sesión
con correo y contraseña (el mismo en el iPhone y la Mac). Cada registro se guarda como un documento en
`users/{uid}/records/{colección__id}`; los cambios llegan a los otros dispositivos en segundos y, sin
internet, se guardan y se envían al reconectar. Las reglas de Firestore solo permiten la cuenta
`sofigonzalezurbano@gmail.com` con el correo verificado.

Archivos: `js/sync.js` (lógica de mezcla e interfaz) y `js/firebase-backend.js` (Firebase).
La sincronización solo funciona en la versión publicada (no al abrir `index.html` como archivo).
