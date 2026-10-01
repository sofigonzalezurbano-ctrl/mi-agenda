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
| **Don Bosco** | Tareas con prioridad, estudiantes por grado/sección, incidencias (tipo, gravedad, notificado, resuelto), reuniones con representantes |
| **4 Eleven Media** | Tareas por restaurante: Movita Juice Bar, Alas Kitchen, La Casita Mexicana |
| **Online Classes** | Estudiantes, clases (únicas o semanales), notas por clase, pagos. Marcar una clase como pagada la suma a Finanzas |
| **Things I need** | Lista de cosas que necesito con prioridad y costo estimado, y tareas personales |
| **Finances** | Ingresos, gastos y ahorro en USD y Bs, tasa de cambio, gastos por categoría, ingresos por trabajo, metas de ahorro |

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
