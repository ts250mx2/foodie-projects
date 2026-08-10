/** Tipos compartidos por la página táctil de requisiciones. */

export interface RequisitionBranch {
    IdSucursal: number;
    Sucursal: string;
}

export interface RequisitionProduct {
    IdProducto: number;
    Producto: string;
    Codigo: string | null;
    IdCategoria: number | null;
    Categoria: string | null;
    Unidad: string;
}

export interface RequisitionTheme {
    titulo: string;
    logo64: string | null;
    colorFondo1: string;
    colorFondo2: string;
    colorLetra: string;
}

/** Renglón del carrito: producto + cantidad pedida. */
export interface CartLine {
    producto: RequisitionProduct;
    cantidad: number;
}

/** Perfil de captura (Cocina, Barra, …) configurado desde el portal. */
export interface RequisitionProfile {
    IdPerfil: number;
    /** Los perfiles son por sucursal: cada equipo tiene el suyo y su PIN. */
    IdSucursal: number;
    Perfil: string;
    /** MySQL devuelve el booleano como 0/1. El PIN nunca viaja al cliente. */
    TienePin: number;
    /**
     * Categorías que el perfil ve al frente en la tablet (IdCategoria; 0 = sin
     * categoría). Vacío = ve el catálogo completo.
     */
    Categorias: number[];
}

/** Categoría de insumos ofrecida al configurar un perfil. */
export interface RequisitionCategory {
    IdCategoria: number;
    Categoria: string;
}

/**
 * Quién levanta el pedido; se recuerda entre sesiones en la misma tablet.
 * El PIN NO se guarda: se pide cada vez que se cambia de perfil.
 */
export interface Requester {
    idSucursal: number;
    solicitante: string;
    area: string;
    idPerfil: number | null;
}
