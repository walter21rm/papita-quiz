import { LEVEL_INFO, QUESTION_TYPE_INFO } from "./labels";
import type { PriorQuestion } from "./schemas";
import type { Level, Question, QuestionType, QuizConfig, Topic } from "./types";

const PERSONA =
  "Eres Papita, un tutor experto y cariñoso que ayuda a estudiantes universitarios hispanohablantes a estudiar con su propio material.";

// ---------- Analysis ----------

export const ANALYSIS_SYSTEM = `${PERSONA}
Analizas documentos con muchísimo cuidado: lees todo el texto, tablas, gráficos, diagramas, fórmulas, notas del orador, texto dentro de imágenes y escritura a mano.
Nunca inventas información que no esté en el material.`;

export function buildAnalysisPrompt(partCount: number): string {
  return `Arriba tienes el material de estudio del estudiante, dividido en ${partCount} parte(s). Cada parte va precedida de una etiqueta como "[Parte N] nombre del archivo".

Construye un mapa de conocimiento completo y fiel que luego servirá para crear quizzes:
1. Identifica los temas principales y, dentro de cada uno, los conceptos evaluables: definiciones, procesos y sus etapas, fórmulas, clasificaciones, causas y efectos, comparaciones, ejemplos, fechas, cifras y datos de tablas o gráficos.
2. Para cada concepto escribe una explicación breve y de 1 a 8 hechos clave verificables, con los nombres, números y términos exactos del material.
3. En "source" indica dónde aparece: nombre del archivo y página, diapositiva u hoja (por ejemplo "Tema2.pptx, diapositiva 7"). En PDFs convertidos desde PowerPoint, cada página es una diapositiva.
4. Recorre el material completo, no solo el inicio. Importancia 3 = idea central, 2 = importante, 1 = detalle.
5. Ignora portadas, índices, logos, datos del docente y bibliografía, salvo que sean contenido del curso.
6. En "warnings" anota, en una frase corta cada una, las partes ilegibles, borrosas, cortadas o sin contenido académico. Si todo está bien, deja la lista vacía.
7. En "capacity" estima cuántas preguntas DISTINTAS y no repetitivas se pueden hacer con este material en cada nivel (basico, intermedio, avanzado, experto). Sé realista: un material corto da pocas preguntas.
8. Escribe todo en español aunque el material esté en otro idioma (puedes conservar el término técnico original entre paréntesis). En "language" pon el código del idioma original del material.`;
}

// ---------- Quiz generation ----------

export const QUIZ_SYSTEM = `${PERSONA}
Eres especialista en evaluación educativa: creas preguntas de examen excelentes, variadas, claras y justas, basadas EXCLUSIVAMENTE en el material del estudiante.
Antes de escribir cada pregunta verificas en el material que la respuesta correcta sea exacta e indiscutible.`;

const LEVEL_GUIDANCE: Record<Level, string> = {
  basico:
    "Preguntas directas sobre definiciones, términos, datos y hechos explícitos del material. Lenguaje sencillo. Los distractores son plausibles pero claramente distinguibles para quien estudió.",
  intermedio:
    "Comprensión y aplicación: relaciones entre conceptos, ejemplos, interpretar tablas o figuras y aplicar una definición o regla a un caso sencillo. Distractores plausibles.",
  avanzado:
    "Análisis: casos prácticos, comparaciones, causa y efecto, detectar errores, interpretar resultados y conectar dos ideas. Distractores finos basados en confusiones comunes.",
  experto:
    "Evaluación e integración: escenarios nuevos que combinan varios temas, justificar decisiones, predecir resultados y valorar afirmaciones. Distractores muy plausibles; nada que se responda solo de memoria.",
};

