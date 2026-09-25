"""python3 -m unittest tools/capsulas/test_guion.py — mismo criterio que test/capsule-tiktok-brief.test.js."""
import os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import guion as G  # noqa: E402

TEXTO = """PARA CARBONO
Joseph Campbell enseña que culturas que nunca se encontraron cuentan el mismo viaje: alguien deja su mundo ordinario, cruza un umbral, supera una prueba que lo cambia y vuelve con un don para los suyos. No es un molde para rellenar escenas.

PARA SILICIO
Al armar un guion: 1) nombra en una frase el mundo ordinario del público; 2) ordena llamada, umbral y prueba.

APLICACIÓN
Lucas reescribe la próxima campaña de AdmiraNeXT como ese viaje.

Fuente: The Hero with a Thousand Faces, de Joseph Campbell (resumen Blinkist; síntesis original AdmiraNeXT)."""


class Guion(unittest.TestCase):
    def test_voz_sin_rotulos(self):
        b = G.bloques(TEXTO)
        voz = G.idea_principal(b["carbono"])
        self.assertTrue(voz.startswith("Joseph Campbell enseña"))
        self.assertNotIn("PARA", voz.upper().split()[0])

    def test_fuente(self):
        self.assertEqual(G.fuente(G.bloques(TEXTO)), ("The Hero with a Thousand Faces", "Joseph Campbell"))

    def test_siglas(self):
        self.assertEqual(len(G.frases("El primer caza de EE. UU. en 143 días fue un hito. Otra frase distinta aquí.")), 2)

    def test_ideas_sin_repetir(self):
        b = G.bloques(TEXTO)
        ideas = G.ideas_automaticas(b, G.idea_principal(b["carbono"]))
        self.assertEqual(len(ideas), 3)
        for i in ideas:
            self.assertTrue(i["head"])
            self.assertNotEqual(i["head"].rstrip("…").lower(), i["sub"].lstrip("…").lower())

    def test_tema(self):
        self.assertEqual(G.tema_de(["formacion", "georgelucas", "creativity"]), "creativity")
        self.assertEqual(G.tema_de(["nada"]), "business")


if __name__ == "__main__":
    unittest.main()
