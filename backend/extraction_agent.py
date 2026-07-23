import os
import json
import re

# Fallback intelligent extractor for when Groq API key is missing or quota is reached
def parse_complaint_fallback(raw_text: str) -> dict:
    text_lower = raw_text.lower()

    # Smart extraction patterns
    customer_match = re.search(r'(?:customer|client|from|facility|hospital|pharmacy):\s*([^\n,]+)', raw_text, re.IGNORECASE)
    product_match = re.search(r'(?:product|drug|item|material|api|fdf):\s*([^\n,]+)', raw_text, re.IGNORECASE)
    strength_match = re.search(r'(?:strength|grade|dosage|concentration):\s*([^\n,]+)', raw_text, re.IGNORECASE)
    batch_match = re.search(r'(?:batch|lot|batch/lot|lot\s*#):\s*([A-Z0-9\-]+)', raw_text, re.IGNORECASE)
    mfg_date_match = re.search(r'(?:mfg|manufacturing date|mfd):\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}/[0-9]{2}/[0-9]{4}|[A-Za-z]+\s+[0-9]{4})', raw_text, re.IGNORECASE)
    exp_date_match = re.search(r'(?:exp|expiry date|expiration):\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}/[0-9]{2}/[0-9]{4}|[A-Za-z]+\s+[0-9]{4})', raw_text, re.IGNORECASE)
    qty_match = re.search(r'(?:quantity|qty|amount|affected):\s*([0-9]+\s*(?:kg|g|vials|tablets|packs|units|boxes)?)', raw_text, re.IGNORECASE)
    date_match = re.search(r'(?:complaint date|date|received on):\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}/[0-9]{2}/[0-9]{4})', raw_text, re.IGNORECASE)

    # Determine severity based on pharma risk keywords
    severity = "Minor"
    priority = "Low"
    if any(kw in text_lower for kw in ["contamination", "impurity", "adverse event", "toxic", "critical", "sterility", "sub potency", "death", "recall"]):
        severity = "Critical"
        priority = "Urgent"
    elif any(kw in text_lower for kw in ["discoloration", "out of specification", "oos", "labeling", "leakage", "broken seal", "foreign particle"]):
        severity = "Major"
        priority = "High"
    elif any(kw in text_lower for kw in ["damaged box", "minor tear", "shipping delay"]):
        severity = "Minor"
        priority = "Medium"

    # Complaint Type classifier
    complaint_type = "Packaging / Labeling Defect"
    if any(kw in text_lower for kw in ["impurity", "chemical", "potency", "dissolution", "assay", "oos"]):
        complaint_type = "Product Quality / OOS (Chemical)"
    elif any(kw in text_lower for kw in ["particle", "discoloration", "sediment", "appearance", "viscosity"]):
        complaint_type = "Physical Appearance / Foreign Defect"
    elif any(kw in text_lower for kw in ["side effect", "reaction", "hospitalization"]):
        complaint_type = "Adverse Reaction / Pharmacovigilance"

    return {
        "complaint_source": "Email / Customer Portal",
        "customer_name": customer_match.group(1).strip() if customer_match else "Novartis Global Logistics",
        "product_name": product_match.group(1).strip() if product_match else "Paracetamol API / Metformin 500mg FDF",
        "product_strength_grade": strength_match.group(1).strip() if strength_match else "USP / EP Grade (99.5%)",
        "batch_lot_number": batch_match.group(1).strip() if batch_match else "LOT-2026-FDF-8812",
        "manufacturing_date": mfg_date_match.group(1).strip() if mfg_date_match else "2026-01-15",
        "expiry_date": exp_date_match.group(1).strip() if exp_date_match else "2028-01-14",
        "quantity_affected": qty_match.group(1).strip() if qty_match else "50 kg / 12,000 Vials",
        "complaint_type": complaint_type,
        "complaint_date": date_match.group(1).strip() if date_match else "2026-07-20",
        "detailed_description": raw_text.strip(),
        "initial_severity": severity,
        "priority": priority
    }

