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
