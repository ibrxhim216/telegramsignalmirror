/**
 * Vision AI Service
 *
 * Analyzes trading chart images using Claude's vision capabilities
 */

import { EventEmitter } from 'events'
import Anthropic from '@anthropic-ai/sdk'
import {
  ChartAnalysisRequest,
  ChartAnalysisResult,
  VisionAISettings,
  VisionAIStats,
  DEFAULT_VISION_SETTINGS,
  VISION_ANALYSIS_PROMPT,
  TrendAnalysis,
  SupportResistance,
  TechnicalIndicators,
  PatternRecognition,
  PriceAction,
  TradingRecommendation,
} from '../types/visionConfig'
import { logger } from '../utils/logger'

export class VisionAIService extends EventEmitter {
  private settings: VisionAISettings
  private stats: VisionAIStats
  private anthropic: Anthropic | null = null

  constructor() {
    super()
    this.settings = { ...DEFAULT_VISION_SETTINGS }
    this.stats = this.initializeStats()
  }

  private initializeStats(): VisionAIStats {
    return {
      totalAnalyses: 0,
      successfulAnalyses: 0,
      failedAnalyses: 0,
      averageProcessingTime: 0,
      requestsThisMinute: 0,
      requestsToday: 0,
      lastResetMinute: new Date().toISOString(),
      lastResetDay: new Date().toISOString(),
      estimatedCost: 0,
      tokensUsed: 0,
    }
  }

  /**
   * Initialize Anthropic client with API key
   */
  private initializeClient() {
    if (!this.settings.apiKey) {
      throw new Error('Vision AI API key not configured')
    }

    if (!this.anthropic) {
      this.anthropic = new Anthropic({
        apiKey: this.settings.apiKey,
      })
      logger.info('Vision AI client initialized')
    }
  }

  /**
   * Update settings
   */
  updateSettings(newSettings: Partial<VisionAISettings>) {
    this.settings = { ...this.settings, ...newSettings }

    // Reinitialize client if API key changed
    if (newSettings.apiKey) {
      this.anthropic = null
      this.initializeClient()
    }

    logger.info('Vision AI settings updated')
    this.emit('settingsUpdated', this.settings)
  }

  /**
   * Get current settings
   */
  getSettings(): VisionAISettings {
    return { ...this.settings }
  }

  /**
   * Get statistics
   */
  getStats(): VisionAIStats {
    return { ...this.stats }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = this.initializeStats()
    logger.info('Vision AI stats reset')
    this.emit('statsReset')
  }

  /**
   * Check if Vision AI is enabled and configured
   */
  isEnabled(): boolean {
    return this.settings.enabled && !!this.settings.apiKey
  }

