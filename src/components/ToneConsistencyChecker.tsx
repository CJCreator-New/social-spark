import React, { useMemo } from "react";
import { Post } from "@/lib/calendarSchedule";

interface ToneAnalysis {
  formality: number; // 1-10: Formal to Casual
  positivity: number; // 1-10: Negative to Positive
  enthusiasm: number; // 1-10: Reserved to Enthusiastic
  consistency: number; // 1-10: How consistent across posts
  issues: string[];
  suggestions: string[];
}

interface ToneConsistencyCheckerProps {
  posts: Post[];
}

function analyzeTone(text: string): { formality: number; positivity: number; enthusiasm: number } {
  const lowerText = text.toLowerCase();

  // Formality indicators
  const formalWords = ["therefore", "furthermore", "consequently", "moreover", "hence", "thus", "accordingly", "subsequently"];
  const casualWords = ["hey", "guys", "kinda", "sorta", "wanna", "gonna", "ain't", "y'all", "cool", "awesome"];

  let formality = 5; // Baseline
  const formalCount = formalWords.filter(word => lowerText.includes(word)).length;
  const casualCount = casualWords.filter(word => lowerText.includes(word)).length;

  formality += formalCount * 1.5;
  formality -= casualCount * 1.2;

  // Positivity indicators
  const positiveWords = ["excellent", "amazing", "fantastic", "wonderful", "brilliant", "outstanding", "superb", "great", "good", "best"];
  const negativeWords = ["terrible", "awful", "horrible", "bad", "worst", "disappointing", "frustrating", "problematic", "issue"];

  let positivity = 5;
  const posCount = positiveWords.filter(word => lowerText.includes(word)).length;
  const negCount = negativeWords.filter(word => lowerText.includes(word)).length;

  positivity += posCount * 1.2;
  positivity -= negCount * 1.5;

  // Enthusiasm indicators
  const enthusiasticMarkers = ["!", "excited", "thrilled", "passionate", "love", "amazing", "incredible", "unbelievable"];
  let enthusiasm = 5;
  const exclamationCount = (text.match(/!/g) || []).length;
  const enthWordCount = enthusiasticMarkers.filter(marker => lowerText.includes(marker)).length;

  enthusiasm += exclamationCount * 0.5;
  enthusiasm += enthWordCount * 1.0;

  return {
    formality: Math.max(1, Math.min(10, Math.round(formality))),
    positivity: Math.max(1, Math.min(10, Math.round(positivity))),
    enthusiasm: Math.max(1, Math.min(10, Math.round(enthusiasm))),
  };
}

function calculateConsistency(analyses: { formality: number; positivity: number; enthusiasm: number }[]): number {
  if (analyses.length < 2) return 10;

  const avgFormality = analyses.reduce((sum, a) => sum + a.formality, 0) / analyses.length;
  const avgPositivity = analyses.reduce((sum, a) => sum + a.positivity, 0) / analyses.length;
  const avgEnthusiasm = analyses.reduce((sum, a) => sum + a.enthusiasm, 0) / analyses.length;

  const variances = analyses.map(a => (
    Math.abs(a.formality - avgFormality) +
    Math.abs(a.positivity - avgPositivity) +
    Math.abs(a.enthusiasm - avgEnthusiasm)
  ));

  const avgVariance = variances.reduce((sum, v) => sum + v, 0) / variances.length;

  // Lower variance = higher consistency
  const consistency = Math.max(1, 10 - avgVariance);
  return Math.round(consistency);
}

