import Image from 'next/image';

interface BrandLogoProps {
    subtitle?: string;
    size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
    sm: { width: 96, height: 96 },
    md: { width: 128, height: 128 },
    lg: { width: 160, height: 160 },
};

export default function BrandLogo({ subtitle, size = 'md' }: BrandLogoProps) {
    const { width, height } = SIZE_MAP[size];

    return (
        <div className="text-center mb-8 flex flex-col items-center">
            <div className="mb-3 drop-shadow-md">
                <Image
                    src="/images/foodie-guru-logo.png"
                    alt="Foodie Guru"
                    width={width}
                    height={height}
                    priority
                    className="object-contain"
                />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Foodie Guru
            </h1>
            {subtitle && (
                <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">{subtitle}</p>
            )}
        </div>
    );
}
