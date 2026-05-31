'use client';

import AiAgent from '@/components/dashboard/AiAgent';

export default function AgentePage() {
    return (
        <div className="-mx-8 -mt-4 -mb-8" style={{ height: 'calc(100vh - 4rem)' }}>
            <AiAgent mode="embedded" />
        </div>
    );
}