function generateIssuesAndSuggestions(analyses: { formality: number; positivity: number; enthusiasm: number }[]): { issues: string[]; suggestions: string[] } {
  const issues: string[] = [];
  const suggestions: string[] = [];

  const formalities = analyses.map(a => a.formality);
  const positivities = analyses.map(a => a.positivity);
  const enthusiasms = analyses.map(a => a.enthusiasm);

  const formalityRange = Math.max(...formalities) - Math.min(...formalities);
  const positivityRange = Math.max(...positivities) - Math.min(...positivities);
  const enthusiasmRange = Math.max(...enthusiasms) - Math.min(...enthusiasms);

  if (formalityRange > 4) {
    issues.push("Tone formality varies significantly across posts");
    suggestions.push("Standardize formality level - choose either consistently formal or consistently conversational");
  }

  if (positivityRange > 4) {
    issues.push("Emotional tone varies from very positive to negative");
    suggestions.push("Maintain consistent positivity level appropriate for your brand voice");
  }

  if (enthusiasmRange > 4) {
    issues.push("Enthusiasm levels fluctuate dramatically");
    suggestions.push("Calibrate excitement level to match your audience's expectations");
  }

  const avgFormality = formalities.reduce((sum, f) => sum + f, 0) / formalities.length;
  const avgPositivity = positivities.reduce((sum, p) => sum + p, 0) / positivities.length;
  const avgEnthusiasm = enthusiasms.reduce((sum, e) => sum + e, 0) / enthusiasms.length;

  if (avgFormality < 4) {
    suggestions.push("Consider slightly more professional language for B2B audiences");
  } else if (avgFormality > 7) {
    suggestions.push("Loosen up the language for more approachable, conversational tone");
  }

  if (avgPositivity < 4) {
    suggestions.push("Add more positive framing and optimistic language");
  } else if (avgPositivity > 8) {
    suggestions.push("Balance high positivity with realistic perspectives");
  }

  if (avgEnthusiasm < 4) {
    suggestions.push("Increase enthusiasm with exclamation points and energetic language");
  } else if (avgEnthusiasm > 8) {
    suggestions.push("Tone down excessive enthusiasm for more credible communication");
  }

  return { issues, suggestions };
}

export const ToneConsistencyChecker: React.FC<ToneConsistencyCheckerProps> = ({ posts }) => {
  const analysis = useMemo((): ToneAnalysis => {
    const postAnalyses = posts.map(post => {
      const fullText = `${post.title} ${post.hook} ${post.body} ${post.cta}`;
      return analyzeTone(fullText);
    });

    const consistency = calculateConsistency(postAnalyses);
    const { issues, suggestions } = generateIssuesAndSuggestions(postAnalyses);

    // Calculate averages
    const avgFormality = postAnalyses.reduce((sum, a) => sum + a.formality, 0) / postAnalyses.length;
    const avgPositivity = postAnalyses.reduce((sum, a) => sum + a.positivity, 0) / postAnalyses.length;
    const avgEnthusiasm = postAnalyses.reduce((sum, a) => sum + a.enthusiasm, 0) / postAnalyses.length;

    return {
      formality: Math.round(avgFormality),
      positivity: Math.round(avgPositivity),
      enthusiasm: Math.round(avgEnthusiasm),
      consistency,
      issues,
      suggestions,
    };
  }, [posts]);

  if (posts.length < 2) return null;

  return (
    <div className="tone-consistency-card">
      <div className="tc-header">
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Tone Consistency Analysis</h3>
        <div className="tc-overall">
          <div
            className="tc-score-ring"
            style={{
              background: `conic-gradient(var(--accent) 0deg ${analysis.consistency * 36}deg, var(--border2) ${analysis.consistency * 36}deg)`,
            }}
          >
            <div className="tc-score-inner">{analysis.consistency}</div>
          </div>
          <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 500 }}>
            {analysis.consistency >= 8 ? "Excellent" : analysis.consistency >= 6 ? "Good" : "Needs Work"}
          </span>
        </div>
      </div>

      <div className="tc-metrics">
        <div className="tc-metric">
          <span className="tc-metric-label">Formality</span>
          <span className="tc-metric-value">{analysis.formality}/10</span>
        </div>
        <div className="tc-metric">
          <span className="tc-metric-label">Positivity</span>
          <span className="tc-metric-value">{analysis.positivity}/10</span>
        </div>
        <div className="tc-metric">
          <span className="tc-metric-label">Enthusiasm</span>
          <span className="tc-metric-value">{analysis.enthusiasm}/10</span>
        </div>
      </div>

      {analysis.issues.length > 0 && (
        <div className="tc-issues">
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", marginBottom: 6 }}>
            Issues to Address:
          </div>
          {analysis.issues.map((issue, i) => (
            <div key={i} className="tc-issue">⚠️ {issue}</div>
          ))}
        </div>
      )}

      {analysis.suggestions.length > 0 && (
        <div className="tc-suggestions">
          <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text2)", marginBottom: 6 }}>
            Suggestions:
          </div>
          {analysis.suggestions.map((suggestion, i) => (
            <div key={i} className="tc-suggestion">💡 {suggestion}</div>
          ))}
        </div>
      )}
    </div>
  );
};</content>
<parameter name="filePath">C:\Users\HP\OneDrive\Desktop\Projects\VS Code\social-spark\src\components\ToneConsistencyChecker.tsx