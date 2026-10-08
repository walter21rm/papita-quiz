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
- `GEMINI_FALLBACK_MODELS`: modelos que se usan, en orden, cuando el principal agota su cuota o está saturado.
- `GEMINI_FAST_MODEL` y `GEMINI_FAST_FALLBACK_MODELS`: modelos para corregir respuestas escritas.
- `OFFICE_PDF_CONVERSION=off`: desactiva la conversión con Microsoft Office.

## Cuota gratuita

En el nivel gratuito cada modelo tiene su propio límite diario (por ejemplo, `gemini-3.8-flash` permite unas 20 consultas al día). Analizar un material usa 1 consulta y cada quiz 1 o 2. Cuando un modelo se queda sin cuota, la app pasa sola al siguiente de la lista; si se agotan todos, avisa cuánto falta para que se reinicie. Si la IA no responde al corregir una respuesta escrita, la app la califica comparándola con la respuesta esperada.

## Privacidad

Tus materiales, quizzes y notas se guardan solo en tu navegador (IndexedDB). Los archivos se envían a Gemini para analizarlos; en el nivel gratuito, Google puede usar ese contenido para mejorar sus productos, así que evita subir documentos sensibles.
