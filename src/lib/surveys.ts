import { Connection } from 'mysql2/promise';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '@/lib/db';

/**
 * Encuestas de satisfacción.
 *
 * La encuesta se contesta desde una tablet en piso (o el celular del
 * comensal), sin login: el acceso es por un UUID de proyecto que va en la URL,
 * igual que las requisiciones de cocina. El UUID vive en su propia columna
 * (UUIDEncuesta) para poder revocar la liga sin tocar la de requisiciones ni
 * el UUID general del proyecto (que trae valores adivinables en proyectos
 * viejos).
 *
 * El contenido es configurable por proyecto: textos del encabezado, preguntas
 * (estrellas 1-5 u opciones), umbral que dispara el comentario abierto y el
 * bloque de regalo con captura de correo. Las respuestas guardan un snapshot
 * de la pregunta para que el reporte histórico sobreviva ediciones.
 */

/** Topes defensivos: el envío de respuestas es un endpoint público. */
export const MAX_SURVEY_QUESTIONS = 20;
export const MAX_QUESTION_LEN = 255;
export const MAX_OPTION_LABEL_LEN = 60;
export const MAX_COMMENT_LEN = 1000;
export const MAX_EMAIL_LEN = 255;
export const MAX_CONFIG_TEXT_LEN = 300;

/** Escala de las preguntas de estrellas y tope de opciones por pregunta. */
export const SURVEY_SCALE = 5;

export const SURVEY_QUESTION_TYPES = ['estrellas', 'opciones'] as const;
export type SurveyQuestionType = typeof SURVEY_QUESTION_TYPES[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SurveyProject {
    idProyecto: number;
    proyecto: string;
    titulo: string | null;
    logo64: string | null;
    colorFondo1: string;
    colorFondo2: string;
    colorLetra: string;
    surveysEnabled: number;
}

/** Un UUID mal formado nunca llega a la base: se descarta antes de consultar. */
export function isValidSurveyUuid(uuid: unknown): uuid is string {
    return typeof uuid === 'string' && UUID_PATTERN.test(uuid);
}

export function isValidSurveyEmail(email: string): boolean {
    return email.length <= MAX_EMAIL_LEN && EMAIL_PATTERN.test(email);
}

/**
 * Columnas de encuestas en la BD central: la liga (UUIDEncuesta) y la bandera
 * del módulo (SurveysEnabled, misma DDL que project-modules.ts para que no
 * importe quién la crea primero). Idempotente.
 */
async function ensureSurveyUuidColumn(): Promise<void> {
    const [cols] = await pool.query<RowDataPacket[]>('SHOW COLUMNS FROM tblProyectos');
    const names = cols.map(c => c.Field);
    if (!names.includes('UUIDEncuesta')) {
        await pool.query('ALTER TABLE tblProyectos ADD COLUMN UUIDEncuesta VARCHAR(36) NULL');
    }
    if (!names.includes('SurveysEnabled')) {
        await pool.query('ALTER TABLE tblProyectos ADD COLUMN `SurveysEnabled` TINYINT NOT NULL DEFAULT 1');
    }
}

/**
 * Devuelve el UUID de encuesta del proyecto y lo genera si aún no existe.
 * Solo debe llamarse desde el portal autenticado (es quien reparte la liga).
 * A diferencia de requisiciones NO adopta el UUID general del proyecto: la
 * liga de encuestas estrena siempre un UUID propio.
 */
export async function getOrCreateSurveyUuid(projectId: number): Promise<string | null> {
    await ensureSurveyUuidColumn();

    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT UUIDEncuesta FROM tblProyectos WHERE IdProyecto = ?',
        [projectId]
    );
    if (rows.length === 0) return null;

    const existing = rows[0].UUIDEncuesta;
    if (isValidSurveyUuid(existing)) return existing;

    const uuid = crypto.randomUUID();
    await pool.query('UPDATE tblProyectos SET UUIDEncuesta = ? WHERE IdProyecto = ?', [uuid, projectId]);
    return uuid;
}

