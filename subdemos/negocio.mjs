// Copia de los manifiestos Store/Biz para navegador, API y fallback de Experto.
export const MANIFIESTOS_NEGOCIO = [
  {
    "version": 1,
    "plataforma": "store",
    "nombre": "admira.store",
    "default_mode": "recorrido",
    "activacion": {
      "hosts": [
        "admira.store",
        "www.admira.store"
      ]
    },
    "subdemos": [
      {
        "id": "voz",
        "letra": "a",
        "nombre": "Gestión de locuciones",
        "desc": "Seleccionar una locución, asignarla a una zona y preparar su horario.",
        "url": "https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=es",
        "cmd": "/demo 1",
        "aliases": [
          "locucion",
          "locuciones",
          "voz"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=store&demo=voz",
        "guion": [
          {
            "accion": "di",
            "texto": "Abrir el local de demostración y su gestión de audio."
          },
          {
            "accion": "señala",
            "texto": "Seleccionar la locución preparada de café y bollería; escucharla."
          },
          {
            "accion": "señala",
            "texto": "Asignar entrada y caja, volumen 65 y horario de desayuno."
          },
          {
            "accion": "señala",
            "texto": "Revisar la programación y el resultado antes de activarlo."
          }
        ],
        "steps": [],
        "caso": {
          "local": "alsea-sbux-021",
          "contenido": "Locución de desayuno",
          "destinos": [
            "Entrada",
            "Caja"
          ],
          "volumen": 65,
          "horario": "08:00–11:00",
          "estado": "Programación de ejemplo preparada"
        },
        "muestra": {
          "tipo": "audio",
          "url": "https://www.pixeria.com/assets/demos/studio-v1/locucion-es.mp3",
          "descripcion": "Locución preparada para el ensayo; programación de ejemplo."
        }
      },
      {
        "id": "musica",
        "letra": "b",
        "nombre": "Gestión de música",
        "desc": "Seleccionar la playlist del local, zonas, volumen y franjas horarias.",
        "url": "https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=es",
        "cmd": "/demo 2",
        "aliases": [
          "musica",
          "playlist",
          "hilo musical"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=store&demo=musica",
        "guion": [
          {
            "accion": "di",
            "texto": "Abrir la gestión del hilo musical del local."
          },
          {
            "accion": "señala",
            "texto": "Escuchar el ambiente musical preparado y seleccionarlo."
          },
          {
            "accion": "señala",
            "texto": "Asignar sala y terraza, volumen 45 y la franja de tarde."
          },
          {
            "accion": "señala",
            "texto": "Revisar cómo conviven música y locución en la programación."
          }
        ],
        "steps": [],
        "caso": {
          "local": "alsea-sbux-021",
          "playlist": "Ambiente de cafetería",
          "destinos": [
            "Sala",
            "Terraza"
          ],
          "volumen": 45,
          "horario": "16:00–20:00",
          "prioridad": "La locución atenúa temporalmente la música"
        },
        "muestra": {
          "tipo": "audio",
          "url": "https://www.pixeria.com/assets/demos/studio-v1/musica-cafe.mp3",
          "descripcion": "Pista preparada para ilustrar la gestión del hilo musical."
        }
      },
      {
        "id": "imagenes",
        "letra": "c",
        "nombre": "Gestión de imágenes",
        "desc": "Seleccionar creatividades, organizarlas en playlist y asignar pantallas.",
        "url": "https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=es",
        "cmd": "/demo 3",
        "aliases": [
          "imagen",
          "imagenes",
          "creatividades"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=store&demo=imagenes",
        "guion": [
          {
            "accion": "di",
            "texto": "Abrir la gestión de contenidos visuales del local."
          },
          {
            "accion": "señala",
            "texto": "Seleccionar la creatividad de café preparada."
          },
          {
            "accion": "señala",
            "texto": "Asignarla a la pantalla de entrada y fijar su orden en la playlist."
          },
          {
            "accion": "señala",
            "texto": "Revisar el calendario y la vista previa de la pantalla."
          }
        ],
        "steps": [],
        "caso": {
          "local": "alsea-sbux-021",
          "contenido": "Creatividad de café",
          "destinos": [
            "Pantalla de entrada"
          ],
          "playlist": "Campaña de desayuno",
          "orden": 1,
          "horario": "08:00–11:00"
        },
        "muestra": {
          "tipo": "image",
          "url": "https://www.pixeria.com/assets/demos/studio-v1/imagen-cafe.jpg",
          "descripcion": "Creatividad preparada para el ensayo de gestión."
        }
      },
      {
        "id": "video",
        "letra": "d",
        "nombre": "Gestión de vídeo",
        "desc": "Ordenar clips en playlist, asignar destinos y comprobar su reproducción.",
        "url": "https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=es",
        "cmd": "/demo 4",
        "aliases": [
          "video",
          "videos",
          "clip"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=store&demo=video",
        "guion": [
          {
            "accion": "di",
            "texto": "Abrir la playlist de vídeo del local."
          },
          {
            "accion": "señala",
            "texto": "Previsualizar el clip preparado de la campaña."
          },
          {
            "accion": "señala",
            "texto": "Asignarlo a la pantalla de pared y colocarlo después de la imagen."
          },
          {
            "accion": "señala",
            "texto": "Revisar la reproducción y la programación por destino."
          }
        ],
        "steps": [],
        "caso": {
          "local": "alsea-sbux-021",
          "contenido": "Clip de campaña de café",
          "destinos": [
            "Pantalla de pared"
          ],
          "playlist": "Campaña de desayuno",
          "orden": 2,
          "reproduccion": "Bucle dentro de la playlist"
        },
        "muestra": {
          "tipo": "video",
          "url": "https://www.pixeria.com/assets/demos/studio-v1/video-fuente.mp4",
          "poster": "https://www.pixeria.com/assets/demos/studio-v1/video-fuente.jpg",
          "descripcion": "Clip preparado para el ensayo de gestión."
        }
      },
      {
        "id": "tpv",
        "letra": "e",
        "nombre": "Gestión del TPV",
        "desc": "Seleccionar un producto y enseñar su relación con audio, pantallas y reglas del local.",
        "url": "https://www.admira.store/admira-xp/?marca=starbucks&loc=alsea-sbux-021&project=starbucks&circuit=alsea_starbucks&lang=es&demo=tpv#tpv",
        "cmd": "/demo 5",
        "aliases": [
          "tpv",
          "caja",
          "venta"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=store&demo=tpv",
        "guion": [
          {
            "accion": "di",
            "texto": "Abrir el TPV del gemelo de demostración."
          },
          {
            "accion": "señala",
            "texto": "Seleccionar un muffin para mostrar la operación en caja."
          },
          {
            "accion": "señala",
            "texto": "Revisar la regla que relaciona el producto con su campaña."
          },
          {
            "accion": "señala",
            "texto": "Comprobar los destinos de audio y vídeo asociados en este ensayo."
          }
        ],
        "steps": [],
        "caso": {
          "local": "alsea-sbux-021",
          "producto": "Muffin",
          "evento": "Selección de producto en TPV",
          "regla": "Si se selecciona el muffin, mostrar la campaña asociada",
          "destinos": [
            "Caja",
            "Pantalla de pared",
            "Altavoces"
          ]
        }
      }
    ],
    "nota": "Recorridos preparados con datos de demostración. El ensayo conserva cambios solo en esta sesión; el alta o la activación real se revisa en la plataforma."
  },
  {
    "version": 1,
    "plataforma": "biz",
    "nombre": "admira.biz",
    "default_mode": "recorrido",
    "activacion": {
      "hosts": [
        "admira.biz",
        "www.admira.biz",
        "clearchannel.tv",
        "www.clearchannel.tv"
      ]
    },
    "subdemos": [
      {
        "id": "proyecto",
        "letra": "a",
        "nombre": "Dar de alta un proyecto",
        "desc": "Definir el identificador, nombre, responsable y circuito del proyecto.",
        "url": "https://www.admiranext.com/xpace/manage",
        "cmd": "/demo 1",
        "aliases": [
          "proyecto",
          "alta proyecto"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=biz&demo=proyecto",
        "guion": [
          {
            "accion": "di",
            "texto": "Abrir la gestión de proyectos y preparar un alta de demostración."
          },
          {
            "accion": "señala",
            "texto": "Definir un identificador estable y un nombre reconocible."
          },
          {
            "accion": "señala",
            "texto": "Relacionar el proyecto con su circuito y revisar su responsable."
          },
          {
            "accion": "señala",
            "texto": "Validar los datos preparados antes de dar el alta real."
          }
        ],
        "steps": [],
        "caso": {
          "id": "demo-alsea-retail",
          "nombre": "Alsea · Retail Media",
          "responsable": "Equipo de demostración",
          "circuito": "demo-alsea-dooh",
          "estado": "Ficha de ejemplo preparada"
        }
      },
      {
        "id": "circuito",
        "letra": "b",
        "nombre": "Dar de alta un circuito DooH",
        "desc": "Agrupar puntos DooH y definir el vuelo de la campaña con fechas, franjas y frecuencia.",
        "url": "https://www.admiranext.com/xpace/manage",
        "cmd": "/demo 2",
        "aliases": [
          "circuito",
          "dooh",
          "vuelo"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=biz&demo=circuito",
        "guion": [
          {
            "accion": "di",
            "texto": "Preparar el circuito vinculado al proyecto de demostración."
          },
          {
            "accion": "señala",
            "texto": "Añadir sus diferentes puntos DooH: entrada, escaparate y tótem."
          },
          {
            "accion": "señala",
            "texto": "Definir el vuelo: inicio y fin, franjas, duración de pieza y frecuencia."
          },
          {
            "accion": "señala",
            "texto": "Revisar cobertura por punto y el calendario del vuelo de ejemplo."
          }
        ],
        "steps": [],
        "caso": {
          "id": "demo-alsea-dooh",
          "proyecto": "demo-alsea-retail",
          "puntos": [
            {
              "id": "dooh-entrada",
              "tipo": "Pantalla de entrada"
            },
            {
              "id": "dooh-escaparate",
              "tipo": "Pantalla de escaparate"
            },
            {
              "id": "dooh-totem",
              "tipo": "Tótem"
            }
          ],
          "vuelo": {
            "inicio": "2026-11-01",
            "fin": "2026-11-14",
            "franjas": [
              "08:00–11:00",
              "16:00–20:00"
            ],
            "pieza_segundos": 15,
            "frecuencia": "Una inserción por bloque de ejemplo"
          }
        }
      },
      {
        "id": "gemelo",
        "letra": "c",
        "nombre": "Dar de alta gemelos digitales · Retail Media",
        "desc": "Representar el local, sus zonas y el inventario de soportes de Retail Media.",
        "url": "https://www.admira.biz/backoffice.html",
        "cmd": "/demo 3",
        "aliases": [
          "gemelo",
          "gemelos",
          "retailmedia",
          "retail media"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=biz&demo=gemelo",
        "guion": [
          {
            "accion": "di",
            "texto": "Preparar la ficha del local y su relación con el proyecto."
          },
          {
            "accion": "señala",
            "texto": "Definir las zonas comerciales y sus soportes de Retail Media."
          },
          {
            "accion": "señala",
            "texto": "Asociar el gemelo digital a la ubicación de demostración."
          },
          {
            "accion": "señala",
            "texto": "Revisar qué soportes del gemelo se pueden incluir en una campaña."
          }
        ],
        "steps": [],
        "caso": {
          "gemelo": "alsea-sbux-021",
          "proyecto": "demo-alsea-retail",
          "zonas": [
            "Entrada",
            "Caja",
            "Sala"
          ],
          "retail_media": [
            {
              "zona": "Entrada",
              "soporte": "Pantalla"
            },
            {
              "zona": "Caja",
              "soporte": "Pantalla TPV"
            },
            {
              "zona": "Sala",
              "soporte": "Tótem"
            }
          ]
        }
      },
      {
        "id": "iot",
        "letra": "d",
        "nombre": "Dar de alta dispositivos IoT",
        "desc": "Relacionar pantallas, altavoces, cámaras y tótems con el gemelo y sus controles.",
        "url": "https://www.admira.biz/backoffice.html",
        "cmd": "/demo 4",
        "aliases": [
          "iot",
          "dispositivos",
          "pantallas",
          "altavoces",
          "camaras",
          "totem"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=biz&demo=iot",
        "guion": [
          {
            "accion": "di",
            "texto": "Preparar el alta de dispositivos del gemelo."
          },
          {
            "accion": "señala",
            "texto": "Identificar pantalla, altavoz, cámara y tótem con IDs únicos."
          },
          {
            "accion": "señala",
            "texto": "Asignar zona, tipo de dispositivo y control previsto."
          },
          {
            "accion": "señala",
            "texto": "Revisar conectividad, estado y relación con el inventario tecnológico."
          }
        ],
        "steps": [],
        "caso": {
          "gemelo": "alsea-sbux-021",
          "dispositivos": [
            {
              "id": "demo-screen-01",
              "tipo": "Pantalla",
              "zona": "Entrada",
              "control": "Contenido y estado"
            },
            {
              "id": "demo-speaker-01",
              "tipo": "Altavoz",
              "zona": "Sala",
              "control": "Audio y volumen"
            },
            {
              "id": "demo-camera-01",
              "tipo": "Cámara",
              "zona": "Entrada",
              "control": "Estado y disponibilidad"
            },
            {
              "id": "demo-totem-01",
              "tipo": "Tótem",
              "zona": "Sala",
              "control": "Contenido e interacción"
            }
          ]
        }
      },
      {
        "id": "itil",
        "letra": "e",
        "nombre": "Integrar en el inventario tecnológico · ITIL",
        "desc": "Registrar los dispositivos como elementos de configuración y relacionar ubicación, servicio y mantenimiento.",
        "url": "https://www.xpaceos.com/inventario/starbucks/?view=references",
        "cmd": "/demo 5",
        "aliases": [
          "itil",
          "inventario",
          "tecnologia"
        ],
        "duracion": 60,
        "ensayo_url": "https://www.admiranext.com/subdemos/ensayo.html?plataforma=biz&demo=itil",
        "guion": [
          {
            "accion": "di",
            "texto": "Abrir el inventario tecnológico de la ubicación."
          },
          {
            "accion": "señala",
            "texto": "Preparar una referencia de configuración para cada dispositivo del gemelo."
          },
          {
            "accion": "señala",
            "texto": "Relacionar servicio, responsable y dependencias entre los elementos."
          },
          {
            "accion": "señala",
            "texto": "Revisar estado y vínculo con mantenimiento e incidencias."
          }
        ],
        "steps": [],
        "caso": {
          "servicio": "Retail Media · local piloto",
          "ubicacion": "alsea-sbux-021",
          "responsable": "Equipo de operaciones de demostración",
          "elementos": [
            {
              "ci": "CI-DEMO-SCREEN-01",
              "dispositivo": "demo-screen-01"
            },
            {
              "ci": "CI-DEMO-SPEAKER-01",
              "dispositivo": "demo-speaker-01"
            },
            {
              "ci": "CI-DEMO-CAMERA-01",
              "dispositivo": "demo-camera-01"
            },
            {
              "ci": "CI-DEMO-TOTEM-01",
              "dispositivo": "demo-totem-01"
            }
          ],
          "relacion": "Dispositivo → gemelo → servicio",
          "estado": "Inventario de ejemplo preparado"
        }
      }
    ],
    "nota": "Recorridos preparados con datos de demostración. El ensayo conserva cambios solo en esta sesión; el alta o la activación real se revisa en la plataforma."
  }
];
