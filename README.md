# FedLearn - Privacy-First E-Learning Platform

A modular, cloud-ready e-learning platform built with federated learning technology, React, Supabase, and designed for Azure integration.

## 🏗️ Architecture

This project follows a **modular, cloud-agnostic architecture** designed for scalability and easy cloud integration.

### Phase 1: Modular Structure ✅ COMPLETE

**Goal:** Reorganize codebase into modules, centralize configuration, and create Azure integration stubs.

**Implemented:**
- ✅ Centralized configuration (`src/config/`)
- ✅ Unified database client (`src/core/database/`)
- ✅ API abstraction layer (`src/core/api/`)
- ✅ Feature toggle system (`src/config/features.config.ts`)
- ✅ Modular services organization (`src/modules/`)
- ✅ Auth context refactoring (`src/core/auth/`)
- ✅ Azure API stubs for future integration

### Phase 2: Plugin System ✅ COMPLETE

**Goal:** Dynamic module loading, runtime feature toggles, and plugin management.

**Implemented:**
- ✅ Plugin Registry System (`src/core/plugins/plugin.registry.ts`)
- ✅ Feature Manager with persistence (`src/core/plugins/feature.manager.ts`)
- ✅ Plugin metadata and health monitoring
- ✅ Admin UI for plugin management (`src/components/admin/PluginManagement.tsx`)
- ✅ React hooks for plugin usage (`usePlugin`, `useFeature`)
- ✅ Runtime feature toggles with localStorage persistence
- ✅ Plugin dependency checking
- ✅ Export/Import configuration
- ✅ Category-based plugin organization

### Phase 3: Dashboard Enhancement ✅ COMPLETE

**Goal:** Real-time data visualization, functional AI, and bug fixes.

**Implemented:**
- ✅ **Interactive Charts** with Recharts library
  - Line charts for trend visualization
  - Bar charts for comparative metrics
  - Multi-line charts for comprehensive weekly overviews
- ✅ **Functional AI Tutor**
  - Fixed edge function integration
  - Proper fallback logic
  - Real-time chat interface
- ✅ **Enhanced Student Dashboard**
  - Weekly progress visualizations
  - Multi-metric performance tracking
  - Interactive learning path display
  - Achievement badge system
- ✅ **Enhanced Instructor Dashboard**
  - Student performance breakdown charts
  - Class engagement analytics
  - Real-time activity monitoring
  - Visual FL network status
- ✅ **Admin Dashboard Improvements**
  - FL network visualization
  - System health monitoring
  - Node management interface
- ✅ **Bug Fixes**
  - Fixed AI tutor edge function connectivity
  - Created fl-coordinator edge function
  - Improved data loading and error handling
  - Fixed chart rendering issues
  - Enhanced service layer robustness

### Phase 4: Azure Integration 📋 PLANNED

**Goal:** Full Azure cloud services integration.

**Planned:**
- Azure Functions integration
- Azure Blob Storage for files
- Azure OpenAI API integration
- Azure Monitor for logging
- Azure CDN for content delivery
- Azure Static Web Apps deployment

## 🚀 Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **Recharts** - Data visualization
- **React Router** - Navigation

### Backend
- **Supabase** - Authentication, Database, Edge Functions
- **PostgreSQL** - Relational database
- **Row Level Security (RLS)** - Data access control

### Cloud (Phase 4)
- **Azure Functions** - Serverless compute
- **Azure Blob Storage** - File storage
- **Azure OpenAI** - AI services
- **Azure Monitor** - Logging and monitoring
- **Azure CDN** - Content delivery

## 📂 Project Structure

```
src/
├── config/                     # Centralized configuration
│   ├── index.ts               # Main config exports
│   ├── supabase.config.ts     # Supabase settings
│   ├── azure.config.ts        # Azure endpoints (stubs)
│   ├── features.config.ts     # Feature flags
│   └── constants.ts           # App constants
│
├── core/                       # Core functionality
│   ├── database/              # Database abstraction
│   ├── api/                   # API abstraction (Supabase + Azure)
│   ├── auth/                  # Authentication
│   └── plugins/               # Plugin system (Phase 2)
│       ├── plugin.registry.ts # Plugin metadata & loading
│       ├── feature.manager.ts # Runtime feature toggles
│       └── index.ts
│
├── modules/                    # Feature modules
│   ├── student/               # Student functionality
│   ├── instructor/            # Instructor functionality
│   ├── admin/                 # Admin functionality
│   ├── ai-tutor/              # AI tutoring
│   ├── federated-learning/    # FL implementation
│   └── adaptive-learning/     # Adaptive learning engine
│
├── components/                 # Shared components
│   ├── ui/                    # shadcn/ui components
│   └── admin/                 # Admin-specific components
│       └── PluginManagement.tsx
│
├── shared/                     # Shared utilities
│   ├── hooks/                 # Custom hooks
│   │   ├── useFeature.ts      # Feature flag hook
│   │   └── usePlugin.ts       # Plugin loading hook
│   ├── utils/                 # Utility functions
│   └── types/                 # Shared types
│
└── pages/                      # Route pages
    ├── Index.tsx              # Landing page
    ├── LoginPage.tsx          # Authentication
    ├── AdminDashboard.tsx     # Admin dashboard
    └── NotFound.tsx           # 404 page
```

