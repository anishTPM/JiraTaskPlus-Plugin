# Contributing to Jira Task Plus

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/jira-task-plus.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature`

## Development Workflow

1. Make changes in `src/`
2. Run `npm run watch` for live rebuilds
3. Load `build/` as unpacked extension in Chrome/Edge
4. Test your changes on a Jira Cloud instance

## Submitting Changes

1. Commit with clear messages (see below)
2. Push to your fork
3. Open a Pull Request against `main`

## Commit Message Format

```
type: short description

- Detail 1
- Detail 2
```

Types: `feat`, `fix`, `docs`, `refactor`, `build`, `chore`

## Code Style

- Use ES modules (`import`/`export`)
- No external runtime dependencies (extension must be self-contained)
- Follow existing patterns in the codebase

## Reporting Issues

- Use GitHub Issues
- Include browser version, extension version, and steps to reproduce
