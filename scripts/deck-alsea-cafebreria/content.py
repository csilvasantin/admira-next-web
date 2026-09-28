"""Textos Alsea · Cafebrería (ES + EN), clon fiel de jti-xtanco-circuito / jti-xtanco-inserto.
Mismos ids, actos, capítulos, minutos y promesas; solo cambia el Xpacio (Xtanco -> Cafebrería)
y el contenido de 2a/2b/2c adaptado a cafetería. Sin cifras ni porcentajes inventados."""

MAIN = 'alsea-cafebreria-circuito'
INSERT = 'alsea-cafebreria-inserto'
MAIN_NAME = 'Alsea · Cafebrería · Circuito Clear Channel'
INSERT_NAME = 'Alsea · Cafebrería · Inserto circuito'
WEBSITE = 'https://www.alsea.net'
INSPIRATION = 'https://www.clearchannel.tv'

# Deep-links del punto Xpacio de la demo (verificados en producción por el coordinador).
# Para cambiarlos: python3 set-deeplink.py <url_es> <url_en>
DEEPLINK_ES = 'https://www.admira.app/?locationId=cafebreria-barcelona'
DEEPLINK_EN = 'https://www.clearchannel.tv/?locationId=cafebreria-barcelona'
TWIN = 'https://www.xpaceos.com/admira-xp/?autostart=cafeteria&loc=cafebreria-barcelona'
XPACIO_3D = 'https://www.xpaceos.com/xpacios/cafebreria/'
POINT = 'Cafebrería Barcelona · Passeig de Gràcia 103'

AUDIENCE = 'Equipo de Alsea, reunión del miércoles 30 de septiembre de 2026 con Carlos Silva / AdmiraNeXT.'
PROBLEM = ('Estructura AdmiraNeXT para Alsea. Xpacio protagonista: la Cafebrería, la cafetería-librería de Alsea. '
           '45 minutos = 3 actos de 15 (admira.studio, admira.store, admira.app) con capítulos a, b y c de 5 minutos. '
           'Momento clave: una pantalla se pone en rojo y sale por garantía, incidencia en yokup.com o «Reponer» en admira.shop. '
           'Sin porcentajes ni cifras inventadas.')

MAIN_ES = {
    'hero': {
        'eyebrow': 'Estructura AdmiraNeXT · Alsea · Cafebrería · Circuito Clear Channel',
        'title': 'El Xpacio, un personaje que nunca se apaga',
        'summary': 'Estructura AdmiraNeXT · Alsea, la Cafebrería, la cafetería-librería de Alsea: tres promesas, tres actos de 15 minutos, nueve capítulos de 5 minutos (45 min).',
    },
    'objective': ('Las tres promesas de Admira en la Cafebrería, la cafetería-librería de Alsea. '
                  '1 Ahorrar dinero optimizando las operaciones: menos errores y menos coste al crear, convertir y distribuir contenidos (admira.studio, 1a y 1b) '
                  'y supervisión y mantenimiento desde un solo sitio de todo el IoT del espacio (admira.store, 2a). '
                  '2 Ganar dinero: ingresos indirectos vendiendo espacios publicitarios en pantallas, hilo musical y avatares digitales del circuito de 100 cafeterías de Alsea (admira.app, acto 3). '
                  '3 Mejorar la experiencia de usuario, interna (Alsea) y externa (quien entra en la cafetería: 1c, 2b, 2c).'),
    'skeleton': {
        'studio-a': {'message': 'Imágenes, locuciones, música y vídeos para la Cafebrería, la cafetería-librería de Alsea, creados con IA: menos errores y menos coste de producción en la creación.'},
        'studio-b': {'message': 'Cada pieza se convierte a todos los formatos y pantallas del local, de los menu boards de la barra a la pantalla de pedido listo: menos errores y menos coste en la conversión; la distribución enlaza con el acto 2.'},
        'studio-c': {'message': 'La anonimización de los clientes permite adaptar el contenido sin identificar a nadie y mejora la experiencia de quien entra en la cafetería.'},
        'store-cover': {'title': 'Acto 2 · admira.store · El control de la Xperience en la Cafebrería, la cafetería-librería de Alsea'},
        'store-a': {'title': '2a · admira.store · Menu boards, pedido listo, hilo musical, aroma a café, wifi y seguridad · 5 min',
                    'message': 'Los menu boards sobre la barra, la pantalla de pedido listo, el hilo musical, el aroma a café, el wifi y la seguridad, supervisados y mantenidos desde un solo sitio: el ahorro operativo del acto 2.'},
        'store-b': {'title': '2b · admira.store · Segmentación por franjas y clima · 5 min',
                    'message': 'El contenido cambia por franja horaria —desayuno, mediodía y tarde— y por condiciones externas como el clima, medidas con analítica de vídeo, de radio y de objetos.'},
        'store-c': {'message': 'El club y la app de fidelización personalizan la experiencia de quien entra en la cafetería.'},
        'app-a': {'message': f'Se ve todo el circuito de 100 cafeterías de Alsea y se venden sus espacios publicitarios en pantallas, hilo musical y avatares digitales: ingresos indirectos. Punto Xpacio de la demo: {POINT} · {DEEPLINK_ES}'},
    },
}

