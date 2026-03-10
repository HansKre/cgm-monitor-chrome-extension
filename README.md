# LibreView Glucose Monitor Chrome Extension

**LibreView Glucose Monitor** – A Chrome extension for FreeStyle Libre users that provides real-time blood glucose monitoring with interactive visualizations and intelligent trend analysis directly in your browser. [Install it from the Chrome Web Store](https://chromewebstore.google.com/detail/libreview-glucose-monitor/emfglagmlmkbmoacmidocogloijnkmma).

---

## ⚠️ Important Disclaimer

This project is **not affiliated with Abbott Laboratories** or the official FreeStyle Libre product line.  
**Use at your own risk.** Data accuracy may vary. Always follow guidance from your healthcare provider. This extension is for informational purposes only and should not replace professional medical advice, diagnosis, or treatment.

---

## ✨ Key Features

### 🎯 Real-Time Monitoring

- **Dynamic browser icon** displaying current glucose value with color-coded ranges
- **Automatic updates** every minute via Chrome's alarm system
- **Persistent background monitoring** across browser sessions

### 📊 Interactive Visualizations

- **Advanced glucose charts** powered by Recharts with smooth animations
- **60-minute trend projections** using linear regression analysis
- **Color-coded glucose zones** with medical range indicators:
  - 🟢 Normal (100-155 mg/dL)
  - 🟠 Elevated (156-189 mg/dL)
  - 🔴 Low/High (70-99, 190-249 mg/dL)
  - ⚫ Very Low/Very High (<70, 250+ mg/dL)

### 🔒 Secure Data Management

- **Encrypted credential storage** using Chrome Storage API
- **Automatic token refresh** to maintain connection
- **HTTPS-only API communication** with LibreView servers

### 🎨 Professional Interface

- **Modern React 19 interface** with responsive design
- **Sequential chart animations** (actual data → projections)
- **Centralized configuration system** for consistent styling
- **Dark mode compatibility** with proper theming

---

## 🚀 Installation

### From Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store listing](https://chrome.google.com/webstore) (coming soon)
2. Click "Add to Chrome"
3. Follow the installation prompts

### Manual Installation (Development)

1. **Clone the repository:**

   ```bash
   git clone https://github.com/HansKre/libreview-monitor.git
   cd libreview-monitor
   pnpm install
   ```

2. **Build the extension:**

   ```bash
   pnpm run build
   ```

3. **Load in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from your project

4. **Initial Setup:**
   - Click the extension icon in your browser toolbar
   - Enter your LibreView credentials (same as FreeStyle LibreLink app)
   - Click "Save" and wait for initial data sync
   - The browser icon will update with your current glucose value

## 🔧 Development

### Build Commands

```bash
# Build extension for production
pnpm run build:extension

# Build extension with development mode and file watching
pnpm run build:extension:dev

# Lint TypeScript/TSX files
pnpm run lint

# Auto-fix linting issues
pnpm run lint:fix
```

### Architecture Overview

- **Service Worker** (`background.ts`) - Handles API calls, data persistence, and icon updates
- **React Popup** (`popup.tsx`) - Interactive chart interface with glucose projections
- **Type Safety** - Full TypeScript coverage with shared interfaces
- **Chrome APIs** - Storage, Alarms, and Action APIs for reliable functionality

### Technical Stack

- **Frontend**: React 19, TypeScript, Recharts
- **Build**: Webpack 5 with Chrome Extension optimization
- **APIs**: LibreView REST API integration
- **Storage**: Chrome Storage API with encryption

## 🔐 Privacy & Security

- **No data collection**: Your glucose data stays on your device and goes directly to LibreView
- **Secure storage**: Credentials encrypted using Chrome's built-in storage APIs
- **HTTPS only**: All API communications use secure connections
- **No tracking**: Extension doesn't track usage or personal information
- **Open source**: Full source code available for security review

## 🤝 Contributing

Contributions are welcome! Please feel free to:

1. **Report Issues**: Open GitHub issues for bugs or feature requests
2. **Submit PRs**: Fork the repo and submit pull requests
3. **Improve Documentation**: Help make setup and usage clearer
4. **Add Features**: Enhance the glucose monitoring experience

### Development Setup

```bash
git clone https://github.com/HansKre/libreview-monitor.git
cd libreview-monitor
pnpm install
pnpm run watch  # Builds with file watching
```

## 📊 How It Works

### Data Flow

1. **Authentication**: Secure login to LibreView API using your FreeStyle LibreLink credentials
2. **Data Fetching**: Background service worker fetches glucose data every minute
3. **Icon Updates**: Browser icon updates with current glucose value and color coding
4. **Trend Analysis**: Linear regression calculates 60-minute glucose projections
5. **Visualization**: Interactive charts display actual and projected glucose trends

### Glucose Projection Algorithm

- Analyzes the last 30 minutes of glucose data
- Uses simple linear regression for trend calculation
- Generates 5-minute interval projections up to 60 minutes ahead
- Applies conservative bounds (40-400 mg/dL) for medical safety

## 🆘 Support & FAQ

**Q: My glucose data isn't updating**

- Verify your LibreView credentials are correct
- Check that you have an active FreeStyle Libre sensor
- Ensure the extension has permission to access LibreView API

**Q: The browser icon shows "?" or is blank**

- This indicates no recent glucose data or connection issues
- Try refreshing your credentials in the extension settings
- Check your internet connection

**Q: Are my credentials safe?**

- Yes, credentials are encrypted and stored locally using Chrome's secure storage
- The extension only communicates with official LibreView servers
- No third-party services have access to your data

## Releasing

### Prepare extension

- update version in `manifest.json`
- run `pnpm run release`

### Upload to Chrome Web Store

- Login to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- Click the GitHub UI Booster extension
- Go to Build > Package
- Click "Upload new package"
- Drag and drop the zip file into the dialog
- Click "Submit for review"

### Update screenshot

- take screenshot and right-click > Open with > GIMP
- CMD+A, CMD+C
- CMD + N to create a new file
- dimensions: 1280x800
- SHIFT+B, choose black and colorize the layer in black
- CMD+V
- SHIFT+S for the Resize Tool
- CMD+two-fingers to zoom out
- resize the pasted image as needed
- SHIFT+CMD+E to export

## 📖 API References

- [LibreView API Documentation](https://gist.github.com/khskekec/6c13ba01b10d3018d816706a32ae8ab2)
- [Unofficial LibreView API Guide](https://libreview-unofficial.stoplight.io/docs/libreview-unofficial/4503bd234db99-get-logbook)

## 📄 License

ISC License - see [LICENSE](LICENSE) for details.

---

**Made with ❤️ for the diabetes community**

_Remember: This tool is meant to complement, not replace, your regular glucose monitoring routine and medical care._
