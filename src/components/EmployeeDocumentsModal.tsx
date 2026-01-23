'use client';

import { useState, useEffect, useRef } from 'react';
import Button from './Button';
import Input from './Input';

interface Document {
    IdEmpleadoDocumento: number;
    IdTipoDocumento: number;
    Documento: string; // Legacy fallback or unused
    TipoDocumento: string | null; // From JOIN
    Comentarios: string | null;
    RutaArchivo: string; // Legacy or relative path
    ArchivoDocumento: string | null; // Base64
    NombreArchivo: string | null;
    FechaAct: string;
}

interface DocumentType {
    IdTipoDocumento: number;
    TipoDocumento: string;
}

interface EmployeeDocumentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    employeeId: number;
    employeeName: string;
    projectId: number;
}

export default function EmployeeDocumentsModal({ isOpen, onClose, employeeId, employeeName, projectId }: EmployeeDocumentsModalProps) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Form state for creating new document (Metadata only)
    const [formData, setFormData] = useState({
        documentTypeId: 0,
        comments: ''
    });

    // File Upload state (Grid)
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadingDocId, setUploadingDocId] = useState<number | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (isOpen && employeeId) {
            fetchDocuments();
            fetchDocumentTypes();
        }
    }, [isOpen, employeeId]);

    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/employees/${employeeId}/documents?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setDocuments(data.data);
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDocumentTypes = async () => {
        try {
            const response = await fetch(`/api/document-types?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setDocumentTypes(data.data);
            }
        } catch (error) {
            console.error('Error fetching document types:', error);
        }
    };

    // --- Create Document (Metadata Only) ---
    const handleAddDocument = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.documentTypeId) return;

        setIsSaving(true);
        try {
            const response = await fetch(`/api/employees/${employeeId}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    documentTypeId: formData.documentTypeId,
                    comments: formData.comments,
                    // No file interaction here anymore
                })
            });

            if (response.ok) {
                setFormData({ documentTypeId: 0, comments: '' });
                fetchDocuments();
            } else {
                alert('Error al agregar el documento');
            }
        } catch (error) {
            console.error('Error creating document:', error);
            alert('Error al agregar el documento');
        } finally {
            setIsSaving(false);
        }
    };

    // --- File Upload (Grid) ---
    const handleFileSelect = (docId: number) => {
        setUploadingDocId(docId);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click(); // Open system dialog
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && uploadingDocId !== null) {
            const file = e.target.files[0];
            await uploadFileForDocument(uploadingDocId, file);
        }
    };

    const uploadFileForDocument = async (docId: number, file: File) => {
        setIsUploading(true);
        try {
            // Convert to Base64
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];
                const fullBase64 = reader.result as string; // Keep prefix for immediate UI update if needed

                const response = await fetch(`/api/employees/${employeeId}/documents`, {
                    method: 'PUT', // Using PUT for updates
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId,
                        documentId: docId,
                        originalFileName: file.name,
                        fileBase64: base64
                    })
                });

                if (response.ok) {
                    await fetchDocuments();
                } else {
                    alert('Error al subir el archivo');
                }
                setUploadingDocId(null);
                setIsUploading(false);
            };
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('Error al subir el archivo');
            setIsUploading(false);
            setUploadingDocId(null);
        }
    };

    const handleDelete = async (docId: number) => {
        if (!confirm('¿Estás seguro de eliminar este documento?')) return;
        try {
            const response = await fetch(`/api/employees/${employeeId}/documents?projectId=${projectId}&docId=${docId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                fetchDocuments();
            }
        } catch (error) {
            console.error('Error deleting document:', error);
        }
    };

    const handleDownload = (doc: Document) => {
        if (doc.ArchivoDocumento) {
            // It's a Base64 string in DB. Construct Data URI.
            // We need to guess mime type or store it. Usually stored, but if not, we can try to infer or just generic.
            // Ideally prefix is stored, or we assume PDF/Image. 
            // If the Base64 in DB doesn't have prefix, we might need to rely on extension.

            // Note: In typical patterns (like Costing), we might be storing the WHOLE data URI or just the bytes.
            // The code above (reader.readAsDataURL) produces "data:application/pdf;base64,.....". 
            // My PUT sends `base64` (split[1]) which is just raw bytes.
            // So we need to reconstruct.

            // Check if we have an extension
            let mimeType = 'application/octet-stream';
            if (doc.NombreArchivo) {
                const ext = doc.NombreArchivo.split('.').pop()?.toLowerCase();
                if (ext === 'pdf') mimeType = 'application/pdf';
                else if (ext === 'png') mimeType = 'image/png';
                else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                else if (ext === 'xls' || ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                else if (ext === 'doc' || ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            }

            const linkSource = `data:${mimeType};base64,${doc.ArchivoDocumento}`;
            const downloadLink = document.createElement("a");
            downloadLink.href = linkSource;
            downloadLink.download = doc.NombreArchivo || `document_${doc.IdEmpleadoDocumento}`;
            downloadLink.click();
        } else if (doc.RutaArchivo) {
            // Legacy path
            window.open(doc.RutaArchivo, '_blank');
        } else {
            alert('No hay archivo disponible');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Documentos - {employeeName}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden h-full min-h-0">
                    {/* Add Form */}
                    <div className="md:col-span-1 border-r pr-6 border-gray-100 overflow-y-auto">
                        <h3 className="text-sm font-bold text-blue-600 mb-4 uppercase">Nuevo Documento</h3>
                        <form onSubmit={handleAddDocument} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
                                <select
                                    value={formData.documentTypeId}
                                    onChange={(e) => setFormData({ ...formData, documentTypeId: parseInt(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    required
                                >
                                    <option value={0}>Seleccionar...</option>
                                    {documentTypes.map((type) => (
                                        <option key={type.IdTipoDocumento} value={type.IdTipoDocumento}>
                                            {type.TipoDocumento}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios</label>
                                <textarea
                                    value={formData.comments}
                                    onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    rows={3}
                                    placeholder="Descripción o notas..."
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSaving}>
                                {isSaving ? 'Guardando...' : 'Agregar Documento'}
                            </Button>
                        </form>
                    </div>

                    {/* Documents List */}
                    <div className="md:col-span-2 overflow-y-auto pr-2">
                        <h3 className="text-sm font-bold text-gray-600 mb-4 uppercase">Historial</h3>
                        {isLoading ? (
                            <div className="text-center py-10 text-gray-500">Cargando documentos...</div>
                        ) : documents.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 bg-gray-50 rounded-lg">No hay documentos registrados.</div>
                        ) : (
                            <div className="bg-white rounded border border-gray-100 overflow-hidden shadow-sm">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Documento</th>
                                            <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Comentarios</th>
                                            <th className="px-4 py-2 text-center text-[10px] font-bold text-gray-500 uppercase">Archivo</th>
                                            <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {documents.map((doc) => (
                                            <tr key={doc.IdEmpleadoDocumento} className="hover:bg-gray-50 text-sm">
                                                <td className="px-4 py-3 font-medium text-gray-900 text-xs">
                                                    {doc.TipoDocumento || 'Otro'}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 text-xs text-wrap max-w-[200px]">
                                                    {doc.Comentarios || '-'}
                                                </td>
                                                <td className="px-4 py-3 align-middle text-center">
                                                    {(doc.ArchivoDocumento || doc.RutaArchivo) ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => handleDownload(doc)}
                                                                className="text-blue-600 hover:underline text-[10px] flex items-center gap-1"
                                                                title={doc.NombreArchivo || 'Ver Archivo'}
                                                            >
                                                                📎 Ver
                                                            </button>
                                                            <button
                                                                onClick={() => handleFileSelect(doc.IdEmpleadoDocumento)}
                                                                className="text-gray-400 hover:text-blue-600 text-[10px] border rounded px-1"
                                                                disabled={isUploading}
                                                                title="Cambiar Archivo"
                                                            >
                                                                🔄
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleFileSelect(doc.IdEmpleadoDocumento)}
                                                            className="text-green-600 hover:text-green-800 text-[10px] border border-green-200 bg-green-50 rounded px-2 py-1 flex items-center gap-1 mx-auto"
                                                            disabled={isUploading}
                                                        >
                                                            📤 Subir
                                                        </button>
                                                    )}
                                                    {isUploading && uploadingDocId === doc.IdEmpleadoDocumento && (
                                                        <span className="text-[10px] text-blue-500 animate-pulse block mt-1">Subiendo...</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleDelete(doc.IdEmpleadoDocumento)}
                                                        className="text-lg hover:scale-125 transition-transform text-red-500"
                                                        title="Eliminar"
                                                    >
                                                        🗑️
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end mt-4 pt-4 border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md text-sm font-medium transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div >
    );
}
