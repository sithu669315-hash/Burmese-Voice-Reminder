export default function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    status: 'ok',
    platform: 'vercel-serverless',
    hasEnvKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
}