/** Rota el UUID: invalida la liga repartida y emite una nueva. */
export async function rotateSurveyUuid(projectId: number): Promise<string> {
    await ensureSurveyUuidColumn();
    const uuid = crypto.randomUUID();
    await pool.query('UPDATE tblProyectos SET UUIDEncuesta = ? WHERE IdProyecto = ?', [uuid, projectId]);
    return uuid;
}

/**
 * Traduce el UUID de la URL al proyecto. Es la ÚNICA forma en que la página
 * pública identifica un proyecto: el cliente nunca manda projectId.
 * Un proyecto con el módulo apagado (SurveysEnabled = 0) resuelve a null,
 * indistinguible de una liga inexistente.
 */
export async function resolveSurveyUuid(uuid: string): Promise<SurveyProject | null> {
    if (!isValidSurveyUuid(uuid)) return null;

    await ensureSurveyUuidColumn();

    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT IdProyecto, Proyecto, Titulo, Logo64, ColorFondo1, ColorFondo2, ColorLetra, SurveysEnabled
         FROM tblProyectos
         WHERE UUIDEncuesta = ?
         LIMIT 1`,
        [uuid]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    const surveysEnabled = row.SurveysEnabled === 0 || row.SurveysEnabled === '0' ? 0 : 1;
    if (surveysEnabled === 0) return null;

    return {
        idProyecto: row.IdProyecto,
        proyecto: row.Proyecto,
        titulo: row.Titulo || null,
        logo64: row.Logo64 || null,
        colorFondo1: row.ColorFondo1 || '#1f6f4a',
        colorFondo2: row.ColorFondo2 || '#14532d',
        colorLetra: row.ColorLetra || '#ffffff',
        surveysEnabled,
    };
}

/** Textos con los que arranca la encuesta la primera vez (los de la lona base). */
export const DEFAULT_SURVEY_CONFIG = {
    Titulo: '¿Cómo fue tu experiencia?',
    Subtitulo: 'Tu opinión nos ayuda a mejorar.',
    Subtitulo2: 'Solo te tomará 30 segundos.',
    UmbralComentario: 3,
    TituloComentario: '¿Algo no salió como esperabas?',
    TextoComentario: 'Cuéntanos qué sucedió. Queremos escucharte y mejorar.',
    RegaloActivo: 1,
    TituloRegalo: 'Tenemos un regalo para ti',
    TextoRegalo: 'Déjanos tu correo y al enviar esta encuesta recibirás un regalo para disfrutar en tu próxima visita.',
    TextoPromos: 'Quiero recibir mi regalo y promociones especiales.',
    TextoBotonEnviar: 'Enviar y recibir mi regalo',
    TituloGracias: '¡Gracias por ayudarnos a mejorar!',
    TextoGracias: 'Revisa tu correo. Tu regalo ya va en camino.',
} as const;

/** Preguntas con las que arranca el módulo la primera vez. */
export const DEFAULT_SURVEY_QUESTIONS: {
    pregunta: string;
    tipo: SurveyQuestionType;
    etiquetas: string[];
}[] = [
    {
        pregunta: '¿Cómo calificarías tu experiencia general?',
        tipo: 'estrellas',
        etiquetas: ['Muy mala', 'Mala', 'Regular', 'Muy buena', 'Excelente'],
    },
    {
        pregunta: '¿Cómo calificas el sabor y la calidad de tus alimentos?',
        tipo: 'estrellas',
        etiquetas: [],
    },
    {
        pregunta: '¿Cómo calificas la atención y servicio de nuestro equipo?',
        tipo: 'estrellas',
        etiquetas: [],
    },
    {
        pregunta: '¿Cómo calificas la limpieza y presentación del restaurante?',
        tipo: 'estrellas',
        etiquetas: [],
    },
    {
        pregunta: '¿Nos recomendarías con tus amigos o familiares?',
        tipo: 'opciones',
        // De mejor a peor: la primera opción vale 5 y la última 1.
        etiquetas: ['Definitivamente sí', 'Probablemente sí', 'Tal vez', 'Probablemente no', 'Definitivamente no'],
    },
];

/**
 * Etiquetas de una pregunta, guardadas como JSON:
 *  - estrellas: etiqueta por valor 1..5 (arreglo de 5, huecos = solo número);
 *  - opciones: opciones en orden de mejor a peor (la primera vale más).
 * Nunca lanza: un JSON corrupto en BD degrada a "sin etiquetas".
 */
export function parseQuestionLabels(raw: unknown): string[] {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .slice(0, SURVEY_SCALE)
            .map(item => (typeof item === 'string' ? item.trim().slice(0, MAX_OPTION_LABEL_LEN) : ''));
    } catch {
        return [];
    }
}

/** Normaliza etiquetas que llegan del portal antes de guardarlas como JSON. */
export function sanitizeQuestionLabels(labels: unknown, tipo: SurveyQuestionType): string[] {
    if (!Array.isArray(labels)) return [];
    const clean = labels
        .slice(0, SURVEY_SCALE)
        .map(item => (typeof item === 'string' ? item.trim().replace(/\s+/g, ' ').slice(0, MAX_OPTION_LABEL_LEN) : ''));
    if (tipo === 'opciones') {
        // Las opciones vacías no se pueden elegir: se descartan. Mínimo 2.
        return clean.filter(Boolean);
    }
    return clean;
}

/**
 * Valor máximo que acepta una pregunta: 5 en estrellas; en opciones, tantas
 * como opciones tenga (valor 5 = primera opción, 1 = última con 5 opciones).
 */
export function maxValueForQuestion(tipo: SurveyQuestionType, etiquetas: string[]): number {
    return tipo === 'opciones' ? Math.min(etiquetas.length, SURVEY_SCALE) : SURVEY_SCALE;
}

/**
 * Etiqueta que corresponde a un valor contestado (snapshot para el reporte).
 * En opciones el valor es descendente: con N opciones, valor N = primera.
 */
export function labelForValue(tipo: SurveyQuestionType, etiquetas: string[], valor: number): string | null {
    if (tipo === 'opciones') {
        const index = etiquetas.length - valor;
        return etiquetas[index] ?? null;
    }
    return etiquetas[valor - 1] || null;
}

/**
 * Esquema del módulo de encuestas en la BD de cada proyecto:
 *  - tblEncuestasConfig: textos y comportamiento de la encuesta (1 renglón);
 *  - tblEncuestasPreguntas: preguntas configurables (estrellas u opciones);
 *  - tblEncuestasRespuestas: una visita = un renglón (correo, comentario);
 *  - tblEncuestasRespuestasDetalle: valor por pregunta, con snapshot del texto.
 * Idempotente: se llama al abrir conexión de proyecto (ver dynamic-db.ts).
 */
export async function ensureSurveyTables(connection: Connection): Promise<void> {
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblEncuestasConfig\` (
              \`IdConfig\` int NOT NULL AUTO_INCREMENT,
              \`Titulo\` varchar(300) NOT NULL,
              \`Subtitulo\` varchar(300) DEFAULT NULL,
              \`Subtitulo2\` varchar(300) DEFAULT NULL,
              \`UmbralComentario\` int NOT NULL DEFAULT 3,
              \`TituloComentario\` varchar(300) DEFAULT NULL,
              \`TextoComentario\` varchar(300) DEFAULT NULL,
              \`RegaloActivo\` tinyint NOT NULL DEFAULT 1,
              \`TituloRegalo\` varchar(300) DEFAULT NULL,
              \`TextoRegalo\` varchar(300) DEFAULT NULL,
              \`TextoPromos\` varchar(300) DEFAULT NULL,
              \`TextoBotonEnviar\` varchar(300) DEFAULT NULL,
              \`TituloGracias\` varchar(300) DEFAULT NULL,
              \`TextoGracias\` varchar(300) DEFAULT NULL,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdConfig\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblEncuestasPreguntas\` (
              \`IdPregunta\` int NOT NULL AUTO_INCREMENT,
              \`Pregunta\` varchar(255) NOT NULL,
              \`TipoPregunta\` varchar(20) NOT NULL DEFAULT 'estrellas',
              \`Etiquetas\` text,
              \`Orden\` int NOT NULL DEFAULT 0,
              \`Activa\` tinyint NOT NULL DEFAULT 1,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdPregunta\`),
              KEY \`idx_activa_orden\` (\`Activa\`, \`Orden\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblEncuestasRespuestas\` (
              \`IdRespuesta\` int NOT NULL AUTO_INCREMENT,
              \`IdSucursal\` int DEFAULT NULL,
              \`Correo\` varchar(255) DEFAULT NULL,
              \`AceptaPromos\` tinyint NOT NULL DEFAULT 0,
              \`Comentario\` text,
              \`Fecha\` datetime DEFAULT NULL,
              \`FechaAct\` datetime DEFAULT NULL,
              PRIMARY KEY (\`IdRespuesta\`),
              KEY \`idx_fecha\` (\`Fecha\`),
              KEY \`idx_sucursal_fecha\` (\`IdSucursal\`, \`Fecha\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS \`tblEncuestasRespuestasDetalle\` (
              \`IdDetalle\` int NOT NULL AUTO_INCREMENT,
              \`IdRespuesta\` int NOT NULL,
              \`IdPregunta\` int NOT NULL,
              \`Pregunta\` varchar(255) NOT NULL,
              \`TipoPregunta\` varchar(20) NOT NULL DEFAULT 'estrellas',
              \`Valor\` int NOT NULL,
              \`Etiqueta\` varchar(60) DEFAULT NULL,
              PRIMARY KEY (\`IdDetalle\`),
              KEY \`idx_respuesta\` (\`IdRespuesta\`),
              KEY \`idx_pregunta\` (\`IdPregunta\`, \`Valor\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // Siembra inicial. El renglón de config vive SIEMPRE con IdConfig = 1:
        // el INSERT IGNORE sobre esa PK fija hace de candado, así dos requests
        // que estrenan el proyecto a la vez no duplican config ni preguntas
        // (solo quien realmente insertó el renglón siembra las preguntas).
        // Además, como el candado nunca se libera, las preguntas que el
        // restaurante borre a propósito no reaparecen.
        const c = DEFAULT_SURVEY_CONFIG;
        const [configInsert] = await connection.query<ResultSetHeader>(
            `INSERT IGNORE INTO tblEncuestasConfig
                (IdConfig, Titulo, Subtitulo, Subtitulo2, UmbralComentario, TituloComentario, TextoComentario,
                 RegaloActivo, TituloRegalo, TextoRegalo, TextoPromos, TextoBotonEnviar,
                 TituloGracias, TextoGracias, FechaAct)
             VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, Now())`,
            [
                c.Titulo, c.Subtitulo, c.Subtitulo2, c.UmbralComentario, c.TituloComentario,
                c.TextoComentario, c.RegaloActivo, c.TituloRegalo, c.TextoRegalo, c.TextoPromos,
                c.TextoBotonEnviar, c.TituloGracias, c.TextoGracias,
            ]
        );

        if (configInsert.affectedRows > 0) {
            for (const [index, q] of DEFAULT_SURVEY_QUESTIONS.entries()) {
                await connection.query(
                    `INSERT INTO tblEncuestasPreguntas (Pregunta, TipoPregunta, Etiquetas, Orden, Activa, FechaAct)
                     VALUES (?, ?, ?, ?, 1, Now())`,
                    [q.pregunta, q.tipo, JSON.stringify(q.etiquetas), index]
                );
            }
        }
    } catch (e) {
        console.error('Error ensuring survey schema:', e);
    }
}

/** Recorta y normaliza texto libre que llega de la tablet o del portal. */
export function sanitizeSurveyText(value: unknown, maxLen: number): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) return null;
    return trimmed.slice(0, maxLen);
}

/** Comentarios conservan saltos de línea (texto multilínea del comensal). */
export function sanitizeSurveyComment(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
    if (!trimmed) return null;
    return trimmed.slice(0, MAX_COMMENT_LEN);
}
