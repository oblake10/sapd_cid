1. 🎨 Estilo general de la web
La estética debe replicar el estilo policial/inteligencia criminal de la imagen 2.

Fondo general: negro absoluto o casi negro (#000000 – #080808)

Tarjetas: gris muy oscuro (#050505 – #0A0A0A)

Bordes: finos, discretos, gris oscuro (#1C1C1C – #242424)

Tipografía: blanca (#FFFFFF) y gris (#A8A8A8)

Sin brillos, sin degradados, sin colores adicionales

Diseño limpio, moderno, serio

🔥 Regla global del color del grupo
El color principal del grupo controla TODOS los acentos visuales.

Esto incluye:

Línea activa del navbar

Botones

Bordes de tarjetas

Indicadores del carrusel

Marcadores del mapa

Iconos

Etiquetas

Estados activos

Si el grupo es amarillo → todo acento es amarillo.
Si el grupo es rojo → todo acento es rojo.

Este comportamiento es obligatorio y dinámico.

2. 🧭 Navbar superior
Estructura
Centrada horizontalmente

Fondo: #050505

Opciones: Inicio / Identificación Criminal / Mapa Criminal

Usuario a la derecha: “callahan”

Estilo
Texto normal: #A8A8A8

Texto activo: #FFFFFF

Línea inferior activa: color principal del grupo

Botón usuario: negro con borde gris suave

Regla estricta
Solo una pestaña puede estar activa.
La línea amarilla (o del color del grupo) debe ser idéntica a la de la imagen 2.

3. 🔍 Cabecera con buscador
Tarjeta grande superior, ancho completo.

Contenido obligatorio
Texto pequeño: “CID”

Título grande: “Identificación Criminal”

Icono decorativo (huella)

Input de búsqueda

Botón “Buscar”

Tarjeta pequeña con número total de grupos

Estilo
Fondo: #060606 – #080808

Borde: #1C1C1C

CID: color principal del grupo

Título: blanco

Input: #0B0B0B

Botón: color principal del grupo

Texto del botón: negro

4. 🧩 Sección 1 — Información del grupo
Debe verse EXACTAMENTE como en la imagen 2.

Estructura
Izquierda: datos del grupo

Derecha: grafiti o imagen del grupo

Contenido obligatorio
Etiqueta: “ORGANIZACIÓN”

Nombre del grupo (grande)

Bloque de colores del grupo:

Fondo negro puro

Borde gris oscuro

Círculo color principal

Círculo color secundario

Peligrosidad

Número de miembros

Imagen del grafiti

Estilo
Fondo sección: #050505

Bloque colores: #000000

Borde: #222222

Texto: blanco

Acentos: color principal del grupo

Regla estricta
No colocar texto encima del color principal.  
El bloque de colores siempre debe tener fondo negro.

5. 🗺️ Sección 2 — Ubicación visual (única sección con dos columnas)
Columna izquierda — Mapa territorial
Polígono del barrio

Color principal del grupo con opacidad 40–60%

Etiqueta con siglas del grupo

Columna derecha — Mapa de actividad
Marcadores de grafitis

Icono de spray/grafiti

Color principal del grupo

Estilo
Fondo tarjeta: #070707

Borde: #242424

Títulos: blanco

Regla estricta
Esta es la única sección que puede tener dos columnas.
Todo lo demás debe ser ancho completo.

6. 🖼️ Sección 3 — Galería de fotos (carrusel grande)
Estructura
Ancho completo

Imagen grande centrada

Flechas izquierda/derecha

Indicadores inferiores (puntos)

Botón “+ Subir imágenes” arriba a la derecha

Estilo
Fondo: #050505

Fondo imagen: #111111

Botón subir: negro con borde del color del grupo

Texto botón: color del grupo

Flechas: círculo negro semitransparente

Indicador activo: color del grupo

Indicadores inactivos: gris

Regla estricta
La galería nunca debe dividirse en columnas.
Debe ser un carrusel grande como en la imagen 2.

7. 👥 Sección 4 — Miembros del grupo
Estructura
Ancho completo

Grid horizontal de tarjetas

Cada tarjeta debe incluir:
Foto del miembro

Nombre y apellido

State ID

Red social

Grupo actual

Grupo anterior

Cargo (Camello / Miembro / Líder / Asociado)

Estado (Activo / No activo)

Estilo
Fondo tarjeta: #080808

Borde: color principal del grupo

Texto principal: blanco

Texto secundario: gris

Estado activo: verde #2ECC71

Estado no activo: rojo #E74C3C

Regla estricta
El borde de cada tarjeta usa el color del grupo actual del miembro.

8. ➕ Modal “Añadir miembro”
Campos obligatorios
Nombre

Apellido

State ID

Red social

Grupo actual (preseleccionado)

Grupo anterior

Cargo (select)

Estado (select)

Subir foto

Botones
Cancelar

Guardar

Funcionalidad obligatoria
Guardar en base de datos

Mostrar automáticamente en la sección de miembros

Permitir editar/eliminar después

9. 📐 Orden final de la página (no modificable)
Navbar

Cabecera con buscador

Información del grupo

Mapas (dos columnas)

Galería (ancho completo)

Miembros (ancho completo)

10. 🧱 Reglas estrictas para evitar errores comunes
Solo los mapas pueden ir en dos columnas.

La galería y los miembros siempre ocupan todo el ancho.

El color del grupo controla todos los acentos.

El estilo debe replicar la imagen 2.

Nada debe tener colores que no sean negro, gris o el color del grupo.

No usar brillos ni degradados.

Los bordes siempre son finos y discretos.

🧱 WIREFRAME ASCII COMPLETO + ANOTACIONES
Código
┌──────────────────────────────────────────────────────────────────────────────┐
│ NAVBAR (100% ANCHO)                                                          │
│                                                                              │
│   Inicio     Identificación Criminal     Mapa Criminal                user   │
│                ───────────────────                                          │
│                Línea activa = color del grupo                                │
│                                                                              │
│  Fondo: negro (#050505)                                                      │
│  Texto normal: gris (#A8A8A8)                                                │
│  Texto activo: blanco (#FFFFFF)                                              │
│  Acento: color del grupo                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
Código
┌──────────────────────────────────────────────────────────────────────────────┐
│ CABECERA / BUSCADOR (100% ANCHO)                                             │
│                                                                              │
│   CID (color del grupo)                                                      │
│   IDENTIFICACIÓN CRIMINAL (blanco, grande)                                   │
│                                                                              │
│   [ Buscar grupo criminal...           ] [ BUSCAR ]                          │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐   │
│   │ 👥 18 grupos encontrados     >                                        │   │
│   │ Tarjeta pequeña con borde gris oscuro                                 │   │
│   └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  Fondo: #060606 / #080808                                                    │
│  Input: #0B0B0B                                                              │
│  Botón: color del grupo                                                      │
└──────────────────────────────────────────────────────────────────────────────┘
Código
┌──────────────────────────────────────────────────────────────────────────────┐
│ SECCIÓN 1 — INFORMACIÓN DEL GRUPO (100% ANCHO)                               │
│                                                                              │
│  ┌──────────────────────────────────────┬──────────────────────────────────┐ │
│  │ IZQUIERDA (datos del grupo)         │ DERECHA (grafiti / imagen)       │ │
│  │                                      │                                  │ │
│  │  ORGANIZACIÓN                        │   [ Imagen del grafiti ]         │ │
│  │  BV (nombre grande)                  │   Fondo oscuro                   │ │
│  │                                      │                                  │ │
│  │  Colores del grupo:                  │                                  │ │
│  │  ┌────────────────────────────────┐  │                                  │ │
│  │  │ Principal: ● #FFF700           │  │                                  │ │
│  │  │ Secundario: ● #FFFFFF          │  │                                  │ │
│  │  └────────────────────────────────┘  │                                  │ │
│  │                                      │                                  │ │
│  │  ⚠ Peligrosidad: Media               │                                  │ │
│  │  👥 Miembros: 0                       │                                  │ │
│  └──────────────────────────────────────┴──────────────────────────────────┘ │
│                                                                              │
│  Fondo sección: #050505                                                      │
│  Bloque colores: negro puro (#000000)                                        │
│  Borde bloque: #222222                                                       │
│  Acentos: color del grupo                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
Código
┌──────────────────────────────────────────────────────────────────────────────┐
│ SECCIÓN 2 — UBICACIÓN VISUAL (ÚNICA EN DOS COLUMNAS)                         │
│                                                                              │
│  ┌──────────────────────────────────┐ ┌────────────────────────────────────┐ │
│  │ MAPA TERRITORIAL                 │ │ MAPA DE ACTIVIDAD / GRAFITIS       │ │
│  │                                  │ │                                    │ │
│  │ [ Polígono con color del grupo ] │ │ [ Marcadores color del grupo ]     │ │
│  │ [ Etiqueta BV en el centro ]     │ │ [ Icono spray ]                    │ │
│  │                                  │ │                                    │ │
│  └──────────────────────────────────┘ └────────────────────────────────────┘ │
│                                                                              │
│  Fondo tarjetas: #070707                                                     │
│  Borde: #242424                                                              │
│  Acentos: color del grupo                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
ANOTACIÓN IMPORTANTE:  
Esta es la única sección que puede tener dos columnas.
Todo lo demás es ancho completo.

Código
┌──────────────────────────────────────────────────────────────────────────────┐
│ SECCIÓN 3 — GALERÍA DE FOTOS (CARRUSEL GRANDE, 100% ANCHO)                   │
│                                                                              │
│                         [ + Subir imágenes ]                                 │
│                                                                              │
│      <      ┌──────────────────────────────────────────────────────────┐   > │
│             │                                                          │     │
│             │                 IMAGEN GRANDE DEL CARRUSEL               │     │
│             │                                                          │     │
│             └──────────────────────────────────────────────────────────┘     │
│                                                                              │
│                           ●  ○  ○  ○  ○                                      │
│                                                                              │
│  Fondo galería: #050505                                                      │
│  Fondo imagen: #111111                                                       │
│  Indicador activo: color del grupo                                           │
│  Indicadores inactivos: gris                                                 │
│  Flechas: círculo negro semitransparente                                     │
└──────────────────────────────────────────────────────────────────────────────┘
Código
┌──────────────────────────────────────────────────────────────────────────────┐
│ SECCIÓN 4 — MIEMBROS DEL GRUPO (GRID HORIZONTAL, 100% ANCHO)                 │
│                                                                              │
│                        [ + Añadir miembro ]                                  │
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────┐│
│  │ FOTO             │ │ FOTO             │ │ FOTO             │ │ FOTO     ││
│  │                  │ │                  │ │                  │ │          ││
│  │ Nombre Apellido  │ │ Nombre Apellido  │ │ Nombre Apellido  │ │ Nombre   ││
│  │ State ID: 12345  │ │ State ID: 12345  │ │ State ID: 12345  │ │ ID: ...  ││
│  │ @usuario         │ │ @usuario         │ │ @usuario         │ │ @user    ││
│  │ Grupo actual: BV │ │ Grupo actual: BV │ │ Grupo actual: BV │ │ BV       ││
│  │ Grupo ant.: —    │ │ Grupo ant.: —    │ │ Grupo ant.: —    │ │ —        ││
│  │ Cargo: Miembro   │ │ Cargo: Líder     │ │ Cargo: Camello   │ │ Miembro  ││
│  │ Estado: Activo ● │ │ Estado: No act.  │ │ Estado: Activo ● │ │ Activo ● ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────┘│
│                                                                              │
│  Fondo tarjeta: #080808                                                      │
│  Borde tarjeta: color del grupo                                              │
│  Estado activo: verde (#2ECC71)                                              │
│  Estado no activo: rojo (#E74C3C)                                            │
└──────────────────────────────────────────────────────────────────────────────┘
📐 ORDEN FINAL (ESTRICTO)
Código
1. Navbar
2. Cabecera con buscador
3. Información del grupo
4. Mapas (dos columnas)
5. Galería (ancho completo)
6. Miembros (ancho completo)