const TYPE_FORMAT: Record<QuestionType, string> = {
  single_choice:
    '"options": 4 opciones (solo el texto, sin letras ni números), "correctOptions": el índice (desde 0) de la ÚNICA correcta.',
  multiple_choice:
    '"options": 4 a 6 opciones, "correctOptions": 2 o más índices correctos. El enunciado debe pedir marcar todas las correctas.',
  true_false:
    '"prompt" es una afirmación (no una pregunta) y "correctBoolean" es true o false. Mezcla afirmaciones verdaderas y falsas; las falsas cambian un detalle importante de forma sutil.',
  fill_blank:
    '"prompt" es una o dos oraciones del tema con cada espacio escrito como ____ (cuatro guiones bajos), máximo 3 espacios. "blanks": un objeto por espacio, en el mismo orden, con "accepted" = respuestas válidas (la principal primero, luego sinónimos o variantes).',
  short_answer:
    'La respuesta es de 1 a 5 palabras o un número. "acceptedAnswers": todas las variantes válidas (con y sin tildes, singular/plural, sinónimos, unidades).',
  open_ended:
    'Pide explicar, comparar o justificar. "rubric": 2 a 5 puntos clave que debe mencionar una buena respuesta. "modelAnswer": respuesta ejemplar de 2 a 5 oraciones.',
  matching:
    '"pairs": 3 a 6 parejas {left, right} del mismo tipo (término-definición, causa-efecto, autor-obra...). Todos los "right" deben ser distintos entre sí.',
  ordering:
    '"orderedItems": 3 a 7 elementos en el ORDEN CORRECTO (pasos de un proceso, etapas, cronología, jerarquía). El enunciado indica el criterio de orden.',
};

function describeTypeCounts(typeCounts: Partial<Record<QuestionType, number>>): string {
  return Object.entries(typeCounts)
    .filter(([, count]) => (count ?? 0) > 0)
    .map(([type, count]) => `- ${count} de ${QUESTION_TYPE_INFO[type as QuestionType].label} (${type})`)
    .join("\n");
}

function describeConcepts(
  topics: Topic[],
  conceptCounts: Record<string, number>,
  config: QuizConfig,
): string {
  const selectedTopics = config.topicIds.length ? topics.filter((topic) => config.topicIds.includes(topic.id)) : topics;
  return selectedTopics
    .map((topic) => {
      const concepts = topic.concepts
        .map((concept) => {
          const asked = conceptCounts[concept.id] ?? 0;
          const focus = config.focusConceptIds.includes(concept.id) ? " [REFORZAR]" : "";
          const facts = concept.keyFacts.slice(0, 4).join("; ");
          return `  - ${concept.id} · ${concept.name}${focus} — preguntado ${asked} ${asked === 1 ? "vez" : "veces"}. ${facts}`;
        })
        .join("\n");
      return `- Tema "${topic.name}" (importancia ${topic.importance}):\n${concepts}`;
    })
    .join("\n");
}

function describePrior(questions: PriorQuestion[], limit: number): string {
  return questions
    .slice(-limit)
    .map((question, index) => {
      const prompt = question.prompt.replace(/\s+/g, " ").slice(0, 160);
      const answer = question.answer.replace(/\s+/g, " ").slice(0, 80);
      return `${index + 1}. ${prompt}${answer ? ` → ${answer}` : ""}`;
    })
    .join("\n");
}

export function buildQuizPrompt(options: {
  topics: Topic[];
  materialLanguage: string;
  config: QuizConfig;
  count: number;
  typeCounts: Partial<Record<QuestionType, number>>;
  conceptCounts: Record<string, number>;
  avoid: PriorQuestion[];
  rejected: string[];
}): string {
  const { config } = options;
  const level = LEVEL_INFO[config.level];
  const language =
    config.language === "es" || options.materialLanguage.toLowerCase().startsWith("es")
      ? "Escribe todo (preguntas, opciones, pistas y explicaciones) en español."
      : `Escribe las preguntas, opciones y respuestas en el idioma original del material (${options.materialLanguage}); las pistas y explicaciones en español.`;

  const focus = config.focusConceptIds.length
    ? "\nENFOQUE: el estudiante falló los conceptos marcados [REFORZAR]. Todas las preguntas deben evaluarlos, con preguntas nuevas y desde otros ángulos (otro tipo de pregunta, otro ejemplo, otro detalle)."
    : config.topicIds.length
      ? "\nPregunta solo sobre los temas listados."
      : "\nReparte las preguntas entre los temas, priorizando los de mayor importancia y los conceptos menos preguntados.";

  const avoid = options.avoid.length
    ? `\n## Preguntas que YA se hicieron antes (NO las repitas, ni las reformules, ni preguntes lo mismo con otras palabras o con la misma respuesta)\n${describePrior(options.avoid, 200)}\n`
    : "";
  const rejected = options.rejected.length
    ? `\n## Estas propuestas tuyas se descartaron por parecerse demasiado a preguntas anteriores; no las uses:\n${options.rejected.map((text) => `- ${text.slice(0, 160)}`).join("\n")}\n`
    : "";

  const formats = Object.keys(options.typeCounts)
    .map((type) => `- ${type}: ${TYPE_FORMAT[type as QuestionType]}`)
    .join("\n");

  return `Crea exactamente ${options.count} preguntas NUEVAS a partir del material de arriba.

## Nivel: ${level.label} (${level.short})
${LEVEL_GUIDANCE[config.level]}

## Distribución de tipos para esta tanda
${describeTypeCounts(options.typeCounts)}

## Idioma
${language}

## Mapa de conocimiento (usa estos IDs en "conceptIds")
${describeConcepts(options.topics, options.conceptCounts, config)}
${focus}
${avoid}${rejected}
## Reglas de calidad
- Cada pregunta se responde SOLO con el material. Comprueba la respuesta correcta en el material antes de escribirla.
- Sin ambigüedad: una única respuesta defendible (o un conjunto claro en opción múltiple). No hagas preguntas de opinión.
- Cada pregunta evalúa algo distinto: varía conceptos y enfoques (definición, aplicación, ejemplo, comparación, causa, consecuencia, dato de una tabla o figura).
- Distractores plausibles, del mismo tipo y de longitud parecida a la respuesta correcta. Nunca uses "todas las anteriores" ni "ninguna de las anteriores".
- El enunciado no debe delatar la respuesta.
- "hints": exactamente 3 pistas progresivas. Pista 1: orienta (qué tema o idea recordar). Pista 2: da una clave importante o descarta opciones. Pista 3: casi da la respuesta, pero sin decirla literalmente.
- "explanation": 2 a 4 oraciones que expliquen por qué la respuesta es correcta y, si hay opciones, por qué las otras no lo son.
- "source": archivo y página o diapositiva de donde sale la pregunta.
- "modelAnswer": la respuesta correcta en texto.
- Usa Markdown simple. Escribe fórmulas en LaTeX entre $...$ (por ejemplo $E = mc^2$).

## Formato según el tipo
${formats}`;
}

