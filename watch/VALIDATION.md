# Validación · v.11.10.2026.r1 · #5655

- Xcode 27.0 (27A266a), SDK watchOS 27; simulador Ultra 3 watchOS 26.5.
- 20 pruebas Node pasan: playlist fija, tamaños reales de JPEG, rechazo de host externo y regresión del visor firmado existente.
- Compilaciones para simulador 26.5 y 27 completadas y app ejecutada con contenido real. La compilación genérica para dispositivo físico pasó con firma Apple Development del equipo JTVR8HASG7; aquel perfil aún no incluía el UDID del Watch. Se ejecutó además la compilación dirigida al Ultra para registrar y aprovisionar el destino real, bloqueada por un timeout de conexión al dispositivo.
- Desarrollo aislado: backend de rama en Pages; puente GET/HEAD bajo `/pruebas/visor/` en admira.biz. Sin firma devuelve 401. La configuración preview carecía de VISOR_LINK_KEY; se habilitó únicamente ahí la clave existente. El puente apunta al despliegue inmutable 868b396d. La lectura de playlist requiere seguir el redireccionamiento de origen. Producción admira.tv sin cambios.
- Minitutorial exportado por https://www.admiranext.com/tiktok/, revisado y convertido a H.264/AAC, 1080×1920, 15,18 segundos. Es animación explicativa, no captura de pantalla. Enlace duradero guardado en los avances de Yokup.
- Prueba real del backend: las seis piezas responden 200; imágenes de 20–31 KB con tamaños 410×230, 308×410 y 246×410; MP4 de 159.403 bytes.
- Ciclos reales completos observados en ambos simuladores: 1/6 → 6/6 (vídeo con fotogramas distintos) → 1/6. Capturas de cada pieza y registros de rotación adjuntos a Yokup.
- La prueba física requiere modo desarrollador y conexión. No equivale a instalación verificada el hecho de compilar con firma. El primer intento falló por timeout Bluetooth y la consulta posterior seguía mostrando Developer Mode Disabled.

Las capturas y registros reales viven en la evidencia de la misión FLT-101914. El criterio de hecho exige ejecución física; hasta verificarla, #5655 permanece abierto.

Revisión cruzada de Wozniak (#5659) aprobada para código, seguridad y límites de fase A en simulador. Se corrigió la conservación del puerto del origen y se rechazaron URLs de configuración sin host o con credenciales. Límites aceptados: póster vinculado al clip actual; descarga completa acotada por el servidor del visor (1,2 MB máximo). La instalación física sigue pendiente.

## Retoques de diseño · #5682 · FLT-101935 · 11-oct-2026

- Base b41907a del PR #173. Cabecera pequeña en #33FF99, sin los márgenes de contenido de watchOS; fotos horizontales al ancho completo y verticales al alto disponible, conservando proporción. Sala A aprovecha la altura para hacer legibles Ahora y Siguiente.
- Título blanco de 16 pt seminegrita, una línea con elipsis, superpuesto sobre un degradado negro en la parte inferior de la pieza.
- Superficie del vídeo al ancho completo con bandas negras; orientación leída de la pista, incluida su transformación. Walt aprobó mantener íntegro el MP4 vertical a altura máxima (#5687, #5690, #5691): el recorte a todo el ancho corta el teléfono. El verde oscuro forma parte del propio MP4, no de las bandas del player. Su etiqueta de catálogo aún es «Clip 5s»; se usa el alias descriptivo local «Modelo de pantalla · envío» únicamente para esta pieza y este título provisional. El Stock conserva sus metadatos.
- Xcode 27.0 / watchOS 26.5: compilación del código final para simulador completada; 20/20 pruebas existentes de Watch y visor pasan. Capturas reales de Ultra 3 (49 mm, 422×514) y Series 9 (41 mm, 352×430): horizontal, vertical, Sala A y vídeo. Dos fotogramas diferentes prueban reproducción en ambos tamaños; el verde exacto de cabecera se comprobó en píxeles.
- [Comparación de los dos simuladores](https://api.yokup.com/media/fleet/1410daf0631fe83f.png). Las capturas de diseño usan una copia de QA local, sin versionar, con los assets reales de virtual-frescaria y el mismo SwiftUI/AVPlayer; solo el transporte de red se sustituye por ficheros para evitar crear o reutilizar enlaces firmados. No prueban una nueva conexión autenticada ni la instalación física.
- Revisión creativa de Walt aprobada antes de la entrega. El título permanece **blanco**, conforme a la instrucción expresa de Carlos; el verde se aplica a ADMIRA VISOR y al contador. Push únicamente a codex/watch-5655; sin merge ni despliegue de esta revisión.
