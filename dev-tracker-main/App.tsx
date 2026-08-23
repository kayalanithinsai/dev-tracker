import React, { useState, useEffect, useMemo } from 'react';
import type { Subject, Problem } from './types';
import { v4 as uuidv4 } from 'uuid';
import ProblemGrid from './components/ProblemGrid';
import AIAssistant from './components/AIAssistant';
import { db } from './services/database';
import { fetchStriverProblems } from './services/striverImporter';
import { createOrUpdateGitHubFile, getGitHubFile, makeGitHubPath, testGitHubConnection, type GitHubSettings } from './services/githubService';
// Use react-markdown only in AIAssistant to keep App clean, import icons
import { Trash2, Plus, ArrowLeft, BrainCircuit, CheckCircle2, Circle, Calendar, Repeat, BookOpen, Edit2, FileText, StickyNote, X, Github, Code2, ExternalLink, UploadCloud, Settings, Eye, EyeOff, ChevronRight, Clock3 } from 'lucide-react';


const getLeetCodeUrl = (problem: Problem) => {
  if (problem.link) return problem.link;
  return `https://leetcode.com/problemset/?search=${encodeURIComponent(problem.title)}`;
};

const getGfgUrl = (problem: Problem) =>
  `https://www.geeksforgeeks.org/search/?q=${encodeURIComponent(problem.title)}`;

