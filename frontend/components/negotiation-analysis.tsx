"use client";

import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';

interface AnalysisResult {
  score: number;
  text: string;
}

interface NegotiationAnalysisProps {
  goal: string;
  analysisResults: AnalysisResult[];
}

export function NegotiationAnalysis({ goal, analysisResults }: NegotiationAnalysisProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Conversation Goal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{goal}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analysisResults.slice(0, 3).map((result, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{result.text}</span>
                  <span className="font-medium">{Math.round(result.score * 100)}%</span>
                </div>
                <Progress value={result.score * 100} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 