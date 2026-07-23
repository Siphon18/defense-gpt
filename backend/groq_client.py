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


DEFENSE_SYSTEM_PROMPT = """You are **Defense GPT**, an elite intelligence AI and Academic Instructor for Indian Defense Exam preparation (NDA, CDS, AFCAT, Navy, CAPF, TA, ACC, SSB).

You operate as a Senior Defense Academy Professor and Tactical Instructor. Your tone is authoritative, highly knowledgeable, precise, and deeply helpful.

---

## CORE ACADEMIC & TACTICAL DIRECTIVES

1. **Academic Excellence First**: Mathematics (Calculus, Trigonometry, Algebra, Matrices, Statistics), Physics, Chemistry, English, and General Studies are **CORE NDA/CDS/AFCAT EXAM SUBJECTS**. When a cadet asks a math, physics, or academic question, provide the **exact formula, step-by-step solution, and mathematical proof immediately**. NEVER claim academic or math topics are "not related to defense exams".
2. **No Preachy Lectures**: Do NOT give lectures about "in the field we don't use formulas". Focus on helping the cadet master the syllabus and clear their exam with maximum marks.
3. **No Chatty Opener Clutter**: Open responses directly with clear, structured answers. Avoid filler like "Hello" or "I'd be happy to help."
4. **Scannable Formatting**: Use bold key terms, LaTeX math formulas (e.g. `\\frac{d}{dx}(\\sin x) = \\cos x`), Markdown tables, and structured bullet points.
5. **Language Matching**: If asked in Hindi or Hinglish (e.g., "kya formula hai"), reply in the same Hindi/Hinglish style while maintaining professional instructional quality.
6. **Blockquote Key Takeaways**: Highlight crucial formulas, shortcuts, or exam tips inside a blockquote starting with `> 🎯 **EXAM STRATEGY:**` or `> 📐 **KEY FORMULA:**`
7. **Never Fabricate Data**: If factual data is missing from retrieved context for a current-affairs question, state `[DATA NOT IN RAG DATABASE] Relying on general strategic knowledge.`

---

## RESPONSE FORMATS BY QUERY TYPE

### 📐 Mathematical / Science / Formula Queries
- State the **exact formula/solution** clearly in bold or LaTeX block.
- Provide a brief 2-3 step **Worked Example** or derivation if applicable.
- Conclude with a `> 📐 **KEY FORMULA / EXAM TIP:**` blockquote.

### 📌 Factual / Definition Queries
- Open with a crisp, 1-2 sentence **Intel Summary**.
- Provide **3-5 key parameters** as bullet points with bold labels.
- Conclude with an exam-focused takeaway.

### 📊 Comparison / Versus Queries
- Synthesize differences into a clean **Markdown table**.
- Provide a concise `**Tactical Verdict:**` below the table.

### 💬 Casual / Greetings
- Keep confirmations crisp: "Acknowledged. Ready for your next query."
"""


def _build_user_message(query: str, context: str, exam_type: str) -> str:
    """Build the user message with RAG context and exam type."""
    user_message = ""
    if context:
        user_message += f"## Retrieved Study Material:\n{context}\n\n---\n\n"
    if exam_type and exam_type != "General":
        user_message += f"**Target Exam: {exam_type}**\n\n"

    user_message += f"**Student's Question:** {query}\n\n"

    user_message += (
        "---\n"
        "**INSTRUCTION TO INSTRUCTOR:**\n"
        "1. Provide a direct, highly accurate, and complete answer to the student's question.\n"
        "2. If the question is about Math, Science, or General Knowledge, give the exact formula/solution step-by-step.\n"
        "3. Prioritize 'Retrieved Study Material' if present. If web findings are present, cite relevant facts.\n"
        "4. If casual input, respond in 1 short line."
    )

    return user_message


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

GROQ_CONTEXT_LIMITS = {
    "llama-3.3-70b-versatile": 128_000,
    "llama-3.1-8b-instant": 128_000,
    "mixtral-8x7b-32768": 32_768,
    "gemma2-9b-it": 8_192,
}


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
        self.default_model = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

    def _build_messages(self, query, context, exam_type, chat_history,
                        model=None, max_tokens=2048):
        model = model or self.default_model
        context_limit = GROQ_CONTEXT_LIMITS.get(model, 32_768)
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
        try:
            response = self._client.chat.completions.create(
                model=model_name,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=0.9,
            )
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
        stream = self._client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=0.9,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield delta.content

    def generate_suggestions(self, query: str, answer: str, exam_type: str = "General") -> list[str]:
        """Generate 3 follow-up question suggestions based on the conversation."""
        try:
            response = self._client.chat.completions.create(
                model="llama-3.1-8b-instant",
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
            "llama-3.3-70b-versatile",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
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
        groq_model = self.groq.default_model if not model or "gemini" in model else model
        return self.groq.generate_response(query, context, exam_type, chat_history, groq_model, temperature, max_tokens)

    def generate_json(self, system_prompt: str, model=None, temperature=0.7, max_tokens=2048) -> str:
        # We route json generation exclusively to Groq since it's fast and supports json objects well
        groq_model = self.groq.default_model if not model or "gemini" in model else model
        return self.groq.generate_json(system_prompt, groq_model, temperature, max_tokens)

    def stream_response(self, query, context="", exam_type="General",
                        chat_history=None, model=None, temperature=0.3,
                        max_tokens=2048, image_data=None):
        if image_data:
            if not self.gemini:
                yield "**Reconnaissance Failed:** Image prompts require Gemini, but GEMINI_API_KEY is not configured."
                return
            gemini_model = "gemini-2.0-flash" if not model or "gemini" not in model else model
            try:
                yield from self.gemini.stream_response(query, context, exam_type, chat_history, gemini_model, temperature, max_tokens, image_data)
            except Exception:
                yield "**Reconnaissance Failed:** The Intelligence Server (Gemini Vision API) rejected the image attachment due to a quota limit (Limit: 0) or region restriction on your account. Please verify your Google AI Studio billing/quota limits. In the meantime, please send text-only prompts!"
            return
            
        groq_model = self.groq.default_model if not model or "gemini" in model else model
        yield from self.groq.stream_response(query, context, exam_type, chat_history, groq_model, temperature, max_tokens)

    def generate_suggestions(self, query: str, answer: str, exam_type: str = "General") -> list[str]:
        return self.groq.generate_suggestions(query, answer, exam_type)

    def get_available_models(self) -> list[str]:
        models = self.groq.get_available_models()
        if self.gemini:
            models += self.gemini.get_available_models()
        return models

def _create_client():
    try:
        return SmartRouterClient()
    except Exception as e:
        print(f"SmartRouterClient initialization delayed: {e}")
        return None

groq_client = _create_client()
