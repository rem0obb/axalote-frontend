import { ReactNode } from 'react';

export interface AISkill {
    id: string;
    name: string;
    description: string;
    category: 'Analysis' | 'Detection' | 'Reversing' | 'General';
    icon: ReactNode;
    promptTemplate: string;
}
