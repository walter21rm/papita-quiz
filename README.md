# Papita Quiz

Sube tus apuntes, diapositivas, PDF o fotos y Papita te prepara quizzes por nivel, con preguntas para marcar, escribir, unir y ordenar, pistas cuando te trabas y sin repetir preguntas entre un quiz y otro.

## Cómo usarlo

1. Instala las dependencias (solo la primera vez):

   ```bash
   npm install
   ```

2. Consigue una API key gratuita en [Google AI Studio](https://aistudio.google.com/apikey) y pégala en `.env.local`:

   ```bash
   GEMINI_API_KEY=tu-clave
   ```

   Si no existe `.env.local`, copia `.env.example` con ese nombre.

3. Inicia la app y abre [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

## Formatos que lee

- PDF (texto, tablas, gráficos y escaneos).
- Word y PowerPoint (`.docx`, `.doc`, `.pptx`, `.ppt`, `.rtf`, `.odt`, `.odp`). En Windows con Microsoft Office instalado se convierten a PDF para que la IA vea las diapositivas y diagramas tal cual; si no, se extrae su texto e imágenes.
- Excel y tablas (`.xlsx`, `.xls`, `.ods`, `.csv`).
- Imágenes de cualquier formato común (JPG, PNG, WEBP, HEIC, GIF, BMP, TIFF, AVIF, SVG).
- Texto (`.txt`, `.md`, `.html`, `.epub`, `.tex`).

## Configuración opcional (`.env.local`)

- `GEMINI_MODEL`: modelo para analizar y crear preguntas (por defecto `gemini-3.8-flash`).
- `GEMINI_FAST_MODEL`: modelo para corregir respuestas escritas (por defecto `gemini-3.5-flash-lite`).
- `OFFICE_PDF_CONVERSION=off`: desactiva la conversión con Microsoft Office.

## Privacidad

Tus materiales, quizzes y notas se guardan solo en tu navegador (IndexedDB). Los archivos se envían a Gemini para analizarlos; en el nivel gratuito, Google puede usar ese contenido para mejorar sus productos, así que evita subir documentos sensibles.