const App: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [notesModalProblem, setNotesModalProblem] = useState<{ subjectId: string; problem: Problem } | null>(null);
  const [notesContent, setNotesContent] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showTopicStats, setShowTopicStats] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);
  const [githubSettings, setGithubSettings] = useState<GitHubSettings>(() => {
    try {
      const saved = localStorage.getItem('devtracker_github_settings');
      return saved ? JSON.parse(saved) : { owner: '', repo: '', branch: 'main', token: '' };
    } catch {
      return { owner: '', repo: '', branch: 'main', token: '' };
    }
  });
  const [githubStatus, setGithubStatus] = useState('');
  const [isTestingGitHub, setIsTestingGitHub] = useState(false);
  const [showGitHubToken, setShowGitHubToken] = useState(false);
  const [solutionModal, setSolutionModal] = useState<{ subjectId: string; problem: Problem } | null>(null);
  const [solutionCode, setSolutionCode] = useState('');
  const [solutionStatus, setSolutionStatus] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [todayPlanIds, setTodayPlanIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('devtracker_dsa_daily_plan');
      if (!saved) return [];
      const parsed = JSON.parse(saved) as { date: string; ids: string[] };
      const today = new Date().toISOString().slice(0, 10);
      return parsed.date === today && Array.isArray(parsed.ids) ? parsed.ids : [];
    } catch {
      return [];
    }
  });

  // Initialize Database and Load Data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await db.initialize();
        const loadedSubjects = await db.getAllSubjects();

        if (loadedSubjects.length === 0) {
          const defaultSubjects: Subject[] = [
            {
              id: uuidv4(),
              title: 'DSA',
              description: 'Data Structures and Algorithms Interview Prep',
              problems: [],
              createdAt: Date.now()
            },
            {
              id: uuidv4(),
              title: 'System Design (HLD)',
              description: 'High Level Design Concepts',
              problems: [],
              createdAt: Date.now()
            },
            {
              id: uuidv4(),
              title: 'LLD',
              description: 'Low Level Design & OOP',
              problems: [],
              createdAt: Date.now()
            }
          ];

          for (const subject of defaultSubjects) {
            await db.createSubject(subject);
          }

          setSubjects(defaultSubjects);
        } else {
          setSubjects(loadedSubjects);
        }

        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsLoaded(true);
      }
    };

    initializeApp();
  }, []);

  const activeSubject = useMemo(() =>
    subjects.find(s => s.id === selectedSubjectId),
    [subjects, selectedSubjectId]
  );

  const toggleProblem = async (subjectId: string, problemId: string) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id === problemId) {
            const updated = { ...p, isSolved: !p.isSolved };
            db.updateProblem(updated); // Persist to database
            return updated;
          }
          return p;
        })
      };
    }));
  };


  const markForRevision = async (subjectId: string, problemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id !== problemId) return p;

          let updated: Problem;
          // Toggle revision
          if (p.isForRevision) {
            const { isForRevision, revisionInterval, nextRevisionDate, ...rest } = p;
            updated = rest as Problem;
          } else {
            // Start/restart revision schedule (1 day)
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + 1);
            nextDate.setHours(0, 0, 0, 0);

            updated = {
              ...p,
              isForRevision: true,
              revisionCompleted: false,
              revisionInterval: 1,
              nextRevisionDate: nextDate.getTime()
            };
          }

          db.updateProblem(updated); // Persist to database
          return updated;
        })
      };
    }));
  };

  const completeRevision = async (subjectId: string, problemId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id !== problemId) return p;

          if (!p.revisionInterval) return p;

          let updated: Problem;
          let newInterval: number | undefined;

          if (p.revisionInterval === 1) newInterval = 4;
          else if (p.revisionInterval === 4) newInterval = 7;
          else if (p.revisionInterval === 7) newInterval = 3650;
          else {
            // Finished full revision cycle: keep a visible completion state.
            updated = {
              ...p,
              isForRevision: false,
              revisionCompleted: true,
              revisionInterval: undefined,
              nextRevisionDate: undefined
            };
            db.updateProblem(updated); // Persist to database
            return updated;
          }

          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + newInterval);
          nextDate.setHours(0, 0, 0, 0);

          updated = {
            ...p,
            revisionInterval: newInterval,
            nextRevisionDate: nextDate.getTime()
          };

          db.updateProblem(updated); // Persist to database
          return updated;
        })
      };
    }));
  };

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);

  const dueRevisions = useMemo(() => {
    const due: { subject: Subject; problem: Problem }[] = [];
    subjects.forEach(subject => {
      subject.problems.forEach(problem => {
        if (problem.isForRevision && problem.nextRevisionDate && problem.nextRevisionDate <= todayStart) {
          due.push({ subject, problem });
        }
      });
    });
    return due;
  }, [subjects, todayStart]);

  const upcomingRevisions = useMemo(() => {
    const weekEnd = todayStart + 7 * 24 * 60 * 60 * 1000;
    return subjects.flatMap(subject =>
      subject.problems
        .filter(problem => problem.isForRevision && problem.nextRevisionDate && problem.nextRevisionDate > todayStart && problem.nextRevisionDate <= weekEnd)
        .map(problem => ({ subject, problem }))
    ).sort((a, b) => (a.problem.nextRevisionDate || 0) - (b.problem.nextRevisionDate || 0));
  }, [subjects, todayStart]);

  const revisionStats = useMemo(() => ({
    due: dueRevisions.length,
    upcoming: upcomingRevisions.length,
    active: subjects.reduce((sum, subject) => sum + subject.problems.filter(p => p.isForRevision).length, 0),
    completed: subjects.reduce((sum, subject) => sum + subject.problems.filter(p => p.revisionCompleted).length, 0)
  }), [subjects, dueRevisions.length, upcomingRevisions.length]);

  const todayPlan = useMemo(() => {
    const dsa = subjects.find(s => s.title.trim().toLowerCase() === 'dsa');
    if (!dsa) return [];
    const byId = new Map(dsa.problems.map(p => [p.id, p]));
    return todayPlanIds
      .map(id => byId.get(id))
      .filter((p): p is Problem => Boolean(p));
  }, [subjects, todayPlanIds]);

  const todayPlanDueCount = useMemo(() =>
    todayPlan.filter(p => p.isForRevision && p.nextRevisionDate && p.nextRevisionDate <= todayStart).length,
    [todayPlan, todayStart]
  );

  const generateTodayPlan = () => {
    const dsa = subjects.find(s => s.title.trim().toLowerCase() === 'dsa');
    if (!dsa) return;

    // Collision strategy:
    // 1) Revisions due/overdue get priority, oldest first.
    // 2) Never pull an upcoming revision forward just to fill a slot.
    // 3) Use remaining slots for the next unsolved Striver problems in sheet order.
    // 4) Hard cap: 5 problems per day. Any extra due revisions remain due and carry over.
    const due = dsa.problems
      .filter(p => p.isForRevision && p.nextRevisionDate && p.nextRevisionDate <= todayStart)
      .sort((a, b) => (a.nextRevisionDate || 0) - (b.nextRevisionDate || 0));

    const selected = due.slice(0, 5);
    const selectedIds = new Set(selected.map(p => p.id));
    const remainingSlots = 5 - selected.length;

    if (remainingSlots > 0) {
      const newProblems = dsa.problems
        .filter(p => !p.isSolved && !p.isForRevision && !p.revisionCompleted && !selectedIds.has(p.id))
        .slice(0, remainingSlots);
      selected.push(...newProblems);
    }

    const ids = selected.map(p => p.id);
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('devtracker_dsa_daily_plan', JSON.stringify({ date: today, ids }));
    setTodayPlanIds(ids);
  };

  const dsaProblemCount = useMemo(() => {
    const dsa = subjects.find(s => s.title.trim().toLowerCase() === 'dsa');
    return dsa?.problems.length || 0;
  }, [subjects]);

  useEffect(() => {
    if (!isLoaded) return;
    const dsa = subjects.find(s => s.title.trim().toLowerCase() === 'dsa');
    if (!dsa) return;
    const today = new Date().toISOString().slice(0, 10);
    const saved = localStorage.getItem('devtracker_dsa_daily_plan');
    let savedDate = '';
    try { savedDate = saved ? (JSON.parse(saved) as { date?: string }).date || '' : ''; } catch { /* ignore */ }
    if (savedDate !== today) {
      generateTodayPlan();
    } else if (dsa.problems.length > 0 && (todayPlanIds.length === 0 || todayPlanIds.some(id => !dsa.problems.some(p => p.id === id)))) {
      generateTodayPlan();
    }
  }, [isLoaded, dsaProblemCount]);

  const dsaTopicStats = useMemo(() => {
    const dsa = subjects.find(s => s.title.trim().toLowerCase() === 'dsa');
    if (!dsa) return [];

    const topicMap = new Map<string, { total: number; solved: number; revision: number; completed: number }>();
    dsa.problems.forEach(problem => {
      const topic = problem.topic?.trim() || 'Uncategorized';
      const current = topicMap.get(topic) || { total: 0, solved: 0, revision: 0, completed: 0 };
      current.total += 1;
      if (problem.isSolved) current.solved += 1;
      if (problem.isForRevision) current.revision += 1;
      if (problem.revisionCompleted) current.completed += 1;
      topicMap.set(topic, current);
    });

    return Array.from(topicMap, ([topic, stats]) => ({
      topic,
      ...stats,
      percentage: stats.total ? Math.round((stats.solved / stats.total) * 100) : 0,
      remaining: stats.total - stats.solved
    })).sort((a, b) => b.total - a.total || a.topic.localeCompare(b.topic));
  }, [subjects]);

  const formatRevisionDate = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const dateStart = new Date(date);
    dateStart.setHours(0, 0, 0, 0);
    const diff = Math.round((dateStart.getTime() - todayStart) / (24 * 60 * 60 * 1000));
    if (diff <= 0) return 'Due today';
    if (diff === 1) return 'Tomorrow';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  const importStriverA2Z = async () => {
    if (isImporting) return;
    setIsImporting(true);
    setImportMessage('Downloading Striver A2Z sheet...');
    try {
      const importedProblems = await fetchStriverProblems();
      let dsa = subjects.find(s => s.title.trim().toLowerCase() === 'dsa');

      if (!dsa) {
        dsa = {
          id: uuidv4(),
          title: 'DSA',
          description: 'Striver A2Z Data Structures and Algorithms',
          problems: [],
          createdAt: Date.now()
        };
        await db.createSubject(dsa);
      }

      const existingIds = new Set(dsa.problems.map(p => p.sourceId).filter(Boolean));
      const newProblems = importedProblems.filter(p => !existingIds.has(p.sourceId));

      if (newProblems.length === 0) {
        setImportMessage('Striver A2Z is already imported.');
        return;
      }

      await db.createProblemsBulk(dsa.id, newProblems);
      setSubjects(prev => prev.map(s => s.id === dsa!.id
        ? { ...s, problems: [...s.problems, ...newProblems] }
        : s
      ));
      setImportMessage(`Imported ${newProblems.length} Striver A2Z problems.`);
    } catch (error) {
      console.error('Striver import failed:', error);
      setImportMessage('Import failed. Check your internet connection and try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const deleteSubject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this subject?')) {
      await db.deleteSubject(id);
      setSubjects(prev => prev.filter(s => s.id !== id));
      if (selectedSubjectId === id) setSelectedSubjectId(null);
    }
  };

  const createSubject = async () => {
    const title = prompt("Enter Subject Name (e.g., 'React Internals'):");
    if (!title) return;

    const newSubject: Subject = {
      id: uuidv4(),
      title,
      description: 'New subject tracker',
      problems: [],
      createdAt: Date.now()
    };

    await db.createSubject(newSubject);
    setSubjects(prev => [...prev, newSubject]);
  };

  const addNewProblem = async (subjectId: string) => {
    const title = prompt("Enter task name:");
    if (!title || !title.trim()) return;

    const newProblem: Problem = {
      id: uuidv4(),
      title: title.trim(),
      isSolved: false
    };

    await db.createProblem(subjectId, newProblem);

    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: [...sub.problems, newProblem]
      };
    }));
  };

  const deleteProblem = async (subjectId: string, problemId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Are you sure you want to delete this task?')) return;

    await db.deleteProblem(problemId);

    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.filter(p => p.id !== problemId)
      };
    }));
  };

  const updateProblemTitle = async (subjectId: string, problemId: string, newTitle: string) => {
    if (!newTitle.trim()) return;

    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id === problemId) {
            const updated = { ...p, title: newTitle };
            db.updateProblem(updated);
            return updated;
          }
          return p;
        })
      };
    }));
  };

  const updateProblemNotes = async (subjectId: string, problemId: string, notes: string) => {
    setSubjects(prev => prev.map(sub => {
      if (sub.id !== subjectId) return sub;
      return {
        ...sub,
        problems: sub.problems.map(p => {
          if (p.id === problemId) {
            const updated = { ...p, notes };
            db.updateProblem(updated);
            return updated;
          }
          return p;
        })
      };
    }));
  };

  const handleStartEdit = (problem: Problem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProblemId(problem.id);
    setEditingTitle(problem.title);
  };

  const handleSaveEdit = async (subjectId: string, problemId: string) => {
    if (editingTitle.trim()) {
      await updateProblemTitle(subjectId, problemId, editingTitle);
    }
    setEditingProblemId(null);
    setEditingTitle('');
  };

  const handleCancelEdit = () => {
    setEditingProblemId(null);
    setEditingTitle('');
  };

  const openNotesModal = (subjectId: string, problem: Problem, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotesModalProblem({ subjectId, problem });
    setNotesContent(problem.notes || '');
  };

  const saveNotes = async () => {
    if (notesModalProblem) {
      await updateProblemNotes(notesModalProblem.subjectId, notesModalProblem.problem.id, notesContent);
      setNotesModalProblem(null);
      setNotesContent('');
    }
  };

  const closeNotesModal = () => {
    setNotesModalProblem(null);
    setNotesContent('');
  };

  const saveGitHubSettings = () => {
    localStorage.setItem('devtracker_github_settings', JSON.stringify(githubSettings));
    setGithubStatus('GitHub settings saved locally.');
  };

  const testGitHub = async () => {
    setIsTestingGitHub(true);
    setGithubStatus('Testing repository access...');
    try {
      const fullName = await testGitHubConnection(githubSettings);
      localStorage.setItem('devtracker_github_settings', JSON.stringify(githubSettings));
      setGithubStatus(`Connected to ${fullName}.`);
    } catch (error) {
      setGithubStatus(error instanceof Error ? error.message : 'GitHub connection failed.');
    } finally {
      setIsTestingGitHub(false);
    }
  };

  const openSolutionModal = (subjectId: string, problem: Problem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSolutionModal({ subjectId, problem });
    setSolutionCode(problem.solutionCode || '');
    setSolutionStatus('');
  };

  const closeSolutionModal = () => {
    setSolutionModal(null);
    setSolutionCode('');
    setSolutionStatus('');
  };

  const updateProblemSolution = async (subjectId: string, problemId: string, code: string, github?: { path?: string; sha?: string; url?: string }) => {
    const current = subjects.find(s => s.id === subjectId)?.problems.find(p => p.id === problemId);
    if (!current) return;
    const updated: Problem = {
      ...current,
      solutionCode: code,
      ...(github?.path !== undefined ? { githubPath: github.path } : {}),
      ...(github?.sha !== undefined ? { githubSha: github.sha } : {}),
      ...(github?.url !== undefined ? { githubUrl: github.url } : {})
    };
    await db.updateProblem(updated);
    setSubjects(prev => prev.map(sub => sub.id !== subjectId ? sub : {
      ...sub,
      problems: sub.problems.map(p => p.id === problemId ? updated : p)
    }));
  };

  const saveSolution = async () => {
    if (!solutionModal) return;
    if (!solutionCode.trim()) {
      setSolutionStatus('Paste your accepted C++ solution first.');
      return;
    }
    await updateProblemSolution(solutionModal.subjectId, solutionModal.problem.id, solutionCode);
    setSolutionStatus('Solution saved locally.');
  };

  const pushSolutionToGitHub = async () => {
    if (!solutionModal) return;
    if (!solutionCode.trim()) {
      setSolutionStatus('Paste your accepted C++ solution first.');
      return;
    }
    if (!githubSettings.owner || !githubSettings.repo || !githubSettings.branch || !githubSettings.token) {
      setSolutionStatus('Open GitHub settings and complete the repository details first.');
      return;
    }

    const problem = solutionModal.problem;
    const defaultCommitMessage = `${problem.githubUrl ? 'Update' : 'Solve'} ${problem.title}`;
    const commitMessage = window.prompt('Enter a GitHub commit message:', defaultCommitMessage);
    if (commitMessage === null) {
      setSolutionStatus('Push cancelled.');
      return;
    }
    if (!commitMessage.trim()) {
      setSolutionStatus('Enter a commit message before pushing.');
      return;
    }

    setIsPushing(true);
    setSolutionStatus('Preparing GitHub commit...');
    try {
      const path = problem.githubPath || makeGitHubPath(problem.topic, problem.subtopic, problem.difficulty, problem.title);
      let sha = problem.githubSha;

      // GitHub requires the current blob SHA when replacing an existing file.
      if (!sha) {
        const existing = await getGitHubFile(githubSettings, path);
        sha = existing?.sha;
      }

      const result = await createOrUpdateGitHubFile(
        githubSettings,
        path,
        solutionCode,
        commitMessage.trim(),
        sha
      );

      await updateProblemSolution(solutionModal.subjectId, problem.id, solutionCode, {
        path,
        sha: result.sha,
        url: result.htmlUrl
      });
      setSolutionStatus('Pushed successfully.');
      setSolutionModal(prev => prev ? { ...prev, problem: { ...prev.problem, solutionCode, githubPath: path, githubSha: result.sha, githubUrl: result.htmlUrl } } : prev);
    } catch (error) {
      console.error('GitHub push failed:', error);
      setSolutionStatus(error instanceof Error ? error.message : 'GitHub push failed.');
    } finally {
      setIsPushing(false);
    }
  };

  const getProgressStats = (problems: Problem[]) => {
    const solved = problems.filter(p => p.isSolved).length;
    const total = problems.length;
    const percentage = total === 0 ? 0 : Math.round((solved / total) * 100);
    return { solved, total, percentage };
  };

  if (!isLoaded) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-emerald-500">Loading Tracker...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">

      {/* Header */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setSelectedSubjectId(null)}>
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              DevTracker
            </h1>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <button
              onClick={() => { setGithubStatus(''); setIsGitHubOpen(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-300 transition-colors"
              title="GitHub settings"
            >
              <Github className="w-4 h-4" />
              <span className="hidden sm:inline">GitHub</span>
              <Settings className="w-3.5 h-3.5 text-zinc-500" />
            </button>
            <span className="hidden md:inline">Prepare. Track. Succeed.</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* Dashboard View */}
        {!activeSubject && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">Your Subjects</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={importStriverA2Z}
                  disabled={isImporting}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition-all"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>{isImporting ? 'Importing...' : 'Import Striver A2Z'}</span>
                </button>
                <button
                  onClick={createSubject}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Subject</span>
                </button>
              </div>
            </div>

            {importMessage && (
              <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-xl px-4 py-3 text-sm">
                {importMessage}
              </div>
            )}

            {/* <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-white">Your Subjects</h2>
              <button
                onClick={createSubject}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>New Subject</span>
              </button>
            </div> */}

            {/* Today's Revision Queue */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Today's Revision Queue</h3>
                    <p className="text-sm text-zinc-500">Focus on the problems that are due today.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-2"><div className="text-lg font-bold text-amber-400">{revisionStats.due}</div><div className="text-[10px] uppercase tracking-wider text-zinc-600">Due</div></div>
                  <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-2"><div className="text-lg font-bold text-indigo-400">{revisionStats.upcoming}</div><div className="text-[10px] uppercase tracking-wider text-zinc-600">Next 7d</div></div>
                  <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl px-4 py-2"><div className="text-lg font-bold text-emerald-400">{revisionStats.completed}</div><div className="text-[10px] uppercase tracking-wider text-zinc-600">Completed</div></div>
                </div>
              </div>

              {dueRevisions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-5 py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/70" />
                  <p className="font-medium text-zinc-300">You're caught up!</p>
                  <p className="text-sm text-zinc-600 mt-1">No revisions are due today.</p>
                </div>
              ) : (
                <div className="grid gap-2">
                  {dueRevisions.map(({ subject, problem }) => (
                    <div key={problem.id} className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50 hover:border-amber-500/30 transition-colors">
                      <button
                        onClick={() => setSelectedSubjectId(subject.id)}
                        className="flex-1 min-w-0 text-left"
                        title="Open subject"
                      >
                        <p className="font-medium text-zinc-200 truncate">{problem.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{subject.title} • {problem.topic || 'DSA'} {problem.subtopic ? `• ${problem.subtopic}` : ''} • {problem.revisionInterval} day interval</p>
                      </button>
                      <span className="hidden sm:flex items-center gap-1 text-xs text-amber-400/80 whitespace-nowrap"><Clock3 className="w-3.5 h-3.5" /> Due today</span>
                      <button
                        onClick={(e) => completeRevision(subject.id, problem.id, e)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-500 hover:text-white rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Complete
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {upcomingRevisions.length > 0 && (
                <div className="mt-6 pt-5 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-zinc-300">Coming up next</h4>
                    <span className="text-xs text-zinc-600">Next 7 days</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {upcomingRevisions.slice(0, 6).map(({ subject, problem }) => (
                      <button key={problem.id} onClick={() => setSelectedSubjectId(subject.id)} className="flex items-center gap-3 text-left bg-zinc-950/30 hover:bg-zinc-950/70 border border-zinc-800/50 hover:border-indigo-500/30 rounded-xl px-3 py-2.5 transition-colors">
                        <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="min-w-0 flex-1"><span className="block text-sm text-zinc-300 truncate">{problem.title}</span><span className="block text-xs text-zinc-600">{formatRevisionDate(problem.nextRevisionDate)}</span></span>
                        <ChevronRight className="w-4 h-4 text-zinc-700" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Today's DSA Plan */}
            {subjects.some(s => s.title.trim().toLowerCase() === 'dsa') && (
              <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">Today's DSA Plan</h3>
                      <p className="text-sm text-zinc-500">Maximum 5 problems • revisions first • new problems fill the remaining slots.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{todayPlan.length}/5 planned</span>
                    <button
                      type="button"
                      onClick={generateTodayPlan}
                      className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-indigo-500/50 hover:bg-indigo-500/10 text-xs text-zinc-300 transition-colors"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>

                {todayPlan.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-5 py-7 text-center">
                    <p className="font-medium text-zinc-300">No problems available for today's plan.</p>
                    <p className="text-sm text-zinc-600 mt-1">Import Striver A2Z or finish your current problems.</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {todayPlan.map((problem, index) => {
                      const subject = subjects.find(s => s.problems.some(p => p.id === problem.id));
                      const isDue = problem.isForRevision && problem.nextRevisionDate && problem.nextRevisionDate <= todayStart;
                      const isScheduledRevision = problem.isForRevision && !isDue;
                      const isSolved = problem.isSolved;
                      return (
                        <div key={problem.id} className="flex items-center gap-3 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50 hover:border-indigo-500/30 transition-colors">
                          <span className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 text-xs font-semibold flex items-center justify-center shrink-0">{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => subject && setSelectedSubjectId(subject.id)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <p className="font-medium text-zinc-200 truncate">{problem.title}</p>
                            <p className="text-xs text-zinc-500 mt-0.5 truncate">{problem.topic || 'DSA'} {problem.subtopic ? `• ${problem.subtopic}` : ''} • {problem.difficulty || 'Unspecified'}</p>
                          </button>
                          <span className={`hidden sm:inline-flex px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap ${isDue ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                            {isDue ? `Revision ${problem.revisionInterval || 1}d` : isScheduledRevision ? `Next ${formatRevisionDate(problem.nextRevisionDate)}` : isSolved ? 'Solved' : 'New'}
                          </span>
                          {isDue ? (
                            <button
                              type="button"
                              onClick={(e) => completeRevision(subject?.id || '', problem.id, e)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Complete
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => subject && setSelectedSubjectId(subject.id)}
                              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-sm font-medium transition-all whitespace-nowrap"
                            >
                              {isSolved ? 'Open' : 'Solve'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {todayPlan.length > 0 && (
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-zinc-600">
                    <span>Strategy: oldest due revisions first; new problems only use leftover slots.</span>
                    {dueRevisions.length > 5 && (
                      <span className="text-amber-500/80">{dueRevisions.length - 5} due revision{dueRevisions.length - 5 === 1 ? '' : 's'} will carry over.</span>
                    )}
                    {todayPlanDueCount === 0 && dueRevisions.length === 0 && <span>Keep going — no revision collisions today.</span>}
                  </div>
                )}
              </section>
            )}

            {dsaTopicStats.length > 0 && (
              <section className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowTopicStats(prev => !prev)}
                  className="w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl px-5 py-4 transition-colors"
                >
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-white">DSA Topic Progress</h3>
                    <p className="text-sm text-zinc-500 mt-1">Click to view your Striver A2Z topic statistics.</p>
                  </div>
                  <ChevronRight className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${showTopicStats ? 'rotate-90' : ''}`} />
                </button>

                {showTopicStats && (
                  <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between gap-3 mb-5">
                      <div>
                        <p className="text-sm text-zinc-500">{dsaTopicStats.length} topics</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {dsaTopicStats.map(stat => (
                        <div key={stat.topic} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 hover:border-zinc-700 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-200 truncate" title={stat.topic}>{stat.topic}</p>
                              <p className="text-xs text-zinc-600 mt-1">{stat.solved} solved • {stat.remaining} remaining</p>
                            </div>
                            <span className="text-sm font-bold text-emerald-400 shrink-0">{stat.percentage}%</span>
                          </div>
                          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mt-3">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${stat.percentage}%` }} />
                          </div>
                          <div className="flex items-center justify-between mt-3 text-[11px] text-zinc-600">
                            <span>{stat.total} problems</span>
                            <span>{stat.revision > 0 ? `${stat.revision} in revision` : stat.completed > 0 ? `${stat.completed} revisions completed` : 'No active revisions'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {subjects.map(subject => {
                const { solved, total, percentage } = getProgressStats(subject.problems);
                return (
                  <div
                    key={subject.id}
                    onClick={() => setSelectedSubjectId(subject.id)}
                    className="group relative bg-zinc-900 border border-zinc-800 rounded-2xl p-6 cursor-pointer hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 w-full h-1 bg-zinc-800">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{subject.title}</h3>
                        <p className="text-sm text-zinc-500 mt-1">{subject.description}</p>
                      </div>
                      <button
                        onClick={(e) => deleteSubject(subject.id, e)}
                        className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-end justify-between mt-8">
                      <div>
                        <span className="text-3xl font-bold text-white">{percentage}%</span>
                        <span className="text-zinc-500 text-sm ml-2">Complete</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-zinc-300">{solved} / {total}</div>
                        <div className="text-xs text-zinc-600 uppercase tracking-wider mt-1">Problems</div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Card Placeholder */}
              <button
                onClick={createSubject}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 hover:text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-300 h-full min-h-[200px]"
              >
                <Plus className="w-10 h-10 mb-2" />
                <span className="font-medium">Add Subject</span>
              </button>
            </div>
          </div>
        )}

        {/* Detail View */}
        {activeSubject && (
          <div className="animate-fade-in-up">
            {/* Nav & Header */}
            <div className="flex items-center gap-4 mb-8">
              <button
                onClick={() => setSelectedSubjectId(null)}
                className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-white">{activeSubject.title}</h2>
                <div className="flex items-center gap-4 mt-2">
                  <div className="h-2 w-48 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${getProgressStats(activeSubject.problems).percentage}%` }}
                    />
                  </div>
                  <span className='text-emerald-400 font-mono text-sm'>
                    {getProgressStats(activeSubject.problems).solved}/{getProgressStats(activeSubject.problems).total} problems
                  </span>
                  {/* <span className="text-emerald-400 font-mono text-sm">
                    {getProgressStats(activeSubject.problems).percentage}% Done
                  </span> */}
                </div>
              </div>

              <div className="flex gap-3">
                {activeSubject.title.trim().toLowerCase() === 'dsa' && (
                  <button
                    onClick={importStriverA2Z}
                    disabled={isImporting}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl transition-all"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span className="font-semibold">{isImporting ? 'Importing...' : 'Import A2Z'}</span>
                  </button>
                )}
                <button
                  onClick={() => addNewProblem(activeSubject.id)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition-all transform hover:scale-105"
                >
                  <Plus className="w-5 h-5" />
                  <span className="font-semibold">Add Task</span>
                </button>

                <button
                  onClick={() => setIsAiOpen(true)}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-105"
                >
                  <BrainCircuit className="w-5 h-5" />
                  <span className="font-semibold">Ask AI Tutor</span>
                </button>
              </div>
            </div>

            {/* Grid Visualization */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium text-zinc-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  Progress Grid
                </h3>
                <span className="text-xs text-zinc-500">Click a box to toggle status</span>
              </div>
              <ProblemGrid
                problems={activeSubject.problems}
                onToggle={(pid) => toggleProblem(activeSubject.id, pid)}
              />
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-zinc-800 rounded-sm"></div>
                  <span>Unsolved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-sm"></div>
                  <span>Solved</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-sm"></div>
                  <span>In Revision</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-sky-500 rounded-sm"></div>
                  <span>Revision Completed</span>
                </div>
              </div>
            </div>

            {/* Hierarchical Problem List */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-white">DSA Roadmap</h3>
                  <p className="text-xs text-zinc-500 mt-1">Topic → Subtopic → Problem • spaced repetition stays on each problem</p>
                </div>
                <span className="text-xs text-zinc-500 font-mono">{activeSubject.problems.length} Items</span>
              </div>
              <div className="max-h-[700px] overflow-y-auto p-3 space-y-3">
                {Array.from(
                  activeSubject.problems.reduce((topicMap, problem) => {
                    const topic = problem.topic || 'Uncategorized';
                    const subtopic = problem.subtopic || 'General';
                    if (!topicMap.has(topic)) topicMap.set(topic, new Map<string, Problem[]>());
                    const subMap = topicMap.get(topic)!;
                    if (!subMap.has(subtopic)) subMap.set(subtopic, []);
                    subMap.get(subtopic)!.push(problem);
                    return topicMap;
                  }, new Map<string, Map<string, Problem[]>>())
                ).map(([topic, subtopics]) => {
                  const topicProblems = Array.from(subtopics.values()).flat();
                  const solved = topicProblems.filter(p => p.isSolved).length;
                  return (
                    <details key={topic} open className="border border-zinc-800 rounded-xl overflow-hidden">
                      <summary className="cursor-pointer list-none px-4 py-3 bg-zinc-950/60 hover:bg-zinc-800/60 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-white">{topic}</span>
                          <span className="ml-3 text-xs text-zinc-500">{solved}/{topicProblems.length} solved</span>
                        </div>
                        <span className="text-xs text-zinc-600">{subtopics.size} subtopics</span>
                      </summary>
                      <div className="p-3 space-y-2">
                        {Array.from(subtopics).map(([subtopic, problems]) => (
                          <details key={subtopic} open className="border border-zinc-800/70 rounded-lg overflow-hidden">
                            <summary className="cursor-pointer list-none px-3 py-2 bg-zinc-900 hover:bg-zinc-800 flex items-center justify-between">
                              <span className="text-sm font-medium text-zinc-200">{subtopic}</span>
                              <span className="text-xs text-zinc-500">{problems.filter(p => p.isSolved).length}/{problems.length}</span>
                            </summary>
                            <div className="divide-y divide-zinc-800/70">
                              {problems.map((problem) => (
                                <div
                                  key={problem.id}
                                  onClick={() => editingProblemId !== problem.id && toggleProblem(activeSubject.id, problem.id)}
                                  className={`group flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-zinc-800/50 ${problem.isSolved ? 'bg-emerald-900/10' : ''}`}
                                >
                                  {problem.isSolved ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" /> : <Circle className="w-5 h-5 text-zinc-600 flex-shrink-0" />}
                                  <div className={`flex-1 text-sm ${problem.isSolved ? 'text-zinc-400 line-through' : 'text-zinc-200'}`}>
                                    {editingProblemId === problem.id ? (
                                      <input
                                        type="text"
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onBlur={() => handleSaveEdit(activeSubject.id, problem.id)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(activeSubject.id, problem.id); if (e.key === 'Escape') handleCancelEdit(); }}
                                        className="w-full bg-zinc-800 text-zinc-200 px-2 py-1 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        autoFocus
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : problem.title}
                                  </div>
                                  <div className="hidden sm:flex items-center gap-1 shrink-0">
                                    <a
                                      href={getLeetCodeUrl(problem)}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="px-2 py-1 rounded-md text-[11px] font-semibold border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                                      title={problem.link ? 'Open LeetCode problem' : 'Search this problem on LeetCode'}
                                    >LC</a>
                                    <a
                                      href={getGfgUrl(problem)}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="px-2 py-1 rounded-md text-[11px] font-semibold border border-green-500/30 text-green-400 hover:bg-green-500/10"
                                      title="Search this problem on GeeksforGeeks"
                                    >GFG</a>
                                  </div>
                                  {problem.difficulty && <span className="text-xs text-zinc-500 hidden md:inline">{problem.difficulty}</span>}
                                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    <button onClick={(e) => openSolutionModal(activeSubject.id, problem, e)} className={`p-1.5 rounded-lg ${problem.solutionCode ? 'text-emerald-500 hover:text-emerald-400' : 'text-zinc-600 hover:text-emerald-400'}`} title="Solution code / GitHub"><Code2 className="w-4 h-4" /></button>
                                    {problem.githubUrl && <a href={problem.githubUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="p-1.5 text-zinc-600 hover:text-white rounded-lg" title="Open GitHub solution"><ExternalLink className="w-4 h-4" /></a>}
                                    <button onClick={(e) => handleStartEdit(problem, e)} className="p-1.5 text-zinc-600 hover:text-blue-400 rounded-lg" title="Edit title"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={(e) => openNotesModal(activeSubject.id, problem, e)} className="p-1.5 text-zinc-600 hover:text-indigo-400 rounded-lg" title="Notes"><FileText className="w-4 h-4" /></button>
                                    <button onClick={(e) => deleteProblem(activeSubject.id, problem.id, e)} className="p-1.5 text-zinc-600 hover:text-red-400 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                    <button
                                      onClick={(e) => markForRevision(activeSubject.id, problem.id, e)}
                                      className={`p-1.5 rounded-lg ${problem.isForRevision ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-600 hover:text-amber-500'}`}
                                      title={problem.isForRevision ? `Next review: ${new Date(problem.nextRevisionDate!).toLocaleDateString()}` : 'Mark for spaced repetition'}
                                    ><Repeat className="w-4 h-4" /></button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* GitHub Settings Modal */}
      {isGitHubOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-xl w-full shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Github className="w-5 h-5" /> GitHub Integration</h3>
                <p className="text-xs text-zinc-500 mt-1">Push accepted LeetCode/GFG solutions directly from DevTracker.</p>
              </div>
              <button onClick={() => setIsGitHubOpen(false)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-zinc-400">Owner / Username<input value={githubSettings.owner} onChange={e => setGithubSettings({...githubSettings, owner: e.target.value})} placeholder="your-username" className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" /></label>
                <label className="text-xs text-zinc-400">Repository<input value={githubSettings.repo} onChange={e => setGithubSettings({...githubSettings, repo: e.target.value})} placeholder="DSA-Solutions" className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" /></label>
              </div>
              <label className="text-xs text-zinc-400">Branch<input value={githubSettings.branch} onChange={e => setGithubSettings({...githubSettings, branch: e.target.value})} placeholder="main" className="mt-1 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-500" /></label>
              <label className="text-xs text-zinc-400">Fine-grained Personal Access Token
                <div className="relative mt-1">
                  <input type={showGitHubToken ? 'text' : 'password'} value={githubSettings.token} onChange={e => setGithubSettings({...githubSettings, token: e.target.value})} placeholder="github_pat_..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 pr-10 text-sm text-white outline-none focus:border-emerald-500" />
                  <button type="button" onClick={() => setShowGitHubToken(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-white">{showGitHubToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
              </label>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-zinc-400">
                Use a fine-grained token restricted to this repository with <span className="text-amber-300 font-semibold">Contents: Read and write</span>. The token is stored only in this browser's local storage. Never paste it into source code or send it to anyone.
              </div>
              {githubStatus && <div className={`text-sm ${githubStatus.toLowerCase().includes('failed') || githubStatus.toLowerCase().includes('unable') ? 'text-red-400' : 'text-emerald-400'}`}>{githubStatus}</div>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsGitHubOpen(false)} className="px-4 py-2 text-zinc-400 hover:text-white rounded-lg">Close</button>
                <button onClick={saveGitHubSettings} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg">Save</button>
                <button onClick={testGitHub} disabled={isTestingGitHub} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg"><Github className="w-4 h-4" />{isTestingGitHub ? 'Testing...' : 'Test Connection'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Solution Modal */}
      {solutionModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-4xl w-full shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-800">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Code2 className="w-5 h-5 text-emerald-400" /> {solutionModal.problem.title}</h3>
                <p className="text-xs text-zinc-500 mt-1">Paste exactly the accepted code you submit on LeetCode/GFG — no driver code required.</p>
              </div>
              <button onClick={closeSolutionModal} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={getLeetCodeUrl(solutionModal.problem)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {solutionModal.problem.link ? 'Open LeetCode' : 'Search LeetCode'}
                </a>
                <a
                  href={getGfgUrl(solutionModal.problem)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Search GeeksforGeeks
                </a>
              </div>
              <textarea
                value={solutionCode}
                onChange={e => setSolutionCode(e.target.value)}
                placeholder={'class Solution {\npublic:\n    // paste your accepted solution here\n};'}
                spellCheck={false}
                className="w-full h-80 bg-zinc-950 border border-zinc-800 rounded-xl p-4 font-mono text-sm text-zinc-200 resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-zinc-500">
                  {solutionModal.problem.githubPath ? <span>GitHub path: <span className="text-zinc-300 font-mono">{solutionModal.problem.githubPath}</span></span> : <span>Path will be generated from Topic / Subtopic / Difficulty / Problem.</span>}
                </div>
                {solutionStatus && <span className={`text-sm ${solutionStatus.toLowerCase().includes('failed') || solutionStatus.toLowerCase().includes('first') || solutionStatus.toLowerCase().includes('complete') ? 'text-amber-400' : 'text-emerald-400'}`}>{solutionStatus}</span>}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button onClick={saveSolution} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg"><CheckCircle2 className="w-4 h-4" /> Save Locally</button>
                <button onClick={pushSolutionToGitHub} disabled={isPushing} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-lg"><UploadCloud className="w-4 h-4" /> {isPushing ? 'Pushing...' : 'Commit & Push'}</button>
                {solutionModal.problem.githubUrl && <a href={solutionModal.problem.githubUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 border border-zinc-700 hover:bg-zinc-800 text-zinc-200 rounded-lg"><ExternalLink className="w-4 h-4" /> Open GitHub</a>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModalProblem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full shadow-2xl animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  Notes
                </h3>
                <p className="text-sm text-zinc-500 mt-1">{notesModalProblem.problem.title}</p>
              </div>
              <button
                onClick={closeNotesModal}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={notesContent}
                onChange={(e) => setNotesContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeNotesModal();
                  if (e.ctrlKey && e.key === 's') {
                    e.preventDefault();
                    saveNotes();
                  }
                }}
                placeholder="Add notes, links, or study references here..."
                className="w-full h-64 bg-zinc-800/50 text-zinc-200 border border-zinc-700 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-zinc-600"
                autoFocus
              />
              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-zinc-600">
                  <kbd className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">Ctrl+S</kbd> to save • <kbd className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">Esc</kbd> to close
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={closeNotesModal}
                    className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNotes}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                  >
                    Save Notes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Assistant Sidebar */}
      <AIAssistant
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        subjectTitle={activeSubject?.title || 'General'}
      />

    </div>
  );
};

export default App;
