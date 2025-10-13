/**
 * Vision AI Configuration
 *
 * Types for chart image analysis using Claude's vision capabilities
 */

export interface ChartImage {
  messageId: string
  channelId: number
  imageBuffer: Buffer
  mimeType: string
  width?: number
  height?: number
  fileSize: number
  downloadedAt: string
}

export interface ChartAnalysisRequest {
  image: ChartImage
  symbol?: string
  timeframe?: string
  existingSignal?: any // Optional parsed signal to enhance
}

export interface TrendAnalysis {
  direction: 'bullish' | 'bearish' | 'neutral' | 'ranging'
  strength: 'strong' | 'moderate' | 'weak'
  confidence: number // 0-100
  reasoning: string
}

export interface SupportResistance {
  type: 'support' | 'resistance'
  level: number
  strength: 'major' | 'minor'
  tested: number // How many times tested
  description: string
}

export interface TechnicalIndicators {
  detected: string[] // e.g., ["RSI", "MACD", "Moving Averages"]
  signals: {
    indicator: string
    signal: 'buy' | 'sell' | 'neutral'
    value?: string
    interpretation: string
  }[]
}

export interface PatternRecognition {
  patterns: {
    name: string // e.g., "Head and Shoulders", "Double Top"
    type: 'continuation' | 'reversal' | 'neutral'
    confidence: number // 0-100
    implication: 'bullish' | 'bearish' | 'neutral'
    description: string
  }[]
}

export interface PriceAction {
  currentPrice?: number
  priceMovement: string // e.g., "Breaking above resistance"
  momentum: 'increasing' | 'decreasing' | 'stable'
  volatility: 'high' | 'medium' | 'low'
  keyObservations: string[]
}

export interface TradingRecommendation {
  action: 'buy' | 'sell' | 'hold' | 'wait'
  confidence: number // 0-100
  entryZone?: {
    min: number
    max: number
  }
  stopLoss?: number
  takeProfit?: number[]
  reasoning: string
  riskLevel: 'low' | 'medium' | 'high'
  timeframe?: string
}

export interface ChartAnalysisResult {
  success: boolean
  error?: string

  // Analysis timestamp
  analyzedAt: string
  processingTime: number // milliseconds

  // Image metadata
  image: {
    messageId: string
    channelId: number
    fileSize: number
  }

  // Extracted information
  symbol?: string
  timeframe?: string

  // AI Analysis
  trend: TrendAnalysis
  supportResistance: SupportResistance[]
  indicators: TechnicalIndicators
  patterns: PatternRecognition
  priceAction: PriceAction
  recommendation: TradingRecommendation

  // Raw AI response
  rawAnalysis: string

  // Enhanced signal (if original signal provided)
  enhancedSignal?: any
}

export interface VisionAISettings {
  enabled: boolean

  // API Configuration
  apiKey: string // Anthropic API key
  model: 'claude-3-opus' | 'claude-3-sonnet' | 'claude-3-haiku'
  maxTokens: number
  temperature: number

  // Processing options
  autoAnalyze: boolean // Automatically analyze charts in signals
  saveAnalysis: boolean // Store analysis results
  enhanceSignals: boolean // Add AI insights to parsed signals

  // Image handling
  maxImageSize: number // bytes
  allowedFormats: string[] // ["image/jpeg", "image/png"]

  // Analysis options
  includeTrend: boolean
  includeSupportResistance: boolean
  includeIndicators: boolean
  includePatterns: boolean
  includePriceAction: boolean
  includeRecommendation: boolean

  // Prompt customization
  customInstructions?: string
  focusAreas?: string[] // e.g., ["price action", "key levels"]

  // Rate limiting
  maxRequestsPerMinute: number
  maxRequestsPerDay: number
}

