/**
 * Dominio de acceso del proyecto (tblProyectos.DominioFG en la BD central).
 *
 * Es la parte que va después de la arroba en el login de todo el personal
 * ("laura@navio.foodieguru"), y es lo que usa /api/auth/login para saber a qué
 * proyecto pertenece quien entra. Por eso:
 *  - la regla es fija: nombre del proyecto sin espacios + ".foodieguru";
 *  - tiene que ser único entre proyectos, o dos proyectos se pelearían el
 *    mismo login;
 *  - cambiarlo obliga a reescribir el Login de todos los usuarios de ese
 *    proyecto, o se quedan sin poder entrar.
 *
 * Módulo puro (sin React ni mysql): lo usan el panel de configuración y el API.
 */

export const PROJECT_DOMAIN_SUFFIX = '.foodieguru';

/**
 * Nombre del proyecto → parte antes del sufijo.
 * "Navío Mariscos" → "naviomariscos". Sin espacios ni acentos, porque va
 * dentro de un correo que la gente teclea a mano.
 */
export function slugifyProjectName(name: unknown): string {
    if (typeof name !== 'string') return '';
    return name
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 60);
}

/** Dominio que le toca a un proyecto por su nombre. */
export function buildProjectDomain(projectName: unknown): string {
    const slug = slugifyProjectName(projectName);
    return slug ? `${slug}${PROJECT_DOMAIN_SUFFIX}` : '';
}

/** Separa el dominio en la parte editable y el sufijo fijo. */
export function splitProjectDomain(domain: unknown): { prefix: string; suffix: string } {
    const value = typeof domain === 'string' ? domain.trim().toLowerCase() : '';
    if (value.endsWith(PROJECT_DOMAIN_SUFFIX)) {
        return { prefix: value.slice(0, -PROJECT_DOMAIN_SUFFIX.length), suffix: PROJECT_DOMAIN_SUFFIX };
    }
    // Dominio viejo con otro sufijo (o vacío): se respeta lo que haya como
    // prefijo para no perderlo al editar.
    return { prefix: value, suffix: PROJECT_DOMAIN_SUFFIX };
}

/**
 * Deja el dominio en su forma canónica: prefijo limpio + sufijo fijo.
 * Devuelve '' si no queda prefijo utilizable.
 */
export function normalizeProjectDomain(value: unknown): string {
    const { prefix } = splitProjectDomain(value);
    const slug = slugifyProjectName(prefix);
    return slug ? `${slug}${PROJECT_DOMAIN_SUFFIX}` : '';
}

export function isValidProjectDomain(domain: unknown): boolean {
    return normalizeProjectDomain(domain) !== '' && normalizeProjectDomain(domain) === domain;
}

/** Reemplaza el dominio de un login conservando el usuario. */
export function replaceLoginDomain(login: unknown, domain: string): string {
    const value = typeof login === 'string' ? login.trim() : '';
    if (!value) return '';
    const user = value.includes('@') ? value.split('@')[0] : value;
    return `${user}@${domain}`;
}