// ---------- Grading ----------

export const GRADE_SYSTEM = `${PERSONA}
Corriges respuestas escritas de forma justa: aceptas sinónimos, paráfrasis, errores menores de ortografía o tildes y respuestas equivalentes en otro idioma cuando el significado es correcto, pero no aceptas respuestas vagas, erróneas o que contradicen el material.`;

export function buildGradePrompt(question: Question, studentAnswer: string, final: boolean): string {
  const expected: string[] = [];
  if (question.type === "fill_blank") {
    question.blanks?.forEach((blank, index) => {
      expected.push(`Espacio ${index + 1}: respuestas aceptadas → ${blank.accepted.join(" | ")}`);
    });
  }
  if (question.type === "short_answer" && question.acceptedAnswers?.length) {
    expected.push(`Respuestas aceptadas: ${question.acceptedAnswers.join(" | ")}`);
  }
  if (question.type === "open_ended" && question.rubric?.length) {
    expected.push(`Rúbrica (puntos clave):\n${question.rubric.map((point, index) => `${index + 1}. ${point}`).join("\n")}`);
  }
  expected.push(`Respuesta modelo: ${question.modelAnswer}`);

  const criteria: Record<string, string> = {
    fill_blank:
      'Evalúa cada espacio por separado y devuelve "blankResults" (true/false por espacio, en orden). "score" = proporción de espacios correctos. "verdict": correct si todos están bien, partial si alguno, incorrect si ninguno.',
    short_answer:
      '"verdict": correct si expresa lo mismo que la respuesta aceptada (score 1), partial si está incompleta pero bien encaminada (score 0.5), incorrect si es errónea o vacía (score 0).',
    open_ended:
      '"score" = proporción de puntos de la rúbrica cubiertos correctamente, restando si hay errores conceptuales. "verdict": correct si score ≥ 0.85, partial si score ≥ 0.4, incorrect en otro caso.',
  };

  const feedbackRule = final
    ? "Es el intento final: en \"feedback\" di qué estuvo bien, qué faltó y cuál es la respuesta correcta, en 1 a 3 oraciones."
    : "El estudiante todavía puede volver a intentarlo: si no es correcta, en \"feedback\" NO reveles la respuesta ni la rúbrica; da una pista breve sobre qué revisar o qué le falta (1 o 2 oraciones). Si es correcta, felicítalo en una oración.";

  return `Corrige la respuesta del estudiante.

Tipo de pregunta: ${QUESTION_TYPE_INFO[question.type].label}
Pregunta: ${question.prompt}
${expected.join("\n")}

Respuesta del estudiante:
${studentAnswer || "(vacía)"}

Criterios:
- ${criteria[question.type] ?? criteria.short_answer}
- ${feedbackRule}
- Habla de tú, con tono cálido y motivador, en español.`;
}