export const DEFAULT_VISION_SETTINGS: VisionAISettings = {
  enabled: false,

  apiKey: '',
  model: 'claude-3-sonnet',
  maxTokens: 2000,
  temperature: 0.3,

  autoAnalyze: true,
  saveAnalysis: true,
  enhanceSignals: true,

  maxImageSize: 5 * 1024 * 1024, // 5MB
  allowedFormats: ['image/jpeg', 'image/png', 'image/jpg'],

  includeTrend: true,
  includeSupportResistance: true,
  includeIndicators: true,
  includePatterns: true,
  includePriceAction: true,
  includeRecommendation: true,

  maxRequestsPerMinute: 10,
  maxRequestsPerDay: 500,
}

export interface VisionAIStats {
  totalAnalyses: number
  successfulAnalyses: number
  failedAnalyses: number
  averageProcessingTime: number // milliseconds

  // Rate limiting
  requestsThisMinute: number
  requestsToday: number
  lastResetMinute: string
  lastResetDay: string

  // Costs (approximate)
  estimatedCost: number // in USD
  tokensUsed: number
}

export const VISION_SYSTEM_PROMPT = `You are an expert trading chart analyst. Analyze the provided trading chart image and extract detailed technical analysis.

Your analysis should include:

1. **Trend Analysis**: Determine the overall trend (bullish/bearish/neutral/ranging), its strength, and confidence level.

2. **Support & Resistance Levels**: Identify key support and resistance levels visible on the chart, their strength, and how many times they've been tested.

3. **Technical Indicators**: Identify any technical indicators visible on the chart (RSI, MACD, Moving Averages, etc.) and interpret their signals.

4. **Chart Patterns**: Recognize any chart patterns (Head & Shoulders, Double Top/Bottom, Triangles, Flags, etc.) and explain their implications.

5. **Price Action**: Describe current price movement, momentum, volatility, and key observations about price behavior.

6. **Trading Recommendation**: Based on the analysis, provide a trading recommendation with entry zones, stop loss, take profit levels, and reasoning.

Provide your analysis in a structured JSON format with clear, actionable insights. Be specific with price levels when possible. Rate your confidence for each finding.`

export const VISION_ANALYSIS_PROMPT = (symbol?: string, timeframe?: string) => `
${VISION_SYSTEM_PROMPT}

${symbol ? `Symbol: ${symbol}` : 'Symbol: Not specified'}
${timeframe ? `Timeframe: ${timeframe}` : 'Timeframe: Not specified'}

Analyze this chart and return your findings in JSON format with the following structure:
{
  "trend": {
    "direction": "bullish|bearish|neutral|ranging",
    "strength": "strong|moderate|weak",
    "confidence": 0-100,
    "reasoning": "explanation"
  },
  "supportResistance": [
    {
      "type": "support|resistance",
      "level": number,
      "strength": "major|minor",
      "tested": number,
      "description": "explanation"
    }
  ],
  "indicators": {
    "detected": ["indicator names"],
    "signals": [
      {
        "indicator": "name",
        "signal": "buy|sell|neutral",
        "value": "current value",
        "interpretation": "explanation"
      }
    ]
  },
  "patterns": {
    "patterns": [
      {
        "name": "pattern name",
        "type": "continuation|reversal|neutral",
        "confidence": 0-100,
        "implication": "bullish|bearish|neutral",
        "description": "explanation"
      }
    ]
  },
  "priceAction": {
    "currentPrice": number,
    "priceMovement": "description",
    "momentum": "increasing|decreasing|stable",
    "volatility": "high|medium|low",
    "keyObservations": ["observation1", "observation2"]
  },
  "recommendation": {
    "action": "buy|sell|hold|wait",
    "confidence": 0-100,
    "entryZone": { "min": number, "max": number },
    "stopLoss": number,
    "takeProfit": [number, number],
    "reasoning": "explanation",
    "riskLevel": "low|medium|high",
    "timeframe": "suggested timeframe"
  }
}

Focus on actionable insights and specific price levels. Be conservative with confidence ratings.
`.trim()
