"""
Alfred Agent Service - Core AI agent using GPT-4.
"""
from datetime import datetime
from typing import List, Dict, Optional
import json
from openai import AsyncOpenAI

from app.core.logging import logger
from app.core.config import settings


class Signal:
    """Represents a detected signal."""
    def __init__(self, signal_type: str, confidence: float, severity: float, 
                 data: Dict, reasoning: str):
        self.type = signal_type
        self.confidence = confidence
        self.severity = severity
        self.data = data
        self.reasoning = reasoning
        self.detected_at = datetime.now()
    
    def to_dict(self) -> Dict:
        return {
            "type": self.type,
            "confidence": self.confidence,
            "severity": self.severity,
            "data": self.data,
            "reasoning": self.reasoning,
            "detected_at": self.detected_at.isoformat()
        }


class SignalType:
    """Types of signals Alfred can detect."""
    MEAL_GAP = "meal_gap"
    LOW_ENERGY = "low_energy"
    POOR_SLEEP = "poor_sleep"
    DEHYDRATION = "dehydration"
    CALENDAR_CONFLICT = "calendar_conflict"
    RECOVERY_NEEDED = "recovery_needed"
    STRESS_HIGH = "stress_high"


class AlfredAgent:
    """Core AI agent for generating contextual, intelligent interventions."""
    
    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.gpt_model = settings.GPT_MODEL
        
    async def generate_intervention(
        self,
        user_data: Dict,
        signal: Signal,
        user_patterns: Dict,
        recent_interventions: List[Dict]
    ) -> Optional[Dict]:
        """Generate a contextual intervention for a detected signal."""
        logger.info(f"Generating intervention for signal: {signal.type}")
        
        context = self._build_context(user_data, signal, user_patterns, recent_interventions)
        intervention = await self._generate_with_gpt4(context, signal)
            
        if intervention:
            intervention["signal_type"] = signal.type
            intervention["signal_confidence"] = signal.confidence
            
        return intervention
        
    async def _generate_with_gpt4(self, context: Dict, signal: Signal) -> Optional[Dict]:
        """Generate intervention using GPT-4."""
        try:
            system_prompt = self._get_system_prompt()
            user_prompt = self._build_intervention_prompt(context, signal)
            
            response = await self.openai_client.chat.completions.create(
                model=self.gpt_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=800,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            
            return {
                "title": result.get("title", "Wellness Check"),
                "message": result.get("message", ""),
                "reasoning": result.get("reasoning", ""),
                "confidence": result.get("confidence", 0.7),
                "recommendation_data": result.get("recommendations", {}),
                "type": signal.type
            }
            
        except Exception as e:
            logger.error(f"Error generating intervention with GPT-4: {e}")
            return None
            
    def _get_system_prompt(self) -> str:
        """Get the system prompt defining Alfred's personality."""
        return """You are Alfred Pennyworth, a sophisticated AI wellness assistant.

Your role is to provide intelligent, contextual, and empathetic wellness interventions to help users optimize their nutrition, rest, and performance.

Key principles:
1. **Respectful Timing**: Never interrupt during meetings or quiet hours
2. **Evidence-Based**: Base recommendations on data patterns and scientific principles
3. **Contextual**: Consider the user's schedule, patterns, and preferences
4. **Empathetic**: Communicate with warmth and understanding, never judgmental
5. **Actionable**: Provide specific, practical recommendations
6. **Transparent**: Explain your reasoning clearly
7. **Confident**: Only intervene when confidence is high (>70%)

Communication style:
- Warm, professional, and butler-like
- Brief and to-the-point (2-3 sentences max)
- Encouraging and supportive
- Use "I notice" or "I've observed" rather than commands
- Suggest rather than prescribe

Respond in JSON format with:
{
  "title": "Brief, engaging title",
  "message": "2-3 sentence intervention message",
  "reasoning": "Your analytical reasoning for this intervention",
  "confidence": 0.0-1.0,
  "recommendations": {
    "action": "specific recommendation",
    "timing": "when to act",
    "alternatives": ["option 1", "option 2"]
  }
}"""
        
    def _build_intervention_prompt(self, context: Dict, signal: Signal) -> str:
        """Build the user prompt with context and signal data."""
        return f"""Generate a wellness intervention based on the following:

**SIGNAL DETECTED:**
Type: {signal.type}
Confidence: {signal.confidence:.0%}
Severity: {signal.severity:.0%}
Data: {json.dumps(signal.data, indent=2)}
Reasoning: {signal.reasoning}

**USER CONTEXT:**
Current Time: {context.get('current_time', 'Unknown')}
Upcoming Schedule: {json.dumps(context.get('upcoming_events', []), indent=2)}

**PATTERNS:**
Meal Patterns: {json.dumps(context.get('meal_patterns', {}), indent=2)}
Sleep Patterns: {json.dumps(context.get('sleep_patterns', {}), indent=2)}

**RECENT INTERVENTIONS:**
{json.dumps(context.get('recent_interventions', []), indent=2)}

**USER PREFERENCES:**
{json.dumps(context.get('user_preferences', {}), indent=2)}

Generate an appropriate intervention that:
1. Addresses the detected signal
2. Respects the user's schedule and preferences
3. Provides actionable, specific recommendations
4. Avoids repetition of recent interventions
5. Maintains Alfred's warm, professional tone"""
        
    def _build_context(
        self,
        user_data: Dict,
        signal: Signal,
        user_patterns: Dict,
        recent_interventions: List[Dict]
    ) -> Dict:
        """Build context dictionary for AI models."""
        return {
            "current_time": datetime.now().strftime("%A, %B %d, %Y at %I:%M %p"),
            "user_preferences": {
                "timezone": user_data.get("timezone", "UTC"),
                "dietary_preferences": user_data.get("dietary_preferences", {}),
                "fitness_goals": user_data.get("fitness_goals", {}),
            },
            "upcoming_events": [
                {
                    "title": e.get("title"),
                    "start": e.get("start_time").strftime("%I:%M %p") if e.get("start_time") else None,
                    "duration": f"{e.get('duration_minutes', 0)} minutes"
                }
                for e in user_data.get("upcoming_calendar", [])[:5]
            ],
            "meal_patterns": user_patterns.get("meals", {}),
            "sleep_patterns": user_patterns.get("sleep", {}),
            "recent_interventions": [
                {
                    "type": i.get("type"),
                    "title": i.get("title"),
                    "when": i.get("created_at"),
                    "response": i.get("user_response")
                }
                for i in recent_interventions[-5:]
            ]
        }


alfred_agent = AlfredAgent()

################################################################################
