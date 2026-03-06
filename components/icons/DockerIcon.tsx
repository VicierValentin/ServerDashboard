import React from 'react';

interface DockerIconProps {
    className?: string;
}

export const DockerIcon: React.FC<DockerIconProps> = ({ className }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={className}
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 13h2v2H3v-2zm3-3h2v2H6v-2zm0 3h2v2H6v-2zm3-6h2v2H9V7zm0 3h2v2H9v-2zm0 3h2v2H9v-2zm3-6h2v2h-2V7zm0 3h2v2h-2v-2zm0 3h2v2h-2v-2zm3-6h2v2h-2V7zm0 3h2v2h-2v-2zm0 3h2v2h-2v-2zM3 16h18v2H3v-2zm18-3c0-1.1-.9-2-2-2h-1v-1c0-.55-.45-1-1-1h-1V8c0-.55-.45-1-1-1h-1V6c0-.55-.45-1-1-1H9c-.55 0-1 .45-1 1v1H7c-.55 0-1 .45-1 1v1H5c-.55 0-1 .45-1 1v1H3c-1.1 0-2 .9-2 2v3h20v-3z"
        />
    </svg>
);
