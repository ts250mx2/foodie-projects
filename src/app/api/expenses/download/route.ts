import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const file = searchParams.get('file');
        const projectId = searchParams.get('projectId');

        if (!file || !projectId) {
            return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 });
        }

        // Construct file path
        const filePath = join(process.cwd(), 'public', 'uploads', file);

        // Check if file exists
        if (!existsSync(filePath)) {
            return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
        }

        // Read file
        const fileBuffer = await readFile(filePath);

        // Determine content type based on extension
        const extension = file.split('.').pop()?.toLowerCase();
        let contentType = 'application/octet-stream';

        switch (extension) {
            case 'pdf':
                contentType = 'application/pdf';
                break;
            case 'jpg':
            case 'jpeg':
                contentType = 'image/jpeg';
                break;
            case 'png':
                contentType = 'image/png';
                break;
            case 'gif':
                contentType = 'image/gif';
                break;
            case 'doc':
                contentType = 'application/msword';
                break;
            case 'docx':
                contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                break;
            case 'xls':
                contentType = 'application/vnd.ms-excel';
                break;
            case 'xlsx':
                contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                break;
        }

        // Return file with appropriate headers
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${file.split('/').pop()}"`,
            },
        });
    } catch (error) {
        console.error('Error downloading file:', error);
        return NextResponse.json({ success: false, message: 'Error downloading file' }, { status: 500 });
    }
}