  /**
   * Check rate limits
   */
  private checkRateLimits(): { allowed: boolean; reason?: string } {
    const now = new Date()

    // Reset minute counter if needed
    const lastMinute = new Date(this.stats.lastResetMinute)
    if (now.getTime() - lastMinute.getTime() > 60000) {
      this.stats.requestsThisMinute = 0
      this.stats.lastResetMinute = now.toISOString()
    }

    // Reset day counter if needed
    const lastDay = new Date(this.stats.lastResetDay)
    if (now.toDateString() !== lastDay.toDateString()) {
      this.stats.requestsToday = 0
      this.stats.lastResetDay = now.toISOString()
    }

    // Check limits
    if (this.stats.requestsThisMinute >= this.settings.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${this.settings.maxRequestsPerMinute} requests per minute`,
      }
    }

    if (this.stats.requestsToday >= this.settings.maxRequestsPerDay) {
      return {
        allowed: false,
        reason: `Daily limit exceeded: ${this.settings.maxRequestsPerDay} requests per day`,
      }
    }

    return { allowed: true }
  }

  /**
   * Validate image
   */
  private validateImage(request: ChartAnalysisRequest): { valid: boolean; reason?: string } {
    const { image } = request

    // Check file size
    if (image.fileSize > this.settings.maxImageSize) {
      return {
        valid: false,
        reason: `Image size ${image.fileSize} exceeds maximum ${this.settings.maxImageSize} bytes`,
      }
    }

    // Check format
    if (!this.settings.allowedFormats.includes(image.mimeType)) {
      return {
        valid: false,
        reason: `Image format ${image.mimeType} not allowed. Supported formats: ${this.settings.allowedFormats.join(', ')}`,
      }
    }

    return { valid: true }
  }

  /**
   * Analyze chart image
   */
  async analyzeChart(request: ChartAnalysisRequest): Promise<ChartAnalysisResult> {
    const startTime = Date.now()

    try {
      // Check if enabled
      if (!this.isEnabled()) {
        return {
          success: false,
          error: 'Vision AI is not enabled or not configured',
          analyzedAt: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          image: {
            messageId: request.image.messageId,
            channelId: request.image.channelId,
            fileSize: request.image.fileSize,
          },
          trend: this.getDefaultTrend(),
          supportResistance: [],
          indicators: { detected: [], signals: [] },
          patterns: { patterns: [] },
          priceAction: this.getDefaultPriceAction(),
          recommendation: this.getDefaultRecommendation(),
          rawAnalysis: '',
        }
      }

      // Validate image
      const validation = this.validateImage(request)
      if (!validation.valid) {
        throw new Error(validation.reason)
      }

      // Check rate limits
      const rateCheck = this.checkRateLimits()
      if (!rateCheck.allowed) {
        throw new Error(rateCheck.reason)
      }

      // Initialize client
      this.initializeClient()

      // Increment counters
      this.stats.requestsThisMinute++
      this.stats.requestsToday++
      this.stats.totalAnalyses++

      logger.info(`🔍 Vision AI: Analyzing chart from message ${request.image.messageId}`)

      // Convert image buffer to base64
      const base64Image = request.image.imageBuffer.toString('base64')

      // Prepare prompt
      const prompt = VISION_ANALYSIS_PROMPT(request.symbol, request.timeframe)

      // Call Claude Vision API
      const response = await this.anthropic!.messages.create({
        model: this.settings.model,
        max_tokens: this.settings.maxTokens,
        temperature: this.settings.temperature,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: request.image.mimeType as 'image/jpeg' | 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      })

      // Extract text from response
      const textContent = response.content.find((c: any) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Vision API')
      }

      const rawAnalysis = textContent.text

      // Parse JSON response
      let analysisData: any
      try {
        // Try to extract JSON from markdown code blocks
        const jsonMatch = rawAnalysis.match(/```json\s*([\s\S]*?)\s*```/)
        const jsonString = jsonMatch ? jsonMatch[1] : rawAnalysis

        analysisData = JSON.parse(jsonString)
      } catch (error) {
        logger.warn('Failed to parse Vision AI response as JSON, using raw text')
        analysisData = this.parseUnstructuredResponse(rawAnalysis)
      }

      // Update stats
      const processingTime = Date.now() - startTime
      this.stats.successfulAnalyses++
      this.stats.averageProcessingTime =
        (this.stats.averageProcessingTime * (this.stats.successfulAnalyses - 1) + processingTime) /
        this.stats.successfulAnalyses

      // Estimate cost (Claude 3 Sonnet: ~$3 per 1M input tokens, ~$15 per 1M output tokens)
      const inputTokens = response.usage.input_tokens
      const outputTokens = response.usage.output_tokens
      const cost = (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15
      this.stats.estimatedCost += cost
      this.stats.tokensUsed += inputTokens + outputTokens

      // Build result
      const result: ChartAnalysisResult = {
        success: true,
        analyzedAt: new Date().toISOString(),
        processingTime,
        image: {
          messageId: request.image.messageId,
          channelId: request.image.channelId,
          fileSize: request.image.fileSize,
        },
        symbol: request.symbol || analysisData.symbol,
        timeframe: request.timeframe || analysisData.timeframe,
        trend: analysisData.trend || this.getDefaultTrend(),
        supportResistance: analysisData.supportResistance || [],
        indicators: analysisData.indicators || { detected: [], signals: [] },
        patterns: analysisData.patterns || { patterns: [] },
        priceAction: analysisData.priceAction || this.getDefaultPriceAction(),
        recommendation: analysisData.recommendation || this.getDefaultRecommendation(),
        rawAnalysis,
      }

      // Enhance signal if provided
      if (request.existingSignal && this.settings.enhanceSignals) {
        result.enhancedSignal = this.enhanceSignal(request.existingSignal, result)
      }

      logger.info(`✅ Vision AI: Analysis complete in ${processingTime}ms`)
      logger.info(`   Trend: ${result.trend.direction} (${result.trend.strength})`)
      logger.info(`   Recommendation: ${result.recommendation.action} (${result.recommendation.confidence}% confidence)`)

      this.emit('analysisComplete', result)

      return result
    } catch (error: any) {
      this.stats.failedAnalyses++
      logger.error('Vision AI analysis failed:', error)

      this.emit('analysisError', {
        error: error.message,
        request,
      })

      return {
        success: false,
        error: error.message,
        analyzedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        image: {
          messageId: request.image.messageId,
          channelId: request.image.channelId,
          fileSize: request.image.fileSize,
        },
        trend: this.getDefaultTrend(),
        supportResistance: [],
        indicators: { detected: [], signals: [] },
        patterns: { patterns: [] },
        priceAction: this.getDefaultPriceAction(),
        recommendation: this.getDefaultRecommendation(),
        rawAnalysis: '',
      }
    }
  }

  /**
   * Parse unstructured response (fallback)
   */
  private parseUnstructuredResponse(text: string): any {
    // Basic extraction if JSON parsing fails
    return {
      trend: {
        direction: this.extractKeyword(text, ['bullish', 'bearish', 'neutral', 'ranging']) || 'neutral',
        strength: this.extractKeyword(text, ['strong', 'moderate', 'weak']) || 'moderate',
        confidence: 50,
        reasoning: text.substring(0, 200),
      },
      supportResistance: [],
      indicators: { detected: [], signals: [] },
      patterns: { patterns: [] },
      priceAction: {
        priceMovement: 'Analysis could not be fully parsed',
        momentum: 'stable',
        volatility: 'medium',
        keyObservations: [],
      },
      recommendation: {
        action: 'wait',
        confidence: 30,
        reasoning: 'Unable to parse full analysis',
        riskLevel: 'high',
      },
    }
  }

  /**
   * Extract keyword from text
   */
  private extractKeyword(text: string, keywords: string[]): string | null {
    const lowerText = text.toLowerCase()
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return keyword
      }
    }
    return null
  }

  /**
   * Enhance signal with AI insights
   */
  private enhanceSignal(signal: any, analysis: ChartAnalysisResult): any {
    const enhanced = { ...signal }

    // Add AI confidence score
    enhanced.aiConfidence = analysis.recommendation.confidence

    // Adjust entry/SL/TP based on AI analysis
    if (analysis.recommendation.entryZone) {
      enhanced.aiEntryZone = analysis.recommendation.entryZone
    }

    if (analysis.recommendation.stopLoss) {
      enhanced.aiStopLoss = analysis.recommendation.stopLoss
    }

    if (analysis.recommendation.takeProfit) {
      enhanced.aiTakeProfit = analysis.recommendation.takeProfit
    }

    // Add support/resistance levels
    if (analysis.supportResistance.length > 0) {
      enhanced.keyLevels = analysis.supportResistance.map((sr) => ({
        type: sr.type,
        level: sr.level,
        strength: sr.strength,
      }))
    }

    // Add trend information
    enhanced.aiTrend = {
      direction: analysis.trend.direction,
      strength: analysis.trend.strength,
    }

    // Add risk level
    enhanced.aiRiskLevel = analysis.recommendation.riskLevel

    // Add detected patterns
    if (analysis.patterns.patterns.length > 0) {
      enhanced.chartPatterns = analysis.patterns.patterns.map((p) => ({
        name: p.name,
        implication: p.implication,
      }))
    }

    return enhanced
  }

  /**
   * Default values for failed analysis
   */
  private getDefaultTrend(): TrendAnalysis {
    return {
      direction: 'neutral',
      strength: 'weak',
      confidence: 0,
      reasoning: 'Analysis not available',
    }
  }

  private getDefaultPriceAction(): PriceAction {
    return {
      priceMovement: 'Unknown',
      momentum: 'stable',
      volatility: 'medium',
      keyObservations: [],
    }
  }

  private getDefaultRecommendation(): TradingRecommendation {
    return {
      action: 'wait',
      confidence: 0,
      reasoning: 'Analysis not available',
      riskLevel: 'high',
    }
  }
}

// Singleton instance
export const visionAI = new VisionAIService()
