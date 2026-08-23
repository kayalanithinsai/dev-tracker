export interface Problem {
    id: string;
    title: string;
    isSolved: boolean;
    difficulty?: 'Easy' | 'Medium' | 'Hard';
    topic?: string;
    subtopic?: string;
    source?: string;
    sourceId?: string;
    link?: string;
    isForRevision?: boolean;
    revisionCompleted?: boolean;
    revisionInterval?: number;
    nextRevisionDate?: number;
    notes?: string;
    solutionCode?: string;
    githubPath?: string;
    githubSha?: string;
    githubUrl?: string;
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