## 🎯 Feature Flags

Control which modules are enabled/disabled:

```typescript
// src/config/features.config.ts
export const FEATURES = {
  // Core features
  AI_TUTOR: true,
  FEDERATED_LEARNING: true,
  ADAPTIVE_LEARNING: true,
  
  // Dashboard features
  ANALYTICS_DASHBOARD: true,
  REAL_TIME_METRICS: true,
  PROGRESS_TRACKING: true,
  
  // Future features
  REAL_TIME_NOTIFICATIONS: false,
  AZURE_INTEGRATION: false,
  ADVANCED_ANALYTICS: false,
};
```

Use in components:
```typescript
import { useFeature } from '@/shared/hooks/useFeature';

const MyComponent = () => {
  const aiTutorEnabled = useFeature('AI_TUTOR');
  
  if (!aiTutorEnabled) return null;
  
  return <AITutorInterface />;
};
```

## 🔌 Plugin System (Phase 2)

### Plugin Registry
All modules are registered as plugins with metadata:

```typescript
{
  id: 'ai-tutor',
  name: 'AI Tutor',
  description: 'Intelligent AI-powered tutoring',
  version: '1.0.0',
  category: 'feature',
  featureFlag: 'AI_TUTOR',
  dependencies: [],
  azureServices: ['Azure OpenAI'],
  status: 'active',
  healthStatus: { isHealthy: true }
}
```

### Runtime Feature Toggles
Admins can enable/disable features at runtime:
- Toggle features from Admin Dashboard
- Changes persist in localStorage
- Automatic page reload on critical changes
- Export/import configurations

### Plugin Management UI
Accessible from Admin Dashboard → Plugin Management tab:
- View all plugins by category
- Toggle plugins on/off
- Check plugin health status
- View dependencies and Azure services
- Export/import feature configurations
- Reset to default settings

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account (for backend)

### Installation
```bash
# Clone repository
git clone <repo-url>

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev
```

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## 🚢 Deployment

### Current (Supabase)
```bash
# Build for production
npm run build

# Deploy edge functions
supabase functions deploy
```

### Future (Azure Static Web Apps)
```bash
# Build optimized bundle
npm run build

# Deploy to Azure
az staticwebapp deploy
```

## 📊 Cost Efficiency

### Current Costs
- **Supabase**: Free tier (500 MB database, 2 GB bandwidth)
- **Hosting**: Deploy on Vercel/Netlify (free tier)

### Planned Azure Costs (Phase 4)
- **Static Web Apps**: Free tier (100 GB bandwidth)
- **Functions**: 1M free executions/month
- **Blob Storage**: 5 GB free
- **OpenAI**: Pay-per-token (~$0.001/1K tokens)
- **CDN**: First 10 GB free

**Estimated Monthly Cost:** $5-15 for moderate usage

## 🔐 Security

### Implemented
- Row Level Security (RLS) on all tables
- User role-based access control (RBAC)
- Separate user_roles table (prevents privilege escalation)
- Server-side authentication validation
- Differential privacy for federated learning

### Database Security
```sql
-- Example RLS policy
CREATE POLICY "Users can view their own data"
ON student_progress
FOR SELECT
USING (student_id = auth.uid());
```

## 📚 Documentation

- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## 📝 License

MIT License - see LICENSE file for details

## 👥 Authors

FedLearn Team - Cloud Computing Course Project

## 🎓 Course Context

This project is part of a **Cloud Computing course**, focusing on:
- Modular cloud-ready architecture
- Scalability and cost efficiency
- Azure cloud services integration
- Real-world deployment scenarios
- Privacy-preserving federated learning

---

**Status:** Phase 3 Complete ✅ | Next: Phase 4 (Azure Integration)
