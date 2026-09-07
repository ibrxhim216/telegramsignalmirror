# Telegram Signal Mirror 1.0.10

## Improved
- The Windows exe now carries the TSM icon and the app's own version/product info (taskbar, installer, Programs list). This needed `build.win.signAndEditExecutable` back on; electron-builder's winCodeSign cache is seeded manually on this machine because the archive's macOS symlinks cannot be extracted without admin rights (see memory: deploy_process).
