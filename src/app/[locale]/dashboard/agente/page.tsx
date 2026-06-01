'use client';

import AiAgent from '@/components/dashboard/AiAgent';

export default function AgentePage() {
    return (
        <div className="h-full w-full overflow-hidden">
            <AiAgent mode="embedded" />
        </div>
    );
}

