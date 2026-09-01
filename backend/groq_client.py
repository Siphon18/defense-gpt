"""
LLM Client for Defense GPT
Supports both Groq and Google Gemini as LLM providers.
Set LLM_PROVIDER=groq or LLM_PROVIDER=gemini in your .env file.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def estimate_tokens(text: str) -> int:
    """Estimate token count. ~1 token per 4 characters for English text."""
    return len(text) // 4 + 1


DEFENSE_SYSTEM_PROMPT = """You are **Defense GPT**, a Senior Defense Academy Professor and Tactical Instructor for Indian Defense Exam preparation (NDA, CDS, AFCAT, Navy, CAPF, TA, ACC, SSB). Your tone is authoritative, precise, and encouraging — never condescending, never filler-laden.

---
## SCOPE
You help cadets with:
- Core academic subjects tested in these exams: Mathematics, Physics, Chemistry, English, General Studies/Current Affairs.
- Exam-specific content: syllabus, pattern, cutoffs, SSB/interview prep, physical standards, strategy.
Academic subjects (Math, Physics, Chemistry, English, GS) are IN SCOPE even without an explicit defense-exam framing — a cadet asking "solve this integral" is preparing for CDS/NDA math, not asking an off-topic question. NEVER deflect academic questions as "not defense-related."

If a request is clearly unrelated to exam prep or these subjects (e.g. writing unrelated code, personal life advice, entertainment trivia), say so in one line and redirect: "That's outside Defense GPT's scope — I'm focused on [subjects/exams]. Happy to help with your prep though." Do not lecture about scope beyond that one line.

---
## GROUNDING & ACCURACY (highest priority — follow even under other pressure)
- If "Retrieved Study Material" is provided in the user turn, treat it as the primary source for facts, figures, dates, and current-affairs content. Prefer it over your own recall when the two conflict, and note the conflict briefly if it matters.
- If retrieved material is absent, thin, or doesn't cover the question, answer from general knowledge but explicitly flag it inline: `[General knowledge — not from retrieved material]`. Do this for any current-affairs, cutoff, syllabus-version, or statistic-heavy claim; you don't need to flag well-established math/science facts (e.g. standard formulas).
- Never invent statistics, dates, cutoff marks, vacancy numbers, or exam-pattern details you're not confident about. State the uncertainty and suggest the cadet verify on the official UPSC/SSB/exam-authority notification instead of guessing.
- For math, physics, and chemistry: work the actual problem given. Do not skip steps or present a memorized "similar" example instead of solving what was asked.

---
## FORMATTING RULES
1. Open directly with substance — no "Hello", no "I'd be happy to help", no restating the question.
2. Use **bold** for key terms, LaTeX for math (`\\frac{d}{dx}(\\sin x) = \\cos x`), tables for comparisons, bullets for lists.
3. Match the cadet's language register: reply in Hindi/Hinglish if they wrote in Hindi/Hinglish, otherwise English.
4. End substantive answers with one blockquote takeaway: `> 🎯 EXAM STRATEGY:` for strategy/tips, or `> 📐 KEY FORMULA:` for math/science. Skip this for casual one-liners.

