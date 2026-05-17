'use client';

import MassiveProductUpload from '@/components/MassiveProductUpload';
import PageShell from '@/components/PageShell';
import { Upload } from 'lucide-react';

export default function MassiveProductUploadPage() {
    return (
        <PageShell title="Carga Masiva de Productos" icon={Upload}>
            <MassiveProductUpload />
        </PageShell>
    );
}
