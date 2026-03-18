# Implementation Guide: Google Antigravity Usage Tracker

This guide provides a comprehensive implementation for a Next.js application that tracks Google Antigravity (Gemini Code Assist) usage.

## 1. Prerequisites

### Google Cloud Console Setup
1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/).
2. Configure the **OAuth Consent Screen**:
   - Add scopes: `.../auth/cloud-platform` and `.../auth/userinfo.email`.
3. Create **OAuth 2.0 Client IDs**:
   - Application type: Web application.
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`.
4. Enable the **Cloud AI Companion API** (if available in your region/org).

## 2. Environment Variables

Create a `.env.local` file:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
NEXTAUTH_SECRET=your_random_secret
NEXTAUTH_URL=http://localhost:3000
```

## 3. Authentication (NextAuth.js)

Install dependencies: `npm install next-auth`

Configure `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email https://www.googleapis.com/auth/cloud-platform",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
});

export { handler as GET, handler as POST };
```

## 4. API Client Implementation

Create `src/lib/antigravity.ts`:

```typescript
const BASE_URL = 'https://cloudcode-pa.googleapis.com';

const METADATA = {
  ideType: 'ANTIGRAVITY',
  platform: 'PLATFORM_UNSPECIFIED',
  pluginType: 'GEMINI'
};

export interface QuotaData {
  promptCredits: {
    monthly: number;
    available: number;
    used: number;
    percentage: number;
  };
  models: any[];
}

export async function fetchAntigravityQuota(accessToken: string): Promise<QuotaData> {
  // 1. Load Code Assist Info (Credits & Project ID)
  const assistResponse = await fetch(`${BASE_URL}/v1internal:loadCodeAssist`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'antigravity-web'
    },
    body: JSON.stringify({ metadata: METADATA })
  });

  if (!assistResponse.ok) throw new Error('Failed to load code assist info');
  const assistData = await assistResponse.json();

  const projectId = typeof assistData.cloudaicompanionProject === 'string' 
    ? assistData.cloudaicompanionProject 
    : assistData.cloudaicompanionProject?.id;

  // 2. Fetch Available Models (Model-specific quotas)
  const modelsResponse = await fetch(`${BASE_URL}/v1internal:fetchAvailableModels`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ project: projectId })
  });

  const modelsData = modelsResponse.ok ? await modelsResponse.json() : { models: {} };

  // 3. Parse and Calculate
  const monthly = assistData.planInfo?.monthlyPromptCredits || 0;
  const available = assistData.availablePromptCredits || 0;
  const used = monthly - available;

  return {
    promptCredits: {
      monthly,
      available,
      used,
      percentage: monthly > 0 ? (used / monthly) * 100 : 0
    },
    models: Object.entries(modelsData.models || {}).map(([id, info]: [string, any]) => ({
      id,
      name: info.displayName || id,
      remaining: info.quotaInfo?.remainingFraction * 100 || 0,
      resetTime: info.quotaInfo?.resetTime
    }))
  };
}
```

## 5. Frontend Implementation

Create `src/app/dashboard/page.tsx`:

```tsx
'use client';
import { useSession, signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { QuotaData } from "@/lib/antigravity";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [quota, setQuota] = useState<QuotaData | null>(null);

  useEffect(() => {
    if (session?.accessToken) {
      fetch('/api/quota')
        .then(res => res.json())
        .then(data => setQuota(data));
    }
  }, [session]);

  if (status === "loading") return <p>Loading...</p>;
  if (!session) return <button onClick={() => signIn("google")}>Login with Google</button>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Antigravity Usage</h1>
      
      {quota && (
        <div className="grid gap-6">
          <div className="p-4 border rounded shadow">
            <h2 className="text-xl font-semibold">Prompt Credits</h2>
            <p>Used: {quota.promptCredits.used} / {quota.promptCredits.monthly}</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${quota.promptCredits.percentage}%` }}
              ></div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2">Model Quotas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quota.models.map(model => (
                <div key={model.id} className="p-4 border rounded">
                  <p className="font-medium">{model.name}</p>
                  <p className="text-sm text-gray-600">Remaining: {model.remaining.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

## 6. API Route for Data Fetching

Create `src/app/api/quota/route.ts`:

```typescript
import { getServerSession } from "next-auth/next";
import { fetchAntigravityQuota } from "@/lib/antigravity";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession();
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await fetchAntigravityQuota(session.accessToken as string);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch quota" }, { status: 500 });
  }
}
```

## Key API Endpoints Summary

| Feature | Endpoint | Method | Purpose |
| :--- | :--- | :--- | :--- |
| **Auth** | `https://accounts.google.com/o/oauth2/v2/auth` | GET | Initiates OAuth flow |
| **Tokens** | `https://oauth2.googleapis.com/token` | POST | Exchanges code for access token |
| **Plan Info** | `/v1internal:loadCodeAssist` | POST | Gets prompt credits and project ID |
| **Model Info**| `/v1internal:fetchAvailableModels` | POST | Gets specific model remaining usage |
| **Onboarding**| `/v1internal:onboardUser` | POST | Initiates project creation if missing |

## Important Considerations
1. **User Agent:** Always set a custom `User-Agent` (e.g., `antigravity`) as some Google APIs use it for tracking/permissions.
2. **Scopes:** Ensure `https://www.googleapis.com/auth/cloud-platform` is requested, as the `v1internal` endpoints are part of the Cloud Code/Companion ecosystem.
3. **Internal Endpoints:** Note that `v1internal` endpoints are used by the official extensions and may be subject to change. Always include the `metadata` object in your requests.
