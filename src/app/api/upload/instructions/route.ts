import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const projectId = formData.get('projectId') as string;
        const productId = formData.get('productId') as string;

        if (!file || !projectId || !productId) {
            return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Create directory structure
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'instructions', projectId, productId);
        await mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const timestamp = Date.now();
        const extension = path.extname(file.name);
        const filename = `step-${timestamp}${extension}`;
        const filepath = path.join(uploadDir, filename);

        // Write file
        await writeFile(filepath, buffer);

        // Return relative path for database storage
        const relativePath = `/uploads/instructions/${projectId}/${productId}/${filename}`;

        return NextResponse.json({
            success: true,
            path: relativePath,
            message: 'File uploaded successfully'
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        return NextResponse.json({ success: false, message: 'Error uploading file' }, { status: 500 });
    }
}
