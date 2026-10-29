(function (G) {
  var A = G.AdmiraIdiomaArmazon;
  if (!A || !A.anadir) return;
  A.anadir({
    'SIMULACIÓN / SIN CONEXIÓN': 'SIMULATION / NO CONNECTION',
    'CONECTADO': 'CONNECTED',
    'Limpieza': 'Cleaning',
    'Robot': 'Robot',
    'Esta imagen es la captura 3D de Mapa1 en la app Roborock, a las 19:45 del 29 de octubre de 2026. Sin claves del puente no hay pose leída y esta página no mueve el robot.': 'This image is the 3D capture of Mapa1 in the Roborock app, at 19:45 on 29 October 2026. Without bridge keys there is no pose reading and this page does not move the robot.',
    'Mapa1 · vista 3D': 'Mapa1 · 3D view',
    'Captura 3D de Mapa1 en la app Roborock': '3D capture of Mapa1 in the Roborock app',
    'El disco que se ve dentro del plano es el de esa captura. No es una pose leída ahora, así que no se dibuja otro robot.': 'The disc inside the plan is the one in that capture. It is not a pose read now, so no other robot is drawn.',
    'La app nombró Cocina, Terraza y Pasillo. En esta captura 3D no se leen los nombres sobre el plano, así que no se marcan.': 'The app named Cocina, Terraza and Pasillo. This 3D capture does not print those names on the plan, so they are not marked.',
    'Sin conexión. No hay pose leída.': 'No connection. No pose has been read.',
    'Pose leída.': 'Pose read.',
    'No mueven el robot: no hay conexión.': 'They do not move the robot: there is no connection.',
    'Cocina': 'Cocina',
    'Terraza': 'Terraza',
    'Pasillo': 'Pasillo',
    'Parar': 'Stop',
    'Cámara': 'Camera',
    'Cámara no conectada': 'Camera not connected',
    'Cámara conectada': 'Camera connected',
    'Salir · sin conexión': 'Leave dock · no connection',
    'Volver a la base · sin conexión': 'Return to dock · no connection',
    'Salir': 'Leave dock',
    'Volver a la base': 'Return to dock',
    'Sin conexión. Salir no se ha enviado.': 'No connection. Leave dock was not sent.',
    'Sin conexión. Volver a la base no se ha enviado.': 'No connection. Return to dock was not sent.',
    'Estado leído: ': 'State read: ',
    '. Batería: ': '. Battery: ',
    'RESPUESTA LEÍDA / SIN POSE': 'RESPONSE READ / NO POSE',
    'Capa de lidar: no disponible. La librería no entrega la nube de puntos y, sin claves, esta página no dibuja una capa.': 'Lidar layer: not available. The library does not provide the point cloud and, without keys, this page does not draw a layer.',
    'No hay visor de cámara. La librería nombra la vista previa y no trae el vídeo. Sin claves no hay imagen del robot.': 'There is no camera viewer. The library names the preview and does not include the video. Without keys there is no image from the robot.',
    'Brazo: la librería no trae una orden para moverlo. Esta página no envía ninguna.': 'Arm: the library has no command to move it. This page does not send one.',
    'Activar cámara · pendiente de tu OK': 'Turn the camera on · waiting for your OK',
    'Mover el brazo · pendiente de tu OK': 'Move the arm · waiting for your OK',
    'Pendiente del OK de Carlos. Activar cámara no se ha enviado.': 'Waiting for Carlos OK. Turn the camera on was not sent.',
    'Pendiente del OK de Carlos. Mover el brazo no se ha enviado.': 'Waiting for Carlos OK. Move the arm was not sent.',
    'Prueba preparada, sin enviar. Activar cámara no llama a start_camera_preview. Mover el brazo no tiene orden en python-roborock 7.13.0 y esta página no inventa una.': 'Test prepared, nothing sent. Turn the camera on does not call start_camera_preview. Move the arm has no command in python-roborock 7.13.0 and this page does not invent one.'
  });
  if (A.aplicar) A.aplicar();
})(typeof window !== 'undefined' ? window : globalThis);
