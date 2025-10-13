# Contributing to Telegram Signal Mirror

Thank you for your interest in contributing to Telegram Signal Mirror! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and professional environment for all contributors.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with:

1. **Clear title** - Describe the issue concisely
2. **Description** - Detailed explanation of the problem
3. **Steps to reproduce** - How to recreate the issue
4. **Expected behavior** - What should happen
5. **Actual behavior** - What actually happens
6. **Environment details** - OS, Node.js version, app version, etc.
7. **Logs** - Include relevant log files if possible

### Suggesting Features

Feature requests are welcome! Please create an issue with:

1. **Use case** - Explain why this feature is needed
2. **Description** - Detailed explanation of the feature
3. **Examples** - Mock-ups, screenshots, or code examples if applicable
4. **Alternatives** - Other solutions you've considered

### Pull Requests

1. **Fork the repository** and create your branch from `master`
2. **Make your changes** with clear, descriptive commits
3. **Test thoroughly** - Ensure your changes don't break existing functionality
4. **Update documentation** - Update README.md if needed
5. **Submit pull request** with a clear description of changes

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/ibrxhim216/telegramsignalmirror.git
   cd telegramsignalmirror
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Telegram API credentials
   ```

4. Run in development mode:
   ```bash
   npm run dev
   ```

## Project Structure

```
telegram-signal-copier/
├── electron/              # Main process (Node.js backend)
│   ├── main.ts           # Application entry point
│   ├── preload.ts        # IPC bridge
│   ├── database.ts       # SQLite database
│   └── services/         # Backend services
│       ├── telegram.ts   # Telegram integration
│       ├── signalParser.ts # AI signal parser
│       ├── websocket.ts  # WebSocket server for EA
│       ├── accountService.ts # Trading account management
│       ├── licenseService.ts # License validation
│       └── ...
├── src/                  # Renderer process (React frontend)
│   ├── components/       # UI components
│   ├── store/           # State management (Zustand)
│   └── App.tsx          # Main app component
├── mt4-mt5/             # Expert Advisors for MT4/MT5
└── scripts/             # Helper scripts
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Define proper types and interfaces
- Avoid `any` type when possible
- Use meaningful variable and function names

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add comments for complex logic
- Keep functions small and focused
- Follow existing code patterns

### Commits

- Use clear, descriptive commit messages
- Start with a verb (Add, Fix, Update, Remove, etc.)
- Reference issue numbers when applicable

Example:
```
Add support for custom risk percentage per channel (#42)
Fix signal parsing for symbols with slashes (e.g., USD/JPY)
Update README with new environment variable setup
```

## Testing

Before submitting a PR:

1. **Run TypeScript checks**:
   ```bash
   npm run typecheck
   ```

2. **Run linter**:
   ```bash
   npm run lint
   ```

3. **Test manually**:
   - Connect to Telegram
   - Select channels
   - Test signal parsing with various formats
   - Verify EA connection
   - Test trade execution (use demo account!)

4. **Test builds**:
   ```bash
   npm run build:win  # or build:mac, build:linux
   ```

## Areas for Contribution

We especially welcome contributions in these areas:

- **Signal parsing improvements** - Handle more signal formats
- **Bug fixes** - Check open issues
- **Documentation** - Improve README, add guides
- **Testing** - Add unit tests
- **Performance** - Optimize slow operations
- **UI/UX** - Improve user interface and experience
- **Platform support** - Improve MT4/MT5/cTrader integration

## Questions?

If you have questions about contributing:

1. Check existing issues and documentation
2. Create a new issue with the "question" label
3. Be specific about what you need help with

## License

By contributing to Telegram Signal Mirror, you agree that your contributions will be licensed under the MIT License.

Thank you for contributing! 🎉