MAIN_EN = {
    'hero': {
        'eyebrow': 'AdmiraNeXT Structure · Alsea · Cafebrería · Clear Channel Circuit',
        'title': 'The Xpacio, a character that never turns off',
        'summary': "AdmiraNeXT Structure · Alsea, the Cafebrería, Alsea's café-bookshop: three promises, three 15-minute acts, nine 5-minute chapters (45 min).",
    },
    'objective': ("Admira's three promises at the Cafebrería, Alsea's café-bookshop. "
                  "1 Save money by optimizing operations: fewer errors and lower cost when creating, converting and distributing content (admira.studio, 1a and 1b) "
                  "and supervision and maintenance from a single place of all the space's IoT (admira.store, 2a). "
                  "2 Make money: indirect revenue by selling advertising spaces on screens, music channels and digital avatars across the circuit of 100 Alsea cafés (admira.app, act 3). "
                  "3 Improve the user experience, internal (Alsea) and external (those who walk into the café: 1c, 2b, 2c)."),
    'skeleton': {
        'studio-a': {'message': "Images, voice-overs, music and videos for the Cafebrería, Alsea's café-bookshop, created with AI: fewer errors and lower production cost in creation."},
        'studio-b': {'message': 'Each piece is converted to all formats and screens in the premises, from the menu boards over the counter to the order-ready screen: fewer errors and lower cost in conversion; distribution links to act 2.'},
        'studio-c': {'message': 'Customer anonymization allows content to be adapted without identifying anyone and improves the experience of those who walk into the café.'},
        'store-cover': {'title': "Act 2 · admira.store · Xperience control at the Cafebrería, Alsea's café-bookshop"},
        'store-a': {'title': '2a · admira.store · Menu boards, order-ready screen, music channel, coffee aroma, wifi and security · 5 min',
                    'message': 'Menu boards over the counter, the order-ready screen, music channel, coffee aroma, wifi and security supervised and maintained from a single place: the operational savings of act 2.'},
        'store-b': {'title': '2b · admira.store · Segmentation by time slots and weather · 5 min',
                    'message': 'Content changes by time slot —breakfast, midday and afternoon— and by external conditions such as the weather, measured with video, radio and object analytics.'},
        'store-c': {'message': 'The loyalty club and app personalize the experience of those who walk into the café.'},
        'app-a': {'message': f'The entire circuit of 100 Alsea cafés is viewed and their advertising spaces are sold on screens, music channels and digital avatars: indirect revenue. Demo Xpacio point: {POINT} · {DEEPLINK_EN}'},
    },
}

