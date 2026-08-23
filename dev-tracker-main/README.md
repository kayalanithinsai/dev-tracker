# DevTracker — Striver A2Z + Spaced Repetition + GitHub

This version keeps the Striver A2Z hierarchy and spaced-repetition workflow, adds a clean revision-status grid, and adds optional GitHub solution pushing.

## Run

```powershell
npm install
npm run dev
```

The project uses port `3000` by default.

## Striver A2Z

Open DSA and click **Import Striver A2Z**. Problems are organized as:

`Topic → Subtopic → Problem`

The importer is safe to run again and does not duplicate imported problems.

## Spaced repetition

The existing schedule is unchanged:

`1 day → 4 days → 7 days → completed`

The schedule belongs to each problem.

## Progress grid

- Gray = Unsolved
- Green = Solved
- Amber = In Revision
- Sky blue = Revision Completed

## GitHub integration

1. Create a repository such as `DSA-Solutions` on GitHub.
2. Create a **fine-grained Personal Access Token** restricted to that repository.
3. Give the token **Contents: Read and write** permission.
4. In DevTracker, open **GitHub** in the header and enter owner, repository, branch and token.
5. Use **Test Connection**.
6. Open the `</>` solution button for a problem, paste the accepted LeetCode/GFG C++ code, and click **Commit & Push**.

The app creates paths automatically using:

`topic/subtopic/difficulty/problem.cpp`

Existing files are updated using their GitHub blob SHA, so re-pushing a solution updates the same file rather than creating a duplicate.

The GitHub token is kept in this browser's local storage. Do not put it in source code or share it.

GitHub's repository contents API supports creating or updating a file with a fine-grained token that has repository **Contents: write** permission.
