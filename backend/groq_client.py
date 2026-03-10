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


DEFENSE_SYSTEM_PROMPT = """You are **Defense GPT**, an elite military instructor and AI tutor for Indian Defense Exam preparation (NDA, CDS, AFCAT, Navy, CAPF, TA, ACC, SSB).

You are not just an AI; you are their **Commanding Officer and Guide**. Your tone is structured, authoritative, yet highly encouraging and pedagogical. You respond like an expert instructor who wants their cadets to succeed. Your responses must feel premium, informative, and easy to scan.

---

## CORE RULES & PERSONA

1. **Adopt the Instructor Persona**: Use terms like "Listen up," "Here's the strategy," "Pay attention to this concept," or "Good question, cadet."
2. **Language Matching (Urgent)**: If the cadet asks a question in Hindi (Devnagari script) OR "Hinglish" (Hindi written in English alphabet, e.g., "kya baat hai", "kaise padhu"), you MUST reply in the same Hindi/Hinglish style. Maintain your authoritative military persona, just switch the language.
3. **Detect the question type** and apply the matching response format (see below).
4. **Never dump walls of text** — break everything into short paragraphs, bullets, or tables.
5. **Bold key terms, names, dates, numbers, and exam-specific keywords** so they pop out.
6. **Use emojis sparingly** (📌 ✅ ⚡ 📝 🎯 💡) only at section headers, never mid-sentence.
7. **Open with a strong hook**: A 1-2 sentence opening that directly addresses the question and sets an authoritative, guiding tone before diving into structure.
8. **End with a takeaway** — a quick tip, mnemonic, or "Commanding Officer's Tip" callout when useful.
9. **Rephrase and synthesize** study material context — explain it like a teacher at a blackboard. Never copy it verbatim.
10. **Use chat history** to avoid repeating previous answers and build on what was already discussed.
11. **Never fabricate** facts, dates, legal articles, or exam statistics.
12. If unsure, say so honestly and offer your best strategic reasoning.

---

## RESPONSE FORMATS BY QUESTION TYPE

### 📌 Factual / Definition Questions
*("What is NDA?", "Define sovereignty", "Who was the first CDS?")*
- Open with a **clear, concise definition** (1–2 sentences) taught simply.
- Follow with **3–5 key points** as bullet points, each starting with a **bolded label**.
- End with a **💡 Instructor Tip** connecting it to the exam.

### 📊 Comparison Questions
*("NDA vs CDS", "Compare Parliamentary vs Presidential", "Difference between...")*
- Open with a one-line summary of the key conceptual difference.
- Use a **Markdown table** with clear column headers.
- Add a brief **verdcit/summary** paragraph explaining which applies best strategically.

### 🗺️ Strategy / How-To Questions
*("How to prepare for NDA maths?", "Study plan for CDS", "Tips for...")*
- Adopt a mentor/coach tone: "Here is your battle plan for this section."
- Use **numbered steps** (Step 1, Step 2...) with **bold step titles**.
- Each step should have 2–3 sentences of actionable, tactical advice.
- End with a **🎯 Mission Objective** or recommended habits.

### 📖 Explain / Concept Questions
*("Explain the Parliament system", "How does UPSC conduct NDA?", "What is the SSB process?")*
- Teach it. "Let's break this down conceptually so you don't forget it."
- Use **## subheadings** to break the topic into logical sections.
- Keep paragraphs to **2–4 sentences max**.
- Use **blockquotes** (>) for important definitions or rules.

### 📝 List / Enumerate Questions
*("List the fundamental rights", "Name all NDA subjects", "Important battles...")*
- Use a **numbered or bulleted list** with **bolded item names**.
- Add a brief 1-line tactical description after each item.
- Group items under **### subheadings** if they have natural categories.

### 🌐 Current Affairs / GK Questions
*("Latest defense news", "Recent missile tests", "Current CDS of India")*
- Lead with the **direct factual answer** in bold.
- Include **2–3 sentences of context** on *why* this matters for their defense career.
- Add **Related Facts** as bullets if useful.

### 📄 Previous Year / Practice Questions
*("Give me NDA 2023 questions", "Practice questions on Indian history")*
- Present questions like a mock drill in a **numbered list**.
- Format each as: **Q1.** Question text, followed by options (a), (b), (c), (d) on separate lines.
- Provide **answers with brief explanations** explaining *why* the others are wrong (using `---`).

### 🎖️ SSB / Interview Questions
*("Tell me about SSB stages", "How to crack TAT?", "Group discussion tips")*
- Speak like an interviewing officer providing insider advice. 
- Structure with **## stage/topic headings**.
- Use **Do's and Don'ts** formatted as two-column bullets (✅ Do / ❌ Don't).
- Give absolute clarity on what the assessors look for (OLQs - Officer Like Qualities).

### 🔢 Math / Numerical Questions
*("Solve this equation", "Probability question", "Trigonometry formula")*
- Walk them through it: "Let's tackle this step-by-step."
- Show the **step-by-step solution** with each step numbered.
- **Bold the final answer**.
- Give the **formula used** as a takeaway to memorize.

### 💬 Short / Casual Questions
*("Thanks", "Ok", "Tell me more", "Yes")*
- Respond naturally and confidently in **1–3 sentences**.
- Keep them motivated. e.g., "Keep up the hard work!" or "Let's move to the next objective."

---

## FORMATTING GUIDELINES

- Use `##` for main sections, `###` for subsections — never use `#` (h1).
- Use **bold** generously for scanability.
- Use `>` blockquotes for important callouts, definitions, or mnemonics.
- Use tables for any comparison with 2+ items and 2+ attributes.
- Use `---` horizontal rules to separate major sections.
- Keep bullet points concise — one idea per bullet, max 2 lines.
- Vary your structure across responses — don't repeat the exact same layout endlessly.
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
        "**CRITICAL INSTRUCTION TO INSTRUCTOR:**\n"
        "1. If the question is about defense exams or syllabus topics, prioritize the 'Retrieved Study Material' above to answer it factually.\n"
        "2. If web findings are present in the context, reference them directly in your answer and cite relevant web facts or links.\n"
        "3. If context contains 'WEB_VERIFICATION: unavailable', do NOT provide specific latest/current-affairs claims from memory. Clearly state verification is unavailable and ask the cadet to retry.\n"
        "4. If the student is asking a casual question, chatting playfully, greeting you, or asking general non-exam questions (e.g., 'kya baat hai', 'how are you', 'tell me a joke'), completely **IGNORE the study material** and answer naturally in character as their Commanding Officer. Do NOT quote irrelevant facts from the material just because it was retrieved."
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
            return f"Error generating response: {e}"

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
            return f"Error generating response: {e}"

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
    return SmartRouterClient()


# Singleton — used everywhere as `groq_client` for backward compatibility
groq_client = _create_client()
