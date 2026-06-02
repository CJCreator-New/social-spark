
import fs from 'fs';
import path from 'path';

/**
 * Prompt Evals Harness
 * Runs a set of briefs through generate-calendar and saves results for inspection.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://mbxlvsftyifovbkpsvyw.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

const BRIEFS = [
  {
    id: "tech-b2b",
    industry: "SaaS / Cloud Infrastructure",
    coreIdea: "Why scaling Kubernetes is harder than it looks",
    audiences: ["DevOps Engineers", "CTOs"],
    voice: "Authoritative but accessible",
    style: "Educational & Data-driven",
    platform: "LinkedIn"
  },
  {
    id: "lifestyle-coaching",
    industry: "Personal Development",
    coreIdea: "Digital detox: 3 ways to stay focused in a noisy world",
    audiences: ["Remote Workers", "Busy Parents"],
    voice: "Empathetic & Encouraging",
    style: "Storytelling",
    platform: "Instagram"
  },
  {
    id: "finance-news",
    industry: "FinTech / Crypto",
    coreIdea: "Wait-and-see as the Fed pauses rates",
    audiences: ["Retail Investors", "Financial Advisors"],
    voice: "Analytical",
    style: "News Flash",
    platform: "X / Twitter"
  }
];

async function runEval() {
  console.log("🚀 Starting Prompt Evaluation...");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const resultsDir = path.join(process.cwd(), "evals");
  
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir);
  }

  const output: any[] = [];

  for (const brief of BRIEFS) {
    for (const quality of ["draft", "polished"] as const) {
      console.log(`  [${brief.id}] Running ${quality} tier...`);
      
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-calendar`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`
          },
          body: JSON.stringify({
            ...brief,
            quality,
            length: "medium",
            structure: "mixed",
            topics: [], // Allow model to infer or use pre-call logic
            bannedHashtags: [],
            requiredHashtags: []
          })
        });

        if (!res.ok) {
          const error = await res.text();
          console.error(`    ❌ Failed: ${res.status} ${error}`);
          continue;
        }

        const data = await res.json();
        output.push({
          brief_id: brief.id,
          quality,
          timestamp: new Date().toISOString(),
          payload: brief,
          response: data
        });
      } catch (e) {
        console.error(`    ❌ Request error:`, e);
      }
    }
  }

  const outputPath = path.join(resultsDir, `eval-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Eval complete! Results saved to: ${outputPath}`);
}

runEval();