MAIN_NOTES = ('Estructura AdmiraNeXT forzada (12 láminas). Xpacio protagonista: la Cafebrería, la cafetería-librería de Alsea. '
              'Validar identidad y lenguaje antes de compartir. Web: https://www.alsea.net. '
              f'Punto de la demo: {POINT} (ES {DEEPLINK_ES} · EN {DEEPLINK_EN}). '
              f'Gemelo en vivo: {TWIN} · Xpacio 3D: {XPACIO_3D}.')

INSERT_ES = {
    'hero': {'eyebrow': 'Estructura AdmiraNeXT · Alsea · Cafebrería · Inserto circuito',
             'title': 'Alsea · Cafebrería · Inserto circuito',
             'summary': 'admira.studio → admira.store → admira.app. Recorrido AdmiraNeXT de 45 minutos con Alsea · Cafebrería · Inserto circuito.'},
    'objective': 'Lámina de inserción: del Xpacio vivo al gemelo digital, antes de admira.app.',
    'skeleton': {
        'vision': {'title': 'La Cafebrería como Xpacio vivo',
                   'message': f'Cada cafetería de Alsea se ve y se gobierna como un punto más del mismo circuito en admira.app. Xpacio 3D de la Cafebrería: {XPACIO_3D}'},
        'entender': {'title': 'El gemelo digital de la Cafebrería',
                     'message': f'admira.store lee la ocupación por zonas, los recorridos y el uso de cada superficie con privacidad desde el diseño. Ese gemelo es el puente hacia los 100 puntos del circuito en admira.app. Gemelo en vivo: {TWIN}'},
    },
    'closing': {'title': 'Elijamos el primer acto con Alsea · Cafebrería · Inserto circuito.'},
}
INSERT_EN = {
    'hero': {'eyebrow': 'AdmiraNeXT Structure · Alsea · Cafebrería · Circuit Insert',
             'title': 'Alsea · Cafebrería · Circuit Insert',
             'summary': 'admira.studio → admira.store → admira.app. 45-minute AdmiraNeXT tour with Alsea · Cafebrería · Circuit Insert.'},
    'objective': 'Insertion slide: from the live Xpacio to the digital twin, before admira.app.',
    'skeleton': {
        'vision': {'title': 'The Cafebrería as a live Xpacio',
                   'message': f"Each Alsea café is seen and governed as one more point on the same circuit in admira.app. The Cafebrería's 3D Xpacio: {XPACIO_3D}"},
        'entender': {'title': 'The Cafebrería digital twin',
                     'message': f'admira.store reads occupancy by zone, journeys and the use of each surface with privacy by design. That twin is the bridge to the 100 points on the circuit in admira.app. Live twin: {TWIN}'},
    },
    'closing': {'title': 'Let’s choose the first act with Alsea · Cafebrería · Circuit Insert.'},
}
INSERT_NOTES = ('Estructura AdmiraNeXT forzada (2 láminas). Validar identidad y lenguaje antes de compartir. Web: https://www.alsea.net. '
                f'Gemelo en vivo: {TWIN} · Xpacio 3D: {XPACIO_3D}.')

# Renders de la cafetería (Trinity · Blender, sin logos) en Pixeria Stock -> lámina.
RENDERS = [
    {'stock': '1790364726790-jj8q5b', 'slide': 'cover', 'caption': 'Cafebrería · vista isométrica (render 3D sin logos)',
     'caption_name': 'alsea-render-iso.png'},
    {'stock': '1790364983143-sac9ai', 'slide': 'store-cover', 'caption': 'Cafebrería · desde la entrada (render 3D sin logos)',
     'caption_name': 'alsea-render-entrada.png'},
    {'stock': '1790364841230-0hef9v', 'slide': 'store-a', 'caption': 'Cafebrería · frontal de la barra con los menu boards (render 3D sin logos)',
     'caption_name': 'alsea-render-frontal.png'},
    {'stock': '1790365122552-qw8bkk', 'slide': 'app-a', 'caption': 'Cafebrería · vista cenital, el «ojo de Dios» (render 3D sin logos)',
     'caption_name': 'alsea-render-cenital.png'},
]
