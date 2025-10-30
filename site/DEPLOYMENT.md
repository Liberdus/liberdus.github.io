# Liberdus Website + Documentation Deployment Guide

This repository contains both the main Liberdus website and integrated Docusaurus documentation, configured for seamless Vercel deployment.

## 🏗️ Project Structure

```
liberdus-modern/
├── index.html              # Main website homepage
├── src/                    # Main website assets
├── docs/                   # Docusaurus documentation
│   ├── docs/              # Documentation content
│   ├── docusaurus.config.ts
│   └── package.json
├── package.json           # Root package.json with scripts
└── vercel.json           # Vercel deployment config
```

## 🚀 Deployment Options

### Option 1: Vercel (Recommended)

#### Single Domain Deployment
Your site will be accessible as:
- **Main Website**: `https://liberdus.com/`
- **Documentation**: `https://liberdus.com/docs/`

#### Quick Deploy Steps:

1. **Connect Repository to Vercel**:
   ```bash
   # If using Vercel CLI
   vercel --prod
   
   # Or connect via Vercel Dashboard
   # Import Git Repository → Select this repo
   ```

2. **Automatic Build Process**:
   - Vercel will automatically detect the configuration
   - Main website serves from root (`/`)
   - Documentation builds and serves from `/docs/`

3. **Environment Variables** (if needed):
   ```bash
   # In Vercel Dashboard → Settings → Environment Variables
   NODE_VERSION=18.x
   ```

#### Custom Domain Setup:
1. In Vercel Dashboard → Settings → Domains
2. Add your domain: `liberdus.com`
3. Configure DNS records as instructed

### Option 2: Separate Deployments

If you prefer to deploy documentation separately:

#### Main Website (Vercel/Netlify/GitHub Pages)
```bash
# Deploy only main website files
# Exclude docs/ folder in deployment settings
```

#### Documentation (Vercel/Netlify)
```bash
cd docs
npm install
npm run build
# Deploy build/ folder
```

## 🛠️ Development Workflow

### Local Development

#### Main Website:
```bash
# Start main website (Python server)
npm run dev
# Visits: http://localhost:3000
```

#### Documentation:
```bash
# Start docs development server
npm run docs:dev
# Visits: http://localhost:3001/docs/
```

#### Both Together:
```bash
# Terminal 1: Main website
npm run dev

# Terminal 2: Documentation  
npm run docs:dev
```

### Build Process

#### Build Documentation Only:
```bash
npm run docs:build
```

#### Build Everything:
```bash
npm run build
```

## 📁 Available Scripts

```json
{
  "dev": "python3 -m http.server 3000",           // Main website dev
  "start": "python3 -m http.server 3000",         // Main website start
  "serve": "python3 -m http.server 8000",         // Main website serve
  "build": "cd docs && npm run build && cd ..",    // Build docs
  "docs:dev": "cd docs && npm start",             // Docs development  
  "docs:build": "cd docs && npm run build",       // Build docs only
  "docs:serve": "cd docs && npm run serve"        // Serve built docs
}
```

## ⚙️ Vercel Configuration Explained

The `vercel.json` handles:

1. **Dual Build Process**:
   - Static website files served directly
   - Docusaurus app built and served from `/docs/`

2. **Smart Routing**:
   - `/docs/*` → Documentation  
   - `/*` → Main website
   - Static assets cached with long expiry

3. **Performance Optimization**:
   - Automatic asset caching
   - Clean URLs enabled
   - Trailing slash normalization

## 🔧 Configuration Files

### `vercel.json` - Deployment Configuration
```json
{
  "builds": [
    {
      "src": "docs/package.json",
      "use": "@vercel/static-build"
    }
  ],
  "routes": [
    {
      "src": "/docs(?:/(.*))?",
      "dest": "/docs/build/$1"
    }
  ]
}
```

### `docs/docusaurus.config.ts` - Documentation Config
```typescript
{
  url: 'https://liberdus.com',
  baseUrl: '/docs/',  // Serves from /docs/ path
}
```

## 🌐 URL Structure

After deployment:

| Path | Content | Example |
|------|---------|---------|
| `/` | Main website homepage | `liberdus.com/` |
| `/docs/` | Documentation homepage | `liberdus.com/docs/` |
| `/docs/getting-started/quick-start` | Quick start guide | `liberdus.com/docs/getting-started/quick-start` |
| `/docs/api/overview` | API documentation | `liberdus.com/docs/api/overview` |

## 🚨 Troubleshooting

### Common Issues:

1. **Documentation 404 errors**:
   - Check `baseUrl: '/docs/'` in `docusaurus.config.ts`
   - Verify Vercel routing in `vercel.json`

2. **Build failures**:
   ```bash
   cd docs && npm install  # Install missing dependencies
   npm run docs:build      # Test build locally
   ```

3. **Asset loading issues**:
   - Check asset paths in main website
   - Verify static file routing in `vercel.json`

### Debug Commands:
```bash
# Test documentation build locally
cd docs && npm run build && npm run serve

# Test main website locally  
npm run dev

# Check Vercel deployment logs
vercel logs --follow
```

## 📈 Performance Optimization

1. **Asset Caching**: Static assets cached for 1 year
2. **Build Optimization**: Docusaurus optimizes bundle splitting
3. **CDN Distribution**: Vercel's global CDN
4. **Image Optimization**: Use Vercel's image optimization for main website

## 🔄 Continuous Deployment

Every push to `main` branch will:
1. Trigger Vercel rebuild
2. Build documentation automatically  
3. Deploy both website and docs
4. Update live site instantly

## 📞 Support

For deployment issues:
- Check [Vercel Documentation](https://vercel.com/docs)
- Review [Docusaurus Deployment Guide](https://docusaurus.io/docs/deployment)
- Open an issue in this repository

---

**Ready to deploy? Push to main branch and watch the magic happen!** ✨