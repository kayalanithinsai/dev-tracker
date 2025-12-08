import initSqlJs, { Database } from 'sql.js';
import type { Subject, Problem } from '../types';

const DB_NAME = 'devtracker_db';
const SCHEMA_VERSION = 2; // Incremented for notes column migration

class DatabaseService {
    private db: Database | null = null;
    private sqlJs: any = null;

    async initialize(): Promise<void> {
        try {
            // Initialize sql.js
            this.sqlJs = await initSqlJs({
                locateFile: (file) => `https://sql.js.org/dist/${file}`
            });

            // Try to load existing database from IndexedDB
            const savedDb = await this.loadFromIndexedDB();

            if (savedDb) {
                this.db = new this.sqlJs.Database(savedDb);
                await this.migrateSchema(); // Check and apply schema migrations
            } else {
                // Create new database
                this.db = new this.sqlJs.Database();
                await this.createSchema();

                // Migrate data from localStorage if exists
                await this.migrateFromLocalStorage();
            }

            console.log('✅ Database initialized successfully');
        } catch (error) {
            console.error('❌ Database initialization failed:', error);
            throw error;
        }
    }

    private async createSchema(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Create subjects table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `);

        // Create problems table
        this.db.run(`
      CREATE TABLE IF NOT EXISTS problems (
        id TEXT PRIMARY KEY,
        subjectId TEXT NOT NULL,
        title TEXT NOT NULL,
        isSolved INTEGER DEFAULT 0,
        difficulty TEXT,
        topic TEXT,
        link TEXT,
        isForRevision INTEGER DEFAULT 0,
        revisionInterval INTEGER,
        nextRevisionDate INTEGER,
        notes TEXT,
        FOREIGN KEY (subjectId) REFERENCES subjects(id) ON DELETE CASCADE
      )
    `);

        // Create indexes for better query performance
        this.db.run('CREATE INDEX IF NOT EXISTS idx_problems_subject ON problems(subjectId)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_problems_revision ON problems(isForRevision, nextRevisionDate)');

        await this.saveToIndexedDB();
    }

    private async migrateFromLocalStorage(): Promise<void> {
        const LOCAL_STORAGE_KEY = 'devtracker_data_v1';
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);

        if (savedData) {
            try {
                const subjects: Subject[] = JSON.parse(savedData);
                console.log(`📦 Migrating ${subjects.length} subjects from localStorage...`);

                for (const subject of subjects) {
                    await this.createSubject(subject);
                }

                // Remove old localStorage data after successful migration
                localStorage.removeItem(LOCAL_STORAGE_KEY);
                console.log('✅ Migration from localStorage completed');
            } catch (error) {
                console.error('❌ Migration failed:', error);
            }
        }
    }

    private async migrateSchema(): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Check if notes column exists in problems table
        const result = this.db.exec("PRAGMA table_info(problems)");

        if (result.length > 0) {
            const columns = result[0].values.map(row => row[1] as string);

            if (!columns.includes('notes')) {
                console.log('📝 Adding notes column to problems table...');
                this.db.run('ALTER TABLE problems ADD COLUMN notes TEXT');
                await this.saveToIndexedDB();
                console.log('✅ Schema migration completed');
            }
        }
    }

    // === CRUD Operations ===

    async getAllSubjects(): Promise<Subject[]> {
        if (!this.db) throw new Error('Database not initialized');

        const subjects: Subject[] = [];
        const subjectRows = this.db.exec('SELECT * FROM subjects ORDER BY createdAt DESC');

        if (subjectRows.length === 0) return subjects;

        const subjectData = subjectRows[0];
        const idIndex = subjectData.columns.indexOf('id');
        const titleIndex = subjectData.columns.indexOf('title');
        const descIndex = subjectData.columns.indexOf('description');
        const createdAtIndex = subjectData.columns.indexOf('createdAt');

        for (const row of subjectData.values) {
            const subjectId = row[idIndex] as string;
            const problems = await this.getProblemsBySubject(subjectId);

            subjects.push({
                id: subjectId,
                title: row[titleIndex] as string,
                description: row[descIndex] as string,
                createdAt: row[createdAtIndex] as number,
                problems
            });
        }

        return subjects;
    }

    private async getProblemsBySubject(subjectId: string): Promise<Problem[]> {
        if (!this.db) throw new Error('Database not initialized');

        const problems: Problem[] = [];
        const stmt = this.db.prepare('SELECT * FROM problems WHERE subjectId = ?');
        stmt.bind([subjectId]);

        while (stmt.step()) {
            const row = stmt.getAsObject();
            problems.push({
                id: row.id as string,
                title: row.title as string,
                isSolved: Boolean(row.isSolved),
                difficulty: row.difficulty as any,
                topic: row.topic as string | undefined,
                link: row.link as string | undefined,
                isForRevision: Boolean(row.isForRevision),
                revisionInterval: row.revisionInterval as number | undefined,
                nextRevisionDate: row.nextRevisionDate as number | undefined,
                notes: row.notes as string | undefined
            });
        }
        stmt.free();

        return problems;
    }

    async createSubject(subject: Subject): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Insert subject
        this.db.run(
            'INSERT INTO subjects (id, title, description, createdAt) VALUES (?, ?, ?, ?)',
            [subject.id, subject.title, subject.description, subject.createdAt]
        );

        // Insert problems
        for (const problem of subject.problems) {
            await this.createProblem(subject.id, problem);
        }

        await this.saveToIndexedDB();
    }

    async createProblem(subjectId: string, problem: Problem): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        this.db.run(
            `INSERT INTO problems (id, subjectId, title, isSolved, difficulty, topic, link, isForRevision, revisionInterval, nextRevisionDate, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                problem.id,
                subjectId,
                problem.title,
                problem.isSolved ? 1 : 0,
                problem.difficulty || null,
                problem.topic || null,
                problem.link || null,
                problem.isForRevision ? 1 : 0,
                problem.revisionInterval || null,
                problem.nextRevisionDate || null,
                problem.notes || null
            ]
        );

