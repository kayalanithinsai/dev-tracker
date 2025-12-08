export interface Problem {
    id: string;
    title: string;
    isSolved: boolean;
    difficulty?: 'Easy' | 'Medium' | 'Hard';
    topic?: string;
    link?: string;
    isForRevision?: boolean;
    revisionInterval?: number;
    nextRevisionDate?: number;
    notes?: string;
}

export interface Subject {
    id: string;
    title: string;
    description: string;
    problems: Problem[];
    createdAt: number;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    isError?: boolean;
}


