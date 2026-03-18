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
  models: { id: string; name: string; remaining: number; resetTime?: string }[];
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

  if (!assistResponse.ok) {
    throw new Error('Failed to load code assist info. Ensure you have the Cloud AI Companion API enabled and the correct scopes.');
  }
  const assistData = await assistResponse.json();

  const projectId = typeof assistData.cloudaicompanionProject === 'string' 
    ? assistData.cloudaicompanionProject 
    : assistData.cloudaicompanionProject?.id;

  // 2. Fetch Available Models (Model-specific quotas)
  const modelsResponse = await fetch(`${BASE_URL}/v1internal:fetchAvailableModels`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'antigravity-web'
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
    models: Object.entries(modelsData.models || {}).map(([id, info]: [string, unknown]) => {
      const modelInfo = info as { displayName?: string; quotaInfo?: { remainingFraction: number; resetTime?: string } };
      return {
        id,
        name: modelInfo.displayName || id,
        remaining: (modelInfo.quotaInfo?.remainingFraction || 0) * 100,
        resetTime: modelInfo.quotaInfo?.resetTime
      };
    })
  };
}
