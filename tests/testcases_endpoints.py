import unittest
import requests
import os


# ============================================================================
# TESTS ENDPOINT: POST /extract-document
# ============================================================================

class TestExtractDocument(unittest.TestCase):

    @classmethod
    def setUpClass(cls):

        cls.url = "http://localhost:8080/extract-document"

        print("\n" + "=" * 70)
        print(f"Inicio Test: {cls.__name__}")
        print("=" * 70)

        cls.base_path = os.path.join(
            os.path.dirname(__file__),
            "data"
        )

        cls.pdf_path = os.path.join(
            cls.base_path,
            "liquidacion_valida.pdf"
        )

        cls.invalid_file_path = os.path.join(
            cls.base_path,
            "archivo_invalido.txt"
        )

        if not os.path.exists(cls.pdf_path):
            raise FileNotFoundError(
                f"No se encontró el archivo PDF: {cls.pdf_path}"
            )

        with open(cls.invalid_file_path, "w", encoding="utf-8") as f:
            f.write("Este archivo no es un PDF válido.\n")
            f.write("LIQUIDACION DE REMUNERACIONES\n")

    @classmethod
    def tearDownClass(cls):

        if os.path.exists(cls.invalid_file_path):
            os.remove(cls.invalid_file_path)

        print("\n" + "=" * 70)
        print(f"Fin Test: {cls.__name__}")
        print("=" * 70)

    # ----------------------------------------------------------------------
    # CASO 1: PDF válido
    # ----------------------------------------------------------------------

    def test_pdf_liquidacion_valido(self):

        with open(self.pdf_path, "rb") as pdf_file:

            files = {
                "documento": (
                    "liquidacion_valida.pdf",
                    pdf_file,
                    "application/pdf"
                )
            }

            response = requests.post(
                self.url,
                files=files
            )

        print("\n" + "-" * 70)
        print(f"Endpoint: {self.url}")
        print(f"Archivo enviado: {self.pdf_path}")
        print("-" * 70)

        print(f"Status Code: {response.status_code}")

        print("\nRespuesta del Endpoint:")
        print(response.text)

        print("-" * 70 + "\n")

        self.assertEqual(response.status_code, 200)

        data = response.json()

        self.assertTrue(data.get("success"))

        self.assertEqual(
            data.get("tipo_documento"),
            "Liquidacion"
        )

        datos = data.get("datos_extraidos", {})
        identificador = datos.get("identificador", {})
        laboral = datos.get("laboral", {})

        self.assertIsNotNone(
            identificador.get("rut")
        )

        self.assertIsNotNone(
            laboral.get("alcance_liquido")
        )

        self.assertIsInstance(
            laboral.get("alcance_liquido"),
            int
        )

    # ----------------------------------------------------------------------
    # CASO 2: Archivo inválido
    # ----------------------------------------------------------------------

    def test_archivo_txt_invalido(self):

        with open(self.invalid_file_path, "rb") as txt_file:

            files = {
                "documento": (
                    "archivo_invalido.txt",
                    txt_file,
                    "text/plain"
                )
            }

            response = requests.post(
                self.url,
                files=files
            )

        print("\n" + "-" * 70)
        print(f"Endpoint: {self.url}")
        print(f"Archivo enviado: {self.invalid_file_path}")
        print("-" * 70)

        print(f"Status Code: {response.status_code}")

        print("\nRespuesta del Endpoint:")
        print(response.text)

        print("-" * 70 + "\n")

        self.assertEqual(response.status_code, 400)

        data = response.json()

        self.assertFalse(data.get("success"))

        self.assertIn("message", data)

        message = data.get("message", "").lower()

        self.assertTrue(
            "formato" in message or
            "soportado" in message or
            "no soportado" in message
        )


# ============================================================================
# TESTS ENDPOINT: POST /verify-carnet-back
# ============================================================================

class TestVerifyCarnetBack(unittest.TestCase):

    @classmethod
    def setUpClass(cls):

        cls.url = "http://localhost:8080/verify-carnet-back"

        print("\n" + "=" * 70)
        print(f"Inicio Test: {cls.__name__}")
        print("=" * 70)

        cls.base_path = os.path.join(
            os.path.dirname(__file__),
            "data"
        )

        cls.carnet_antiguo_path = os.path.join(
            cls.base_path,
            "carnetAntiguo.png"
        )

        cls.carnet_nuevo_path = os.path.join(
            cls.base_path,
            "carnetNuevo.png"
        )

    @classmethod
    def tearDownClass(cls):

        print("\n" + "=" * 70)
        print(f"Fin Test: {cls.__name__}")
        print("=" * 70)

    # ----------------------------------------------------------------------
    # CASO 1: Carnet antiguo
    # ----------------------------------------------------------------------

    def test_verificacion_carnet_antiguo(self):

        rut = "7.306.002-8"
        fecha_vencimiento = "15-05-2026"

        with open(self.carnet_antiguo_path, "rb") as image_file:

            files = {
                "documento": (
                    "carnetAntiguo.jpg",
                    image_file,
                    "image/jpeg"
                )
            }

            data = {
                "rut": rut,
                "fecha_vencimiento": fecha_vencimiento
            }

            response = requests.post(
                self.url,
                files=files,
                data=data
            )

        print("\n" + "-" * 70)
        print(f"Endpoint: {self.url}")
        print(f"Imagen enviada: {self.carnet_antiguo_path}")
        print(f"RUT: {rut}")
        print(f"Fecha vencimiento: {fecha_vencimiento}")
        print("-" * 70)

        print(f"Status Code: {response.status_code}")

        print("\nRespuesta del Endpoint:")
        print(response.text)

        print("-" * 70 + "\n")

        # Se espera status 200 para carnet válido.
        # El test falla porque el sistema no logra procesar correctamente el QR
        self.assertEqual(response.status_code, 200)

    # ----------------------------------------------------------------------
    # CASO 2: Carnet nuevo
    # ----------------------------------------------------------------------

    def test_verificacion_carnet_nuevo(self):

        rut = "21.732.389-4"
        fecha_vencimiento = "15-12-2034"

        with open(self.carnet_nuevo_path, "rb") as image_file:

            files = {
                "documento": (
                    "carnetNuevo.jpg",
                    image_file,
                    "image/jpeg"
                )
            }

            data = {
                "rut": rut,
                "fecha_vencimiento": fecha_vencimiento
            }

            response = requests.post(
                self.url,
                files=files,
                data=data
            )

        print("\n" + "-" * 70)
        print(f"Endpoint: {self.url}")
        print(f"Imagen enviada: {self.carnet_nuevo_path}")
        print(f"RUT: {rut}")
        print(f"Fecha vencimiento: {fecha_vencimiento}")
        print("-" * 70)

        print(f"Status Code: {response.status_code}")

        print("\nRespuesta del Endpoint:")
        print(response.text)

        print("-" * 70 + "\n")

        # Se espera status 200 para carnet válido.
        # El test falla porque el sistema no logra procesar correctamente el QR
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main(verbosity=2)