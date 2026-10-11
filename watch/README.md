# Admira Visor · fase A · encargo #5655 · FLT-101914

App nativa independiente para watchOS 26+, SwiftUI y AVPlayer. Versión v.11.10.2026.r1, build 5655. Lee la playlist real `virtual-frescaria` mediante `/pruebas/visor/watch-playlist`: cinco imágenes de 10 s y un vídeo de 5 s en la comprobación inicial. El servidor reduce imágenes a un máximo de 410 px; conserva la proporción, por lo que caben en los 410×502 del Ultra. El vídeo se descarga mediante la sesión firmada y AVPlayer reproduce el fichero local, silenciado y en bucle durante su turno. Existe un póster del clip actual como alternativa si falla la reproducción.

## Preparar e instalar

1. Crear un enlace **distinto para cada simulador o reloj**, con el alta oficial del visor (`/pruebas/visor-enlace/`). El enlace dura hasta 7 días, tiene revocación en VISOR_LINKS y se vincula a un dispositivo. La clave de firma nunca va en la app. Para el backend de desarrollo, usar el origen `https://admira.biz`, conservando ruta y token. No compartir enlaces ni subir Config/Device.plist a Git.
2. Pasar el enlace por stdin a `python3 watch/scripts/configure-link.py`. El fichero se excluye de Git. `xcodegen generate --spec watch/project.yml` crea el proyecto.
3. Abrir el proyecto generado o usar `xcodebuild -project watch/AdmiraVisor.xcodeproj -scheme AdmiraVisor -destination 'platform=watchOS Simulator,id=<UDID>' -derivedDataPath watch/.build/simulator CODE_SIGNING_ALLOWED=NO build`. Instalar con `xcrun simctl install <UDID> watch/.build/simulator/Build/Products/Debug-watchsimulator/AdmiraVisor.app` y lanzar `com.admiranext.visor.watch`.
4. Para el Watch físico: generar otro enlace y compilar con destino `generic/platform=watchOS`, firma automática y Team JTVR8HASG7 (el equipo de Carlos disponible en este Mac). Usar `-allowProvisioningUpdates -allowProvisioningDeviceRegistration`. Instalar con `xcrun devicectl device install app --device <UDID> <ruta.app>`.
   El atajo `bash watch/scripts/install-device.sh <UDID>` compila para el destino real, actualiza el aprovisionamiento, instala y lanza. Requiere el enlace propio ya configurado y el modo desarrollador activado; no concede permisos.
5. En el reloj abrir **Admira Visor** en la lista de apps. La reproducción comienza sola. El contador muestra la posición. Ante caducidad, revocación o falta de red, aparece un mensaje y Reintentar; renovar un enlace requiere volver a configurar y compilar esta versión de desarrollo.

El Watch Ultra de Carlos requiere **Ajustes → Privacidad y seguridad → Modo desarrollador**, reinicio y confirmación. Debe estar desbloqueado y conectado al Mac/iPhone. No concedemos permisos ni activamos ese modo en nombre de Carlos.

## Backend y despliegue de prueba

No se cambia producción de admira.tv ni se replican clones. Los dos nuevos endpoints están bajo el middleware firmado ya existente. El fetch de playlist ocurre en servidor: no hace falta abrir CORS ni iniciar sesión en el Watch.

La rama de prueba vive en `codex-watch-5655.admiranext.pages.dev`; el puente fija el despliegue inmutable `868b396d.admiranext.pages.dev`. La red de este Mac no conecta a los IP 188.114.96.5/97.5 asignados a pages.dev, aunque el mismo host responde usando un IP alternativo de Cloudflare. Un worker pequeño en `watch/server` sirve **solo GET/HEAD de `/pruebas/visor/*` en admira.biz y www.admira.biz**, que son los dominios permitidos por Carlos. Reenvía al backend de la rama y conserva la verja, la cookie y caché privada. No cambia otras rutas de admira.biz. Para revertir, retirar esas dos rutas del worker `admira-watch-preview`; no borrar el KV compartido del visor.

## Límites reales

- watchOS controla el reposo y el retorno a la esfera. `WKSupportsAlwaysOnDisplay` permite el estado Always On cuando el usuario lo habilita. No hay una API pública para bloquear permanentemente el reloj como un quiosco. La app pausa vídeos y rotación al quedar inactiva o atenuarse, y continúa al volver al primer plano.
- Se requiere red y enlace vigente. No hay login, selector de pantalla ni quioscos reales en esta fase; eso es fase B.
- El enlace y la firma son de desarrollo, no una distribución App Store ni un certificado de producción.
- Las capturas del simulador y los registros prueban el simulador. La instalación física solo se declara verificada tras instalar y ejecutar en el Ultra.
- El minitutorial del generador oficial es una animación explicativa, no una grabación de pantalla ni una prueba de instalación.
