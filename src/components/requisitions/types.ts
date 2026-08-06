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

/** Quién levanta el pedido; se recuerda entre sesiones en la misma tablet. */
export interface Requester {
    idSucursal: number;
    solicitante: string;
    area: string;
}

export const REQUISITION_AREAS = ['Cocina', 'Barra', 'Caja', 'Almacén', 'Limpieza', 'Otro'] as const;
