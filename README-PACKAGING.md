# Packaging for webOS TV

Prerequisites:

- Node.js and npm installed
- Install the webOS CLI (`ares-cli`):

```powershell
npm install -g ares-cli
```

- A webOS signing certificate / developer profile (follow LG webOS TV docs to create or install)

Package using the included script:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\package.ps1
```

This will produce a `.ipk` named using the `id` and `version` from `appinfo.json`.

If you prefer to use the `ares-package` command directly:

```powershell
ares-package . -o MyApp.ipk
```

See the webOS developer documentation for installing and signing packages on target devices.