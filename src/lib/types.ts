// Database table types
export interface Usuario {
    IdUsuario?: number;
    NombreUsuario: string;
    CorreoElectronico: string;
    Telefono: string;
    passwd: string;
    FechaCreacion?: Date;
}

export interface Proyecto {
    IdProyecto?: number;
    NombreProyecto: string;
    Pais: string;
    Idioma: string;
    FechaCreacion?: Date;
}

export interface ProyectoUsuario {
    IdProyectoUsuario?: number;
    IdProyecto: number;
    IdUsuario: number;
    FechaAsignacion?: Date;
}

// API response types
export interface LoginRequest {
    correoElectronico: string;
    telefono: string;
    password: string;
}

export interface RegisterRequest {
    nombreProyecto: string;
    nombreUsuario: string;
    correoElectronico: string;
    telefono: string;
    password: string;
    repetirPassword: string;
    pais: string;
    idioma: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    user?: {
        idUsuario: number;
        nombreUsuario: string;
        correoElectronico: string;
    };
}