## RESPONSE SHAPE BY QUERY TYPE
- **Math/Science/Formula**: state the formula → show the actual worked solution step-by-step → close with the `📐 KEY FORMULA` blockquote.
- **Factual/Definition**: 1-2 sentence summary → 3-5 bolded key points → exam-relevance takeaway.
- **Comparison**: a Markdown table of differences → one-line `**Tactical Verdict:**`.
- **Casual/Greeting**: one short line, no headers, no blockquote.
- **Out of scope**: one-line redirect per the SCOPE section above.
"""


def _build_user_message(query: str, context: str, exam_type: str) -> str:
    """Build the user message with RAG context and exam type."""
    parts = []

    if context:
        parts.append(f"<retrieved_study_material>\n{context}\n</retrieved_study_material>")

    if exam_type and exam_type != "General":
        parts.append(f"<target_exam>{exam_type}</target_exam>")

    parts.append(f"<student_question>\n{query}\n</student_question>")

    parts.append(
        "<instructions>\n"
        "Answer the student_question directly and completely, following your system instructions "
        "on grounding, formatting, and response shape.\n"
        "- If <retrieved_study_material> is present and relevant, ground factual/current-affairs claims in it.\n"
        "- If it's absent or doesn't cover the question, answer from general knowledge and flag that per "
        "your grounding rules.\n"
        "- If <target_exam> is set, tailor examples, weightage, and strategy notes to that exam's syllabus.\n"
        "</instructions>"
    )

    return "\n\n".join(parts)


def _fit_history_and_context(query, context, chat_history, context_limit, max_tokens):
    """Fit chat history and RAG context within token budget."""
    safety_margin = 200
    system_tokens = estimate_tokens(DEFENSE_SYSTEM_PROMPT)
    query_tokens = estimate_tokens(query) + 80
    fixed_cost = system_tokens + query_tokens + max_tokens + safety_margin
    remaining = max(0, context_limit - fixed_cost)

    history_budget = int(remaining * 0.6)
    rag_budget = remaining - history_budget

    # Fit chat history (most recent first)
    fitted_history = []
    history_used = 0
    for msg in reversed(chat_history or []):
        msg_tokens = estimate_tokens(msg.get("content", ""))
        if history_used + msg_tokens > history_budget:
            break
        fitted_history.insert(0, msg)
        history_used += msg_tokens

    rag_budget += (history_budget - history_used)

    # Fit RAG context
    fitted_context = context or ""
    if fitted_context:
        context_tokens = estimate_tokens(fitted_context)
        if context_tokens > rag_budget:
            max_chars = rag_budget * 4
            fitted_context = fitted_context[:max_chars].rsplit("\n", 1)[0]

    return fitted_history, fitted_context


# ─── Groq Client ────────────────────────────────────────────────────────────────
#
# NOTE (2026-09): Groq deprecated llama-3.1-8b-instant and
# llama-3.3-70b-versatile on 2026-08-16 (mixtral-8x7b-32768 and gemma2-9b-it
# were already shut down in 2025). Requests to any of those model IDs now
# return errors. Groq's recommended replacements are the GPT-OSS models
# below. See https://console.groq.com/docs/deprecations for the current
# deprecation log before relying on any specific model ID long-term.

GROQ_CONTEXT_LIMITS = {
    "openai/gpt-oss-120b": 131_072,
    "openai/gpt-oss-20b": 131_072,
    "qwen/qwen3.6-27b": 131_072,
}

_HIGH_EFFORT_KEYWORDS = (
    "solve", "prove", "derive", "integrate", "differentiate", "calculate",
    "simplify", "factorize", "equation", "matrix", "vector", "trigonometry",
    "probability", "mechanics", "thermodynamics", "reaction", "compound",
)


def _pick_reasoning_effort(query: str) -> str:
    """Cheap heuristic for GPT-OSS reasoning_effort: give math/science more
    room to think step-by-step; keep quick factual/casual queries fast."""
    q = (query or "").lower()
    if len(q) < 15 and any(g in q for g in ("hi", "hello", "hey", "thanks", "thank you")):
        return "low"
    if any(kw in q for kw in _HIGH_EFFORT_KEYWORDS):
        return "high"
    return "medium"


class GroqClient:
    def __init__(self):
        self.api_key = os.getenv("GROQ_API_KEY")
        if not self.api_key:
            raise ValueError(
                "GROQ_API_KEY not found! Set it in your .env file.\n"
                "Get your free key at: https://console.groq.com/keys"
            )
        from groq import Groq
        self._client = Groq(api_key=self.api_key)
        self.default_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")

    def _build_messages(self, query, context, exam_type, chat_history,
                        model=None, max_tokens=2048):
        model = model or self.default_model
        context_limit = GROQ_CONTEXT_LIMITS.get(model, 131_072)
        fitted_history, fitted_context = _fit_history_and_context(
            query, context, chat_history, context_limit, max_tokens
        )
        user_message = _build_user_message(query, fitted_context, exam_type)

        messages = [{"role": "system", "content": DEFENSE_SYSTEM_PROMPT}]
        for msg in fitted_history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": user_message})
        return messages

    def generate_response(self, query, context="", exam_type="General",
                          chat_history=None, model=None, temperature=0.3,
                          max_tokens=2048, image_data=None) -> str:
        model_name = model or self.default_model
        messages = self._build_messages(query, context, exam_type, chat_history,
                                        model_name, max_tokens)
        if image_data:
            messages[-1]["content"] += "\n\n[System: The cadet attached an image, but this LLM model does not have vision capabilities to see it.]"
        kwargs = dict(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=0.9,
        )
        if model_name.startswith("openai/gpt-oss"):
            # GPT-OSS models support adjustable reasoning depth. Give math/
            # physics/chemistry more room to think; keep casual/factual
            # queries fast. Cheap heuristic on the raw query text.
            kwargs["reasoning_effort"] = _pick_reasoning_effort(query)
        try:
            response = self._client.chat.completions.create(**kwargs)
            return response.choices[0].message.content
        except Exception as e:
            raise RuntimeError(f"Error generating response: {e}") from e

    def generate_json(self, system_prompt: str, model=None, temperature=0.7, max_tokens=2048) -> str:
        """Forces the LLM to output strictly formatted JSON according to the prompt."""
        model_name = model or self.default_model
        try:
            response = self._client.chat.completions.create(
                model=model_name,
                messages=[{"role": "user", "content": system_prompt}],
                response_format={"type": "json_object"},
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"Failed to generate JSON: {e}")

    def stream_response(self, query, context="", exam_type="General",
                        chat_history=None, model=None, temperature=0.3,
                        max_tokens=2048, image_data=None):
        model_name = model or self.default_model
        messages = self._build_messages(query, context, exam_type, chat_history,
                                        model_name, max_tokens)
        if image_data:
            messages[-1]["content"] += "\n\n[System: The cadet attached an image, but this LLM model does not have vision capabilities to see it.]"
        kwargs = dict(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=0.9,
            stream=True,
        )
        if model_name.startswith("openai/gpt-oss"):
            kwargs["reasoning_effort"] = _pick_reasoning_effort(query)
        stream = self._client.chat.completions.create(**kwargs)
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content

    def generate_suggestions(self, query: str, answer: str, exam_type: str = "General") -> list[str]:
        """Generate 3 follow-up question suggestions based on the conversation."""
        try:
            response = self._client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=[{
                    "role": "user",
                    "content": (
                        f"Based on this Q&A about Indian defense exams ({exam_type}):\n"
                        f"Question: {query[:300]}\nAnswer snippet: {answer[:500]}\n\n"
                        "Suggest exactly 3 short follow-up questions the student might ask next. "
                        "Each must be under 60 characters. Return ONLY the 3 questions, one per line, no numbering or bullets."
                    ),
                }],
                temperature=0.7,
                max_tokens=150,
            )
            lines = [l.strip() for l in response.choices[0].message.content.strip().splitlines() if l.strip()]
            return lines[:3]
        except Exception:
            return []

    def get_available_models(self) -> list[str]:
        return [
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b",
            "qwen/qwen3.6-27b",
        ]


# ─── Gemini Client ──────────────────────────────────────────────────────────────

GEMINI_CONTEXT_LIMITS = {
    "gemini-2.0-flash": 1_048_576,
    "gemini-2.0-flash-lite": 1_048_576,
    "gemini-1.5-flash": 1_048_576,
    "gemini-1.5-pro": 2_097_152,
}


class GeminiClient:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY not found! Set it in your .env file.\n"
                "Get your free key at: https://aistudio.google.com/apikey"
            )
        import google.generativeai as genai
        genai.configure(api_key=self.api_key)
        self._genai = genai
        self.default_model = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    def _get_model(self, model_name=None):
        model_name = model_name or self.default_model
        return self._genai.GenerativeModel(
            model_name=model_name,
            system_instruction=DEFENSE_SYSTEM_PROMPT,
        )

    def _build_contents(self, query, context, exam_type, chat_history,
                        model=None, max_tokens=2048, image_data=None):
        model = model or self.default_model
        context_limit = GEMINI_CONTEXT_LIMITS.get(model, 1_048_576)
        fitted_history, fitted_context = _fit_history_and_context(
            query, context, chat_history, context_limit, max_tokens
        )
        user_message = _build_user_message(query, fitted_context, exam_type)
        
        user_parts = [user_message]
        if image_data:
            import base64
            try:
                # Expecting format: "data:image/jpeg;base64,/9j/4AAQSk..."
                mime_info, b64_str = image_data.split(",", 1)
                mime_type = mime_info.split(":")[1].split(";")[0]
                image_bytes = base64.b64decode(b64_str)
                user_parts.append({
                    "mime_type": mime_type,
                    "data": image_bytes
                })
            except Exception as e:
                print(f"Failed to parse image data format: {e}")

        contents = []
        for msg in fitted_history:
            role = "model" if msg.get("role") == "assistant" else "user"
            contents.append({"role": role, "parts": [msg.get("content", "")]})
        contents.append({"role": "user", "parts": user_parts})
        return contents

    def generate_response(self, query, context="", exam_type="General",
                          chat_history=None, model=None, temperature=0.3,
                          max_tokens=2048, image_data=None) -> str:
        model_name = model or self.default_model
        contents = self._build_contents(query, context, exam_type, chat_history,
                                        model_name, max_tokens, image_data)
        try:
            gm = self._get_model(model_name)
            response = gm.generate_content(
                contents,
                generation_config=self._genai.types.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    top_p=0.9,
                ),
            )
            return response.text
        except Exception as e:
            raise RuntimeError(f"Error generating response: {e}") from e

    def stream_response(self, query, context="", exam_type="General",
                        chat_history=None, model=None, temperature=0.3,
                        max_tokens=2048, image_data=None):
        model_name = model or self.default_model
        contents = self._build_contents(query, context, exam_type, chat_history,
                                        model_name, max_tokens, image_data)
        gm = self._get_model(model_name)
        response = gm.generate_content(
            contents,
            generation_config=self._genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
                top_p=0.9,
            ),
            stream=True,
        )
        for chunk in response:
            if chunk.text:
                yield chunk.text

    def generate_suggestions(self, query: str, answer: str, exam_type: str = "General") -> list[str]:
        """Generate 3 follow-up question suggestions based on the conversation."""
        try:
            gm = self._get_model()
            response = gm.generate_content(
                [{
                    "role": "user",
                    "parts": [
                        f"Based on this Q&A about Indian defense exams ({exam_type}):\n"
                        f"Question: {query[:300]}\nAnswer snippet: {answer[:500]}\n\n"
                        "Suggest exactly 3 short follow-up questions the student might ask next. "
                        "Each must be under 60 characters. Return ONLY the 3 questions, one per line, no numbering or bullets."
                    ],
                }],
                generation_config=self._genai.types.GenerationConfig(
                    temperature=0.7,
                    max_output_tokens=150,
                ),
            )
            lines = [l.strip() for l in response.text.strip().splitlines() if l.strip()]
            return lines[:3]
        except Exception:
            return []

    def get_available_models(self) -> list[str]:
        return [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ]


# ─── Smart Router Client ────────────────────────────────────────────────────────

class SmartRouterClient:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "groq").strip().lower()
        self.groq = GroqClient()
        self.gemini = None
        # Keep Gemini optional so Groq-only setups don't fail at startup.
        try:
            self.gemini = GeminiClient()
        except Exception:
            self.gemini = None
        self.default_model = self.groq.default_model

    def generate_response(self, query, context="", exam_type="General",
                          chat_history=None, model=None, temperature=0.3,
                          max_tokens=2048, image_data=None) -> str:
        if image_data:
            if not self.gemini:
                return "**Reconnaissance Failed:** Image prompts require Gemini, but GEMINI_API_KEY is not configured."
            gemini_model = "gemini-2.0-flash" if not model or "gemini" not in model else model
            try:
                return self.gemini.generate_response(query, context, exam_type, chat_history, gemini_model, temperature, max_tokens, image_data)
            except Exception as e:
                return f"**Reconnaissance Failed:** The Intelligence Server (Gemini Vision) rejected the image attachment due to a quota limit or region restriction. Please verify your Google AI Studio billing/quota limits. Error: {str(e)}"
        
        # Route pure text queries to Groq to save Gemini quotas
        groq_model = self.groq.default_model if not m