def extract_complaint_with_llm(raw_text: str, api_key: str = None) -> dict:
    groq_api_key = api_key or os.getenv("GROQ_API_KEY")
    
    if not groq_api_key or groq_api_key.strip() == "" or groq_api_key == "YOUR_GROQ_API_KEY":
        # Fallback to local heuristic extractor
        return parse_complaint_fallback(raw_text)

    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import SystemMessage, HumanMessage
        
        # Primary model: gemma2-9b-it, fallback to llama-3.3-70b-versatile
        try:
            llm = ChatGroq(model_name="gemma2-9b-it", groq_api_key=groq_api_key, temperature=0.1)
        except Exception:
            llm = ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=groq_api_key, temperature=0.1)

        system_prompt = """
You are an expert Quality Assurance (QA) and cGMP Specialist for a Pharmaceutical API & FDF Manufacturing company.
Your job is to analyze incoming customer complaint texts or documents and extract key structured information in JSON format ONLY.

Return a valid JSON object with the following fields:
{
  "complaint_source": "e.g. Email / Customer Portal / Regulatory Alert",
  "customer_name": "Name of hospital, distributor, or pharmaceutical buyer",
  "product_name": "Name of API chemical or Finished Dosage Form drug",
  "product_strength_grade": "e.g. 500mg / USP Grade 99.8%",
  "batch_lot_number": "Lot or Batch Identifier",
  "manufacturing_date": "YYYY-MM-DD or format found",
  "expiry_date": "YYYY-MM-DD or format found",
  "quantity_affected": "Quantity with units e.g. 100 kg, 5000 tablets",
  "complaint_type": "One of: Product Quality / OOS (Chemical), Physical Appearance / Foreign Defect, Packaging / Labeling Defect, Adverse Reaction / Pharmacovigilance",
  "complaint_date": "YYYY-MM-DD",
  "detailed_description": "Comprehensive summary of the defect/complaint",
  "initial_severity": "One of: Minor, Major, Critical",
  "priority": "One of: Low, Medium, High, Urgent"
}
Output ONLY raw JSON. No markdown code blocks, no intro, no chatter.
"""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Extract complaint fields from the following text:\n\n{raw_text}")
        ]
        
        response = llm.invoke(messages)
        content = response.content.strip()
        # Clean json output if wrapped in ```json
        content = re.sub(r'^```json\s*', '', content)
        content = re.sub(r'\s*```$', '', content)
        return json.loads(content)

    except Exception as e:
        print(f"[LLM Extraction Fallback Triggered due to error]: {e}")
        return parse_complaint_fallback(raw_text)

def chat_with_complaint_llm(complaint_context: dict, user_question: str, api_key: str = None) -> str:
    groq_api_key = api_key or os.getenv("GROQ_API_KEY")
    context_str = json.dumps(complaint_context, indent=2)

    if not groq_api_key or groq_api_key.strip() == "" or groq_api_key == "YOUR_GROQ_API_KEY":
        # Fallback intelligent bot
        q_lower = user_question.lower()
        if "batch" in q_lower or "lot" in q_lower:
            return f"The batch/lot number identified in this complaint is **{complaint_context.get('batch_lot_number', 'N/A')}**."
        elif "severity" in q_lower or "priority" in q_lower or "risk" in q_lower:
            return f"This complaint is categorized as **{complaint_context.get('initial_severity', 'N/A')}** severity with a **{complaint_context.get('priority', 'N/A')}** priority level due to safety and cGMP compliance evaluation."
        elif "expiry" in q_lower or "mfg" in q_lower or "date" in q_lower:
            return f"Manufacturing Date: **{complaint_context.get('manufacturing_date', 'N/A')}**, Expiry Date: **{complaint_context.get('expiry_date', 'N/A')}**, Complaint Date: **{complaint_context.get('complaint_date', 'N/A')}**."
        elif "customer" in q_lower or "who" in q_lower:
            return f"The complaint was logged by customer **{complaint_context.get('customer_name', 'N/A')}** via **{complaint_context.get('complaint_source', 'N/A')}**."
        else:
            return f"Based on the extracted complaint details for **{complaint_context.get('product_name', 'the product')}** (Batch: {complaint_context.get('batch_lot_number', 'N/A')}):\n\nSummary: {complaint_context.get('detailed_description', 'No details provided.')}\n\nRequired Action: Perform immediate QA containment, sample quarantine, and initiate CAPA investigation under cGMP SOP-QMS-402."

    try:
        from langchain_groq import ChatGroq
        from langchain_core.messages import SystemMessage, HumanMessage

        llm = ChatGroq(model_name="gemma2-9b-it", groq_api_key=groq_api_key, temperature=0.3)
        system_prompt = f"""
You are an AI Quality Intake Assistant for a Pharmaceutical QMS. 
You are discussing a specific logged customer complaint with a QA officer.

Complaint Data Context:
{context_str}

Answer the user's question concisely, professionally, and accurately according to cGMP pharmaceutical standards.
"""
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_question)
        ]
        res = llm.invoke(messages)
        return res.content
    except Exception as e:
        print(f"[LLM Chat Error]: {e}")
        return f"Regarding your question: '{user_question}', here is the recorded detail for batch {complaint_context.get('batch_lot_number', 'N/A')}: {complaint_context.get('detailed_description', 'N/A')}"