        await this.saveToIndexedDB();
    }

    async updateProblem(problem: Problem): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        this.db.run(
            `UPDATE problems 
       SET title = ?, isSolved = ?, difficulty = ?, topic = ?, link = ?, 
           isForRevision = ?, revisionInterval = ?, nextRevisionDate = ?, notes = ?
       WHERE id = ?`,
            [
                problem.title,
                problem.isSolved ? 1 : 0,
                problem.difficulty || null,
                problem.topic || null,
                problem.link || null,
                problem.isForRevision ? 1 : 0,
                problem.revisionInterval || null,
                problem.nextRevisionDate || null,
                problem.notes || null,
                problem.id
            ]
        );

        await this.saveToIndexedDB();
    }

    async deleteSubject(subjectId: string): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        // Delete subject (problems will be cascaded deleted)
        this.db.run('DELETE FROM subjects WHERE id = ?', [subjectId]);

        await this.saveToIndexedDB();
    }

    // === IndexedDB Persistence ===

    private async saveToIndexedDB(): Promise<void> {
        if (!this.db) return;

        const data = this.db.export();
        const blob = new Blob([data]);

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                const db = request.result;
                const transaction = db.transaction(['database'], 'readwrite');
                const store = transaction.objectStore('database');
                store.put(blob, 'sqliteDb');

                transaction.oncomplete = () => {
                    db.close();
                    resolve();
                };
                transaction.onerror = () => reject(transaction.error);
            };

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('database')) {
                    db.createObjectStore('database');
                }
            };
        });
    }

    private async loadFromIndexedDB(): Promise<Uint8Array | null> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, SCHEMA_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains('database')) {
                    db.close();
                    resolve(null);
                    return;
                }

                const transaction = db.transaction(['database'], 'readonly');
                const store = transaction.objectStore('database');
                const getRequest = store.get('sqliteDb');

                getRequest.onsuccess = async () => {
                    db.close();
                    if (getRequest.result) {
                        const blob = getRequest.result as Blob;
                        const arrayBuffer = await blob.arrayBuffer();
                        resolve(new Uint8Array(arrayBuffer));
                    } else {
                        resolve(null);
                    }
                };

                getRequest.onerror = () => {
                    db.close();
                    reject(getRequest.error);
                };
            };

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('database')) {
                    db.createObjectStore('database');
                }
            };
        });
    }

    // Bulk update for efficiency
    async updateMultipleProblems(problems: Problem[]): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        for (const problem of problems) {
            await this.updateProblem(problem);
        }
    }
}

// Export singleton instance
export const db = new DatabaseService();
