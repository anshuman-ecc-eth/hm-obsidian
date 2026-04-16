# Hyvmind Uploader

Upload Obsidian folders to [Hyvmind](https://hyvmind.app) ICP app as source graphs.

## Features

- **Internet Identity Authentication** - Secure login using Internet Identity with 8-hour session expiry
- **Folder Upload** - Right-click any folder to upload to Hyvmind as a source graph
- **Recursive Scanning** - Includes all subfolders and markdown files
- **Smart Mapping** - Converts folder structure to Hyvmind's graph format:
  - Root folder → Curation
  - Level 1 subfolders → Swarm (tagged "obsidian-import")
  - Level 2+ subfolders → Location
  - Markdown files → Law Entity + Interpretation Entity (with full content)
- **Batch Upload** - Automatically splits large payloads (>2MB) into manageable batches
- **Progress Tracking** - Real-time upload progress with status modal

## Installation

### From Obsidian Community Plugins (Coming Soon)

1. Open **Settings → Community Plugins**
2. Turn off **Safe Mode**
3. Click **Browse** and search for "Hyvmind Uploader"
4. Click **Install**
5. Enable the plugin

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/anshuman-ecc-eth/hm-obsidian/releases)
2. Create folder `VaultFolder/.obsidian/plugins/hyvmind-uploader/`
3. Copy the files to this folder
4. Enable the plugin in Obsidian settings

## Configuration

### Settings

Open **Settings → Hyvmind Uploader** to configure:

- **Canister ID** - The Hyvmind backend canister (default provided)
- **Identity Provider URL** - Internet Identity URL:
  - Mainnet: `https://id.ai`
  - Local: `http://id.ai.localhost:8000`
- **ICP Host** - Network endpoint:
  - Mainnet: `https://icp-api.io`
  - Local: `http://localhost:8000`
- **Display Name** - Your name for the Hyvmind user profile

Use the **Environment Presets** buttons to quickly switch between mainnet and local configurations.

## Usage

### Connect to ICP

1. Click the **cloud upload icon** in the left ribbon, or
2. Use command palette: **"Hyvmind Uploader: Connect to ICP"**
3. Complete Internet Identity authentication in the popup

### Upload a Folder

**Method 1 - Right-click:**
1. Right-click any folder in the file explorer
2. Select **"Upload to Hyvmind"**

**Method 2 - Command:**
1. Open any markdown file
2. Use command palette: **"Hyvmind Uploader: Upload current folder"**

### Disconnect

Use command palette: **"Hyvmind Uploader: Disconnect from ICP"**

## Status Bar

The status bar at the bottom shows:
- **🟢 Green** - Connected (shows truncated principal)
- **⚪ Gray** - Not connected

## Requirements

- Obsidian v0.15.0 or higher
- Internet Identity for authentication
- Connection to Internet Computer (mainnet or local)

## Development

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/anshuman-ecc-eth/hm-obsidian.git
   cd hm-obsidian
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the plugin:
   ```bash
   npm run build
   ```

4. For development with auto-rebuild:
   ```bash
   npm run dev
   ```

5. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugin folder

### Local Testing with ICP

1. Start local ICP network:
   ```bash
   icp network start -d
   ```

2. Deploy Hyvmind canister locally

3. Configure plugin to use local URLs:
   - Identity Provider: `http://id.ai.localhost:8000`
   - ICP Host: `http://localhost:8000`

## Architecture

```
src/
├── main.ts              # Plugin entry point
├── settings.ts          # Settings UI
├── icp/
│   ├── auth.ts         # Internet Identity auth
│   ├── agent.ts        # ICP agent/actor
│   └── uploader.ts     # Folder-to-graph conversion
├── ui/
│   └── status-bar.ts   # Connection indicator
└── types/
    └── canister.ts     # Candid types
```

## Tech Stack

- **Obsidian API** - Plugin framework
- **TypeScript** - Type-safe development
- **@icp-sdk/auth** - Internet Identity authentication
- **@icp-sdk/core** - ICP agent and actor
- **esbuild** - Build tooling

## License

MIT License - See [LICENSE](LICENSE) for details

## Support

- **Website**: [hyvmind.app](https://hyvmind.app)
- **Repository**: [github.com/anshuman-ecc-eth/hm-obsidian](https://github.com/anshuman-ecc-eth/hm-obsidian)

## Acknowledgments

Built for [Hyvmind](https://hyvmind.app) - Sanctuary tech for legal researchers
